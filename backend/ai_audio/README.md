# AI audio detector (ElevenLabs)

Python FastAPI service that scores whether call audio sounds like **ElevenLabs-generated speech**. It is the plug-in for spec fields `elevenlabs_ai_score` (incident) and `ai_voice_used` (scam record).

This is **detection only**. Transcription stays with Grok; SMS stays with Textbelt.

## Run

```bash
cd backend/ai_audio
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8001
```

Optional `.env`:

```
ELEVENLABS_API_KEY=  # sent as xi-api-key if set; classifier historically works without it
YES_THRESHOLD=0.50
NO_THRESHOLD=0.30
REQUEST_TIMEOUT_SECONDS=30
MAX_UPLOAD_BYTES=10485760
```

## API

`GET /health` → `{ "status": "ok", "service": "ai-audio-detector" }`

`POST /v1/detect` — multipart field `file` (`mp3`, `wav`, `ogg`, `webm`, max 10MB).

```bash
curl -s -F "file=@sample.mp3" http://127.0.0.1:8001/v1/detect
```

Example success body:

```json
{
  "elevenlabs_ai_score": 0.91,
  "ai_voice_used": "yes",
  "detection_method": "elevenlabs_classifier",
  "reason": "ElevenLabs synthetic-voice score 0.91",
  "limitations": [
    "Detects ElevenLabs voices only, not other TTS providers.",
    "Unreliable on Eleven v3 audio.",
    "Classifier analyzes roughly the first minute of audio.",
    "Statistical detector, not SynthID watermark proof (ElevenLabs cites ~99% precision / 80% recall on unmodified older-model audio)."
  ]
}
```

`ai_voice_used`: `yes` if score ≥ 0.50, `no` if ≤ 0.30, otherwise `unknown`.

If ElevenLabs is down or returns garbage, the endpoint responds **502/504** with `error: classifier_unavailable` so the scam detector can keep going on language/vector signals only.

## How it talks to ElevenLabs

ElevenLabs’ signed-in **Audio Detector** (SynthID watermark + classifier fallback) has **no public API**. This service calls the same classifier the public [AI Speech Classifier](https://elevenlabs.io/ai-speech-classifier) uses:

`POST https://api.elevenlabs.io/v1/moderation/ai-speech-classification` with multipart `file`.

Expect `{ "probability": 0.0–1.0 }`. That value is `elevenlabs_ai_score`.

## Tests

```bash
cd backend/ai_audio
pytest
```

All tests mock HTTP; no live API key required.

## Demo fixture (optional)

With `ELEVENLABS_API_KEY` and `elevenlabs` installed:

```bash
pip install elevenlabs
python scripts/generate_sample.py
```

Writes a short TTS clip you can POST to `/v1/detect`.
