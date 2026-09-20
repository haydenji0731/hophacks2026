#!/usr/bin/env bash
# Decode the checked-in *.png.b64 files into PNGs Chrome can load.
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
    dest = src.with_suffix("")  # icon16.png.b64 -> icon16.png
    dest.write_bytes(base64.b64decode(src.read_text()))
    print(f"decoded {dest.name} ({dest.stat().st_size} bytes)")

for size in (16, 32, 48, 128):
    src = icon_dir / f"icon{size}.png"
    dest = root_icons / f"icon{size}.png"
    dest.write_bytes(src.read_bytes())
    print(f"copied {dest}")
PY
