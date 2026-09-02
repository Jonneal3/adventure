"""Single-pass VLM boundaries for gallery QA, service resolution, and pair verification."""

from __future__ import annotations

import base64
import json
import os
import ssl
import sys
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, List, Mapping, Optional, Sequence, Tuple

import certifi

from programs.gallery_enrichment.manifest import refine_manifest_from_verification, validate_manifest
from programs.gallery_enrichment.registry import FAMILIES, registry_contract
from programs.pricing.replicate_vlm import (
    _extract_json_from_text,
    _replicate_create_prediction,
    _replicate_wait_for_completion,
)


_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
_TIMEOUT = float(os.getenv("ADVENTURE_GALLERY_VISION_TIMEOUT_SEC", "60"))


def _model() -> str:
    explicit = str(os.getenv("ADVENTURE_GALLERY_VISION_MODEL") or "").strip()
    if explicit:
        return explicit
    if _gemini_key():
        return "gemini-2.5-flash"
    return "openai/gpt-5-mini"


def _gemini_key() -> str:
    return str(
        os.getenv("GEMINI_API_KEY")
        or os.getenv("GOOGLE_API_KEY")
        or os.getenv("GOOGLE_GENERATIVE_AI_API_KEY")
        or ""
    ).strip()


def gallery_vision_enabled() -> bool:
    return bool(_gemini_key() or str(os.getenv("REPLICATE_API_TOKEN") or "").strip())


def _fetch_image(url: str) -> Optional[Tuple[bytes, str]]:
    req = urllib.request.Request(url, headers={"User-Agent": "adventure-gallery-enrichment/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=25, context=_SSL_CONTEXT) as resp:
            data = resp.read()
            if not data or len(data) > 10_000_000:
                return None
            content_type = str(resp.headers.get("Content-Type") or "").split(";")[0].strip().lower()
    except (urllib.error.URLError, TimeoutError, ValueError):
        return None
    if content_type not in {"image/jpeg", "image/png", "image/webp", "image/gif"}:
        lower = url.lower()
        content_type = "image/png" if ".png" in lower else "image/webp" if ".webp" in lower else "image/jpeg"
    return data, content_type


def _gemini_json(image_urls: Sequence[str], *, system: str, user: str, model: str) -> Optional[Dict[str, Any]]:
    key = _gemini_key()
    if not key:
        return None
    parts: List[Dict[str, Any]] = [{"text": user}]
    for url in image_urls:
        fetched = _fetch_image(url)
        if not fetched:
            return None
        blob, mime = fetched
        parts.append({"inline_data": {"mime_type": mime, "data": base64.b64encode(blob).decode("ascii")}})
    model_id = str(model or "").rsplit("/", 1)[-1] or "gemini-2.5-flash"
    payload = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": parts}],
        "generationConfig": {
            "temperature": 0.1,
            "maxOutputTokens": 2400,
            "responseMimeType": "application/json",
        },
    }
    endpoint = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{urllib.parse.quote(model_id, safe='.-')}:generateContent?key={urllib.parse.quote(key)}"
    )
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Accept": "application/json", "Content-Type": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=_TIMEOUT, context=_SSL_CONTEXT) as resp:
            body = json.loads(resp.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, ValueError):
        return None
    candidates = body.get("candidates") if isinstance(body, dict) else None
    content = candidates[0].get("content") if isinstance(candidates, list) and candidates and isinstance(candidates[0], dict) else None
    response_parts = content.get("parts") if isinstance(content, dict) else None
    text = "\n".join(
        str(part.get("text") or "")
        for part in response_parts or []
        if isinstance(part, dict) and part.get("text")
    ).strip()
    return _extract_json_from_text(text) if text else None


def _replicate_json(image_urls: Sequence[str], *, system: str, user: str, model: str) -> Optional[Dict[str, Any]]:
    model_id = str(model or "").strip()
    if "/" not in model_id:
        model_id = f"google/{model_id}" if "gemini" in model_id.lower() else model_id
    if not model_id:
        model_id = "openai/gpt-5-mini"
    if "gemini" in model_id.lower() or model_id.startswith("google/"):
        inp = {
            "prompt": f"{system}\n\n{user}",
            "images": list(image_urls),
            "max_output_tokens": 2400,
            "temperature": 0.1,
        }
    else:
        inp = {
            "system_prompt": system,
            "prompt": user,
            "image_input": list(image_urls),
            "max_completion_tokens": 2400,
            "reasoning_effort": "minimal",
            "verbosity": "low",
        }
    try:
        created = _replicate_create_prediction(model_id=model_id, input=inp)
        prediction_id = str(created.get("id") or "")
        if not prediction_id:
            return None
        final = _replicate_wait_for_completion(prediction_id, timeout_sec=_TIMEOUT)
        if str(final.get("status") or "").lower() != "succeeded":
            print(
                "gallery vision prediction failed "
                f"status={str(final.get('status') or 'unknown')[:40]} "
                f"error={str(final.get('error') or '')[:300]}",
                file=sys.stderr,
            )
            return None
        output = final.get("output")
        text = "".join(str(part) for part in output) if isinstance(output, list) else str(output or "")
        parsed = _extract_json_from_text(text)
        if not parsed:
            print("gallery vision prediction returned malformed JSON", file=sys.stderr)
        return parsed
    except Exception as exc:
        print(f"gallery vision provider exception={type(exc).__name__}: {str(exc)[:300]}", file=sys.stderr)
        return None


def vision_json(image_urls: Sequence[str], *, system: str, user: str, model: Optional[str] = None) -> Optional[Dict[str, Any]]:
    urls = [str(url or "").strip() for url in image_urls if str(url or "").startswith(("http://", "https://"))]
    if not urls:
        return None
    selected_model = str(model or _model()).strip()
    if _gemini_key() and "gemini" in selected_model.lower():
        result = _gemini_json(urls, system=system, user=user, model=selected_model)
        if result:
            return result
    if str(os.getenv("REPLICATE_API_TOKEN") or "").strip():
        return _replicate_json(urls, system=system, user=user, model=selected_model)
    return None


def _score(value: Any) -> float:
    try:
        return round(max(0.0, min(1.0, float(value))), 3)
    except (TypeError, ValueError):
        return 0.0


def _strings(value: Any, *, cap: int = 30) -> List[str]:
    if not isinstance(value, list):
        return []
    out: List[str] = []
    for item in value:
        text = str(item or "").strip()[:240]
        if text and text not in out:
            out.append(text)
        if len(out) >= cap:
            break
    return out


def _normalize_inferred_manifest_shape(raw: Any, contract: Mapping[str, Any]) -> Any:
    """Repair common JSON-shape drift without adding or changing visible scope.

    Some VLMs emit registered component keys as an object map even when asked
    for the canonical ``components`` array. This adapter only restructures
    component data that the model actually returned; the closed manifest
    validator remains responsible for all enum, unit, and pricing checks.
    """
    if isinstance(raw, list):
        return {"components": raw}
    if not isinstance(raw, Mapping):
        return raw

    normalized = dict(raw)
    components = normalized.get("components")
    if isinstance(components, Mapping):
        normalized["components"] = [
            {**dict(value), "componentKey": key}
            for key, value in components.items()
            if isinstance(value, Mapping)
        ]
        return normalized
    if isinstance(components, list) and components:
        return normalized

    items = normalized.pop("items", None)
    if isinstance(items, list):
        normalized["components"] = items
        return normalized

    allowed = {
        str(row.get("componentKey") or "")
        for row in contract.get("components") or []
        if isinstance(row, Mapping) and row.get("componentKey")
    }
    inferred: List[Dict[str, Any]] = []
    for key in list(normalized):
        if key not in allowed:
            continue
        value = normalized.pop(key)
        if isinstance(value, Mapping):
            inferred.append({**dict(value), "componentKey": key})
    if inferred:
        normalized["components"] = inferred
    return normalized


def classify_service_family(image_url: str) -> Optional[Dict[str, Any]]:
    families = [{"pricingFamily": key, "label": value.label} for key, value in FAMILIES.items()]
    raw = vision_json(
        [image_url],
        system=(
            "Classify a generated gallery image into exactly one supplied launch pricing family. "
            "Use only visible evidence. Return uncertain when the service is ambiguous or unsupported. Return JSON only."
        ),
        user=(
            f"Allowed families: {json.dumps(families, separators=(',', ':'))}. "
            "Return {\"status\":\"resolved|uncertain|unsupported\",\"pricingFamily\":\"\","
            "\"confidence\":0.0,\"reason\":\"\"}."
        ),
    )
    if not isinstance(raw, dict):
        return None
    family = str(raw.get("pricingFamily") or raw.get("pricing_family") or "").strip()
    status = str(raw.get("status") or "uncertain").strip().lower()
    if family not in FAMILIES or status != "resolved":
        status = "unsupported" if status == "unsupported" else "uncertain"
        family = ""
    return {"status": status, "pricingFamily": family, "confidence": _score(raw.get("confidence")), "reason": str(raw.get("reason") or "").strip()[:300]}


def qa_and_infer_manifest(
    image_url: str,
    *,
    pricing_family: str,
    service_id: str,
    model_id: str = "",
) -> Optional[Dict[str, Any]]:
    contract = registry_contract(pricing_family)
    if not contract:
        return None
    manifest_schema = {
        "version": 1,
        "source": "legacy_inferred",
        "serviceId": service_id,
        "serviceKey": contract["serviceKey"],
        "pricingFamily": contract["pricingFamily"],
        "components": [
            {
                "componentKey": "one supplied componentKey",
                "subtypeKey": "one supplied subtypeKey, or omit",
                "materialKey": "one supplied materialKey, or omit",
                "tier": "one supplied tier",
                "quantity": {
                    "low": 0,
                    "likely": 0,
                    "high": 0,
                    "unit": "the supplied unit for this component",
                },
                "attributes": {},
            }
        ],
        "assumptions": [],
        "normalizationNotes": [],
    }
    raw = vision_json(
        [image_url],
        system=(
            "Perform one strict QA and priceable-scope inference pass on this AI-generated gallery image. "
            "Judge the actual image, not its generating model. Reject visible AI artifacts, impossible geometry, "
            "duplicated objects, malformed hands, text, logos, collage layouts, watermarks, poor realism, or material "
            "visible work that cannot map to the supplied registry. Do not use numeric thresholds. Return JSON only."
        ),
        user=(
            f"Allowed registry: {json.dumps(contract, separators=(',', ':'))}. "
            "Infer only registered scope. Use quantity ranges when exact measurement is visual. "
            "quantityBounds are hard inclusive limits: every low, likely, and high value must stay inside the "
            "selected component's bounds and use that component's supplied unit. Omit incidental visible elements "
            "that fall below a component minimum; do not price ordinary background elements as project scope. "
            "If material project work cannot be represented inside the supplied bounds, return verdict uncertain. "
            "The priceableManifest must use this exact envelope and a components ARRAY; never put component keys "
            f"at the manifest root: {json.dumps(manifest_schema, separators=(',', ':'))}. "
            "Return {\"verdict\":\"keep|reject|uncertain\",\"reason\":\"\",\"artifacts\":[],"
            "\"realismScore\":0.0,\"artifactScore\":0.0,\"aestheticScore\":0.0,"
            "\"sceneType\":\"\",\"cameraView\":\"\",\"fixedElements\":[],"
            "\"priceableManifest\":{}}."
        ),
    )
    if not isinstance(raw, dict):
        return None
    verdict = str(raw.get("verdict") or "uncertain").strip().lower()
    if verdict not in {"keep", "reject", "uncertain"}:
        verdict = "uncertain"
    inferred_manifest = _normalize_inferred_manifest_shape(
        raw.get("priceableManifest") or raw.get("priceable_manifest"),
        contract,
    )
    manifest_validation = validate_manifest(
        inferred_manifest,
        expected_family=pricing_family,
        expected_service_id=service_id,
        source="legacy_inferred",
    )
    if verdict == "keep" and not manifest_validation.valid:
        verdict = "uncertain"
    return {
        "status": verdict,
        "verdict": verdict,
        "reason": str(raw.get("reason") or "").strip()[:500],
        "artifacts": _strings(raw.get("artifacts")),
        "scores": {
            "realism": _score(raw.get("realismScore") or raw.get("realism_score")),
            "artifact": _score(raw.get("artifactScore") or raw.get("artifact_score")),
            "aesthetic": _score(raw.get("aestheticScore") or raw.get("aesthetic_score")),
        },
        "sceneType": str(raw.get("sceneType") or raw.get("scene_type") or "").strip()[:120],
        "cameraView": str(raw.get("cameraView") or raw.get("camera_view") or "").strip()[:120],
        "fixedElements": _strings(raw.get("fixedElements") or raw.get("fixed_elements")),
        "priceableManifest": manifest_validation.manifest,
        "manifestErrors": manifest_validation.errors,
        "modelId": str(model_id or "").strip() or None,
    }


def verify_pair(before_url: str, after_url: str, *, manifest: Mapping[str, Any]) -> Optional[Dict[str, Any]]:
    validated = validate_manifest(manifest)
    if not validated.valid or not validated.manifest:
        return None
    contract = registry_contract(validated.manifest["pricingFamily"])
    raw = vision_json(
        [before_url, after_url],
        system=(
            "Verify an illustrative BEFORE/AFTER pair. Image 1 is BEFORE; image 2 is AFTER. Return JSON only. "
            "They must be the same scene, camera, crop, perspective, architecture, boundaries, fixed-object positions, "
            "fixture counts, and zones. The before must be realistic, ordinary, and maintained. The after must be free "
            "of obvious artifacts. Verified scope may refine quantities and registered attributes but may not invent "
            "components. Put unknown visible work in unsupportedObservations; material unsupported work fails the pair."
        ),
        user=(
            f"Original manifest: {json.dumps(validated.manifest, separators=(',', ':'))}. "
            f"Allowed registry: {json.dumps(contract, separators=(',', ':'))}. "
            "verifiedComponents must be an ARRAY with exactly one object for every original manifest component, "
            "using the same componentKey and no new component keys. Copy each original component unchanged when "
            "there is no supported refinement. A refined quantity may contain only low, likely, high, and unit; "
            "never return beforeEstimate, afterEstimate, measured, or component-specific quantity field names. "
            "Return {\"status\":\"passed|failed|uncertain\",\"confidence\":0.0,\"sameScene\":true,"
            "\"beforePlausible\":true,\"afterQualityValid\":true,\"manifestCoverage\":[],"
            "\"verifiedComponents\":[],\"unsupportedObservations\":[],\"observedDelta\":[],"
            "\"assumptions\":[],\"failureReasons\":[]}."
        ),
    )
    if not isinstance(raw, dict):
        return None
    status = str(raw.get("status") or "uncertain").strip().lower()
    if status not in {"passed", "failed", "uncertain"}:
        status = "uncertain"
    unsupported = _strings(raw.get("unsupportedObservations") or raw.get("unsupported_observations"))
    raw_verified = raw.get("verifiedComponents") or raw.get("verified_components") or []
    refined = refine_manifest_from_verification(
        validated.manifest,
        raw_verified,
    )
    same_scene = raw.get("sameScene") is True or raw.get("same_scene") is True
    before_plausible = raw.get("beforePlausible") is True or raw.get("before_plausible") is True
    after_valid = raw.get("afterQualityValid") is True or raw.get("after_quality_valid") is True
    failure_reasons = _strings(raw.get("failureReasons") or raw.get("failure_reasons"))
    expected_component_keys = {row["componentKey"] for row in validated.manifest["components"]}
    verified_component_keys = {
        str(row.get("componentKey") or row.get("component_key") or row.get("key") or "").strip()
        for row in raw_verified
        if isinstance(row, Mapping)
    }
    missing_components = sorted(expected_component_keys - verified_component_keys)
    if missing_components:
        failure_reasons.append("verifiedComponents missing: " + ", ".join(missing_components))
    if unsupported:
        failure_reasons.append("unsupported material visible work")
    if not refined.valid:
        failure_reasons.extend(refined.errors)
    if status == "passed" and (not same_scene or not before_plausible or not after_valid or failure_reasons):
        status = "failed"
    return {
        "status": status,
        "confidence": _score(raw.get("confidence")),
        "sameScene": same_scene,
        "beforePlausible": before_plausible,
        "afterQualityValid": after_valid,
        "manifestCoverage": _strings(raw.get("manifestCoverage") or raw.get("manifest_coverage")),
        "verifiedComponents": (refined.manifest or validated.manifest)["components"],
        "unsupportedObservations": unsupported,
        "observedDelta": _strings(raw.get("observedDelta") or raw.get("observed_delta")),
        "assumptions": _strings(raw.get("assumptions")),
        "failureReasons": list(dict.fromkeys(failure_reasons)),
        "refinedManifest": refined.manifest,
    }


__all__ = [
    "classify_service_family",
    "gallery_vision_enabled",
    "qa_and_infer_manifest",
    "verify_pair",
    "vision_json",
]
