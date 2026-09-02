"""Deterministic pricing for validated gallery manifests."""

from __future__ import annotations

from copy import deepcopy
from typing import Any, Dict, List, Mapping, Optional, Tuple

from programs.gallery_enrichment.manifest import validate_manifest
from programs.gallery_enrichment.registry import RateBand, get_family


PACK_VERSION = 1
TIER_MULTIPLIERS = {
    "value": (0.82, 0.88, 0.94),
    "mid": (1.0, 1.0, 1.0),
    "premium": (1.16, 1.28, 1.42),
    "luxury": (1.35, 1.58, 1.9),
}

STATE_MARKET_FACTORS = {
    "AL": .88, "AK": 1.24, "AZ": 1.02, "AR": .86, "CA": 1.30, "CO": 1.13,
    "CT": 1.19, "DE": 1.08, "FL": 1.03, "GA": .94, "HI": 1.38, "ID": 1.01,
    "IL": 1.05, "IN": .92, "IA": .91, "KS": .91, "KY": .89, "LA": .91,
    "ME": 1.04, "MD": 1.16, "MA": 1.26, "MI": .98, "MN": 1.08, "MS": .84,
    "MO": .92, "MT": 1.02, "NE": .93, "NV": 1.08, "NH": 1.12, "NJ": 1.22,
    "NM": .96, "NY": 1.25, "NC": .94, "ND": .98, "OH": .93, "OK": .88,
    "OR": 1.13, "PA": 1.03, "RI": 1.16, "SC": .92, "SD": .91, "TN": .91,
    "TX": .96, "UT": 1.03, "VT": 1.08, "VA": 1.08, "WA": 1.20, "WV": .84,
    "WI": .99, "WY": .98, "DC": 1.30,
}
CITY_MARKET_FACTORS = {
    ("austin", "TX"): 1.08,
    ("boston", "MA"): 1.34,
    ("chicago", "IL"): 1.17,
    ("dallas", "TX"): 1.04,
    ("denver", "CO"): 1.20,
    ("houston", "TX"): 1.01,
    ("los angeles", "CA"): 1.38,
    ("miami", "FL"): 1.18,
    ("new york", "NY"): 1.48,
    ("san francisco", "CA"): 1.52,
    ("seattle", "WA"): 1.30,
}


def _round_price(value: float) -> int:
    if value < 500:
        step = 10
    elif value < 5_000:
        step = 50
    else:
        step = 100
    return max(0, int(round(float(value) / step) * step))


def _range(low: float, likely: float, high: float) -> Dict[str, Any]:
    values = sorted((_round_price(low), _round_price(likely), _round_price(high)))
    return {"low": values[0], "likely": values[1], "high": values[2], "currency": "USD"}


def _scale_rate(rate: RateBand, quantities: Tuple[float, float, float], multipliers: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return (
        rate.low * quantities[0] * multipliers[0],
        rate.likely * quantities[1] * multipliers[1],
        rate.high * quantities[2] * multipliers[2],
    )


def _add(a: Tuple[float, float, float], b: Tuple[float, float, float]) -> Tuple[float, float, float]:
    return a[0] + b[0], a[1] + b[1], a[2] + b[2]


def _breakdown_item(key: str, label: str, category: str, values: Tuple[float, float, float]) -> Optional[Dict[str, Any]]:
    if max(values) <= 0:
        return None
    return {"key": key, "label": label, "category": category, "range": _range(*values)}


def market_factor(city: object = "", state: object = "") -> Tuple[float, str]:
    city_key = str(city or "").strip().lower()
    state_key = str(state or "").strip().upper()
    if city_key and state_key and (city_key, state_key) in CITY_MARKET_FACTORS:
        return CITY_MARKET_FACTORS[(city_key, state_key)], f"{str(city).strip()}, {state_key}"
    if state_key in STATE_MARKET_FACTORS:
        return STATE_MARKET_FACTORS[state_key], state_key
    return 1.0, "National typical range"


def pricing_confidence(manifest: Mapping[str, Any]) -> str:
    assumptions = manifest.get("assumptions") if isinstance(manifest.get("assumptions"), list) else []
    inferred = str(manifest.get("source") or "") == "legacy_inferred"
    widest_ratio = 1.0
    for component in manifest.get("components") or []:
        quantity = component.get("quantity") if isinstance(component, Mapping) else {}
        low = float(quantity.get("low") or 0)
        high = float(quantity.get("high") or 0)
        likely = float(quantity.get("likely") or 0)
        if low > 0:
            widest_ratio = max(widest_ratio, high / low)
        elif likely > 0:
            widest_ratio = max(widest_ratio, 3.0)
    if widest_ratio >= 2.0 or len(assumptions) >= 3:
        return "broad"
    if inferred or widest_ratio > 1.25 or assumptions:
        return "medium"
    return "high"


def _localize_breakdown(items: List[Dict[str, Any]], factor: float) -> List[Dict[str, Any]]:
    localized: List[Dict[str, Any]] = []
    for item in items:
        next_item = deepcopy(item)
        row = item["range"]
        next_item["localizedRange"] = _range(row["low"] * factor, row["likely"] * factor, row["high"] * factor)
        localized.append(next_item)
    return localized


def localize_pricing_result(pricing: Mapping[str, Any], *, city: object = "", state: object = "") -> Dict[str, Any]:
    """Apply the viewer's market factor to canonical national line items."""
    result = deepcopy(dict(pricing))
    factor, location_label = market_factor(city, state)
    breakdown = pricing.get("breakdown") if isinstance(pricing.get("breakdown"), list) else []
    localized_breakdown = _localize_breakdown(breakdown, factor)
    localized_total = {
        key: sum(int(item["localizedRange"][key]) for item in localized_breakdown)
        for key in ("low", "likely", "high")
    }
    result["localizedRange"] = {**localized_total, "currency": "USD"}
    result["locationLabel"] = location_label
    result["marketFactor"] = round(factor, 3)
    result["breakdown"] = localized_breakdown
    return result


def price_manifest(manifest: Any, *, city: object = "", state: object = "") -> Dict[str, Any]:
    validated = validate_manifest(manifest)
    if not validated.valid or not validated.manifest:
        return {
            "status": "failed",
            "confidence": "broad",
            "family": str((manifest or {}).get("pricingFamily") or "") if isinstance(manifest, Mapping) else "",
            "packVersion": PACK_VERSION,
            "baseRange": _range(0, 0, 0),
            "localizedRange": _range(0, 0, 0),
            "locationLabel": "National typical range",
            "marketFactor": 1.0,
            "breakdown": [],
            "assumptions": [],
            "failureReasons": validated.errors,
        }
    normalized = validated.manifest
    family = get_family(normalized["pricingFamily"])
    if not family:
        raise AssertionError("validated manifest must have a registered family")

    subtotal = (0.0, 0.0, 0.0)
    breakdown: List[Dict[str, Any]] = []
    permit_subtotal = (0.0, 0.0, 0.0)
    contingency_subtotal = (0.0, 0.0, 0.0)
    categories = (
        ("materials", "Materials", "material"),
        ("labor", "Labor", "labor"),
        ("preparation", "Preparation", "preparation"),
        ("removal", "Removal", "removal"),
        ("installation", "Installation", "installation"),
    )
    for index, component in enumerate(normalized["components"]):
        definition = family.components[component["componentKey"]]
        quantity = component["quantity"]
        quantities = (float(quantity["low"]), float(quantity["likely"]), float(quantity["high"]))
        multipliers = TIER_MULTIPLIERS[component["tier"]]
        component_base = (0.0, 0.0, 0.0)
        for category, suffix, field in categories:
            values = _scale_rate(getattr(definition.pricing, field), quantities, multipliers)
            component_base = _add(component_base, values)
            item = _breakdown_item(
                f"{component['componentKey']}:{index}:{category}",
                f"{definition.label} — {suffix}",
                category,
                values,
            )
            if item:
                breakdown.append(item)
        permit_subtotal = _add(permit_subtotal, tuple(value * definition.pricing.permit_rate for value in component_base))
        contingency_subtotal = _add(
            contingency_subtotal,
            tuple(value * definition.pricing.contingency_rate for value in component_base),
        )
        subtotal = _add(subtotal, component_base)
    permit_item = _breakdown_item("project:permits", "Permits and compliance", "permits", permit_subtotal)
    contingency_item = _breakdown_item("project:contingency", "Project contingency", "contingency", contingency_subtotal)
    if permit_item:
        breakdown.append(permit_item)
    if contingency_item:
        breakdown.append(contingency_item)
    # Make total exactly equal to displayed, rounded line items.
    displayed_total = {
        key: sum(int(item["range"][key]) for item in breakdown)
        for key in ("low", "likely", "high")
    }
    base = {**displayed_total, "currency": "USD"}
    result = {
        "status": "complete",
        "confidence": pricing_confidence(normalized),
        "family": family.key,
        "packVersion": PACK_VERSION,
        "baseRange": base,
        "localizedRange": base,
        "locationLabel": "National typical range",
        "marketFactor": 1.0,
        "breakdown": breakdown,
        "assumptions": list(normalized.get("assumptions") or []),
        "failureReasons": [],
    }
    return localize_pricing_result(result, city=city, state=state)


def pricing_label(confidence: object) -> str:
    return {
        "high": "Typical estimated range",
        "medium": "Estimated project range",
        "broad": "Broad illustrative estimate",
    }.get(str(confidence or "").strip().lower(), "Broad illustrative estimate")


__all__ = [
    "CITY_MARKET_FACTORS",
    "PACK_VERSION",
    "STATE_MARKET_FACTORS",
    "market_factor",
    "localize_pricing_result",
    "price_manifest",
    "pricing_confidence",
    "pricing_label",
]
