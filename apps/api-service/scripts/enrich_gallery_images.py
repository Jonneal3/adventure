#!/usr/bin/env python3
"""Resumable manifest-first enrichment for generated gallery images.

Examples:
  PYTHONPATH=src python scripts/enrich_gallery_images.py --limit 20 --dry-run
  PYTHONPATH=src python scripts/enrich_gallery_images.py --service-id UUID --limit 0
  PYTHONPATH=src python scripts/enrich_gallery_images.py --with-before --force --limit 20

This command never deletes source rows. Failed, uncertain, duplicate, or
unsupported rows are retained with ``publish.status=hidden`` metadata.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Mapping


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from programs.gallery_enrichment.manifest import validate_manifest  # noqa: E402
from programs.gallery_enrichment.persistence import (  # noqa: E402
    SupabaseGalleryStore,
    eligible_generated_gallery_row,
)
from programs.gallery_enrichment.pipeline import (  # noqa: E402
    generate_with_existing_image_service,
    hidden_enrichment,
    merge_enrichment_metadata,
    process_classified_after,
    process_legacy_after,
    process_planned_manifest,
)
from programs.gallery_enrichment.pricing import price_manifest  # noqa: E402
from programs.gallery_enrichment.service_resolution import resolve_legacy_service  # noqa: E402
from programs.gallery_enrichment.vision import (  # noqa: E402
    classify_service_family,
    gallery_vision_enabled,
    qa_and_infer_manifest,
    verify_pair,
)


def _metadata(row: Mapping[str, Any]) -> Dict[str, Any]:
    return dict(row.get("metadata")) if isinstance(row.get("metadata"), Mapping) else {}


def _current_enrichment(meta: Mapping[str, Any]) -> Mapping[str, Any]:
    value = meta.get("gallery_enrichment")
    return value if isinstance(value, Mapping) else {}


def _model_id(row: Mapping[str, Any]) -> str:
    meta = _metadata(row)
    return str(row.get("model_id") or meta.get("ai_model") or meta.get("model_id") or meta.get("model_name") or "").strip()


def _planned_manifest(meta: Mapping[str, Any]) -> Any:
    enrichment = _current_enrichment(meta)
    manifest = enrichment.get("priceableManifest")
    if not isinstance(manifest, Mapping):
        manifest = meta.get("priceable_manifest") or meta.get("priceableManifest")
    if not isinstance(manifest, Mapping):
        return None
    source = str(manifest.get("source") or enrichment.get("pipelineSource") or "").strip()
    return manifest if source == "planned" else None


def _stage(status: str, *, attempts: int = 1, error: str = "") -> Dict[str, Any]:
    value: Dict[str, Any] = {
        "version": 1,
        "status": status,
        "attempts": attempts,
        "updatedAt": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
    }
    if error:
        value["error"] = str(error)[:500]
    return value


def _legacy_checkpoint(
    *,
    model_id: str,
    qa: Mapping[str, Any],
    manifest: Mapping[str, Any],
    preflight: Mapping[str, Any],
) -> Dict[str, Any]:
    """Canonical pending state used to resume after the expensive QA stage."""
    return {
        "version": 1,
        "pipelineSource": "legacy",
        "provenance": {"modelId": model_id or None},
        "qa": dict(qa),
        "priceableManifest": dict(manifest),
        "before": {
            "status": "not_generated",
            "attempts": 0,
            "disclosure": "ai_generated_illustrative_before",
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
            "failureReasons": [],
        },
        "pricing": dict(preflight),
        "publish": {"status": "pending"},
        "stages": {
            "serviceResolution": _stage("complete"),
            "qa": _stage("complete"),
            "manifest": _stage("complete"),
            "pricePreflight": _stage("complete"),
        },
    }


def _resumable_legacy_qa(current: Mapping[str, Any]) -> Dict[str, Any] | None:
    if current.get("version") != 1 or current.get("pipelineSource") != "legacy":
        return None
    publish = current.get("publish") if isinstance(current.get("publish"), Mapping) else {}
    stages = current.get("stages") if isinstance(current.get("stages"), Mapping) else {}
    qa_stage = stages.get("qa") if isinstance(stages.get("qa"), Mapping) else {}
    qa = current.get("qa") if isinstance(current.get("qa"), Mapping) else {}
    manifest = current.get("priceableManifest") if isinstance(current.get("priceableManifest"), Mapping) else None
    if publish.get("status") == "pending" and qa_stage.get("status") == "complete":
        if str(qa.get("verdict") or qa.get("status") or "") != "keep" or not manifest:
            return None
    elif (
        publish.get("status") == "hidden"
        and str(publish.get("reason") or "").startswith("qa_uncertain:")
        and isinstance(qa.get("manifestErrors"), list)
        and qa.get("manifestErrors")
        and isinstance(qa.get("priceableManifest"), Mapping)
    ):
        # A newer deterministic normalizer may repair a previously malformed
        # enum without another model call. The strict validator still decides.
        manifest = qa.get("priceableManifest")
    else:
        return None
    normalized = validate_manifest(manifest, source="legacy_inferred")
    if not normalized.valid or not normalized.manifest:
        return None
    return {
        **dict(qa),
        "status": "keep",
        "verdict": "keep",
        "priceableManifest": normalized.manifest,
        "manifestErrors": [],
    }


def _write_hidden(
    store: SupabaseGalleryStore,
    row: Mapping[str, Any],
    *,
    reason: str,
    pipeline_source: str = "legacy",
    qa: Mapping[str, Any] | None = None,
) -> None:
    enrichment = hidden_enrichment(
        pipeline_source=pipeline_source,
        model_id=_model_id(row),
        reason=reason,
        qa=qa,
    )
    store.patch_metadata(str(row.get("id") or ""), merge_enrichment_metadata(_metadata(row), enrichment))


def _reconcile_existing_pair(
    store: SupabaseGalleryStore,
    row: Mapping[str, Any],
    enrichment: Mapping[str, Any],
) -> Dict[str, Any]:
    """Restore an already-persisted verified child link without generating media."""
    current = dict(enrichment)
    publish = current.get("publish") if isinstance(current.get("publish"), Mapping) else {}
    pair = current.get("pair") if isinstance(current.get("pair"), Mapping) else {}
    if publish.get("status") != "ready" or pair.get("status") == "linked":
        return current
    child = store.existing_before_child(str(row.get("id") or ""))
    child_url = str((child or {}).get("image_url") or "").strip()
    child_id = str((child or {}).get("id") or "").strip()
    if not child_id or not child_url.startswith(("http://", "https://")):
        return current
    child_meta = _metadata(child or {})
    child_pair = child_meta.get("gallery_pair") if isinstance(child_meta.get("gallery_pair"), Mapping) else {}
    manifest = current.get("priceableManifest") if isinstance(current.get("priceableManifest"), Mapping) else {}
    components = list(manifest.get("components") or [])
    current["before"] = {
        "status": "success",
        "imageId": child_id,
        "url": child_url,
        "attempts": int(child_meta.get("attempt") or 1),
        "disclosure": "ai_generated_illustrative_before",
    }
    current["pair"] = {
        "version": 1,
        "status": "linked",
        "role": "after",
        "pairId": str(child_pair.get("pair_id") or row.get("id") or ""),
        "counterpartImageId": child_id,
        "source": str(child_pair.get("source") or "generated"),
    }
    verification = dict(current.get("verification")) if isinstance(current.get("verification"), Mapping) else {}
    verification.update({
        "status": "passed",
        "sameScene": True,
        "beforePlausible": True,
        "afterQualityValid": True,
        "manifestCoverage": [str(item.get("componentKey") or "") for item in components if isinstance(item, Mapping)],
        "verifiedComponents": components,
        "failureReasons": [],
    })
    current["verification"] = verification
    return current


def _process_planned(
    store: SupabaseGalleryStore,
    row: Mapping[str, Any],
    manifest: Mapping[str, Any],
    *,
    with_before: bool,
    city: str,
    state: str,
) -> Dict[str, Any]:
    meta = _metadata(row)
    description = str(meta.get("option_description") or meta.get("description") or meta.get("option_label") or "").strip()
    if not with_before:
        qa = qa_and_infer_manifest(
            str(row.get("image_url") or ""),
            pricing_family=str(manifest.get("pricingFamily") or ""),
            service_id=str(manifest.get("serviceId") or row.get("subcategory_id") or ""),
            model_id=_model_id(row),
        )
        if not qa:
            return hidden_enrichment(
                pipeline_source="planned",
                model_id=_model_id(row),
                reason="qa_provider_failure",
            )
        return process_classified_after(
            qa=qa,
            model_id=_model_id(row),
            pipeline_source="planned",
            city=city,
            state=state,
        )
    return process_planned_manifest(
        manifest=manifest,
        concept_description=description,
        generate_after=lambda **kwargs: generate_with_existing_image_service(**kwargs),
        generate_before=lambda **kwargs: generate_with_existing_image_service(**kwargs),
        verify=lambda **kwargs: verify_pair(**kwargs),
        persist_pair=lambda after_url, before_url, attempt: store.persist_planned_pair(row, after_url, before_url, attempt),
        initial_after_url=str(row.get("image_url") or ""),
        model_id=_model_id(row),
        city=city,
        state=state,
    )


def _process_legacy(
    store: SupabaseGalleryStore,
    row: Mapping[str, Any],
    *,
    services_by_id: Mapping[str, Mapping[str, Any]],
    current: Mapping[str, Any],
    checkpoint: Callable[[Mapping[str, Any]], None],
    with_before: bool,
    city: str,
    state: str,
) -> Dict[str, Any]:
    qa = _resumable_legacy_qa(current)
    if not qa:
        resolved = resolve_legacy_service(
            row,
            services_by_id=services_by_id,
            classifier=classify_service_family,
        )
        if resolved.status != "resolved" or not resolved.pricing_family:
            return hidden_enrichment(
                pipeline_source="legacy",
                model_id=_model_id(row),
                reason=f"service_{resolved.status or 'uncertain'}",
                qa={
                    "status": "uncertain",
                    "reason": resolved.reason,
                    "serviceResolution": {
                        "status": resolved.status,
                        "source": resolved.source,
                        "confidence": resolved.confidence,
                    },
                    "scores": {},
                    "artifacts": [],
                },
            )
        qa = qa_and_infer_manifest(
            str(row.get("image_url") or ""),
            pricing_family=resolved.pricing_family,
            service_id=resolved.service_id,
            model_id=_model_id(row),
        )
        if not qa:
            return hidden_enrichment(
                pipeline_source="legacy",
                model_id=_model_id(row),
                reason="qa_provider_failure",
            )
        qa["serviceResolution"] = {
            "status": resolved.status,
            "source": resolved.source,
            "confidence": resolved.confidence,
            "serviceId": resolved.service_id,
            "serviceKey": resolved.service_key,
            "pricingFamily": resolved.pricing_family,
        }
        manifest_result = validate_manifest(qa.get("priceableManifest"), source="legacy_inferred")
        preflight = price_manifest(manifest_result.manifest) if manifest_result.valid and manifest_result.manifest else None
        if qa.get("verdict") == "keep" and preflight and preflight.get("status") == "complete":
            checkpoint(_legacy_checkpoint(
                model_id=_model_id(row),
                qa=qa,
                manifest=manifest_result.manifest,
                preflight=preflight,
            ))
    if not with_before:
        return process_classified_after(
            qa=qa,
            model_id=_model_id(row),
            pipeline_source="legacy",
            city=city,
            state=state,
        )
    return process_legacy_after(
        after_url=str(row.get("image_url") or ""),
        qa=qa,
        model_id=_model_id(row),
        generate_before=lambda **kwargs: generate_with_existing_image_service(**kwargs),
        verify=lambda **kwargs: verify_pair(**kwargs),
        persist_before=lambda provider_url, attempt: store.persist_before_child(row, provider_url, attempt),
        city=city,
        state=state,
    )


def main() -> int:
    parser = argparse.ArgumentParser(description="Cull and enrich generated gallery images without deleting sources")
    parser.add_argument("--limit", type=int, default=20, help="Maximum candidate rows; 0 means all")
    parser.add_argument("--service-id", default="", help="Only process one subcategory/service id")
    parser.add_argument("--force", action="store_true", help="Re-run rows with current completed enrichment")
    parser.add_argument("--dry-run", action="store_true", help="Run providers and validation without database writes")
    parser.add_argument(
        "--materialize-contract-only",
        action="store_true",
        help="Refresh badge, tags, metrics, lifecycle, and compatibility metadata without provider calls",
    )
    parser.add_argument(
        "--reconcile-existing-pairs",
        action="store_true",
        help="Reconnect already-persisted illustrative-before children without generating new images",
    )
    parser.add_argument(
        "--with-before",
        action="store_true",
        help="Generate and verify synthetic legacy befores; omitted by default for the fast classification backfill",
    )
    parser.add_argument("--page-size", type=int, default=100)
    parser.add_argument("--shard-count", type=int, default=1, help="Split candidates across deterministic parallel workers")
    parser.add_argument("--shard-index", type=int, default=0, help="Zero-based worker shard index")
    parser.add_argument(
        "--skip-content-hash",
        action="store_true",
        help="Skip byte-hash duplicate detection during QA; exact duplicate URLs are still collapsed",
    )
    parser.add_argument("--sleep", type=float, default=0.05)
    args = parser.parse_args()

    if args.shard_count < 1 or args.shard_index < 0 or args.shard_index >= args.shard_count:
        parser.error("--shard-count must be >= 1 and --shard-index must be within that count")

    if not args.materialize_contract_only and not gallery_vision_enabled():
        print("Gallery VLM is not configured. Set GEMINI_API_KEY or REPLICATE_API_TOKEN.", file=sys.stderr)
        return 1
    store = SupabaseGalleryStore(dry_run=args.dry_run)
    services_by_id = store.services_by_id()
    gallery_image_ids = store.gallery_image_ids()
    cap = None if args.limit <= 0 else args.limit
    counts = {
        "candidates": 0,
        "ready": 0,
        "hidden": 0,
        "skipped": 0,
        "duplicates": 0,
        "failed": 0,
    }
    seen_urls: Dict[str, str] = {}
    seen_hashes: Dict[str, str] = {}
    rows = list(store.iter_images(service_id=args.service_id.strip(), page_size=max(1, min(args.page_size, 200))))
    canonical_urls: Dict[str, str] = {}
    for row in rows:
        if eligible_generated_gallery_row(row, gallery_image_ids=gallery_image_ids):
            image_url = str(row.get("image_url") or "").strip()
            if image_url:
                canonical_urls.setdefault(image_url, str(row.get("id") or ""))

    for row in rows:
        if not eligible_generated_gallery_row(row, gallery_image_ids=gallery_image_ids):
            continue
        image_id = str(row.get("id") or "")
        shard = int(hashlib.sha256(image_id.encode("utf-8")).hexdigest()[:8], 16) % args.shard_count
        if shard != args.shard_index:
            continue
        if cap is not None and counts["candidates"] >= cap:
            break
        counts["candidates"] += 1
        meta = _metadata(row)
        current = _current_enrichment(meta)
        current_publish = current.get("publish") if isinstance(current.get("publish"), Mapping) else {}
        image_url = str(row.get("image_url") or "").strip()
        if args.materialize_contract_only:
            if current.get("version") != 1:
                counts["skipped"] += 1
                print(f"skip {image_id} enrichment=missing")
                continue
            materialized = _reconcile_existing_pair(store, row, current) if args.reconcile_existing_pairs else dict(current)
            store.patch_metadata(image_id, merge_enrichment_metadata(meta, materialized))
            status = str(current_publish.get("status") or "hidden")
            counts["ready" if status == "ready" else "hidden"] += 1
            print(f"materialized {image_id} publish={status}")
            continue
        repairable_hidden = current_publish.get("status") == "hidden" and _resumable_legacy_qa(current) is not None
        retryable_provider_failure = (
            current_publish.get("status") == "hidden"
            and str(current_publish.get("reason") or "") == "qa_provider_failure"
        )
        if (
            not args.force
            and current.get("version") == 1
            and current_publish.get("status") in {"ready", "hidden"}
            and not repairable_hidden
            and not retryable_provider_failure
        ):
            if current_publish.get("status") == "ready" and image_url:
                seen_urls.setdefault(image_url, image_id)
                digest = None if args.skip_content_hash else store.image_digest(image_url)
                if digest:
                    seen_hashes.setdefault(digest, image_id)
            counts["skipped"] += 1
            print(f"skip {image_id} publish={current_publish.get('status')}")
            continue

        needs_source_preflight = retryable_provider_failure or not current
        if needs_source_preflight and not store.image_accessible(image_url):
            _write_hidden(store, row, reason="source_image_unavailable")
            counts["hidden"] += 1
            print(f"hidden {image_id} source_image_unavailable")
            continue

        canonical_id = canonical_urls.get(image_url) if image_url else None
        duplicate_of = canonical_id if canonical_id and canonical_id != image_id else None
        if not duplicate_of:
            duplicate_of = seen_urls.get(image_url) if image_url else None
        digest = None
        if not duplicate_of and image_url and not args.skip_content_hash:
            digest = store.image_digest(image_url)
            duplicate_of = seen_hashes.get(digest) if digest else None
        if duplicate_of:
            _write_hidden(store, row, reason=f"exact_duplicate_of:{duplicate_of}")
            counts["duplicates"] += 1
            counts["hidden"] += 1
            print(f"hidden {image_id} exact_duplicate_of={duplicate_of}")
            continue
        if image_url:
            seen_urls[image_url] = image_id
        if digest:
            seen_hashes[digest] = image_id

        # Canonical metadata stores national pricing. Localization happens when
        # a gallery is read for a specific instance.
        city, state = "", ""
        planned = _planned_manifest(meta)
        try:
            enrichment = (
                _process_planned(
                    store,
                    row,
                    planned,
                    with_before=bool(args.with_before),
                    city=city,
                    state=state,
                )
                if isinstance(planned, Mapping)
                else _process_legacy(
                    store,
                    row,
                    services_by_id=services_by_id,
                    current=current,
                    checkpoint=lambda value: store.patch_metadata(
                        image_id,
                        merge_enrichment_metadata(meta, value),
                    ),
                    with_before=bool(args.with_before),
                    city=city,
                    state=state,
                )
            )
            store.patch_metadata(image_id, merge_enrichment_metadata(meta, enrichment))
            publish = enrichment.get("publish") if isinstance(enrichment.get("publish"), Mapping) else {}
            status = str(publish.get("status") or "hidden")
            if status == "ready":
                counts["ready"] += 1
            else:
                counts["hidden"] += 1
            print(
                f"{'dry ' if args.dry_run else ''}{status} {image_id} "
                f"source={enrichment.get('pipelineSource')} reason={publish.get('reason') or ''}"
            )
        except Exception as exc:
            counts["failed"] += 1
            reason = f"pipeline_exception:{type(exc).__name__}"
            _write_hidden(store, row, reason=reason, pipeline_source="planned" if planned else "legacy")
            print(f"failed {image_id} {reason}: {str(exc)[:300]}", file=sys.stderr)
        time.sleep(max(0.0, args.sleep))

    print(json.dumps({
        **counts,
        "dryRun": bool(args.dry_run),
        "withBefore": bool(args.with_before),
        "contentHashChecked": not bool(args.skip_content_hash),
        "materializeContractOnly": bool(args.materialize_contract_only),
        "reconciledExistingPairs": bool(args.reconcile_existing_pairs),
        "shardCount": args.shard_count,
        "shardIndex": args.shard_index,
    }, sort_keys=True))
    return 0 if counts["failed"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
