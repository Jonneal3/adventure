#!/usr/bin/env python3
"""Hide statistically weak gallery projects and report replacement demand."""

from __future__ import annotations

import argparse
import json
import os
import sys
from collections import Counter, defaultdict
from typing import Any, Dict, Mapping


ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
for path in (ROOT, SRC):
    if path not in sys.path:
        sys.path.insert(0, path)

from programs.gallery_enrichment.launch import (  # noqa: E402
    DEFAULT_LOW_PERFORMER_CLICK_RATE,
    DEFAULT_LOW_PERFORMER_IMPRESSIONS,
    MIN_ACTIVE_PROJECTS,
    is_low_performer,
)
from programs.gallery_enrichment.persistence import SupabaseGalleryStore, eligible_generated_gallery_row  # noqa: E402
from programs.gallery_enrichment.pipeline import merge_enrichment_metadata, now_iso  # noqa: E402


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Retire low-performing gallery projects without deleting source rows")
    parser.add_argument("--apply", action="store_true", help="Persist hides; otherwise print a dry-run report")
    parser.add_argument("--service-id", default="")
    parser.add_argument("--min-impressions", type=int, default=DEFAULT_LOW_PERFORMER_IMPRESSIONS)
    parser.add_argument("--max-click-rate", type=float, default=DEFAULT_LOW_PERFORMER_CLICK_RATE)
    parser.add_argument("--minimum-active", type=int, default=MIN_ACTIVE_PROJECTS)
    parser.add_argument("--target-active", type=int, default=75)
    args = parser.parse_args()

    if args.minimum_active < 1 or args.target_active < args.minimum_active:
        parser.error("--target-active must be at least --minimum-active")
    store = SupabaseGalleryStore(dry_run=not args.apply)
    gallery_ids = store.gallery_image_ids()
    by_service: Dict[str, list[Dict[str, Any]]] = defaultdict(list)
    for row in store.iter_images(service_id=args.service_id.strip(), page_size=200):
        if not eligible_generated_gallery_row(row, gallery_image_ids=gallery_ids):
            continue
        metadata = _mapping(row.get("metadata"))
        enrichment = _mapping(metadata.get("gallery_enrichment"))
        publish = _mapping(enrichment.get("publish"))
        if publish.get("status") != "ready":
            continue
        manifest = _mapping(enrichment.get("priceableManifest"))
        service_id = str(manifest.get("serviceId") or row.get("subcategory_id") or "").strip()
        if service_id:
            by_service[service_id].append(dict(row))

    counts = Counter()
    services: list[Dict[str, Any]] = []
    for service_id, rows in sorted(by_service.items()):
        active = len(rows)
        candidates = [
            row for row in rows
            if is_low_performer(
                _mapping(row.get("metadata")),
                min_impressions=args.min_impressions,
                max_click_rate=args.max_click_rate,
            )
        ]
        candidates.sort(key=lambda row: int(_mapping(_mapping(row.get("metadata")).get("adventure_stats")).get("shown") or 0), reverse=True)
        capacity = max(0, active - args.minimum_active)
        retiring = candidates[:capacity]
        for row in retiring:
            metadata = dict(_mapping(row.get("metadata")))
            enrichment = dict(_mapping(metadata.get("gallery_enrichment")))
            enrichment["publish"] = {
                "status": "hidden",
                "reason": "low_performance",
                "updatedAt": now_iso(),
            }
            final_metadata = merge_enrichment_metadata(metadata, enrichment)
            lifecycle = dict(_mapping(final_metadata.get("gallery_launch")))
            if lifecycle:
                lifecycle.update({"status": "retired", "retiredAt": now_iso(), "reason": "low_performance"})
                final_metadata["gallery_launch"] = lifecycle
            store.patch_metadata(str(row.get("id") or ""), final_metadata)
            counts["retired"] += 1
        remaining = active - len(retiring)
        replacement_needed = max(0, args.target_active - remaining)
        counts["replacement_needed"] += replacement_needed
        services.append({
            "serviceId": service_id,
            "activeBefore": active,
            "eligibleLowPerformers": len(candidates),
            "retired": len(retiring),
            "activeAfter": remaining,
            "replacementNeeded": replacement_needed,
        })
    print(json.dumps({
        "apply": bool(args.apply),
        "policy": {
            "minImpressions": args.min_impressions,
            "maxClickRate": args.max_click_rate,
            "minimumActive": args.minimum_active,
            "targetActive": args.target_active,
        },
        "counts": dict(counts),
        "services": services,
    }, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
