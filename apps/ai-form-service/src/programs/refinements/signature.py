from __future__ import annotations

import dspy

from programs.refinements.prompt_library import build_refinements_prompt


class RefinementsPlannerSignature(dspy.Signature):
    """
    Refinements planner signature.
    Same input shape as QuestionPlanner; output is refinement_plan_json.
    """

    planner_context_json: str = dspy.InputField(
        desc=(
            "JSON string ONLY. Refinement context + memory (services_summary, industry/service, answered_qa, asked_step_ids, "
            "and optional copy/form constraints)."
        )
    )
    max_steps: int = dspy.InputField(desc="Target refinement plan size. Must emit 5-10 items and never exceed this maximum.")
    allowed_mini_types: list[str] = dspy.InputField(desc="Allowed UI step types. Use multiple_choice for every refinement step.")
    refinement_plan_json: str = dspy.OutputField(
        desc=(
            "JSON string ONLY. Single object with top-level `plan` array. Each item must include: "
            "key (snake_case), question (user-facing), type_hint='multiple_choice', and option_hints as array of "
            "{label, value, image_prompt}. Every option MUST include image_prompt for thumbnail generation. "
            "Questions should be service-specific stylistic inpainting refinements (fixtures, materials, finishes, layout accents, etc.), "
            "not generic mood prompts."
        )
    )


RefinementsPlannerSignature.__doc__ = build_refinements_prompt()

__all__ = ["RefinementsPlannerSignature"]
