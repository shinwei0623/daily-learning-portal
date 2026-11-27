#!/usr/bin/env python3
"""依內容檔產出宜蘭見聞 A4 PDF（不依賴瀏覽器）。"""
from __future__ import annotations

import os
import re
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
CONTENT = ROOT / "src/content/yilan"
PUBLIC = ROOT / "public"
OUT_PUBLIC = PUBLIC / "pdfs"
OUT_DIST = ROOT / "dist" / "pdfs"

# A4 at 200 dpi
DPI = 200
W = round(210 / 25.4 * DPI)
H = round(297 / 25.4 * DPI)
MARGIN = round(12 / 25.4 * DPI)

FONT_REG = "/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"
FONT_BOLD = "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"
TC = 3

SEA = (12, 107, 94)
INK = (28, 25, 23)
SOFT = (74, 67, 60)
LINE = (228, 216, 200)
PAPER = (255, 253, 248)



def credit_line() -> str:
    """頁尾支持單位。預設維持宜蘭高中員生合作社原文；Charming 版另加粉專名稱。"""
    defaults = {
        "ylsh": "日日學網站由宜蘭高中員生合作社支持建置",
        "charming": "日日學網站由 Charming 支持分享",
    }
    brand = (os.environ.get("BRAND") or "ylsh").strip().lower()
    if brand not in defaults:
        brand = "ylsh"
    text = os.environ.get("SUPPORTER_TEXT") or defaults[brand]
    if brand == "charming":
        label = os.environ.get("BRAND_LINK_LABEL") or "Charming 粉專"
        if label and label not in text:
            return f"{text} · {label}"
    return text


def font(bold: bool, size: int) -> ImageFont.FreeTypeFont:
    path = FONT_BOLD if bold else FONT_REG
    return ImageFont.truetype(path, size, index=TC)


def parse_md(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    _, fm, body = text.split("---", 2)
    data: dict = {"sources": [], "body": body.strip()}
    current = None
    for raw in fm.splitlines():
        line = raw.rstrip()
        if m := re.match(r"^(\w+):\s*(.*)$", line):
            key, val = m.group(1), m.group(2).strip().strip('"')
            if key == "sources":
                current = "sources"
                continue
            data[key] = val
            current = None
        elif current == "sources" and (m := re.match(r"^\s+-\s+title:\s*(.*)$", line)):
            data["sources"].append({"title": m.group(1).strip().strip('"')})
        elif current == "sources" and data["sources"] and (m := re.match(r"^\s+(url|note):\s*(.*)$", line)):
            data["sources"][-1][m.group(1)] = m.group(2).strip().strip('"')
    return data


def wrap(draw: ImageDraw.ImageDraw, text: str, fnt, width: int) -> list[str]:
    lines: list[str] = []
    for para in text.split("\n"):
        para = para.strip() or " "
        buf = ""
        for ch in para:
            trial = buf + ch
            if draw.textlength(trial, font=fnt) <= width:
                buf = trial
            else:
                lines.append(buf)
                buf = ch
        lines.append(buf)
    return lines


def format_date(iso: str) -> str:
    y, m, d = iso.split("-")
    return f"{int(y)}年{int(m)}月{int(d)}日"


def render_one(data: dict, dest: Path) -> None:
    img = Image.new("RGB", (W, H), PAPER)
    draw = ImageDraw.Draw(img)
    x0, y = MARGIN, MARGIN
    usable = W - 2 * MARGIN

    kicker = font(True, 22)
    title_f = font(True, 40)
    meta_f = font(False, 20)
    body_f = font(False, 28)
    small = font(False, 16)

    draw.text((x0, y), "日日學 · 宜蘭每日見聞", font=kicker, fill=SEA)
    y += 36
    # title wrap
    title_lines = wrap(draw, data["title"], title_f, usable)
    for line in title_lines:
        draw.text((x0, y), line, font=title_f, fill=INK)
        y += 50
    chars = len(re.sub(r"\s+", "", data["body"]))
    draw.text((x0, y), f"{format_date(data['date'])}  ·  {chars} 字  ·  公益學習、可供張貼", font=meta_f, fill=SOFT)
    y += 40

    photo_path = PUBLIC / data["image"]
    photo = Image.open(photo_path).convert("RGB")
    max_h = round(H * 0.36)
    ratio = min(usable / photo.width, max_h / photo.height)
    pw, ph = int(photo.width * ratio), int(photo.height * ratio)
    photo = photo.resize((pw, ph), Image.Resampling.LANCZOS)
    img.paste(photo, (x0, y))
    draw.rectangle((x0, y, x0 + pw, y + ph), outline=LINE, width=2)
    y += ph + 10

    credit = f"{data.get('image_credit','')} 授權：{data.get('image_license','')}。作者：{data.get('image_author','')}。"
    for line in wrap(draw, credit, small, usable):
        draw.text((x0, y), line, font=small, fill=SOFT)
        y += 24
    y += 10

    for line in wrap(draw, data["body"], body_f, usable):
        draw.text((x0, y), line, font=body_f, fill=INK)
        y += 42
    y += 16

    draw.text((x0, y), "資料來源", font=kicker, fill=SEA)
    y += 32
    for src in data["sources"]:
        block = src.get("title", "")
        if src.get("url"):
            block += f"（{src['url']}）"
        if src.get("note"):
            block += f" — {src['note']}"
        for line in wrap(draw, block, small, usable):
            draw.text((x0, y), line, font=small, fill=SOFT)
            y += 24
        y += 6

    footer = "本頁為非營利公益學習用途。建議以 A4 直式列印。"
    credit = credit_line()
    fw = draw.textlength(footer, font=small)
    draw.text(((W - fw) / 2, H - MARGIN - 44), footer, font=small, fill=SOFT)
    credit_f = font(False, 15)
    cw = draw.textlength(credit, font=credit_f)
    draw.text(((W - cw) / 2, H - MARGIN - 18), credit, font=credit_f, fill=SOFT)

    dest.parent.mkdir(parents=True, exist_ok=True)
    img.save(dest, "PDF", resolution=DPI, title=data["title"])
    print(f"pdf {dest} ({dest.stat().st_size} bytes)")


def main() -> int:
    files = sorted(CONTENT.glob("*.md"))
    if not files:
        print("沒有宜蘭內容", file=sys.stderr)
        return 1
    OUT_PUBLIC.mkdir(parents=True, exist_ok=True)
    for md in files:
        data = parse_md(md)
        name = f"yilan-{data['date']}.pdf"
        dest = OUT_PUBLIC / name
        render_one(data, dest)
        if (ROOT / "dist").exists():
            OUT_DIST.mkdir(parents=True, exist_ok=True)
            (OUT_DIST / name).write_bytes(dest.read_bytes())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
