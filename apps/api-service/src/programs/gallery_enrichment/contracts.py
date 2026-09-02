"""Shared contracts for manifest-first gallery enrichment.

These TypedDicts intentionally use the JSON field names persisted in
``images.metadata.gallery_enrichment``.  The matching TypeScript contract lives
in ``apps/widget/components/adventure/v8/galleryEnrichment.ts``.
"""

from __future__ import annotations

from typing import Any, Dict, List, Literal, NotRequired, Optional, TypedDict


ManifestSource = Literal["planned", "legacy_inferred"]
PipelineSource = Literal["planned", "legacy"]
PricingConfidence = Literal["high", "medium", "broad"]
PairStatus = Literal["linked", "unpaired"]
PairRole = Literal["before", "after"]
PairSource = Literal["generated", "uploaded", "linked"]


class QuantityRange(TypedDict):
    low: float
    likely: float
    high: float
    unit: str


class ManifestComponent(TypedDict):
    componentKey: str
    subtypeKey: NotRequired[str]
    materialKey: NotRequired[str]
    tier: str
    quantity: QuantityRange
    attributes: Dict[str, Any]


class PriceableGalleryManifest(TypedDict):
    version: Literal[1]
    source: ManifestSource
    serviceId: str
    serviceKey: str
    pricingFamily: str
    components: List[ManifestComponent]
    assumptions: List[str]
    normalizationNotes: List[str]


class PairVerification(TypedDict):
    status: Literal["passed", "failed", "uncertain", "not_run"]
    confidence: float
    sameScene: bool
    beforePlausible: bool
    afterQualityValid: bool
    manifestCoverage: List[str]
    verifiedComponents: List[ManifestComponent]
    unsupportedObservations: List[str]
    observedDelta: List[str]
    assumptions: List[str]
    failureReasons: List[str]


class PriceRange(TypedDict):
    low: int
    likely: int
    high: int
    currency: str


class PricingBreakdownItem(TypedDict):
    key: str
    label: str
    category: Literal[
        "materials",
        "labor",
        "preparation",
        "removal",
        "installation",
        "permits",
        "contingency",
    ]
    range: PriceRange


class GalleryPricingResult(TypedDict):
    status: Literal["complete", "failed"]
    confidence: PricingConfidence
    family: str
    packVersion: int
    baseRange: PriceRange
    localizedRange: PriceRange
    locationLabel: str
    marketFactor: float
    breakdown: List[PricingBreakdownItem]
    assumptions: List[str]
    failureReasons: List[str]


class GalleryPair(TypedDict):
    version: Literal[1]
    status: PairStatus
    role: PairRole
    pairId: Optional[str]
    counterpartImageId: Optional[str]
    source: Optional[PairSource]


class GalleryEnrichment(TypedDict):
    version: Literal[1]
    pipelineSource: PipelineSource
    provenance: Dict[str, Any]
    qa: Dict[str, Any]
    priceableManifest: Optional[PriceableGalleryManifest]
    before: Dict[str, Any]
    pair: GalleryPair
    verification: PairVerification
    pricing: GalleryPricingResult
    publish: Dict[str, Any]
    stages: Dict[str, Any]


__all__ = [
    "GalleryEnrichment",
    "GalleryPricingResult",
    "GalleryPair",
    "ManifestComponent",
    "ManifestSource",
    "PairVerification",
    "PairRole",
    "PairSource",
    "PairStatus",
    "PipelineSource",
    "PriceRange",
    "PriceableGalleryManifest",
    "PricingBreakdownItem",
    "PricingConfidence",
    "QuantityRange",
]
