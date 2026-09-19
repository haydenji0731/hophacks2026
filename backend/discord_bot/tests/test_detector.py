import httpx
import pytest

from detector import DetectorError, analyze_text


@pytest.mark.asyncio
async def test_analyze_text_posts_transcript() -> None:
    async def handler(request: httpx.Request) -> httpx.Response:
        assert request.url.path.endswith("/v1/analyze")
        return httpx.Response(200, json={"scam_confidence": 0.8, "notification_tier": "high", "grok": {"is_scam": True}})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        payload = await analyze_text("Hi grandma buy gift cards", client=client)
    assert payload["scam_confidence"] == 0.8


@pytest.mark.asyncio
async def test_analyze_text_http_error() -> None:
    async def handler(_request: httpx.Request) -> httpx.Response:
        return httpx.Response(502, json={"detail": "nope"})

    transport = httpx.MockTransport(handler)
    async with httpx.AsyncClient(transport=transport) as client:
        with pytest.raises(DetectorError, match="HTTP 502"):
            await analyze_text("enough text here", client=client)
