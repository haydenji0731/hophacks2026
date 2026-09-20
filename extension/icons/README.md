Sherpa icon set. Compass is the primary Chrome toolbar and store mark.

| File | Use |
| --- | --- |
| `icon16.png` · `icon32.png` · `icon48.png` · `icon128.png` | Chrome toolbar, puzzle-piece menu, and store listing |
| `sherpa-compass-1024.png` | Source artwork (same file as [`../../icons/sherpa-compass-1024.png`](../../icons/sherpa-compass-1024.png)) |
| `compass.svg`, `cairn.svg`, `signpost.svg`, `tent.svg`, `ridge.svg` | Named marks |

Regenerate the sized PNGs from the 1024 source:

```bash
python3 - <<'PY'
from PIL import Image
src = Image.open("sherpa-compass-1024.png").convert("RGBA")
for size in (16, 32, 48, 128):
    src.resize((size, size), Image.Resampling.LANCZOS).save(f"icon{size}.png")
PY
```
