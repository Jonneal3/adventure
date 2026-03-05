from __future__ import annotations

import hashlib
import json
import os
import time
from pathlib import Path
from typing import Any, Dict

import requests

from programs.image_request.types import ImageRequest, ImageSpec, image_spec_to_dict

REPLICATE_PREDICTIONS_URL = "https://api.replicate.com/v1/predictions"
DEFAULT_PRIMARY_MODEL = "black-forest-labs/flux-1.1-pro"
DEFAULT_OPTION_MODEL = "black-forest-labs/flux-schnell"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[5]


def _cache_dir() -> Path:
    override = os.getenv("IMAGE_OPTIMIZATION_CACHE_DIR", "").strip()
    root = Path(override) if override else (_repo_root() / ".image_optimization_cache")
    root.mkdir(parents=True, exist_ok=True)
    return root


def _hash_obj(obj: Any) -> str:
    data = json.dumps(obj, sort_keys=True, default=str).encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def _replicate_input(request: ImageRequest, spec: ImageSpec, seed: int) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "prompt": request.prompt,
        "seed": int(seed),
        "output_format": request.params.get("output_format", "png"),
        "aspect_ratio": request.params.get("aspect_ratio", spec.aspect),
    }
    negative_prompt = (request.negative_prompt or "").strip()
    if negative_prompt:
        payload["negative_prompt"] = negative_prompt

    for key in ("steps", "guidance", "guidance_scale", "safety_tolerance", "num_inference_steps", "strength"):
        if key in request.params:
            payload[key] = request.params[key]

    if spec.task in {"img2img", "inpaint"} and spec.reference_image_url:
        payload["image"] = spec.reference_image_url
    if spec.task == "inpaint" and spec.mask_image_url:
        payload["mask"] = spec.mask_image_url
    return payload


def _extract_output_url(output: Any) -> str:
    if isinstance(output, list) and output:
        first = output[0]
        if isinstance(first, str):
            return first
    if isinstance(output, str):
        return output
    raise ValueError("Replicate returned no output URL")


def render_with_replicate(
    request: ImageRequest,
    spec: ImageSpec,
    *,
    seed: int,
    model: str | None = None,
    timeout_sec: int | None = None,
) -> str:
    model_name = (model or os.getenv("REPLICATE_MODEL_ID") or DEFAULT_PRIMARY_MODEL).strip()
    timeout = int(timeout_sec or os.getenv("REPLICATE_TIMEOUT_SEC") or 90)
    replicate_token = (os.getenv("REPLICATE_API_TOKEN") or "").strip()
    cache_key = _hash_obj(
        {
            "model": model_name,
            "spec": image_spec_to_dict(spec),
            "request": {"prompt": request.prompt, "negative_prompt": request.negative_prompt, "params": request.params},
            "seed": int(seed),
        }
    )
    cache_path = _cache_dir() / f"{cache_key}.json"
    if cache_path.exists():
        cached = json.loads(cache_path.read_text(encoding="utf-8"))
        return str(cached["image_url"])

    if not replicate_token:
        mock_url = f"MOCK://replicate/{cache_key}.png"
        cache_path.write_text(json.dumps({"image_url": mock_url, "cached_at": int(time.time())}), encoding="utf-8")
        return mock_url

    body = {"model": model_name, "input": _replicate_input(request, spec, seed)}
    headers = {"Authorization": f"Token {replicate_token}", "Content-Type": "application/json"}

    resp = requests.post(REPLICATE_PREDICTIONS_URL, headers=headers, json=body, timeout=timeout)
    resp.raise_for_status()
    prediction = resp.json()
    poll_url = prediction.get("urls", {}).get("get")
    status = prediction.get("status")
    started = time.time()

    while status not in {"succeeded", "failed", "canceled"}:
        if not poll_url:
            raise RuntimeError("Replicate response missing poll URL")
        if (time.time() - started) > timeout:
            raise TimeoutError(f"Replicate prediction timed out after {timeout}s")
        time.sleep(1.5)
        poll_resp = requests.get(poll_url, headers=headers, timeout=timeout)
        poll_resp.raise_for_status()
        prediction = poll_resp.json()
        status = prediction.get("status")

    if status != "succeeded":
        raise RuntimeError(f"Replicate prediction failed: {prediction.get('error') or status}")

    image_url = _extract_output_url(prediction.get("output"))
    cache_path.write_text(
        json.dumps({"image_url": image_url, "cached_at": int(time.time()), "status": status}),
        encoding="utf-8",
    )
    return image_url
