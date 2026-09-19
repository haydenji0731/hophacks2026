#!/usr/bin/env python3
"""
Desktop capture sidecar: record a short clip and POST to Linux /v1/process.

Does NOT run openWakeWord, CLAP, or ElevenLabs locally (those live on ravens).
Not the website (frontend/) and not the browser extension (extension/).

Usage (from repo root):
  uv run --with sounddevice --with soundfile --with httpx --with numpy \\
    python desktop/listen.py --url http://127.0.0.1:8000/v1/process

  python desktop/listen.py --dry-run --save desktop/recordings/test.wav --seconds 3
  python desktop/listen.py --url http://127.0.0.1:8000/v1/process --loop
"""

from __future__ import annotations

import argparse
import json
import shutil
import sys
import tempfile
import time
from pathlib import Path


def record_wav(
    path: Path,
    *,
    seconds: float,
    sample_rate: int,
    device: int | None,
    stop_event=None,
    on_progress=None,
    on_stream=None,
) -> dict:
    import threading

    import numpy as np
    import sounddevice as sd
    import soundfile as sf

    frames = int(seconds * sample_rate)
    chunk = max(int(0.05 * sample_rate), 1)
    print(f"Recording {seconds:.1f}s @ {sample_rate} Hz …", file=sys.stderr)
    if device is None:
        default = sd.default.device
        print(f"Input device: {default} → {sd.query_devices(kind='input')['name']}", file=sys.stderr)
    else:
        print(f"Input device: {device} → {sd.query_devices(device)['name']}", file=sys.stderr)

    parts: list = []
    got = 0
    finished = threading.Event()

    def callback(indata, frames_n, _time_info, _status) -> None:
        nonlocal got
        if stop_event is not None and stop_event.is_set():
            raise sd.CallbackStop()
        remaining = frames - got
        if remaining <= 0:
            raise sd.CallbackStop()
        take = min(frames_n, remaining)
        parts.append(np.array(indata[:take], copy=True))
        got += take
        if on_progress is not None:
            on_progress(got / sample_rate, seconds)
        if got >= frames:
            raise sd.CallbackStop()

    with sd.InputStream(
        samplerate=sample_rate,
        channels=1,
        dtype="float32",
        device=device,
        blocksize=chunk,
        latency="low",
        callback=callback,
        finished_callback=lambda: finished.set(),
    ) as stream:
        if on_stream is not None:
            on_stream(stream)
        try:
            while not finished.wait(0.05):
                if stop_event is not None and stop_event.is_set():
                    print("Recording stopped.", file=sys.stderr)
                    break
        finally:
            if on_stream is not None:
                on_stream(None)

    if stop_event is not None and stop_event.is_set():
        print("Recording stopped.", file=sys.stderr)

    audio = np.concatenate(parts, axis=0) if parts else np.zeros((0, 1), dtype=np.float32)
    if audio.size == 0:
        peak = 0.0
        rms = 0.0
    else:
        peak = float(np.max(np.abs(audio)))
        rms = float(np.sqrt(np.mean(audio**2)))
    sf.write(str(path), audio, sample_rate, subtype="PCM_16")
    print(
        f"Wrote {path} ({path.stat().st_size} bytes)  peak={peak:.4f} rms={rms:.4f}",
        file=sys.stderr,
    )
    if peak < 0.01:
        print(
            "WARNING: near-silence — wrong mic, muted input, or permission denied. "
            "Try --list-devices and --device N, or check System Settings → Privacy → Microphone.",
            file=sys.stderr,
        )
    elif peak < 0.05:
        print("NOTE: very quiet — speak louder or move closer to the mic.", file=sys.stderr)
    else:
        print("Audio levels look OK.", file=sys.stderr)
    return {"peak": peak, "rms": rms}


def post_chunk(
    url: str,
    wav_path: Path,
    *,
    to: str | None,
    force_escalate: bool,
    timeout: float,
    on_client=None,
    on_event=None,
) -> dict:
    import httpx

    data: dict[str, str] = {}
    if to:
        data["to"] = to
    if force_escalate:
        data["force_escalate"] = "true"
    if on_event is not None:
        data["stream"] = "true"

    with wav_path.open("rb") as fh:
        files = {"file": (wav_path.name, fh, "audio/wav")}
        with httpx.Client(timeout=timeout) as client:
            if on_client is not None:
                on_client(client)
            try:
                if on_event is None:
                    resp = client.post(url, data=data, files=files)
                    resp.raise_for_status()
                    return resp.json()
                with client.stream("POST", url, data=data, files=files) as resp:
                    resp.raise_for_status()
                    return _read_process_stream(resp, on_event)
            finally:
                if on_client is not None:
                    on_client(None)


def _read_process_stream(resp, on_event) -> dict:
    final: dict | None = None
    buf = ""
    for chunk in resp.iter_text():
        buf += chunk
        while "\n" in buf:
            line, buf = buf.split("\n", 1)
            final = _ingest_stream_line(line, on_event, final)
    final = _ingest_stream_line(buf, on_event, final)
    if not isinstance(final, dict):
        raise RuntimeError("empty detector response")
    return final


def _ingest_stream_line(line: str, on_event, final: dict | None) -> dict | None:
    line = line.strip()
    if not line:
        return final
    obj = json.loads(line)
    if not isinstance(obj, dict):
        return final
    if obj.get("stage"):
        on_event(obj)
        if obj.get("stage") == "done" and isinstance(obj.get("result"), dict):
            return obj["result"]
        return final
    on_event({"stage": "done", "result": obj})
    return obj


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="Desktop listen → Linux /v1/process")
    parser.add_argument(
        "--url",
        default="http://127.0.0.1:8000/v1/process",
        help="Linux detector process endpoint (via SSH tunnel usually)",
    )
    parser.add_argument("--seconds", type=float, default=30.0, help="Chunk length")
    parser.add_argument("--sample-rate", type=int, default=16000)
    parser.add_argument("--device", type=int, default=None, help="sounddevice input device index")
    parser.add_argument("--to", default=None, help="E.164 phone for Textbelt on escalate")
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
    parser.add_argument(
        "--save",
        type=Path,
        default=None,
        help="Copy each chunk to this path (e.g. /tmp/hophacks-test.wav) to listen with afplay",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Record only; do not POST (use with --save to verify mic)",
    )
    args = parser.parse_args(argv)

    if args.list_devices:
        import sounddevice as sd

        print(sd.query_devices())
        print("\nDefault input:", sd.default.device, file=sys.stderr)
        return 0

    while True:
        with tempfile.TemporaryDirectory(prefix="whs-listen-") as tmp:
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

            if args.save:
                args.save.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(wav_path, args.save)
                print(f"Saved copy → {args.save}  (play: afplay {args.save})", file=sys.stderr)

            if args.dry_run:
                print("Dry-run: skipped POST.", file=sys.stderr)
                if not args.loop:
                    return 0
                time.sleep(0.25)
                continue

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
