"""
Intelligent model selection based on task requirements.

Instead of hardcoding model choices per API route, this module examines
the input signals (number of images, use case, transformation type) and
returns the optimal model + parameters.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional


@dataclass
class ModelRecommendation:
    model_id: str
    guidance_scale: float
    num_inference_steps: int
    max_reference_images: int
    aspect_ratio: str = ""
    output_format: str = "png"
    prompt_upsampling: Optional[bool] = None
    safety_tolerance: int = 2

    def to_dict(self) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "modelId": self.model_id,
            "guidanceScale": self.guidance_scale,
            "numInferenceSteps": self.num_inference_steps,
            "maxReferenceImages": self.max_reference_images,
            "outputFormat": self.output_format,
            "safetyTolerance": self.safety_tolerance,
        }
        if self.aspect_ratio:
            d["aspectRatio"] = self.aspect_ratio
        if self.prompt_upsampling is not None:
            d["promptUpsampling"] = self.prompt_upsampling
        return d


# ---- Model presets ----

FLUX_PRO = ModelRecommendation(
    model_id="black-forest-labs/flux-1.1-pro",
    guidance_scale=6.0,
    num_inference_steps=18,
    max_reference_images=0,
    aspect_ratio="1:1",
    output_format="png",
)

FLUX_KONTEXT = ModelRecommendation(
    model_id="black-forest-labs/flux-kontext-pro",
    guidance_scale=5.5,
    num_inference_steps=25,
    max_reference_images=1,
    aspect_ratio="match_input_image",
    output_format="png",
    prompt_upsampling=True,
)

NANO_BANANA = ModelRecommendation(
    model_id="google/nano-banana",
    guidance_scale=6.0,
    num_inference_steps=18,
    max_reference_images=4,
    output_format="jpg",
)

FLUX_SCHNELL = ModelRecommendation(
    model_id="black-forest-labs/flux-schnell",
    guidance_scale=3.5,
    num_inference_steps=4,
    max_reference_images=0,
    aspect_ratio="1:1",
    output_format="webp",
)


def select_model(
    *,
    use_case: str = "scene",
    num_input_images: int = 0,
    has_scene_image: bool = False,
    has_product_image: bool = False,
    has_user_image: bool = False,
    is_thumbnail: bool = False,
) -> ModelRecommendation:
    """
    Select the best model and parameters for the given task.

    Priority logic:
    1. Thumbnails/option images -> Schnell (fast, cheap)
    2. Try-on (user + product) -> Nano Banana (multi-image)
    3. Scene-placement (scene + product) -> Nano Banana (multi-image)
    4. 1 input image + edit -> Kontext Pro (single-image edit)
    5. 0 input images -> Flux 1.1 Pro (text-to-image)
    """
    if is_thumbnail:
        return FLUX_SCHNELL

    uc = use_case.lower().replace("_", "-").strip()

    if uc in ("tryon", "try-on"):
        if has_user_image and has_product_image:
            return NANO_BANANA
        if num_input_images >= 2:
            return NANO_BANANA
        if num_input_images == 1:
            return FLUX_KONTEXT
        return FLUX_PRO

    if uc == "scene-placement":
        if has_scene_image and has_product_image:
            return NANO_BANANA
        if num_input_images >= 2:
            return NANO_BANANA
        if num_input_images == 1:
            return FLUX_KONTEXT
        return FLUX_PRO

    if uc == "drilldown":
        if num_input_images >= 2:
            return NANO_BANANA
        if num_input_images == 1:
            return FLUX_KONTEXT
        return FLUX_PRO

    # Default "scene" use case
    if num_input_images >= 2:
        return NANO_BANANA
    if num_input_images == 1:
        return FLUX_KONTEXT
    return FLUX_PRO


__all__ = ["ModelRecommendation", "select_model"]
