#!/usr/bin/env python3
"""Launch manifest-first, automatically curated gallery verticals from JSON config.

The command is plan-only unless ``--apply`` is supplied. Successful rows are
stored as durable before/after pairs; rejected generations remain hidden.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
from collections import Counter
from typing import Any, Dict, Mapping


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
for path in (ROOT, SRC):
    if path not in sys.path:
        sys.path.insert(0, path)

from programs.gallery_enrichment.launch import (  # noqa: E402
    MAX_ACTIVE_PROJECTS,
    MIN_ACTIVE_PROJECTS,
    build_project_concepts,
    initial_project_metadata,
    launch_catalog_key,
)
from programs.gallery_enrichment.persistence import SupabaseGalleryStore  # noqa: E402
from programs.gallery_enrichment.pipeline import (  # noqa: E402
    generate_with_existing_image_service,
    merge_enrichment_metadata,
    process_planned_manifest,
)
from programs.gallery_enrichment.prompts import build_after_prompt  # noqa: E402
from programs.gallery_enrichment.registry import resolve_pricing_family  # noqa: E402
from programs.gallery_enrichment.vision import gallery_vision_enabled, verify_pair  # noqa: E402


def _load_config(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as handle:
        value = json.load(handle)
    if not isinstance(value, dict) or value.get("version") != 1 or not isinstance(value.get("verticals"), list):
        raise ValueError("config must be an object with version=1 and a verticals array")
    return value


def _ready_for_service(store: SupabaseGalleryStore, service_id: str) -> int:
    ready = 0
    for row in store.iter_images(service_id=service_id, page_size=200):
        metadata = row.get("metadata") if isinstance(row.get("metadata"), Mapping) else {}
        enrichment = metadata.get("gallery_enrichment") if isinstance(metadata.get("gallery_enrichment"), Mapping) else {}
        publish = enrichment.get("publish") if isinstance(enrichment.get("publish"), Mapping) else {}
        catalog = metadata.get("gallery_catalog") if isinstance(metadata.get("gallery_catalog"), Mapping) else {}
        lifecycle = str(metadata.get("gallery_status") or catalog.get("status") or "active")
        if publish.get("status") == "ready" and lifecycle != "hidden":
            ready += 1
    return ready


def _validated_verticals(config: Mapping[str, Any], services: Mapping[str, Mapping[str, Any]]) -> list[Dict[str, Any]]:
    rows: list[Dict[str, Any]] = []
    seen: set[str] = set()
    for raw in config.get("verticals") or []:
        if not isinstance(raw, Mapping):
            continue
        service_id = str(raw.get("serviceId") or "").strip()
        vertical_key = str(raw.get("key") or "").strip().lower().replace(" ", "_")
        service = services.get(service_id) or {}
        family = resolve_pricing_family(
            raw.get("pricingFamily"),
            service.get("subcategory"),
            service.get("service_summary"),
            service.get("category_name"),
        )
        target = int(raw.get("targetProjects") or config.get("targetProjectsPerVertical") or 75)
        if not service_id or not vertical_key or vertical_key in seen:
            raise ValueError("each vertical needs a unique key and serviceId")
        if not service or str(service.get("status") or "").lower() != "active" or str(service.get("category_status") or "").lower() != "active":
            raise ValueError(f"vertical {vertical_key} must reference an active service in an active category")
        if not family:
            raise ValueError(f"vertical {vertical_key} does not resolve to a launch-supported pricing family")
        if target < MIN_ACTIVE_PROJECTS or target > MAX_ACTIVE_PROJECTS:
            raise ValueError(f"vertical {vertical_key} targetProjects must be between 50 and 100")
        seen.add(vertical_key)
        rows.append({
            "key": vertical_key,
            "industry": str(raw.get("industry") or service.get("category_name") or "").strip(),
            "serviceId": service_id,
            "serviceName": str(raw.get("serviceName") or service.get("subcategory") or "").strip(),
            "pricingFamily": family,
            "targetProjects": target,
        })
    if not 3 <= len(rows) <= 5:
        raise ValueError("launch config must contain 3 to 5 active verticals")
    return rows


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate and publish 3-5 manifest-first gallery verticals")
    parser.add_argument("--config", required=True, help="Path to versioned vertical launch JSON")
    parser.add_argument("--apply", action="store_true", help="Generate media and persist changes; otherwise plan only")
    parser.add_argument("--service-id", default="", help="Limit execution to one configured service")
    parser.add_argument("--limit", type=int, default=0, help="Limit newly attempted projects across the run")
    parser.add_argument("--replacement-buffer", type=int, default=25, help="Extra concepts available when outputs are rejected")
    parser.add_argument("--shard-count", type=int, default=1, help="Split deterministic concepts across parallel workers")
    parser.add_argument("--shard-index", type=int, default=0, help="Zero-based worker shard index")
    parser.add_argument("--sleep", type=float, default=0.2)
    args = parser.parse_args()

    if args.shard_count < 1 or args.shard_index < 0 or args.shard_index >= args.shard_count:
        parser.error("--shard-count must be >= 1 and --shard-index must be within that count")

    if args.apply and not gallery_vision_enabled():
        print("Gallery VLM is not configured.", file=sys.stderr)
        return 1
    config = _load_config(args.config)
    store = SupabaseGalleryStore(dry_run=not args.apply)
    verticals = _validated_verticals(config, store.services_by_id())
    model_id = str(config.get("imageModel") or os.getenv("ADVENTURE_GALLERY_IMAGE_MODEL") or "black-forest-labs/flux-2-pro").strip()
    counts = Counter()

    for vertical in verticals:
        if args.service_id and vertical["serviceId"] != args.service_id:
            continue
        active = _ready_for_service(store, vertical["serviceId"])
        needed = max(0, vertical["targetProjects"] - active)
        pool_size = min(200, vertical["targetProjects"] + max(0, args.replacement_buffer))
        concepts = build_project_concepts(
            service_id=vertical["serviceId"],
            pricing_family=vertical["pricingFamily"],
            target_count=pool_size,
        )
        print(json.dumps({"vertical": vertical["key"], "active": active, "target": vertical["targetProjects"], "needed": needed, "pool": len(concepts)}))
        if not args.apply:
            counts["planned"] += needed
            continue
        for concept_index, concept in enumerate(concepts):
            if concept_index % args.shard_count != args.shard_index:
                continue
            if active >= vertical["targetProjects"]:
                break
            if args.limit > 0 and counts["attempted"] >= args.limit:
                break
            catalog_key = launch_catalog_key(vertical["key"], vertical["serviceId"], concept["key"])
            existing = store.image_by_catalog_key(catalog_key)
            if existing:
                counts["existing"] += 1
                continue
            counts["attempted"] += 1
            manifest = concept["manifest"]
            provider_after = generate_with_existing_image_service(
                prompt=build_after_prompt(manifest, concept_description=concept["description"]),
                attempt=1,
            )
            if not provider_after:
                counts["generation_failed"] += 1
                continue
            base_metadata = initial_project_metadata(
                vertical_key=vertical["key"],
                industry=vertical["industry"],
                service_id=vertical["serviceId"],
                service_name=vertical["serviceName"],
                concept=concept,
                model_id=model_id,
            )
            parent = store.persist_planned_after(
                image_url=provider_after,
                service_id=vertical["serviceId"],
                metadata=base_metadata,
                model_id=None,
            )
            if not parent:
                counts["persistence_failed"] += 1
                continue
            enrichment = process_planned_manifest(
                manifest=manifest,
                concept_description=concept["description"],
                generate_after=lambda **kwargs: generate_with_existing_image_service(**kwargs),
                generate_before=lambda **kwargs: generate_with_existing_image_service(**kwargs),
                verify=lambda **kwargs: verify_pair(**kwargs),
                persist_pair=lambda after_url, before_url, attempt: store.persist_planned_pair(parent, after_url, before_url, attempt),
                initial_after_url=str(parent.get("image_url") or ""),
                model_id=model_id,
            )
            final_metadata = merge_enrichment_metadata(base_metadata, enrichment)
            launch = dict(final_metadata.get("gallery_launch") or {})
            ready = (enrichment.get("publish") or {}).get("status") == "ready"
            launch["status"] = "ready" if ready else "rejected"
            final_metadata["gallery_launch"] = launch
            store.patch_metadata(str(parent.get("id") or ""), final_metadata)
            counts["ready" if ready else "rejected"] += 1
            if ready:
                active += 1
            print(json.dumps({"vertical": vertical["key"], "imageId": parent.get("id"), "status": "ready" if ready else "hidden", "active": active}))
            time.sleep(max(0.0, args.sleep))
        counts[f"active:{vertical['key']}"] = active

    print(json.dumps({
        **counts,
        "apply": bool(args.apply),
        "shardCount": args.shard_count,
        "shardIndex": args.shard_index,
    }, sort_keys=True))
    return 0 if not counts["generation_failed"] and not counts["persistence_failed"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
