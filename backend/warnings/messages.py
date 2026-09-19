from __future__ import annotations

from warn_config import Settings, settings
from models import NotificationTier

# Generic SMS. No scores, scam type, URLs, or extra instructions.
GENERIC_BODY = "Warning: possible scam in progress. End the call."


def repeat_count(tier: NotificationTier, cfg: Settings | None = None) -> int:
    cfg = cfg or settings
    return {
        "low": cfg.low_repeat_count,
        "medium": cfg.medium_repeat_count,
        "high": cfg.high_repeat_count,
    }[tier]


def build_body(
    *,
    tier: NotificationTier,
    reason: str,
    scam_type: str | None = None,
    scam_confidence: float | None = None,
    site_url: str | None = None,
    cfg: Settings | None = None,
) -> str:
    return GENERIC_BODY
