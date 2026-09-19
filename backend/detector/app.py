from __future__ import annotations

from fastapi import FastAPI, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from ingest import IngestInputs, ingest_incident, upsert_report
from news_wire import live_cards, refresh_wire
from process import ProcessInputs, process_audio
from pipeline import analyze_incident
from screen import run_screen
from schemas import (
    AnalyzeResponse,
    ErrorDetail,
    HealthResponse,
    IngestResponse,
    KeywordHitOut,
    NewsFeedResponse,
    ProcessResponse,
    ReportRequest,
    ReportResponse,
    ScreenResponse,
)
from settings import settings

ALLOWED_CONTENT_TYPES = {
    "audio/mpeg",
    "audio/mp3",
    "audio/wav",
    "audio/x-wav",
    "audio/wave",
    "audio/ogg",
    "audio/webm",
    "video/webm",
    "application/octet-stream",
}

EXTENSION_TYPES = {
    ".mp3": "audio/mpeg",
    ".wav": "audio/wav",
    ".ogg": "audio/ogg",
    ".webm": "audio/webm",
}

app = FastAPI(
    title="Scam detector",
    description=(
        "Mid-call screen (ElevenLabs + openWakeWord) → escalate STT/Grok → log + Textbelt. "
        "Also supports analyze/ingest/report."
    ),
    version="0.2.0",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:5174",
        "http://localhost:5174",
        "http://127.0.0.1:5175",
        "http://localhost:5175",
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


def _audio_content_type(filename: str, declared: str | None) -> str | None:
    suffix = ""
    if "." in filename:
        suffix = "." + filename.rsplit(".", 1)[-1].lower()
    content_type = (declared or "").lower() or EXTENSION_TYPES.get(suffix, "")
    if content_type not in ALLOWED_CONTENT_TYPES and suffix not in EXTENSION_TYPES:
        return None
    return content_type or EXTENSION_TYPES.get(suffix, "audio/mpeg")


async def _read_audio(file: UploadFile | None) -> tuple[bytes, str, str] | None:
    if file is None or not file.filename:
        return None
    filename = file.filename or "audio.mp3"
    content_type = _audio_content_type(filename, file.content_type)
    if content_type is None:
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(
                error="unsupported_media_type",
                detail="Upload mp3, wav, ogg, or webm audio.",
            ).model_dump(),
        )
    data = await file.read()
    if not data:
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(error="empty_file", detail="Uploaded audio was empty.").model_dump(),
        )
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=413,
            detail=ErrorDetail(
                error="file_too_large",
                detail=f"Audio exceeds {settings.max_upload_bytes} bytes.",
            ).model_dump(),
        )
    return data, filename, content_type


@app.post(
    "/v1/analyze",
    response_model=AnalyzeResponse,
    responses={
        400: {"model": ErrorDetail},
        413: {"model": ErrorDetail},
        502: {"model": ErrorDetail},
    },
)
async def analyze(
    transcript: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
) -> AnalyzeResponse:
    text = (transcript or "").strip() or None
    audio = await _read_audio(file)

    if text is None and audio is None:
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(
                error="missing_input",
                detail="Provide a transcript form field and/or an audio file.",
            ).model_dump(),
        )

    try:
        return analyze_incident(transcript=text, audio=audio)
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=ErrorDetail(error="no_signals", detail=str(exc)).model_dump(),
        ) from exc


@app.post(
    "/v1/ingest",
    response_model=IngestResponse,
    responses={
        400: {"model": ErrorDetail},
        413: {"model": ErrorDetail},
        502: {"model": ErrorDetail},
    },
)
async def ingest(
    transcript: str | None = Form(default=None),
    to: str | None = Form(default=None),
    file: UploadFile | None = File(default=None),
) -> IngestResponse:
    """Analyze transcript/audio; if scam, upsert pattern row and send Textbelt SMS."""
    text = (transcript or "").strip() or None
    audio = await _read_audio(file)

    if text is None and audio is None:
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(
                error="missing_input",
                detail="Provide a transcript form field and/or an audio file.",
            ).model_dump(),
        )

    try:
        return ingest_incident(
            IngestInputs(
                transcript=text,
                to=(to or "").strip() or None,
                audio=audio,
            )
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=502,
            detail=ErrorDetail(error="no_signals", detail=str(exc)).model_dump(),
        ) from exc


@app.post(
    "/v1/report",
    response_model=ReportResponse,
    responses={400: {"model": ErrorDetail}},
)
def report(req: ReportRequest) -> ReportResponse:
    """User-confirmed 'this happened to me' — upsert pattern, no SMS."""
    if not (req.scam_type or "").strip():
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(
                error="missing_scam_type",
                detail="scam_type is required.",
            ).model_dump(),
        )
    db_result, warnings = upsert_report(
        scam_type=req.scam_type.strip(),
        method=req.method,
        target=req.target,
        reasoning=req.reasoning,
        ai_generated=req.ai_generated,
        platform=req.platform,
    )
    return ReportResponse(db=db_result, warnings=warnings)


@app.post(
    "/v1/screen",
    response_model=ScreenResponse,
    responses={400: {"model": ErrorDetail}, 413: {"model": ErrorDetail}},
)
async def screen_audio(file: UploadFile = File(...)) -> ScreenResponse:
    """Cheap screen only: clip → ElevenLabs + openWakeWord → alarm / sensitivity."""
    audio = await _read_audio(file)
    if audio is None:
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(error="missing_input", detail="Audio file required.").model_dump(),
        )
    data, filename, content_type = audio
    result = run_screen(data, filename, content_type)
    return ScreenResponse(
        elevenlabs_ai_score=result.elevenlabs_ai_score,
        ai_voice_used=result.ai_voice_used,  # type: ignore[arg-type]
        ai_generated=result.ai_generated,
        keyword_hits=[KeywordHitOut(**h) for h in result.keyword_hits],
        alarm_score=result.alarm_score,
        sensitivity=result.sensitivity,  # type: ignore[arg-type]
        escalate=result.escalate,
        clipped_seconds=result.clipped_seconds,
        warnings=result.warnings,
    )


@app.post(
    "/v1/process",
    response_model=ProcessResponse,
    responses={
        400: {"model": ErrorDetail},
        413: {"model": ErrorDetail},
        502: {"model": ErrorDetail},
    },
)
async def process(
    file: UploadFile = File(...),
    to: str | None = Form(default=None),
    force_escalate: bool = Form(default=False),
) -> ProcessResponse:
    """
    Full demo path: screen → if sensitive, STT + Grok → if scam, log + notify.
    Mac capture clients should POST audio chunks here (Linux backend).
    """
    audio = await _read_audio(file)
    if audio is None:
        raise HTTPException(
            status_code=400,
            detail=ErrorDetail(error="missing_input", detail="Audio file required.").model_dump(),
        )
    return process_audio(
        ProcessInputs(
            audio=audio,
            to=(to or "").strip() or None,
            force_escalate=force_escalate,
        )
    )


def _news_authorized(secret_header: str | None, authorization: str | None) -> bool:
    expected = (settings.news_refresh_secret or "").strip()
    if not expected:
        return True
    if (secret_header or "").strip() == expected:
        return True
    auth = (authorization or "").strip()
    if auth.lower().startswith("bearer ") and auth[7:].strip() == expected:
        return True
    return False


@app.get("/v1/news", response_model=NewsFeedResponse)
def get_news() -> NewsFeedResponse:
    """Home-page wire: newest scams first. Does not call Grok."""
    return NewsFeedResponse.model_validate(live_cards())


@app.post(
    "/v1/news/refresh",
    response_model=NewsFeedResponse,
    responses={
        400: {"model": ErrorDetail},
        401: {"model": ErrorDetail},
    },
)
def post_news_refresh(
    days: int | None = Query(default=None, ge=1, le=90),
    x_news_refresh_secret: str | None = Header(default=None),
    authorization: str | None = Header(default=None),
) -> NewsFeedResponse:
    """Grok Bot / CLI: recent scams → Grok deks → news_wire.json."""
    if not _news_authorized(x_news_refresh_secret, authorization):
        raise HTTPException(
            status_code=401,
            detail=ErrorDetail(
                error="unauthorized",
                detail="Invalid news refresh secret.",
            ).model_dump(),
        )
    return NewsFeedResponse.model_validate(refresh_wire(days=days))
