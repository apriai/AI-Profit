#!/usr/bin/env python3
"""Regenera el .ico y el .icns a partir del PNG del acceso AI Profit.

Fuente, en este orden:
  assets/abrir-granja-icon.png
  propfarm-logo.png
  assets/propfarm-logo.png

Los instaladores del cliente no ejecutan este script (en Mac, python3
puede ser el aviso de las Command Line Tools).
  Mac:     instalar-ai-profit.command aplica assets/abrir-granja-icon.icns
  Windows: instalar-ai-profit.bat genera el .ico con System.Drawing si puede,
           y si no usa el .ico que ya está en el repositorio.

Hace falta Pillow solo en la máquina de quien actualiza estos binarios
en el repositorio (pip install pillow). No se instala en la PC de la granja.
"""
from __future__ import annotations

import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
ICO_SIZES = (16, 24, 32, 48, 64, 128, 256)

# OSTypes de iconutil para PNG dentro de un .icns.
ICNS_TYPES = (
    (16, b"icp4"),
    (32, b"icp5"),
    (32, b"ic11"),
    (64, b"icp6"),
    (64, b"ic12"),
    (128, b"ic07"),
    (256, b"ic08"),
    (256, b"ic13"),
    (512, b"ic09"),
    (512, b"ic14"),
    (1024, b"ic10"),
)


def source_png() -> Path:
    for candidate in (
        ASSETS / "abrir-granja-icon.png",
        ROOT / "propfarm-logo.png",
        ASSETS / "propfarm-logo.png",
    ):
        if candidate.is_file():
            return candidate
    raise SystemExit("No hay PNG de icono (assets/abrir-granja-icon.png).")


def write_ico(im, dest: Path) -> None:
    from PIL import Image

    resample = getattr(Image, "Resampling", Image).LANCZOS
    chunks = []
    for size in ICO_SIZES:
        frame = im.resize((size, size), resample=resample)
        from io import BytesIO

        buf = BytesIO()
        frame.save(buf, format="PNG")
        chunks.append((size, buf.getvalue()))
    count = len(chunks)
    header = struct.pack("<HHH", 0, 1, count)
    entries = b""
    offset = 6 + 16 * count
    payload = b""
    for size, data in chunks:
        dim = 0 if size >= 256 else size
        entries += struct.pack("<BBBBHHII", dim, dim, 0, 0, 1, 32, len(data), offset)
        offset += len(data)
        payload += data
    dest.write_bytes(header + entries + payload)


def write_icns(im, dest: Path) -> None:
    from PIL import Image

    resample = getattr(Image, "Resampling", Image).LANCZOS
    body = b""
    for size, ostype in ICNS_TYPES:
        frame = im.resize((size, size), resample=resample)
        from io import BytesIO

        buf = BytesIO()
        frame.save(buf, format="PNG")
        data = buf.getvalue()
        body += ostype + struct.pack(">I", len(data) + 8) + data
    dest.write_bytes(b"icns" + struct.pack(">I", len(body) + 8) + body)


def main() -> None:
    try:
        from PIL import Image
    except ImportError:
        raise SystemExit(
            "Falta Pillow en esta máquina de edición. "
            "Los instaladores de Mac y Windows convierten el PNG solos."
        )
    src = source_png()
    im = Image.open(src).convert("RGBA")
    ico = ASSETS / "abrir-granja-icon.ico"
    icns = ASSETS / "abrir-granja-icon.icns"
    write_ico(im, ico)
    write_icns(im, icns)
    print(f"PNG:  {src} ({im.size[0]}x{im.size[1]})")
    print(f"ICO:  {ico} ({ico.stat().st_size} bytes)")
    print(f"ICNS: {icns} ({icns.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
