# Scam detector

Combines **ElevenLabs** synthetic-voice scores with the team's **Grok** transcript classifier (`detect_scam.py`) into one incident payload: `scam_confidence`, `notification_tier`, and a Twilio-ready `reason`.

`POST /v1/ingest` also upserts a scam-pattern row and sends a Twilio warning when Grok says `is_scam`. DB/notify failures are soft (returned in `warnings[]`).

## Run

```bash
cd backend/detector
uv sync --group dev
# language flags: XAI_API_KEY (same as detect_scam.py)
# audio (optional): ELEVENLABS_API_KEY
# ingest DB: DATABASE_URL (same as backend/db/.env)
# ingest SMS: TWILIO_* vars (same as backend/warnings/.env) — missing → dry-run
uv run uvicorn app:app --reload --port 8000
```

## API

`GET /health`

`POST /v1/analyze` — multipart:

- `transcript` (optional string)
- `file` (optional mp3/wav/ogg/webm)

Need at least one. Best demo: both.

```bash
curl -s -F "transcript=Hi grandma, buy \$500 in gift cards and don't tell mom." \
  -F "file=@sample.mp3" \
  http://127.0.0.1:8000/v1/analyze
```

`POST /v1/ingest` — same fields plus:

- `to` — E.164 phone for Twilio (optional; skipped with a warning if missing)

```bash
curl -s -F "transcript=Hi grandma, buy \$500 in gift cards and don't tell mom." \
  -F "to=+14105551234" \
  http://127.0.0.1:8000/v1/ingest
```

When `is_scam`, response includes `db` (`created` / `updated` / `skipped`) and `notify` (SMS body / dry-run). Raw transcript is never written to Postgres.

## Scoring

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

No live Grok, ElevenLabs, Postgres, or Twilio calls in unit tests.
