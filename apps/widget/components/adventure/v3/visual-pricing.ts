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

function conciseProjectTitle(label: string, scope: string): string {
  const normalized = label.trim().replace(/\s+/g, " ");
  const fallback = scope.trim().replace(/\s+/g, " ");
  const value = normalized && !/^project\s+\d+$/i.test(normalized) ? normalized : fallback;
  if (!value) return "Project inspiration";
  return sentenceLabel(value).slice(0, 48);
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
    const candidate = sentenceLabel(`${base} · ${tag}`).slice(0, 56);
    if (!used.has(normalize(candidate))) {
      used.add(normalize(candidate));
      return candidate;
    }
  }

  const fallback = sentenceLabel(`${base} ${used.size + 1}`).slice(0, 56);
  used.add(normalize(fallback));
  return fallback;
}

function scopeWeight(scope: string): number {
  const value = scope.toLowerCase();
  if (/layout|plumbing|full|complete|primary/.test(value)) return 1;
  if (/shower|tub|vanity|cabinet|fixture/.test(value)) return 0.78;
  if (/tile|floor|paint|cosmetic|refresh|lighting|hardware/.test(value)) return 0.61;
  return 0.74;
}

function projectRange(
  raw: RawVisualProject,
  band: BudgetBand,
  bounds: PricingBounds,
  budgetMode: "constraint" | "lens"
): { min: number; max: number } {
  const variance = (stableHash(`${raw.assetId}:${band.id}`) % 1000) / 1000;
  if (band.min !== null && band.max !== null) {
    if (budgetMode === "lens") {
      // Stay near the selected band with a tight planning span (~22–34% of band width).
      const width = Math.max(4_000, band.max - band.min);
      const mid = band.min + width * (0.32 + variance * 0.36);
      const half = width * (0.11 + variance * 0.06);
      const lower = Math.max(band.min * 0.9, mid - half);
      const upper = Math.min(band.max * 1.06, mid + half);
      return { min: roundPrice(lower), max: roundPrice(Math.max(lower + 2_000, upper)) };
    }
    const width = band.max - band.min;
    const lower = band.min + width * (0.07 + variance * 0.2);
    const upper = Math.min(band.max, lower + width * (0.48 + variance * 0.16));
    return { min: roundPrice(lower), max: roundPrice(Math.max(lower + 2_000, upper)) };
  }
  if (band.min !== null) {
    const lower = band.min * (1.03 + variance * 0.13);
    return { min: roundPrice(lower), max: roundPrice(lower * (1.34 + variance * 0.16)) };
  }
  const weight = scopeWeight(raw.scope);
  const lower = Math.max(bounds.min * 0.56, bounds.min * weight * (0.9 + variance * 0.18));
  const upper = Math.max(lower + 3_000, bounds.max * weight * (0.92 + variance * 0.15));
  return { min: roundPrice(lower), max: roundPrice(upper) };
}

function isLandscapeService(service: ServiceOption): boolean {
  return /landscap|outdoor|garden|patio|lawn|tree|shrub|hardscape|irrigation/i.test(
    `${service.label} ${service.serviceName || ""} ${service.serviceSummary || ""}`
  );
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
  if (/full|complete|primary/.test(value)) {
    return {
      inclusions: ["Primary surfaces", "Cabinetry or built-ins", "Fixtures and lighting", "Finish work and paint"],
      assumptions: ["Existing structural footprint retained", "Standard site access", "No major hidden damage"],
    };
  }
  if (/shower|tub/.test(value)) {
    return {
      inclusions: ["Shower or tub surround", "Waterproofing", "Trim and fixtures", "Finish detailing"],
      assumptions: ["Existing plumbing locations retained", "Standard waterproofing conditions", "No structural repair"],
    };
  }
  if (/vanity|cabinet|fixture/.test(value)) {
    return {
      inclusions: ["Vanity or cabinetry", "Countertop and sink", "Faucet and hardware", "Related lighting"],
      assumptions: ["Existing plumbing locations retained", "Standard cabinet sizing", "Walls remain in place"],
    };
  }
  if (/tile|floor/.test(value)) {
    return {
      inclusions: ["Primary tile surfaces", "Flooring", "Preparation and underlayment", "Grout and finish work"],
      assumptions: ["Subfloor is serviceable", "Existing layout retained", "No major water damage"],
    };
  }
  if (/cosmetic|paint|lighting|hardware|refresh/.test(value)) {
    return {
      inclusions: ["Paint and finish refresh", "Lighting updates", "Hardware and accessories", "Minor surface repairs"],
      assumptions: ["No layout changes", "Existing major components retained", "Standard electrical access"],
    };
  }
  const fromComponents = configuredComponents.map(inclusionFromComponentLabel);
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
  return {
    increases: [
      "Moving walls, plumbing, or major utilities",
      "Custom fabrication or premium imported materials",
      "Hidden damage, permit changes, or difficult access",
    ],
    compromises: [
      "Keep major utility locations where they are",
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
    return !/cosmetic|paint|hardware|refresh/.test(value);
  }
  if (budgetBandId === "60-plus") {
    return /full|complete|primary|layout|plumbing|addition|shower|tub/.test(value);
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

  return params.rawProjects
    .filter((raw) => budgetMode === "lens" || scopeFitsBudget(raw.scope, params.budgetBand.id))
    .slice(0, 50)
    .map((raw) => {
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
