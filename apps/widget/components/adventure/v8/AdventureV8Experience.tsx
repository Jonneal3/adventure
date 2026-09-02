"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Camera, Download, LockOpen, Maximize2, Share2 } from "lucide-react";

import { BrandHeader } from "@/components/widget/BrandHeader";
import { AdventureLoader, type AdventureLoaderPhase } from "@/components/form/AdventureLoader";
import { FormThemeProvider } from "@/components/form/demo/FormThemeProvider";
import {
  AdventureActionBar,
  AdventureButton,
  AdventureChoiceCard,
  AdventureInput,
  AdventureStepShell,
  AdventureUiProvider,
} from "../shared/AdventureUi";
import { withWidgetDesignDefaults } from "@/lib/widget-design-defaults";
import type { DesignSettings } from "@/types/design";

import type { ServiceOption } from "../v2/types";
import { v2ScopeStarterKey } from "@/lib/adventure-v2/scope-starter-catalog";
import css from "./configurator-v8.module.css";
import {
  buildRefinementPlan,
  catalogTags,
  curateGalleryProjectDiversity,
  DISCOVERY_MODELS,
  finishTiersForScope,
  formatChipBand,
  layoutChoicesForProject,
  normalizeFinishTier,
  pinAspectRatio,
  pinEstimate,
  priceForFinishTier,
  projectEstimateForBand,
  proposeClientBudgetBounds,
  scopeBudgetMultiplier,
  splitMasonryColumns,
  splitFinishTiers,
  tooExpensiveForBudget,
  tightenPriceRangeForDisplay,
  withinBudgetWindow,
  withOpenEndedTop,
  type RefinementPlan,
} from "./generationRecipes";
import {
  buildScopeQuestion,
  lookConflictsWithService,
  lookFitsSelectedScopes,
  looksLikeMaterialSwatch,
  projectMode,
  verticalKey,
} from "./scopeRecipes";
import {
  analyzeV8ProjectManifest,
  callAdventurePipeline,
  curateAdventureImages,
  fetchV8RefinementCatalog,
  generateV8RefinementOptionImages,
  generateV8DesignImage,
  type V8DesignPayload,
} from "./adventurePipelineClient";
import type {
  V8BudgetBounds,
  V8Estimate,
  V8FinishTier,
  V8FinishTierId,
  V8GeneratedImage,
  V8IntakeChoice,
  V8IntakeQuestion,
  V8ProjectSnapshot,
  V8ProjectManifest,
  V8RefinementCatalog,
  V8RefinementOption,
  V8Stage,
  V8State,
  V8VisualDirection,
} from "./types";
import { clearV8Snapshot, getOrCreateV8SessionId, loadV8Snapshot, saveV8Snapshot } from "./storage";
import { adventureCopy, languageForIndustry, localityFromInstance } from "./adventureCopy";
import { galleryPricingLabel } from "./galleryEnrichment";

export type AdventureV8ExperienceProps = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
  uiVersion?: "v8" | "v9";
};

const STAGE_ORDER: V8Stage[] = [
  "service",
  "project",
  "budget",
  "path",
  "style",
  "visual",
  "price",
  "connect",
  "done",
];

const REFINE_LIMIT = 8;
const STARTER_CUE = "Starter canvas";
// Fetch the durable catalog once, then reveal a curated eight-project batch at a time.
const PRICING_GALLERY_MAX = 120;
const PRICING_GALLERY_PAGE_SIZE = 8;
const PRICING_BREAKDOWN_MAX_ITEMS = 8;
const PRICING_PIN_ASPECTS = ["5 / 6", "4 / 3", "3 / 5", "1 / 1", "2 / 3", "5 / 4", "3 / 4"] as const;
const FALLBACK_GALLERY_STYLE_TITLES = [
  "Warm modern",
  "Light and airy",
  "Clean contemporary",
  "Soft neutral",
  "Natural minimal",
  "Classic bright",
  "Relaxed organic",
  "Simple refined",
  "Fresh timeless",
  "Calm modern",
] as const;

const CONNECT_OPTIONS = [
  { id: "quote", label: "Request a quote" },
  { id: "talk", label: "Talk to the business" },
  {
    id: "photo_application",
    label: "Apply this design to my actual space",
    noPhotoOnly: true,
  },
];

const FALLBACK_SERVICES: ServiceOption[] = [
  {
    value: "bathroom-remodel",
    label: "Bathroom Remodel",
    serviceName: "Bathroom Remodel",
    photoSubject: "bathroom",
    photoContext: "the actual space, condition, size, and details that affect price",
  },
  {
    value: "kitchen-remodel",
    label: "Kitchen Remodel",
    serviceName: "Kitchen Remodel",
    photoSubject: "kitchen",
    photoContext: "the actual space, condition, size, and details that affect price",
  },
  {
    value: "flooring",
    label: "Flooring",
    serviceName: "Flooring",
    photoSubject: "room",
    photoContext: "the actual floor area, condition, layout, and details that affect price",
  },
  {
    value: "pergola",
    label: "Pergola",
    serviceName: "Pergola",
    photoSubject: "outdoor space",
    photoContext: "the actual space, condition, size, and site details that affect price",
  },
  {
    value: "landscaping",
    label: "Landscaping",
    serviceName: "Landscaping",
    photoSubject: "yard",
    photoContext: "the actual space, condition, size, and site details that affect price",
  },
];

const SERVICE_COVERS: Record<string, string[]> = {
  bathroom: [
    "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&q=80",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80",
    "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&q=80",
    "https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?w=800&q=80",
    "https://images.unsplash.com/photo-1656646523409-46f291d67d2a?w=800&q=80",
    "https://images.unsplash.com/photo-1638799869566-b17fa794c4de?w=800&q=80",
    "https://images.unsplash.com/photo-1726572945278-1fa9f6fbd3f6?w=800&q=80",
    "https://images.unsplash.com/photo-1696987007764-7f8b85dd3033?w=800&q=80",
    "https://images.unsplash.com/photo-1723258339959-61093d7d86d3?w=800&q=80",
  ],
  kitchen: [
    "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=800&q=80",
    "https://images.unsplash.com/photo-1556911220-bff31c5750ea?w=800&q=80",
    "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=800&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
    "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80",
    "https://images.unsplash.com/photo-1556909172-54557c7e4fb7?w=800&q=80",
    "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80",
  ],
  landscaping: [
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
    "https://images.unsplash.com/photo-1598902108854-10e335adac99?w=800&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&q=80",
  ],
  flooring: [
    "https://images.unsplash.com/photo-1581858726788-75bc52f2598f?w=800&q=80",
    "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80",
    "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
    "https://images.unsplash.com/photo-1581858726788-75bc52f2598f?w=800&q=80",
    "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=800&q=80",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80",
  ],
};

const PHOTO_INPUT_EXAMPLES: Record<string, string> = {
  bathroom: "/adventure/upload-examples/bathroom-phone-photo.webp",
  landscaping: "/visual-pricing/courtyard-before.png",
};

type QuickRefinementOption = {
  id: string;
  label: string;
  prompt: string;
  imageIndex?: number;
  imageUrl?: string;
  budgetDelta?: number;
  palette?: [string, string, string];
};

type RefinementReference = {
  kind: "style" | "item" | "space";
  label: string;
  target?: string;
  stylePrompt?: string;
  imageUrl?: string;
};

type PricingWhatIfLevel = "simpler" | "as-shown" | "upgrade" | "remove";
type PricingOverallDirection = "simpler" | "as-shown" | "upgrade";
type PricingRefinementSuggestion = {
  id: string;
  label: string;
  prompt: string;
};

const PRICING_WHAT_IF_LEVELS: Array<{
  id: PricingWhatIfLevel;
  label: string;
  multiplier: number;
}> = [
  { id: "simpler", label: "Simpler", multiplier: 0.82 },
  { id: "as-shown", label: "As shown", multiplier: 1 },
  { id: "upgrade", label: "Upgrade", multiplier: 1.28 },
];

function pricingWhatIfMultiplier(level: PricingWhatIfLevel): number {
  if (level === "remove") return 0;
  return PRICING_WHAT_IF_LEVELS.find((option) => option.id === level)?.multiplier || 1;
}

function canRemovePricingItem(item: string): boolean {
  return /light|storage|cabinet|accessor|mirror|backsplash|wall tile|landscap|plant|seating/i.test(item);
}

function pricingWhatIfPrompt(item: string, level: PricingWhatIfLevel): string {
  const boundary = `Change only the existing ${item}. Preserve the camera, layout, architecture, and every unrelated item exactly as shown.`;
  if (level === "simpler") {
    return `${boundary} Replace it in place with a clean, practical, value-focused version using standard materials and straightforward detailing. Do not make the room look unfinished or cheap.`;
  }
  if (level === "upgrade") {
    return `${boundary} Upgrade it in place by one realistic quality tier with visibly better materials, finish, hardware, and detailing. Keep the result buildable and restrained.`;
  }
  if (level === "remove") {
    return `${boundary} Remove it cleanly and finish the immediately surrounding surface naturally. Do not remove or alter anything else.`;
  }
  return `${boundary} Return it to the original example's as-shown quality, materials, and detailing while preserving every other customization.`;
}

function localPricingRefinementSuggestions(target: string): PricingRefinementSuggestion[] {
  const key = String(target || "Anywhere").toLowerCase();
  const rows = /faucet|fixture|hardware|shower|tub/.test(key)
    ? [
        ["polished-chrome", "Polished chrome", "Replace the visible fixture finish with polished chrome."],
        ["brushed-nickel", "Brushed nickel", "Replace the visible fixture finish with brushed nickel."],
        ["matte-black", "Matte black", "Replace the visible fixture finish with matte black."],
      ]
    : /vanity|cabinet|storage/.test(key)
      ? [
          ["lighter-wood", "Lighter wood", "Use a lighter natural wood finish with restrained grain."],
          ["painted-finish", "Painted finish", "Use a clean painted cabinet finish that fits the room."],
          ["more-storage", "More storage", "Improve the visible storage within the existing footprint."],
        ]
      : /tile|floor|counter|surface|backsplash/.test(key)
        ? [
            ["large-format", "Larger tile", "Use a larger-format tile with fewer grout lines."],
            ["warmer-surface", "Warmer tone", "Use a warmer surface color that fits the current palette."],
            ["lighter-grout", "Lighter grout", "Use lighter coordinated grout while preserving the tile layout."],
          ]
        : /light/.test(key)
          ? [
              ["warmer-light", "Warmer light", "Use warmer, softer lighting fixtures in the existing locations."],
              ["simpler-light", "Cleaner fixtures", "Use simpler, cleaner-lined lighting fixtures."],
              ["statement-light", "Statement light", "Use one restrained statement light in the existing location."],
            ]
          : [
              ["warmer", "Make it warmer", "Make the materials and palette feel warmer and more inviting."],
              ["more-modern", "More modern", "Make the visible finishes cleaner and more modern."],
              ["more-contrast", "Add contrast", "Add tasteful visual contrast while keeping the design cohesive."],
            ];
  return rows.map(([id, label, prompt]) => ({ id, label, prompt }));
}

const FULL_ROOM_STYLES: QuickRefinementOption[] = [
  {
    id: "warm-minimal",
    label: "Warm minimal",
    imageIndex: 0,
    palette: ["#eee9de", "#b99163", "#6e6960"],
    prompt:
      "Match the Warm minimal card's exact visual language throughout the existing room: dominant warm ivory and pale sand surfaces, light honey-oak flat-panel vanity or cabinetry, quiet cream limestone-look counters and large matte tile, low-contrast grout, slim brushed-nickel plumbing, thin dark bronze mirror frames, and soft diffused daylight. Remove conflicting high-contrast color, ornate detailing, dark cabinetry, and busy accent bands. Keep every component in its current position and do not add anything.",
  },
  {
    id: "organic-spa",
    label: "Organic spa",
    imageIndex: 1,
    palette: ["#dbe5dc", "#7f9d88", "#314b3e"],
    prompt:
      "Match the Organic spa card's exact visual language throughout the existing room: make eucalyptus and sage green the dominant palette, using medium sage-green large-format tile across the existing wet-zone walls and other appropriate tiled surfaces, a slightly deeper forest-sage tone on compatible painted or cabinetry surfaces, crisp white sanitary fixtures, transparent glass with thin matte-black framing, and minimal black or dark graphite plumbing hardware. Use calm natural daylight and very restrained forms. Remove conflicting beige marble, cream travertine, tan mosaic bands, honey oak, brass, and warm brown as dominant finishes. Change existing surfaces and item styling only; preserve the exact layout and inventory.",
  },
  {
    id: "modern-contrast",
    label: "Modern contrast",
    imageIndex: 2,
    palette: ["#f1f1ef", "#9ea2a0", "#22282a"],
    prompt:
      "Match the Modern contrast card's exact visual language throughout the existing room: an almost monochrome field of crisp white and very light cool-gray large-format tile, pure white sanitary fixtures, thin matte-black shower framing and plumbing, minimal square-edged forms, frameless clear glass, and sharp daylight with clean shadows. Existing cabinetry should become flat-front white, pale gray, or charcoal only when needed for contrast. Remove beige, brown wood grain, tan decorative bands, warm brass, and traditional ornament. Preserve all geometry, locations, openings, and fixture counts.",
  },
  {
    id: "terracotta",
    label: "Mediterranean clay",
    imageIndex: 3,
    palette: ["#f0d1b6", "#b76f54", "#6f493b"],
    prompt:
      "Match the Mediterranean clay card's exact visual language throughout the existing room: saturated but natural terracotta and burnt-clay rectangular tile across the existing wet-zone and appropriate tiled surfaces, softly varied clay grout, warm off-white plaster on non-tiled walls, clear glass, aged bronze plumbing, and crisp white sanitary fixtures for contrast. Remove cool gray, blue, green, marble veining, and decorative mosaic bands. Do not recolor doors or plumbing objects terracotta. Preserve the exact layout and fixture count.",
  },
  {
    id: "quiet-traditional",
    label: "Quiet traditional",
    imageIndex: 4,
    palette: ["#f2ede4", "#a78062", "#4e3329"],
    prompt:
      "Match the Quiet traditional card's exact visual language throughout the existing room: warm white walls and counters, medium walnut inset-panel vanity cabinetry, simple warm-oak flooring or quiet cream tile where appropriate, dark oil-rubbed-bronze plumbing and clear shower framing, rectangular bronze-framed mirrors, and classic opal-shade vanity lights. Keep the result tailored and restrained rather than ornate. Remove strong color, glossy modern slab fronts, and dramatic veining. Preserve the room, component locations, and exact inventory.",
  },
  {
    id: "japandi",
    label: "Japandi",
    imageIndex: 5,
    palette: ["#ede7db", "#b98f61", "#8c9186"],
    prompt:
      "Match the Japandi card's exact visual language throughout the existing room: chalky warm-white walls, pale natural-oak slab-front cabinetry, quiet sand and light greige stone, fine vertically textured pale tile in the wet zone, brushed-nickel plumbing, thin black softly rounded mirror frames, and calm linen-like texture. Remove decorative tile bands, glossy finishes, ornate profiles, saturated colors, and high contrast. Keep all architecture, openings, components, and fixture counts exactly where they are.",
  },
  {
    id: "soft-contemporary",
    label: "Soft contemporary",
    imageIndex: 6,
    palette: ["#e7e6e3", "#a0a29f", "#5b5f5d"],
    prompt:
      "Match the Soft contemporary card's exact visual language throughout the existing room: layered light-to-medium warm gray porcelain tile, soft white walls, a long flat-front mushroom-gray vanity where cabinetry exists, white counters and sanitary fixtures, frameless glass, brushed-nickel shower hardware, thin dark rounded mirrors, and compact warm shaded sconces. Remove beige marble, mosaic accent strips, wood ornament, saturated color, and traditional profiles. Preserve the room geometry, camera, and exact fixture inventory.",
  },
  {
    id: "boutique-hotel",
    label: "Boutique hotel",
    imageIndex: 7,
    palette: ["#d6c1a2", "#7a593b", "#2b2825"],
    budgetDelta: 5_000,
    prompt:
      "Match the Boutique hotel card's exact visual language throughout the existing room: deep walnut furniture-style cabinetry, charcoal-brown honed stone counters and wet-zone tile, black-framed glass, dark bronze or black plumbing, tall black-framed mirrors, sculptural warm wall sconces, concealed amber niche lighting, and a softly worn taupe floor. Remove bright white tile fields, pale oak, chrome, decorative mosaic bands, and cool clinical lighting. Upgrade existing items only; preserve the physical layout and exact fixture count.",
  },
  {
    id: "coastal-natural",
    label: "Coastal natural",
    imageIndex: 0,
    palette: ["#f2eee3", "#8fa59a", "#b18d5d"],
    prompt:
      "Match the Coastal natural card's exact visual language throughout the existing room: sun-washed off-white walls and limestone-look floors, pale washed-oak inset cabinetry, subtly irregular pearly off-white wet-zone tile, sea-glass green textiles or very restrained accents, warm brushed-brass plumbing and hardware, thin brass mirror frames, white sanitary fixtures, and bright natural light. Remove dark tile, black fixtures, heavy contrast, mosaic bands, and overt nautical decoration. Preserve the exact layout and fixture count.",
  },
];

const CURATED_STYLE_REFERENCES: Record<string, Record<string, string>> = {
  bathroom: {
    "warm-minimal": "/adventure/style-references/bathroom/warm-minimal.jpg",
    "organic-spa": "/adventure/style-references/bathroom/organic-spa.jpg",
    "modern-contrast": "/adventure/style-references/bathroom/modern-contrast.jpg",
    terracotta: "/adventure/style-references/bathroom/mediterranean-clay.jpg",
    "quiet-traditional": "/adventure/style-references/bathroom/quiet-traditional.jpg",
    japandi: "/adventure/style-references/bathroom/japandi.jpg",
    "soft-contemporary": "/adventure/style-references/bathroom/soft-contemporary.jpg",
    "boutique-hotel": "/adventure/style-references/bathroom/boutique-hotel.jpg",
    "coastal-natural": "/adventure/style-references/bathroom/coastal-natural.jpg",
  },
};

const ITEM_REFINEMENTS: Record<string, QuickRefinementOption[]> = {
  bathroom: [
    {
      id: "copper-fixtures",
      label: "Copper fixtures",
      imageIndex: 1,
      prompt:
        "Change only the visible faucets, shower trim, handles, and bathroom hardware to a refined brushed copper finish. Keep the vanity, tile, walls, doors, layout, and exact fixture count unchanged.",
    },
    {
      id: "walnut-vanity",
      label: "Walnut vanity",
      imageIndex: 3,
      prompt:
        "Change only the vanity to a well-proportioned natural walnut vanity with clean drawer fronts and a modest stone top. Preserve its location and size; keep the rest of the bathroom unchanged.",
    },
    {
      id: "frameless-glass",
      label: "Frameless glass",
      imageIndex: 4,
      prompt:
        "Change only the existing shower enclosure to clean frameless glass with minimal hardware. Do not add a shower, tub, toilet, vanity, or extra plumbing fixture, and keep the room layout unchanged.",
    },
    {
      id: "handmade-tile",
      label: "Handmade tile",
      imageIndex: 5,
      prompt:
        "Change only the visible bathroom tile to a softly varied handmade-look ceramic tile with realistic grout and professional alignment. Keep fixtures, doors, walls outside the tiled areas, and layout unchanged.",
    },
    {
      id: "designer-lighting",
      label: "Designer lighting",
      imageIndex: 6,
      budgetDelta: 2500,
      prompt:
        "Upgrade only the existing bathroom lighting with flattering, well-scaled designer sconces and balanced warm illumination. Keep the mirror, vanity, plumbing fixtures, walls, layout, and exact fixture count unchanged.",
    },
  ],
  kitchen: [
    {
      id: "brass-hardware",
      label: "Brass hardware",
      imageIndex: 1,
      prompt:
        "Change only the visible cabinet pulls, faucet, and kitchen hardware to restrained brushed brass. Keep cabinets, counters, appliances, doors, windows, and layout unchanged.",
    },
    {
      id: "oak-cabinetry",
      label: "Natural oak",
      imageIndex: 3,
      prompt:
        "Change only the existing cabinet fronts to refined natural oak with consistent grain and simple detailing. Preserve every cabinet position, appliance, opening, counter, and the room layout.",
    },
    {
      id: "stone-backsplash",
      label: "Stone backsplash",
      imageIndex: 4,
      prompt:
        "Change only the backsplash to a calm natural stone slab with realistic seams and scale. Preserve cabinetry, counters, appliances, lighting, and room geometry.",
    },
    {
      id: "pendant-lighting",
      label: "Pendant lights",
      imageIndex: 5,
      prompt:
        "Upgrade only the existing kitchen lighting with well-scaled designer pendant fixtures. Do not add an island or move cabinets, appliances, doors, or windows.",
    },
    {
      id: "workstation-sink",
      label: "Workstation sink",
      imageIndex: 6,
      budgetDelta: 3500,
      prompt:
        "Upgrade only the existing kitchen sink to a well-proportioned workstation sink with a refined matching faucet. Preserve its exact location, the cabinetry, counters, appliances, openings, and room layout.",
    },
  ],
  landscaping: [
    {
      id: "cedar-pergola",
      label: "Cedar pergola",
      imageIndex: 1,
      prompt:
        "Add one appropriately scaled cedar pergola over the existing main seating or patio zone. Preserve the lot, house, paths, planting zones, camera, and all other outdoor zones; do not duplicate the patio.",
    },
    {
      id: "limestone-pavers",
      label: "Limestone pavers",
      imageIndex: 2,
      prompt:
        "Change only the existing hardscape paving to warm limestone pavers with realistic scale, joints, and drainage. Preserve planting beds, lawn, structures, and the exact outdoor layout.",
    },
    {
      id: "layered-planting",
      label: "Layered planting",
      imageIndex: 3,
      prompt:
        "Upgrade only the existing planting beds with restrained layered shrubs, grasses, and perennials appropriate to the site. Keep paths, lawn, structures, zones, and camera unchanged.",
    },
    {
      id: "fire-feature",
      label: "Fire feature",
      imageIndex: 4,
      prompt:
        "Add one modest built-in fire feature within the existing seating zone. Do not create a second patio, seating area, kitchen, pergola, pool, or duplicated outdoor zone; preserve the overall plan.",
    },
    {
      id: "landscape-lighting",
      label: "Landscape lighting",
      imageIndex: 5,
      budgetDelta: 2500,
      prompt:
        "Add a restrained low-voltage lighting layer to the existing paths and planting zones using a few well-placed fixtures. Preserve the site plan, structures, planting, hardscape, and all zone counts.",
    },
  ],
  flooring: [
    {
      id: "wide-plank-oak",
      label: "Wide-plank oak",
      imageIndex: 1,
      prompt:
        "Change only the visible flooring to natural wide-plank white oak with realistic board width, grain, and installation. Preserve walls, openings, furniture, cabinetry, and camera.",
    },
    {
      id: "herringbone",
      label: "Herringbone",
      imageIndex: 2,
      prompt:
        "Change only the existing floor to a correctly scaled oak herringbone installation with straight boundaries and realistic transitions. Preserve the entire room and all objects above the floor.",
    },
    {
      id: "warm-limestone",
      label: "Warm limestone",
      imageIndex: 3,
      prompt:
        "Change only the visible floor to warm honed limestone tile with realistic sizing, grout, and edge alignment. Keep the room structure, furnishings, and camera unchanged.",
    },
    {
      id: "dark-walnut-floor",
      label: "Dark walnut",
      imageIndex: 4,
      prompt:
        "Change only the visible flooring to refined dark walnut planks with realistic grain and a low-sheen finish. Preserve all walls, fixtures, furnishings, and room geometry.",
    },
    {
      id: "clean-transitions",
      label: "Clean transitions",
      imageIndex: 5,
      budgetDelta: 1000,
      prompt:
        "Improve only the visible flooring transitions, perimeter cuts, thresholds, and board alignment so the installation looks precise and buildable. Preserve the floor material, room, objects, walls, and camera.",
    },
  ],
  default: [
    {
      id: "brushed-brass",
      label: "Brushed brass",
      imageIndex: 1,
      prompt:
        "Change only the visible hardware and fixtures to restrained brushed brass. Keep all surrounding materials, objects, doors, windows, layout, and camera unchanged.",
    },
    {
      id: "natural-oak",
      label: "Natural oak",
      imageIndex: 2,
      prompt:
        "Change only the primary existing millwork or cabinetry finish to refined natural oak. Preserve its location, proportions, all other materials, and the complete room layout.",
    },
    {
      id: "statement-lighting",
      label: "Better lighting",
      imageIndex: 3,
      prompt:
        "Upgrade only the existing light fixtures with well-scaled designer lighting and more natural illumination. Do not add architectural features or change the room layout.",
    },
    {
      id: "textured-stone",
      label: "Textured stone",
      imageIndex: 4,
      prompt:
        "Change only the primary existing feature surface to understated textured natural stone. Preserve doors, windows, fixtures, furniture, camera, and layout.",
    },
    {
      id: "tailored-millwork",
      label: "Tailored millwork",
      imageIndex: 5,
      budgetDelta: 5000,
      prompt:
        "Refine only the existing primary millwork with more tailored proportions, consistent reveals, and professional detailing. Do not add new built-ins or change doors, windows, fixtures, camera, or layout.",
    },
  ],
};

const VIEW_REFINEMENTS: QuickRefinementOption[] = [
  {
    id: "same-view",
    label: "Keep this view",
    prompt:
      "Keep this exact camera view and framing. Make no camera or layout change; preserve the complete fixture and zone inventory.",
  },
  {
    id: "side-view",
    label: "Side view",
    prompt:
      "Show a side-view variation of this exact same space from roughly 45 degrees to the right. Change only the camera position; preserve room geometry, layout, finishes, and the exact fixture or zone inventory.",
  },
  {
    id: "wide-view",
    label: "Wider view",
    prompt:
      "Show a slightly wider view of this exact same space. Change only the camera framing; do not invent additional walls, floor area, fixtures, furniture, or outdoor zones.",
  },
];

const BUDGET_REFINEMENT_MIN_STEP = 500;
const BUDGET_REFINEMENT_MAX_STEP = 2_000;

function budgetRefinementStepFor(budget: number): number {
  const amount = Math.max(0, Math.round(Number(budget) || 0));
  if (amount < 10_000) return BUDGET_REFINEMENT_MIN_STEP;
  if (amount < 25_000) return 1_000;
  return BUDGET_REFINEMENT_MAX_STEP;
}

function isOther(label: string): boolean {
  return /^other$/i.test(String(label || "").trim());
}

function isFullScopeChoice(choice: V8IntakeChoice): boolean {
  return choice.role === "full" || choice.id === "full";
}

function isFullScopeLabel(label: string, question: V8IntakeQuestion | null): boolean {
  const full = question?.choices.find(isFullScopeChoice);
  if (
    full && (
      label === full.label ||
      label === full.id ||
      v2ScopeStarterKey(label) === v2ScopeStarterKey(full.label) ||
      v2ScopeStarterKey(label) === v2ScopeStarterKey(full.id)
    )
  ) return true;
  return false;
}

function selectedScopeBreakdownItems(
  selectedScopes: string[],
  question: V8IntakeQuestion | null
): string[] {
  const fullProjectSelected = selectedScopes.some((item) => isFullScopeLabel(item, question));
  if (fullProjectSelected) {
    return uniqueProjectItems(
      (question?.choices || [])
        .filter((choice) => !isFullScopeChoice(choice) && !isOther(choice.label))
        .map((choice) => choice.label.trim())
        .filter(Boolean)
    ).slice(0, PRICING_BREAKDOWN_MAX_ITEMS);
  }
  return uniqueProjectItems(
    selectedScopes
      .map((item) => item.trim())
      .filter((item) => item && !isFullScopeLabel(item, question) && !isOther(item))
  ).slice(0, PRICING_BREAKDOWN_MAX_ITEMS);
}

function uniqueProjectItems(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = v2ScopeStarterKey(item);
    if (!item || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function projectItemChoiceLabel(item: string, question: V8IntakeQuestion | null): string | null {
  const clean = String(item || "").trim();
  const key = v2ScopeStarterKey(clean);
  const choice = question?.choices.find((candidate) =>
    !isFullScopeChoice(candidate) &&
    !isOther(candidate.label) &&
    (v2ScopeStarterKey(candidate.label) === key || v2ScopeStarterKey(candidate.id) === key)
  );
  return choice?.label.trim() || null;
}

function projectItemLabel(item: string, question: V8IntakeQuestion | null): string {
  const clean = String(item || "").trim();
  return projectItemChoiceLabel(clean, question) || clean;
}

function normalizeProjectManifest(raw: unknown): V8ProjectManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, any>;
  const componentRows = Array.isArray(source.components)
    ? source.components
    : Array.isArray(source.contains)
      ? source.contains
      : [];
  const components = uniqueProjectItems(
    componentRows
      .map((component) =>
        typeof component === "string"
          ? component
          : String(component?.label || component?.key || "").trim()
      )
      .filter(Boolean)
  ).map((label) => {
    const original = componentRows.find((component) =>
      v2ScopeStarterKey(typeof component === "string" ? component : component?.label || component?.key || "") ===
      v2ScopeStarterKey(label)
    );
    const confidence = Number(typeof original === "object" ? original?.confidence : source.quality_score);
    return {
      key: v2ScopeStarterKey(typeof original === "object" ? original?.key || label : label),
      label,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.7,
      quantity: Math.max(1, Number(typeof original === "object" ? original?.quantity : 1) || 1),
    };
  });
  const primaryScope = String(source.primaryScope || source.primary_scope || "").trim() || null;
  const explicitStatus = String(source.analysisStatus || source.analysis_status || "").toLowerCase();
  const analysisStatus: V8ProjectManifest["analysisStatus"] =
    explicitStatus === "rejected" || explicitStatus === "pending"
      ? explicitStatus
      : components.length
        ? "verified"
        : "rejected";
  const explicitSceneType = String(source.sceneType || source.scene_type || "").toLowerCase();
  const sceneType: V8ProjectManifest["sceneType"] =
    explicitSceneType === "full-project" || /\b(full|whole|complete|entire)\b/i.test(primaryScope || "")
      ? "full-project"
      : "component";
  return {
    version: 1,
    analysisStatus,
    sceneType,
    description: String(source.description || "").trim() || null,
    primaryScope,
    components,
    model: String(source.model || "").trim() || null,
    analyzedAt: String(source.analyzedAt || source.analyzed_at || source.tagged_at || "").trim() || null,
  };
}

function includedItemsForProject(
  look: V8GeneratedImage | null,
  selectedScopes: string[],
  question: V8IntakeQuestion | null
): string[] {
  const manifest = look?.projectManifest;
  if (!manifest || manifest.analysisStatus !== "verified") return [];
  const verified = uniqueProjectItems(
    manifest.components
      .filter((component) => component.confidence >= 0.55)
      .map((component) => projectItemLabel(component.label || component.key, question))
      .filter((item) => item && !isFullScopeLabel(item, question))
  );
  const selected = uniqueProjectItems(
    selectedScopes
      .map((item) => item.trim())
      .filter((item) => item && !isFullScopeLabel(item, question))
      .map((item) => projectItemLabel(item, question))
  );
  // Intake is customer intent; the manifest is visual truth. Quote only their
  // intersection, never the selected scope as a substitute for image evidence.
  if (selected.length) {
    const selectedKeys = new Set(selected.map(v2ScopeStarterKey));
    return verified
      .filter((item) => selectedKeys.has(v2ScopeStarterKey(item)))
      .slice(0, PRICING_BREAKDOWN_MAX_ITEMS);
  }
  return verified.slice(0, PRICING_BREAKDOWN_MAX_ITEMS);
}

function galleryFeaturesForProject(
  look: V8GeneratedImage,
  selectedScopes: string[],
  question: V8IntakeQuestion | null
): string[] {
  const verified = includedItemsForProject(look, selectedScopes, question);
  if (verified.length) return verified.slice(0, 3);
  const source = [look.primaryScope, look.scopeLabel, ...(look.includedItems || []), ...(look.tags || [])]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const inferred = (question?.choices || [])
    .filter((choice) => !isFullScopeLabel(choice.label, question) && !isOther(choice.label))
    .filter((choice) => {
      const words = choice.label
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length > 2 && !["and", "the", "area", "only"].includes(word));
      return words.length > 0 && words.every((word) => source.includes(word));
    })
    .map((choice) => choice.label);
  if (inferred.length) return uniqueProjectItems(inferred).slice(0, 3);
  return [];
}

function pricedItemsForProject(
  look: V8GeneratedImage | null,
  selectedScopes: string[],
  question: V8IntakeQuestion | null
): string[] {
  const fullProjectSelected = selectedScopes.some((item) => isFullScopeLabel(item, question));
  if (fullProjectSelected) {
    const scopedBreakdown = selectedScopeBreakdownItems(selectedScopes, question);
    if (scopedBreakdown.length) return scopedBreakdown;
  }
  return includedItemsForProject(look, selectedScopes, question);
}

function normalizeFocusRegions(raw: unknown): V8GeneratedImage["focusRegions"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const clamp = (value: unknown, fallback: number) => Math.min(100, Math.max(0, Number(value) || fallback));
  const regions: NonNullable<V8GeneratedImage["focusRegions"]> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return;
    const row = value as Record<string, unknown>;
    const x = clamp(row.x ?? row.left, 0);
    const y = clamp(row.y ?? row.top, 0);
    const width = clamp(row.width ?? row.w, 50);
    const height = clamp(row.height ?? row.h, 50);
    regions[key] = {
      x: Math.min(x, 100 - Math.max(8, width)),
      y: Math.min(y, 100 - Math.max(8, height)),
      width: Math.max(8, Math.min(width, 100 - x)),
      height: Math.max(8, Math.min(height, 100 - y)),
    };
  });
  return regions;
}

function normalizeFocusOutlines(raw: unknown): V8GeneratedImage["focusOutlines"] {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const clamp = (value: unknown) => Math.min(100, Math.max(0, Number(value) || 0));
  const outlines: NonNullable<V8GeneratedImage["focusOutlines"]> = {};
  Object.entries(raw as Record<string, unknown>).forEach(([key, value]) => {
    if (!Array.isArray(value)) return;
    const points = value
      .map((point) => {
        if (Array.isArray(point) && point.length >= 2) return { x: clamp(point[0]), y: clamp(point[1]) };
        if (point && typeof point === "object") {
          const row = point as Record<string, unknown>;
          return { x: clamp(row.x ?? row.left), y: clamp(row.y ?? row.top) };
        }
        return null;
      })
      .filter((point): point is { x: number; y: number } => Boolean(point));
    if (points.length >= 3) outlines[key] = points;
  });
  return outlines;
}

function estimateHeading(serviceLabel: string | null | undefined, selectedPart?: string | null): string {
  const label = String(selectedPart || serviceLabel || "Price").trim() || "Price";
  const concise = selectedPart
    ? label
    : label.replace(/\b(?:full|complete|remodel|renovation)\b/gi, " ").replace(/\s+/g, " ").trim() || label;
  return `${concise.charAt(0).toUpperCase()}${concise.slice(1)} estimate`;
}

function refinePlaceholder(): string {
  return "Try “use warmer finishes” or “make it more minimal”…";
}

function projectKey(label: string): string {
  const text = label.toLowerCase();
  if (/bath|shower|vanity|tub/.test(text)) return "bathroom";
  if (/kitchen/.test(text)) return "kitchen";
  if (/pergola|patio cover/.test(text)) return "pergola";
  if (/landscap|yard|patio|outdoor|garden/.test(text)) return "landscaping";
  if (/floor/.test(text)) return "flooring";
  return "default";
}

function catalogForIntake(services: ServiceOption[]) {
  return services.map((s) => ({
    id: s.value,
    businessLabel: s.businessLabel || s.serviceName || s.label,
    customerLabel: s.customerLabel || s.label,
    industry: s.industryName || null,
    summary: s.serviceSummary || null,
    photoSubject: s.photoSubject || null,
    photoContext: s.photoContext || null,
    components: (s.subcategoryComponents || []).map((c) => ({
      key: c.key,
      label: c.label,
    })),
    knownParts: s.subcategoryScope || [],
  }));
}

function fallbackServiceIntake(services: ServiceOption[]): V8IntakeQuestion {
  if (services.length <= 1) {
    return {
      step: "service",
      skip: true,
      selectedServiceId: services[0]?.value || null,
      question: "",
      subtitle: "",
      selectionType: "single",
      choices: [],
      source: "fallback",
    };
  }
  return {
    step: "service",
    skip: false,
    question: "What would you like help with?",
    subtitle: "Pick one — we'll keep it simple.",
    selectionType: "single",
    choices: services.map((s) => ({
      id: s.value,
      label: s.customerLabel || s.label,
      serviceId: s.value,
    })),
    source: "fallback",
  };
}

function scopeIntakeForService(service: ServiceOption | null): V8IntakeQuestion {
  const built = buildScopeQuestion({
    industry: service?.industryName,
    serviceLabel: service?.customerLabel || service?.label || service?.businessLabel,
    summary: service?.serviceSummary,
    knownParts: service?.subcategoryScope || [],
    componentLabels: (service?.subcategoryComponents || []).map((c) => c.label || c.key),
  });
  return {
    step: "scope",
    skip: false,
    selectedServiceId: service?.value || null,
    question: built.recipe.question,
    subtitle: built.recipe.subtitle,
    selectionType: "multiple",
    choices: built.choices,
    allowOther: true,
    source: built.source,
  };
}

function parseIntake(data: Record<string, any> | null | undefined, fallback: V8IntakeQuestion): V8IntakeQuestion {
  if (!data) return fallback;
  const hasQuestion = Boolean(String(data.question || "").trim());
  const hasChoices = Array.isArray(data.choices) && data.choices.length > 0;
  if (!data.skip && !hasQuestion && !hasChoices) return fallback;
  const choices = Array.isArray(data.choices)
    ? data.choices
        .map((item: any) => {
          if (typeof item === "string") {
            const label = item.trim();
            return label ? { id: label, label } : null;
          }
          const label = String(item?.label || item?.name || "").trim();
          if (!label) return null;
          return {
            id: String(item?.id || label),
            label,
            serviceId: item?.serviceId ? String(item.serviceId) : null,
            role: item?.role === "full" || item?.role === "other" || item?.role === "part" ? item.role : undefined,
          };
        })
        .filter(Boolean)
    : [];
  const selectionType = data.selectionType === "multiple" || data.selection_type === "multiple" ? "multiple" : "single";
  return {
    step: fallback.step,
    skip: Boolean(data.skip),
    selectedServiceId: data.selectedServiceId ? String(data.selectedServiceId) : fallback.selectedServiceId || null,
    question: String(data.question || fallback.question),
    subtitle: data.subtitle != null ? String(data.subtitle) : fallback.subtitle || "",
    selectionType,
    choices: choices.length ? (choices as V8IntakeChoice[]) : fallback.choices,
    allowOther: data.allowOther !== false,
    source: String(data.source || "llm"),
  };
}

function normalizeServices(raw: unknown): ServiceOption[] {
  if (!Array.isArray(raw)) return [];
  const normalized: ServiceOption[] = [];
  for (const service of raw as any[]) {
    const value = String(service?.value ?? service?.id ?? service?.slug ?? "").trim();
    const businessLabel = String(
      service?.businessLabel ?? service?.business_label ?? service?.serviceName ?? service?.label ?? ""
    ).trim();
    const customerLabel = String(
      service?.customerLabel ?? service?.customer_label ?? service?.label ?? businessLabel
    ).trim();
    const label = customerLabel || businessLabel;
    if (!value || !label) continue;
    if (service?.visualEligible === false || service?.visual_eligible === false) continue;
    normalized.push({
      value,
      label,
      businessLabel: businessLabel || label,
      customerLabel: customerLabel || label,
      serviceName: businessLabel || label,
      visualEligible: true,
      industryId: service?.industryId ?? service?.industry_id ?? null,
      industryName: service?.industryName ?? service?.industry_name ?? null,
      serviceSummary: service?.serviceSummary ?? service?.service_summary ?? null,
      photoSubject: service?.photoSubject ?? service?.photo_subject ?? null,
      photoContext: service?.photoContext ?? service?.photo_context ?? null,
      subcategoryComponents: Array.isArray(service?.subcategoryComponents)
        ? service.subcategoryComponents
        : Array.isArray(service?.subcategory_components)
          ? service.subcategory_components
          : [],
      subcategoryScope: Array.isArray(service?.subcategoryScope)
        ? service.subcategoryScope
        : Array.isArray(service?.subcategory_scope)
          ? service.subcategory_scope
          : [],
      styleOptions: Array.isArray(service?.styleOptions) ? service.styleOptions : [],
    });
  }
  return normalized;
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function catalogCoverUrl(service: ServiceOption | null | undefined, seed: string): string | null {
  const urls = (service?.styleOptions || [])
    .map((opt) => String(opt?.imageUrl || "").trim())
    .filter((url) => /^https?:\/\//i.test(url));
  if (!urls.length) return null;
  return urls[hashSeed(seed) % urls.length];
}

function instanceBudgetOverride(instance: any): { min: number; max: number; step?: number } | null {
  const raw =
    instance?.config?.adventureBudget ||
    instance?.config?.adventure_budget ||
    instance?.config?.budgetBounds ||
    instance?.config?.aiFormConfig?.budgetBounds;
  if (!raw || typeof raw !== "object") return null;
  const min = Number((raw as any).min ?? (raw as any).minBudget);
  const max = Number((raw as any).max ?? (raw as any).maxBudget);
  if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min) return null;
  const step = Number((raw as any).step);
  return { min, max, step: Number.isFinite(step) && step > 0 ? step : undefined };
}

function formatMoney(value: number): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

function generatedWriteBack(
  img: V8GeneratedImage,
  ctx: {
    serviceId: string | null;
    serviceLabel: string;
    industry?: string;
    scope: string;
    scopes?: string[];
    mode: string;
    recipeKey?: string;
    finishTier?: V8FinishTierId | null;
    demandKey?: string;
  }
) {
  const direction = img.direction;
  const tags = catalogTags({
    serviceLabel: ctx.serviceLabel,
    scopes: ctx.scopes,
    scope: ctx.scope,
    finishTier: img.finishTier || ctx.finishTier,
    direction,
  });
  return {
    url: img.url,
    label: img.styleLabel || direction?.label || img.label,
    serviceId: ctx.serviceId,
    serviceLabel: ctx.serviceLabel,
    industry: ctx.industry,
    scope: ctx.scope,
    finishTier: img.finishTier || ctx.finishTier,
    priceRange: img.estimate
      ? { min: img.estimate.min, max: img.estimate.max, currency: "USD", source: img.estimate.source }
      : null,
    modelId: img.modelId || null,
    projectManifest: img.projectManifest || null,
    writeBack: {
      generated_for: "adventure_v8",
      starter_scope: ctx.scope,
      starter_scope_key: v2ScopeStarterKey(ctx.scope),
      subcategory_id: ctx.serviceId,
      option_label: img.styleLabel || direction?.label || img.label,
      finish_tier: img.finishTier || ctx.finishTier || "",
      price_range: img.estimate
        ? { min: img.estimate.min, max: img.estimate.max, currency: "USD", source: img.estimate.source }
        : null,
      price_relationship: img.finishTier || ctx.finishTier || "",
      catalog_demand_key: ctx.demandKey || "",
      adventure_mode: ctx.mode,
      recipe_key: ctx.recipeKey || "",
      scope_keys: ctx.scopes || [],
      tags,
      model_id: img.modelId || "",
      visual_direction: direction?.prompt || "",
      visual_prompt: direction?.prompt || "",
      palette: direction?.palette || "",
      surfaces: direction?.surfaces || "",
      fixtures: direction?.fixtures || "",
      materials: [direction?.surfaces, direction?.fixtures].filter(Boolean),
      style: direction?.style || "",
      palette_family: direction?.family || "",
      project_manifest: img.projectManifest || null,
      discovery: img.projectManifest
        ? {
            contains: img.projectManifest.components.map((component) => component.key),
            primary_scope: img.projectManifest.primaryScope || v2ScopeStarterKey(ctx.scope),
            estimated_finish_tier: normalizeFinishTier(img.finishTier || ctx.finishTier) || "mid",
            description: img.projectManifest.description || "",
            quality_score: Math.min(
              ...img.projectManifest.components.map((component) => component.confidence),
              1
            ),
            role: "inspiration",
            inspirational: true,
            verdict: "keep",
            keep: true,
            model: img.projectManifest.model || "",
            tagged_at: img.projectManifest.analyzedAt || new Date().toISOString(),
          }
        : null,
    },
  };
}

function formatBand(min: number, max: number): string {
  if (Math.round(min) === Math.round(max)) return formatMoney(min);
  return `${formatMoney(min)}–${formatMoney(max)}`;
}

function formatTightPriceBand(min: number, max: number): string {
  const range = tightenPriceRangeForDisplay(min, max);
  return formatBand(range.min, range.max);
}

function budgetPrice(budget: number): V8Estimate {
  const amount = Math.max(0, Math.round(Number(budget) || 0));
  return { min: amount, max: amount, source: "budget" };
}

function refinementEstimate(budget: number, step: number): V8Estimate {
  const amount = Math.max(0, Math.round(Number(budget) || 0));
  return {
    min: Math.max(0, amount - Math.round(step / 2)),
    max: amount + Math.round(step / 2),
    source: "refinement-budget",
  };
}

function startingBudget(bounds: V8BudgetBounds, previous?: number | null): number {
  const mid =
    bounds.defaultAmount ||
    Math.round((bounds.min + bounds.max) / 2 / bounds.step) * bounds.step;
  if (typeof previous === "number" && previous >= bounds.min && previous <= bounds.max) {
    return previous;
  }
  return Math.min(bounds.max, Math.max(bounds.min, mid));
}

function broadBudgetRanges(tiers: V8FinishTier[], maxChoices = 6): V8FinishTier[] {
  if (tiers.length <= maxChoices) return tiers;
  const ranges: V8FinishTier[] = [];
  for (let groupIndex = 0; groupIndex < maxChoices; groupIndex += 1) {
    const start = Math.floor((groupIndex * tiers.length) / maxChoices);
    const end = Math.max(start, Math.floor(((groupIndex + 1) * tiers.length) / maxChoices) - 1);
    const first = tiers[start];
    const last = tiers[Math.min(tiers.length - 1, end)];
    ranges.push({
      ...first,
      min: first.min,
      max: last.max,
      openEnded: groupIndex === maxChoices - 1,
      catalogTier: last.catalogTier || first.catalogTier,
    });
  }
  return ranges;
}

function newSessionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `v8-${Date.now()}`;
}

function initialState(sessionId?: string): V8State {
  return {
    stage: "loading",
    serviceId: null,
    serviceSkipped: false,
    scopes: [],
    otherScope: "",
    budget: 25000,
    budgetBounds: null,
    finishTierId: null,
    galleryHasMore: false,
    galleryOffset: 0,
    photoUrl: null,
    photoSkipped: false,
    looks: [],
    favorites: [],
    layoutId: null,
    styleId: null,
    moodId: null,
    railQuestion: "refine",
    selectedDesignId: null,
    activeRevisionIndex: -1,
    refineRemaining: REFINE_LIMIT,
    changeNote: "",
    pendingBudgetDelta: 0,
    estimate: null,
    teaserEstimate: null,
    photoPathChosen: null,
    pricingParts: [],
    email: "",
    emailCaptured: false,
    phone: "",
    phoneCaptured: false,
    connectIntent: null,
    generating: false,
    generatingLabel: "",
    sessionId: sessionId || newSessionId(),
    submissionId: null,
  };
}

function progressLabel(
  stage: V8Stage,
  serviceSkipped: boolean,
  photoPathChosen: boolean | null
): string {
  const visible = STAGE_ORDER.filter(
    (s) =>
      s !== "done" &&
      !(serviceSkipped && s === "service") &&
      !(photoPathChosen === false && s === "style")
  );
  const idx = visible.indexOf(stage);
  if (idx < 0) return "";
  return `Step ${idx + 1} of ${visible.length}`;
}

function loaderForStage(
  stage: V8Stage,
  generatingLabel: string
): { phase: AdventureLoaderPhase; message?: string } {
  if (stage === "loading") {
    return {
      phase: "initial",
      message: "Loading services and project options…",
    };
  }
  if (stage === "project") {
    return {
      phase: "initial",
      message: "Loading visual scope options…",
    };
  }
  if (stage === "budget") {
    return {
      phase: "initial",
      message: "Loading pricing for the selected scope…",
    };
  }
  if (stage === "path") {
    return {
      phase: "initial",
      message: generatingLabel || "Uploading your reference photo…",
    };
  }
  if (stage === "style") {
    return {
      phase: "preview_generating",
      message: generatingLabel || "Creating a personalized concept for your space…",
    };
  }
  if (stage === "visual") {
    return {
      phase: "inspiration",
      message: generatingLabel || "Loading local examples…",
    };
  }
  return {
    phase: "initial",
    message: generatingLabel || "Loading the next project step…",
  };
}

function LoadingState({
  phase,
  message,
}: {
  phase: AdventureLoaderPhase;
  message?: string;
}) {
  return (
    <div className={css.loading} data-adventure-ui="loading-state" role="status" aria-live="polite">
      <AdventureLoader phase={phase} active messageOverride={message} />
    </div>
  );
}

function BootstrapStage() {
  const loader = loaderForStage("loading", "");
  return (
    <AdventureStepShell className={css.stage}>
      <LoadingState phase={loader.phase} message={loader.message} />
    </AdventureStepShell>
  );
}

export function AdventureV8BootstrapShell({ uiVersion = "v8" }: { uiVersion?: "v8" | "v9" } = {}) {
  const shellDesign = withWidgetDesignDefaults({}, "Adventure");
  return (
    <FormThemeProvider config={shellDesign}>
      <AdventureUiProvider version={uiVersion}>
        <div className={css.root} data-adventure-version={uiVersion}>
          <main className={css.main}>
            <BootstrapStage />
          </main>
        </div>
      </AdventureUiProvider>
    </FormThemeProvider>
  );
}

export function AdventureV8Experience({
  instanceId,
  initialInstanceData,
  initialDesignConfig,
  uiVersion = "v8",
}: AdventureV8ExperienceProps) {
  const [instance, setInstance] = useState<any>(initialInstanceData || null);
  const [design, setDesign] = useState<DesignSettings>(() =>
    withWidgetDesignDefaults(initialDesignConfig || initialInstanceData?.config || {}, initialInstanceData?.name)
  );
  const [services, setServices] = useState<ServiceOption[]>(FALLBACK_SERVICES);
  const [state, setState] = useState<V8State>(() => initialState());
  const [error, setError] = useState<string | null>(null);
  const [layoutThumbs, setLayoutThumbs] = useState<Record<string, string>>({});
  const [styleThumbs, setStyleThumbs] = useState<Record<string, string>>({});
  const [refinementCatalog, setRefinementCatalog] = useState<V8RefinementCatalog | null>(null);
  const [refinementCategoryId, setRefinementCategoryId] = useState("");
  const [refinementCatalogLoading, setRefinementCatalogLoading] = useState(false);
  const [refinementCatalogFailed, setRefinementCatalogFailed] = useState(false);
  const [refinementOptionImages, setRefinementOptionImages] = useState<Record<string, string>>({});
  const [refinementImagesLoadingId, setRefinementImagesLoadingId] = useState("");
  const [pricingUnlockSubmitting, setPricingUnlockSubmitting] = useState(false);
  const [pricingCanvasView, setPricingCanvasView] = useState<"before" | "after">("after");
  const [pricingBaseEstimate, setPricingBaseEstimate] = useState<{ min: number; max: number } | null>(null);
  const [pricingManifestEstimates, setPricingManifestEstimates] =
    useState<Record<string, V8Estimate>>({});
  const [pricingManifestPricingStatus, setPricingManifestPricingStatus] =
    useState<"idle" | "loading" | "ready" | "failed">("idle");
  const [pricingWhatIfSelections, setPricingWhatIfSelections] =
    useState<Record<string, PricingWhatIfLevel>>({});
  const [pricingOverallDirection, setPricingOverallDirection] =
    useState<PricingOverallDirection>("as-shown");
  const [pricingDetailMode, setPricingDetailMode] = useState<"review" | "refine">("review");
  const [pricingEstimateUpdated, setPricingEstimateUpdated] = useState(false);
  const [selectedPricingReviewItem, setSelectedPricingReviewItem] = useState("whole-project");
  const [pendingPricingWhatIf, setPendingPricingWhatIf] =
    useState<{ item: string; level: PricingWhatIfLevel } | null>(null);
  const [pricingRefinementSuggestions, setPricingRefinementSuggestions] =
    useState<PricingRefinementSuggestion[]>(() => localPricingRefinementSuggestions("Anywhere"));
  const [pricingSuggestionsLoading, setPricingSuggestionsLoading] = useState(false);
  const [pricingShareStatus, setPricingShareStatus] = useState("");
  const [pricingGalleryVisibleCount, setPricingGalleryVisibleCount] = useState(PRICING_GALLERY_PAGE_SIZE);
  const [pricingColumnCount, setPricingColumnCount] = useState(1);
  const [selectedRefinementReference, setSelectedRefinementReference] =
    useState<RefinementReference | null>(null);
  const [pricingReferenceUploading, setPricingReferenceUploading] = useState(false);
  const [openRefinementSection, setOpenRefinementSection] =
    useState<"styles" | "items" | "view" | null>("styles");
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const pricingReferenceUploadRef = useRef<HTMLInputElement | null>(null);
  const pricingReferenceKindRef = useRef<"style" | "space">("style");
  const pricingGalleryScrollRef = useRef<HTMLDivElement | null>(null);
  const pricingGalleryLoadSentinelRef = useRef<HTMLDivElement | null>(null);
  const pricingMasonryRef = useRef<HTMLDivElement | null>(null);
  const pricingCanvasRef = useRef<HTMLElement | null>(null);
  const heroRef = useRef<HTMLDivElement | null>(null);
  const starterGenRef = useRef(0);
  const manifestPricingRequestRef = useRef(0);
  const manifestAnalysisRequestRef = useRef(0);
  const pricingGalleryPrefetchRef = useRef<{
    serviceId: string;
    rows: Array<Record<string, any>>;
  } | null>(null);
  const pricingGalleryPrefetchPromiseRef = useRef<{
    serviceId: string;
    promise: Promise<Array<Record<string, any>>>;
  } | null>(null);
  const pricingSuggestionCacheRef = useRef(new Map<string, PricingRefinementSuggestion[]>());
  const pricingSuggestionRequestRef = useRef(0);
  const pricingShareStatusTimerRef = useRef<number | null>(null);
  const [serviceQuestion, setServiceQuestion] = useState<V8IntakeQuestion | null>(null);
  const [scopeQuestion, setScopeQuestion] = useState<V8IntakeQuestion | null>(null);
  const lookGenRef = useRef(0);
  const budgetBandCacheRef = useRef(new Map<string, V8BudgetBounds>());
  const budgetBandInflightRef = useRef(new Map<string, Promise<V8BudgetBounds>>());
  const refinementCatalogCacheRef = useRef(new Map<string, V8RefinementCatalog>());
  const refinementOptionImageCacheRef = useRef(new Map<string, Record<string, string>>());
  const refinementOptionImageInflightRef = useRef(new Map<string, Promise<Record<string, string>>>());
  const activeBudgetKeyRef = useRef("");
  const stateRef = useRef(state);
  stateRef.current = state;

  const patch = useCallback((next: Partial<V8State>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const resetExperience = useCallback(
    (_source: "in_form" | "designer_refresh") => {
      clearV8Snapshot(instanceId);
      starterGenRef.current += 1;
      lookGenRef.current += 1;
      setLayoutThumbs({});
      setStyleThumbs({});
      setRefinementCatalog(null);
      setRefinementCategoryId("");
      setRefinementCatalogFailed(false);
      setRefinementOptionImages({});
      setRefinementImagesLoadingId("");
      setPricingUnlockSubmitting(false);
      setPricingManifestEstimates({});
      setPricingManifestPricingStatus("idle");
      setPricingOverallDirection("as-shown");
      manifestPricingRequestRef.current += 1;
      manifestAnalysisRequestRef.current += 1;
      setPricingDetailMode("review");
      setPricingEstimateUpdated(false);
      setSelectedPricingReviewItem("whole-project");
      setPendingPricingWhatIf(null);
      setPricingRefinementSuggestions(localPricingRefinementSuggestions("Anywhere"));
      setPricingSuggestionsLoading(false);
      setPricingShareStatus("");
      setSelectedRefinementReference(null);
      setPricingReferenceUploading(false);
      setOpenRefinementSection("styles");
      refinementCatalogCacheRef.current.clear();
      refinementOptionImageCacheRef.current.clear();
      refinementOptionImageInflightRef.current.clear();
      budgetBandCacheRef.current.clear();
      budgetBandInflightRef.current.clear();
      pricingGalleryPrefetchRef.current = null;
      pricingGalleryPrefetchPromiseRef.current = null;
      pricingSuggestionCacheRef.current.clear();
      pricingSuggestionRequestRef.current += 1;
      if (pricingShareStatusTimerRef.current) {
        window.clearTimeout(pricingShareStatusTimerRef.current);
        pricingShareStatusTimerRef.current = null;
      }
      setError(null);
      const sessionId = getOrCreateV8SessionId(instanceId);
      const implicit = services.length <= 1 ? services[0] || null : null;
      const budget = proposeClientBudgetBounds({
        serviceLabel: implicit?.label,
        industry: implicit?.industryName,
        serviceSummary: implicit?.serviceSummary,
      }).defaultAmount;
      if (implicit) {
        setScopeQuestion(scopeIntakeForService(implicit));
        setState({
          ...initialState(sessionId),
          stage: "project",
          serviceId: implicit.value,
          serviceSkipped: true,
          budget,
        });
        return;
      }
      setScopeQuestion(null);
      setState({
        ...initialState(sessionId),
        stage: "service",
        serviceSkipped: false,
        budget,
      });
    },
    [instanceId, services]
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.parent?.postMessage({ type: "FORM_READY", version: "v8" }, "*");
      window.parent?.postMessage({ type: "WIDGET_READY", surface: "form", version: "v8" }, "*");
    } catch {
      // ignore
    }
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "SIF_RESET_SESSION" || event.data.type === "RESET_SESSION") {
        resetExperience("designer_refresh");
        try {
          window.parent?.postMessage({ type: "RESET_SESSION_ACK", version: "v8" }, event.origin || "*");
        } catch {
          // ignore
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [resetExperience]);

  const selectedService = useMemo(
    () => services.find((s) => s.value === state.serviceId) || null,
    [services, state.serviceId]
  );
  const namedScopes = useMemo(() => state.scopes.filter((s) => !isOther(s)), [state.scopes]);
  const otherSelected = state.scopes.some(isOther);
  const pricingScopes = useMemo(
    () => [...namedScopes, otherSelected ? state.otherScope.trim() : ""].filter(Boolean),
    [namedScopes, otherSelected, state.otherScope]
  );
  const scopeLabel = pricingScopes.join(" + ");
  const scopeReady = namedScopes.length > 0 || (otherSelected && Boolean(state.otherScope.trim()));
  const activeRevisionIndex =
    state.looks.length && state.activeRevisionIndex >= 0
      ? Math.min(state.activeRevisionIndex, state.looks.length - 1)
      : -1;
  const selectedDesign =
    (activeRevisionIndex >= 0 ? state.looks[activeRevisionIndex] : null) ||
    state.looks.find((d) => d.id === state.selectedDesignId) ||
    (state.photoPathChosen ? state.looks[0] : null) ||
    null;
  const refinementProject = projectKey(
    [selectedService?.label, selectedService?.industryName, scopeLabel].filter(Boolean).join(" ")
  );
  const refinementImages = SERVICE_COVERS[refinementProject] || SERVICE_COVERS.default;
  const industryLanguage = useMemo(
    () => languageForIndustry({
      serviceLabel: selectedService?.label,
      industry: selectedService?.industryName,
      serviceSummary: selectedService?.serviceSummary,
      photoSubject: selectedService?.photoSubject,
      photoContext: selectedService?.photoContext,
    }),
    [
      selectedService?.industryName,
      selectedService?.label,
      selectedService?.photoContext,
      selectedService?.photoSubject,
      selectedService?.serviceSummary,
    ]
  );
  const marketLocality = useMemo(() => localityFromInstance(instance), [instance]);
  const copy = useMemo(
    () => adventureCopy(industryLanguage, marketLocality),
    [industryLanguage, marketLocality]
  );
  const photoInputExample =
    PHOTO_INPUT_EXAMPLES[industryLanguage.key] ||
    refinementImages[Math.max(0, refinementImages.length - 1)];
  const photoResultExample = refinementImages[0];
  const liveRefinementCatalog = refinementCatalog;
  const brandName = design.brand_name || instance?.name || "Adventure";
  const studioOpen =
    state.stage === "visual" && state.photoPathChosen === true && Boolean(selectedDesign);
  const pricingGalleryOpen =
    state.stage === "visual" &&
    state.photoPathChosen === false &&
    !state.selectedDesignId &&
    activeRevisionIndex < 0;
  const pricingProjectOpen =
    state.stage === "visual" &&
    state.photoPathChosen === false &&
    Boolean(state.selectedDesignId) &&
    Boolean(selectedDesign);
  const pricingGalleryItems = useMemo(
    // Keep the style variants admitted by the V1 inspiration feed. The helper
    // still removes duplicate URLs; the high cap only disables the old
    // one-starter-per-scope collapse at render time.
    () => curateGalleryProjectDiversity(state.looks, PRICING_GALLERY_MAX).slice(0, PRICING_GALLERY_MAX),
    [state.looks]
  );
  const visiblePricingGalleryItems = pricingGalleryItems.slice(0, pricingGalleryVisibleCount);
  const pricingMasonryColumns = useMemo(
    () => splitMasonryColumns(
      visiblePricingGalleryItems,
      pricingColumnCount,
      (look) => look.pinAspect || "4 / 5"
    ),
    [pricingColumnCount, visiblePricingGalleryItems]
  );
  const refinementCatalogPending =
    studioOpen && !refinementCatalogFailed && (!refinementCatalog || refinementCatalogLoading);
  const starterNotice = state.photoPathChosen
    ? `Built from your ${industryLanguage.space}. Use the quick controls to shape it.`
    : "A visual example with estimated local pricing.";

  const loadRefinementCategoryImages = useCallback(
    async (category: import("./types").V8RefinementCategory) => {
      const thumbnailBudgetTier =
        state.budget < 10_000 ? "value" : state.budget < 25_000 ? "standard" : "premium";
      const cacheKey = [
        state.serviceId,
        thumbnailBudgetTier,
        category.id,
        category.options.map((option) => option.id).join(","),
      ].join("::");
      const cached = refinementOptionImageCacheRef.current.get(cacheKey);
      if (cached) {
        setRefinementOptionImages(cached);
        return;
      }
      let request = refinementOptionImageInflightRef.current.get(cacheKey);
      if (!request) {
        request = generateV8RefinementOptionImages({
          instanceId,
          sessionId: state.sessionId,
          serviceId: state.serviceId || "",
          serviceLabel: selectedService?.label,
          serviceSummary: selectedService?.serviceSummary,
          industry: selectedService?.industryName,
          budget: state.budget,
          category,
        });
        refinementOptionImageInflightRef.current.set(cacheKey, request);
      }
      setRefinementImagesLoadingId(category.id);
      const images = await request;
      refinementOptionImageInflightRef.current.delete(cacheKey);
      refinementOptionImageCacheRef.current.set(cacheKey, images);
      if (stateRef.current.serviceId === state.serviceId) {
        setRefinementOptionImages(images);
        setRefinementImagesLoadingId((current) => current === category.id ? "" : current);
      }
    },
    [
      instanceId,
      selectedService?.industryName,
      selectedService?.label,
      selectedService?.serviceSummary,
      state.budget,
      state.serviceId,
      state.sessionId,
    ]
  );

  useEffect(() => {
    if (
      state.stage !== "visual" ||
      state.photoPathChosen !== true ||
      !state.serviceId ||
      !selectedDesign?.url ||
      !/^https?:\/\//i.test(selectedDesign.url)
    ) {
      setRefinementCatalog(null);
      setRefinementCategoryId("quick-swaps");
      setRefinementCatalogLoading(false);
      setRefinementCatalogFailed(false);
      return;
    }
    const cacheKey = `${state.serviceId}::${selectedDesign.id}::${state.budget}`;
    const cached = refinementCatalogCacheRef.current.get(cacheKey);
    if (cached) {
      setRefinementCatalog(cached);
      setRefinementCategoryId((current) =>
        cached.categories.some((category) => category.id === current)
          ? current
          : ""
      );
      setRefinementCatalogLoading(false);
      setRefinementCatalogFailed(false);
      return;
    }
    let cancelled = false;
    setRefinementCatalog(null);
    setRefinementCategoryId("quick-swaps");
    setRefinementCatalogLoading(true);
    setRefinementCatalogFailed(false);
    void fetchV8RefinementCatalog({
      instanceId,
      serviceId: state.serviceId,
      serviceLabel: selectedService?.label,
      serviceSummary: selectedService?.serviceSummary,
      scopes: pricingScopes,
      budget: state.budget,
      imageUrl: selectedDesign.url,
    }).then(async (catalog) => {
      if (cancelled) return;
      if (!catalog?.categories?.length) {
        setRefinementCatalogLoading(false);
        setRefinementCatalogFailed(true);
        return;
      }
      refinementCatalogCacheRef.current.set(cacheKey, catalog);
      setRefinementCatalog(catalog);
      setRefinementCategoryId("");
      setRefinementCatalogLoading(false);
      setRefinementCatalogFailed(false);
    });
    return () => {
      cancelled = true;
    };
  }, [
    instanceId,
    pricingScopes,
    selectedDesign?.id,
    selectedDesign?.url,
    selectedService?.label,
    selectedService?.serviceSummary,
    state.budget,
    state.photoPathChosen,
    state.serviceId,
    state.stage,
  ]);

  const localBudgetBounds = useMemo((): V8BudgetBounds => {
    const proposed = proposeClientBudgetBounds({
      serviceLabel: selectedService?.label,
      industry: selectedService?.industryName,
      serviceSummary: selectedService?.serviceSummary,
      scopes: pricingScopes,
    });
    return {
      min: proposed.min,
      max: proposed.max,
      step: proposed.step,
      defaultAmount: proposed.defaultAmount,
      source: "calibrated-local",
      finishTiers: finishTiersForScope({
        serviceLabel: selectedService?.label,
        industry: selectedService?.industryName,
        serviceSummary: selectedService?.serviceSummary,
        scopes: pricingScopes,
      }),
    };
  }, [pricingScopes, selectedService]);
  const immediateBudgetBounds = useMemo((): V8BudgetBounds => {
    const override = instanceBudgetOverride(instance);
    if (!override) return localBudgetBounds;
    const scaled = proposeClientBudgetBounds({
      serviceLabel: selectedService?.label,
      industry: selectedService?.industryName,
      serviceSummary: selectedService?.serviceSummary,
      scopes: pricingScopes,
      serviceLow: override.min,
      serviceHigh: override.max,
    });
    return {
      min: scaled.min,
      max: scaled.max,
      step: scaled.step,
      defaultAmount: scaled.defaultAmount,
      source: "business",
      confidence: 0.85,
      finishTiers: withOpenEndedTop(
        splitFinishTiers(scaled.min, scaled.closedMax, {
          serviceLabel: selectedService?.label,
          industry: selectedService?.industryName,
          serviceSummary: selectedService?.serviceSummary,
          plusHigh: scaled.plusHigh,
        })
      ),
    };
  }, [instance, localBudgetBounds, pricingScopes, selectedService]);
  const budgetScopeKey = useMemo(
    () =>
      [
        state.serviceId || "service",
        ...pricingScopes.map((scope) => scope.trim().toLowerCase()).filter(Boolean).sort(),
      ].join("::"),
    [pricingScopes, state.serviceId]
  );
  activeBudgetKeyRef.current = budgetScopeKey;
  const budgetBounds = state.budgetBounds || immediateBudgetBounds;
  const budgetRefinementStep = budgetRefinementStepFor(state.budget);
  const finishTiers: V8FinishTier[] = broadBudgetRanges(withOpenEndedTop(
    budgetBounds.finishTiers && budgetBounds.finishTiers.length
      ? budgetBounds.finishTiers
      : finishTiersForScope({
          serviceLabel: selectedService?.label,
          industry: selectedService?.industryName,
          serviceSummary: selectedService?.serviceSummary,
          scopes: pricingScopes,
        })
  ));
  const selectedTier = finishTiers.find((row) => row.id === state.finishTierId) || null;
  const designPayload = useCallback(
    (overrides?: Partial<V8DesignPayload>): V8DesignPayload => {
      const favoriteUrls = state.favorites
        .map((id) => state.looks.find((img) => img.id === id)?.url)
        .filter((url): url is string => Boolean(url));
      const businessLabel =
        selectedService?.businessLabel || selectedService?.serviceName || selectedService?.label || "Project";
      const customerLabel = selectedService?.customerLabel || selectedService?.label || businessLabel;
      return {
        instanceId,
        serviceId: state.serviceId,
        serviceLabel: businessLabel,
        customerServiceLabel: customerLabel,
        industry: selectedService?.industryName || null,
        serviceSummary: selectedService?.serviceSummary || null,
        visualEligible: selectedService?.visualEligible !== false,
        scope: scopeLabel || "General",
        scopes: namedScopes,
        scopeKeys: namedScopes,
        scopeOther: otherSelected ? state.otherScope : null,
        budget: state.budget,
        budgetBandId: state.finishTierId,
        finishTier: state.finishTierId,
        startPath: state.photoUrl ? "photo" : "pricing",
        photoUrl: state.photoUrl,
        favoriteUrls,
        selectedIdeaUrl: selectedDesign?.url || null,
        refineNote: state.changeNote || null,
        lead: {
          email: state.email || null,
          phone: state.phone || null,
          intent: state.connectIntent,
        },
        ...overrides,
      };
    },
    [
      instanceId,
      scopeLabel,
      namedScopes,
      otherSelected,
      selectedDesign?.url,
      selectedService,
      state.budget,
      state.finishTierId,
      state.changeNote,
      state.connectIntent,
      state.email,
      state.favorites,
      state.looks,
      state.otherScope,
      state.phone,
      state.photoUrl,
      state.serviceId,
    ]
  );

  const requestIntake = useCallback(
    async (opts: { list: ServiceOption[]; businessName?: string }) => {
      const fallback = fallbackServiceIntake(opts.list);
      const live = await callAdventurePipeline(
        "intake",
        { instanceId },
        {
          step: "service",
          businessName: opts.businessName || "",
          services: catalogForIntake(opts.list),
        }
      );
      return parseIntake(live, fallback);
    },
    [instanceId]
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      let shouldStartFresh = false;
      try {
        const params = new URLSearchParams(window.location.search);
        const freshRequested = params.get("fresh") === "1" || params.get("fresh") === "true";
        const freshNonce = params.get("freshNonce") || "";
        if (freshRequested && freshNonce) {
          const markerKey = `adventure:v8:fresh-consumed:${instanceId}`;
          shouldStartFresh = window.sessionStorage.getItem(markerKey) !== freshNonce;
          if (shouldStartFresh) window.sessionStorage.setItem(markerKey, freshNonce);
        }
      } catch {
        // ignore
      }
      if (shouldStartFresh) {
        clearV8Snapshot(instanceId);
        setLayoutThumbs({});
        setStyleThumbs({});
      }
      try {
        const response = await fetch(`/api/widget/${encodeURIComponent(instanceId)}?phase=intake`, {
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Unable to load configurator.");
        const data = await response.json();
        if (cancelled) return;
        const nextInstance = data?.instance || initialInstanceData || {};
        const nextServices = normalizeServices(data?.serviceOptions);
        const resolved = nextServices.length > 0 ? nextServices : FALLBACK_SERVICES;
        setInstance(nextInstance);
        setDesign((prev) => withWidgetDesignDefaults(nextInstance?.config || prev, nextInstance?.name));
        setServices(resolved);
        const businessName = String(nextInstance?.name || "").trim();
        const serviceQ = fallbackServiceIntake(resolved);
        const skipped = resolved.length <= 1;
        const implicitId = skipped ? serviceQ.selectedServiceId || resolved[0]?.value || null : null;
        const implicit = resolved.find((s) => s.value === implicitId) || (skipped ? resolved[0] : null) || null;
        const budget = proposeClientBudgetBounds({
          serviceLabel: implicit?.label,
          industry: implicit?.industryName,
          serviceSummary: implicit?.serviceSummary,
        }).defaultAmount;
        const saved = shouldStartFresh ? null : loadV8Snapshot(instanceId);
        const savedServiceId = saved?.state?.serviceId || saved?.context?.serviceId || null;
        const savedService = savedServiceId ? resolved.find((s) => s.value === savedServiceId) || null : null;
        const canRestore = Boolean(
          saved?.state &&
            saved.state.stage !== "loading" &&
            (savedService || saved.state.stage === "service" || (implicit && savedServiceId === implicit.value))
        );
        if (canRestore && saved) {
          const service = savedService || implicit || null;
          setServiceQuestion(serviceQ);
          setScopeQuestion(service ? scopeIntakeForService(service) : null);
          setLayoutThumbs(saved.layoutThumbs || {});
          setStyleThumbs(saved.styleThumbs || {});
          setState({
            ...saved.state,
            sessionId: saved.state.sessionId || getOrCreateV8SessionId(instanceId),
            generating: false,
            generatingLabel: "",
            serviceId: service?.value || saved.state.serviceId,
            serviceSkipped: skipped || saved.state.serviceSkipped,
            moodId: saved.state.moodId ?? null,
            finishTierId: saved.state.finishTierId ?? null,
            galleryHasMore: Boolean(saved.state.galleryHasMore),
            galleryOffset: Number(saved.state.galleryOffset || 0),
            activeRevisionIndex: saved.state.looks.length === 0 || !saved.state.selectedDesignId
              ? -1
              : Number.isInteger(saved.state.activeRevisionIndex) && saved.state.activeRevisionIndex >= 0
                ? Math.min(saved.state.activeRevisionIndex, saved.state.looks.length - 1)
                : saved.state.looks.findIndex((look) => look.id === saved.state.selectedDesignId),
            pendingBudgetDelta: Number(saved.state.pendingBudgetDelta || 0),
            railQuestion: "refine",
          });
        } else {
          const sessionId = getOrCreateV8SessionId(instanceId);
          if (implicit) {
            setServiceQuestion(serviceQ);
            setScopeQuestion(scopeIntakeForService(implicit));
            setState({
              ...initialState(sessionId),
              stage: "project",
              serviceId: implicit.value,
              serviceSkipped: true,
              budget,
            });
          } else {
            setServiceQuestion(serviceQ);
            setScopeQuestion(null);
            setState({
              ...initialState(sessionId),
              stage: "service",
              serviceSkipped: false,
              budget,
            });
          }
        }

        // The first usable step must never wait on the optional AI-authored copy.
        // Enhance the already-rendered service question in the background only.
        if (resolved.length > 1) {
          void requestIntake({ list: resolved, businessName })
            .then((enhanced) => {
              if (cancelled || enhanced.skip) return;
              setServiceQuestion(enhanced);
            })
            .catch(() => {
              // The deterministic question is already on screen.
            });
        }

        // Service cover images are decorative only. Fetch them behind the first
        // interactive step so intake never waits on visual catalog data.
        void fetch(`/api/widget/${encodeURIComponent(instanceId)}?phase=service-covers`, {
          cache: "no-store",
        })
          .then(async (catalogResponse) => {
            if (!catalogResponse.ok) return [];
            const catalogData = await catalogResponse.json();
            return normalizeServices(catalogData?.serviceOptions);
          })
          .then((enrichedServices) => {
            if (cancelled || enrichedServices.length === 0) return;
            const enrichedById = new Map(enrichedServices.map((service) => [service.value, service]));
            setServices((current) =>
              current.map((service) => ({ ...service, ...(enrichedById.get(service.value) || {}) }))
            );
          })
          .catch(() => {
            // Text-only intake is already usable; discovery has its own fallbacks.
          });
      } catch (bootError) {
        if (cancelled) return;
        setServices(FALLBACK_SERVICES);
        setServiceQuestion(fallbackServiceIntake(FALLBACK_SERVICES));
        setState({ ...initialState(), stage: "service" });
        setError(bootError instanceof Error ? bootError.message : "Unable to load configurator.");
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [initialInstanceData, instanceId, requestIntake]);

  useEffect(() => {
    if (!selectedService) return;
    if (state.budget < budgetBounds.min || state.budget > budgetBounds.max) {
      patch({ budget: startingBudget(budgetBounds) });
    }
  }, [budgetBounds, patch, selectedService, state.budget]);

  const go = (stage: V8Stage) => patch({ stage });

  const goBack = () => {
    if (state.stage === "visual" && state.photoPathChosen === false && state.selectedDesignId) {
      patch({
        selectedDesignId: null,
        activeRevisionIndex: -1,
        pricingParts: [],
        estimate: null,
      });
      return;
    }
    if (state.stage === "visual") {
      lookGenRef.current += 1;
      starterGenRef.current += 1;
      patch({
        stage: state.photoPathChosen ? "style" : "path",
        looks: [],
        favorites: [],
        selectedDesignId: null,
        activeRevisionIndex: -1,
        pendingBudgetDelta: 0,
        layoutId: null,
        styleId: null,
        moodId: null,
        galleryOffset: 0,
        galleryHasMore: false,
        pricingParts: [],
        generating: false,
        generatingLabel: "",
      });
      setLayoutThumbs({});
      setStyleThumbs({});
      return;
    }
    if (state.stage === "project" && state.serviceSkipped) return;
    const visible = STAGE_ORDER.filter((s) => !(s === "service" && state.serviceSkipped));
    const idx = visible.indexOf(state.stage);
    if (idx <= 0) return;
    go(visible[idx - 1]);
  };

  const prefetchBudgetBands = useCallback((): Promise<V8BudgetBounds> => {
    const cached = budgetBandCacheRef.current.get(budgetScopeKey);
    if (cached) return Promise.resolve(cached);
    const inFlight = budgetBandInflightRef.current.get(budgetScopeKey);
    if (inFlight) return inFlight;

    const request = (async () => {
      let next = immediateBudgetBounds;
      if (immediateBudgetBounds.source !== "business") {
        // The calibrated pricing engine runs speculatively while the visitor is
        // still on scope. Local bands remain the instant, never-blocking fallback.
        const live = await callAdventurePipeline("budget_bands", {
          instanceId,
          serviceId: state.serviceId,
          serviceLabel:
            selectedService?.businessLabel || selectedService?.serviceName || selectedService?.label || "Project",
          customerServiceLabel: selectedService?.customerLabel || selectedService?.label || "Project",
          industry: selectedService?.industryName || null,
          serviceSummary: selectedService?.serviceSummary || null,
          scope: scopeLabel,
          scopes: pricingScopes,
          scopeKeys: pricingScopes,
        });
        if (live && typeof live.min === "number" && typeof live.max === "number") {
          next = {
            min: Number(live.min),
            max: Number(live.max),
            step: Number(live.step) || 1000,
            defaultAmount: Number(live.defaultAmount) || undefined,
            source: String(live.source || "calibrated"),
            confidence: Number(live.confidence) || 0.5,
            finishTiers: withOpenEndedTop(
              Array.isArray(live.finishTiers) && live.finishTiers.length
                ? live.finishTiers
                : splitFinishTiers(Number(live.min), Number(live.max), {
                    serviceLabel: selectedService?.label,
                    industry: selectedService?.industryName,
                    serviceSummary: selectedService?.serviceSummary,
                    plusHigh: Number(live.max),
                  })
            ),
          };
        }
      }
      budgetBandCacheRef.current.set(budgetScopeKey, next);
      return next;
    })().finally(() => {
      budgetBandInflightRef.current.delete(budgetScopeKey);
    });

    budgetBandInflightRef.current.set(budgetScopeKey, request);
    return request;
  }, [budgetScopeKey, immediateBudgetBounds, instanceId, pricingScopes, scopeLabel, selectedService, state.serviceId]);

  useEffect(() => {
    if (!state.serviceId || !scopeReady || (state.stage !== "project" && state.stage !== "budget")) return;
    const requestKey = budgetScopeKey;
    const delayMs = state.stage === "project" ? 120 : 0;
    const timer = window.setTimeout(() => {
      void prefetchBudgetBands().then((next) => {
        if (activeBudgetKeyRef.current !== requestKey || stateRef.current.stage !== "budget") return;
        setState((prev) => {
          // Never move the choices after the visitor has picked a band.
          if (prev.stage !== "budget" || prev.finishTierId) return prev;
          return {
            ...prev,
            budgetBounds: next,
            budget: startingBudget(next),
          };
        });
      });
    }, delayMs);
    return () => window.clearTimeout(timer);
  }, [budgetScopeKey, prefetchBudgetBands, scopeReady, state.serviceId, state.stage]);

  const fullScopeLabel = scopeQuestion?.choices.find((c) => c.role === "full" || c.id === "full")?.label || null;
  const mode = projectMode(namedScopes, fullScopeLabel);
  const vertical = verticalKey(
    selectedService?.industryName,
    selectedService?.label,
    selectedService?.serviceSummary
  );
  const layoutQuickChoices = useMemo(
    () => layoutChoicesForProject(vertical, pricingScopes).slice(0, 4),
    [pricingScopes, vertical]
  );
  useEffect(() => {
    if (state.stage === "loading") return;
    saveV8Snapshot(instanceId, {
      state: { ...state, generating: false, generatingLabel: "" },
      layoutThumbs,
      styleThumbs,
      context: {
        serviceId: state.serviceId,
        serviceLabel: selectedService?.label || "Project",
        industry: selectedService?.industryName || null,
        summary: selectedService?.serviceSummary || null,
        vertical,
        scopes: namedScopes,
        scopeLabel,
        mode,
        budget: state.budget,
        layoutId: state.layoutId,
        styleId: state.styleId,
        photoUrl: state.photoUrl,
        designUrl: selectedDesign?.url || null,
      },
    });
  }, [
    instanceId,
    layoutThumbs,
    mode,
    namedScopes,
    scopeLabel,
    selectedDesign?.url,
    selectedService,
    state,
    styleThumbs,
    vertical,
  ]);

  const enterStudioWithLook = (
    look: V8GeneratedImage,
    opts: {
      mode: string;
      photoUrl: string | null;
      photoSkipped: boolean;
      photoPathChosen: boolean;
    }
  ) => {
    setState((prev) => ({
      ...prev,
      stage: "visual",
      looks: [look],
      favorites: [look.id],
      selectedDesignId: look.id,
      activeRevisionIndex: 0,
      galleryOffset: 0,
      galleryHasMore: false,
      photoUrl: opts.photoUrl,
      photoSkipped: opts.photoSkipped,
      photoPathChosen: opts.photoPathChosen,
      changeNote: "",
      pendingBudgetDelta: 0,
      refineRemaining: REFINE_LIMIT,
      generating: false,
      generatingLabel: "",
    }));
    if (!look.url || look.source === "fallback") return;
    void curateAdventureImages(instanceId, {
      events: [{ type: "shown", url: look.url, source: look.source, mode: opts.mode }],
      candidates: look.source === "generated"
        ? [generatedWriteBack(look, {
            serviceId: stateRef.current.serviceId,
            serviceLabel: selectedService?.label || "Project",
            industry: selectedService?.industryName || undefined,
            scope: scopeLabel,
            scopes: pricingScopes,
            mode: opts.mode,
            finishTier: stateRef.current.finishTierId,
          })]
        : [],
      writeBack: look.source === "generated",
    });
  };

  const mapPricingProject = (
    raw: Record<string, any>,
    index: number,
    sourceOverride?: V8GeneratedImage["source"],
    options?: { allowPricingFallback?: boolean; allowBroadFallback?: boolean }
  ): V8GeneratedImage | null => {
    const url = String(raw?.url || raw?.src || raw?.image || "").trim();
    if (!/^https?:\/\//i.test(url)) return null;
    const source = sourceOverride || (raw.source === "generated" ? "generated" : "library");
    const id = String(raw.id || raw.imageId || `pricing-project-${index}-${hashSeed(url)}`);
    const beforeUrl = String(
      raw.beforeUrl || raw.before_url || raw.beforeImageUrl || raw.before_image_url || ""
    ).trim();
    const rawChangeSummary = raw.changeSummary || raw.change_summary || raw.whatChanged || raw.what_changed || "";
    const changeSummary = Array.isArray(rawChangeSummary)
      ? rawChangeSummary.map(String).map((item) => item.trim()).filter(Boolean).join(" · ")
      : String(rawChangeSummary || "").trim();
    const projectManifest = normalizeProjectManifest(
      raw.projectManifest || raw.project_manifest || raw.discovery ||
      (Array.isArray(raw.contains) ? {
        contains: raw.contains,
        primary_scope: raw.primaryScope || raw.scopeKey,
        quality_score: raw.qualityScore || raw.quality_score,
        description: raw.description,
        model: raw.discoveryModel || raw.discovery_model,
      } : null)
    );
    const priceableManifest = raw.priceableManifest || raw.priceable_manifest || null;
    const verificationConfidence = Number(raw.verificationConfidence ?? raw.verification_confidence);
    const pricingConfidence = String(raw.pricingConfidence || raw.pricing_confidence || "").trim().toLowerCase();
    const normalizedPricingConfidence =
      pricingConfidence === "high" || pricingConfidence === "medium" || pricingConfidence === "broad"
        ? pricingConfidence
        : null;
    const pricingBreakdown = Array.isArray(raw.pricingBreakdown || raw.pricing_breakdown)
      ? (raw.pricingBreakdown || raw.pricing_breakdown)
      : [];
    const pricingAssumptions = Array.isArray(raw.pricingAssumptions || raw.pricing_assumptions)
      ? (raw.pricingAssumptions || raw.pricing_assumptions).map(String).filter(Boolean)
      : [];
    const includedItems = projectManifest?.analysisStatus === "verified"
      ? projectManifest.components.map((component) => component.label || component.key)
      : [];
    const focusRegions = normalizeFocusRegions(
      raw.focusRegions || raw.focus_regions || raw.componentRegions || raw.component_regions
    );
    const focusOutlines = normalizeFocusOutlines(
      raw.focusOutlines || raw.focus_outlines || raw.componentOutlines || raw.component_outlines
    );
    const finishTier = normalizeFinishTier(
      raw.estimatedFinishTier || raw.finishTier || raw.priceTier || stateRef.current.finishTierId
    );
    const fallbackTitle = `${pricingScopes[0] || selectedService?.label || "Project"} project`;
    const label = String(raw.label || raw.title || fallbackTitle).trim() || fallbackTitle;
    const imageText = [
      label,
      raw.description,
      raw.searchText,
      raw.prompt,
      raw.primaryScope,
      raw.scopeKey,
      raw.scope,
      ...(Array.isArray(raw.contains) ? raw.contains : []),
      ...(Array.isArray(raw.materials) ? raw.materials : []),
      ...(Array.isArray(raw.tags) ? raw.tags : []),
    ]
      .filter(Boolean)
      .join(" ");
    const generatedFor = String(raw.generatedFor || raw.generated_for || "");
    const relevance = Number(raw.relevanceScore ?? raw.relevance_score);
    const estimateData = raw.estimate || raw.priceRange || raw.price_range || raw.estimatedBudget || raw.estimated_budget || null;
    const estimateMin = Number(estimateData?.min ?? estimateData?.low ?? raw.estimateMin ?? raw.estimate_min);
    const estimateMax = Number(estimateData?.max ?? estimateData?.high ?? raw.estimateMax ?? raw.estimate_max);
    const estimateMid =
      estimateMin > 0 && estimateMax > 0
        ? (estimateMin + estimateMax) / 2
        : Number(raw.estimateMid ?? raw.estimate_mid ?? 0);
    const selectedScopeKeys = pricingScopes.map((item) => v2ScopeStarterKey(item)).filter(Boolean);
    const primaryScopeKey = v2ScopeStarterKey(String(raw.primaryScope || raw.scopeKey || ""));
    const primaryScopeMatchesSelection = selectedScopeKeys.some((selectedKey) =>
      primaryScopeKey === selectedKey ||
      primaryScopeKey.includes(selectedKey) ||
      selectedKey.includes(primaryScopeKey)
    );
    const manifestKeys = new Set(
      (projectManifest?.components || []).map((component) => v2ScopeStarterKey(component.key || component.label))
    );
    const selectedPartKeys = pricingScopes
      .filter((item) => !isFullScopeLabel(item, scopeQuestion))
      .map(v2ScopeStarterKey)
      .filter(Boolean);
    const coversSelectedParts = selectedPartKeys.every((selectedKey) =>
      Array.from(manifestKeys).some((manifestKey) =>
        manifestKey === selectedKey || manifestKey.includes(selectedKey) || selectedKey.includes(manifestKey)
      )
    );
    const needsFullProject = pricingScopes.some((item) => isFullScopeLabel(item, scopeQuestion));
    const broadFallback =
      options?.allowBroadFallback === true ||
      String(raw.retrievalMatch || "").toLowerCase() === "broad";

    // Tagged exact matches still get the stricter contract. The first gallery
    // may also show broad catalog inspiration without blocking on a VLM pass;
    // that one selected image is analyzed lazily in the next step.
    if (!broadFallback && (
      !projectManifest ||
      projectManifest.analysisStatus !== "verified" ||
      projectManifest.components.length === 0 ||
      !coversSelectedParts ||
      (needsFullProject && projectManifest.sceneType !== "full-project")
    )) {
      return null;
    }

    if (
      looksLikeMaterialSwatch(imageText) ||
      (!broadFallback && (
        lookConflictsWithService({
          imageText,
          industry: selectedService?.industryName,
          serviceLabel: selectedService?.label,
          summary: selectedService?.serviceSummary,
        }) ||
        !lookFitsSelectedScopes({ imageText, scopes: pricingScopes, generatedFor })
      ))
    ) {
      return null;
    }
    if (source === "library" && !broadFallback) {
      if (Number.isFinite(relevance) && relevance < 0.68) return null;
      if (String(raw.retrievalMatch || "").toLowerCase() === "nearest") return null;
      if (
        mode === "component" &&
        primaryScopeKey &&
        selectedScopeKeys.length &&
        !primaryScopeMatchesSelection
      ) {
        return null;
      }
      if (!options?.allowPricingFallback) {
        const selectedFinish = normalizeFinishTier(stateRef.current.finishTierId);
        if (selectedFinish && finishTier && selectedFinish !== finishTier) return null;
        if (tooExpensiveForBudget(raw.priceTier, stateRef.current.budget)) return null;
        if (
          !withinBudgetWindow({
            budget: stateRef.current.budget,
            mid: estimateMid > 0 ? estimateMid : null,
            priceTier: raw.priceTier,
          })
        ) {
          return null;
        }
      }
    }
    return {
      id,
      url,
      beforeUrl: /^https?:\/\//i.test(beforeUrl) ? beforeUrl : null,
      label: /^look$/i.test(label) ? fallbackTitle : label,
      changeSummary: changeSummary || null,
      includedItems,
      projectManifest,
      priceableManifest:
        priceableManifest && typeof priceableManifest === "object" ? priceableManifest : null,
      verificationConfidence: Number.isFinite(verificationConfidence) ? verificationConfidence : null,
      pricingConfidence: normalizedPricingConfidence,
      pricingLabel: normalizedPricingConfidence ? galleryPricingLabel(normalizedPricingConfidence) : null,
      pricingBreakdown,
      pricingAssumptions,
      beforeDisclosure:
        raw.beforeDisclosure === "ai_generated_illustrative_before" ||
        raw.before_disclosure === "ai_generated_illustrative_before"
          ? "ai_generated_illustrative_before"
          : null,
      focusRegions,
      focusOutlines,
      source,
      styleLabel: label,
      scopeLabel,
      primaryScope: raw.primaryScope || raw.scopeKey || pricingScopes[0] || null,
      generatedFor: generatedFor || null,
      direction: raw.direction || null,
      finishTier,
      budget: stateRef.current.budget,
      estimate: estimateMin > 0 && estimateMax > 0
        ? { min: estimateMin, max: estimateMax, source: String(estimateData?.source || "catalog") }
        : (() => {
            const currentTier = finishTiers.find((row) => row.id === stateRef.current.finishTierId);
            return currentTier
              ? projectEstimateForBand(currentTier.min, currentTier.max, id)
              : pinEstimate(stateRef.current.budget, id);
          })(),
      priceTier: raw.priceTier || null,
      pinAspect: PRICING_PIN_ASPECTS[index % PRICING_PIN_ASPECTS.length],
      tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
      cue: String(raw.performanceCue || raw.cue || "Matched project example"),
      timesShown: Number(raw.timesShown || 0),
      timesSelected: Number(raw.timesSelected || 0),
      timesSaved: Number(raw.timesSaved || 0),
      timesShared: Number(raw.timesShared || 0),
      conversions: Number(raw.conversions || 0),
      businessUsageCount: Number(raw.businessUsageCount || 0),
      localShown: Number(raw.localShown || 0),
      localSelections: Number(raw.localSelections || 0),
      localSaves: Number(raw.localSaves || 0),
      localShares: Number(raw.localShares || 0),
      localConversions: Number(raw.localConversions || 0),
      local: Boolean(raw.local),
      catalogSource:
        raw.catalogSource === "instance" || raw.catalogSource === "business" || raw.catalogSource === "platform"
          ? raw.catalogSource
          : source === "generated"
            ? "generated"
            : source === "fallback"
              ? "fallback"
              : "platform",
      worthKeeping: Boolean(raw.worthKeeping),
      reusableStatus: raw.reusableStatus || undefined,
    };
  };

  const uniquePricingProjects = (rows: V8GeneratedImage[]): V8GeneratedImage[] =>
    // Style variants are useful inspiration in V1. De-dupe URLs, but do not
    // collapse an entire service catalog to one starter image per scope.
    curateGalleryProjectDiversity(rows, PRICING_GALLERY_MAX);

  const fallbackRowsForPricingGallery = (): Array<Record<string, any>> =>
    refinementImages.map((url, index) => ({
      id: `pricing-cover-${refinementProject}-${index}-${hashSeed(url)}`,
      url,
      label: `${FALLBACK_GALLERY_STYLE_TITLES[index % FALLBACK_GALLERY_STYLE_TITLES.length]} ${industryLanguage.space}`,
      source: "fallback",
      retrievalMatch: "broad",
      primaryScope: pricingScopes[0] || selectedService?.label || null,
      scopeKey: pricingScopes[0] || selectedService?.label || null,
      finishTier: stateRef.current.finishTierId,
      tags: pricingScopes,
    }));

  const prefetchPricingGallery = async (): Promise<Array<Record<string, any>>> => {
    const current = stateRef.current;
    const serviceId = String(current.serviceId || "").trim();
    if (!serviceId) return [];
    if (
      pricingGalleryPrefetchRef.current?.serviceId === serviceId &&
      pricingGalleryPrefetchRef.current.rows.length
    ) {
      return pricingGalleryPrefetchRef.current.rows;
    }
    if (pricingGalleryPrefetchPromiseRef.current?.serviceId === serviceId) {
      return pricingGalleryPrefetchPromiseRef.current.promise;
    }
    const promise = callAdventurePipeline(
      "discovery",
      designPayload({ startPath: "pricing", finishTier: null, budgetBandId: null }),
      { offset: 0, limit: PRICING_GALLERY_MAX, unfiltered: true }
    ).then((response) => {
      const upstreamRows = Array.isArray(response?.images) ? response.images : [];
      // Pricing discovery is an enhancement, not a single point of failure.
      // Keep Step 4 usable during a pipeline outage with curated service covers.
      const rows = upstreamRows.length ? upstreamRows : fallbackRowsForPricingGallery();
      pricingGalleryPrefetchRef.current = { serviceId, rows };
      if (pricingGalleryPrefetchPromiseRef.current?.serviceId === serviceId) {
        pricingGalleryPrefetchPromiseRef.current = null;
      }
      return rows;
    });
    pricingGalleryPrefetchPromiseRef.current = { serviceId, promise };
    return promise;
  };

  const dropBrokenPricingProject = useCallback((lookId: string) => {
    setState((prev) => {
      if (prev.photoPathChosen !== false || !prev.looks.some((look) => look.id === lookId)) return prev;
      const selectedFailed = prev.selectedDesignId === lookId;
      return {
        ...prev,
        looks: prev.looks.filter((look) => look.id !== lookId),
        selectedDesignId: selectedFailed ? null : prev.selectedDesignId,
        activeRevisionIndex: -1,
      };
    });
  }, []);

  const loadPricingGallery = async () => {
    const current = stateRef.current;
    if (!current.serviceId) return;
    const token = ++starterGenRef.current;
    setPricingGalleryVisibleCount(PRICING_GALLERY_PAGE_SIZE);
    const cachedRows = pricingGalleryPrefetchRef.current?.serviceId === current.serviceId
      ? pricingGalleryPrefetchRef.current.rows
      : [];
    setError(null);
    patch({
      stage: "visual",
      photoUrl: null,
      photoSkipped: true,
      photoPathChosen: false,
      pricingParts: [],
      looks: [],
      favorites: [],
      selectedDesignId: null,
      activeRevisionIndex: -1,
      galleryOffset: 0,
      galleryHasMore: false,
      generating: cachedRows.length === 0,
      generatingLabel: cachedRows.length ? "" : copy.gallery.loading,
    });
    const liveRows = cachedRows.length ? cachedRows : await prefetchPricingGallery();
    if (starterGenRef.current !== token) return;
    // The complete catalog is already in memory. Map it for display only; the
    // chosen image is analyzed lazily in the next step.
    const requestedPageRows = uniquePricingProjects(
      liveRows
        .map((row: Record<string, any>, index: number) =>
          mapPricingProject(row, index, row.source === "fallback" ? "fallback" : undefined, {
            allowPricingFallback: true,
            allowBroadFallback: true,
          })
        )
        .filter((row: V8GeneratedImage | null): row is V8GeneratedImage => Boolean(row))
    ).map((row, visibleIndex) => ({
      ...row,
      pinAspect: PRICING_PIN_ASPECTS[
        visibleIndex % PRICING_PIN_ASPECTS.length
      ],
    }));
    // Put URLs in the DOM immediately. Native eager/lazy loading paints the
    // first viewport progressively; broken URLs drop themselves via onError.
    const pageRows = requestedPageRows;
    const qualifiedRows = uniquePricingProjects(pageRows)
      .slice(0, PRICING_GALLERY_MAX);
    patch({
      stage: "visual",
      looks: qualifiedRows,
      generating: false,
      generatingLabel: "",
      galleryOffset: liveRows.length,
      galleryHasMore: false,
    });
    if (pageRows.length) {
      void curateAdventureImages(instanceId, {
        events: pageRows.map((look) => ({
          type: "shown",
          url: look.url,
          source: look.source,
          mode: "pricing_discovery",
        })),
      });
    }
    if (qualifiedRows.length === 0) {
      setError("We couldn’t load the project gallery yet. Please try again.");
    }
  };

  useEffect(() => {
    if (!pricingGalleryOpen || !state.looks.length) return;
    const node = pricingMasonryRef.current;
    if (!node) return;
    const updateColumnCount = () => {
      const width = node.getBoundingClientRect().width;
      const next = uiVersion === "v9"
        ? width >= 1100 ? 3 : width >= 700 ? 2 : 1
        : width >= 1180 ? 3 : width >= 560 ? 2 : 1;
      setPricingColumnCount((current) => current === next ? current : next);
    };
    updateColumnCount();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateColumnCount);
      return () => window.removeEventListener("resize", updateColumnCount);
    }
    const observer = new ResizeObserver(updateColumnCount);
    observer.observe(node);
    return () => observer.disconnect();
  }, [pricingGalleryOpen, state.looks.length, uiVersion]);

  useEffect(() => {
    if (!pricingGalleryOpen || pricingGalleryVisibleCount >= pricingGalleryItems.length) return;
    const root = pricingGalleryScrollRef.current;
    const sentinel = pricingGalleryLoadSentinelRef.current;
    if (!root || !sentinel || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setPricingGalleryVisibleCount((count) =>
          Math.min(count + PRICING_GALLERY_PAGE_SIZE, pricingGalleryItems.length)
        );
      },
      { root, rootMargin: "600px 0px", threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [pricingGalleryItems.length, pricingGalleryOpen, pricingGalleryVisibleCount]);

  const generatePhotoConcept = async () => {
    const current = stateRef.current;
    const style = FULL_ROOM_STYLES.find((option) => option.id === current.styleId);
    if (!current.photoUrl || !style || !current.serviceId) return;
    const token = ++lookGenRef.current;
    const styleReference =
      CURATED_STYLE_REFERENCES[refinementProject]?.[style.id] ||
      refinementImages[FULL_ROOM_STYLES.findIndex((option) => option.id === style.id) % refinementImages.length];
    const absoluteStyleReference =
      typeof window !== "undefined" && styleReference?.startsWith("/")
        ? new URL(styleReference, window.location.origin).toString()
        : styleReference;
    const modeInstruction =
      mode === "spatial"
        ? "Preserve the actual spatial structure, camera, openings, and usable circulation. Apply only plausible changes for the selected whole-space scope."
        : `Focus the transformation on ${scopeLabel || "the selected component"}. Preserve the surrounding room and all unrelated elements.`;
    const styleInstruction =
      mode === "spatial"
        ? `Selected visual direction: ${style.label}. ${style.prompt}`
        : `Use the ${style.label} reference only to choose a compatible palette, material, finish, and hardware for ${scopeLabel || "the selected component"}; do not restyle the surrounding room.`;
    setError(null);
    patch({
      stage: "style",
      generating: true,
      generatingLabel: "Creating a personalized concept for your space…",
    });
    const prompt = [
      `Create one personalized ${selectedService?.label || "project"} concept for the customer's actual property photo.`,
      `Selected scope: ${scopeLabel || "the requested project"}.`,
      `Directional budget: about ${formatMoney(current.budget)}. Keep all visible choices plausible at this spend level.`,
      styleInstruction,
      modeInstruction,
      "Use the uploaded photo as the immutable source of geometry and perspective. Do not replace it with the style reference's room or composition.",
      "No text, labels, people, logos, or watermarks.",
    ].join(" ");
    const url = await generateV8DesignImage({
      instanceId,
      prompt,
      photoUrl: current.photoUrl,
      styleUrls: absoluteStyleReference ? [absoluteStyleReference] : [],
      service: selectedService?.label,
      industry: selectedService?.industryName || undefined,
      serviceSummary: selectedService?.serviceSummary,
      scope: scopeLabel,
      budget: current.budget,
      modelId: DISCOVERY_MODELS.edit,
      generationIntent: "personalized-concept",
      useCase: "scene-refinement",
    });
    if (lookGenRef.current !== token) return;
    if (!url) {
      patch({ stage: "style", generating: false, generatingLabel: "" });
      setError("We couldn’t create that concept. Try the style again or choose another direction.");
      return;
    }
    const direction: V8VisualDirection = {
      label: style.label,
      prompt,
      family: style.id,
      palette: style.palette?.join(", "),
      style: style.label,
    };
    const look: V8GeneratedImage = {
      id: `photo-concept-${Date.now()}`,
      url,
      label: `${style.label} concept`,
      cue: "Personalized concept",
      source: "generated",
      styleLabel: style.label,
      scopeLabel,
      finishTier: current.finishTierId,
      budget: current.budget,
      estimate: budgetPrice(current.budget),
      direction,
      modelId: DISCOVERY_MODELS.edit,
      pinAspect: pinAspectRatio(`photo-concept-${current.sessionId}`),
      tags: catalogTags({
        serviceLabel: selectedService?.label,
        scopes: pricingScopes,
        scope: scopeLabel,
        finishTier: current.finishTierId,
        direction,
      }),
    };
    enterStudioWithLook(look, {
      mode: "photo_concept",
      photoUrl: current.photoUrl,
      photoSkipped: false,
      photoPathChosen: true,
    });
  };

  const updateChangeNote = (
    note: string,
    explicitBudgetDelta?: number,
    reference: RefinementReference | null = null
  ) => {
    const nextNote = String(note || "");
    setSelectedRefinementReference(reference);
    const inferredDelta = nextNote.trim()
      ? buildRefinementPlan({
          note: nextNote,
          serviceLabel: selectedService?.label,
          scopeLabel,
          budget: state.budget,
        }).estimatedBudgetDelta
      : 0;
    patch({
      changeNote: nextNote,
      pendingBudgetDelta: Number.isFinite(explicitBudgetDelta)
        ? Number(explicitBudgetDelta)
        : inferredDelta,
    });
  };

  const selectQuickRefinement = (
    option: QuickRefinementOption | V8RefinementOption,
    reference: RefinementReference | null = null
  ) => {
    if (state.generating || state.refineRemaining <= 0) return;
    updateChangeNote(option.prompt, option.budgetDelta, reference);
  };

  const shiftProjectBudget = (direction: "down" | "up") => {
    if (state.generating || state.refineRemaining <= 0) return;
    const lowerBound = Math.max(0, Math.round(budgetBounds.min || 0));
    const upperBound = Math.max(
      lowerBound,
      Math.round(budgetBounds.max || state.budget + budgetRefinementStep)
    );
    const requested =
      state.budget +
      (direction === "up" ? budgetRefinementStep : -budgetRefinementStep);
    const nextBudget = Math.min(upperBound, Math.max(lowerBound, requested));
    const budgetDelta = nextBudget - state.budget;
    if (budgetDelta === 0) return;
    const amount = Math.abs(budgetDelta);
    const visibleRecipe =
      refinementProject === "bathroom"
        ? budgetDelta > 0
          ? "Visibly upgrade two or three existing elements: use a more refined buildable finish on the current vanity, use a cleaner premium-looking counter or wet-zone tile specification, and improve the existing faucet, hardware, mirror, or lighting quality."
          : "Visibly simplify two or three existing elements: use a straightforward stock vanity finish, a clean standard quartz or porcelain surface, and simpler chrome or brushed-nickel hardware and lighting."
        : refinementProject === "kitchen"
          ? budgetDelta > 0
            ? "Visibly upgrade two or three existing elements: improve the current cabinet-front material and detailing, use a more refined counter or backsplash specification, and upgrade the existing faucet, hardware, or lighting."
            : "Visibly simplify two or three existing elements: use straightforward stock cabinet fronts, a clean standard counter or backsplash, and simpler hardware and lighting."
          : refinementProject === "landscaping"
            ? budgetDelta > 0
              ? "Visibly upgrade two or three existing elements: improve the paving material, add more intentional layered planting within existing beds, and refine the existing lighting or seating specification."
              : "Visibly simplify two or three existing elements: use economical clean paving, a simpler planting mix within existing beds, and straightforward lighting or seating."
            : budgetDelta > 0
              ? "Visibly upgrade two or three existing materials, built-ins, hardware, or lights by one realistic quality tier."
              : "Visibly simplify two or three existing materials, built-ins, hardware, or lights by one realistic quality tier.";
    const note =
      budgetDelta > 0
        ? `BUDGET CONTROL: Move the current design one small finish-quality step up, representing about $${amount.toLocaleString()} in visible value. ${visibleRecipe} Keep the current room style and palette coherent. Make the quality improvement clearly visible, but do not add components or make the room ostentatious. A lighting-only or color-grading-only change is not sufficient. Preserve the exact camera, geometry, component locations, and fixture count.`
        : `BUDGET CONTROL: Value engineer the current design by one small finish-quality step, representing about $${amount.toLocaleString()} in savings. ${visibleRecipe} Keep it attractive, coordinated, clean, and professionally designed—never damaged, dirty, unfinished, or intentionally cheap-looking. A lighting-only or color-grading-only change is not sufficient. Preserve the exact camera, geometry, component locations, and fixture count.`;
    setSelectedRefinementReference(null);
    patch({ changeNote: "", pendingBudgetDelta: 0 });
    void applyChange({ note, budgetDelta, reference: null });
  };

  const goToRevision = (requestedIndex: number) => {
    if (state.generating || state.looks.length === 0) return;
    const index = Math.min(Math.max(0, requestedIndex), state.looks.length - 1);
    const revision = state.looks[index];
    if (!revision) return;
    setSelectedRefinementReference(null);
    patch({
      activeRevisionIndex: index,
      selectedDesignId: revision.id,
      budget: revision.budget ?? state.budget,
      estimate: revision.estimate ?? state.estimate,
      changeNote: "",
      pendingBudgetDelta: 0,
    });
  };

  const viewDesignFullscreen = async () => {
    const activeFrame = pricingProjectOpen ? pricingCanvasRef.current : heroRef.current;
    if (!state.emailCaptured || !selectedDesign || !activeFrame) return;
    setError(null);
    try {
      const frame = activeFrame as HTMLElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (typeof frame.requestFullscreen === "function") {
        await frame.requestFullscreen();
      } else if (typeof frame.webkitRequestFullscreen === "function") {
        await frame.webkitRequestFullscreen();
      } else {
        window.open(selectedDesign.url, "_blank", "noopener,noreferrer");
      }
    } catch {
      setError("Unable to open this design full screen.");
    }
  };

  const downloadDesign = async () => {
    if (!state.emailCaptured || !selectedDesign) return;
    setError(null);
    const safeName = String(selectedService?.label || "project-design")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "project-design";
    try {
      const response = await fetch(selectedDesign.url, { cache: "no-store" });
      if (!response.ok) throw new Error("Download unavailable");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${safeName}-design.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      const link = document.createElement("a");
      link.href = selectedDesign.url;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  };

  const shareDesign = async () => {
    if (!state.emailCaptured || !selectedDesign) return;
    setError(null);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: selectedProjectTitle,
          text: `See this ${String(selectedService?.label || "design").toLowerCase()}.`,
          url: selectedDesign.url,
        });
        return;
      }
      await navigator.clipboard.writeText(selectedDesign.url);
      setPricingShareStatus("Link copied");
      if (pricingShareStatusTimerRef.current) window.clearTimeout(pricingShareStatusTimerRef.current);
      pricingShareStatusTimerRef.current = window.setTimeout(() => {
        setPricingShareStatus("");
        pricingShareStatusTimerRef.current = null;
      }, 2_000);
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") return;
      setError("Unable to share this design.");
    }
  };

  const applyChange = async (override?: {
    note: string;
    budgetDelta?: number;
    reference?: RefinementReference | null;
  }): Promise<boolean> => {
    const note = String(override?.note ?? state.changeNote).trim();
    const pendingBudgetDelta = Number(override?.budgetDelta ?? state.pendingBudgetDelta ?? 0);
    const activeRefinementReference = override
      ? override.reference || null
      : selectedRefinementReference;
    if (!note || !selectedDesign) return false;
    if (state.refineRemaining <= 0) {
      setError("That’s all the refinements for this design.");
      return false;
    }
    setPricingCanvasView("after");
    setError(null);
    const plannedRefinement = buildRefinementPlan({
      note,
      serviceLabel: selectedService?.label,
      scopeLabel,
      budget: state.budget,
    });
    const isStylePreset = activeRefinementReference?.kind === "style";
    const isSpaceReference =
      activeRefinementReference?.kind === "space" && Boolean(activeRefinementReference.imageUrl);
    const isBudgetControl = /^BUDGET CONTROL:/i.test(note);
    const plan: RefinementPlan = isStylePreset
      ? {
          mode: "global_style",
          target: null,
          interpretedNote: note,
          estimatedBudgetDelta: pendingBudgetDelta,
          generationIntent: "style_shift",
          modelPath: "fast-first",
          loaderLabel: `Applying ${activeRefinementReference.label} style…`,
          prompt: [
            `STYLE PRESET: ${activeRefinementReference.label}.`,
            `STYLE FINGERPRINT: ${activeRefinementReference.stylePrompt || note}`,
            "REFINEMENT SCOPE: TOTAL, MUTUALLY EXCLUSIVE WHOLE-ROOM STYLE REPLACEMENT.",
            "This preset revokes every earlier room-style preset. Fully replace the current design language; never blend, layer, average, or harmonize the new preset with colors, materials, fixture styling, or decorative choices left by a previous preset.",
            activeRefinementReference.imageUrl
              ? "The current design is the only source of geometry, camera, composition, architecture, and item placement. Use the uploaded inspiration only for its visual style."
              : "The current customer image is the only image input and the only source of room geometry, camera, composition, architecture, and item placement.",
            "Apply the new fingerprint comprehensively by respecifying every visible style-defining element in one pass: cabinetry or vanity fronts, counters, appropriate wall and floor surfaces, tile, plumbing trim, hardware, mirror styling, and existing light fixtures.",
            "Remove all visually conflicting remnants of the prior style. The finished room must read immediately and consistently as only the newly selected preset.",
            "Choose the nearest physically plausible equivalent for each element already present. Do not paste in another room, borrow another composition, create a collage, overlay a reference scene, or blend two interiors.",
            "Do not add, remove, relocate, duplicate, enlarge, or shrink any vanity, shower, tub, toilet, sink, window, door, light, or other major component.",
            "Preserve the source image's exact framing, perspective, walls, openings, fixture count, and spatial relationships. The result must look like the same room professionally restyled in place.",
            "No text, labels, people, logos, or watermarks.",
          ].join(" "),
        }
      : isBudgetControl
        ? {
            mode: "budget_shift",
            target: null,
            interpretedNote: note,
            estimatedBudgetDelta: pendingBudgetDelta,
            generationIntent:
              pendingBudgetDelta > 0 ? "budget_upgrade" : "value_engineering",
            modelPath: "fast-first",
            loaderLabel:
              pendingBudgetDelta > 0
                ? "Upgrading visible finish quality…"
                : "Value engineering visible finishes…",
            prompt: [
              note,
              "REFINEMENT SCOPE: FORCED WHOLE-DESIGN FINISH-TIER SHIFT.",
              "Execute the requested two or three visible material or product substitutions in the existing room; do not interpret this as a single-component edit.",
              "The before-and-after quality difference must be readable at normal viewing size while the design style, layout, architecture, camera, openings, and exact component inventory remain fixed.",
              "Do not change exposure, white balance, contrast, styling accessories, or image color grading as a substitute for changing real visible specifications.",
              "No text, labels, people, logos, or watermarks.",
            ].join(" "),
          }
        : plannedRefinement;
    const lowerBound = Math.max(0, Math.round(budgetBounds.min || 0));
    const upperBound = Math.max(lowerBound, Math.round(budgetBounds.max || state.budget));
    const budgetDelta = Number(pendingBudgetDelta || plan.estimatedBudgetDelta || 0);
    const targetBudget = Math.min(upperBound, Math.max(lowerBound, state.budget + budgetDelta));
    const targetEstimate = budgetDelta
      ? refinementEstimate(targetBudget, budgetRefinementStep)
      : selectedDesign.estimate || state.estimate || budgetPrice(targetBudget);
    const componentBoundaryGuidance =
      activeRefinementReference?.kind === "item"
        ? [
            `ITEM SELECTION: ${activeRefinementReference.label}.`,
            `TARGET COMPONENT: ${activeRefinementReference.target || plan.target || "the named existing component"}.`,
            "REFINEMENT SCOPE: STRICT LOCAL IN-PLACE COMPONENT EDIT.",
            "The current customer room is the only image input. The selector thumbnail is a visual menu preview only and must not be used as another scene or composition.",
            "Change only the finish, material, color, face style, or hardware of the target component requested in the edit instruction.",
            "Treat the target's exact existing silhouette and immediate material contact edges as the edit boundary. Pixels and objects outside that boundary are locked and should remain visually identical to the source.",
            "Preserve the target's current location, width, height, depth, count, plumbing points, and relationship to adjacent surfaces. Never replace it with a larger scene, copy a showroom, extend cabinetry, or add another sink, mirror, vanity, toilet, tub, shower, light, door, or window.",
            "If a requested detail cannot fit inside the existing component footprint, simplify that detail instead of changing the room.",
          ].join(" ")
        : "";
    const uploadedReferenceGuidance = isSpaceReference
      ? [
          `CUSTOMER SPACE: Use the uploaded ${industryLanguage.space} as the only source of geometry, camera, architecture, openings, and item placement.`,
          "Use the selected example only as a style and finish direction. Adapt that direction to the customer space without copying the example layout.",
          "Preserve the customer's real spatial structure and make only physically plausible changes.",
        ].join(" ")
      : activeRefinementReference?.imageUrl
        ? "Use the uploaded inspiration image only for colors, materials, and style. Keep the current design's layout and geometry unchanged."
        : "";
    const authoredPrompt = [plan.prompt, componentBoundaryGuidance, uploadedReferenceGuidance]
      .filter(Boolean)
      .join("\n\n");
    const activeHistory = state.looks.slice(
      0,
      Math.min(Math.max(0, state.activeRevisionIndex), state.looks.length - 1) + 1
    );
    const isWholeRoomStyleRevision = (look: V8GeneratedImage) =>
      look.direction?.family === "global_style" ||
      look.direction?.prompt?.includes("STYLE PRESET:") ||
      look.direction?.label === "Whole-canvas style shift";
    const refinementSourceDesign = isStylePreset
      ? [...activeHistory].reverse().find((look) => !isWholeRoomStyleRevision(look)) || selectedDesign
      : selectedDesign;
    patch({ generating: true, generatingLabel: plan.loaderLabel });
    const requestRefinement = (modelId: string) =>
      generateV8DesignImage({
        instanceId,
        prompt: authoredPrompt,
        photoUrl: isSpaceReference
          ? activeRefinementReference?.imageUrl
          : refinementSourceDesign.url,
        styleUrls: activeRefinementReference?.imageUrl
          ? isSpaceReference
            ? [refinementSourceDesign.url]
            : [activeRefinementReference.imageUrl]
          : [],
        service: selectedService?.label,
        industry: selectedService?.industryName || undefined,
        serviceSummary: selectedService?.serviceSummary,
        scope: scopeLabel,
        budget: targetBudget,
        modelId,
        generationIntent: plan.generationIntent,
        useCase: "scene-refinement",
      });
    // Keep the interactive loop predictably fast. A failed fast edit is surfaced
    // for retry instead of silently adding a 20+ second quality-model fallback.
    const primaryModel = DISCOVERY_MODELS.fastEdit;
    const url = await requestRefinement(primaryModel);
    if (!url) {
      patch({ generating: false, generatingLabel: "" });
      setError("Couldn’t apply that change. Your estimate was not changed.");
      return false;
    }
    const manifestAnalysis = await analyzeV8ProjectManifest({
      instanceId,
      imageUrl: url,
      serviceId: state.serviceId,
      serviceLabel: selectedService?.label,
      scopes: pricingScopes,
    });
    const previousInventory = new Set(
      (selectedDesign.projectManifest?.components || []).map((component) =>
        v2ScopeStarterKey(component.key || component.label)
      )
    );
    const nextInventory = new Set(
      (manifestAnalysis?.manifest.components || []).map((component) =>
        v2ScopeStarterKey(component.key || component.label)
      )
    );
    const inventoryChanged = !isSpaceReference && previousInventory.size > 0 && (
      previousInventory.size !== nextInventory.size ||
      Array.from(previousInventory).some((component) => !nextInventory.has(component))
    );
    if (!manifestAnalysis || inventoryChanged) {
      patch({ generating: false, generatingLabel: "" });
      setError("That version changed the project scope, so it wasn’t applied. Your estimate was not changed.");
      return false;
    }
    const next: V8GeneratedImage = {
      id: `refine-${Date.now()}`,
      url,
      label: selectedDesign.label,
      cue: STARTER_CUE,
      source: "generated",
      modelId: primaryModel,
      styleLabel: selectedDesign.styleLabel,
      scopeLabel: selectedDesign.scopeLabel,
      finishTier: selectedDesign.finishTier,
      budget: targetBudget,
      estimate: targetEstimate,
      primaryScope: selectedDesign.primaryScope,
      includedItems: selectedDesign.includedItems,
      projectManifest: manifestAnalysis.manifest,
      focusRegions: selectedDesign.focusRegions,
      focusOutlines: selectedDesign.focusOutlines,
      beforeUrl: isSpaceReference ? activeRefinementReference?.imageUrl : selectedDesign.beforeUrl,
      tags: selectedDesign.tags,
      direction: selectedDesign.direction
        ? {
            ...selectedDesign.direction,
            prompt: authoredPrompt,
            family: plan.mode,
            label:
              plan.mode === "component_tier_shift" && plan.target
                ? `Upgraded ${plan.target}`
                : plan.mode === "targeted_component" && plan.target
                  ? `Changed ${plan.target}`
                  : plan.mode === "budget_shift"
                    ? "Budget-adjusted design"
                    : plan.mode === "camera_shift"
                      ? "Alternate view"
                  : plan.mode === "global_style"
                    ? "Whole-canvas style shift"
                    : selectedDesign.direction.label,
          }
        : {
            label:
              plan.mode === "component_tier_shift" && plan.target
                ? `Upgraded ${plan.target}`
                : plan.mode === "targeted_component" && plan.target
                  ? `Changed ${plan.target}`
                  : plan.mode === "budget_shift"
                    ? "Budget-adjusted design"
                    : plan.mode === "camera_shift"
                      ? "Alternate view"
                  : plan.mode === "global_style"
                    ? "Whole-canvas style shift"
                    : "Refined starter canvas",
            prompt: authoredPrompt,
            family: plan.mode,
          },
    };
    setState((prev) => {
      if (prev.photoPathChosen === false) {
        const selectedIndex = prev.looks.findIndex((look) => look.id === prev.selectedDesignId);
        const gallery = selectedIndex >= 0
          ? prev.looks.map((look, index) => (index === selectedIndex ? next : look))
          : [next, ...prev.looks];
        return {
          ...prev,
          looks: gallery,
          selectedDesignId: next.id,
          activeRevisionIndex: -1,
          favorites: [next.id],
          budget: targetBudget,
          estimate: targetEstimate,
          photoUrl: isSpaceReference ? activeRefinementReference?.imageUrl || prev.photoUrl : prev.photoUrl,
          photoSkipped: isSpaceReference ? false : prev.photoSkipped,
          changeNote: "",
          pendingBudgetDelta: 0,
          refineRemaining: Math.max(0, prev.refineRemaining - 1),
          generating: false,
          generatingLabel: "",
        };
      }
      const branchIndex = prev.looks.length
        ? Math.min(Math.max(0, prev.activeRevisionIndex), prev.looks.length - 1)
        : -1;
      const history = [...prev.looks.slice(0, branchIndex + 1), next];
      return {
        ...prev,
        looks: history,
        selectedDesignId: next.id,
        activeRevisionIndex: history.length - 1,
        favorites: [next.id],
        budget: targetBudget,
        estimate: targetEstimate,
        changeNote: "",
        pendingBudgetDelta: 0,
        refineRemaining: Math.max(0, prev.refineRemaining - 1),
        generating: false,
        generatingLabel: "",
      };
    });
    setSelectedRefinementReference(null);
    if (isStylePreset) setOpenRefinementSection("items");
    const nextPricedItems = pricedItemsForProject(next, pricingScopes, scopeQuestion);
    if (nextPricedItems.length) void loadManifestPricing(next, nextPricedItems);
    void curateAdventureImages(instanceId, {
      events: [{ type: "saved", url, source: "generated", mode: "refine" }],
      candidates: [generatedWriteBack(next, {
        serviceId: state.serviceId,
        serviceLabel: selectedService?.label || "Project",
        industry: selectedService?.industryName || undefined,
        scope: scopeLabel,
        scopes: namedScopes,
        mode: "refine",
        finishTier: state.finishTierId,
      })],
      writeBack: true,
    });
    return true;
  };

  const applyQuickRefinement = (
    option: QuickRefinementOption,
    reference: RefinementReference | null = null
  ) => {
    if (state.generating || state.refineRemaining <= 0) return;
    void applyChange({
      note: option.prompt,
      budgetDelta: option.budgetDelta || 0,
      reference,
    });
  };

  const refreshEstimate = useCallback(async () => {
    const current = stateRef.current;
    const look = current.looks.find((row) => row.id === current.selectedDesignId) || current.looks[0];
    const lookTierId = look?.finishTier || current.finishTierId;
    const tier =
      finishTiers.find((row) => row.id === lookTierId) ||
      finishTiers.find((row) => row.id === current.finishTierId) ||
      selectedTier;
    patch({ estimate: tier ? priceForFinishTier(tier) : budgetPrice(current.budget) });
  }, [finishTiers, patch, selectedTier]);

  const projectSnapshot = useCallback((): V8ProjectSnapshot => {
    const businessLabel =
      selectedService?.businessLabel || selectedService?.serviceName || selectedService?.label || "Project";
    const favoriteUrls = state.favorites
      .map((id) => state.looks.find((img) => img.id === id)?.url)
      .filter((url): url is string => Boolean(url));
    return {
      instanceId,
      service: {
        id: state.serviceId || "",
        businessLabel,
        customerLabel: selectedService?.customerLabel || selectedService?.label || businessLabel,
        industry: selectedService?.industryName || undefined,
        summary: selectedService?.serviceSummary || undefined,
      },
      scope: scopeLabel,
      otherText: otherSelected ? state.otherScope : undefined,
      budget: state.budget,
      photoUrl: state.photoUrl,
      styleUrls: favoriteUrls,
      designUrl: selectedDesign?.url || null,
      estimate: state.estimate,
      pricingParts: state.pricingParts.length ? state.pricingParts : pricingScopes,
      experiencePath: state.photoPathChosen ? "photo" : "pricing",
    };
  }, [
    instanceId,
    scopeLabel,
    selectedDesign?.url,
    selectedService,
    pricingScopes,
    state.budget,
    state.estimate,
    state.favorites,
    state.looks,
    state.otherScope,
    otherSelected,
    state.photoUrl,
    state.photoPathChosen,
    state.pricingParts,
    state.serviceId,
  ]);

  const saveLead = async (extra?: { phone?: string; intent?: string | null; email?: string }) => {
    const email = (extra?.email ?? state.email).trim();
    const res = await fetch("/api/adventure/v8/leads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instanceId,
        sessionId: state.sessionId,
        email,
        phone: extra?.phone || state.phone || null,
        submissionData: {
          project: projectSnapshot(),
          intent: extra?.intent ?? state.connectIntent,
        },
      }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.ok) return null;
    return String(data.submissionId || "") || null;
  };

  const onSelectService = (serviceId: string) => {
    const service = services.find((s) => s.value === serviceId) || null;
    pricingGalleryPrefetchRef.current = null;
    pricingGalleryPrefetchPromiseRef.current = null;
    setScopeQuestion(scopeIntakeForService(service));
    patch({
      serviceId,
      scopes: [],
      otherScope: "",
      generating: false,
      generatingLabel: "",
      stage: "project",
      looks: [],
      photoUrl: null,
      photoSkipped: false,
      photoPathChosen: null,
      pricingParts: [],
      teaserEstimate: null,
      layoutId: null,
      styleId: null,
      moodId: null,
      railQuestion: "refine",
      selectedDesignId: null,
      activeRevisionIndex: -1,
      pendingBudgetDelta: 0,
    });
    setLayoutThumbs({});
    setStyleThumbs({});
    setRefinementCatalog(null);
    setRefinementCategoryId("");
    setRefinementCatalogFailed(false);
  };

  const onSelectScope = (scope: string) => {
    if (isFullScopeLabel(scope, scopeQuestion)) {
      const has = state.scopes.includes(scope);
      const keptOther = has ? [] : state.scopes.filter(isOther);
      patch({ scopes: has ? keptOther : [scope, ...keptOther], otherScope: keptOther.length ? state.otherScope : "" });
      return;
    }
    const withoutFull = state.scopes.filter((item) => !isFullScopeLabel(item, scopeQuestion));
    const has = withoutFull.includes(scope);
    const next = has ? withoutFull.filter((item) => item !== scope) : [...withoutFull, scope];
    patch({ scopes: next, otherScope: next.some(isOther) ? state.otherScope : "" });
  };

  const goToBudget = () => {
    if (!scopeReady) return;
    const next = budgetBandCacheRef.current.get(budgetScopeKey) || immediateBudgetBounds;
    patch({
      stage: "budget",
      budgetBounds: next,
      finishTierId: null,
      budget: startingBudget(next),
    });
    // Usually already in flight from the scope step. This call only ensures a
    // fast visitor does not outrun the speculative prefetch.
    void prefetchBudgetBands();
    // Load the full inspiration catalog while the visitor completes the next
    // two steps. The no-photo gallery then opens from memory.
    void prefetchPricingGallery();
  };

  const goToPath = () => {
    if (!scopeReady || !state.finishTierId) return;
    const tier = finishTiers.find((row) => row.id === state.finishTierId) || selectedTier;
    patch({
      stage: "path",
      teaserEstimate: tier ? priceForFinishTier(tier) : budgetPrice(state.budget),
      generating: false,
      generatingLabel: "",
      photoPathChosen: null,
      pricingParts: [],
    });
  };

  const onPhotoSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to continue.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That photo is too large. Choose one under 15 MB.");
      return;
    }
    setError(null);
    patch({
      stage: "path",
      photoPathChosen: true,
      generating: true,
      generatingLabel: "Uploading your reference photo…",
    });
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Unable to read that photo."));
        reader.readAsDataURL(file);
      });
      const uploadResponse = await fetch(`/api/v2/assets/${encodeURIComponent(instanceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, kind: "scene", image: dataUrl }),
      });
      const uploadData = await uploadResponse.json().catch(() => null);
      const publicUrl = uploadData?.asset?.url ? String(uploadData.asset.url) : "";
      if (!uploadResponse.ok || !publicUrl) {
        throw new Error(String(uploadData?.error || "Unable to upload that photo."));
      }
      patch({
        stage: "style",
        photoUrl: publicUrl,
        photoSkipped: false,
        photoPathChosen: true,
        styleId: null,
        looks: [],
        favorites: [],
        selectedDesignId: null,
        activeRevisionIndex: -1,
        pricingParts: [],
        generating: false,
        generatingLabel: "",
      });
    } catch (photoError) {
      patch({ generating: false, generatingLabel: "" });
      setError(photoError instanceof Error ? photoError.message : "Unable to use that photo.");
    } finally {
      if (uploadRef.current) uploadRef.current.value = "";
    }
  };

  const onPricingReferenceSelected = async (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Choose an image file to continue.");
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError("That photo is too large. Choose one under 15 MB.");
      return;
    }
    const referenceKind = pricingReferenceKindRef.current;
    setError(null);
    setPricingReferenceUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Unable to read that image."));
        reader.readAsDataURL(file);
      });
      const uploadResponse = await fetch(`/api/v2/assets/${encodeURIComponent(instanceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: state.sessionId, kind: "scene", image: dataUrl }),
      });
      const uploadData = await uploadResponse.json().catch(() => null);
      const publicUrl = uploadData?.asset?.url ? String(uploadData.asset.url) : "";
      if (!uploadResponse.ok || !publicUrl) {
        throw new Error(String(uploadData?.error || "Unable to upload that image."));
      }
      const reference: RefinementReference = referenceKind === "space"
        ? {
            kind: "space",
            label: `My ${industryLanguage.space}`,
            imageUrl: publicUrl,
          }
        : {
            kind: "style",
            label: "My inspiration",
            stylePrompt: "Use the uploaded image as the visual direction for colors, materials, and finish character.",
            imageUrl: publicUrl,
          };
      updateChangeNote(
        referenceKind === "space"
          ? `Apply this direction to my ${industryLanguage.space}.`
          : "Use this inspiration for the colors, materials, and overall feel.",
        0,
        reference
      );
      setSelectedPricingReviewItem("whole-project");
    } catch (referenceError) {
      setError(referenceError instanceof Error ? referenceError.message : "Unable to use that image.");
    } finally {
      setPricingReferenceUploading(false);
      if (pricingReferenceUploadRef.current) pricingReferenceUploadRef.current.value = "";
    }
  };

  const continueWithoutPhoto = async () => {
    await loadPricingGallery();
  };

  const loadManifestPricing = async (look: V8GeneratedImage, items: string[]) => {
    const requestId = ++manifestPricingRequestRef.current;
    setPricingManifestEstimates({});
    if (!items.length) {
      setPricingManifestPricingStatus("failed");
      return;
    }
    setPricingManifestPricingStatus("loading");
    const priced = await Promise.all(
      items.map(async (item) => {
        const response = await callAdventurePipeline(
          "estimate",
          designPayload({
            scope: item,
            scopes: [item],
            scopeKeys: [v2ScopeStarterKey(item)],
            selectedIdeaUrl: look.url,
            finishTier: look.finishTier || stateRef.current.finishTierId,
          })
        );
        const estimate = response?.estimate;
        const min = Number(estimate?.rangeLow ?? estimate?.min);
        const max = Number(estimate?.rangeHigh ?? estimate?.max);
        if (!(min > 0) || !(max >= min)) return null;
        return {
          item,
          estimate: {
            min,
            max,
            source: String(estimate?.source || "pricing_engine"),
          } satisfies V8Estimate,
        };
      })
    );
    if (manifestPricingRequestRef.current !== requestId) return;
    const complete = priced.filter((row): row is NonNullable<typeof row> => Boolean(row));
    if (complete.length !== items.length) {
      setPricingManifestPricingStatus("failed");
      return;
    }
    const byItem = Object.fromEntries(complete.map((row) => [row.item, row.estimate]));
    const total = complete.reduce(
      (sum, row) => ({ min: sum.min + row.estimate.min, max: sum.max + row.estimate.max }),
      { min: 0, max: 0 }
    );
    setPricingManifestEstimates(byItem);
    setPricingBaseEstimate(tightenPriceRangeForDisplay(total.min, total.max));
    setPricingManifestPricingStatus("ready");
    patch({ estimate: { ...total, source: "manifest_line_items" } });
  };

  const hydrateSelectedProjectManifest = async (look: V8GeneratedImage) => {
    const requestId = ++manifestAnalysisRequestRef.current;
    const analysis = await analyzeV8ProjectManifest({
      instanceId,
      imageUrl: look.url,
      serviceId: stateRef.current.serviceId,
      serviceLabel: selectedService?.label,
      scopes: pricingScopes,
    });
    if (manifestAnalysisRequestRef.current !== requestId) return;
    if (!analysis?.manifest) {
      if (!pricedItemsForProject(look, pricingScopes, scopeQuestion).length) {
        setPricingManifestPricingStatus("failed");
      }
      return;
    }
    const hydratedLook: V8GeneratedImage = {
      ...look,
      projectManifest: analysis.manifest,
      includedItems: analysis.manifest.components.map((component) => component.label || component.key),
    };
    const items = pricedItemsForProject(hydratedLook, pricingScopes, scopeQuestion);
    setState((prev) => ({
      ...prev,
      looks: prev.looks.map((row) => row.id === look.id ? hydratedLook : row),
      pricingParts: items,
    }));
    if (items.length) {
      void loadManifestPricing(hydratedLook, items);
    } else {
      setPricingManifestPricingStatus("failed");
    }
  };

  const selectPricingProject = (look: V8GeneratedImage) => {
    // Keep a background replenishment from replacing the card the visitor just chose.
    starterGenRef.current += 1;
    setError(null);
    setPricingUnlockSubmitting(false);
    setPricingDetailMode("review");
    setPricingEstimateUpdated(false);
    setSelectedPricingReviewItem("whole-project");
    setPricingCanvasView("after");
    setPricingWhatIfSelections({});
    setPricingOverallDirection("as-shown");
    setPricingManifestEstimates({});
    setPricingManifestPricingStatus("loading");
    setPendingPricingWhatIf(null);
    setPricingRefinementSuggestions(localPricingRefinementSuggestions("Anywhere"));
    setPricingSuggestionsLoading(false);
    setPricingShareStatus("");
    pricingSuggestionRequestRef.current += 1;
    const includedItems = pricedItemsForProject(look, pricingScopes, scopeQuestion);
    const baseEstimate = look.estimate || budgetPrice(state.budget);
    setPricingBaseEstimate(tightenPriceRangeForDisplay(baseEstimate.min, baseEstimate.max));
    patch({
      selectedDesignId: look.id,
      activeRevisionIndex: -1,
      pricingParts: includedItems,
      estimate: look.estimate || budgetPrice(state.budget),
      generating: false,
      generatingLabel: "",
    });
    if (includedItems.length) void loadManifestPricing(look, includedItems);
    if (
      !look.projectManifest ||
      look.projectManifest.analysisStatus !== "verified" ||
      !includedItems.length
    ) {
      void hydrateSelectedProjectManifest(look);
    }
    void curateAdventureImages(instanceId, {
      events: [{ type: "selected", url: look.url, source: look.source, mode: "pricing_discovery" }],
      candidates: look.source === "generated" ? [generatedWriteBack(look, {
        serviceId: state.serviceId,
        serviceLabel: selectedService?.label || "Project",
        industry: selectedService?.industryName || undefined,
        scope: scopeLabel,
        scopes: pricingScopes,
        mode: "pricing_discovery",
        finishTier: state.finishTierId,
      })] : [],
      writeBack: look.source === "generated",
    });
  };

  const applyPricingWhatIf = async (item: string, level: PricingWhatIfLevel) => {
    if (!state.emailCaptured || state.generating || state.refineRemaining <= 0) return;
    const currentLevel = pricingWhatIfSelections[item] || "as-shown";
    if (currentLevel === level) {
      return;
    }
    const baseLineItem = selectedProjectLineItemEstimates.find((row) => row.item === item);
    if (!baseLineItem) return;
    const baseMidpoint = (baseLineItem.min + baseLineItem.max) / 2;
    const budgetDelta = Math.round(
      baseMidpoint * (pricingWhatIfMultiplier(level) - pricingWhatIfMultiplier(currentLevel)) / 100
    ) * 100;
    setPricingEstimateUpdated(false);
    setPendingPricingWhatIf({ item, level });
    setPricingCanvasView("after");
    try {
      const applied = await applyChange({
        note: pricingWhatIfPrompt(item, level),
        budgetDelta,
        reference: { kind: "item", label: item, target: item },
      });
      if (applied) {
        setPricingWhatIfSelections((current) => ({ ...current, [item]: level }));
        setPricingEstimateUpdated(true);
      }
    } finally {
      setPendingPricingWhatIf(null);
    }
  };

  const applyPricingPromptRefinement = async () => {
    if (!state.changeNote.trim() || state.generating || state.refineRemaining <= 0) return;
    setPricingEstimateUpdated(false);
    const applied = await applyChange();
    if (applied) setPricingEstimateUpdated(true);
  };

  const applyPricingOverallDirection = async (level: PricingOverallDirection) => {
    if (level === pricingOverallDirection || state.generating || state.refineRemaining <= 0) return;
    const rank: Record<PricingOverallDirection, number> = {
      simpler: -1,
      "as-shown": 0,
      upgrade: 1,
    };
    const budgetDelta = (rank[level] - rank[pricingOverallDirection]) * budgetRefinementStep;
    const note = level === "simpler"
      ? "BUDGET CONTROL: Simplify the overall design by one realistic finish tier. Use clean standard materials and straightforward detailing while preserving the exact layout, camera, component locations, and fixture count."
      : level === "upgrade"
        ? "BUDGET CONTROL: Upgrade the overall design by one realistic finish tier. Improve the visible materials, finish quality, hardware, and detailing while preserving the exact layout, camera, component locations, and fixture count."
        : "BUDGET CONTROL: Return the overall design to its balanced as-shown finish level. Keep the current style, layout, camera, component locations, and fixture count unchanged.";
    setPricingEstimateUpdated(false);
    const applied = await applyChange({ note, budgetDelta, reference: null });
    if (applied) {
      setPricingOverallDirection(level);
      setPricingEstimateUpdated(true);
    }
  };

  const goToPrice = () => {
    if (!selectedDesign) return;
    patch({
      selectedDesignId: selectedDesign.id,
      stage: "price",
    });
    void refreshEstimate();
    if (!selectedDesign.url || selectedDesign.source === "fallback") return;
    const sourceMode = state.photoPathChosen ? "photo_concept" : "pricing_discovery";
    void curateAdventureImages(instanceId, {
      events: [{ type: "selected", url: selectedDesign.url, source: selectedDesign.source, mode: sourceMode }],
      candidates: selectedDesign.source === "generated" ? [generatedWriteBack(selectedDesign, {
        serviceId: state.serviceId,
        serviceLabel: selectedService?.label || "Project",
        industry: selectedService?.industryName || undefined,
        scope: scopeLabel,
        scopes: pricingScopes,
        mode: sourceMode,
        finishTier: state.finishTierId,
      })] : [],
      writeBack: selectedDesign.source === "generated",
    });
  };

  const captureEmail = async (candidateEmail?: string) => {
    if (pricingUnlockSubmitting) return;
    const email = (candidateEmail ?? state.email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email to continue.");
      return;
    }
    setError(null);
    setPricingUnlockSubmitting(true);
    try {
      if (!state.estimate) await refreshEstimate();
      const submissionId = await saveLead({ email });
      if (!submissionId) {
        setError("Couldn’t save that email. Try again.");
        return;
      }
      setPricingDetailMode("review");
      setPricingEstimateUpdated(false);
      setSelectedPricingReviewItem("whole-project");
      setPricingCanvasView("after");
      patch({
        email,
        emailCaptured: true,
        submissionId,
        favorites: selectedDesign?.id ? [selectedDesign.id] : state.favorites,
      });
    } catch {
      setError("Couldn’t unlock pricing. Try again.");
    } finally {
      setPricingUnlockSubmitting(false);
    }
  };

  const capturePhone = async () => {
    if (!state.connectIntent) return;
    if (state.phone.trim().length < 7) {
      setError(
        state.connectIntent === "photo_application"
          ? "Enter a mobile number so the business can text you for the photo."
          : "Enter a phone number to connect."
      );
      return;
    }
    setError(null);
    await callAdventurePipeline("handoff", designPayload({
      lead: { email: state.email, phone: state.phone, intent: state.connectIntent },
    }));
    const submissionId = await saveLead({ phone: state.phone, intent: state.connectIntent });
    if (selectedDesign?.url) {
      void curateAdventureImages(instanceId, {
        events: [{
          type: state.connectIntent === "quote" ? "quote" : "saved",
          url: selectedDesign.url,
          source: selectedDesign.source,
          mode: "connect",
        }],
      });
    }
    patch({ phoneCaptured: true, submissionId: submissionId || state.submissionId, stage: "done" });
  };

  const revealedPrice =
    state.estimate ||
    (selectedDesign?.finishTier
      ? priceForFinishTier(finishTiers.find((row) => row.id === selectedDesign.finishTier) || selectedTier)
      : priceForFinishTier(selectedTier));
  const pricingPreview = selectedDesign?.estimate?.source === "local" && selectedTier
    ? projectEstimateForBand(selectedTier.min, selectedTier.max, selectedDesign.id)
    : selectedDesign?.estimate || budgetPrice(state.budget);
  const selectedProjectBeforeUrl = selectedDesign?.beforeUrl && /^https?:\/\//i.test(selectedDesign.beforeUrl)
    ? selectedDesign.beforeUrl
    : null;
  const effectivePricingCanvasView = selectedProjectBeforeUrl ? pricingCanvasView : "after";
  const selectedProjectIncludedItems = includedItemsForProject(selectedDesign, pricingScopes, scopeQuestion);
  const selectedProjectPricedItems = pricedItemsForProject(selectedDesign, pricingScopes, scopeQuestion);
  const selectedProjectTitle = selectedDesign?.label || estimateHeading(selectedService?.label);
  const selectedProjectPricingLabel = selectedDesign?.pricingLabel || "Estimated project range";
  const selectedProjectStoredBreakdown = Array.isArray(selectedDesign?.pricingBreakdown)
    ? selectedDesign.pricingBreakdown
    : [];
  const selectedProjectPricingAssumptions = selectedDesign?.pricingAssumptions || [];
  const selectedProjectScopeSummary = selectedProjectIncludedItems.slice(0, 3).join(" · ") ||
    selectedDesign?.primaryScope || selectedDesign?.scopeLabel || industryLanguage.space;
  const selectedProjectMaterialSummary = [
    selectedDesign?.direction?.surfaces,
    selectedDesign?.direction?.fixtures,
    selectedDesign?.direction?.style,
    selectedDesign?.styleLabel,
  ]
    .filter((value): value is string => Boolean(value))
    .flatMap((value) => value.split(/[,;]+/).map((part) => part.trim()).filter(Boolean))
    .slice(0, 3)
    .join(" · ") || "As shown";
  const displayedPriceRange = revealedPrice
    ? tightenPriceRangeForDisplay(revealedPrice.min, revealedPrice.max)
    : null;
  const unlockedPrice = revealedPrice
    ? {
        min: displayedPriceRange?.min || revealedPrice.min,
        max: displayedPriceRange?.max || revealedPrice.max,
        source: state.photoPathChosen === false ? "project-scope" : revealedPrice.source,
      }
    : null;
  const projectBreakdownRange = pricingBaseEstimate || (
    state.emailCaptured && unlockedPrice
      ? { min: unlockedPrice.min, max: unlockedPrice.max }
      : { min: pricingPreview.min, max: pricingPreview.max }
  );
  const selectedProjectLineItemEstimates = selectedProjectPricedItems
    .map((item) => {
      const estimate = pricingManifestEstimates[item];
      return estimate ? { item, min: estimate.min, max: estimate.max } : null;
    })
    .filter((row): row is { item: string; min: number; max: number } => Boolean(row));
  const pricingAdjustedLineItemEstimates = selectedProjectLineItemEstimates.map((lineItem) => {
    const level = pricingWhatIfSelections[lineItem.item] || "as-shown";
    const multiplier = pricingWhatIfMultiplier(level);
    return {
      ...lineItem,
      baseMin: lineItem.min,
      baseMax: lineItem.max,
      level,
      min: Math.max(0, Math.round(lineItem.min * multiplier / 100) * 100),
      max: Math.max(0, Math.round(lineItem.max * multiplier / 100) * 100),
    };
  });
  const refinableItemKeys = new Set(selectedProjectIncludedItems.map(v2ScopeStarterKey));
  const pricingRefinementLineItemEstimates = pricingAdjustedLineItemEstimates.filter((lineItem) =>
    refinableItemKeys.has(v2ScopeStarterKey(lineItem.item))
  );
  const pricingAdjustedProjectRange = pricingAdjustedLineItemEstimates.length
    ? pricingAdjustedLineItemEstimates.reduce(
        (total, lineItem) => ({ min: total.min + lineItem.min, max: total.max + lineItem.max }),
        { min: 0, max: 0 }
      )
    : projectBreakdownRange;
  const selectedPricingLineItem = selectedPricingReviewItem === "whole-project"
    ? null
    : pricingRefinementLineItemEstimates.find((lineItem) => lineItem.item === selectedPricingReviewItem) || null;
  const pricingTotalLabel = formatTightPriceBand(
    pricingAdjustedProjectRange.min,
    pricingAdjustedProjectRange.max
  );
  const pricingIncludes = pricingScopes;
  const loadPricingRefinementSuggestions = async (target: string) => {
    const targetLabel = String(target || "Anywhere").trim() || "Anywhere";
    const local = localPricingRefinementSuggestions(targetLabel);
    setPricingRefinementSuggestions(local);
    const cacheKey = `${selectedDesign?.id || "design"}::${targetLabel.toLowerCase()}`;
    const cached = pricingSuggestionCacheRef.current.get(cacheKey);
    if (cached?.length) {
      setPricingRefinementSuggestions(cached);
      setPricingSuggestionsLoading(false);
      return;
    }
    const requestId = ++pricingSuggestionRequestRef.current;
    setPricingSuggestionsLoading(true);
    const response = await callAdventurePipeline(
      "refinement_suggestions",
      designPayload({ refineNote: targetLabel === "Anywhere" ? null : `Change ${targetLabel}` }),
      {
        target: targetLabel,
        components: pricingRefinementLineItemEstimates.map((row) => row.item),
        projectTitle: selectedProjectTitle,
        designLabel: selectedDesign?.label || null,
        changeSummary: selectedDesign?.changeSummary || null,
      }
    );
    if (requestId !== pricingSuggestionRequestRef.current) return;
    const suggestions = (Array.isArray(response?.suggestions) ? response.suggestions : [])
      .map((row: any, index: number): PricingRefinementSuggestion | null => {
        const label = String(row?.label || "").trim().slice(0, 32);
        const prompt = String(row?.prompt || row?.instruction || "").trim().slice(0, 260);
        if (!label || !prompt || /cheaper|expensive|premium|upgrade/i.test(label)) return null;
        return {
          id: String(row?.id || `${targetLabel}-${index}`).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-") || `suggestion-${index}`,
          label,
          prompt,
        };
      })
      .filter((row: PricingRefinementSuggestion | null): row is PricingRefinementSuggestion => Boolean(row))
      .slice(0, 3);
    const next = suggestions.length ? suggestions : local;
    pricingSuggestionCacheRef.current.set(cacheKey, next);
    setPricingRefinementSuggestions(next);
    setPricingSuggestionsLoading(false);
  };

  const applyPricingCostSuggestion = async (direction: "down" | "up") => {
    if (selectedPricingLineItem) {
      await applyPricingWhatIf(selectedPricingLineItem.item, direction === "down" ? "simpler" : "upgrade");
      return;
    }
    await applyPricingOverallDirection(direction === "down" ? "simpler" : "upgrade");
  };

  const applyPricingSuggestion = async (suggestion: PricingRefinementSuggestion) => {
    if (state.generating || state.refineRemaining <= 0) return;
    const target = selectedPricingLineItem?.item || null;
    const boundary = target
      ? `Change only the existing ${target}. Preserve the camera, layout, architecture, and every unrelated item exactly as shown.`
      : "Apply this as a coordinated room-wide finish change. Preserve the camera, layout, architecture, component locations, and fixture count.";
    setPricingEstimateUpdated(false);
    const applied = await applyChange({
      note: `${boundary} ${suggestion.prompt}`,
      budgetDelta: 0,
      reference: target ? { kind: "item", label: target, target } : null,
    });
    if (applied) setPricingEstimateUpdated(true);
  };
  const previewBudget = Math.min(
    Math.max(0, Math.round(budgetBounds.max || state.budget)),
    Math.max(Math.max(0, Math.round(budgetBounds.min || 0)), state.budget + state.pendingBudgetDelta)
  );
  const railPrice = state.pendingBudgetDelta
    ? refinementEstimate(previewBudget, budgetRefinementStep)
    : revealedPrice;
  const showLoader =
    (state.generating && state.stage === "visual" && state.looks.length === 0 && state.photoPathChosen !== false) ||
    (state.generating && state.stage === "style") ||
    (state.generating && state.stage === "path") ||
    (state.stage === "project" && !scopeQuestion);
  const firstStep = state.serviceSkipped ? "project" : "service";
  const serviceChoices = serviceQuestion?.choices?.length
    ? serviceQuestion.choices
    : fallbackServiceIntake(services).choices;

  const loader = loaderForStage(state.stage, state.generatingLabel);
  const forwardAction = (label: string) => uiVersion === "v9" ? (
    <>{label} <ArrowRight aria-hidden="true" /></>
  ) : `${label} →`;

  return (
    <FormThemeProvider config={design}>
    <AdventureUiProvider version={uiVersion}>
    <div
      className={css.root}
      data-adventure-version={uiVersion}
      data-stage={state.stage}
      data-pricing-project-open={pricingProjectOpen ? "true" : "false"}
    >
      <BrandHeader config={design} compact />
      {state.stage !== "loading" && !(uiVersion === "v9" && pricingProjectOpen) && (
        <div className={css.top} data-adventure-ui="navigation">
          {uiVersion === "v8" || state.stage !== firstStep ? (
            <AdventureButton legacyShadcn
              type="button"
              intent="secondary"
              variant="ghost"
              size="sm"
              className={css.back}
              onClick={goBack}
              disabled={state.generating}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </AdventureButton>
          ) : <span className={css.backPlaceholder} aria-hidden="true" />}
          <div className={css.progress} data-adventure-ui="progress">
            {progressLabel(state.stage, state.serviceSkipped, state.photoPathChosen)}
          </div>
        </div>
      )}

      <main
        data-adventure-ui="viewport"
        className={`${css.main} ${
          pricingGalleryOpen ? css.mainWide : studioOpen || pricingProjectOpen ? css.mainFill : ""
        }`}
      >
        {uiVersion === "v9" && pricingProjectOpen ? (
          <div className={css.pricingFloatingNav} data-adventure-ui="navigation" aria-label="Project navigation">
            <AdventureButton legacyShadcn
              type="button"
              intent="secondary"
              variant="ghost"
              size="sm"
              className={css.back}
              onClick={goBack}
              disabled={state.generating}
            >
              <ArrowLeft aria-hidden="true" />
              Back
            </AdventureButton>
            <div className={css.progress} data-adventure-ui="progress">
              {progressLabel(state.stage, state.serviceSkipped, state.photoPathChosen)}
            </div>
          </div>
        ) : null}
        {state.stage === "loading" ? (
          <BootstrapStage />
        ) : showLoader ? (
          <LoadingState phase={loader.phase} message={loader.message} />
        ) : (
          <>
            {state.stage === "service" && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  <h1 className={css.prompt}>{serviceQuestion?.question || "What would you like help with?"}</h1>
                  <p className={css.sub}>{serviceQuestion?.subtitle || "Pick one — we&apos;ll keep it simple."}</p>
                  <div className={css.grid} data-adventure-ui="choice-grid">
                    {serviceChoices.map((choice) => {
                      const serviceId = choice.serviceId || choice.id;
                      const service = services.find((s) => s.value === serviceId);
                      const cover = catalogCoverUrl(service || null, `service-${serviceId}`);
                      return (
                        <AdventureChoiceCard
                          key={choice.id}
                          type="button"
                          data-card-kind="service"
                          className={`${css.card} ${cover ? "" : css.cardTextOnly} ${state.serviceId === serviceId ? css.cardSelected : ""}`}
                          aria-pressed={state.serviceId === serviceId}
                          onClick={() => uiVersion === "v9" ? patch({ serviceId }) : void onSelectService(serviceId)}
                        >
                          {cover ? <img className={css.cardImg} src={cover} alt="" /> : null}
                          <div className={css.cardLabel}>
                            {choice.label}
                            {choice.hint ? <span className={css.choiceHint}>{choice.hint}</span> : null}
                          </div>
                        </AdventureChoiceCard>
                      );
                    })}
                  </div>
                </div>
                {uiVersion === "v9" ? (
                  <AdventureActionBar className={css.footer}>
                    <AdventureButton
                      type="button"
                      intent="primary"
                      disabled={!state.serviceId}
                      onClick={() => state.serviceId && void onSelectService(state.serviceId)}
                    >
                      {forwardAction("Continue")}
                    </AdventureButton>
                  </AdventureActionBar>
                ) : null}
              </div>
            )}

            {state.stage === "project" && scopeQuestion && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  <h1 className={css.prompt}>{scopeQuestion.question || "What would you like to include?"}</h1>
                  <p className={css.sub}>{scopeQuestion.subtitle || "Pick everything that applies."}</p>
                  <div className={css.scopeGrid} data-adventure-ui="choice-grid">
                    {scopeQuestion.choices.map((choice) => {
                      const selected = state.scopes.includes(choice.label) || state.scopes.includes(choice.id);
                      return (
                        <AdventureChoiceCard
                          key={choice.id}
                          type="button"
                          data-card-kind="text"
                          className={`${css.card} ${css.cardTextOnly} ${css.scopeCard} ${selected ? css.cardSelected : ""}`}
                          aria-pressed={selected}
                          onClick={() => onSelectScope(choice.label)}
                        >
                          <div className={css.cardLabel}>
                            <span className={css.scopeCheck}>{selected ? "✓" : ""}</span>
                            {choice.label}
                            {choice.hint ? <span className={css.choiceHint}>{choice.hint}</span> : null}
                          </div>
                        </AdventureChoiceCard>
                      );
                    })}
                  </div>
                  {otherSelected && (
                    <AdventureInput
                      className={css.field}
                      style={{ marginTop: 12 }}
                      placeholder="Tell us briefly what you're working on"
                      value={state.otherScope}
                      onChange={(e) => patch({ otherScope: e.target.value })}
                    />
                  )}
                </div>
                <AdventureActionBar className={css.footer}>
                    <AdventureButton type="button" intent="primary" className={css.cta} disabled={!scopeReady} onClick={() => goToBudget()}>
                      {forwardAction("Continue")}
                    </AdventureButton>
                </AdventureActionBar>
              </div>
            )}

            {state.stage === "budget" && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  <h1 className={css.prompt}>What price range works for you?</h1>
                  <p className={css.sub}>Pick the closest range.</p>
                  <div className={css.bandGrid} data-adventure-ui="choice-grid">
                    {finishTiers.map((tier) => {
                      const on = state.finishTierId === tier.id;
                      return (
                        <AdventureChoiceCard
                          key={tier.id}
                          type="button"
                          data-card-kind="text"
                          className={`${css.bandChip} ${on ? css.bandChipOn : ""}`}
                          aria-pressed={on}
                          onClick={() =>
                            patch({
                              finishTierId: tier.id,
                              budget: tier.openEnded ? tier.min : Math.round((tier.min + tier.max) / 2),
                            })
                          }
                        >
                          <span className={css.bandRange}>{formatChipBand(tier)}</span>
                        </AdventureChoiceCard>
                      );
                    })}
                  </div>
                </div>
                <AdventureActionBar className={css.footer}>
                  <AdventureButton
                    type="button"
                    intent="primary"
                    className={css.cta}
                    disabled={!state.finishTierId}
                    onClick={goToPath}
                  >
                    {forwardAction("Continue")}
                  </AdventureButton>
                </AdventureActionBar>
              </div>
            )}

            {state.stage === "path" && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  {state.photoUrl ? (
                    <>
                      <h1 className={css.prompt}>Use this photo of the {industryLanguage.space}?</h1>
                      <p className={css.sub}>Great. We&apos;ll use the real space as the starting point.</p>
                      <img className={css.pathPreview} src={state.photoUrl} alt={`Your ${industryLanguage.space}`} />
                      {uiVersion === "v8" ? (
                        <div className={css.pathActions}>
                          <AdventureButton type="button" className={css.cta} onClick={() => go("style")}>
                            Choose a style direction →
                          </AdventureButton>
                          <AdventureButton type="button" className={css.secondary} onClick={() => uploadRef.current?.click()}>
                            Replace photo
                          </AdventureButton>
                          <AdventureButton type="button" className={css.secondary} onClick={() => void continueWithoutPhoto()}>
                            Skip for now
                          </AdventureButton>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <>
                      <h1 className={css.prompt}>
                        {uiVersion === "v9" ? copy.photo.preciseTitle : copy.photo.title}
                      </h1>
                      <p className={css.sub}>
                        {uiVersion === "v9" ? copy.photo.simpleBody : copy.photo.body}
                      </p>
                      {uiVersion === "v9" ? (
                        <div data-adventure-ui="photo-uploader">
                          <AdventureButton
                            type="button"
                            intent="secondary"
                            data-adventure-ui="photo-dropzone"
                            onClick={() => {
                              patch({ photoPathChosen: true });
                              uploadRef.current?.click();
                            }}
                          >
                            <span data-adventure-ui="photo-upload-icon" aria-hidden="true">
                              <Camera />
                            </span>
                            <span data-adventure-ui="photo-upload-copy">
                              <strong>Choose a {industryLanguage.photoSubject} photo</strong>
                              <span data-adventure-ui="photo-file-types">JPG, PNG or HEIC</span>
                            </span>
                          </AdventureButton>
                          <div data-adventure-ui="photo-skip">
                            <p>No photo?</p>
                            <AdventureButton
                              type="button"
                              intent="ghost"
                              onClick={() => void continueWithoutPhoto()}
                            >
                              Continue without one
                            </AdventureButton>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div
                            className={css.photoBenefit}
                            data-adventure-ui="photo-benefit"
                            aria-label={`A real photo of your ${industryLanguage.photoSubject} leads to a more accurate estimate`}
                          >
                            <span
                              className={`${css.photoBenefitCard} ${css.photoBenefitInput}`}
                              data-adventure-ui="photo-benefit-before"
                            >
                              <span className={css.phonePhotoFrame}>
                                <img
                                  src={photoInputExample}
                                  alt={`Example phone photo of a ${industryLanguage.photoSubject}`}
                                />
                              </span>
                              <strong>{copy.photo.inputLabel}</strong>
                            </span>
                            <span
                              className={`${css.photoBenefitCard} ${css.photoBenefitResult}`}
                              data-adventure-ui="photo-benefit-after"
                            >
                              <img src={photoResultExample} alt="Illustrative result and estimate preview" />
                              <span className={css.estimatePreview} aria-hidden="true">
                                <small>Estimate preview</small>
                                <span className={css.estimatePreviewLine} />
                                <span className={`${css.estimatePreviewLine} ${css.estimatePreviewLineShort}`} />
                              </span>
                              <strong>{copy.photo.resultLabel}</strong>
                            </span>
                          </div>
                          <p className={css.photoContext}>{copy.photo.context}</p>
                          <div className={css.pathGrid} data-adventure-ui="choice-grid">
                            <AdventureButton
                              type="button"
                              intent="primary"
                              data-card-kind="text"
                              data-adventure-choice="photo"
                              className={`${css.pathCard} ${css.pathCardPrimary}`}
                              onClick={() => {
                                patch({ photoPathChosen: true });
                                uploadRef.current?.click();
                              }}
                              aria-pressed={state.photoPathChosen === true}
                            >
                              <strong>{copy.photo.primary}</strong>
                            </AdventureButton>
                            <AdventureButton
                              type="button"
                              intent="secondary"
                              data-card-kind="text"
                              className={`${css.pathCard} ${css.pathCardSecondary}`}
                              onClick={() => void continueWithoutPhoto()}
                              aria-pressed={state.photoPathChosen === false}
                            >
                              <strong>{copy.photo.secondary}</strong>
                            </AdventureButton>
                          </div>
                        </>
                      )}
                      {error ? <p className={css.error}>{error}</p> : null}
                    </>
                  )}
                  <AdventureInput
                    ref={uploadRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(event) => void onPhotoSelected(event.target.files?.[0] || null)}
                  />
                </div>
                {uiVersion === "v9" && !state.generating && state.photoUrl ? (
                  <AdventureActionBar className={css.footer}>
                    <div className={css.footerStack}>
                      <AdventureButton type="button" intent="primary" onClick={() => go("style")}>
                        Choose a style direction <ArrowRight aria-hidden="true" />
                      </AdventureButton>
                      <div className={css.pathSecondaryActions}>
                        <AdventureButton type="button" intent="secondary" onClick={() => uploadRef.current?.click()}>
                          Replace photo
                        </AdventureButton>
                        <AdventureButton type="button" intent="ghost" onClick={() => void continueWithoutPhoto()}>
                          Skip for now
                        </AdventureButton>
                      </div>
                    </div>
                  </AdventureActionBar>
                ) : null}
              </div>
            )}

            {state.stage === "style" && state.photoUrl && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  <h1 className={css.prompt}>Which look feels closest?</h1>
                  <p className={css.sub}>
                    Choose a direction. We&apos;ll borrow the feel, not the layout.
                  </p>
                  <div className={css.styleDirectionGrid} data-adventure-ui="choice-grid">
                    {FULL_ROOM_STYLES.slice(0, 6).map((option, optionIndex) => {
                      const image =
                        CURATED_STYLE_REFERENCES[refinementProject]?.[option.id] ||
                        refinementImages[(option.imageIndex ?? optionIndex) % refinementImages.length];
                      const selected = state.styleId === option.id;
                      return (
                        <AdventureChoiceCard
                          key={option.id}
                          type="button"
                          data-card-kind="image"
                          className={`${css.styleDirectionCard} ${selected ? css.styleDirectionCardSelected : ""}`}
                          aria-pressed={selected}
                          onClick={() => patch({ styleId: option.id })}
                        >
                          <img src={image} alt={`${option.label} style reference`} />
                          <span>{option.label}</span>
                        </AdventureChoiceCard>
                      );
                    })}
                  </div>
                  {error ? <p className={css.error}>{error}</p> : null}
                </div>
                <AdventureActionBar className={css.footer}>
                  <AdventureButton
                    type="button"
                    intent="primary"
                    className={css.cta}
                    disabled={!state.styleId || state.generating}
                    onClick={() => void generatePhotoConcept()}
                  >
                    {forwardAction("Generate my personalized concept")}
                  </AdventureButton>
                </AdventureActionBar>
              </div>
            )}

            {state.stage === "visual" && pricingGalleryOpen ? (
              <div className={`${css.stage} ${css.pricingDiscoveryStage}`} data-adventure-ui="gallery-shell">
                <div className={css.stageBody} data-adventure-ui="gallery-body">
                  <div className={css.pricingGalleryHeader}>
                    <div className={css.pricingGalleryIntro}>
                      <h1 className={css.prompt}>{copy.gallery.title}</h1>
                      <p className={css.sub}>{copy.gallery.body}</p>
                    </div>
                  </div>
                  <div
                    ref={pricingGalleryScrollRef}
                    className={css.pricingGalleryScroll}
                    data-adventure-ui="gallery-scroll"
                    data-loading={!state.looks.length && state.generating ? "true" : "false"}
                    aria-label="Project inspiration gallery"
                  >
                    {state.looks.length ? (
                      <div
                        ref={pricingMasonryRef}
                        className={css.pricingMasonry}
                        data-adventure-ui="project-grid"
                        style={{ "--pricing-column-count": pricingColumnCount } as React.CSSProperties}
                      >
                        {uiVersion === "v9" ? pricingMasonryColumns.map((column, columnIndex) => (
                          <div
                            className={css.pricingMasonryColumn}
                            data-adventure-ui="project-column"
                            key={`pricing-column-${columnIndex}`}
                          >
                            {column.map((look) => {
                              return (
                                <article key={look.id} className={css.pricingProjectCard} data-adventure-ui="project-card">
                                  <AdventureButton
                                    type="button"
                                    intent="choice"
                                    aria-label={`Get price for ${look.label}`}
                                    onClick={() => selectPricingProject(look)}
                                  >
                                    <span
                                      className={css.pricingProjectMedia}
                                      data-adventure-ui="project-media"
                                      style={{ "--project-aspect": look.pinAspect || "4 / 5" } as React.CSSProperties}
                                    >
                                      <img
                                        src={look.url}
                                        alt={look.label}
                                        loading="eager"
                                        decoding="async"
                                        onError={() => dropBrokenPricingProject(look.id)}
                                      />
                                      <span className={css.pricingProjectOverlay} data-adventure-ui="project-caption">
                                        <strong className={css.pricingProjectTitle} data-adventure-ui="project-title">
                                          {look.label}
                                        </strong>
                                        <span className={css.pricingProjectAction} data-adventure-ui="project-action">
                                          {copy.gallery.action} <ArrowRight aria-hidden="true" />
                                        </span>
                                      </span>
                                    </span>
                                  </AdventureButton>
                                </article>
                              );
                            })}
                          </div>
                        )) : pricingMasonryColumns.map((column, columnIndex) => (
                          <div className={css.pricingMasonryColumn} key={`pricing-column-${columnIndex}`}>
                            {column.map((look) => {
                              const galleryIndex = pricingGalleryItems.findIndex((row) => row.id === look.id);
                              const cardEstimate = look.estimate || budgetPrice(look.budget || state.budget);
                              const cardFeatures = galleryFeaturesForProject(look, pricingScopes, scopeQuestion);
                              const cardFeatureLabel = cardFeatures.length
                                ? cardFeatures.join(" · ")
                                : look.primaryScope || look.scopeLabel || industryLanguage.space;
                              return (
                                <article key={look.id} className={css.pricingProjectCard}>
                                  <AdventureButton
                                    type="button"
                                    aria-label={`View local price details for ${look.label}`}
                                    onClick={() => selectPricingProject(look)}
                                  >
                                    <span
                                      className={css.pricingProjectMedia}
                                      style={{ aspectRatio: look.pinAspect || "4 / 5" }}
                                    >
                                      <img
                                        src={look.url}
                                        alt={look.label}
                                        loading={galleryIndex < PRICING_GALLERY_PAGE_SIZE ? "eager" : "lazy"}
                                        decoding="async"
                                        onError={() => dropBrokenPricingProject(look.id)}
                                      />
                                    </span>
                                    <span className={css.pricingProjectOverlay}>
                                      <strong className={css.pricingProjectPrice}>
                                        {formatTightPriceBand(cardEstimate.min, cardEstimate.max)}
                                      </strong>
                                      <span className={css.pricingProjectEstimateKind}>{look.pricingLabel || "Estimated project range"}</span>
                                      <span className={css.pricingProjectFeatures}>{cardFeatureLabel}</span>
                                      <span className={css.pricingProjectLocality}>{marketLocality.label}</span>
                                      <span className={css.pricingProjectAction}>{copy.gallery.action} →</span>
                                    </span>
                                  </AdventureButton>
                                </article>
                              );
                            })}
                          </div>
                        ))}
                      </div>
                    ) : state.generating ? (
                      <div className={css.galleryInitialLoader} role="status" aria-live="polite">
                        <AdventureLoader
                          phase="inspiration"
                          active
                          size="sm"
                          messageOverride={copy.gallery.loading}
                          className={css.galleryLoaderContent}
                        />
                      </div>
                    ) : !state.generating ? (
                      <p className={css.sub}>{copy.gallery.empty}</p>
                    ) : null}
                    {pricingGalleryVisibleCount < pricingGalleryItems.length ? (
                      <div
                        ref={pricingGalleryLoadSentinelRef}
                        className={css.pricingGallerySentinel}
                        aria-hidden="true"
                      />
                    ) : null}
                    {error ? <p className={css.error}>{error}</p> : null}
                  </div>
                </div>
                <div className={css.pricingPhotoDock} data-adventure-ui="gallery-action-bar">
                  <AdventureButton
                    type="button"
                    intent="secondary"
                    className={css.pricingPhotoButton}
                    onClick={() => uploadRef.current?.click()}
                  >
                    <span aria-hidden="true">＋</span>
                    Add your own photo
                  </AdventureButton>
                  <AdventureInput
                    ref={uploadRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    hidden
                    onChange={(event) => void onPhotoSelected(event.target.files?.[0] || null)}
                  />
                </div>
              </div>
            ) : null}

            {state.stage === "visual" && pricingProjectOpen && selectedDesign ? (
              <div className={`${css.stage} ${css.pricingRefinementStage}`} data-adventure-ui="pricing-shell">
                <div className={css.stageBody} data-adventure-ui="pricing-body">
                  <div
                    className={css.pricingRefinementShell}
                    data-adventure-ui="pricing-layout"
                    data-access={state.emailCaptured ? "unlocked" : "locked"}
                  >
                    <div className={css.pricingRefinementMedia} data-adventure-ui="pricing-media">
                      <div className={css.pricingCanvas} data-adventure-ui="pricing-canvas" aria-label="Project transformation canvas">
                        <figure
                          ref={pricingCanvasRef}
                          className={css.pricingCanvasFrame}
                          data-adventure-ui="media-frame"
                          data-view={effectivePricingCanvasView}
                        >
                          {effectivePricingCanvasView === "before" && selectedProjectBeforeUrl ? (
                            <img src={selectedProjectBeforeUrl} alt={`Before ${selectedProjectTitle}`} />
                          ) : (
                            <img
                              key={selectedDesign.id}
                              className={css.pricingAfterImage}
                              src={selectedDesign.url}
                              alt={`After ${selectedProjectTitle}`}
                            />
                          )}
                          {selectedProjectBeforeUrl && uiVersion === "v9" ? (
                            <div className={css.pricingCanvasToggle} data-adventure-ui="segmented-control" role="group" aria-label="Show project view">
                              <AdventureButton
                                type="button"
                                intent="utility"
                                aria-pressed={pricingCanvasView === "before"}
                                onClick={() => setPricingCanvasView("before")}
                              >
                                Before
                              </AdventureButton>
                              <AdventureButton
                                type="button"
                                intent="utility"
                                aria-pressed={pricingCanvasView === "after"}
                                onClick={() => setPricingCanvasView("after")}
                              >
                                After
                              </AdventureButton>
                            </div>
                          ) : selectedProjectBeforeUrl ? <div className={css.pricingCanvasToggle} role="group" aria-label="Show project view">
                            <AdventureButton legacyShadcn
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-pressed={pricingCanvasView === "before"}
                              onClick={() => setPricingCanvasView("before")}
                            >
                              Before
                            </AdventureButton>
                            <AdventureButton legacyShadcn
                              type="button"
                              variant="ghost"
                              size="sm"
                              aria-pressed={pricingCanvasView === "after"}
                              onClick={() => setPricingCanvasView("after")}
                            >
                              After
                            </AdventureButton>
                          </div> : null}
                          {uiVersion === "v9" && state.emailCaptured && effectivePricingCanvasView === "after" ? (
                            <div className={css.pricingMediaToolbar} data-adventure-ui="media-toolbar" aria-label="Project media controls">
                              <div className={css.pricingCanvasActions} data-adventure-ui="media-actions" aria-label="Unlocked design tools">
                                <AdventureButton
                                  type="button"
                                  intent="icon"
                                  aria-label="Download after image"
                                  title="Download"
                                  onClick={() => void downloadDesign()}
                                >
                                  <Download aria-hidden="true" />
                                </AdventureButton>
                                <AdventureButton
                                  type="button"
                                  intent="icon"
                                  aria-label="View after image full screen"
                                  title="Full screen"
                                  onClick={() => void viewDesignFullscreen()}
                                >
                                  <Maximize2 aria-hidden="true" />
                                </AdventureButton>
                                <AdventureButton
                                  type="button"
                                  intent="icon"
                                  aria-label="Share after image"
                                  title="Share"
                                  onClick={() => void shareDesign()}
                                >
                                  <Share2 aria-hidden="true" />
                                </AdventureButton>
                              </div>
                            </div>
                          ) : null}
                          {uiVersion === "v8" && state.emailCaptured && effectivePricingCanvasView === "after" ? (
                            <div className={css.pricingCanvasActions} aria-label="Unlocked design tools">
                              <AdventureButton legacyShadcn intent="icon"
                                type="button"
                                variant="ghost"
                                size="iconSm"
                                aria-label="Download after image"
                                title="Download"
                                onClick={() => void downloadDesign()}
                              >
                                <Download aria-hidden="true" />
                              </AdventureButton>
                              <AdventureButton legacyShadcn intent="icon"
                                type="button"
                                variant="ghost"
                                size="iconSm"
                                aria-label="View after image full screen"
                                title="Full screen"
                                onClick={() => void viewDesignFullscreen()}
                              >
                                <Maximize2 aria-hidden="true" />
                              </AdventureButton>
                              <AdventureButton legacyShadcn intent="icon"
                                type="button"
                                variant="ghost"
                                size="iconSm"
                                aria-label="Share after image"
                                title="Share"
                                onClick={() => void shareDesign()}
                              >
                                <Share2 aria-hidden="true" />
                              </AdventureButton>
                            </div>
                          ) : null}
                          {uiVersion === "v8" && pricingShareStatus ? (
                            <div className={css.pricingShareStatus} role="status">{pricingShareStatus}</div>
                          ) : null}
                          {state.emailCaptured && pricingDetailMode === "refine" && state.generating ? (
                            <div className={css.pricingUpdateStatus} role="status">
                              Updating {pendingPricingWhatIf?.item || "design"}…
                            </div>
                          ) : null}
                        </figure>
                        {selectedProjectBeforeUrl ? (
                          <p className={css.pricingBeforeDisclosure}>AI-generated illustrative before</p>
                        ) : null}
                        {uiVersion === "v9" && pricingShareStatus ? (
                          <div className={css.pricingShareStatus} role="status">{pricingShareStatus}</div>
                        ) : null}
                      </div>
                    </div>
                    <aside className={css.pricingRefinementPanel} data-adventure-ui="pricing-panel">
                      <section className={css.pricingProjectSummary} data-adventure-ui="panel" data-mode={pricingDetailMode}>
                        <div className={css.pricingEstimateHeaderWrap}>
                          <AdventureButton
                            type="button"
                            className={css.pricingEstimateHeader}
                            data-adventure-ui="estimate-header"
                            data-adventure-role="panel-header"
                            aria-label={pricingDetailMode === "refine" ? "View price and breakdown" : undefined}
                            disabled={!state.emailCaptured || pricingDetailMode === "review"}
                            onClick={() => {
                              setPricingEstimateUpdated(false);
                              setPricingDetailMode("review");
                            }}
                          >
                            <span className={css.pricingEstimateHeaderSummary} data-adventure-ui="estimate-summary">
                              <span className={css.pricingEstimateHeaderTitle} data-adventure-ui="estimate-title">{selectedProjectTitle}</span>
                              {pricingDetailMode !== "review" ? (
                                <span className={css.pricingEstimateCompactPrice} data-adventure-ui="estimate-compact">
                                  <span>{copy.detail.priceLabel}</span>
                                  <strong>{pricingTotalLabel}</strong>
                                </span>
                              ) : null}
                            </span>
                            {pricingDetailMode !== "review" ? (
                              <span className={css.pricingEstimateReturn} data-adventure-ui="estimate-return">
                                View price &amp; breakdown
                              </span>
                            ) : null}
                          </AdventureButton>
                        </div>
                        {pricingDetailMode === "review" ? (
                          <div
                            className={css.pricingPricePanel}
                            aria-label={state.emailCaptured ? "Estimated local price" : "Estimated local price hidden until unlock"}
                          >
                            <div className={css.pricingPriceHead}>
                              {!state.emailCaptured ? (
                                <div className={css.pricingInlineUnlock} aria-live="polite">
                                  <span className={css.pricingLockedDesignName} data-adventure-ui="locked-design-name">{selectedProjectTitle}</span>
                                  <div className={css.pricingPriceSummary} data-adventure-ui="price-summary">
                                    <span data-adventure-ui="price-label">{copy.detail.priceLabel}</span>
                                    <strong data-locked="true" data-adventure-ui="locked-price" aria-label="Price range hidden until unlock">
                                      <span className={css.pricingLockedPriceSegment}>
                                        <span className={css.pricingLockedPriceCurrency} aria-hidden="true">$</span>
                                        <span className={css.pricingLockedPriceDigits} data-adventure-ui="locked-price-digits">
                                          {formatMoney(pricingPreview.min).replace(/^\$/, "")}
                                        </span>
                                      </span>
                                      <span className={css.pricingLockedPriceDash} aria-hidden="true">—</span>
                                      <span className={css.pricingLockedPriceSegment}>
                                        <span className={css.pricingLockedPriceCurrency} aria-hidden="true">$</span>
                                        <span className={css.pricingLockedPriceDigits} data-adventure-ui="locked-price-digits">
                                          {formatMoney(pricingPreview.max).replace(/^\$/, "")}
                                        </span>
                                      </span>
                                    </strong>
                                  </div>
                                  <div className={css.pricingUnlockDivider} aria-hidden="true" />
                                  <p className={css.pricingUnlockHeading} data-adventure-ui="unlock-heading">
                                    Get instant pricing
                                  </p>
                                  <form
                                    className={css.pricingInlineUnlockForm}
                                    data-adventure-ui="unlock-form"
                                    onSubmit={(event) => {
                                      event.preventDefault();
                                      const email = String(new FormData(event.currentTarget).get("email") || "");
                                      void captureEmail(email);
                                    }}
                                  >
                                    <AdventureInput legacyShadcn
                                      id="pricing-unlock-email"
                                      className={css.field}
                                      type="email"
                                      name="email"
                                      aria-label="Email to unlock pricing"
                                      placeholder="your@email.com"
                                      value={state.email}
                                      onChange={(event) => patch({ email: event.target.value })}
                                      autoComplete="email"
                                      inputMode="email"
                                      spellCheck={false}
                                      disabled={pricingUnlockSubmitting}
                                    />
                                    <AdventureButton legacyShadcn type="submit" size="sm" disabled={pricingUnlockSubmitting}>
                                      {pricingUnlockSubmitting ? "Unlocking…" : (
                                        <>
                                          <LockOpen aria-hidden="true" />
                                          Unlock
                                        </>
                                      )}
                                    </AdventureButton>
                                  </form>
                                  <p className={css.pricingUnlockMicrocopy} data-adventure-ui="unlock-note">
                                    By continuing, you agree to the{" "}
                                    <a href="/terms" target="_blank" rel="noreferrer">Terms &amp; Conditions</a>.
                                    {" "}We’ll never send you spam. :)
                                  </p>
                                  {error ? <p className={css.error}>{error}</p> : null}
                                </div>
                              ) : (
                                <div className={css.pricingPriceSummary}>
                                  <span>{copy.detail.priceLabel}</span>
                                  <strong data-locked="false">{pricingTotalLabel}</strong>
                                </div>
                              )}
                            </div>

                            {state.emailCaptured ? (
                              <div className={css.pricingReviewPanel} data-adventure-ui="estimate-breakdown">
                                <div className={css.pricingProjectFacts} data-adventure-ui="project-facts">
                                  <div>
                                    <span>Scope</span>
                                    <strong>{selectedProjectScopeSummary}</strong>
                                  </div>
                                  <div>
                                    <span>Materials</span>
                                    <strong>{selectedProjectMaterialSummary}</strong>
                                  </div>
                                </div>
                                <p className={css.pricingEstimateKind}>{selectedProjectPricingLabel} · Not a quote</p>
                                {selectedProjectStoredBreakdown.length ? (
                                  <div className={css.pricingIncludedBreakdown} data-adventure-ui="breakdown-list" aria-label="Illustrative deterministic price breakdown">
                                    <strong className={css.pricingIncludedHeading}>Illustrative breakdown</strong>
                                    <div className={css.pricingIncludedRows} data-adventure-ui="breakdown-rows">
                                      {selectedProjectStoredBreakdown.map((item) => {
                                        const range = item.localizedRange || item.range;
                                        return (
                                          <div key={item.key}>
                                            <span><span aria-hidden="true">✓</span><span>{item.label}</span></span>
                                            <strong>{formatTightPriceBand(range.low, range.high)}</strong>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : selectedProjectPricedItems.length ? (
                                  <div className={css.pricingIncludedBreakdown} data-adventure-ui="breakdown-list" aria-label="Included items and prices">
                                    <strong className={css.pricingIncludedHeading}>{copy.detail.breakdownTitle}</strong>
                                    <div className={css.pricingIncludedRows} data-adventure-ui="breakdown-rows">
                                      {selectedProjectPricedItems.map((item) => {
                                        const lineItem = pricingAdjustedLineItemEstimates.find((row) => row.item === item) || null;
                                        const level = lineItem?.level || pricingWhatIfSelections[item] || "as-shown";
                                        const options = canRemovePricingItem(item)
                                          ? [...PRICING_WHAT_IF_LEVELS, { id: "remove" as const, label: "Remove", multiplier: 0 }]
                                          : PRICING_WHAT_IF_LEVELS;
                                        const currentLevelLabel = options.find((option) => option.id === level)?.label || "As shown";
                                        return (
                                          <div key={item}>
                                            <span>
                                              <span aria-hidden="true">✓</span>
                                              <span>
                                                {item}
                                                {level !== "as-shown" ? <small>{currentLevelLabel}</small> : null}
                                              </span>
                                            </span>
                                            <strong>
                                              {lineItem
                                                ? formatTightPriceBand(lineItem.min, lineItem.max)
                                                : pricingManifestPricingStatus === "failed"
                                                  ? "Unavailable"
                                                  : "Calculating…"}
                                            </strong>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                ) : null}
                                {selectedProjectPricingAssumptions.length ? (
                                  <div className={css.pricingEstimateAssumptions}>
                                    <strong>Assumptions</strong>
                                    <ul>{selectedProjectPricingAssumptions.map((assumption) => <li key={assumption}>{assumption}</li>)}</ul>
                                  </div>
                                ) : null}
                                {pricingManifestPricingStatus === "loading" ? (
                                  <p className={css.pricingManifestStatus}>Calculating verified line-item prices…</p>
                                ) : null}
                                {pricingManifestPricingStatus === "failed" ? (
                                  <p className={css.pricingWhatIfError}>Verified line-item pricing is unavailable for this image.</p>
                                ) : null}

                              </div>
                            ) : null}
                          </div>
                        ) : null}

                      </section>

                      {state.emailCaptured ? (
                        <section
                          className={css.pricingRefinementSection}
                          data-adventure-ui="refinement-section"
                          data-expanded={pricingDetailMode === "refine" ? "true" : "false"}
                        >
                          <AdventureButton
                            type="button"
                            className={css.pricingRefinementHeader}
                            data-adventure-ui="refinement-header"
                            data-adventure-role="panel-header"
                            aria-expanded={pricingDetailMode === "refine"}
                            disabled={state.generating || state.refineRemaining <= 0}
                            onClick={() => {
                              setPricingEstimateUpdated(false);
                              setPricingDetailMode("refine");
                              void loadPricingRefinementSuggestions(
                                selectedPricingLineItem?.item || "Anywhere"
                              );
                            }}
                          >
                            <span>
                              <strong>{copy.detail.customizeTitle}</strong>
                              <small>{copy.detail.customizeBody}</small>
                            </span>
                          </AdventureButton>

                          {pricingDetailMode === "refine" ? (
                            <div className={css.pricingRefinePanel} data-adventure-ui="refinement-controls" aria-label="Design refinement controls">
                              <div className={css.pricingComponentPicker} data-adventure-ui="refinement-targets">
                                <span>Change</span>
                                <div role="listbox" aria-label="Design target">
                                  <AdventureButton
                                    type="button"
                                    role="option"
                                    aria-selected={selectedPricingReviewItem === "whole-project"}
                                    data-selected={selectedPricingReviewItem === "whole-project" ? "true" : "false"}
                                    onClick={() => {
                                      setSelectedPricingReviewItem("whole-project");
                                      setPricingCanvasView("after");
                                      updateChangeNote("", undefined, null);
                                      void loadPricingRefinementSuggestions("Anywhere");
                                    }}
                                  >
                                    Anywhere
                                  </AdventureButton>
                                  {pricingRefinementLineItemEstimates.map((lineItem) => {
                                    const selected = selectedPricingReviewItem === lineItem.item;
                                    return (
                                      <AdventureButton
                                        key={lineItem.item}
                                        type="button"
                                        role="option"
                                        aria-selected={selected}
                                        data-selected={selected ? "true" : "false"}
                                        onClick={() => {
                                          setSelectedPricingReviewItem(lineItem.item);
                                          setPricingCanvasView("after");
                                          updateChangeNote("", undefined, {
                                            kind: "item",
                                            label: lineItem.item,
                                            target: lineItem.item,
                                          });
                                          void loadPricingRefinementSuggestions(lineItem.item);
                                        }}
                                      >
                                        {lineItem.item}
                                      </AdventureButton>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className={css.pricingSuggestionControl} data-adventure-ui="refinement-suggestions">
                                <span>Quick ideas</span>
                                <div aria-label="Suggested design changes">
                                  <AdventureButton
                                    type="button"
                                    onClick={() => void applyPricingCostSuggestion("down")}
                                    disabled={state.generating || state.refineRemaining <= 0}
                                  >
                                    A little cheaper
                                  </AdventureButton>
                                  <AdventureButton
                                    type="button"
                                    onClick={() => void applyPricingCostSuggestion("up")}
                                    disabled={state.generating || state.refineRemaining <= 0}
                                  >
                                    A little more premium
                                  </AdventureButton>
                                  {pricingRefinementSuggestions.map((suggestion) => (
                                    <AdventureButton
                                      key={suggestion.id}
                                      type="button"
                                      onClick={() => void applyPricingSuggestion(suggestion)}
                                      disabled={state.generating || state.refineRemaining <= 0}
                                    >
                                      {suggestion.label}
                                    </AdventureButton>
                                  ))}
                                </div>
                                {pricingSuggestionsLoading ? <small role="status">Refreshing ideas…</small> : null}
                              </div>

                              <div className={css.pricingReferenceControl} data-adventure-ui="refinement-references">
                                <span>Add a reference</span>
                                <div>
                                  <AdventureButton
                                    type="button"
                                    disabled={pricingReferenceUploading || state.generating || state.refineRemaining <= 0}
                                    onClick={() => {
                                      pricingReferenceKindRef.current = "style";
                                      pricingReferenceUploadRef.current?.click();
                                    }}
                                  >
                                    Add inspiration
                                  </AdventureButton>
                                  <AdventureButton
                                    type="button"
                                    disabled={pricingReferenceUploading || state.generating || state.refineRemaining <= 0}
                                    onClick={() => {
                                      pricingReferenceKindRef.current = "space";
                                      pricingReferenceUploadRef.current?.click();
                                    }}
                                  >
                                    Use my {industryLanguage.space}
                                  </AdventureButton>
                                </div>
                                {pricingReferenceUploading ? <small role="status">Adding your image…</small> : null}
                                {selectedRefinementReference?.imageUrl ? (
                                  <small>{selectedRefinementReference.label} is ready to apply.</small>
                                ) : null}
                                <AdventureInput
                                  ref={pricingReferenceUploadRef}
                                  type="file"
                                  accept="image/*"
                                  hidden
                                  onChange={(event) => void onPricingReferenceSelected(event.target.files?.[0] || null)}
                                />
                              </div>

                              <div className={css.pricingPromptControl} data-adventure-ui="refinement-prompt">
                                <label htmlFor="pricing-refine-prompt">Describe a change</label>
                                <div>
                                  <AdventureInput
                                    id="pricing-refine-prompt"
                                    type="text"
                                    value={state.changeNote}
                                    placeholder={selectedPricingLineItem
                                      ? `Change the ${selectedPricingLineItem.item.toLowerCase()}…`
                                      : "Change anything…"}
                                    onChange={(event) => updateChangeNote(
                                      event.target.value,
                                      undefined,
                                      selectedPricingLineItem
                                        ? {
                                            kind: "item",
                                            label: selectedPricingLineItem.item,
                                            target: selectedPricingLineItem.item,
                                          }
                                        : selectedRefinementReference
                                    )}
                                    onKeyDown={(event) => {
                                      if (event.key === "Enter") void applyPricingPromptRefinement();
                                    }}
                                    disabled={state.generating || state.refineRemaining <= 0}
                                  />
                                  <AdventureButton
                                    type="button"
                                    onClick={() => void applyPricingPromptRefinement()}
                                    disabled={state.generating || !state.changeNote.trim() || state.refineRemaining <= 0}
                                  >
                                    {state.generating ? "Updating…" : "Update"}
                                  </AdventureButton>
                                </div>
                              </div>

                              {pricingEstimateUpdated && !pendingPricingWhatIf ? (
                                <div className={css.pricingRefineUpdated} role="status">
                                  <div>
                                    <strong>Estimate updated</strong>
                                    <span>Your new design and pricing are ready.</span>
                                  </div>
                                  <AdventureButton
                                    type="button"
                                    onClick={() => {
                                      setPricingEstimateUpdated(false);
                                      setPricingDetailMode("review");
                                    }}
                                  >
                                    View updated estimate
                                  </AdventureButton>
                                </div>
                              ) : null}
                              {error ? <p className={css.pricingWhatIfError}>{error}</p> : null}
                            </div>
                          ) : null}
                        </section>
                      ) : null}
                    </aside>
                  </div>
                </div>
              </div>
            ) : null}

            {state.stage === "visual" && studioOpen && selectedDesign ? (
              <div className={css.workspace}>
                <div className={css.exploreFocus}>
                  <div className={css.heroStage}>
                    <div className={css.canvasNotice}>
                      <strong className={css.canvasNoticeKicker}>{selectedDesign.cue || STARTER_CUE}</strong>
                      <span className={css.canvasNoticeBody}>{starterNotice}</span>
                    </div>
                    <div className={css.heroWrap} ref={heroRef}>
                      <img
                        className={css.heroImgLarge}
                        src={selectedDesign.url}
                        alt={selectedDesign.label}
                      />
                      <p className={css.starterBadge}>{selectedDesign.cue || STARTER_CUE}</p>
                      {state.looks.length > 1 ? (
                        <div className={css.revisionNav} aria-label="Design revision history">
                          <AdventureButton
                            type="button"
                            aria-label="Previous design version"
                            disabled={state.generating || activeRevisionIndex <= 0}
                            onClick={() => goToRevision(activeRevisionIndex - 1)}
                          >
                            ←
                          </AdventureButton>
                          <span>{activeRevisionIndex + 1} / {state.looks.length}</span>
                          <AdventureButton
                            type="button"
                            aria-label="Next design version"
                            disabled={state.generating || activeRevisionIndex >= state.looks.length - 1}
                            onClick={() => goToRevision(activeRevisionIndex + 1)}
                          >
                            →
                          </AdventureButton>
                        </div>
                      ) : null}
                      {state.generating ? (
                        <div className={css.heroBusy}>
                          <AdventureLoader
                            phase="preview_refreshing"
                            variant="pill"
                            size="sm"
                            active
                            messageOverride={state.generatingLabel || "Updating this look…"}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <aside className={css.explorePanel}>
                    <div className={css.railBody}>
                    {error ? <p className={css.error}>{error}</p> : null}
                    <div className={css.railPriceCard}>
                      <div className={css.railPriceHead}>
                        <p className={css.railSection}>Project price</p>
                        {!state.emailCaptured ? (
                          <AdventureButton type="button" className={css.priceUnlockLink} onClick={() => goToPrice()}>
                            Unlock
                          </AdventureButton>
                        ) : (
                          <span className={css.priceUnlocked}>Unlocked</span>
                        )}
                      </div>
                      <p className={`${css.railPrice} ${!state.emailCaptured ? css.railPriceLocked : ""}`}>
                        {railPrice ? formatTightPriceBand(railPrice.min, railPrice.max) : formatMoney(previewBudget)}
                      </p>
                      {state.pendingBudgetDelta ? (
                        <p className={css.pendingPriceChange}>
                          {state.emailCaptured
                            ? `Planned ${state.pendingBudgetDelta > 0 ? "+" : "−"}${formatMoney(Math.abs(state.pendingBudgetDelta))} with this change`
                            : "Price will update with this change"}
                        </p>
                      ) : null}
                      <div className={css.priceAdjustGrid}>
                        <AdventureButton
                          type="button"
                          className={css.priceAdjustBtn}
                          disabled={state.generating || previewBudget <= budgetBounds.min}
                          onClick={() => shiftProjectBudget("down")}
                        >
                          <span>Lower cost</span>
                          <strong>− {formatMoney(budgetRefinementStep)}</strong>
                        </AdventureButton>
                        <AdventureButton
                          type="button"
                          className={css.priceAdjustBtn}
                          disabled={state.generating || previewBudget >= budgetBounds.max}
                          onClick={() => shiftProjectBudget("up")}
                        >
                          <span>Higher end</span>
                          <strong>+ {formatMoney(budgetRefinementStep)}</strong>
                        </AdventureButton>
                      </div>
                    </div>

                    {state.emailCaptured ? (
                      <div className={css.railUtilities} aria-label="Unlocked design tools">
                        <AdventureButton type="button" className={css.utilityBtn} onClick={() => void downloadDesign()}>
                          <span aria-hidden="true">↓</span> Download
                        </AdventureButton>
                        <AdventureButton type="button" className={css.utilityBtn} onClick={() => void viewDesignFullscreen()}>
                          <span aria-hidden="true">⛶</span> Full screen
                        </AdventureButton>
                      </div>
                    ) : null}

                    {mode === "spatial" ? (
                      <div className={css.earlyRailBlock}>
                        <div className={css.earlyRailHeading}>
                          <strong>Layout direction</strong>
                          <small>One-click regenerate · 4 presets max</small>
                        </div>
                        <div className={css.quickLayoutGrid}>
                          {layoutQuickChoices.map((option) => (
                            <AdventureButton
                              key={option.id}
                              type="button"
                              disabled={state.generating || state.refineRemaining <= 0}
                              onClick={() =>
                                applyQuickRefinement({
                                  id: option.id,
                                  label: option.label,
                                  prompt: [
                                    `LAYOUT PRESET: ${option.label}. ${option.prompt}.`,
                                    "Reconfigure only the selected project area while preserving the property's outer envelope, camera, doors, windows, fixed utilities, and realistic circulation.",
                                    `Keep the result plausible for ${scopeLabel || "the selected scope"} at about ${formatMoney(state.budget)}.`,
                                    "Do not add unrelated rooms or duplicate major components.",
                                  ].join(" "),
                                })
                              }
                            >
                              {option.label}
                            </AdventureButton>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {state.emailCaptured ? <details
                      className={`${css.refinementDrop} ${css.itemsSection}`}
                      name="v8-refinement-section"
                      open={openRefinementSection === "items"}
                      onToggle={(event) => {
                        const isOpen = event.currentTarget.open;
                        setOpenRefinementSection((current) =>
                          isOpen ? "items" : current === "items" ? null : current
                        );
                      }}
                    >
                      <summary className={css.refinementDropSummary}>
                        <span>
                          <strong>Items &amp; materials</strong>
                          <small>
                            {refinementCatalogPending
                              ? "Finding visible items…"
                              : liveRefinementCatalog
                                ? `${liveRefinementCatalog.categories.length} editable areas`
                                : "Use the change box below"}
                          </small>
                        </span>
                        <b aria-hidden="true">⌄</b>
                      </summary>
                      {refinementCatalogPending ? (
                        <div className={css.catalogLoading} role="status" aria-live="polite">
                          <span className={css.catalogLoadingPulse} aria-hidden="true" />
                          <span>Looking at this design…</span>
                        </div>
                      ) : refinementCatalogFailed || !liveRefinementCatalog ? (
                        <p className={css.catalogUnavailable}>
                          Visual choices aren’t ready. Describe the change below.
                        </p>
                      ) : (
                        <div className={css.materialCategoryList}>
                          {liveRefinementCatalog.categories.map((category) => {
                            const categoryOpen = refinementCategoryId === category.id;
                            return (
                              <details
                                key={category.id}
                                className={css.materialCategoryDrop}
                                name="v8-material-category"
                                open={categoryOpen}
                                onToggle={(event) => {
                                  const isOpen = event.currentTarget.open;
                                  setRefinementCategoryId((current) =>
                                    isOpen ? category.id : current === category.id ? "" : current
                                  );
                                  if (isOpen) void loadRefinementCategoryImages(category);
                                }}
                              >
                                <summary className={css.materialCategorySummary}>
                                  <span>
                                    <strong>{category.label}</strong>
                                    <small>{category.options.length} visual choices</small>
                                  </span>
                                  <b aria-hidden="true">⌄</b>
                                </summary>
                                {categoryOpen && refinementImagesLoadingId === category.id ? (
                                  <div className={css.materialImagesLoading} role="status" aria-live="polite">
                                    <span className={css.catalogLoadingPulse} aria-hidden="true" />
                                    <span>Generating {category.options.length} {category.label.toLowerCase()} choices…</span>
                                  </div>
                                ) : categoryOpen ? (
                                  <div className={`${css.visualOptionGrid} ${css.materialOptionGrid}`}>
                                    {category.options.map((option) => {
                                      const selected = state.changeNote === option.prompt;
                                      return (
                                        <AdventureButton
                                          key={option.id}
                                          type="button"
                                          className={css.visualOption}
                                          aria-label={`Use ${option.label}`}
                                          aria-pressed={selected}
                                          data-selected={selected ? "true" : "false"}
                                          disabled={state.generating || state.refineRemaining <= 0}
                                          onClick={() =>
                                            selectQuickRefinement(option, {
                                              kind: "item",
                                              label: option.label,
                                              target: option.target || category.label,
                                            })
                                          }
                                        >
                                          <img
                                            src={refinementOptionImages[option.id] || option.imageUrl}
                                            alt={`${option.label} item or material reference`}
                                            loading="lazy"
                                            onError={(event) => {
                                              if (!event.currentTarget.dataset.fallbackApplied) {
                                                event.currentTarget.dataset.fallbackApplied = "true";
                                                event.currentTarget.src =
                                                  option.fallbackImageUrl || option.imageUrl;
                                              }
                                            }}
                                          />
                                          <span>{option.label}</span>
                                        </AdventureButton>
                                      );
                                    })}
                                  </div>
                                ) : null}
                              </details>
                            );
                          })}
                        </div>
                      )}
                    </details> : null}

                    <details
                      className={`${css.refinementDrop} ${css.stylesSection}`}
                      name="v8-refinement-section"
                      open={openRefinementSection === "styles"}
                      onToggle={(event) => {
                        const isOpen = event.currentTarget.open;
                        setOpenRefinementSection((current) =>
                          isOpen ? "styles" : current === "styles" ? null : current
                        );
                      }}
                    >
                      <summary className={css.refinementDropSummary}>
                        <span>
                          <strong>Full-room styles</strong>
                          <small>Applies the look to your room—not the reference layout</small>
                        </span>
                        <b aria-hidden="true">⌄</b>
                      </summary>
                      <div className={css.visualOptionGrid}>
                        {FULL_ROOM_STYLES.slice(0, 6).map((option, optionIndex) => {
                          const selected = state.changeNote === option.prompt;
                          const fallbackImage =
                            refinementImages[(option.imageIndex ?? optionIndex) % refinementImages.length];
                          const styleReferenceImage =
                            CURATED_STYLE_REFERENCES[refinementProject]?.[option.id] || fallbackImage;
                          return (
                            <AdventureButton
                              key={option.id}
                              type="button"
                              className={`${css.visualOption} ${css.styleOption}`}
                              data-style={option.id}
                              aria-pressed={selected}
                              data-selected={selected ? "true" : "false"}
                              disabled={state.generating || state.refineRemaining <= 0}
                              onClick={() =>
                                mode === "component"
                                  ? applyQuickRefinement(
                                      {
                                        ...option,
                                        prompt: `Change only the existing ${scopeLabel || "selected component"} finishes, materials, color, and hardware to match ${option.label}: ${(option.palette || []).join(", ")}. Preserve the surrounding room and every unrelated element exactly as shown.`,
                                      },
                                      {
                                        kind: "item",
                                        label: option.label,
                                        target: scopeLabel || "selected component",
                                      }
                                    )
                                  : applyQuickRefinement(option, {
                                      kind: "style",
                                      label: option.label,
                                      stylePrompt: option.prompt,
                                    })
                              }
                            >
                              <img
                                src={styleReferenceImage}
                                alt={`${option.label} full-room style reference`}
                                loading={optionIndex < 4 ? "eager" : "lazy"}
                                onError={(event) => {
                                  if (!event.currentTarget.dataset.fallbackApplied) {
                                    event.currentTarget.dataset.fallbackApplied = "true";
                                    event.currentTarget.src = fallbackImage;
                                  }
                                }}
                              />
                              <i className={css.stylePalette} aria-hidden="true">
                                {(option.palette || []).map((color) => (
                                  <b key={color} style={{ backgroundColor: color }} />
                                ))}
                              </i>
                              <span>{option.label}</span>
                            </AdventureButton>
                          );
                        })}
                      </div>
                    </details>

                    {state.emailCaptured ? <details
                      className={`${css.refinementDrop} ${css.viewSection}`}
                      name="v8-refinement-section"
                      open={openRefinementSection === "view"}
                      onToggle={(event) => {
                        const isOpen = event.currentTarget.open;
                        setOpenRefinementSection((current) =>
                          isOpen ? "view" : current === "view" ? null : current
                        );
                      }}
                    >
                      <summary className={css.refinementDropSummary}>
                        <span>
                          <strong>View &amp; angle</strong>
                          <small>Keep the same physical design</small>
                        </span>
                        <b aria-hidden="true">⌄</b>
                      </summary>
                      <div className={css.viewOptionGrid}>
                        {VIEW_REFINEMENTS.map((option) => {
                          const selected = state.changeNote === option.prompt;
                          return (
                            <AdventureButton
                              key={option.id}
                              type="button"
                              className={css.viewOption}
                              aria-pressed={selected}
                              data-selected={selected ? "true" : "false"}
                              disabled={state.generating || state.refineRemaining <= 0}
                              onClick={() => selectQuickRefinement(option)}
                            >
                              {option.label}
                            </AdventureButton>
                          );
                        })}
                      </div>
                    </details> : null}
                    </div>
                    <div className={css.railFooter}>
                      {state.emailCaptured ? (
                        <>
                          <label className={css.composerLabel} htmlFor="v8-refinement-prompt">
                            Describe any other change
                          </label>
                          <div className={css.refinementComposer}>
                            <AdventureInput
                              id="v8-refinement-prompt"
                              className={css.railInput}
                              placeholder={refinePlaceholder()}
                              value={state.changeNote}
                              onChange={(e) => updateChangeNote(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") void applyChange();
                              }}
                              disabled={state.generating || state.refineRemaining <= 0}
                            />
                            <AdventureButton
                              type="button"
                              className={css.railApply}
                              disabled={state.generating || !state.changeNote.trim() || state.refineRemaining <= 0}
                              onClick={() => void applyChange()}
                            >
                              Apply
                            </AdventureButton>
                          </div>
                          <p className={css.refineRemaining}>
                            {state.refineRemaining > 0
                              ? `${state.refineRemaining} refinements left`
                              : "Refinements used"}
                          </p>
                          <AdventureButton type="button" className={css.railConnectCta} onClick={() => go("connect")}>
                            Get a more accurate estimate →
                          </AdventureButton>
                        </>
                      ) : (
                        <AdventureButton
                          type="button"
                          className={css.railConnectCta}
                          onClick={() => goToPrice()}
                        >
                          Unlock full pricing &amp; refinement →
                        </AdventureButton>
                      )}
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}

            {state.stage === "price" && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  <h1 className={css.prompt}>
                    {state.emailCaptured
                      ? "Your pricing is unlocked"
                      : state.photoPathChosen
                        ? `See what this version of your ${industryLanguage.space} could cost.`
                        : `What this ${industryLanguage.space} could cost`}
                  </h1>
                  {selectedDesign ? (
                    <img className={css.priceGateHero} src={selectedDesign.url} alt={selectedDesign.label} />
                  ) : null}
                  {state.emailCaptured && unlockedPrice ? (
                    <>
                      <p className={css.budgetValue} style={{ marginTop: 16 }}>
                        {formatTightPriceBand(unlockedPrice.min, unlockedPrice.max)}
                      </p>
                      <p className={css.sub}>
                        {state.photoPathChosen
                          ? "A directional range for this concept and finish level—not a contractor quote yet."
                          : "An estimated local range based on the scope and finish level."}
                      </p>
                      <div className={css.pricingBreakdown}>
                        <section>
                          <strong>What&apos;s included</strong>
                          <ul>
                            {(pricingIncludes.length ? pricingIncludes : [scopeLabel || "Selected work"]).map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        </section>
                        <section>
                          <strong>Main price drivers</strong>
                          <ul>
                            <li>Size and site conditions</li>
                            <li>Material and fixture selections</li>
                            <li>Labor, access, and required preparation</li>
                          </ul>
                        </section>
                        <section>
                          <strong>What moves the price</strong>
                          <p>
                            Premium materials, custom fabrication, structural changes, or difficult access increase it.
                            Standard sizes, simpler finishes, and keeping existing utilities in place decrease it.
                          </p>
                        </section>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className={css.lockedPricePreview} aria-label="Price hidden until email unlock">
                        <span>Estimated range</span>
                        <strong>$•••• – $••••</strong>
                      </div>
                      <p className={css.sub}>Enter your email to unlock the range, inclusions, and main cost drivers.</p>
                      <AdventureInput
                        className={css.field}
                        type="email"
                        placeholder="your@email.com"
                        value={state.email}
                        onChange={(e) => patch({ email: e.target.value })}
                        autoFocus
                      />
                      {error && <p className={css.error}>{error}</p>}
                    </>
                  )}
                </div>
                <AdventureActionBar className={css.footer}>
                  {state.emailCaptured ? (
                    <div className={css.footerStack}>
                      {state.photoPathChosen ? (
                        <AdventureButton type="button" intent="primary" className={css.cta} onClick={() => go("visual")}>
                          {forwardAction("Continue refining this concept")}
                        </AdventureButton>
                      ) : (
                        <AdventureButton
                          type="button"
                          intent="primary"
                          className={css.cta}
                          onClick={() => patch({ stage: "visual", selectedDesignId: null, activeRevisionIndex: -1, pricingParts: [] })}
                        >
                          {forwardAction("Browse more local examples")}
                        </AdventureButton>
                      )}
                      {state.photoPathChosen === false ? (
                        <AdventureButton type="button" intent="secondary" className={css.secondary} onClick={() => uploadRef.current?.click()}>
                          Upload a photo for personalization
                        </AdventureButton>
                      ) : null}
                      <AdventureButton type="button" intent="secondary" className={css.secondary} onClick={() => go("connect")}>
                        {forwardAction("Get a more accurate estimate")}
                      </AdventureButton>
                      <AdventureInput
                        ref={uploadRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        hidden
                        onChange={(event) => void onPhotoSelected(event.target.files?.[0] || null)}
                      />
                    </div>
                  ) : (
                    <AdventureButton type="button" intent="primary" className={css.cta} onClick={() => void captureEmail()}>
                      {forwardAction("Unlock my pricing")}
                    </AdventureButton>
                  )}
                </AdventureActionBar>
              </div>
            )}

            {state.stage === "connect" && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  <h1 className={css.prompt}>Want a tighter estimate?</h1>
                  <p className={css.sub}>
                    Share your number and {brandName} can review the details with you.
                  </p>
                  <div className={css.stack} data-adventure-ui="choice-grid">
                    {CONNECT_OPTIONS.filter((opt) => !opt.noPhotoOnly || !state.photoUrl).map((opt) => (
                      <AdventureButton
                        key={opt.id}
                        type="button"
                        intent="choice"
                        aria-pressed={state.connectIntent === opt.id}
                        className={`${css.secondary} ${css.connectOption} ${
                          state.connectIntent === opt.id ? css.cardSelected : ""
                        }`}
                        style={{ marginTop: 0, borderWidth: 2 }}
                        onClick={() => patch({ connectIntent: opt.id })}
                      >
                        <strong>{opt.id === "talk" ? `Talk to ${brandName}` : opt.label}</strong>
                        {opt.id === "photo_application" ? (
                          <span>Let {brandName} text you, then reply with a photo whenever it&apos;s handy.</span>
                        ) : null}
                      </AdventureButton>
                    ))}
                  </div>
                  {state.connectIntent && (
                    <div style={{ marginTop: 16 }}>
                      <AdventureInput
                        className={css.field}
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        placeholder={
                          state.connectIntent === "photo_application" ? "Mobile number for the photo text" : "Phone number"
                        }
                        value={state.phone}
                        onChange={(e) => patch({ phone: e.target.value })}
                      />
                      {error && <p className={css.error}>{error}</p>}
                    </div>
                  )}
                </div>
                {state.connectIntent && (
                  <AdventureActionBar className={css.footer}>
                    <AdventureButton type="button" intent="primary" className={css.cta} onClick={() => void capturePhone()}>
                      {state.connectIntent === "photo_application" ? "Text me so I can send a photo →" : "Connect me →"}
                    </AdventureButton>
                  </AdventureActionBar>
                )}
              </div>
            )}

            {state.stage === "done" && (
              <div className={css.stage} data-adventure-ui="step-shell">
                <div className={css.stageBody} data-adventure-ui="step-body">
                  <h1 className={css.prompt}>
                    {state.connectIntent === "photo_application" ? "Watch for a text." : "Your accuracy review is next."}
                  </h1>
                  <p className={css.sub}>
                    {state.connectIntent === "photo_application"
                      ? `${brandName} will follow up so you can reply with a photo of your actual space.`
                      : `We’ve got your project and how to reach you — ${brandName} will review the details and follow up with a more specific range for your ${
                          selectedService?.label?.toLowerCase() || "project"
                        }.`}
                  </p>
                  <div className={css.sliderWrap}>
                    <p className={css.muted}>Service: {selectedService?.label}</p>
                    <p className={css.muted}>Scope: {scopeLabel}</p>
                    <p className={css.muted}>
                      Price: {unlockedPrice ? formatTightPriceBand(unlockedPrice.min, unlockedPrice.max) : formatMoney(state.budget)}
                    </p>
                    <p className={css.muted}>Email: {state.email || "—"}</p>
                    <p className={css.muted}>Phone: {state.phone || "—"}</p>
                  </div>
                </div>
                <AdventureActionBar className={css.footer}>
                  <AdventureButton
                    type="button"
                    intent="primary"
                    className={css.cta}
                    onClick={() => {
                      const skipped = Boolean(serviceQuestion?.skip) || services.length === 1;
                      if (!skipped) setScopeQuestion(null);
                      setState({
                        ...initialState(),
                        stage: skipped ? "project" : "service",
                        serviceId: skipped ? serviceQuestion?.selectedServiceId || services[0]?.value || null : null,
                        serviceSkipped: skipped,
                        budget: state.budget,
                      });
                    }}
                  >
                    Start another project
                  </AdventureButton>
                </AdventureActionBar>
              </div>
            )}
          </>
        )}
      </main>
    </div>
    </AdventureUiProvider>
    </FormThemeProvider>
  );
}
