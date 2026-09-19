from __future__ import annotations

from fastapi import FastAPI, HTTPException

from warn_config import settings
from models import ErrorDetail, HealthResponse, NotifyRequest, NotifyResponse
from notifier import NotifierError, notify, textbelt_configured

app = FastAPI(
    title="Scam warning notifier",
    description="Turns the scam detector's tier + reason into severity-tiered Textbelt SMS that always link to the site.",
    version="0.1.0",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse(textbelt_configured=textbelt_configured())


@app.post(
    "/v1/notify",
    response_model=NotifyResponse,
    responses={400: {"model": ErrorDetail}, 502: {"model": ErrorDetail}},
)
def send_notification(req: NotifyRequest) -> NotifyResponse:
    if not req.to.strip():
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(error="missing_to", detail="A destination phone number is required.").model_dump(),
        )
    try:
        return notify(req, settings)
    except NotifierError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=ErrorDetail(
                error="textbelt_error",
                detail=exc.message,
                upstream_status=exc.upstream_status,
            ).model_dump(),
        ) from exc
