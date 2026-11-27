#!/usr/bin/env python3
"""確認建置成果不含宜蘭高中／員生合作社品牌（宜蘭縣地理內文除外）。"""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

FORBIDDEN = re.compile(r"宜蘭高中|員生合作社|ylsh\.ilc|gapp\.ylsh")
TEXT_SUFFIXES = {".html", ".css", ".js", ".mjs", ".json", ".xml", ".svg", ".txt", ".md", ".map"}


def check_text_files(root: Path) -> list[str]:
    hits = []
    for path in root.rglob("*"):
        if not path.is_file():
            continue
        if path.suffix.lower() not in TEXT_SUFFIXES:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            text = path.read_text(encoding="utf-8", errors="ignore")
        if FORBIDDEN.search(text):
            hits.append(str(path.relative_to(root)))
    return hits


def pdf_text(path: Path) -> str:
    try:
        out = subprocess.run(
            ["pdftotext", "-enc", "UTF-8", str(path), "-"],
            check=False,
            capture_output=True,
        )
        return (out.stdout or b"").decode("utf-8", errors="ignore")
    except FileNotFoundError:
        return ""


def check_pdfs(root: Path) -> list[str]:
    hits = []
    for path in root.rglob("*.pdf"):
        data = path.read_bytes()
        raw = data.decode("latin-1", errors="ignore")
        extracted = pdf_text(path)
        blob = extracted + "\n" + raw
        # UTF-8 / UTF-16 school strings inside the file
        for needle in (
            "宜蘭高中".encode("utf-8"),
            "員生合作社".encode("utf-8"),
            "ylsh.ilc".encode("ascii"),
            "gapp.ylsh".encode("ascii"),
            "宜蘭高中".encode("utf-16-le"),
            "宜蘭高中".encode("utf-16-be"),
            "員生合作社".encode("utf-16-le"),
            "員生合作社".encode("utf-16-be"),
        ):
            if needle in data:
                hits.append(f"{path.relative_to(root)} (binary)")
                break
        else:
            if FORBIDDEN.search(extracted) or FORBIDDEN.search(raw):
                hits.append(f"{path.relative_to(root)} (text)")
    return hits


def main() -> int:
    if len(sys.argv) != 2:
        print("用法：assert-brand-clean.py <dist目錄>", file=sys.stderr)
        return 2
    root = Path(sys.argv[1]).resolve()
    if not root.is_dir():
        print(f"找不到目錄：{root}", file=sys.stderr)
        return 2
    hits = check_text_files(root) + check_pdfs(root)
    if hits:
        print("Charming 建置仍含宜蘭高中／員生合作社品牌：", file=sys.stderr)
        for h in hits:
            print(f"  - {h}", file=sys.stderr)
        return 1
    print(f"通過：{root} 未發現宜蘭高中／員生合作社／ylsh 品牌字樣")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
