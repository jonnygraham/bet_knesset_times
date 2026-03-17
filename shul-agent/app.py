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

SHEETS_ID = "1He76e8XjXrfSs9mvtVDWtIeeckv_YVuM9t-tcFpJLvo"
UNISYN_URL = "https://unisyn.org.il/%D7%9C%D7%95%D7%97-%D7%93%D7%99%D7%A0%D7%99%D7%9D-%D7%95%D7%9E%D7%A0%D7%94%D7%92%D7%99%D7%9D"
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


async def get_birthdays(ctx: RunContext[None]) -> str:
    """Read the member birthday list from the public Google Sheet."""
    url = f"https://docs.google.com/spreadsheets/d/{SHEETS_ID}/gviz/tq?tqx=out:json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=15)
    raw = resp.text
    # Extract JSON from google.visualization.Query.setResponse({...});
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


async def send_whatsapp(ctx: RunContext[None], message: str) -> str:
    """Send a WhatsApp message via WhataBot API. Call this with the final composed message."""
    api_key = get_param("/shul-agent/whatabot-api-key")
    url = (
        f"https://api.whatabot.net/whatsapp/sendMessage"
        f"?apikey={api_key}"
        f"&text={urllib.parse.quote(message)}"
        f"&phone={urllib.parse.quote(PHONE)}"
    )
    async with httpx.AsyncClient() as client:
        resp = await client.get(url, timeout=30)
    return f"WhatsApp sent, status: {resp.status_code}"


_agent = None


def _get_agent():
    global _agent
    if _agent is None:
        _ensure_gemini_key()
        _agent = Agent(
            "google-gla:gemini-2.5-flash",
            tools=[get_birthdays, get_minhagim, send_whatsapp],
            system_prompt=(
                "You are a shul (synagogue) weekly assistant. Your job:\n"
                "1. Use get_minhagim to read this week's and next week's halachic minhagim from the UniSyn page.\n"
                "2. Use get_birthdays to read the members spreadsheet and find anyone whose birthday "
                "falls during this week's or next week's parsha dates.\n"
                "3. Compose a clear, warm WhatsApp message in Hebrew summarizing:\n"
                "   - Key minhagim/dinim for this and next Shabbat\n"
                "   - Birthday wishes for relevant members\n"
                "4. Use send_whatsapp to send the composed message.\n"
                "Keep the message concise and friendly. Use emojis sparingly."
            ),
        )
    return _agent


async def _run():
    agent = _get_agent()
    today = datetime.now().strftime("%Y-%m-%d")
    try:
        result = await agent.run(
            f"Today is {today}. Please look up this week's minhagim, check for birthdays, "
            f"compose the WhatsApp message, and send it.",
            model_settings=ModelSettings(max_tokens=4096),
            usage_limits=UsageLimits(request_limit=10),
        )
        print(f"Agent completed. Usage: {result.usage()}")
        return result.data
    except Exception as e:
        print(f"Agent failed: {type(e).__name__}: {e}")
        raise


def handler(event, context):
    import asyncio
    loop = asyncio.new_event_loop()
    try:
        data = loop.run_until_complete(_run())
        return {"statusCode": 200, "body": data}
    finally:
        loop.close()
