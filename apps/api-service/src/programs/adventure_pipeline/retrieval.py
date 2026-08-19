"""
Library retrieval + ranking for Adventure V7.

Does not fetch Supabase itself — the widget supplies catalog candidates.
This layer decides which stored images are worth showing given the current
design state (service, scope, budget, taste).
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from programs.adventure_pipeline.library import hard_filter_by_scopes, scope_starter_key
from programs.adventure_pipeline.recipes import (
    look_conflicts_with_service,
    look_fits_selected_scopes,
    look_haystack,
)
from programs.adventure_pipeline.schemas import DesignState


def _hash_seed(value: str) -> int:
    return int(hashlib.sha1(value.encode("utf-8")).hexdigest()[:8], 16)


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", str(text or "").lower()) if len(t) > 2}


# Map price_tier labels used in the catalog onto approximate spend bands.
_TIER_BANDS: Dict[str, Tuple[float, float]] = {
    "$": (0, 15_000),
    "$$": (10_000, 40_000),
    "$$$": (30_000, 90_000),
    "$$$$": (70_000, 500_000),
}


def _tier_fit(price_tier: str, budget: float) -> float:
    """1.0 = perfect band match, 0.0 = far outside."""
    tier = str(price_tier or "").strip()
    if not tier or budget <= 0:
        return 0.4
    band = _TIER_BANDS.get(tier)
    if not band:
        # Accept "mid", "premium", etc. loosely.
        lower = tier.lower()
        if any(k in lower for k in ("budget", "value", "starter", "economy")):
            band = _TIER_BANDS["$"]
        elif any(k in lower for k in ("mid", "standard")):
            band = _TIER_BANDS["$$"]
        elif any(k in lower for k in ("premium", "high")):
            band = _TIER_BANDS["$$$"]
        elif any(k in lower for k in ("lux", "bespoke", "custom")):
            band = _TIER_BANDS["$$$$"]
        else:
            return 0.4
    lo, hi = band
    if lo <= budget <= hi:
        return 1.0
    # Soft falloff outside the band.
    if budget < lo:
        gap = (lo - budget) / max(lo, 1)
    else:
        gap = (budget - hi) / max(hi, 1)
    return max(0.0, 1.0 - min(gap, 1.0))


def _customer_tier_rank(budget: float) -> int:
    if budget < 15_000:
        return 1
    if budget < 40_000:
        return 2
    if budget < 90_000:
        return 3
    return 4


def _image_tier_rank(price_tier: str) -> int:
    tier = str(price_tier or "").strip()
    dollars = len(re.sub(r"[^$]", "", tier))
    if dollars:
        return dollars
    lower = tier.lower()
    if any(k in lower for k in ("budget", "value", "starter", "economy")):
        return 1
    if any(k in lower for k in ("mid", "standard")):
        return 2
    if any(k in lower for k in ("premium", "high")):
        return 3
    if any(k in lower for k in ("lux", "bespoke", "custom")):
        return 4
    return 2


_BUDGET_WINDOW = 0.05


def within_budget_window(item: Dict[str, Any], budget: float) -> bool:
    if budget <= 0:
        return True
    stored = item.get("budget")
    try:
        mid = float(stored or 0)
    except (TypeError, ValueError):
        mid = 0.0
    if mid > 0:
        return abs(mid - budget) / max(budget, 1) <= _BUDGET_WINDOW
    tier = str(item.get("priceTier") or item.get("price_tier") or "").strip()
    if not tier:
        return True
    return _image_tier_rank(tier) <= _customer_tier_rank(budget)


def _hard_filter_by_budget(
    candidates: Sequence[Dict[str, Any]],
    *,
    budget: float,
    min_keep: int = 12,
) -> List[Dict[str, Any]]:
    """Keep looks inside the customer's budget band (±5% when a numeric budget is stored)."""
    items = [c for c in candidates if isinstance(c, dict)]
    if budget <= 0 or not items:
        return list(items)
    keep = [c for c in items if within_budget_window(c, budget)]
    if keep:
        return keep
    unlabeled = [c for c in items if not str(c.get("priceTier") or "").strip() and not c.get("budget")]
    return unlabeled[:max(min_keep, 0)]


def _performance_score(item: Dict[str, Any]) -> float:
    """Optional counters from the curation loop. Missing → neutral."""
    shown = float(item.get("timesShown") or item.get("times_shown") or 0)
    selected = float(item.get("timesSelected") or item.get("times_selected") or 0)
    saved = float(item.get("timesSaved") or item.get("times_saved") or 0)
    converted = float(item.get("conversions") or item.get("quoteRequests") or 0)
    quality = float(item.get("qualityScore") or item.get("quality_score") or 0.5)
    if shown <= 0:
        # Unproven library stock still deserves a chance (explore).
        return 0.45 + 0.2 * max(0.0, min(1.0, quality))
    rate = (selected + 1.5 * saved + 3.0 * converted) / max(shown, 1.0)
    return max(0.0, min(1.0, 0.3 * quality + 0.7 * min(rate, 1.0)))


def _performance_cue(item: Dict[str, Any]) -> str:
    shown = float(item.get("timesShown") or item.get("times_shown") or 0)
    selected = float(item.get("timesSelected") or item.get("times_selected") or 0)
    saved = float(item.get("timesSaved") or item.get("times_saved") or 0)
    conversions = float(item.get("conversions") or item.get("quoteRequests") or 0)
    if conversions >= 1:
        return "Top rated in the area"
    if saved >= 2:
        return "Frequently used"
    if selected >= 2 and shown > 0 and selected / max(shown, 1) >= 0.12:
        return "Popular nearby"
    return ""


def normalize_library_candidates(raw: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw if isinstance(raw, list) else []:
        if isinstance(item, str):
            url, label = item.strip(), ""
            meta: Dict[str, Any] = {}
        elif isinstance(item, dict):
            url = str(item.get("url") or item.get("src") or item.get("imageUrl") or "").strip()
            label = str(item.get("label") or item.get("title") or item.get("option_label") or "").strip()
            meta = item
        else:
            continue
        if not url or url in seen:
            continue
        if not (url.startswith("http://") or url.startswith("https://")):
            continue
        seen.add(url)
        scope = str(meta.get("scope") or "").strip()
        scope_key = str(meta.get("scopeKey") or meta.get("scope_key") or "").strip()
        if not scope_key and scope:
            scope_key = scope_starter_key(scope)
        generated_for = str(meta.get("generatedFor") or meta.get("generated_for") or "").strip()
        row = {
            "id": str(meta.get("id") or meta.get("imageId") or f"library-{len(out) + 1}"),
            "url": url,
            "label": label or "From our work",
            "source": "library",
            "priceTier": str(meta.get("priceTier") or meta.get("price_tier") or ""),
            "description": str(meta.get("description") or meta.get("option_description") or ""),
            "tags": meta.get("tags") if isinstance(meta.get("tags"), list) else [],
            "scope": scope or None,
            "scopeKey": scope_key or None,
            "generatedFor": generated_for or None,
            "timesShown": meta.get("timesShown") or meta.get("times_shown") or 0,
            "timesSelected": meta.get("timesSelected") or meta.get("times_selected") or 0,
            "timesSaved": meta.get("timesSaved") or meta.get("times_saved") or 0,
            "conversions": meta.get("conversions") or 0,
            "qualityScore": meta.get("qualityScore") or meta.get("quality_score") or 0.5,
            "featuredRank": meta.get("featuredRank") or meta.get("featured_rank"),
        }
        perf_cue = str(meta.get("performanceCue") or meta.get("cue") or "").strip() or _performance_cue(row)
        row["performanceCue"] = perf_cue or None
        row["cue"] = perf_cue or None
        row["palette"] = str(meta.get("palette") or "").strip() or None
        row["surfaces"] = str(meta.get("surfaces") or "").strip() or None
        row["fixtures"] = str(meta.get("fixtures") or "").strip() or None
        row["style"] = str(meta.get("style") or "").strip() or None
        row["paletteFamily"] = str(meta.get("paletteFamily") or meta.get("palette_family") or "").strip() or None
        row["visualPrompt"] = str(meta.get("visualPrompt") or meta.get("visual_prompt") or meta.get("visual_direction") or "").strip() or None
        row["visual_direction"] = row["visualPrompt"]
        out.append(row)
    return out


def _exact_scope_hit(item: Dict[str, Any], scope_keys: Sequence[str]) -> float:
    needles = {scope_starter_key(s) for s in scope_keys if str(s or "").strip()}
    needles = {n for n in needles if n and n != "other"}
    if not needles:
        return 0.25
    keys = set()
    sk = str(item.get("scopeKey") or "").strip()
    if sk:
        keys.add(scope_starter_key(sk))
    scope = str(item.get("scope") or item.get("description") or "").strip()
    if scope:
        keys.add(scope_starter_key(scope))
    for tag in item.get("tags") or []:
        t = str(tag or "").strip()
        if t:
            keys.add(scope_starter_key(t))
    hits = len(keys & needles)
    if not hits:
        return 0.0
    coverage = hits / max(len(needles), 1)
    boost = 1.0
    if str(item.get("generatedFor") or "") in (
        "v2_scope_starter",
        "v2_neutral_scope_starter",
    ):
        boost = 1.15
    return coverage * boost


def rank_library(
    design: DesignState,
    candidates: Sequence[Dict[str, Any]],
    *,
    limit: int,
    exclude_urls: Optional[Sequence[str]] = None,
) -> List[Dict[str, Any]]:
    """
    Rank stored images for this project state.

    Hard-filters by selected scopes first (broadens only if thin), then scores
    taste + exact scope + budget + performance.
    """
    if limit <= 0 or not candidates:
        return []

    scope_keys = list(design.scope_keys or design.scopes or [])
    if design.scope and design.scope not in scope_keys:
        scope_keys.append(design.scope)

    pool = hard_filter_by_scopes(list(candidates), scope_keys)
    pool = _hard_filter_by_budget(pool, budget=float(design.budget or 0))
    excluded = {str(u).strip() for u in (exclude_urls or []) if str(u).strip()}
    confirmed = set(design.taste.confirmed_ids or [])
    taste_labels = [
        t.label for t in design.taste.tags if (not confirmed) or t.id in confirmed
    ]
    taste_tokens = _tokens(" ".join(taste_labels))
    scope_text = " ".join(
        [
            design.scope or "",
            " ".join(design.scopes or []),
            " ".join(design.scope_keys or []),
            design.service_label or "",
            design.customer_service_label or "",
        ]
    )
    budget = float(design.budget or 0)

    scored: List[Tuple[float, int, Dict[str, Any]]] = []
    for i, item in enumerate(pool):
        url = str(item.get("url") or "")
        if url in excluded:
            continue
        haystack = look_haystack(item)
        if look_conflicts_with_service(
            haystack,
            industry=str(design.industry or ""),
            service_label=str(design.customer_service_label or design.service_label or ""),
            summary=str(design.service_summary or ""),
        ):
            continue
        if not look_fits_selected_scopes(
            haystack,
            scopes=scope_keys,
            generated_for=str(item.get("generatedFor") or item.get("generated_for") or ""),
        ):
            continue
        if not within_budget_window(item, budget):
            continue
        hay = _tokens(haystack)
        taste_hit = len(taste_tokens & hay) / max(len(taste_tokens), 1) if taste_tokens else 0.25
        scope_hit = _exact_scope_hit(item, scope_keys)
        budget_hit = _tier_fit(str(item.get("priceTier") or ""), budget)
        perf = _performance_score(item)
        featured = item.get("featuredRank")
        feature_boost = 0.15 if featured is not None and float(featured or 0) > 0 else 0.0

        score = (
            0.15 * taste_hit
            + 0.42 * min(scope_hit, 1.0)
            + 0.28 * budget_hit
            + 0.15 * perf
            + feature_boost
        )
        if scope_hit > 1.0:
            score += 0.08  # scope-starter bonus
        # Tiny stable jitter so ties don't always pick the same first rows.
        score += (_hash_seed(f"{url}:{scope_text}:{int(budget)}") % 100) / 10_000.0
        scored.append((score, i, item))

    scored.sort(key=lambda row: (-row[0], row[1]))
    out: List[Dict[str, Any]] = []
    for score, _i, item in scored[:limit]:
        row = dict(item)
        row["retrievalScore"] = round(float(score), 4)
        row["source"] = "library"
        # Prefer real metadata cues over empty.
        if not row.get("cue") and row.get("performanceCue"):
            row["cue"] = row["performanceCue"]
        out.append(row)
    return out


def retrieval_mix(
    *,
    mode: str,
    requested: int,
    library_available: int,
) -> Dict[str, int]:
    """
    How many tiles should come from the library vs generation for this mode.

    Inspiration: lean retrieve (up to 2/3 library).
    Ideas: still hybrid but keep ≥ half generated so taste still shapes the set.
    Refine: never retrieve a replacement grid — edit/gen only (handled elsewhere).
    """
    requested = max(0, int(requested))
    available = max(0, int(library_available))
    if requested == 0:
        return {"library": 0, "generate": 0}

    key = str(mode or "").strip().lower()
    if key == "inspiration":
        # Prefer stored looks for this scope + price. Generate a minority
        # slice to grow the catalog — skip generation when the well is deep.
        if available >= requested * 2:
            return {"library": requested, "generate": 0}
        if requested == 1:
            lib = min(available, 1)
        else:
            lib = min(available, max(0, (requested * 2) // 3))
            if available > 0 and lib == 0:
                lib = 1
        return {"library": lib, "generate": requested - lib}

    if key in ("ideas", "explore"):
        # Keep majority generated so confirmed taste drives the exploration grid,
        # but surface proven library winners when we have them.
        lib = min(available, max(0, requested // 3))
        return {"library": lib, "generate": requested - lib}

    return {"library": 0, "generate": requested}


__all__ = [
    "normalize_library_candidates",
    "rank_library",
    "retrieval_mix",
    "within_budget_window",
]
