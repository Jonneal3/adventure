from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any, Dict


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def artifact_dir() -> Path:
    root = _repo_root() / "artifacts" / "image-optimization"
    root.mkdir(parents=True, exist_ok=True)
    return root


def save_artifact(payload: Dict[str, Any], *, filename: str = "compiled_image_request_program.json") -> Path:
    path = artifact_dir() / filename
    blob = {"saved_at_unix": int(time.time()), **payload}
    path.write_text(json.dumps(blob, indent=2), encoding="utf-8")
    return path


def load_artifact(*, filename: str = "compiled_image_request_program.json") -> Dict[str, Any]:
    path = artifact_dir() / filename
    if not path.exists():
        raise FileNotFoundError(f"Artifact not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))
