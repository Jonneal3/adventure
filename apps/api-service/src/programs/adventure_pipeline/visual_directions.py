"""
Groq visual directions for the no-photo Explore → Narrow gallery.

Scope is the hard constraint (WHAT we show).
Style is the variable — a fresh set of short visual directions per batch.
No stored industry style matrix.
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, List, Optional, Tuple

from programs.adventure_pipeline.llm import run_json_signature
from programs.adventure_pipeline.recipes import match_recipe


BATCH = 12

ROOMS = {
    "bathroom": "residential bathroom",
    "kitchen": "residential kitchen",
    "landscaping": "residential outdoor living space",
    "painting": "interior of a home being painted",
    "pool": "residential pool and deck",
    "flooring": "interior with new flooring as the hero",
    "pergola": "residential pergola and patio",
    "windows": "residential windows and exterior doors on a home",
    "roofing": "a residential roof",
    "siding": "residential exterior siding",
    "fencing": "a residential fence",
    "default": "residential project",
}

# Colorful HOW-it-looks seeds. Used only when Groq is unavailable.
# Modest budget still uses color — never a batch of all-white builder rooms.
FALLBACK_DIRECTIONS: List[Dict[str, str]] = [
    {"label": "navy contrast", "prompt": "navy and cream palette, chrome hardware, bright daylight, clear contrast", "family": "navy", "palette": "navy and cream", "surfaces": "navy surfaces with cream contrast", "fixtures": "chrome hardware", "style": "classic modern"},
    {"label": "sage warm", "prompt": "sage green and warm oak, brass hardware, soft daylight", "family": "sage", "palette": "sage and oak", "surfaces": "sage finishes, warm wood", "fixtures": "brass hardware", "style": "soft traditional"},
    {"label": "graphite modern", "prompt": "charcoal and white, matte black hardware, graphic and simple", "family": "graphite", "palette": "charcoal and white", "surfaces": "charcoal and white pairing", "fixtures": "matte black hardware", "style": "modern"},
    {"label": "terracotta craft", "prompt": "terracotta and sand, bronze hardware, warm light", "family": "terracotta", "palette": "terracotta and sand", "surfaces": "terracotta-look ceramic", "fixtures": "bronze hardware", "style": "organic"},
    {"label": "blush light", "prompt": "blush and white, nickel hardware, bright airy light", "family": "blush", "palette": "blush and white", "surfaces": "blush tile or paint, white trim", "fixtures": "nickel hardware", "style": "light contemporary"},
    {"label": "forest bold", "prompt": "forest green and cream, black hardware, strong color", "family": "forest", "palette": "forest green and cream", "surfaces": "deep green surfaces", "fixtures": "black hardware", "style": "bold modern"},
    {"label": "high contrast", "prompt": "black and white contrast, chrome hardware, graphic pattern", "family": "checker", "palette": "black and white", "surfaces": "high-contrast pattern", "fixtures": "chrome hardware", "style": "classic"},
    {"label": "honey traditional", "prompt": "honey oak and cream, champagne bronze, warm daylight", "family": "honey", "palette": "honey oak and cream", "surfaces": "warm wood and cream", "fixtures": "champagne bronze", "style": "warm traditional"},
    {"label": "sky coastal", "prompt": "sky blue and white, chrome, coastal daylight", "family": "sky", "palette": "sky blue and white", "surfaces": "light blue and white", "fixtures": "chrome hardware", "style": "coastal"},
    {"label": "ink oak", "prompt": "ink blue and natural oak, brushed nickel, calm light", "family": "ink", "palette": "ink blue and oak", "surfaces": "deep blue with natural wood", "fixtures": "brushed nickel", "style": "organic modern"},
    {"label": "sand texture", "prompt": "warm sand and clay, brushed gold, sunlit texture", "family": "sand", "palette": "warm sand and clay", "surfaces": "textured sand ceramic", "fixtures": "brushed gold-tone", "style": "quiet craft"},
    {"label": "slate clean", "prompt": "slate and white, square chrome, clean graphic look", "family": "slate", "palette": "cool slate and white", "surfaces": "slate-look porcelain", "fixtures": "square chrome", "style": "spa-simple"},
    {"label": "emerald jewel", "prompt": "emerald and cream, brass hardware, rich but buildable", "family": "emerald", "palette": "emerald and cream", "surfaces": "emerald surfaces, cream contrast", "fixtures": "brass hardware", "style": "jewel traditional"},
    {"label": "cobalt graphic", "prompt": "cobalt and white, chrome hardware, graphic contrast", "family": "cobalt", "palette": "cobalt and white", "surfaces": "cobalt accent with white field", "fixtures": "chrome hardware", "style": "graphic coastal"},
    {"label": "mint fresh", "prompt": "mint and white, chrome hardware, fresh daylight", "family": "mint", "palette": "mint and white", "surfaces": "mint tile or paint, white trim", "fixtures": "chrome hardware", "style": "retro fresh"},
    {"label": "ochre pattern", "prompt": "ochre pattern, cream field, bronze hardware, warm", "family": "ochre", "palette": "mustard ochre and cream", "surfaces": "patterned ochre ceramic", "fixtures": "bronze hardware", "style": "collected"},
    {"label": "cinnamon warm", "prompt": "cinnamon and warm gray, matte black hardware", "family": "cinnamon", "palette": "cinnamon and warm gray", "surfaces": "wood-look and cinnamon accent", "fixtures": "matte black hardware", "style": "warm modern"},
    {"label": "plum mood", "prompt": "aubergine and pale stone, brushed nickel, warm light", "family": "plum", "palette": "aubergine and pale stone", "surfaces": "plum gloss, pale stone-look", "fixtures": "brushed nickel", "style": "moody classic"},
]

BATHROOM_DIRECTIONS: List[Dict[str, str]] = [
    {"label": "navy subway", "prompt": "navy subway tile, cream walls, chrome rain head and tub filler, bright daylight", "family": "navy", "palette": "navy and cream", "surfaces": "glossy navy 3x6 subway tile, light grout", "fixtures": "chrome rain shower and wall-mount tub filler", "style": "classic modern"},
    {"label": "sage zellige", "prompt": "sage zellige tile, warm white walls, brushed brass shower and tub, soft daylight", "family": "sage", "palette": "sage green and warm white", "surfaces": "handmade-look sage zellige wall tile", "fixtures": "brushed brass shower set and tub filler", "style": "soft traditional"},
    {"label": "matte graphite", "prompt": "charcoal porcelain, crisp white walls, matte black rain head and handheld, graphic contrast", "family": "graphite", "palette": "charcoal and crisp white", "surfaces": "24x48 charcoal porcelain, white walls", "fixtures": "matte black rain head plus handheld", "style": "modern"},
    {"label": "terracotta bath", "prompt": "terracotta ceramic tile, sand grout, bronze shower and tub, warm afternoon light", "family": "terracotta", "palette": "terracotta and sand", "surfaces": "terracotta-look ceramic, sandy grout", "fixtures": "oil-rubbed bronze tub filler and shower", "style": "organic"},
    {"label": "blush herringbone", "prompt": "blush herringbone tile, white hex floor, polished nickel shower and tub, bright light", "family": "blush", "palette": "blush pink and white", "surfaces": "blush herringbone ceramic, white hex floor", "fixtures": "polished nickel shower trim", "style": "light contemporary"},
    {"label": "forest stack", "prompt": "vertical forest-green ceramic, cream walls, matte black exposed shower, strong color", "family": "forest", "palette": "forest green and cream", "surfaces": "vertical stacked forest-green ceramic", "fixtures": "matte black exposed-pipe shower", "style": "bold modern"},
    {"label": "black white check", "prompt": "checkerboard floor, white subway walls, chrome vintage cross-handle shower and tub", "family": "checker", "palette": "black and white", "surfaces": "black-and-white checkerboard floor, white subway walls", "fixtures": "chrome cross-handle vintage shower", "style": "classic"},
    {"label": "honey oak", "prompt": "cream 4x4 tile, honey oak accents, champagne bronze shower and tub, warm daylight", "family": "honey", "palette": "honey oak and cream", "surfaces": "cream 4x4 ceramic, honey oak accents", "fixtures": "champagne-bronze shower set", "style": "warm traditional"},
    {"label": "sky penny tile", "prompt": "sky-blue penny mosaic, white pebble-look floor, chrome handheld shower and tub, beachy light", "family": "sky", "palette": "sky blue and white", "surfaces": "sky-blue penny mosaic, white pebble-look floor", "fixtures": "chrome handheld and tub spout", "style": "coastal"},
    {"label": "ink and oak", "prompt": "deep ink-blue ceramic, natural oak trim, brushed nickel rain head, calm daylight", "family": "ink", "palette": "deep ink blue and natural oak", "surfaces": "deep blue large ceramic, natural oak trim", "fixtures": "brushed nickel rain head", "style": "organic modern"},
    {"label": "warm sand", "prompt": "warm sand ceramic, clay grout, brushed gold shower and tub, sunlit and textured", "family": "sand", "palette": "warm sand and clay", "surfaces": "sand-colored ceramic, handmade grout lines", "fixtures": "brushed gold-tone shower trim", "style": "quiet craft"},
    {"label": "slate hex", "prompt": "slate-look hexagon porcelain, white ceiling, square chrome rain head, clean and graphic", "family": "slate", "palette": "cool slate and white", "surfaces": "slate-look hexagon porcelain", "fixtures": "square chrome rain head", "style": "spa-simple"},
    {"label": "emerald arabesque", "prompt": "emerald lantern tile, cream walls, brass shower and tub, rich but buildable", "family": "emerald", "palette": "emerald and cream", "surfaces": "emerald arabesque / lantern tile", "fixtures": "unlacquered-brass look shower and tub", "style": "jewel traditional"},
    {"label": "cobalt mosaic", "prompt": "cobalt mosaic with white stacked tile, chrome rain head and floor-mount tub filler", "family": "cobalt", "palette": "cobalt blue and white", "surfaces": "cobalt mosaic niche, white stacked wall tile", "fixtures": "chrome rain head and floor-mount tub filler", "style": "graphic coastal"},
    {"label": "mint subway", "prompt": "mint subway tile, white hex floor, chrome rain head and tub, fresh daylight", "family": "mint", "palette": "mint green and white", "surfaces": "mint subway tile, white hex floor", "fixtures": "chrome rain head and widespread faucet", "style": "retro fresh"},
    {"label": "ochre encaustic", "prompt": "ochre encaustic-look floor, cream walls, bronze shower and tub, patterned and warm", "family": "ochre", "palette": "mustard ochre and cream", "surfaces": "ochre patterned encaustic-look ceramic", "fixtures": "oil-rubbed bronze shower", "style": "collected"},
    {"label": "cinnamon plank", "prompt": "cinnamon wood-look porcelain, warm gray walls, matte black rain head and tub", "family": "cinnamon", "palette": "cinnamon and warm gray", "surfaces": "wood-look porcelain planks, cinnamon accent wall", "fixtures": "matte black rainfall and tub filler", "style": "warm modern"},
    {"label": "plum gloss", "prompt": "glossy plum ceramic, pale stone-look floor, brushed nickel vintage tub filler, evening-warm light", "family": "plum", "palette": "aubergine and pale stone", "surfaces": "glossy plum ceramic, pale stone-look floor", "fixtures": "brushed nickel vintage tub filler", "style": "moody classic"},
]

_OTHER = re.compile(r"^other$", re.I)
_FULL = re.compile(r"^(full |whole |complete )", re.I)
_DISCOVERY_MODELS = (
    "black-forest-labs/flux-schnell",
    "google/imagen-4-fast",
)


def _clean(value: Any, limit: int = 240) -> str:
    return str(value or "").strip()[:limit]


def _as_int(value: Any, default: int, lo: int, hi: int) -> int:
    try:
        n = int(value)
    except (TypeError, ValueError):
        n = default
    return max(lo, min(hi, n))


def _focal_scopes(raw: Any) -> List[str]:
    items = raw if isinstance(raw, list) else []
    out: List[str] = []
    seen: set[str] = set()
    for item in items:
        label = _clean(item.get("label") if isinstance(item, dict) else item, 80)
        if not label or _OTHER.match(label) or _FULL.match(label):
            continue
        key = label.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(label)
    return out


def _liked_directions(raw: Any) -> List[Dict[str, str]]:
    items = raw if isinstance(raw, list) else []
    out: List[Dict[str, str]] = []
    seen: set[str] = set()
    for item in items:
        if isinstance(item, dict):
            label = _clean(item.get("label"), 80)
            prompt = _clean(item.get("prompt") or item.get("direction") or label, 220)
        else:
            label = _clean(item, 80)
            prompt = label
        if not prompt:
            continue
        key = prompt.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append({"label": label or prompt[:40], "prompt": prompt})
    return out[:8]


def _room_for(payload: Dict[str, Any], design: Dict[str, Any]) -> Tuple[str, str]:
    recipe = match_recipe(
        industry=_clean(payload.get("industry") or design.get("industry"), 80),
        service_label=_clean(
            payload.get("serviceLabel")
            or payload.get("customerServiceLabel")
            or design.get("customerServiceLabel")
            or design.get("serviceLabel"),
            80,
        ),
        summary=_clean(payload.get("serviceSummary") or design.get("serviceSummary"), 400),
    )
    key = str(recipe.get("key") or "default")
    if key != "default" and key in ROOMS:
        return key, ROOMS[key]
    service = _clean(
        payload.get("serviceLabel")
        or payload.get("customerServiceLabel")
        or design.get("customerServiceLabel")
        or design.get("serviceLabel"),
        80,
    )
    if service:
        return key, f"{service.lower()} work on a residential home"
    return key, ROOMS["default"]


def _shuffle(rows: List[Dict[str, str]], seed: str) -> List[Dict[str, str]]:
    if len(rows) <= 1:
        return list(rows)
    digest = hashlib.sha256(seed.encode("utf-8")).digest()
    indexed = list(enumerate(rows))
    indexed.sort(key=lambda pair: digest[pair[0] % len(digest)])
    return [item for _, item in indexed]


def _direction_row(item: Any) -> Optional[Dict[str, str]]:
    if isinstance(item, dict):
        label = _clean(item.get("label"), 80)
        prompt = _clean(item.get("prompt") or item.get("direction") or label, 220)
        if not prompt:
            return None
        row = {"label": label or prompt[:40], "prompt": prompt}
        for key in ("family", "palette", "surfaces", "fixtures", "style"):
            value = _clean(item.get(key), 160)
            if value:
                row[key] = value
        return row
    prompt = _clean(item, 220)
    if not prompt:
        return None
    return {"label": prompt[:40], "prompt": prompt}


def _fallback_directions(
    *,
    count: int,
    liked: List[Dict[str, str]],
    seed: str,
    round_n: int,
    budget: int = 0,
    room_key: str = "default",
) -> List[Dict[str, str]]:
    pool = list(BATHROOM_DIRECTIONS if room_key == "bathroom" else FALLBACK_DIRECTIONS)
    if budget and budget < 15_000:
        modest = [
            row
            for row in pool
            if not re.search(
                r"luxur|bespoke|marble palace|calacatta|onyx|gold leaf|spa-resort|evening glow",
                f"{row['label']} {row['prompt']}",
                re.I,
            )
        ]
        if len(modest) >= 4:
            pool = modest
    if round_n > 0 and liked:
        biased: List[Dict[str, str]] = []
        for liked_row in liked:
            biased.append(liked_row)
            prompt = liked_row["prompt"]
            biased.append({"label": f"{liked_row['label']} quieter", "prompt": f"{prompt}, calmer palette, simpler surfaces"})
            if not (budget and budget < 15_000):
                biased.append({"label": f"{liked_row['label']} richer", "prompt": f"{prompt}, richer material contrast"})
        pool = biased + [row for row in pool if row["prompt"].lower() not in {r["prompt"].lower() for r in biased}]
    shuffled = _shuffle(pool, seed)
    out: List[Dict[str, str]] = []
    seen: set[str] = set()
    seen_families: set[str] = set()
    for row in shuffled:
        key = row["prompt"].lower()
        family = str(row.get("family") or "").lower()
        if key in seen:
            continue
        if family and family in seen_families:
            continue
        seen.add(key)
        if family:
            seen_families.add(family)
        out.append(dict(row))
        if len(out) >= count:
            break
    while len(out) < count and pool:
        row = pool[len(out) % len(pool)]
        out.append(dict(row))
    return out[:count]


def _parse_llm_directions(raw: Optional[Dict[str, Any]], count: int) -> List[Dict[str, str]]:
    if not isinstance(raw, dict):
        return []
    rows = raw.get("directions") or raw.get("visualDirections") or []
    if not isinstance(rows, list):
        return []
    out: List[Dict[str, str]] = []
    seen: set[str] = set()
    seen_families: set[str] = set()
    for item in rows:
        row = _direction_row(item)
        if not row:
            continue
        key = row["prompt"].lower()
        family = str(row.get("family") or row.get("palette") or "").lower()
        if key in seen:
            continue
        if family and family in seen_families:
            continue
        seen.add(key)
        if family:
            seen_families.add(family)
        if not row.get("label"):
            row["label"] = f"look {len(out) + 1}"
        out.append(row)
        if len(out) >= count:
            break
    return out


def assign_discovery_model(session_id: str, override: Optional[str] = None) -> str:
    raw = _clean(override, 80).lower()
    if "imagen" in raw:
        return _DISCOVERY_MODELS[1]
    if "schnell" in raw or "flux" in raw:
        return _DISCOVERY_MODELS[0]
    digest = hashlib.sha256(_clean(session_id, 80).encode("utf-8")).digest()
    return _DISCOVERY_MODELS[digest[0] % 2]


def plan_visual_directions(payload: Dict[str, Any], llm_result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    body = payload if isinstance(payload, dict) else {}
    design = body.get("design") if isinstance(body.get("design"), dict) else {}
    count = _as_int(body.get("count") or body.get("numOutputs") or BATCH, BATCH, 4, 12)
    round_n = _as_int(body.get("round") or body.get("inspirationRound") or 0, 0, 0, 8)
    scopes = _focal_scopes(body.get("scopes") or design.get("scopes") or [])
    if not scopes:
        scope = _clean(body.get("scope") or design.get("scope"), 80)
        if scope and not _OTHER.match(scope) and not _FULL.match(scope):
            scopes = [scope]
    liked = _liked_directions(body.get("likedDirections") or body.get("selectedDirections"))
    service = _clean(
        body.get("customerServiceLabel")
        or body.get("serviceLabel")
        or design.get("customerServiceLabel")
        or design.get("serviceLabel")
        or "Project",
        80,
    )
    budget = _as_int(body.get("budget") or design.get("budget") or 0, 0, 0, 10_000_000)
    recipe_key, room = _room_for(body, design)
    session_id = _clean(body.get("sessionId") or design.get("sessionId"), 80)
    model_id = assign_discovery_model(session_id or service, body.get("discoveryModel") or body.get("modelId"))

    parsed = llm_result
    if parsed is None:
        from programs.adventure_pipeline.signatures import VisualDirectionsSignature

        parsed = run_json_signature(
            signature=VisualDirectionsSignature,
            input_field="request_json",
            output_field="directions_json",
            payload={
                "count": count,
                "round": round_n,
                "room": room,
                "service": service,
                "scopes": scopes or ["the selected work"],
                "budget": budget,
                "likedDirections": liked,
                "task": (
                    "narrow around the liked looks, still varied, stay on the same scope"
                    if liked
                    else "explore more varied looks of the same scope; do not repeat earlier palettes, tile types, or fixtures"
                ),
                "budgetNote": (
                    "Modest budget: colorful ceramic and porcelain are great. Do not default to all-white. No exotic marble, onyx, or spa-resort millwork."
                    if budget and budget < 15000
                    else "Stay realistic for this budget. Maximize color, tile, and fixture variety."
                ),
            },
            module_env_prefix="DSPY_ADVENTURE_DIRECTIONS",
            default_temperature=0.85,
            default_max_tokens=900,
            default_timeout=12.0,
        )

    directions = _parse_llm_directions(parsed, count)
    source = "llm" if directions else "fallback"
    if len(directions) < count:
        fill = _fallback_directions(
            count=count,
            liked=liked,
            seed=f"{session_id}|{service}|{round_n}|{','.join(scopes)}",
            round_n=round_n,
            budget=budget,
            room_key=recipe_key,
        )
        seen = {row["prompt"].lower() for row in directions}
        for row in fill:
            if row["prompt"].lower() in seen:
                continue
            directions.append(row)
            seen.add(row["prompt"].lower())
            if len(directions) >= count:
                break

    return {
        "ok": True,
        "room": room,
        "recipeKey": recipe_key,
        "count": len(directions[:count]),
        "round": round_n,
        "scopes": scopes,
        "modelId": model_id,
        "source": source,
        "directions": directions[:count],
    }


__all__ = ["FALLBACK_DIRECTIONS", "assign_discovery_model", "plan_visual_directions"]
