from __future__ import annotations

from typing import Any, Dict

from fastapi import APIRouter, Body
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.status import HTTP_400_BAD_REQUEST

from programs.adventure_pipeline.orchestrator import run_adventure_action


def register(router: APIRouter, compat_router: APIRouter) -> None:
    async def _run(instance_id: str, action: str, payload: Any) -> JSONResponse:
        if not isinstance(payload, dict):
            payload = {}
        body: Dict[str, Any] = dict(payload)
        body["instanceId"] = str(instance_id or body.get("instanceId") or "").strip()
        if isinstance(body.get("design"), dict):
            body["design"] = {**body["design"], "instanceId": body["instanceId"]}
        else:
            body.setdefault("design", {})
            if isinstance(body["design"], dict):
                body["design"]["instanceId"] = body["instanceId"]

        if not action:
            return JSONResponse(
                status_code=HTTP_400_BAD_REQUEST,
                content={"ok": False, "error": "missing_action", "message": "action is required"},
            )

        result = await run_in_threadpool(run_adventure_action, action, body)
        status = 200 if isinstance(result, dict) and result.get("ok") else 502
        # Soft-fail unknown action as 400
        if isinstance(result, dict) and result.get("error") == "unknown_action":
            status = 400
        return JSONResponse(status_code=status, content=result if isinstance(result, dict) else {"ok": False})

    @router.post("/adventure/{instanceId}/{action}")
    async def adventure_action(instanceId: str, action: str, payload: Any = Body(default_factory=dict)) -> Any:
        return await _run(instanceId, action, payload)

    @router.post("/adventure/{instanceId}")
    async def adventure_action_body(instanceId: str, payload: Any = Body(default_factory=dict)) -> Any:
        action = ""
        if isinstance(payload, dict):
            action = str(payload.get("action") or "").strip()
        return await _run(instanceId, action, payload)

    @compat_router.post("/adventure/{instanceId}/{action}")
    async def adventure_action_compat(instanceId: str, action: str, payload: Any = Body(default_factory=dict)) -> Any:
        return await _run(instanceId, action, payload)
