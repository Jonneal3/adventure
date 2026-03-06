from __future__ import annotations

import json
from typing import Any, Dict

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.status import HTTP_422_UNPROCESSABLE_ENTITY

from api.request_adapter import to_next_steps_payload
from api.utils import extract_instance_id, http_status_for_pipeline_response, now_ms
from programs.pricing.orchestrator import estimate_pricing
from schemas.api_models import NewBatchRequest, PricingResponse


def register(router: APIRouter, compat_router: APIRouter) -> None:
    async def _pricing_impl(instanceId: str, payload: Any) -> JSONResponse:
        if isinstance(payload, str):
            try:
                payload = json.loads(payload)
            except Exception:
                payload = {"raw": payload}
        if not isinstance(payload, dict):
            request_id = f"val_{now_ms()}"
            return JSONResponse(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "ok": False,
                    "error": "validation_error",
                    "message": "Request body must be a JSON object (set Content-Type: application/json).",
                    "requestId": request_id,
                },
            )

        try:
            parsed = NewBatchRequest.model_validate(payload)
        except ValidationError as exc:
            request_id = f"val_{now_ms()}"
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
        # Preserve previewImageUrl from raw payload (not in NewBatchRequest; used for VLM pricing).
        for key in ("previewImageUrl", "preview_image_url", "imageUrl", "image_url"):
            val = payload.get(key) if isinstance(payload, dict) else None
            if val is not None and val != "":
                body["previewImageUrl"] = val
                break
        adapted = to_next_steps_payload(instance_id=instanceId, body=body)
        resp = estimate_pricing(adapted)
        status = http_status_for_pipeline_response(resp)
        return JSONResponse(status_code=status, content=resp)

    @router.post(
        "/pricing/{instanceId}",
        response_model=PricingResponse,
        response_model_exclude_none=True,
        description="Estimates a rough pricing range based on the same inputs as step generation.",
    )
    async def pricing(instanceId: str, payload: Any = Body(default_factory=dict)) -> Any:
        return await _pricing_impl(instanceId, payload)

    @router.post(
        "/pricing",
        response_model=PricingResponse,
        response_model_exclude_none=True,
        description="Estimates a rough pricing range; instanceId is taken from payload.session.instanceId or payload.instanceId.",
    )
    async def pricing_no_path_instance(payload: Any = Body(default_factory=dict)) -> Any:
        instance_id = extract_instance_id(payload)
        if not instance_id:
            return JSONResponse(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "ok": False,
                    "error": "validation_error",
                    "message": "instanceId is required (either in URL or in payload.session.instanceId / payload.instanceId).",
                },
            )
        return await _pricing_impl(instance_id, payload)

    @compat_router.post("/pricing")
    async def pricing_compat(payload: Any = Body(default_factory=dict)) -> Any:
        instance_id = extract_instance_id(payload)
        if not instance_id:
            return JSONResponse(
                status_code=HTTP_422_UNPROCESSABLE_ENTITY,
                content={
                    "ok": False,
                    "error": "validation_error",
                    "message": "instanceId is required (either in URL or in payload.session.instanceId / payload.instanceId).",
                },
            )
        return await _pricing_impl(instance_id, payload)

    @compat_router.post("/ai-form/{instanceId}/pricing")
    async def pricing_ai_form_compat(instanceId: str, payload: Any = Body(default_factory=dict)) -> Any:
        return await _pricing_impl(instanceId, payload)

    @router.post("/ai-form/{instanceId}/pricing")
    async def pricing_ai_form(instanceId: str, payload: Any = Body(default_factory=dict)) -> Any:
        return await _pricing_impl(instanceId, payload)

