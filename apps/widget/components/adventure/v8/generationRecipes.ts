/**
 * No-photo visual discovery: Explore → Narrow → Design.
 *
 * Scope is the hard constraint (WHAT we show).
 * Style is the variable — Groq writes a fresh set of visual directions per batch.
 * Fast models render the gallery (Schnell vs Imagen 4 Fast split).
 */

import { verticalKey } from "./scopeRecipes";

export const DISCOVERY_BATCH = 12;
export const STYLE_BOARD_COUNT = 28;

export const DISCOVERY_MODELS = {
  schnell: "black-forest-labs/flux-schnell",
  imagen: "google/imagen-4-fast",
  edit: "black-forest-labs/flux-2-pro",
  kontext: "black-forest-labs/flux-kontext-pro",
  draft: "black-forest-labs/flux-2-pro",
  banana: "google/nano-banana",
  fastEdit: "prunaai/p-image-edit",
} as const;

export type DiscoveryModelId = (typeof DISCOVERY_MODELS)[keyof typeof DISCOVERY_MODELS];

export type ColorMood = {
  id: string;
  label: string;
  colors: [string, string];
  prompt: string;
};

export type LookStyle = {
  id: string;
  label: string;
  prompt: string;
};

/** 5–6 color/mood presets for the refine rail. */
export const COLOR_MOODS: ColorMood[] = [
  { id: "navy", label: "Navy", colors: ["#1e3a5f", "#f3efe6"], prompt: "navy and cream palette, calm contrast, photoreal" },
  { id: "sage", label: "Sage", colors: ["#7d9a7a", "#f4efe6"], prompt: "sage green and warm white, soft and livable" },
  { id: "graphite", label: "Graphite", colors: ["#3d3f42", "#f2f2f0"], prompt: "charcoal and crisp white, graphic and clean" },
  { id: "sand", label: "Sand", colors: ["#cbb79a", "#f5efe4"], prompt: "warm sand and cream, quiet and sunlit" },
  { id: "blush", label: "Blush", colors: ["#d9a8b0", "#f7f1ea"], prompt: "soft blush and white, light and airy" },
  { id: "cream", label: "Cream", colors: ["#f3efe6", "#d8d0c4"], prompt: "warm cream and soft white, bright and simple" },
];

/** 4–5 visual styles for the refine rail. */
export const LOOK_STYLES: LookStyle[] = [
  { id: "modern", label: "Modern", prompt: "clean modern lines, flat panels, simple hardware, uncluttered" },
  { id: "transitional", label: "Transitional", prompt: "transitional mix of shaker and simple contemporary, balanced and livable" },
  { id: "traditional", label: "Traditional", prompt: "traditional residential, shaker doors, classic trim, warm and familiar" },
  { id: "coastal", label: "Coastal", prompt: "light coastal, airy, simple beach-house finishes" },
  { id: "organic", label: "Organic", prompt: "organic modern, natural textures, soft wood and stone-look, calm" },
];

export function buildMoodStylePrompt(opts: {
  room: string;
  serviceLabel: string;
  scopes: string[];
  budget: number;
  mood?: ColorMood | null;
  style?: LookStyle | null;
}): string {
  const parts = focalScopeParts(opts.scopes);
  const scopeText = parts.join(" and ") || "the selected work";
  return [
    `Restyle this generated ${opts.room} scene for a ${opts.serviceLabel.toLowerCase()} project.`,
    "Keep the exact camera, walls, door, and fixture layout. Do not generate a new room.",
    `${scopeText} must stay where they already are.`,
    opts.mood ? `Color / mood: ${opts.mood.label}. ${opts.mood.prompt}.` : "",
    opts.style ? `Style: ${opts.style.label}. ${opts.style.prompt}.` : "",
    budgetStyleDirective(opts.budget),
    "Photoreal, designed, and livable — not a hotel spa and not an ugly empty box.",
    "No text, logos, people, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export type VisualDirection = {
  label: string;
  prompt: string;
  family?: string;
  palette?: string;
  surfaces?: string;
  fixtures?: string;
  style?: string;
};

type DiversityLook = VisualDirection & { family: string };

const BATHROOM_LOOKS: DiversityLook[] = [
  { family: "navy", label: "navy subway", palette: "navy and cream", surfaces: "glossy navy 3x6 subway tile, light grout", fixtures: "chrome rain shower and wall-mount tub filler", style: "classic modern", prompt: "navy subway tile, cream walls, chrome rain head and tub filler, bright daylight" },
  { family: "sage", label: "sage zellige", palette: "sage green and warm white", surfaces: "handmade-look sage zellige wall tile, simple porcelain floor", fixtures: "brushed brass shower set and tub filler", style: "soft traditional", prompt: "sage zellige tile, warm white walls, brushed brass shower and tub, soft daylight" },
  { family: "graphite", label: "matte graphite", palette: "charcoal and crisp white", surfaces: "24x48 charcoal porcelain, white walls", fixtures: "matte black rain head plus handheld", style: "modern", prompt: "charcoal porcelain, crisp white walls, matte black rain head and handheld, graphic contrast" },
  { family: "terracotta", label: "terracotta bath", palette: "terracotta and sand", surfaces: "terracotta-look ceramic, sandy grout", fixtures: "oil-rubbed bronze tub filler and shower", style: "organic", prompt: "terracotta ceramic tile, sand grout, bronze shower and tub, warm afternoon light" },
  { family: "blush", label: "blush herringbone", palette: "blush pink and white", surfaces: "blush herringbone ceramic, white hex floor", fixtures: "polished nickel shower trim", style: "light contemporary", prompt: "blush herringbone tile, white hex floor, polished nickel shower and tub, bright light" },
  { family: "forest", label: "forest stack", palette: "forest green and cream", surfaces: "vertical stacked forest-green ceramic", fixtures: "matte black exposed-pipe shower", style: "bold modern", prompt: "vertical forest-green ceramic, cream walls, matte black exposed shower, strong color" },
  { family: "checker", label: "black white check", palette: "black and white", surfaces: "black-and-white checkerboard floor, white subway walls", fixtures: "chrome cross-handle vintage shower", style: "classic", prompt: "checkerboard floor, white subway walls, chrome vintage cross-handle shower and tub" },
  { family: "honey", label: "honey oak", palette: "honey oak and cream", surfaces: "cream 4x4 ceramic, honey oak accents", fixtures: "champagne-bronze shower set", style: "warm traditional", prompt: "cream 4x4 tile, honey oak accents, champagne bronze shower and tub, warm daylight" },
  { family: "sky", label: "sky penny tile", palette: "sky blue and white", surfaces: "sky-blue penny mosaic, white pebble-look floor", fixtures: "chrome handheld and tub spout", style: "coastal", prompt: "sky-blue penny mosaic, white pebble-look floor, chrome handheld shower and tub, beachy light" },
  { family: "ink", label: "ink and oak", palette: "deep ink blue and natural oak", surfaces: "deep blue large ceramic, natural oak trim", fixtures: "brushed nickel rain head", style: "organic modern", prompt: "deep ink-blue ceramic, natural oak trim, brushed nickel rain head, calm daylight" },
  { family: "sand", label: "warm sand", palette: "warm sand and clay", surfaces: "sand-colored ceramic, handmade grout lines", fixtures: "brushed gold-tone shower trim", style: "quiet craft", prompt: "warm sand ceramic, clay grout, brushed gold shower and tub, sunlit and textured" },
  { family: "slate", label: "slate hex", palette: "cool slate and white", surfaces: "slate-look hexagon porcelain", fixtures: "square chrome rain head", style: "spa-simple", prompt: "slate-look hexagon porcelain, white ceiling, square chrome rain head, clean and graphic" },
  { family: "emerald", label: "emerald arabesque", palette: "emerald and cream", surfaces: "emerald arabesque / lantern tile", fixtures: "unlacquered-brass look shower and tub", style: "jewel traditional", prompt: "emerald lantern tile, cream walls, brass shower and tub, rich but buildable" },
  { family: "cobalt", label: "cobalt mosaic", palette: "cobalt blue and white", surfaces: "cobalt mosaic niche, white stacked wall tile", fixtures: "chrome rain head and floor-mount tub filler", style: "graphic coastal", prompt: "cobalt mosaic with white stacked tile, chrome rain head and floor-mount tub filler" },
  { family: "cinnamon", label: "cinnamon plank", palette: "cinnamon and warm gray", surfaces: "wood-look porcelain planks, cinnamon accent wall", fixtures: "matte black rainfall and tub filler", style: "warm modern", prompt: "cinnamon wood-look porcelain, warm gray walls, matte black rain head and tub" },
  { family: "plum", label: "plum gloss", palette: "aubergine and pale stone", surfaces: "glossy plum ceramic, pale stone-look floor", fixtures: "brushed nickel vintage tub filler", style: "moody classic", prompt: "glossy plum ceramic, pale stone-look floor, brushed nickel vintage tub filler, evening-warm light" },
  { family: "mint", label: "mint subway", palette: "mint green and white", surfaces: "mint subway tile, white hex floor", fixtures: "chrome rain head and widespread faucet", style: "retro fresh", prompt: "mint subway tile, white hex floor, chrome rain head and tub, fresh daylight" },
  { family: "ochre", label: "ochre encaustic", palette: "mustard ochre and cream", surfaces: "ochre patterned encaustic-look ceramic", fixtures: "oil-rubbed bronze shower", style: "collected", prompt: "ochre encaustic-look floor, cream walls, bronze shower and tub, patterned and warm" },
  { family: "cream", label: "cream subway", palette: "warm white and cream", surfaces: "cream subway wall tile, simple white floor", fixtures: "chrome shower trim", style: "quiet builder", prompt: "cream subway tile, white floor, chrome shower and tub, bright clean daylight, designed but ordinary" },
  { family: "mist", label: "soft gray porcelain", palette: "light gray and white", surfaces: "24x24 light-gray porcelain, white walls", fixtures: "brushed nickel shower", style: "quiet modern", prompt: "light gray porcelain, white walls, brushed nickel shower and tub, even daylight, photoreal" },
  { family: "twotone", label: "navy two-tone", palette: "navy and white", surfaces: "navy painted vanity, white tile walls", fixtures: "chrome faucet", style: "classic builder", prompt: "navy vanity, white ceramic walls, chrome faucet and shower, clean residential bath" },
];

const KITCHEN_LOOKS: DiversityLook[] = [
  { family: "navy", label: "navy shaker", palette: "navy and cream", surfaces: "navy shaker cabinets, cream counters, subway backsplash", fixtures: "chrome faucet and knobs", style: "classic modern", prompt: "navy shaker cabinets, cream counters, chrome faucet, bright daylight" },
  { family: "sage", label: "sage kitchen", palette: "sage and oak", surfaces: "sage cabinets, oak shelves, cream tile", fixtures: "brass faucet and pulls", style: "soft traditional", prompt: "sage cabinets, warm oak, brass faucet, soft daylight" },
  { family: "graphite", label: "graphite flat", palette: "charcoal and white", surfaces: "flat charcoal cabinets, white counters", fixtures: "matte black faucet", style: "modern", prompt: "charcoal flat-panel cabinets, white counters, matte black faucet" },
  { family: "terracotta", label: "terracotta splash", palette: "terracotta and sand", surfaces: "terracotta tile backsplash, sand cabinets", fixtures: "bronze faucet", style: "organic", prompt: "terracotta backsplash, sand cabinets, bronze faucet, warm light" },
  { family: "forest", label: "forest cabinets", palette: "forest green and cream", surfaces: "forest-green cabinets, cream stone-look counters", fixtures: "black hardware", style: "bold modern", prompt: "forest-green cabinets, cream counters, black hardware, strong color" },
  { family: "checker", label: "check floor", palette: "black and white", surfaces: "black-and-white checkerboard floor, white cabinets", fixtures: "chrome bridge faucet", style: "classic", prompt: "checkerboard floor, white cabinets, chrome bridge faucet" },
  { family: "honey", label: "honey traditional", palette: "honey oak and cream", surfaces: "honey oak cabinets, cream tile", fixtures: "champagne bronze", style: "warm traditional", prompt: "honey oak cabinets, cream tile, champagne bronze faucet" },
  { family: "sky", label: "sky coastal", palette: "sky blue and white", surfaces: "sky-blue lower cabinets, white uppers", fixtures: "chrome gooseneck", style: "coastal", prompt: "sky-blue cabinets, white uppers, chrome gooseneck, coastal light" },
  { family: "ink", label: "ink oak", palette: "ink blue and oak", surfaces: "ink-blue island, natural oak perimeter", fixtures: "brushed nickel", style: "organic modern", prompt: "ink-blue island, natural oak cabinets, brushed nickel faucet" },
  { family: "sand", label: "sand craft", palette: "warm sand and clay", surfaces: "sand cabinets, clay tile backsplash", fixtures: "brushed gold-tone", style: "quiet craft", prompt: "sand cabinets, clay tile, brushed gold faucet, sunlit texture" },
  { family: "blush", label: "blush light", palette: "blush and white", surfaces: "blush tile backsplash, white cabinets", fixtures: "nickel hardware", style: "light contemporary", prompt: "blush backsplash, white cabinets, nickel faucet, bright light" },
  { family: "slate", label: "slate clean", palette: "cool slate and white", surfaces: "slate-look counters, white cabinets", fixtures: "square chrome", style: "spa-simple", prompt: "slate-look counters, white cabinets, square chrome faucet" },
];

const DEFAULT_LOOKS: DiversityLook[] = [
  { family: "navy", label: "navy contrast", palette: "navy and cream", surfaces: "navy surfaces with cream contrast", fixtures: "chrome hardware", style: "classic modern", prompt: "navy and cream palette, chrome hardware, bright daylight, clear contrast" },
  { family: "sage", label: "sage warm", palette: "sage and oak", surfaces: "sage finishes, warm wood", fixtures: "brass hardware", style: "soft traditional", prompt: "sage green and warm oak, brass hardware, soft daylight" },
  { family: "graphite", label: "graphite modern", palette: "charcoal and white", surfaces: "charcoal and white pairing", fixtures: "matte black hardware", style: "modern", prompt: "charcoal and white, matte black hardware, graphic and simple" },
  { family: "terracotta", label: "terracotta craft", palette: "terracotta and sand", surfaces: "terracotta-look ceramic", fixtures: "bronze hardware", style: "organic", prompt: "terracotta and sand, bronze hardware, warm light" },
  { family: "blush", label: "blush light", palette: "blush and white", surfaces: "blush tile or paint, white trim", fixtures: "nickel hardware", style: "light contemporary", prompt: "blush and white, nickel hardware, bright airy light" },
  { family: "forest", label: "forest bold", palette: "forest green and cream", surfaces: "deep green surfaces", fixtures: "black hardware", style: "bold modern", prompt: "forest green and cream, black hardware, strong color" },
  { family: "checker", label: "high contrast", palette: "black and white", surfaces: "high-contrast pattern", fixtures: "chrome hardware", style: "classic", prompt: "black and white contrast, chrome hardware, graphic pattern" },
  { family: "honey", label: "honey traditional", palette: "honey oak and cream", surfaces: "warm wood and cream", fixtures: "champagne bronze", style: "warm traditional", prompt: "honey oak and cream, champagne bronze, warm daylight" },
  { family: "sky", label: "sky coastal", palette: "sky blue and white", surfaces: "light blue and white", fixtures: "chrome hardware", style: "coastal", prompt: "sky blue and white, chrome, coastal daylight" },
  { family: "ink", label: "ink oak", palette: "ink blue and oak", surfaces: "deep blue with natural wood", fixtures: "brushed nickel", style: "organic modern", prompt: "ink blue and natural oak, brushed nickel, calm light" },
  { family: "sand", label: "sand texture", palette: "warm sand and clay", surfaces: "textured sand ceramic", fixtures: "brushed gold-tone", style: "quiet craft", prompt: "warm sand and clay, brushed gold, sunlit texture" },
  { family: "slate", label: "slate clean", palette: "cool slate and white", surfaces: "slate-look porcelain", fixtures: "square chrome", style: "spa-simple", prompt: "slate and white, square chrome, clean graphic look" },
  { family: "emerald", label: "emerald jewel", palette: "emerald and cream", surfaces: "emerald surfaces, cream contrast", fixtures: "brass hardware", style: "jewel traditional", prompt: "emerald and cream, brass hardware, rich but buildable" },
  { family: "cobalt", label: "cobalt graphic", palette: "cobalt and white", surfaces: "cobalt accent with white field", fixtures: "chrome hardware", style: "graphic coastal", prompt: "cobalt and white, chrome hardware, graphic contrast" },
  { family: "cinnamon", label: "cinnamon warm", palette: "cinnamon and warm gray", surfaces: "wood-look and cinnamon accent", fixtures: "matte black hardware", style: "warm modern", prompt: "cinnamon and warm gray, matte black hardware" },
  { family: "mint", label: "mint fresh", palette: "mint and white", surfaces: "mint tile or paint, white trim", fixtures: "chrome hardware", style: "retro fresh", prompt: "mint and white, chrome hardware, fresh daylight" },
  { family: "ochre", label: "ochre pattern", palette: "mustard ochre and cream", surfaces: "patterned ochre ceramic", fixtures: "bronze hardware", style: "collected", prompt: "ochre pattern, cream field, bronze hardware, warm" },
  { family: "plum", label: "plum mood", palette: "aubergine and pale stone", surfaces: "plum gloss, pale stone-look", fixtures: "brushed nickel", style: "moody classic", prompt: "aubergine and pale stone, brushed nickel, warm light" },
];

const LANDSCAPE_LOOKS: DiversityLook[] = [
  { family: "sage", label: "lush green", palette: "layered greens and cream stone", surfaces: "mixed planting beds, gravel path", fixtures: "simple path lights", style: "soft traditional", prompt: "layered green planting, gravel path, cream stone, simple outdoor lights, typical suburban yard" },
  { family: "sand", label: "dry garden", palette: "sand and clay", surfaces: "decomposed granite, drought planting", fixtures: "low bronze path lights", style: "quiet craft", prompt: "decomposed granite, drought-tolerant grasses, clay planters, dry suburban yard" },
  { family: "graphite", label: "modern hardscape", palette: "charcoal and white", surfaces: "charcoal pavers, white gravel", fixtures: "matte black bollard lights", style: "modern", prompt: "charcoal pavers, white gravel, clipped planting, matte black outdoor lights" },
  { family: "terracotta", label: "clay beds", palette: "terracotta and sand", surfaces: "terracotta planters, sandy mulch", fixtures: "bronze lanterns", style: "organic", prompt: "terracotta planters, sandy beds, bronze lanterns, warm late-day light" },
  { family: "honey", label: "warm timber", palette: "honey cedar and cream", surfaces: "cedar seating, cream stone", fixtures: "warm string lights", style: "warm traditional", prompt: "honey cedar seating, cream stone, warm string lights, planted edges" },
  { family: "navy", label: "evening court", palette: "navy planters and cream stone", surfaces: "cream pavers, navy ceramic pots", fixtures: "chrome path lights", style: "classic modern", prompt: "cream pavers, navy planters, chrome path lights, evening garden court" },
];

const PAINTING_LOOKS: DiversityLook[] = [
  { family: "sage", label: "sage walls", palette: "sage and warm white", surfaces: "sage painted walls, white trim", fixtures: "simple white switches", style: "soft traditional", prompt: "sage painted walls, warm white trim and ceiling, typical interior" },
  { family: "navy", label: "navy accent", palette: "navy and cream", surfaces: "navy accent wall, cream field", fixtures: "white trim", style: "classic modern", prompt: "navy accent wall, cream field walls, white trim, residential interior" },
  { family: "graphite", label: "charcoal contrast", palette: "charcoal and white", surfaces: "charcoal wall, white ceiling", fixtures: "white trim", style: "modern", prompt: "charcoal painted wall, white ceiling and trim, graphic interior" },
  { family: "sand", label: "warm sand", palette: "warm sand and cream", surfaces: "sand walls, cream trim", fixtures: "simple hardware", style: "quiet craft", prompt: "warm sand walls, cream trim, sunlit residential interior" },
  { family: "honey", label: "creamy oak", palette: "cream and honey oak", surfaces: "cream walls, oak trim", fixtures: "warm hardware", style: "warm traditional", prompt: "cream painted walls, honey oak trim, warm daylight interior" },
  { family: "blush", label: "soft blush", palette: "blush and white", surfaces: "blush walls, white trim", fixtures: "nickel hardware", style: "light contemporary", prompt: "blush painted walls, white trim, bright interior" },
];

const POOL_LOOKS: DiversityLook[] = [
  { family: "sky", label: "coastal blue", palette: "sky blue and white", surfaces: "light blue waterline, white deck", fixtures: "chrome water returns", style: "coastal", prompt: "light blue waterline tile, white pool deck, chrome fittings, residential backyard pool" },
  { family: "graphite", label: "dark water", palette: "charcoal and white", surfaces: "dark plaster, pale stone deck", fixtures: "matte black fittings", style: "modern", prompt: "dark plaster pool, pale stone deck, matte black fittings, residential backyard" },
  { family: "sand", label: "beach pebble", palette: "sand and cream", surfaces: "pebble-look finish, cream pavers", fixtures: "bronze fittings", style: "quiet craft", prompt: "sand pebble-look pool, cream pavers, bronze fittings, backyard" },
  { family: "terracotta", label: "clay deck", palette: "terracotta and aqua", surfaces: "terracotta pavers, aqua waterline", fixtures: "bronze scuppers", style: "organic", prompt: "terracotta deck, aqua waterline tile, bronze details, residential pool" },
  { family: "navy", label: "navy mosaic", palette: "navy and white", surfaces: "navy mosaic waterline, white plaster", fixtures: "chrome fittings", style: "classic modern", prompt: "navy mosaic waterline, white plaster, chrome fittings, backyard pool" },
  { family: "honey", label: "warm stone", palette: "honey stone and cream", surfaces: "honey travertine-look deck", fixtures: "champagne fittings", style: "warm traditional", prompt: "honey stone-look deck, cream coping, warm residential pool" },
];

const FLOORING_LOOKS: DiversityLook[] = [
  { family: "honey", label: "honey oak", palette: "honey oak and cream", surfaces: "honey oak-look planks", fixtures: "simple baseboard", style: "warm traditional", prompt: "honey oak-look floor planks, cream walls, typical residential room" },
  { family: "graphite", label: "charcoal plank", palette: "charcoal and white", surfaces: "charcoal wood-look planks", fixtures: "white baseboard", style: "modern", prompt: "charcoal wood-look flooring, white walls, residential interior" },
  { family: "sand", label: "light sand", palette: "warm sand and cream", surfaces: "sand-colored planks", fixtures: "cream baseboard", style: "quiet craft", prompt: "sand-colored floor planks, cream walls, bright residential room" },
  { family: "navy", label: "navy inlay", palette: "navy and oak", surfaces: "oak field with navy border", fixtures: "simple trim", style: "classic modern", prompt: "oak flooring with a navy border, cream walls, residential interior" },
  { family: "checker", label: "check tile", palette: "black and white", surfaces: "checkerboard floor tile", fixtures: "white base", style: "classic", prompt: "black-and-white checkerboard floor, white walls, residential interior" },
  { family: "terracotta", label: "clay tile", palette: "terracotta and cream", surfaces: "terracotta-look floor tile", fixtures: "cream base", style: "organic", prompt: "terracotta-look floor tile, cream walls, warm residential interior" },
];

const PERGOLA_LOOKS: DiversityLook[] = [
  { family: "honey", label: "honey cedar", palette: "honey cedar and cream", surfaces: "honey cedar beams, cream patio", fixtures: "warm fan and lights", style: "warm traditional", prompt: "honey cedar pergola, cream patio, warm fan and lights, residential backyard" },
  { family: "graphite", label: "black frame", palette: "charcoal and white", surfaces: "matte black posts, pale pavers", fixtures: "black fan", style: "modern", prompt: "matte black pergola, pale pavers, black fan, residential patio" },
  { family: "sand", label: "whitewash", palette: "sand and cream", surfaces: "whitewashed beams, sand pavers", fixtures: "cream fan", style: "quiet craft", prompt: "whitewashed pergola, sand pavers, cream fan, backyard" },
  { family: "sage", label: "garden shade", palette: "sage and cedar", surfaces: "cedar frame, sage cushions", fixtures: "simple string lights", style: "soft traditional", prompt: "cedar pergola, sage cushions, planting around, residential yard" },
  { family: "navy", label: "navy cushions", palette: "navy and oak", surfaces: "oak frame, navy shade cloth", fixtures: "chrome lights", style: "classic modern", prompt: "oak pergola, navy shade cloth, chrome lights, residential patio" },
  { family: "terracotta", label: "clay patio", palette: "terracotta and cedar", surfaces: "cedar frame, terracotta pavers", fixtures: "bronze lights", style: "organic", prompt: "cedar pergola, terracotta pavers, bronze lights, backyard" },
];

const LOOKS_BY_VERTICAL: Record<string, DiversityLook[]> = {
  bathroom: BATHROOM_LOOKS,
  kitchen: KITCHEN_LOOKS,
  landscaping: LANDSCAPE_LOOKS,
  painting: PAINTING_LOOKS,
  pool: POOL_LOOKS,
  flooring: FLOORING_LOOKS,
  pergola: PERGOLA_LOOKS,
  default: DEFAULT_LOOKS,
};

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function shuffleBySeed<T>(rows: T[], seed: string): T[] {
  const out = [...rows];
  let n = hashString(seed) || 1;
  for (let i = out.length - 1; i > 0; i -= 1) {
    n = Math.imul(n, 1664525) + 1013904223;
    const j = Math.abs(n) % (i + 1);
    const tmp = out[i];
    out[i] = out[j];
    out[j] = tmp;
  }
  return out;
}

/** One distinct palette family per image. Never a batch of all-white looks. */
export function pickDiverseLooks(opts: {
  count: number;
  seed: string;
  vertical?: string | null;
  excludeFamilies?: string[];
}): VisualDirection[] {
  const n = Math.max(0, Math.round(opts.count));
  const pool = LOOKS_BY_VERTICAL[String(opts.vertical || "default")] || DEFAULT_LOOKS;
  const excluded = new Set((opts.excludeFamilies || []).map((f) => String(f || "").toLowerCase()).filter(Boolean));
  const shuffled = shuffleBySeed(pool, opts.seed);
  const out: VisualDirection[] = [];
  const used = new Set<string>();
  for (const row of shuffled) {
    if (excluded.has(row.family) || used.has(row.family)) continue;
    used.add(row.family);
    out.push(row);
    if (out.length >= n) break;
  }
  if (out.length < n) {
    for (const row of shuffled) {
      if (used.has(row.family)) continue;
      used.add(row.family);
      out.push(row);
      if (out.length >= n) break;
    }
  }
  let i = 0;
  while (out.length < n && pool.length) {
    out.push(pool[i % pool.length]);
    i += 1;
  }
  return out.slice(0, n);
}

const ROOMS: Record<string, string> = {
  bathroom: "residential bathroom",
  kitchen: "residential kitchen",
  landscaping: "residential outdoor living space",
  painting: "interior of a home being painted",
  pool: "residential pool and deck",
  flooring: "interior with new flooring as the hero",
  pergola: "residential pergola and patio",
  windows: "residential windows and exterior doors on a home",
  roofing: "a residential roof",
  siding: "residential exterior siding",
  fencing: "a residential fence",
  default: "residential project",
};

/** Colorful HOW-it-looks seeds when Groq is unavailable. Not an all-white matrix. */
export const FALLBACK_DIRECTIONS: VisualDirection[] = DEFAULT_LOOKS;

function isFullScopePart(label: string): boolean {
  return /^(full |whole |complete )/i.test(String(label || "").trim());
}

export function discoveryRoom(opts: {
  industry?: string | null;
  serviceLabel?: string | null;
  summary?: string | null;
}): string {
  const key = verticalKey(opts.industry, opts.serviceLabel, opts.summary);
  if (key !== "default" && ROOMS[key]) return ROOMS[key];
  const label = String(opts.serviceLabel || "").trim();
  if (label) return `${label.toLowerCase()} work on a residential home`;
  return ROOMS.default;
}

export function focalScopeParts(scopes: string[]): string[] {
  return scopes.map((s) => String(s || "").trim()).filter((s) => s && !isFullScopePart(s) && !/^other$/i.test(s));
}

export function assignDiscoveryModel(sessionId: string, override?: string | null): DiscoveryModelId {
  const raw = String(override || "").trim().toLowerCase();
  if (raw.includes("imagen")) return DISCOVERY_MODELS.imagen;
  if (raw.includes("schnell") || raw.includes("flux")) return DISCOVERY_MODELS.schnell;
  let hash = 0;
  for (let i = 0; i < sessionId.length; i += 1) {
    hash = (hash * 31 + sessionId.charCodeAt(i)) >>> 0;
  }
  return hash % 2 === 0 ? DISCOVERY_MODELS.schnell : DISCOVERY_MODELS.imagen;
}

export function discoveryModelOverrideFromSearch(search = ""): string | null {
  const raw = search || (typeof window !== "undefined" ? window.location.search : "");
  try {
    return new URLSearchParams(raw.startsWith("?") || !raw ? raw : `?${raw}`).get("discoveryModel");
  } catch {
    return null;
  }
}

export type GalleryShot = {
  focus: "part" | "room";
  hero: string;
  heroes: string[];
};

/** Looks must land within this fraction of the customer's budget. */
export const BUDGET_WINDOW = 0.05;

/** Scope shrinks the slider vs a full job. First match wins per label. */
const SCOPE_BUDGET_MULT: Array<{ keys: string[]; mult: number }> = [
  { keys: ["full bathroom", "full kitchen", "full outdoor", "full yard", "master plan", "gut", "full renovation"], mult: 1 },
  { keys: ["full", "whole", "complete", "renovation"], mult: 1 },
  { keys: ["layout", "plumbing", "electrical", "addition", "expand"], mult: 0.85 },
  { keys: ["shower", "tub", "wet room", "bath surround"], mult: 0.42 },
  { keys: ["vanity", "toilet", "mirror", "medicine"], mult: 0.28 },
  { keys: ["grill", "outdoor kitchen", "pizza oven"], mult: 0.48 },
  { keys: ["fire pit", "fireplace", "pergola", "shade"], mult: 0.4 },
  { keys: ["seating", "furniture", "dining"], mult: 0.3 },
  { keys: ["cabinet", "fixture", "faucet", "sink", "hardware"], mult: 0.28 },
  { keys: ["tile & flooring", "tile and flooring", "floor tile", "wall tile"], mult: 0.32 },
  { keys: ["tile", "flooring", "floor"], mult: 0.32 },
  { keys: ["cosmetic", "paint", "trim", "refresh"], mult: 0.18 },
  { keys: ["lighting", "exhaust"], mult: 0.22 },
  { keys: ["patio", "terrace", "walkway", "path", "hardscape", "retaining"], mult: 0.45 },
  { keys: ["planting", "lawn", "garden", "tree", "shrub", "privacy", "irrigation", "drainage"], mult: 0.25 },
  { keys: ["driveway", "fence", "gate"], mult: 0.48 },
  { keys: ["water feature"], mult: 0.35 },
  { keys: ["island", "counter", "backsplash", "appliance", "pantry"], mult: 0.55 },
  { keys: ["kitchen"], mult: 0.7 },
  { keys: ["other"], mult: 0.55 },
];

function serviceBudgetEnvelope(text: string): { low: number; typicalHigh: number; premiumHigh: number; luxuryHigh: number; floor: number } {
  const blob = String(text || "").toLowerCase();
  if (/bath|shower|tub|vanity|powder/.test(blob)) return { low: 5000, typicalHigh: 35000, premiumHigh: 70000, luxuryHigh: 150000, floor: 500 };
  if (/kitchen|cabinet|countertop|pantry/.test(blob)) return { low: 10000, typicalHigh: 60000, premiumHigh: 120000, luxuryHigh: 250000, floor: 1000 };
  if (/landscap|outdoor|garden|patio|yard|lawn/.test(blob)) return { low: 5000, typicalHigh: 45000, premiumHigh: 90000, luxuryHigh: 175000, floor: 500 };
  if (/\bpool\b|\bspa\b/.test(blob)) return { low: 15000, typicalHigh: 75000, premiumHigh: 140000, luxuryHigh: 200000, floor: 5000 };
  if (/\bpergola\b|\bdeck\b/.test(blob)) return { low: 5000, typicalHigh: 25000, premiumHigh: 40000, luxuryHigh: 60000, floor: 500 };
  if (/\broof|\bshingle/.test(blob)) return { low: 5000, typicalHigh: 18000, premiumHigh: 30000, luxuryHigh: 50000, floor: 1500 };
  if (/\bhvac\b|air condition|furnace/.test(blob)) return { low: 3000, typicalHigh: 10000, premiumHigh: 16000, luxuryHigh: 25000, floor: 500 };
  if (/\bfloor|\bflooring\b|hardwood|\blvp\b/.test(blob)) return { low: 2000, typicalHigh: 15000, premiumHigh: 30000, luxuryHigh: 50000, floor: 500 };
  if (/\bpaint|\bpainting\b/.test(blob)) return { low: 1000, typicalHigh: 7000, premiumHigh: 14000, luxuryHigh: 25000, floor: 250 };
  if (/\bwindows?\b|\bsiding\b/.test(blob)) return { low: 4000, typicalHigh: 25000, premiumHigh: 45000, luxuryHigh: 85000, floor: 1000 };
  return { low: 2000, typicalHigh: 30000, premiumHigh: 60000, luxuryHigh: 100000, floor: 500 };
}

function serviceBandRungs(text: string): number[] {
  const blob = String(text || "").toLowerCase();
  if (/bath|shower|tub|vanity|powder/.test(blob)) return [500, 1500, 3000, 5000, 10000, 18000, 28000, 45000, 70000, 110000, 150000];
  if (/kitchen|cabinet|countertop|pantry/.test(blob)) return [1000, 3000, 6000, 10000, 18000, 25000, 40000, 60000, 90000, 120000, 250000];
  if (/landscap|outdoor|garden|patio|yard|lawn/.test(blob)) return [500, 5000, 12000, 20000, 35000, 55000, 90000, 175000];
  if (/\bpool\b|\bspa\b/.test(blob)) return [5000, 15000, 30000, 50000, 75000, 110000, 150000, 200000];
  if (/\bpergola\b|\bdeck\b/.test(blob)) return [500, 4000, 8000, 15000, 25000, 40000, 60000];
  if (/\broof|\bshingle/.test(blob)) return [1500, 6000, 10000, 16000, 25000, 40000, 50000];
  if (/\bhvac\b|air condition|furnace/.test(blob)) return [500, 3000, 6000, 10000, 16000, 25000];
  if (/\bfloor|\bflooring\b|hardwood|\blvp\b/.test(blob)) return [500, 3000, 7000, 12000, 20000, 35000, 50000];
  if (/\bpaint|\bpainting\b/.test(blob)) return [250, 750, 1500, 3000, 5000, 9000, 15000, 25000];
  if (/\bwindows?\b|\bsiding\b/.test(blob)) return [1000, 5000, 10000, 20000, 35000, 55000, 85000];
  return [500, 5000, 12000, 25000, 45000, 80000, 120000];
}

export function scopeBudgetMultiplier(scopes: string[]): number {
  const texts = scopes.map((s) => String(s || "").trim().toLowerCase()).filter((t) => t && t !== "other" && !t.includes("multiple / other"));
  if (!texts.length) return 1;
  if (texts.some((t) => ["full bathroom", "full kitchen", "full outdoor", "full yard", "master plan"].some((k) => t.includes(k)))) {
    return 1;
  }
  if (texts.some((t) => t.startsWith("full ") || t.startsWith("whole ") || t.includes("complete"))) return 1;
  const scores = texts.map((t) => {
    const hit = SCOPE_BUDGET_MULT.find((row) => row.keys.some((k) => t.includes(k)));
    return hit?.mult ?? 0.55;
  });
  const primary = Math.max(...scores);
  const extras = [...scores].sort((a, b) => b - a).slice(1);
  const combined = primary + 0.35 * extras.reduce((sum, n) => sum + n, 0);
  return Math.max(0.15, Math.min(primary < 0.95 ? 0.95 : 1.05, combined));
}

export function proposeClientBudgetBounds(opts: {
  serviceLabel?: string | null;
  industry?: string | null;
  serviceSummary?: string | null;
  scopes?: string[];
  serviceLow?: number;
  serviceHigh?: number;
}): { min: number; max: number; closedMax: number; plusHigh: number; step: number; defaultAmount: number; scopeMultiplier: number } {
  const envelope = serviceBudgetEnvelope(`${opts.industry || ""} ${opts.serviceLabel || ""} ${opts.serviceSummary || ""}`);
  const serviceLow = opts.serviceLow && opts.serviceLow > 0 ? opts.serviceLow : envelope.low;
  const serviceHigh = opts.serviceHigh && opts.serviceHigh > serviceLow ? opts.serviceHigh : envelope.premiumHigh;
  const span = Math.max(1000, serviceHigh - serviceLow);
  const typicalHigh = opts.serviceHigh ? Math.round(serviceLow + span * 0.35) : envelope.typicalHigh;
  const premiumHigh = opts.serviceHigh ? serviceHigh : envelope.premiumHigh;
  const luxuryHigh = opts.serviceHigh ? Math.round(serviceHigh * 1.35) : envelope.luxuryHigh;
  const floor = envelope.floor;
  const mult = scopeBudgetMultiplier(opts.scopes || []);
  const roundTo = (n: number, size: number) => Math.round(n / size) * size;
  let min: number;
  let max: number;
  let plusHigh: number;
  if (mult >= 0.95) {
    min = floor;
    max = Math.max(min + 4000, roundTo(premiumHigh, 1000));
    plusHigh = Math.max(max, roundTo(luxuryHigh, 1000));
  } else {
    const scaled = serviceLow * Math.max(mult, 0.15);
    min = scaled <= 8000 ? floor : Math.max(floor, roundTo(scaled, 500));
    max = Math.max(min + 2500, roundTo(typicalHigh * mult * 1.35, 1000));
    plusHigh = Math.max(max, roundTo(max * 1.5, 1000));
  }
  const step = max <= 20000 ? 500 : max <= 60000 ? 1000 : 2500;
  const defaultAmount = roundTo((min + max) / 2, step);
  return {
    min,
    max: plusHigh,
    closedMax: max,
    plusHigh,
    step,
    defaultAmount: Math.min(plusHigh, Math.max(min, defaultAmount)),
    scopeMultiplier: Number(mult.toFixed(3)),
  };
}

export const FINISH_TIER_IDS = ["starter", "value", "mid", "upper", "plus", "premium", "luxury", "estate"] as const;
export type FinishTierId = (typeof FINISH_TIER_IDS)[number];
export type CatalogFinishTierId = "value" | "mid" | "premium" | "luxury";

export type FinishTier = {
  id: FinishTierId;
  label: string;
  min: number;
  max: number;
  openEnded?: boolean;
  catalogTier?: CatalogFinishTierId;
};

const FINISH_LABELS: Record<FinishTierId, string> = {
  starter: "Starter",
  value: "Value",
  mid: "Mid",
  upper: "Upper",
  plus: "Plus",
  premium: "Premium",
  luxury: "Luxury",
  estate: "Estate",
};

const CATALOG_TIER: Record<string, CatalogFinishTierId> = {
  starter: "value",
  value: "value",
  mid: "mid",
  upper: "mid",
  plus: "premium",
  premium: "premium",
  luxury: "luxury",
  estate: "luxury",
};

const IDS_FOR_COUNT: Record<number, FinishTierId[]> = {
  1: ["value"],
  2: ["value", "premium"],
  3: ["value", "mid", "premium"],
  4: ["value", "mid", "premium", "luxury"],
  5: ["starter", "value", "mid", "premium", "luxury"],
  6: ["starter", "value", "mid", "upper", "premium", "luxury"],
  7: ["starter", "value", "mid", "upper", "premium", "luxury", "estate"],
  8: ["starter", "value", "mid", "upper", "plus", "premium", "luxury", "estate"],
};

function idsForCount(n: number): FinishTierId[] {
  if (n <= 0) return ["value"];
  return IDS_FOR_COUNT[n] || FINISH_TIER_IDS.slice(0, Math.min(n, FINISH_TIER_IDS.length));
}

function fillCuts(cuts: number[], minWidth: number, roundTo: number, target = 5, cap = 8): number[] {
  const round = (n: number) => Math.round(n / roundTo) * roundTo;
  while (cuts.length - 1 < target) {
    let bestI = -1;
    let bestSpan = 0;
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const span = cuts[i + 1] - cuts[i];
      if (span > bestSpan && span >= minWidth * 2) {
        bestSpan = span;
        bestI = i;
      }
    }
    if (bestI < 0) break;
    let mid = round((cuts[bestI] + cuts[bestI + 1]) / 2);
    if (mid <= cuts[bestI] || mid >= cuts[bestI + 1]) mid = cuts[bestI] + minWidth;
    if (mid - cuts[bestI] < minWidth || cuts[bestI + 1] - mid < minWidth) break;
    cuts.splice(bestI + 1, 0, mid);
  }
  while (cuts.length - 1 > cap) {
    let bestI = -1;
    let bestSpan = Number.POSITIVE_INFINITY;
    for (let i = 0; i < cuts.length - 1; i += 1) {
      const span = cuts[i + 1] - cuts[i];
      if (span < bestSpan) {
        bestSpan = span;
        bestI = i;
      }
    }
    if (bestI < 0 || bestI + 1 >= cuts.length - 1) break;
    cuts.splice(bestI + 1, 1);
  }
  return cuts;
}

export function formatChipBand(tier: { min: number; max: number; openEnded?: boolean }): string {
  const compact = (n: number) => {
    const abs = Math.max(0, Math.round(Number(n) || 0));
    if (abs >= 1000) {
      const k = abs / 1000;
      const text = Number.isInteger(k) ? String(k) : k.toFixed(1).replace(/\.0$/, "");
      return `$${text}k`;
    }
    return `$${abs.toLocaleString("en-US")}`;
  };
  if (tier.openEnded) return `${compact(tier.min)}+`;
  return `${compact(tier.min)} – ${compact(tier.max)}`;
}

export function withOpenEndedTop<T extends { openEnded?: boolean }>(tiers: T[]): T[] {
  if (!tiers.length) return tiers;
  return tiers.map((tier, i) => ({ ...tier, openEnded: i === tiers.length - 1 }));
}

export function primaryScopeKey(label: string): string {
  return (
    String(label || "")
      .trim()
      .toLowerCase()
      .replace(/&/g, " and ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 100) || "scope"
  );
}

export function splitFinishTiers(
  min: number,
  max: number,
  opts?: { serviceLabel?: string | null; industry?: string | null; serviceSummary?: string | null; plusHigh?: number }
): FinishTier[] {
  const low = Math.max(250, Math.round(Number(min) || 0));
  const high = Math.max(low + 1500, Math.round(Number(max) || 0));
  const plusHigh = Math.max(high, Math.round(Number(opts?.plusHigh || high)));
  const roundTo = high <= 10000 ? 250 : high <= 150000 ? 1000 : 5000;
  const minWidth = high <= 10000 ? 250 : high <= 40000 ? 1000 : 2500;
  const round = (n: number) => Math.round(n / roundTo) * roundTo;
  const rungs = serviceBandRungs(`${opts?.industry || ""} ${opts?.serviceLabel || ""} ${opts?.serviceSummary || ""}`);
  const cuts = [low];
  for (const rung of rungs) {
    const cut = round(rung);
    if (cut - cuts[cuts.length - 1] < minWidth) continue;
    if (high - cut < minWidth) continue;
    if (cut > low && cut < high) cuts.push(cut);
  }
  cuts.push(high);
  fillCuts(cuts, minWidth, roundTo, 5, 8);
  const ids = idsForCount(cuts.length - 1);
  return ids.map((id, i) => {
    const lo = cuts[i];
    const openEnded = i === ids.length - 1;
    const hi = openEnded ? Math.max(plusHigh, cuts[i + 1]) : Math.max(lo + minWidth, cuts[i + 1]);
    return {
      id,
      label: openEnded ? `${lo}+` : FINISH_LABELS[id],
      min: lo,
      max: hi,
      openEnded,
      catalogTier: CATALOG_TIER[id] || "mid",
    };
  });
}

export function finishTiersForScope(opts: {
  serviceLabel?: string | null;
  industry?: string | null;
  serviceSummary?: string | null;
  scopes?: string[];
  serviceLow?: number;
  serviceHigh?: number;
}): FinishTier[] {
  const bounds = proposeClientBudgetBounds(opts);
  return splitFinishTiers(bounds.min, bounds.closedMax, { ...opts, plusHigh: bounds.plusHigh });
}

export function adjacentFinishTiers(selected: string | null | undefined, tiers: FinishTier[]): CatalogFinishTierId[] {
  const ids = tiers.map((t) => t.id);
  const key = String(selected || "").trim() as FinishTierId;
  const catalogOf = (tier: FinishTier) =>
    (tier.catalogTier || CATALOG_TIER[tier.id] || "mid") as CatalogFinishTierId;
  if (!ids.includes(key)) {
    const unique = Array.from(new Set(tiers.map(catalogOf)));
    return unique.slice(0, Math.min(2, unique.length));
  }
  const idx = ids.indexOf(key);
  const keep = new Set<FinishTierId>([ids[idx]]);
  if (idx > 0) keep.add(ids[idx - 1]);
  if (idx < ids.length - 1) keep.add(ids[idx + 1]);
  const out: CatalogFinishTierId[] = [];
  const seen = new Set<string>();
  for (const tier of tiers) {
    if (!keep.has(tier.id)) continue;
    const tag = catalogOf(tier);
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

export function normalizeFinishTier(raw: string | null | undefined): FinishTierId | null {
  const text = String(raw || "").trim().toLowerCase();
  if (!text) return null;
  if ((FINISH_TIER_IDS as readonly string[]).includes(text)) return text as FinishTierId;
  if (/^(value|economy|budget|afford|\$)$/.test(text) || text === "$") return "value";
  if (/^(starter|entry)$/.test(text)) return "starter";
  if (/^(mid|middle|standard|mid_range|mid-range|\$\$)$/.test(text) || text === "$$") return "mid";
  if (/^(upper|upper-mid|upper_mid)$/.test(text)) return "upper";
  if (/^(plus)$/.test(text)) return "plus";
  if (/^(premium|high|\$\$\$)$/.test(text) || text === "$$$") return "premium";
  if (/^(luxury|lux|bespoke|custom|\$\$\$\$)$/.test(text) || text === "$$$$") return "luxury";
  if (/^(estate|ultra)$/.test(text)) return "estate";
  if (/afford|value|economy/.test(text)) return "value";
  if (/starter/.test(text)) return "starter";
  if (/premium|high/.test(text)) return "premium";
  if (/lux|bespoke/.test(text)) return "luxury";
  if (/mid|standard/.test(text)) return "mid";
  const dollars = text.replace(/[^$]/g, "").length;
  if (dollars === 1) return "value";
  if (dollars === 2) return "mid";
  if (dollars === 3) return "premium";
  if (dollars >= 4) return "luxury";
  return null;
}

export function priceForFinishTier(tier: FinishTier | null | undefined): { min: number; max: number; source: "scope_tier" } {
  if (!tier) return { min: 0, max: 0, source: "scope_tier" };
  return { min: tier.min, max: tier.max, source: "scope_tier" };
}

export function budgetTierLabel(budget: number): string {
  if (budget < 15000) return "$";
  if (budget < 40000) return "$$";
  if (budget < 90000) return "$$$";
  return "$$$$";
}

export function tierRank(priceTier: string | null | undefined, budget: number): number {
  const tier = String(priceTier || "").trim();
  const rank = (t: string) => t.replace(/[^$]/g, "").length || 2;
  if (!tier) return rank(budgetTierLabel(budget));
  if (/\$/.test(tier)) return rank(tier);
  if (/afford|value|starter|economy/i.test(tier)) return 1;
  if (/premium|lux|bespoke|step up/i.test(tier)) return 3;
  return 2;
}

/** True when a look's price is above the customer's budget band. */
export function tooExpensiveForBudget(priceTier: string | null | undefined, budget: number): boolean {
  if (!String(priceTier || "").trim() || budget <= 0) return false;
  return tierRank(priceTier, budget) > tierRank(budgetTierLabel(budget), budget);
}

/** Pin estimate stays inside budget ±5% so the gallery can show a test price. */
export function pinEstimate(budget: number, seed: string): { min: number; max: number; source: "local" } {
  const b = Math.max(0, Math.round(Number(budget) || 0));
  if (!b) return { min: 0, max: 0, source: "local" };
  const tilt = ((hashString(seed) % 7) - 3) / 100;
  const mid = b * (1 + tilt);
  const half = b * 0.04;
  const roundTo = b < 10_000 ? 50 : b < 40_000 ? 100 : 250;
  const round = (n: number) => Math.round(n / roundTo) * roundTo;
  const lo = round(b * (1 - BUDGET_WINDOW));
  const hi = round(b * (1 + BUDGET_WINDOW));
  let min = Math.max(lo, round(mid - half));
  let max = Math.min(hi, round(mid + half));
  if (min > b) min = lo;
  if (max < b) max = Math.min(hi, b + roundTo);
  if (max <= min) max = Math.min(hi, min + roundTo);
  return { min, max, source: "local" };
}

export function withinBudgetWindow(opts: {
  budget: number;
  mid?: number | null;
  priceTier?: string | null;
}): boolean {
  const budget = Number(opts.budget || 0);
  if (!(budget > 0)) return true;
  const mid = Number(opts.mid || 0);
  if (mid > 0) return Math.abs(mid - budget) / budget <= BUDGET_WINDOW;
  if (!String(opts.priceTier || "").trim()) return true;
  return !tooExpensiveForBudget(opts.priceTier, budget);
}

function cleanPhrase(text: string): string {
  return String(text || "")
    .replace(/\s*,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .replace(/^,\s*|,\s*$/g, "")
    .trim();
}

function omitUnselectedFixtures(text: string, parts: string[]): string {
  const blob = parts.join(" ").toLowerCase();
  let out = String(text || "");
  if (!/\bshower\b/.test(blob)) {
    out = out.replace(
      /\b(chrome |matte black |brushed [\w-]+ |polished [\w-]+ |oil-rubbed bronze )?(rain ?head|rain shower|handheld|exposed[- ]pipe(?: shower)?|shower set|shower trim|shower and tub|walk-?in shower|shower)\b/gi,
      ""
    );
  }
  if (!/\btub\b/.test(blob)) {
    out = out.replace(/\b(and )?(wall-mount |floor-mount )?(tub filler|tub spout|soaking tub|bathtub|\btub\b)\b/gi, "");
  }
  return cleanPhrase(out);
}

/** Rewrite a diversity pack so unselected parts (e.g. shower) are not the subject. */
export function adaptLookToScopes(look: VisualDirection, scopes: string[]): VisualDirection {
  const parts = focalScopeParts(scopes);
  if (!parts.length) return look;
  const feature = `featuring ${parts.join(" and ")} as the main subjects`;
  const prompt = omitUnselectedFixtures(look.prompt, parts);
  const fixtures = omitUnselectedFixtures(look.fixtures || "", parts);
  const already = parts.some((part) => prompt.toLowerCase().includes(part.toLowerCase()));
  return {
    ...look,
    prompt: already ? prompt : cleanPhrase(`${prompt}, ${feature}`),
    fixtures: fixtures || undefined,
  };
}

/** Library photos used as layout/camera references so generation does not invent a floor plan. */
export function pickLayoutRefs(urls: Array<string | null | undefined>, limit = 2): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of urls) {
    const url = String(raw || "").trim();
    if (!/^https?:\/\//i.test(url) || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= limit) break;
  }
  return out;
}

export function directionsForBudget(budget: number, rows: VisualDirection[]): VisualDirection[] {
  if (!(budget > 0)) return rows;
  const rank = tierRank(budgetTierLabel(budget), budget);
  const blobOf = (row: VisualDirection) =>
    `${row.label} ${row.prompt} ${row.surfaces || ""} ${row.fixtures || ""} ${row.style || ""}`;
  const luxury = /zellige|calacatta|marble|onyx|unlacquered|arabesque|lantern tile|floor-mount|gold leaf|spa-resort|high-end spa|evening glow/i;
  const spa = /rain head plus handheld|floor-mount tub filler|unlacquered-brass/i;
  const kept = rows.filter((row) => {
    const blob = blobOf(row);
    if (rank <= 1 && (luxury.test(blob) || spa.test(blob))) return false;
    if (rank <= 2 && /calacatta|onyx|gold leaf|spa-resort/i.test(blob)) return false;
    return true;
  });
  return kept.length >= 8 ? kept : rows;
}

export function budgetStyleDirective(budget: number, vertical?: string | null): string {
  const amount = Math.max(0, Math.round(budget || 0));
  const money = amount ? `about $${amount.toLocaleString()}` : "this budget";
  const rank = amount ? tierRank(budgetTierLabel(amount), amount) : 2;
  const key = String(vertical || "").toLowerCase();
  if (rank <= 1) {
    const bath =
      key === "bathroom"
        ? " Ceramic tile not stone, a normal painted or white shaker vanity, chrome or nickel. No marble, no zellige, no spa rain system."
        : "";
    return `Finish quality must match a ${money} job: builder-grade, photoreal, and nicely designed.${bath} No luxury stone, no gold, no hotel look.`;
  }
  if (rank === 2) {
    return `Finish quality must match a ${money} job: mid-range, photoreal, and designed. Quality materials for a typical house, not a resort.`;
  }
  if (rank === 3) {
    return `Finish quality must match a ${money} job: nicer tile and surfaces, mixed metals ok. Still a real house, not a hotel.`;
  }
  return `Finish quality must match a ${money} job: premium residential finishes — not a resort spa.`;
}

const METAL_KITS: Array<{ id: string; label: string; prompt: string; minRank: number }> = [
  { id: "chrome", label: "chrome", prompt: "polished chrome fixtures", minRank: 1 },
  { id: "nickel", label: "nickel", prompt: "brushed nickel fixtures", minRank: 1 },
  { id: "black", label: "matte black", prompt: "matte black fixtures", minRank: 2 },
  { id: "brass", label: "brass", prompt: "brushed brass fixtures", minRank: 2 },
];

function metalsForBudget(budget: number): typeof METAL_KITS {
  const rank = budget > 0 ? tierRank(budgetTierLabel(budget), budget) : 2;
  return METAL_KITS.filter((row) => row.minRank <= rank);
}

export function isPaleDirection(row: VisualDirection): boolean {
  const blob = `${row.label} ${row.prompt} ${row.palette || ""} ${row.surfaces || ""}`.toLowerCase();
  const hasColor =
    /\b(navy|sage|green|blue|terracotta|blush|pink|forest|charcoal|graphite|ink|sand|slate|black|emerald|cobalt|cinnamon|plum|aubergine|mint|ochre|mustard|honey oak|bronze|brass)\b/.test(
      blob
    );
  if (hasColor) return false;
  return /\b(all[- ]white|bright and airy|pale surfaces|airy whites|restrained details|cream tones|quiet surfaces|builder beige|builder white)\b/.test(
    blob
  );
}

export function planGalleryShots(count: number, scopes: string[]): GalleryShot[] {
  const n = Math.max(0, Math.round(count));
  const parts = focalScopeParts(scopes);
  const cameraParts = parts.filter((part) => !/\b(paint|color|stain|grout)\b/i.test(part));
  const useParts = cameraParts.length ? cameraParts : parts;
  if (!n) return [];
  if (!useParts.length) {
    return Array.from({ length: n }, () => ({ focus: "room" as const, hero: "", heroes: parts }));
  }
  const comboCount = parts.length >= 2 ? Math.max(Math.ceil(n * 0.6), n - useParts.length) : Math.max(1, Math.round(n * 0.25));
  const shots: GalleryShot[] = [];
  for (let i = 0; i < n; i += 1) {
    const roomFirst = parts.length >= 2 ? i < comboCount : i >= n - comboCount;
    shots.push({
      focus: roomFirst ? "room" : "part",
      hero: useParts[i % useParts.length],
      heroes: parts,
    });
  }
  return shots;
}

/** Two stored looks, then one new look, repeating. First page only — never reorder already-shown pins. */
export function interleaveLooks<T>(library: T[], generated: T[]): T[] {
  if (!generated.length) return [...library];
  if (!library.length) return [...generated];
  const out: T[] = [];
  let li = 0;
  let gi = 0;
  while (li < library.length || gi < generated.length) {
    if (li < library.length) out.push(library[li++]);
    if (li < library.length) out.push(library[li++]);
    if (gi < generated.length) out.push(generated[gi++]);
  }
  return out;
}

const PIN_ASPECTS = ["4/5", "3/4", "5/6", "2/3", "4/5", "1/1"] as const;

/** Stable per-id Pinterest height. Does not change when the board grows. */
export function pinAspectRatio(id: string): string {
  const raw = String(id || "pin");
  let hash = 2166136261;
  for (let i = 0; i < raw.length; i += 1) {
    hash ^= raw.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return PIN_ASPECTS[(hash >>> 0) % PIN_ASPECTS.length];
}

export function pinAspectHeight(ratio: string): number {
  const [w, h] = String(ratio || "4/5").split("/").map(Number);
  if (!w || !h) return 1.25;
  return h / w;
}

/** Pack pins into columns. Prefix assignment stays put when items are appended. */
export function splitMasonryColumns<T>(
  items: T[],
  columnCount: number,
  aspectOf: (item: T) => string
): T[][] {
  const n = Math.max(1, Math.round(columnCount) || 1);
  const cols: T[][] = Array.from({ length: n }, () => []);
  const heights = Array.from({ length: n }, () => 0);
  for (const item of items) {
    let idx = 0;
    for (let i = 1; i < n; i += 1) {
      if (heights[i] < heights[idx]) idx = i;
    }
    cols[idx].push(item);
    heights[idx] += pinAspectHeight(aspectOf(item));
  }
  return cols;
}

/**
 * How many tiles of a page come from stored catalog vs new generation.
 * ~2/3 library when we have stock (e.g. 8 stored + 4 new). Skip generation
 * entirely once this scope + price combo has a deep well of saved looks.
 */
export function retrievalMix(opts: { requested: number; libraryAvailable: number }): {
  library: number;
  generate: number;
} {
  const requested = Math.max(0, Math.round(opts.requested));
  const available = Math.max(0, Math.round(opts.libraryAvailable));
  if (!requested) return { library: 0, generate: 0 };
  if (available <= 0) return { library: 0, generate: requested };
  if (available >= requested * 2) return { library: requested, generate: 0 };
  const library = Math.min(available, Math.max(0, Math.floor((requested * 2) / 3)));
  return { library, generate: requested - library };
}

export function catalogTags(opts: {
  serviceLabel?: string | null;
  scopes?: string[];
  scope?: string | null;
  priceTier?: string | null;
  budget?: number | null;
  direction?: VisualDirection | null;
}): string[] {
  const budget = Math.round(Number(opts.budget || 0));
  const raw = [
    opts.serviceLabel,
    opts.scope,
    ...(opts.scopes || []),
    opts.priceTier,
    budget > 0 ? `$${budget}` : "",
    budget > 0 ? budgetTierLabel(budget) : "",
    opts.direction?.family,
    opts.direction?.palette,
    opts.direction?.style,
    opts.direction?.surfaces,
    opts.direction?.fixtures,
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const value = String(item || "").trim();
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
}

export function buildDiscoveryPrompt(opts: {
  room: string;
  serviceLabel: string;
  scopes: string[];
  budget: number;
  direction: VisualDirection;
  focus?: "part" | "room";
  hero?: string;
  heroes?: string[];
  hasLayoutRef?: boolean;
}): string {
  const parts = (opts.heroes && opts.heroes.length ? opts.heroes : focalScopeParts(opts.scopes)).filter(Boolean);
  const scopeText =
    parts.length
      ? parts.join(" and ")
      : opts.scopes.filter((s) => !/^other$/i.test(s)).join(" and ") || "the selected work";
  const budget = Math.max(0, Math.round(opts.budget || 0));
  const hero = String(opts.hero || parts[0] || "").trim();
  const focus = opts.focus || (hero ? "part" : "room");
  const focusLine =
    parts.length >= 2
      ? `The subject is ${scopeText} together in one realistic ${opts.room}. Both must dominate the frame. Do not hero unselected parts.`
      : focus === "room" && hero
        ? `Full ${opts.room} in limited context. The ${hero} must still be clearly visible.`
        : hero
          ? `The ${hero} is the hero — medium shot of the ${hero} in a real ${opts.room}. Other details stay secondary.`
          : `Show a realistic ${opts.room} for this project.`;
  const scopeLine =
    parts.length > 0
      ? `${scopeText} must be clearly visible, relevant visual elements — do not generate a generic ${opts.room}.`
      : "";
  const budgetLine = budget
    ? `This look must be buildable for about $${budget.toLocaleString()} (stay within 5%). ${
        budget < 15000
          ? "Colorful ceramic and porcelain are great — do not default to an all-white room. No luxury stone, oversized custom millwork, or high-end spa finishes."
          : "No palace or hotel-spa finishes above this budget."
      }`
    : "";
  const palette = String(opts.direction.palette || "").trim();
  const surfaces = String(opts.direction.surfaces || "").trim();
  const fixtures = String(opts.direction.fixtures || "").trim();
  const style = String(opts.direction.style || "").trim();
  const layoutLine = opts.hasLayoutRef
    ? "Match the camera angle and room layout of the reference image. Restyle finishes, color, and fixtures only — do not invent a new floor plan."
    : "Use a typical American residential layout for this room: standard US home dimensions, fixtures on real plumbing walls, doors and windows that make sense. No spatial hallucinations, floating fixtures, extra doors into nowhere, or impossible geometry.";
  return [
    `Photoreal ${opts.room} for a ${opts.serviceLabel.toLowerCase()} project.`,
    "Priority: realistic layout, then selected scope, then budget, then beauty, then style variety.",
    layoutLine,
    `This is specifically a ${opts.serviceLabel.toLowerCase()} job — do not show a different trade, room, or project type.`,
    `Scope to include: ${scopeText}.`,
    focusLine,
    scopeLine,
    budgetLine,
    palette
      ? `Color scheme: ${palette}. This palette must dominate the image — do not wash it out to white or beige.`
      : "",
    surfaces ? `Surfaces and tile: ${surfaces}.` : "",
    fixtures ? `Fixtures: ${fixtures}. Show these fixture types clearly.` : "",
    style ? `Style: ${style}.` : "",
    `Visual direction: ${opts.direction.prompt}.`,
    "This image is a reference look for a later design step — keep the layout practical and buildable.",
    "Make this look visually distinct: unique color, unique tile pattern, unique fixtures. Do not generate a generic all-white builder bathroom unless the direction explicitly asks for white.",
    "Square-friendly composition. No text, logos, people, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export type LayoutPreset = {
  id: string;
  label: string;
  prompt: string;
  image?: string;
  /** If set, show this option only when a selected scope mentions one of these words. */
  needs?: string[];
};

export type StyleSwatch = {
  id: string;
  label: string;
  colors: [string, string];
  prompt: string;
  image: string;
};

const LAYOUTS: Record<string, LayoutPreset[]> = {
  bathroom: [
    { id: "walk-in", label: "Walk-in shower", prompt: "typical US bathroom with a walk-in shower, clear wet wall, realistic clearances" },
    { id: "tub-shower", label: "Tub + shower", prompt: "typical US bathroom with a tub/shower combo on one wall, vanity on another" },
    { id: "open-wet", label: "Open wet room", prompt: "compact American wet-room bath, shower and floor drain, vanity nearby" },
    { id: "compact", label: "Compact", prompt: "small US hall bath, efficient layout, nothing oversized" },
  ],
  kitchen: [
    { id: "galley", label: "Galley", prompt: "galley kitchen, two parallel runs, typical American home" },
    { id: "l-shape", label: "L-shape", prompt: "L-shaped kitchen with a clear work triangle" },
    { id: "island", label: "Island", prompt: "kitchen with a centered island and clear walkways" },
    { id: "u-shape", label: "U-shape", prompt: "U-shaped kitchen, cabinets on three walls" },
  ],
  landscaping: [
    { id: "patio", label: "Patio-first", prompt: "patio as the main outdoor room, planting around the edges" },
    { id: "garden", label: "Garden rooms", prompt: "yard divided into simple outdoor rooms with a path" },
    { id: "linear", label: "Linear path", prompt: "straight walk and planting beds, typical suburban lot" },
    { id: "court", label: "Courtyard", prompt: "inward courtyard with seating in the center" },
  ],
  default: [
    { id: "open", label: "Open", prompt: "open, readable American residential layout" },
    { id: "centered", label: "Centered", prompt: "centered composition, balanced and typical" },
    { id: "compact", label: "Compact", prompt: "compact, efficient layout, nothing oversized" },
    { id: "zoned", label: "Zoned", prompt: "clear zones, simple circulation" },
  ],
};

const FAMILY_COLORS: Record<string, [string, string]> = {
  navy: ["#1e3a5f", "#f3efe6"],
  sage: ["#7d9a7a", "#f4efe6"],
  graphite: ["#3d3f42", "#f2f2f0"],
  honey: ["#c4a574", "#f5efe4"],
  terracotta: ["#c56a43", "#f3eadc"],
  blush: ["#d9a8b0", "#f7f1ea"],
  forest: ["#2f5d3a", "#f4efe6"],
  checker: ["#1a1a1a", "#f4f4f0"],
  sky: ["#6ea4c8", "#f4f7fa"],
  ink: ["#1c2e4a", "#d8c3a5"],
  sand: ["#cbb79a", "#f5efe4"],
  slate: ["#6b7380", "#f2f2f0"],
  emerald: ["#1f6b4a", "#f4efe6"],
  cobalt: ["#1e4ea0", "#f4f7fa"],
  cinnamon: ["#a15b32", "#ece4d8"],
  plum: ["#6b3a58", "#f3eadc"],
  mint: ["#8fbfb0", "#f4f7f4"],
  ochre: ["#c3922e", "#f5efe4"],
  cream: ["#f3efe6", "#d8d0c4"],
  mist: ["#c5c9ce", "#f4f5f6"],
  twotone: ["#1e3a5f", "#f4f4f0"],
};

function titleStyleLabel(label: string): string {
  const raw = String(label || "").trim();
  if (!raw) return "Style";
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function layoutPresets(vertical?: string | null): LayoutPreset[] {
  const key = String(vertical || "default");
  return LAYOUTS[key] || LAYOUTS.default;
}

/** Styles for this service + scope + budget. Thumbs are filled from the current layout image. */
export function styleSwatchesForProject(
  vertical?: string | null,
  scopes?: string[],
  budget?: number
): StyleSwatch[] {
  const key = String(vertical || "default");
  const pool = LOOKS_BY_VERTICAL[key] || DEFAULT_LOOKS;
  const ranked = directionsForBudget(budget || 0, pool);
  const metals = metalsForBudget(budget || 0);
  const kit = budgetStyleDirective(budget || 0, vertical);
  const out: StyleSwatch[] = [];
  const seen = new Set<string>();
  const push = (look: VisualDirection, metal: (typeof METAL_KITS)[number] | null, index: number) => {
    const adapted = adaptLookToScopes(look, scopes || []);
    const family = String(look.family || look.label || "style").toLowerCase().trim();
    const id = metal ? `${family}-${metal.id}` : `${family}-${index}`;
    if (seen.has(id)) return false;
    seen.add(id);
    const label = metal
      ? `${titleStyleLabel(adapted.label || family)} · ${metal.label}`
      : titleStyleLabel(adapted.label || family);
    const prompt = [adapted.prompt, metal?.prompt, kit].filter(Boolean).join(". ");
    out.push({
      id,
      label,
      colors: FAMILY_COLORS[family] || ["#e8e4dc", "#cfc9be"],
      prompt,
      image: "",
    });
    return true;
  };
  for (const look of ranked) {
    const metal = metals[out.length % Math.max(1, metals.length)] || null;
    push(look, metal, out.length);
    if (out.length >= STYLE_BOARD_COUNT) return out;
  }
  for (const metal of metals) {
    for (const look of ranked) {
      push(look, metal, out.length);
      if (out.length >= STYLE_BOARD_COUNT) return out;
    }
  }
  let i = 0;
  while (out.length < STYLE_BOARD_COUNT && ranked.length) {
    push(ranked[i % ranked.length], metals[i % Math.max(1, metals.length)] || null, i);
    i += 1;
    if (i > STYLE_BOARD_COUNT * 4) break;
  }
  return out.slice(0, STYLE_BOARD_COUNT);
}

export function styleSwatches(): StyleSwatch[] {
  return styleSwatchesForProject("default");
}

/** Hard spatial rules so layouts don't invent cramped, overlapping fixtures. */
export function residentialClearanceBlock(room: string): string {
  const r = String(room || "").toLowerCase();
  if (r.includes("bath")) {
    return [
      "Follow standard US residential bathroom layout rules with realistic bathroom clearances.",
      "Toilet at least 15–18 inches from any fixture or wall, measured from the toilet centerline.",
      "Bathtub has proper clearance on the long side — at least 21 inches of open floor in front of the tub.",
      "Comfortable walking space between toilet, tub, and vanity. Keep a clear center aisle.",
      "No fixtures cramped together. Every fixture sits on the floor with real plumbing and real gaps.",
      "NEGATIVES: no tub jammed against the toilet, no cramped corners, no overlapping fixtures, no toilet under a vanity, no doors hitting fixtures, no floating or warped geometry.",
      "If a fixture cannot fit with proper clearance, leave empty floor — never overlap or shrink fixtures.",
    ].join(" ");
  }
  if (r.includes("kitchen")) {
    return [
      "Follow standard US residential kitchen layout rules.",
      "Keep a work triangle between sink, range, and fridge. Aisles 36–42 inches.",
      "NEGATIVES: no overlapping cabinets, no island blocking the walkway, no cramped corners.",
    ].join(" ");
  }
  return [
    "Follow standard US residential layout rules.",
    "Comfortable walking space. No overlapping or cramped objects.",
  ].join(" ");
}

/** Shared finish recipe so starter + layout thumbs look like one blank canvas, not five designed rooms. */
export function whitewashLayoutBlock(room: string): string {
  const r = String(room || "").toLowerCase();
  if (r.includes("kitchen")) {
    return [
      "STANDARD BUILDER LAYOUT, not a designed kitchen and not an ugly empty box.",
      "Photoreal listing photo: looks clean, ordinary, and well-built.",
      "Simple finishes: soft-white walls, white shaker cabinets, plain white counters, white 4x4 backsplash, basic chrome. Even daylight, nothing blown out.",
      "No wood stain, no color story, no statement lighting. Same quiet kit on every option — only the layout may change.",
    ].join(" ");
  }
  if (/\b(yard|landscape|outdoor|garden|patio)\b/.test(r)) {
    return [
      "STANDARD suburban yard, not a landscape design and not a dirt lot.",
      "Even grass, simple concrete patio, ordinary daylight. Looks like a real backyard listing photo.",
      "No luxury hardscape, no designed planting palette. Only patio vs beds vs lawn may differ.",
    ].join(" ");
  }
  if (r.includes("bath")) {
    return [
      "STANDARD BUILDER LAYOUT. Photoreal listing photo of a normal American hall bath.",
      "It should look fine — clean, ordinary, correctly built — not fancy and not terrible.",
      "Soft-white walls and ceiling, white ceramic subway or 4x4 wall tile with even grout, simple white porcelain floor, a normal 30-inch white shaker vanity, a plain rectangular mirror, exactly one white toilet, white tub if present, basic chrome.",
      "Even window daylight, true whites that are not blown out, straight tile, fixtures sitting correctly on the floor with real shadows.",
      "ONE toilet only. ONE vanity only. ONE tub or shower. Never two toilets, never two vanities, never a second tub.",
      "No hotel spa, no marble, no brass, no designer lighting, no round wood mirror, no plants or towels as the subject.",
      "Not a vacant gutted rental. Not overexposed hospital white. Not warped plastic or a 3D sketch.",
      "Every option uses this SAME quiet builder kit so the ONLY differences are fixture layout and camera.",
    ].join(" ");
  }
  return [
    "STANDARD BUILDER LAYOUT. Photoreal, clean, ordinary — not a designed interior and not an ugly empty box.",
    "Soft-white builder finishes, even daylight, real materials. Same quiet kit on every option — only layout and camera may change.",
  ].join(" ");
}

/** Layout geometry only — finishes come from the customer's budget. */
export function spatialKitBlock(room: string): string {
  const r = String(room || "").toLowerCase();
  if (r.includes("bath")) {
    return [
      "Photoreal listing photo of a real American hall bath with a proven layout.",
      "ONE toilet only. ONE vanity only. ONE tub or shower. Never two toilets, never two vanities, never a second tub.",
      "Even daylight, fixtures sitting correctly on the floor with real shadows.",
      "Not a vacant gutted rental. Not warped plastic or a 3D sketch.",
    ].join(" ");
  }
  if (r.includes("kitchen")) {
    return "Photoreal listing photo of a real American kitchen. Proven residential layout, even daylight, real materials.";
  }
  if (/\b(yard|landscape|outdoor|garden|patio)\b/.test(r)) {
    return "Photoreal suburban yard listing photo. Real grass and hardscape, ordinary daylight.";
  }
  return "Photoreal residential interior. Proven layout, even daylight, real materials.";
}

export function buildStarterPrompt(opts: {
  room: string;
  serviceLabel: string;
  scopes: string[];
  mode: "spatial" | "component";
  budget: number;
}): string {
  const parts = focalScopeParts(opts.scopes);
  const scopeText = parts.join(" and ") || "the selected work";
  const budget = Math.max(0, Math.round(opts.budget || 0));
  const subject =
    opts.mode === "component"
      ? `Clean, focused view of ${scopeText} only. Crop tight on the element. Do not show a full unrelated room.`
      : `Realistic full ${opts.room} in a typical American house. ${scopeText} must be clearly visible.`;
  const defaultPlan = opts.mode === "component"
    ? `Show only ${scopeText} as the project that will be built at this budget.`
    : String(opts.room || "").toLowerCase().includes("bath")
      ? "Default layout: proven US 5x8 hall bath. Alcove tub/shower combo along the LONG BACK wall, exactly ONE toilet on that same wet wall with 18 inches from the tub and the side wall, one 30-inch vanity on the adjacent wall, door on the remaining wall, clear center walkway. Eye-level 3/4 view from near the door. Never invent a second toilet or second vanity."
      : "Typical American residential layout for this room, readable from a doorway 3/4 view.";
  return [
    `Photoreal ${opts.room} for a ${opts.serviceLabel.toLowerCase()} project.`,
    "This is a ROUGH STARTER meant to be changed — a real project at this budget, not a finished design.",
    subject,
    defaultPlan,
    spatialKitBlock(opts.room),
    residentialClearanceBlock(opts.room),
    budgetStyleDirective(budget, opts.room),
    "Real house, not a hotel spa photoshoot.",
    "Physically plausible fixtures, no spatial hallucinations.",
    "ONE single photograph of one room. Not a stereogram, split-screen, diptych, collage, or two images side by side.",
    budget ? `Spend level is about $${budget.toLocaleString()} — materials, fixtures, and finish quality must look like that job.` : "",
    "No text, logos, people, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildNeutralizePrompt(opts: { room: string; scopes: string[] }): string {
  const parts = focalScopeParts(opts.scopes);
  const scopeText = parts.join(" and ") || "the selected work";
  return [
    `Light cleanup of this existing ${opts.room} photo.`,
    "Keep the real spatial structure, camera angle, and architecture exactly.",
    `Make ${scopeText} readable.`,
    "Gentle neutralization: tidy clutter, even daylight, true colors. Do not redesign the room.",
    "No text, logos, or people.",
  ].join(" ");
}

/** Starting floor plans of the generated scene. Style is a later step. */
const LAYOUT_OPTIONS: Record<string, LayoutPreset[]> = {
  bathroom: [
    {
      id: "tub-combo",
      label: "Tub/shower combo",
      prompt: "PROVEN 5x8 US hall bath. Alcove tub/shower combo along the LONG BACK wall. Toilet on that same wet wall with 18 inches from the tub. Single vanity on the adjacent wall. Clear center aisle.",
      needs: ["shower", "tub"],
    },
    {
      id: "walk-in",
      label: "Walk-in shower",
      prompt: "PROVEN 5x8 US hall bath with a walk-in shower alcove, toilet with 18-inch clearance, single vanity on the adjacent wall.",
      needs: ["shower"],
    },
    {
      id: "corner-shower",
      label: "Corner shower",
      prompt: "PROVEN 5x8 US hall bath. Corner shower stall in one back corner only. Vanity on the long wall. Toilet on the remaining wall with 18-inch clearance.",
      needs: ["shower"],
    },
    {
      id: "double-vanity",
      label: "Double vanity",
      prompt: "PROVEN 5x10 US bath. Double vanity on one long wall, toilet with 18-inch clearance, tub or shower on another wall — not next to the toilet.",
      needs: ["vanity"],
    },
    {
      id: "tub-long-wall",
      label: "Tub on long wall",
      prompt: "PROVEN 5x10 US bath. Alcove tub along one long wall, toilet 18 inches from the tub, vanity on the opposite wall.",
      needs: ["tub"],
    },
    {
      id: "from-door",
      label: "From the door",
      prompt: "Same hall-bath floor plan, camera standing in the doorway looking in. Do not invent a new floor plan.",
    },
  ],
  kitchen: [
    { id: "galley", label: "Galley", prompt: "galley kitchen: two parallel cabinet runs, no island" },
    { id: "l-shape", label: "L-shape", prompt: "L-shaped kitchen, cabinets on two walls, clear work triangle" },
    { id: "island", label: "Island", prompt: "kitchen with a centered island and perimeter cabinets" },
    { id: "u-shape", label: "U-shape", prompt: "U-shaped kitchen, cabinets on three walls" },
  ],
  landscaping: [
    { id: "patio-first", label: "Patio-first", prompt: "patio as the main outdoor room, planting around the edges" },
    { id: "garden-beds", label: "Garden beds", prompt: "yard divided into lawn and planting beds with a simple path" },
    { id: "from-house", label: "From the house", prompt: "camera at the back door looking into the same yard" },
    { id: "patio-view", label: "Patio view", prompt: "camera on the patio looking across the lot" },
    { id: "full-yard", label: "Full yard", prompt: "wider shot of the whole typical suburban yard" },
  ],
  default: [
    { id: "from-door", label: "From the door", prompt: "camera from the entry looking in, typical residential layout" },
    { id: "left", label: "Left side", prompt: "camera from the left side of the same space" },
    { id: "right", label: "Right side", prompt: "camera from the right side of the same space" },
  ],
};

function layoutOptionFitsScopes(row: LayoutPreset, scopes?: string[]): boolean {
  if (!row.needs?.length) return true;
  const blob = (scopes || []).join(" ").toLowerCase();
  if (!blob.trim()) return true;
  return row.needs.some((need) => blob.includes(need.toLowerCase()));
}

export function layoutChoicesForProject(vertical?: string | null, scopes?: string[]): LayoutPreset[] {
  const key = String(vertical || "default");
  const options = (LAYOUT_OPTIONS[key] || LAYOUT_OPTIONS.default).filter((row) =>
    layoutOptionFitsScopes(row, scopes)
  );
  const thisView: LayoutPreset = {
    id: "this-view",
    label: "This view",
    prompt: "keep the current camera and fixture layout. Stay a standard builder layout.",
  };
  return [thisView, ...options.slice(0, 9)];
}

export function buildLayoutCompositePrompt(opts: {
  room: string;
  serviceLabel: string;
  scopes: string[];
  layout?: LayoutPreset | null;
}): string {
  const parts = focalScopeParts(opts.scopes);
  const scopeText = parts.join(" and ") || "the selected work";
  return [
    `Composite this generated ${opts.room} scene into an alternate layout for a ${opts.serviceLabel.toLowerCase()} project.`,
    "This image is the MAIN FOCAL SCENE. Keep its camera, room size, finishes, lighting, and overall look.",
    "Rearrange only fixture placement. Do not generate a different house. Do not restyle.",
    `${scopeText} must stay in the room.`,
    "Do not add a second tub, a stub tub, a tiled bench that looks like a tub, an extra shower, or any new basin in a corner.",
    "Do not overlap the toilet, vanity, tub, or shower.",
    opts.layout ? `New layout: ${opts.layout.label}. ${opts.layout.prompt}` : "",
    whitewashLayoutBlock(opts.room),
    "Quality bar: straight lines, real plumbing, even daylight, no warped fixtures, no CGI look.",
    "No text, logos, people, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildLayoutThumbPrompt(opts: {
  room: string;
  serviceLabel: string;
  scopes: string[];
  layout: LayoutPreset;
}): string {
  return buildLayoutCompositePrompt(opts);
}

export function buildStyleThumbPrompt(opts: {
  room: string;
  serviceLabel: string;
  scopes: string[];
  style: StyleSwatch;
  budget?: number;
}): string {
  const parts = focalScopeParts(opts.scopes);
  const scopeText = parts.join(" and ") || "the selected work";
  return [
    `Restyle this generated ${opts.room} scene for a ${opts.serviceLabel.toLowerCase()} project.`,
    "This image is the chosen layout. Keep the exact camera, walls, door, and fixture placement.",
    `${scopeText} must stay where they already are.`,
    `Apply this finish kit so it looks designed, photoreal, and obviously different: ${opts.style.prompt}.`,
    opts.budget ? budgetStyleDirective(opts.budget) : "",
    "Do not generate a new room. Do not change the floor plan. No text, logos, people, or watermarks.",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildRailPrompt(opts: {
  room: string;
  serviceLabel: string;
  scopes: string[];
  mode: "spatial" | "component";
  budget: number;
  layout?: LayoutPreset | null;
  style?: StyleSwatch | null;
}): string {
  const parts = focalScopeParts(opts.scopes);
  const scopeText = parts.join(" and ") || "the selected work";
  return [
    `Inpaint this existing ${opts.room} photo for a ${opts.serviceLabel.toLowerCase()} project.`,
    "Keep this exact camera, architecture, and layout. Do not invent a new room.",
    opts.mode === "component"
      ? `Stay a focused view of ${scopeText}.`
      : `Keep this same ${opts.room}. ${scopeText} must stay clearly visible.`,
    opts.layout && !opts.style ? `Adjust layout only: ${opts.layout.prompt}.` : "",
    opts.style
      ? `Paint this color scheme onto the existing photo so it is obviously different: ${opts.style.prompt}. Leave the camera and layout alone.`
      : whitewashLayoutBlock(opts.room),
    opts.budget ? `Buildable for about $${opts.budget.toLocaleString()} (±5%).` : "",
    "No spatial hallucinations. No text, logos, or people.",
  ]
    .filter(Boolean)
    .join(" ");
}
