import { v2ScopeStarterKey } from "@/lib/adventure-v2/scope-starter-catalog";

export const V8_STARTER_REFERENCE_GENERATED_FOR = "v8_starter_reference";
export const V8_STARTER_REFERENCE_PROFILE_VERSION = 1;
export const V8_STARTER_MODEL_ID = "prunaai/p-image-edit";
const V8_STARTER_MODEL_ALLOWLIST = new Set([V8_STARTER_MODEL_ID]);

export type StarterFinishTier = "value" | "mid" | "premium" | "luxury";

export type StarterReferenceProfile = {
  version: number;
  eligible: boolean;
  reviewStatus: "approved" | "pending" | "rejected";
  serviceId: string | null;
  visibleScopeKeys: string[];
  heroScopeKeys: string[];
  finishTier: StarterFinishTier;
  layoutFamily: string;
  cameraAngle: string;
  fixtureInventory: Record<string, string | number | boolean>;
  plainnessScore: number;
  editabilityScore: number;
  structuralValid: boolean;
  defects: string[];
};

export type StarterReferenceRow = {
  id: string;
  image_url: string;
  account_id?: string | null;
  subcategory_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type StarterReferenceCandidate = {
  id: string;
  imageUrl: string;
  accountId: string | null;
  profile: StarterReferenceProfile;
};

export type StarterReferenceMatch = StarterReferenceCandidate & {
  score: number;
  matchedScopeKeys: string[];
  missingScopeKeys: string[];
};

export function resolveV8StarterModelId(value?: unknown): string {
  const requested = String(value || "").trim();
  return V8_STARTER_MODEL_ALLOWLIST.has(requested)
    ? requested
    : V8_STARTER_MODEL_ID;
}

const FINISH_TIER_RANK: Record<StarterFinishTier, number> = {
  value: 0,
  mid: 1,
  premium: 2,
  luxury: 3,
};

const LEGACY_NEUTRAL_GENERATED_FOR = "v2_neutral_scope_starter";

const LEGACY_VISIBLE_SCOPES: Record<string, string[]> = {
  "full-bathroom-renovation": [
    "full-bathroom-renovation",
    "shower-tub",
    "shower-or-tub-area-only",
    "vanity",
    "vanity-cabinets-and-fixtures",
    "cabinets-storage",
    "cabinets-and-storage",
    "countertop",
    "toilet",
    "floor-tile",
    "wall-tile",
    "tile-and-flooring",
    "faucets-fixtures",
    "faucets-and-fixtures",
    "lighting",
    "mirror-medicine",
    "mirror-medicine-cabinet",
    "paint-trim",
    "paint-and-trim",
    "hardware",
    "exhaust-fan",
    "layout-changes",
    "plumbing-updates",
    "layout-or-plumbing-changes",
  ],
  "shower-or-tub-area-only": [
    "shower-tub",
    "shower-or-tub-area-only",
    "floor-tile",
    "wall-tile",
    "tile-and-flooring",
    "faucets-fixtures",
    "faucets-and-fixtures",
  ],
  "vanity-cabinets-and-fixtures": [
    "vanity",
    "vanity-cabinets-and-fixtures",
    "cabinets-storage",
    "cabinets-and-storage",
    "countertop",
    "faucets-fixtures",
    "faucets-and-fixtures",
    "lighting",
    "mirror-medicine",
    "mirror-medicine-cabinet",
    "hardware",
  ],
  "tile-and-flooring": ["floor-tile", "wall-tile", "tile-and-flooring", "shower-tub"],
  "cosmetic-refresh-paint-lighting-hardware": [
    "cosmetic-refresh-paint-lighting-hardware",
    "vanity",
    "cabinets-storage",
    "cabinets-and-storage",
    "countertop",
    "faucets-fixtures",
    "faucets-and-fixtures",
    "lighting",
    "mirror-medicine",
    "mirror-medicine-cabinet",
    "paint-trim",
    "paint-and-trim",
    "hardware",
  ],
  "layout-or-plumbing-changes": [
    "layout-or-plumbing-changes",
    "layout-changes",
    "plumbing-updates",
    "shower-tub",
    "vanity",
    "toilet",
  ],
  "full-outdoor-renovation": [
    "full-outdoor-renovation",
    "patio",
    "patio-terrace",
    "walkways",
    "walkways-and-paths",
    "lawn",
    "planting-beds",
    "trees-shrubs",
    "trees-and-shrubs",
    "privacy",
    "privacy-screening",
    "outdoor-lighting-installation",
    "outdoor-lighting",
    "lighting",
    "irrigation",
    "drainage",
  ],
  "patio-and-walkway-upgrade": ["patio", "patio-terrace", "walkways", "walkways-and-paths", "patio-and-walkway-upgrade"],
  "new-lawn-and-garden-installation": [
    "lawn",
    "planting-beds",
    "trees-shrubs",
    "trees-and-shrubs",
    "new-lawn-and-garden-installation",
  ],
  "driveway-resurfacing-and-repair": ["driveway", "driveway-resurfacing-and-repair"],
  "hardscape-color-scheme-refresh": [
    "patio",
    "walkways",
    "retaining-walls",
    "hardscape-color-scheme-refresh",
  ],
  "outdoor-lighting-installation": ["lighting", "outdoor-lighting", "outdoor-lighting-installation", "walkways", "walkways-and-paths"],
  "irrigation-system-installation": ["irrigation", "lawn", "planting-beds"],
  "tree-and-shrub-pruning-service": ["trees-shrubs", "trees-and-shrubs", "privacy", "privacy-screening", "tree-and-shrub-pruning-service"],
};

const LEGACY_LAYOUTS: Record<string, { layout: string; camera: string; inventory: Record<string, string | number | boolean> }> = {
  "full-bathroom-renovation": {
    layout: "compact-hall-bath",
    camera: "doorway-three-quarter-wide",
    inventory: { wet_zone_type: "tub-shower-combo", wet_zone_count: 1, vanity_count: 1, toilet_count: 1 },
  },
  "shower-or-tub-area-only": {
    layout: "alcove-wet-zone",
    camera: "wet-zone-front-three-quarter",
    inventory: { wet_zone_type: "tub-shower-combo", wet_zone_count: 1, vanity_count: 0, toilet_count: 0 },
  },
  "vanity-cabinets-and-fixtures": {
    layout: "single-vanity-wall",
    camera: "vanity-front-three-quarter",
    inventory: { wet_zone_count: 0, vanity_count: 1, toilet_count: 0 },
  },
  "tile-and-flooring": {
    layout: "bathroom-surface-study",
    camera: "wide-downward-three-quarter",
    inventory: { wet_zone_count: 1, vanity_count: 0, toilet_count: 0 },
  },
  "cosmetic-refresh-paint-lighting-hardware": {
    layout: "single-vanity-wall",
    camera: "vanity-wall-wide",
    inventory: { wet_zone_count: 0, vanity_count: 1, toilet_count: 0 },
  },
  "layout-or-plumbing-changes": {
    layout: "compact-hall-bath",
    camera: "doorway-layout-wide",
    inventory: { wet_zone_type: "tub-shower-combo", wet_zone_count: 1, vanity_count: 1, toilet_count: 1 },
  },
  "full-outdoor-renovation": {
    layout: "suburban-backyard-wide",
    camera: "house-to-yard-wide",
    inventory: { lawn_zones: 1, patio_zones: 1, walkway_zones: 1, planting_zones: 1 },
  },
  "patio-and-walkway-upgrade": {
    layout: "patio-walkway-connection",
    camera: "hardscape-wide-three-quarter",
    inventory: { patio_zones: 1, walkway_zones: 1 },
  },
  "new-lawn-and-garden-installation": {
    layout: "lawn-perimeter-bed",
    camera: "yard-wide",
    inventory: { lawn_zones: 1, planting_zones: 1 },
  },
  "driveway-resurfacing-and-repair": {
    layout: "two-car-driveway",
    camera: "street-to-garage-wide",
    inventory: { driveway_zones: 1 },
  },
  "hardscape-color-scheme-refresh": {
    layout: "connected-hardscape",
    camera: "hardscape-wide",
    inventory: { hardscape_zones: 1 },
  },
  "outdoor-lighting-installation": {
    layout: "path-and-foundation-bed",
    camera: "blue-hour-yard-wide",
    inventory: { walkway_zones: 1, lighting_zones: 0 },
  },
  "irrigation-system-installation": {
    layout: "lawn-perimeter-bed",
    camera: "coverage-zone-wide",
    inventory: { lawn_zones: 1, planting_zones: 1, irrigation_zones: 0 },
  },
  "tree-and-shrub-pruning-service": {
    layout: "foundation-planting-edge",
    camera: "tree-shrub-wide",
    inventory: { tree_zones: 1, shrub_zones: 1 },
  },
};

function asObject(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function boundedScore(value: unknown, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(1, parsed));
}

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return Array.from(
    new Set(
      value
        .map((item) => v2ScopeStarterKey(String(item || "")))
        .filter(Boolean)
    )
  );
}

function textList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export function normalizeStarterFinishTier(value: unknown): StarterFinishTier {
  const tier = String(value || "").trim().toLowerCase();
  if (["starter", "value", "budget", "economy", "$"].includes(tier)) return "value";
  if (["mid", "middle", "standard", "upper", "upper-mid", "$$"].includes(tier)) return "mid";
  if (["plus", "premium", "high", "$$$"].includes(tier)) return "premium";
  if (["luxury", "lux", "estate", "bespoke", "$$$$"].includes(tier)) return "luxury";
  return "mid";
}

function explicitProfile(
  raw: Record<string, unknown>,
  serviceId: string
): StarterReferenceProfile | null {
  const reviewStatus = String(raw.review_status || raw.reviewStatus || "pending").trim().toLowerCase();
  const defects = textList(raw.defects);
  const profileServiceId = String(raw.service_id || raw.serviceId || "").trim() || null;
  const version = Number(raw.version || 0);
  const eligible = raw.eligible === true;
  const structuralValid = raw.structural_valid === true || raw.structuralValid === true;
  if (
    version !== V8_STARTER_REFERENCE_PROFILE_VERSION ||
    !eligible ||
    reviewStatus !== "approved" ||
    !structuralValid ||
    defects.length > 0 ||
    (profileServiceId && profileServiceId !== serviceId)
  ) {
    return null;
  }
  const inventory = asObject(raw.fixture_inventory || raw.fixtureInventory) || {};
  return {
    version,
    eligible,
    reviewStatus: "approved",
    serviceId: profileServiceId,
    visibleScopeKeys: stringList(raw.visible_scope_keys || raw.visibleScopeKeys),
    heroScopeKeys: stringList(raw.hero_scope_keys || raw.heroScopeKeys),
    finishTier: normalizeStarterFinishTier(raw.finish_tier || raw.finishTier),
    layoutFamily: String(raw.layout_family || raw.layoutFamily || "general").trim() || "general",
    cameraAngle: String(raw.camera_angle || raw.cameraAngle || "wide-three-quarter").trim() || "wide-three-quarter",
    fixtureInventory: inventory as Record<string, string | number | boolean>,
    plainnessScore: boundedScore(raw.plainness_score || raw.plainnessScore, 0.8),
    editabilityScore: boundedScore(raw.editability_score || raw.editabilityScore, 0.8),
    structuralValid,
    defects,
  };
}

function legacyNeutralProfile(metadata: Record<string, unknown>): StarterReferenceProfile | null {
  if (
    String(metadata.generated_for || "").trim() !== LEGACY_NEUTRAL_GENERATED_FOR ||
    metadata.starter_experiment_eligible !== true
  ) {
    return null;
  }
  const scopeKey = v2ScopeStarterKey(String(metadata.starter_scope_key || metadata.starter_scope || ""));
  const layout = LEGACY_LAYOUTS[scopeKey];
  if (!layout) return null;
  const visible = LEGACY_VISIBLE_SCOPES[scopeKey] || [scopeKey];
  return {
    version: 0,
    eligible: true,
    reviewStatus: "approved",
    serviceId: String(metadata.subcategory_id || "").trim() || null,
    visibleScopeKeys: visible,
    heroScopeKeys: scopeKey.startsWith("full-") ? visible : [scopeKey, ...visible.slice(0, 3)],
    finishTier: "value",
    layoutFamily: layout.layout,
    cameraAngle: layout.camera,
    fixtureInventory: layout.inventory,
    plainnessScore: 0.95,
    editabilityScore: 0.9,
    structuralValid: true,
    defects: [],
  };
}

export function starterReferenceCandidate(
  row: StarterReferenceRow,
  serviceId: string
): StarterReferenceCandidate | null {
  const imageUrl = String(row.image_url || "").trim();
  if (!row.id || !/^https?:\/\//i.test(imageUrl)) return null;
  const metadata = asObject(row.metadata) || {};
  const profileRaw = asObject(metadata.starter_profile);
  const profile = profileRaw
    ? explicitProfile(profileRaw, serviceId)
    : legacyNeutralProfile(metadata);
  if (!profile) return null;
  return {
    id: row.id,
    imageUrl,
    accountId: String(row.account_id || "").trim() || null,
    profile,
  };
}

function stableBucket(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectStarterReference(params: {
  rows: StarterReferenceRow[];
  serviceId: string;
  accountId?: string | null;
  scopes: string[];
  finishTier?: string | null;
  sessionId: string;
}): StarterReferenceMatch | null {
  const requestedScopeKeys = Array.from(
    new Set(params.scopes.map((scope) => v2ScopeStarterKey(scope)).filter(Boolean))
  );
  const desiredTier = normalizeStarterFinishTier(params.finishTier);
  const desiredTierRank = FINISH_TIER_RANK[desiredTier];
  const candidates = params.rows
    .map((row) => starterReferenceCandidate(row, params.serviceId))
    .filter((row): row is StarterReferenceCandidate => Boolean(row))
    .filter((row) => !row.accountId || row.accountId === params.accountId)
    .map((candidate): StarterReferenceMatch => {
      const visible = new Set(candidate.profile.visibleScopeKeys);
      const hero = new Set(candidate.profile.heroScopeKeys);
      const matchedScopeKeys = requestedScopeKeys.filter((key) => visible.has(key));
      const missingScopeKeys = requestedScopeKeys.filter((key) => !visible.has(key));
      const coverage = requestedScopeKeys.length
        ? matchedScopeKeys.length / requestedScopeKeys.length
        : 1;
      const heroMatches = requestedScopeKeys.filter((key) => hero.has(key)).length;
      const tierDistance = Math.abs(
        FINISH_TIER_RANK[candidate.profile.finishTier] - desiredTierRank
      );
      const isWide = /wide|doorway|three-quarter/i.test(candidate.profile.cameraAngle);
      const score =
        coverage * 100 +
        matchedScopeKeys.length * 12 +
        heroMatches * 8 +
        Math.max(0, 18 - tierDistance * 6) +
        (candidate.accountId ? 12 : 0) +
        (requestedScopeKeys.length > 1 && isWide ? 6 : 0) +
        candidate.profile.plainnessScore * 5 +
        candidate.profile.editabilityScore * 5;
      return { ...candidate, score, matchedScopeKeys, missingScopeKeys };
    })
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));

  if (!candidates.length) return null;
  const topScore = candidates[0].score;
  const similarlyRanked = candidates.filter((candidate) => candidate.score >= topScore - 4);
  const scopeSeed = requestedScopeKeys.slice().sort().join(",");
  const bucket = stableBucket(
    `${params.sessionId}:${params.serviceId}:${scopeSeed}:${desiredTier}`
  );
  return similarlyRanked[bucket % similarlyRanked.length] || candidates[0];
}

function finishDirective(tier: StarterFinishTier, budget: number): string {
  const amount = budget > 0 ? ` The project budget is approximately $${Math.round(budget).toLocaleString()}.` : "";
  const directive: Record<StarterFinishTier, string> = {
    value: "Use clean, durable, readily available builder-grade materials and straightforward fixtures.",
    mid: "Use good-quality mainstream materials and fixtures with restrained detailing.",
    premium: "Use visibly upgraded materials and fixtures, while keeping the scene restrained and approachable.",
    luxury: "Use high-end materials and fixtures, but avoid editorial styling or extravagant decor.",
  };
  return `${directive[tier]}${amount}`;
}

function inventoryDirective(inventory: Record<string, string | number | boolean>): string {
  const entries = Object.entries(inventory);
  if (!entries.length) return "Preserve every existing fixture and zone count exactly.";
  return `Immutable fixture and zone inventory: ${entries
    .map(([key, value]) => `${key.replace(/_/g, " ")}=${String(value)}`)
    .join(", ")}.`;
}

function structuralInventoryDirective(
  serviceLabel: string,
  inventory: Record<string, string | number | boolean>
): string {
  const service = String(serviceLabel || "").toLowerCase();
  const wetZoneCount = Number(inventory.wet_zone_count || 0);
  const wetZoneType = String(inventory.wet_zone_type || "").toLowerCase();
  if (/bath|shower|tub/.test(service) && wetZoneCount === 1) {
    const comboHardware = wetZoneType.includes("tub") && wetZoneType.includes("shower")
      ? "The single tub-shower combination must contain exactly ONE showerhead total, exactly ONE tub spout, and exactly ONE control-valve set, all in their original reference positions."
      : "The single wet zone must contain exactly ONE coherent shower or tub hardware set in its original reference position.";
    return [
      comboHardware,
      "Do not mirror, redraw, reinterpret, relocate, or duplicate any plumbing hardware.",
      "A showerhead must remain a showerhead and may not become a lamp; a lamp, sconce, or glowing fixture may not appear inside the tiled tub/shower wet zone.",
      "Preserve the reference lighting positions exactly. If lighting is selected work, change only the finish or light quality of an existing light outside the wet zone.",
    ].join(" ");
  }
  return "Do not mirror, redraw, reinterpret, relocate, or duplicate any major fixture, hardware set, structure, or zone.";
}

export function buildStarterReferencePrompt(params: {
  serviceLabel: string;
  scopes: string[];
  otherScope?: string | null;
  budget?: number;
  finishTier?: string | null;
  reference: StarterReferenceCandidate;
}): string {
  const scopes = params.scopes.map((scope) => String(scope || "").trim()).filter(Boolean);
  const selectedWork = scopes.length ? scopes.join(", ") : "the selected project work";
  const other = String(params.otherScope || "").trim();
  const tier = normalizeStarterFinishTier(params.finishTier);
  return [
    `Make one low-delta photoreal material-and-finish variation of the supplied approved residential ${params.serviceLabel} reference.`,
    "This is a constrained reference edit, not a new scene and not a redesign.",
    "Use the supplied image as an immutable object, plumbing, spatial, lighting-position, and camera reference—not merely as style inspiration.",
    `Preserve its ${params.reference.profile.layoutFamily} layout and ${params.reference.profile.cameraAngle} camera angle.`,
    inventoryDirective(params.reference.profile.fixtureInventory),
    structuralInventoryDirective(params.serviceLabel, params.reference.profile.fixtureInventory),
    "Keep the exact number, type, position, orientation, and clearances of every existing major fixture and outdoor zone.",
    "Never add, remove, mirror, or duplicate a showerhead, shower, tub, faucet, control, toilet, vanity, sink, light, patio, walkway, fire feature, kitchen zone, or other major element.",
    `The approved reference already represents the selected work: ${selectedWork}. Keep those existing elements visible; do not create another element to represent a selected scope.`,
    other ? `Additional customer request: ${other}.` : "",
    finishDirective(tier, Math.max(0, Number(params.budget) || 0)),
    "Limit changes to subtle, coherent colors, surface materials, and finish quality on existing visible elements. If a variation would require changing geometry or inventing an object, leave that element unchanged.",
    "Make this an intentionally modest, neutral, clean, partially designed starting canvas that invites later edits.",
    "It must look newly installed and convincing, but not like a completed luxury reveal, editorial photo, before-image, rental, or lived-in space.",
    "Use ordinary daylight and realistic materials. No people, text, logos, watermarks, clutter, personal items, or split-screen composition.",
    "Any uniqueness must come only from restrained surface and finish variation; preserve every physical object and hardware count from the reference.",
  ]
    .filter(Boolean)
    .join(" ");
}
