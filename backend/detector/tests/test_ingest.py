import pytest
from fastapi.testclient import TestClient

from app import app
from schemas import AnalyzeResponse, DbUpsertResult, GrokFlags, NotifyResult


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


def _scam_analysis() -> AnalyzeResponse:
    return AnalyzeResponse(
        elevenlabs_ai_score=None,
        ai_voice_used=None,
        ai_generated=None,
        grok=GrokFlags(
            is_scam=True,
            scam_type="gift_card_bail",
            confidence=0.92,
            reasoning="Gift-card bail ask and secrecy.",
            method="gift card payment request",
            target="elderly individual",
        ),
        scam_confidence=0.92,
        notification_tier="high",
        reason="gift_card_bail (language 0.92)",
        warnings=[],
    )


def test_ingest_scam_upserts_and_notifies(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("ingest.analyze_incident", lambda **_k: _scam_analysis())
    monkeypatch.setattr(
        "ingest._try_upsert",
        lambda _analysis: (
            DbUpsertResult(
                action="created",
                scam_id="11111111-1111-1111-1111-111111111111",
                name="gift_card_bail",
                frequency=1,
            ),
            [],
        ),
    )
    monkeypatch.setattr(
        "ingest._try_notify",
        lambda _analysis, to: (
            NotifyResult(
                to=to,
                tier="high",
                body="STOP - scam",
                messages_sent=1,
                dry_run=True,
                results=[],
                warnings=["Textbelt not configured; running in dry-run."],
            ),
            [],
        ),
    )

    response = client.post(
        "/v1/ingest",
        data={
            "transcript": "Hi grandma, buy gift cards and don't tell mom.",
            "to": "+14105551234",
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["grok"]["is_scam"] is True
    assert body["db"]["action"] == "created"
    assert body["db"]["name"] == "gift_card_bail"
    assert body["notify"]["to"] == "+14105551234"
    assert body["notify"]["dry_run"] is True


def test_ingest_not_scam_skips_db_and_notify(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    analysis = AnalyzeResponse(
        elevenlabs_ai_score=None,
        ai_voice_used=None,
        ai_generated=None,
        grok=GrokFlags(
            is_scam=False,
            scam_type="none",
            confidence=0.1,
            reasoning="Routine appointment.",
            method="none",
            target="unclear",
        ),
        scam_confidence=0.1,
        notification_tier="low",
        reason="language score 0.10",
        warnings=[],
    )
    monkeypatch.setattr("ingest.analyze_incident", lambda **_k: analysis)

    response = client.post(
        "/v1/ingest",
        data={"transcript": "Confirming your dentist appointment tomorrow."},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["db"]["action"] == "skipped"
    assert body["notify"] is None


def test_ingest_db_failure_is_soft(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("ingest.analyze_incident", lambda **_k: _scam_analysis())
    monkeypatch.setattr(
        "ingest._try_upsert",
        lambda _analysis: (DbUpsertResult(action="skipped"), ["Database upsert failed: boom"]),
    )
    monkeypatch.setattr(
        "ingest._try_notify",
        lambda _analysis, to: (
            NotifyResult(
                to=to,
                tier="high",
                body="STOP",
                messages_sent=1,
                dry_run=True,
                results=[],
                warnings=[],
            ),
            [],
        ),
    )

    response = client.post(
        "/v1/ingest",
        data={"transcript": "gift cards now", "to": "+14105551234"},
    )
    body = response.json()
    assert response.status_code == 200
    assert body["db"]["action"] == "skipped"
    assert any("Database upsert failed" in w for w in body["warnings"])
    assert body["notify"] is not None


def test_report_upserts_without_sms(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        "app.upsert_report",
        lambda **_k: (
            DbUpsertResult(
                action="updated",
                scam_id="11111111-1111-1111-1111-111111111111",
                name="Family emergency / bail scam",
                frequency=4,
            ),
            [],
        ),
    )
    response = client.post(
        "/v1/report",
        json={
            "scam_type": "Family emergency / bail scam",
            "method": "gift card payment request",
            "target": "family member / older adult",
            "reasoning": "Phone call. Gift cards. Urgency.",
            "ai_generated": True,
            "platform": "phone",
        },
    )
    body = response.json()
    assert response.status_code == 200
    assert body["db"]["action"] == "updated"
    assert body["db"]["frequency"] == 4
    assert body["warnings"] == []


def test_report_requires_scam_type(client: TestClient) -> None:
    response = client.post("/v1/report", json={"scam_type": "  "})
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "missing_scam_type"


def test_ingest_requires_input(client: TestClient) -> None:
    response = client.post("/v1/ingest", data={})
    assert response.status_code == 400
    assert response.json()["detail"]["error"] == "missing_input"
