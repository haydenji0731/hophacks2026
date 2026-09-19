from warn_config import Settings
from messages import GENERIC_BODY, build_body, repeat_count


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


def test_body_is_generic_no_url():
    cfg = _cfg()
    for tier in ("low", "medium", "high"):
        body = build_body(tier=tier, reason="urgency + gift-card ask", cfg=cfg)
        assert body == GENERIC_BODY
        assert "http" not in body
        assert "wehatescammers" not in body
        assert "gift-card" not in body


def test_tiers_share_the_same_copy():
    cfg = _cfg()
    low = build_body(tier="low", reason="x", cfg=cfg)
    high = build_body(tier="high", reason="x", cfg=cfg)
    assert low == high
    assert low.startswith("Warning:")


def test_confidence_not_in_body():
    cfg = _cfg()
    body = build_body(tier="medium", reason="x", scam_confidence=0.82, cfg=cfg)
    assert "82%" not in body
    assert "sure" not in body


def test_scam_type_not_in_sms():
    cfg = _cfg()
    body = build_body(tier="medium", reason="", scam_type="IRS refund", cfg=cfg)
    assert "IRS" not in body
    assert "possible scam" in body


def test_site_url_not_in_sms():
    cfg = _cfg()
    body = build_body(tier="high", reason="x", site_url="https://example.test", cfg=cfg)
    assert "https://example.test" not in body
    assert "http" not in body
