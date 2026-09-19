import json

import pytest
from fastapi.testclient import TestClient

from app import app
from schemas import GrokFlags
from screen import ScreenResult


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _screen(
    *,
    escalate: bool = False,
    ai: float | None = 0.2,
    hits: list[dict] | None = None,
) -> ScreenResult:
    return ScreenResult(
        elevenlabs_ai_score=ai,
        ai_voice_used="yes" if ai and ai >= 0.5 else "no",
        ai_generated=True if ai and ai >= 0.5 else False,
        keyword_hits=hits or [],
        alarm_score=ai or 0.0,
        sensitivity="high" if escalate else "not_sensitive",
        escalate=escalate,
        clipped_seconds=30.0,
        warnings=[],
    )


def test_process_requires_file(client: TestClient) -> None:
    response = client.post("/v1/process", data={})
    assert response.status_code == 422  # missing required file


def test_process_skips_escalate_when_not_sensitive(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("process.run_screen", lambda *_a, **_k: _screen(escalate=False))

    response = client.post(
        "/v1/process",
        files={"file": ("chunk.wav", b"fake", "audio/wav")},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["escalate"] is False
    assert body["escalated"] is False
    assert body["transcript"] is None
    assert body["grok"] is None
    assert any("Not escalated" in w for w in body["warnings"])


def test_process_escalates_stt_grok_notify(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    from schemas import DbUpsertResult

    monkeypatch.setattr(
        "process.run_screen",
        lambda *_a, **_k: _screen(
            escalate=True,
            ai=0.85,
            hits=[{"label": "alexa", "score": 0.9}],
        ),
    )
    monkeypatch.setattr("process.transcribe_audio_bytes", lambda *_a, **_k: "Buy gift cards now.")
    monkeypatch.setattr(
        "process.run_grok_flags",
        lambda _t: GrokFlags(
            is_scam=True,
            scam_type="gift_card_bail",
            confidence=0.92,
            reasoning="Gift card ask.",
            method="gift card payment request",
            target="elderly individual",
        ),
    )
    monkeypatch.setattr(
        "process._try_upsert",
        lambda _a: (DbUpsertResult(action="created", scam_id="1", name="gift_card_bail", frequency=1), []),
    )
    monkeypatch.setattr(
        "process._try_notify",
        lambda _a, _to: (None, ["Notify skipped: no destination phone number (to)."]),
    )

    response = client.post(
        "/v1/process",
        files={"file": ("chunk.wav", b"fake", "audio/wav")},
        data={"to": ""},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["escalated"] is True
    assert body["transcript"] == "Buy gift cards now."
    assert body["grok"]["is_scam"] is True
    assert body["db"]["action"] == "created"
    assert body["notification_tier"] == "high"


def test_process_force_escalate(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("process.run_screen", lambda *_a, **_k: _screen(escalate=False, ai=0.1))
    monkeypatch.setattr("process.transcribe_audio_bytes", lambda *_a, **_k: "hello")
    monkeypatch.setattr(
        "process.run_grok_flags",
        lambda _t: GrokFlags(
            is_scam=False,
            scam_type="none",
            confidence=0.1,
            reasoning="Benign.",
        ),
    )
    monkeypatch.setattr("process._try_upsert", lambda _a: (__import__("schemas").DbUpsertResult(action="skipped"), []))
    monkeypatch.setattr("process._try_notify", lambda _a, _to: (None, []))

    response = client.post(
        "/v1/process",
        files={"file": ("chunk.wav", b"fake", "audio/wav")},
        data={"force_escalate": "true"},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["escalate"] is False
    assert body["escalated"] is True
    assert body["transcript"] == "hello"


def test_process_stream_emits_screen_then_done(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        "process.run_screen",
        lambda *_a, **_k: _screen(
            escalate=True,
            ai=0.81,
            hits=[{"label": "gift_cards", "score": 0.77}],
        ),
    )
    monkeypatch.setattr("process.transcribe_audio_bytes", lambda *_a, **_k: "Send the codes.")
    monkeypatch.setattr(
        "process.run_grok_flags",
        lambda _t: GrokFlags(
            is_scam=True,
            scam_type="gift_card_bail",
            confidence=0.9,
            reasoning="Codes.",
            method="gift card payment request",
            target="elderly individual",
        ),
    )
    monkeypatch.setattr(
        "process._try_upsert",
        lambda _a: (__import__("schemas").DbUpsertResult(action="skipped"), []),
    )
    monkeypatch.setattr("process._try_notify", lambda _a, _to: (None, []))

    with client.stream(
        "POST",
        "/v1/process",
        files={"file": ("chunk.wav", b"fake", "audio/wav")},
        data={"stream": "true"},
    ) as response:
        assert response.status_code == 200
        stages = [json.loads(line)["stage"] for line in response.iter_lines() if line]

    assert stages == ["screen", "transcript", "done"]
