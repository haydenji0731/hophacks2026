# Scam warning notifier (Twilio)

Turns the confidence scorer's output into **severity-tiered SMS warnings** that always
deep-link to the site. This is the "Warnings (Twilio)" surface from the spec (§5).

It takes the fields the [`scorer`](../scorer) already emits — `notification_tier`,
`reason`, `scam_confidence`, and an optional `scam_type` — plus a destination number,
and sends the right number of messages with tier-appropriate copy.

## Tiers

| Tier | Behavior |
| --- | --- |
| `low` | Soft single SMS, **optional** — suppressed by default (`SEND_LOW_TIER=true` to enable). |
| `medium` | One clear warning SMS + site link. |
| `high` | **Repeated** texts (`HIGH_REPEAT_COUNT`, default 3); all copy redirects to the site. |

Every message states a potential scam was flagged, gives the **specific reason**, and
points to `SITE_URL`.

## Dry-run mode

If any Twilio credential is missing, the service runs in **dry-run**: it builds the exact
SMS copy and returns it without contacting Twilio. This keeps the demo working without
live SMS or opt-in, which the spec flags as a real constraint. `dry_run: true` in the
response tells you nothing was actually sent.

## Run it

```bash
cd backend/warnings
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # optional: fill in Twilio creds, else dry-run
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
| `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_FROM_NUMBER` | empty | All three required to actually send; else dry-run. |
| `SITE_URL` | `https://wehatescammers.com` | The link every warning points to. |
| `SEND_LOW_TIER` | `false` | Enable the optional low-tier soft SMS. |
| `HIGH_REPEAT_COUNT` | `3` | How many times the high tier repeats. |

## Tests

```bash
python -m pytest -q
```

## Wiring note

The scorer's `/v1/analyze` returns `notification_tier`, `reason`, `scam_confidence`, and
`grok.scam_type`. Those map one-to-one onto this endpoint's request body, so the caller
that owns the phone number just forwards them here.
