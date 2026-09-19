from __future__ import annotations

from warn_config import Settings, settings
from models import NotificationTier

# Copy is written as a text you'd actually receive.
_TIER_OPENER = {
    "low": "Heads up — this call has a few scam-like signs",
    "medium": "Warning — this call looks like a scam",
    "high": "Urgent — this call is very likely a scam",
}
_TIER_CLOSE = {
    "low": "",
    "medium": "Don't send money.",
    "high": "Do not send money or share codes.",
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

    opener = _TIER_OPENER[tier]
    why = _clean_reason(reason, scam_type)
    parts = [f"{opener} ({why})."]
    close = _TIER_CLOSE[tier]
    if close:
        parts.append(close)

    if scam_confidence is not None:
        parts.append(f"{scam_confidence:.0%} sure.")

    return " ".join(parts)
