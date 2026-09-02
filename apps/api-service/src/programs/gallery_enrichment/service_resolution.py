"""Legacy service resolution before registry-constrained inference."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Mapping, Optional

from programs.gallery_enrichment.registry import resolve_pricing_family


@dataclass(frozen=True)
class ResolvedService:
    status: str
    service_id: str
    service_key: str
    pricing_family: str
    source: str
    confidence: float
    reason: str = ""


def resolve_legacy_service(
    row: Mapping[str, Any],
    *,
    services_by_id: Mapping[str, Mapping[str, Any]],
    classifier: Optional[Callable[[str], Optional[Mapping[str, Any]]]] = None,
) -> ResolvedService:
    metadata = row.get("metadata") if isinstance(row.get("metadata"), Mapping) else {}
    subcategory_id = str(row.get("subcategory_id") or metadata.get("subcategory_id") or "").strip()
    service = services_by_id.get(subcategory_id) if subcategory_id else None
    if service:
        family = resolve_pricing_family(
            service.get("pricing_family"),
            service.get("service_key"),
            service.get("subcategory"),
            service.get("service_summary"),
            service.get("category_name"),
        )
        if family:
            return ResolvedService("resolved", subcategory_id, str(service.get("service_key") or family), family, "subcategory_id", 1.0)

    family = resolve_pricing_family(
        metadata.get("pricing_family"),
        metadata.get("service_key"),
        metadata.get("service_name"),
        metadata.get("subcategory"),
        metadata.get("subcategory_name"),
        metadata.get("category_name"),
        metadata.get("generated_for"),
    )
    if family:
        inferred_service_id = subcategory_id or str(metadata.get("service_id") or family).strip()
        return ResolvedService("resolved", inferred_service_id, family, family, "metadata_alias", .95)

    image_url = str(row.get("image_url") or "").strip()
    classified = classifier(image_url) if classifier and image_url else None
    if isinstance(classified, Mapping) and classified.get("status") == "resolved":
        classified_family = resolve_pricing_family(classified.get("pricingFamily"))
        if classified_family:
            inferred_service_id = subcategory_id or str(metadata.get("service_id") or classified_family).strip()
            return ResolvedService(
                "resolved",
                inferred_service_id,
                classified_family,
                classified_family,
                "vlm",
                float(classified.get("confidence") or 0),
                str(classified.get("reason") or ""),
            )
    return ResolvedService(
        str(classified.get("status") or "uncertain") if isinstance(classified, Mapping) else "uncertain",
        subcategory_id,
        "",
        "",
        "unresolved",
        float(classified.get("confidence") or 0) if isinstance(classified, Mapping) else 0.0,
        str(classified.get("reason") or "service could not be resolved") if isinstance(classified, Mapping) else "service could not be resolved",
    )


__all__ = ["ResolvedService", "resolve_legacy_service"]
