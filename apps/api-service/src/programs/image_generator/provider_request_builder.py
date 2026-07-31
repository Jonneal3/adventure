from __future__ import annotations

from math import gcd
from typing import Any, Dict, List, Optional

from programs.image_generator.model_catalog import get_model_entry


def derive_aspect_ratio(width: Optional[int], height: Optional[int]) -> Optional[str]:
    if not isinstance(width, int) or not isinstance(height, int) or width <= 0 or height <= 0:
        return None

    ratio = f"{width // gcd(width, height)}:{height // gcd(width, height)}"
    allowed = {
        "1:1",
        "16:9",
        "9:16",
        "4:3",
        "3:4",
        "3:2",
        "2:3",
        "2:1",
        "1:2",
        "19.5:9",
        "9:19.5",
        "20:9",
        "9:20",
        "auto",
    }
    if ratio in allowed:
        return ratio
    if width == height:
        return "1:1"
    if width > height:
        return "16:9" if (width / height) >= 1.6 else "4:3"
    return "9:16" if (height / width) >= 1.6 else "3:4"


def build_replicate_request(
    *,
    prompt: str,
    model_id: str,
    num_outputs: int = 1,
    output_format: str = "png",
    negative_prompt: Optional[str] = None,
    aspect_ratio: Optional[str] = None,
    width: Optional[int] = None,
    height: Optional[int] = None,
    num_inference_steps: Optional[int] = None,
    guidance_scale: Optional[float] = None,
    prompt_strength: Optional[float] = None,
    image_prompt_strength: Optional[float] = None,
    safety_tolerance: Optional[int] = None,
    prompt_upsampling: Optional[bool] = None,
    go_fast: Optional[bool] = None,
    reference_images: Optional[List[str]] = None,
    scene_image: Optional[str] = None,
    product_image: Optional[str] = None,
) -> Dict[str, Any]:
    prompt_text = str(prompt or "").strip()
    model = str(model_id or "").strip()
    if not model:
        raise RuntimeError("model_id is required before building the provider request")

    profile = get_model_entry(model)
    style = profile.provider_input_style if profile else "generic"
    n = max(1, min(9, int(num_outputs or 1)))
    ratio = str(aspect_ratio or "").strip() or derive_aspect_ratio(width, height) or None
    refs = [x.strip() for x in (reference_images or []) if isinstance(x, str) and x.strip()]
    primary_reference = refs[0] if refs else None
    primary_edit_image = (
        scene_image.strip()
        if isinstance(scene_image, str) and scene_image.strip()
        else primary_reference
    )

    if style == "p-image":
        request_input = {
            "prompt": prompt_text,
            "aspect_ratio": ratio or "16:9",
            "prompt_upsampling": False if prompt_upsampling is None else bool(prompt_upsampling),
            "disable_safety_checker": False,
        }
    elif style == "p-image-edit":
        request_input = {
            "prompt": prompt_text,
            "images": [primary_edit_image, *[ref for ref in refs if ref != primary_edit_image]][:4],
        }
        request_input["images"] = [image for image in request_input["images"] if image]
        if not request_input["images"]:
            raise RuntimeError("p-image-edit requires at least one edit image")
        request_input["aspect_ratio"] = ratio or "match_input_image"
    elif style == "grok-image":
        request_input: Dict[str, Any] = {"prompt": prompt_text}
        if primary_edit_image:
            request_input["image"] = primary_edit_image
        elif ratio:
            request_input["aspect_ratio"] = ratio
    elif style == "flux-schnell":
        request_input = {
            "prompt": prompt_text,
            "num_outputs": max(1, min(4, n)),
            "aspect_ratio": ratio or "1:1",
            "num_inference_steps": max(1, min(4, int(num_inference_steps or 4))),
            "output_format": str(output_format or "webp").strip() or "webp",
            "disable_safety_checker": False,
            # Match Replicate playground default (fp8); omitting can differ by API version.
            "go_fast": True if go_fast is None else bool(go_fast),
        }
    elif style == "flux-2":
        edit_images: List[str] = []
        for image in [primary_edit_image, *refs]:
            if image and image not in edit_images:
                edit_images.append(image)
        request_input = {
            "prompt": prompt_text,
            "aspect_ratio": ratio or ("match_input_image" if edit_images else "1:1"),
            "resolution": "match_input_image" if edit_images else "2 MP",
            "output_format": str(output_format or "png").strip() or "png",
            "output_quality": 100,
        }
        if edit_images:
            request_input["input_images"] = edit_images[:8]
        if isinstance(safety_tolerance, int) and safety_tolerance > 0:
            request_input["safety_tolerance"] = max(1, min(5, safety_tolerance))
    elif style == "flux-kontext":
        request_input = {"prompt": prompt_text}
        if primary_edit_image:
            request_input["input_image"] = primary_edit_image
        elif ratio:
            request_input["aspect_ratio"] = ratio
        if isinstance(safety_tolerance, int) and safety_tolerance > 0:
            request_input["safety_tolerance"] = safety_tolerance
        if isinstance(prompt_upsampling, bool):
            request_input["prompt_upsampling"] = prompt_upsampling
        fmt = str(output_format or "").strip()
        if fmt:
            request_input["output_format"] = fmt
    elif style == "flux-pro":
        request_input = {"prompt": prompt_text, "num_outputs": max(1, min(4, n))}
        if ratio:
            request_input["aspect_ratio"] = ratio
        if ratio == "custom":
            if isinstance(width, int) and width > 0:
                request_input["width"] = width
            if isinstance(height, int) and height > 0:
                request_input["height"] = height
        if isinstance(safety_tolerance, int) and safety_tolerance > 0:
            request_input["safety_tolerance"] = safety_tolerance
        if isinstance(prompt_upsampling, bool):
            request_input["prompt_upsampling"] = prompt_upsampling
        fmt = str(output_format or "").strip()
        if fmt:
            request_input["output_format"] = fmt
    else:
        request_input = {"prompt": prompt_text, "num_outputs": n}
        if negative_prompt and str(negative_prompt).strip():
            request_input["negative_prompt"] = str(negative_prompt).strip()
        if ratio:
            request_input["aspect_ratio"] = ratio
        if isinstance(width, int) and width > 0:
            request_input["width"] = width
        if isinstance(height, int) and height > 0:
            request_input["height"] = height
        if isinstance(num_inference_steps, int) and num_inference_steps > 0:
            request_input["num_inference_steps"] = num_inference_steps
        if isinstance(guidance_scale, (int, float)) and float(guidance_scale) > 0:
            request_input["guidance_scale"] = float(guidance_scale)
        if isinstance(prompt_strength, (int, float)) and float(prompt_strength) > 0:
            request_input["prompt_strength"] = float(prompt_strength)
        if isinstance(image_prompt_strength, (int, float)) and float(image_prompt_strength) > 0:
            request_input["image_prompt_strength"] = float(image_prompt_strength)
        if isinstance(safety_tolerance, int) and safety_tolerance > 0:
            request_input["safety_tolerance"] = safety_tolerance
        if isinstance(prompt_upsampling, bool):
            request_input["prompt_upsampling"] = prompt_upsampling
        if isinstance(go_fast, bool):
            request_input["go_fast"] = go_fast
        if primary_reference:
            request_input["image"] = primary_reference
            request_input["input_image"] = primary_reference
        if isinstance(scene_image, str) and scene_image.strip():
            scene_url = scene_image.strip()
            request_input.setdefault("image", scene_url)
            request_input.setdefault("input_image", scene_url)
            request_input["scene_image"] = scene_url
            request_input["background_image"] = scene_url
        if isinstance(product_image, str) and product_image.strip():
            product_url = product_image.strip()
            request_input["product_image"] = product_url
            request_input["subject_image"] = product_url
            request_input["overlay_image"] = product_url

    return {"modelId": model, "input": request_input}


__all__ = ["build_replicate_request", "derive_aspect_ratio"]
