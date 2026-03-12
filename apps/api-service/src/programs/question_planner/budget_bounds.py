"""
Shared budget bounds for service-aware slider calibration.

Used by context_builder (to pass budget_bounds_hint) and plan_to_steps (to derive
min/max/step when AI omits or provides invalid values).
"""

from __future__ import annotations

from typing import Optional, Tuple

SERVICE_BUDGET_BOUNDS: tuple[tuple[tuple[str, ...], tuple[int, int]], ...] = (
    (("bath", "bathroom"), (3000, 60000)),
    (("kitchen",), (10000, 120000)),
    (("paint", "painting"), (500, 20000)),
    (("floor", "flooring"), (1500, 30000)),
    (("roof",), (5000, 50000)),
    (("hvac",), (3000, 25000)),
    (("landscape", "yard"), (2000, 50000)),
    (("remodel", "renovation"), (5000, 150000)),
)

DEFAULT_BUDGET_BOUNDS: tuple[int, int] = (1000, 150000)


def infer_budget_bounds_hint(
    *,
    industry: str = "",
    service: str = "",
    services_summary: str = "",
) -> Tuple[int, int]:
    """
    Derive min/max bounds for budget slider from service context.

    Used when AI omits or provides invalid min/max so the renderer can fall back
    to service-aware defaults.
    """
    text = f"{industry} {service} {services_summary}".strip().lower()
    if not text:
        return DEFAULT_BUDGET_BOUNDS
    for hints, bounds in SERVICE_BUDGET_BOUNDS:
        if any(h in text for h in hints):
            return bounds
    return DEFAULT_BUDGET_BOUNDS


def ensure_budget_in_plan(plan_items: list, *, asked_step_ids: Optional[set] = None) -> list:
    """
    Ensure budget_range is present and last in the plan. Inject default if missing.
    Skip injection if budget was already asked.
    """
    asked = asked_step_ids or set()
    budget_key = "budget_range"
    budget_step_id = "step-budget-range"
    if budget_step_id in asked:
        return [x for x in plan_items if str(x.get("key") or "").strip() != budget_key]

    budget_items = [x for x in plan_items if str(x.get("key") or "").strip() == budget_key]
    non_budget = [x for x in plan_items if str(x.get("key") or "").strip() != budget_key]

    if budget_items:
        return [*non_budget, budget_items[0]]

    default_budget = {
        "key": budget_key,
        "question": "What budget range should we design around?",
        "type_hint": "slider",
        "min": DEFAULT_BUDGET_BOUNDS[0],
        "max": DEFAULT_BUDGET_BOUNDS[1],
        "step": 1000,
        "currency": "USD",
    }
    return [*non_budget, default_budget]


__all__ = [
    "SERVICE_BUDGET_BOUNDS",
    "DEFAULT_BUDGET_BOUNDS",
    "infer_budget_bounds_hint",
    "ensure_budget_in_plan",
]
