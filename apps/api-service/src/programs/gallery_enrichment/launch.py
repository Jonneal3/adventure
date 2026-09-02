"""Deterministic planning and lifecycle policy for gallery vertical launches."""

from __future__ import annotations

import hashlib
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, Mapping

from programs.gallery_enrichment.manifest import validate_manifest
from programs.gallery_enrichment.pricing import price_manifest
from programs.gallery_enrichment.registry import get_family


LAUNCH_VERSION = 1
DEFAULT_TARGET_PROJECTS = 100
MIN_ACTIVE_PROJECTS = 50
MAX_ACTIVE_PROJECTS = 100
MAX_CONCEPT_POOL = 200
DEFAULT_LOW_PERFORMER_IMPRESSIONS = 100
DEFAULT_LOW_PERFORMER_CLICK_RATE = 0.02


def _now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _quantity(definition: Any, size_index: int) -> Dict[str, Any]:
    rule = definition.quantity
    factor = (0.8, 1.0, 1.25)[size_index % 3]
    values = [
        max(rule.minimum, min(rule.maximum, rule.default_low * factor)),
        max(rule.minimum, min(rule.maximum, rule.default_likely * factor)),
        max(rule.minimum, min(rule.maximum, rule.default_high * factor)),
    ]
    values.sort()
    return {"low": values[0], "likely": values[1], "high": values[2], "unit": rule.unit}


def _component_manifest(definition: Any, variant: int, size_index: int) -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "componentKey": definition.key,
        "tier": definition.tiers[variant % len(definition.tiers)],
        "quantity": _quantity(definition, size_index),
        "attributes": {},
    }
    if definition.subtypes:
        row["subtypeKey"] = definition.subtypes[(variant // 2) % len(definition.subtypes)]
    if definition.materials:
        row["materialKey"] = definition.materials[(variant // 3) % len(definition.materials)]
    for offset, (key, values) in enumerate(sorted(definition.attributes.items())):
        if values:
            row["attributes"][key] = values[(variant + offset) % len(values)]
    return row


def _concept_label(family: Any, components: Iterable[Mapping[str, Any]], serial: int) -> str:
    rows = list(components)
    primary = family.components[rows[0]["componentKey"]]
    tier = str(rows[0].get("tier") or "mid").replace("_", " ").title()
    material = str(rows[0].get("materialKey") or rows[0].get("subtypeKey") or "").replace("_", " ").title()
    suffix = f" + {family.components[rows[1]['componentKey']].label}" if len(rows) > 1 else ""
    descriptor = f" {material}" if material else ""
    return f"{tier}{descriptor} {primary.label}{suffix} {serial + 1}".strip()


def build_project_concepts(
    *,
    service_id: str,
    pricing_family: str,
    target_count: int = DEFAULT_TARGET_PROJECTS,
) -> list[Dict[str, Any]]:
    """Build a stable, closed-registry concept catalog without model-defined scope.

    The image model receives only manifests that already passed deterministic
    validation and price preflight. This makes the planner safe to resume and
    keeps a 100-project launch independent from one oversized LLM response.
    """
    family = get_family(pricing_family)
    if not family:
        raise ValueError(f"unsupported pricing family: {pricing_family}")
    service_id = str(service_id or "").strip()
    if not service_id:
        raise ValueError("service_id is required")
    target = max(1, min(int(target_count or DEFAULT_TARGET_PROJECTS), MAX_CONCEPT_POOL))
    definitions = list(family.components.values())
    concepts: list[Dict[str, Any]] = []
    seen: set[str] = set()
    serial = 0
    while len(concepts) < target and serial < target * 80:
        primary_index = serial % len(definitions)
        component_count = 1 + (1 if serial % 3 else 0) + (1 if len(definitions) >= 3 and serial % 11 == 0 else 0)
        component_count = min(component_count, len(definitions), 3)
        components = [
            _component_manifest(
                definitions[(primary_index + offset) % len(definitions)],
                variant=serial + offset * 7,
                size_index=(serial // max(1, len(definitions)) + offset) % 3,
            )
            for offset in range(component_count)
        ]
        manifest = {
            "version": 1,
            "source": "planned",
            "serviceId": service_id,
            "serviceKey": family.service_key,
            "pricingFamily": family.key,
            "components": components,
            "assumptions": [],
            "normalizationNotes": ["Deterministically planned from the versioned component registry."],
        }
        validated = validate_manifest(
            manifest,
            expected_family=family.key,
            expected_service_id=service_id,
            source="planned",
        )
        pricing = price_manifest(validated.manifest) if validated.valid and validated.manifest else None
        if validated.valid and validated.manifest and pricing and pricing.get("status") == "complete":
            fingerprint = hashlib.sha256(
                repr(sorted((row["componentKey"], row.get("subtypeKey"), row.get("materialKey"), row["tier"], tuple((row.get("quantity") or {}).values())) for row in validated.manifest["components"])).encode("utf-8")
            ).hexdigest()[:16]
            if fingerprint not in seen:
                seen.add(fingerprint)
                label = _concept_label(family, validated.manifest["components"], len(concepts))
                concepts.append({
                    "key": fingerprint,
                    "label": label,
                    "value": f"{family.key}_{fingerprint}",
                    "description": " · ".join(family.components[row["componentKey"]].label for row in validated.manifest["components"]),
                    "manifest": deepcopy(validated.manifest),
                    "pricingPreflight": pricing,
                })
        serial += 1
    if len(concepts) < target:
        raise RuntimeError(f"registry produced only {len(concepts)} unique concepts for {family.key}; requested {target}")
    return concepts


def launch_catalog_key(vertical_key: str, service_id: str, concept_key: str) -> str:
    return f"gallery_launch:v{LAUNCH_VERSION}:{vertical_key}:{service_id}:{concept_key}"


def initial_project_metadata(
    *,
    vertical_key: str,
    industry: str,
    service_id: str,
    service_name: str,
    concept: Mapping[str, Any],
    model_id: str,
) -> Dict[str, Any]:
    manifest = concept.get("manifest") if isinstance(concept.get("manifest"), Mapping) else {}
    components = manifest.get("components") if isinstance(manifest.get("components"), list) else []
    tags = [vertical_key, manifest.get("serviceKey"), manifest.get("pricingFamily")]
    for component in components:
        if not isinstance(component, Mapping):
            continue
        tags.extend(component.get(key) for key in ("componentKey", "subtypeKey", "materialKey", "tier"))
    return {
        "generated_for": "subcategory_catalog",
        "source": "gallery_vertical_launch",
        "catalog_key": launch_catalog_key(vertical_key, service_id, str(concept.get("key") or "")),
        "option_label": str(concept.get("label") or "Project concept"),
        "option_value": str(concept.get("value") or concept.get("key") or "project"),
        "option_description": str(concept.get("description") or ""),
        "category_name": industry,
        "subcategory_name": service_name,
        "subcategory_id": service_id,
        "priceable_manifest": deepcopy(dict(manifest)),
        "pricing_preflight": deepcopy(dict(concept.get("pricingPreflight") or {})),
        "tags": list(dict.fromkeys(str(value).strip() for value in tags if str(value or "").strip())),
        "ai_model": model_id,
        "gallery_launch": {
            "version": LAUNCH_VERSION,
            "verticalKey": vertical_key,
            "serviceId": service_id,
            "conceptKey": str(concept.get("key") or ""),
            "status": "processing",
            "createdAt": _now_iso(),
        },
        "gallery_status": "hidden",
        "gallery_badge": "Project example",
        "adventure_stats": {
            "shown": 0,
            "selected": 0,
            "saved": 0,
            "shared": 0,
            "conversions": 0,
            "impressions": 0,
            "clicks": 0,
        },
    }


def is_low_performer(
    metadata: Mapping[str, Any],
    *,
    min_impressions: int = DEFAULT_LOW_PERFORMER_IMPRESSIONS,
    max_click_rate: float = DEFAULT_LOW_PERFORMER_CLICK_RATE,
) -> bool:
    stats = metadata.get("adventure_stats") if isinstance(metadata.get("adventure_stats"), Mapping) else {}
    impressions = int(stats.get("shown") or stats.get("impressions") or 0)
    clicks = int(stats.get("selected") or stats.get("clicks") or 0)
    return impressions >= min_impressions and clicks / max(1, impressions) < max_click_rate


__all__ = [
    "DEFAULT_LOW_PERFORMER_CLICK_RATE",
    "DEFAULT_LOW_PERFORMER_IMPRESSIONS",
    "DEFAULT_TARGET_PROJECTS",
    "LAUNCH_VERSION",
    "MAX_ACTIVE_PROJECTS",
    "MAX_CONCEPT_POOL",
    "MIN_ACTIVE_PROJECTS",
    "build_project_concepts",
    "initial_project_metadata",
    "is_low_performer",
    "launch_catalog_key",
]
