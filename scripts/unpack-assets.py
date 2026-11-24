#!/usr/bin/env python3
"""Decode vendor-assets/*.b64 into public/ so the site can be built without binary git objects."""
from __future__ import annotations

import base64
import io
import tarfile
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
VENDOR = ROOT / "vendor-assets"


def decode_file(src: Path, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(base64.b64decode(src.read_text(encoding="ascii").encode("ascii")))
    print(f"unpacked {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)")


def unpack_tar(src: Path) -> None:
    data = base64.b64decode(src.read_text(encoding="ascii").encode("ascii"))
    with tarfile.open(fileobj=io.BytesIO(data), mode="r") as tar:
        for member in tar.getmembers():
            name = member.name.lstrip("./")
            if not name.startswith("public/") or member.isdir():
                continue
            dest = (ROOT / name).resolve()
            if not str(dest).startswith(str(ROOT.resolve())):
                raise SystemExit(f"refusing unsafe path: {member.name}")
            dest.parent.mkdir(parents=True, exist_ok=True)
            extracted = tar.extractfile(member)
            if extracted is None:
                continue
            dest.write_bytes(extracted.read())
            print(f"unpacked {dest.relative_to(ROOT)} ({dest.stat().st_size} bytes)")


def main() -> None:
    tar_b64 = VENDOR / "audio-and-favicon.tar.b64"
    if tar_b64.exists():
        unpack_tar(tar_b64)
    jpg = VENDOR / "2026-11-24-guishan.jpg.b64"
    if jpg.exists():
        decode_file(jpg, ROOT / "public/images/yilan/2026-11-24-guishan.jpg")
    pdf = VENDOR / "yilan-2026-11-24.pdf.b64"
    if pdf.exists():
        decode_file(pdf, ROOT / "public/pdfs/yilan-2026-11-24.pdf")


if __name__ == "__main__":
    main()
