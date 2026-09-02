"""Fast Groq-authored refinement chips with instant deterministic fallbacks."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from programs.adventure_pipeline.llm import run_json_signature


_GENERIC_COST = re.compile(r"cheaper|expensive|premium|upgrade|simpler|as shown", re.I)


def _clean(value: Any, limit: int = 260) -> str:
    return str(value or "").strip()[:limit]


def _slug(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", value.lower()).strip("-")[:48] or "suggestion"


def _fallback(target: str) -> List[Dict[str, str]]:
    key = target.lower()
    if re.search(r"faucet|fixture|hardware|shower|tub", key):
        rows = [
            ("Polished chrome", "Replace the visible fixture finish with polished chrome."),
            ("Brushed nickel", "Replace the visible fixture finish with brushed nickel."),
            ("Matte black", "Replace the visible fixture finish with matte black."),
        ]
    elif re.search(r"vanity|cabinet|storage", key):
        rows = [
            ("Lighter wood", "Use a lighter natural wood finish with restrained grain."),
            ("Painted finish", "Use a clean painted cabinet finish that fits the room."),
            ("More storage", "Improve the visible storage within the existing footprint."),
        ]
    elif re.search(r"tile|floor|counter|surface|backsplash", key):
        rows = [
            ("Larger tile", "Use a larger-format tile with fewer grout lines."),
            ("Warmer tone", "Use a warmer surface color that fits the current palette."),
            ("Lighter grout", "Use lighter coordinated grout while preserving the tile layout."),
        ]
    elif "light" in key:
        rows = [
            ("Warmer light", "Use warmer, softer lighting fixtures in the existing locations."),
            ("Cleaner fixtures", "Use simpler, cleaner-lined lighting fixtures."),
            ("Statement light", "Use one restrained statement light in the existing location."),
        ]
    else:
        rows = [
            ("Make it warmer", "Make the materials and palette feel warmer and more inviting."),
            ("More modern", "Make the visible finishes cleaner and more modern."),
            ("Add contrast", "Add tasteful visual contrast while keeping the design cohesive."),
        ]
    return [{"id": _slug(label), "label": label, "prompt": prompt} for label, prompt in rows]


def _normalize(raw: Any, fallback: List[Dict[str, str]]) -> List[Dict[str, str]]:
    items = raw if isinstance(raw, list) else []
    out: List[Dict[str, str]] = []
    seen: set[str] = set()
    for item in items:
        if not isinstance(item, dict):
            continue
        label = _clean(item.get("label"), 32)
        prompt = _clean(item.get("prompt") or item.get("instruction"), 260)
        key = label.lower()
        if not label or not prompt or key in seen or _GENERIC_COST.search(label):
            continue
        seen.add(key)
        out.append({"id": _slug(label), "label": label, "prompt": prompt})
        if len(out) >= 3:
            break
    for row in fallback:
        key = row["label"].lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(row)
        if len(out) >= 3:
            break
    return out[:3]


def plan_refinement_suggestions(
    payload: Dict[str, Any],
    *,
    llm_result: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    body = payload if isinstance(payload, dict) else {}
    design = body.get("design") if isinstance(body.get("design"), dict) else {}
    target = _clean(body.get("target") or "Anywhere", 80) or "Anywhere"
    components = [
        _clean(item, 80)
        for item in (body.get("components") if isinstance(body.get("components"), list) else [])
        if _clean(item, 80)
    ][:12]
    fallback = _fallback(target)
    parsed = llm_result
    if parsed is None:
        from programs.adventure_pipeline.signatures import RefinementSuggestionsSignature

        parsed = run_json_signature(
            signature=RefinementSuggestionsSignature,
            input_field="request_json",
            output_field="suggestions_json",
            payload={
                "service": _clean(
                    body.get("serviceLabel")
                    or design.get("customerServiceLabel")
                    or design.get("serviceLabel"),
                    100,
                ),
                "scope": _clean(body.get("scope") or design.get("scope"), 100),
                "scopes": body.get("scopes") or design.get("scopes") or [],
                "target": target,
                "components": components,
                "designLabel": _clean(body.get("designLabel"), 120),
                "changeSummary": _clean(body.get("changeSummary"), 240),
            },
            module_env_prefix="DSPY_ADVENTURE_REFINEMENT_SUGGESTIONS",
            default_temperature=0.3,
            default_max_tokens=700,
            default_timeout=8.0,
            module_default_model="openai/gpt-oss-20b",
        )

    suggestions = _normalize((parsed or {}).get("suggestions"), fallback)
    return {
        "ok": True,
        "target": target,
        "suggestions": suggestions,
        "source": "llm" if isinstance(parsed, dict) and parsed.get("suggestions") else "fallback",
    }


__all__ = ["plan_refinement_suggestions"]
