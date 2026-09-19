# Scam warning notifier (Textbelt)

Turns the scam detector's output into **severity-tiered SMS warnings** that always
deep-link to the site. This is the "Warnings" surface from the spec (§5).

It takes the fields the [`detector`](../detector) already emits — `notification_tier`,
`reason`, `scam_confidence`, and an optional `scam_type` — plus a destination number,
and sends the right number of messages with tier-appropriate copy.

## Tiers

| Tier | Behavior |
| --- | --- |
| `low` | Soft single SMS, **optional** — suppressed by default (`SEND_LOW_TIER=true` to enable). |
| `medium` | One clear warning SMS + site link. |
| `high` | **Repeated** texts (`HIGH_REPEAT_COUNT`, default 3); all copy redirects to the site. Free Textbelt key is capped at **1 SMS/day**, so high-tier repeats are skipped. |

Every message states a potential scam was flagged and gives the **specific reason**.
Links are omitted: Textbelt rejects URLs in SMS.

## Dry-run mode

If `TEXTBELT_KEY` is missing, the service runs in **dry-run**: it builds the exact
SMS copy and returns it without contacting Textbelt. This keeps the demo working without
live SMS or opt-in, which the spec flags as a real constraint. `dry_run: true` in the
response tells you nothing was actually sent.

## Run it

```bash
cd backend/warnings
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optional: TEXTBELT_KEY=textbelt for the free daily SMS, else dry-run
uvicorn app:app --reload --port 8002
```

```bash
curl -s -X POST http://127.0.0.1:8002/v1/notify \
  -H 'Content-Type: application/json' \
  -d '{
        "to": "+14105551234",
        "notification_tier": "high",
        "reason": "synthetic voice score high; urgency + gift-card ask",
        "scam_confidence": 0.88,
        "scam_type": "IRS refund"
      }'
```

Response includes the final `body`, `messages_sent`, `dry_run`, and per-message results.

## Config (`.env`)

| Var | Default | Notes |
| --- | --- | --- |
| `TEXTBELT_KEY` | empty | Required to actually send; else dry-run. Use `textbelt` for 1 free SMS/day. |
| `SITE_URL` | `https://wehatescammers.com` | Kept for other surfaces. **Not** put in SMS — Textbelt rejects URLs. |
| `SEND_LOW_TIER` | `false` | Enable the optional low-tier soft SMS. |
| `HIGH_REPEAT_COUNT` | `3` | How many times the high tier repeats (paid keys only). |

When the detector runs `/v1/process` or `/v1/ingest`, put the same `TEXTBELT_KEY` in
`backend/detector/.env` (uvicorn's cwd) so notify is not dry-run.

## Tests

```bash
python -m pytest -q
```

## Wiring note

The detector's `/v1/analyze` returns `notification_tier`, `reason`, `scam_confidence`, and
`grok.scam_type`. Those map one-to-one onto this endpoint's request body, so the caller
that owns the phone number just forwards them here.
