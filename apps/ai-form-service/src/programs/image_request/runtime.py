from __future__ import annotations

import os
from typing import Any, Dict, Optional

from programs.image_request.optimizers.image_request_driver import hydrate_program
from programs.image_request.training.artifacts import load_artifact
from programs.image_request.types import ImageSpec, spec_to_promptable_text


def _is_enabled() -> bool:
    return str(os.getenv("IMAGE_OPT_USE_ARTIFACT") or "").strip().lower() in {"1", "true", "yes"}


def _payload_task(payload: Dict[str, Any]) -> str:
    use_case = str(payload.get("useCase") or "").strip().lower()
    refs = payload.get("referenceImages") if isinstance(payload.get("referenceImages"), list) else []
    has_refs = len([x for x in refs if isinstance(x, str) and x.strip()]) > 0
    has_mask = bool(str(payload.get("maskImage") or payload.get("mask_image") or "").strip())
    if use_case in {"inpaint"} or has_mask:
        return "inpaint"
    if has_refs or use_case in {"scene-placement", "tryon", "drilldown"}:
        return "img2img"
    return "t2i"


def _payload_aspect(payload: Dict[str, Any]) -> str:
    try:
        w = int(payload.get("width") or 0)
        h = int(payload.get("height") or 0)
        if w > 0 and h > 0:
            return f"{w}:{h}"
    except Exception:
        pass
    return "1:1"


def maybe_build_optimized_request(payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    if not _is_enabled():
        return None
    try:
        artifact = load_artifact()
        program = hydrate_program(artifact.get("program") or {})
    except Exception:
        return None

    step_data = payload.get("stepDataSoFar") if isinstance(payload.get("stepDataSoFar"), dict) else {}
    user_prompt = str(step_data.get("step-promptInput") or step_data.get("prompt") or payload.get("promptHint") or "").strip()
    if not user_prompt:
        user_prompt = "Generate a high quality image that matches the user context."
    style = str(step_data.get("style") or payload.get("useCase") or "photoreal").strip()
    constraints = str(payload.get("negativePrompt") or "").strip()
    refs = payload.get("referenceImages") if isinstance(payload.get("referenceImages"), list) else []
    ref = next((x for x in refs if isinstance(x, str) and x.strip()), None)
    mask = str(payload.get("maskImage") or payload.get("mask_image") or "").strip() or None

    spec = ImageSpec(
        user_prompt=user_prompt,
        style_preset=style or "photoreal",
        aspect=_payload_aspect(payload),
        constraints=constraints,
        reference_image_url=ref,
        mask_image_url=mask,
        task=_payload_task(payload),
    )
    req = program(spec_to_promptable_text(spec, policy=program.policy))
    return {"prompt": req.prompt, "negativePrompt": req.negative_prompt, "params": req.params}
