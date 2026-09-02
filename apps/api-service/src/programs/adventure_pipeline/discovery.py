"""Nearest-match concept discovery over service, scope, and finish quality."""

from __future__ import annotations

import re
import hashlib
from typing import Any, Dict, List, Sequence, Set

from programs.adventure_pipeline.budget_bands import (
    adjacent_finish_tiers,
    finish_tiers_for_scope,
    normalize_finish_tier,
)
from programs.adventure_pipeline.catalog_tag import inspiration_blocked
from programs.adventure_pipeline.library import fetch_library_candidates, scope_starter_key
from programs.adventure_pipeline.recipes import (
    look_conflicts_with_service,
    look_haystack,
    looks_like_material_swatch,
)
from programs.adventure_pipeline.schemas import DesignState

_FULL_SCOPE = re.compile(r"^(full|whole|complete|entire|everything)(-|\b)", re.I)
_GENERIC_PRIMARY = frozenset(
    {
        "from-our-work",
        "look",
        "scope",
        "untitled",
        "image",
        "photo",
        "catalog",
        "gallery",
    }
)

# An image must be genuinely relevant, not merely the least-bad row in a sparse
# catalog. Scope dominates this score; finish similarity can order valid scope
# matches but cannot rescue a generic or wrong-scope scene.
MIN_DISCOVERY_RELEVANCE = 0.68
MAX_DISCOVERY_CANDIDATES = 800
MAX_DISCOVERY_PAGE_SIZE = 120


def _usable_scope_key(text: str) -> str:
    keyed = scope_starter_key(str(text or "").strip())
    if not keyed or keyed in _GENERIC_PRIMARY:
        return ""
    return keyed


def project_discovery(item: Dict[str, Any]) -> Dict[str, Any]:
    """Prefer metadata.discovery; otherwise derive from catalog fields."""
    raw = item.get("discovery") if isinstance(item.get("discovery"), dict) else {}
    primary = _usable_scope_key(str(raw.get("primary_scope") or ""))
    tier = normalize_finish_tier(str(raw.get("estimated_finish_tier") or ""))
    source = "discovery" if primary and tier else "legacy"
    if not primary:
        for key in (
            item.get("scopeKey"),
            item.get("scope"),
            item.get("starter_scope"),
            item.get("label"),
        ):
            keyed = _usable_scope_key(str(key or ""))
            if keyed:
                primary = keyed
                break
        if not primary:
            for tag in item.get("tags") or item.get("scopeKeys") or []:
                text = str(tag or "").strip()
                if text in ("$", "$$", "$$$", "$$$$"):
                    continue
                keyed = _usable_scope_key(text)
                if keyed:
                    primary = keyed
                    break
    if not tier:
        tier = normalize_finish_tier(
            str(
                item.get("finishTier")
                or item.get("finish_tier")
                or item.get("estimated_finish_tier")
                or item.get("priceTier")
                or item.get("price_tier")
                or ""
            )
        )
    out = dict(item)
    out["primaryScope"] = primary or None
    out["estimatedFinishTier"] = tier
    out["discoverySource"] = source if primary and tier else ("legacy" if primary or tier else None)
    if isinstance(raw, dict) and raw:
        out["contains"] = raw.get("contains") if isinstance(raw.get("contains"), list) else []
        out["style"] = raw.get("style") or item.get("style")
        out["mood"] = raw.get("mood")
        out["lighting"] = raw.get("lighting")
        out["colors"] = raw.get("colors") if isinstance(raw.get("colors"), list) else []
        out["materials"] = raw.get("materials") if isinstance(raw.get("materials"), list) else []
        out["tileShape"] = raw.get("tile_shape") or raw.get("tileShape")
        out["tileColor"] = raw.get("tile_color") or raw.get("tileColor")
        out["hardwareFinish"] = raw.get("hardware_finish") or raw.get("hardwareFinish")
        out["vanityStyle"] = raw.get("vanity_style") or raw.get("vanityStyle")
        out["vanityColor"] = raw.get("vanity_color") or raw.get("vanityColor")
        out["role"] = raw.get("role")
        out["inspirational"] = raw.get("inspirational")
        out["searchText"] = raw.get("search_text") or raw.get("searchText")
        if raw.get("description") and not out.get("description"):
            out["description"] = raw.get("description")
        extra_tags = [
            *(out.get("colors") or []),
            *(out.get("materials") or []),
            out.get("mood"),
            out.get("tileShape"),
            out.get("tileColor"),
            out.get("hardwareFinish"),
            out.get("searchText"),
        ]
        merged = list(out.get("tags") or [])
        seen = {str(t).lower() for t in merged}
        for tag in extra_tags:
            value = str(tag or "").strip()
            if not value or value.lower() in seen:
                continue
            seen.add(value.lower())
            merged.append(value)
        out["tags"] = merged
    return out


def _selected_scope_keys(scopes: Sequence[str] | None) -> Set[str]:
    out: Set[str] = set()
    for raw in scopes or []:
        text = str(raw or "").strip()
        if not text or text.lower() == "other" or "multiple / other" in text.lower():
            continue
        out.add(scope_starter_key(text))
    return out


def _scope_hit(primary: str, needles: Set[str]) -> bool:
    if primary in needles:
        return True
    primary_head = primary.split("-", 1)[0]
    for needle in needles:
        if primary in needle or needle in primary:
            return True
        if primary_head and primary_head == needle.split("-", 1)[0]:
            return True
    return False


def _is_full_job(needles: Set[str], scopes: Sequence[str] | None) -> bool:
    if any(_FULL_SCOPE.match(n) for n in needles):
        return True
    return any(_FULL_SCOPE.match(str(raw or "").strip()) for raw in (scopes or []))


def _part_scope_hit(item: Dict[str, Any], needles: Set[str], scopes: Sequence[str] | None) -> bool:
    primary = str(item.get("primaryScope") or "").strip()
    if primary and _scope_hit(primary, needles):
        return True
    hay = look_haystack(item).lower()
    if not hay.strip():
        return False
    for raw in scopes or []:
        label = str(raw or "").strip().lower()
        if not label or label == "other" or "multiple / other" in label or _FULL_SCOPE.match(label):
            continue
        for bit in re.split(r"[/&,]| and ", label):
            token = re.sub(r"[^a-z0-9]+", " ", bit).strip()
            if len(token) >= 3 and re.search(rf"\b{re.escape(token)}\b", hay):
                return True
    for needle in needles:
        if _FULL_SCOPE.match(needle):
            continue
        head = needle.split("-", 1)[0]
        if head and re.search(rf"\b{re.escape(head)}\b", hay):
            return True
    return False


def hard_filter_discovery(
    candidates: Sequence[Dict[str, Any]],
    *,
    scopes: Sequence[str] | None,
    finish_tier: str | None,
    tiers: Sequence[Dict[str, Any]],
    industry: str = "",
    service_label: str = "",
    service_summary: str = "",
) -> List[Dict[str, Any]]:
    needles = _selected_scope_keys(scopes)
    full_job = _is_full_job(needles, scopes)
    tier_ids = [str(t.get("id") or "") for t in tiers if str(t.get("id") or "")]
    selected = normalize_finish_tier(finish_tier) or (tier_ids[0] if tier_ids else "mid")
    scored: List[tuple[float, int, Dict[str, Any]]] = []
    for raw in candidates:
        if not isinstance(raw, dict) or not raw.get("url"):
            continue
        item = project_discovery(raw)
        generated_for = str(
            item.get("generatedFor")
            or raw.get("generatedFor")
            or raw.get("generated_for")
            or ""
        ).strip()
        if generated_for == "refinement_option":
            continue
        if not raw.get("clientQualified") and inspiration_blocked(
            generated_for=generated_for,
            discovery=item.get("discovery") or raw.get("discovery"),
        ):
            continue
        haystack = look_haystack(item)
        if look_conflicts_with_service(
            haystack,
            industry=industry,
            service_label=service_label,
            summary=service_summary,
        ):
            continue
        if looks_like_material_swatch(haystack):
            continue

        primary = str(item.get("primaryScope") or "").strip()
        part_hit = _part_scope_hit(item, needles, scopes) if needles else False
        if not needles:
            scope_score = 0.65
            match = "service"
        elif full_job:
            scope_score = 1.0 if primary and _FULL_SCOPE.match(primary) else 0.82
            match = "exact" if scope_score == 1.0 else "scope"
        elif part_hit:
            scope_score = 1.0
            match = "exact"
        elif not primary:
            scope_score = 0.42
            match = "nearest"
        else:
            scope_score = 0.18
            match = "nearest"

        tier = str(item.get("estimatedFinishTier") or "").strip()
        if not tier:
            finish_score = 0.45
        elif selected in tier_ids and tier in tier_ids:
            finish_score = max(0.12, 1.0 - 0.22 * abs(tier_ids.index(selected) - tier_ids.index(tier)))
        else:
            finish_score = 1.0 if normalize_finish_tier(tier) == selected else 0.45
        relevance = 0.84 * scope_score + 0.16 * finish_score
        item["relevanceScore"] = round(relevance, 4)
        if needles and relevance < MIN_DISCOVERY_RELEVANCE:
            continue

        shown = float(item.get("timesShown") or 0)
        selected_count = float(item.get("timesSelected") or 0)
        saved = float(item.get("timesSaved") or 0)
        conversions = float(item.get("conversions") or 0)
        performance = min(1.0, (selected_count + 1.5 * saved + 3.0 * conversions) / max(shown, 1.0)) if shown else 0.45
        stable = int(hashlib.sha1(str(item.get("url") or "").encode("utf-8")).hexdigest()[:6], 16) % 100
        score = 0.62 * scope_score + 0.30 * finish_score + 0.08 * performance + stable / 100_000.0
        item["retrievalScore"] = round(score, 4)
        item["retrievalMatch"] = (
            "exact"
            if match == "exact" and finish_score >= 0.99
            else ("scope" if scope_score >= 0.8 else "nearest")
        )
        scored.append((score, len(scored), item))
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [item for _score, _i, item in scored]


def broad_discovery_fallback(
    candidates: Sequence[Dict[str, Any]],
    *,
    preferred: Sequence[Dict[str, Any]],
    scopes: Sequence[str] | None,
    finish_tier: str | None,
    tiers: Sequence[Dict[str, Any]],
    industry: str = "",
    service_label: str = "",
    service_summary: str = "",
    service_id: str = "",
) -> List[Dict[str, Any]]:
    """Rank the rest of the durable catalog without making metadata mandatory.

    The first gallery is an inspiration feed, not a quote engine. Exact tagged
    matches stay first, but untagged and adjacent-scope photos remain eligible
    so a sparse metadata neighborhood never turns into an empty, slow screen.
    """
    preferred_urls = {str(item.get("url") or "").strip() for item in preferred}
    needles = _selected_scope_keys(scopes)
    tier_ids = [str(t.get("id") or "") for t in tiers if str(t.get("id") or "")]
    selected = normalize_finish_tier(finish_tier) or (tier_ids[0] if tier_ids else "mid")
    scored: List[tuple[float, int, Dict[str, Any]]] = []
    for raw in candidates:
        if not isinstance(raw, dict):
            continue
        url = str(raw.get("url") or "").strip()
        if not url or url in preferred_urls:
            continue
        item = project_discovery(raw)
        generated_for = str(item.get("generatedFor") or raw.get("generated_for") or "").strip()
        if generated_for == "refinement_option":
            continue
        if not raw.get("clientQualified") and inspiration_blocked(
            generated_for=generated_for,
            discovery=item.get("discovery") or raw.get("discovery"),
        ):
            continue
        haystack = look_haystack(item)
        if looks_like_material_swatch(haystack):
            continue

        primary = str(item.get("primaryScope") or "").strip()
        scope_hit = _part_scope_hit(item, needles, scopes) if needles else False
        scope_score = 1.0 if scope_hit else (0.62 if not needles else 0.30 if primary else 0.22)
        tier = str(item.get("estimatedFinishTier") or "").strip()
        if not tier:
            finish_score = 0.50
        elif selected in tier_ids and tier in tier_ids:
            finish_score = max(0.18, 1.0 - 0.20 * abs(tier_ids.index(selected) - tier_ids.index(tier)))
        else:
            finish_score = 1.0 if normalize_finish_tier(tier) == selected else 0.45
        discovery = item.get("discovery") if isinstance(item.get("discovery"), dict) else {}
        try:
            quality = max(0.0, min(1.0, float(discovery.get("quality_score") or item.get("qualityScore") or 0.58)))
        except (TypeError, ValueError):
            quality = 0.58
        shown = float(item.get("timesShown") or 0)
        selected_count = float(item.get("timesSelected") or 0)
        saved = float(item.get("timesSaved") or 0)
        conversions = float(item.get("conversions") or 0)
        performance = min(1.0, (selected_count + 1.5 * saved + 3.0 * conversions) / max(shown, 1.0)) if shown else 0.45
        conflicts = look_conflicts_with_service(
            haystack,
            industry=industry,
            service_label=service_label,
            summary=service_summary,
        )
        stable = int(hashlib.sha1(url.encode("utf-8")).hexdigest()[:6], 16) % 100
        score = 0.44 * scope_score + 0.24 * finish_score + 0.20 * quality + 0.10 * performance + stable / 10_000.0
        if service_id and str(item.get("subcategoryId") or "").strip() == service_id:
            score += 0.45
        if conflicts:
            score -= 0.35
        item["relevanceScore"] = round(max(0.05, min(MIN_DISCOVERY_RELEVANCE - 0.01, score)), 4)
        item["retrievalScore"] = round(score, 4)
        item["retrievalMatch"] = "broad"
        scored.append((score, len(scored), item))
    scored.sort(key=lambda row: (-row[0], row[1]))
    return [item for _score, _i, item in scored]


def discovery_page(
    design: DesignState,
    *,
    finish_tier: str | None = None,
    offset: int = 0,
    limit: int = 24,
    candidates: Sequence[Dict[str, Any]] | None = None,
    unfiltered: bool = False,
) -> Dict[str, Any]:
    scopes = design.scope_keys or design.scopes
    tiers = finish_tiers_for_scope(
        service_label=design.service_label or design.customer_service_label,
        industry=design.industry,
        service_summary=design.service_summary,
        scopes=scopes,
    )
    selected = normalize_finish_tier(finish_tier) or (tiers[1]["id"] if len(tiers) > 1 else (tiers[0]["id"] if tiers else "mid"))
    fetch_limit = min(MAX_DISCOVERY_CANDIDATES, max(120, max(1, int(limit or 24))))
    raw = [row for row in (candidates or []) if isinstance(row, dict)][:fetch_limit]
    if not raw:
        raw = fetch_library_candidates(
            service_id=design.service_id,
            instance_id=design.instance_id,
            scope_keys=None,
            limit=fetch_limit,
            broaden=False,
            allow_any_source=True,
        )
    if unfiltered:
        # This path feeds a catalog, not a search result. Keep only non-gallery
        # assets out; do not rank or filter by scope, budget, or finish tier.
        broad = []
        for candidate in raw:
            item = project_discovery(candidate)
            generated_for = str(item.get("generatedFor") or candidate.get("generated_for") or "").strip()
            if generated_for == "refinement_option":
                continue
            if not candidate.get("clientQualified") and inspiration_blocked(
                generated_for=generated_for,
                discovery=item.get("discovery") or candidate.get("discovery"),
            ):
                continue
            if looks_like_material_swatch(look_haystack(item)):
                continue
            item["retrievalMatch"] = "broad"
            broad.append(item)
        matched = []
    else:
        matched = hard_filter_discovery(
            raw,
            scopes=scopes,
            finish_tier=selected,
            tiers=tiers,
            industry=str(design.industry or ""),
            service_label=str(design.customer_service_label or design.service_label or ""),
            service_summary=str(design.service_summary or ""),
        )
        broad = broad_discovery_fallback(
            raw,
            preferred=matched,
            scopes=scopes,
            finish_tier=selected,
            tiers=tiers,
            industry=str(design.industry or ""),
            service_label=str(design.customer_service_label or design.service_label or ""),
            service_summary=str(design.service_summary or ""),
            service_id=str(design.service_id or ""),
        )
    feed = [*matched, *broad]
    start = max(0, int(offset or 0))
    page_size = max(1, min(int(limit or 24), MAX_DISCOVERY_PAGE_SIZE))
    page = feed[start : start + page_size]
    return {
        "ok": True,
        "images": page,
        "finishTiers": tiers,
        "finishTier": selected,
        "finishNeighborhood": adjacent_finish_tiers(selected, tiers),
        "offset": start,
        "limit": page_size,
        "hasMore": start + len(page) < len(feed),
        "nextOffset": start + len(page),
        "counts": {
            "fetched": len(raw),
            "matched": len(matched),
            "broad": len(broad),
            "available": len(feed),
            "page": len(page),
        },
        "source": "library-unfiltered" if unfiltered else "library",
    }


__all__ = [
    "MIN_DISCOVERY_RELEVANCE",
    "broad_discovery_fallback",
    "discovery_page",
    "hard_filter_discovery",
    "project_discovery",
]
