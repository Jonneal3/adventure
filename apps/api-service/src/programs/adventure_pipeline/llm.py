"""Small DSPy runner for the Adventure V7 orchestration calls (JSON in, JSON out)."""

from __future__ import annotations

import json
import os
from typing import Any, Dict, Optional

from programs.common.dspy_runtime import configure_dspy, make_dspy_lm_for_module
from programs.common.env import prefixed_model


def compact_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=True, separators=(",", ":"), sort_keys=True)


def _coerce_float(value: Any, default: float) -> float:
    try:
        return float(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _coerce_int(value: Any, default: int) -> int:
    try:
        return int(value) if value is not None else default
    except (TypeError, ValueError):
        return default


def _parse_json_object(raw: Any) -> Optional[Dict[str, Any]]:
    text = str(raw or "").strip()
    if not text:
        return None
    try:
        loaded = json.loads(text)
        if isinstance(loaded, dict):
            return loaded
    except Exception:
        pass
    # Fall back to the shared brace-matching extractor (handles fences / prose).
    from programs.pricing.replicate_vlm import _extract_json_from_text

    return _extract_json_from_text(text)


def run_json_signature(
    *,
    signature: Any,
    input_field: str,
    output_field: str,
    payload: Dict[str, Any],
    module_env_prefix: str,
    default_temperature: float = 0.2,
    default_max_tokens: int = 700,
    default_timeout: float = 30.0,
    module_default_model: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Run a single-shot DSPy prediction and parse the JSON output.
    Returns None whenever the model is unconfigured or the output is unusable,
    so every caller keeps a deterministic fallback path.
    """
    lm_cfg = make_dspy_lm_for_module(module_env_prefix=module_env_prefix, allow_small_models=True)
    if not lm_cfg:
        return None

    prefix = module_env_prefix.strip().upper()
    if module_default_model and not os.getenv(f"{prefix}_MODEL"):
        provider = str(lm_cfg.get("provider") or "groq")
        model_name = str(module_default_model).strip()
        lm_cfg = {
            **lm_cfg,
            "model": prefixed_model(provider, model_name),
            "modelName": model_name,
        }
    try:
        import dspy

        lm = dspy.LM(
            model=lm_cfg["model"],
            temperature=_coerce_float(os.getenv(f"{prefix}_TEMPERATURE"), default_temperature),
            max_tokens=_coerce_int(os.getenv(f"{prefix}_MAX_TOKENS"), default_max_tokens),
            timeout=_coerce_float(os.getenv(f"{prefix}_TIMEOUT"), default_timeout),
        )
        configure_dspy(lm)
        program = dspy.Predict(signature)
        with dspy.context(lm=lm):
            pred = program(**{input_field: compact_json(payload)})
    except Exception:
        return None

    return _parse_json_object(getattr(pred, output_field, None))


__all__ = ["run_json_signature", "compact_json"]
