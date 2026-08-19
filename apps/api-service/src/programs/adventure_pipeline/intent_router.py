"""
Intent → image strategy routing for Adventure V7.

Given a customer instruction (already interpreted into a Modification), decide
the cheapest path that can satisfy it: retrieve, edit, generate, or none.
"""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass
from typing import Any, Dict, Literal, Optional

from programs.adventure_pipeline.schemas import DesignState, Modification


Strategy = Literal["none", "retrieve", "edit", "generate", "retrieve_then_generate"]


@dataclass
class ImagePlan:
    strategy: Strategy
    reason: str
    use_case: str = "scene"
    num_outputs: int = 1
    prefer_library: bool = False
    budget_bias: Literal["down", "up", "hold"] = "hold"
    # When retrieve: how many library tiles to pull before considering gen fill.
    retrieve_limit: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)


_MORE_LIKE = re.compile(r"more like this|similar|same vibe|same feel", re.I)
_DIFFERENT = re.compile(r"another style|different|something else|try another|show me something", re.I)
_EDIT_PART = re.compile(
    r"\b(change|swap|replace|update|redo)\b.+\b(vanity|tile|cabinet|counter|fixture|planting|hardscape|lighting|mirror|shower)\b"
    r"|\b(vanity|tile|cabinet|counter|fixture|planting|hardscape|lighting|mirror|shower)\b.+\b(change|swap|replace)\b",
    re.I,
)


def plan_for_mode(
    *,
    mode: str,
    design: DesignState,
    modification: Optional[Modification] = None,
    instruction: str = "",
    library_count: int = 0,
    requested: int = 8,
) -> ImagePlan:
    """Top-level plan for inspiration / ideas / refine."""
    key = str(mode or "").strip().lower()
    instr = (instruction or design.refine_note or "").strip()

    if key == "inspiration":
        # Photo path: still retrieve for adjacent looks, but prefer generating from the space.
        from_photo = str(design.start_path or "").strip().lower() == "photo" and bool(design.photo_url)
        if from_photo and library_count > 0:
            return ImagePlan(
                strategy="retrieve_then_generate",
                reason="Photo start: retrieve a few library references, generate from the space.",
                use_case="scene",
                num_outputs=requested,
                prefer_library=True,
                retrieve_limit=max(1, requested // 4),
            )
        if from_photo:
            return ImagePlan(
                strategy="generate",
                reason="Photo start with empty library — generate from the uploaded space.",
                use_case="scene",
                num_outputs=requested,
            )
        if library_count > 0:
            return ImagePlan(
                strategy="retrieve_then_generate",
                reason="Inspiration prefers curated library, then fills gaps.",
                use_case="scene",
                num_outputs=requested,
                prefer_library=True,
                retrieve_limit=max(1, (requested * 2) // 3),
            )
        return ImagePlan(
            strategy="generate",
            reason="No library candidates — generate inspiration set.",
            use_case="scene",
            num_outputs=requested,
        )

    if key in ("ideas", "explore"):
        if library_count >= 2:
            return ImagePlan(
                strategy="retrieve_then_generate",
                reason="Exploration hybrid: proven library + taste-driven generations.",
                use_case="scene",
                num_outputs=requested,
                prefer_library=True,
                retrieve_limit=max(1, requested // 3),
            )
        return ImagePlan(
            strategy="generate",
            reason="Exploration needs taste-driven candidates; library thin.",
            use_case="scene",
            num_outputs=requested,
        )

    if key in ("refine", "adjust", "final"):
        return plan_for_instruction(
            design=design,
            modification=modification,
            instruction=instr,
            library_count=library_count,
            mode=key,
        )

    return ImagePlan(strategy="generate", reason=f"Default generate for mode={key}", use_case="scene", num_outputs=requested)


def plan_for_instruction(
    *,
    design: DesignState,
    modification: Optional[Modification] = None,
    instruction: str = "",
    library_count: int = 0,
    mode: str = "refine",
) -> ImagePlan:
    """Map a refine/consult instruction onto retrieve / edit / generate."""
    text = (instruction or "").strip()
    mod = modification
    intent = (mod.intent if mod else "other") or "other"
    direction = (mod.budget_direction if mod else "hold") or "hold"

    if not text and mode != "final":
        return ImagePlan(strategy="none", reason="No instruction — keep current design.", use_case="scene", num_outputs=0)

    if mode == "final":
        return ImagePlan(
            strategy="generate",
            reason="Final design uses the best-quality generation pass.",
            use_case="scene-refinement" if design.selected_idea_url else "scene",
            num_outputs=1,
        )

    # Explicit visual intents first — don't let a misread budget intent override them.
    if _MORE_LIKE.search(text):
        return ImagePlan(
            strategy="edit" if design.selected_idea_url else "generate",
            reason="More-like-this: generate close variations of the selected image.",
            use_case="scene-refinement" if design.selected_idea_url else "scene",
            num_outputs=1,
        )

    if _EDIT_PART.search(text) or intent in ("material_change", "feature_add", "feature_remove", "layout_change"):
        return ImagePlan(
            strategy="edit" if design.selected_idea_url else "generate",
            reason="Part/material change: editing model on the selected scene.",
            use_case="scene-refinement" if design.selected_idea_url else "scene",
            num_outputs=1,
        )

    if _DIFFERENT.search(text) or intent == "style_shift":
        if library_count > 0:
            return ImagePlan(
                strategy="retrieve_then_generate",
                reason="Style change: retrieve alternate looks first.",
                use_case="scene",
                num_outputs=1,
                prefer_library=True,
                retrieve_limit=1,
            )
        return ImagePlan(
            strategy="generate",
            reason="Style change: generate a new direction.",
            use_case="scene",
            num_outputs=1,
        )

    # Budget moves: retrieve cheaper/premium band first when we have library depth.
    if intent == "cheaper" or direction == "down" or _looks_cheaper(text):
        if library_count > 0:
            return ImagePlan(
                strategy="retrieve_then_generate",
                reason="Spend-less: try lower-budget library first, then generate a cheaper variant.",
                use_case="scene-refinement" if design.selected_idea_url else "scene",
                num_outputs=1,
                prefer_library=True,
                budget_bias="down",
                retrieve_limit=1,
            )
        return ImagePlan(
            strategy="edit" if design.selected_idea_url else "generate",
            reason="Spend-less: edit current design toward simpler materials.",
            use_case="scene-refinement" if design.selected_idea_url else "scene",
            num_outputs=1,
            budget_bias="down",
        )

    if intent == "premium" or direction == "up" or _looks_premium(text):
        if library_count > 0 and not design.selected_idea_url:
            return ImagePlan(
                strategy="retrieve_then_generate",
                reason="Spend-more: elevate via premium library then generate.",
                use_case="scene",
                num_outputs=1,
                prefer_library=True,
                budget_bias="up",
                retrieve_limit=1,
            )
        return ImagePlan(
            strategy="edit" if design.selected_idea_url else "generate",
            reason="Spend-more: edit current design with richer materials.",
            use_case="scene-refinement" if design.selected_idea_url else "scene",
            num_outputs=1,
            budget_bias="up",
        )

    # Default refine path.
    return ImagePlan(
        strategy="edit" if design.selected_idea_url else "generate",
        reason="General refine instruction.",
        use_case="scene-refinement" if design.selected_idea_url else "scene",
        num_outputs=1,
    )


def _looks_cheaper(text: str) -> bool:
    return bool(re.search(r"spend less|afford|cheap|save|simpler|budget|less expensive", text, re.I))


def _looks_premium(text: str) -> bool:
    return bool(re.search(r"spend more|elevat|premium|upgrade|luxur|richer|nicer", text, re.I))


__all__ = ["ImagePlan", "plan_for_mode", "plan_for_instruction"]
