"""Small Supabase REST/storage adapter used by the resumable offline runner."""

from __future__ import annotations

import hashlib
import json
import os
import ssl
import urllib.error
import urllib.parse
import urllib.request
import uuid
from typing import Any, Dict, Iterable, List, Mapping, Optional, Tuple

import certifi


_SSL_CONTEXT = ssl.create_default_context(cafile=certifi.where())
_BUCKET = "images"


class SupabaseGalleryStore:
    def __init__(self, *, dry_run: bool = False) -> None:
        self.base_url = str(os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL") or "").strip().rstrip("/")
        self.key = str(os.getenv("SUPABASE_SERVICE_ROLE_KEY") or os.getenv("SUPABASE_SERVICE_KEY") or "").strip()
        if not self.base_url or not self.key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required")
        self.dry_run = bool(dry_run)

    def _request(
        self,
        method: str,
        path: str,
        body: Optional[Any] = None,
        *,
        headers: Optional[Mapping[str, str]] = None,
        raw_body: Optional[bytes] = None,
    ) -> Any:
        request_headers = {
            "apikey": self.key,
            "Authorization": f"Bearer {self.key}",
            "Accept": "application/json",
            **dict(headers or {}),
        }
        data = raw_body
        if body is not None:
            data = json.dumps(body).encode("utf-8")
            request_headers["Content-Type"] = "application/json"
        req = urllib.request.Request(f"{self.base_url}{path}", data=data, headers=request_headers, method=method)
        with urllib.request.urlopen(req, timeout=60, context=_SSL_CONTEXT) as resp:
            raw = resp.read()
            if not raw:
                return None
            content_type = str(resp.headers.get("Content-Type") or "")
            return json.loads(raw.decode("utf-8")) if "json" in content_type else raw

    def iter_images(self, *, service_id: str = "", page_size: int = 100) -> Iterable[Dict[str, Any]]:
        offset = 0
        select = urllib.parse.quote(
            "id,image_url,metadata,model_id,replicate_prediction_id,status,subcategory_id,account_id,instance_id,user_id,created_at",
            safe=",",
        )
        while True:
            path = f"/rest/v1/images?select={select}&status=eq.completed&order=created_at.asc&limit={page_size}&offset={offset}"
            if service_id:
                path += f"&subcategory_id=eq.{urllib.parse.quote(service_id)}"
            rows = self._request("GET", path)
            if not isinstance(rows, list) or not rows:
                return
            for row in rows:
                if isinstance(row, dict):
                    yield row
            if len(rows) < page_size:
                return
            offset += len(rows)

    def services_by_id(self) -> Dict[str, Dict[str, Any]]:
        select = urllib.parse.quote("id,subcategory,service_summary,slug,description,status,category_id,categories(name,status)", safe=",()")
        rows = self._request("GET", f"/rest/v1/categories_subcategories?select={select}&limit=2000")
        out: Dict[str, Dict[str, Any]] = {}
        for row in rows if isinstance(rows, list) else []:
            if not isinstance(row, dict) or not row.get("id"):
                continue
            category = row.get("categories") if isinstance(row.get("categories"), dict) else {}
            out[str(row["id"])] = {
                **row,
                "category_name": category.get("name"),
                "category_status": category.get("status"),
                "pricing_family": None,
                "service_key": row.get("slug"),
            }
        return out

    def image_by_catalog_key(self, catalog_key: str) -> Optional[Dict[str, Any]]:
        token = urllib.parse.quote(str(catalog_key or "").strip())
        if not token:
            return None
        select = urllib.parse.quote(
            "id,image_url,metadata,model_id,status,subcategory_id,account_id,instance_id,user_id",
            safe=",",
        )
        key = urllib.parse.quote("metadata->>catalog_key", safe="")
        rows = self._request("GET", f"/rest/v1/images?select={select}&{key}=eq.{token}&limit=1")
        return rows[0] if isinstance(rows, list) and rows else None

    def persist_planned_after(
        self,
        *,
        image_url: str,
        service_id: str,
        metadata: Mapping[str, Any],
        model_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Copy a planned after into durable storage and create its source row."""
        catalog_key = str(metadata.get("catalog_key") or "").strip()
        existing = self.image_by_catalog_key(catalog_key) if catalog_key else None
        if existing:
            return existing
        image_id = str(uuid.uuid4())
        uploaded = self.upload_from_url(image_url, parent_image_id=image_id, attempt=1, kind="after")
        if not uploaded:
            return {}
        row = {
            "id": image_id,
            "image_url": uploaded["url"],
            "subcategory_id": service_id,
            "status": "completed",
            "model_id": model_id,
            "metadata": {**dict(metadata), "s3_path": uploaded["storagePath"]},
        }
        if self.dry_run:
            return row
        rows = self._request("POST", "/rest/v1/images", row, headers={"Prefer": "return=representation"})
        return rows[0] if isinstance(rows, list) and rows else {}

    def gallery_image_ids(self) -> set[str]:
        """Return image ids explicitly selected into an instance gallery."""
        out: set[str] = set()
        offset = 0
        page_size = 500
        while True:
            rows = self._request(
                "GET",
                f"/rest/v1/instance_sample_gallery?select=image_id&limit={page_size}&offset={offset}",
            )
            if not isinstance(rows, list) or not rows:
                return out
            out.update(str(row.get("image_id") or "").strip() for row in rows if isinstance(row, Mapping))
            out.discard("")
            if len(rows) < page_size:
                return out
            offset += len(rows)

    def instance_location(self, instance_id: str) -> Tuple[str, str]:
        if not instance_id:
            return "", ""
        rows = self._request("GET", f"/rest/v1/instances?select=*&id=eq.{urllib.parse.quote(instance_id)}&limit=1")
        row = rows[0] if isinstance(rows, list) and rows else {}
        if not isinstance(row, dict):
            return "", ""
        metadata = row.get("metadata") if isinstance(row.get("metadata"), dict) else {}
        city = row.get("location_city") or row.get("business_city") or row.get("city") or metadata.get("city") or ""
        state = row.get("location_state") or row.get("business_state") or row.get("state") or metadata.get("state") or ""
        return str(city or "").strip(), str(state or "").strip()

    def patch_metadata(self, image_id: str, metadata: Mapping[str, Any]) -> None:
        if self.dry_run:
            return
        self._request(
            "PATCH",
            f"/rest/v1/images?id=eq.{urllib.parse.quote(image_id)}",
            {"metadata": dict(metadata)},
            headers={"Prefer": "return=minimal"},
        )

    def patch_image(self, image_id: str, fields: Mapping[str, Any]) -> None:
        if self.dry_run:
            return
        self._request(
            "PATCH",
            f"/rest/v1/images?id=eq.{urllib.parse.quote(image_id)}",
            dict(fields),
            headers={"Prefer": "return=minimal"},
        )

    def image_by_id(self, image_id: str) -> Optional[Dict[str, Any]]:
        token = urllib.parse.quote(str(image_id or "").strip())
        if not token:
            return None
        select = urllib.parse.quote("id,metadata", safe=",")
        rows = self._request("GET", f"/rest/v1/images?select={select}&id=eq.{token}&limit=1")
        return rows[0] if isinstance(rows, list) and rows else None

    def link_existing_pair(
        self,
        *,
        after_image_id: str,
        before_image_id: str,
        source: str = "uploaded",
    ) -> str:
        """Idempotently link two existing image rows without changing ownership.

        The relationship is deliberately stored on both rows so either image
        can resolve its counterpart. Canonical enrichment remains on the after.
        """
        after_id = str(after_image_id or "").strip()
        before_id = str(before_image_id or "").strip()
        if not after_id or not before_id or after_id == before_id:
            raise ValueError("distinct after_image_id and before_image_id are required")
        pair_source = source if source in {"generated", "uploaded", "linked"} else "linked"
        pair_id = after_id
        rows = {
            "after": self.image_by_id(after_id),
            "before": self.image_by_id(before_id),
        }
        if not rows["after"] or not rows["before"]:
            raise ValueError("both image rows must exist before they can be linked")
        for role, counterpart in (("after", before_id), ("before", after_id)):
            row = rows[role] or {}
            metadata = dict(row.get("metadata")) if isinstance(row.get("metadata"), Mapping) else {}
            metadata["gallery_pair"] = {
                "version": 1,
                "pair_id": pair_id,
                "role": role,
                "counterpart_image_id": counterpart,
                "source": pair_source,
            }
            self.patch_metadata(str(row.get("id") or ""), metadata)
        return pair_id

    def image_digest(self, image_url: str) -> Optional[str]:
        req = urllib.request.Request(image_url, headers={"User-Agent": "adventure-gallery-enrichment/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=30, context=_SSL_CONTEXT) as resp:
                digest = hashlib.sha256()
                total = 0
                while True:
                    chunk = resp.read(1024 * 256)
                    if not chunk:
                        break
                    total += len(chunk)
                    if total > 20_000_000:
                        return None
                    digest.update(chunk)
                return digest.hexdigest() if total else None
        except (urllib.error.URLError, TimeoutError, ValueError):
            return None

    def image_accessible(self, image_url: str) -> bool:
        """Cheaply verify that a source image still exists before sending it to QA."""
        url = str(image_url or "").strip()
        if not url.startswith(("http://", "https://")):
            return False
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "adventure-gallery-enrichment/1.0",
                "Range": "bytes=0-0",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=20, context=_SSL_CONTEXT) as resp:
                content_type = str(resp.headers.get("Content-Type") or "").lower()
                if int(getattr(resp, "status", 200) or 200) >= 400:
                    return False
                if content_type.startswith("image/"):
                    return True
                # A few storage providers use a generic binary type. JSON or
                # text bodies at image-looking URLs are expired/error payloads.
                if content_type.startswith("application/octet-stream"):
                    return bool(resp.read(1))
                return False
        except (urllib.error.URLError, TimeoutError, ValueError):
            return False

    def upload_from_url(
        self,
        image_url: str,
        *,
        parent_image_id: str,
        attempt: int,
        kind: str = "before",
    ) -> Optional[Dict[str, str]]:
        req = urllib.request.Request(image_url, headers={"User-Agent": "adventure-gallery-enrichment/1.0"})
        try:
            with urllib.request.urlopen(req, timeout=60, context=_SSL_CONTEXT) as resp:
                blob = resp.read()
                content_type = str(resp.headers.get("Content-Type") or "image/webp").split(";")[0].strip()
        except (urllib.error.URLError, TimeoutError, ValueError):
            return None
        if not blob or len(blob) > 20_000_000:
            return None
        extension = {"image/png": "png", "image/jpeg": "jpg", "image/webp": "webp"}.get(content_type, "webp")
        safe_kind = "after" if kind == "after" else "before"
        path = f"gallery-{safe_kind}/{parent_image_id}/{attempt}-{uuid.uuid4().hex[:12]}.{extension}"
        if self.dry_run:
            return {"url": image_url, "storagePath": path}
        encoded_path = urllib.parse.quote(path, safe="/")
        self._request(
            "POST",
            f"/storage/v1/object/{_BUCKET}/{encoded_path}",
            headers={"Content-Type": content_type, "x-upsert": "false"},
            raw_body=blob,
        )
        public_url = f"{self.base_url}/storage/v1/object/public/{_BUCKET}/{encoded_path}"
        return {"url": public_url, "storagePath": path}

    def existing_before_child(self, parent_image_id: str) -> Optional[Dict[str, Any]]:
        token = urllib.parse.quote(parent_image_id)
        generated = urllib.parse.quote("illustrative_before")
        select = urllib.parse.quote("id,image_url,metadata", safe=",")
        generated_key = urllib.parse.quote("metadata->>generated_for", safe="")
        parent_key = urllib.parse.quote("metadata->>parent_image_id", safe="")
        rows = self._request(
            "GET",
            f"/rest/v1/images?select={select}&{generated_key}=eq.{generated}&{parent_key}=eq.{token}&limit=1",
        )
        return rows[0] if isinstance(rows, list) and rows else None

    def persist_before_child(self, parent: Mapping[str, Any], provider_url: str, attempt: int) -> Dict[str, str]:
        parent_id = str(parent.get("id") or "")
        existing = self.existing_before_child(parent_id)
        if self.dry_run and existing and existing.get("id") and existing.get("image_url"):
            return {"imageId": str(existing["id"]), "url": str(existing["image_url"]), "pairId": parent_id}
        uploaded = self.upload_from_url(provider_url, parent_image_id=parent_id, attempt=attempt, kind="before")
        if not uploaded:
            return {}
        if self.dry_run:
            return {"imageId": f"dry-before-{parent_id}", "url": uploaded["url"], "pairId": parent_id}
        if existing and existing.get("id"):
            existing_meta = dict(existing.get("metadata")) if isinstance(existing.get("metadata"), Mapping) else {}
            existing_meta.update({
                "generated_for": "illustrative_before",
                "parent_image_id": parent_id,
                "hidden": True,
                "disclosure": "ai_generated_illustrative_before",
                "attempt": attempt,
                "s3_path": uploaded["storagePath"],
                "gallery_pair": {
                    "version": 1,
                    "pair_id": parent_id,
                    "role": "before",
                    "counterpart_image_id": parent_id,
                    "source": "generated",
                },
            })
            self.patch_image(str(existing["id"]), {"image_url": uploaded["url"], "metadata": existing_meta})
            return {"imageId": str(existing["id"]), "url": uploaded["url"], "pairId": parent_id}
        body = {
            "account_id": parent.get("account_id"),
            "image_url": uploaded["url"],
            "instance_id": parent.get("instance_id"),
            "metadata": {
                "generated_for": "illustrative_before",
                "parent_image_id": parent_id,
                "hidden": True,
                "disclosure": "ai_generated_illustrative_before",
                "attempt": attempt,
                "s3_path": uploaded["storagePath"],
                "generator_model": str(os.getenv("ADVENTURE_GALLERY_IMAGE_MODEL") or "black-forest-labs/flux-2-pro"),
                "gallery_pair": {
                    "version": 1,
                    "pair_id": parent_id,
                    "role": "before",
                    "counterpart_image_id": parent_id,
                    "source": "generated",
                },
            },
            # images.model_id is a UUID foreign key in the live schema. The
            # provider slug belongs in metadata unless the parent already has
            # a valid catalog model id to inherit.
            "model_id": parent.get("model_id"),
            "prompt_id": None,
            "status": "completed",
            "subcategory_id": parent.get("subcategory_id"),
            "user_id": parent.get("user_id"),
        }
        rows = self._request("POST", "/rest/v1/images", body, headers={"Prefer": "return=representation"})
        row = rows[0] if isinstance(rows, list) and rows else {}
        return {
            "imageId": str(row.get("id") or ""),
            "url": str(row.get("image_url") or uploaded["url"]),
            "pairId": parent_id,
        }

    def persist_planned_pair(
        self,
        parent: Mapping[str, Any],
        after_url: str,
        before_url: str,
        attempt: int,
    ) -> Dict[str, str]:
        parent_id = str(parent.get("id") or "")
        current_after = str(parent.get("image_url") or "").strip()
        stable_after = current_after
        if after_url != current_after:
            uploaded_after = self.upload_from_url(after_url, parent_image_id=parent_id, attempt=attempt, kind="after")
            if not uploaded_after:
                return {}
            stable_after = uploaded_after["url"]
            self.patch_image(parent_id, {"image_url": stable_after})
        child = self.persist_before_child(parent, before_url, attempt)
        if not child.get("imageId") or not child.get("url"):
            return {}
        return {
            "afterUrl": stable_after,
            "beforeUrl": child["url"],
            "beforeImageId": child["imageId"],
            "pairId": child.get("pairId") or parent_id,
        }


GENERATED_GALLERY_SOURCES = frozenset({
    "style_seed", "subcategory_catalog", "adventure_v7", "adventure_v8",
    "v2_scope_starter", "v2_neutral_scope_starter", "v2_service_starter", "sample_gallery",
})


def eligible_generated_gallery_row(
    row: Mapping[str, Any],
    *,
    gallery_image_ids: Optional[set[str]] = None,
) -> bool:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), Mapping) else {}
    generated_for = str(metadata.get("generated_for") or "").strip()
    if generated_for == "illustrative_before":
        return False
    source = str(metadata.get("source") or metadata.get("upload_source") or "").strip().lower()
    if source in {"customer_upload", "user_upload", "reference_photo", "uploaded"}:
        return False
    if metadata.get("customer_upload") is True or metadata.get("is_reference") is True:
        return False
    has_ai_provenance = bool(
        str(row.get("model_id") or "").strip()
        or str(row.get("replicate_prediction_id") or "").strip()
        or str(metadata.get("ai_model") or metadata.get("model_id") or metadata.get("model_name") or "").strip()
    )
    explicitly_linked = str(row.get("id") or "").strip() in (gallery_image_ids or set())
    return generated_for in GENERATED_GALLERY_SOURCES or (explicitly_linked and has_ai_provenance)


__all__ = ["GENERATED_GALLERY_SOURCES", "SupabaseGalleryStore", "eligible_generated_gallery_row"]
