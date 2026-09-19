# Scam detector

Mid-call pipeline:

1. **Screen** (cheap): clip → ElevenLabs AI-voice + openWakeWord keywords → alarm / sensitivity
2. **Escalate** (if sensitive): Grok STT → Grok scam flags → upsert pattern + Textbelt SMS

Also exposes analyze / ingest / report for transcript-first flows.

**Runtime split:** run this API on **Linux** (openWakeWord works there). Capture audio on the Mac with [`desktop/listen.py`](../../desktop/listen.py) and POST chunks here.

## Run (Linux backend)

```bash
cd backend/detector
uv python pin 3.11          # openWakeWord / tflite need 3.11
uv sync --group dev --extra kws
# language + STT: XAI_API_KEY
# audio screen: ELEVENLABS_API_KEY
# ingest DB: DATABASE_URL (same as backend/db/.env)
# ingest SMS: TEXTBELT_KEY (same as backend/warnings/.env) — missing → dry-run
#   TEXTBELT_KEY=textbelt  → 1 free SMS/day with custom copy
uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000
```

First-time KWS (Linux): install onnxruntime extra, then **custom phrase models** (not stock alexa):

```bash
uv run python -c "import openwakeword; openwakeword.utils.download_models()"
# add trained scam-phrase .onnx files to backend/detector/wakeword_models/
# (gift_card, bail, arrest_warrant, … — see keywords.py SCAM_WAKE_PHRASES)
```

## Mac capture client

```bash
# from repo root — no openWakeWord on the Mac
uv run --with sounddevice --with soundfile --with httpx --with numpy \
  python desktop/listen.py \
  --url http://LINUX_HOST:8000/v1/process \
  --seconds 30 \
  --loop \
  --to +14105551234
```

List mic devices: `… desktop/listen.py --list-devices`

## API

`GET /health`

### Screen / process (demo path)

`POST /v1/screen` — multipart `file` only. Returns AI score, keyword hits, alarm, sensitivity, escalate flag. No STT.

`POST /v1/process` — multipart:

- `file` (required) — mp3/wav/ogg/webm chunk
- `to` (optional) — E.164 for Textbelt if scam
- `force_escalate` (optional bool) — run STT/Grok even when screen is cold

```bash
curl -s -F "file=@chunk.wav" -F "to=+14105551234" \
  http://127.0.0.1:8000/v1/process
```

Escalate gate (env): `AI_ESCALATE_THRESHOLD` (default `0.5`), `MIN_KEYWORD_HITS_TO_ESCALATE` (default `1`).

### News wire (home-page cards)

Cards are JSON on ravens (`news_wire.json`), not a CMS table. Grok writes deks from `scams` rows updated in the last 7–14 days. The website only **GETs**.

```bash
# on ravens, detector cwd, DATABASE_URL + XAI_API_KEY in .env
uv run python refresh_news.py
uv run python refresh_news.py --days 7 --dry-run
```

`GET /v1/news` — current cards (no Grok).

`POST /v1/news/refresh?days=14` — same job as the script. Cursor Grok Bot should HTTP this (public HTTPS), not SSH. If `NEWS_REFRESH_SECRET` is set, send `X-News-Refresh-Secret` or `Authorization: Bearer …`. Empty secret is allowed for hackathon.

Env: `NEWS_LOOKBACK_DAYS` (default `14`), `NEWS_REFRESH_SECRET`, `NEWS_WIRE_PATH`, `XAI_GROK_MODEL`.

### CLAP phrases (wake list)

Spoken phrases are frozen in `clap_phrases.json` (same idea as the news wire). CLAP reads that file on each clip; it does **not** query Postgres on the hot path. Refresh pulls a non-redundant set from `scams` (name / demands / short method) and fills gaps from the built-in seed.

```bash
# on ravens, detector cwd, DATABASE_URL in .env
uv run python refresh_phrases.py
uv run python refresh_phrases.py --dry-run
```

Via the tunnel (same secret as news):

```bash
curl -sS -m 30 -X POST 'http://127.0.0.1:8000/v1/phrases/refresh'
```

Cron (every 6 hours):

```cron
0 */6 * * * cd /mnt/disk2/hji/hophacks2026/backend/detector && uv run python refresh_phrases.py
```

`GET /v1/phrases` — current frozen book. `POST /v1/phrases/refresh` — rewrite the JSON. Restart uvicorn is not required; the detector reloads the file within a minute.

### Intel catalog

`GET /v1/intel?q=&limit=60` — TF-IDF search over seed pattern TSVs. Empty `q` returns the top patterns.

`GET /v1/intel/{name}` — one pattern, or 404.

If this 404s, ravens uvicorn is older than the intel commit. `git pull` in `/mnt/disk2/hji/hophacks2026` and restart the detector process.

### Analyze / ingest / report

`POST /v1/analyze` — multipart `transcript` and/or `file`. Need at least one.

```bash
curl -s -F "transcript=Hi grandma, buy \$500 in gift cards and don't tell mom." \
  -F "file=@sample.mp3" \
  http://127.0.0.1:8000/v1/analyze
```

`POST /v1/ingest` — same fields plus `to`. When `is_scam`, upserts pattern + Textbelt. Soft-fails land in `warnings[]`.

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

No live Grok, ElevenLabs, Postgres, Textbelt, or openWakeWord calls in unit tests.
