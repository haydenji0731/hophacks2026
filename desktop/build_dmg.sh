#!/usr/bin/env bash
# Unsigned Lighthouse.app + DMG. Run from desktop/.
set -euo pipefail
cd "$(dirname "$0")"
export UV_PYTHON="${UV_PYTHON:-3.11}"

mkdir -p assets/lighthouse.iconset
sips -z 16 16     assets/icon.png --out assets/lighthouse.iconset/icon_16x16.png >/dev/null
sips -z 32 32     assets/icon.png --out assets/lighthouse.iconset/icon_16x16@2x.png >/dev/null
sips -z 32 32     assets/icon.png --out assets/lighthouse.iconset/icon_32x32.png >/dev/null
sips -z 64 64     assets/icon.png --out assets/lighthouse.iconset/icon_32x32@2x.png >/dev/null
sips -z 128 128   assets/icon.png --out assets/lighthouse.iconset/icon_128x128.png >/dev/null
sips -z 256 256   assets/icon.png --out assets/lighthouse.iconset/icon_128x128@2x.png >/dev/null
sips -z 256 256   assets/icon.png --out assets/lighthouse.iconset/icon_256x256.png >/dev/null
sips -z 512 512   assets/icon.png --out assets/lighthouse.iconset/icon_256x256@2x.png >/dev/null
sips -z 512 512   assets/icon.png --out assets/lighthouse.iconset/icon_512x512.png >/dev/null
sips -z 1024 1024 assets/icon.png --out assets/lighthouse.iconset/icon_512x512@2x.png >/dev/null
iconutil -c icns assets/lighthouse.iconset -o assets/lighthouse.icns
rm -rf assets/lighthouse.iconset

uv sync --group pack --python 3.11
uv run --python 3.11 pyinstaller --noconfirm Listen.spec

rm -rf dist/dmg
mkdir -p dist/dmg
cp -R dist/Lighthouse.app dist/dmg/
ln -s /Applications dist/dmg/Applications
hdiutil create \
  -volname "Lighthouse" \
  -srcfolder dist/dmg \
  -ov -format UDZO \
  dist/Lighthouse.dmg

echo "App:  $PWD/dist/Lighthouse.app"
echo "DMG:  $PWD/dist/Lighthouse.dmg"
echo "Unsigned: right-click the app → Open the first time (Gatekeeper)."
