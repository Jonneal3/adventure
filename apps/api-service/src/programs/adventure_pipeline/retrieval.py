"""
Library retrieval + ranking for Adventure V7.

Does not fetch Supabase itself — the widget supplies catalog candidates.
This layer decides which stored images are worth showing given the current
design state (service, scope, finish quality, taste).
"""

from __future__ import annotations

import hashlib
import re
from typing import Any, Dict, List, Optional, Sequence, Tuple

from programs.adventure_pipeline.budget_bands import normalize_finish_tier
from programs.adventure_pipeline.catalog_tag import project_manifest_from_catalog_tags
from programs.adventure_pipeline.library import hard_filter_by_scopes, scope_starter_key
from programs.adventure_pipeline.recipes import (
    look_conflicts_with_service,
    look_haystack,
)
from programs.adventure_pipeline.schemas import DesignState


def _hash_seed(value: str) -> int:
    return int(hashlib.sha1(value.encode("utf-8")).hexdigest()[:8], 16)


def _tokens(text: str) -> set[str]:
    return {t for t in re.split(r"[^a-z0-9]+", str(text or "").lower()) if len(t) > 2}


_FINISH_ORDER = ("starter", "value", "mid", "upper", "plus", "premium", "luxury", "estate")
_FULL_SCOPE = re.compile(r"^(full|whole|complete|entire|everything)(-|\b)", re.I)
MIN_LIBRARY_RELEVANCE = 0.68


def _finish_fit(image_tier: str, selected_tier: str) -> float:
    """Soft visual-quality similarity; never converts an image into a price."""
    image = normalize_finish_tier(str(image_tier or ""))
    selected = normalize_finish_tier(str(selected_tier or ""))
    if not image:
        return 0.45
    if not selected:
        return 0.65
    try:
        distance = abs(_FINISH_ORDER.index(image) - _FINISH_ORDER.index(selected))
    except ValueError:
        return 0.45
    return max(0.12, 1.0 - 0.22 * distance)


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
        raw_change_summary = (
            meta.get("changeSummary")
            or meta.get("change_summary")
            or meta.get("whatChanged")
            or meta.get("what_changed")
            or ""
        )
        change_summary = (
            " · ".join(str(value).strip() for value in raw_change_summary if str(value or "").strip())
            if isinstance(raw_change_summary, list)
            else str(raw_change_summary or "").strip()
        )
        raw_included_items = (
            meta.get("includedItems")
            or meta.get("included_items")
            or meta.get("whatWasDone")
            or meta.get("what_was_done")
            or meta.get("workItems")
            or meta.get("work_items")
            or meta.get("components")
            or meta.get("contains")
            or []
        )
        included_items = (
            [str(value).strip() for value in raw_included_items if str(value or "").strip()]
            if isinstance(raw_included_items, list)
            else []
        )
        raw_focus_regions = (
            meta.get("focusRegions")
            or meta.get("focus_regions")
            or meta.get("componentRegions")
            or meta.get("component_regions")
            or {}
        )
        focus_regions = raw_focus_regions if isinstance(raw_focus_regions, dict) else {}
        raw_focus_outlines = (
            meta.get("focusOutlines")
            or meta.get("focus_outlines")
            or meta.get("componentOutlines")
            or meta.get("component_outlines")
            or {}
        )
        focus_outlines = raw_focus_outlines if isinstance(raw_focus_outlines, dict) else {}
        raw_focus_masks = meta.get("focusMasks") or meta.get("focus_masks") or {}
        focus_masks = raw_focus_masks if isinstance(raw_focus_masks, dict) else {}
        project_manifest = (
            meta.get("projectManifest")
            if isinstance(meta.get("projectManifest"), dict)
            else meta.get("project_manifest")
            if isinstance(meta.get("project_manifest"), dict)
            else None
        )
        discovery = meta.get("discovery") if isinstance(meta.get("discovery"), dict) else None
        if project_manifest is None and discovery:
            project_manifest = project_manifest_from_catalog_tags(discovery)
        row = {
            "id": str(meta.get("id") or meta.get("imageId") or f"library-{len(out) + 1}"),
            "url": url,
            "beforeUrl": str(
                meta.get("beforeUrl")
                or meta.get("before_url")
                or meta.get("beforeImageUrl")
                or meta.get("before_image_url")
                or ""
            ).strip() or None,
            "label": label or "From our work",
            "source": "library",
            "finishTier": str(
                meta.get("finishTier")
                or meta.get("finish_tier")
                or meta.get("estimatedFinishTier")
                or meta.get("estimated_finish_tier")
                or meta.get("priceTier")
                or meta.get("price_tier")
                or ""
            ),
            "priceTier": str(meta.get("priceTier") or meta.get("price_tier") or "") or None,
            "description": str(meta.get("description") or meta.get("option_description") or ""),
            "changeSummary": change_summary or None,
            "includedItems": included_items,
            "projectManifest": project_manifest,
            "focusRegions": focus_regions,
            "focusOutlines": focus_outlines,
            "focusMasks": focus_masks,
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
    if any(_FULL_SCOPE.match(needle) for needle in needles):
        if any(_FULL_SCOPE.match(key) for key in keys):
            return 1.0
        # Component-specific finished scenes are still useful for a whole-job
        # request, but remain below an explicitly whole-project image.
        return 0.82 if keys else 0.0
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

    Ranks by service-safe scope similarity, finish-quality closeness, taste,
    and performance. Monetary price is intentionally absent from image search.
    """
    if limit <= 0 or not candidates:
        return []

    scope_keys = list(design.scope_keys or design.scopes or [])
    if design.scope and not scope_keys:
        scope_keys.append(design.scope)

    pool = hard_filter_by_scopes(list(candidates), scope_keys)
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
    selected_finish = normalize_finish_tier(str(design.budget_band_id or "")) or "mid"

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
        hay = _tokens(haystack)
        taste_hit = len(taste_tokens & hay) / max(len(taste_tokens), 1) if taste_tokens else 0.25
        scope_hit = _exact_scope_hit(item, scope_keys)
        finish_hit = _finish_fit(
            str(item.get("finishTier") or item.get("priceTier") or ""),
            selected_finish,
        )
        perf = _performance_score(item)
        featured = item.get("featuredRank")
        feature_boost = 0.04 if featured is not None and float(featured or 0) > 0 else 0.0

        relevance = 0.84 * min(scope_hit, 1.0) + 0.16 * finish_hit
        if scope_keys and relevance < MIN_LIBRARY_RELEVANCE:
            continue

        score = (
            0.12 * taste_hit
            + 0.52 * min(scope_hit, 1.0)
            + 0.28 * finish_hit
            + 0.08 * perf
            + feature_boost
        )
        if scope_hit > 1.0:
            score += 0.08  # scope-starter bonus
        # Tiny stable jitter so ties don't always pick the same first rows.
        score += (_hash_seed(f"{url}:{scope_text}:{selected_finish}") % 100) / 10_000.0
        scored.append((score, i, item))

    scored.sort(key=lambda row: (-row[0], row[1]))
    out: List[Dict[str, Any]] = []
    for score, _i, item in scored[:limit]:
        row = dict(item)
        row["retrievalScore"] = round(float(score), 4)
        scope_hit = _exact_scope_hit(row, scope_keys)
        finish_hit = _finish_fit(
            str(row.get("finishTier") or row.get("priceTier") or ""),
            selected_finish,
        )
        row["relevanceScore"] = round(0.84 * min(scope_hit, 1.0) + 0.16 * finish_hit, 4)
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
        # Prefer stored looks for this scope + finish neighborhood. Generate a minority
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
    "MIN_LIBRARY_RELEVANCE",
    "normalize_library_candidates",
    "rank_library",
    "retrieval_mix",
]
