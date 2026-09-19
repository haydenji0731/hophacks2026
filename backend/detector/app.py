from __future__ import annotations

from fastapi import FastAPI, File, Form, HTTPException, UploadFile

from ingest import IngestInputs, ingest_incident
from pipeline import analyze_incident
from schemas import AnalyzeResponse, ErrorDetail, HealthResponse, IngestResponse
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
        "Combines ElevenLabs AI-voice scores with Grok language flags; "
        "ingest upserts scam patterns and sends Twilio warnings."
    ),
    version="0.1.0",
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
    """Analyze transcript/audio; if scam, upsert pattern row and send Twilio SMS."""
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
