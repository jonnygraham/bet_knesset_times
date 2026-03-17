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
}
UNISYN_URL = "https://unisyn.org.il/%D7%9C%D7%95%D7%97-%D7%93%D7%99%D7%A0%D7%99%D7%9D-%D7%95%D7%9E%D7%A0%D7%94%D7%92%D7%99%D7%9D"
TIMES_LAMBDA_URL = "https://y4knms6qijsgs6yzrx462uvxxm0xuepq.lambda-url.us-east-1.on.aws/"
PHONE = "+972543041655"

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


async def get_sheet_data(ctx: RunContext[None], sheet_name: str) -> str:
    """Read data from a named Google Sheet. Available sheets: bar_mitzvah.
    The bar_mitzvah sheet contains members' bar mitzvah dates (Hebrew birthday)."""
    sheet_id = SHEETS.get(sheet_name)
    if not sheet_id:
        return json.dumps({"error": f"Unknown sheet: {sheet_name}. Available: {list(SHEETS.keys())}"})
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=15)
    raw = resp.text
    match = re.search(r"setResponse\((.+)\);?\s*$", raw)
    if not match:
        return json.dumps({"error": "Could not parse Google Sheets response"})
    data = json.loads(match.group(1))
    cols = [c.get("label", "") for c in data["table"]["cols"]]
    rows = []
    for row in data["table"]["rows"]:
        rows.append({cols[i]: (cell["v"] if cell else None) for i, cell in enumerate(row["c"])})
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
    Returns times like erev_mincha, shacharit, mincha, arvit, motzash etc."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(TIMES_LAMBDA_URL, timeout=30)
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


async def send_whatsapp(ctx: RunContext[None], message: str) -> str:
    """Send a WhatsApp message via WhataBot API. Call this with the final composed message."""
    api_key = get_param("/shul-agent/whatabot-api-key")
    print(f"Message to send:\n{message}")
    chunks = _split_message(message)
    print(f"Split into {len(chunks)} chunks")
    statuses = []
    async with httpx.AsyncClient() as client:
        for i, chunk in enumerate(chunks):
            if i > 0:
                await asyncio.sleep(6)
            status = await _send_chunk(client, api_key, chunk)
            statuses.append(status)
    return f"WhatsApp sent in {len(chunks)} parts, statuses: {statuses}"


_agent = None


def _get_agent():
    global _agent
    if _agent is None:
        _ensure_gemini_key()
        _agent = Agent(
            "google-gla:gemini-2.5-flash",
            tools=[get_sheet_data, get_minhagim, get_shabbat_times, send_whatsapp],
            system_prompt=(
                "You are a shul (synagogue) weekly assistant preparing a message for the Gabbays.\n"
                "1. Use get_minhagim to read the halachic minhagim from the UniSyn page.\n"
                "2. Use get_sheet_data with sheet_name='bar_mitzvah' to read the members spreadsheet.\n"
                "   The dates are bar mitzvah dates (Hebrew birthday).\n"
                "   Find anyone whose bar mitzvah date falls during the relevant parsha week(s).\n"
                "   These people should be offered an aliyah on that Shabbat.\n"
                "3. Use get_shabbat_times to get the calculated tefillah times for the upcoming shabbat.\n"
                "4. Compose a clear WhatsApp message in Hebrew for the Gabbays summarizing:\n"
                "   - Shabbat tefillah times (candle lighting, shacharit, mincha, arvit, motzash, weekday times)\n"
                "   - Key minhagim/dinim for the relevant Shabbat(ot)\n"
                "   - List of members who should get an aliyah (bar mitzvah anniversary)\n"
                "5. Use send_whatsapp to send the composed message.\n"
                "Keep the message concise and practical."
            ),
        )
    return _agent


async def _run(weeks_ahead: int = 1):
    agent = _get_agent()
    today = datetime.now().strftime("%Y-%m-%d")
    prompt = (
        f"Today is {today}. Please look up minhagim, shabbat times, and bar mitzvah aliyot "
        f"for the next {weeks_ahead} week(s) of Shabbat, compose the message, and send it."
    )
    try:
        result = await agent.run(
            prompt,
            model_settings=ModelSettings(max_tokens=4096),
            usage_limits=UsageLimits(request_limit=15),
        )
        print(f"Agent completed. Usage: {result.usage()}")
        return result.output
    except Exception as e:
        print(f"Agent failed: {type(e).__name__}: {e}")
        raise


def handler(event, context):
    # Support weeks_ahead via query string or event payload
    weeks = 1
    if isinstance(event, dict):
        qs = event.get("queryStringParameters") or {}
        weeks = int(qs.get("weeks", event.get("weeks", 1)))
    loop = asyncio.new_event_loop()
    try:
        data = loop.run_until_complete(_run(weeks_ahead=weeks))
        return {"statusCode": 200, "body": data}
    finally:
        loop.close()
