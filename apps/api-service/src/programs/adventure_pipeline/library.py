"""
Server-side image library fetch for Adventure V7.

Ranks happen in retrieval.py; this module loads catalog candidates from Supabase
when the widget does not supply libraryImages.
"""

from __future__ import annotations

import json
import os
import re
import unicodedata
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Optional, Sequence, Set

from programs.adventure_pipeline.catalog_tag import inspiration_blocked
from programs.adventure_pipeline.recipes import look_fits_selected_scopes, look_haystack


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
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data if isinstance(data, list) else []
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return []


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
    conversions = float(stats.get("conversions") or 0)
    if conversions >= 1:
        return "Local favorite"
    if saved >= 2:
        return "Often saved"
    if selected >= 2 and shown > 0 and selected / max(shown, 1) >= 0.12:
        return "Popular pick"
    return ""


def _row_to_candidate(row: Dict[str, Any], *, allow_any_source: bool = False) -> Optional[Dict[str, Any]]:
    meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
    generated_for = str(meta.get("generated_for") or "").strip()
    if generated_for and not allow_any_source and generated_for not in _CATALOG_GENERATED_FOR:
        return None
    url = str(row.get("image_url") or "").strip()
    if not (url.startswith("http://") or url.startswith("https://")):
        return None
    discovery = meta.get("discovery") if isinstance(meta.get("discovery"), dict) else None
    if inspiration_blocked(generated_for=generated_for, discovery=discovery):
        return None
    label = _label_from_meta(meta) or "From our work"
    scope_tag = str(meta.get("starter_scope") or meta.get("refinement_category_label") or "").strip()
    scope_key = str(meta.get("starter_scope_key") or "").strip() or (
        scope_starter_key(scope_tag) if scope_tag else ""
    )
    price_tier = str(meta.get("price_tier") or "").strip()
    raw_tags = meta.get("tags") if isinstance(meta.get("tags"), list) else []
    scope_keys = meta.get("scope_keys") if isinstance(meta.get("scope_keys"), list) else []
    tags: List[str] = []
    seen_tags: Set[str] = set()
    for item in (
        [scope_tag, scope_key, price_tier, str(meta.get("palette_family") or ""), str(meta.get("style") or "")]
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
    cue = _performance_cue(stats)
    return {
        "id": str(row.get("id") or ""),
        "imageId": str(row.get("id") or ""),
        "url": url,
        "label": label,
        "description": scope_tag or str(meta.get("option_description") or ""),
        "priceTier": price_tier,
        "tags": tags,
        "scopeKey": scope_key or None,
        "scope": scope_tag or None,
        "generatedFor": generated_for or None,
        "timesShown": stats.get("shown") or 0,
        "timesSelected": stats.get("selected") or 0,
        "timesSaved": stats.get("saved") or 0,
        "conversions": stats.get("conversions") or 0,
        "featuredRank": meta.get("featured_rank"),
        "performanceCue": cue or None,
        "cue": cue or None,
        "source": "library",
        "budget": meta.get("budget") or None,
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
    return look_fits_selected_scopes(
        look_haystack(item),
        scopes=list(scope_keys or []),
        generated_for=str(item.get("generatedFor") or item.get("generated_for") or ""),
    )


def _image_select() -> str:
    return urllib.parse.quote(
        "id,subcategory_id,image_url,metadata,account_id,created_at",
        safe=",",
    )


def _query_images(*, filters: Sequence[str], limit: int, require_completed: bool) -> List[Dict[str, Any]]:
    qs = f"images?select={_image_select()}"
    for part in filters:
        if part:
            qs += f"&{part}"
    if require_completed:
        qs += "&status=eq.completed"
    qs += f"&order=created_at.desc&limit={max(1, min(int(limit), 240))}"
    return _rest_get(qs)


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
    seen: Optional[Set[str]] = None,
) -> List[Dict[str, Any]]:
    seen = seen if seen is not None else set()
    out: List[Dict[str, Any]] = []
    for row in rows:
        cand = _row_to_candidate(row, allow_any_source=allow_any_source)
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
    cap = max(1, min(int(limit) * 2, 240))
    rows: List[Dict[str, Any]] = []
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

    out = _candidates_from_rows(rows, allow_any_source=allow_any_source)
    if not out:
        return []
    if not broaden:
        return out[: max(1, min(int(limit), 240))]
    filtered = hard_filter_by_scopes(out, scope_keys, min_keep=_MIN_FILTERED)
    return filtered[: max(1, min(int(limit), 200))]


def hard_filter_by_scopes(
    candidates: Sequence[Dict[str, Any]],
    scope_keys: Sequence[str] | None,
    *,
    min_keep: int = _MIN_FILTERED,
) -> List[Dict[str, Any]]:
    """
    Prefer exact scope matches (especially v2_scope_starter). Broaden only with
    other finished-room looks — never dump tile swatches or option cards.
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
