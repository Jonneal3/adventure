import type { ServiceOption } from "../v2/types";
import type { PricingBounds } from "./pricing";
import type {
  BudgetBand,
  BudgetBandId,
  PersonalizedRefinementRecord,
  RawVisualProject,
  VisualPricingEstimateConfig,
  VisualPricingProject,
} from "./visual-pricing-types";

export const DEFAULT_ESTIMATE_CONFIG: VisualPricingEstimateConfig = {
  finishLevel: "selected",
  scopeLevel: "complete",
  layoutPlan: "keep",
  sourcing: "standard",
};

export const DEFAULT_BUDGET_BANDS: BudgetBand[] = [
  { id: "under-15", label: "Under $15,000", galleryLabel: "under $15K", min: 7_500, max: 15_000 },
  { id: "15-25", label: "$15,000–$25,000", galleryLabel: "$15K–$25K", min: 15_000, max: 25_000 },
  { id: "25-40", label: "$25,000–$40,000", galleryLabel: "$25K–$40K", min: 25_000, max: 40_000 },
  { id: "40-60", label: "$40,000–$60,000", galleryLabel: "$40K–$60K", min: 40_000, max: 60_000 },
  { id: "60-plus", label: "$60,000+", galleryLabel: "$60K+", min: 60_000, max: null },
  { id: "not-sure", label: "Not sure yet", galleryLabel: "typical projects", min: null, max: null },
];

/** Cosmetic refresh / partial bath work often starts around a few thousand. */
export const BATHROOM_BUDGET_BANDS: BudgetBand[] = [
  { id: "bath-under-5", label: "Under $5,000", galleryLabel: "under $5K", min: 2_500, max: 5_000 },
  { id: "bath-5-10", label: "$5,000–$10,000", galleryLabel: "$5K–$10K", min: 5_000, max: 10_000 },
  { id: "bath-10-20", label: "$10,000–$20,000", galleryLabel: "$10K–$20K", min: 10_000, max: 20_000 },
  { id: "bath-20-35", label: "$20,000–$35,000", galleryLabel: "$20K–$35K", min: 20_000, max: 35_000 },
  { id: "bath-35-55", label: "$35,000–$55,000", galleryLabel: "$35K–$55K", min: 35_000, max: 55_000 },
  { id: "bath-55-plus", label: "$55,000+", galleryLabel: "$55K+", min: 55_000, max: null },
  { id: "not-sure", label: "Not sure yet", galleryLabel: "typical projects", min: null, max: null },
];

/** Full outdoor work regularly reaches mid–high five figures. */
export const LANDSCAPE_BUDGET_BANDS: BudgetBand[] = [
  { id: "yard-under-10", label: "Under $10,000", galleryLabel: "under $10K", min: 4_000, max: 10_000 },
  { id: "yard-10-25", label: "$10,000–$25,000", galleryLabel: "$10K–$25K", min: 10_000, max: 25_000 },
  { id: "yard-25-50", label: "$25,000–$50,000", galleryLabel: "$25K–$50K", min: 25_000, max: 50_000 },
  { id: "yard-50-100", label: "$50,000–$100,000", galleryLabel: "$50K–$100K", min: 50_000, max: 100_000 },
  { id: "yard-100-plus", label: "$100,000+", galleryLabel: "$100K+", min: 100_000, max: null },
  { id: "not-sure", label: "Not sure yet", galleryLabel: "typical projects", min: null, max: null },
];

export const KITCHEN_BUDGET_BANDS: BudgetBand[] = [
  { id: "kit-under-15", label: "Under $15,000", galleryLabel: "under $15K", min: 8_000, max: 15_000 },
  { id: "kit-15-30", label: "$15,000–$30,000", galleryLabel: "$15K–$30K", min: 15_000, max: 30_000 },
  { id: "kit-30-50", label: "$30,000–$50,000", galleryLabel: "$30K–$50K", min: 30_000, max: 50_000 },
  { id: "kit-50-80", label: "$50,000–$80,000", galleryLabel: "$50K–$80K", min: 50_000, max: 80_000 },
  { id: "kit-80-plus", label: "$80,000+", galleryLabel: "$80K+", min: 80_000, max: null },
  { id: "not-sure", label: "Not sure yet", galleryLabel: "typical projects", min: null, max: null },
];

/** @deprecated Prefer budgetBandsForService — kept for older callers/tests. */
export const BUDGET_BANDS = DEFAULT_BUDGET_BANDS;

const ALL_BUDGET_BANDS: BudgetBand[] = [
  ...BATHROOM_BUDGET_BANDS,
  ...LANDSCAPE_BUDGET_BANDS,
  ...KITCHEN_BUDGET_BANDS,
  ...DEFAULT_BUDGET_BANDS,
];

function serviceBudgetSearchText(service: ServiceOption | null | undefined): string {
  return `${service?.label || ""} ${service?.serviceName || ""} ${
    (service as { service_name?: string } | null | undefined)?.service_name || ""
  } ${service?.serviceSummary || ""}`.trim();
}

/** Industry-appropriate ranges — a bath refresh is not a backyard rebuild. */
export function budgetBandsForService(service: ServiceOption | null | undefined): BudgetBand[] {
  const text = serviceBudgetSearchText(service);
  if (/bath|shower|tub|vanity|powder room/i.test(text)) return BATHROOM_BUDGET_BANDS;
  if (/landscap|outdoor|garden|patio|lawn|hardscape|irrigation|driveway/i.test(text)) {
    return LANDSCAPE_BUDGET_BANDS;
  }
  if (/kitchen|cabinet|countertop|pantry/i.test(text)) return KITCHEN_BUDGET_BANDS;
  return DEFAULT_BUDGET_BANDS;
}

export function budgetBandById(
  id: BudgetBandId | null,
  service?: ServiceOption | null
): BudgetBand | null {
  if (!id) return null;
  const preferred = service ? budgetBandsForService(service) : null;
  return (
    preferred?.find((band) => band.id === id) ||
    ALL_BUDGET_BANDS.find((band) => band.id === id) ||
    null
  );
}

function stableHash(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function roundPrice(value: number): number {
  const increment = value < 20_000 ? 500 : value < 75_000 ? 1_000 : 2_500;
  return Math.max(increment, Math.round(value / increment) * increment);
}

function sentenceLabel(value: string): string {
  const words = value.trim().replace(/\s+/g, " ").split(" ");
  const normalized = words
    .map((word) => (/^[A-Z0-9]{2,}$/.test(word) ? word : word.toLowerCase()))
    .join(" ");
  return normalized ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}` : "";
}

/** Professional display names: "Warm Contemporary", not "Warm contemporary". */
function titleCaseLabel(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => {
      if (!word || word === "·") return word;
      if (/^[A-Z0-9]{2,}$/.test(word)) return word;
      return `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`;
    })
    .join(" ");
}

function conciseProjectTitle(label: string, scope: string): string {
  const normalized = label.trim().replace(/\s+/g, " ");
  const fallback = scope.trim().replace(/\s+/g, " ");
  const value = normalized && !/^project\s+\d+$/i.test(normalized) ? normalized : fallback;
  if (!value) return "Project Inspiration";
  // One format only: the style name. Drop any "Style · Tag" leftovers.
  const styleOnly = value.split("·")[0]?.trim() || value;
  return titleCaseLabel(styleOnly).slice(0, 48);
}

/**
 * Same style name everywhere. Duplicates become "Modern Organic 2", never
 * "Modern Organic · Courtyard" — mixed formats read like a bug on demos.
 */
function assignUniqueProjectTitle(
  label: string,
  scope: string,
  _assetId: string,
  used: Set<string>
): string {
  const base = conciseProjectTitle(label, scope);
  const normalize = (value: string) => value.trim().toLowerCase();
  if (base && !used.has(normalize(base))) {
    used.add(normalize(base));
    return base;
  }

  for (let index = 2; index < 200; index += 1) {
    const candidate = `${base} ${index}`;
    if (!used.has(normalize(candidate))) {
      used.add(normalize(candidate));
      return candidate;
    }
  }

  const fallback = `${base} ${used.size + 1}`;
  used.add(normalize(fallback));
  return fallback;
}

function scopeWeight(scope: string): number {
  const value = scope.toLowerCase();
  // Outdoor
  if (/full outdoor|complete outdoor|full landscap/.test(value)) return 1;
  if (/patio|hardscape|driveway/.test(value)) return 0.82;
  if (/lawn|garden|plant|irrigation/.test(value)) return 0.7;
  if (/lighting|prun|tree|shrub|color scheme|refresh/.test(value)) return 0.58;
  // Bath / interior
  if (/layout|plumbing|addition/.test(value)) return 1;
  if (/full|complete|primary/.test(value)) return 0.94;
  if (/shower|tub/.test(value)) return 0.78;
  if (/vanity|cabinet|fixture/.test(value)) return 0.7;
  if (/tile|floor/.test(value)) return 0.58;
  if (/cosmetic|paint|hardware|refresh|lighting/.test(value)) return 0.42;
  return 0.72;
}

/** Style labels that read more expensive or more value-oriented. */
function styleTierScore(label: string): number {
  const value = label.toLowerCase();
  if (
    /luxury|marble|spa|resort|bespoke|statement|opal|gilt|palace|art deco|drama|boutique|champagne|mediterranean|monochrome|indigo|espresso|noir|moody|hotel/.test(
      value
    )
  ) {
    return 0.93;
  }
  if (/premium|elegant|refined|luxe|polished|designer|sculptural|gold|bronze|walnut|slate canyon/.test(value)) {
    return 0.8;
  }
  if (/contemporary|transitional|organic|warm|classic|modern|atelier|villa|travertine|herringbone|zellige/.test(value)) {
    return 0.52;
  }
  if (
    /scandinavian|nordic|coastal|natural|soft|clay|simple|minimal|basic|fresh|clean|compact|practical|bright|airy|ivory|cloud|fog|pale oak|cosmetic/.test(
      value
    )
  ) {
    return 0.26;
  }
  return 0.45;
}

function explicitTierScore(priceTier: string | null | undefined): number | null {
  const tier = String(priceTier || "").trim().toLowerCase();
  if (!tier) return null;
  const map: Record<string, number> = {
    $: 0.18,
    $$: 0.42,
    $$$: 0.72,
    $$$$: 0.92,
    basic: 0.18,
    budget: 0.2,
    essential: 0.24,
    value: 0.28,
    standard: 0.48,
    mid: 0.52,
    midrange: 0.52,
    "mid-range": 0.52,
    mid_range: 0.52,
    premium: 0.76,
    high: 0.8,
    luxury: 0.92,
  };
  return map[tier] ?? null;
}

/**
 * 0–1 quality/complexity score for a catalog image. Drives both gallery fit
 * for a budget band and relative pricing inside that band.
 */
export function projectQualityScore(raw: RawVisualProject): number {
  const explicit = explicitTierScore(raw.priceTier);
  const scope = scopeWeight(raw.scope);
  const style = styleTierScore(raw.label);
  const blended = explicit === null
    ? scope * 0.62 + style * 0.38
    : explicit * 0.55 + scope * 0.28 + style * 0.17;
  return Math.max(0, Math.min(1, blended));
}

/** Absolute planning midpoint before the selected budget lens is applied. */
export function intrinsicProjectMidpoint(raw: RawVisualProject, bounds: PricingBounds): number {
  const score = projectQualityScore(raw);
  const low = Math.max(4_000, bounds.min * 0.45);
  const high = Math.max(low + 8_000, bounds.max * 1.45);
  return low + (high - low) * score;
}

function bandTargetWindow(band: BudgetBand): { low: number; high: number; mid: number } | null {
  if (band.min !== null && band.max !== null) {
    return { low: band.min, high: band.max, mid: (band.min + band.max) / 2 };
  }
  if (band.min !== null) {
    const high = band.min * 1.85;
    return { low: band.min, high, mid: (band.min + high) / 2 };
  }
  return null;
}

/** Finish level the selected budget should look like (0 = value, 1 = luxury). */
function targetQualityForBand(band: BudgetBand): number | null {
  const window = bandTargetWindow(band);
  if (!window) return null;
  const mid = window.mid;
  if (mid <= 5_000) return 0.16;
  if (mid <= 10_000) return 0.26;
  if (mid <= 20_000) return 0.4;
  if (mid <= 35_000) return 0.52;
  if (mid <= 55_000) return 0.66;
  if (mid <= 100_000) return 0.8;
  return 0.9;
}

/**
 * How well an image belongs in the selected budget. Higher is better; ≤0 is a
 * mismatch. Visual finish level matters more than raw price math — a marble spa
 * should not lead a $5K wall even if we can invent a low price label for it.
 */
function budgetFitScore(intrinsicMid: number, quality: number, band: BudgetBand): number {
  const window = bandTargetWindow(band);
  if (!window) return 0.75; // not-sure: keep everything, mild preference for mid-range
  const targetQ = targetQualityForBand(band) ?? 0.5;

  // Hard exclusions: luxury looks out of light budgets, bargain looks out of high ones.
  if (window.mid <= 8_000 && quality >= 0.6) return 0;
  if (window.mid <= 15_000 && quality >= 0.78) return 0;
  if (window.mid >= 70_000 && quality <= 0.34) return 0;

  const qualityFit = 1 - Math.min(1, Math.abs(quality - targetQ) / 0.55);
  const { low, high, mid } = window;
  const width = Math.max(2_500, high - low);
  let priceFit = 0;
  if (intrinsicMid >= low * 0.75 && intrinsicMid <= high * 1.25) {
    priceFit = 1 - Math.min(0.55, Math.abs(intrinsicMid - mid) / width);
  } else if (intrinsicMid >= low * 0.45 && intrinsicMid <= high * 1.7) {
    priceFit = 0.38 - Math.min(0.28, Math.abs(intrinsicMid - mid) / (width * 2.4));
  }

  return Math.max(0, qualityFit * 0.78 + priceFit * 0.22);
}

function compareBudgetEntries(
  a: { fit: number; quality: number; raw: RawVisualProject },
  b: { fit: number; quality: number; raw: RawVisualProject },
  band: BudgetBand
): number {
  if (b.fit !== a.fit) return b.fit - a.fit;
  const targetQ = targetQualityForBand(band);
  if (targetQ !== null) {
    const aDist = Math.abs(a.quality - targetQ);
    const bDist = Math.abs(b.quality - targetQ);
    if (aDist !== bDist) return aDist - bDist;
  }
  const labelCmp = String(a.raw.label || "").localeCompare(String(b.raw.label || ""));
  if (labelCmp !== 0) return labelCmp;
  return a.raw.assetId.localeCompare(b.raw.assetId);
}

function projectRange(
  raw: RawVisualProject,
  band: BudgetBand,
  bounds: PricingBounds,
  budgetMode: "constraint" | "lens"
): { min: number; max: number } {
  const variance = (stableHash(`${raw.assetId}:${band.id}`) % 1000) / 1000;
  const score = projectQualityScore(raw);
  const naturalMid = intrinsicProjectMidpoint(raw, bounds);

  if (budgetMode === "lens") {
    const window = bandTargetWindow(band);
    if (window) {
      // Place this image inside the band by its own quality score — not a shared mid.
      const width = Math.max(4_000, window.high - window.low);
      const mid = window.low + width * (0.1 + score * 0.8);
      // Mild pull toward the image's natural price so relative order stays honest.
      const blended = mid * 0.72 + naturalMid * 0.28;
      const clamped = Math.max(window.low * 0.9, Math.min(window.high * 1.08, blended));
      const half = Math.max(1_500, width * (0.07 + variance * 0.05));
      const lower = Math.max(window.low * 0.85, clamped - half);
      const upper = Math.min(window.high * 1.1, clamped + half);
      return { min: roundPrice(lower), max: roundPrice(Math.max(lower + 2_000, upper)) };
    }
    // not-sure: show the catalog's natural planning range.
    const half = Math.max(2_000, naturalMid * (0.1 + variance * 0.06));
    return {
      min: roundPrice(Math.max(2_500, naturalMid - half)),
      max: roundPrice(naturalMid + half),
    };
  }

  // Constraint mode: keep prices inside the band, still biased by quality.
  if (band.min !== null && band.max !== null) {
    const width = band.max - band.min;
    const lower = band.min + width * (0.05 + score * 0.35 + variance * 0.08);
    const upper = Math.min(band.max, lower + width * (0.35 + score * 0.2 + variance * 0.1));
    return { min: roundPrice(lower), max: roundPrice(Math.max(lower + 2_000, upper)) };
  }
  if (band.min !== null) {
    const lower = band.min * (1.02 + score * 0.28 + variance * 0.08);
    return { min: roundPrice(lower), max: roundPrice(lower * (1.28 + score * 0.18 + variance * 0.1)) };
  }
  const half = Math.max(2_500, naturalMid * (0.12 + variance * 0.08));
  return {
    min: roundPrice(Math.max(bounds.min * 0.5, naturalMid - half)),
    max: roundPrice(Math.max(naturalMid + half, bounds.min * 0.7)),
  };
}

function serviceText(service: ServiceOption): string {
  return `${service.label} ${service.serviceName || ""} ${service.serviceSummary || ""}`;
}

function isLandscapeService(service: ServiceOption): boolean {
  return /landscap|outdoor|garden|patio|lawn|tree|shrub|hardscape|irrigation/i.test(serviceText(service));
}

function isBathroomService(service: ServiceOption): boolean {
  return /bath|shower|tub|vanity|powder room/i.test(serviceText(service));
}

function isKitchenService(service: ServiceOption): boolean {
  return /kitchen|cabinet|countertop|pantry/i.test(serviceText(service));
}

/** Turn subcategory shells ("Patio style") into real deliverable language. */
function inclusionFromComponentLabel(label: string, outdoor = false): string {
  const raw = label.trim().replace(/\s+/g, " ");
  const value = raw.toLowerCase();
  if (outdoor) {
    if (/patio|hardscape|paver/.test(value)) return "Patio and hardscape surfaces sized for this layout";
    if (/walkway|pathway|path\b|sidewalk/.test(value)) return "Walkways and connecting paths";
    if (/driveway/.test(value)) return "Driveway resurfacing or redesign allowance";
    if (/plant|garden|bed|shrub|tree/.test(value)) return "Planting package with soil prep and mulch";
    if (/light/.test(value)) return "Landscape lighting package";
    if (/irrigation|sprinkler/.test(value)) return "Irrigation adjustments for new planting";
    if (/fence|gate/.test(value)) return "Fence or gate updates where shown";
    if (/lawn|turf|sod/.test(value)) return "Lawn restoration or new turf areas";
    if (/retain|wall|grade/.test(value)) return "Retaining walls or grade transitions";
    if (/water|fountain|feature/.test(value)) return "Water feature allowance";
  } else {
    if (/vanity|cabinet/.test(value)) return "Vanity or cabinetry for the selected layout";
    if (/tile|floor/.test(value)) return "Primary tile or flooring surfaces";
    if (/shower|tub/.test(value)) return "Shower or tub surround and waterproofing";
    if (/fixture|faucet|hardware/.test(value)) return "Fixtures, faucet, and finish hardware";
    if (/light|sconce/.test(value)) return "Lighting updates in the work area";
    if (/paint|finish/.test(value)) return "Paint and finish work";
  }
  if (/\b(style|type|material|option|selection)s?\b/.test(value)) {
    const base = raw.replace(/\b(style|type|material|option|selection)s?\b/gi, "").trim();
    if (base) return `${sentenceLabel(base)} selected and installed for this design`;
  }
  return sentenceLabel(raw);
}

function uniqueInclusions(items: string[], limit = 5): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of items) {
    const key = item.toLowerCase();
    if (!item || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
    if (result.length >= limit) break;
  }
  return result;
}

function landscapeInclusions(scope: string, configuredComponents: string[]): string[] {
  const fromComponents = configuredComponents.map((label) => inclusionFromComponentLabel(label, true));
  const value = scope.toLowerCase();
  const fromScope: string[] = [];
  if (/patio|hardscape|paver|courtyard/.test(value)) {
    fromScope.push("Patio and hardscape surfaces sized for this layout");
  }
  if (/walk|path|step/.test(value)) fromScope.push("Walkways, steps, and edge detailing");
  if (/drive/.test(value)) fromScope.push("Driveway resurfacing or redesign allowance");
  if (/plant|garden|yard|landscape|outdoor|renovation/.test(value)) {
    fromScope.push("Planting package with soil prep and mulch");
  }
  if (/light/.test(value)) fromScope.push("Landscape lighting package");
  if (/full|complete|renovation|transformation/.test(value)) {
    fromScope.push("Site prep, installation, and finish cleanup");
  }
  return uniqueInclusions([
    ...fromComponents,
    ...fromScope,
    "Patio and hardscape surfaces sized for this layout",
    "Planting package with soil prep and mulch",
    "Walkways and connecting paths",
    "Landscape lighting package",
    "Site prep, installation, and finish cleanup",
  ]);
}

function detailsForScope(scope: string, configuredComponents: string[], service: ServiceOption) {
  if (isLandscapeService(service)) {
    return {
      inclusions: landscapeInclusions(scope, configuredComponents),
      assumptions: [
        "Existing mature trees kept where they fit the design",
        "Standard drainage and soil preparation",
        "Normal site access for crew and materials",
      ],
    };
  }

  const value = scope.toLowerCase();
  const outdoor = false;
  const fromComponents = configuredComponents.map((label) => inclusionFromComponentLabel(label, outdoor));

  // Scope-specific packs only when they match the selected subcategory.
  if (isBathroomService(service)) {
    if (/full|complete|primary/.test(value)) {
      return {
        inclusions: uniqueInclusions([
          ...fromComponents,
          "Primary surfaces",
          "Cabinetry or built-ins",
          "Fixtures and lighting",
          "Finish work and paint",
        ], 4),
        assumptions: ["Existing structural footprint retained", "Standard site access", "No major hidden damage"],
      };
    }
    if (/shower|tub/.test(value)) {
      return {
        inclusions: uniqueInclusions([
          ...fromComponents,
          "Shower or tub surround",
          "Waterproofing",
          "Trim and fixtures",
          "Finish detailing",
        ], 4),
        assumptions: ["Existing plumbing locations retained", "Standard waterproofing conditions", "No structural repair"],
      };
    }
    if (/vanity|cabinet|fixture/.test(value)) {
      return {
        inclusions: uniqueInclusions([
          ...fromComponents,
          "Vanity or cabinetry",
          "Countertop and sink",
          "Faucet and hardware",
          "Related lighting",
        ], 4),
        assumptions: ["Existing plumbing locations retained", "Standard cabinet sizing", "Walls remain in place"],
      };
    }
    if (/tile|floor/.test(value)) {
      return {
        inclusions: uniqueInclusions([
          ...fromComponents,
          "Primary tile surfaces",
          "Flooring",
          "Preparation and underlayment",
          "Grout and finish work",
        ], 4),
        assumptions: ["Subfloor is serviceable", "Existing layout retained", "No major water damage"],
      };
    }
  }

  if (isKitchenService(service)) {
    if (/full|complete|remodel/.test(value)) {
      return {
        inclusions: uniqueInclusions([
          ...fromComponents,
          "Cabinetry",
          "Counters and backsplash",
          "Sink, faucet, and hardware",
          "Lighting and finish work",
        ], 4),
        assumptions: ["Existing structural footprint retained", "Standard site access", "No major hidden damage"],
      };
    }
    if (/cabinet|counter|island/.test(value)) {
      return {
        inclusions: uniqueInclusions([
          ...fromComponents,
          "Cabinetry updates",
          "Countertops",
          "Hardware and sink area",
          "Finish detailing",
        ], 4),
        assumptions: ["Existing layout retained", "Standard appliance openings", "Walls remain in place"],
      };
    }
  }

  if (/cosmetic|paint|lighting|hardware|refresh/.test(value)) {
    return {
      inclusions: uniqueInclusions([
        ...fromComponents,
        "Paint and finish refresh",
        "Lighting updates",
        "Hardware and accessories",
        "Minor surface repairs",
      ], 4),
      assumptions: ["No layout changes", "Existing major components retained", "Standard electrical access"],
    };
  }

  return {
    inclusions: uniqueInclusions([
      ...fromComponents,
      "Core project work",
      "Materials and finishes",
      "Installation",
      "Finish detailing",
    ], 4),
    assumptions: ["Existing layout retained", "Standard site access", "No major hidden damage"],
  };
}

export function priceDetailsForService(service: ServiceOption) {
  if (isLandscapeService(service)) {
    return {
      increases: [
        "Significant grading, drainage, or soil preparation",
        "Premium hardscape materials or custom outdoor features",
        "Expanded square footage, utility work, or difficult site access",
      ],
      compromises: [
        "Retain the existing layout and mature planting where possible",
        "Prioritize one major focal feature before secondary upgrades",
        "Use standard paver sizes and readily available plant material",
      ],
    };
  }
  if (isBathroomService(service)) {
    return {
      increases: [
        "Moving plumbing, waterproofing repairs, or major utilities",
        "Custom tilework or premium fixtures and finishes",
        "Hidden damage, permit changes, or difficult access",
      ],
      compromises: [
        "Keep major plumbing locations where they are",
        "Use reliable in-stock sizes for secondary elements",
        "Prioritize the most visible surfaces first",
      ],
    };
  }
  if (isKitchenService(service)) {
    return {
      increases: [
        "Moving appliances, plumbing, or electrical locations",
        "Custom cabinetry or premium countertop materials",
        "Hidden damage, permit changes, or difficult access",
      ],
      compromises: [
        "Keep major appliance and utility locations where they are",
        "Use reliable in-stock sizes for secondary elements",
        "Prioritize the most visible surfaces first",
      ],
    };
  }
  return {
    increases: [
      "Expanded scope or structural changes",
      "Custom fabrication or premium materials",
      "Hidden damage, permit changes, or difficult access",
    ],
    compromises: [
      "Keep the existing layout where possible",
      "Use reliable in-stock sizes for secondary elements",
      "Prioritize the most visible surfaces first",
    ],
  };
}

/** Recompute deliverables so saved snapshots don’t keep stale category labels. */
export function refreshProjectCoverage(
  project: VisualPricingProject,
  service: ServiceOption
): VisualPricingProject {
  const configuredComponents = (service.subcategoryComponents || [])
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((component) => sentenceLabel(component.label))
    .filter(Boolean);
  const details = detailsForScope(project.scope, configuredComponents, service);
  const priceDetails = priceDetailsForService(service);
  return {
    ...project,
    inclusions: details.inclusions,
    assumptions: details.assumptions,
    priceIncreases: priceDetails.increases,
    compromises: priceDetails.compromises,
  };
}

function scopeFitsBudget(scope: string, band: BudgetBand): boolean {
  if (band.min === null && band.max === null) return true;
  const value = scope.toLowerCase();
  const mid = bandTargetWindow(band)?.mid ?? 25_000;
  // Light cosmetic / partial work fits the low end.
  if (mid <= 12_000) {
    return (
      !/full bathroom|full outdoor|complete renovation|layout|plumbing|addition/.test(value) ||
      /cosmetic|paint|hardware|refresh|tile|vanity|pruning|lighting|irrigation/.test(value)
    );
  }
  if (mid <= 28_000) {
    return !/layout|plumbing|addition/.test(value) || /shower|vanity|tile|patio|lawn|garden/.test(value);
  }
  // High end prefers full / structural scopes.
  if (mid >= 70_000) {
    return (
      /full|complete|primary|layout|plumbing|addition|renovation|outdoor|patio/.test(value) ||
      !/cosmetic|paint|hardware|refresh|pruning/.test(value)
    );
  }
  return true;
}

export function buildVisualProjects(params: {
  rawProjects: RawVisualProject[];
  service: ServiceOption;
  budgetBand: BudgetBand;
  bounds: PricingBounds;
  budgetMode?: "constraint" | "lens";
}): VisualPricingProject[] {
  const configuredComponents = (params.service.subcategoryComponents || [])
    .slice()
    .sort((a, b) => a.priority - b.priority)
    .map((component) => sentenceLabel(component.label))
    .filter(Boolean);

  const budgetMode = params.budgetMode || "constraint";
  const usedTitles = new Set<string>();

  const ranked = params.rawProjects
    .map((raw) => {
      const quality = projectQualityScore(raw);
      const intrinsicMid = intrinsicProjectMidpoint(raw, params.bounds);
      const fit = budgetMode === "lens"
        ? budgetFitScore(intrinsicMid, quality, params.budgetBand)
        : scopeFitsBudget(raw.scope, params.budgetBand) ? 1 : 0;
      return { raw, intrinsicMid, fit, quality };
    })
    .filter((entry) => entry.fit > 0)
    .sort((a, b) => compareBudgetEntries(a, b, params.budgetBand));

  // If the band is thin on matches, fill with the closest finish levels — never
  // by blindly re-including luxury into a light budget at a token score.
  const window = bandTargetWindow(params.budgetBand);
  const targetQ = targetQualityForBand(params.budgetBand);
  const pool = ranked.length >= 6
    ? ranked
    : params.rawProjects
      .map((raw) => {
        const quality = projectQualityScore(raw);
        const intrinsicMid = intrinsicProjectMidpoint(raw, params.bounds);
        let fit = budgetMode === "lens"
          ? budgetFitScore(intrinsicMid, quality, params.budgetBand)
          : scopeFitsBudget(raw.scope, params.budgetBand) ? 1 : 0.15;
        if (budgetMode === "lens" && fit <= 0 && targetQ !== null) {
          // Soft fallback: distance to the band's finish target only.
          fit = Math.max(0.02, 0.55 - Math.abs(quality - targetQ));
          if (window && window.mid <= 10_000 && quality >= 0.7) fit = 0;
          if (window && window.mid >= 70_000 && quality <= 0.3) fit = 0;
        }
        return { raw, intrinsicMid, fit, quality };
      })
      .filter((entry) => entry.fit > 0)
      .sort((a, b) => compareBudgetEntries(a, b, params.budgetBand));

  return pool
    .slice(0, 50)
    .map(({ raw }) => {
      const range = projectRange(raw, params.budgetBand, params.bounds, budgetMode);
      const details = detailsForScope(raw.scope, configuredComponents, params.service);
      const priceDetails = priceDetailsForService(params.service);
      return {
        ...raw,
        title: assignUniqueProjectTitle(raw.label, raw.scope, raw.assetId, usedTitles),
        serviceLabel: params.service.label,
        priceMin: Math.min(range.min, range.max),
        priceMax: Math.max(range.min, range.max),
        currency: params.bounds.currency,
        fitLabel:
          params.budgetBand.id === "not-sure"
            ? "A typical option for this project type"
            : budgetMode === "lens"
              ? `Commonly built around your ${params.budgetBand.galleryLabel} starting point`
              : `Fits your selected ${params.budgetBand.galleryLabel} budget`,
        layoutSummary: /layout|plumbing/i.test(raw.scope)
          ? "Layout changes included"
          : "Existing layout retained",
        inclusions: details.inclusions,
        assumptions: details.assumptions,
        priceIncreases: priceDetails.increases,
        compromises: priceDetails.compromises,
      };
    });
}

/** Short professional blurb for the estimate reveal — not a headline. */
export function projectDesignSummary(project: VisualPricingProject): string {
  const style = titleCaseLabel(project.title.split("·")[0] || project.title);
  const scope = project.scope?.trim();
  const layout = project.layoutSummary?.trim();
  if (scope && !/^project\s+\d+$/i.test(scope)) {
    return `${style} for ${sentenceLabel(scope).toLowerCase()}. ${layout || "A considered direction with a realistic planning range."}`;
  }
  return `${style}. ${layout || "A considered direction with elevated finishes and a clear planning range."}`;
}

/** Tighten a catalog span into a credible selected-project planning range. */
export function tightenedPlanningRange(project: VisualPricingProject) {
  const midpoint = (project.priceMin + project.priceMax) / 2;
  const originalWidth = Math.max(0, project.priceMax - project.priceMin);
  const narrowedWidth = Math.max(2_000, Math.min(originalWidth * 0.42, midpoint * 0.24));
  return {
    totalMin: roundPrice(Math.max(1_000, midpoint - narrowedWidth / 2)),
    totalMax: roundPrice(midpoint + narrowedWidth / 2),
    currency: project.currency,
  };
}

export function personalizedProjectRange(project: VisualPricingProject, keepLayout: boolean) {
  const tightened = tightenedPlanningRange(project);
  const midpoint = (tightened.totalMin + tightened.totalMax) / 2;
  const originalWidth = tightened.totalMax - tightened.totalMin;
  const narrowedWidth = Math.max(2_000, originalWidth * 0.72);
  const adjustedMidpoint = midpoint * (keepLayout ? 0.985 : 1.12);
  return {
    totalMin: roundPrice(Math.max(1_000, adjustedMidpoint - narrowedWidth / 2)),
    totalMax: roundPrice(adjustedMidpoint + narrowedWidth / 2),
    currency: project.currency,
  };
}

export function adjustedPersonalizedRange(
  range: { totalMin: number; totalMax: number; currency: string },
  priceImpact: number
) {
  const normalizedImpact = Math.max(-0.24, Math.min(0.4, Number(priceImpact) || 0));
  const multiplier = 1 + normalizedImpact;
  return {
    totalMin: roundPrice(Math.max(1_000, range.totalMin * multiplier)),
    totalMax: roundPrice(Math.max(1_500, range.totalMax * multiplier)),
    currency: range.currency,
  };
}

export function cumulativePersonalizedImpact(refinements: PersonalizedRefinementRecord[]): number {
  return Math.max(
    -0.24,
    Math.min(0.4, refinements.reduce((total, refinement) => total + (Number(refinement.priceImpact) || 0), 0))
  );
}

export function configuredProjectRange(
  project: VisualPricingProject,
  config: VisualPricingEstimateConfig,
  refinements?: { suggestions?: string[]; prompt?: string; priceImpact?: number }
) {
  const finishMultiplier = config.finishLevel === "value"
    ? 0.88
    : config.finishLevel === "premium"
      ? 1.14
      : 1;
  const scopeMultiplier = config.scopeLevel === "focused"
    ? 0.9
    : 1;
  const layoutMultiplier = config.layoutPlan === "rework" ? 1.18 : 1;
  const sourcingMultiplier = config.sourcing === "custom" ? 1.12 : 1;
  const uniqueSuggestions = new Set((refinements?.suggestions || []).map((item) => item.trim()).filter(Boolean));
  const hasLibraryImpact = typeof refinements?.priceImpact === "number" && Number.isFinite(refinements.priceImpact);
  const libraryImpact = hasLibraryImpact ? Math.max(-0.2, Math.min(0.4, refinements?.priceImpact || 0)) : 0;
  const genericSuggestionCount = Math.max(0, uniqueSuggestions.size - (hasLibraryImpact ? 1 : 0));
  const refinementMultiplier = Math.min(
    1.4,
    1 + genericSuggestionCount * 0.025 + libraryImpact + (refinements?.prompt?.trim() ? 0.035 : 0)
  );
  const multiplier = finishMultiplier * scopeMultiplier * layoutMultiplier * sourcingMultiplier * refinementMultiplier;
  const tight = tightenedPlanningRange(project);
  return {
    totalMin: roundPrice(tight.totalMin * multiplier),
    totalMax: roundPrice(Math.max(tight.totalMin * multiplier + 1_500, tight.totalMax * multiplier)),
    currency: project.currency,
    multiplier,
    refinementMultiplier,
  };
}
