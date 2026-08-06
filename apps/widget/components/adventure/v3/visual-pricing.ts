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

export const BUDGET_BANDS: BudgetBand[] = [
  { id: "under-15", label: "Under $15,000", galleryLabel: "under $15K", min: 7_500, max: 15_000 },
  { id: "15-25", label: "$15,000–$25,000", galleryLabel: "$15K–$25K", min: 15_000, max: 25_000 },
  { id: "25-40", label: "$25,000–$40,000", galleryLabel: "$25K–$40K", min: 25_000, max: 40_000 },
  { id: "40-60", label: "$40,000–$60,000", galleryLabel: "$40K–$60K", min: 40_000, max: 60_000 },
  { id: "60-plus", label: "$60,000+", galleryLabel: "$60K+", min: 60_000, max: null },
  { id: "not-sure", label: "Not sure yet", galleryLabel: "typical projects", min: null, max: null },
];

export function budgetBandById(id: BudgetBandId | null): BudgetBand | null {
  return BUDGET_BANDS.find((band) => band.id === id) || null;
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
  return titleCaseLabel(value).slice(0, 48);
}

/** Short tags used to differentiate duplicate API style labels in the gallery. */
const DISTINCTIVE_STYLE_TAGS = [
  "courtyard",
  "terrace",
  "evening light",
  "stone path",
  "fire lounge",
  "garden dining",
  "shaded retreat",
  "entry garden",
  "lawn lounge",
  "poolside",
  "grove edge",
  "patio boardwalk",
  "meadow edge",
  "boardwalk",
  "lantern walk",
  "olive court",
  "cedar border",
  "slate terrace",
  "gravel garden",
  "sunken patio",
  "hillside steps",
  "water feature",
  "dining court",
  "morning light",
  "twilight patio",
  "orchard path",
  "bamboo screen",
  "river stone",
  "pergola court",
  "bloom border",
  "hearth patio",
  "canopy walk",
  "desert court",
  "coastal path",
  "zen pocket",
  "family lawn",
  "secret garden",
  "rooftop feel",
  "villa court",
  "cabin edge",
  "atelier patio",
  "festival lawn",
] as const;

function assignUniqueProjectTitle(
  label: string,
  scope: string,
  assetId: string,
  used: Set<string>
): string {
  const base = conciseProjectTitle(label, scope);
  const normalize = (value: string) => value.trim().toLowerCase();
  if (base && !used.has(normalize(base))) {
    used.add(normalize(base));
    return base;
  }

  const start = stableHash(assetId || `${label}:${scope}`) % DISTINCTIVE_STYLE_TAGS.length;
  for (let offset = 0; offset < DISTINCTIVE_STYLE_TAGS.length; offset += 1) {
    const tag = DISTINCTIVE_STYLE_TAGS[(start + offset) % DISTINCTIVE_STYLE_TAGS.length];
    const candidate = titleCaseLabel(`${base} · ${tag}`).slice(0, 56);
    if (!used.has(normalize(candidate))) {
      used.add(normalize(candidate));
      return candidate;
    }
  }

  const fallback = titleCaseLabel(`${base} ${used.size + 1}`).slice(0, 56);
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
  if (/luxury|marble|spa|resort|bespoke|statement|opal|gilt|palace/.test(value)) return 0.94;
  if (/premium|elegant|refined|luxe|hotel|polished|designer|sculptural/.test(value)) return 0.8;
  if (/contemporary|transitional|organic|warm|classic|modern|atelier|villa/.test(value)) return 0.56;
  if (/simple|minimal|basic|fresh|clean|compact|practical|bright|airy/.test(value)) return 0.3;
  return 0.5;
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

/** How well an image belongs in the selected budget. Higher is better; ≤0 is a mismatch. */
function budgetFitScore(intrinsicMid: number, band: BudgetBand): number {
  const window = bandTargetWindow(band);
  if (!window) return 0.75; // not-sure: keep everything, mild preference for mid-range
  const { low, high, mid } = window;
  const width = Math.max(4_000, high - low);
  if (intrinsicMid >= low * 0.88 && intrinsicMid <= high * 1.12) {
    return 1 - Math.min(0.55, Math.abs(intrinsicMid - mid) / width);
  }
  if (intrinsicMid >= low * 0.7 && intrinsicMid <= high * 1.35) {
    return 0.42 - Math.min(0.3, Math.abs(intrinsicMid - mid) / (width * 2.4));
  }
  return 0;
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

function scopeFitsBudget(scope: string, budgetBandId: BudgetBandId): boolean {
  const value = scope.toLowerCase();
  if (budgetBandId === "not-sure" || budgetBandId === "25-40") return true;
  if (budgetBandId === "under-15") {
    return !/full|complete|primary|layout|plumbing|addition/.test(value);
  }
  if (budgetBandId === "15-25") {
    return !/layout|plumbing|addition/.test(value);
  }
  if (budgetBandId === "40-60") {
    return !/cosmetic|paint|hardware|refresh/.test(value) || /full|shower|vanity|tile/.test(value);
  }
  if (budgetBandId === "60-plus") {
    return /full|complete|primary|layout|plumbing|addition|shower|tub|patio|outdoor/.test(value);
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
      const intrinsicMid = intrinsicProjectMidpoint(raw, params.bounds);
      const fit = budgetMode === "lens"
        ? budgetFitScore(intrinsicMid, params.budgetBand)
        : scopeFitsBudget(raw.scope, params.budgetBand.id) ? 1 : 0;
      return { raw, intrinsicMid, fit, quality: projectQualityScore(raw) };
    })
    .filter((entry) => entry.fit > 0)
    .sort((a, b) => {
      if (b.fit !== a.fit) return b.fit - a.fit;
      // Prefer a spread of qualities near the band, then stable id.
      return a.raw.assetId.localeCompare(b.raw.assetId);
    });

  // If the band is too strict for a thin catalog, relax to the next-best fits.
  const pool = ranked.length >= 6
    ? ranked
    : params.rawProjects
      .map((raw) => {
        const intrinsicMid = intrinsicProjectMidpoint(raw, params.bounds);
        const fit = budgetMode === "lens"
          ? Math.max(0.05, budgetFitScore(intrinsicMid, params.budgetBand))
          : scopeFitsBudget(raw.scope, params.budgetBand.id) ? 1 : 0.15;
        return { raw, intrinsicMid, fit, quality: projectQualityScore(raw) };
      })
      .sort((a, b) => b.fit - a.fit || a.raw.assetId.localeCompare(b.raw.assetId));

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
