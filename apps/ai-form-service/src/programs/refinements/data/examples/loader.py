from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from programs.dspy_demos import as_dspy_examples


def _compact_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=True, separators=(",", ":"), sort_keys=True)


def _load_refinement_examples() -> list[dict]:
    path = Path(__file__).with_name("refinement_examples.json")
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return []
    return data if isinstance(data, list) else []


def _ensure_json_str(v: Any) -> str:
    if isinstance(v, (dict, list)):
        return _compact_json(v)
    return str(v or "").strip()


def default_refinement_demos():
    """Load refinement examples and convert to DSPy format."""
    records: list[dict] = []
    for item in _load_refinement_examples():
        if not isinstance(item, dict):
            continue
        if "planner_context_json" not in item or "refinement_plan_json" not in item:
            continue
        inputs = {
            "planner_context_json": item.get("planner_context_json"),
            "max_steps": item.get("max_steps", 8),
            "allowed_mini_types": item.get("allowed_mini_types", ["multiple_choice"]),
        }
        outputs = {"refinement_plan_json": item.get("refinement_plan_json")}
        inputs["planner_context_json"] = _ensure_json_str(inputs.get("planner_context_json"))
        outputs["refinement_plan_json"] = _ensure_json_str(outputs.get("refinement_plan_json"))
        if not str(inputs.get("planner_context_json") or "").strip():
            continue
        if not outputs.get("refinement_plan_json"):
            continue
        records.append({"inputs": inputs, "outputs": outputs})
    return as_dspy_examples(
        records,
        input_keys=["planner_context_json", "max_steps", "allowed_mini_types"],
    )


__all__ = ["default_refinement_demos"]
