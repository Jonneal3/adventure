"""Minimal design ontology — curated attribute vocabulary, not a theme pack."""

from __future__ import annotations

from typing import Dict, List, Tuple


# service_key → list of (attribute_path, label)
_ONTOLOGY: Dict[str, List[Tuple[str, str]]] = {
    "bathroom": [
        ("style.modern", "Modern look"),
        ("style.clean_lines", "Clean lines"),
        ("materials.warm_wood", "Warm wood"),
        ("materials.large_format_tile", "Large-format tile"),
        ("materials.stone_look", "Stone-look surfaces"),
        ("fixtures.matte_black", "Matte black fixtures"),
        ("lighting.soft_ambient", "Soft ambient light"),
        ("palette.neutral", "Neutral colors"),
        ("features.glass_shower", "Glass shower"),
        ("features.floating_vanity", "Floating vanity"),
    ],
    "kitchen": [
        ("style.modern", "Modern look"),
        ("style.clean_lines", "Clean lines"),
        ("style.open_layout", "Open layout"),
        ("materials.warm_wood", "Warm wood"),
        ("materials.stone_countertops", "Stone countertops"),
        ("palette.neutral", "Neutral colors"),
        ("lighting.soft_natural", "Soft natural light"),
        ("features.large_island", "Large island"),
        ("features.mixed_metals", "Mixed metals"),
        ("features.subtle_backsplash", "Subtle backsplash"),
    ],
    "landscaping": [
        ("style.modern", "Modern look"),
        ("style.clean_lines", "Clean lines"),
        ("style.open_layout", "Open layout"),
        ("materials.warm_wood", "Warm wood"),
        ("materials.large_format_pavers", "Large-format pavers"),
        ("materials.natural_stone", "Natural stone"),
        ("planting.natural", "Natural planting"),
        ("palette.neutral", "Neutral colors"),
        ("features.built_in_seating", "Built-in seating"),
        ("features.layered_lighting", "Layered lighting"),
    ],
    "flooring": [
        ("style.modern", "Modern look"),
        ("style.clean_lines", "Clean lines"),
        ("materials.wide_plank", "Wide-plank look"),
        ("materials.warm_tone", "Warm tone"),
        ("materials.matte_finish", "Matte finish"),
        ("materials.subtle_grain", "Subtle grain"),
        ("palette.neutral", "Neutral colors"),
        ("layout.continuous_flow", "Continuous flow"),
    ],
    "default": [
        ("style.modern", "Modern look"),
        ("style.clean_lines", "Clean lines"),
        ("palette.neutral", "Neutral colors"),
        ("materials.warm_wood", "Warm wood"),
        ("lighting.soft_natural", "Soft natural light"),
        ("style.open_layout", "Open layout"),
        ("materials.mixed_textures", "Mixed textures"),
        ("style.simple_geometry", "Simple geometry"),
    ],
}


def resolve_ontology_key(service_label: str, scope: str = "") -> str:
    text = f"{service_label} {scope}".lower()
    if any(t in text for t in ("bath", "shower", "vanity", "tub")):
        return "bathroom"
    if "kitchen" in text:
        return "kitchen"
    if any(t in text for t in ("landscap", "yard", "patio", "pergola", "outdoor")):
        return "landscaping"
    if "floor" in text:
        return "flooring"
    return "default"


def attribute_pool(service_label: str, scope: str = "") -> List[Tuple[str, str]]:
    key = resolve_ontology_key(service_label, scope)
    return list(_ONTOLOGY.get(key) or _ONTOLOGY["default"])


def spend_less_deltas(service_label: str, scope: str = "") -> List[str]:
    """Deterministic translation hints for 'spend less' — pricing/design engines consume these."""
    key = resolve_ontology_key(service_label, scope)
    if key == "bathroom":
        return ["simpler tile layout", "standard vanity", "fewer niche features"]
    if key == "kitchen":
        return ["simpler backsplash", "fewer custom millwork details", "standard hardware"]
    if key == "landscaping":
        return ["simpler hardscape", "reduce structural complexity", "lower planting density"]
    return ["simpler materials", "reduce structural complexity", "retain overall aesthetic"]


def spend_more_deltas(service_label: str, scope: str = "") -> List[str]:
    key = resolve_ontology_key(service_label, scope)
    if key == "bathroom":
        return ["premium fixtures", "larger-format tile", "richer lighting"]
    if key == "kitchen":
        return ["upgraded stone", "custom millwork cues", "richer lighting"]
    if key == "landscaping":
        return ["premium hardscape", "richer planting", "feature lighting"]
    return ["premium materials", "richer detailing", "retain overall aesthetic"]


# service_key → list of (customer-facing lever, design delta, share of project cost)
_SAVINGS_LEVERS: Dict[str, List[Tuple[str, str, float]]] = {
    "bathroom": [
        ("Simpler tile layout", "simpler tile layout", 0.07),
        ("Standard vanity instead of custom", "standard vanity", 0.06),
        ("Fewer niche and bench details", "fewer niche features", 0.035),
    ],
    "kitchen": [
        ("Simpler backsplash", "simpler backsplash", 0.05),
        ("Fewer custom millwork details", "fewer custom millwork details", 0.08),
        ("Standard hardware and fixtures", "standard hardware", 0.03),
    ],
    "landscaping": [
        ("Simpler hardscape pattern", "simpler hardscape", 0.08),
        ("Lower planting density", "lower planting density", 0.045),
        ("Fewer built structures", "reduce structural complexity", 0.09),
    ],
    "flooring": [
        ("Value-tier plank in the same tone", "value-tier plank", 0.09),
        ("Keep existing transitions", "keep existing transitions", 0.03),
    ],
    "default": [
        ("Simpler materials in the same look", "simpler materials", 0.07),
        ("Reduce structural complexity", "reduce structural complexity", 0.06),
        ("Fewer decorative details", "fewer decorative details", 0.035),
    ],
}


_UPGRADE_LEVERS: Dict[str, List[Tuple[str, str, float]]] = {
    "bathroom": [
        ("Premium fixtures", "premium fixtures", 0.06),
        ("Larger-format tile", "larger-format tile", 0.05),
        ("Layered lighting", "richer lighting", 0.03),
    ],
    "kitchen": [
        ("Upgraded stone surfaces", "upgraded stone", 0.08),
        ("Custom millwork details", "custom millwork cues", 0.09),
        ("Layered lighting", "richer lighting", 0.03),
    ],
    "landscaping": [
        ("Premium hardscape material", "premium hardscape", 0.09),
        ("Richer planting plan", "richer planting", 0.05),
        ("Feature lighting", "feature lighting", 0.035),
    ],
    "flooring": [
        ("Wider premium plank", "premium wide plank", 0.08),
        ("Upgraded underlayment and trim", "upgraded trim detail", 0.03),
    ],
    "default": [
        ("Premium materials", "premium materials", 0.08),
        ("Richer detailing", "richer detailing", 0.05),
    ],
}


def _levers(table: Dict[str, List[Tuple[str, str, float]]], service_label: str, scope: str, budget: float) -> List[Dict[str, object]]:
    key = resolve_ontology_key(service_label, scope)
    rows = table.get(key) or table["default"]
    base = max(2500.0, float(budget or 0))
    out: List[Dict[str, object]] = []
    for label, delta, share in rows:
        amount = base * share
        rounded = int(round(amount / 100.0) * 100)
        out.append({"label": label, "delta": delta, "amount": rounded, "sharePct": round(share * 100, 1)})
    return out


def savings_levers(service_label: str, scope: str = "", budget: float = 0) -> List[Dict[str, object]]:
    """Deterministic 'what would save money' options — the pricing engine owns the numbers."""
    return _levers(_SAVINGS_LEVERS, service_label, scope, budget)


def upgrade_levers(service_label: str, scope: str = "", budget: float = 0) -> List[Dict[str, object]]:
    return _levers(_UPGRADE_LEVERS, service_label, scope, budget)
