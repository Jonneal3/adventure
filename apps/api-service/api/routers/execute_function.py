from __future__ import annotations

import os
import uuid
from typing import Any, Callable, Dict, Optional

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from pydantic import ValidationError
from starlette.status import HTTP_400_BAD_REQUEST, HTTP_422_UNPROCESSABLE_ENTITY

from api.utils import answered_qa_from_step_data, hash_step_data, http_status_for_pipeline_response, now_ms
from programs.image_generator.orchestrator import generate_image
from schemas.api_models import ExecuteFunctionRequest


def register(
    router: APIRouter,
    compat_router: APIRouter,
    *,
    cache_get: Callable[[str], Optional[Dict[str, Any]]],
    cache_set: Callable[[str, Dict[str, Any], int], None],
) -> None:
    @compat_router.post("/ai-form/{instanceId}/execute-function")
    @router.post("/ai-form/{instanceId}/execute-function")
    async def execute_function(instanceId: str, payload: Dict[str, Any] = Body(default_factory=dict)) -> Any:
        request_id = f"exec_fn_{now_ms()}_{uuid.uuid4().hex[:8]}"
        try:
            parsed = ExecuteFunctionRequest.model_validate(payload)
        except ValidationError as exc:
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
        session_id = str(body.get("sessionId") or "").strip()
        function_name = str(body.get("functionName") or "").strip()
        step_data = body.get("stepData") if isinstance(body.get("stepData"), dict) else {}

        if function_name != "generateInitialImage":
            return JSONResponse(
                status_code=HTTP_400_BAD_REQUEST,
                content={
                    "ok": False,
                    "error": "unknown_function",
                    "message": f"Unsupported functionName: {function_name}",
                    "requestId": request_id,
                },
            )

        cache_material = {
            "stepData": step_data,
            "useCase": payload.get("useCase") or payload.get("use_case"),
            "negativePrompt": payload.get("negativePrompt") or payload.get("negative_prompt"),
            "referenceImages": payload.get("referenceImages") or payload.get("reference_images"),
            "sceneImage": payload.get("sceneImage") or payload.get("scene_image"),
            "productImage": payload.get("productImage") or payload.get("product_image"),
            "numOutputs": payload.get("numOutputs") or payload.get("num_outputs"),
            "outputFormat": payload.get("outputFormat") or payload.get("output_format"),
            "modelId": payload.get("modelId") or payload.get("model_id"),
            "width": payload.get("width"),
            "height": payload.get("height"),
            "numInferenceSteps": payload.get("numInferenceSteps") or payload.get("num_inference_steps"),
            "guidanceScale": payload.get("guidanceScale") or payload.get("guidance_scale"),
        }
        cache_key = f"exec_fn:{session_id or 'none'}:{function_name}:{hash_step_data(cache_material)}"
        ttl_sec = int(os.getenv("AI_FORM_EXECUTE_FUNCTION_CACHE_TTL_SEC") or "900")

        cached = cache_get(cache_key) if session_id else None
        if isinstance(cached, dict) and cached.get("ok") is True:
            return JSONResponse(status_code=200, content=cached)

        image_payload: Dict[str, Any] = {
            "sessionId": session_id,
            "instanceId": instanceId,
            "answeredQA": answered_qa_from_step_data(step_data),
            "serviceSummary": payload.get("serviceSummary") or payload.get("service_summary"),
            "companySummary": payload.get("companySummary") or payload.get("company_summary"),
            "useCase": payload.get("useCase") or payload.get("use_case"),
            "instanceContext": payload.get("instanceContext") or payload.get("instance_context"),
            "batchId": f"exec-{(session_id or 'none')[:40]}",
        }

        for k in ("prompt", "promptTemplate"):
            if k in payload and payload.get(k) not in (None, ""):
                return JSONResponse(
                    status_code=HTTP_400_BAD_REQUEST,
                    content={
                        "ok": False,
                        "error": "unsupported_field",
                        "message": f"Field '{k}' is not supported; prompts are generated server-side.",
                        "requestId": request_id,
                    },
                )

        for k in (
            "numOutputs",
            "outputFormat",
            "modelId",
            "negativePrompt",
            "width",
            "height",
            "numInferenceSteps",
            "guidanceScale",
            "referenceImages",
            "sceneImage",
            "productImage",
        ):
            if k in payload and payload.get(k) is not None:
                image_payload[k] = payload.get(k)

        resp = {**generate_image(image_payload), "requestId": request_id}
        if not resp.get("ok"):
            return JSONResponse(status_code=http_status_for_pipeline_response(resp), content=resp)
        if session_id:
            cache_set(cache_key, resp, ttl_sec)
        return JSONResponse(status_code=200, content=resp)

