"""
Vertical scope configuration for Adventure intake.

Scope is always for the selected catalog service:
1. stored subcategory_scope / components on that service
2. otherwise a vertical recipe matched from the service name

Groq is not used at runtime for these options.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional


SCOPE_QUESTION = "What would you like to include?"
SCOPE_SUBTITLE = "Pick everything that applies."
OTHER_LABEL = "Other"

_OVERALL = re.compile(r"^(full|whole|complete|entire|everything)\b", re.I)
_OTHER = re.compile(r"^other$", re.I)

# key → question, full-scope label, and the parts a customer can include.
_VERTICALS: Dict[str, Dict[str, Any]] = {
    "bathroom": {
        "key": "bathroom",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Bathroom Remodel",
        "parts": ["Vanity", "Shower / Tub", "Tile", "Flooring", "Paint", "Lighting"],
    },
    "kitchen": {
        "key": "kitchen",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Kitchen Remodel",
        "parts": ["Cabinets", "Countertops", "Island", "Backsplash", "Flooring", "Lighting"],
    },
    "landscaping": {
        "key": "landscaping",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Landscape Project",
        "parts": ["Pavers", "Rock Walls", "Planting", "Irrigation", "Outdoor Lighting", "Fire Pit"],
    },
    "painting": {
        "key": "painting",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Whole House",
        "parts": ["Specific Rooms", "Walls", "Ceilings", "Trim & Doors", "Cabinets", "Exterior"],
    },
    "pool": {
        "key": "pool",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Complete Pool Remodel",
        "parts": ["Shell", "Deck", "Waterline Tile", "Equipment", "Lighting", "Water Features"],
    },
    "flooring": {
        "key": "flooring",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Whole Home",
        "parts": ["Living Areas", "Kitchen", "Bedrooms", "Stairs"],
    },
    "pergola": {
        "key": "pergola",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Pergola Project",
        "parts": ["Structure", "Fan", "Lighting", "Shade"],
    },
    "windows": {
        "key": "windows",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Windows and Doors",
        "parts": ["Windows", "Entry Doors", "Sliding Doors", "Trim"],
    },
    "roofing": {
        "key": "roofing",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Roof Replacement",
        "parts": ["Shingles", "Flashing", "Gutters", "Ventilation"],
    },
    "siding": {
        "key": "siding",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Siding Project",
        "parts": ["Siding", "Trim", "Fascia", "Soffit"],
    },
    "fencing": {
        "key": "fencing",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Fence Project",
        "parts": ["Fence Line", "Gates", "Posts", "Privacy Screening"],
    },
    "default": {
        "key": "default",
        "question": SCOPE_QUESTION,
        "subtitle": SCOPE_SUBTITLE,
        "fullScope": "Full Project",
        "parts": ["Main Area", "Finishes", "Fixtures"],
    },
}


def _match_text(industry: str = "", service_label: str = "", summary: str = "") -> str:
    primary = (service_label or "").strip().lower()
    if primary:
        return primary
    return f"{industry or ''} {summary or ''}".strip().lower()


def _classify(text: str) -> str:
    if not text:
        return "default"
    if re.search(r"\b(paint|painter|painting)\b", text):
        return "painting"
    if re.search(
        r"\bwindows?\b|\b(entry|exterior|sliding|patio|french|garage)\s+doors?\b|\bdoor\s+(replacement|install)",
        text,
    ):
        return "windows"
    if re.search(r"\broof|\bshingle", text):
        return "roofing"
    if re.search(r"\bsiding\b", text):
        return "siding"
    if re.search(r"\bfenc(e|ing)\b", text):
        return "fencing"
    if re.search(r"\bbath|\bshower\b|\bvanity\b", text):
        return "bathroom"
    if re.search(r"\bkitchen\b", text):
        return "kitchen"
    if re.search(r"\bpergola\b|patio cover", text):
        return "pergola"
    if re.search(r"\b(floor|flooring)\b", text):
        return "flooring"
    if re.search(
        r"\b(landscape|landscaping|yard|patio|outdoor|garden|hardscape|hardscaping)\b",
        text,
    ):
        return "landscaping"
    if re.search(r"\b(pool|pools)\b|\bhot[\s-]?tub\b|\bswim[\s-]?spa\b", text):
        return "pool"
    if re.search(r"\bspa\b", text):
        return "pool"
    return "default"


_COMPATIBLE_VERTICALS = {
    "bathroom": ["flooring", "painting"],
    "kitchen": ["flooring", "painting"],
    "flooring": ["bathroom", "kitchen"],
    "landscaping": ["pergola"],
    "pergola": ["landscaping"],
}


_DETAIL_SHOT = re.compile(
    r"\b(swatch|sample|palette|color chip|paint chip|hex code|\bral\b|material board|mood board|"
    r"close[- ]?up|macro(?:scopic)?|texture (?:shot|detail|close)|detail (?:shot|view|of)|"
    r"product (?:shot|photo)|flatlay|flat lay)\b",
    re.I,
)
_TILE_MACRO = re.compile(
    r"\b(patterned tile|encaustic|mosaic pattern|grout (?:line|color|joint)|"
    r"tile (?:color|sample|swatch|pattern)|4\s*[x×]\s*4|6\s*[x×]\s*6|hex tile)\b",
    re.I,
)
_MATERIAL_SUBJECT = re.compile(
    r"\b(tiles?|grout|paint|porcelain|ceramic|mosaic|stone|quartz|granite)\b",
    re.I,
)
_ROOM_SCENE = re.compile(
    r"\b(bathroom|kitchen|shower|bathtub|tub|bath|room|remodel|interior|"
    r"walk-?in|soaking|faucet|fixture|rain ?head)\b",
    re.I,
)
_OTHER_PART = re.compile(
    r"\b(vanity|toilet|flooring|tiles?|paint|lighting|cabinets?|countertops?|island|backsplash)\b",
    re.I,
)
_CATALOG_DETAIL_FOR = frozenset({"subcategory_catalog", "refinement_option"})
_SCOPE_ALIASES = {
    "tub": ["tub", "bathtub", "soaking"],
    "shower": ["shower", "walk-in", "walkin"],
    "tile": ["tile", "tiles", "tiling"],
    "vanity": ["vanity", "vanities", "sink"],
}


def looks_like_finished_room(text: str) -> bool:
    return bool(_ROOM_SCENE.search(str(text or "")))


def looks_like_material_swatch(text: str) -> bool:
    blob = str(text or "")
    if _DETAIL_SHOT.search(blob):
        return True
    if looks_like_finished_room(blob):
        return False
    return bool(_TILE_MACRO.search(blob) or _MATERIAL_SUBJECT.search(blob))


def look_haystack(item: Optional[Dict[str, Any]] = None) -> str:
    item = item or {}
    tags = item.get("tags") if isinstance(item.get("tags"), list) else []
    return " ".join(
        [
            str(item.get("label") or ""),
            str(item.get("description") or ""),
            str(item.get("scope") or ""),
            str(item.get("visualPrompt") or item.get("visual_prompt") or item.get("visual_direction") or ""),
            str(item.get("surfaces") or ""),
            str(item.get("fixtures") or ""),
            str(item.get("searchText") or item.get("search_text") or ""),
            str(item.get("mood") or ""),
            str(item.get("tileColor") or item.get("tile_color") or ""),
            str(item.get("hardwareFinish") or item.get("hardware_finish") or ""),
            " ".join(str(t) for t in (item.get("colors") or [])),
            " ".join(str(t) for t in (item.get("materials") or [])),
            " ".join(str(t) for t in tags),
        ]
    )


def _selected_scope_parts(scopes: Optional[List[str]]) -> List[str]:
    out: List[str] = []
    for raw in scopes or []:
        label = str(raw or "").strip()
        if not label or _OTHER.match(label) or _OVERALL.match(label):
            continue
        out.append(label)
    return out


def _wants_material_swatch(parts: List[str]) -> bool:
    return any(re.search(r"\b(tile|paint|color|stain|grout)\b", part, re.I) for part in parts)


def _scope_tokens(label: str) -> List[str]:
    tokens: List[str] = []
    for bit in re.split(r"[/&,]| and ", str(label or ""), flags=re.I):
        words = re.sub(r"[^a-z0-9]+", " ", bit.lower()).strip().split()
        for word in words:
            if len(word) < 3:
                continue
            tokens.append(word)
            tokens.extend(_SCOPE_ALIASES.get(word, []))
    return tokens


def _selected_scope_hit(image_text: str, parts: List[str]) -> bool:
    blob = str(image_text or "").lower()
    for part in parts:
        for tok in _scope_tokens(part):
            if re.search(rf"\b{re.escape(tok)}\b", blob, re.I):
                return True
    return False


def look_fits_selected_scopes(
    image_text: str = "",
    *,
    scopes: Optional[List[str]] = None,
    generated_for: str = "",
) -> bool:
    """Keep finished in-scope looks. Drop tile macros, option cards, and off-part shots."""
    blob = str(image_text or "")
    parts = _selected_scope_parts(scopes)
    wants_swatch = _wants_material_swatch(parts)
    if not wants_swatch and looks_like_material_swatch(blob):
        return False
    gen = str(generated_for or "").strip()
    if gen in _CATALOG_DETAIL_FOR and not wants_swatch and not looks_like_finished_room(blob):
        return False
    if not parts:
        return True
    if _selected_scope_hit(blob, parts):
        return True
    if looks_like_finished_room(blob) and not looks_like_material_swatch(blob):
        return True
    if _OTHER_PART.search(blob):
        return False
    return True


def look_conflicts_with_service(
    image_text: str = "",
    *,
    industry: str = "",
    service_label: str = "",
    summary: str = "",
) -> bool:
    service_vert = recipe_key(industry=industry, service_label=service_label, summary=summary)
    image_vert = _classify(str(image_text or "").strip().lower())
    if image_vert == "default" or service_vert == "default":
        return False
    if image_vert == service_vert:
        return False
    return image_vert not in _COMPATIBLE_VERTICALS.get(service_vert, [])


def recipe_key(industry: str = "", service_label: str = "", summary: str = "") -> str:
    return _classify(_match_text(industry, service_label, summary))


def get_recipe(key: str) -> Dict[str, Any]:
    rec = _VERTICALS.get(key) or _VERTICALS["default"]
    return {
        "key": rec["key"],
        "question": rec["question"],
        "subtitle": rec["subtitle"],
        "fullScope": rec["fullScope"],
        "parts": list(rec["parts"]),
    }


def match_recipe(*, industry: str = "", service_label: str = "", summary: str = "") -> Dict[str, Any]:
    return get_recipe(recipe_key(industry, service_label, summary))


def _clean_part(value: Any) -> str:
    if isinstance(value, dict):
        return str(value.get("label") or value.get("id") or value.get("key") or "").strip()
    return str(value or "").strip()


def stored_parts(service: Optional[Dict[str, Any]]) -> List[str]:
    service = service or {}
    known: List[str] = []
    seen: set[str] = set()
    for raw in service.get("knownParts") or service.get("subcategoryScope") or service.get("scopes") or []:
        label = _clean_part(raw)
        key = label.lower()
        if not label or _OTHER.match(label) or _OVERALL.match(label) or key in seen:
            continue
        seen.add(key)
        known.append(label)
    if known:
        return known

    components: List[str] = []
    for raw in service.get("components") or service.get("subcategoryComponents") or []:
        label = _clean_part(raw)
        key = label.lower()
        if not label or _OTHER.match(label) or _OVERALL.match(label) or key in seen:
            continue
        seen.add(key)
        components.append(label)
    return components


def scope_choices(recipe: Dict[str, Any], parts: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    """Full-scope option, then parts, then Other. Same structure for every vertical."""
    full = str(recipe.get("fullScope") or "Full Project")
    out: List[Dict[str, Any]] = [
        {"id": "full", "label": full, "role": "full", "serviceId": None, "hint": None}
    ]
    seen = {full.lower(), "other", "everything"}
    for part in parts if parts is not None else (recipe.get("parts") or []):
        label = str(part or "").strip()
        if not label or label.lower() in seen:
            continue
        seen.add(label.lower())
        slug = "".join(ch.lower() if ch.isalnum() else "-" for ch in label).strip("-")[:48] or "part"
        out.append({"id": slug, "label": label, "role": "part", "serviceId": None, "hint": None})
    out.append({"id": "other", "label": OTHER_LABEL, "role": "other", "serviceId": None, "hint": None})
    return out


def scope_question_for_service(service: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    service = service or {}
    label = str(service.get("customerLabel") or service.get("businessLabel") or "")
    recipe = match_recipe(
        industry="",
        service_label=label,
        summary="",
    )
    stored = stored_parts(service)
    parts = stored if stored else list(recipe["parts"])
    return {
        "ok": True,
        "step": "scope",
        "skip": False,
        "selectedServiceId": service.get("id"),
        "question": recipe["question"],
        "subtitle": recipe["subtitle"],
        "selectionType": "multiple",
        "choices": scope_choices(recipe, parts),
        "allowOther": True,
        "recipeKey": recipe["key"],
        "source": "service" if stored else "recipe",
    }


__all__ = [
    "OTHER_LABEL",
    "SCOPE_QUESTION",
    "SCOPE_SUBTITLE",
    "get_recipe",
    "look_conflicts_with_service",
    "look_fits_selected_scopes",
    "look_haystack",
    "looks_like_finished_room",
    "looks_like_material_swatch",
    "match_recipe",
    "recipe_key",
    "scope_choices",
    "scope_question_for_service",
    "stored_parts",
]
