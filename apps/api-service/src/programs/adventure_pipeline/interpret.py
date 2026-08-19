"""
Instruction interpretation for Adventure V7.

"Make it more affordable" is not an image prompt. This layer turns a customer
sentence into a structured modification (what to add, avoid, keep, and which way
cost should move) that both the generation spec and the pricing engine can read.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List

from programs.adventure_pipeline.llm import run_json_signature
from programs.adventure_pipeline.ontology import (
    attribute_pool,
    spend_less_deltas,
    spend_more_deltas,
)
from programs.adventure_pipeline.schemas import DesignState, Modification


_CHEAPER = re.compile(r"spend less|afford|cheap|save|budget|simpler|simplify|less expensive|lower cost", re.I)
_PREMIUM = re.compile(r"spend more|elevat|premium|upgrade|luxur|richer|higher end|nicer", re.I)
_REMOVE = re.compile(r"\b(remove|drop|get rid of|without|no more)\b", re.I)
_ADD = re.compile(r"\b(add|include|put in|with a|more of)\b", re.I)
_LAYOUT = re.compile(r"layout|arrange|move|open up|bigger|smaller|wider", re.I)
_MATERIAL = re.compile(r"tile|stone|wood|paver|concrete|metal|material|finish|counter", re.I)


PHRASE_MAX_WORDS = 6


def _clean_phrases(raw: Any, *, limit: int) -> List[str]:
    out: List[str] = []
    seen: set[str] = set()
    for item in raw if isinstance(raw, list) else []:
        text = str(item or "").strip().strip(".,;")
        if not text or len(text) > 60:
            continue
        # Prices and questions belong to the pricing engine, not the image model.
        if "$" in text or "?" in text or re.search(r"\d{3,}", text):
            continue
        words = text.split()
        if len(words) > PHRASE_MAX_WORDS:
            text = " ".join(words[:PHRASE_MAX_WORDS])
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        out.append(text)
        if len(out) >= limit:
            break
    return out


def _rules_modification(design: DesignState, instruction: str) -> Modification:
    text = instruction.strip()
    service = design.service_label or design.service_id
    if _CHEAPER.search(text):
        return Modification(
            intent="cheaper",
            mustInclude=spend_less_deltas(service, design.scope),
            avoid=["ultra luxury finishes", "overly complex structures"],
            keep=["overall aesthetic"],
            budgetDirection="down",
            budgetDeltaPct=-0.12,
            summary="Simplifying the expensive parts while keeping the look.",
            source="rules",
        )
    if _PREMIUM.search(text):
        return Modification(
            intent="premium",
            mustInclude=spend_more_deltas(service, design.scope),
            avoid=["builder-grade finishes"],
            keep=["overall aesthetic"],
            budgetDirection="up",
            budgetDeltaPct=0.14,
            summary="Upgrading materials and detailing.",
            source="rules",
        )

    intent = "other"
    if _REMOVE.search(text):
        intent = "feature_remove"
    elif _MATERIAL.search(text):
        intent = "material_change"
    elif _ADD.search(text):
        intent = "feature_add"
    elif _LAYOUT.search(text):
        intent = "layout_change"

    must = [text] if text and len(text.split()) <= PHRASE_MAX_WORDS else []
    return Modification(
        intent=intent,
        mustInclude=must,
        avoid=[],
        keep=["overall aesthetic"],
        budgetDirection="hold",
        budgetDeltaPct=0.03 if intent != "other" else 0.0,
        summary="Adjusting the design to match that.",
        source="rules",
    )


def interpret_instruction(design: DesignState, instruction: str) -> Modification:
    """LLM reading of the instruction, with deterministic rules as the floor."""
    text = str(instruction or "").strip()
    if not text:
        return Modification(summary="", source="rules")

    fallback = _rules_modification(design, text)
    confirmed = set(design.taste.confirmed_ids or [])
    payload: Dict[str, Any] = {
        "instruction": text[:400],
        "design": {
            "service": design.service_label or design.service_id,
            "scope": design.scope,
            "budget": int(design.budget or 0),
            "taste": [t.label for t in design.taste.tags if (not confirmed) or t.id in confirmed],
        },
        "vocabulary": [label for _path, label in attribute_pool(design.service_label or design.service_id, design.scope)],
    }

    from programs.adventure_pipeline.signatures import InstructionInterpretSignature

    parsed = run_json_signature(
        signature=InstructionInterpretSignature,
        input_field="request_json",
        output_field="modification_json",
        payload=payload,
        module_env_prefix="DSPY_ADVENTURE_INTERPRET",
        default_temperature=0.2,
        default_max_tokens=600,
    )
    if not isinstance(parsed, dict):
        return fallback

    must = _clean_phrases(parsed.get("mustInclude") or parsed.get("must_include"), limit=8)
    avoid = _clean_phrases(parsed.get("avoid"), limit=8)
    keep = _clean_phrases(parsed.get("keep"), limit=6)
    if not must and not avoid:
        return fallback

    direction = str(parsed.get("budgetDirection") or parsed.get("budget_direction") or "hold").strip().lower()
    if direction not in ("down", "up", "hold"):
        direction = "hold"
    try:
        delta = float(parsed.get("budgetDeltaPct") or parsed.get("budget_delta_pct") or 0.0)
    except (TypeError, ValueError):
        delta = 0.0
    delta = max(-0.25, min(0.4, delta))
    if direction == "down":
        delta = min(delta, -0.04)
    elif direction == "up":
        delta = max(delta, 0.04)
    else:
        delta = max(-0.05, min(0.08, delta))

    intent = str(parsed.get("intent") or fallback.intent).strip().lower()[:32] or "other"
    summary = str(parsed.get("summary") or fallback.summary).strip()[:200]

    # Cost-direction requests still get the ontology's deterministic levers appended,
    # so the image model and the pricing engine stay in agreement.
    service = design.service_label or design.service_id
    if direction == "down":
        must = must + [d for d in spend_less_deltas(service, design.scope) if d not in must]
    elif direction == "up":
        must = must + [d for d in spend_more_deltas(service, design.scope) if d not in must]

    return Modification(
        intent=intent,
        mustInclude=must[:10],
        avoid=avoid[:8],
        keep=keep[:6] or ["overall aesthetic"],
        budgetDirection=direction,  # type: ignore[arg-type]
        budgetDeltaPct=delta,
        summary=summary,
        source="llm",
    )


__all__ = ["interpret_instruction"]
