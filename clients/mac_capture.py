#!/usr/bin/env python3
"""
Mac laptop capture client: record a short chunk and POST to Linux /v1/process.

Does NOT run openWakeWord or ElevenLabs locally (those live on the Linux backend).

Usage:
  uv run --with sounddevice --with soundfile --with httpx --with numpy \\
    python clients/mac_capture.py --url http://LINUX_HOST:8000/v1/process

  # one-shot 30s clip (default)
  python clients/mac_capture.py --url http://192.168.1.10:8000/v1/process --seconds 30

  # loop: capture → POST → repeat
  python clients/mac_capture.py --url http://192.168.1.10:8000/v1/process --loop --to +14105551234
"""

from __future__ import annotations

import argparse
import json
import sys
import tempfile
import time
from pathlib import Path


def record_wav(path: Path, *, seconds: float, sample_rate: int, device: int | None) -> None:
    import numpy as np
    import sounddevice as sd
    import soundfile as sf

    frames = int(seconds * sample_rate)
    print(f"Recording {seconds:.1f}s @ {sample_rate} Hz …", file=sys.stderr)
    audio = sd.rec(
        frames,
        samplerate=sample_rate,
        channels=1,
        dtype="float32",
        device=device,
    )
    sd.wait()
    sf.write(str(path), audio, sample_rate, subtype="PCM_16")
    print(f"Wrote {path} ({path.stat().st_size} bytes)", file=sys.stderr)


def post_chunk(
    url: str,
    wav_path: Path,
    *,
    to: str | None,
    force_escalate: bool,
    timeout: float,
) -> dict:
    import httpx

    data: dict[str, str] = {}
    if to:
        data["to"] = to
    if force_escalate:
        data["force_escalate"] = "true"

    with wav_path.open("rb") as fh:
        files = {"file": (wav_path.name, fh, "audio/wav")}
        with httpx.Client(timeout=timeout) as client:
            resp = client.post(url, data=data, files=files)
    resp.raise_for_status()
    return resp.json()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Mac capture → Linux /v1/process")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8000/v1/process",
        help="Linux detector process endpoint",
    )
    parser.add_argument("--seconds", type=float, default=30.0, help="Chunk length")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--device", type=int, default=None, help="sounddevice input device index")
    parser.add_argument("--to", default=None, help="E.164 phone for Twilio on escalate")
    parser.add_argument(
        "--force-escalate",
        action="store_true",
        help="Force STT/Grok even if screen is not sensitive",
    )
    parser.add_argument("--loop", action="store_true", help="Keep capturing forever")
    parser.add_argument("--timeout", type=float, default=180.0)
    parser.add_argument(
        "--list-devices",
        action="store_true",
        help="Print sounddevice input devices and exit",
    )
    args = parser.parse_args(argv)

    if args.list_devices:
        import sounddevice as sd

        print(sd.query_devices())
        return 0

    while True:
        with tempfile.TemporaryDirectory(prefix="hophacks-capture-") as tmp:
            wav_path = Path(tmp) / "chunk.wav"
            try:
                record_wav(
                    wav_path,
                    seconds=args.seconds,
                    sample_rate=args.sample_rate,
                    device=args.device,
                )
            except Exception as exc:
                print(f"Record failed: {exc}", file=sys.stderr)
                return 1

            try:
                body = post_chunk(
                    args.url,
                    wav_path,
                    to=args.to,
                    force_escalate=args.force_escalate,
                    timeout=args.timeout,
                )
            except Exception as exc:
                print(f"POST failed: {exc}", file=sys.stderr)
                if not args.loop:
                    return 1
                time.sleep(1.0)
                continue

            print(json.dumps(body, indent=2))
            sens = body.get("sensitivity")
            esc = body.get("escalated")
            conf = body.get("scam_confidence")
            print(
                f"→ sensitivity={sens} escalated={esc} scam_confidence={conf}",
                file=sys.stderr,
            )

        if not args.loop:
            return 0
        time.sleep(0.25)


if __name__ == "__main__":
    raise SystemExit(main())
