#!/usr/bin/env python3
import sys
import zipfile
import xml.etree.ElementTree as ET
from PIL import Image, ImageDraw, ImageFont

DOCX_PATH = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shabbat_times.docx'
OUT_PATH = sys.argv[2] if len(sys.argv) > 2 else '/tmp/shabbat_docx_screenshot.png'

with zipfile.ZipFile(DOCX_PATH) as z:
    doc_xml = ET.fromstring(z.read('word/document.xml'))

ns = {'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}

# 9:16 Portrait (1080x1920)
W, H = 1080, 1920
scale = W / 11907.0
pt_to_px = 140.0 / 72.0

img = Image.new('RGB', (W, H), 'white')
draw = ImageDraw.Draw(img)

FONT_REG = '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
FONT_BOLD = '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf'

def get_font(half_pts, bold=False):
    pts = half_pts / 2.0
    px = int(round(pts * pt_to_px))
    return ImageFont.truetype(FONT_BOLD if bold else FONT_REG, px)

margin_top = int(1600 * scale)
margin_right = int(1300 * scale)
header_y = int(900 * scale)

# Draw Header: בס"ד on top right
hdr_font = get_font(32, bold=False)
draw.text((W - margin_right, header_y), 'בס"ד', font=hdr_font, fill='#000000', anchor='ra', direction='rtl')

y = margin_top + 40
extracted_lines = []

for p in doc_xml.findall('.//w:body/w:p', ns):
    pPr = p.find('w:pPr', ns)
    jc = 'right'
    default_sz = 36
    default_bold = False
    default_color = '#864904'
    if pPr is not None:
        jc_el = pPr.find('w:jc', ns)
        if jc_el is not None:
            jc = jc_el.attrib.get(f'{{{ns["w"]}}}val', 'right')
        rPr = pPr.find('w:rPr', ns)
        if rPr is not None:
            sz_el = rPr.find('w:sz', ns)
            if sz_el is not None:
                default_sz = int(sz_el.attrib.get(f'{{{ns["w"]}}}val', 36))
            if rPr.find('w:b', ns) is not None:
                default_bold = True
            c_el = rPr.find('w:color', ns)
            if c_el is not None:
                val = c_el.attrib.get(f'{{{ns["w"]}}}val', '864904')
                if val != 'auto':
                    default_color = '#' + val

    runs = []
    for r in p.findall('w:r', ns):
        t_els = r.findall('w:t', ns)
        text = ''.join([t.text for t in t_els if t.text])
        if not text:
            continue
        rPr = r.find('w:rPr', ns)
        sz = default_sz
        bold = default_bold
        color = default_color
        if rPr is not None:
            sz_el = rPr.find('w:sz', ns)
            if sz_el is not None:
                sz = int(sz_el.attrib.get(f'{{{ns["w"]}}}val', sz))
            if rPr.find('w:b', ns) is not None:
                bold = True
            c_el = rPr.find('w:color', ns)
            if c_el is not None:
                val = c_el.attrib.get(f'{{{ns["w"]}}}val', '864904')
                if val != 'auto':
                    color = '#' + val
        runs.append((text, sz, bold, color))

    if not runs:
        y += int(default_sz / 2.0 * pt_to_px * 1.2)
        continue

    full_line = ''.join(r[0] for r in runs).strip()
    if full_line:
        extracted_lines.append(full_line)

    all_same_style = len(set((r[1], r[2], r[3]) for r in runs)) == 1
    max_sz = max(r[1] for r in runs)
    line_height = int(max_sz / 2.0 * pt_to_px * 1.4)

    if all_same_style:
        full_text = ''.join(r[0] for r in runs)
        sz, bold, color = runs[0][1], runs[0][2], runs[0][3]
        font = get_font(sz, bold)
        if jc == 'center':
            draw.text((W // 2, y + line_height // 2), full_text, font=font, fill=color, anchor='mm', direction='rtl')
        else:
            draw.text((W - margin_right - int(346 * scale), y + line_height // 2), full_text, font=font, fill=color, anchor='rm', direction='rtl')
    else:
        pieces = []
        total_w = 0
        for text, sz, bold, color in runs:
            font = get_font(sz, bold)
            bbox = draw.textbbox((0, 0), text, font=font, direction='rtl')
            w = bbox[2] - bbox[0]
            pieces.append((text, font, color, w))
            total_w += w
        if jc == 'center':
            curr_right = (W + total_w) // 2
        else:
            curr_right = W - margin_right
        baseline_y = y + int(max_sz / 2.0 * pt_to_px)
        for text, font, color, w in pieces:
            draw.text((curr_right, baseline_y), text, font=font, fill=color, anchor='rs', direction='rtl')
            curr_right -= w

    y += line_height

img.save(OUT_PATH)
print(f"Saved 1080x1920 screenshot to {OUT_PATH}")
print("--- EXTRACTED TEXT ---")
for line in extracted_lines:
    print(line)
