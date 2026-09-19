#!/usr/bin/env python3
"""Generate a short ElevenLabs TTS clip for detector demos. Not part of the public API."""

from __future__ import annotations

import os
from pathlib import Path

SAMPLE_TEXT = (
    "This is the Internal Revenue Service. Your refund is ready. "
    "Stay on the line and purchase gift cards to release the funds immediately."
)


def main() -> None:
    api_key = os.environ.get("ELEVENLABS_API_KEY")
    if not api_key:
        raise SystemExit("Set ELEVENLABS_API_KEY to generate a sample clip.")

    try:
        from elevenlabs.client import ElevenLabs
    except ImportError as exc:
        raise SystemExit("Install the official SDK: pip install elevenlabs") from exc

    client = ElevenLabs(api_key=api_key)
    audio = client.text_to_speech.convert(
        voice_id="JBFqnCBsd6RMkjVDRZzb",
        text=SAMPLE_TEXT,
        model_id="eleven_multilingual_v2",
    )

    out_dir = Path(__file__).resolve().parents[1] / "fixtures"
    out_dir.mkdir(exist_ok=True)
    out_path = out_dir / "irs_refund_sample.mp3"
    with out_path.open("wb") as handle:
        for chunk in audio:
            handle.write(chunk)

    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
