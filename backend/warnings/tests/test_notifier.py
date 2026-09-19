import pytest

from warn_config import Settings
from models import NotifyRequest
from notifier import notify, twilio_configured


def _cfg(**kw):
    base = dict(
        twilio_account_sid=None,
        twilio_auth_token=None,
        twilio_from_number=None,
        site_url="https://wehatescammers.com",
        send_low_tier=False,
        low_repeat_count=1,
        medium_repeat_count=1,
        high_repeat_count=3,
    )
    base.update(kw)
    return Settings(**base)


def test_twilio_configured_requires_all_three():
    assert twilio_configured(_cfg()) is False
    assert twilio_configured(_cfg(twilio_account_sid="AC", twilio_auth_token="t")) is False
    assert (
        twilio_configured(_cfg(twilio_account_sid="AC", twilio_auth_token="t", twilio_from_number="+1"))
        is True
    )


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


def test_live_send_calls_twilio(monkeypatch):
    cfg = _cfg(twilio_account_sid="AC123", twilio_auth_token="tok", twilio_from_number="+15005550006")
    calls = []

    class FakeResp:
        status_code = 201

        def json(self):
            return {"sid": "SM123", "status": "queued"}

    def fake_post(url, **kwargs):
        calls.append((url, kwargs))
        return FakeResp()

    monkeypatch.setattr("notifier.httpx.post", fake_post)

    req = NotifyRequest(to="+14105551234", notification_tier="high", reason="scam")
    resp = notify(req, cfg)

    assert resp.dry_run is False
    assert resp.messages_sent == 3
    assert len(calls) == 3
    assert all(c[1]["data"]["To"] == "+14105551234" for c in calls)
    assert all(m.sid == "SM123" for m in resp.results)
