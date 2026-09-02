"""
Cheap catalog pass: tags + quality score for discovery search.

Default path is Gemini Flash-Lite (high-volume classification). Ambiguous
aesthetic calls escalate to a stronger model. Hard defects auto-reject.
"""

from __future__ import annotations

import base64
import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from programs.pricing.replicate_vlm import (
    _extract_json_from_text,
    _replicate_create_prediction,
    _replicate_wait_for_completion,
)


CATALOG_METADATA_SPEC_VERSION = 1
DISCOVERY_SCOPES = (
    "vanity",
    "shower-tub",
    "tile",
    "flooring",
    "paint",
    "lighting",
    "full-bathroom-remodel",
    "cabinets",
    "countertops",
    "island",
    "backsplash",
    "full-kitchen-remodel",
    "planting",
    "patio",
    "full-landscape-project",
    "other",
)
DISCOVERY_TIERS = ("value", "mid", "premium", "luxury")
DISCOVERY_STYLES = ("modern", "transitional", "traditional", "coastal", "organic", "other")
DISCOVERY_MOODS = ("bright", "airy", "warm", "spa", "moody", "clinical", "dated", "other")
DISCOVERY_LIGHTING = ("daylight", "warm", "dingy", "mixed", "other")
DISCOVERY_ROLES = ("inspiration", "starter", "before", "swatch", "option")
TILE_SHAPES = ("subway", "square", "hex", "large-format", "penny", "mosaic", "plank", "other")
HARDWARE_FINISHES = ("chrome", "matte-black", "brass", "nickel", "bronze", "mixed", "other")
VERDICTS = ("keep", "reject", "review")

# Older product versions stored these as blank starter canvases, not inspiration.
STARTER_GENERATED_FOR = frozenset(
    {
        "v2_scope_starter",
        "v2_neutral_scope_starter",
        "v2_service_starter",
        "style_seed",
    }
)

# Objective junk — cheap models are reliable here; no second pass needed.
HARD_DEFECTS = frozenset(
    {
        "blur",
        "watermark",
        "screenshot",
        "collage",
        "swatch",
        "floorplan",
        "text-overlay",
        "logo",
        "off-topic",
        "people",
        "thumbnail-grid",
        "broken",
        "ai-artifact",
        "stock-watermark",
    }
)

# Looks like a before-photo or ugly starter — hide from the inspiration board.
AESTHETIC_REJECT = frozenset(
    {
        "dated",
        "dingy",
        "yellow-cast",
        "builder-basic",
        "rental",
        "unstaged",
        "cramped",
        "empty-box",
    }
)

_TIMEOUT = float(os.getenv("ADVENTURE_CATALOG_VISION_TIMEOUT_SEC", "40"))


def _cheap_model() -> str:
    env = str(os.getenv("ADVENTURE_CATALOG_VISION_MODEL") or "").strip()
    if env:
        return env
    if _gemini_key():
        return "gemini-2.5-flash-lite"
    return str(os.getenv("ADVENTURE_VISION_MODEL") or "openai/gpt-5-mini").strip()


def catalog_vision_enabled() -> bool:
    raw = str(os.getenv("ADVENTURE_TASTE_USE_VISION", "") or "").strip().lower()
    if raw in ("false", "0", "off", "no"):
        return False
    return bool(_gemini_key() or str(os.getenv("REPLICATE_API_TOKEN") or "").strip())


def discovery_hidden(discovery: Any) -> bool:
    """True when a tagged photo should stay out of the concept gallery."""
    if not isinstance(discovery, dict) or not discovery:
        return False
    if discovery.get("keep") is False:
        return True
    if discovery.get("inspirational") is False:
        return True
    role = str(discovery.get("role") or "").strip().lower()
    if role in ("starter", "before", "swatch"):
        return True
    verdict = str(discovery.get("verdict") or "").strip().lower()
    return verdict in ("reject", "hide")


def inspiration_blocked(*, generated_for: str = "", discovery: Any = None) -> bool:
    """Drop old starter/before canvases unless a later tag pass marks them as inspiration."""
    disc = discovery if isinstance(discovery, dict) else {}
    if discovery_hidden(disc):
        return True
    gen = str(generated_for or "").strip()
    if gen not in STARTER_GENERATED_FOR:
        return False
    return not (
        str(disc.get("role") or "") == "inspiration"
        and disc.get("keep") is True
        and disc.get("inspirational") is True
    )


def already_tagged(discovery: Any) -> bool:
    if not isinstance(discovery, dict):
        return False
    return bool(str(discovery.get("primary_scope") or "").strip())


def needs_review(tags: Dict[str, Any] | None) -> bool:
    if not isinstance(tags, dict) or not tags:
        return True
    defects = {str(d).strip().lower() for d in (tags.get("defects") or []) if str(d).strip()}
    if defects & HARD_DEFECTS:
        return False
    if defects & AESTHETIC_REJECT:
        return False
    verdict = str(tags.get("verdict") or "").strip().lower()
    if verdict == "review":
        return True
    try:
        score = float(tags.get("quality_score"))
    except (TypeError, ValueError):
        score = None
    if verdict == "reject" and not defects:
        return True
    if verdict == "keep" and score is not None and 0.40 <= score < 0.62:
        return True
    if score is None and verdict != "keep":
        return True
    return False


def _closed(raw: Any, allowed: tuple[str, ...], fallback: str) -> str:
    value = str(raw or "").strip().lower().replace("_", "-").replace(" ", "-")
    return value if value in allowed else fallback


def _search_text(tags: Dict[str, Any]) -> str:
    bits = [
        str(tags.get("description") or ""),
        str(tags.get("style") or ""),
        str(tags.get("mood") or ""),
        str(tags.get("lighting") or ""),
        str(tags.get("tile_shape") or ""),
        str(tags.get("tile_color") or ""),
        str(tags.get("hardware_finish") or ""),
        str(tags.get("vanity_style") or ""),
        str(tags.get("vanity_color") or ""),
        " ".join(str(x) for x in (tags.get("contains") or [])),
        " ".join(str(x) for x in (tags.get("colors") or [])),
        " ".join(str(x) for x in (tags.get("materials") or [])),
        str(tags.get("primary_scope") or ""),
    ]
    seen: set[str] = set()
    out: List[str] = []
    for bit in bits:
        for token in str(bit).replace("-", " ").split():
            key = token.strip().lower()
            if len(key) < 2 or key in seen:
                continue
            seen.add(key)
            out.append(key)
    return " ".join(out)[:400]


def normalize_catalog_tags(raw: Any, *, model: str = "") -> Dict[str, Any]:
    parsed = raw if isinstance(raw, dict) else {}
    scope = _closed(parsed.get("primary_scope"), DISCOVERY_SCOPES, "other")
    tier = _closed(parsed.get("estimated_finish_tier"), DISCOVERY_TIERS, "mid")
    style = _closed(parsed.get("style"), DISCOVERY_STYLES, "other")
    mood = _closed(parsed.get("mood"), DISCOVERY_MOODS, "other")
    lighting = _closed(parsed.get("lighting"), DISCOVERY_LIGHTING, "other")
    defects = _string_list(parsed.get("defects"), cap=10)
    hard = bool({d.lower() for d in defects} & HARD_DEFECTS)
    ugly = bool({d.lower() for d in defects} & AESTHETIC_REJECT) or mood == "dated" or lighting == "dingy"
    role = _closed(parsed.get("role"), DISCOVERY_ROLES, "")
    verdict = str(parsed.get("verdict") or "").strip().lower()
    if verdict not in VERDICTS:
        keep_flag = parsed.get("keep")
        if keep_flag is False or hard or ugly:
            verdict = "reject"
        elif keep_flag is True:
            verdict = "keep"
        else:
            verdict = "review"
    if hard or ugly or role in ("starter", "before", "swatch"):
        verdict = "reject"
    if not role:
        role = "inspiration" if verdict == "keep" else "before"
    try:
        score = max(0.0, min(1.0, float(parsed.get("quality_score"))))
    except (TypeError, ValueError):
        score = 0.35 if verdict == "reject" else 0.55 if verdict == "review" else 0.72
    inspirational = verdict == "keep" and role == "inspiration" and not ugly and not hard
    if isinstance(parsed.get("inspirational"), bool) and verdict == "keep" and not ugly and not hard:
        inspirational = bool(parsed.get("inspirational"))
    keep = bool(inspirational)
    description = str(parsed.get("description") or parsed.get("caption") or "").strip()[:240]
    tags = {
        "schema_version": CATALOG_METADATA_SPEC_VERSION,
        "contains": _string_list(parsed.get("contains"), cap=12),
        "primary_scope": scope,
        "style": style,
        "mood": mood,
        "lighting": lighting,
        "estimated_finish_tier": tier,
        "colors": _string_list(parsed.get("colors") or parsed.get("palette"), cap=8),
        "materials": _string_list(parsed.get("materials"), cap=8),
        "tile_shape": _closed(parsed.get("tile_shape"), TILE_SHAPES, "other") if parsed.get("tile_shape") else None,
        "tile_color": str(parsed.get("tile_color") or "").strip().lower().replace(" ", "-")[:32] or None,
        "hardware_finish": _closed(parsed.get("hardware_finish"), HARDWARE_FINISHES, "other") if parsed.get("hardware_finish") else None,
        "vanity_style": str(parsed.get("vanity_style") or "").strip().lower().replace(" ", "-")[:32] or None,
        "vanity_color": str(parsed.get("vanity_color") or "").strip().lower().replace(" ", "-")[:32] or None,
        "description": description or None,
        "role": role,
        "inspirational": inspirational,
        "quality_score": round(score, 3),
        "defects": defects,
        "verdict": verdict,
        "keep": keep,
        "model": str(model or parsed.get("model") or "").strip() or None,
        "tagged_at": str(parsed.get("tagged_at") or _now()),
    }
    tags["search_text"] = _search_text(tags)
    return tags


def project_manifest_from_catalog_tags(tags: Any) -> Dict[str, Any]:
    """Turn VLM catalog observations into the one runtime project contract."""
    source = tags if isinstance(tags, dict) else {}
    contains = _string_list(source.get("contains"), cap=12)
    defects = {str(item or "").strip().lower() for item in source.get("defects") or []}
    hard_defects = sorted(defects & HARD_DEFECTS)
    try:
        confidence = max(0.0, min(1.0, float(source.get("quality_score") or 0.0)))
    except (TypeError, ValueError):
        confidence = 0.0
    components = [
        {
            "key": value,
            "label": value.replace("-", " ").replace("_", " ").strip().title(),
            "confidence": round(confidence, 3),
            "quantity": 1,
        }
        for value in contains
    ]
    primary_scope = str(source.get("primary_scope") or "").strip() or None
    is_full = bool(
        primary_scope
        and re.search(r"(?:^|[-_ ])(?:full|whole|complete|entire)(?:$|[-_ ])", primary_scope, re.I)
    )
    status = "verified" if components and not hard_defects else "rejected"
    return {
        "version": 1,
        "analysisStatus": status,
        "sceneType": "full-project" if is_full else "component",
        "description": str(source.get("description") or "").strip() or None,
        "primaryScope": primary_scope,
        "components": components,
        "model": str(source.get("model") or "").strip() or None,
        "analyzedAt": str(source.get("tagged_at") or _now()),
        "defects": hard_defects,
    }


def tag_catalog_photo(image_url: str) -> Optional[Dict[str, Any]]:
    """Run exactly one catalog vision pass and fail closed on provider errors."""
    if not catalog_vision_enabled():
        return None
    url = str(image_url or "").strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        return None
    cheap_model = _cheap_model()
    cheap = _run_vision(url, model=cheap_model, role="triage")
    if not cheap:
        return None
    tags = normalize_catalog_tags(cheap, model=cheap_model)
    tags["reviewed"] = False
    return tags


def normalize_starter_profile_suggestion(
    raw: Any,
    *,
    service_id: str = "",
    service_scope_keys: Optional[List[str]] = None,
    model: str = "",
) -> Dict[str, Any]:
    """Normalize an offline VLM suggestion without making it retrieval-eligible."""
    parsed = raw if isinstance(raw, dict) else {}
    allowed = {
        str(value or "").strip().lower().replace("_", "-").replace(" ", "-")
        for value in (service_scope_keys or [])
        if str(value or "").strip()
    }
    visible = _string_list(parsed.get("visible_scope_keys"), cap=32)
    hero = _string_list(parsed.get("hero_scope_keys"), cap=16)
    if allowed:
        visible = [value for value in visible if value in allowed]
        hero = [value for value in hero if value in allowed]
    defects = _string_list(parsed.get("defects"), cap=12)
    inventory_raw = parsed.get("fixture_inventory")
    inventory: Dict[str, Any] = {}
    if isinstance(inventory_raw, dict):
        for raw_key, raw_value in list(inventory_raw.items())[:24]:
            key = str(raw_key or "").strip().lower().replace(" ", "_")[:64]
            if not key or not isinstance(raw_value, (str, int, float, bool)):
                continue
            inventory[key] = raw_value

    def score(key: str, fallback: float) -> float:
        try:
            return round(max(0.0, min(1.0, float(parsed.get(key)))), 3)
        except (TypeError, ValueError):
            return fallback

    structural_valid = parsed.get("structural_valid") is True and not defects
    return {
        "version": 1,
        # Suggestions can never enter runtime retrieval until a human flips both fields.
        "eligible": False,
        "review_status": "pending",
        "service_id": str(service_id or parsed.get("service_id") or "").strip() or None,
        "visible_scope_keys": visible,
        "hero_scope_keys": hero,
        "finish_tier": _closed(parsed.get("finish_tier"), DISCOVERY_TIERS, "mid"),
        "layout_family": str(parsed.get("layout_family") or "general").strip().lower().replace(" ", "-")[:80] or "general",
        "camera_angle": str(parsed.get("camera_angle") or "wide-three-quarter").strip().lower().replace(" ", "-")[:80] or "wide-three-quarter",
        "fixture_inventory": inventory,
        "plainness_score": score("plainness_score", 0.5),
        "editability_score": score("editability_score", 0.5),
        "structural_valid": structural_valid,
        "defects": defects,
        "suggested_by_model": str(model or parsed.get("model") or "").strip() or None,
        "suggested_at": _now(),
    }


def suggest_starter_profile(
    image_url: str,
    *,
    service_id: str = "",
    service_scope_keys: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """Offline-only starter metadata prefill. Human approval remains mandatory."""
    if not catalog_vision_enabled():
        return None
    url = str(image_url or "").strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        return None
    model = _cheap_model()
    raw = _run_vision(url, model=model, role="starter")
    if not raw:
        return None
    return normalize_starter_profile_suggestion(
        raw,
        service_id=service_id,
        service_scope_keys=service_scope_keys,
        model=model,
    )


def _string_list(raw: Any, *, cap: int) -> List[str]:
    if not isinstance(raw, list):
        return []
    out: List[str] = []
    seen: set[str] = set()
    for item in raw:
        value = str(item or "").strip().lower().replace("_", "-").replace(" ", "-")
        if not value or value in seen:
            continue
        seen.add(value)
        out.append(value)
        if len(out) >= cap:
            break
    return out


def _now() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _gemini_key() -> str:
    return (os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY") or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY") or "").strip()


def _prompt(role: str) -> Tuple[str, str]:
    if role == "starter":
        return (
            "You inspect remodeling photos proposed as neutral AI-editing anchors. Return JSON only. "
            "Describe only what is visibly present. Count major fixtures and outdoor zones exactly. "
            "Flag duplicate fixtures, warped geometry, impossible reflections, collage layouts, text, people, "
            "watermarks, blur, and AI artifacts. A starter should be plain, structurally believable, broadly editable, "
            "and photographed from a useful wide or component-focused angle. Do not approve or reject it; humans do that.",
            "Return JSON with visible_scope_keys, hero_scope_keys, finish_tier (value/mid/premium/luxury), "
            "layout_family, camera_angle, fixture_inventory (object of exact counts/types), plainness_score (0-1), "
            "editability_score (0-1), structural_valid (boolean), and defects (array).",
        )
    system = (
        "You index remodeling photos for an inspiration gallery. Return JSON only. "
        "This board is Pinterest-style inspiration — not a before photo, not a blank starter room, "
        "and not a dingy builder-grade rental. "
        "primary_scope is the main subject. estimated_finish_tier is value/mid/premium/luxury. "
        "Reject blur, watermarks, screenshots, swatches, collages, floorplans, logos, text, people, "
        "broken images, and off-topic shots. "
        "Also reject dated, dingy, yellow-cast, cramped, unstaged, empty-box, or builder-basic rooms "
        "that a homeowner would not save as a look. Those get role=before, inspirational=false, verdict=reject. "
        "Keep only bright, designed, livable rooms. Describe tile color/shape, hardware finish, vanity, mood. "
        "If technically fine but taste is uncertain, verdict=review."
    )
    if role == "review":
        system += " Second pass: keep only if a customer would tap it as a look they want."
    user = (
        "Closed vocabulary:\n"
        f"primary_scope: {list(DISCOVERY_SCOPES)}\n"
        f"estimated_finish_tier: {list(DISCOVERY_TIERS)}\n"
        f"style: {list(DISCOVERY_STYLES)}\n"
        f"mood: {list(DISCOVERY_MOODS)}\n"
        f"lighting: {list(DISCOVERY_LIGHTING)}\n"
        f"role: {list(DISCOVERY_ROLES)}\n"
        f"tile_shape: {list(TILE_SHAPES)}\n"
        f"hardware_finish: {list(HARDWARE_FINISHES)}\n"
        f"verdict: {list(VERDICTS)}\n"
        "defects: blur, watermark, screenshot, collage, swatch, floorplan, text-overlay, logo, "
        "off-topic, people, thumbnail-grid, broken, ai-artifact, dated, dingy, yellow-cast, "
        "builder-basic, rental, unstaged, cramped, empty-box.\n"
        "quality_score is 0-1. description is one short sentence for search.\n"
        "Return JSON: {\"contains\":[\"vanity\",\"shower-tub\"],\"primary_scope\":\"full-bathroom-remodel\","
        "\"style\":\"modern\",\"mood\":\"bright\",\"lighting\":\"daylight\","
        "\"estimated_finish_tier\":\"mid\",\"colors\":[\"white\",\"matte-black\"],"
        "\"materials\":[\"subway-tile\",\"oak\"],\"tile_shape\":\"subway\",\"tile_color\":\"white\","
        "\"hardware_finish\":\"matte-black\",\"vanity_style\":\"shaker\",\"vanity_color\":\"white\","
        "\"description\":\"Bright modern bath, white subway tile, matte black hardware\","
        "\"role\":\"inspiration\",\"inspirational\":true,\"quality_score\":0.86,\"defects\":[],"
        "\"verdict\":\"keep\",\"keep\":true}"
    )
    return system, user


def _run_vision(image_url: str, *, model: str, role: str) -> Optional[Dict[str, Any]]:
    system, user = _prompt(role)
    if _gemini_key() and "gemini" in model.lower():
        parsed = _gemini_json(image_url, model=model, system=system, user=user)
        if parsed:
            return parsed
    if str(os.getenv("REPLICATE_API_TOKEN") or "").strip():
        return _replicate_json(image_url, model=model, system=system, user=user)
    return None


def _gemini_model_id(model: str) -> str:
    name = str(model or "").strip()
    if "/" in name:
        name = name.rsplit("/", 1)[-1]
    return name or "gemini-2.5-flash-lite"


def _guess_mime(url: str, content_type: str = "") -> str:
    ctype = str(content_type or "").split(";")[0].strip().lower()
    if ctype in ("image/jpeg", "image/png", "image/webp", "image/gif"):
        return ctype
    lower = url.lower()
    if ".png" in lower:
        return "image/png"
    if ".webp" in lower:
        return "image/webp"
    if ".gif" in lower:
        return "image/gif"
    return "image/jpeg"


def _fetch_image(url: str) -> Optional[Tuple[bytes, str]]:
    req = urllib.request.Request(url, headers={"User-Agent": "adventure-catalog-tag/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = resp.read()
            if not data or len(data) > 8_000_000:
                return None
            mime = _guess_mime(url, str(resp.headers.get("Content-Type") or ""))
            return data, mime
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None


def _gemini_json(image_url: str, *, model: str, system: str, user: str) -> Optional[Dict[str, Any]]:
    key = _gemini_key()
    if not key:
        return None
    fetched = _fetch_image(image_url)
    if not fetched:
        return None
    blob, mime = fetched
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [
            {
                "role": "user",
                "parts": [
                    {"text": user},
                    {"inline_data": {"mime_type": mime, "data": base64.b64encode(blob).decode("ascii")}},
                ],
            }
        ],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 800,
            "responseMimeType": "application/json",
        },
    }
    model_id = urllib.parse.quote(_gemini_model_id(model), safe=".-")
    endpoint = (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent?key={urllib.parse.quote(key)}"
    )
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
    text = _gemini_text(body)
    return _extract_json_from_text(text) if text else None


def _gemini_text(body: Any) -> str:
    if not isinstance(body, dict):
        return ""
    cands = body.get("candidates")
    if not isinstance(cands, list) or not cands:
        return ""
    content = cands[0].get("content") if isinstance(cands[0], dict) else None
    parts = content.get("parts") if isinstance(content, dict) else None
    if not isinstance(parts, list):
        return ""
    chunks: List[str] = []
    for part in parts:
        if isinstance(part, dict) and part.get("text"):
            chunks.append(str(part.get("text") or ""))
    return "\n".join(chunks).strip()


def _replicate_model_id(model: str) -> str:
    name = str(model or "").strip()
    if name.startswith("google/") or name.startswith("openai/") or "/" in name:
        return name
    if "gemini" in name.lower():
        return f"google/{name}"
    return name or "openai/gpt-5-mini"


def _replicate_input(model_id: str, *, system: str, user: str, image_url: str) -> Dict[str, Any]:
    images = [image_url]
    if "gemini" in model_id.lower() or model_id.startswith("google/"):
        return {
            "prompt": f"{system}\n\n{user}",
            "images": images,
            "max_output_tokens": 800,
            "temperature": 0.1,
        }
    if "gpt-5" in model_id.lower():
        return {
            "system_prompt": system,
            "prompt": user,
            "image_input": images,
            "max_completion_tokens": 800,
            "reasoning_effort": "minimal",
            "verbosity": "low",
        }
    return {
        "system_prompt": system,
        "prompt": user,
        "image_input": images,
        "temperature": 0.1,
        "max_completion_tokens": 800,
    }


def _replicate_json(image_url: str, *, model: str, system: str, user: str) -> Optional[Dict[str, Any]]:
    model_id = _replicate_model_id(model)
    try:
        created = _replicate_create_prediction(
            model_id=model_id,
            input=_replicate_input(model_id, system=system, user=user, image_url=image_url),
        )
        pred_id = created.get("id")
        if not pred_id:
            return None
        final = _replicate_wait_for_completion(str(pred_id), timeout_sec=_TIMEOUT)
        if str(final.get("status") or "").lower() != "succeeded":
            return None
        output = final.get("output")
        text = "".join(str(part) for part in output) if isinstance(output, list) else str(output or "")
        return _extract_json_from_text(text)
    except Exception:
        return None


__all__ = [
    "AESTHETIC_REJECT",
    "CATALOG_METADATA_SPEC_VERSION",
    "DISCOVERY_SCOPES",
    "DISCOVERY_STYLES",
    "DISCOVERY_TIERS",
    "HARD_DEFECTS",
    "STARTER_GENERATED_FOR",
    "already_tagged",
    "catalog_vision_enabled",
    "discovery_hidden",
    "inspiration_blocked",
    "needs_review",
    "normalize_catalog_tags",
    "project_manifest_from_catalog_tags",
    "tag_catalog_photo",
]
