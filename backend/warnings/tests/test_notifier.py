import pytest

from warn_config import Settings
from models import NotifyRequest
from notifier import NotifierError, notify, textbelt_configured


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


def test_textbelt_configured_requires_key():
    assert textbelt_configured(_cfg()) is False
    assert textbelt_configured(_cfg(textbelt_key="   ")) is False
    assert textbelt_configured(_cfg(textbelt_key="textbelt")) is True


def test_dry_run_builds_but_does_not_send():
    cfg = _cfg()
    req = NotifyRequest(to="+14105551234", notification_tier="medium", reason="urgency + gift card")
    resp = notify(req, cfg)
    assert resp.dry_run is True
    assert resp.messages_sent == 1
    assert "urgency + gift card" in resp.body
    assert all(m.dry_run for m in resp.results)


def test_high_tier_sends_repeated_messages():
    cfg = _cfg()
    req = NotifyRequest(to="+14105551234", notification_tier="high", reason="synthetic voice")
    resp = notify(req, cfg)
    assert resp.messages_sent == 3


def test_low_tier_suppressed_by_default():
    cfg = _cfg()
    req = NotifyRequest(to="+14105551234", notification_tier="low", reason="weak signals")
    resp = notify(req, cfg)
    assert resp.messages_sent == 0
    assert resp.body  # copy is still built for inspection


def test_low_tier_sends_when_enabled():
    cfg = _cfg(send_low_tier=True)
    req = NotifyRequest(to="+14105551234", notification_tier="low", reason="weak signals")
    resp = notify(req, cfg)
    assert resp.messages_sent == 1


def test_live_send_calls_textbelt_with_custom_body(monkeypatch):
    cfg = _cfg(textbelt_key="textbelt")
    calls = []

    class FakeResp:
        status_code = 200

        def json(self):
            return {"success": True, "textId": "tb123", "quotaRemaining": 0}

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return FakeResp()

    monkeypatch.setattr("notifier.httpx.post", fake_post)

    req = NotifyRequest(to="+14105551234", notification_tier="high", reason="scam")
    resp = notify(req, cfg)

    assert resp.dry_run is False
    assert len(calls) == 1
    url, kwargs = calls[0]
    assert url == "https://textbelt.com/text"
    assert kwargs["data"]["phone"] == "+14105551234"
    assert kwargs["data"]["key"] == "textbelt"
    assert "Urgent" in kwargs["data"]["message"]
    assert "scam" in kwargs["data"]["message"]
    assert all(m.sid == "tb123" for m in resp.results)
    assert resp.messages_sent == 1
    assert any("1 SMS/day" in w for w in resp.warnings)
    assert any("quota remaining: 0" in w.lower() for w in resp.warnings)


def test_paid_key_sends_high_repeats(monkeypatch):
    cfg = _cfg(textbelt_key="paid-secret")
    calls = []

    class FakeResp:
        status_code = 200

        def json(self):
            return {"success": True, "textId": "tb456", "quotaRemaining": 9}

    def fake_post(url, **kwargs):
        calls.append(kwargs)
        return FakeResp()

    monkeypatch.setattr("notifier.httpx.post", fake_post)
    req = NotifyRequest(to="+14105551234", notification_tier="high", reason="gift card")
    resp = notify(req, cfg)
    assert len(calls) == 3
    assert all("gift card" in c["data"]["message"] for c in calls)
    assert "gift card" in resp.body
    assert resp.messages_sent == 3


def test_textbelt_success_false_raises(monkeypatch):
    cfg = _cfg(textbelt_key="textbelt")

    class FakeResp:
        status_code = 200

        def json(self):
            return {"success": False, "error": "Out of quota", "quotaRemaining": 0}

    monkeypatch.setattr("notifier.httpx.post", lambda *a, **k: FakeResp())
    req = NotifyRequest(to="+14105551234", notification_tier="medium", reason="scam")
    with pytest.raises(NotifierError, match="Out of quota"):
        notify(req, cfg)
