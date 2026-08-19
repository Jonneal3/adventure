"""
Two-question intake planner for Adventure V8.

Service step: present (or skip) the business's offerings.
Scope step: deterministic vertical configuration — no runtime Groq.
"""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

from programs.adventure_pipeline.llm import run_json_signature
from programs.adventure_pipeline.recipes import scope_question_for_service


_OTHER = re.compile(r"^other$", re.I)
_NON_CUSTOMER = re.compile(
    r"consult|inspection|permit|estimate only|maintenance plan|warranty|hoa|financing",
    re.I,
)


def _clean(value: Any, limit: int = 160) -> str:
    return str(value or "").strip()[:limit]


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", _clean(text, 80).lower()).strip("-")
    return slug[:48] or "choice"


def _truthy_skip(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value or "").strip().lower() in ("true", "1", "yes", "skip")


def _services_from_payload(payload: Dict[str, Any]) -> List[Dict[str, Any]]:
    raw = payload.get("services") or payload.get("serviceOptions") or []
    design = payload.get("design") if isinstance(payload.get("design"), dict) else {}
    if not raw and isinstance(design.get("services"), list):
        raw = design.get("services")
    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw if isinstance(raw, list) else []:
        if not isinstance(item, dict):
            continue
        sid = _clean(item.get("id") or item.get("value") or item.get("serviceId"), 80)
        business = _clean(
            item.get("businessLabel") or item.get("serviceName") or item.get("label") or item.get("name")
        )
        customer = _clean(item.get("customerLabel") or item.get("label") or business)
        if not sid or not (customer or business):
            continue
        if sid in seen:
            continue
        seen.add(sid)
        components = []
        for comp in item.get("components") or item.get("subcategoryComponents") or []:
            if not isinstance(comp, dict):
                continue
            label = _clean(comp.get("label") or comp.get("key"), 80)
            if label:
                components.append({"key": _clean(comp.get("key") or _slug(label), 48), "label": label})
        known = []
        for part in item.get("knownParts") or item.get("subcategoryScope") or item.get("scopes") or []:
            label = _clean(part, 80) if not isinstance(part, dict) else _clean(part.get("label") or part.get("id"), 80)
            if label and not _OTHER.match(label):
                known.append(label)
        out.append(
            {
                "id": sid,
                "businessLabel": business or customer,
                "customerLabel": customer or business,
                "industry": _clean(item.get("industry") or item.get("industryName"), 80) or None,
                "summary": _clean(item.get("summary") or item.get("serviceSummary"), 400) or None,
                "components": components,
                "knownParts": known,
            }
        )
    return out[:16]


def _selected_service(payload: Dict[str, Any], services: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    design = payload.get("design") if isinstance(payload.get("design"), dict) else {}
    sid = _clean(
        payload.get("selectedServiceId")
        or payload.get("serviceId")
        or design.get("serviceId")
        or design.get("service_id"),
        80,
    )
    if sid:
        for svc in services:
            if svc["id"] == sid:
                return svc
    if len(services) == 1:
        return services[0]
    return None


def _choice(
    *,
    label: str,
    choice_id: str | None = None,
    service_id: str | None = None,
    hint: str | None = None,
    role: str | None = None,
) -> Dict[str, Any]:
    text = _clean(label, 48)
    return {
        "id": _clean(choice_id or _slug(text), 48) or _slug(text),
        "label": text,
        "serviceId": _clean(service_id, 80) or None,
        "hint": _clean(hint, 72) or None,
        "role": role,
    }


def _fallback_service(services: List[Dict[str, Any]]) -> Dict[str, Any]:
    visual = [s for s in services if not _NON_CUSTOMER.search(f"{s['businessLabel']} {s['summary'] or ''}")] or services
    if len(visual) <= 1:
        chosen = visual[0] if visual else (services[0] if services else None)
        return {
            "step": "service",
            "skip": True,
            "selectedServiceId": chosen["id"] if chosen else None,
            "question": "",
            "subtitle": "",
            "selectionType": "single",
            "choices": [],
            "allowOther": False,
            "source": "fallback",
        }
    return {
        "step": "service",
        "skip": False,
        "selectedServiceId": None,
        "question": "What would you like help with?",
        "subtitle": "Pick one — we'll keep it simple.",
        "selectionType": "single",
        "choices": [
            _choice(label=s["customerLabel"], choice_id=s["id"], service_id=s["id"]) for s in visual
        ],
        "allowOther": False,
        "source": "fallback",
    }


def _fallback_scope(service: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    return scope_question_for_service(service)


def _bind_service_choices(raw: Any, services: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    by_id = {s["id"]: s for s in services}
    by_label: Dict[str, Dict[str, Any]] = {}
    for svc in services:
        for key in (svc["id"], svc["customerLabel"], svc["businessLabel"]):
            by_label[_clean(key).lower()] = svc

    out: List[Dict[str, Any]] = []
    seen: set[str] = set()
    for item in raw if isinstance(raw, list) else []:
        if isinstance(item, str):
            label, sid, hint, cid = item, "", "", ""
        elif isinstance(item, dict):
            label = _clean(item.get("label") or item.get("name"), 48)
            sid = _clean(item.get("serviceId") or item.get("id") or item.get("value"), 80)
            hint = _clean(item.get("hint") or item.get("description"), 72)
            cid = _clean(item.get("id"), 48)
        else:
            continue
        svc = by_id.get(sid) or by_label.get(label.lower()) or by_label.get(sid.lower())
        if not svc:
            continue
        if svc["id"] in seen:
            continue
        seen.add(svc["id"])
        out.append(
            _choice(
                label=label or svc["customerLabel"],
                choice_id=cid or svc["id"],
                service_id=svc["id"],
                hint=hint,
            )
        )
        if len(out) >= 8:
            break
    return out


def _finalize_service(services: List[Dict[str, Any]], llm: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    fallback = _fallback_service(services)
    if not services:
        return {**fallback, "ok": True}
    if len(services) == 1:
        return {**fallback, "skip": True, "selectedServiceId": services[0]["id"], "ok": True}

    parsed = llm if isinstance(llm, dict) else None
    if parsed and _truthy_skip(parsed.get("skip")):
        sid = _clean(parsed.get("selectedServiceId") or parsed.get("selected_service_id"), 80)
        match = next((s for s in services if s["id"] == sid), None)
        if match:
            return {
                **fallback,
                "skip": True,
                "selectedServiceId": match["id"],
                "source": "llm",
                "ok": True,
            }

    choices = _bind_service_choices((parsed or {}).get("choices"), services) if parsed else []
    if len(choices) <= 1:
        if len(choices) == 1:
            return {
                "step": "service",
                "skip": True,
                "selectedServiceId": choices[0].get("serviceId") or services[0]["id"],
                "question": "",
                "subtitle": "",
                "selectionType": "single",
                "choices": [],
                "allowOther": False,
                "source": "llm" if parsed else "fallback",
                "ok": True,
            }
        return {**fallback, "ok": True}

    question = _clean((parsed or {}).get("question"), 80) or fallback["question"]
    subtitle = _clean((parsed or {}).get("subtitle"), 140)
    return {
        "step": "service",
        "skip": False,
        "selectedServiceId": None,
        "question": question,
        "subtitle": subtitle or fallback["subtitle"],
        "selectionType": "single",
        "choices": choices,
        "allowOther": False,
        "source": "llm",
        "ok": True,
    }


def _finalize_scope(service: Optional[Dict[str, Any]], llm: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    # Scope is curated configuration. Ignore any model output.
    del llm
    return scope_question_for_service(service)


def _llm_payload(
    *,
    step: str,
    payload: Dict[str, Any],
    services: List[Dict[str, Any]],
    selected: Optional[Dict[str, Any]],
) -> Dict[str, Any]:
    design = payload.get("design") if isinstance(payload.get("design"), dict) else {}
    return {
        "step": step,
        "objective": (
            "You have up to two steps to narrow this customer's intent into a useful rough scope of work. "
            "Determine the best question and choices to accomplish that with as little friction as possible."
        ),
        "businessName": _clean(payload.get("businessName") or payload.get("brandName") or design.get("brandName"), 80),
        "services": services,
        "selectedService": selected,
    }


def plan_intake(payload: Dict[str, Any], llm_result: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    body = payload if isinstance(payload, dict) else {}
    step = _clean(body.get("step") or body.get("intakeStep") or "service", 16).lower()
    if step not in ("service", "scope"):
        step = "service"
    services = _services_from_payload(body)
    selected = _selected_service(body, services)

    parsed = llm_result
    # Scope is vertical config — never call Groq. Service still may, when there are several offerings.
    if parsed is None and step == "service" and len(services) > 1:
        from programs.adventure_pipeline.signatures import IntakeSignature

        parsed = run_json_signature(
            signature=IntakeSignature,
            input_field="intake_json",
            output_field="question_json",
            payload=_llm_payload(step=step, payload=body, services=services, selected=selected),
            module_env_prefix="DSPY_ADVENTURE_INTAKE",
            default_temperature=0.0,
            default_max_tokens=500,
            default_timeout=18.0,
        )

    if step == "scope":
        result = _finalize_scope(selected, parsed)
    else:
        result = _finalize_service(services, parsed)
    result["ok"] = True
    return result


__all__ = ["plan_intake"]
