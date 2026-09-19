from __future__ import annotations

from warn_config import Settings, settings
from models import NotificationTier

# One-sentence SMS. No scores, URLs, or extra instructions.
_TIER_OPENER = {
    "low": "Heads up",
    "medium": "Warning",
    "high": "Urgent",
}


def repeat_count(tier: NotificationTier, cfg: Settings | None = None) -> int:
    cfg = cfg or settings
    return {
        "low": cfg.low_repeat_count,
        "medium": cfg.medium_repeat_count,
        "high": cfg.high_repeat_count,
    }[tier]


def _clean_reason(reason: str, scam_type: str | None) -> str:
    label = (scam_type or "").strip()
    if label and label.lower() != "none":
        return label
    reason = (reason or "").strip()
    if reason:
        return reason.split(";")[0].strip()
    return "a scam"


def build_body(
    *,
    tier: NotificationTier,
    reason: str,
    scam_type: str | None = None,
    scam_confidence: float | None = None,
    site_url: str | None = None,
    cfg: Settings | None = None,
) -> str:
    why = _clean_reason(reason, scam_type)
    return f"{_TIER_OPENER[tier]}: {why}."
