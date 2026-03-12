from __future__ import annotations

import os
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.status import HTTP_422_UNPROCESSABLE_ENTITY, HTTP_500_INTERNAL_SERVER_ERROR


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[1]


def _shared_env_file() -> Path:
    # Monorepo-first lookup: walk upward and pick the first env/.env.shared.local.
    # Supports both:
    # - <repo>/apps/api-service
    # - <repo>/api-service (legacy layout)
    root = _repo_root()
    for base in (root, *root.parents):
        candidate = base / "env" / ".env.shared.local"
        if candidate.exists():
            return candidate
    # Default to legacy location for local overrides if file is absent.
    return root.parent / "env" / ".env.shared.local"


def _ensure_src_on_path() -> None:
    src = _repo_root() / "src"
    if not src.is_dir():
        return
    s = str(src)
    if s not in sys.path:
        sys.path.insert(0, s)


_ensure_src_on_path()

# Router modules (keeps this file thin)
from api.routers import core as core_router  # noqa: E402
from api.routers import execute_function as execute_router  # noqa: E402
from api.routers import form as form_router  # noqa: E402
from api.routers import image as image_router  # noqa: E402
from api.routers import pricing as pricing_router  # noqa: E402
from api.utils import now_ms  # noqa: E402


def create_app() -> FastAPI:
    # Single source of truth for local envs across apps.
    load_dotenv(_shared_env_file(), override=False)
    # Keep local fallback for non-monorepo usage.
    load_dotenv(_repo_root() / ".env", override=False)

    app = FastAPI(title="sif-api-service")
    router = APIRouter(prefix="/v1/api")
    compat_router = APIRouter(prefix="/api")

    _EXEC_FN_CACHE: dict[str, tuple[float, Dict[str, Any]]] = {}

    def _exec_fn_cache_get(cache_key: str) -> Optional[Dict[str, Any]]:
        if not cache_key:
            return None
        rec = _EXEC_FN_CACHE.get(cache_key)
        if not rec:
            return None
        expires_at, value = rec
        if time.time() >= float(expires_at):
            _EXEC_FN_CACHE.pop(cache_key, None)
            return None
        return value

    def _exec_fn_cache_set(cache_key: str, value: Dict[str, Any], ttl_sec: int) -> None:
        if not cache_key:
            return
        ttl = max(60, min(3600, int(ttl_sec or 0)))
        _EXEC_FN_CACHE[cache_key] = (time.time() + ttl, value)

    @app.exception_handler(RequestValidationError)
    async def _validation_error_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
        request_id = f"val_{now_ms()}_{uuid.uuid4().hex[:8]}"
        print(
            f"[api] 422 validation_error requestId={request_id} path={request.url.path} errors={exc.errors()}",
            flush=True,
        )
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

    @app.exception_handler(Exception)
    async def _unhandled_error_handler(request: Request, exc: Exception) -> JSONResponse:
        request_id = f"err_{now_ms()}_{uuid.uuid4().hex[:8]}"
        print(f"[api] 500 internal_error requestId={request_id} path={request.url.path} err={exc!r}", flush=True)
        return JSONResponse(
            status_code=HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "ok": False,
                "error": "internal_error",
                "message": "Unhandled server error.",
                "requestId": request_id,
            },
        )

    # Register endpoints
    core_router.register(app)
    form_router.register(router, compat_router)
    pricing_router.register(router, compat_router)
    image_router.register(router, compat_router)
    execute_router.register(
        router,
        compat_router,
        cache_get=_exec_fn_cache_get,
        cache_set=_exec_fn_cache_set,
    )

    app.include_router(router)
    app.include_router(compat_router)
    return app


app = create_app()
