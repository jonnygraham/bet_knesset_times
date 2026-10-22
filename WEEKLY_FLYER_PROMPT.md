# Weekly Shabbat Flyer Generator & Telegram Sender Prompt

Run the following workflow to completion without waiting for user confirmation:

## 1. Determine Israel Daylight Saving Time (`dst=true` vs `dst=false`)
Determine whether Israel (`Asia/Jerusalem`) is in Daylight Saving Time (IDT, UTC+3) or Standard Time (IST, UTC+2) for the upcoming Shabbat (Saturday), and set `DST_PARAM` accordingly (`true` or `false`):

```bash
DST_PARAM=$(python3 -c '
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
now_il = datetime.now(ZoneInfo("Asia/Jerusalem"))
days_to_sat = (5 - now_il.weekday()) % 7
shabbat_il = now_il + timedelta(days=days_to_sat)
print("true" if bool(shabbat_il.dst()) else "false")
')
echo "Using dst=${DST_PARAM}"
```

## 2. Download the Weekly Shabbat `.docx` & Render `1080x1920` (9:16) Screenshot
Download the `.docx` from the CloudFront endpoint with `?dst=${DST_PARAM}`, render a `1080x1920` (9:16 portrait) PNG screenshot of the document, and extract its Hebrew text:

```bash
curl -sL "https://d1dv96azwhiqeg.cloudfront.net/docx?dst=${DST_PARAM}" -o /tmp/shabbat_times.docx
python3 /home/pi/git/bet_knesset_times/render_docx.py /tmp/shabbat_times.docx /tmp/shabbat_docx_screenshot.png
cp /tmp/shabbat_docx_screenshot.png /home/pi/dev/node/public/shabbat_docx_screenshot.png
```

## 3. Identify This Week's Parsha in Israel
Read the extracted text output from `render_docx.py` (specifically the second line, e.g. `שבת – פרשת ...`) and verify the Parsha/holiday read in Israel this week.
Choose visual, biblical/traditional motifs that represent the theme of this week's Parsha in Israel (for example: Noah's Ark, rainbow, and dove for *Parshat Noach*; Abraham's journey under a starry sky / desert tents for *Parshat Lech Lecha*; the three angels by the terebinth trees of Mamre for *Parshat Vayera*, etc.).

## 4. Generate the Parsha-Themed `9:16` Portrait Flyer via AI Image Generator
Invoke the `image-generator` subagent (`Model: "inherit"`) with a prompt instructing it to:
1. Use `AspectRatio: "9:16"` (vertical portrait 1080x1920 ratio) for all `generate_image` calls.
2. First generate a clean `9:16` portrait Parsha-themed background illustration (no text) with the artwork framed around the top, bottom, and side borders and a clean, light, warm cream/parchment central 70% area.
3. Then call `generate_image` with `AspectRatio: "9:16"` passing both `/tmp/shabbat_docx_screenshot.png` and the generated background in `ImagePaths`, compositing the exact Hebrew prayer schedule from `/tmp/shabbat_docx_screenshot.png` onto the central parchment area so that the dark brown (`#864904`) Hebrew lettering and prayer times remain 100% sharp, unmodified, and legible.
4. Reply with the generated composite image file path.

*(Wait for the `image-generator` subagent to finish and return the generated image path before proceeding to Step 5.)*

## 5. Verify, Resize to Exact `1080x1920`, Publish, and Send via Telegram
1. View the generated flyer image using `view_file` to verify that all Hebrew text and prayer times match `/tmp/shabbat_docx_screenshot.png` accurately.
2. Resize/save the final image at exact `1080x1920` resolution to `/home/pi/dev/node/public/shabbat_flyer.jpg`:

```bash
python3 -c '
import sys
from PIL import Image
im = Image.open(sys.argv[1]).convert("RGB")
if im.size != (1080, 1920):
    im = im.resize((1080, 1920), Image.Resampling.LANCZOS)
im.save("/home/pi/dev/node/public/shabbat_flyer.jpg", quality=95)
print("Saved final 1080x1920 flyer:", im.size)
' "<GENERATED_IMAGE_PATH>"
```

3. Send the final `1080x1920` flyer image to Telegram using the Telegram Bot credentials from your workspace rules (`sendPhoto` endpoint) with a Hebrew caption for the Parsha:

```bash
curl -s -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/sendPhoto" \
  -F "chat_id=<TELEGRAM_CHAT_ID>" \
  -F "photo=@/home/pi/dev/node/public/shabbat_flyer.jpg" \
  -F "caption=שבת שלום - זמני תפילות $(python3 -c '
import zipfile, xml.etree.ElementTree as ET
with zipfile.ZipFile("/tmp/shabbat_times.docx") as z:
    root = ET.fromstring(z.read("word/document.xml"))
ns = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
ps = ["".join(t.text for t in p.findall(".//w:t", ns) if t.text).strip() for p in root.findall(".//w:body/w:p", ns)]
ps = [p for p in ps if p]
print(ps[1] if len(ps) > 1 else "שבת שלום")
')"
```
