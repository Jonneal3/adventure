"""Pure orchestration for legacy and manifest-first gallery enrichment."""

from __future__ import annotations

import os
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Mapping, Optional

from programs.gallery_enrichment.manifest import refine_manifest_from_verification, validate_manifest
from programs.gallery_enrichment.pricing import price_manifest
from programs.gallery_enrichment.prompts import build_after_prompt, build_before_prompt
from programs.gallery_enrichment.registry import get_family


ImageGenerator = Callable[..., Optional[str]]
PairVerifier = Callable[..., Optional[Dict[str, Any]]]


def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat()


def _stage(status: str, *, attempts: int = 1, error: str = "") -> Dict[str, Any]:
    row: Dict[str, Any] = {
        "version": 1,
        "status": status,
        "attempts": attempts,
        "updatedAt": now_iso(),
    }
    if error:
        row["error"] = str(error)[:500]
    return row


def _component_labels(manifest: Mapping[str, Any]) -> list[str]:
    family = get_family(manifest.get("pricingFamily"))
    if not family:
        return []
    return [family.components[row["componentKey"]].label for row in manifest.get("components") or [] if row.get("componentKey") in family.components]


def _catalog_badge(enrichment: Mapping[str, Any]) -> str:
    pricing = enrichment.get("pricing") if isinstance(enrichment.get("pricing"), Mapping) else {}
    return {
        "high": "Typical estimate",
        "medium": "Estimated range",
        "broad": "Broad estimate",
    }.get(str(pricing.get("confidence") or "").strip().lower(), "Project example")


def _manifest_tags(manifest: Mapping[str, Any]) -> list[str]:
    values: list[str] = []
    for value in (manifest.get("serviceKey"), manifest.get("pricingFamily")):
        if value:
            values.append(str(value))
    for component in manifest.get("components") or []:
        if not isinstance(component, Mapping):
            continue
        for key in ("componentKey", "subtypeKey", "materialKey", "tier"):
            if component.get(key):
                values.append(str(component[key]))
        attributes = component.get("attributes") if isinstance(component.get("attributes"), Mapping) else {}
        values.extend(f"{key}:{value}" for key, value in attributes.items() if value)
    seen: set[str] = set()
    return [value for value in values if not (value.lower() in seen or seen.add(value.lower()))]


def catalog_contract_metadata(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    """Materialize the compact catalog contract used by launch and retrieval.

    ``publish.status`` remains canonical. This companion object makes lifecycle,
    the customer-facing badge, and filterable attributes cheap to read without
    adding another table in v1.
    """
    manifest = enrichment.get("priceableManifest") if isinstance(enrichment.get("priceableManifest"), Mapping) else {}
    publish = enrichment.get("publish") if isinstance(enrichment.get("publish"), Mapping) else {}
    status = "active" if publish.get("status") == "ready" else "hidden"
    return {
        "version": 1,
        "status": status,
        "badge": _catalog_badge(enrichment),
        "serviceId": str(manifest.get("serviceId") or "") or None,
        "serviceKey": str(manifest.get("serviceKey") or "") or None,
        "pricingFamily": str(manifest.get("pricingFamily") or "") or None,
        "tags": _manifest_tags(manifest),
        "updatedAt": now_iso(),
    }


def compatibility_metadata(enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    manifest = enrichment.get("priceableManifest") if isinstance(enrichment.get("priceableManifest"), Mapping) else {}
    verification = enrichment.get("verification") if isinstance(enrichment.get("verification"), Mapping) else {}
    pricing = enrichment.get("pricing") if isinstance(enrichment.get("pricing"), Mapping) else {}
    before = enrichment.get("before") if isinstance(enrichment.get("before"), Mapping) else {}
    labels = _component_labels(manifest)
    confidence = float(verification.get("confidence") or 0)
    scope_is_valid = bool(labels) and pricing.get("status") == "complete"
    old_manifest = {
        "version": 1,
        "analysisStatus": "verified" if scope_is_valid else "rejected",
        "sceneType": "full-project" if len(labels) > 1 else "component",
        "description": " · ".join(verification.get("observedDelta") or []) or None,
        "primaryScope": labels[0] if labels else None,
        "components": [
            {
                "key": component.get("componentKey"),
                "label": label,
                "confidence": confidence,
                "quantity": (component.get("quantity") or {}).get("likely"),
            }
            for component, label in zip(manifest.get("components") or [], labels)
        ],
        "model": (enrichment.get("provenance") or {}).get("modelId"),
        "analyzedAt": now_iso(),
    }
    localized = pricing.get("localizedRange") if isinstance(pricing.get("localizedRange"), Mapping) else {}
    return {
        "project_manifest": old_manifest,
        "before_image_url": before.get("url"),
        "what_changed": list(verification.get("observedDelta") or labels),
        "included_items": labels,
        "price_range": {
            "min": localized.get("low"),
            "likely": localized.get("likely"),
            "max": localized.get("high"),
            "low": localized.get("low"),
            "high": localized.get("high"),
            "currency": localized.get("currency") or "USD",
            "source": "gallery_manifest_v1",
        },
    }


def merge_enrichment_metadata(existing: Any, enrichment: Mapping[str, Any]) -> Dict[str, Any]:
    merged = dict(existing) if isinstance(existing, Mapping) else {}
    merged["gallery_enrichment"] = deepcopy(dict(enrichment))
    merged.update(compatibility_metadata(enrichment))
    pair = enrichment.get("pair") if isinstance(enrichment.get("pair"), Mapping) else {}
    if pair.get("status") == "linked" and pair.get("counterpartImageId"):
        merged["gallery_pair"] = {
            "version": 1,
            "pair_id": pair.get("pairId"),
            "role": pair.get("role") or "after",
            "counterpart_image_id": pair.get("counterpartImageId"),
            "source": pair.get("source") or "linked",
        }
    catalog = catalog_contract_metadata(enrichment)
    merged["gallery_catalog"] = catalog
    merged["gallery_status"] = catalog["status"]
    merged["gallery_badge"] = catalog["badge"]
    existing_tags = merged.get("tags") if isinstance(merged.get("tags"), list) else []
    merged["tags"] = list(dict.fromkeys([
        *[str(item).strip() for item in existing_tags if str(item or "").strip()],
        *catalog["tags"],
    ]))
    stats = merged.get("adventure_stats") if isinstance(merged.get("adventure_stats"), Mapping) else {}
    merged["adventure_stats"] = {
        "shown": int(stats.get("shown") or stats.get("impressions") or 0),
        "selected": int(stats.get("selected") or stats.get("clicks") or 0),
        "saved": int(stats.get("saved") or 0),
        "shared": int(stats.get("shared") or stats.get("shares") or 0),
        "conversions": int(stats.get("conversions") or 0),
        "impressions": int(stats.get("impressions") or stats.get("shown") or 0),
        "clicks": int(stats.get("clicks") or stats.get("selected") or 0),
    }
    return merged


def hidden_enrichment(
    *,
    pipeline_source: str,
    model_id: str = "",
    reason: str,
    qa: Optional[Mapping[str, Any]] = None,
    stages: Optional[Mapping[str, Any]] = None,
) -> Dict[str, Any]:
    return {
        "version": 1,
        "pipelineSource": pipeline_source,
        "provenance": {"modelId": model_id or None},
        "qa": dict(qa or {"status": "uncertain", "reason": reason, "scores": {}, "artifacts": []}),
        "priceableManifest": None,
        "before": {"status": "not_available", "attempts": 0, "disclosure": None},
        "pair": {
            "version": 1,
            "status": "unpaired",
            "role": "after",
            "pairId": None,
            "counterpartImageId": None,
            "source": None,
        },
        "verification": {
            "status": "uncertain",
            "confidence": 0.0,
            "sameScene": False,
            "beforePlausible": False,
            "afterQualityValid": False,
            "manifestCoverage": [],
            "verifiedComponents": [],
            "unsupportedObservations": [],
            "observedDelta": [],
            "assumptions": [],
            "failureReasons": [reason],
        },
        "pricing": {
            "status": "failed",
            "confidence": "broad",
            "family": "",
            "packVersion": 1,
            "baseRange": {"low": 0, "likely": 0, "high": 0, "currency": "USD"},
            "localizedRange": {"low": 0, "likely": 0, "high": 0, "currency": "USD"},
            "locationLabel": "National typical range",
            "marketFactor": 1.0,
            "breakdown": [],
            "assumptions": [],
            "failureReasons": [reason],
        },
        "publish": {"status": "hidden", "reason": reason, "updatedAt": now_iso()},
        "stages": dict(stages or {"pipeline": _stage("failed", error=reason)}),
    }


def _ready_enrichment(
    *,
    pipeline_source: str,
    model_id: str,
    qa: Mapping[str, Any],
    manifest: Mapping[str, Any],
    before_url: str,
    before_image_id: str,
    before_attempts: int,
    verification: Mapping[str, Any],
    pricing: Mapping[str, Any],
    stages: Mapping[str, Any],
    pair_id: str = "",
) -> Dict[str, Any]:
    return {
        "version": 1,
        "pipelineSource": pipeline_source,
        "provenance": {"modelId": model_id or None},
        "qa": dict(qa),
        "priceableManifest": deepcopy(dict(manifest)),
        "before": {
            "status": "success",
            "imageId": before_image_id,
            "url": before_url,
            "attempts": before_attempts,
            "disclosure": "ai_generated_illustrative_before",
        },
        "pair": {
            "version": 1,
            "status": "linked",
            "role": "after",
            "pairId": pair_id or before_image_id,
            "counterpartImageId": before_image_id,
            "source": "generated",
        },
        "verification": {key: deepcopy(value) for key, value in verification.items() if key != "refinedManifest"},
        "pricing": deepcopy(dict(pricing)),
        "publish": {"status": "ready", "updatedAt": now_iso()},
        "stages": dict(stages),
    }


def process_classified_after(
    *,
    qa: Mapping[str, Any],
    model_id: str,
    pipeline_source: str = "legacy",
    manifest: Optional[Mapping[str, Any]] = None,
    city: str = "",
    state: str = "",
) -> Dict[str, Any]:
    """Publish a QA-approved, priceable image without manufacturing a before.

    This is the default legacy backfill path. A real or generated before can be
    linked later without changing the manifest or deterministic price result.
    """
    stages: Dict[str, Any] = {"qa": _stage("complete")}
    if str(qa.get("verdict") or qa.get("status") or "") != "keep":
        verdict = str(qa.get("verdict") or qa.get("status") or "uncertain")
        manifest_errors = qa.get("manifestErrors") if isinstance(qa.get("manifestErrors"), list) else []
        reason = (
            f"qa_{verdict}: " + "; ".join(str(error) for error in manifest_errors[:5])
            if manifest_errors
            else str(qa.get("reason") or f"qa_{verdict}")
        )
        return hidden_enrichment(
            pipeline_source=pipeline_source,
            model_id=model_id,
            reason=reason,
            qa=qa,
            stages=stages,
        )

    manifest_source = "planned" if pipeline_source == "planned" else "legacy_inferred"
    validated = validate_manifest(manifest or qa.get("priceableManifest"), source=manifest_source)
    if not validated.valid or not validated.manifest:
        stages["manifest"] = _stage("failed", error="; ".join(validated.errors))
        return hidden_enrichment(
            pipeline_source=pipeline_source,
            model_id=model_id,
            reason="invalid_or_unpriceable_manifest",
            qa=qa,
            stages=stages,
        )
    normalized = validated.manifest
    stages["manifest"] = _stage("complete")
    pricing = price_manifest(normalized, city=city, state=state)
    if pricing.get("status") != "complete":
        stages["pricing"] = _stage("failed", error="; ".join(pricing.get("failureReasons") or []))
        return hidden_enrichment(
            pipeline_source=pipeline_source,
            model_id=model_id,
            reason="deterministic_pricing_failed",
            qa=qa,
            stages=stages,
        )

    stages["pricePreflight"] = _stage("complete")
    stages["pricing"] = _stage("complete")
    stages["publish"] = _stage("complete")
    verification = {
        "status": "not_run",
        "confidence": 0.0,
        "sameScene": False,
        "beforePlausible": False,
        "afterQualityValid": True,
        "manifestCoverage": [row["componentKey"] for row in normalized["components"]],
        "verifiedComponents": [],
        "unsupportedObservations": [],
        "observedDelta": [],
        "assumptions": [],
        "failureReasons": [],
    }
    return {
        "version": 1,
        "pipelineSource": pipeline_source,
        "provenance": {"modelId": model_id or None},
        "qa": dict(qa),
        "priceableManifest": deepcopy(normalized),
        "before": {"status": "not_available", "attempts": 0, "disclosure": None},
        "pair": {
            "version": 1,
            "status": "unpaired",
            "role": "after",
            "pairId": None,
            "counterpartImageId": None,
            "source": None,
        },
        "verification": verification,
        "pricing": deepcopy(dict(pricing)),
        "publish": {"status": "ready", "updatedAt": now_iso()},
        "stages": stages,
    }


def process_legacy_after(
    *,
    after_url: str,
    qa: Mapping[str, Any],
    model_id: str,
    generate_before: ImageGenerator,
    verify: PairVerifier,
    persist_before: Callable[[str, int], Mapping[str, str]],
    city: str = "",
    state: str = "",
) -> Dict[str, Any]:
    """Process a legacy after. Provider/model failures fail closed and never delete it."""
    stages: Dict[str, Any] = {"qa": _stage("complete")}
    if str(qa.get("verdict") or "") != "keep":
        verdict = str(qa.get("verdict") or "uncertain")
        manifest_errors = qa.get("manifestErrors") if isinstance(qa.get("manifestErrors"), list) else []
        reason = (
            f"qa_{verdict}: " + "; ".join(str(error) for error in manifest_errors[:5])
            if manifest_errors
            else str(qa.get("reason") or f"qa_{verdict}")
        )
        return hidden_enrichment(pipeline_source="legacy", model_id=model_id, reason=reason, qa=qa, stages=stages)
    validated = validate_manifest(qa.get("priceableManifest"), source="legacy_inferred")
    if not validated.valid or not validated.manifest:
        stages["manifest"] = _stage("failed", error="; ".join(validated.errors))
        return hidden_enrichment(
            pipeline_source="legacy", model_id=model_id,
            reason="invalid_or_unpriceable_manifest", qa=qa, stages=stages,
        )
    manifest = validated.manifest
    stages["manifest"] = _stage("complete")
    # Persist national base pricing. Viewer-local factors are applied by the
    # gallery read path for the requesting instance.
    preflight = price_manifest(manifest)
    if preflight.get("status") != "complete":
        stages["pricePreflight"] = _stage("failed", error="; ".join(preflight.get("failureReasons") or []))
        return hidden_enrichment(pipeline_source="legacy", model_id=model_id, reason="price_preflight_failed", qa=qa, stages=stages)
    stages["pricePreflight"] = _stage("complete")

    before_url = ""
    verification: Optional[Dict[str, Any]] = None
    for attempt in (1, 2):
        prompt = build_before_prompt(manifest, failure_reasons=(verification or {}).get("failureReasons"))
        before_url = str(generate_before(prompt=prompt, after_url=after_url, attempt=attempt) or "").strip()
        if not before_url:
            verification = {"status": "failed", "failureReasons": ["before_generation_failed"]}
            continue
        verification = verify(before_url=before_url, after_url=after_url, manifest=manifest)
        if isinstance(verification, dict) and verification.get("status") == "passed":
            break
        if isinstance(verification, dict) and verification.get("afterQualityValid") is False:
            # Legacy afters are immutable. A new before cannot repair a bad after.
            break
    stages["before"] = _stage("complete" if before_url else "failed", attempts=attempt)
    stages["verification"] = _stage(
        "complete" if isinstance(verification, dict) and verification.get("status") == "passed" else "failed",
        attempts=attempt,
        error="; ".join((verification or {}).get("failureReasons") or []),
    )
    if not before_url or not isinstance(verification, dict) or verification.get("status") != "passed":
        return hidden_enrichment(pipeline_source="legacy", model_id=model_id, reason="before_pair_verification_failed", qa=qa, stages=stages)

    refined = refine_manifest_from_verification(manifest, verification.get("verifiedComponents"))
    if not refined.valid or not refined.manifest:
        stages["pricing"] = _stage("failed", error="; ".join(refined.errors))
        return hidden_enrichment(pipeline_source="legacy", model_id=model_id, reason="verification_invented_or_invalid_scope", qa=qa, stages=stages)
    pricing = price_manifest(refined.manifest)
    if pricing.get("status") != "complete":
        stages["pricing"] = _stage("failed", error="; ".join(pricing.get("failureReasons") or []))
        return hidden_enrichment(pipeline_source="legacy", model_id=model_id, reason="deterministic_pricing_failed", qa=qa, stages=stages)
    persisted = persist_before(before_url, attempt)
    stable_url = str(persisted.get("url") or "").strip()
    stable_id = str(persisted.get("imageId") or "").strip()
    if not stable_url or not stable_id:
        stages["persistence"] = _stage("failed", error="before persistence failed")
        return hidden_enrichment(pipeline_source="legacy", model_id=model_id, reason="before_persistence_failed", qa=qa, stages=stages)
    stages["pricing"] = _stage("complete")
    stages["persistence"] = _stage("complete")
    stages["publish"] = _stage("complete")
    return _ready_enrichment(
        pipeline_source="legacy", model_id=model_id, qa=qa, manifest=refined.manifest,
        before_url=stable_url, before_image_id=stable_id, before_attempts=attempt,
        verification=verification, pricing=pricing, stages=stages,
        pair_id=str(persisted.get("pairId") or ""),
    )


def process_planned_manifest(
    *,
    manifest: Mapping[str, Any],
    concept_description: str,
    generate_after: ImageGenerator,
    generate_before: ImageGenerator,
    verify: PairVerifier,
    persist_pair: Callable[[str, str, int], Mapping[str, str]],
    initial_after_url: str = "",
    model_id: str = "",
    city: str = "",
    state: str = "",
) -> Dict[str, Any]:
    """Full manifest-first path with one bounded corrective retry."""
    validated = validate_manifest(manifest, source="planned")
    qa = {"status": "keep", "reason": "planned_manifest", "scores": {}, "artifacts": []}
    stages: Dict[str, Any] = {}
    if not validated.valid or not validated.manifest:
        return hidden_enrichment(pipeline_source="planned", model_id=model_id, reason="invalid_manifest", qa=qa)
    normalized = validated.manifest
    preflight = price_manifest(normalized)
    if preflight.get("status") != "complete":
        return hidden_enrichment(pipeline_source="planned", model_id=model_id, reason="price_preflight_failed", qa=qa)
    stages["manifest"] = _stage("complete")
    stages["pricePreflight"] = _stage("complete")
    after_url = str(initial_after_url or "").strip()
    before_url = ""
    verification: Optional[Dict[str, Any]] = None
    regenerate_after = not bool(after_url)
    for attempt in (1, 2):
        if regenerate_after:
            after_url = str(generate_after(prompt=build_after_prompt(normalized, concept_description=concept_description), attempt=attempt) or "").strip()
        if not after_url:
            verification = {"status": "failed", "failureReasons": ["after_generation_failed"], "afterQualityValid": False}
            regenerate_after = True
            continue
        before_url = str(generate_before(
            prompt=build_before_prompt(normalized, failure_reasons=(verification or {}).get("failureReasons")),
            after_url=after_url,
            attempt=attempt,
        ) or "").strip()
        if not before_url:
            verification = {"status": "failed", "failureReasons": ["before_generation_failed"], "afterQualityValid": True}
            regenerate_after = False
            continue
        verification = verify(before_url=before_url, after_url=after_url, manifest=normalized)
        if isinstance(verification, dict) and verification.get("status") == "passed":
            break
        regenerate_after = not bool((verification or {}).get("afterQualityValid"))
    stages["after"] = _stage("complete" if after_url else "failed", attempts=attempt)
    stages["before"] = _stage("complete" if before_url else "failed", attempts=attempt)
    stages["verification"] = _stage(
        "complete" if isinstance(verification, dict) and verification.get("status") == "passed" else "failed",
        attempts=attempt,
        error="; ".join((verification or {}).get("failureReasons") or []),
    )
    if not before_url or not after_url or not isinstance(verification, dict) or verification.get("status") != "passed":
        return hidden_enrichment(pipeline_source="planned", model_id=model_id, reason="pair_verification_failed", qa=qa, stages=stages)
    refined = refine_manifest_from_verification(normalized, verification.get("verifiedComponents"))
    if not refined.valid or not refined.manifest:
        return hidden_enrichment(pipeline_source="planned", model_id=model_id, reason="verification_invented_or_invalid_scope", qa=qa, stages=stages)
    pricing = price_manifest(refined.manifest)
    if pricing.get("status") != "complete":
        return hidden_enrichment(pipeline_source="planned", model_id=model_id, reason="deterministic_pricing_failed", qa=qa, stages=stages)
    persisted = persist_pair(after_url, before_url, attempt)
    stable_after = str(persisted.get("afterUrl") or "").strip()
    stable_before = str(persisted.get("beforeUrl") or "").strip()
    before_id = str(persisted.get("beforeImageId") or "").strip()
    if not stable_after or not stable_before or not before_id:
        return hidden_enrichment(pipeline_source="planned", model_id=model_id, reason="pair_persistence_failed", qa=qa, stages=stages)
    stages["pricing"] = _stage("complete")
    stages["persistence"] = _stage("complete")
    stages["publish"] = _stage("complete")
    enrichment = _ready_enrichment(
        pipeline_source="planned", model_id=model_id, qa=qa, manifest=refined.manifest,
        before_url=stable_before, before_image_id=before_id, before_attempts=attempt,
        verification=verification, pricing=pricing, stages=stages,
        pair_id=str(persisted.get("pairId") or ""),
    )
    enrichment["after"] = {"url": stable_after, "attempts": attempt}
    return enrichment


def generate_with_existing_image_service(*, prompt: str, after_url: str = "", attempt: int = 1) -> Optional[str]:
    from programs.image_generator.orchestrator import generate_image

    payload: Dict[str, Any] = {
        "prompt": prompt,
        "useCase": "scene-refinement" if after_url else "scene",
        "modelId": str(os.getenv("ADVENTURE_GALLERY_IMAGE_MODEL") or "black-forest-labs/flux-2-pro").strip(),
        "numOutputs": 1,
        "outputFormat": "webp",
        "generationIntent": "gallery_before" if after_url else "gallery_after",
    }
    if after_url:
        payload["sceneImage"] = after_url
        payload["referenceImages"] = [after_url]
        payload["promptStrength"] = .35
    response = generate_image(payload)
    output = response.get("output") if isinstance(response, Mapping) else None
    if isinstance(output, str) and output.startswith(("http://", "https://")):
        return output
    if isinstance(output, list):
        for value in output:
            if isinstance(value, str) and value.startswith(("http://", "https://")):
                return value
    return None


__all__ = [
    "catalog_contract_metadata",
    "compatibility_metadata",
    "generate_with_existing_image_service",
    "hidden_enrichment",
    "merge_enrichment_metadata",
    "process_classified_after",
    "now_iso",
    "process_legacy_after",
    "process_planned_manifest",
]
