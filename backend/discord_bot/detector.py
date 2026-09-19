from __future__ import annotations

from typing import Any

import httpx

from config import settings


class DetectorError(Exception):
    def __init__(self, message: str, *, status_code: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code


async def analyze_text(text: str, *, client: httpx.AsyncClient | None = None) -> dict[str, Any]:
    owns = client is None
    http = client or httpx.AsyncClient(timeout=settings.request_timeout_seconds)
    url = settings.detector_url.rstrip("/") + "/v1/analyze"
    try:
        response = await http.post(url, data={"transcript": text})
    except httpx.RequestError as exc:
        raise DetectorError(f"Could not reach detector at {url}: {exc}") from exc
    finally:
        if owns:
            await http.aclose()

    if response.status_code >= 400:
        raise DetectorError(
            f"Detector returned HTTP {response.status_code}",
            status_code=response.status_code,
        )
    try:
        return response.json()
    except ValueError as exc:
        raise DetectorError("Detector returned non-JSON") from exc
