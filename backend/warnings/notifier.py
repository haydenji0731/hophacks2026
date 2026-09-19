from __future__ import annotations

import httpx

from warn_config import Settings, settings
from messages import build_body, repeat_count
from models import NotifyRequest, NotifyResponse, SentMessage

TEXTBELT_URL = "https://textbelt.com/text"
FREE_TEXTBELT_KEY = "textbelt"


class NotifierError(Exception):
    def __init__(self, message: str, *, status_code: int = 502, upstream_status: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.upstream_status = upstream_status


def textbelt_configured(cfg: Settings | None = None) -> bool:
    cfg = cfg or settings
    return bool((cfg.textbelt_key or "").strip())


def _is_free_key(cfg: Settings) -> bool:
    return (cfg.textbelt_key or "").strip().lower() == FREE_TEXTBELT_KEY


def _send_one(body: str, to: str, cfg: Settings) -> tuple[SentMessage, int | None]:
    key = (cfg.textbelt_key or "").strip()
    try:
        resp = httpx.post(
            TEXTBELT_URL,
            data={"phone": to, "message": body, "key": key},
            timeout=cfg.request_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise NotifierError(f"Textbelt request failed: {exc}") from exc

    if resp.status_code >= 400:
        detail = (resp.text or "").strip().replace("\n", " ")[:400]
        raise NotifierError(
            f"Textbelt rejected the message (HTTP {resp.status_code}): {detail or resp.reason}",
            upstream_status=resp.status_code,
        )

    try:
        payload = resp.json()
    except ValueError as exc:
        raise NotifierError("Textbelt returned a non-JSON response") from exc

    if not isinstance(payload, dict) or not payload.get("success"):
        err = "unknown error"
        quota = None
        if isinstance(payload, dict):
            err = str(payload.get("error") or err)
            quota = payload.get("quotaRemaining")
        extra = f" (quota remaining: {quota})" if quota is not None else ""
        raise NotifierError(
            f"Textbelt rejected the message: {err}{extra}",
            upstream_status=resp.status_code,
        )

    text_id = payload.get("textId")
    quota = payload.get("quotaRemaining")
    quota_n = int(quota) if isinstance(quota, int) else None
    return (
        SentMessage(
            sid=str(text_id) if text_id is not None else None,
            status="sent",
            dry_run=False,
        ),
        quota_n,
    )


def notify(req: NotifyRequest, cfg: Settings | None = None) -> NotifyResponse:
    cfg = cfg or settings
    warnings: list[str] = []

    body = build_body(
        tier=req.notification_tier,
        reason=req.reason,
        scam_type=req.scam_type,
        scam_confidence=req.scam_confidence,
        site_url=req.site_url,
        cfg=cfg,
    )

    count = repeat_count(req.notification_tier, cfg)
    if req.notification_tier == "low" and not cfg.send_low_tier:
        return NotifyResponse(
            to=req.to,
            tier=req.notification_tier,
            body=body,
            messages_sent=0,
            dry_run=not textbelt_configured(cfg),
            results=[],
            warnings=["Low tier is optional and disabled (set send_low_tier to enable)."],
        )

    dry_run = not textbelt_configured(cfg)
    if dry_run:
        warnings.append("Textbelt not configured; running in dry-run (message built, not sent).")
        results = [SentMessage(status="dry_run", dry_run=True) for _ in range(count)]
        return NotifyResponse(
            to=req.to,
            tier=req.notification_tier,
            body=body,
            messages_sent=len(results),
            dry_run=True,
            results=results,
            warnings=warnings,
        )

    if _is_free_key(cfg) and count > 1:
        count = 1
        warnings.append("Free Textbelt key (1 SMS/day); high-tier repeats skipped.")

    results: list[SentMessage] = []
    to = req.to.strip()
    quota: int | None = None
    for _ in range(count):
        sent, quota = _send_one(body, to, cfg)
        results.append(sent)
    if quota is not None:
        warnings.append(f"Textbelt quota remaining: {quota}.")

    return NotifyResponse(
        to=req.to,
        tier=req.notification_tier,
        body=body,
        messages_sent=len(results),
        dry_run=False,
        results=results,
        warnings=warnings,
    )
