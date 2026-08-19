#!/usr/bin/env python3
"""
Bulk-tag catalog images: search metadata + quality score.

Cheap model (Gemini Flash-Lite by default) does the full pass. Ambiguous
aesthetic calls escalate to a stronger model. Rejected photos stay in
Supabase but are hidden from the concept gallery.

This is a one-shot cleanup. Re-run as new images land, or call
tag_catalog_photo() from ingest later.

Usage:
  PYTHONPATH=src python scripts/tag_discovery_images.py --limit 50 --dry-run
  PYTHONPATH=src python scripts/tag_discovery_images.py --service-id UUID
  PYTHONPATH=src python scripts/tag_discovery_images.py --limit 0
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Dict, Iterable, Optional

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
SRC = os.path.join(ROOT, "src")
if SRC not in sys.path:
    sys.path.insert(0, SRC)

from programs.adventure_pipeline.catalog_tag import (  # noqa: E402
    already_tagged,
    catalog_vision_enabled,
    tag_catalog_photo,
)


PAGE_SIZE_MAX = 200


def _config() -> tuple[str, str]:
    url = (os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip().rstrip("/")
    key = (
        os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        or os.getenv("SUPABASE_SERVICE_KEY")
        or os.getenv("SUPABASE_ANON_KEY")
        or ""
    ).strip()
    if not url or not key:
        raise SystemExit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
    return url, key


def _request(method: str, path_qs: str, body: Optional[dict] = None, extra_headers: Optional[dict] = None) -> Any:
    base, key = _config()
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Accept": "application/json",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    if extra_headers:
        headers.update(extra_headers)
    req = urllib.request.Request(
        f"{base}/rest/v1/{path_qs}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
        headers=headers,
        method=method,
    )
    with urllib.request.urlopen(req, timeout=45) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw) if raw else None


def _iter_rows(*, page_size: int, service_id: str | None, instance_id: str | None) -> Iterable[Dict[str, Any]]:
    select = "id,image_url,metadata,subcategory_id,instance_id,status,created_at"
    offset = 0
    size = max(1, min(int(page_size), PAGE_SIZE_MAX))
    while True:
        qs = (
            f"images?select={urllib.parse.quote(select, safe=',')}"
            "&status=eq.completed"
            "&order=created_at.desc"
            f"&limit={size}&offset={offset}"
        )
        if service_id:
            qs += f"&subcategory_id=eq.{urllib.parse.quote(service_id)}"
        if instance_id:
            qs += f"&instance_id=eq.{urllib.parse.quote(instance_id)}"
        data = _request("GET", qs)
        rows = data if isinstance(data, list) else []
        if not rows:
            return
        for row in rows:
            if isinstance(row, dict):
                yield row
        if len(rows) < size:
            return
        offset += size


def _patch_metadata(image_id: str, metadata: Dict[str, Any]) -> None:
    _request("PATCH", f"images?id=eq.{urllib.parse.quote(str(image_id))}", {"metadata": metadata})


def main() -> int:
    parser = argparse.ArgumentParser(description="Tag catalog images with metadata.discovery + quality")
    parser.add_argument("--limit", type=int, default=80, help="Max images to process; 0 means all")
    parser.add_argument("--page-size", type=int, default=80)
    parser.add_argument("--force", action="store_true", help="Retag rows that already have primary_scope")
    parser.add_argument("--service-id", default="")
    parser.add_argument("--instance-id", default="")
    parser.add_argument("--sleep", type=float, default=0.05)
    parser.add_argument("--dry-run", action="store_true", help="Call the model but do not write")
    parser.add_argument("--no-review", action="store_true", help="Skip the stronger second pass")
    parser.add_argument("--no-hide", action="store_true", help="Tag rejects but still show them in the gallery")
    args = parser.parse_args()
    if not catalog_vision_enabled():
        print("Vision is off. Set GEMINI_API_KEY (preferred) or REPLICATE_API_TOKEN.", file=sys.stderr)
        return 1

    cap = None if int(args.limit) <= 0 else int(args.limit)
    tagged = skipped = failed = hidden = reviewed = 0
    processed = 0
    for row in _iter_rows(
        page_size=args.page_size,
        service_id=args.service_id.strip() or None,
        instance_id=args.instance_id.strip() or None,
    ):
        if cap is not None and processed >= cap:
            break
        meta = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        existing = meta.get("discovery") if isinstance(meta.get("discovery"), dict) else {}
        if already_tagged(existing) and not args.force:
            skipped += 1
            continue
        url = str(row.get("image_url") or "").strip()
        tags = tag_catalog_photo(url, review=not args.no_review)
        processed += 1
        if not tags:
            failed += 1
            print(f"fail {row.get('id')} {url[:80]}")
            continue
        if args.no_hide and tags.get("verdict") == "reject":
            tags = dict(tags)
            tags["keep"] = True
            tags["verdict"] = "keep"
            tags["overridden"] = "no-hide"
        if tags.get("reviewed"):
            reviewed += 1
        if tags.get("keep") is False:
            hidden += 1
        if not args.dry_run:
            next_meta = dict(meta)
            next_meta["discovery"] = tags
            _patch_metadata(str(row["id"]), next_meta)
        tagged += 1
        print(
            f"{'dry ' if args.dry_run else ''}tagged {row.get('id')} "
            f"{tags.get('primary_scope')} {tags.get('estimated_finish_tier')} "
            f"q={tags.get('quality_score')} {tags.get('verdict')}"
            f"{' reviewed' if tags.get('reviewed') else ''}"
        )
        time.sleep(max(0.0, args.sleep))
    print(
        f"done tagged={tagged} skipped={skipped} failed={failed} "
        f"hidden={hidden} reviewed={reviewed} dry_run={bool(args.dry_run)}"
    )
    return 0 if failed == 0 or tagged else 1


if __name__ == "__main__":
    raise SystemExit(main())
