from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile

from classifier import ClassifierError, classify_audio
from config import settings
from models import DetectResponse, ErrorDetail, HealthResponse

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
    title="AI audio detector",
    description="ElevenLabs synthetic-voice score for the scam-detector phone pipeline.",
    version="0.1.0",
)


@app.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    return HealthResponse()


@app.post(
    "/v1/detect",
    response_model=DetectResponse,
    responses={
        400: {"model": ErrorDetail},
        413: {"model": ErrorDetail},
        502: {"model": ErrorDetail},
        504: {"model": ErrorDetail},
    },
)
async def detect(file: UploadFile = File(...)) -> DetectResponse:
    filename = file.filename or "audio.mp3"
    suffix = ""
    if "." in filename:
        suffix = "." + filename.rsplit(".", 1)[-1].lower()

    content_type = (file.content_type or "").lower() or EXTENSION_TYPES.get(suffix, "")
    if content_type not in ALLOWED_CONTENT_TYPES and suffix not in EXTENSION_TYPES:
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

    try:
        return classify_audio(data, filename, content_type or EXTENSION_TYPES.get(suffix, "audio/mpeg"))
    except ClassifierError as exc:
        raise HTTPException(
            status_code=exc.status_code,
            detail=ErrorDetail(
                error="classifier_unavailable",
                detail=exc.message,
                upstream_status=exc.upstream_status,
            ).model_dump(),
        ) from exc
