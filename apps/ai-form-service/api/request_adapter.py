from __future__ import annotations

from typing import Any, Dict


def to_next_steps_payload(*, instance_id: str, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert the canonical NewBatchRequest body into the internal dict shape expected by
    `programs.form_pipeline.orchestrator.next_steps_jsonl`.

    This is intentionally small: the API layer stays boring, and all request shaping lives here.
    """
    if not isinstance(body, dict):
        return {"session": {"instanceId": str(instance_id), "sessionId": ""}}

    out = dict(body)

    # Back-compat: some upstreams wrap the canonical payload as `{ body: {...} }`.
    inner = out.get("body")
    if isinstance(inner, dict):
        for k, v in inner.items():
            if k not in out or out.get(k) in (None, "", {}, []):
                out[k] = v
        out.pop("body", None)

    # Carry instance/session identifiers in a consistent place for downstream correlation.
    sess = out.get("session") if isinstance(out.get("session"), dict) else {}
    session_id = str(
        out.get("sessionId")
        or out.get("session_id")
        or (sess.get("sessionId") if isinstance(sess, dict) else None)
        or (sess.get("session_id") if isinstance(sess, dict) else None)
        or ""
    )
    out["session"] = {"instanceId": str(instance_id), "sessionId": session_id}

    # Canonical keys used by the generator.
    state = out.get("state") if isinstance(out.get("state"), dict) else {}

    if "stepDataSoFar" not in out:
        out["stepDataSoFar"] = (
            out.get("knownAnswers")
            or out.get("known_answers")
            or (state.get("answers") if isinstance(state.get("answers"), dict) else None)
            or {}
        )

    # Merge top-level budgetRange into stepDataSoFar so server-side prompt logic has budget.
    step_data = out.get("stepDataSoFar")
    if isinstance(step_data, dict):
        budget_raw = out.get("budgetRange") or out.get("budget_range") or out.get("budget")
        if budget_raw is not None and budget_raw != "":
            try:
                budget_val = int(float(str(budget_raw)))
            except (TypeError, ValueError):
                budget_val = str(budget_raw)
            for key in ("budget_range", "budgetRange", "step-budget-range"):
                if key not in step_data or step_data.get(key) in (None, ""):
                    step_data = {**step_data, key: budget_val}
            out["stepDataSoFar"] = step_data

    if "askedStepIds" not in out:
        out["askedStepIds"] = (
            out.get("alreadyAskedKeys")
            or out.get("already_asked_keys")
            or (state.get("askedStepIds") if isinstance(state.get("askedStepIds"), list) else None)
            or (state.get("asked_step_ids") if isinstance(state.get("asked_step_ids"), list) else None)
            or []
        )

    if "answeredQA" not in out:
        aqa = state.get("answeredQA") or state.get("answered_qa")
        if isinstance(aqa, list):
            out["answeredQA"] = aqa

    # Preserve the OpenAPI field name as-is; orchestrator will read from `instanceContext`.
    if "instance_context" in out and "instanceContext" not in out:
        out["instanceContext"] = out.get("instance_context")
    if "instanceContext" not in out:
        ctx = state.get("context")
        if isinstance(ctx, dict):
            out["instanceContext"] = ctx

    # Pass through preview image URL for pricing (VLM analyzes the image when present).
    for key in ("previewImageUrl", "preview_image_url", "imageUrl", "image_url"):
        val = out.get(key)
        if val is not None and val != "":
            if "previewImageUrl" not in out:
                out["previewImageUrl"] = val
            break

    return out

