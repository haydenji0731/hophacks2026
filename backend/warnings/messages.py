from __future__ import annotations

from config import Settings, settings
from models import NotificationTier

# Per-tier opener. Every warning still states a potential scam was flagged,
# gives a specific reason, and points to the site (see build_body).
_TIER_OPENER = {
    "low": "Heads up: this call/text has a few scam-like signs.",
    "medium": "Warning: this looks like a likely scam.",
    "high": "STOP - this is very likely a scam. Do not send money or share codes.",
}


def repeat_count(tier: NotificationTier, cfg: Settings | None = None) -> int:
    cfg = cfg or settings
    return {
        "low": cfg.low_repeat_count,
        "medium": cfg.medium_repeat_count,
        "high": cfg.high_repeat_count,
    }[tier]


def _clean_reason(reason: str, scam_type: str | None) -> str:
    reason = (reason or "").strip()
    if reason:
        return reason
    if scam_type:
        return f"matches the {scam_type} pattern"
    return "matched known scam signals"


def build_body(
    *,
    tier: NotificationTier,
    reason: str,
    scam_type: str | None = None,
    scam_confidence: float | None = None,
    site_url: str | None = None,
    cfg: Settings | None = None,
) -> str:
    cfg = cfg or settings
    url = site_url or cfg.site_url

    opener = _TIER_OPENER[tier]
    why = _clean_reason(reason, scam_type)
    parts = [opener, f"Why: {why}."]

    if scam_confidence is not None:
        parts.append(f"Confidence {scam_confidence:.0%}.")

    if tier == "high":
        parts.append(f"Learn what to do and confirm it here: {url}")
    else:
        parts.append(f"Check it here: {url}")

    return " ".join(parts)
