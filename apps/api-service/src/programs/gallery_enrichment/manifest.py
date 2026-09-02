"""Normalization and strict validation for priceable gallery manifests."""

from __future__ import annotations

from copy import deepcopy
from dataclasses import dataclass
from typing import Any, Dict, List, Mapping, Optional, Sequence

from programs.gallery_enrichment.registry import (
    REGISTRY_VERSION,
    component_alias_map,
    get_family,
    resolve_pricing_family,
    slug,
)


_MANIFEST_KEYS = frozenset({
    "version", "source", "serviceId", "service_id", "serviceKey", "service_key",
    "pricingFamily", "pricing_family", "components", "assumptions",
    "normalizationNotes", "normalization_notes",
})
_COMPONENT_KEYS = frozenset({
    "componentKey", "component_key", "key", "subtypeKey", "subtype_key",
    "materialKey", "material_key", "tier", "quantity", "attributes",
})
_QUANTITY_KEYS = frozenset({"low", "likely", "high", "unit"})


@dataclass(frozen=True)
class ManifestValidation:
    valid: bool
    manifest: Optional[Dict[str, Any]]
    errors: List[str]


def _text_list(value: Any, *, cap: int = 30) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        text = str(item or "").strip()[:240]
        if text and text not in out:
            out.append(text)
        if len(out) >= cap:
            break
    return out


def _number(value: Any) -> Optional[float]:
    if isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if number == number and abs(number) != float("inf") else None


def _closed_value(value: Any, allowed: Sequence[str]) -> Optional[str]:
    normalized = slug(value)
    if not normalized:
        return "" if not allowed else None
    aliases = {slug(item): item for item in allowed}
    return aliases.get(normalized)


def _closed_value_from_related(value: Any, allowed: Sequence[str]) -> Optional[str]:
    """Infer a missing enum only when another registered enum identifies it uniquely."""
    normalized = slug(value)
    if not normalized:
        return None
    matches = [
        item
        for item in allowed
        if normalized == slug(item)
        or normalized in slug(item).split("_")
        or slug(item).startswith(f"{normalized}_")
    ]
    return matches[0] if len(matches) == 1 else None


def _normalize_quantity(raw: Any, definition: Any, errors: List[str], path: str) -> Dict[str, Any]:
    source = raw if isinstance(raw, Mapping) else {}
    if raw is not None and not isinstance(raw, Mapping):
        errors.append(f"{path}.quantity must be an object")
    for key in source:
        if key not in _QUANTITY_KEYS:
            errors.append(f"{path}.quantity.{key} is not allowed")
    q = definition.quantity
    unit = slug(source.get("unit") or q.unit)
    if unit != slug(q.unit):
        errors.append(f"{path}.quantity.unit must be {q.unit}")
        unit = q.unit
    values: Dict[str, float] = {}
    defaults = {"low": q.default_low, "likely": q.default_likely, "high": q.default_high}
    for key in ("low", "likely", "high"):
        value = _number(source.get(key))
        if value is None:
            value = defaults[key]
        if value < q.minimum or value > q.maximum:
            errors.append(f"{path}.quantity.{key} must be between {q.minimum:g} and {q.maximum:g}")
        values[key] = value
    if not values["low"] <= values["likely"] <= values["high"]:
        errors.append(f"{path}.quantity must satisfy low <= likely <= high")
    return {**values, "unit": q.unit}


def validate_manifest(
    raw: Any,
    *,
    expected_family: Optional[str] = None,
    expected_service_id: Optional[str] = None,
    source: Optional[str] = None,
) -> ManifestValidation:
    """Normalize aliases, then reject anything outside the closed registry."""
    if not isinstance(raw, Mapping):
        return ManifestValidation(False, None, ["manifest must be an object"])

    errors: List[str] = []
    for key in raw:
        if key not in _MANIFEST_KEYS:
            errors.append(f"manifest.{key} is not allowed")
    if raw.get("version") not in {None, REGISTRY_VERSION}:
        errors.append(f"version must be {REGISTRY_VERSION}")
    family_key = resolve_pricing_family(
        expected_family,
        raw.get("pricingFamily"),
        raw.get("pricing_family"),
        raw.get("serviceKey"),
        raw.get("service_key"),
    )
    if expected_family:
        expected_key = resolve_pricing_family(expected_family)
        if not expected_key:
            return ManifestValidation(False, None, [f"unsupported pricing family: {expected_family}"])
        if family_key and family_key != expected_key:
            errors.append(f"pricingFamily must be {expected_key}")
        family_key = expected_key
    family = get_family(family_key)
    if not family:
        return ManifestValidation(False, None, ["manifest pricingFamily is not launch-supported"])

    raw_source = str(source or raw.get("source") or "").strip()
    if raw_source not in {"planned", "legacy_inferred"}:
        errors.append("source must be planned or legacy_inferred")
        raw_source = "planned"
    service_id = str(expected_service_id or raw.get("serviceId") or raw.get("service_id") or "").strip()
    if not service_id:
        errors.append("serviceId is required")
    raw_service_key = slug(raw.get("serviceKey") or raw.get("service_key") or family.service_key)
    service_key = family.service_key
    if raw_service_key != slug(family.service_key) and resolve_pricing_family(raw_service_key) != family.key:
        errors.append(f"serviceKey does not match {family.key}")

    raw_components = raw.get("components")
    if not isinstance(raw_components, list) or not raw_components:
        errors.append("components must contain at least one component")
        raw_components = []
    aliases = component_alias_map(family)
    components: List[Dict[str, Any]] = []
    seen_components: set[str] = set()
    for index, item in enumerate(raw_components[:30]):
        path = f"components[{index}]"
        if not isinstance(item, Mapping):
            errors.append(f"{path} must be an object")
            continue
        for key in item:
            if key not in _COMPONENT_KEYS:
                errors.append(f"{path}.{key} is not allowed")
        raw_key = slug(item.get("componentKey") or item.get("component_key") or item.get("key"))
        component_key = aliases.get(raw_key)
        if not component_key:
            errors.append(f"{path}.componentKey is not registered for {family.key}")
            continue
        if component_key in seen_components:
            errors.append(f"{path}.componentKey duplicates {component_key}")
        seen_components.add(component_key)
        definition = family.components[component_key]
        if not definition.before_strategy:
            errors.append(f"{path}.componentKey has no registered before strategy")
        if max(
            definition.pricing.material.high,
            definition.pricing.labor.high,
            definition.pricing.preparation.high,
            definition.pricing.removal.high,
            definition.pricing.installation.high,
        ) <= 0:
            errors.append(f"{path}.componentKey has no registered pricing rule")
        raw_subtype = item.get("subtypeKey") or item.get("subtype_key")
        raw_material = item.get("materialKey") or item.get("material_key")
        material = _closed_value(raw_material, definition.materials)
        subtype = _closed_value(raw_subtype, definition.subtypes)
        if definition.subtypes and subtype is None and not slug(raw_subtype):
            subtype = _closed_value_from_related(material or raw_material, definition.subtypes)
        if definition.subtypes and subtype is None:
            errors.append(f"{path}.subtypeKey is not registered for {component_key}")
            subtype = ""
        if definition.materials and material is None:
            errors.append(f"{path}.materialKey is not registered for {component_key}")
            material = ""
        tier = _closed_value(item.get("tier") or "mid", definition.tiers)
        if tier is None:
            errors.append(f"{path}.tier is not registered for {component_key}")
            tier = "mid"
        raw_attributes = item.get("attributes") if isinstance(item.get("attributes"), Mapping) else {}
        attributes: Dict[str, str] = {}
        for attr_key, attr_value in raw_attributes.items():
            normalized_key = slug(attr_key)
            if normalized_key not in definition.attributes:
                errors.append(f"{path}.attributes.{normalized_key or 'unknown'} is not registered")
                continue
            normalized_value = _closed_value(attr_value, definition.attributes[normalized_key])
            if normalized_value is None:
                errors.append(f"{path}.attributes.{normalized_key} has an unsupported value")
                continue
            attributes[normalized_key] = normalized_value
        components.append(
            {
                "componentKey": component_key,
                **({"subtypeKey": subtype} if subtype else {}),
                **({"materialKey": material} if material else {}),
                "tier": tier,
                "quantity": _normalize_quantity(item.get("quantity"), definition, errors, path),
                "attributes": attributes,
            }
        )

    if not components:
        errors.append("manifest contains no registered components")

    manifest = {
        "version": REGISTRY_VERSION,
        "source": raw_source,
        "serviceId": service_id,
        "serviceKey": service_key,
        "pricingFamily": family.key,
        "components": components,
        "assumptions": _text_list(raw.get("assumptions")),
        "normalizationNotes": _text_list(raw.get("normalizationNotes") or raw.get("normalization_notes")),
    }
    return ManifestValidation(not errors, manifest, errors)


def refine_manifest_from_verification(
    manifest: Mapping[str, Any],
    verified_components: Any,
) -> ManifestValidation:
    """Apply quantity/attribute refinements without allowing new components."""
    base = validate_manifest(manifest)
    if not base.valid or not base.manifest:
        return base
    if not isinstance(verified_components, list):
        return ManifestValidation(False, base.manifest, ["verifiedComponents must be an array"])
    original_keys = {str(row.get("componentKey") or "") for row in base.manifest["components"]}
    merged = deepcopy(base.manifest)
    by_key = {str(row.get("componentKey") or ""): row for row in merged["components"]}
    errors: List[str] = []
    for index, item in enumerate(verified_components):
        if not isinstance(item, Mapping):
            errors.append(f"verifiedComponents[{index}] must be an object")
            continue
        key = slug(item.get("componentKey") or item.get("component_key") or item.get("key"))
        if key not in original_keys:
            errors.append(f"verification invented unsupported component: {key or 'unknown'}")
            continue
        target = by_key[key]
        if isinstance(item.get("quantity"), Mapping):
            target["quantity"] = dict(item["quantity"])
        if isinstance(item.get("attributes"), Mapping):
            target["attributes"] = dict(item["attributes"])
        # Refinement may clarify an already-supported enum but never change the component.
        for field in ("subtypeKey", "materialKey", "tier"):
            if item.get(field):
                target[field] = item[field]
    validated = validate_manifest(merged)
    return ManifestValidation(validated.valid and not errors, validated.manifest, [*errors, *validated.errors])


__all__ = ["ManifestValidation", "refine_manifest_from_verification", "validate_manifest"]
