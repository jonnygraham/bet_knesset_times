import asyncio
import json
import os
import re
import urllib.parse

import boto3
import httpx
from datetime import datetime
from pydantic_ai import Agent, RunContext
from pydantic_ai.settings import ModelSettings
from pydantic_ai.usage import UsageLimits
from playwright.async_api import async_playwright

SHEETS = {
    "bar_mitzvah": "1He76e8XjXrfSs9mvtVDWtIeeckv_YVuM9t-tcFpJLvo",
    "anim_zmirot": "10MS7JaKlz6ZHq6nD0P-G2oCpAxLTzzSBMClp-wc7rHI",
}
UNISYN_URL = "https://unisyn.org.il/%D7%9C%D7%95%D7%97-%D7%93%D7%99%D7%A0%D7%99%D7%9D-%D7%95%D7%9E%D7%A0%D7%94%D7%92%D7%99%D7%9D"
PHONE = "+972543041655"
TIMES_JSON_URL = os.environ.get("TIMES_JSON_URL", "")

_ssm = None
_gemini_key_loaded = False


def _get_ssm():
    global _ssm
    if _ssm is None:
        _ssm = boto3.client("ssm")
    return _ssm


def _ensure_gemini_key():
    global _gemini_key_loaded
    if not _gemini_key_loaded:
        param_name = os.environ.get("GEMINI_API_KEY_PARAM", "/shul-agent/gemini-api-key")
        os.environ["GOOGLE_API_KEY"] = _get_ssm().get_parameter(
            Name=param_name, WithDecryption=True
        )["Parameter"]["Value"]
        _gemini_key_loaded = True


def get_param(name: str) -> str:
    return _get_ssm().get_parameter(Name=name, WithDecryption=True)["Parameter"]["Value"]


async def _fetch_sheet(sheet_id: str) -> list[dict]:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=15)
    match = re.search(r"setResponse\((.+)\);?\s*$", resp.text)
    if not match:
        return []
    data = json.loads(match.group(1))
    cols = [c.get("label", "") for c in data["table"]["cols"]]
    all_rows = data["table"]["rows"]
    if all(not c for c in cols) and all_rows:
        cols = [(cell["v"] if cell else "") for cell in all_rows[0]["c"]]
        all_rows = all_rows[1:]
    return [{cols[i]: (cell["v"] if cell else None) for i, cell in enumerate(row["c"])} for row in all_rows]


async def get_aliyot(ctx: RunContext[None], parsha: str) -> str:
    """Get the list of members who get an aliyah for the given parsha name (e.g. ויקרא).
    Returns names of members whose bar mitzvah parsha matches."""
    rows = await _fetch_sheet(SHEETS["bar_mitzvah"])
    matches = [r for r in rows if r.get("פרשה") == parsha]
    names = [f"{r.get('שם פרטי', '')} {r.get('שם משפחה', '')}".strip() for r in matches]
    print(f"Aliyot for {parsha}: {names}")
    return json.dumps(names, ensure_ascii=False) if names else "אין עליות לפרשה זו"


async def get_anim_zmirot(ctx: RunContext[None]) -> str:
    """Get the full anim zmirot schedule. Returns all rows with פרשה and שם הילד columns.
    Match the upcoming parsha to find the right boy. Note: parsha names may include
    extras like 'צו - שבת הגדול' or holiday names — use fuzzy matching."""
    rows = await _fetch_sheet(SHEETS["anim_zmirot"])
    return json.dumps(rows, ensure_ascii=False)


async def get_minhagim(ctx: RunContext[None]) -> str:
    """Browse the UniSyn minhagim page and return the current month's halachic calendar content."""
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=["--no-sandbox", "--disable-gpu", "--single-process"])
        try:
            page = await browser.new_page()
            await page.goto(UNISYN_URL, timeout=30000, wait_until="networkidle")
            text = await page.inner_text("body")
        finally:
            await browser.close()
    return text[:15000]


async def get_shabbat_times(ctx: RunContext[None]) -> str:
    """Get the calculated shabbat and weekday tefillah times for the upcoming shabbat.
    Returns JSON with erev_mincha, day_mincha_2, motzash_arvit, week_mincha, week_arvit_1 etc."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(TIMES_JSON_URL, timeout=30)
    print(f"Times JSON response ({resp.status_code}): {resp.text[:2000]}")
    return resp.text[:5000]


async def _send_chunk(client: httpx.AsyncClient, api_key: str, text: str) -> int:
    url = (
        f"https://api.whatabot.net/whatsapp/sendMessage"
        f"?apikey={api_key}"
        f"&text={urllib.parse.quote(text)}"
        f"&phone={urllib.parse.quote(PHONE)}"
    )
    for attempt in range(3):
        resp = await client.get(url, timeout=30)
        print(f"WhatsApp chunk ({len(text)} chars) attempt {attempt+1}: {resp.status_code} {resp.text[:200]}")
        if resp.status_code != 429:
            return resp.status_code
        await asyncio.sleep(6)
    return resp.status_code


def _split_message(message: str, limit: int = 450) -> list[str]:
    """Split message keeping chunks under the limit. Splits on single newlines."""
    lines = message.split("\n")
    chunks, current = [], ""
    for line in lines:
        candidate = (current + "\n" + line) if current else line
        if len(candidate) > limit:
            if current:
                chunks.append(current.strip())
            current = line
        else:
            current = candidate
    if current.strip():
        chunks.append(current.strip())
    return chunks


async def _send_whatsapp(message: str):
    message = message.replace("\\'", "'").replace('\\"', '"')
    print(f"Message to send:\n{message}")
    api_key = get_param("/shul-agent/whatabot-api-key")
    chunks = _split_message(message)
    print(f"Split into {len(chunks)} chunks")
    statuses = []
    async with httpx.AsyncClient() as client:
        for i, chunk in enumerate(chunks):
            if i > 0:
                await asyncio.sleep(6)
            status = await _send_chunk(client, api_key, chunk)
            statuses.append(status)
    print(f"WhatsApp sent in {len(chunks)} parts, statuses: {statuses}")


_agent = None


MODELS = ["google-gla:gemini-2.5-flash", "google-gla:gemini-2.5-flash-lite"]


def _get_agent(model: str = MODELS[0]):
    _ensure_gemini_key()
    return Agent(
        model,
        tools=[get_minhagim, get_shabbat_times, get_aliyot, get_anim_zmirot],
        system_prompt=(
            "You are a shul (synagogue) weekly assistant preparing a WhatsApp message for the גבאים.\n"
            "1. Use get_shabbat_times to get tefillah times. The response includes the parsha name.\n"
            "2. Use get_aliyot with the parsha name to get members who get an aliyah.\n"
            "3. Use get_anim_zmirot to get the full schedule, then find the boy for this parsha.\n"
            "   Parsha names may be fuzzy (e.g. 'צו - שבת הגדול' matches צו). Use best match.\n"
            "4. Use get_minhagim to read halachic minhagim from the UniSyn page.\n"
            "5. Return a WhatsApp message in Hebrew for the גבאים with this EXACT structure:\n"
            "   a) *זמני תפילות* section with these EXACT labels:\n"
            "      מנחה וקבלת שבת: {erev_mincha}\n"
            "      מנחה שבת: {day_mincha_2}\n"
            "      ערבית מוצאי שבת: {motzash_arvit}\n"
            "      מנחה (ימי חול): {week_mincha}\n"
            "      ערבית (ימי חול): {week_arvit_1}\n"
            "   b) *דינים ומנהגים* section: key dinim for THIS Shabbat only\n"
            "   c) If this is שבת מברכים, add a separate *ברכת החודש* section stating:\n"
            "      which month, which day(s) it falls on, and the מולד (exact time).\n"
            "      Look up the molad from the minhagim page.\n"
            "   d) *עליות לפרשת בר מצוה* section: list of names\n"
            "   e) *אנעים זמירות*: the boy's name\n"
            "   IMPORTANT: Use WhatsApp formatting: *bold* (single stars), _italic_ (underscores). NOT markdown **double stars**.\n"
            "   Do NOT escape quotes. Write \" not \\\".\n"
            "Return ONLY the message text, nothing else."
        ),
    )


async def _run(weeks_ahead: int = 1, send: bool = True):
    today = datetime.now().strftime("%Y-%m-%d")
    prompt = (
        f"Today is {today}. Prepare the weekly message for the upcoming Shabbat only "
        f"(the next {weeks_ahead} Shabbat(ot))."
    )
    last_err = None
    for model in MODELS:
        for attempt in range(2):
            try:
                if attempt > 0:
                    await asyncio.sleep(15)
                print(f"Trying {model} (attempt {attempt + 1})")
                agent = _get_agent(model)
                result = await agent.run(
                    prompt,
                    model_settings=ModelSettings(max_tokens=4096),
                    usage_limits=UsageLimits(request_limit=20),
                )
                print(f"Agent completed ({model}). Usage: {result.usage()}")
                message = result.output
                if send:
                    await _send_whatsapp(message)
                else:
                    message = message.replace("\\'", "'").replace('\\"', '"')
                    print(f"Message (send=false):\n{message}")
                return message
            except Exception as e:
                last_err = e
                print(f"{model} attempt {attempt + 1} failed: {type(e).__name__}: {e}")
                if "503" not in str(e) and "429" not in str(e):
                    break  # non-transient error, try next model
    raise last_err


def handler(event, context):
    print(f"Event: {json.dumps(event, default=str)[:500]}")
    # Support weeks_ahead and send via query string or event payload
    weeks = 1
    send = True
    if isinstance(event, dict):
        qs = event.get("queryStringParameters") or {}
        weeks = int(qs.get("weeks", event.get("weeks", 1)))
        send = str(qs.get("send", event.get("send", "true"))).lower() != "false"
    try:
        loop = asyncio.get_event_loop()
        if loop.is_closed():
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    data = loop.run_until_complete(_run(weeks_ahead=weeks, send=send))
    return {"statusCode": 200, "body": data}
