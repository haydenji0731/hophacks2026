from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
AI_AUDIO = ROOT / "backend" / "ai_audio"
TRAINING_DATA = ROOT / "training_data"
DB = ROOT / "backend" / "db"
WARNINGS = ROOT / "backend" / "warnings"


def ensure_import_paths() -> None:
    # Insert last → first so AI_AUDIO wins for colliding top-level names like `models`.
    for path in (str(ROOT), str(TRAINING_DATA), str(DB), str(WARNINGS), str(AI_AUDIO)):
        if path not in sys.path:
            sys.path.insert(0, path)


def prefer_package(path: Path, drop_modules: tuple[str, ...] = ()) -> None:
    """Put a sibling package first on sys.path and drop colliding module caches."""
    ensure_import_paths()
    resolved = str(path)
    if resolved in sys.path:
        sys.path.remove(resolved)
    sys.path.insert(0, resolved)
    for name in drop_modules:
        sys.modules.pop(name, None)
