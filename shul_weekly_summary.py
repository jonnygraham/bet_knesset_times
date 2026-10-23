#!/usr/bin/env python3
"""
Local Shul Weekly Summary Generator & Telegram Sender
Fetches tefillah times, Google Sheets aliyot/anim zmirot, UniSyn dinim, and Hebcal molad,
formats the message, and sends to Telegram.
Runs 100% locally with 0 API tokens / 0 external AI credits.
"""
import argparse
import io
import json
import os
import re
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pypdf import PdfReader

SHEETS = {
    "bar_mitzvah": "1He76e8XjXrfSs9mvtVDWtIeeckv_YVuM9t-tcFpJLvo",
    "anim_zmirot": "10MS7JaKlz6ZHq6nD0P-G2oCpAxLTzzSBMClp-wc7rHI",
}
TIMES_JSON_URL = "https://akxhxwhqfecfqv3dm6gu7y7d7u0kmqft.lambda-url.us-east-1.on.aws/"
UNISYN_PAGE_URL = "https://unisyn.org.il/%D7%9C%D7%95%D7%97-%D7%93%D7%99%D7%A0%D7%99%D7%9D-%D7%95%D7%9E%D7%A0%D7%94%D7%92%D7%99%D7%9D"
def get_telegram_creds() -> tuple[str, str]:
    """Retrieve Telegram bot token and chat ID from environment or picoclaw configuration."""
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if token and chat_id:
        return token, chat_id

    try:
        sec_path = os.path.expanduser("~/.picoclaw/.security.yml")
        if os.path.exists(sec_path) and not token:
            with open(sec_path, "r", encoding="utf-8") as f:
                for line in f:
                    if "token:" in line:
                        token = line.split("token:")[1].strip().strip('"').strip("'")
                        break

        cfg_path = os.path.expanduser("~/.picoclaw/config.json")
        if os.path.exists(cfg_path) and not chat_id:
            with open(cfg_path, "r", encoding="utf-8") as f:
                cfg = json.load(f)
                allow_from = cfg.get("telegram", {}).get("allow_from", [])
                if allow_from:
                    chat_id = str(allow_from[0])
    except Exception as e:
        print(f"Warning: Failed to load Telegram credentials from picoclaw: {e}", file=sys.stderr)

    return token or "", chat_id or ""


def fetch_sheet(sheet_id: str) -> list[dict]:
    url = f"https://docs.google.com/spreadsheets/d/{sheet_id}/gviz/tq?tqx=out:json"
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=15) as resp:
        content = resp.read().decode("utf-8")
    match = re.search(r"setResponse\((.+)\);?\s*$", content)
    if not match:
        return []
    data = json.loads(match.group(1))
    cols = [c.get("label", "") for c in data["table"]["cols"]]
    all_rows = data["table"]["rows"]
    if all(not c for c in cols) and all_rows:
        cols = [(cell["v"] if cell else "") for cell in all_rows[0]["c"]]
        all_rows = all_rows[1:]
    return [{cols[i]: (cell["v"] if cell else None) for i, cell in enumerate(row["c"])} for row in all_rows]


def get_shabbat_times() -> dict:
    req = urllib.request.Request(TIMES_JSON_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_aliyot(parsha: str) -> list[str]:
    rows = fetch_sheet(SHEETS["bar_mitzvah"])
    matches = [r for r in rows if r.get("פרשה") == parsha]
    return [f"{r.get('שם פרטי', '')} {r.get('שם משפחה', '')}".strip() for r in matches if r.get("שם פרטי") or r.get("שם משפחה")]


def get_anim_zmirot(parsha: str) -> str:
    rows = fetch_sheet(SHEETS["anim_zmirot"])
    p_clean = parsha.replace("-", " ").strip()
    # 1. Exact match
    for r in rows:
        row_p = str(r.get("פרשה", "")).strip()
        if row_p == parsha or row_p.replace("-", " ").strip() == p_clean:
            boy = r.get("שם הילד", "")
            if boy:
                return str(boy).strip()
    # 2. Whole word substring match (e.g. "צו" in "צו - שבת הגדול")
    for r in rows:
        row_p = str(r.get("פרשה", "")).strip()
        if re.search(r'(?:^|[\s\-])' + re.escape(parsha) + r'(?:$|[\s\-])', row_p):
            boy = r.get("שם הילד", "")
            if boy:
                return str(boy).strip()
    return "לא נקבע"


def get_unisyn_dinim(parsha: str) -> dict:
    """Extract dinim for parsha from UniSyn monthly PDF"""
    try:
        req = urllib.request.Request(UNISYN_PAGE_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8")
        
        pdf_match = re.search(r'data="([^"]+\.pdf)"', html) or re.search(r'href="([^"]+\.pdf)"', html)
        if not pdf_match:
            return {}
        
        pdf_url = pdf_match.group(1)
        if pdf_url.startswith("/"):
            pdf_url = "https://unisyn.org.il" + pdf_url
            
        pdf_req = urllib.request.Request(pdf_url, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(pdf_req, timeout=30) as resp:
            pdf_bytes = resp.read()
            
        reader = PdfReader(io.BytesIO(pdf_bytes))
        full_text = "\n".join(p.extract_text() for p in reader.pages)
        
        pattern = r"שבת\s+פרשת\s+" + re.escape(parsha.replace(" ", "[-־ ]"))
        match = re.search(pattern, full_text)
        if not match:
            for part in parsha.split():
                m = re.search(r"שבת\s+פרשת[^\n]*" + re.escape(part), full_text)
                if m:
                    match = m
                    break
        
        dinim = {}
        if match:
            section = full_text[match.start():match.start() + 1500]
            end_match = re.search(r"(?:שבת\s+פרשת|\)\d{1,2}/\d{1,2}/202\d|\nאירועי\s+החודש)", section[30:])
            if end_match:
                section = section[:30 + end_match.start()]
                
            lines = [l.strip() for l in section.split("\n") if l.strip()]
            for i, line in enumerate(lines):
                if "ספרי תורה" in line and i + 1 < len(lines):
                    dinim["ספרי תורה"] = lines[i+1]
                elif "קריאה בתורה" in line and i + 1 < len(lines):
                    dinim["קריאה בתורה"] = lines[i+1]
                elif "הפטרה" in line and i + 1 < len(lines):
                    dinim["הפטרה"] = lines[i+1]
                    
        # Check Birkat Halevana
        if "סוף זמן ברכת הלבנה" in full_text:
            bh_idx = full_text.find("סוף זמן ברכת הלבנה")
            bh_text = full_text[bh_idx:bh_idx+200].split("\n")
            if len(bh_text) > 1:
                dinim["סוף זמן ברכת הלבנה"] = bh_text[1].strip()
                
        return dinim
    except Exception as e:
        print(f"Error fetching UniSyn: {e}", file=sys.stderr)
        return {}


def get_hebcal_info() -> dict:
    today = datetime.now()
    events = []
    molad_str = ""
    mevarchim_chodesh = ""
    try:
        for i in range(8):
            d = today + timedelta(days=i)
            url = f"https://www.hebcal.com/converter?cfg=json&gy={d.year}&gm={d.month}&gd={d.day}&g2h=1"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                evs = data.get("events", [])
                events.extend(evs)
                for ev in evs:
                    if "Molad" in ev:
                        molad_str = ev
                    if "Shabbat Mevarchim" in ev:
                        mevarchim_chodesh = ev.replace("Shabbat Mevarchim", "").strip()
    except Exception as e:
        print(f"Hebcal error: {e}", file=sys.stderr)
    return {"events": events, "molad": molad_str, "mevarchim": mevarchim_chodesh}


def generate_message() -> str:
    times = get_shabbat_times()
    parsha = times.get("parsha", "")
    is_mevarchim = times.get("is_shabbat_mevarchim", False)
    
    aliyot = get_aliyot(parsha)
    anim_boy = get_anim_zmirot(parsha)
    dinim = get_unisyn_dinim(parsha)
    hebcal = get_hebcal_info()
    
    msg = f"לכבוד גבאי בית הכנסת,\nלהלן העדכונים לשבת הקרובה (פרשת {parsha}):\n\n"
    msg += "*זמני תפילות*\n"
    msg += f"מנחה וקבלת שבת: {times.get('erev_mincha', '')}\n"
    msg += f"מנחה שבת: {times.get('day_mincha_2', '')}\n"
    msg += f"ערבית מוצאי שבת: {times.get('motzash_arvit', '')}\n"
    msg += f"מנחה (ימי חול): {times.get('week_mincha', '')}\n"
    msg += f"ערבית (ימי חול): {times.get('week_arvit_1', '')}\n\n"
    
    msg += f"*דינים ומנהגים*\nלשבת פרשת {parsha}:\n"
    if dinim.get("ספרי תורה"):
        msg += f"• מניין ספרי תורה: {dinim['ספרי תורה']}\n"
    if dinim.get("קריאה בתורה"):
        msg += f"• קריאה בתורה: {dinim['קריאה בתורה']}\n"
    if dinim.get("הפטרה"):
        msg += f"• הפטרה: {dinim['הפטרה']}\n"
    if dinim.get("סוף זמן ברכת הלבנה"):
        msg += f"• סוף זמן ברכת הלבנה: {dinim['סוף זמן ברכת הלבנה']}\n"
    msg += "\n"
    
    if is_mevarchim or hebcal.get("mevarchim"):
        msg += "*ברכת החודש*\n"
        if hebcal.get("mevarchim"):
            msg += f"שבת מברכים {hebcal['mevarchim']}\n"
        if hebcal.get("molad"):
            msg += f"המולד: {hebcal['molad']}\n"
        msg += "\n"
        
    msg += "*עליות לפרשת בר מצוה*\n"
    if aliyot:
        msg += "\n".join(aliyot) + "\n\n"
    else:
        msg += "אין עליות לפרשה זו\n\n"
        
    msg += f"*אנעים זמירות*\n{anim_boy}"
    
    return msg


def send_telegram(message: str) -> bool:
    token, chat_id = get_telegram_creds()
    if not token or not chat_id:
        print("Error: Telegram credentials (bot token or chat ID) not configured.", file=sys.stderr)
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": "Markdown",
    }
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            res = json.loads(resp.read().decode("utf-8"))
            return res.get("ok", False)
    except Exception as e:
        print(f"Error sending message to Telegram: {e}", file=sys.stderr)
        return False


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate and send weekly shul message.")
    parser.add_argument("--send", action="store_true", help="Send message to Telegram")
    args = parser.parse_args()
    
    message = generate_message()
    print("=== Generated Message ===")
    print(message)
    print("=========================")
    
    if args.send:
        ok = send_telegram(message)
        print(f"Sent to Telegram: {'SUCCESS' if ok else 'FAILED'}")
