from format_reply import format_reply


def test_high_scam_embed() -> None:
    embed = format_reply(
        {
            "scam_confidence": 0.91,
            "notification_tier": "high",
            "reason": "gift_card_bail (language 0.90); asked for secrecy",
            "grok": {
                "is_scam": True,
                "scam_type": "gift_card_bail",
                "confidence": 0.9,
                "reasoning": "Gift cards and secrecy.",
                "method": "gift card payment request",
                "target": "elderly individual",
            },
        },
        site_url="https://wehatescammers.com",
    )
    assert "very likely a scam" in embed["title"].lower()
    assert embed["color"] == 0xE23D3D
    names = [f["name"] for f in embed["fields"]]
    assert "Closest type" in names
    assert any("wehatescammers" in f["value"] for f in embed["fields"])


def test_low_not_scam_embed() -> None:
    embed = format_reply(
        {
            "scam_confidence": 0.12,
            "notification_tier": "low",
            "reason": "language score 0.12",
            "grok": {
                "is_scam": False,
                "scam_type": "none",
                "confidence": 0.12,
                "reasoning": "Dentist reminder.",
                "method": "none",
                "target": "unclear",
            },
        },
        site_url="https://example.com",
    )
    assert "doesn't look like" in embed["title"].lower()
    assert embed["color"] == 0x5C9DFF
