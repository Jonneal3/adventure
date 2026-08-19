"""
Vision taste inference for Adventure V7.

The customer picks 2-3 images; a vision model reads them and reports which
ontology attributes are actually visible. The vocabulary is closed on purpose:
the model classifies inside our design universe instead of inventing labels.
"""

from __future__ import annotations

import json
import os
from typing import Any, Dict, List, Optional, Tuple

from programs.adventure_pipeline.catalog_tag import catalog_vision_enabled, tag_catalog_photo
from programs.pricing.replicate_vlm import (
    _extract_json_from_text,
    _replicate_create_prediction,
    _replicate_wait_for_completion,
)


ADVENTURE_VISION_MODEL = os.getenv("ADVENTURE_VISION_MODEL", "openai/gpt-4.1-nano").strip()
ADVENTURE_VISION_TIMEOUT_SEC = float(os.getenv("ADVENTURE_VISION_TIMEOUT_SEC", "45"))
ADVENTURE_VISION_MAX_IMAGES = int(os.getenv("ADVENTURE_VISION_MAX_IMAGES", "3"))


def vision_enabled() -> bool:
    raw = str(os.getenv("ADVENTURE_TASTE_USE_VISION", "") or "").strip().lower()
    if raw in ("false", "0", "off", "no"):
        return False
    return bool(str(os.getenv("REPLICATE_API_TOKEN") or "").strip())


def usable_image_urls(urls: List[str]) -> List[str]:
    """Replicate needs fetchable http(s) URLs — data: URLs and blobs are dropped."""
    out: List[str] = []
    for u in urls:
        s = str(u or "").strip()
        if s.startswith("http://") or s.startswith("https://"):
            out.append(s)
        if len(out) >= max(1, ADVENTURE_VISION_MAX_IMAGES):
            break
    return out


def _system_prompt() -> str:
    return (
        "You are a design taste analyst. You look at images a customer chose and report which "
        "attributes from a fixed vocabulary are clearly visible across them.\n"
        "Rules:\n"
        "- Only use attribute paths from the provided vocabulary. Never invent new ones.\n"
        "- Pick 6-8 attributes, ordered by how strongly they define the customer's taste.\n"
        "- For each attribute, name the image index (0-based) where it is most visible and give "
        "a focal point (percent of width/height) on that image where the evidence sits.\n"
        "- confidence is 0-1. Mark confidence >= 0.6 only when the attribute is unmistakable.\n"
        "- Output ONLY valid JSON, no markdown."
    )


def _user_prompt(*, service_label: str, scope: str, vocabulary: List[Tuple[str, str]], image_count: int) -> str:
    vocab = [{"attributePath": path, "label": label} for path, label in vocabulary]
    context = {
        "service": service_label or "project",
        "scope": scope or "",
        "image_count": image_count,
        "vocabulary": vocab,
    }
    return (
        f"Context:\n{json.dumps(context, ensure_ascii=True, separators=(',', ':'))}\n\n"
        "The images are the ones the customer chose as favorites. Report the shared visual taste.\n"
        'Return JSON: {"attributes":[{"attributePath":"style.modern","imageIndex":0,'
        '"focalX":48,"focalY":40,"confidence":0.82}]}'
    )


def _parse_attributes(output: Any, *, vocabulary: List[Tuple[str, str]], image_count: int) -> List[Dict[str, Any]]:
    text = ""
    if isinstance(output, list):
        text = "".join(str(x) for x in output)
    elif isinstance(output, str):
        text = output
    obj = _extract_json_from_text(text)
    if not isinstance(obj, dict):
        return []

    raw = obj.get("attributes")
    if not isinstance(raw, list):
        return []

    labels = {path: label for path, label in vocabulary}
    seen: set[str] = set()
    parsed: List[Dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict):
            continue
        path = str(item.get("attributePath") or item.get("attribute_path") or "").strip()
        if path not in labels or path in seen:
            continue
        seen.add(path)

        def _num(value: Any, default: float, lo: float, hi: float) -> float:
            try:
                return max(lo, min(hi, float(value)))
            except (TypeError, ValueError):
                return default

        index = int(_num(item.get("imageIndex", item.get("image_index", 0)), 0, 0, max(0, image_count - 1)))
        parsed.append(
            {
                "attributePath": path,
                "label": labels[path],
                "imageIndex": index,
                "focalX": _num(item.get("focalX", item.get("focal_x")), 50.0, 5.0, 95.0),
                "focalY": _num(item.get("focalY", item.get("focal_y")), 50.0, 5.0, 95.0),
                "confidence": _num(item.get("confidence"), 0.5, 0.0, 1.0),
            }
        )
    return parsed


def analyze_taste(
    *,
    image_urls: List[str],
    service_label: str,
    scope: str,
    vocabulary: List[Tuple[str, str]],
) -> Optional[List[Dict[str, Any]]]:
    """
    Returns ranked attribute observations, or None when vision is unavailable/failed
    so the caller can fall back to ontology ranking.
    """
    if not vision_enabled() or not vocabulary:
        return None
    images = usable_image_urls(image_urls)
    if not images:
        return None

    try:
        created = _replicate_create_prediction(
            model_id=ADVENTURE_VISION_MODEL,
            input={
                "prompt": _user_prompt(
                    service_label=service_label,
                    scope=scope,
                    vocabulary=vocabulary,
                    image_count=len(images),
                ),
                "system_prompt": _system_prompt(),
                "image_input": images,
                "temperature": 0.2,
                "max_completion_tokens": 700,
            },
        )
        pred_id = created.get("id")
        if not pred_id:
            return None
        final = _replicate_wait_for_completion(str(pred_id), timeout_sec=ADVENTURE_VISION_TIMEOUT_SEC)
        if str(final.get("status") or "").lower() != "succeeded":
            return None
        attributes = _parse_attributes(final.get("output"), vocabulary=vocabulary, image_count=len(images))
    except Exception:
        return None

    if len(attributes) < 4:
        return None
    attributes.sort(key=lambda a: float(a.get("confidence") or 0), reverse=True)
    for attr in attributes:
        idx = int(attr.get("imageIndex") or 0)
        attr["imageUrl"] = images[idx] if 0 <= idx < len(images) else images[0]
    return attributes[:8]


def analyze_photo(
    *,
    image_url: str,
    service_label: str = "",
    scope: str = "",
) -> Optional[Dict[str, Any]]:
    """
    Structured read of a customer space photo → materials / condition / constraints.
    Stored on ProjectState.start.photo.analysis — not a fake UX step.
    """
    if not vision_enabled():
        return None
    images = usable_image_urls([image_url])
    if not images:
        return None
    system = (
        "You analyze a customer's existing space photo for a remodeling/design project. "
        "Return JSON only with keys: materials (string[]), condition (short string), "
        "constraints (string[]), notes (short string). Be concrete and visual. "
        "Do not invent square footage or prices."
    )
    user = (
        f"Service: {service_label or 'home project'}\n"
        f"Scope: {scope or 'general'}\n"
        "Describe what is visibly present and what a designer should preserve or work around."
    )
    try:
        created = _replicate_create_prediction(
            model=ADVENTURE_VISION_MODEL,
            input={
                "system_prompt": system,
                "prompt": user,
                "image_input": images[:1],
                "temperature": 0.2,
                "max_completion_tokens": 500,
            },
        )
        pred_id = created.get("id")
        if not pred_id:
            return None
        final = _replicate_wait_for_completion(str(pred_id), timeout_sec=ADVENTURE_VISION_TIMEOUT_SEC)
        if str(final.get("status") or "").lower() != "succeeded":
            return None
        parsed = _extract_json_from_text(final.get("output"))
        if not isinstance(parsed, dict):
            return None
        materials = parsed.get("materials") if isinstance(parsed.get("materials"), list) else []
        constraints = parsed.get("constraints") if isinstance(parsed.get("constraints"), list) else []
        return {
            "materials": [str(m).strip() for m in materials if str(m).strip()][:12],
            "condition": str(parsed.get("condition") or "").strip()[:240],
            "constraints": [str(c).strip() for c in constraints if str(c).strip()][:12],
            "notes": str(parsed.get("notes") or "").strip()[:500],
            "raw": parsed,
        }
    except Exception:
        return None


__all__ = [
    "analyze_taste",
    "analyze_photo",
    "catalog_vision_enabled",
    "tag_catalog_photo",
    "vision_enabled",
    "usable_image_urls",
]
