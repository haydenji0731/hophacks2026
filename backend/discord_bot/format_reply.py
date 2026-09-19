from __future__ import annotations

from typing import Any

TIER_COLOR = {
    "low": 0xF5C542,
    "medium": 0xF07A3A,
    "high": 0xE23D3D,
}

TIER_TITLE = {
    "low": "A few scam-like signs",
    "medium": "This looks like a likely scam",
    "high": "This is very likely a scam — don't send money or codes",
}


def format_reply(payload: dict[str, Any], *, site_url: str) -> dict[str, Any]:
    """Turn /v1/analyze JSON into a Discord embed dict (no discord.py required)."""
    grok = payload.get("grok") or {}
    is_scam = bool(grok.get("is_scam"))
    confidence = float(payload.get("scam_confidence") or 0)
    tier = str(payload.get("notification_tier") or "low")
    reason = str(payload.get("reason") or "").strip()
    scam_type = str(grok.get("scam_type") or "").strip()
    if scam_type.lower() in {"", "none"}:
        scam_type = ""

    if not is_scam and confidence < 0.4:
        title = "Doesn't look like a typical scam"
        description = (
            "We're not seeing the usual pressure / payment / impersonation pattern. "
            "If something still feels off, hang up and check on the website."
        )
        color = 0x5C9DFF
    else:
        title = TIER_TITLE.get(tier, TIER_TITLE["medium"])
        description = reason or "Matched known scam signals."
        color = TIER_COLOR.get(tier, TIER_COLOR["medium"])

    fields = [
        {"name": "Confidence", "value": f"{confidence:.0%}", "inline": True},
        {"name": "Tier", "value": tier, "inline": True},
    ]
    if scam_type:
        fields.append({"name": "Closest type", "value": scam_type, "inline": False})
    if grok.get("method") and grok.get("method") != "none":
        fields.append({"name": "Method", "value": str(grok["method"]), "inline": True})
    if grok.get("target") and grok.get("target") not in {"unclear", "none"}:
        fields.append({"name": "Likely target", "value": str(grok["target"]), "inline": True})
    fields.append(
        {
            "name": "Learn more",
            "value": f"[Look it up on wehatescammers]({site_url})",
            "inline": False,
        }
    )
    return {"title": title, "description": description, "color": color, "fields": fields}
