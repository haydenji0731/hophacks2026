from __future__ import annotations

import httpx

from warn_config import Settings, settings
from messages import build_body, repeat_count
from models import NotifyRequest, NotifyResponse, SentMessage


class NotifierError(Exception):
    def __init__(self, message: str, *, status_code: int = 502, upstream_status: int | None = None):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.upstream_status = upstream_status


def twilio_configured(cfg: Settings | None = None) -> bool:
    cfg = cfg or settings
    return bool(cfg.twilio_account_sid and cfg.twilio_auth_token and cfg.twilio_from_number)


def _send_one(body: str, to: str, cfg: Settings) -> SentMessage:
    url = f"https://api.twilio.com/2010-04-01/Accounts/{cfg.twilio_account_sid}/Messages.json"
    try:
        resp = httpx.post(
            url,
            data={"To": to, "From": cfg.twilio_from_number, "Body": body},
            auth=(cfg.twilio_account_sid or "", cfg.twilio_auth_token or ""),
            timeout=cfg.request_timeout_seconds,
        )
    except httpx.HTTPError as exc:
        raise NotifierError(f"Twilio request failed: {exc}") from exc

    if resp.status_code >= 400:
        raise NotifierError(
            "Twilio rejected the message",
            upstream_status=resp.status_code,
        )

    payload = resp.json()
    return SentMessage(sid=payload.get("sid"), status=payload.get("status", "queued"), dry_run=False)


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
            dry_run=not twilio_configured(cfg),
            results=[],
            warnings=["Low tier is optional and disabled (set send_low_tier to enable)."],
        )

    dry_run = not twilio_configured(cfg)
    if dry_run:
        warnings.append("Twilio not configured; running in dry-run (message built, not sent).")
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

    results: list[SentMessage] = []
    for _ in range(count):
        results.append(_send_one(body, req.to, cfg))

    return NotifyResponse(
        to=req.to,
        tier=req.notification_tier,
        body=body,
        messages_sent=len(results),
        dry_run=False,
        results=results,
        warnings=warnings,
    )
