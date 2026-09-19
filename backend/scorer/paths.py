from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
AI_AUDIO = ROOT / "backend" / "ai_audio"
TRAINING_DATA = ROOT / "training_data"


def ensure_import_paths() -> None:
    for path in (str(AI_AUDIO), str(TRAINING_DATA), str(ROOT)):
        if path not in sys.path:
            sys.path.insert(0, path)
