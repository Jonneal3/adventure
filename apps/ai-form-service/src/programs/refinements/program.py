from __future__ import annotations

import json
import re

import dspy

from programs.dspy_demos import as_dspy_examples, load_jsonl_records
from programs.refinements.data.examples.loader import default_refinement_demos
from programs.refinements.signature import RefinementsPlannerSignature


def _extract_first_plan_json_object(text: str) -> dict | None:
    """Extract first JSON object with top-level `plan` list."""
    s = str(text or "")
    if not s:
        return None
    i = 0
    while True:
        start = s.find("{", i)
        if start < 0:
            return None
        depth = 0
        in_str = False
        esc = False
        for j in range(start, len(s)):
            ch = s[j]
            if in_str:
                if esc:
                    esc = False
                    continue
                if ch == "\\":
                    esc = True
                    continue
                if ch == '"':
                    in_str = False
                continue
            if ch == '"':
                in_str = True
                continue
            if ch == "{":
                depth += 1
            elif ch == "}":
                depth -= 1
                if depth == 0:
                    blob = s[start : j + 1]
                    try:
                        parsed = json.loads(blob)
                    except Exception:
                        break
                    if isinstance(parsed, dict) and isinstance(parsed.get("plan"), list):
                        return parsed
                    break
        i = start + 1


def _strip_code_fences(s: str) -> str:
    if not s:
        return s
    t = str(s).strip()
    t = re.sub(r"^```(?:json)?\s*", "", t, flags=re.IGNORECASE)
    t = re.sub(r"\s*```$", "", t, flags=re.IGNORECASE)
    return t.strip()


def _sanitize_refinement_plan_json(raw: object) -> str:
    text = _strip_code_fences(str(raw or "").strip())
    if not text:
        return ""
    try:
        loaded = json.loads(text)
        if isinstance(loaded, dict) and isinstance(loaded.get("plan"), list):
            return json.dumps(loaded, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    except Exception:
        pass
    parsed = _extract_first_plan_json_object(text)
    if parsed:
        return json.dumps(parsed, ensure_ascii=True, separators=(",", ":"), sort_keys=True)
    return text


class RefinementsPlannerProgram(dspy.Module):
    """DSPy wrapper for the refinements planner."""

    def __init__(self, *, demo_pack: str = "") -> None:
        super().__init__()
        self.prog = dspy.Predict(RefinementsPlannerSignature)
        demos = []
        if demo_pack:
            demos = as_dspy_examples(
                load_jsonl_records(demo_pack),
                input_keys=["planner_context_json", "max_steps", "allowed_mini_types"],
            )
        if not demos:
            demos = default_refinement_demos()
        if demos:
            setattr(self.prog, "demos", demos)

    def forward(
        self,
        *,
        planner_context_json: str,
        max_steps: int,
        allowed_mini_types: list[str],
    ):
        pred = self.prog(
            planner_context_json=planner_context_json,
            max_steps=max_steps,
            allowed_mini_types=allowed_mini_types,
        )
        try:
            cleaned = _sanitize_refinement_plan_json(getattr(pred, "refinement_plan_json", None))
            if cleaned:
                setattr(pred, "refinement_plan_json", cleaned)
        except Exception:
            pass
        return pred


__all__ = ["RefinementsPlannerProgram"]
