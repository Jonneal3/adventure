import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
import type {
  V8RefinementCatalog,
  V8RefinementCategory,
  V8RefinementOption,
} from "@/components/adventure/v8/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;

type Ctx = { params: Promise<{ instanceId: string }> };

type CatalogImage = {
  imageUrl: string;
  searchText: string;
};

const BATHROOM_ITEM_ROOT = "/adventure/item-references/bathroom";

const BATHROOM_ITEM_PREVIEWS: Record<string, Record<string, string>> = {
  vanity: {
    "white-oak-floating": `${BATHROOM_ITEM_ROOT}/vanity-white-oak-floating.jpg`,
    "walnut-furniture-style": `${BATHROOM_ITEM_ROOT}/vanity-walnut-furniture.jpg`,
    "painted-shaker": `${BATHROOM_ITEM_ROOT}/vanity-painted-shaker.jpg`,
    "reeded-natural-oak": `${BATHROOM_ITEM_ROOT}/vanity-reeded-oak.jpg`,
    "tailored-furniture-vanity": `${BATHROOM_ITEM_ROOT}/vanity-tailored-furniture.jpg`,
  },
  faucet: {
    "polished-chrome": `${BATHROOM_ITEM_ROOT}/faucet-polished-chrome.jpg`,
    "brushed-nickel": `${BATHROOM_ITEM_ROOT}/faucet-brushed-nickel.jpg`,
    "matte-black": `${BATHROOM_ITEM_ROOT}/faucet-matte-black.jpg`,
    "brushed-brass": `${BATHROOM_ITEM_ROOT}/faucet-brushed-brass.jpg`,
    "aged-copper": `${BATHROOM_ITEM_ROOT}/faucet-aged-copper.jpg`,
  },
  shower: {
    "frameless-glass": `${BATHROOM_ITEM_ROOT}/shower-frameless-glass.jpg`,
    "clear-sliding-glass": `${BATHROOM_ITEM_ROOT}/shower-clear-sliding-glass.jpg`,
    "quiet-built-in-niche": `${BATHROOM_ITEM_ROOT}/shower-built-in-niche.jpg`,
    "simple-stone-curb": `${BATHROOM_ITEM_ROOT}/shower-stone-curb.jpg`,
    "tailored-shower-trim": `${BATHROOM_ITEM_ROOT}/shower-tailored-trim.jpg`,
  },
  wall: {
    "warm-limestone": `${BATHROOM_ITEM_ROOT}/wall-warm-limestone.jpg`,
    "handmade-zellige": `${BATHROOM_ITEM_ROOT}/wall-handmade-zellige.jpg`,
    "large-format-porcelain": `${BATHROOM_ITEM_ROOT}/wall-large-format-porcelain.jpg`,
    "refined-terrazzo": `${BATHROOM_ITEM_ROOT}/wall-refined-terrazzo.jpg`,
    "fluted-stone-accent": `${BATHROOM_ITEM_ROOT}/wall-fluted-stone.jpg`,
  },
  floor: {
    "matte-porcelain": `${BATHROOM_ITEM_ROOT}/floor-matte-porcelain.jpg`,
    "small-format-mosaic": `${BATHROOM_ITEM_ROOT}/floor-small-mosaic.jpg`,
    "honed-limestone": `${BATHROOM_ITEM_ROOT}/floor-honed-limestone.jpg`,
    "terrazzo-tile": `${BATHROOM_ITEM_ROOT}/floor-terrazzo.jpg`,
    "warm-stone-look": `${BATHROOM_ITEM_ROOT}/floor-warm-stone.jpg`,
  },
  toilet: {
    "clean-skirted": `${BATHROOM_ITEM_ROOT}/toilet-clean-skirted.jpg`,
    "compact-modern": `${BATHROOM_ITEM_ROOT}/toilet-compact-modern.jpg`,
    "quiet-traditional": `${BATHROOM_ITEM_ROOT}/toilet-quiet-traditional.jpg`,
    "wall-hung-profile": `${BATHROOM_ITEM_ROOT}/toilet-wall-hung.jpg`,
    "integrated-bidet-style": `${BATHROOM_ITEM_ROOT}/toilet-integrated-bidet.jpg`,
  },
  mirror: {
    "simple-round": `${BATHROOM_ITEM_ROOT}/mirror-simple-round.jpg`,
    "arched-brass": `${BATHROOM_ITEM_ROOT}/mirror-arched-brass.jpg`,
    "thin-black-frame": `${BATHROOM_ITEM_ROOT}/mirror-thin-black.jpg`,
    "soft-rectangle": `${BATHROOM_ITEM_ROOT}/mirror-soft-rectangle.jpg`,
    "recessed-medicine-cabinet": `${BATHROOM_ITEM_ROOT}/mirror-medicine-cabinet.jpg`,
  },
  lighting: {
    "minimal-globe-sconces": `${BATHROOM_ITEM_ROOT}/lighting-globe-sconces.jpg`,
    "warm-linear-light": `${BATHROOM_ITEM_ROOT}/lighting-linear.jpg`,
    "aged-brass-sconces": `${BATHROOM_ITEM_ROOT}/lighting-aged-brass.jpg`,
    "soft-backlighting": `${BATHROOM_ITEM_ROOT}/lighting-backlit.jpg`,
    "simple-shaded-sconces": `${BATHROOM_ITEM_ROOT}/lighting-shaded-sconces.jpg`,
  },
};

const FALLBACK_SPECS: Record<string, Array<{ label: string; target: string; choices: string[] }>> = {
  bathroom: [
    { label: "Vanity", target: "the existing vanity", choices: ["White oak floating", "Walnut furniture style", "Painted shaker", "Reeded natural oak", "Tailored furniture vanity"] },
    { label: "Faucets & hardware", target: "the existing visible faucets and hardware", choices: ["Polished chrome", "Brushed nickel", "Matte black", "Brushed brass", "Aged copper"] },
    { label: "Shower or tub", target: "the existing shower or tub wet zone", choices: ["Frameless glass", "Clear sliding glass", "Quiet built-in niche", "Simple stone curb", "Tailored shower trim"] },
    { label: "Wall tile", target: "the existing wall tile surfaces", choices: ["Warm limestone", "Handmade zellige", "Large-format porcelain", "Refined terrazzo", "Fluted stone accent"] },
    { label: "Flooring", target: "the existing bathroom floor", choices: ["Matte porcelain", "Small-format mosaic", "Honed limestone", "Terrazzo tile", "Warm stone look"] },
    { label: "Toilet", target: "the existing toilet", choices: ["Clean skirted", "Compact modern", "Quiet traditional", "Wall-hung profile", "Integrated bidet style"] },
    { label: "Mirror", target: "the existing mirror", choices: ["Simple round", "Arched brass", "Thin black frame", "Soft rectangle", "Recessed medicine cabinet"] },
    { label: "Lighting", target: "the existing bathroom lighting", choices: ["Minimal globe sconces", "Warm linear light", "Aged brass sconces", "Soft backlighting", "Simple shaded sconces"] },
  ],
  kitchen: [
    { label: "Cabinet finishes", target: "the existing cabinet fronts", choices: ["Natural white oak", "Warm walnut", "Soft white shaker", "Deep olive paint", "Reeded oak accent"] },
    { label: "Countertops", target: "the existing countertops", choices: ["Quiet quartz", "Honed soapstone", "Warm limestone", "Calacatta-look slab", "Butcher block accent"] },
    { label: "Backsplash", target: "the existing backsplash", choices: ["Handmade ceramic", "Quiet slab", "Classic subway", "Warm zellige", "Small stone mosaic"] },
    { label: "Sink & faucet", target: "the existing sink and faucet", choices: ["Polished chrome", "Brushed nickel", "Matte black", "Brushed brass", "Aged copper"] },
    { label: "Cabinet hardware", target: "the existing cabinet hardware", choices: ["Simple knobs", "Slim bar pulls", "Tab pulls", "Classic cup pulls", "Mixed knobs and pulls"] },
    { label: "Lighting", target: "the existing kitchen lighting", choices: ["Opal globe pendants", "Linear island light", "Aged brass pendants", "Minimal black pendants", "Layered recessed light"] },
    { label: "Flooring", target: "the existing kitchen flooring", choices: ["Natural oak", "Warm porcelain", "Limestone look", "Quiet terrazzo", "Classic checkerboard"] },
    { label: "Wall color", target: "the existing painted kitchen walls", choices: ["Warm white", "Soft greige", "Muted olive", "Plaster beige", "Quiet blue gray"] },
  ],
  landscaping: [
    { label: "Paving", target: "the existing hardscape", choices: ["Warm limestone", "Large concrete pavers", "Reclaimed brick", "Bluestone", "Permeable gravel grid"] },
    { label: "Planting", target: "the existing planting beds", choices: ["Layered native grasses", "Evergreen structure", "Pollinator perennials", "Formal clipped planting", "Low-water Mediterranean"] },
    { label: "Pergola or cover", target: "the existing outdoor shade structure", choices: ["Cedar pergola", "Painted pavilion", "Slim steel cover", "Retractable canopy", "Open slatted roof"] },
    { label: "Privacy", target: "the existing fence or privacy edge", choices: ["Slatted cedar screen", "Layered evergreen hedge", "Painted horizontal fence", "Climbing vine trellis", "Masonry garden wall"] },
    { label: "Seating", target: "the existing seating zone", choices: ["Built-in bench", "Teak lounge set", "Dining arrangement", "Simple fire-side chairs", "Compact sectional"] },
    { label: "Lighting", target: "the existing outdoor lighting", choices: ["Low-voltage path lights", "Warm tree uplights", "Subtle step lights", "Shielded wall lights", "Under-bench glow"] },
    { label: "Fire or water feature", target: "the existing focal feature zone", choices: ["Linear fire pit", "Masonry fireplace", "Small water bowl", "Quiet fountain wall", "No focal feature"] },
    { label: "Edging & groundcover", target: "the existing bed edges and exposed ground", choices: ["Steel edging", "Natural stone edging", "Fine gravel", "Living groundcover", "Dark bark mulch"] },
  ],
  default: [
    { label: "Primary finishes", target: "the primary visible finish", choices: ["Natural white oak", "Warm walnut", "Soft painted finish", "Textured limestone", "Handmade ceramic"] },
    { label: "Hardware", target: "the existing visible hardware", choices: ["Polished chrome", "Brushed nickel", "Matte black", "Brushed brass", "Aged copper"] },
    { label: "Lighting", target: "the existing lighting", choices: ["Opal globe", "Architectural linear", "Aged brass", "Minimal black", "Layered ambient"] },
    { label: "Details", target: "one existing focal detail", choices: ["Fluted wood", "Reeded glass", "Soft plaster", "Natural stone", "Tailored millwork"] },
    { label: "Flooring", target: "the existing flooring", choices: ["Natural oak", "Warm stone", "Quiet porcelain", "Textured concrete", "Refined terrazzo"] },
    { label: "Wall color", target: "the existing painted walls", choices: ["Warm white", "Soft greige", "Muted olive", "Plaster beige", "Quiet blue gray"] },
  ],
};

function cleanText(value: unknown, max = 400): string {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

function slug(value: string): string {
  return cleanText(value, 80).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "option";
}

function serviceKey(label: string): string {
  const text = label.toLowerCase();
  if (/bath|shower|vanity|tub/.test(text)) return "bathroom";
  if (/kitchen/.test(text)) return "kitchen";
  if (/landscap|yard|patio|garden|pergola|outdoor/.test(text)) return "landscaping";
  return "default";
}

function normalizedBudgetDelta(value: unknown): number {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return 0;
  return Math.max(-15_000, Math.min(15_000, Math.round(amount / 500) * 500));
}

function refinementFamily(categoryLabel: string, target = ""): string {
  const text = `${categoryLabel} ${target}`.toLowerCase();
  if (/mirror|medicine cabinet/.test(text)) return "mirror";
  if (/toilet|bidet/.test(text)) return "toilet";
  if (/exhaust|vent|fan/.test(text)) return "fan";
  if (/light|sconce|pendant|lamp/.test(text)) return "lighting";
  if (/counter|worktop/.test(text)) return "countertop";
  if (/paint|trim|wall color|plaster/.test(text)) return "paint";
  if (/layout|floor plan|plumbing update/.test(text)) return "layout";
  if (/floor|paving|paver|groundcover|edging/.test(text)) return "floor";
  if (/tile|backsplash/.test(text)) return "wall";
  if (/shower|tub|wet zone|enclosure/.test(text)) return "shower";
  if (/faucet|hardware|sink|plumbing/.test(text)) return "faucet";
  if (/vanity|cabinet|millwork|storage/.test(text)) return "vanity";
  if (/wall|counter|stone|surface|paint/.test(text)) return "wall";
  if (/plant|shrub|tree|garden/.test(text)) return "planting";
  if (/pergola|cover|shade/.test(text)) return "pergola";
  if (/fire|water feature|fountain/.test(text)) return "feature";
  if (/seat|furniture/.test(text)) return "seating";
  return "material";
}

function illustratedOptionPreview(family: string, optionLabel: string): string {
  let hash = 0;
  for (const char of optionLabel) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  const accents = ["#a86f4c", "#b69a70", "#687a72", "#77706a", "#9a816d"];
  const finish = optionLabel.toLowerCase();
  const accent = /navy|blue/.test(finish)
    ? "#34495f"
    : /white|ivory|cream/.test(finish)
      ? "#c9c5ba"
      : /black/.test(finish)
        ? "#292a2a"
        : /charcoal|graphite/.test(finish)
          ? "#555655"
          : /walnut|espresso/.test(finish)
            ? "#765039"
            : /oak|natural wood/.test(finish)
              ? "#b08b62"
              : /brass|gold/.test(finish)
                ? "#a88545"
                : /copper|terracotta/.test(finish)
                  ? "#a65f43"
                  : accents[hash % accents.length];
  const icons: Record<string, string> = {
    vanity: '<rect x="72" y="91" width="176" height="76" rx="5"/><path d="M86 105h63v48H86zm77 0h71v48h-71z"/><path d="M128 72c0-17 24-17 24 0v15"/><ellipse cx="140" cy="92" rx="32" ry="8"/>',
    faucet: '<path d="M85 150h150M120 145V87c0-35 70-35 70 0v20h-34"/><path d="M91 126h25m78 0h25"/>',
    shower: '<rect x="72" y="38" width="176" height="139" rx="4"/><path d="M91 65h92c25 0 25 31 25 31M208 96h24M101 162h118"/><circle cx="208" cy="96" r="9"/>',
    wall: '<path d="M55 45h210v130H55zM55 88h210M55 132h210M107 45v130M160 45v130M213 45v130"/>',
    floor: '<path d="M45 156 101 63h118l56 93zM70 135h180M87 105h146M116 63l-16 93M160 63v93M204 63l16 93"/>',
    toilet: '<path d="M113 62h94v49c0 20-12 29-24 37v27h-60v-27c-12-8-24-17-24-37h108M121 62V42h78v20"/>',
    mirror: '<rect x="92" y="35" width="136" height="151" rx="54"/><path d="M116 164h88"/>',
    lighting: '<path d="M160 34v43M111 154h98M128 77h64l27 77H101z"/><circle cx="160" cy="130" r="20"/>',
    countertop: '<path d="M55 95h210v28H55zM72 123v54m176-54v54M118 94c0-25 84-25 84 0M160 73V45c0-15 28-15 28 0v13"/>',
    paint: '<path d="M83 56h128v45H83zM211 78h27v39h-78v29M160 146v38"/>',
    fan: '<circle cx="160" cy="108" r="69"/><circle cx="160" cy="108" r="15"/><path d="M160 93c-8-38 11-57 38-45 12 28-6 49-38 45M175 108c38-8 57 11 45 38-28 12-49-6-45-38M160 123c8 38-11 57-38 45-12-28 6-49 38-45M145 108c-38 8-57-11-45-38 28-12 49 6 45 38"/>',
    layout: '<path d="M62 42h196v140H62zM128 42v67H62M128 109h75v73M203 109h55M93 109v73"/>',
    planting: '<path d="M160 177V82M160 112c-39 0-57-23-58-49 34-2 56 17 58 49M160 137c37 0 58-21 60-49-34-2-57 18-60 49M111 177h98"/>',
    pergola: '<path d="M66 55h188M82 55v126M238 55v126M53 72h214M94 55 75 72m54-17-19 17m54-17-19 17m54-17-19 17m54-17-19 17"/>',
    feature: '<path d="M74 167h172V98H74zM104 98c0-33 22-51 56-61 34 10 56 28 56 61M130 146c0-24 12-36 30-48 18 12 30 24 30 48"/>',
    seating: '<path d="M72 106h176v60H72zM88 74h144v32M87 166v20m146-20v20"/>',
    material: '<path d="M74 56h172v112H74zM95 78h130v68H95z"/>',
  };
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="210" viewBox="0 0 320 210"><rect width="320" height="210" fill="#f0ede7"/><circle cx="270" cy="35" r="46" fill="${accent}" opacity=".22"/><g fill="${accent}" fill-opacity=".12" stroke="${accent}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round">${icons[family] || icons.material}</g></svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function curatedItemPreview(
  key: string,
  categoryLabel: string,
  target: string,
  optionLabel: string,
  _optionIndex: number
): string {
  const family = refinementFamily(categoryLabel, target);
  if (key === "bathroom") {
      const familyPreviews = BATHROOM_ITEM_PREVIEWS[family];
      if (familyPreviews) {
        const exact = familyPreviews[slug(optionLabel)];
        if (exact) return exact;
        return illustratedOptionPreview(family, optionLabel);
      }
  }
  return illustratedOptionPreview(family, optionLabel);
}

function fallbackCatalog(key: string): V8RefinementCatalog {
  const specs = FALLBACK_SPECS[key] || FALLBACK_SPECS.default;
  return {
    source: "fallback",
    diagnosis: "Suggestions are scoped to the visible project and preserve its physical layout.",
    categories: specs.map((spec) => ({
      id: slug(spec.label),
      label: spec.label,
      description: `Change only ${spec.target}.`,
      options: spec.choices.map((choice, optionIndex) => ({
        id: `${slug(spec.label)}-${slug(choice)}`,
        label: choice,
        prompt: `Change only ${spec.target} to ${choice.toLowerCase()}. Make the selection professionally proportioned and buildable. Preserve all unrelated materials, the camera, physical layout, and exact fixture or zone count.`,
        imagePrompt: `Exactly one ${choice.toLowerCase()} ${spec.label.toLowerCase()} product or material selection, shown large and clearly enough to identify the actual item being chosen.`,
        imageUrl: curatedItemPreview(key, spec.label, spec.target, choice, optionIndex),
        budgetDelta: /luxury|custom|built-in|outdoor kitchen|stone|walnut/i.test(choice) ? 5_000 : 0,
        target: spec.target,
        searchTerms: [spec.label, spec.target, choice],
      })),
    })),
  };
}

function canonicalizeCuratedOptions(
  key: string,
  categories: V8RefinementCategory[],
  fallbackCategories: V8RefinementCategory[]
): V8RefinementCategory[] {
  if (key !== "bathroom") return categories;
  const canonicalByFamily = new Map(
    fallbackCategories.map((category) => [
      refinementFamily(category.label, category.description),
      category,
    ])
  );
  return categories.map((category) => {
    const family = refinementFamily(category.label, category.description);
    if (!BATHROOM_ITEM_PREVIEWS[family]) return category;
    const canonical = canonicalByFamily.get(family);
    if (!canonical) return category;
    return {
      ...category,
      options: canonical.options.map((option) => ({ ...option })),
    };
  });
}

function parseAiCatalog(content: string): { diagnosis: string; categories: V8RefinementCategory[] } | null {
  try {
    const parsed = JSON.parse(content);
    const diagnosis = cleanText(parsed?.diagnosis, 240);
    const rawCategories = Array.isArray(parsed?.categories) ? parsed.categories : [];
    const categories = rawCategories.slice(0, 8).map((rawCategory: any, categoryIndex: number) => {
      const label = cleanText(rawCategory?.label, 54);
      const description = cleanText(rawCategory?.description, 120);
      const rawOptions = Array.isArray(rawCategory?.options) ? rawCategory.options : [];
      const options = rawOptions.slice(0, 5).map((rawOption: any, optionIndex: number) => {
        const optionLabel = cleanText(rawOption?.label, 54);
        const prompt = cleanText(rawOption?.prompt, 500);
        const imagePrompt = cleanText(rawOption?.imagePrompt || rawOption?.image_prompt, 320);
        const target = cleanText(rawOption?.target, 80) || label;
        const searchTerms = Array.isArray(rawOption?.searchTerms)
          ? rawOption.searchTerms.map((term: unknown) => cleanText(term, 60)).filter(Boolean).slice(0, 8)
          : [label, optionLabel].filter(Boolean);
        if (!optionLabel || !prompt) return null;
        return {
          id: cleanText(rawOption?.id, 70) || `${slug(label)}-${slug(optionLabel)}-${optionIndex}`,
          label: optionLabel,
          prompt: `${prompt} Change only ${target}. Preserve every unrelated surface and object, the camera, physical layout, and exact fixture or zone count. Use correct scale, coordinated materials, clean transitions, and plausible construction.`,
          imagePrompt:
            imagePrompt ||
            `Exactly one ${optionLabel.toLowerCase()} ${label.toLowerCase()} selection, shown large and clearly enough to identify the actual item being chosen.`,
          imageUrl: "",
          budgetDelta: normalizedBudgetDelta(rawOption?.budgetDelta),
          target,
          searchTerms,
        } satisfies V8RefinementOption;
      }).filter((option: V8RefinementOption | null): option is V8RefinementOption => Boolean(option));
      if (!label || options.length !== 5) return null;
      return {
        id: cleanText(rawCategory?.id, 70) || `${slug(label)}-${categoryIndex}`,
        label,
        description: description || "Five scoped visual directions.",
        options,
      } satisfies V8RefinementCategory;
    }).filter((category: V8RefinementCategory | null): category is V8RefinementCategory => Boolean(category));
    if (categories.length < 5) return null;
    return { diagnosis, categories };
  } catch {
    return null;
  }
}

function tokenize(values: string[]): Set<string> {
  return new Set(values.join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((token) => token.length > 2));
}

function categoriesShareSubject(a: V8RefinementCategory, b: V8RefinementCategory): boolean {
  const roots = (category: V8RefinementCategory) =>
    new Set(Array.from(tokenize([category.label])).map((token) => token.slice(0, 5)));
  const aRoots = roots(a);
  return Array.from(roots(b)).some((root) => aRoots.has(root));
}

function attachCatalogImages(
  key: string,
  categories: V8RefinementCategory[],
  assets: CatalogImage[]
): V8RefinementCategory[] {
  const used = new Set<string>();
  return categories.map((category) => ({
    ...category,
    options: category.options.map((option, optionIndex) => {
      const subjectTerms = tokenize([category.label, option.target || ""]);
      const choiceTerms = tokenize([option.label]);
      const ranked = assets
        .map((asset) => ({
          asset,
          subjectHits: Array.from(subjectTerms).reduce(
            (score, term) => score + (asset.searchText.includes(term) ? 1 : 0),
            0
          ),
          choiceHits: Array.from(choiceTerms).reduce(
            (score, term) => score + (asset.searchText.includes(term) ? 1 : 0),
            0
          ),
        }))
        .filter((entry) => entry.subjectHits > 0 && entry.choiceHits > 0)
        .sort((a, b) => (b.subjectHits * 4 + b.choiceHits * 2) - (a.subjectHits * 4 + a.choiceHits * 2));
      const chosen = ranked.find((entry) => !used.has(entry.asset.imageUrl))?.asset;
      const curated = curatedItemPreview(
        key,
        category.label,
        option.target || category.description,
        option.label,
        optionIndex
      );
      const imageUrl = curated.startsWith(BATHROOM_ITEM_ROOT)
        ? curated
        : chosen?.imageUrl || curated;
      used.add(imageUrl);
      return { ...option, imageUrl, fallbackImageUrl: curated };
    }),
  }));
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { instanceId } = await ctx.params;
  const id = cleanText(instanceId, 120);
  const body = await request.json().catch(() => ({}));
  const serviceId = cleanText(body?.serviceId, 120);
  const suppliedServiceLabel = cleanText(body?.serviceLabel, 100);
  const imageUrl = cleanText(body?.imageUrl, 4_000);
  const scopes = Array.isArray(body?.scopes)
    ? body.scopes.map((scope: unknown) => cleanText(scope, 100)).filter(Boolean).slice(0, 16)
    : [];
  const budget = Math.max(0, Math.round(Number(body?.budget) || 0));
  if (!id || !serviceId || !/^https?:\/\//i.test(imageUrl)) {
    return NextResponse.json({ ok: false, error: "invalid_request" }, { status: 400 });
  }

  try {
    const { supabase } = createSupabaseAdminClient();
    const [{ data: instance }, { data: service }] = await Promise.all([
      supabase.from("instances").select("account_id, config").eq("id", id).maybeSingle(),
      supabase
        .from("categories_subcategories")
        .select("subcategory, service_summary, subcategory_components")
        .eq("id", serviceId)
        .maybeSingle(),
    ]);
    if (!instance || !service) {
      return NextResponse.json({ ok: false, error: "service_not_found" }, { status: 404 });
    }
    const { data: activeLink } = await supabase
      .from("instance_subcategories")
      .select("category_subcategory_id")
      .eq("instance_id", id)
      .eq("category_subcategory_id", serviceId)
      .limit(1)
      .maybeSingle();
    const configuredServices = Array.isArray((instance as any)?.config?.aiFormConfig?.services)
      ? (instance as any).config.aiFormConfig.services
          .map((value: unknown) => cleanText(value, 120))
          .filter(Boolean)
      : [];
    if (!activeLink && !configuredServices.includes(serviceId)) {
      return NextResponse.json({ ok: false, error: "service_not_active" }, { status: 404 });
    }
    const serviceLabel = cleanText((service as any).subcategory, 100) || suppliedServiceLabel || "Project";
    const key = serviceKey(serviceLabel);
    const baseFallback = fallbackCatalog(key);
    const accountId = cleanText((instance as any).account_id, 120);
    let assetsQuery = supabase
      .from("images")
      .select("image_url, metadata")
      .eq("subcategory_id", serviceId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(120);
    if (accountId) assetsQuery = assetsQuery.or(`account_id.is.null,account_id.eq.${accountId}`);
    const { data: imageRows } = await assetsQuery;
    const assets: CatalogImage[] = (imageRows || []).map((row: any) => ({
      imageUrl: cleanText(row?.image_url, 4_000),
      searchText: JSON.stringify(row?.metadata || {}).toLowerCase(),
    })).filter((asset: CatalogImage) => /^https?:\/\//i.test(asset.imageUrl));

    let aiCatalog: { diagnosis: string; categories: V8RefinementCategory[] } | null = null;
    const apiKey = process.env.GROQ_API_KEY;
    if (apiKey) {
      try {
        const components = Array.isArray((service as any).subcategory_components)
          ? (service as any).subcategory_components
              .map((component: any) => cleanText(component?.label || component?.name || component?.key, 80))
              .filter(Boolean)
              .slice(0, 20)
          : [];
        const groq = new Groq({ apiKey });
        const model = String(process.env.V8_REFINEMENT_CATALOG_VISION_MODEL || process.env.CONCEPT_SUGGESTIONS_VISION_MODEL || "qwen/qwen3.6-27b").replace(/^groq\//, "");
        const context = JSON.stringify({
          task: "Inspect this design and build its compact visual refinement subsystem.",
          selectedService: serviceLabel,
          serviceSummary: cleanText((service as any).service_summary || body?.serviceSummary, 600),
          configuredComponents: components,
          selectedScopes: scopes,
          budget,
          requirements: [
            "Return 6 to 8 useful categories and exactly 5 options per category.",
            "Categories should be common parts a customer can visually recognize, such as faucets, vanities, toilets, tile, paint, planting, paving, cabinetry, or lighting—only when applicable.",
            "Ground categories in components visible in the image and the selected service/scope.",
            "Inventory every distinct editable component or surface visible in the image before choosing categories. Cover the 6 to 8 most useful visible items; do not stop at four.",
            "Each category should represent one component or surface. Do not combine unrelated items such as lighting and mirrors or countertops and backsplash.",
            "Every option prompt must say whether it changes one component or the whole design, preserve unrelated items, and preserve exact fixture/zone counts.",
            "Every option must include imagePrompt: a concrete product-only description of the exact single item or material selection to render as its thumbnail. It must name the category subject and visible defining traits; never describe a whole room.",
            "Translate negative or insulting wording into positive professional design intent; never make anything intentionally ugly or cheap.",
            "Use a restrained residential designer's eye: correct scale, material coordination, buildability, and proportion.",
            "budgetDelta is a realistic multiple of 500 between -15000 and 15000; use 0 when price should not materially change.",
          ],
        });
        const completion = await groq.chat.completions.create({
          model,
          temperature: 0.35,
          top_p: 0.8,
          reasoning_effort: "none",
          max_completion_tokens: 4_000,
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                "You are a practical residential design director building a visual editing menu from a supplied project image. " +
                "Return strict JSON with diagnosis and categories. Schema: " +
                '{"diagnosis":"one sentence","categories":[{"id":"slug","label":"category","description":"short","options":[{"id":"slug","label":"2-5 words","prompt":"complete scoped positive image-edit instruction","imagePrompt":"one exact isolated product or material thumbnail description","target":"component","budgetDelta":0,"searchTerms":["material","component"]}]}]}.',
            },
            {
              role: "user",
              content: [
                { type: "text", text: context },
                { type: "image_url", image_url: { url: imageUrl } },
              ] as any,
            },
          ],
        });
        aiCatalog = parseAiCatalog(completion.choices[0]?.message?.content || "");
      } catch (error) {
        logger.warn("[adventure-v8:refinement-catalog] vision fallback", {
          instanceId: id,
          serviceId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const aiCategories = aiCatalog
      ? [
          ...aiCatalog.categories,
          ...baseFallback.categories.filter((fallbackCategory) =>
            !aiCatalog.categories.some((category) =>
              category.id === fallbackCategory.id || categoriesShareSubject(category, fallbackCategory)
            )
          ),
        ].slice(0, 8)
      : null;
    const sourceCatalog = aiCatalog && aiCategories
      ? { source: "vision" as const, diagnosis: aiCatalog.diagnosis, categories: aiCategories }
      : { ...baseFallback, source: "service" as const };
    const canonicalCategories = canonicalizeCuratedOptions(
      key,
      sourceCatalog.categories,
      baseFallback.categories
    );
    const categories = attachCatalogImages(key, canonicalCategories, assets);
    return NextResponse.json(
      { ok: true, source: sourceCatalog.source, diagnosis: sourceCatalog.diagnosis, categories },
      { headers: { "Cache-Control": "private, max-age=300" } }
    );
  } catch (error) {
    logger.error("[adventure-v8:refinement-catalog] failed", {
      instanceId: id,
      serviceId,
      error: error instanceof Error ? error.message : String(error),
    });
    const fallback = fallbackCatalog(serviceKey(suppliedServiceLabel));
    return NextResponse.json({ ok: true, ...fallback });
  }
}
