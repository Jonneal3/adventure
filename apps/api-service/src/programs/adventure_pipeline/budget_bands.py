"""
Budget bands from service + scope context.

Dynamic at first (calibration + scope multipliers), structured/learned later.
"""

from __future__ import annotations

from typing import Any, Dict, List, Sequence

from programs.pricing.service_calibration import match_service_calibration


# Scope keywords that shrink or expand the typical spend vs a "full" project.
# Order matters: first match wins per scope label.
_SCOPE_MULTIPLIERS: tuple[tuple[tuple[str, ...], float], ...] = (
    (("full bathroom", "full kitchen", "full outdoor", "full yard", "master plan", "gut", "full renovation"), 1.0),
    (("full", "whole", "complete", "renovation"), 1.0),
    (("layout", "plumbing", "electrical", "addition", "expand"), 0.85),
    (("shower", "tub", "wet room", "bath surround"), 0.42),
    (("vanity", "toilet", "mirror", "medicine"), 0.28),
    (("grill", "outdoor kitchen", "pizza oven"), 0.48),
    (("fire pit", "fireplace", "pergola", "shade"), 0.40),
    (("seating", "furniture", "dining"), 0.30),
    (("cabinet", "fixture", "faucet", "sink", "hardware"), 0.28),
    (("tile & flooring", "tile and flooring", "floor tile", "wall tile"), 0.32),
    (("tile", "flooring", "floor"), 0.32),
    (("cosmetic", "paint", "trim", "refresh"), 0.18),
    (("lighting", "exhaust"), 0.22),
    (("patio", "terrace", "walkway", "path", "hardscape", "retaining"), 0.45),
    (("planting", "lawn", "garden", "tree", "shrub", "privacy", "irrigation", "drainage"), 0.25),
    (("driveway", "fence", "gate"), 0.48),
    (("water feature",), 0.35),
    (("island", "counter", "backsplash", "appliance", "pantry"), 0.55),
    (("kitchen",), 0.70),
    (("other",), 0.55),
)


def _scope_multiplier(scopes: Sequence[str]) -> float:
    texts = [str(s or "").strip().lower() for s in scopes if str(s or "").strip()]
    # Ignore Other for range sizing — free-text doesn't widen the band by itself.
    texts = [t for t in texts if t != "other" and "multiple / other" not in t]
    if not texts:
        return 1.0
    if any(any(k in t for k in ("full bathroom", "full kitchen", "full outdoor", "full yard", "master plan")) for t in texts):
        return 1.0
    if any(t.startswith("full ") or t.startswith("whole ") or "complete" in t for t in texts):
        return 1.0
    scores: List[float] = []
    for t in texts:
        matched = 0.55  # unknown focused scope — mid-partial, not full
        for keys, mult in _SCOPE_MULTIPLIERS:
            if any(k in t for k in keys):
                matched = mult
                break
        scores.append(matched)
    if not scores:
        return 1.0
    # Multi-select: take the largest piece + diminishing add-ons; cap below full reno.
    primary = max(scores)
    extras = sorted(scores, reverse=True)[1:]
    combined = primary + 0.35 * sum(extras)
    return max(0.15, min(0.95 if primary < 0.95 else 1.05, combined))


_MIN_JOB = 250

# Lowest chip for this trade — niches and light scopes start here, not at a full-gut floor.
_SERVICE_FLOOR: Dict[str, int] = {
    "bathroom_remodel": 500,
    "kitchen_remodel": 1_000,
    "landscape_design": 500,
    "pool_build": 5_000,
    "deck_patio": 500,
    "roofing": 1_500,
    "hvac": 500,
    "flooring": 500,
    "painting": 250,
    "windows_siding": 1_000,
    "generic_remodel": 500,
    "general_service": 500,
}

# Dollar cut points per calibrated service. Scope clips this ladder to the
# job envelope, so a vanity gets $500–$5k while a full bath starts at $5k.
_SERVICE_RUNGS: Dict[str, tuple[int, ...]] = {
    "bathroom_remodel": (500, 1_500, 3_000, 5_000, 10_000, 18_000, 28_000, 45_000, 70_000, 110_000, 150_000),
    "kitchen_remodel": (1_000, 3_000, 6_000, 10_000, 18_000, 25_000, 40_000, 60_000, 90_000, 120_000, 250_000),
    "landscape_design": (500, 5_000, 12_000, 20_000, 35_000, 55_000, 90_000, 175_000),
    "pool_build": (5_000, 15_000, 30_000, 50_000, 75_000, 110_000, 150_000, 200_000),
    "deck_patio": (500, 4_000, 8_000, 15_000, 25_000, 40_000, 60_000),
    "roofing": (1_500, 6_000, 10_000, 16_000, 25_000, 40_000, 50_000),
    "hvac": (500, 3_000, 6_000, 10_000, 16_000, 25_000),
    "flooring": (500, 3_000, 7_000, 12_000, 20_000, 35_000, 50_000),
    "painting": (250, 750, 1_500, 3_000, 5_000, 9_000, 15_000, 25_000),
    "windows_siding": (1_000, 5_000, 10_000, 20_000, 35_000, 55_000, 85_000),
    "generic_remodel": (500, 5_000, 10_000, 20_000, 35_000, 55_000, 90_000, 150_000),
    "general_service": (500, 5_000, 12_000, 25_000, 45_000, 80_000, 120_000),
}


def _round_to(n: float, size: int) -> int:
    size = max(1, int(size))
    return int(round(n / size) * size)


def _rungs_for_service(service_label: str = "", industry: str = "", service_summary: str = "") -> tuple[int, ...]:
    text = f"{industry} {service_label} {service_summary}".strip()
    key = match_service_calibration(text).key
    return _SERVICE_RUNGS.get(key) or _SERVICE_RUNGS["general_service"]


def _floor_for_service(service_label: str = "", industry: str = "", service_summary: str = "") -> int:
    text = f"{industry} {service_label} {service_summary}".strip()
    key = match_service_calibration(text).key
    return max(_MIN_JOB, int(_SERVICE_FLOOR.get(key) or _MIN_JOB))


def propose_budget_bands(
    *,
    service_label: str = "",
    industry: str = "",
    service_summary: str = "",
    scopes: Sequence[str] | None = None,
) -> Dict[str, Any]:
    text = f"{industry} {service_label} {service_summary}".strip()
    calibration = match_service_calibration(text)
    base_low, base_high = calibration.normalized_service_range().low, calibration.normalized_service_range().high
    tiers = calibration.normalized_tier_ranges()
    typical_high = int(tiers["standard"].high) if tiers.get("standard") else int(round(base_high * 0.35))
    premium_high = int(tiers["premium"].high) if tiers.get("premium") else int(round(base_high * 0.6))
    luxury_high = int(tiers["luxury"].high) if tiers.get("luxury") else int(round(base_high))
    mult = _scope_multiplier(scopes or [])
    floor = _floor_for_service(service_label, industry, service_summary)
    # Full jobs still offer a low first chip for this trade; the last chip is $X+.
    if mult >= 0.95:
        low = floor
        high = max(low + 4000, _round_to(premium_high, 1000))
        plus_high = max(high, _round_to(luxury_high, 1000))
    else:
        scaled = base_low * max(mult, 0.15)
        low = floor if scaled <= 8_000 else max(floor, _round_to(scaled, 500))
        high = max(low + 2500, _round_to(typical_high * mult * 1.35, 1000))
        plus_high = max(high, _round_to(high * 1.5, 1000))

    bands: List[Dict[str, Any]] = []
    for key in ("starter", "standard", "premium", "luxury"):
        rng = tiers.get(key)  # type: ignore[arg-type]
        if not rng:
            continue
        b_lo = max(low, _round_to(rng.low * mult, 500))
        b_hi = max(b_lo + 1000, _round_to(rng.high * mult, 1000))
        b_hi = min(b_hi, high) if key != "luxury" else max(min(b_hi, high), high)
        bands.append(
            {
                "id": key,
                "label": key.title(),
                "min": b_lo,
                "max": b_hi,
                "source": "ai",
            }
        )

    step = 500 if high <= 20000 else 1000 if high <= 60000 else 2500
    default_amount = _round_to((low + high) / 2, step)
    finish_tiers = split_finish_tiers(
        low,
        high,
        service_label=service_label,
        industry=industry,
        service_summary=service_summary,
        plus_high=plus_high,
    )
    return {
        "ok": True,
        "source": "ai",
        "currency": "USD",
        "min": low,
        "max": plus_high,
        "step": step,
        "defaultAmount": default_amount,
        "scopeMultiplier": round(mult, 3),
        "scopes": list(scopes or []),
        "calibrationKey": calibration.key,
        "bands": bands,
        "finishTiers": finish_tiers,
        "confidence": 0.55 if scopes else 0.4,
    }


_FINISH_LABELS = {
    "starter": "Starter",
    "value": "Value",
    "mid": "Mid",
    "upper": "Upper",
    "plus": "Plus",
    "premium": "Premium",
    "luxury": "Luxury",
    "estate": "Estate",
}
_FINISH_ORDER = ("starter", "value", "mid", "upper", "plus", "premium", "luxury", "estate")
_CATALOG_TIER = {
    "starter": "value",
    "value": "value",
    "mid": "mid",
    "upper": "mid",
    "plus": "premium",
    "premium": "premium",
    "luxury": "luxury",
    "estate": "luxury",
}
_IDS_FOR_COUNT = {
    1: ("value",),
    2: ("value", "premium"),
    3: ("value", "mid", "premium"),
    4: ("value", "mid", "premium", "luxury"),
    5: ("starter", "value", "mid", "premium", "luxury"),
    6: ("starter", "value", "mid", "upper", "premium", "luxury"),
    7: ("starter", "value", "mid", "upper", "premium", "luxury", "estate"),
    8: ("starter", "value", "mid", "upper", "plus", "premium", "luxury", "estate"),
}


def _ids_for_count(n: int) -> tuple[str, ...]:
    if n <= 0:
        return ("value",)
    if n in _IDS_FOR_COUNT:
        return _IDS_FOR_COUNT[n]
    extra = n - 7
    return _FINISH_ORDER + tuple(f"band-{i + 8}" for i in range(extra))


def _band_round(high: int) -> int:
    if high <= 10_000:
        return 500
    if high <= 150_000:
        return 1000
    return 5000


def _min_band_width(high: int) -> int:
    if high <= 10_000:
        return 250
    if high <= 40_000:
        return 1000
    return 2500


def _fill_cuts(cuts: List[int], *, min_width: int, round_to: int, target: int = 5, cap: int = 8) -> List[int]:
    """Pad or merge so the customer sees about 5–8 dollar ranges, not 2–3 huge buckets."""
    out = list(cuts)
    while len(out) - 1 < target:
        best_i = -1
        best_span = 0
        for i in range(len(out) - 1):
            span = out[i + 1] - out[i]
            if span > best_span and span >= min_width * 2:
                best_span = span
                best_i = i
        if best_i < 0:
            break
        mid = _round_to((out[best_i] + out[best_i + 1]) / 2, round_to)
        if mid <= out[best_i] or mid >= out[best_i + 1]:
            mid = out[best_i] + min_width
        if mid - out[best_i] < min_width or out[best_i + 1] - mid < min_width:
            break
        out.insert(best_i + 1, mid)
    while len(out) - 1 > cap:
        best_i = -1
        best_span = 10**12
        for i in range(len(out) - 1):
            span = out[i + 1] - out[i]
            if span < best_span:
                best_span = span
                best_i = i
        if best_i < 0 or best_i + 1 >= len(out) - 1:
            break
        del out[best_i + 1]
    return out


def _catalog_tier_for(raw: Any) -> str:
    if isinstance(raw, dict):
        tagged = str(raw.get("catalogTier") or raw.get("catalog_tier") or "").strip()
        if tagged:
            return tagged
        key = str(raw.get("id") or "").strip()
    else:
        key = str(raw or "").strip()
    return _CATALOG_TIER.get(key, key or "mid")


def split_finish_tiers(
    low: int,
    high: int,
    *,
    service_label: str = "",
    industry: str = "",
    service_summary: str = "",
    rungs: Sequence[int] | None = None,
    plus_high: int | None = None,
) -> List[Dict[str, Any]]:
    lo = max(_MIN_JOB, int(low))
    hi = max(lo + 1500, int(high))
    top = max(hi, int(plus_high or hi))
    round_to = _band_round(hi)
    min_width = _min_band_width(hi)
    cuts = [lo]
    ladder = list(rungs or _rungs_for_service(service_label, industry, service_summary))
    for rung in ladder:
        cut = _round_to(rung, min(250, round_to) if hi <= 10_000 else round_to)
        if cut - cuts[-1] < min_width:
            continue
        if hi - cut < min_width:
            continue
        if lo < cut < hi:
            cuts.append(cut)
    cuts.append(hi)
    cuts = _fill_cuts(cuts, min_width=min_width, round_to=round_to, target=5, cap=8)
    ids = _ids_for_count(len(cuts) - 1)
    out: List[Dict[str, Any]] = []
    for i, tid in enumerate(ids):
        start = cuts[i]
        end = cuts[i + 1]
        end = max(start + min_width, end)
        open_ended = i == len(ids) - 1
        if open_ended:
            end = max(end, top)
        out.append(
            {
                "id": tid,
                "label": f"{start}+" if open_ended else _FINISH_LABELS.get(tid, tid.title()),
                "min": start,
                "max": end,
                "openEnded": open_ended,
                "catalogTier": _CATALOG_TIER.get(tid, tid),
            }
        )
    return out


def adjacent_finish_tiers(selected: str | None, tiers: Sequence[Dict[str, Any]] | Sequence[str]) -> List[str]:
    """Catalog tags (value/mid/premium/luxury) for the selected chip ± one neighbor."""
    rows = list(tiers)
    ids = [str(t["id"] if isinstance(t, dict) else t) for t in rows]
    key = str(selected or "").strip()
    if key not in ids:
        mapped = [_catalog_tier_for(t) for t in rows]
        unique = list(dict.fromkeys(mapped))
        return unique[: min(2, len(unique))]
    idx = ids.index(key)
    keep_ids = {ids[idx]}
    if idx > 0:
        keep_ids.add(ids[idx - 1])
    if idx < len(ids) - 1:
        keep_ids.add(ids[idx + 1])
    catalog: List[str] = []
    seen: set[str] = set()
    for i, tid in enumerate(ids):
        if tid not in keep_ids:
            continue
        tag = _catalog_tier_for(rows[i] if i < len(rows) else tid)
        if not tag or tag in seen:
            continue
        seen.add(tag)
        catalog.append(tag)
    return catalog


def normalize_finish_tier(raw: str | None) -> str | None:
    text = str(raw or "").strip().lower()
    if not text:
        return None
    if text in _FINISH_ORDER:
        return text
    if text in ("$", "value", "economy", "budget", "afford"):
        return "value"
    if text in ("starter", "entry"):
        return "starter"
    if text in ("$$", "mid", "middle", "standard", "mid_range", "mid-range"):
        return "mid"
    if text in ("upper", "upper-mid", "upper_mid"):
        return "upper"
    if text in ("plus",):
        return "plus"
    if text in ("$$$", "premium", "high"):
        return "premium"
    if text in ("$$$$", "luxury", "lux", "bespoke", "custom"):
        return "luxury"
    if text in ("estate", "ultra"):
        return "estate"
    if any(k in text for k in ("afford", "value", "economy")):
        return "value"
    if "starter" in text:
        return "starter"
    if any(k in text for k in ("lux", "bespoke")):
        return "luxury"
    if "premium" in text or text == "high":
        return "premium"
    if "mid" in text or "standard" in text:
        return "mid"
    dollars = text.count("$")
    if dollars == 1:
        return "value"
    if dollars == 2:
        return "mid"
    if dollars == 3:
        return "premium"
    if dollars >= 4:
        return "luxury"
    return None


def finish_tiers_for_scope(
    *,
    service_label: str = "",
    industry: str = "",
    service_summary: str = "",
    scopes: Sequence[str] | None = None,
) -> List[Dict[str, Any]]:
    proposed = propose_budget_bands(
        service_label=service_label,
        industry=industry,
        service_summary=service_summary,
        scopes=scopes,
    )
    return list(proposed.get("finishTiers") or [])


__all__ = [
    "adjacent_finish_tiers",
    "finish_tiers_for_scope",
    "normalize_finish_tier",
    "propose_budget_bands",
    "split_finish_tiers",
]
