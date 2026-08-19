"""
Adventure V7 step contracts — canonical consume/produce rules.

Source of truth for what each step shows, reads, collects, and may use AI for.
Image intelligence + model routing sit under Starting→Refine; they are not
assigned as “Step N = Model X.”
"""

from __future__ import annotations

from typing import Any, Dict, List, Set

from programs.adventure_pipeline.schemas import ProjectState


STEP_CONTRACTS: Dict[str, Dict[str, Any]] = {
    "choose": {
        "aliases": ["service"],
        "ux": "Customer-understandable service entry.",
        "visual": {
            "cards": "Image + service name; text-only if no image",
            "select": "single",
        },
        "data": {
            "services": "Business selects in Instance Designer → Supabase",
            "names": "Instance data (customer_label when stored)",
            "images": "Instance images → platform images → text-only",
            "copy": "Fixed form copy unless customized in Instance Designer",
        },
        "logic": {
            "one_service": "Skip",
            "two_plus": "Show",
            "selected": "Determines scope options; saved to ProjectState.service",
        },
        "interaction": {"required": True, "mode": "single-select"},
        "ai": "Translate business→customer labels when missing; skip if stored.",
        "improves": "Validated customer labels",
        "required": {"service.id"},
        "collects": ["service"],
    },
    "scope": {
        "aliases": ["project"],
        "ux": "Parts checklist for what's included in the project.",
        "visual": {
            "cards": "Small image chips (10–20 parts) + Full renovation select-all; text-only if no cover; Other",
            "select": "multi",
        },
        "data": {
            "options": "Element parts from components/subcategory_scope (grill, vanity, etc.)",
            "images": "Stored starters/aliases first; generate missing part covers (no stock fillers)",
            "other": "Customer free text → ProjectState.scope.otherText",
            "selections": "ProjectState.scope.items; AI review later",
        },
        "logic": {
            "from_service": "Service determines available parts",
            "drives": "Later steps, images, pricing",
            "multiple": "Multi-select inclusions; Full renovation = all parts",
            "other": "Saved for AI review and future configuration",
        },
        "interaction": {"required": True, "mode": "multi-select"},
        "ai": "Text when taxonomy thin; image covers from library, generate only gaps.",
        "improves": "Scope taxonomy + image tags by scope key",
        "required": {"scope.items"},
        "collects": ["scope.items", "scope.otherText"],
    },
    "budget": {
        "aliases": [],
        "ux": "Realistic spend band for this service+scope.",
        "visual": {"control": "Slider with range + increments"},
        "data": {
            "copy_title": "Roughly, what's your budget?",
            "range_default": "Platform calibration / database",
            "range_context": "Service + Scope determines range",
            "range_override": "Business override via Instance Designer → Supabase",
            "selection": "ProjectState.budget",
        },
        "logic": {
            "range": "Service + Scope → range; instance override wins",
            "drives": "Filters later images, designs, pricing",
        },
        "interaction": {"required": True, "mode": "slider"},
        "ai": "Propose bands from service+scope; recommend better ranges over time.",
        "improves": "Learned bands per service/scope",
        "required": {"budget.amount"},
        "collects": ["budget"],
    },
    "starting": {
        "aliases": ["path"],
        "ux": "Inspiration vs photo branch.",
        "visual": {
            "choices": ["Start with inspiration", "Use a photo"],
            "photo_upload": "Only after choosing photo; mobile can capture",
        },
        "data": {
            "choices": "Fixed form",
            "photo": "Customer upload → Supabase",
            "analysis": "AI vision → ProjectState.start.photo.analysis",
            "selection": "ProjectState.start.path",
        },
        "logic": {
            "inspiration": "→ Inspiration",
            "photo": "Analyze photo → use in later visual steps",
        },
        "interaction": {"required": True, "mode": "single-select"},
        "ai": "Vision only if photo path.",
        "improves": "Photo analysis quality",
        "required": {"start.path"},
        "collects": ["start.path", "start.photo"],
    },
    "inspiration": {
        "aliases": [],
        "ux": "Pinterest-style gallery of relevant looks; collect favorites.",
        "visual": {
            "gallery": "50+ possible images, fast, varied styles",
            "favorites": "2–5 required",
        },
        "data": {
            "images": "Instance library → platform library → AI-generated (Supabase)",
            "metadata": [
                "service",
                "scope/component",
                "style",
                "materials",
                "price range",
                "popularity",
                "selections/saves/shares",
            ],
            "labels": ["style tags", "superlatives", "price relationship", "social proof"],
            "generated": "Saved when worth keeping → reusable inventory",
        },
        "logic": {
            "filter": "ProjectState (service, scope, budget, photo, prefs)",
            "order": "Stored first; generate when needed",
            "rank": ["relevance", "popularity", "performance", "variety", "price fit"],
        },
        "interaction": {"required": True, "mode": "multi-select 2–5"},
        "ai": "Retrieve-first, generate to fill gaps; curation loop improves library.",
        "improves": "Library gaps, rankings, tags",
        "required": {"service.id", "scope.items", "budget.amount", "start.path"},
        "collects": ["selection.inspirationIds"],
    },
    "review": {
        "aliases": ["likes"],
        "ux": "Confirm structured preferences from favorites (not more images).",
        "visual": {
            "favorites": "Selected inspiration images shown together",
            "bubbles": "AI preference traits (color, material, style, layout, components)",
        },
        "data": {
            "images": "From Inspiration favorites",
            "analysis": "AI identifies common visual traits",
            "preferences": "ProjectState.taste; confirmed → Supabase",
        },
        "logic": {
            "flow": "Selected images → AI analyzes → customer confirms → Exploration",
        },
        "interaction": {"required": True, "mode": "confirm/remove then continue"},
        "ai": "Interpret visuals → taste tags inside ontology vocabulary.",
        "improves": "Attribute performance",
        "required": {"selection.inspirationIds"},
        "collects": ["taste"],
    },
    "exploration": {
        "aliases": ["explore", "ideas"],
        "ux": "10–15 possibilities; choose one design to refine.",
        "visual": {
            "gallery": "Large board, similar feel to Inspiration",
            "loading": "Images appear as they finish; show progress",
        },
        "data": {
            "input": "Entire ProjectState",
            "images": "Edit existing when possible; reuse stored; generate otherwise",
            "model": "Router chooses by speed/quality/type/cost",
            "results": "Supabase when worth keeping",
        },
        "logic": {
            "edit_vs_gen": "Edit when suitable existing image; else generate",
            "async": "Results stream as they finish",
            "reuse": "Strong results → future Inspiration",
        },
        "interaction": {
            "required": True,
            "mode": "choose 1; limited regen; can return later",
        },
        "ai": "retrieve / edit / generate via intent + model router",
        "improves": "Idea win rates + library",
        "required": {"selection.inspirationIds"},
        "collects": ["selection.ideaId", "selection.ideaUrl"],
    },
    "refine": {
        "aliases": ["adjust"],
        "ux": "Action-based steering of the selected design.",
        "visual": {
            "hero": "Selected design",
            "actions": [
                "More like this",
                "Change component",
                "Make it more affordable",
                "Try another style",
                "Something different",
            ],
        },
        "data": {
            "selected": "From Exploration",
            "action": "ProjectState + instruction",
            "result": "Edit existing or generate; write-back when worth keeping",
        },
        "logic": {
            "more_like_this": "Variations",
            "change_component": "Edit/generate that part",
            "affordable": "Budget as constraint",
            "another_style": "Retrieve different → generate if needed",
            "every_action": "Updates ProjectState for later steps",
        },
        "interaction": {"required": False, "mode": "action-based; no unnecessary typing"},
        "ai": "edit vs gen vs retrieve from interpreted instruction",
        "improves": "Edit success by model/service/scope",
        "required": {"selection.ideaUrl"},
        "collects": ["refineNote", "priceImpact", "selection.history"],
    },
}


def _normalize_step(step: str) -> str:
    key = str(step or "").strip().lower().replace("-", "_")
    if key in STEP_CONTRACTS:
        return key
    for name, meta in STEP_CONTRACTS.items():
        aliases = meta.get("aliases") or []
        if key in aliases or key == name:
            return name
    return key


def _has_path(project: ProjectState, path: str) -> bool:
    if path == "service.id":
        return bool(project.service.id or project.service.business_label)
    if path == "scope.items":
        return bool(project.scope.items) or bool(project.scope.other_text.strip())
    if path == "budget.amount":
        return float(project.budget.amount or 0) > 0
    if path == "start.path":
        return project.start.path in ("inspiration", "photo")
    if path == "selection.inspirationIds":
        return bool(project.selection.inspiration_ids)
    if path in ("selection.ideaUrl", "selection.ideaId"):
        return bool(project.selection.idea_url or project.selection.idea_id)
    if path == "taste.confirmedIds":
        return bool(project.taste.confirmed_ids or any(t.selected for t in project.taste.tags))
    return True


def missing_fields(project: ProjectState, step: str) -> List[str]:
    name = _normalize_step(step)
    contract = STEP_CONTRACTS.get(name) or {}
    required: Set[str] = set(contract.get("required") or set())
    return [path for path in sorted(required) if not _has_path(project, path)]


def can_advance(project: ProjectState, step: str) -> Dict[str, Any]:
    name = _normalize_step(step)
    missing = missing_fields(project, name)
    meta = STEP_CONTRACTS.get(name) or {}
    return {
        "ok": len(missing) == 0,
        "step": name,
        "missing": missing,
        "contract": {
            k: meta.get(k)
            for k in ("ux", "visual", "data", "logic", "interaction", "ai", "improves", "collects")
        },
    }


def contracts_overview() -> List[Dict[str, Any]]:
    return [{"step": step, **meta} for step, meta in STEP_CONTRACTS.items()]


__all__ = [
    "STEP_CONTRACTS",
    "can_advance",
    "missing_fields",
    "contracts_overview",
]
