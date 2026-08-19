"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { BrandHeader } from "@/components/widget/BrandHeader";
import { AdventureLoader, type AdventureLoaderPhase } from "@/components/form/AdventureLoader";
import { FormThemeProvider } from "@/components/form/demo/FormThemeProvider";
import { withWidgetDesignDefaults } from "@/lib/widget-design-defaults";
import type { DesignSettings } from "@/types/design";

import type { ServiceOption } from "../v2/types";
import { v2ScopeStarterKey } from "@/lib/adventure-v2/scope-starter-catalog";
import css from "./configurator-v8.module.css";
import {
  budgetTierLabel,
  catalogTags,
  DISCOVERY_MODELS,
  finishTiersForScope,
  formatChipBand,
  normalizeFinishTier,
  pinAspectRatio,
  priceForFinishTier,
  proposeClientBudgetBounds,
  splitFinishTiers,
  splitMasonryColumns,
  withOpenEndedTop,
} from "./generationRecipes";
import {
  buildScopeQuestion,
  lookConflictsWithService,
  lookFitsSelectedScopes,
  projectMode,
  verticalKey,
} from "./scopeRecipes";
import { callAdventurePipeline, curateAdventureImages, fetchInstanceCatalogLooks, generateV8DesignImage, type V8DesignPayload } from "./adventurePipelineClient";
import type {
  V8BudgetBounds,
  V8Estimate,
  V8FinishTier,
  V8FinishTierId,
  V8GeneratedImage,
  V8IntakeChoice,
  V8IntakeQuestion,
  V8ProjectSnapshot,
  V8Stage,
  V8State,
  V8VisualDirection,
} from "./types";
import { clearV8Snapshot, getOrCreateV8SessionId, loadV8Snapshot, saveV8Snapshot } from "./storage";

type Props = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
};

const STAGE_ORDER: V8Stage[] = [
  "service",
  "project",
  "budget",
  "visual",
  "price",
  "connect",
  "done",
];

const REFINE_LIMIT = 5;
const GALLERY_PAGE = 24;
const STARTER_CUE = "Your pick";

const CONNECT_OPTIONS = [
  { id: "quote", label: "Request a quote" },
  { id: "talk", label: "Talk to the business" },
];

const FALLBACK_SERVICES: ServiceOption[] = [
  { value: "bathroom-remodel", label: "Bathroom Remodel", serviceName: "Bathroom Remodel" },
  { value: "kitchen-remodel", label: "Kitchen Remodel", serviceName: "Kitchen Remodel" },
  { value: "flooring", label: "Flooring", serviceName: "Flooring" },
  { value: "pergola", label: "Pergola", serviceName: "Pergola" },
  { value: "landscaping", label: "Landscaping", serviceName: "Landscaping" },
];

const SERVICE_COVERS: Record<string, string[]> = {
  bathroom: [
    "https://images.unsplash.com/photo-1620626011761-996317b8d101?w=800&q=80",
    "https://images.unsplash.com/photo-1552321554-5fefe8c9ef14?w=800&q=80",
    "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=800&q=80",
    "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?w=800&q=80",
    "https://images.unsplash.com/photo-1507652313519-d4e9174996dd?w=800&q=80",
    "https://images.unsplash.com/photo-1631889993959-41b4e9c6e3c5?w=800&q=80",
    "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?w=800&q=80",
    "https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?w=800&q=80",
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

function isOther(label: string): boolean {
  return /^other$/i.test(String(label || "").trim());
}

function isFullScopeChoice(choice: V8IntakeChoice): boolean {
  return choice.role === "full" || choice.id === "full";
}

function isFullScopeLabel(label: string, question: V8IntakeQuestion | null): boolean {
  const full = question?.choices.find(isFullScopeChoice);
  if (full && (label === full.label || label === full.id)) return true;
  return false;
}

function refinePlaceholder(): string {
  return "Describe a change…";
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
    serviceLabel: service?.customerLabel || service?.label || service?.businessLabel,
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

function coverPool(serviceLabel: string, scope: string): string[] {
  const key = projectKey(`${serviceLabel} ${scope}`);
  if (key === "default") return [];
  return SERVICE_COVERS[key] || [];
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

function placeholderUrl(seed: string, w = 800, h = 800): string {
  const n = (hashSeed(seed) % 1000) + 1;
  return `https://picsum.photos/seed/${encodeURIComponent(`${seed}-${n}`)}/${w}/${h}`;
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
    budget?: number;
  }
) {
  const direction = img.direction;
  const tags = catalogTags({
    serviceLabel: ctx.serviceLabel,
    scopes: ctx.scopes,
    scope: ctx.scope,
    priceTier: img.priceTier,
    budget: ctx.budget,
    direction,
  });
  return {
    url: img.url,
    label: img.styleLabel || direction?.label || img.label,
    serviceId: ctx.serviceId,
    serviceLabel: ctx.serviceLabel,
    industry: ctx.industry,
    scope: ctx.scope,
    priceTier: img.priceTier,
    modelId: img.modelId || null,
    writeBack: {
      generated_for: "adventure_v8",
      starter_scope: ctx.scope,
      starter_scope_key: v2ScopeStarterKey(ctx.scope),
      subcategory_id: ctx.serviceId,
      option_label: img.styleLabel || direction?.label || img.label,
      price_tier: img.priceTier || "",
      budget: ctx.budget ?? "",
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
      style: direction?.style || "",
      palette_family: direction?.family || "",
    },
  };
}

function formatBand(min: number, max: number): string {
  return `${formatMoney(min)}–${formatMoney(max)}`;
}

function isUsableLookUrl(url: string): boolean {
  const value = String(url || "").trim();
  if (!/^https?:\/\//i.test(value)) return false;
  if (/example\.com|placehold(er)?|via\.placeholder|picsum\.photos/i.test(value)) return false;
  return true;
}

function budgetPrice(budget: number): V8Estimate {
  const amount = Math.max(0, Math.round(Number(budget) || 0));
  return { min: amount, max: amount, source: "budget" };
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
    inspirationRound: 0,
    discoveryModelId: null,
    selectedDesignId: null,
    refineRemaining: REFINE_LIMIT,
    changeNote: "",
    estimate: null,
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

function progressLabel(stage: V8Stage, serviceSkipped: boolean): string {
  const visible = STAGE_ORDER.filter((s) => s !== "done" && !(serviceSkipped && s === "service"));
  const idx = visible.indexOf(stage);
  if (idx < 0) return "";
  return `Step ${idx + 1} of ${visible.length}`;
}

function loaderForStage(
  stage: V8Stage,
  generatingLabel: string
): { phase: AdventureLoaderPhase; message?: string; subMessage?: string } {
  if (stage === "loading") {
    return { phase: "initial", message: "Setting things up…", subMessage: "Getting your project ready." };
  }
  if (stage === "project") {
    return {
      phase: "initial",
      message: "Putting your project together…",
      subMessage: "Figuring out what to include…",
    };
  }
  if (stage === "budget") {
    return {
      phase: "initial",
      message: "Checking typical budgets…",
      subMessage: "This helps keep the price honest.",
    };
  }
  if (stage === "visual") {
    return {
      phase: "preview_generating",
      message: generatingLabel || "Finding looks…",
    };
  }
  return { phase: "initial", message: generatingLabel || "One moment…" };
}

function LoadingState({
  phase,
  message,
  subMessage,
}: {
  phase: AdventureLoaderPhase;
  message?: string;
  subMessage?: string;
}) {
  return (
    <div className={css.loading} role="status" aria-live="polite">
      <AdventureLoader phase={phase} active messageOverride={message} subMessageOverride={subMessage} />
    </div>
  );
}

export function AdventureV8Experience({ instanceId, initialInstanceData, initialDesignConfig }: Props) {
  const [instance, setInstance] = useState<any>(initialInstanceData || null);
  const [design, setDesign] = useState<DesignSettings>(() =>
    withWidgetDesignDefaults(initialDesignConfig || initialInstanceData?.config || {}, initialInstanceData?.name)
  );
  const [services, setServices] = useState<ServiceOption[]>(FALLBACK_SERVICES);
  const [state, setState] = useState<V8State>(() => initialState());
  const [error, setError] = useState<string | null>(null);
  const [budgetDraft, setBudgetDraft] = useState<number | null>(null);
  const [layoutThumbs, setLayoutThumbs] = useState<Record<string, string>>({});
  const [styleThumbs, setStyleThumbs] = useState<Record<string, string>>({});
  const starterGenRef = useRef(0);
  const gallerySentinelRef = useRef<HTMLDivElement | null>(null);
  const failedLookUrlsRef = useRef<Set<string>>(new Set());
  const [masonryCols, setMasonryCols] = useState(2);
  const [serviceQuestion, setServiceQuestion] = useState<V8IntakeQuestion | null>(null);
  const [scopeQuestion, setScopeQuestion] = useState<V8IntakeQuestion | null>(null);
  const lookGenRef = useRef(0);
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
      failedLookUrlsRef.current = new Set();
      setLayoutThumbs({});
      setStyleThumbs({});
      setBudgetDraft(null);
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
  const namedScopes = state.scopes.filter((s) => !isOther(s));
  const otherSelected = state.scopes.some(isOther);
  const scopeLabel = [...namedScopes, otherSelected ? state.otherScope.trim() : ""]
    .filter(Boolean)
    .join(" + ");
  const scopeReady = namedScopes.length > 0 || (otherSelected && Boolean(state.otherScope.trim()));
  const selectedDesign = state.looks.find((d) => d.id === state.selectedDesignId) || state.looks[0] || null;
  const brandName = design.brand_name || instance?.name || "Adventure";
  const studioOpen = state.stage === "visual" && Boolean(state.selectedDesignId);
  const galleryOpen = state.stage === "visual" && !state.selectedDesignId;

  const localBudgetBounds = useMemo((): V8BudgetBounds => {
    const proposed = proposeClientBudgetBounds({
      serviceLabel: selectedService?.label,
      industry: selectedService?.industryName,
      serviceSummary: selectedService?.serviceSummary,
      scopes: namedScopes,
    });
    return {
      min: proposed.min,
      max: proposed.max,
      step: proposed.step,
      defaultAmount: proposed.defaultAmount,
      source: "ai",
      finishTiers: finishTiersForScope({
        serviceLabel: selectedService?.label,
        industry: selectedService?.industryName,
        serviceSummary: selectedService?.serviceSummary,
        scopes: namedScopes,
      }),
    };
  }, [namedScopes, selectedService]);
  const budgetBounds = state.budgetBounds || localBudgetBounds;
  const finishTiers: V8FinishTier[] = withOpenEndedTop(
    budgetBounds.finishTiers && budgetBounds.finishTiers.length
      ? budgetBounds.finishTiers
      : finishTiersForScope({
          serviceLabel: selectedService?.label,
          industry: selectedService?.industryName,
          serviceSummary: selectedService?.serviceSummary,
          scopes: namedScopes,
        })
  );
  const selectedTier = finishTiers.find((row) => row.id === state.finishTierId) || null;
  const displayBudget = selectedTier
    ? selectedTier.openEnded
      ? selectedTier.min
      : Math.round((selectedTier.min + selectedTier.max) / 2)
    : budgetDraft ?? state.budget;

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
        startPath: state.photoUrl ? "photo" : "inspiration",
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
      state.scopes,
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
        const businessName = String(nextInstance?.name || "").trim();
        const serviceQ =
          resolved.length <= 1
            ? fallbackServiceIntake(resolved)
            : await requestIntake({ list: resolved, businessName });
        if (cancelled) return;
        const skipped = Boolean(serviceQ.skip) || resolved.length <= 1;
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
            railQuestion: "refine",
          });
          return;
        }
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
          return;
        }
        setServiceQuestion(serviceQ);
        setScopeQuestion(null);
        setState({
          ...initialState(sessionId),
          stage: "service",
          serviceSkipped: false,
          budget,
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
    if (state.stage === "visual" && state.selectedDesignId) {
      patch({ selectedDesignId: null, changeNote: "", generating: false, generatingLabel: "" });
      return;
    }
    if (state.stage === "visual") {
      lookGenRef.current += 1;
      starterGenRef.current += 1;
      patch({
        stage: "budget",
        photoSkipped: false,
        photoUrl: null,
        looks: [],
        favorites: [],
        selectedDesignId: null,
        layoutId: null,
        styleId: null,
        moodId: null,
        galleryOffset: 0,
        galleryHasMore: false,
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

  const refreshBudgetBands = useCallback(async () => {
    const override = instanceBudgetOverride(instance);
    const live = await callAdventurePipeline("budget_bands", designPayload());
    if (override) {
      const scaled = proposeClientBudgetBounds({
        serviceLabel: selectedService?.label,
        industry: selectedService?.industryName,
        serviceSummary: selectedService?.serviceSummary,
        scopes: namedScopes,
        serviceLow: override.min,
        serviceHigh: override.max,
      });
      const next: V8BudgetBounds = {
        min: scaled.min,
        max: scaled.max,
        step: scaled.step,
        defaultAmount: scaled.defaultAmount,
        source: "business",
        confidence: 0.85,
        finishTiers: withOpenEndedTop(
          Array.isArray(live?.finishTiers) && live.finishTiers.length
            ? live.finishTiers
            : splitFinishTiers(scaled.min, scaled.closedMax, {
                serviceLabel: selectedService?.label,
                industry: selectedService?.industryName,
                serviceSummary: selectedService?.serviceSummary,
                plusHigh: scaled.plusHigh,
              })
        ),
      };
      setState((prev) => ({
        ...prev,
        budgetBounds: next,
        budget: startingBudget(next, prev.budgetBounds ? prev.budget : null),
      }));
      return;
    }
    if (!live || typeof live.min !== "number" || typeof live.max !== "number") return;
    const next: V8BudgetBounds = {
      min: Number(live.min),
      max: Number(live.max),
      step: Number(live.step) || 1000,
      defaultAmount: Number(live.defaultAmount) || undefined,
      source: String(live.source || "ai"),
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
    setState((prev) => ({
      ...prev,
      budgetBounds: next,
      budget: startingBudget(next, prev.budgetBounds ? prev.budget : null),
    }));
  }, [designPayload, instance, namedScopes, selectedService]);

  useEffect(() => {
    if (state.stage !== "budget" || !state.serviceId) return;
    void refreshBudgetBands();
  }, [refreshBudgetBands, state.serviceId, state.stage]);

  const fullScopeLabel = scopeQuestion?.choices.find((c) => c.role === "full" || c.id === "full")?.label || null;
  const mode = projectMode(namedScopes, fullScopeLabel);
  const vertical = verticalKey(
    selectedService?.industryName,
    selectedService?.label,
    selectedService?.serviceSummary
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

  const makeLook = (opts: {
    id: string;
    url: string;
    label: string;
    cue?: string | null;
    source?: V8GeneratedImage["source"];
    style?: { id: string; label: string; prompt: string } | null;
  }): V8GeneratedImage => {
    const style = opts.style;
    const direction: V8VisualDirection | undefined = style
      ? {
          label: style.label,
          prompt: style.prompt,
          family: style.id,
          palette: style.prompt,
          style: style.label,
        }
      : undefined;
    return {
      id: opts.id,
      url: opts.url,
      label: opts.label,
      cue: opts.cue || null,
      source: opts.source || "generated",
      styleLabel: style?.label || opts.label,
      scopeLabel: scopeLabel,
      priceTier: budgetTierLabel(stateRef.current.budget),
      budget: stateRef.current.budget,
      estimate: budgetPrice(stateRef.current.budget),
      direction,
      tags: catalogTags({
        serviceLabel: selectedService?.label,
        scopes: namedScopes,
        scope: scopeLabel,
        priceTier: budgetTierLabel(stateRef.current.budget),
        budget: stateRef.current.budget,
        direction,
      }),
    };
  };

  const writeLook = (img: V8GeneratedImage, railMode: string) => {
    if (!img.url || img.source === "fallback") return;
    void curateAdventureImages(instanceId, {
      events: [{ type: "shown", url: img.url, source: img.source, mode: railMode }],
      candidates: img.source === "generated"
        ? [generatedWriteBack(img, {
            serviceId: stateRef.current.serviceId,
            serviceLabel: selectedService?.label || "Project",
            industry: selectedService?.industryName,
            scope: scopeLabel,
            scopes: namedScopes,
            mode: railMode,
            budget: stateRef.current.budget,
          })]
        : [],
      writeBack: img.source === "generated",
    });
  };

  const mapDiscoveryLook = (img: Record<string, any>, index: number): V8GeneratedImage | null => {
    const url = String(img?.url || "").trim();
    if (!isUsableLookUrl(url) || failedLookUrlsRef.current.has(url)) return null;
    const id = String(img.id || img.imageId || `look-${index}-${url.slice(-16)}`);
    const finish = normalizeFinishTier(img.estimatedFinishTier || img.finishTier || img.priceTier);
    const label = String(img.label || "").trim();
    return {
      id,
      url,
      label: !label || /^from our work$/i.test(label) ? "Look" : label,
      source: "library",
      finishTier: finish,
      primaryScope: img.primaryScope || img.scopeKey || null,
      priceTier: img.priceTier || null,
      pinAspect: pinAspectRatio(id),
      tags: Array.isArray(img.tags) ? img.tags.map(String) : [],
      cue: img.cue || img.performanceCue || null,
    };
  };

  const dropBrokenLook = useCallback((url: string) => {
    const gone = String(url || "").trim();
    if (!gone) return;
    failedLookUrlsRef.current.add(gone);
    setState((prev) => ({ ...prev, looks: prev.looks.filter((look) => look.url !== gone) }));
  }, []);

  const loadDiscovery = useCallback(
    async (opts?: { append?: boolean }) => {
      const current = stateRef.current;
      if (!current.finishTierId) return;
      if (opts?.append && (current.generating || !current.galleryHasMore)) return;
      const token = ++starterGenRef.current;
      const offset = opts?.append ? current.galleryOffset : 0;
      if (!opts?.append) {
        patch({
          generating: true,
          generatingLabel: "Finding looks…",
          stage: "visual",
          looks: [],
          selectedDesignId: null,
          galleryOffset: 0,
          galleryHasMore: true,
          photoSkipped: true,
        });
        setError(null);
      } else {
        patch({ generating: true, generatingLabel: "Loading more looks…" });
      }
      let live = await callAdventurePipeline(
        "discovery",
        designPayload({ finishTier: current.finishTierId, budgetBandId: current.finishTierId }),
        { offset, limit: GALLERY_PAGE, finishTier: current.finishTierId }
      );
      let rows = Array.isArray(live?.images) ? live.images : [];
      if (!opts?.append && rows.length === 0) {
        const lib = await callAdventurePipeline("library", designPayload(), {
          limit: GALLERY_PAGE,
          finishTier: current.finishTierId,
        });
        if (Array.isArray(lib?.images) && lib.images.length) {
          live = lib;
          rows = lib.images;
        }
      }
      if (!opts?.append && rows.length === 0) {
        const local = await fetchInstanceCatalogLooks(instanceId);
        rows = local.filter((img) => {
          const imageText = [img.label, img.description, ...(Array.isArray(img.tags) ? img.tags : [])]
            .filter(Boolean)
            .join(" ");
          if (
            lookConflictsWithService({
              imageText,
              serviceLabel: selectedService?.label,
              industry: selectedService?.industryName,
              summary: selectedService?.serviceSummary,
            })
          ) {
            return false;
          }
          return lookFitsSelectedScopes({ imageText, scopes: namedScopes });
        });
        live = { images: rows, hasMore: false, nextOffset: rows.length };
      }
      if (starterGenRef.current !== token) return;
      const mapped = rows.map((row: Record<string, any>, i: number) => mapDiscoveryLook(row, offset + i)).filter(
        (row: V8GeneratedImage | null): row is V8GeneratedImage => Boolean(row)
      );
      const existing = opts?.append ? current.looks : [];
      const seen = new Set(existing.map((row) => row.url));
      const added = mapped.filter((row) => !seen.has(row.url));
      const nextLooks = [...existing, ...added];
      patch({
        looks: nextLooks,
        generating: false,
        generatingLabel: "",
        stage: "visual",
        galleryOffset: Number(live?.nextOffset || nextLooks.length),
        galleryHasMore: Boolean(live?.hasMore),
      });
      for (const look of added) writeLook(look, "inspiration");
    },
    [designPayload, instanceId, namedScopes, patch, selectedService]
  );

  const loadMoreLooks = useCallback(() => {
    void loadDiscovery({ append: true });
  }, [loadDiscovery]);

  useEffect(() => {
    const onResize = () => setMasonryCols(window.innerWidth >= 720 ? 3 : 2);
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => {
    if (state.stage !== "visual" || state.selectedDesignId || !state.galleryHasMore || state.generating) return;
    const node = gallerySentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMoreLooks();
      },
      { rootMargin: "240px" }
    );
    io.observe(node);
    return () => io.disconnect();
  }, [loadMoreLooks, state.galleryHasMore, state.generating, state.selectedDesignId, state.stage, state.looks.length]);

  const galleryColumns = useMemo(
    () => splitMasonryColumns(state.looks, masonryCols, (item) => item.pinAspect || pinAspectRatio(item.id)),
    [masonryCols, state.looks]
  );

  const applyChange = async () => {
    const note = state.changeNote.trim();
    if (!note || !selectedDesign) return;
    if (state.refineRemaining <= 0) {
      setError("That’s all the refinements for this design.");
      return;
    }
    setError(null);
    patch({ generating: true, generatingLabel: "Making that change…" });
    const prompt = `${note}. Keep this exact photo. Same camera and layout. Only apply that change.`;
    let url =
      (await generateV8DesignImage({
        instanceId,
        prompt,
        photoUrl: selectedDesign.url,
        service: selectedService?.label,
        industry: selectedService?.industryName,
        serviceSummary: selectedService?.serviceSummary,
        scope: scopeLabel,
        budget: state.budget,
        modelId: DISCOVERY_MODELS.fastEdit,
        generationIntent: "initial",
        useCase: "scene-refinement",
      })) ||
      (await generateV8DesignImage({
        instanceId,
        prompt,
        photoUrl: selectedDesign.url,
        service: selectedService?.label,
        industry: selectedService?.industryName,
        serviceSummary: selectedService?.serviceSummary,
        scope: scopeLabel,
        budget: state.budget,
        modelId: DISCOVERY_MODELS.edit,
        generationIntent: "initial",
        useCase: "scene-refinement",
      }));
    if (!url) {
      patch({ generating: false, generatingLabel: "" });
      setError("Couldn’t apply that change. Try another.");
      return;
    }
    const next: V8GeneratedImage = {
      id: `refine-${Date.now()}`,
      url,
      label: selectedDesign.label,
      cue: STARTER_CUE,
      source: "generated",
      styleLabel: selectedDesign.styleLabel,
      scopeLabel: selectedDesign.scopeLabel,
      finishTier: selectedDesign.finishTier,
      primaryScope: selectedDesign.primaryScope,
      tags: selectedDesign.tags,
      direction: selectedDesign.direction,
    };
    setState((prev) => ({
      ...prev,
      looks: prev.looks.map((d) => (d.id === prev.selectedDesignId ? next : d)),
      selectedDesignId: next.id,
      favorites: [next.id],
      changeNote: "",
      refineRemaining: Math.max(0, prev.refineRemaining - 1),
      generating: false,
      generatingLabel: "",
    }));
    void curateAdventureImages(instanceId, {
      events: [{ type: "saved", url, source: "generated", mode: "refine" }],
      candidates: [generatedWriteBack(next, {
        serviceId: state.serviceId,
        serviceLabel: selectedService?.label || "Project",
        industry: selectedService?.industryName,
        scope: scopeLabel,
        scopes: namedScopes,
        mode: "refine",
        budget: state.budget,
      })],
      writeBack: true,
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
    };
  }, [
    instanceId,
    scopeLabel,
    selectedDesign?.url,
    selectedService,
    state.budget,
    state.estimate,
    state.favorites,
    state.looks,
    state.otherScope,
    otherSelected,
    state.photoUrl,
    state.scopes,
    state.serviceId,
  ]);

  const saveLead = async (extra?: { phone?: string; intent?: string | null }) => {
    const email = state.email.trim();
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
      layoutId: null,
      styleId: null,
      moodId: null,
      railQuestion: "refine",
      selectedDesignId: null,
    });
    setLayoutThumbs({});
    setStyleThumbs({});
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
    const proposed = proposeClientBudgetBounds({
      serviceLabel: selectedService?.label,
      industry: selectedService?.industryName,
      serviceSummary: selectedService?.serviceSummary,
      scopes: namedScopes,
    });
    const tiers = finishTiersForScope({
      serviceLabel: selectedService?.label,
      industry: selectedService?.industryName,
      serviceSummary: selectedService?.serviceSummary,
      scopes: namedScopes,
    });
    const mid = tiers.find((row) => row.id === "mid") || tiers[Math.floor(tiers.length / 2)] || tiers[0];
    const next: V8BudgetBounds = {
      min: proposed.min,
      max: proposed.max,
      step: proposed.step,
      defaultAmount: proposed.defaultAmount,
      source: "ai",
      confidence: 0.55,
      finishTiers: tiers,
    };
    patch({
      stage: "budget",
      budgetBounds: next,
      finishTierId: mid?.id || "mid",
      budget: mid ? Math.round((mid.min + mid.max) / 2) : startingBudget(next),
    });
  };

  const goToVisual = async () => {
    if (!scopeReady || !state.finishTierId) return;
    await loadDiscovery();
  };

  const goToPrice = () => {
    if (!selectedDesign) return;
    patch({
      selectedDesignId: selectedDesign.id,
      favorites: selectedDesign.id ? [selectedDesign.id] : state.favorites,
      stage: "price",
    });
    void refreshEstimate();
    if (!selectedDesign.url || selectedDesign.source === "fallback") return;
    void curateAdventureImages(instanceId, {
      events: [{ type: "selected", url: selectedDesign.url, source: selectedDesign.source, mode: "inspiration" }],
      candidates: selectedDesign.source === "generated" ? [generatedWriteBack(selectedDesign, {
        serviceId: state.serviceId,
        serviceLabel: selectedService?.label || "Project",
        industry: selectedService?.industryName,
        scope: scopeLabel,
        scopes: namedScopes,
        mode: "inspiration",
        budget: state.budget,
      })] : [],
      writeBack: selectedDesign.source === "generated",
    });
  };

  const captureEmail = async () => {
    const email = state.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Enter a valid email to continue.");
      return;
    }
    setError(null);
    if (!state.estimate) await refreshEstimate();
    const submissionId = await saveLead();
    if (!submissionId) {
      setError("Couldn’t save that email. Try again.");
      return;
    }
    patch({ emailCaptured: true, submissionId });
  };

  const capturePhone = async () => {
    if (!state.connectIntent) return;
    if (state.phone.trim().length < 7) {
      setError("Enter a phone number to connect.");
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
  const showLoader =
    state.stage === "loading" ||
    (state.generating && state.stage === "visual" && state.looks.length === 0) ||
    (state.stage === "project" && !scopeQuestion);
  const firstStep = state.serviceSkipped ? "project" : "service";
  const serviceChoices = serviceQuestion?.choices?.length
    ? serviceQuestion.choices
    : fallbackServiceIntake(services).choices;

  const loader = loaderForStage(state.stage, state.generatingLabel);

  return (
    <FormThemeProvider config={design}>
    <div className={css.root} data-adventure-version="v8">
      <BrandHeader config={design} compact />
      {state.stage !== "loading" && (
        <div className={css.top}>
          <button
            type="button"
            className={css.back}
            onClick={goBack}
            disabled={state.stage === firstStep}
          >
            ← Back
          </button>
          <div className={css.progress}>{progressLabel(state.stage, state.serviceSkipped)}</div>
        </div>
      )}

      <main className={`${css.main} ${galleryOpen ? css.mainWide : studioOpen ? css.mainFill : ""}`}>
        {showLoader ? (
          <LoadingState phase={loader.phase} message={loader.message} subMessage={loader.subMessage} />
        ) : (
          <>
            {state.stage === "service" && (
              <div className={css.stage}>
                <div className={css.stageBody}>
                  <h1 className={css.prompt}>{serviceQuestion?.question || "What would you like help with?"}</h1>
                  <p className={css.sub}>{serviceQuestion?.subtitle || "Pick one — we&apos;ll keep it simple."}</p>
                  <div className={css.grid}>
                    {serviceChoices.map((choice) => {
                      const serviceId = choice.serviceId || choice.id;
                      const service = services.find((s) => s.value === serviceId);
                      const cover = catalogCoverUrl(service || null, `service-${serviceId}`);
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          className={`${css.card} ${cover ? "" : css.cardTextOnly} ${state.serviceId === serviceId ? css.cardSelected : ""}`}
                          onClick={() => void onSelectService(serviceId)}
                        >
                          {cover ? <img className={css.cardImg} src={cover} alt="" /> : null}
                          <div className={css.cardLabel}>
                            {choice.label}
                            {choice.hint ? <span className={css.choiceHint}>{choice.hint}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {state.stage === "project" && scopeQuestion && (
              <div className={css.stage}>
                <div className={css.stageBody}>
                  <h1 className={css.prompt}>{scopeQuestion.question || "What would you like to include?"}</h1>
                  <p className={css.sub}>{scopeQuestion.subtitle || "Pick everything that applies."}</p>
                  <div className={css.scopeGrid}>
                    {scopeQuestion.choices.map((choice) => {
                      const selected = state.scopes.includes(choice.label) || state.scopes.includes(choice.id);
                      return (
                        <button
                          key={choice.id}
                          type="button"
                          className={`${css.card} ${css.cardTextOnly} ${css.scopeCard} ${selected ? css.cardSelected : ""}`}
                          onClick={() => onSelectScope(choice.label)}
                        >
                          <div className={css.cardLabel}>
                            <span className={css.scopeCheck}>{selected ? "✓ " : ""}</span>
                            {choice.label}
                            {choice.hint ? <span className={css.choiceHint}>{choice.hint}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  {otherSelected && (
                    <input
                      className={css.field}
                      style={{ marginTop: 12 }}
                      placeholder="Tell us briefly what you're working on"
                      value={state.otherScope}
                      onChange={(e) => patch({ otherScope: e.target.value })}
                    />
                  )}
                </div>
                <div className={css.footer}>
                    <button type="button" className={css.cta} disabled={!scopeReady} onClick={() => goToBudget()}>
                      Next: budget →
                    </button>
                  </div>
              </div>
            )}

            {state.stage === "budget" && (
              <div className={css.stage}>
                <div className={css.stageBody}>
                  <h1 className={css.prompt}>About how much do you want to spend?</h1>
                  <p className={css.sub}>Pick a price range for this project.</p>
                  <div className={css.bandGrid}>
                    {finishTiers.map((tier) => {
                      const on = state.finishTierId === tier.id;
                      return (
                        <button
                          key={tier.id}
                          type="button"
                          className={`${css.bandChip} ${on ? css.bandChipOn : ""}`}
                          onClick={() =>
                            patch({
                              finishTierId: tier.id,
                              budget: tier.openEnded ? tier.min : Math.round((tier.min + tier.max) / 2),
                            })
                          }
                        >
                          <span className={css.bandRange}>{formatChipBand(tier)}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className={css.footer}>
                  <button type="button" className={css.cta} disabled={!state.finishTierId} onClick={() => void goToVisual()}>
                    Browse looks →
                  </button>
                </div>
              </div>
            )}

            {state.stage === "visual" && galleryOpen ? (
              <div className={css.stage}>
                <div className={css.stageBody}>
                  <h1 className={css.prompt}>Pick a look you like</h1>
                  <p className={css.sub}>
                    {[selectedService?.label, scopeLabel, selectedTier ? formatChipBand(selectedTier) : ""]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                  {state.looks.length ? (
                    <div className={css.masonryBoard}>
                      {galleryColumns.map((col, colIdx) => (
                        <div key={`col-${colIdx}`} className={css.masonryCol}>
                          {col.map((look) => (
                            <button
                              key={look.id}
                              type="button"
                              className={`${css.masonryItem} ${state.selectedDesignId === look.id ? css.cardSelected : ""} ${css.pinEnter}`}
                              onClick={() => {
                                patch({ selectedDesignId: look.id, favorites: [look.id] });
                                void curateAdventureImages(instanceId, {
                                  events: [{ type: "selected", url: look.url, source: look.source, mode: "inspiration" }],
                                });
                              }}
                            >
                              <img
                                className={css.cardImg}
                                src={look.url}
                                alt=""
                                style={{ aspectRatio: look.pinAspect || pinAspectRatio(look.id) }}
                                onLoad={(event) => {
                                  event.currentTarget.dataset.ready = "1";
                                }}
                                onError={() => dropBrokenLook(look.url)}
                              />
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  ) : !state.generating ? (
                    <p className={css.sub}>No photos in this catalog yet.</p>
                  ) : null}
                  {error ? <p className={css.error}>{error}</p> : null}
                  <div ref={gallerySentinelRef} className={css.gallerySentinel} />
                  {state.generating && state.looks.length > 0 ? (
                    <p className={css.muted}>Loading more looks…</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            {state.stage === "visual" && studioOpen && selectedDesign ? (
              <div className={css.workspace}>
                <div className={css.exploreFocus}>
                  <div className={css.heroStage}>
                    <div className={css.heroWrap}>
                      <img
                        className={css.heroImgLarge}
                        src={selectedDesign.url}
                        alt={selectedDesign.label}
                      />
                      <p className={css.starterBadge}>{STARTER_CUE}</p>
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
                    <div className={css.railPriceCard}>
                      <p className={css.railSection}>Price</p>
                      <p className={`${css.railPrice} ${css.railPriceLocked}`}>
                        {revealedPrice ? formatBand(revealedPrice.min, revealedPrice.max) : formatMoney(displayBudget)}
                      </p>
                      <p className={css.railQuiet}>
                        {[selectedService?.label, scopeLabel].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {error ? <p className={css.error}>{error}</p> : null}
                    <div className={css.railBlock}>
                      <p className={css.railSection}>Tweak this photo</p>
                      <input
                        className={css.railInput}
                        placeholder={refinePlaceholder()}
                        value={state.changeNote}
                        onChange={(e) => patch({ changeNote: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void applyChange();
                        }}
                        disabled={state.generating || state.refineRemaining <= 0}
                      />
                      <button
                        type="button"
                        className={css.railBtn}
                        disabled={state.generating || !state.changeNote.trim() || state.refineRemaining <= 0}
                        onClick={() => void applyChange()}
                      >
                        {state.refineRemaining > 0
                          ? `Apply this change (${state.refineRemaining} left)`
                          : "Refinements used"}
                      </button>
                    </div>
                    </div>
                    <div className={css.railFooter}>
                      <button
                        type="button"
                        className={css.railPrimary}
                        disabled={state.generating}
                        onClick={() => goToPrice()}
                      >
                        See my price →
                      </button>
                    </div>
                  </aside>
                </div>
              </div>
            ) : null}

            {state.stage === "price" && (
              <div className={css.stage}>
                <div className={css.stageBody}>
                  <h1 className={css.prompt}>
                    {state.emailCaptured ? "Estimated project price" : "Want to see what this could cost?"}
                  </h1>
                  {selectedDesign ? (
                    <img className={css.heroImg} src={selectedDesign.url} alt="Your design" />
                  ) : null}
                  {state.emailCaptured && revealedPrice ? (
                    <>
                      <p className={css.budgetValue} style={{ marginTop: 16 }}>
                        {formatBand(revealedPrice.min, revealedPrice.max)}
                      </p>
                      <p className={css.sub}>Typical range for this project and finish level — not a quote for this photo.</p>
                    </>
                  ) : (
                    <>
                      <p className={css.sub}>We’ll email this estimate. No sales call unless you ask.</p>
                      <input
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
                <div className={css.footer}>
                  {state.emailCaptured ? (
                    <button type="button" className={css.cta} onClick={() => go("connect")}>
                      Want help bringing this to life? →
                    </button>
                  ) : (
                    <button type="button" className={css.cta} onClick={() => void captureEmail()}>
                      Show my price →
                    </button>
                  )}
                </div>
              </div>
            )}

            {state.stage === "connect" && (
              <div className={css.stage}>
                <div className={css.stageBody}>
                  <h1 className={css.prompt}>Want help bringing this to life?</h1>
                  <p className={css.sub}>
                    Only share your number if you want {brandName} to follow up on this design.
                  </p>
                  <div className={css.stack}>
                    {CONNECT_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        className={`${css.secondary} ${state.connectIntent === opt.id ? css.cardSelected : ""}`}
                        style={{ marginTop: 0, borderWidth: 2 }}
                        onClick={() => patch({ connectIntent: opt.id })}
                      >
                        {opt.id === "talk" ? `Talk to ${brandName}` : opt.label}
                      </button>
                    ))}
                  </div>
                  {state.connectIntent && (
                    <div style={{ marginTop: 16 }}>
                      <input
                        className={css.field}
                        type="tel"
                        placeholder="Phone number"
                        value={state.phone}
                        onChange={(e) => patch({ phone: e.target.value })}
                      />
                      {error && <p className={css.error}>{error}</p>}
                    </div>
                  )}
                </div>
                {state.connectIntent && (
                  <div className={css.footer}>
                    <button type="button" className={css.cta} onClick={() => void capturePhone()}>
                      Connect me →
                    </button>
                  </div>
                )}
              </div>
            )}

            {state.stage === "done" && (
              <div className={css.stage}>
                <div className={css.stageBody}>
                  <h1 className={css.prompt}>You&apos;re all set.</h1>
                  <p className={css.sub}>
                    We&apos;ve got your design and how to reach you — {brandName} will follow up about your{" "}
                    {selectedService?.label?.toLowerCase() || "project"}.
                  </p>
                  <div className={css.sliderWrap}>
                    <p className={css.muted}>Service: {selectedService?.label}</p>
                    <p className={css.muted}>Scope: {scopeLabel}</p>
                    <p className={css.muted}>
                      Price: {revealedPrice ? formatBand(revealedPrice.min, revealedPrice.max) : formatMoney(state.budget)}
                    </p>
                    <p className={css.muted}>Email: {state.email || "—"}</p>
                    <p className={css.muted}>Phone: {state.phone || "—"}</p>
                  </div>
                </div>
                <div className={css.footer}>
                  <button
                    type="button"
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
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
    </FormThemeProvider>
  );
}
