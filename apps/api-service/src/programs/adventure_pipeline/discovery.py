"""
Hard-filtered concept discovery: library photos only, no AI fill.

Filter: in-scope catalog photos, and tagged finish tiers in selected ±1.
Untagged finish is allowed until the catalog is tagged — otherwise a full bath
shows an empty board because almost every photo is still "Vanity" / unlabeled.
"""

from __future__ import annotations

import re
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
    look_fits_selected_scopes,
    look_haystack,
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
            str(item.get("priceTier") or item.get("price_tier") or item.get("estimated_finish_tier") or "")
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
    allowed_tiers = set(adjacent_finish_tiers(finish_tier, list(tiers)))
    full_job = _is_full_job(needles, scopes)
    keep: List[Dict[str, Any]] = []
    for raw in candidates:
        if not isinstance(raw, dict) or not raw.get("url"):
            continue
        item = project_discovery(raw)
        if inspiration_blocked(
            generated_for=str(item.get("generatedFor") or raw.get("generatedFor") or raw.get("generated_for") or ""),
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
        if needles:
            if full_job:
                if not look_fits_selected_scopes(
                    haystack,
                    scopes=list(scopes or []),
                    generated_for=str(item.get("generatedFor") or item.get("generated_for") or ""),
                ):
                    continue
            elif not _part_scope_hit(item, needles, scopes):
                continue
        tier = str(item.get("estimatedFinishTier") or "").strip()
        if tier and allowed_tiers and tier not in allowed_tiers:
            continue
        keep.append(item)
    return keep


def discovery_page(
    design: DesignState,
    *,
    finish_tier: str | None = None,
    offset: int = 0,
    limit: int = 24,
) -> Dict[str, Any]:
    scopes = design.scope_keys or design.scopes
    tiers = finish_tiers_for_scope(
        service_label=design.service_label or design.customer_service_label,
        industry=design.industry,
        service_summary=design.service_summary,
        scopes=scopes,
    )
    selected = normalize_finish_tier(finish_tier) or (tiers[1]["id"] if len(tiers) > 1 else (tiers[0]["id"] if tiers else "mid"))
    raw = fetch_library_candidates(
        service_id=design.service_id,
        instance_id=design.instance_id,
        scope_keys=None,
        limit=200,
        broaden=False,
        allow_any_source=True,
    )
    filtered = hard_filter_discovery(
        raw,
        scopes=scopes,
        finish_tier=selected,
        tiers=tiers,
        industry=str(design.industry or ""),
        service_label=str(design.customer_service_label or design.service_label or ""),
        service_summary=str(design.service_summary or ""),
    )
    start = max(0, int(offset or 0))
    page_size = max(1, min(int(limit or 24), 48))
    page = filtered[start : start + page_size]
    return {
        "ok": True,
        "images": page,
        "finishTiers": tiers,
        "finishTier": selected,
        "allowedTiers": adjacent_finish_tiers(selected, tiers),
        "offset": start,
        "limit": page_size,
        "hasMore": start + len(page) < len(filtered),
        "nextOffset": start + len(page),
        "counts": {"fetched": len(raw), "filtered": len(filtered), "page": len(page)},
        "source": "library",
    }


__all__ = ["discovery_page", "hard_filter_discovery", "project_discovery"]
