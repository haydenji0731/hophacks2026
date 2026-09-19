from __future__ import annotations

import httpx
import pytest
from fastapi.testclient import TestClient

from app import app
from classifier import ClassifierError, build_detect_response, classify_audio, map_ai_voice_used
from config import Settings
from models import CLASSIFIER_LIMITATIONS


def test_map_ai_voice_used_thresholds() -> None:
    assert map_ai_voice_used(0.91) == "yes"
    assert map_ai_voice_used(0.70) == "yes"
    assert map_ai_voice_used(0.50) == "yes"
    assert map_ai_voice_used(0.30) == "no"
    assert map_ai_voice_used(0.05) == "no"
    assert map_ai_voice_used(0.40) == "unknown"


def test_build_detect_response() -> None:
    result = build_detect_response(0.9123)
    assert result.elevenlabs_ai_score == pytest.approx(0.9123)
    assert result.ai_voice_used == "yes"
    assert result.detection_method == "elevenlabs_classifier"
    assert result.reason == "ElevenLabs synthetic-voice score 0.91"
    assert result.limitations == CLASSIFIER_LIMITATIONS


def test_build_detect_response_clamps_score() -> None:
    assert build_detect_response(1.4).elevenlabs_ai_score == 1.0
    assert build_detect_response(-0.2).elevenlabs_ai_score == 0.0


def _mock_client(handler) -> httpx.Client:
    transport = httpx.MockTransport(handler)
    return httpx.Client(transport=transport)


def test_classify_audio_success() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/v1/moderation/ai-speech-classification")
        assert request.headers.get("xi-api-key") == "test-key"
        return httpx.Response(200, json={"probability": 0.88})

    cfg = Settings(elevenlabs_api_key="test-key")
    result = classify_audio(b"fake-mp3", "clip.mp3", "audio/mpeg", client=_mock_client(handler), cfg=cfg)
    assert result.elevenlabs_ai_score == pytest.approx(0.88)
    assert result.ai_voice_used == "yes"


def test_classify_audio_missing_probability() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"ok": True})

    with pytest.raises(ClassifierError, match="missing probability"):
        classify_audio(b"x", "a.wav", "audio/wav", client=_mock_client(handler))


def test_classify_audio_upstream_error() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"detail": "unauthorized"})

    with pytest.raises(ClassifierError) as exc:
        classify_audio(b"x", "a.mp3", "audio/mpeg", client=_mock_client(handler))
    assert exc.value.status_code == 502
    assert exc.value.upstream_status == 401


def test_classify_audio_non_json() -> None:
    def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="not-json")

    with pytest.raises(ClassifierError, match="non-JSON"):
        classify_audio(b"x", "a.mp3", "audio/mpeg", client=_mock_client(handler))


def test_health() -> None:
    client = TestClient(app)
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "ai-audio-detector"}


def test_detect_endpoint_success(monkeypatch: pytest.MonkeyPatch) -> None:
    from models import DetectResponse

    def fake_classify(_bytes: bytes, _name: str, _ctype: str) -> DetectResponse:
        return build_detect_response(0.22)

    monkeypatch.setattr("app.classify_audio", fake_classify)
    client = TestClient(app)
    response = client.post("/v1/detect", files={"file": ("call.wav", b"RIFF....", "audio/wav")})
    body = response.json()
    assert response.status_code == 200
    assert body["elevenlabs_ai_score"] == pytest.approx(0.22)
    assert body["ai_voice_used"] == "no"


def test_detect_rejects_empty() -> None:
    client = TestClient(app)
    response = client.post("/v1/detect", files={"file": ("call.mp3", b"", "audio/mpeg")})
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "empty_file"


def test_detect_rejects_unsupported_type() -> None:
    client = TestClient(app)
    response = client.post("/v1/detect", files={"file": ("notes.txt", b"hello", "text/plain")})
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "unsupported_media_type"


def test_detect_classifier_error(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_classify(_bytes: bytes, _name: str, _ctype: str):
        raise ClassifierError("timed out", status_code=504)

    monkeypatch.setattr("app.classify_audio", fake_classify)
    client = TestClient(app)
    response = client.post("/v1/detect", files={"file": ("call.mp3", b"audio", "audio/mpeg")})
    assert response.status_code == 504
    assert response.json()["detail"]["error"] == "classifier_unavailable"
