from typing import Literal

from pydantic import BaseModel, Field

AiVoiceUsed = Literal["yes", "no", "unknown"]
NotificationTier = Literal["low", "medium", "high"]


class GrokFlags(BaseModel):
    is_scam: bool
    scam_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str


class AnalyzeResponse(BaseModel):
    elevenlabs_ai_score: float | None = Field(default=None, ge=0.0, le=1.0)
    ai_voice_used: AiVoiceUsed | None = None
    ai_generated: bool | None = None
    grok: GrokFlags | None = None
    scam_confidence: float = Field(ge=0.0, le=1.0)
    notification_tier: NotificationTier
    reason: str
    warnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "scam-confidence-scorer"


class ErrorDetail(BaseModel):
    error: str
    detail: str
    upstream_status: int | None = None
