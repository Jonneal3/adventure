from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, Optional, Tuple


@dataclass(frozen=True)
class ModelCatalogEntry:
    key: str
    model_id: str
    label: str
    speed: str
    quality: str
    max_reference_images: int
    best_for: Tuple[str, ...]
    output_format: str = "png"
    aspect_ratio: str = ""
    guidance_scale: float = 6.0
    num_inference_steps: int = 18
    prompt_upsampling: Optional[bool] = None
    safety_tolerance: int = 2
    prompt_strength: Optional[float] = None
    image_prompt_strength: Optional[float] = None
    go_fast: Optional[bool] = None
    required_tags: Tuple[str, ...] = ()
    traits: Tuple[str, ...] = ("high_prompt_adherence",)
    priorities: Tuple[str, ...] = ("highest_quality", "highest_reliability", "lowest_cost")
    provider_input_style: str = "generic"
    notes: str = ""


FLUX_PRO = ModelCatalogEntry(
    key="flux-pro-scene",
    model_id="black-forest-labs/flux-1.1-pro",
    label="Flux Pro",
    speed="medium",
    quality="high",
    max_reference_images=0,
    best_for=("scene_text_to_image", "photoreal_generation"),
    output_format="png",
    aspect_ratio="1:1",
    guidance_scale=6.0,
    num_inference_steps=18,
    provider_input_style="flux-pro",
    required_tags=("landscapes",),
    traits=("high_prompt_adherence", "landscape_generation"),
    notes="Best default for fresh scene generation without anchor images.",
)

FLUX_2_PRO = ModelCatalogEntry(
    key="flux-2-pro-edit",
    model_id="black-forest-labs/flux-2-pro",
    label="Flux 2 Pro",
    speed="medium",
    quality="very_high",
    max_reference_images=8,
    best_for=(
        "scene_text_to_image",
        "scene_edit",
        "scene_refinement",
        "scene_placement",
        "iterative_edit",
        "anchor_preservation",
    ),
    output_format="png",
    aspect_ratio="match_input_image",
    guidance_scale=6.0,
    num_inference_steps=28,
    provider_input_style="flux-2",
    required_tags=("landscapes",),
    traits=("high_prompt_adherence", "edit_preservation", "multi_image_edit", "photoreal_generation"),
    priorities=("highest_quality", "highest_reliability", "lowest_latency"),
    notes="Highest-quality default for successive scene edits and multi-reference placement.",
)

FLUX_KONTEXT = ModelCatalogEntry(
    key="flux-kontext-edit",
    model_id="black-forest-labs/flux-kontext-pro",
    label="Flux Kontext",
    speed="medium",
    quality="high",
    max_reference_images=1,
    best_for=("scene_edit", "anchor_preservation", "single_image_edit"),
    output_format="png",
    aspect_ratio="match_input_image",
    guidance_scale=5.5,
    num_inference_steps=25,
    prompt_upsampling=True,
    prompt_strength=0.66,
    image_prompt_strength=0.86,
    provider_input_style="flux-kontext",
    required_tags=("landscapes",),
    traits=("high_prompt_adherence", "edit_preservation"),
    notes="Best default for anchored scene edits with one primary reference image.",
)

P_IMAGE_EDIT = ModelCatalogEntry(
    key="p-image-fast-edit",
    model_id="prunaai/p-image-edit",
    label="P-Image Edit",
    speed="very_fast",
    quality="medium",
    max_reference_images=4,
    best_for=("fast_preview_edit", "localized_edit", "single_image_edit"),
    output_format="jpg",
    aspect_ratio="match_input_image",
    guidance_scale=1.0,
    num_inference_steps=1,
    provider_input_style="p-image-edit",
    traits=("high_prompt_adherence", "low_latency", "edit_preservation"),
    priorities=("lowest_latency", "lowest_cost", "highest_quality"),
    notes="Sub-second preview editor for simple interactive refinements.",
)

P_IMAGE = ModelCatalogEntry(
    key="p-image-fast-draft",
    model_id="prunaai/p-image",
    label="P-Image",
    speed="very_fast",
    quality="medium",
    max_reference_images=0,
    best_for=("fast_preview_generation", "option_images", "thumbnails", "speed"),
    output_format="jpg",
    aspect_ratio="16:9",
    guidance_scale=1.0,
    num_inference_steps=1,
    prompt_upsampling=False,
    provider_input_style="p-image",
    traits=("high_prompt_adherence", "low_latency"),
    priorities=("lowest_latency", "lowest_cost", "highest_quality"),
    notes="Warm sub-second text-to-image model for progressive concept drafts.",
)

GROK_IMAGINE_IMAGE = ModelCatalogEntry(
    key="grok-inpaint",
    model_id="xai/grok-imagine-image",
    label="Grok Imagine Image",
    speed="fast",
    quality="high",
    max_reference_images=1,
    best_for=("scene_placement", "scene_refinement", "inpainting", "localized_edit"),
    output_format="jpg",
    aspect_ratio="1:1",
    guidance_scale=6.0,
    num_inference_steps=18,
    prompt_strength=0.84,
    image_prompt_strength=0.9,
    provider_input_style="grok-image",
    traits=("high_prompt_adherence", "inpainting", "composition_preservation"),
    priorities=("highest_quality", "lowest_latency", "lowest_cost"),
    notes="Fast preserve-and-edit model for placement, drilldown, and refinement flows.",
)

NANO_BANANA = ModelCatalogEntry(
    key="nano-banana-tryon",
    model_id="google/nano-banana",
    label="Nano Banana",
    speed="fast",
    quality="high",
    max_reference_images=4,
    best_for=("tryon", "multi_image_edit", "person_product_edit"),
    output_format="jpg",
    guidance_scale=6.0,
    num_inference_steps=18,
    prompt_strength=0.72,
    image_prompt_strength=0.88,
    provider_input_style="generic",
    required_tags=("faces", "portraits"),
    traits=("high_prompt_adherence", "human_shape_preservation", "identity_preservation"),
    priorities=("highest_quality", "highest_reliability", "lowest_latency"),
    notes="Best default when a person image and product image must be combined.",
)

FLUX_SCHNELL = ModelCatalogEntry(
    key="flux-schnell-thumbnail",
    model_id="black-forest-labs/flux-schnell",
    label="Flux Schnell",
    speed="very_fast",
    quality="medium",
    max_reference_images=0,
    best_for=("option_images", "thumbnails", "speed"),
    output_format="webp",
    aspect_ratio="1:1",
    guidance_scale=3.5,
    num_inference_steps=4,
    go_fast=True,
    provider_input_style="flux-schnell",
    priorities=("lowest_latency", "lowest_cost", "highest_quality"),
    notes="Fastest acceptable model for option thumbnails and other speed-first image tasks.",
)

MODEL_CATALOG: Dict[str, ModelCatalogEntry] = {
    entry.model_id: entry
    for entry in (
        FLUX_PRO,
        FLUX_2_PRO,
        FLUX_KONTEXT,
        P_IMAGE,
        P_IMAGE_EDIT,
        GROK_IMAGINE_IMAGE,
        NANO_BANANA,
        FLUX_SCHNELL,
    )
}


def normalize_use_case(raw: str) -> str:
    value = str(raw or "").strip().lower().replace("_", "-")
    if value in {"tryon", "try-on"}:
        return "tryon"
    if value in {"scene", "scene-placement", "scene-refinement", "drilldown"}:
        return value
    return "scene"


def get_model_entry(model_id: str) -> Optional[ModelCatalogEntry]:
    return MODEL_CATALOG.get(str(model_id or "").strip())


def resolve_model_entry(
    *,
    use_case: str = "scene",
    has_reference_images: bool = False,
    has_scene_image: bool = False,
    has_product_image: bool = False,
    has_user_image: bool = False,
    is_thumbnail: bool = False,
) -> ModelCatalogEntry:
    if is_thumbnail:
        return FLUX_SCHNELL

    normalized = normalize_use_case(use_case)

    if normalized == "tryon":
        return NANO_BANANA

    if normalized == "scene-refinement":
        return FLUX_2_PRO

    if normalized in {"scene-placement", "drilldown"}:
        return FLUX_2_PRO

    if normalized == "scene" and (has_reference_images or has_scene_image or has_product_image or has_user_image):
        return FLUX_2_PRO

    return FLUX_PRO


__all__ = [
    "FLUX_2_PRO",
    "FLUX_KONTEXT",
    "FLUX_PRO",
    "FLUX_SCHNELL",
    "GROK_IMAGINE_IMAGE",
    "MODEL_CATALOG",
    "NANO_BANANA",
    "P_IMAGE",
    "P_IMAGE_EDIT",
    "ModelCatalogEntry",
    "get_model_entry",
    "normalize_use_case",
    "resolve_model_entry",
]
