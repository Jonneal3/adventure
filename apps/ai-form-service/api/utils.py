from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Dict, Optional

from starlette.status import (
    HTTP_400_BAD_REQUEST,
    HTTP_422_UNPROCESSABLE_ENTITY,
    HTTP_429_TOO_MANY_REQUESTS,
    HTTP_500_INTERNAL_SERVER_ERROR,
)


def repo_root() -> Path:
    # `api/utils.py` lives at `<repo>/api/utils.py`
    return Path(__file__).resolve().parents[1]


def resolve_ui_contract_dir() -> Path | None:
    """
    Resolve the canonical AI Form UI contract directory.

    Monorepo-preferred layout:
      <monorepo>/shared/api/ai-form-ui-contract/schema/...

    Back-compat layouts (older standalone service repos):
      <monorepo>/packages/ai-form-ui-contract/schema/...
      <service>/shared/ai-form-ui-contract/schema/...
      <service>/shared/ai-form-contract/schema/...
    """
    root = repo_root()

    override = str(os.getenv("AI_FORM_UI_CONTRACT_DIR") or "").strip()
    if override:
        p = Path(override).expanduser()
        if not p.is_absolute():
            p = (root / p).resolve()
        if (p / "schema" / "ui_step.schema.json").exists():
            return p

    # Monorepo-first: walk upward so both legacy and apps/* layouts resolve.
    for base in (root, *root.parents):
        monorepo_shared_api = base / "shared" / "api" / "ai-form-ui-contract"
        if (monorepo_shared_api / "schema" / "ui_step.schema.json").exists():
            return monorepo_shared_api
        monorepo_pkg = base / "packages" / "ai-form-ui-contract"
        if (monorepo_pkg / "schema" / "ui_step.schema.json").exists():
            return monorepo_pkg

    # Standalone repo: contract vendored under shared/
    vendored_new = root / "shared" / "ai-form-ui-contract"
    if (vendored_new / "schema" / "ui_step.schema.json").exists():
        return vendored_new

    vendored_old = root / "shared" / "ai-form-contract"
    if (vendored_old / "schema" / "ui_step.schema.json").exists():
        return vendored_old

    return None


def load_contract_schema() -> Dict[str, Any]:
    contract_dir = resolve_ui_contract_dir()
    schema_path = (contract_dir / "schema" / "ui_step.schema.json") if contract_dir else Path("__missing__")
    version_path = (contract_dir / "schema" / "schema_version.txt") if contract_dir else Path("__missing__")

    schema_obj: Dict[str, Any] = {}
    try:
        schema_obj = json.loads(schema_path.read_text(encoding="utf-8"))
    except Exception:
        schema_obj = {}
    try:
        schema_version = version_path.read_text(encoding="utf-8").strip()
    except Exception:
        schema_version = ""
    schema_version = schema_version or (schema_obj.get("schemaVersion") if isinstance(schema_obj, dict) else "")
    return {"schemaVersion": schema_version or "", "uiStepSchema": schema_obj}


def http_status_for_pipeline_response(resp: Any) -> int:
    if not isinstance(resp, dict):
        return HTTP_500_INTERNAL_SERVER_ERROR
    if resp.get("ok") is not False:
        return 200

    err = str(resp.get("error") or "").strip().lower()
    msg = str(resp.get("message") or resp.get("error") or "").strip().lower()

    if err in {"rate_limited"}:
        return HTTP_429_TOO_MANY_REQUESTS
    if "dspy lm not configured" in msg or "dspy import failed" in msg or err in {"internal_error"}:
        return HTTP_500_INTERNAL_SERVER_ERROR
    if "missing service context" in msg or "missing services_summary" in msg:
        return HTTP_422_UNPROCESSABLE_ENTITY
    if "token budget exhausted" in msg:
        return HTTP_400_BAD_REQUEST
    return HTTP_400_BAD_REQUEST


def normalize_output_urls(output: Any) -> list[str]:
    if output is None:
        return []
    if isinstance(output, str):
        s = output.strip()
        return [s] if s else []
    if isinstance(output, list):
        out: list[str] = []
        for item in output:
            if isinstance(item, str) and item.strip():
                out.append(item.strip())
            elif isinstance(item, dict):
                u = item.get("url") if isinstance(item.get("url"), str) else None
                if u and u.strip():
                    out.append(u.strip())
        return out
    return []


def dedup_urls(urls: list[str]) -> list[str]:
    seen: set[str] = set()
    out: list[str] = []
    for u in urls or []:
        if not isinstance(u, str):
            continue
        s = u.strip()
        if not s or s in seen:
            continue
        seen.add(s)
        out.append(s)
    return out


def extract_instance_id(payload: Any) -> str:
    if not isinstance(payload, dict):
        return ""
    if isinstance(payload.get("instanceId"), str):
        v = str(payload.get("instanceId") or "").strip()
        if v:
            return v
    sess = payload.get("session")
    if isinstance(sess, dict) and isinstance(sess.get("instanceId"), str):
        v = str(sess.get("instanceId") or "").strip()
        if v:
            return v
    return ""


def hash_step_data(step_data: Any) -> str:
    try:
        raw = json.dumps(step_data or {}, ensure_ascii=True, sort_keys=True, separators=(",", ":"))
    except Exception:
        raw = str(step_data or "")
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:12]


def answered_qa_from_step_data(step_data: Dict[str, Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    if not isinstance(step_data, dict):
        return out
    for k, v in step_data.items():
        key = str(k or "").strip()
        if not key:
            continue
        step_id = f"step-{key.replace('_', '-').replace(' ', '-')}"
        try:
            answer = v if isinstance(v, (str, int, float, bool)) or v is None else json.dumps(v, ensure_ascii=True)
        except Exception:
            answer = str(v)
        out.append({"stepId": step_id, "question": key, "answer": answer})
        if len(out) >= 32:
            break
    return out


def now_ms() -> int:
    return int(time.time() * 1000)

