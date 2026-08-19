"""
AI consultation for Adventure V7.

The model never computes prices. It receives the pricing engine's estimate plus
the deterministic levers, and either answers with those facts or hands a
structured instruction back to the design pipeline.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from programs.adventure_pipeline.llm import run_json_signature
from programs.adventure_pipeline.ontology import savings_levers, upgrade_levers
from programs.adventure_pipeline.schemas import DesignState


_CHANGE = re.compile(
    r"\b(make|change|add|remove|swap|replace|try|show|simplify|upgrade|more|less|darker|lighter|warmer)\b",
    re.I,
)
_MONEY = re.compile(r"\b(price|cost|budget|afford|save|cheap|under|quote|expensive)\b", re.I)
# "What would save me $3k?" is a question about the design, not permission to change it.
_ASKING = re.compile(r"^\s*(what|which|how much|how many|why|is|are|does|do|can i|could i|would)\b", re.I)
_IMPERATIVE = re.compile(
    r"\b(make|change|add|remove|swap|replace|simplify|upgrade|downgrade|try|show me|redo|update)\b",
    re.I,
)


def _money(value: float) -> str:
    return f"${int(round(value)):,}"


def _lever_lines(levers: List[Dict[str, Any]]) -> str:
    return "; ".join(f"{l.get('label')} (about {_money(float(l.get('amount') or 0))})" for l in levers[:3])


def _fallback_reply(
    *,
    question: str,
    design: DesignState,
    estimate: Optional[Dict[str, Any]],
    levers: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if _MONEY.search(question):
        if estimate and estimate.get("rangeLow") and estimate.get("rangeHigh"):
            span = f"{_money(float(estimate['rangeLow']))}–{_money(float(estimate['rangeHigh']))}"
            reply = f"This design is tracking around {span}. Options that bring it down: {_lever_lines(levers)}."
        else:
            reply = f"Options that bring the cost down: {_lever_lines(levers)}."
        return {"reply": reply, "action": "none", "instruction": "", "levers": [l.get("label") for l in levers[:3]]}

    if _CHANGE.search(question) and not (_ASKING.search(question) and not _IMPERATIVE.search(question)):
        return {"reply": "Updating the design now.", "action": "modify", "instruction": question.strip()[:200], "levers": []}

    scope = design.scope or "project"
    return {
        "reply": f"Noted — I'll use that for your {scope.lower()} direction.",
        "action": "none",
        "instruction": "",
        "levers": [],
    }


def _levers_from(raw: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label") or "").strip()
        try:
            amount = int(float(item.get("amount") or 0))
        except (TypeError, ValueError):
            amount = 0
        if label and amount > 0:
            out.append({"label": label, "delta": str(item.get("delta") or label), "amount": amount})
    return out


def consult(
    *,
    design: DesignState,
    question: str,
    estimate: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    text = str(question or "").strip()
    service = design.service_label or design.service_id
    # Reuse the levers the pricing engine already sized for this estimate when we have them.
    down = _levers_from(estimate.get("savingsLevers") if estimate else None) or savings_levers(
        service, design.scope, design.budget
    )
    up = _levers_from(estimate.get("upgradeLevers") if estimate else None) or upgrade_levers(
        service, design.scope, design.budget
    )
    fallback = _fallback_reply(question=text, design=design, estimate=estimate, levers=down)
    if not text:
        return {**fallback, "source": "rules", "savingsLevers": down, "upgradeLevers": up}

    confirmed = set(design.taste.confirmed_ids or [])
    payload: Dict[str, Any] = {
        "question": text[:400],
        "design": {
            "service": service,
            "scope": design.scope,
            "budget": int(design.budget or 0),
            "taste": [t.label for t in design.taste.tags if (not confirmed) or t.id in confirmed],
            "lastRequest": design.refine_note or "",
        },
        "estimate": {
            "rangeLow": int(float(estimate.get("rangeLow") or 0)) if estimate else 0,
            "rangeHigh": int(float(estimate.get("rangeHigh") or 0)) if estimate else 0,
        },
        "savingsLevers": [{"label": l["label"], "amount": l["amount"]} for l in down],
        "upgradeLevers": [{"label": l["label"], "amount": l["amount"]} for l in up],
    }

    from programs.adventure_pipeline.signatures import ConsultSignature

    parsed = run_json_signature(
        signature=ConsultSignature,
        input_field="consult_json",
        output_field="answer_json",
        payload=payload,
        module_env_prefix="DSPY_ADVENTURE_CONSULT",
        default_temperature=0.3,
        default_max_tokens=500,
    )
    if not isinstance(parsed, dict):
        return {**fallback, "source": "rules", "savingsLevers": down, "upgradeLevers": up}

    reply = str(parsed.get("reply") or "").strip()
    if not reply or len(reply) > 600:
        return {**fallback, "source": "rules", "savingsLevers": down, "upgradeLevers": up}

    action = str(parsed.get("action") or "none").strip().lower()
    if action not in ("modify", "none"):
        action = "none"
    # Answer questions with words; only regenerate when the customer actually asked for a change.
    if action == "modify" and _ASKING.search(text) and not _IMPERATIVE.search(text):
        action = "none"
    instruction = str(parsed.get("instruction") or "").strip()[:200]
    if action == "modify" and not instruction:
        instruction = text[:200]

    allowed = {str(l["label"]).lower() for l in down + up}
    referenced = [
        str(x).strip()
        for x in (parsed.get("levers") if isinstance(parsed.get("levers"), list) else [])
        if str(x).strip().lower() in allowed
    ]

    return {
        "reply": reply,
        "action": action,
        "instruction": instruction if action == "modify" else "",
        "levers": referenced,
        "source": "llm",
        "savingsLevers": down,
        "upgradeLevers": up,
    }


__all__ = ["consult"]
