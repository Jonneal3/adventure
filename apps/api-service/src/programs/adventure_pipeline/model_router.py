"""
Adventure-specific model routing.

Thin adapter over image_generator.model_catalog — does not fork the catalog.
Maps task quality/speed needs onto concrete model ids, overridable via env.
"""

from __future__ import annotations

import os
from dataclasses import asdict, dataclass
from typing import Any, Dict, Literal, Optional

from programs.image_generator.model_catalog import (
    FLUX_2_PRO,
    FLUX_KONTEXT,
    FLUX_PRO,
    FLUX_SCHNELL,
    P_IMAGE,
    P_IMAGE_EDIT,
    resolve_model_entry,
)


TaskTier = Literal["fast", "balanced", "edit", "best"]


@dataclass
class ModelChoice:
    model_id: str
    tier: TaskTier
    use_case: str
    reason: str
    source: str = "adventure_router"

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


def _env_model(key: str, default: str) -> str:
    return str(os.getenv(key) or "").strip() or default


# Defaults follow the image strategy: cheap inspiration, balanced ideas,
# edit models for refine, best quality for final.
_DEFAULTS: Dict[TaskTier, str] = {
    "fast": FLUX_SCHNELL.model_id,
    "balanced": FLUX_PRO.model_id,
    "edit": FLUX_2_PRO.model_id,
    "best": FLUX_2_PRO.model_id,
}


def _tier_for(*, mode: str, strategy: str, use_case: str) -> TaskTier:
    key = str(mode or "").strip().lower()
    strat = str(strategy or "").strip().lower()
    uc = str(use_case or "").strip().lower()

    if key == "final":
        return "best"
    if key == "inspiration":
        return "fast"
    if key in ("refine", "adjust") or strat == "edit" or uc == "scene-refinement":
        return "edit"
    if key in ("ideas", "explore"):
        return "balanced"
    return "balanced"


def choose_model(
    *,
    mode: str,
    strategy: str = "generate",
    use_case: str = "scene",
    has_reference: bool = False,
    has_scene: bool = False,
    explicit_model_id: Optional[str] = None,
) -> ModelChoice:
    """
    Pick a model for this adventure task.

    Explicit payload modelId always wins. Env overrides:
      ADVENTURE_MODEL_FAST / BALANCED / EDIT / BEST
    """
    if explicit_model_id and str(explicit_model_id).strip():
        return ModelChoice(
            model_id=str(explicit_model_id).strip(),
            tier=_tier_for(mode=mode, strategy=strategy, use_case=use_case),
            use_case=use_case,
            reason="Caller supplied modelId",
            source="explicit",
        )

    tier = _tier_for(mode=mode, strategy=strategy, use_case=use_case)
    env_key = {
        "fast": "ADVENTURE_MODEL_FAST",
        "balanced": "ADVENTURE_MODEL_BALANCED",
        "edit": "ADVENTURE_MODEL_EDIT",
        "best": "ADVENTURE_MODEL_BEST",
    }[tier]

    # Prefer kontext / p-image-edit for pure edits when configured; default stays flux-2-pro
    # which the existing scene-refinement path already uses successfully.
    default = _DEFAULTS[tier]
    if tier == "edit":
        default = _env_model("ADVENTURE_MODEL_EDIT", FLUX_2_PRO.model_id)
        # Allow opting into kontext via env without code change.
        if os.getenv("ADVENTURE_MODEL_EDIT"):
            default = _env_model("ADVENTURE_MODEL_EDIT", FLUX_2_PRO.model_id)
    elif tier == "fast":
        # p-image is also a strong cheap option when set.
        default = _env_model("ADVENTURE_MODEL_FAST", FLUX_SCHNELL.model_id)
    elif tier == "best":
        default = _env_model("ADVENTURE_MODEL_BEST", FLUX_2_PRO.model_id)
    else:
        default = _env_model("ADVENTURE_MODEL_BALANCED", FLUX_PRO.model_id)

    model_id = _env_model(env_key, default)

    # If nothing configured and we have a scene refine, fall back to catalog resolver
    # so we stay consistent with the rest of the product.
    if not os.getenv(env_key) and use_case == "scene-refinement":
        entry = resolve_model_entry(
            use_case=use_case,
            has_reference_images=has_reference,
            has_scene_image=has_scene,
        )
        model_id = entry.model_id

    return ModelChoice(
        model_id=model_id,
        tier=tier,
        use_case=use_case,
        reason=f"tier={tier} mode={mode} strategy={strategy}",
        source="adventure_router",
    )


# Re-export catalog ids useful for tests / docs without pulling the whole catalog.
KNOWN_MODELS = {
    "fast": FLUX_SCHNELL.model_id,
    "balanced": FLUX_PRO.model_id,
    "edit": FLUX_2_PRO.model_id,
    "best": FLUX_2_PRO.model_id,
    "edit_kontext": FLUX_KONTEXT.model_id,
    "fast_p_image": P_IMAGE.model_id,
    "edit_p_image": P_IMAGE_EDIT.model_id,
}


__all__ = ["ModelChoice", "choose_model", "KNOWN_MODELS"]
