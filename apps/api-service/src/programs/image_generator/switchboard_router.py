from __future__ import annotations

import json
import os
import subprocess
import time
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

_CACHE: Dict[str, Tuple[float, Optional[Dict[str, Any]]]] = {}


def _enabled() -> bool:
    v = str(os.getenv("SWITCHBOARD_ROUTING_ENABLED") or "true").strip().lower()
    return v not in {"0", "false", "no", "off"}


def _cache_ttl_sec() -> int:
    try:
        return max(1, min(300, int(str(os.getenv("SWITCHBOARD_ROUTING_CACHE_TTL_SEC") or "60").strip())))
    except Exception:
        return 60


def _timeout_sec() -> float:
    try:
        return max(0.2, min(5.0, float(str(os.getenv("SWITCHBOARD_ROUTING_TIMEOUT_SEC") or "1.5").strip())))
    except Exception:
        return 1.5


def _script_path() -> Path:
    return Path(__file__).resolve().parents[3] / "scripts" / "switchboard_recommend.mjs"


def _cache_key(
    *,
    use_case: str,
    num_input_images: int,
    has_input_image: bool,
    intent: str,
) -> str:
    return "|".join(
        [
            str(use_case or "").strip().lower(),
            str(max(0, int(num_input_images or 0))),
            "1" if bool(has_input_image) else "0",
            str(intent or "").strip().lower(),
        ]
    )


def recommend_replicate_model(
    *,
    use_case: str,
    num_input_images: int,
    has_input_image: bool,
    intent: str,
    prompt: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Best-effort Switchboard route recommendation for image generation.

    Returns a dict like:
      { "providerId": "replicate", "modelId": "...", "routeKey": "...", "acceptedCount": n }
    or None when unavailable.
    """
    if not _enabled():
        return None

    key = _cache_key(
        use_case=use_case,
        num_input_images=num_input_images,
        has_input_image=has_input_image,
        intent=intent,
    )
    now = time.time()
    cached = _CACHE.get(key)
    if cached and now < cached[0]:
        return cached[1]

    script = _script_path()
    if not script.exists():
        _CACHE[key] = (now + _cache_ttl_sec(), None)
        return None

    payload = {
        "useCase": use_case,
        "numInputImages": max(0, int(num_input_images or 0)),
        "hasInputImage": bool(has_input_image),
        "intent": str(intent or "").strip(),
        "prompt": str(prompt or ""),
    }
    try:
        proc = subprocess.run(
            ["node", str(script), json.dumps(payload, ensure_ascii=True)],
            capture_output=True,
            text=True,
            timeout=_timeout_sec(),
            check=False,
        )
    except Exception:
        _CACHE[key] = (now + _cache_ttl_sec(), None)
        return None

    if proc.returncode != 0:
        _CACHE[key] = (now + _cache_ttl_sec(), None)
        return None

    try:
        out = json.loads((proc.stdout or "").strip() or "{}")
    except Exception:
        _CACHE[key] = (now + _cache_ttl_sec(), None)
        return None

    if not isinstance(out, dict) or not out.get("ok"):
        _CACHE[key] = (now + _cache_ttl_sec(), None)
        return None
    if str(out.get("providerId") or "").strip().lower() != "replicate":
        _CACHE[key] = (now + _cache_ttl_sec(), None)
        return None

    model_id = str(out.get("modelId") or "").strip()
    if not model_id:
        _CACHE[key] = (now + _cache_ttl_sec(), None)
        return None

    result = {
        "providerId": "replicate",
        "modelId": model_id,
        "routeKey": str(out.get("routeKey") or "").strip() or None,
        "acceptedCount": int(out.get("acceptedCount") or 0),
    }
    _CACHE[key] = (now + _cache_ttl_sec(), result)
    return result

