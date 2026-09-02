#!/usr/bin/env python3
"""Read-only audit of the publishable gallery contract and vertical coverage."""

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

from programs.gallery_enrichment.persistence import SupabaseGalleryStore, eligible_generated_gallery_row  # noqa: E402
from programs.gallery_enrichment.registry import resolve_pricing_family  # noqa: E402


def _mapping(value: Any) -> Mapping[str, Any]:
    return value if isinstance(value, Mapping) else {}


def main() -> int:
    parser = argparse.ArgumentParser(description="Audit gallery readiness and launch coverage")
    parser.add_argument("--json", action="store_true", help="Print machine-readable JSON only")
    parser.add_argument("--services-matching", default="", help="Comma-separated service-name fragments to list")
    args = parser.parse_args()

    store = SupabaseGalleryStore(dry_run=True)
    services = store.services_by_id()
    if args.services_matching:
        fragments = [item.strip().lower() for item in args.services_matching.split(",") if item.strip()]
        matches = [
            {
                "serviceId": service_id,
                "service": service.get("subcategory"),
                "serviceStatus": service.get("status"),
                "category": service.get("category_name"),
                "categoryStatus": service.get("category_status"),
            }
            for service_id, service in services.items()
            if any(fragment in str(service.get("subcategory") or "").lower() for fragment in fragments)
        ]
        print(json.dumps(matches, indent=2, sort_keys=True))
        return 0
    gallery_ids = store.gallery_image_ids()
    summary = Counter()
    hidden_reasons = Counter()
    family_counts = Counter()
    service_counts: Dict[str, Counter] = defaultdict(Counter)

    for row in store.iter_images(page_size=200):
        metadata = _mapping(row.get("metadata"))
        if str(metadata.get("generated_for") or "") == "illustrative_before":
            summary["before_children"] += 1
            continue
        if not eligible_generated_gallery_row(row, gallery_image_ids=gallery_ids):
            continue
        summary["eligible_sources"] += 1
        enrichment = _mapping(metadata.get("gallery_enrichment"))
        publish = _mapping(enrichment.get("publish"))
        status = str(publish.get("status") or "unprocessed")
        summary[status] += 1
        if status == "hidden":
            hidden_reasons[str(publish.get("reason") or "unspecified")] += 1
        if status != "ready":
            continue

        manifest = _mapping(enrichment.get("priceableManifest"))
        pricing = _mapping(enrichment.get("pricing"))
        pair = _mapping(enrichment.get("pair"))
        service_id = str(manifest.get("serviceId") or row.get("subcategory_id") or "unknown")
        family = str(manifest.get("pricingFamily") or "unknown")
        family_counts[family] += 1
        service_counts[service_id]["ready"] += 1
        if pair.get("status") == "linked":
            summary["ready_paired"] += 1
        else:
            summary["ready_after_only"] += 1
        if pricing.get("status") == "complete" and pricing.get("breakdown"):
            summary["ready_priced"] += 1
        if manifest.get("components"):
            summary["ready_tagged"] += 1
        catalog = _mapping(metadata.get("gallery_catalog"))
        if metadata.get("gallery_badge") or catalog.get("badge"):
            summary["ready_badged"] += 1
        stats = _mapping(metadata.get("adventure_stats"))
        if "shown" in stats and "selected" in stats:
            summary["ready_metrics_initialized"] += 1
        if str(metadata.get("gallery_status") or catalog.get("status") or "") == "active":
            summary["ready_active"] += 1
            service_counts[service_id]["active"] += 1

    service_rows = []
    for service_id, counts in sorted(service_counts.items(), key=lambda item: (-item[1]["active"], item[0])):
        service = services.get(service_id) or {}
        service_rows.append({
            "serviceId": service_id,
            "service": service.get("subcategory") or "Unknown service",
            "serviceStatus": service.get("status"),
            "category": service.get("category_name"),
            "categoryStatus": service.get("category_status"),
            "ready": counts["ready"],
            "active": counts["active"],
            "meets50": 50 <= counts["active"] <= 100,
        })

    result = {
        "counts": dict(summary),
        "families": dict(family_counts.most_common()),
        "hiddenReasons": dict(hidden_reasons.most_common()),
        "services": service_rows,
        "launchCandidates": [
            {
                "serviceId": service_id,
                "service": service.get("subcategory"),
                "serviceStatus": service.get("status"),
                "category": service.get("category_name"),
                "categoryStatus": service.get("category_status"),
                "pricingFamily": family,
            }
            for service_id, service in sorted(services.items(), key=lambda item: (str(item[1].get("category_name") or ""), str(item[1].get("subcategory") or "")))
            if str(service.get("status") or "").lower() == "active"
            and str(service.get("category_status") or "").lower() == "active"
            and (family := resolve_pricing_family(
                service.get("pricing_family"),
                service.get("subcategory"),
                service.get("service_summary"),
                service.get("description"),
                service.get("category_name"),
            ))
        ],
        "target": {
            "activeVerticalsMeeting50To100": sum(1 for row in service_rows if row["meets50"]),
            "minimumVerticals": 3,
            "maximumVerticals": 5,
            "minimumProjectsPerVertical": 50,
            "maximumProjectsPerVertical": 100,
        },
    }
    if args.json:
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
