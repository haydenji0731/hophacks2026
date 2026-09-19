from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import app
from grok import GrokError
from schemas import GrokFlags


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def test_health(client: TestClient) -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["service"] == "scam-confidence-scorer"


def test_analyze_requires_input(client: TestClient) -> None:
    response = client.post("/v1/analyze", data={})
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "missing_input"


def test_analyze_transcript_and_audio(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_audio(_bytes: bytes, _name: str, _ctype: str):
        return SimpleNamespace(elevenlabs_ai_score=0.91, ai_voice_used="yes")

    def fake_grok(_transcript: str) -> GrokFlags:
        return GrokFlags(
            is_scam=True,
            scam_type="gift_card_bail",
            confidence=0.9,
            reasoning="Asked for gift cards and secrecy.",
        )

    monkeypatch.setattr("pipeline.classify_call_audio", fake_audio)
    monkeypatch.setattr("pipeline.run_grok_flags", fake_grok)

    response = client.post(
        "/v1/analyze",
        data={"transcript": "Hi grandma, buy gift cards and don't tell mom."},
        files={"file": ("call.mp3", b"fake-audio", "audio/mpeg")},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["elevenlabs_ai_score"] == pytest.approx(0.91)
    assert body["ai_voice_used"] == "yes"
    assert body["ai_generated"] is True
    assert body["grok"]["scam_type"] == "gift_card_bail"
    assert body["notification_tier"] == "high"
    assert body["warnings"] == []


def test_analyze_audio_failure_falls_back_to_grok(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    def boom(*_args, **_kwargs):
        raise RuntimeError("classifier down")

    def fake_grok(_transcript: str) -> GrokFlags:
        return GrokFlags(is_scam=True, scam_type="irs", confidence=0.8, reasoning="IRS refund pressure.")

    monkeypatch.setattr("pipeline.classify_call_audio", boom)
    monkeypatch.setattr("pipeline.run_grok_flags", fake_grok)

    response = client.post(
        "/v1/analyze",
        data={"transcript": "This is the IRS, stay on the line."},
        files={"file": ("call.mp3", b"audio", "audio/mpeg")},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["elevenlabs_ai_score"] is None
    assert body["scam_confidence"] == pytest.approx(0.8)
    assert body["notification_tier"] == "high"
    assert any("ElevenLabs" in w for w in body["warnings"])


def test_analyze_both_detectors_down(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("pipeline.classify_call_audio", lambda *_a, **_k: (_ for _ in ()).throw(RuntimeError("down")))
    monkeypatch.setattr("pipeline.run_grok_flags", lambda _t: (_ for _ in ()).throw(GrokError("down")))

    response = client.post(
        "/v1/analyze",
        data={"transcript": "hello"},
        files={"file": ("call.wav", b"xx", "audio/wav")},
    )
    assert response.status_code == 502
    assert response.json()["detail"]["error"] == "no_signals"
