from typing import Literal

from pydantic import BaseModel, Field

AiVoiceUsed = Literal["yes", "no", "unknown"]
DetectionMethod = Literal["elevenlabs_classifier"]

CLASSIFIER_LIMITATIONS: list[str] = [
    "Detects ElevenLabs voices only, not other TTS providers.",
    "Unreliable on Eleven v3 audio.",
    "Classifier analyzes roughly the first minute of audio.",
    "Statistical detector, not SynthID watermark proof (ElevenLabs cites ~99% precision / 80% recall on unmodified older-model audio).",
]


class DetectResponse(BaseModel):
    elevenlabs_ai_score: float = Field(ge=0.0, le=1.0)
    ai_voice_used: AiVoiceUsed
    detection_method: DetectionMethod = "elevenlabs_classifier"
    reason: str
    limitations: list[str] = Field(default_factory=lambda: list(CLASSIFIER_LIMITATIONS))


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "ai-audio-detector"


class ErrorDetail(BaseModel):
    error: str
    detail: str
    upstream_status: int | None = None
