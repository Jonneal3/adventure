"""
Refinements orchestrator: generates refinement questions for post-concept exploration.

Same payload shape as next_steps; uses RefinementsPlannerProgram instead of QuestionPlanner.
"""

from __future__ import annotations

import json
import os
import time
from typing import Any, Dict, List

from programs.form_pipeline.context_builder import build_context
from programs.question_planner.plan_parsing import derive_step_id_from_key, extract_plan_items, normalize_plan_key
from programs.question_planner.renderer.plan_to_steps import render_plan_items_to_mini_steps
from programs.refinements.program import RefinementsPlannerProgram


def _compact_json(obj: object) -> str:
    return json.dumps(obj, ensure_ascii=True, separators=(",", ":"), sort_keys=True)


def _coerce_int(value: Any, default: int) -> int:
    try:
        if isinstance(value, dict):
            # Be resilient to nested shapes from context builder.
            for k in ("value", "max", "target", "count"):
                if k in value:
                    return int(value.get(k))
            return default
        if value is None:
            return default
        return int(value)
    except Exception:
        return default


def _coerce_float(value: Any, default: float) -> float:
    try:
        if value is None:
            return default
        return float(value)
    except Exception:
        return default


def _make_refinements_lm_cfg() -> Dict[str, Any] | None:
    model_raw = (
        os.getenv("DSPY_REFINEMENTS_MODEL")
        or os.getenv("DSPY_PLANNER_MODEL")
        or os.getenv("DSPY_MODEL")
        or ""
    ).strip()
    if not model_raw:
        return None
    provider = (os.getenv("DSPY_PROVIDER") or "").strip().lower()
    model = model_raw if "/" in model_raw or not provider else f"{provider}/{model_raw}"
    return {
        "model": model,
        "temperature": _coerce_float(
            os.getenv("DSPY_REFINEMENTS_TEMPERATURE") or os.getenv("DSPY_PLANNER_TEMPERATURE"),
            0.7,
        ),
        "max_tokens": _coerce_int(os.getenv("DSPY_REFINEMENTS_MAX_TOKENS") or os.getenv("DSPY_PLANNER_MAX_TOKENS"), 2048),
        "timeout": float(os.getenv("DSPY_REFINEMENTS_TIMEOUT") or os.getenv("DSPY_PLANNER_TIMEOUT") or 30),
    }


def refinements_jsonl(payload: Dict[str, Any]) -> Dict[str, Any]:
    """
    Generate refinement miniSteps for post-concept exploration.
    Same payload shape as next_steps_jsonl.
    """
    request_id = f"refinements_{int(time.time() * 1000)}"
    start_time = time.time()

    try:
        ctx = build_context(payload)
    except Exception as e:
        return {
            "ok": False,
            "error": str(e),
            "requestId": request_id,
            "schemaVersion": "0",
        }

    asked_ids = set(str(x).strip() for x in (ctx.get("asked_step_ids") or []) if str(x).strip())
    batch_constraints = ctx.get("batch_constraints") if isinstance(ctx.get("batch_constraints"), dict) else {}
    max_steps_raw = batch_constraints.get("maxStepsTotal", 8)
    max_steps = min(10, max(5, _coerce_int(max_steps_raw, 8)))
    allowed_mini_types = ["multiple_choice"]

    planner_context_json = _compact_json({
        "services_summary": str(ctx.get("services_summary") or ctx.get("grounding_summary") or "").strip(),
        "answered_qa": ctx.get("answered_qa") if isinstance(ctx.get("answered_qa"), list) else [],
        "asked_step_ids": sorted(list(asked_ids)),
        "industry": str(ctx.get("industry") or "").strip(),
        "service": str(ctx.get("service") or "").strip(),
    })

    import dspy

    planner_lm_cfg = _make_refinements_lm_cfg()
    if not planner_lm_cfg:
        return {"ok": False, "error": "LM not configured", "requestId": request_id, "schemaVersion": "0"}

    planner_lm = dspy.LM(
        model=planner_lm_cfg["model"],
        temperature=float(planner_lm_cfg.get("temperature", 0.7)),
        max_tokens=int(planner_lm_cfg.get("max_tokens", 2048)),
        timeout=float(planner_lm_cfg.get("timeout", 30)),
    )

    program = RefinementsPlannerProgram()
    with dspy.context(lm=planner_lm):
        pred = program(
            planner_context_json=planner_context_json,
            max_steps=max_steps,
            allowed_mini_types=allowed_mini_types,
        )

    raw = str(getattr(pred, "refinement_plan_json", "") or "").strip()
    if not raw:
        return {
            "ok": True,
            "requestId": request_id,
            "schemaVersion": "1",
            "miniSteps": [],
        }

    try:
        parsed = json.loads(raw)
        plan = parsed.get("plan") if isinstance(parsed, dict) else []
    except Exception:
        plan = []

    if not isinstance(plan, list) or not plan:
        return {
            "ok": True,
            "requestId": request_id,
            "schemaVersion": "1",
            "miniSteps": [],
        }

    plan_items: List[Dict[str, Any]] = []
    for item in plan:
        if not isinstance(item, dict):
            continue
        key = normalize_plan_key(item.get("key"))
        if not key:
            continue
        sid = derive_step_id_from_key(key)
        if sid in asked_ids:
            continue
        plan_items.append(dict(item, key=key))
        if len(plan_items) >= max_steps:
            break

    choice_min = ctx.get("choice_option_min", 4)
    choice_max = ctx.get("choice_option_max", 10)
    choice_target = ctx.get("choice_option_target", 6)
    budget_hint = ctx.get("budget_bounds_hint")

    emitted = render_plan_items_to_mini_steps(
        plan_items,
        choice_option_min=choice_min,
        choice_option_max=choice_max,
        choice_option_target=choice_target,
        budget_bounds_hint=budget_hint,
    )

    latency_ms = int((time.time() - start_time) * 1000)
    if os.getenv("AI_FORM_DEBUG") == "true":
        print(f"[Refinements] requestId={request_id} steps={len(emitted)} latencyMs={latency_ms}", flush=True)

    return {
        "ok": True,
        "requestId": request_id,
        "schemaVersion": "1",
        "miniSteps": emitted,
    }


__all__ = ["refinements_jsonl"]
