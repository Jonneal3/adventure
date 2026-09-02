export type GalleryManifestSource = "planned" | "legacy_inferred";
export type GalleryPricingConfidence = "high" | "medium" | "broad";

export type GalleryQuantityRange = {
  low: number;
  likely: number;
  high: number;
  unit: string;
};

export type ManifestComponent = {
  componentKey: string;
  subtypeKey?: string;
  materialKey?: string;
  tier: "value" | "mid" | "premium" | "luxury";
  quantity: GalleryQuantityRange;
  attributes: Record<string, string | number | boolean>;
};

export type PriceableGalleryManifest = {
  version: 1;
  source: GalleryManifestSource;
  serviceId: string;
  serviceKey: string;
  pricingFamily: string;
  components: ManifestComponent[];
  assumptions: string[];
  normalizationNotes: string[];
};

export type PairVerification = {
  status: "passed" | "failed" | "uncertain" | "not_run";
  confidence: number;
  sameScene: boolean;
  beforePlausible: boolean;
  afterQualityValid: boolean;
  manifestCoverage: string[];
  verifiedComponents: ManifestComponent[];
  unsupportedObservations: string[];
  observedDelta: string[];
  assumptions: string[];
  failureReasons: string[];
};

export type GalleryPriceRange = {
  low: number;
  likely: number;
  high: number;
  currency: string;
};

export type GalleryPricingBreakdownItem = {
  key: string;
  label: string;
  category: "materials" | "labor" | "preparation" | "removal" | "installation" | "permits" | "contingency";
  range: GalleryPriceRange;
  localizedRange?: GalleryPriceRange;
};

export type GalleryPricingResult = {
  status: "complete" | "failed";
  confidence: GalleryPricingConfidence;
  family: string;
  packVersion: number;
  baseRange: GalleryPriceRange;
  localizedRange: GalleryPriceRange;
  locationLabel: string;
  marketFactor: number;
  breakdown: GalleryPricingBreakdownItem[];
  assumptions: string[];
  failureReasons: string[];
};

export type GalleryEnrichment = {
  version: 1;
  pipelineSource: "planned" | "legacy";
  provenance: { modelId?: string | null; [key: string]: unknown };
  qa: Record<string, unknown>;
  priceableManifest: PriceableGalleryManifest | null;
  before: {
    status: "success" | "not_generated" | "not_available" | "failed";
    imageId?: string;
    url?: string;
    attempts: number;
    disclosure?: "ai_generated_illustrative_before" | null;
  };
  pair?: {
    version: 1;
    status: "linked" | "unpaired";
    role: "before" | "after";
    pairId?: string | null;
    counterpartImageId?: string | null;
    source?: "generated" | "uploaded" | "linked" | null;
  };
  verification: PairVerification;
  pricing: GalleryPricingResult;
  publish: { status: "ready" | "pending" | "hidden"; reason?: string; updatedAt?: string };
  stages: Record<string, unknown>;
};

export const galleryPricingLabel = (confidence: GalleryPricingConfidence | null | undefined): string => {
  if (confidence === "high") return "Typical estimated range";
  if (confidence === "medium") return "Estimated project range";
  return "Broad illustrative estimate";
};

const STATE_MARKET_FACTORS: Record<string, number> = {
  AL: 0.88, AK: 1.24, AZ: 1.02, AR: 0.86, CA: 1.30, CO: 1.13, CT: 1.19,
  DE: 1.08, FL: 1.03, GA: 0.94, HI: 1.38, ID: 1.01, IL: 1.05, IN: 0.92,
  IA: 0.91, KS: 0.91, KY: 0.89, LA: 0.91, ME: 1.04, MD: 1.16, MA: 1.26,
  MI: 0.98, MN: 1.08, MS: 0.84, MO: 0.92, MT: 1.02, NE: 0.93, NV: 1.08,
  NH: 1.12, NJ: 1.22, NM: 0.96, NY: 1.25, NC: 0.94, ND: 0.98, OH: 0.93,
  OK: 0.88, OR: 1.13, PA: 1.03, RI: 1.16, SC: 0.92, SD: 0.91, TN: 0.91,
  TX: 0.96, UT: 1.03, VT: 1.08, VA: 1.08, WA: 1.20, WV: 0.84, WI: 0.99,
  WY: 0.98, DC: 1.30,
};

const CITY_MARKET_FACTORS: Record<string, number> = {
  "austin|TX": 1.08,
  "boston|MA": 1.34,
  "chicago|IL": 1.17,
  "dallas|TX": 1.04,
  "denver|CO": 1.20,
  "houston|TX": 1.01,
  "los angeles|CA": 1.38,
  "miami|FL": 1.18,
  "new york|NY": 1.48,
  "san francisco|CA": 1.52,
  "seattle|WA": 1.30,
};

function roundGalleryPrice(value: number): number {
  const step = value < 500 ? 10 : value < 5_000 ? 50 : 100;
  return Math.max(0, Math.round(value / step) * step);
}

function scaleGalleryRange(range: GalleryPriceRange, factor: number): GalleryPriceRange {
  const sorted = [range.low, range.likely, range.high]
    .map((value) => roundGalleryPrice(Number(value || 0) * factor))
    .sort((a, b) => a - b);
  return { low: sorted[0], likely: sorted[1], high: sorted[2], currency: range.currency || "USD" };
}

export function localizeGalleryPricing(
  pricing: GalleryPricingResult,
  location: { city?: unknown; state?: unknown },
): GalleryPricingResult {
  const city = String(location.city || "").trim();
  const state = String(location.state || "").trim().toUpperCase();
  const factor = CITY_MARKET_FACTORS[`${city.toLowerCase()}|${state}`] || STATE_MARKET_FACTORS[state] || 1;
  const locationLabel = city && state ? `${city}, ${state}` : state || "National typical range";
  const breakdown = (pricing.breakdown || []).map((item) => ({
    ...item,
    localizedRange: scaleGalleryRange(item.range, factor),
  }));
  const localizedRange = breakdown.length
    ? {
        low: breakdown.reduce((sum, item) => sum + Number(item.localizedRange?.low || 0), 0),
        likely: breakdown.reduce((sum, item) => sum + Number(item.localizedRange?.likely || 0), 0),
        high: breakdown.reduce((sum, item) => sum + Number(item.localizedRange?.high || 0), 0),
        currency: "USD",
      }
    : scaleGalleryRange(pricing.baseRange, factor);
  return { ...pricing, breakdown, localizedRange, locationLabel, marketFactor: factor };
}

export const isReadyGalleryEnrichment = (value: unknown): value is GalleryEnrichment => {
  if (!value || typeof value !== "object") return false;
  const enrichment = value as Partial<GalleryEnrichment>;
  const pairContractValid =
    (enrichment.before?.status === "not_available" && enrichment.verification?.status === "not_run") ||
    (enrichment.before?.status === "success" &&
      /^https?:\/\//i.test(String(enrichment.before.url || "")) &&
      enrichment.verification?.status === "passed");
  return (
    enrichment.version === 1 &&
    enrichment.publish?.status === "ready" &&
    pairContractValid &&
    enrichment.pricing?.status === "complete" &&
    enrichment.priceableManifest?.version === 1 &&
    Array.isArray(enrichment.priceableManifest.components) &&
    enrichment.priceableManifest.components.length > 0
  );
};

export const hasLinkedGalleryBefore = (value: unknown): value is GalleryEnrichment => {
  if (!isReadyGalleryEnrichment(value)) return false;
  const enrichment = value as GalleryEnrichment;
  return (
    enrichment.before?.status === "success" &&
    /^https?:\/\//i.test(String(enrichment.before.url || "")) &&
    enrichment.verification?.status === "passed"
  );
};
