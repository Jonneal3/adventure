"""
Curation helpers — turn generations into reusable library candidates.

api-service does not write to Supabase directly. Instead it returns a
`curation` payload the widget BFF can persist (shown/selected counters +
optional style_seed write-back of winners).
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional

from programs.adventure_pipeline.schemas import DesignState, GenerationSpec, Modification


def budget_tier_label(budget: float) -> str:
    b = float(budget or 0)
    if b <= 0:
        return ""
    if b < 15_000:
        return "$"
    if b < 40_000:
        return "$$"
    if b < 90_000:
        return "$$$"
    return "$$$$"


def build_curation_record(
    *,
    design: DesignState,
    image: Dict[str, Any],
    mode: str,
    spec: Optional[GenerationSpec] = None,
    modification: Optional[Modification] = None,
    model_id: str = "",
) -> Dict[str, Any]:
    """Metadata to attach when writing a successful generation into the library."""
    confirmed = set(design.taste.confirmed_ids or [])
    taste = [t.label for t in design.taste.tags if (not confirmed) or t.id in confirmed]
    url = str(image.get("url") or "").strip()
    label = str(image.get("label") or (taste[0] if taste else (design.scope or "Design"))).strip()
    return {
        "url": url,
        "label": label,
        "serviceId": design.service_id,
        "serviceLabel": design.service_label,
        "industry": design.industry,
        "scope": design.scope,
        "scopes": list(design.scopes or []),
        "scopeKeys": list(design.scope_keys or design.scopes or []),
        "budget": design.budget,
        "priceTier": budget_tier_label(design.budget),
        "taste": taste,
        "mode": mode,
        "modelId": model_id,
        "mustInclude": list((spec.must_include if spec else []) or (modification.must_include if modification else [])),
        "avoid": list((spec.avoid if spec else []) or (modification.avoid if modification else [])),
        "promptContext": (spec.project_context if spec else "") or "",
        "source": image.get("source") or "generated",
        "writeBack": {
            "generated_for": "adventure_v8",
            "catalog_scope": "adventure",
            "option_label": label,
            "option_value": label.lower().replace(" ", "_")[:48] or "design",
            "category_name": design.industry or "",
            "subcategory_name": design.service_label or "",
            "subcategory_id": design.service_id or "",
            "starter_scope": (design.scopes[0] if design.scopes else design.scope) or "",
            "scope_keys": list(design.scope_keys or design.scopes or []),
            "price_tier": budget_tier_label(design.budget),
            "budget": design.budget,
            "adventure_mode": mode,
            "model_id": model_id,
            "visual_prompt": str(image.get("prompt") or image.get("visualPrompt") or ""),
            "visual_direction": str((image.get("direction") or {}).get("prompt") if isinstance(image.get("direction"), dict) else image.get("visual_direction") or ""),
            "palette": str((image.get("direction") or {}).get("palette") if isinstance(image.get("direction"), dict) else image.get("palette") or ""),
            "surfaces": str((image.get("direction") or {}).get("surfaces") if isinstance(image.get("direction"), dict) else image.get("surfaces") or ""),
            "fixtures": str((image.get("direction") or {}).get("fixtures") if isinstance(image.get("direction"), dict) else image.get("fixtures") or ""),
            "style": str((image.get("direction") or {}).get("style") if isinstance(image.get("direction"), dict) else image.get("style") or ""),
            "palette_family": str((image.get("direction") or {}).get("family") if isinstance(image.get("direction"), dict) else image.get("paletteFamily") or ""),
        },
    }


def curation_bundle(
    *,
    design: DesignState,
    images: List[Dict[str, Any]],
    mode: str,
    spec: Optional[GenerationSpec] = None,
    modification: Optional[Modification] = None,
    model_id: str = "",
) -> Dict[str, Any]:
    """
    Bundle for the client:
    - candidates: generated images eligible for write-back
    - events: counters the client should fire (shown) immediately
    """
    generated = [img for img in images if str(img.get("source") or "") == "generated" and img.get("url")]
    library = [img for img in images if str(img.get("source") or "") == "library" and img.get("url")]
    candidates = [
        build_curation_record(
            design=design,
            image=img,
            mode=mode,
            spec=spec,
            modification=modification,
            model_id=model_id,
        )
        for img in generated
    ]
    return {
        "candidates": candidates,
        "events": [
            {"type": "shown", "url": img["url"], "source": img.get("source"), "mode": mode}
            for img in [*library, *generated]
        ],
        "policy": {
            "writeBackOnSelect": True,
            "writeBackGeneratedFor": "adventure_v8",
            "note": "Widget persists winners via /api/adventure/v8/:id/curate",
        },
    }


__all__ = ["budget_tier_label", "build_curation_record", "curation_bundle"]
