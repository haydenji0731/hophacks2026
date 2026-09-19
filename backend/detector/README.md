# Scam detector

Mid-call pipeline:

1. **Screen** (cheap): clip → ElevenLabs AI-voice + openWakeWord keywords → alarm / sensitivity
2. **Escalate** (if sensitive): Grok STT → Grok scam flags → upsert pattern + Twilio SMS

Also exposes analyze / ingest / report for transcript-first flows.

**Runtime split:** run this API on **Linux** (openWakeWord works there). Capture audio on the Mac with [`clients/mac_capture.py`](../../clients/mac_capture.py) and POST chunks here.

## Run (Linux backend)

```bash
cd backend/detector
uv python pin 3.11          # openWakeWord / tflite need 3.11
uv sync --group dev --extra kws
# language + STT: XAI_API_KEY
# audio screen: ELEVENLABS_API_KEY
# ingest DB: DATABASE_URL (same as backend/db/.env)
# ingest SMS: TWILIO_* (same as backend/warnings/.env) — missing → dry-run
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

First-time KWS models (Linux):

```bash
uv run python -c "import openwakeword; openwakeword.utils.download_models()"
```

## Mac capture client

```bash
# from repo root — no openWakeWord on the Mac
uv run --with sounddevice --with soundfile --with httpx --with numpy \
  python clients/mac_capture.py \
  --url http://LINUX_HOST:8000/v1/process \
  --seconds 30 \
  --loop \
  --to +14105551234
```

List mic devices: `… mac_capture.py --list-devices`

## API

`GET /health`

### Screen / process (demo path)

`POST /v1/screen` — multipart `file` only. Returns AI score, keyword hits, alarm, sensitivity, escalate flag. No STT.

`POST /v1/process` — multipart:

- `file` (required) — mp3/wav/ogg/webm chunk
- `to` (optional) — E.164 for Twilio if scam
- `force_escalate` (optional bool) — run STT/Grok even when screen is cold

```bash
curl -s -F "file=@chunk.wav" -F "to=+14105551234" \
  http://127.0.0.1:8000/v1/process
```

Escalate gate (env): `AI_ESCALATE_THRESHOLD` (default `0.5`), `MIN_KEYWORD_HITS_TO_ESCALATE` (default `1`).

### Analyze / ingest / report

`POST /v1/analyze` — multipart `transcript` and/or `file`. Need at least one.

```bash
curl -s -F "transcript=Hi grandma, buy \$500 in gift cards and don't tell mom." \
  -F "file=@sample.mp3" \
  http://127.0.0.1:8000/v1/analyze
```

`POST /v1/ingest` — same fields plus `to`. When `is_scam`, upserts pattern + Twilio. Soft-fails land in `warnings[]`.

`POST /v1/report` — JSON “this happened to me”. Upserts only; no SMS.

```bash
curl -s -X POST http://127.0.0.1:8000/v1/report \
  -H 'Content-Type: application/json' \
  -d '{"scam_type":"Family emergency / bail scam","method":"gift card payment request","platform":"phone"}'
```

## Scoring (after escalate)

Default: `0.4 * elevenlabs_ai_score + 0.6 * grok.confidence` (renormalized if one side is missing).

| Combined score | `notification_tier` |
| --- | --- |
| ≥ 0.70 | `high` |
| ≥ 0.40 | `medium` |
| else | `low` |

Env: `AUDIO_WEIGHT`, `LANGUAGE_WEIGHT`, `HIGH_THRESHOLD`, `MEDIUM_THRESHOLD`.

## Tests

```bash
cd backend/detector
uv sync --group dev
uv run pytest -q
```

No live Grok, ElevenLabs, Postgres, Twilio, or openWakeWord calls in unit tests.
