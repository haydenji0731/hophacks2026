from typing import Literal

from pydantic import BaseModel, Field

NotificationTier = Literal["low", "medium", "high"]


class NotifyRequest(BaseModel):
    """Input mirrors the fields the scam detector already emits."""

    to: str = Field(description="Destination phone number in E.164 form, e.g. +14105551234")
    notification_tier: NotificationTier
    reason: str = Field(description="Specific reason the incident was flagged (goes in the SMS).")
    scam_confidence: float | None = Field(default=None, ge=0.0, le=1.0)
    scam_type: str | None = Field(default=None, description="Optional label, e.g. 'IRS refund'.")
    site_url: str | None = Field(default=None, description="Override the destination link.")


class SentMessage(BaseModel):
    sid: str | None = None
    status: str
    dry_run: bool = False


class NotifyResponse(BaseModel):
    to: str
    tier: NotificationTier
    body: str
    messages_sent: int
    dry_run: bool
    results: list[SentMessage] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


class HealthResponse(BaseModel):
    status: Literal["ok"] = "ok"
    service: str = "scam-warning-notifier"
    textbelt_configured: bool = False


class ErrorDetail(BaseModel):
    error: str
    detail: str
    upstream_status: int | None = None
