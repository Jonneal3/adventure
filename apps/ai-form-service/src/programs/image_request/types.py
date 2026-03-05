from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any, Dict, Optional


@dataclass(frozen=True)
class ImageSpec:
    user_prompt: str
    style_preset: str
    aspect: str = "1:1"
    constraints: str = ""
    reference_image_url: Optional[str] = None
    mask_image_url: Optional[str] = None
    task: str = "t2i"


@dataclass
class ImageRequest:
    prompt: str
    negative_prompt: str
    params: Dict[str, Any]


def spec_to_promptable_text(spec: ImageSpec, policy: Optional[str] = None) -> str:
    text = (
        f"task: {spec.task}\n"
        f"user_prompt: {spec.user_prompt}\n"
        f"style_preset: {spec.style_preset}\n"
        f"aspect: {spec.aspect}\n"
        f"constraints: {spec.constraints}\n"
        f"reference_image_url: {spec.reference_image_url or ''}\n"
        f"mask_image_url: {spec.mask_image_url or ''}\n"
        "Return fields: prompt, negative_prompt, params_json.\n"
        "Prefer explicit, production-safe generation instructions.\n"
    )
    if policy:
        text += f"POLICY:\n{policy}\n"
    return text


def image_spec_to_dict(spec: ImageSpec) -> Dict[str, Any]:
    return asdict(spec)
