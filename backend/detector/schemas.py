from typing import Literal

from pydantic import BaseModel, Field

AiVoiceUsed = Literal["yes", "no", "unknown"]
NotificationTier = Literal["low", "medium", "high"]


class GrokFlags(BaseModel):
    is_scam: bool
    scam_type: str
    confidence: float = Field(ge=0.0, le=1.0)
    reasoning: str
    method: str = Field(
        default="none",
        description="How the scam is executed, from detect_scam (e.g. gift card payment request).",
    )
    target: str = Field(
        default="unclear",
        description="Who the scam appears to target (role/demographic), from detect_scam.",
    )


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
    service: str = "scam-detector"


class ErrorDetail(BaseModel):
    error: str
    detail: str
    upstream_status: int | None = None


class DbUpsertResult(BaseModel):
    action: Literal["created", "updated", "skipped"]
    scam_id: str | None = None
    name: str | None = None
    frequency: int | None = None


class NotifyResult(BaseModel):
    to: str
    tier: NotificationTier
    body: str
    messages_sent: int
    dry_run: bool
    results: list[dict] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class IngestResponse(AnalyzeResponse):
    db: DbUpsertResult | None = None
    notify: NotifyResult | None = None


class ReportRequest(BaseModel):
    scam_type: str
    method: str = "none"
    target: str = "unclear"
    reasoning: str = ""
    ai_generated: bool | None = None
    platform: str = "phone"


class ReportResponse(BaseModel):
    db: DbUpsertResult
    warnings: list[str] = Field(default_factory=list)
