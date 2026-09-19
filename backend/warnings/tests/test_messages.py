from warn_config import Settings
from messages import build_body, repeat_count


def _cfg(**kw):
    base = dict(
        textbelt_key=None,
        site_url="https://wehatescammers.com",
        send_low_tier=False,
        low_repeat_count=1,
        medium_repeat_count=1,
        high_repeat_count=3,
    )
    base.update(kw)
    return Settings(**base)


def test_repeat_count_high_is_repeated():
    cfg = _cfg()
    assert repeat_count("low", cfg) == 1
    assert repeat_count("medium", cfg) == 1
    assert repeat_count("high", cfg) == 3


def test_body_always_has_reason_no_url():
    cfg = _cfg()
    for tier in ("low", "medium", "high"):
        body = build_body(tier=tier, reason="urgency + gift-card ask", cfg=cfg)
        assert "urgency + gift-card ask" in body
        assert "http" not in body
        assert "wehatescammers" not in body


def test_high_tier_is_more_forceful():
    cfg = _cfg()
    low = build_body(tier="low", reason="x", cfg=cfg)
    high = build_body(tier="high", reason="x", cfg=cfg)
    assert "Urgent" in high
    assert "Urgent" not in low


def test_confidence_rendered_as_percent():
    cfg = _cfg()
    body = build_body(tier="medium", reason="x", scam_confidence=0.82, cfg=cfg)
    assert "82%" in body


def test_falls_back_to_scam_type_when_reason_empty():
    cfg = _cfg()
    body = build_body(tier="medium", reason="", scam_type="IRS refund", cfg=cfg)
    assert "IRS refund" in body


def test_site_url_not_in_sms():
    cfg = _cfg()
    body = build_body(tier="high", reason="x", site_url="https://example.test", cfg=cfg)
    assert "https://example.test" not in body
    assert "http" not in body
