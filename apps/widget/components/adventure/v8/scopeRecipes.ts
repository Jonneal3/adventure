/**
 * Vertical scope configuration for Adventure V8.
 *
 * Scope is always for the selected catalog service:
 * 1. stored subcategory_scope / components on that service
 * 2. otherwise a vertical recipe matched from the service name
 *
 * Groq is not used at runtime for these options.
 */

export type ScopeChoiceRole = "full" | "part" | "other";

export type VerticalScopeRecipe = {
  key: string;
  question: string;
  subtitle: string;
  fullScope: string;
  parts: string[];
};

export type ScopeChoice = {
  id: string;
  label: string;
  role: ScopeChoiceRole;
};

const QUESTION = "What would you like to include?";
const SUBTITLE = "Pick everything that applies.";
const OTHER_LABEL = "Other";

// Scope choices should describe a visible element the customer can choose in a
// design. Keep whole-project and custom paths, but omit mechanical systems,
// behind-the-wall work, and process-only tasks.
const NON_VISUAL_SCOPE_PART =
  /\b(?:demolition|permits?|inspections?|labor|installation|project management|design services?|site prep|prep work|layout changes?|plumbing|electrical|structural work|framing|waterproofing|drainage|irrigation|ventilation|equipment|mechanicals?|hvac|ductwork|exhaust fans?|pumps?|filters?|heaters?|rough-?in|wiring|underlayment|footings?|excavation|grading|cleanup|disposal)\b/i;
const AWKWARD_OR_NON_DESIGN_SCOPE_PART = /\bflooring\s*\(\s*non[-\s]?tile\s*\)/i;

// Stored service taxonomies often mix visible selections with operational
// work. Once the service is known, require a term that belongs in a finished
// project image for that vertical.
const VISUAL_SCOPE_PART_BY_VERTICAL: Record<string, RegExp> = {
  bathroom:
    /\b(?:shower|tub|bathtub|vanit(?:y|ies)|sink|cabinet|storage|countertops?|toilet|floor tile|wall tile|tiles?|faucets?|fixtures?|lighting|lights?|mirror|medicine cabinet|paint|trim|hardware|backsplash|niche|shelving|doors?|windows?|glass|partition|grab bars?|accessor(?:y|ies)|towel bars?)\b/i,
  kitchen:
    /\b(?:cabinets?|countertops?|islands?|backsplash|flooring|floors?|lighting|lights?|sinks?|faucets?|appliances?|pantry|shelving|range hood|hardware|paint|trim|tiles?|doors?|windows?)\b/i,
  landscaping:
    /\b(?:pavers?|hardscape|patios?|walkways?|paths?|driveways?|retaining walls?|rock walls?|planting|plants?|trees?|shrubs?|gardens?|flowers?|lawns?|sod|turf|mulch|gravel|stone|outdoor lighting|fire pits?|water features?|fountains?|ponds?|pergolas?|decks?|fences?|edging|raised beds?)\b/i,
  painting:
    /\b(?:rooms?|walls?|ceilings?|trim|doors?|cabinets?|exterior|interior|siding|fences?|decks?|railings?|accent walls?)\b/i,
  pool:
    /\b(?:pool shell|interior finish|plaster|pebble|decks?|coping|waterline tiles?|tiles?|lighting|lights?|water features?|fountains?|steps?|spas?|hot tubs?|benches?|seating|slides?)\b/i,
  flooring:
    /\b(?:living areas?|kitchens?|bedrooms?|stairs?|bathrooms?|entries?|entryways?|hallways?|basements?|floors?|flooring|hardwood|tiles?|carpet|vinyl|laminate)\b/i,
  pergola:
    /\b(?:structure|posts?|beams?|rafters?|roof|canopy|shade|screens?|ceiling fans?|lighting|lights?|paint|stain|color)\b/i,
  windows:
    /\b(?:windows?|entry doors?|sliding doors?|patio doors?|french doors?|frames?|trim|glass|grilles?|hardware|shutters?)\b/i,
  roofing:
    /\b(?:shingles?|metal roofing|roof tiles?|roof material|gutters?|fascia|soffit|skylights?)\b/i,
  siding:
    /\b(?:siding|trim|fascia|soffit|shutters?|accents?|stone veneer|brick veneer|paint|color)\b/i,
  fencing:
    /\b(?:fence lines?|fences?|gates?|posts?|panels?|privacy screens?|screening|lattice|paint|stain|color)\b/i,
};

export function isVisualScopePart(label: string, vertical?: string | null): boolean {
  const clean = String(label || "").trim();
  if (!clean || NON_VISUAL_SCOPE_PART.test(clean) || AWKWARD_OR_NON_DESIGN_SCOPE_PART.test(clean)) return false;
  const verticalFilter = vertical ? VISUAL_SCOPE_PART_BY_VERTICAL[vertical] : null;
  return verticalFilter ? verticalFilter.test(clean) : true;
}

const VERTICALS: Record<string, VerticalScopeRecipe> = {
  bathroom: {
    key: "bathroom",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Bathroom Remodel",
    parts: [
      "Shower / Tub",
      "Vanity",
      "Cabinets & Storage",
      "Countertop",
      "Toilet",
      "Floor Tile",
      "Wall Tile",
      "Faucets & Fixtures",
      "Lighting",
      "Mirror / Medicine Cabinet",
      "Paint & Trim",
      "Hardware",
    ],
  },
  kitchen: {
    key: "kitchen",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Kitchen Remodel",
    parts: ["Cabinets", "Countertops", "Island", "Backsplash", "Flooring", "Lighting"],
  },
  landscaping: {
    key: "landscaping",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Landscape Project",
    parts: [
      "Pavers & Walkways",
      "Patio",
      "Retaining Walls",
      "Planting",
      "Lawn / Turf",
      "Mulch / Gravel",
      "Outdoor Lighting",
      "Fire Pit",
      "Water Feature",
    ],
  },
  painting: {
    key: "painting",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Whole House",
    parts: ["Specific Rooms", "Walls", "Ceilings", "Trim & Doors", "Cabinets", "Exterior"],
  },
  pool: {
    key: "pool",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Complete Pool Remodel",
    parts: ["Interior Finish", "Deck & Coping", "Waterline Tile", "Lighting", "Water Features"],
  },
  flooring: {
    key: "flooring",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Whole Home",
    parts: ["Living Areas", "Kitchen", "Bedrooms", "Stairs"],
  },
  pergola: {
    key: "pergola",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Pergola Project",
    parts: ["Structure", "Ceiling Fan", "Lighting", "Shade"],
  },
  windows: {
    key: "windows",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Windows and Doors",
    parts: ["Windows", "Entry Doors", "Sliding Doors", "Trim"],
  },
  roofing: {
    key: "roofing",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Roof Replacement",
    parts: ["Shingles", "Metal Roofing", "Gutters", "Fascia & Soffit", "Skylights"],
  },
  siding: {
    key: "siding",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Siding Project",
    parts: ["Siding", "Trim", "Fascia", "Soffit"],
  },
  fencing: {
    key: "fencing",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Fence Project",
    parts: ["Fence Line", "Gates", "Posts", "Privacy Screening"],
  },
  default: {
    key: "default",
    question: QUESTION,
    subtitle: SUBTITLE,
    fullScope: "Full Project",
    parts: ["Main Area", "Finishes", "Fixtures"],
  },
};

function matchText(industry?: string | null, serviceLabel?: string | null, summary?: string | null): string {
  const primary = String(serviceLabel || "").trim().toLowerCase();
  if (primary) return primary;
  return `${industry || ""} ${summary || ""}`.trim().toLowerCase();
}

function classifyVertical(text: string): string {
  if (!text) return "default";
  if (/\b(paint|painter|painting)\b/.test(text)) return "painting";
  if (/\bwindows?\b|\b(entry|exterior|sliding|patio|french|garage)\s+doors?\b|\bdoor\s+(replacement|install)/.test(text)) {
    return "windows";
  }
  if (/\broof|\bshingle/.test(text)) return "roofing";
  if (/\bsiding\b/.test(text)) return "siding";
  if (/\bfenc(e|ing)\b/.test(text)) return "fencing";
  if (/\bbath|\bshower\b|\bvanity\b/.test(text)) return "bathroom";
  if (/\bkitchen\b/.test(text)) return "kitchen";
  if (/\bpergola\b|patio cover/.test(text)) return "pergola";
  if (/\b(floor|flooring)\b/.test(text)) return "flooring";
  if (/\b(landscape|landscaping|yard|patio|outdoor|garden|hardscape|hardscaping)\b/.test(text)) {
    return "landscaping";
  }
  if (/\b(pool|pools)\b|\bhot[\s-]?tub\b|\bswim[\s-]?spa\b/.test(text)) return "pool";
  if (/\bspa\b/.test(text)) return "pool";
  return "default";
}

const COMPATIBLE_VERTICALS: Record<string, string[]> = {
  bathroom: ["flooring", "painting"],
  kitchen: ["flooring", "painting"],
  flooring: ["bathroom", "kitchen"],
  landscaping: ["pergola"],
  pergola: ["landscaping"],
};

const DETAIL_SHOT =
  /\b(swatch|sample|palette|color chip|paint chip|hex code|\bral\b|material board|mood board|close[- ]?up|macro(?:scopic)?|texture (?:shot|detail|close)|detail (?:shot|view|of)|product (?:shot|photo)|flatlay|flat lay)\b/i;
const TILE_MACRO =
  /\b(patterned tile|encaustic|mosaic pattern|grout (?:line|color|joint)|tile (?:color|sample|swatch|pattern)|4\s*[x×]\s*4|6\s*[x×]\s*6|hex tile)\b/i;
const MATERIAL_SUBJECT = /\b(tiles?|grout|paint|porcelain|ceramic|mosaic|stone|quartz|granite)\b/i;
const ROOM_SCENE =
  /\b(bathroom|kitchen|shower|bathtub|tub|bath|room|remodel|interior|walk-?in|soaking|faucet|fixture|rain ?head)\b/i;
const OTHER_PART =
  /\b(vanity|toilet|flooring|tiles?|paint|lighting|cabinets?|countertops?|island|backsplash)\b/i;
const CATALOG_DETAIL_FOR = new Set(["subcategory_catalog", "refinement_option"]);
const SCOPE_ALIASES: Record<string, string[]> = {
  tub: ["tub", "bathtub", "soaking"],
  shower: ["shower", "walk-in", "walkin"],
  tile: ["tile", "tiles", "tiling"],
  vanity: ["vanity", "vanities", "sink"],
};

export function looksLikeFinishedRoom(text: string): boolean {
  return ROOM_SCENE.test(String(text || ""));
}

/** Tile macros, paint chips, and other product/detail shots — not a finished project look. */
export function looksLikeMaterialSwatch(text: string): boolean {
  const blob = String(text || "");
  if (DETAIL_SHOT.test(blob)) return true;
  if (looksLikeFinishedRoom(blob)) return false;
  return TILE_MACRO.test(blob) || MATERIAL_SUBJECT.test(blob);
}

function selectedScopeParts(scopes?: string[] | null): string[] {
  return (scopes || [])
    .map((s) => String(s || "").trim())
    .filter((s) => s && !isOtherPart(s) && !isOverallPart(s));
}

function wantsMaterialSwatch(parts: string[]): boolean {
  return parts.some((s) => /\b(tile|paint|color|stain|grout)\b/i.test(s));
}

function scopeTokens(label: string): string[] {
  const out: string[] = [];
  for (const bit of label.split(/[/&,]| and /i)) {
    const words = bit.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(/\s+/);
    for (const word of words) {
      if (word.length < 3) continue;
      out.push(word, ...(SCOPE_ALIASES[word] || []));
    }
  }
  return out;
}

function selectedScopeHit(imageText: string, parts: string[]): boolean {
  const blob = String(imageText || "").toLowerCase();
  return parts.some((part) =>
    scopeTokens(part).some((tok) => new RegExp(`\\b${tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(blob))
  );
}

/**
 * Keep finished, in-scope project looks. Drop tile/paint macros, catalog
 * option cards, and images that only show a part the customer did not pick.
 */
export function lookFitsSelectedScopes(opts: {
  imageText?: string | null;
  scopes?: string[] | null;
  generatedFor?: string | null;
}): boolean {
  const blob = String(opts.imageText || "");
  const parts = selectedScopeParts(opts.scopes);
  const wantsSwatch = wantsMaterialSwatch(parts);
  if (!wantsSwatch && looksLikeMaterialSwatch(blob)) return false;
  const generatedFor = String(opts.generatedFor || "").trim();
  if (CATALOG_DETAIL_FOR.has(generatedFor) && !wantsSwatch && !looksLikeFinishedRoom(blob)) {
    return false;
  }
  if (!parts.length) return true;
  if (selectedScopeHit(blob, parts)) return true;
  // A finished adjacent room/yard is still the wrong pricing example for a
  // focused choice. Library and generated rows both carry scope text, so an
  // explicit scope hit is required here.
  return false;
}

/** True when an image's labels clearly belong to a different trade than the selected service. */
export function lookConflictsWithService(opts: {
  imageText?: string | null;
  industry?: string | null;
  serviceLabel?: string | null;
  summary?: string | null;
}): boolean {
  const serviceVert = verticalKey(opts.industry, opts.serviceLabel, opts.summary);
  const imageVert = classifyVertical(String(opts.imageText || "").trim().toLowerCase());
  if (!imageVert || imageVert === "default" || !serviceVert || serviceVert === "default") return false;
  if (imageVert === serviceVert) return false;
  return !(COMPATIBLE_VERTICALS[serviceVert] || []).includes(imageVert);
}

export function verticalKey(industry?: string | null, serviceLabel?: string | null, summary?: string | null): string {
  return classifyVertical(matchText(industry, serviceLabel, summary));
}

export type ProjectMode = "spatial" | "component";

const SPATIAL_PART = /\b(shower|tub|bath|cabinet|island|room|patio|yard|landscape|pool|pergola|fence|roof|siding|window|door)\b/i;

/** Full-room jobs vs a focused element (vanity only, backsplash only, etc.). */
export function projectMode(scopes: string[], fullLabel?: string | null): ProjectMode {
  const labels = (scopes || []).map((s) => String(s || "").trim()).filter(Boolean);
  const pickedFull = labels.some(
    (s) => isOverallPart(s) || (fullLabel && s.toLowerCase() === String(fullLabel).trim().toLowerCase())
  );
  if (pickedFull) return "spatial";
  const parts = labels.filter((s) => !isOtherPart(s) && !isOverallPart(s));
  if (parts.length === 0) return "spatial";
  if (parts.length === 1) return SPATIAL_PART.test(parts[0]) ? "spatial" : "component";
  if (parts.some((part) => SPATIAL_PART.test(part))) return "spatial";
  return "component";
}

export function matchScopeRecipe(opts: {
  industry?: string | null;
  serviceLabel?: string | null;
  summary?: string | null;
}): VerticalScopeRecipe {
  const key = verticalKey(opts.industry, opts.serviceLabel, opts.summary);
  return VERTICALS[key] || VERTICALS.default;
}

function isOtherPart(label: string): boolean {
  return /^other$/i.test(label.trim());
}

function isOverallPart(label: string): boolean {
  return /^(full|whole|complete|entire|everything)\b/i.test(label.trim());
}

function slug(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "part";
}

export function storedScopeParts(opts: {
  knownParts?: Array<string | { label?: string; id?: string }> | null;
  componentLabels?: Array<string | { label?: string; key?: string }> | null;
  vertical?: string | null;
}): string[] {
  const fromKnown: string[] = [];
  for (const part of opts.knownParts || []) {
    const label = String(typeof part === "string" ? part : part?.label || part?.id || "").trim();
    if (label && !isOtherPart(label) && !isOverallPart(label) && isVisualScopePart(label, opts.vertical)) {
      fromKnown.push(label);
    }
  }
  if (fromKnown.length > 0) return Array.from(new Set(fromKnown));

  const fromComponents: string[] = [];
  for (const part of opts.componentLabels || []) {
    const label = String(typeof part === "string" ? part : part?.label || part?.key || "").trim();
    if (label && !isOtherPart(label) && !isOverallPart(label) && isVisualScopePart(label, opts.vertical)) {
      fromComponents.push(label);
    }
  }
  return Array.from(new Set(fromComponents));
}

export function scopeChoicesFromParts(fullScope: string, parts: string[], vertical?: string | null): ScopeChoice[] {
  const out: ScopeChoice[] = [{ id: "full", label: fullScope, role: "full" }];
  const seen = new Set([fullScope.toLowerCase(), "other", "everything"]);
  for (const part of parts) {
    const label = String(part || "").trim();
    if (!label || !isVisualScopePart(label, vertical) || seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    out.push({ id: slug(label), label, role: "part" });
  }
  out.push({ id: "other", label: OTHER_LABEL, role: "other" });
  return out;
}

export function buildScopeQuestion(opts: {
  industry?: string | null;
  serviceLabel?: string | null;
  summary?: string | null;
  knownParts?: Array<string | { label?: string; id?: string }> | null;
  componentLabels?: Array<string | { label?: string; key?: string }> | null;
}): { recipe: VerticalScopeRecipe; choices: ScopeChoice[]; source: "service" | "recipe" } {
  const recipe = matchScopeRecipe({
    industry: opts.industry,
    serviceLabel: opts.serviceLabel,
    summary: opts.summary,
  });
  const stored = storedScopeParts({
    knownParts: opts.knownParts,
    componentLabels: opts.componentLabels,
    vertical: recipe.key,
  });
  const parts = stored.length > 0 ? stored : recipe.parts;
  return {
    recipe,
    choices: scopeChoicesFromParts(recipe.fullScope, parts, recipe.key),
    source: stored.length > 0 ? "service" : "recipe",
  };
}
