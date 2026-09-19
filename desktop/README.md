# Desktop capture (speech fraud sidecar)

Laptop tool only: record a clip, POST to ravens `/v1/process`, save wav/json locally.

## Window (`app.py`)

```bash
cd desktop
uv run --python 3.11 python app.py
```

**Outpost** is the product name (top left of the window). **Start listening** is the one click: folder picker if needed, then the capture loop until **Stop**. The bottom panel shows the latest detection, not a log. Detector URL defaults to `http://127.0.0.1:8000/v1/process`.

- **Not** the website → [`frontend/`](../frontend/)
- **Not** the browser extension → [`extension/`](../extension/)
- **Not** models → `backend/detector` on Linux

```bash
# tunnel first: ssh -N -L 8000:localhost:8000 hji@ravens
uv run --with sounddevice --with soundfile --with httpx --with numpy \
  python desktop/listen.py \
  --url http://127.0.0.1:8000/v1/process \
  --seconds 30 \
  --loop
```

Mic check (no POST): `--dry-run --save desktop/recordings/test.wav`. Play with `afplay`.

Clips you keep go in `desktop/recordings/` (gitignored) or a folder you pick in the app.
