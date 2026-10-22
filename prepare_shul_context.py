#!/usr/bin/env python3
"""
Prepares raw context data for the weekly Shul summary LLM agent.
Dumps all data into /tmp/shul_context.json.
"""
import io
import json
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


def get_times() -> dict:
    req = urllib.request.Request(TIMES_JSON_URL, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def get_unisyn_content() -> str:
    try:
        req = urllib.request.Request(UNISYN_PAGE_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            html = resp.read().decode("utf-8")
        
        pdf_match = re.search(r'data="([^"]+\.pdf)"', html) or re.search(r'href="([^"]+\.pdf)"', html)
        pdf_text = ""
        if pdf_match:
            pdf_url = pdf_match.group(1)
            if pdf_url.startswith("/"):
                pdf_url = "https://unisyn.org.il" + pdf_url
            pdf_req = urllib.request.Request(pdf_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(pdf_req, timeout=30) as resp:
                pdf_bytes = resp.read()
            reader = PdfReader(io.BytesIO(pdf_bytes))
            pdf_text = "\n".join(p.extract_text() for p in reader.pages)
        
        # Simple text strip of HTML
        clean_html = re.sub(r"<[^>]+>", " ", html)
        clean_html = re.sub(r"\s+", " ", clean_html)
        return (clean_html[:3000] + "\n\n--- PDF CONTENT ---\n" + pdf_text)[:15000]
    except Exception as e:
        print(f"Error fetching UniSyn: {e}", file=sys.stderr)
        return ""


def get_hebcal_events() -> list[str]:
    today = datetime.now()
    events = []
    try:
        for i in range(8):
            d = today + timedelta(days=i)
            url = f"https://www.hebcal.com/converter?cfg=json&gy={d.year}&gm={d.month}&gd={d.day}&g2h=1"
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("events"):
                    events.append(f"{d.strftime('%Y-%m-%d')}: {', '.join(data['events'])}")
    except Exception as e:
        print(f"Hebcal error: {e}", file=sys.stderr)
    return events


def main():
    print("Collecting shul data...")
    times = get_times()
    bar_mitzvah = fetch_sheet(SHEETS["bar_mitzvah"])
    anim_zmirot = fetch_sheet(SHEETS["anim_zmirot"])
    unisyn = get_unisyn_content()
    hebcal = get_hebcal_events()

    context = {
        "today": datetime.now().strftime("%Y-%m-%d"),
        "times": times,
        "bar_mitzvah_sheet": bar_mitzvah,
        "anim_zmirot_sheet": anim_zmirot,
        "unisyn_content": unisyn,
        "hebcal_events": hebcal,
    }

    out_path = "/tmp/shul_context.json"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(context, f, ensure_ascii=False, indent=2)
    print(f"Saved shul context to {out_path} ({len(json.dumps(context))} bytes)")


if __name__ == "__main__":
    main()
