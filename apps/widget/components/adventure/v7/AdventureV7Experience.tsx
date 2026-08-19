"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandHeader } from "@/components/widget/BrandHeader";
import { withWidgetDesignDefaults } from "@/lib/widget-design-defaults";
import type { DesignSettings } from "@/types/design";

import type { ServiceOption } from "../v2/types";
import { v2ScopeStarterKey } from "@/lib/adventure-v2/scope-starter-catalog";
import { budgetBandsForService } from "../v3/visual-pricing";
import css from "./configurator-v7.module.css";
import { callAdventurePipeline, curateAdventureImages, type V7DesignPayload } from "./adventurePipelineClient";
import type {
  V7BudgetBounds,
  V7BudgetSource,
  V7Estimate,
  V7GeneratedImage,
  V7GateExperiment,
  V7PhotoAnalysis,
  V7PriceLever,
  V7ProjectState,
  V7Stage,
  V7State,
  V7StartPath,
  V7TasteTag,
} from "./types";

type Props = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
};

const STAGE_ORDER: V7Stage[] = [
  "service", // Choose
  "project", // Scope
  "budget",
  "path", // Starting
  "inspiration",
  "review",
  "exploration",
  "refine",
  "email_gate",
  "final",
  "consultation",
  "connect",
  "done",
];

const REFINE_ACTIONS = [
  "More like this",
  "Change a component",
  "Make it more affordable",
  "Try another style",
  "Something different",
];

const PRICE_ACTIONS = ["Make it more affordable", "Spend more"] as const;

/** Inspiration gallery: retrieve-first, large board, 2–5 favorites. */
const INSPIRATION_TARGET = 54;
const INSPIRATION_FAVORITES_MIN = 2;
const INSPIRATION_FAVORITES_MAX = 5;
/** Exploration: progressive fill toward this count. */
const EXPLORATION_TARGET = 12;

const CONNECT_OPTIONS = [
  { id: "quote", label: "Get a real quote on this design" },
  { id: "talk", label: "Have someone from the business reach out" },
  { id: "schedule", label: "Book a walkthrough" },
  { id: "continue", label: "Keep refining on my own for now" },
];

/** Extra idea-grid regenerations after the first set (not counting the initial batch). */
const EXPLORATION_REGEN_LIMIT = 2;

/** Element-level parts for Focus (select-all “Full …” is UI-only, not in these lists). */
const FALLBACK_SERVICES: ServiceOption[] = [
  {
    value: "bathroom-remodel",
    label: "Bathroom Remodel",
    serviceName: "Bathroom Remodel",
    subcategoryScope: [
      "Shower / tub",
      "Vanity",
      "Cabinets & storage",
      "Countertop",
      "Toilet",
      "Floor tile",
      "Wall tile",
      "Faucets & fixtures",
      "Lighting",
      "Mirror / medicine cabinet",
      "Paint & trim",
      "Hardware",
      "Exhaust fan",
      "Layout changes",
      "Plumbing updates",
    ],
  },
  {
    value: "kitchen-remodel",
    label: "Kitchen Remodel",
    serviceName: "Kitchen Remodel",
    subcategoryScope: [
      "Cabinets",
      "Countertops",
      "Backsplash",
      "Island",
      "Sink & faucet",
      "Appliances",
      "Lighting",
      "Flooring",
      "Hardware",
      "Paint",
      "Pantry",
      "Layout changes",
      "Plumbing updates",
      "Electrical updates",
    ],
  },
  {
    value: "flooring",
    label: "Flooring",
    serviceName: "Flooring",
    subcategoryScope: [
      "Living areas",
      "Kitchen",
      "Bathrooms",
      "Bedrooms",
      "Hallways",
      "Stairs",
      "Basement",
      "Entry / mudroom",
      "Transitions & trim",
    ],
  },
  {
    value: "pergola",
    label: "Pergola",
    serviceName: "Pergola",
    subcategoryScope: [
      "Attached structure",
      "Freestanding structure",
      "Roof / shade canopy",
      "Posts & beams",
      "Lighting",
      "Fans",
      "Outdoor kitchen tie-in",
      "Seating area",
      "Deck / patio base",
    ],
  },
  {
    value: "landscaping",
    label: "Landscaping",
    serviceName: "Landscaping",
    subcategoryScope: [
      "Patio / terrace",
      "Walkways & paths",
      "Outdoor grill / kitchen",
      "Outdoor seating & furniture",
      "Fire pit / fireplace",
      "Pergola / shade structure",
      "Outdoor lighting",
      "Lawn",
      "Planting beds",
      "Trees & shrubs",
      "Privacy screening",
      "Retaining walls",
      "Driveway",
      "Fence / gate",
      "Water feature",
      "Irrigation",
      "Drainage",
      "Outdoor dining area",
    ],
  },
];

function isOtherPart(label: string): boolean {
  const s = String(label || "").trim();
  return /^other$/i.test(s) || /^multiple\s*\/\s*other$/i.test(s);
}

function isOverallPart(label: string): boolean {
  const s = String(label || "").trim();
  return /^full\b/i.test(s) || /^whole\b/i.test(s) || /master plan/i.test(s);
}

function fullRenovationLabel(service: ServiceOption | null): string {
  const name = (service?.label || "project").trim();
  if (/bath/i.test(name)) return "Full bathroom renovation";
  if (/kitchen/i.test(name)) return "Full kitchen renovation";
  if (/landscap|outdoor|garden|yard|patio/i.test(name)) return "Full outdoor renovation";
  if (/floor/i.test(name)) return "Whole-home flooring";
  return "Full renovation";
}

/**
 * Map element-level Focus parts → known v2_scope_starter labels so covers still hit
 * after we moved from coarse buckets to parts.
 */
const PART_COVER_ALIASES: Record<string, string[]> = {
  "shower / tub": ["Shower or tub area only"],
  vanity: ["Vanity, cabinets & fixtures"],
  "cabinets & storage": ["Vanity, cabinets & fixtures"],
  "faucets & fixtures": ["Vanity, cabinets & fixtures"],
  "floor tile": ["Tile & flooring"],
  "wall tile": ["Tile & flooring"],
  "flooring (non-tile)": ["Tile & flooring"],
  "paint & trim": ["Cosmetic refresh (paint, lighting, hardware)"],
  hardware: ["Cosmetic refresh (paint, lighting, hardware)"],
  lighting: ["Outdoor lighting installation", "Cosmetic refresh (paint, lighting, hardware)"],
  "layout changes": ["Layout or plumbing changes"],
  "plumbing updates": ["Layout or plumbing changes"],
  "patio / terrace": ["Patio and walkway upgrade"],
  "walkways & paths": ["Patio and walkway upgrade"],
  "outdoor grill / kitchen": ["Full outdoor renovation", "Patio and walkway upgrade"],
  "outdoor seating & furniture": ["Patio and walkway upgrade"],
  "outdoor dining area": ["Patio and walkway upgrade"],
  "fire pit / fireplace": ["Patio and walkway upgrade"],
  "pergola / shade structure": ["Patio and walkway upgrade"],
  "outdoor lighting": ["Outdoor lighting installation"],
  lawn: ["New lawn and garden installation"],
  "planting beds": ["New lawn and garden installation"],
  "trees & shrubs": ["Tree and shrub pruning service", "New lawn and garden installation"],
  "privacy screening": ["New lawn and garden installation"],
  driveway: ["Driveway resurfacing and repair"],
  "hardscape color scheme refresh": ["Hardscape color scheme refresh"],
  "full bathroom renovation": ["Full bathroom renovation"],
  "full kitchen renovation": ["Full kitchen renovation"],
  "full outdoor renovation": ["Full outdoor renovation"],
};

function coverTokens(text: string): Set<string> {
  return new Set(
    String(text || "")
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((t) => t.length > 2 && !["and", "the", "for", "with", "only"].includes(t))
  );
}

/**
 * Catalog / starter / generated override only.
 * No stock Unsplash — missing parts stay text-only until we generate a cover.
 */
function preferredPartCover(
  service: ServiceOption | null | undefined,
  partLabel: string,
  overrides?: Record<string, { imageUrl: string }> | null
): string | null {
  if (!partLabel || isOtherPart(partLabel)) return null;
  const key = v2ScopeStarterKey(partLabel);
  if (overrides) {
    const fromOverride =
      overrides[key]?.imageUrl ||
      overrides[partLabel]?.imageUrl ||
      overrides[partLabel.toLowerCase()]?.imageUrl;
    if (fromOverride && /^https?:\/\//i.test(fromOverride)) return fromOverride;
  }

  const covers = service?.scopeCovers;
  if (covers && typeof covers === "object") {
    const exact =
      covers[key] || covers[partLabel] || covers[partLabel.toLowerCase()] || null;
    const exactUrl = String(exact?.imageUrl || "").trim();
    if (/^https?:\/\//i.test(exactUrl)) return exactUrl;

    for (const alias of PART_COVER_ALIASES[partLabel.toLowerCase()] || []) {
      const aliasKey = v2ScopeStarterKey(alias);
      const hit = covers[aliasKey] || covers[alias] || covers[alias.toLowerCase()];
      const url = String(hit?.imageUrl || "").trim();
      if (/^https?:\/\//i.test(url)) return url;
    }
  }

  // Only strong catalog matches — weak 1-token hits look irrelevant on this step.
  const needles = coverTokens(partLabel);
  if (needles.size < 2) return null;
  let best: { url: string; score: number } | null = null;
  for (const opt of service?.styleOptions || []) {
    const url = String(opt?.imageUrl || "").trim();
    if (!/^https?:\/\//i.test(url)) continue;
    const hay = coverTokens(
      [opt?.label, (opt as any)?.scope, (opt as any)?.description]
        .filter(Boolean)
        .join(" ")
    );
    let score = 0;
    for (const t of needles) if (hay.has(t)) score += 1;
    if (score < 2) continue;
    if (!best || score > best.score) best = { url, score };
  }
  return best?.url || null;
}

/** Assign real covers only (starter / alias / strong catalog / generated). */
function assignPartCovers(
  service: ServiceOption | null | undefined,
  parts: string[],
  overrides?: Record<string, { imageUrl: string }> | null
): Record<string, string> {
  const out: Record<string, string> = {};
  const used = new Set<string>();

  for (const part of parts) {
    if (isOtherPart(part)) continue;
    const preferred = preferredPartCover(service, part, overrides);
    if (preferred && !used.has(preferred)) {
      out[part] = preferred;
      used.add(preferred);
    }
  }
  return out;
}

function partsMissingCovers(
  service: ServiceOption | null | undefined,
  parts: string[],
  overrides?: Record<string, { imageUrl: string }> | null
): string[] {
  const assigned = assignPartCovers(service, parts, overrides);
  return parts.filter((p) => !isOtherPart(p) && !assigned[p]);
}

function normalizeServices(raw: unknown): ServiceOption[] {
  if (!Array.isArray(raw)) return [];
  const normalized: ServiceOption[] = [];
  for (const service of raw as any[]) {
    const value = String(service?.value ?? service?.id ?? service?.slug ?? "").trim();
    const businessLabel = String(
      service?.businessLabel ?? service?.business_label ?? service?.serviceName ?? service?.service_name ?? service?.label ?? service?.name ?? ""
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
      scopeCovers:
        service?.scopeCovers && typeof service.scopeCovers === "object" ? service.scopeCovers : undefined,
      styleOptions: Array.isArray(service?.styleOptions) ? service.styleOptions : [],
    });
  }
  return normalized;
}

function ensureOtherScope(scopes: string[]): string[] {
  const cleaned = Array.from(
    new Set(
      scopes
        .map((s) => s.trim())
        .filter(Boolean)
        .filter((s) => !isOtherPart(s) && !isOverallPart(s))
    )
  );
  return [...cleaned, "Other"];
}

/**
 * Focus parts: prefer stored components, then subcategory_scope, then trade defaults.
 * Always element-level (not coarse buckets). "Full renovation" is a separate UI control.
 */
function scopesForService(service: ServiceOption | null): string[] {
  if (!service) return ["Other"];

  const fromComponents = (service.subcategoryComponents || [])
    .slice()
    .sort((a, b) => Number(a?.priority || 0) - Number(b?.priority || 0))
    .map((c) => String(c?.label || c?.key || "").trim())
    .filter(Boolean);

  const fromConfig = Array.from(
    new Set((service.subcategoryScope || []).map((scope) => scope.trim()).filter(Boolean))
  );

  const fallback = FALLBACK_SERVICES.find((item) => {
    if (item.value === service.value) return true;
    if (item.label.toLowerCase() === service.label.toLowerCase()) return true;
    if (/bath/i.test(service.label) && /bath/i.test(item.label)) return true;
    if (/kitchen/i.test(service.label) && /kitchen/i.test(item.label)) return true;
    if (/landscap|outdoor|garden/i.test(service.label) && /landscap/i.test(item.label)) return true;
    if (/pergola|patio cover/i.test(service.label) && /pergola/i.test(item.label)) return true;
    if (/floor/i.test(service.label) && /floor/i.test(item.label)) return true;
    return false;
  });

  // Prefer the richest element list available.
  const candidates = [fromComponents, fromConfig, fallback?.subcategoryScope || []].sort(
    (a, b) => b.length - a.length
  );
  const best = candidates[0] || [];
  if (best.length >= 8) return ensureOtherScope(best);
  if (fromConfig.length > 0) return ensureOtherScope(fromConfig);
  if (fromComponents.length > 0) return ensureOtherScope(fromComponents);
  return ensureOtherScope(fallback?.subcategoryScope || ["Main area", "Finishes", "Fixtures"]);
}

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function placeholderUrl(seed: string, w = 800, h = 800): string {
  const n = (hashSeed(seed) % 1000) + 1;
  return `https://picsum.photos/seed/${encodeURIComponent(`${seed}-${n}`)}/${w}/${h}`;
}

/**
 * Deterministic cover art for Steps 1–2 when the business has no catalog yet.
 * Not AI generation — fixed Unsplash URLs keyed by service/scope so early cards
 * look like the trade instead of random Picsum tiles.
 */
const SERVICE_COVERS: Record<string, string[]> = {
  bathroom: [
    "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&q=80",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&q=80",
    "https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?w=800&q=80",
  ],
  kitchen: [
    "https://images.unsplash.com/photo-1556912173-46c336c7fd55?w=800&q=80",
    "https://images.unsplash.com/photo-1556911220-bff31c5750ea?w=800&q=80",
    "https://images.unsplash.com/photo-1600489000022-c2086d79f9d4?w=800&q=80",
    "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=800&q=80",
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=800&q=80",
    "https://images.unsplash.com/photo-1565538810643-b5bdb714032a?w=800&q=80",
  ],
  landscaping: [
    "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=800&q=80",
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&q=80",
    "https://images.unsplash.com/photo-1598902108854-10e335adac99?w=800&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?w=800&q=80",
  ],
  flooring: [
    "https://images.unsplash.com/photo-1581858726788-75bc52f2598f?w=800&q=80",
    "https://images.unsplash.com/photo-1615874959474-d609969a20ed?w=800&q=80",
    "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?w=800&q=80",
    "https://images.unsplash.com/photo-1600210492493-0946911123ea?w=800&q=80",
  ],
  default: [
    "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=800&q=80",
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=800&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
  ],
};

function coverPoolKey(label: string): string {
  const text = label.toLowerCase();
  if (/bath|shower|vanity|tub/.test(text)) return "bathroom";
  if (/kitchen/.test(text)) return "kitchen";
  if (/landscap|yard|patio|pergola|outdoor|garden/.test(text)) return "landscaping";
  if (/floor/.test(text)) return "flooring";
  return "default";
}

function budgetTierFor(budget: number): string {
  if (budget <= 0) return "$$";
  if (budget < 15000) return "$";
  if (budget < 40000) return "$$";
  if (budget < 90000) return "$$$";
  return "$$$$";
}

/** Trade cover pool used as a retrieve library when the business catalog is empty. */
function fallbackLibraryFor(
  serviceLabel: string,
  scope: string,
  budget: number
): Array<{
  url: string;
  label: string;
  description: string;
  priceTier: string;
}> {
  const key = coverPoolKey(`${serviceLabel} ${scope}`);
  const pool = SERVICE_COVERS[key] || SERVICE_COVERS.default;
  const tier = budgetTierFor(budget);
  return pool.map((url, i) => ({
    url,
    label: scope ? `${scope} look ${i + 1}` : `${serviceLabel} look ${i + 1}`,
    description: `${serviceLabel} ${scope} ${key}`.trim(),
    priceTier: tier,
  }));
}

/**
 * Service-card cover: first catalog image only (no stock). Focus/scope step is text-only.
 */
function catalogCoverUrl(
  service: ServiceOption | null | undefined,
  seed: string
): string | null {
  const options = service?.styleOptions || [];
  if (!options.length) return null;
  const urls = options
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
  return {
    min,
    max,
    step: Number.isFinite(step) && step > 0 ? step : undefined,
  };
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

/** Market label for “nearby” cues — never invent a person; city only if instance has one. */
function localityFromInstance(instance: any): { label: string; isNamedPlace: boolean } {
  const city = String(
    instance?.city ||
      instance?.location_city ||
      instance?.market_city ||
      instance?.address?.city ||
      instance?.business_city ||
      ""
  ).trim();
  const region = String(
    instance?.state ||
      instance?.location_state ||
      instance?.market_state ||
      instance?.address?.state ||
      ""
  ).trim();
  if (city && region) return { label: `${city}, ${region}`, isNamedPlace: true };
  if (city) return { label: city, isNamedPlace: true };
  return { label: "your area", isNamedPlace: false };
}

function budgetBandLabel(budget: number): string {
  const roundTo = budget < 20000 ? 5000 : 10000;
  const low = Math.max(roundTo, Math.round((budget * 0.85) / roundTo) * roundTo);
  const high = Math.round((budget * 1.15) / roundTo) * roundTo;
  return `${formatMoney(low)}–${formatMoney(high)}`;
}

/** Aggregate-pattern cues only — no fabricated customers or testimonials. */
function localCuesForGrid(opts: {
  count: number;
  seed: string;
  scope: string;
  budget: number;
  locality: { label: string; isNamedPlace: boolean };
}): Array<string | null> {
  const scopeShort = opts.scope.replace(/\s*\/\s*Other$/i, "").trim() || "this project";
  const pool = [
    "Popular nearby",
    `Common for ${budgetBandLabel(opts.budget)} projects`,
    `Often chosen with ${scopeShort.toLowerCase()}`,
    opts.locality.isNamedPlace
      ? `Trending in ${opts.locality.label}`
      : "Popular in your area",
    "Similar to looks people save most",
  ];
  return Array.from({ length: opts.count }, (_, i) => {
    // Leave ~40% without a cue so the grid doesn’t feel plastered.
    if ((hashSeed(`${opts.seed}-cue-${i}`) % 10) < 4) return null;
    return pool[hashSeed(`${opts.seed}-pick-${i}`) % pool.length];
  });
}

const SCOPE_STARTER_FOR = new Set(["v2_scope_starter", "v2_neutral_scope_starter"]);
const LIBRARY_SCOPE_MIN = 12;

function performanceCueFromStats(opt: {
  timesShown?: number;
  timesSelected?: number;
  timesSaved?: number;
  conversions?: number;
}): string | null {
  const shown = Number(opt.timesShown || 0);
  const selected = Number(opt.timesSelected || 0);
  const saved = Number(opt.timesSaved || 0);
  const conversions = Number(opt.conversions || 0);
  if (saved >= 3) return "Often saved";
  if (selected >= 3 && shown > 0 && selected / Math.max(shown, 1) >= 0.15) return "Popular pick";
  if (conversions >= 1) return "Leads to quotes";
  if (shown >= 20) return "Frequently shown";
  return null;
}

function inspirationCardCue(img: {
  cue?: string | null;
  performanceCue?: string | null;
  priceTier?: string | null;
  label?: string;
  source?: string;
}): string | null {
  if (img.performanceCue) return img.performanceCue;
  if (img.cue && !/^Popular nearby$/i.test(img.cue) && !/^From library$/i.test(img.cue)) {
    return img.cue;
  }
  if (img.priceTier) return img.priceTier;
  if (img.source === "generated") return "New for you";
  return img.cue || null;
}

/** Hard-filter catalog by selected scopes; broaden only if thinner than ~12. */
function filterLibraryByScopes<
  T extends {
    url: string;
    scope?: string | null;
    scopeKey?: string | null;
    tags?: string[];
    generatedFor?: string | null;
  },
>(items: T[], scopes: string[]): T[] {
  const needles = new Set(
    scopes
      .map((s) => String(s || "").trim())
      .filter((s) => s && s.toLowerCase() !== "other" && !/multiple\s*\/\s*other/i.test(s))
      .map((s) => v2ScopeStarterKey(s))
  );
  if (!needles.size || !items.length) return items;

  const matches = (item: T) => {
    const keys = new Set<string>();
    const sk = String(item.scopeKey || "").trim();
    if (sk) keys.add(v2ScopeStarterKey(sk));
    const scope = String(item.scope || "").trim();
    if (scope) keys.add(v2ScopeStarterKey(scope));
    for (const tag of item.tags || []) {
      const t = String(tag || "").trim();
      if (t) keys.add(v2ScopeStarterKey(t));
    }
    for (const k of keys) {
      if (needles.has(k)) return true;
    }
    return false;
  };

  const matched = items.filter(matches);
  const starters = matched.filter((m) => SCOPE_STARTER_FOR.has(String(m.generatedFor || "")));
  const preferred = starters.length >= LIBRARY_SCOPE_MIN ? starters : matched;
  if (preferred.length >= LIBRARY_SCOPE_MIN) return preferred;
  if (preferred.length > 0) {
    const seen = new Set(preferred.map((p) => p.url));
    return [...preferred, ...items.filter((i) => !seen.has(i.url))];
  }
  return items;
}

/** Soft estimate for a focused idea — budget + refine tilt + slight per-idea variance. */
function estimateForIdea(
  budget: number,
  ideaId: string,
  refineNote?: string | null,
  priceImpact = 0
): { min: number; max: number } {
  const hash = hashSeed(`${ideaId}:${refineNote || "base"}`);
  const tilt = ((hash % 11) - 5) / 100; // -5% … +5%
  const mid = Math.max(2500, budget * (1 + tilt) * (1 + priceImpact));
  const spread = Math.max(2000, mid * 0.16);
  const roundTo = mid < 20000 ? 500 : 1000;
  const round = (n: number) => Math.max(roundTo, Math.round(n / roundTo) * roundTo);
  return { min: round(mid - spread / 2), max: round(mid + spread / 2) };
}

function priceImpactForAction(action: string): number {
  const value = action.toLowerCase();
  if (/spend less|more affordable|afford|cheap|save|less expensive|simpler|simplify/.test(value)) {
    return -0.12;
  }
  if (/spend more|elevat|premium|upgrade|luxury|richer/.test(value)) return 0.14;
  if (/modern|warmer|storage|tile|material|hardscape|vanity|planting|component/.test(value)) {
    return 0.04;
  }
  if (/different|another style|more like this/.test(value)) return 0.02;
  return 0.03;
}

function clampImpact(value: number): number {
  return Math.max(-0.28, Math.min(0.4, value));
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** One wait UI for boot and every generation — never swap loader styles mid-flow. */
function LoadingState({ label = "One moment…" }: { label?: string }) {
  return (
    <div className={css.loading} role="status" aria-live="polite">
      <span className={css.loadingTrack} aria-hidden="true" />
      <p className={css.loadingLabel}>{label}</p>
    </div>
  );
}

/** Mock vision summary across favorites → 6–8 visual taste tags with crop thumbs. */
function buildTasteTags(
  serviceLabel: string,
  scope: string,
  favoriteImages: V7GeneratedImage[]
): V7TasteTag[] {
  const text = `${serviceLabel} ${scope}`.toLowerCase();
  let pool: string[];
  if (/bath|shower|vanity|tub/.test(text)) {
    pool = [
      "Warm wood",
      "Large-format tile",
      "Matte black fixtures",
      "Soft ambient light",
      "Clean lines",
      "Stone-look surfaces",
      "Neutral colors",
      "Glass shower",
      "Floating vanity",
      "Modern look",
    ];
  } else if (/kitchen/.test(text)) {
    pool = [
      "Warm wood",
      "Stone countertops",
      "Clean lines",
      "Open layout",
      "Soft natural light",
      "Mixed metals",
      "Large island",
      "Neutral colors",
      "Modern look",
      "Subtle backsplash",
    ];
  } else if (/landscap|yard|patio|pergola/.test(text)) {
    pool = [
      "Warm wood",
      "Large-format pavers",
      "Clean lines",
      "Natural planting",
      "Neutral colors",
      "Built-in seating",
      "Modern look",
      "Open layout",
      "Layered lighting",
      "Natural stone",
    ];
  } else if (/floor/.test(text)) {
    pool = [
      "Wide-plank look",
      "Warm tone",
      "Clean lines",
      "Subtle grain",
      "Matte finish",
      "Neutral colors",
      "Continuous flow",
      "Modern look",
    ];
  } else {
    pool = [
      "Warm wood",
      "Clean lines",
      "Neutral colors",
      "Modern look",
      "Open layout",
      "Soft natural light",
      "Mixed textures",
      "Simple geometry",
    ];
  }

  const seed = favoriteImages.map((img) => img.id).join("|") || "taste";
  const rotated = [...pool.slice(hashSeed(seed) % pool.length), ...pool.slice(0, hashSeed(seed) % pool.length)];
  const labels = rotated.slice(0, Math.min(8, Math.max(6, rotated.length)));
  const sources = favoriteImages.length > 0 ? favoriteImages : [];

  return labels.map((label, i) => {
    const source = sources[i % Math.max(sources.length, 1)];
    const focalSeed = hashSeed(`${seed}-${label}-${i}`);
    return {
      id: `taste-${i + 1}`,
      label,
      imageUrl: source?.url || placeholderUrl(`${seed}-taste-${i}`),
      focalX: 20 + (focalSeed % 60),
      focalY: 20 + ((focalSeed >> 3) % 60),
    };
  });
}

function initialState(gate: V7GateExperiment): V7State {
  return {
    stage: "loading",
    serviceId: null,
    scopes: [],
    otherScope: "",
    budget: 25000,
    budgetBandId: null,
    budgetSource: "customer",
    budgetBounds: null,
    startPath: null,
    photoDataUrl: null,
    photoAnalysis: null,
    inspiration: [],
    favorites: [],
    tasteTags: [],
    selectedTasteTagIds: [],
    explorations: [],
    explorationPicks: [],
    explorationRegenRemaining: EXPLORATION_REGEN_LIMIT,
    explorationFocusId: null,
    refineNote: null,
    workspaceHistory: [],
    workspaceHistoryIndex: 0,
    priceImpact: 0,
    estimate: null,
    email: "",
    emailCaptured: false,
    emailFormOpen: false,
    finalOptions: [],
    selectedFinalId: null,
    phone: "",
    phoneCaptured: false,
    connectIntent: null,
    handoff: null,
    chatInput: "",
    chatLog: [],
    generating: false,
    generatingLabel: "",
    gate,
    pricingUnlocked: false,
  };
}

function progressLabel(stage: V7Stage): string {
  // Solo refine / consultation / email gate / old final tradeoff are folded into steer.
  const visible = STAGE_ORDER.filter(
    (s) =>
      s !== "done"
      && s !== "refine"
      && s !== "consultation"
      && s !== "email_gate"
      && s !== "final"
      && s !== "likes"
  );
  const normalized =
    stage === "likes"
      ? "review"
      : stage === "refine" || stage === "email_gate" || stage === "final" || stage === "consultation"
        ? "exploration"
        : stage;
  const idx = visible.indexOf(normalized as (typeof visible)[number]);
  if (idx < 0) return "";
  return `Step ${idx + 1} of ${visible.length}`;
}

export function AdventureV7Experience({ instanceId, initialInstanceData, initialDesignConfig }: Props) {
  const [instance, setInstance] = useState<any>(initialInstanceData || null);
  const [design, setDesign] = useState<DesignSettings>(() =>
    withWidgetDesignDefaults(initialDesignConfig || initialInstanceData?.config || {}, initialInstanceData?.name)
  );
  const [services, setServices] = useState<ServiceOption[]>(FALLBACK_SERVICES);
  const [state, setState] = useState<V7State>(() => initialState("a"));
  const [error, setError] = useState<string | null>(null);
  /** Session overrides: extra parts from text model; generated covers for missing pics. */
  const [scopeOptionsOverride, setScopeOptionsOverride] = useState<string[] | null>(null);
  const [scopeCoverOverrides, setScopeCoverOverrides] = useState<
    Record<string, { imageUrl: string }>
  >({});
  const [scopeEnriching, setScopeEnriching] = useState(false);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  /** Last pipeline curation payload — used to write winners back on select. */
  const lastCurationRef = useRef<Record<string, any> | null>(null);
  const scopeEnrichKeyRef = useRef<string>("");

  const patch = useCallback((next: Partial<V7State>) => {
    setState((prev) => ({ ...prev, ...next }));
  }, []);

  const selectedService = useMemo(
    () => services.find((s) => s.value === state.serviceId) || null,
    [services, state.serviceId]
  );

  const storedScopeOptions = useMemo(() => scopesForService(selectedService), [selectedService]);
  const scopeOptions = scopeOptionsOverride?.length
    ? ensureOtherScope(scopeOptionsOverride)
    : storedScopeOptions;
  /** Parts only — Other is separate; Full renovation is the select-all control. */
  const scopeParts = useMemo(
    () => scopeOptions.filter((s) => !isOtherPart(s)),
    [scopeOptions]
  );
  const fullLabel = useMemo(() => fullRenovationLabel(selectedService), [selectedService]);
  const allPartsSelected =
    scopeParts.length > 0 && scopeParts.every((part) => state.scopes.includes(part));
  const partCoverByLabel = useMemo(
    () => assignPartCovers(selectedService, scopeOptions, scopeCoverOverrides),
    [selectedService, scopeOptions, scopeCoverOverrides]
  );

  const refineActions = useMemo(() => {
    const label = selectedService?.label || "";
    const scopes = state.scopes.join(" ");
    if (/bath|shower|vanity|tub/i.test(`${label} ${scopes}`)) {
      return [
        "More like this",
        "Change the vanity",
        "Change the tile",
        "Make it more affordable",
        "Try another style",
        "Something different",
      ];
    }
    if (/kitchen/i.test(label)) {
      return [
        "More like this",
        "Change the cabinets",
        "Change the counters",
        "Make it more affordable",
        "Try another style",
        "Something different",
      ];
    }
    if (/landscap|outdoor|patio|pergola/i.test(label)) {
      return [
        "More like this",
        "Change the hardscape",
        "Change the planting",
        "Make it more affordable",
        "Try another style",
        "Something different",
      ];
    }
    return REFINE_ACTIONS;
  }, [selectedService?.label, state.scopes]);

  const localBudgetBounds = useMemo((): V7BudgetBounds => {
    const bands = budgetBandsForService(selectedService).filter((b) => b.id !== "not-sure");
    const mins = bands.map((b) => b.min).filter((v): v is number => typeof v === "number");
    const maxes = bands.map((b) => b.max).filter((v): v is number => typeof v === "number");
    const min = mins.length ? Math.min(...mins) : 5000;
    const maxCandidate = maxes.length ? Math.max(...maxes) : 80000;
    const openEnded = bands.some((b) => b.max == null && b.min != null);
    const max = openEnded ? Math.max(maxCandidate, (Math.max(...mins.filter(Boolean)) || maxCandidate) * 1.4) : maxCandidate;
    const step = max <= 20000 ? 500 : max <= 60000 ? 1000 : 2500;
    return { min, max: Math.max(min + step, max), step, source: "business" };
  }, [selectedService]);

  const budgetBounds = state.budgetBounds || localBudgetBounds;

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      let gate: V7GateExperiment = "a";
      try {
        const params = new URLSearchParams(window.location.search);
        const gateParam = (params.get("gate") || "").toLowerCase();
        if (gateParam === "b" || gateParam === "a") gate = gateParam;
      } catch {}

      try {
        const response = await fetch(`/api/widget/${encodeURIComponent(instanceId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load configurator.");
        const data = await response.json();
        if (cancelled) return;
        const nextInstance = data?.instance || initialInstanceData || {};
        const nextServices = normalizeServices(data?.serviceOptions);
        const resolved = nextServices.length > 0 ? nextServices : FALLBACK_SERVICES;
        setInstance(nextInstance);
        setDesign((prev) => withWidgetDesignDefaults(nextInstance?.config || prev, nextInstance?.name));
        setServices(resolved);
        const implicit = resolved.length === 1 ? resolved[0] : null;
        const bands = budgetBandsForService(implicit);
        const mid = bands.find((b) => b.min != null && b.max != null);
        setState({
          ...initialState(gate),
          stage: implicit ? "project" : "service",
          serviceId: implicit?.value || null,
          budget: mid ? Math.round(((mid.min || 0) + (mid.max || mid.min || 25000)) / 2) : 25000,
        });
      } catch (bootError) {
        if (cancelled) return;
        setServices(FALLBACK_SERVICES);
        setState({ ...initialState(gate), stage: "service" });
        setError(bootError instanceof Error ? bootError.message : "Unable to load configurator.");
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [initialInstanceData, instanceId]);

  useEffect(() => {
    if (!selectedService) return;
    if (state.budget < budgetBounds.min || state.budget > budgetBounds.max) {
      patch({ budget: Math.round((budgetBounds.min + budgetBounds.max) / 2 / budgetBounds.step) * budgetBounds.step });
    }
  }, [budgetBounds, patch, selectedService, state.budget]);

  const go = (stage: V7Stage) => patch({ stage });

  const goBack = () => {
    const current = state.stage;
    // Focused idea → back to the idea grid (pick a different one).
    if (current === "exploration" && state.explorationFocusId) {
      patch({ explorationFocusId: null, explorationPicks: [] });
      return;
    }
    if (current === "final" || current === "consultation") {
      go("exploration");
      return;
    }
    if (current === "email_gate") {
      go("exploration");
      return;
    }
    const idx = STAGE_ORDER.indexOf(current);
    if (idx <= 0) return;
    let prev = STAGE_ORDER[idx - 1];
    // Refine + AI consult + email gate + old final tradeoff live inside steer.
    if (prev === "likes") prev = "review";
    if (prev === "refine" || prev === "email_gate" || prev === "final" || prev === "consultation") {
      prev = "exploration";
    }
    if (prev === "path" && state.startPath === "photo" && current === "inspiration") {
      go("path");
      return;
    }
    go(prev);
  };

  /**
   * ProjectState (+ flat compat) for every pipeline call.
   * Scope is always the full multi-select list — never collapsed to scopes[0].
   */
  const designPayload = useCallback(
    (overrides?: Partial<V7DesignPayload>): V7DesignPayload => {
      const favoriteUrls = state.favorites
        .map((id) => state.inspiration.find((img) => img.id === id)?.url)
        .filter((url): url is string => Boolean(url));
      const businessLabel =
        selectedService?.businessLabel || selectedService?.serviceName || selectedService?.label || "Project";
      const customerLabel = selectedService?.customerLabel || selectedService?.label || businessLabel;
      const scopeItems = state.scopes.map((label) => ({
        key: label,
        label,
        source: "stored" as const,
      }));
      const scopeJoined = state.scopes.join(", ") || "General";
      const project: V7ProjectState = {
        instanceId,
        service: {
          id: state.serviceId || "",
          businessLabel,
          customerLabel,
          industry: selectedService?.industryName || undefined,
          summary: selectedService?.serviceSummary || undefined,
          visualEligible: selectedService?.visualEligible !== false,
        },
        scope: {
          items: scopeItems,
          otherText: state.otherScope || "",
          mode: "multi",
        },
        budget: {
          amount: state.budget,
          bandId: state.budgetBandId,
          currency: "USD",
          source: state.budgetSource,
          confidence: state.budgetBounds?.confidence ?? 0.5,
        },
        start: {
          path: state.startPath,
          photo: state.photoDataUrl
            ? { url: state.photoDataUrl, analysis: state.photoAnalysis }
            : null,
        },
        taste: {
          tags: state.tasteTags.map((t) => ({
            id: t.id,
            label: t.label,
            attributePath: t.attributePath,
            imageUrl: t.imageUrl,
            focalX: t.focalX,
            focalY: t.focalY,
            selected: state.selectedTasteTagIds.includes(t.id),
          })),
          confirmedIds: state.selectedTasteTagIds,
        },
        selection: {
          inspirationIds: favoriteUrls,
          ideaId: state.explorationFocusId,
          ideaUrl:
            state.explorations.find((img) => img.id === state.explorationFocusId)?.url
            || state.workspaceHistory[state.workspaceHistoryIndex]
            || null,
          history: state.workspaceHistory,
        },
        estimate: state.estimate,
        lead: {
          email: state.email || null,
          phone: state.phone || null,
          intent: state.connectIntent,
        },
        refineNote: state.refineNote,
        priceImpact: state.priceImpact,
      };
      return {
        instanceId,
        project,
        serviceId: state.serviceId,
        serviceLabel: businessLabel,
        customerServiceLabel: customerLabel,
        industry: selectedService?.industryName || null,
        serviceSummary: selectedService?.serviceSummary || null,
        visualEligible: selectedService?.visualEligible !== false,
        scope: scopeJoined,
        scopes: state.scopes,
        scopeKeys: state.scopes,
        scopeOther: state.otherScope || null,
        otherScope: state.otherScope || null,
        budget: state.budget,
        budgetBandId: state.budgetBandId,
        budgetSource: state.budgetSource,
        startPath: state.startPath,
        start: project.start,
        photoUrl: state.photoDataUrl,
        photoAnalysis: state.photoAnalysis,
        favoriteUrls,
        taste: project.taste,
        selection: project.selection,
        refineNote: state.refineNote,
        priceImpact: state.priceImpact,
        lead: project.lead,
        ...overrides,
      };
    },
    [
      instanceId,
      selectedService?.businessLabel,
      selectedService?.customerLabel,
      selectedService?.industryName,
      selectedService?.label,
      selectedService?.serviceName,
      selectedService?.serviceSummary,
      selectedService?.visualEligible,
      state.budget,
      state.budgetBandId,
      state.budgetBounds?.confidence,
      state.budgetSource,
      state.connectIntent,
      state.email,
      state.estimate,
      state.explorationFocusId,
      state.explorations,
      state.favorites,
      state.inspiration,
      state.otherScope,
      state.phone,
      state.photoAnalysis,
      state.photoDataUrl,
      state.priceImpact,
      state.refineNote,
      state.scopes,
      state.selectedTasteTagIds,
      state.serviceId,
      state.startPath,
      state.tasteTags,
      state.workspaceHistory,
      state.workspaceHistoryIndex,
    ]
  );

  /** Curated library imagery — hard-filtered by selected scopes when set. */
  const libraryImages = useMemo(() => {
    const options = selectedService?.styleOptions || [];
    const fromCatalog = options
      .map((opt) => {
        const url = String(opt?.imageUrl || "").trim();
        if (!/^https?:\/\//i.test(url)) return null;
        const scope = String((opt as any)?.scope || "").trim() || null;
        const scopeKey =
          String((opt as any)?.scopeKey || "").trim() ||
          (scope ? v2ScopeStarterKey(scope) : "") ||
          null;
        const timesShown = Number((opt as any)?.timesShown || (opt as any)?.adventure_stats?.shown || 0) || undefined;
        const timesSelected =
          Number((opt as any)?.timesSelected || (opt as any)?.adventure_stats?.selected || 0) || undefined;
        const timesSaved = Number((opt as any)?.timesSaved || (opt as any)?.adventure_stats?.saved || 0) || undefined;
        const conversions =
          Number((opt as any)?.conversions || (opt as any)?.adventure_stats?.conversions || 0) || undefined;
        const performanceCue = performanceCueFromStats({
          timesShown,
          timesSelected,
          timesSaved,
          conversions,
        });
        return {
          url,
          label: String(opt?.label || "").trim(),
          description: opt?.description ?? scope,
          priceTier: opt?.priceTier ?? null,
          featuredRank: opt?.featuredRank ?? null,
          imageId: (opt as any)?.imageId ?? null,
          scope,
          scopeKey,
          generatedFor: String((opt as any)?.generatedFor || "").trim() || null,
          tags: scope ? [scope, ...(scopeKey ? [scopeKey] : [])] : undefined,
          timesShown,
          timesSelected,
          timesSaved,
          conversions,
          performanceCue,
          cue: performanceCue,
        };
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item));

    if (fromCatalog.length > 0) {
      return filterLibraryByScopes(fromCatalog, state.scopes);
    }

    // Empty business catalog → still retrieve, using the deterministic trade pool.
    return fallbackLibraryFor(
      selectedService?.label || "Project",
      state.scopes.join(" ") || "",
      state.budget
    );
  }, [selectedService?.label, selectedService?.styleOptions, state.budget, state.scopes]);

  /** Fetch AI/service+scope budget bands when entering the budget step. Instance overrides win. */
  const refreshBudgetBands = useCallback(async () => {
    const override = instanceBudgetOverride(instance);
    const live = await callAdventurePipeline("budget_bands", designPayload());
    if (override) {
      const step = override.step || (override.max <= 20000 ? 500 : override.max <= 60000 ? 1000 : 2500);
      const next: V7BudgetBounds = {
        min: override.min,
        max: override.max,
        step,
        defaultAmount: Math.round((override.min + override.max) / 2 / step) * step,
        bands: Array.isArray(live?.bands) ? live.bands : [],
        source: "business",
        confidence: 0.85,
        scopeMultiplier: Number(live?.scopeMultiplier) || undefined,
      };
      setState((prev) => ({
        ...prev,
        budgetBounds: next,
        budget: Math.min(next.max, Math.max(next.min, prev.budget || next.defaultAmount || next.min)),
        budgetSource: "business",
      }));
      return;
    }
    if (!live || typeof live.min !== "number" || typeof live.max !== "number") return;
    const next: V7BudgetBounds = {
      min: Number(live.min),
      max: Number(live.max),
      step: Number(live.step) || 1000,
      defaultAmount: Number(live.defaultAmount) || undefined,
      bands: Array.isArray(live.bands) ? live.bands : [],
      source: String(live.source || "ai"),
      confidence: Number(live.confidence) || 0.5,
      scopeMultiplier: Number(live.scopeMultiplier) || undefined,
    };
    const mid = next.defaultAmount || Math.round((next.min + next.max) / 2 / next.step) * next.step;
    setState((prev) => ({
      ...prev,
      budgetBounds: next,
      budget: Math.min(next.max, Math.max(next.min, prev.budget || mid)),
      budgetSource: "ai" as V7BudgetSource,
    }));
  }, [designPayload, instance]);

  const reportCuration = useCallback(
    (live: Record<string, any> | null, opts?: { selectedUrl?: string; writeBack?: boolean }) => {
      if (!live?.curation) return;
      lastCurationRef.current = live;
      const events = Array.isArray(live.curation.events) ? [...live.curation.events] : [];
      if (opts?.selectedUrl) {
        events.push({
          type: "selected",
          url: opts.selectedUrl,
          source: "generated",
          mode: String(live.mode || ""),
        });
      }
      const candidates =
        opts?.writeBack && Array.isArray(live.curation.candidates)
          ? live.curation.candidates.filter(
              (c: any) => !opts.selectedUrl || String(c?.url || "") === opts.selectedUrl
            )
          : [];
      void curateAdventureImages(instanceId, {
        events,
        candidates,
        writeBack: Boolean(opts?.writeBack && candidates.length),
      });
    },
    [instanceId]
  );

  /** Pricing engine owns the number; we only ask it to re-run. */
  const refreshEstimate = useCallback(
    async (overrides?: Partial<V7DesignPayload>) => {
      const live = await callAdventurePipeline("estimate", designPayload(overrides));
      const estimate = live?.estimate;
      const min = Number(estimate?.rangeLow || 0);
      const max = Number(estimate?.rangeHigh || 0);
      if (!min || !max) return;
      const levers = (raw: unknown): V7PriceLever[] =>
        Array.isArray(raw)
          ? raw
              .map((l: any) => ({
                label: String(l?.label || ""),
                delta: String(l?.delta || l?.label || ""),
                amount: Number(l?.amount || 0),
              }))
              .filter((l) => l.label && l.amount > 0)
          : [];
      const next: V7Estimate = {
        min,
        max,
        source: String(estimate?.source || "pricing_engine"),
        savingsLevers: levers(estimate?.savingsLevers),
        upgradeLevers: levers(estimate?.upgradeLevers),
      };
      setState((prev) => ({ ...prev, estimate: next }));
    },
    [designPayload]
  );

  const makeInspiration = useCallback(async () => {
    const serviceLabel = selectedService?.label || "Project";
    const scope = state.scopes.join(", ") || "General";
    const locality = localityFromInstance(instance);
    patch({
      generating: true,
      generatingLabel: "Finding looks…",
      stage: "inspiration",
      inspiration: [],
      favorites: [],
    });

    const toTiles = (
      rows: Array<{
        id?: string;
        url?: string;
        label?: string;
        source?: string;
        cue?: string | null;
        priceTier?: string | null;
        performanceCue?: string | null;
        scopeKey?: string | null;
        styleLabel?: string | null;
      }>,
      prefix: string
    ): V7GeneratedImage[] =>
      rows
        .filter((img) => Boolean(img?.url))
        .map((img, i) => {
          const label = String(img.label || img.styleLabel || `${scope} look ${i + 1}`);
          const performanceCue = img.performanceCue || null;
          const priceTier = img.priceTier || null;
          return {
            id: String(img.id || `${prefix}-${i + 1}`),
            label,
            styleLabel: img.styleLabel || label,
            url: String(img.url),
            source: (img.source === "library" || img.source === "generated" || img.source === "fallback"
              ? img.source
              : "library") as V7GeneratedImage["source"],
            priceTier,
            performanceCue,
            scopeKey: img.scopeKey || null,
            cue: inspirationCardCue({
              cue: img.cue,
              performanceCue,
              priceTier,
              label,
              source: img.source,
            }),
          };
        });

    // 1) Stored library first — large retrieve board (no wait for generation).
    const libLive = await callAdventurePipeline("library", designPayload(), {
      limit: INSPIRATION_TARGET,
      libraryImages,
    });
    let tiles = toTiles(
      Array.isArray(libLive?.images) ? libLive.images : [],
      "lib"
    );

    if (tiles.length < 8 && libraryImages.length > 0) {
      tiles = toTiles(
        libraryImages.slice(0, INSPIRATION_TARGET).map((img, i) => ({
          id: `catalog-${i + 1}`,
          url: img.url,
          label: img.label || `${scope} look ${i + 1}`,
          styleLabel: img.label || null,
          priceTier: img.priceTier ?? null,
          performanceCue: (img as any).performanceCue ?? null,
          scopeKey: (img as any).scopeKey ?? null,
          source: "library",
          cue: (img as any).cue ?? null,
        })),
        "catalog"
      );
    }

    if (state.photoDataUrl && !tiles.some((t) => t.url === state.photoDataUrl)) {
      tiles = [
        {
          id: "photo-0",
          url: state.photoDataUrl,
          label: "Your space",
          styleLabel: "Your space",
          source: "library",
          cue: "Your photo",
        },
        ...tiles,
      ];
    }

    const cues = localCuesForGrid({
      count: Math.max(tiles.length, 8),
      seed: `${instanceId}-${serviceLabel}-${scope}-insp`,
      scope,
      budget: state.budget,
      locality,
    });
    tiles = tiles.slice(0, INSPIRATION_TARGET).map((img, i) => ({
      ...img,
      cue:
        inspirationCardCue(img) ||
        (img.source === "library" ? cues[i] : "New for you") ||
        null,
    }));

    if (tiles.length > 0) {
      patch({
        inspiration: tiles,
        favorites: [],
        generating: tiles.length < 12,
        generatingLabel: tiles.length < 12 ? "Adding a few more looks…" : "",
        stage: "inspiration",
      });
      reportCuration(libLive);
    }

    // 2) Generate only to fill gaps when library is thin.
    if (tiles.length < 12) {
      const need = Math.min(12, 12 - tiles.length);
      const genLive = await callAdventurePipeline(
        "inspiration",
        designPayload({ startPath: state.startPath || "inspiration" }),
        { numOutputs: need, libraryImages: [] }
      );
      const generated = toTiles(
        Array.isArray(genLive?.images) ? genLive.images : [],
        "gen"
      ).map((img, i) => ({ ...img, source: "generated" as const, cue: "New for you" }));
      const seen = new Set(tiles.map((t) => t.url));
      const merged = [...tiles, ...generated.filter((g) => !seen.has(g.url))].slice(
        0,
        INSPIRATION_TARGET
      );
      if (merged.length > 0) {
        patch({
          inspiration: merged,
          favorites: [],
          generating: false,
          generatingLabel: "",
          stage: "inspiration",
        });
        reportCuration(genLive);
        return;
      }
    }

    if (tiles.length > 0) {
      patch({ generating: false, generatingLabel: "" });
      return;
    }

    // Offline last resort
    await wait(600);
    const fallback: V7GeneratedImage[] = Array.from({ length: 8 }, (_, i) => ({
      id: `insp-${i + 1}`,
      label: `${scope} look ${i + 1}`,
      url:
        state.photoDataUrl && i === 0
          ? state.photoDataUrl
          : placeholderUrl(`${instanceId}-${serviceLabel}-${scope}-insp-${i}`),
      cue: cues[i],
      source: "fallback",
    }));
    patch({
      inspiration: fallback,
      favorites: [],
      generating: false,
      generatingLabel: "",
      stage: "inspiration",
    });
  }, [
    designPayload,
    instance,
    instanceId,
    libraryImages,
    patch,
    reportCuration,
    selectedService?.label,
    state.budget,
    state.photoDataUrl,
    state.scopes,
    state.startPath,
  ]);

  const makeExploration = useCallback(async (opts?: { regen?: boolean }) => {
    const regen = Boolean(opts?.regen);
    if (regen && state.explorationRegenRemaining <= 0) return;
    const serviceLabel = selectedService?.label || "Project";
    const scope = state.scopes.join(", ") || "General";
    const stamp = Date.now();
    const target = EXPLORATION_TARGET;

    patch({
      generating: true,
      generatingLabel: `Shaping ideas… (0/${target})`,
      stage: "exploration",
      explorations: [],
      explorationFocusId: null,
      explorationPicks: [],
      workspaceHistory: [],
      workspaceHistoryIndex: 0,
      priceImpact: 0,
      refineNote: null,
      finalOptions: [],
      selectedFinalId: null,
      explorationRegenRemaining: regen
        ? Math.max(0, state.explorationRegenRemaining - 1)
        : EXPLORATION_REGEN_LIMIT,
    });

    const seen = new Set<string>();
    const appendTiles = (rows: V7GeneratedImage[]) => {
      setState((prev) => {
        const next = [...prev.explorations];
        for (const row of rows) {
          if (!row.url || seen.has(row.url)) continue;
          seen.add(row.url);
          next.push(row);
        }
        const count = next.length;
        return {
          ...prev,
          explorations: next.slice(0, target + 3),
          generating: count < target,
          generatingLabel:
            count < target ? `Shaping ideas… (${count}/${target})` : "",
        };
      });
    };

    // Reuse strong library matches immediately (do not wait for generation).
    const libLive = await callAdventurePipeline(
      "library",
      designPayload({ refineNote: null, priceImpact: 0 }),
      { limit: Math.min(4, Math.floor(target / 3)), libraryImages }
    );
    if (Array.isArray(libLive?.images) && libLive.images.length) {
      appendTiles(
        libLive.images
          .filter((img: any) => img?.url)
          .map((img: any, i: number) => ({
            id: String(img.id || `exp-lib-${stamp}-${i + 1}`),
            label: String(img.label || `Idea ${i + 1}`),
            url: String(img.url),
            source: "library" as const,
            cue: "From library",
          }))
      );
      reportCuration(libLive);
    }

    // Generate remaining tiles in parallel; each appears as it finishes.
    const axes = [
      "wide establishing view, bright daylight",
      "closer three-quarter view, warm light",
      "cooler daylight, calmer palette",
      "evening light, layered lighting",
      "texture-forward composition",
      "simpler surfaces, more restraint",
      "more open composition",
      "material-forward composition",
      "softer diffuse light",
      "richer material contrast",
      "quieter minimal styling",
      "bolder focal material moment",
    ];
    const genCount = Math.max(0, target - seen.size);
    const jobs = Array.from({ length: genCount }, (_, i) => i);

    await Promise.all(
      jobs.map(async (i) => {
        const live = await callAdventurePipeline(
          "ideas",
          designPayload({ refineNote: null, priceImpact: 0 }),
          {
            numOutputs: 1,
            libraryImages: [],
            instruction: `Variation ${i + 1}: ${axes[i % axes.length]}.`,
          }
        );
        const first = Array.isArray(live?.images) ? live?.images[0] : null;
        const url = first ? String(first.url || "") : "";
        if (!url) return;
        appendTiles([
          {
            id: `exp-gen-${stamp}-${i + 1}`,
            label: String(first?.label || `Idea ${i + 1}`),
            url,
            source: "generated",
          },
        ]);
        if (live) reportCuration(live);
      })
    );

    setState((prev) => {
      if (prev.explorations.length > 0) {
        return { ...prev, generating: false, generatingLabel: "" };
      }
      // Offline fallback if everything failed
      const images: V7GeneratedImage[] = Array.from({ length: 9 }, (_, i) => ({
        id: `exp-${stamp}-${i + 1}`,
        label: `Idea ${i + 1}`,
        url: placeholderUrl(`${instanceId}-${serviceLabel}-${scope}-exp-${stamp}-${i}`),
        source: "fallback",
      }));
      return {
        ...prev,
        explorations: images,
        generating: false,
        generatingLabel: "",
      };
    });
  }, [
    designPayload,
    instanceId,
    libraryImages,
    patch,
    reportCuration,
    selectedService?.label,
    state.explorationRegenRemaining,
    state.scopes,
  ]);

  const onSelectService = (serviceId: string) => {
    const service = services.find((s) => s.value === serviceId) || null;
    const bands = budgetBandsForService(service);
    const mid = bands.find((b) => b.min != null && b.max != null);
    setScopeOptionsOverride(null);
    setScopeCoverOverrides({});
    scopeEnrichKeyRef.current = "";
    patch({
      serviceId,
      scopes: [],
      otherScope: "",
      budgetBounds: null,
      budget: mid ? Math.round(((mid.min || 0) + (mid.max || mid.min || 25000)) / 2) : 25000,
      stage: "project",
    });
  };

  /** Focus: generate real covers for every part without a catalog/starter match. */
  useEffect(() => {
    if (state.stage !== "project" || !selectedService) return;
    const enrichKey = `${selectedService.value}:${storedScopeOptions.join("|")}`;
    if (scopeEnrichKeyRef.current === enrichKey) return;
    scopeEnrichKeyRef.current = enrichKey;

    let cancelled = false;
    const mergeCovers = (covers: Record<string, any>) => {
      setScopeCoverOverrides((prev) => {
        const next = { ...prev };
        for (const [label, meta] of Object.entries(covers)) {
          const url = String(meta?.imageUrl || "").trim();
          if (!/^https?:\/\//i.test(url)) continue;
          next[v2ScopeStarterKey(label)] = { imageUrl: url };
          next[label] = { imageUrl: url };
        }
        return next;
      });
    };

    const run = async () => {
      setScopeEnriching(true);
      try {
        const withoutOther = storedScopeOptions.filter((s) => !isOtherPart(s));
        let nextScopes = storedScopeOptions;
        if (withoutOther.length < 10) {
          const live = await callAdventurePipeline("suggest_scopes", designPayload(), {
            existingScopes: withoutOther,
            components: selectedService.subcategoryComponents || [],
            minScopeCount: 12,
            maxScopeCount: 18,
          });
          if (!cancelled && Array.isArray(live?.scopes) && live.scopes.length >= 10) {
            nextScopes = ensureOtherScope(live.scopes.map((s: unknown) => String(s)));
            setScopeOptionsOverride(nextScopes);
          }
        }

        const missing = partsMissingCovers(selectedService, nextScopes, null);
        // Generate in small parallel waves so chips fill in progressively.
        for (let i = 0; i < missing.length && !cancelled; i += 3) {
          const wave = missing.slice(i, i + 3);
          await Promise.all(
            wave.map(async (part) => {
              if (cancelled) return;
              const live = await callAdventurePipeline("scope_covers", designPayload(), {
                missingScopes: [part],
              });
              const covers = live?.covers && typeof live.covers === "object" ? live.covers : {};
              if (!cancelled && Object.keys(covers).length > 0) {
                mergeCovers(covers as Record<string, any>);
              }
            })
          );
        }
      } finally {
        if (!cancelled) setScopeEnriching(false);
      }
    };
    void run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per service/part catalog
  }, [state.stage, selectedService?.value, storedScopeOptions.join("|")]);

  const toggleScope = (scope: string) => {
    // Multi-select checklist of parts to include.
    const isOtherChip = isOtherPart(scope);
    setState((prev) => {
      const has = prev.scopes.includes(scope);
      if (has) {
        return {
          ...prev,
          scopes: prev.scopes.filter((s) => s !== scope && s !== fullLabel),
          otherScope: isOtherChip ? "" : prev.otherScope,
        };
      }
      let next = [...prev.scopes.filter((s) => s !== fullLabel), scope];
      const partsOn = scopeParts.every((p) => next.includes(p));
      if (partsOn && !next.includes(fullLabel)) next = [...next, fullLabel];
      return { ...prev, scopes: next };
    });
  };

  const toggleFullRenovation = () => {
    setState((prev) => {
      const parts = scopeParts;
      const allOn = parts.length > 0 && parts.every((p) => prev.scopes.includes(p));
      if (allOn) {
        // Clear parts but keep Other + free text if present.
        return {
          ...prev,
          scopes: prev.scopes.filter((s) => isOtherPart(s)),
        };
      }
      const kept = prev.scopes.filter((s) => isOtherPart(s));
      return { ...prev, scopes: [...parts, ...kept, fullLabel] };
    });
  };

  const goToBudget = () => {
    go("budget");
    void refreshBudgetBands();
  };

  const toggleFavorite = (id: string) => {
    setState((prev) => {
      if (prev.favorites.includes(id)) {
        return { ...prev, favorites: prev.favorites.filter((f) => f !== id) };
      }
      if (prev.favorites.length >= INSPIRATION_FAVORITES_MAX) return prev;
      return { ...prev, favorites: [...prev.favorites, id] };
    });
  };

  const focusExploration = (id: string) => {
    const img = state.explorations.find((item) => item.id === id);
    const url = img?.url || "";
    patch({
      explorationFocusId: id,
      explorationPicks: [id],
      workspaceHistory: url ? [url] : [],
      workspaceHistoryIndex: 0,
      priceImpact: 0,
      refineNote: null,
      estimate: null,
      emailFormOpen: false,
      finalOptions: [],
      selectedFinalId: null,
    });
    void refreshEstimate({ selectedIdeaUrl: url || null, refineNote: null, priceImpact: 0 });
    // Selecting a generated idea writes it into the library for future retrieval.
    if (url && lastCurationRef.current) {
      reportCuration(lastCurationRef.current, { selectedUrl: url, writeBack: true });
    }
  };

  const focusedExploration = useMemo(
    () => state.explorations.find((img) => img.id === state.explorationFocusId) || null,
    [state.explorationFocusId, state.explorations]
  );

  const focusedIdeaEstimate = useMemo(() => {
    if (!focusedExploration) return null;
    return estimateForIdea(state.budget, focusedExploration.id, state.refineNote, state.priceImpact);
  }, [focusedExploration, state.budget, state.priceImpact, state.refineNote]);

  const runWorkspaceAdjust = async (action: string) => {
    const focus = focusedExploration;
    if (!focus) return;
    const serviceLabel = selectedService?.label || "Project";
    const scope = state.scopes.join(", ") || "General";
    const guessedImpact = clampImpact(state.priceImpact + priceImpactForAction(action));
    patch({
      generating: true,
      generatingLabel: "Updating your design…",
      refineNote: action,
      emailFormOpen: false,
    });

    const live = await callAdventurePipeline(
      "refine",
      designPayload({ selectedIdeaUrl: focus.url, refineNote: action, priceImpact: guessedImpact }),
      { instruction: action, numOutputs: 1, libraryImages }
    );
    const liveUrl = Array.isArray(live?.images) ? String(live.images[0]?.url || "") : "";
    const newUrl =
      liveUrl ||
      placeholderUrl(`${instanceId}-${serviceLabel}-${scope}-adj-${action}-${Date.now()}`);

    // The interpreter's cost direction beats our keyword guess when it ran.
    const interpreted = Number(live?.modification?.budgetDeltaPct);
    const nextImpact = Number.isFinite(interpreted)
      ? clampImpact(state.priceImpact + interpreted)
      : guessedImpact;

    if (!liveUrl) await wait(900);

    setState((prev) => ({
      ...prev,
      workspaceHistory: [...prev.workspaceHistory, newUrl],
      workspaceHistoryIndex: prev.workspaceHistory.length,
      priceImpact: nextImpact,
      refineNote: action,
      explorations: prev.explorations.map((img) =>
        img.id === focus.id ? { ...img, url: newUrl } : img
      ),
      generating: false,
      generatingLabel: "",
    }));

    void refreshEstimate({ selectedIdeaUrl: newUrl, refineNote: action, priceImpact: nextImpact });
    if (liveUrl) {
      reportCuration(live, { selectedUrl: liveUrl, writeBack: true });
    }
  };

  const beginTasteSummary = useCallback(async () => {
    if (state.favorites.length < INSPIRATION_FAVORITES_MIN) return;
    const favoriteImages = state.favorites
      .map((id) => state.inspiration.find((img) => img.id === id))
      .filter((img): img is V7GeneratedImage => Boolean(img));
    patch({
      stage: "review",
      tasteTags: [],
      selectedTasteTagIds: [],
      generating: true,
      generatingLabel: "Reading what you like…",
    });

    const live = await callAdventurePipeline(
      "taste",
      designPayload({ favoriteUrls: favoriteImages.map((img) => img.url) })
    );

    const liveTagsRaw = live?.taste?.tags;
    if (Array.isArray(liveTagsRaw) && liveTagsRaw.length >= 4) {
      const tags: V7TasteTag[] = liveTagsRaw.map((t: any, i: number) => ({
        id: String(t.id || `taste-${i + 1}`),
        label: String(t.label || `Look ${i + 1}`),
        imageUrl: String(t.imageUrl || favoriteImages[i % favoriteImages.length]?.url || ""),
        focalX: Number(t.focalX ?? 50),
        focalY: Number(t.focalY ?? 50),
        attributePath: t.attributePath ? String(t.attributePath) : undefined,
      }));
      const preselected = Array.isArray(live?.taste?.confirmedIds)
        ? live.taste.confirmedIds.map(String)
        : tags.slice(0, Math.min(5, tags.length)).map((tag) => tag.id);
      patch({
        tasteTags: tags,
        selectedTasteTagIds: preselected,
        generating: false,
        generatingLabel: "",
      });
      return;
    }

    await wait(1000);
    const tags = buildTasteTags(
      selectedService?.label || "Project",
      state.scopes.join(", ") || "",
      favoriteImages
    );
    const preselected = tags.slice(0, Math.min(5, tags.length)).map((tag) => tag.id);
    patch({
      tasteTags: tags,
      selectedTasteTagIds: preselected,
      generating: false,
      generatingLabel: "",
    });
  }, [
    designPayload,
    patch,
    selectedService?.label,
    state.favorites,
    state.inspiration,
    state.scopes,
  ]);

  const toggleTasteTag = (tagId: string) => {
    setState((prev) => {
      const has = prev.selectedTasteTagIds.includes(tagId);
      return {
        ...prev,
        selectedTasteTagIds: has
          ? prev.selectedTasteTagIds.filter((id) => id !== tagId)
          : [...prev.selectedTasteTagIds, tagId],
      };
    });
  };

  const confirmTasteSummary = async () => {
    if (state.selectedTasteTagIds.length === 0) return;
    const confirmed = state.tasteTags.filter((t) => state.selectedTasteTagIds.includes(t.id));
    const payload = designPayload();
    void curateAdventureImages(instanceId, {
      preferences: {
        confirmedIds: state.selectedTasteTagIds,
        tags: confirmed.map((t) => ({
          id: t.id,
          label: t.label,
          attributePath: t.attributePath,
        })),
        favoriteUrls: payload.favoriteUrls || [],
        serviceId: state.serviceId,
        scopes: state.scopes,
        budget: state.budget,
        step: "review",
      },
      project: payload.project as Record<string, unknown> | undefined,
    });
    await makeExploration();
  };

  const onPickPath = async (path: V7StartPath) => {
    patch({ startPath: path });
    if (path === "photo") {
      uploadRef.current?.click();
      return;
    }
    await makeInspiration();
  };

  const onPhotoSelected = async (file: File | null) => {
    if (!file) return;
    patch({
      generating: true,
      generatingLabel: "Uploading your photo…",
      startPath: "photo",
      photoAnalysis: null,
    });
    try {
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Unable to read that image."));
        reader.readAsDataURL(file);
      });

      // Persist to Supabase so vision + later steps get a fetchable URL.
      let publicUrl = dataUrl;
      try {
        const sessionId =
          typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `v7-${Date.now()}`;
        const uploadRes = await fetch(`/api/v2/assets/${encodeURIComponent(instanceId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId, kind: "scene", image: dataUrl }),
        });
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (uploadRes.ok && uploadData?.asset?.url) {
          publicUrl = String(uploadData.asset.url);
        }
      } catch {
        // Keep data URL locally if upload fails; analysis may skip it.
      }

      patch({ photoDataUrl: publicUrl, startPath: "photo" });
      patch({ generatingLabel: "Reading your space…" });
      const analysisLive = await callAdventurePipeline(
        "analyze_photo",
        designPayload({ photoUrl: publicUrl, startPath: "photo" })
      );
      if (analysisLive?.analysis && typeof analysisLive.analysis === "object") {
        patch({ photoAnalysis: analysisLive.analysis as V7PhotoAnalysis });
      }
      await makeInspiration();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to use that photo.");
      patch({ generating: false, generatingLabel: "" });
    }
  };

  const commitDirection = () => {
    go("connect");
  };

  const captureEmail = async () => {
    const email = state.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email to continue.");
      return;
    }
    setError(null);
    patch({
      emailCaptured: true,
      pricingUnlocked: true,
      emailFormOpen: false,
    });
  };

  const sendChat = async (preset?: string) => {
    const text = (preset ?? state.chatInput).trim();
    if (!text) return;
    patch({ chatInput: "", chatLog: [...state.chatLog, { role: "user", text }] });

    const live = await callAdventurePipeline(
      "consult",
      designPayload({ selectedIdeaUrl: workspaceHeroUrl }),
      { question: text }
    );

    if (live?.reply) {
      setState((prev) => ({ ...prev, chatLog: [...prev.chatLog, { role: "ai", text: String(live.reply) }] }));
      if (live.action === "modify") {
        void runWorkspaceAdjust(String(live.instruction || text));
      }
      return;
    }

    // Offline: keep the two behaviors the visitor expects — change the design, or answer with the range.
    if (/make|change|add|remove|darker|lighter|modern|warmer|spend|afford|less|more|replace|swap|try/i.test(text)) {
      void runWorkspaceAdjust(text);
      return;
    }
    const reply = /under|save|cheap|budget|cost|price|quote/i.test(text)
      ? `This design is tracking around ${formatMoney(workspacePrice?.min || state.budget)}–${formatMoney(workspacePrice?.max || state.budget)}. Email yourself the estimate for the exact range.`
      : `Noted. I’ll use that as guidance for your ${state.scopes.join(", ") || "project"} direction.`;
    setState((prev) => ({ ...prev, chatLog: [...prev.chatLog, { role: "ai", text: reply }] }));
  };

  const workspaceHeroUrl = useMemo(() => {
    if (state.workspaceHistory.length > 0) {
      const idx = Math.min(
        Math.max(0, state.workspaceHistoryIndex),
        state.workspaceHistory.length - 1
      );
      return state.workspaceHistory[idx] || focusedExploration?.url || null;
    }
    return focusedExploration?.url || null;
  }, [
    focusedExploration,
    state.workspaceHistory,
    state.workspaceHistoryIndex,
  ]);

  // Pricing engine when we can reach it; local band only so the UI never blanks out.
  const workspacePrice = useMemo(
    () => (state.estimate ? { min: state.estimate.min, max: state.estimate.max } : focusedIdeaEstimate),
    [focusedIdeaEstimate, state.estimate]
  );

  const inWorkspace = state.stage === "exploration" && Boolean(focusedExploration);

  const brandName = design.brand_name || instance?.name || "Adventure";
  const locality = localityFromInstance(instance);
  // Progressive boards (inspiration / exploration grid) stay visible while tiles stream in.
  const progressiveBoard =
    (state.stage === "inspiration" && state.inspiration.length > 0) ||
    (state.stage === "exploration" && !state.explorationFocusId && state.explorations.length > 0);
  const showLoader = state.stage === "loading" || (state.generating && !progressiveBoard);

  return (
    <div className={css.root} data-adventure-version="v7">
      <BrandHeader config={design} compact />
      {state.stage !== "loading" && (
        <div className={css.top}>
          <button type="button" className={css.back} onClick={goBack} disabled={state.stage === "service" && services.length !== 1}>
            ← Back
          </button>
          <div className={css.progress}>{progressLabel(state.stage)}</div>
        </div>
      )}

      <main className={`${css.main} ${inWorkspace && !showLoader ? `${css.mainWide} ${css.mainFill}` : ""}`}>
        {showLoader ? (
          <LoadingState label={state.generatingLabel || "One moment…"} />
        ) : (
          <>
        {state.stage === "service" && (
          <div className={css.stage}>
            <div className={css.stageBody}>
              <h1 className={css.prompt}>What would you like to design today?</h1>
              <p className={css.sub}>Just pick what you&apos;re dreaming up — we&apos;ll keep it simple.</p>
              <div className={css.grid}>
                {services.map((service) => {
                  const cover = catalogCoverUrl(service, `service-${service.value}`);
                  return (
                    <button
                      key={service.value}
                      type="button"
                      className={`${css.card} ${cover ? "" : css.cardTextOnly} ${state.serviceId === service.value ? css.cardSelected : ""}`}
                      onClick={() => onSelectService(service.value)}
                    >
                      {cover ? (
                        <img className={css.cardImg} src={cover} alt="" />
                      ) : null}
                      <div className={css.cardLabel}>{service.label}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {state.stage === "project" && (
          <div className={css.stage}>
            <div className={css.stageBody}>
              <h1 className={css.prompt}>What&apos;s included?</h1>
              <div className={css.scopeHeaderRow}>
                <p className={css.sub}>
                  Tap the parts you want in your {selectedService?.label?.toLowerCase() || "project"}.
                  {" "}
                  <span className={css.localCount}>
                    {state.scopes.filter((s) => s !== fullLabel).length === 0
                      ? "None yet"
                      : `${state.scopes.filter((s) => s !== fullLabel).length} selected`}
                  </span>
                </p>
                <button
                  type="button"
                  aria-pressed={allPartsSelected}
                  className={`${css.scopeSelectAllChip} ${allPartsSelected ? css.scopeSelectAllChipOn : ""}`}
                  onClick={() => toggleFullRenovation()}
                >
                  {allPartsSelected ? "✓ " : ""}
                  {allPartsSelected ? "All selected" : "Select all"}
                </button>
              </div>
              <div className={css.scopeGrid}>
                {scopeOptions.map((scope) => {
                  const selected = state.scopes.includes(scope) || (allPartsSelected && !isOtherPart(scope));
                  const cover = partCoverByLabel[scope] || null;
                  return (
                    <button
                      key={scope}
                      type="button"
                      aria-pressed={selected}
                      className={`${css.card} ${css.scopeCard} ${cover ? "" : css.cardTextOnly} ${selected ? css.cardSelected : ""}`}
                      onClick={() => toggleScope(scope)}
                    >
                      {cover ? <img className={css.cardImg} src={cover} alt="" loading="lazy" /> : null}
                      <div className={css.cardLabel}>
                        {selected ? <span className={css.scopeCheck} aria-hidden>✓</span> : null}
                        {scope}
                      </div>
                    </button>
                  );
                })}
              </div>
              {scopeEnriching ? (
                <p className={css.scopeHint}>Generating photos for parts without catalog images…</p>
              ) : null}
              {state.scopes.some((s) => isOtherPart(s)) && (
                <input
                  className={css.field}
                  style={{ marginTop: 12 }}
                  placeholder="Tell us briefly what else you need included"
                  value={state.otherScope}
                  onChange={(e) => patch({ otherScope: e.target.value })}
                />
              )}
            </div>
            <div className={css.footer}>
              <button
                type="button"
                className={css.cta}
                disabled={state.scopes.filter((s) => s !== fullLabel).length === 0}
                onClick={() => goToBudget()}
              >
                Next: budget →
              </button>
            </div>
          </div>
        )}

        {state.stage === "budget" && (
          <div className={css.stage}>
            <div className={css.stageBody}>
              <h1 className={css.prompt}>Roughly, what&apos;s your budget?</h1>
              <p className={css.sub}>
                Based on{" "}
                {state.scopes.includes(fullLabel) || allPartsSelected
                  ? fullLabel.toLowerCase()
                  : state.scopes.filter((s) => s !== fullLabel).length <= 3
                    ? `your ${state.scopes.filter((s) => s !== fullLabel).join(" + ").toLowerCase() || "project"}`
                    : `your ${state.scopes.filter((s) => s !== fullLabel).length} selected parts`}
                {budgetBounds.scopeMultiplier && budgetBounds.scopeMultiplier < 0.95
                  ? " — a tighter scope usually means a lower range"
                  : ""}
                . No perfect number needed.
              </p>
              <div className={css.sliderWrap}>
                <p className={css.budgetValue}>{formatMoney(state.budget)}</p>
                <input
                  className={css.slider}
                  type="range"
                  min={budgetBounds.min}
                  max={budgetBounds.max}
                  step={budgetBounds.step}
                  value={state.budget}
                  onChange={(e) =>
                    patch({ budget: Number(e.target.value), budgetSource: "customer" })
                  }
                />
                <div className={css.hint}>
                  <span>{formatMoney(budgetBounds.min)}</span>
                  <span>{formatMoney(budgetBounds.max)}</span>
                </div>
              </div>
            </div>
            <div className={css.footer}>
              <button type="button" className={css.cta} onClick={() => go("path")}>
                Show me looks around this →
              </button>
            </div>
          </div>
        )}

        {state.stage === "path" && (
          <div className={css.stage}>
            <div className={css.stageBody}>
              <h1 className={css.prompt}>How do you want to start?</h1>
              <p className={css.sub}>You don&apos;t need a photo — inspiration works great on its own.</p>
              <div className={css.pathGrid}>
                <button type="button" className={css.pathCard} onClick={() => void onPickPath("inspiration")}>
                  <strong>Start with inspiration</strong>
                  <span>See looks for your project.</span>
                </button>
                <button type="button" className={css.pathCard} onClick={() => void onPickPath("photo")}>
                  <strong>Use a photo of my space</strong>
                  <span>Upload a photo as the visual foundation.</span>
                </button>
              </div>
              <input
                ref={uploadRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={(e) => void onPhotoSelected(e.target.files?.[0] || null)}
              />
            </div>
          </div>
        )}

        {state.stage === "inspiration" && (
          <div className={css.stage}>
            <div className={css.stageBody}>
              <h1 className={css.prompt}>Let&apos;s find a look you like.</h1>
              <p className={css.sub}>
                {selectedService?.label || "Project"}
                {state.scopes.length ? ` · ${state.scopes.join(" + ")}` : ""}
                {` · around ${formatMoney(state.budget)}`}
              </p>
              <div className={css.localSection}>
                <p className={css.localEyebrow}>
                  {locality.isNamedPlace
                    ? `Popular designs in ${locality.label}`
                    : "Popular designs in your area"}
                </p>
                <p className={css.localHint}>
                  Browse looks for your project — tap {INSPIRATION_FAVORITES_MIN}–{INSPIRATION_FAVORITES_MAX} favorites.
                  {" "}
                  <span className={css.localCount}>
                    {state.favorites.length} of {INSPIRATION_FAVORITES_MAX} selected
                  </span>
                </p>
              </div>
              {state.generating && state.inspiration.length > 0 ? (
                <p className={css.progressNote}>{state.generatingLabel || "Loading more looks…"}</p>
              ) : null}
              <div className={`${css.masonry} ${css.staggerIn}`}>
                {state.inspiration.map((img, index) => {
                  const selected = state.favorites.includes(img.id);
                  return (
                    <button
                      key={img.id}
                      type="button"
                      className={`${css.card} ${css.masonryItem} ${selected ? css.cardSelected : ""}`}
                      style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
                      onClick={() => toggleFavorite(img.id)}
                    >
                      <span className={css.cardMedia}>
                        <img className={css.cardImg} src={img.url} alt={img.label} loading="lazy" />
                        {img.cue ? <span className={css.cardCue}>{img.cue}</span> : null}
                      </span>
                      <span className={css.cardMeta}>
                        <span className={css.cardLabel}>{img.styleLabel || img.label}</span>
                        {img.priceTier ? (
                          <span className={css.cardPriceTier}>{img.priceTier}</span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={css.footer}>
              <button
                type="button"
                className={css.cta}
                disabled={state.favorites.length < INSPIRATION_FAVORITES_MIN}
                onClick={() => void beginTasteSummary()}
              >
                These feel right →
              </button>
            </div>
          </div>
        )}

        {(state.stage === "review" || state.stage === "likes") && state.tasteTags.length > 0 && (
          <div className={css.stage}>
            <div className={css.stageBody}>
              <h1 className={css.prompt}>Here&apos;s what stands out in your picks.</h1>
              <p className={css.sub}>
                Confirm or remove preferences — I&apos;ll use this to shape your exploration.
              </p>
              <div className={css.reviewFavorites}>
                {state.favorites
                  .map((id) => state.inspiration.find((img) => img.id === id))
                  .filter((img): img is V7GeneratedImage => Boolean(img))
                  .map((img) => (
                    <img
                      key={img.id}
                      className={css.reviewFavoriteThumb}
                      src={img.url}
                      alt={img.label}
                    />
                  ))}
              </div>
              <div className={`${css.tasteGrid} ${css.staggerIn}`}>
                {state.tasteTags.map((tag, index) => {
                  const selected = state.selectedTasteTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      className={`${css.tasteCard} ${selected ? css.tasteCardSelected : ""}`}
                      style={{ animationDelay: `${Math.min(index, 7) * 40}ms` }}
                      onClick={() => toggleTasteTag(tag.id)}
                      aria-pressed={selected}
                    >
                      <span className={css.tasteCardMedia}>
                        <img
                          className={css.tasteCardImg}
                          src={tag.imageUrl}
                          alt=""
                          style={{
                            objectPosition: `${tag.focalX}% ${tag.focalY}%`,
                          }}
                        />
                        {selected ? <span className={css.tasteCheck} aria-hidden="true">✓</span> : null}
                      </span>
                      <span className={css.tasteCardLabel}>{tag.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className={css.footer}>
              <button
                type="button"
                className={css.cta}
                disabled={state.selectedTasteTagIds.length === 0}
                onClick={() => void confirmTasteSummary()}
              >
                Got it — show me some ideas →
              </button>
            </div>
          </div>
        )}

        {state.stage === "exploration" && !focusedExploration && (
          <div className={css.stage}>
            <div className={css.stageBody}>
              <h1 className={css.prompt}>Any of these looks interest you?</h1>
              <p className={css.browseHint}>Tap one to refine it — you can come back for another later.</p>
              {state.generating ? (
                <p className={css.progressNote}>
                  {state.generatingLabel || `Shaping ideas… (${state.explorations.length}/${EXPLORATION_TARGET})`}
                </p>
              ) : null}
              <div className={`${css.masonry} ${css.staggerIn}`}>
                {state.explorations.map((img, index) => (
                  <button
                    key={img.id}
                    type="button"
                    className={`${css.card} ${css.masonryItem}`}
                    style={{ animationDelay: `${Math.min(index, 10) * 30}ms` }}
                    onClick={() => focusExploration(img.id)}
                  >
                    <img className={css.cardImg} src={img.url} alt={img.label} loading="lazy" />
                  </button>
                ))}
              </div>
            </div>
            {state.explorationRegenRemaining > 0 && (
              <div className={css.footer}>
                <button
                  type="button"
                  className={css.secondary}
                  disabled={state.generating}
                  onClick={() => void makeExploration({ regen: true })}
                >
                  None of these? Try a fresh set
                  {state.explorationRegenRemaining === 1
                    ? " (1 left)"
                    : ` (${state.explorationRegenRemaining} left)`}
                </button>
              </div>
            )}
          </div>
        )}

        {inWorkspace && workspaceHeroUrl && workspacePrice && (
          <div className={css.workspace}>
            <div className={css.workspaceHead}>
              <div className={css.workspaceHeadText}>
                <h1 className={css.prompt}>Here&apos;s your starting design.</h1>
                <p className={css.workspaceMeta}>
                  {selectedService?.label}
                  {state.scopes.length ? ` · ${state.scopes.join(" + ")}` : ""}
                </p>
              </div>
            </div>

            <div className={css.exploreFocus}>
                <div className={css.heroStage}>
                  <img className={css.heroImgLarge} src={workspaceHeroUrl} alt="Your design" />

                  {state.workspaceHistory.length > 1 && (
                    <div className={css.genStrip} aria-label="Earlier versions">
                      {state.workspaceHistory.map((url, index) => (
                        <button
                          key={`${url}-${index}`}
                          type="button"
                          className={`${css.genThumb} ${index === state.workspaceHistoryIndex ? css.genThumbActive : ""}`}
                          onClick={() => patch({ workspaceHistoryIndex: index })}
                          aria-label={index === 0 ? "Starting version" : `Version ${index + 1}`}
                        >
                          <img src={url} alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <aside className={css.explorePanel}>
                  <div className={css.railBlock}>
                    <p className={css.railSection}>Price</p>
                    <div className={css.priceBlock}>
                      {state.pricingUnlocked ? (
                        <div className={css.priceRows}>
                          <span className={css.priceTeaserLabel}>This design</span>
                          <span className={css.priceLine}>
                            {formatMoney(workspacePrice.min)} – {formatMoney(workspacePrice.max)}
                          </span>
                          <p className={css.trustLine}>
                            Range based on your budget and the look you picked.
                          </p>
                        </div>
                      ) : state.emailFormOpen ? (
                        <div className={css.unlockBox}>
                          <p className={css.trustLine}>
                            We&apos;ll email this estimate. No sales call unless you ask.
                          </p>
                          <input
                            className={css.railInput}
                            type="email"
                            placeholder="you@email.com"
                            value={state.email}
                            onChange={(e) => patch({ email: e.target.value })}
                            autoFocus
                          />
                          {error && <p className={css.error}>{error}</p>}
                          <button type="button" className={css.railPrimary} onClick={() => void captureEmail()}>
                            Email me this estimate →
                          </button>
                          <button
                            type="button"
                            className={css.railLink}
                            onClick={() => {
                              setError(null);
                              patch({ emailFormOpen: false });
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className={css.priceRows}>
                          <span className={css.priceTeaserLabel}>This design</span>
                          <span className={`${css.priceLine} ${css.railPriceLocked}`}>
                            {formatMoney(workspacePrice.min)} – {formatMoney(workspacePrice.max)}
                          </span>
                          <button
                            type="button"
                            className={css.railLink}
                            onClick={() => patch({ emailFormOpen: true })}
                          >
                            Email me this estimate
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={`${css.railBlock} ${css.railBlockGrow}`}>
                    <p className={css.railSection}>Adjust</p>
                    <div className={css.railStack}>
                      {refineActions.map((action) => (
                        <button
                          key={action}
                          type="button"
                          className={css.railBtn}
                          onClick={() => void runWorkspaceAdjust(action)}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className={css.railBlock}>
                    <p className={css.railSection}>Cost</p>
                    <div className={css.priceTilt}>
                      {PRICE_ACTIONS.map((action) => (
                        <button
                          key={action}
                          type="button"
                          className={css.railBtn}
                          onClick={() => void runWorkspaceAdjust(action)}
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                    {state.estimate?.savingsLevers?.length ? (
                      <div className={css.leverList}>
                        {state.estimate.savingsLevers.slice(0, 3).map((lever) => (
                          <button
                            key={lever.label}
                            type="button"
                            className={css.leverBtn}
                            onClick={() => void runWorkspaceAdjust(lever.delta)}
                          >
                            <span className={css.leverLabel}>{lever.label}</span>
                            <span className={css.leverAmount}>save ~{formatMoney(lever.amount)}</span>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>

                  <div className={css.railBlock}>
                    <p className={css.railSection}>Tell us what to change</p>
                    <input
                      className={css.railInput}
                      placeholder="Make the vanity lighter…"
                      value={state.chatInput}
                      onChange={(e) => patch({ chatInput: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void sendChat();
                      }}
                    />
                    {state.chatLog.length > 0 && (
                      <p className={css.railChatLine}>
                        <strong>AI</strong>
                        {state.chatLog.filter((l) => l.role === "ai").slice(-1)[0]?.text}
                      </p>
                    )}
                  </div>

                  <div className={css.railCommit}>
                    <div className={css.railUtils}>
                      <button
                        type="button"
                        className={css.railLink}
                        onClick={() => {
                          patch({
                            chatLog: [
                              ...state.chatLog,
                              { role: "ai", text: "Saved this design to your session." },
                            ],
                          });
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className={css.railLink}
                        onClick={() => {
                          try {
                            void navigator.clipboard?.writeText(window.location.href);
                          } catch {}
                          patch({
                            chatLog: [
                              ...state.chatLog,
                              { role: "ai", text: "Link copied — you can share this project." },
                            ],
                          });
                        }}
                      >
                        Share
                      </button>
                    </div>
                    <button type="button" className={css.railPrimary} onClick={commitDirection}>
                      I want help with this →
                    </button>
                  </div>
                </aside>
              </div>
          </div>
        )}

        {state.stage === "refine" && (
          <div className={css.stage}>
            <h1 className={css.prompt}>Refine the direction</h1>
            <p className={css.sub}>Continuing in your design workspace…</p>
            <div className={css.footer}>
              <button type="button" className={css.cta} onClick={() => go("exploration")}>
                Back to workspace →
              </button>
            </div>
          </div>
        )}

        {state.stage === "final" && (
          <div className={css.stage}>
            <h1 className={css.prompt}>Your design</h1>
            <p className={css.sub}>Continuing in your design workspace…</p>
            <div className={css.footer}>
              <button type="button" className={css.cta} onClick={() => go("exploration")}>
                Back to workspace →
              </button>
            </div>
          </div>
        )}

        {state.stage === "email_gate" && (
          <div className={css.stage}>
            <h1 className={css.prompt}>Unlock your estimate</h1>
            <p className={css.sub}>Continuing in your design workspace…</p>
            <div className={css.footer}>
              <button
                type="button"
                className={css.cta}
                onClick={() => {
                  patch({ emailFormOpen: true, stage: "exploration" });
                }}
              >
                Back to your design →
              </button>
            </div>
          </div>
        )}

        {state.stage === "consultation" && (
          <div className={css.stage}>
            <h1 className={css.prompt}>AI consultation</h1>
            <p className={css.sub}>Continuing on your design…</p>
            <div className={css.footer}>
              <button type="button" className={css.cta} onClick={() => go("exploration")}>
                Back to design →
              </button>
            </div>
          </div>
        )}

        {state.stage === "connect" && (
          <div className={css.stage}>
            <h1 className={css.prompt}>Want help bringing this project to life?</h1>
            <p className={css.sub}>
              Only share your number if you want a real-world next step — not a hard sell.
            </p>
            <p className={css.trustLineStandalone}>
              {brandName} uses this to follow up on the design you shaped — you stay in control.
            </p>
            <div className={css.stack}>
              {CONNECT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={`${css.secondary} ${state.connectIntent === opt.id ? css.cardSelected : ""}`}
                  style={{ marginTop: 0, borderWidth: 2 }}
                  onClick={() => {
                    if (opt.id === "continue") {
                      go("exploration");
                      return;
                    }
                    patch({ connectIntent: opt.id });
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {state.connectIntent && state.connectIntent !== "continue" && (
              <div style={{ marginTop: 16 }}>
                <input
                  className={css.field}
                  type="tel"
                  placeholder="Phone number"
                  value={state.phone}
                  onChange={(e) => patch({ phone: e.target.value })}
                />
                <button
                  type="button"
                  className={css.cta}
                  onClick={() => {
                    if (state.phone.trim().length < 7) {
                      setError("Enter a phone number to connect.");
                      return;
                    }
                    setError(null);
                    void (async () => {
                      const live = await callAdventurePipeline(
                        "handoff",
                        designPayload({
                          lead: {
                            email: state.email || null,
                            phone: state.phone,
                            intent: state.connectIntent,
                          },
                        })
                      );
                      patch({
                        phoneCaptured: true,
                        handoff: (live?.handoff as Record<string, unknown>) || null,
                        stage: "done",
                      });
                    })();
                  }}
                >
                  Connect me →
                </button>
                {error && <p className={css.error}>{error}</p>}
              </div>
            )}
          </div>
        )}

        {state.stage === "done" && (
          <div className={css.stage}>
            <h1 className={css.prompt}>You&apos;re all set.</h1>
            <p className={css.sub}>
              We&apos;ve got your design and how to reach you — {brandName} will follow up about your{" "}
              {selectedService?.label?.toLowerCase() || "project"}.
            </p>
            <div className={css.sliderWrap}>
              <p className={css.muted}>Service: {selectedService?.label}</p>
              <p className={css.muted}>Scope: {state.scopes.join(", ")}{state.otherScope ? ` (${state.otherScope})` : ""}</p>
              <p className={css.muted}>Budget: {formatMoney(state.budget)}</p>
              <p className={css.muted}>Email: {state.email || "—"}</p>
              <p className={css.muted}>Phone: {state.phone || "—"}</p>
            </div>
            <div className={css.footer}>
              <button
                type="button"
                className={css.cta}
                onClick={() =>
                  setState({
                    ...initialState(state.gate),
                    stage: services.length === 1 ? "project" : "service",
                    serviceId: services.length === 1 ? services[0].value : null,
                    budget: state.budget,
                  })
                }
              >
                Start over
              </button>
            </div>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
}
