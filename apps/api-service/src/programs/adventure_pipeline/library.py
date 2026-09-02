"""
Server-side image library fetch for Adventure V7.

Ranks happen in retrieval.py; this module loads catalog candidates from Supabase
when the widget does not supply libraryImages.
"""

from __future__ import annotations

import json
import os
import re
import ssl
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Sequence, Set

import certifi

from programs.adventure_pipeline.catalog_tag import inspiration_blocked, project_manifest_from_catalog_tags
from programs.adventure_pipeline.recipes import look_haystack, looks_like_material_swatch
from programs.gallery_enrichment.pricing import localize_pricing_result


_CATALOG_GENERATED_FOR = (
    "style_seed",
    "subcategory_catalog",
    "adventure_v7",
    "adventure_v8",
    "v2_scope_starter",
    "v2_neutral_scope_starter",
    "v2_service_starter",
    "refinement_option",
)

_SCOPE_STARTER_FOR = frozenset(
    {
        "v2_scope_starter",
        "v2_neutral_scope_starter",
    }
)

# Broaden only when hard-filtered set is thinner than this.
_MIN_FILTERED = 12
_IMAGE_QUERY_PAGE_SIZE = 200
_MAX_LIBRARY_ROWS = 800
_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
_TRANSIENT_IMAGE_HOSTS = frozenset({"replicate.delivery"})


def _supabase_config() -> Optional[tuple[str, str]]:
    url = (
        os.getenv("SUPABASE_URL")
        or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
        or ""
    ).strip().rstrip("/")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()
    if not url or not key:
        return None
    return url, key


def _rest_get(path_qs: str) -> List[Dict[str, Any]]:
    cfg = _supabase_config()
    if not cfg:
        return []
    base, key = cfg
    url = f"{base}/rest/v1/{path_qs}"
    req = urllib.request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Accept": "application/json",
        },
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=12, context=_SSL_CONTEXT) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data if isinstance(data, list) else []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return []


def _instance_pricing_location(instance_id: str) -> tuple[str, str]:
    iid = str(instance_id or "").strip()
    if not iid:
        return "", ""
    select = urllib.parse.quote("*", safe="*")
    rows = _rest_get(f"instances?select={select}&id=eq.{urllib.parse.quote(iid)}&limit=1")
    row = rows[0] if rows and isinstance(rows[0], dict) else {}
    metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    city = row.get("location_city") or row.get("business_city") or row.get("city") or metadata.get("city") or ""
    state = row.get("location_state") or row.get("business_state") or row.get("state") or metadata.get("state") or ""
    return str(city or "").strip(), str(state or "").strip()


def scope_starter_key(label: str) -> str:
    """Match widget `v2ScopeStarterKey` for exact scope matching."""
    s = unicodedata.normalize("NFKD", str(label or ""))
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.strip().lower().replace("&", " and ")
    s = re.sub(r"[^a-z0-9]+", "-", s).strip("-")[:100]
    return s or "scope"


def _normalize_scope_needles(scope_keys: Sequence[str] | None) -> Set[str]:
    out: Set[str] = set()
    for raw in scope_keys or []:
        text = str(raw or "").strip()
        if not text:
            continue
        lower = text.lower()
        if lower == "other" or "multiple / other" in lower:
            continue
        out.add(scope_starter_key(text))
        # Also accept already-keyed values as-is.
        if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", lower):
            out.add(lower)
    return out


def _label_from_meta(meta: Dict[str, Any]) -> str:
    for key in (
        "option_label",
        "starter_variant_label",
        "refinement_variation_label",
        "starter_scope",
        "refinement_category_label",
        "service_name",
        "option_value",
    ):
        val = str(meta.get(key) or "").strip()
        if val:
            return val
    return ""


def _performance_cue(stats: Dict[str, Any]) -> str:
    shown = float(stats.get("shown") or 0)
    selected = float(stats.get("selected") or 0)
    saved = float(stats.get("saved") or 0)
    shared = float(stats.get("shared") or stats.get("shares") or 0)
    conversions = float(stats.get("conversions") or 0)
    local_selected = float(stats.get("local_selected") or 0)
    local_saved = float(stats.get("local_saved") or 0)
    local_shared = float(stats.get("local_shared") or 0)
    local_conversions = float(stats.get("local_conversions") or 0)
    local_heat = local_selected + 2 * local_saved + 2 * local_shared + 3 * local_conversions
    if local_heat >= 3:
        return "🔥🔥🔥 Hot in your area"
    if conversions >= 1:
        return "Local favorite"
    if shared >= 2:
        return "Frequently shared"
    if saved >= 2:
        return "Often saved"
    if selected >= 2 and shown > 0 and selected / max(shown, 1) >= 0.12:
        return "Popular pick"
    return ""


def _is_stable_scope_catalog_image(
    *,
    generated_for: str,
    metadata: Dict[str, Any],
    image_url: str,
) -> bool:
    """Admit the styled, durable scope catalog without reopening starter junk.

    The curated scope set was generated as ``v2_scope_starter`` and copied to
    Supabase storage, but predates the discovery tag pass.  Temporary provider
    URLs and neutral/service starter canvases remain blocked.
    """
    if generated_for != "v2_scope_starter":
        return False
    parsed = urllib.parse.urlparse(image_url)
    host = (parsed.hostname or "").lower()
    if not host.endswith(".supabase.co") or "/storage/v1/object/" not in parsed.path:
        return False
    scope = str(metadata.get("starter_scope") or "").strip()
    style_label = str(
        metadata.get("starter_variant_label")
        or metadata.get("option_label")
        or ""
    ).strip()
    return bool(scope and style_label)


def _is_transient_provider_url(image_url: str) -> bool:
    """Provider delivery URLs are not durable reusable-catalog assets."""
    host = (urllib.parse.urlparse(image_url).hostname or "").lower()
    return host in _TRANSIENT_IMAGE_HOSTS or any(
        host.endswith(f".{blocked}") for blocked in _TRANSIENT_IMAGE_HOSTS
    )


def _row_to_candidate(
    row: Dict[str, Any],
    *,
    allow_any_source: bool = False,
    instance_id: str = "",
    require_publish_ready: bool = False,
    pricing_city: str = "",
    pricing_state: str = "",
) -> Optional[Dict[str, Any]]:
    meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    enrichment = meta.get("gallery_enrichment") if isinstance(meta.get("gallery_enrichment"), dict) else {}
    publish = enrichment.get("publish") if isinstance(enrichment.get("publish"), dict) else {}
    # The gallery enrichment contract is fail-closed: legacy/unprocessed,
    # pending, rejected, and synthetic-before rows never reach visitors.
    if require_publish_ready and (enrichment.get("version") != 1 or publish.get("status") != "ready"):
        return None
    generated_for = str(meta.get("generated_for") or "").strip()
    if generated_for and not allow_any_source and generated_for not in _CATALOG_GENERATED_FOR:
        return None
    url = str(row.get("image_url") or "").strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        return None
    if _is_transient_provider_url(url):
        return None
    discovery = meta.get("discovery") if isinstance(meta.get("discovery"), dict) else None
    stable_scope_catalog = _is_stable_scope_catalog_image(
        generated_for=generated_for,
        metadata=meta,
        image_url=url,
    )
    if inspiration_blocked(generated_for=generated_for, discovery=discovery) and not stable_scope_catalog:
        return None
    label = _label_from_meta(meta) or "From our work"
    scope_tag = str(meta.get("starter_scope") or meta.get("refinement_category_label") or "").strip()
    scope_key = str(meta.get("starter_scope_key") or "").strip() or (
        scope_starter_key(scope_tag) if scope_tag else ""
    )
    discovery_tier = discovery.get("estimated_finish_tier") if isinstance(discovery, dict) else ""
    enrichment_pricing_raw = enrichment.get("pricing") if isinstance(enrichment.get("pricing"), dict) else {}
    enrichment_pricing = (
        localize_pricing_result(enrichment_pricing_raw, city=pricing_city, state=pricing_state)
        if enrichment_pricing_raw.get("status") == "complete"
        else enrichment_pricing_raw
    )
    localized_range = enrichment_pricing.get("localizedRange") if isinstance(enrichment_pricing.get("localizedRange"), dict) else None
    base_range = enrichment_pricing.get("baseRange") if isinstance(enrichment_pricing.get("baseRange"), dict) else None
    canonical_range = localized_range or base_range
    price_range = (
        {
            "min": canonical_range.get("low"),
            "likely": canonical_range.get("likely"),
            "max": canonical_range.get("high"),
            "low": canonical_range.get("low"),
            "high": canonical_range.get("high"),
            "currency": canonical_range.get("currency") or "USD",
            "source": "gallery_manifest_v1",
        }
        if isinstance(canonical_range, dict)
        else meta.get("price_range") if isinstance(meta.get("price_range"), dict) else None
    )
    discovery_materials = discovery.get("materials") if isinstance(discovery, dict) and isinstance(discovery.get("materials"), list) else []
    materials = meta.get("materials") if isinstance(meta.get("materials"), list) else discovery_materials
    finish_tier = str(
        meta.get("finish_tier")
        or meta.get("estimated_finish_tier")
        or discovery_tier
        or meta.get("price_tier")  # legacy migration fallback
        or ""
    ).strip()
    raw_tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []
    scope_keys = meta.get("scope_keys") if isinstance(meta.get("scope_keys"), list) else []
    tags: List[str] = []
    seen_tags: Set[str] = set()
    for item in (
        [scope_tag, scope_key, finish_tier, str(meta.get("palette_family") or ""), str(meta.get("style") or "")]
        + [str(t) for t in scope_keys]
        + [str(t) for t in raw_tags]
    ):
        value = str(item or "").strip()
        if not value:
            continue
        key = value.lower()
        if key in seen_tags:
            continue
        seen_tags.add(key)
        tags.append(value)
    stats = meta.get("adventure_stats") if isinstance(meta.get("adventure_stats"), dict) else {}
    usage = meta.get("adventure_usage") if isinstance(meta.get("adventure_usage"), dict) else {}
    by_instance = usage.get("by_instance") if isinstance(usage.get("by_instance"), dict) else {}
    requested_instance = str(instance_id or "").strip()
    local_stats = by_instance.get(requested_instance) if isinstance(by_instance.get(requested_instance), dict) else {}
    source_instance = str(row.get("instance_id") or meta.get("origin_instance_id") or "").strip()
    is_local = bool(requested_instance and (source_instance == requested_instance or local_stats))
    combined_stats = {
        **stats,
        "local_selected": local_stats.get("selected") or 0,
        "local_saved": local_stats.get("saved") or 0,
        "local_shared": local_stats.get("shared") or 0,
        "local_conversions": local_stats.get("conversions") or 0,
    }
    cue = _performance_cue(combined_stats)
    badge = str(meta.get("gallery_badge") or cue or "Project example").strip()
    enrichment_before = enrichment.get("before") if isinstance(enrichment.get("before"), dict) else {}
    before_url = str(
        enrichment_before.get("url")
        or meta.get("before_image_url")
        or meta.get("before_url")
        or meta.get("beforeImageUrl")
        or meta.get("beforeUrl")
        or ""
    ).strip()
    raw_change_summary = (
        meta.get("what_changed")
        or meta.get("change_summary")
        or meta.get("whatChanged")
        or meta.get("changeSummary")
        or ""
    )
    change_summary = (
        " · ".join(str(item).strip() for item in raw_change_summary if str(item or "").strip())
        if isinstance(raw_change_summary, list)
        else str(raw_change_summary or "").strip()
    )
    raw_included_items = (
        meta.get("included_items")
        or meta.get("what_was_done")
        or meta.get("work_items")
        or meta.get("components")
        or meta.get("contains")
        or []
    )
    included_items = (
        [str(item).strip() for item in raw_included_items if str(item or "").strip()]
        if isinstance(raw_included_items, list)
        else []
    )
    raw_focus_regions = (
        meta.get("focus_regions")
        or meta.get("component_regions")
        or meta.get("focusRegions")
        or meta.get("componentRegions")
        or {}
    )
    focus_regions = raw_focus_regions if isinstance(raw_focus_regions, dict) else {}
    raw_focus_outlines = (
        meta.get("focus_outlines")
        or meta.get("component_outlines")
        or meta.get("focusOutlines")
        or meta.get("componentOutlines")
        or {}
    )
    focus_outlines = raw_focus_outlines if isinstance(raw_focus_outlines, dict) else {}
    raw_focus_masks = meta.get("focus_masks") or meta.get("focusMasks") or {}
    focus_masks = raw_focus_masks if isinstance(raw_focus_masks, dict) else {}
    project_manifest = meta.get("project_manifest") if isinstance(meta.get("project_manifest"), dict) else None
    if project_manifest is None and discovery:
        project_manifest = project_manifest_from_catalog_tags(discovery)
    account_id = str(row.get("account_id") or "").strip()
    catalog_source = "instance" if is_local else ("business" if account_id else "platform")
    priceable_manifest = enrichment.get("priceableManifest") if isinstance(enrichment.get("priceableManifest"), dict) else None
    verification = enrichment.get("verification") if isinstance(enrichment.get("verification"), dict) else {}
    pricing_breakdown = enrichment_pricing.get("breakdown") if isinstance(enrichment_pricing.get("breakdown"), list) else []
    pricing_assumptions = enrichment_pricing.get("assumptions") if isinstance(enrichment_pricing.get("assumptions"), list) else []
    return {
        "id": str(row.get("id") or ""),
        "imageId": str(row.get("id") or ""),
        "subcategoryId": str(row.get("subcategory_id") or "").strip() or None,
        "url": url,
        "beforeUrl": before_url if before_url.startswith(("http://", "https://")) else None,
        "label": label,
        "changeSummary": change_summary or None,
        "includedItems": included_items,
        "projectManifest": project_manifest,
        "priceableManifest": priceable_manifest,
        "verificationConfidence": verification.get("confidence"),
        "pricingConfidence": enrichment_pricing.get("confidence"),
        "pricingLabel": {
            "high": "Typical estimated range",
            "medium": "Estimated project range",
            "broad": "Broad illustrative estimate",
        }.get(str(enrichment_pricing.get("confidence") or ""), "Broad illustrative estimate"),
        "pricingBreakdown": pricing_breakdown,
        "pricingAssumptions": pricing_assumptions,
        "beforeDisclosure": enrichment_before.get("disclosure"),
        "focusRegions": focus_regions,
        "focusOutlines": focus_outlines,
        "focusMasks": focus_masks,
        "description": scope_tag or str(meta.get("option_description") or ""),
        "finishTier": finish_tier,
        "priceTier": str(meta.get("price_tier") or "").strip() or None,
        "priceRange": price_range,
        "priceRelationship": str(meta.get("price_relationship") or finish_tier).strip() or None,
        "tags": tags,
        "materials": [str(item).strip() for item in materials if str(item or "").strip()],
        "scopeKey": scope_key or None,
        "scope": scope_tag or None,
        "generatedFor": generated_for or None,
        "clientQualified": stable_scope_catalog,
        "curationSource": "stable_scope_catalog" if stable_scope_catalog else None,
        "timesShown": stats.get("shown") or 0,
        "timesSelected": stats.get("selected") or 0,
        "timesSaved": stats.get("saved") or 0,
        "timesShared": stats.get("shared") or stats.get("shares") or 0,
        "conversions": stats.get("conversions") or 0,
        "businessUsageCount": usage.get("instance_count") or stats.get("business_usage") or 0,
        "localShown": local_stats.get("shown") or 0,
        "localSelections": local_stats.get("selected") or 0,
        "localSaves": local_stats.get("saved") or 0,
        "localShares": local_stats.get("shared") or 0,
        "localConversions": local_stats.get("conversions") or 0,
        "local": is_local,
        "catalogSource": catalog_source,
        "originInstanceId": source_instance or None,
        "worthKeeping": bool(meta.get("worth_keeping")),
        "reusableStatus": str(meta.get("reusable_status") or "").strip() or None,
        "featuredRank": meta.get("featured_rank"),
        "performanceCue": cue or None,
        "cue": cue or None,
        "badge": badge,
        "source": "library",
        "palette": str(meta.get("palette") or "").strip() or None,
        "surfaces": str(meta.get("surfaces") or "").strip() or None,
        "fixtures": str(meta.get("fixtures") or "").strip() or None,
        "style": str(meta.get("style") or "").strip() or None,
        "paletteFamily": str(meta.get("palette_family") or "").strip() or None,
        "visualPrompt": str(meta.get("visual_prompt") or meta.get("visual_direction") or "").strip() or None,
        "visual_direction": str(meta.get("visual_direction") or meta.get("visual_prompt") or "").strip() or None,
        "scopeKeys": [str(t).strip() for t in scope_keys if str(t or "").strip()],
        "discovery": meta.get("discovery") if isinstance(meta.get("discovery"), dict) else None,
    }


def _matches_scopes(item: Dict[str, Any], needles: Set[str]) -> bool:
    if not needles:
        return True
    keys: Set[str] = set()
    sk = str(item.get("scopeKey") or "").strip()
    if sk:
        keys.add(scope_starter_key(sk))
        keys.add(sk.lower())
    scope = str(item.get("scope") or item.get("description") or "").strip()
    if scope:
        keys.add(scope_starter_key(scope))
    for tag in item.get("tags") or []:
        t = str(tag or "").strip()
        if t:
            keys.add(scope_starter_key(t))
            if re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", t.lower()):
                keys.add(t.lower())
    return bool(keys & needles)


def _keep_relevant(item: Dict[str, Any], scope_keys: Sequence[str] | None) -> bool:
    generated_for = str(item.get("generatedFor") or item.get("generated_for") or "")
    if generated_for == "refinement_option":
        return False
    return not looks_like_material_swatch(look_haystack(item))


def _image_select() -> str:
    return urllib.parse.quote(
        "id,subcategory_id,image_url,metadata,account_id,instance_id,created_at",
        safe=",",
    )


def _query_images(*, filters: Sequence[str], limit: int, require_completed: bool) -> List[Dict[str, Any]]:
    requested = max(1, min(int(limit), _MAX_LIBRARY_ROWS))
    rows: List[Dict[str, Any]] = []
    offset = 0
    while len(rows) < requested:
        batch_size = min(_IMAGE_QUERY_PAGE_SIZE, requested - len(rows))
        qs = f"images?select={_image_select()}"
        for part in filters:
            if part:
                qs += f"&{part}"
        if require_completed:
            qs += "&status=eq.completed"
        qs += f"&order=created_at.desc&limit={batch_size}&offset={offset}"
        batch = _rest_get(qs)
        if not batch:
            break
        rows.extend(batch)
        if len(batch) < batch_size:
            break
        offset += len(batch)
    return rows[:requested]


def _flatten_gallery_rows(rows: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in rows:
        if not isinstance(row, dict):
            continue
        img = row.get("images")
        if isinstance(img, list) and img:
            img = img[0]
        if isinstance(img, dict):
            out.append(img)
        elif row.get("image_url"):
            out.append(row)
    return out


def _candidates_from_rows(
    rows: Sequence[Dict[str, Any]],
    *,
    allow_any_source: bool,
    instance_id: str = "",
    pricing_city: str = "",
    pricing_state: str = "",
    seen: Optional[Set[str]] = None,
) -> List[Dict[str, Any]]:
    seen = seen if seen is not None else set()
    out: List[Dict[str, Any]] = []
    for row in rows:
        cand = _row_to_candidate(
            row,
            allow_any_source=allow_any_source,
            instance_id=instance_id,
            require_publish_ready=True,
            pricing_city=pricing_city,
            pricing_state=pricing_state,
        )
        if not cand:
            continue
        key = str(cand.get("id") or cand.get("url") or "").strip()
        if not key or key in seen:
            continue
        seen.add(key)
        out.append(cand)
    return out


def fetch_library_candidates(
    *,
    service_id: str = "",
    instance_id: str = "",
    scope_keys: Sequence[str] | None = None,
    limit: int = 80,
    broaden: bool = True,
    allow_any_source: bool = False,
) -> List[Dict[str, Any]]:
    """
    Load completed catalog images for a subcategory / instance and hard-filter
    by selected scopes when present (broaden only if the filtered set is thin).
    """
    sid = str(service_id or "").strip()
    iid = str(instance_id or "").strip()
    requested = max(1, min(int(limit), _MAX_LIBRARY_ROWS))
    cap = max(1, min(requested * 2, _MAX_LIBRARY_ROWS))
    rows: List[Dict[str, Any]] = []
    pricing_city, pricing_state = _instance_pricing_location(iid)
    if sid:
        rows.extend(_query_images(filters=[f"subcategory_id=eq.{urllib.parse.quote(sid)}"], limit=cap, require_completed=True))
        if not rows:
            rows.extend(_query_images(filters=[f"subcategory_id=eq.{urllib.parse.quote(sid)}"], limit=cap, require_completed=False))
    if iid:
        extra = _query_images(filters=[f"instance_id=eq.{urllib.parse.quote(iid)}"], limit=cap, require_completed=True)
        if not extra:
            extra = _query_images(filters=[f"instance_id=eq.{urllib.parse.quote(iid)}"], limit=cap, require_completed=False)
        rows.extend(extra)
        gallery = _rest_get(
            "instance_sample_gallery"
            f"?select={urllib.parse.quote('sort_order,image_id,images(id,image_url,metadata,status,subcategory_id,account_id,created_at)', safe=',()')}"
            f"&instance_id=eq.{urllib.parse.quote(iid)}"
            "&order=sort_order.asc"
            f"&limit={cap}"
        )
        rows.extend(_flatten_gallery_rows(gallery))

    out = _candidates_from_rows(
        rows,
        allow_any_source=allow_any_source,
        instance_id=iid,
        pricing_city=pricing_city,
        pricing_state=pricing_state,
    )
    # A thin service catalog must not make the first inspiration board empty.
    # Fill only from the shared platform pool (account_id IS NULL) so private
    # business/customer images never leak across accounts.
    if allow_any_source and len(out) < requested:
        seen = {str(item.get("id") or item.get("url") or "").strip() for item in out}
        # The newest platform rows include refinement assets and other records
        # that are intentionally rejected below. Scan a deeper raw window so
        # filtering still leaves enough durable inspiration for a full board.
        platform_scan_limit = min(_MAX_LIBRARY_ROWS, max(cap, requested * 4))
        platform_rows = _query_images(
            filters=["account_id=is.null"],
            limit=platform_scan_limit,
            require_completed=True,
        )
        out.extend(
            _candidates_from_rows(
                platform_rows,
                allow_any_source=True,
                instance_id=iid,
                pricing_city=pricing_city,
                pricing_state=pricing_state,
                seen=seen,
            )
        )
    if not out:
        return []
    if not broaden:
        return out[:requested]
    filtered = hard_filter_by_scopes(out, scope_keys, min_keep=_MIN_FILTERED)
    return filtered[:requested]


def hard_filter_by_scopes(
    candidates: Sequence[Dict[str, Any]],
    scope_keys: Sequence[str] | None,
    *,
    min_keep: int = _MIN_FILTERED,
) -> List[Dict[str, Any]]:
    """
    Prefer exact scope matches, then retain the nearest same-service finished
    scenes. Sparse coverage is a ranking condition, not an empty-result error.
    """
    items = [c for c in candidates if isinstance(c, dict) and c.get("url")]
    relevant = [c for c in items if _keep_relevant(c, scope_keys)]
    needles = _normalize_scope_needles(scope_keys)
    if not needles or not relevant:
        return relevant

    matched = [c for c in relevant if _matches_scopes(c, needles)]
    starters = [
        c
        for c in matched
        if str(c.get("generatedFor") or "") in _SCOPE_STARTER_FOR
    ]
    # Prefer scope starters when we have enough; else all scope matches.
    preferred = starters if len(starters) >= min_keep else matched
    if len(preferred) >= min_keep:
        return preferred
    if preferred:
        seen = {str(c.get("url")) for c in preferred}
        rest = [c for c in relevant if str(c.get("url")) not in seen]
        return [*preferred, *rest]
    return relevant


__all__ = [
    "fetch_library_candidates",
    "hard_filter_by_scopes",
    "scope_starter_key",
]
