# Confidence scorer

Combines **ElevenLabs** synthetic-voice scores with the team's **Grok** transcript classifier (`detect_scam.py`) into one incident payload: `scam_confidence`, `notification_tier`, and a Twilio-ready `reason`.

Does not send SMS or write to Postgres. If one detector is down, the other still produces a score.

## Run

```bash
cd backend/scorer
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
# language flags: XAI_API_KEY (same as detect_scam.py)
# audio (optional): ELEVENLABS_API_KEY
uvicorn app:app --reload --port 8000
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

Example:

```json
{
  "elevenlabs_ai_score": 0.91,
  "ai_voice_used": "yes",
  "ai_generated": true,
  "grok": {
    "is_scam": true,
    "scam_type": "gift_card_bail",
    "confidence": 0.9,
    "reasoning": "Asked for gift cards and secrecy."
  },
  "scam_confidence": 0.904,
  "notification_tier": "low | medium | high",
  "reason": "gift_card_bail (language 0.90); ElevenLabs synthetic-voice score 0.91; Asked for gift cards and secrecy.",
  "warnings": []
}
```

`ai_generated` is the DB column mapping: `yes` → `true`, `no` → `false`, `unknown`/missing → `null`.

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
cd backend/scorer
pytest
```

No live Grok or ElevenLabs calls.
