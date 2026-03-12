from __future__ import annotations

import os
import json
import uuid
from typing import Any, Dict

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.status import HTTP_422_UNPROCESSABLE_ENTITY

from api.request_adapter import to_next_steps_payload
from api.utils import http_status_for_pipeline_response, load_contract_schema, now_ms
from programs.form_pipeline.orchestrator import next_steps_jsonl
from programs.refinements.orchestrator import refinements_jsonl
from schemas.api_models import NewBatchRequest, FormResponse


def register(router: APIRouter, compat_router: APIRouter | None = None) -> None:
    @router.get("/form/capabilities")
    def capabilities() -> Dict[str, Any]:
        return {"ok": True, **load_contract_schema()}

    async def _handle_form(instanceId: str, payload: Dict[str, Any]) -> Any:
        from api.openapi_contract import validate_new_batch_request, validate_new_batch_response

        log_io = str(os.getenv("AI_FORM_LOG_FORM_IO") or "").strip().lower() in {"1", "true", "yes", "y", "on"}
        api_request_id = f"form_{now_ms()}_{uuid.uuid4().hex[:8]}"

        try:
            parsed = NewBatchRequest.model_validate(payload)
        except ValidationError as exc:
            request_id = f"val_{now_ms()}_{uuid.uuid4().hex[:8]}"
            return JSONResponse(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "ok": False,
                    "error": "validation_error",
                    "message": "Request body did not match expected schema.",
                    "requestId": request_id,
                    "details": exc.errors(),
                },
            )

        body = parsed.model_dump(by_alias=True, exclude_none=True)
        validate_contract = os.getenv("AI_FORM_VALIDATE_CONTRACT") == "true"
        if validate_contract:
            validate_new_batch_request(body)

        if log_io:
            try:
                print(
                    json.dumps(
                        {
                            "event": "form_request",
                            "apiRequestId": api_request_id,
                            "instanceId": instanceId,
                            "sessionId": body.get("sessionId"),
                            "askedStepIdsCount": len(body.get("askedStepIds") or []),
                            "stepDataSoFarKeysCount": len((body.get("stepDataSoFar") or {}).keys()),
                            "generateOptionImages": body.get("generateOptionImages") or body.get("optionImages"),
                            "serviceSummaryLen": len(str(body.get("serviceSummary") or "")),
                        },
                        ensure_ascii=True,
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                    flush=True,
                )
            except Exception:
                pass

        payload_dict = to_next_steps_payload(instance_id=instanceId, body=body)
        resp = next_steps_jsonl(payload_dict)

        if validate_contract:
            validate_new_batch_response(resp)

        if log_io:
            try:
                steps = resp.get("miniSteps") if isinstance(resp, dict) else None
                steps_list = steps if isinstance(steps, list) else []
                type_counts: dict[str, int] = {}
                image_choice_grids = 0
                any_image_url = False
                for s in steps_list:
                    if not isinstance(s, dict):
                        continue
                    t = str(s.get("type") or "").strip()
                    if t:
                        type_counts[t] = type_counts.get(t, 0) + 1
                    if t == "image_choice_grid":
                        image_choice_grids += 1
                        opts = s.get("options")
                        if isinstance(opts, list):
                            for o in opts:
                                if isinstance(o, dict) and isinstance(o.get("imageUrl"), str) and o.get("imageUrl").strip():
                                    any_image_url = True
                                    break
                print(
                    json.dumps(
                        {
                            "event": "form_response",
                            "apiRequestId": api_request_id,
                            "requestId": (resp.get("requestId") if isinstance(resp, dict) else None),
                            "ok": (resp.get("ok") if isinstance(resp, dict) else None),
                            "miniStepsCount": len(steps_list),
                            "typeCounts": type_counts,
                            "imageChoiceGridSteps": image_choice_grids,
                            "anyImageUrl": any_image_url,
                        },
                        ensure_ascii=True,
                        separators=(",", ":"),
                        sort_keys=True,
                    ),
                    flush=True,
                )
            except Exception:
                pass

        status = http_status_for_pipeline_response(resp)
        headers: Dict[str, str] = {}
        try:
            if isinstance(resp, dict) and isinstance(resp.get("rateLimit"), dict):
                rl = resp.get("rateLimit") or {}
                retry_after = rl.get("appLimiter", {}).get("retryAfterSec") if isinstance(rl.get("appLimiter"), dict) else None
                if isinstance(retry_after, (int, float)) and retry_after > 0 and status == 429:
                    headers["Retry-After"] = str(int(max(1, retry_after)))
                # Small, stable debug headers (avoid huge JSON blobs).
                if isinstance(rl.get("appLimiter"), dict):
                    headers["x-ai-form-rl-store"] = str(rl["appLimiter"].get("store") or "")[:80]
                    headers["x-ai-form-rl-model"] = str(rl["appLimiter"].get("model") or "")[:120]
                    # Expose the tightest remaining minute window we can find (global+session).
                    windows = rl["appLimiter"].get("windows")
                    if isinstance(windows, list):
                        for w in windows:
                            if not isinstance(w, dict):
                                continue
                            if str(w.get("window")) != "minute":
                                continue
                            scope = str(w.get("scope") or "")
                            if scope in {"global", "session"}:
                                headers[f"x-ai-form-rl-{scope}-minute-remaining-requests"] = str(int(w.get("remainingRequests") or 0))
                                headers[f"x-ai-form-rl-{scope}-minute-remaining-tokens"] = str(int(w.get("remainingTokens") or 0))
        except Exception:
            headers = headers or {}

        return JSONResponse(status_code=status, content=resp, headers=headers)

    @router.post(
        "/form/{instanceId}",
        response_model=FormResponse,
        response_model_exclude_none=True,
        description="Generates the next batch of UI steps. Requires instanceId in the URL.",
    )
    async def form(
        instanceId: str,
        payload: Dict[str, Any] = Body(default_factory=dict),
    ) -> Any:
        return await _handle_form(instanceId, payload)

    # Legacy/widget route: some clients call this instead of /form/{instanceId}.
    @router.post("/ai-form/{instanceId}/generate-steps")
    async def generate_steps(instanceId: str, payload: Dict[str, Any] = Body(default_factory=dict)) -> Any:
        return await _handle_form(instanceId, payload)

    @router.post(
        "/form/{instanceId}/refinements",
        response_model=FormResponse,
        response_model_exclude_none=True,
        description="Generates refinement questions for post-concept exploration. Same payload shape as /form/{instanceId}.",
    )
    async def refinements(instanceId: str, payload: Dict[str, Any] = Body(default_factory=dict)) -> Any:
        payload_dict = to_next_steps_payload(instance_id=instanceId, body=payload)
        payload_dict["instanceId"] = instanceId
        payload_dict["instance_id"] = instanceId
        resp = refinements_jsonl(payload_dict)
        status = http_status_for_pipeline_response(resp)
        return JSONResponse(status_code=status, content=resp)

    if compat_router is not None:
        @compat_router.post("/ai-form/{instanceId}/generate-steps")
        async def generate_steps_compat(instanceId: str, payload: Dict[str, Any] = Body(default_factory=dict)) -> Any:
            return await _handle_form(instanceId, payload)

