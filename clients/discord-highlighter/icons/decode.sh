#!/usr/bin/env bash
# Decode checked-in *.png.b64 files into PNGs. Missing 48/128 sizes are scaled from 32.
set -euo pipefail

ICON_DIR="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$ICON_DIR/../../.." && pwd)"
ROOT_ICONS="$ROOT/icons"
mkdir -p "$ROOT_ICONS"

python3 - "$ICON_DIR" "$ROOT_ICONS" <<'PY'
from pathlib import Path
import base64
import sys

icon_dir = Path(sys.argv[1])
root_icons = Path(sys.argv[2])
for src in sorted(icon_dir.glob("*.png.b64")):
    dest = src.with_suffix("")
    dest.write_bytes(base64.b64decode(src.read_text()))
    print(f"decoded {dest.name} ({dest.stat().st_size} bytes)")

try:
    from PIL import Image
except ImportError:
    Image = None

src32 = icon_dir / "icon32.png"
if Image and src32.is_file():
    compass = Image.open(src32).convert("RGBA")
    for size in (16, 48, 128):
        dest = icon_dir / f"icon{size}.png"
        if dest.is_file() and dest.stat().st_size > 0:
            continue
        compass.resize((size, size), Image.Resampling.LANCZOS).save(dest, format="PNG", optimize=True)
        print(f"scaled {dest.name}")

for size in (16, 32, 48, 128):
    src = icon_dir / f"icon{size}.png"
    if src.is_file():
        dest = root_icons / f"icon{size}.png"
        dest.write_bytes(src.read_bytes())
        print(f"copied {dest}")
PY
