"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Camera,
  ChevronLeft,
  ChevronRight,
  Download,
  Heart,
  ImagePlus,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Maximize2,
  Phone,
  RotateCcw,
  Sparkles,
  Upload,
  WandSparkles,
  X,
} from "lucide-react";

import { BrandHeader } from "@/components/widget/BrandHeader";
import { emitTelemetry } from "@/lib/ai-form/telemetry";
import { withWidgetDesignDefaults } from "@/lib/widget-design-defaults";
import type { DesignSettings } from "@/types/design";

import type {
  CanvasHistoryEntry,
  ServiceOption,
  StableAsset,
  StarterCanvas,
} from "../v2/types";
import { configuredPricingBounds } from "./pricing";
import {
  refinementCategoryHeading,
  refinementComponentsForProject,
} from "./refinement-component-library";
import {
  BUDGET_BANDS,
  adjustedPersonalizedRange,
  budgetBandById,
  buildVisualProjects,
  configuredProjectRange,
  DEFAULT_ESTIMATE_CONFIG,
  personalizedProjectRange,
} from "./visual-pricing";
import type {
  BudgetBand,
  BudgetBandId,
  PersonalizedRefinementRecord,
  RawVisualProject,
  VisualPricingProject,
  VisualPricingSnapshot,
  VisualPricingStage,
} from "./visual-pricing-types";
import {
  clearVisualPricingSnapshot,
  getOrCreateVisualPricingSession,
  loadVisualPricingSnapshot,
  saveVisualPricingSnapshot,
} from "./visual-storage";
import styles from "./visual-pricing-v3.module.css";
import v4Styles from "../v4/visual-pricing-v4.module.css";

type AdventureVisualRouteVersion = "v3" | "v4";

type Props = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
  routeVersion?: AdventureVisualRouteVersion;
};

const PERSONALIZATION_MODEL_ID = "black-forest-labs/flux-2-pro";
const VISUAL_CATALOG_REVISION = "2026-08-01-scope-scenes-v3";
const FREE_PERSONALIZED_REFINEMENTS = 5;

function isMinimalVisualRoute(routeVersion: AdventureVisualRouteVersion): boolean {
  return routeVersion === "v4";
}

type PersonalizedRefinementOption = {
  id: string;
  label: string;
  instruction: string;
  priceImpact: number;
};

type PlanningRange = { totalMin: number; totalMax: number; currency: string };
type PricedCanvasHistoryEntry = CanvasHistoryEntry & { planningRange?: PlanningRange | null };
type PendingPhoneAction =
  | { kind: "project-refinement" | "personalized-refinement" }
  | { kind: "download" | "fullscreen"; imageUrl: string; label: string };

function storedPlanningRange(entry: CanvasHistoryEntry | undefined): PlanningRange | null {
  return (entry as PricedCanvasHistoryEntry | undefined)?.planningRange || null;
}

function personalizedRangeAt(snapshot: VisualPricingSnapshot, conceptIndex: number): PlanningRange | null {
  if (!snapshot.personalizedBaseRange) return snapshot.personalizedRange;
  const normalizedIndex = Math.max(0, Math.min(conceptIndex, snapshot.personalizedConcepts.length - 1));
  let range = snapshot.personalizedBaseRange;
  for (let index = 0; index < normalizedIndex; index += 1) {
    const refinement = snapshot.personalizedRefinements[index];
    if (!refinement) break;
    range = refinement.resultingRange || adjustedPersonalizedRange(range, refinement.priceImpact);
  }
  return range;
}

function personalizedRefinementOptions(project: VisualPricingProject): PersonalizedRefinementOption[] {
  const bathroom = /bath|shower|tub|vanity/i.test(`${project.serviceLabel} ${project.scope}`);
  return [
    { id: "modern", label: "Make it more modern", instruction: "Make the design more modern with cleaner lines and restrained detailing.", priceImpact: 0.03 },
    bathroom
      ? { id: "upgrade-feature", label: "Upgrade the shower", instruction: "Upgrade the shower with more premium glass, fixtures, waterproofing details, and finish materials.", priceImpact: 0.12 }
      : { id: "upgrade-feature", label: "Upgrade the focal feature", instruction: "Upgrade the primary focal feature with more premium materials and detailing.", priceImpact: 0.12 },
    bathroom
      ? { id: "keep-existing", label: "Keep the existing vanity", instruction: "Keep and reuse the existing vanity while coordinating the surrounding design around it.", priceImpact: -0.06 }
      : { id: "keep-existing", label: "Keep existing built-ins", instruction: "Keep and reuse the existing built-ins while coordinating the surrounding design around them.", priceImpact: -0.06 },
    { id: "affordable", label: "Use more affordable finishes", instruction: "Use attractive, readily available value-conscious finishes while preserving the overall design direction.", priceImpact: -0.1 },
    { id: "budget", label: "Stay within my budget", instruction: "Simplify secondary details and material allowances so the project stays within the selected budget.", priceImpact: -0.08 },
  ];
}

function customRefinementPriceImpact(prompt: string): number {
  const value = prompt.trim().toLowerCase();
  if (!value) return 0;
  if (/affordable|save|cheaper|budget|reuse|keep existing|retain/.test(value)) return -0.06;
  if (/upgrade|premium|custom|larger|expand|move|layout|add|replace/.test(value)) return 0.08;
  return 0.03;
}

function normalizeServices(raw: unknown): ServiceOption[] {
  if (!Array.isArray(raw)) return [];
  const normalized: ServiceOption[] = [];
  for (const service of raw as any[]) {
    const value = String(service?.value ?? service?.id ?? service?.slug ?? "").trim();
    const label = String(service?.label ?? service?.name ?? service?.service_name ?? "").trim();
    if (!value || !label) continue;
    normalized.push({
      value,
      label,
      serviceName: service?.serviceName ?? service?.service_name ?? label,
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
    });
  }
  return normalized;
}

function formatCurrency(value: number, currency = "USD"): string {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(value);
  } catch {
    return `$${Math.round(value).toLocaleString()}`;
  }
}

function projectRangeText(project: VisualPricingProject): string {
  return `${formatCurrency(project.priceMin, project.currency)}–${formatCurrency(project.priceMax, project.currency)}`;
}

function rangeText(range: { totalMin: number; totalMax: number; currency: string }): string {
  return `${formatCurrency(range.totalMin, range.currency)}–${formatCurrency(range.totalMax, range.currency)}`;
}

function investmentRangeText(range: { totalMin: number; totalMax: number; currency: string }): string {
  const increment = range.totalMax < 25_000 ? 1_000 : range.totalMax < 75_000 ? 5_000 : 10_000;
  const lower = Math.max(increment, Math.floor(range.totalMin / increment) * increment);
  const upper = Math.max(lower + increment, Math.ceil(range.totalMax / increment) * increment);
  return `${formatCurrency(lower, range.currency)}–${formatCurrency(upper, range.currency)}+`;
}

type V4VisionPath = {
  id: string;
  label: string;
  details: string[];
  instruction: string;
  priceImpact: number;
};

const V4_LANDSCAPE_VISION_PATHS: V4VisionPath[] = [
  {
    id: "starting-range",
    label: "Keep closer to the starting range",
    details: ["Smaller patio", "Standard materials", "Simplified planting"],
    instruction: "Keep the selected design direction while using a smaller patio, standard materials, and a simplified planting plan.",
    priceImpact: -0.1,
  },
  {
    id: "more-impact",
    label: "Add more impact",
    details: ["Premium stone", "Landscape lighting", "Fire feature"],
    instruction: "Add visual impact with premium stone, a landscape lighting package, and one focal fire feature.",
    priceImpact: 0.1,
  },
  {
    id: "luxury-version",
    label: "Create a luxury version",
    details: ["Pergola", "Outdoor kitchen", "Entertainment area"],
    instruction: "Create a luxury outdoor retreat with a pergola, outdoor kitchen, and a dedicated entertainment area.",
    priceImpact: 0.22,
  },
];

const V4_GENERAL_VISION_PATHS: V4VisionPath[] = [
  {
    id: "starting-range",
    label: "Keep closer to the starting range",
    details: ["Simpler scope", "Standard materials", "Prioritized finishes"],
    instruction: "Keep the selected design direction with a simpler scope, standard materials, and the highest-impact finishes prioritized.",
    priceImpact: -0.1,
  },
  {
    id: "more-impact",
    label: "Add more impact",
    details: ["Elevated materials", "Statement lighting", "One focal feature"],
    instruction: "Add more visual impact through elevated materials, statement lighting, and one focal feature.",
    priceImpact: 0.1,
  },
  {
    id: "luxury-version",
    label: "Create a luxury version",
    details: ["Custom details", "Premium finishes", "Expanded entertaining"],
    instruction: "Create a luxury version with custom details, premium finishes, and expanded entertaining features.",
    priceImpact: 0.22,
  },
];

function v4VisionPaths(service: ServiceOption | null): V4VisionPath[] {
  const serviceText = `${service?.label || ""} ${service?.serviceName || ""} ${service?.serviceSummary || ""}`;
  return /landscap|outdoor|garden|patio|lawn|tree|shrub|hardscape|irrigation/i.test(serviceText)
    ? V4_LANDSCAPE_VISION_PATHS
    : V4_GENERAL_VISION_PATHS;
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Please choose an image file."));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      reject(new Error("Please choose an image smaller than 10 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read that image."));
    reader.readAsDataURL(file);
  });
}

function scopesForService(service: ServiceOption | null): string[] {
  return Array.from(new Set((service?.subcategoryScope || []).map((scope) => scope.trim()).filter(Boolean)));
}

function firstQuestionStage(service: ServiceOption | null): VisualPricingStage {
  if (!service) return "project";
  return scopesForService(service).length > 1 ? "scope" : "budget";
}

function defaultSnapshot(
  sessionId: string,
  service: ServiceOption | null,
  showPrimer = true
): VisualPricingSnapshot {
  const scopes = scopesForService(service);
  return {
    version: 3,
    experiment: "visual_pricing_two_stage",
    sessionId,
    stage: showPrimer ? "intro" : firstQuestionStage(service),
    selectedServiceId: service?.value || null,
    selectedScope: scopes.length === 1 ? scopes[0] : null,
    budgetBandId: null,
    projects: [],
    selectedProjectId: null,
    favoriteProjectIds: [],
    lead: {
      emailCaptured: false,
      emailStatus: "idle",
      phoneStatus: "idle",
      consultationStatus: "idle",
    },
    estimateConfig: { ...DEFAULT_ESTIMATE_CONFIG },
    refinementPrompt: "",
    refinementSuggestions: [],
    refinementPriceImpact: 0,
    projectRefinementHistory: [],
    projectActiveRefinementIndex: 0,
    sourceAsset: null,
    keepLayout: true,
    featuresToKeep: [],
    personalizedConcepts: [],
    personalizedBaseRange: null,
    personalizedRange: null,
    personalizedRefinements: [],
    personalizedRefinementChoiceId: null,
    personalizedRefinementPrompt: "",
    personalizedActiveConceptIndex: 0,
    updatedAt: Date.now(),
  };
}

function EmailGate(props: {
  open: boolean;
  busy: boolean;
  error: string | null;
  project: VisualPricingProject | null;
  routeVersion: AdventureVisualRouteVersion;
  onClose: () => void;
  onSubmit: (email: string, name: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const isMinimal = isMinimalVisualRoute(props.routeVersion);
  if (!props.open || !props.project) return null;
  const title = isMinimal ? "Claim this project" : "Get your pricing";
  const body = isMinimal
    ? "Save this direction and unlock its investment range, what typically goes into it, and the rest of the gallery."
    : "Enter your name and email to see the full price range and what’s included.";
  const cta = isMinimal ? "Claim and view investment" : "See pricing";
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="visual-pricing-email-title">
        <button type="button" className={styles.modalClose} onClick={props.onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className={styles.modalProject}>
          <img src={props.project.imageUrl} alt={props.project.title} />
          <div className={styles.modalProjectIcon} aria-hidden="true"><Mail size={18} /></div>
          <span>{props.project.title}</span>
        </div>
        <h2 id="visual-pricing-email-title">{title}</h2>
        <p>{body}</p>
        {!isMinimal ? (
          <label>
            <span className={styles.fieldLabel}>First name</span>
            <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="given-name" required />
          </label>
        ) : null}
        <label>
          <span className={styles.fieldLabel}>{isMinimal ? "Email address" : "Email"}</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            autoComplete="email"
            required
          />
        </label>
        {props.error ? <div className={styles.formError}>{props.error}</div> : null}
        <button
          type="button"
          className={styles.primaryButton}
          disabled={props.busy || !email.trim() || (!isMinimal && !name.trim())}
          onClick={() => props.onSubmit(email, name)}
        >
          {props.busy ? <LoaderCircle className={styles.spin} size={16} /> : <LockKeyhole size={16} />}
          {cta}
        </button>
        <small className={styles.privacyNote}>No spam—just your pricing.</small>
      </div>
    </div>
  );
}

function PhoneGate(props: {
  open: boolean;
  busy: boolean;
  error: string | null;
  routeVersion: AdventureVisualRouteVersion;
  onClose: () => void;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  const isMinimal = isMinimalVisualRoute(props.routeVersion);
  if (!props.open) return null;
  const title = isMinimal ? "Keep customizing your project" : "Keep designing your project";
  const body = isMinimal
    ? "Unlock more personalized concepts, continued refinements, and updated pricing as you make changes."
    : "Unlock continued revisions, version history, fullscreen concepts, downloads, and updated pricing.";
  const cta = isMinimal ? "Unlock continued refinements" : "Unlock project tools";
  const note = isMinimal
    ? "This unlocks your project workspace. It does not request a consultation."
    : "Your current concept and estimate stay saved if you close this window.";
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="visual-pricing-phone-title">
        <button type="button" className={styles.modalClose} onClick={props.onClose} aria-label="Close">
          <X size={18} />
        </button>
        <div className={styles.modalIcon}><Phone size={21} /></div>
        <h2 id="visual-pricing-phone-title">{title}</h2>
        <p>{body}</p>
        <label>
          <span className={styles.fieldLabel}>{isMinimal ? "Mobile number" : "Phone number"}</span>
          <input value={phone} onChange={(event) => setPhone(event.target.value)} type="tel" autoComplete="tel" />
        </label>
        {props.error ? <div className={styles.formError}>{props.error}</div> : null}
        <button
          type="button"
          className={styles.primaryButton}
          disabled={props.busy || phone.replace(/\D/g, "").length < 10}
          onClick={() => props.onSubmit(phone)}
        >
          {props.busy ? <LoaderCircle className={styles.spin} size={16} /> : <Sparkles size={16} />}
          {cta}
        </button>
        <small className={styles.privacyNote}>{note}</small>
      </div>
    </div>
  );
}

function ProjectCard(props: {
  project: VisualPricingProject;
  index: number;
  unlocked: boolean;
  favorite: boolean;
  routeVersion: AdventureVisualRouteVersion;
  onSelect: () => void;
  onFavorite: () => void;
}) {
  const isMinimal = isMinimalVisualRoute(props.routeVersion);
  return (
    <article className={styles.projectCard} data-shape={["wide", "portrait", "square", "portrait", "portrait", "square", "wide"][props.index % 7]}>
      <button type="button" className={styles.projectSelect} onClick={props.onSelect} aria-label={`View pricing for ${props.project.title}`}>
        <div className={styles.projectImageFrame}>
          <img src={props.project.imageUrl} alt={props.project.title} />
          <span className={styles.budgetFit}><Check size={12} /> {isMinimal ? "Common at this level" : "In budget"}</span>
          <div className={styles.projectImageMeta}>
            <h3>{props.project.title}</h3>
            <div className={styles.cardPriceRow}>
              {props.unlocked ? (
                <strong className={styles.priceVisible}>{projectRangeText(props.project)}</strong>
              ) : (
                <strong className={styles.priceLocked} aria-label="Estimated price hidden">
                  <LockKeyhole size={11} />
                  <em>Est. price</em>
                  <span className={styles.lockedAmount} aria-hidden="true"><i /><i /></span>
                </strong>
              )}
              <span className={styles.cardCta}>{props.unlocked ? "Details" : "View pricing"} <ArrowRight size={14} /></span>
            </div>
          </div>
        </div>
      </button>
      {props.unlocked ? (
        <button
          type="button"
          className={styles.favoriteButton}
          data-favorite={props.favorite ? "true" : "false"}
          onClick={props.onFavorite}
          aria-label={props.favorite ? `Remove ${props.project.title} from favorites` : `Save ${props.project.title}`}
        >
          <Heart size={16} fill={props.favorite ? "currentColor" : "none"} />
        </button>
      ) : null}
    </article>
  );
}

function SelectionBubbles({ items }: { items: Array<string | null | undefined> }) {
  const selections = Array.from(new Set(items.map((item) => item?.trim()).filter((item): item is string => Boolean(item))));
  if (selections.length === 0) return null;
  return (
    <div className={styles.selectionBubbles} aria-label="Your selections">
      {selections.map((selection) => <span key={selection}>{selection}</span>)}
    </div>
  );
}

function IterationMeter({ count, unlocked, limit = FREE_PERSONALIZED_REFINEMENTS }: { count: number; unlocked: boolean; limit?: number }) {
  const used = Math.min(count, limit);
  const requiresPhone = !unlocked && (limit === 0 || count >= limit);
  return (
    <span
      className={styles.iterationMeter}
      data-unlocked={unlocked ? "true" : "false"}
      aria-label={unlocked
        ? `${count} refinements made; continued refinements unlocked`
        : requiresPhone
          ? "Your free refinements are used; add a phone number to continue refining"
        : `${used} of ${limit} refinements used`}
    >
      <span>Refinements</span>
      <small>{unlocked ? count : requiresPhone ? "Phone to continue" : `${used}/${limit}`}</small>
    </span>
  );
}

export function AdventureV3VisualPricingExperience({
  instanceId,
  initialInstanceData,
  initialDesignConfig,
  routeVersion = "v3",
}: Props) {
  const isMinimalRoute = isMinimalVisualRoute(routeVersion);
  const [instance, setInstance] = useState<any>(initialInstanceData || null);
  const [design, setDesign] = useState<DesignSettings>(() =>
    withWidgetDesignDefaults(initialDesignConfig || initialInstanceData?.config || {}, initialInstanceData?.name)
  );
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [snapshot, setSnapshot] = useState<VisualPricingSnapshot | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogNonce, setCatalogNonce] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [personalizedRefinementBusy, setPersonalizedRefinementBusy] = useState(false);
  const [projectRefinementBusy, setProjectRefinementBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [pendingPhoneAction, setPendingPhoneAction] = useState<PendingPhoneAction | null>(null);
  const [fullscreenAsset, setFullscreenAsset] = useState<{ imageUrl: string; label: string } | null>(null);
  const [selectedRefinementCategoryId, setSelectedRefinementCategoryId] = useState<string | null>(null);
  const [refinementMode, setRefinementMode] = useState<"vision" | "parts" | "describe">(() => isMinimalVisualRoute(routeVersion) ? "vision" : "parts");
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);

  const selectedService = useMemo(
    () => services.find((service) => service.value === snapshot?.selectedServiceId) || null,
    [services, snapshot?.selectedServiceId]
  );
  const selectedBudget = budgetBandById(snapshot?.budgetBandId || null);
  const selectedScopes = useMemo(() => scopesForService(selectedService), [selectedService]);
  const selectedProject = useMemo(
    () => snapshot?.projects.find((project) => project.assetId === snapshot.selectedProjectId) || null,
    [snapshot?.projects, snapshot?.selectedProjectId]
  );
  const bounds = useMemo(() => configuredPricingBounds(instance), [instance]);
  const components = useMemo(() => {
    const configured = (selectedService?.subcategoryComponents || [])
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((component) => component.label)
      .filter(Boolean)
      .slice(0, 5);
    return configured.length > 0
      ? configured
      : ["Main fixtures", "Flooring", "Windows and doors", "Existing cabinetry"];
  }, [selectedService]);

  const patchSnapshot = useCallback((patch: Partial<VisualPricingSnapshot>) => {
    setSnapshot((previous) => previous ? { ...previous, ...patch, updatedAt: Date.now() } : previous);
  }, []);

  const track = useCallback((eventType: string, payload: Record<string, unknown> = {}, requestId?: string | null) => {
    if (!snapshot?.sessionId) return;
    emitTelemetry({
      sessionId: snapshot.sessionId,
      instanceId,
      eventType,
      modelRequestId: requestId || undefined,
      payload: {
        ...payload,
        experienceVersion: "v3",
        experience_version: "v3",
        experiment: "visual_pricing_two_stage",
      },
    });
  }, [instanceId, snapshot?.sessionId]);

  const resetExperience = useCallback((source: "in_form" | "designer_refresh") => {
    clearVisualPricingSnapshot(instanceId, routeVersion);
    const sessionId = getOrCreateVisualPricingSession(instanceId, routeVersion);
    const implicit = services.length === 1 ? services[0] : null;
    setSnapshot(defaultSnapshot(sessionId, implicit));
    setError(null);
    setEmailOpen(false);
    setPhoneOpen(false);
    track("adventure_v3_visual_pricing_restarted", { source });
  }, [instanceId, routeVersion, services, track]);

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      let shouldStartFresh = false;
      let hintedServiceId = "";
      try {
        const params = new URLSearchParams(window.location.search);
        hintedServiceId = params.get("serviceId") || params.get("service_id") || "";
        const freshRequested = params.get("fresh") === "1" || params.get("fresh") === "true";
        const freshNonce = params.get("freshNonce") || "";
        if (freshRequested && freshNonce) {
          const markerKey = `adventure:${routeVersion}:visual-fresh-consumed:${instanceId}`;
          shouldStartFresh = window.sessionStorage.getItem(markerKey) !== freshNonce;
          if (shouldStartFresh) window.sessionStorage.setItem(markerKey, freshNonce);
        }
      } catch {}
      if (shouldStartFresh) clearVisualPricingSnapshot(instanceId, routeVersion);
      const sessionId = getOrCreateVisualPricingSession(instanceId, routeVersion);
      const saved = shouldStartFresh ? null : loadVisualPricingSnapshot(instanceId, routeVersion);
      try {
        const response = await fetch(`/api/widget/${encodeURIComponent(instanceId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load visual pricing.");
        const data = await response.json();
        if (cancelled) return;
        const nextInstance = data?.instance || initialInstanceData || {};
        const nextServices = normalizeServices(data?.serviceOptions);
        const normalizedServices = nextServices.length > 0
          ? nextServices
          : [{
              value: "general-service",
              label: String(nextInstance?.name || "Your project"),
              serviceName: String(nextInstance?.name || "Your project"),
              serviceSummary: nextInstance?.service_summary || nextInstance?.company_summary || null,
            } satisfies ServiceOption];
        setInstance(nextInstance);
        setDesign((previous) => withWidgetDesignDefaults(nextInstance?.config || previous, nextInstance?.name));
        setServices(normalizedServices);
        const savedService = normalizedServices.find((service) => service.value === saved?.selectedServiceId);
        const hinted = normalizedServices.find((service) =>
          service.value === hintedServiceId || service.label.toLowerCase() === hintedServiceId.toLowerCase()
        );
        const implicit = hinted || savedService || (normalizedServices.length === 1 ? normalizedServices[0] : null);
        setSnapshot(saved && savedService ? {
          ...saved,
          estimateConfig: saved.estimateConfig || { ...DEFAULT_ESTIMATE_CONFIG },
          refinementPrompt: saved.refinementPrompt || "",
          refinementSuggestions: Array.isArray(saved.refinementSuggestions) ? saved.refinementSuggestions : [],
          refinementPriceImpact: Number(saved.refinementPriceImpact) || 0,
          projectRefinementHistory: Array.isArray(saved.projectRefinementHistory) ? saved.projectRefinementHistory : [],
          projectActiveRefinementIndex: Math.max(0, Math.min(
            typeof saved.projectActiveRefinementIndex === "number"
              ? saved.projectActiveRefinementIndex
              : (Array.isArray(saved.projectRefinementHistory) ? saved.projectRefinementHistory.length : 0),
            Array.isArray(saved.projectRefinementHistory) ? saved.projectRefinementHistory.length : 0
          )),
          personalizedConcepts: Array.isArray(saved.personalizedConcepts) ? saved.personalizedConcepts : [],
          personalizedBaseRange: saved.personalizedBaseRange || saved.personalizedRange || null,
          personalizedRefinements: Array.isArray(saved.personalizedRefinements) ? saved.personalizedRefinements : [],
          personalizedRefinementChoiceId: saved.personalizedRefinementChoiceId || null,
          personalizedRefinementPrompt: saved.personalizedRefinementPrompt || "",
          personalizedActiveConceptIndex: Math.max(0, Math.min(
            typeof saved.personalizedActiveConceptIndex === "number"
              ? saved.personalizedActiveConceptIndex
              : Math.max(0, (Array.isArray(saved.personalizedConcepts) ? saved.personalizedConcepts.length : 1) - 1),
            Math.max(0, (Array.isArray(saved.personalizedConcepts) ? saved.personalizedConcepts.length : 1) - 1)
          )),
        } : defaultSnapshot(sessionId, implicit));
      } catch (bootstrapError) {
        if (!cancelled) setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to load visual pricing.");
      }
    }
    void bootstrap();
    return () => { cancelled = true; };
  }, [initialInstanceData, instanceId, routeVersion]);

  useEffect(() => {
    if (!snapshot) return;
    saveVisualPricingSnapshot(instanceId, snapshot, routeVersion);
  }, [instanceId, routeVersion, snapshot]);

  useEffect(() => {
    if (!snapshot?.stage || snapshot.stage === "loading") return;
    rootRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [snapshot?.stage]);

  useEffect(() => {
    if (!snapshot?.sessionId) return;
    track("adventure_experience_started", { routeVersion, funnel: "visual_pricing" });
  }, [routeVersion, snapshot?.sessionId, track]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.parent?.postMessage({ type: "FORM_READY", version: routeVersion }, "*");
      window.parent?.postMessage({ type: "WIDGET_READY", surface: "form", version: routeVersion }, "*");
    } catch {}
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "SIF_RESET_SESSION" || event.data.type === "RESET_SESSION") {
        resetExperience("designer_refresh");
        try { window.parent?.postMessage({ type: "RESET_SESSION_ACK", version: routeVersion }, event.origin || "*"); } catch {}
      }
      if (event.data.type === "UPDATE_CONFIG" && event.data.config && typeof event.data.config === "object") {
        setDesign(withWidgetDesignDefaults(event.data.config, instance?.name));
        try { window.parent?.postMessage({ type: "UPDATE_CONFIG_ACK", version: routeVersion }, event.origin || "*"); } catch {}
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [instance?.name, resetExperience, routeVersion]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      try {
        window.parent?.postMessage({
          type: "ADVENTURE_RESIZE",
          instanceId,
          phase: snapshot?.stage || "project",
          height: Math.ceil(root.scrollHeight),
          version: routeVersion,
        }, "*");
      } catch {}
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [instanceId, routeVersion, snapshot?.stage]);

  useEffect(() => {
    if (
      snapshot?.stage !== "gallery" ||
      !selectedService ||
      !selectedBudget
    ) return;
    const scope = snapshot.selectedScope || selectedScopes[0] || "Typical project";
    let cancelled = false;
    setCatalogBusy(snapshot.projects.length === 0);
    setError(null);
    const params = new URLSearchParams({ serviceId: selectedService.value });
    params.append("scope", scope);
    params.set("catalogRevision", VISUAL_CATALOG_REVISION);
    const catalogUrl = `/api/v3/ai-form/${encodeURIComponent(instanceId)}/visual-projects?${params.toString()}`;
    const loadCatalog = async () => {
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
          const response = await fetch(catalogUrl, { cache: "no-store" });
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error || "Unable to load projects.");
          const rawProjects = Array.isArray(data?.projects) ? data.projects as RawVisualProject[] : [];
          const projects = buildVisualProjects({
            rawProjects,
            service: selectedService,
            budgetBand: selectedBudget,
            bounds,
            budgetMode: isMinimalVisualRoute(routeVersion) ? "lens" : "constraint",
          });
          if (projects.length === 0) throw new Error("No visual projects are available for this service yet.");
          return projects;
        } catch (catalogError) {
          lastError = catalogError instanceof Error ? catalogError : new Error("Unable to load projects.");
          if (attempt < 2) await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)));
        }
      }
      throw lastError || new Error("Unable to load projects.");
    };
    void loadCatalog()
      .then((projects) => {
        if (!cancelled) patchSnapshot({ projects });
      })
      .catch((catalogError) => {
        if (!cancelled) setError(catalogError instanceof Error ? catalogError.message : "Unable to load projects.");
      })
      .finally(() => { if (!cancelled) setCatalogBusy(false); });
    return () => { cancelled = true; };
  }, [bounds, catalogNonce, instanceId, patchSnapshot, selectedBudget, selectedScopes, selectedService, snapshot?.selectedScope, snapshot?.stage]);

  const chooseService = useCallback((service: ServiceOption) => {
    if (!snapshot) return;
    setSnapshot(defaultSnapshot(snapshot.sessionId, service, false));
    track("adventure_v3_project_selected", { serviceId: service.value, serviceName: service.label });
  }, [snapshot, track]);

  const chooseScope = useCallback((scope: string) => {
    patchSnapshot({
      selectedScope: scope,
      budgetBandId: null,
      projects: [],
      selectedProjectId: null,
      projectRefinementHistory: [],
      projectActiveRefinementIndex: 0,
      stage: "budget",
    });
    track("adventure_v3_scope_selected", { serviceId: selectedService?.value, scope });
  }, [patchSnapshot, selectedService?.value, track]);

  const chooseBudget = useCallback((band: BudgetBand) => {
    patchSnapshot({
      budgetBandId: band.id,
      projects: [],
      selectedProjectId: null,
      stage: "gallery",
      personalizedConcepts: [],
      personalizedBaseRange: null,
      personalizedRange: null,
      personalizedRefinements: [],
      personalizedRefinementChoiceId: null,
      personalizedRefinementPrompt: "",
      personalizedActiveConceptIndex: 0,
      sourceAsset: null,
      estimateConfig: { ...DEFAULT_ESTIMATE_CONFIG },
      refinementPrompt: "",
      refinementSuggestions: [],
      refinementPriceImpact: 0,
      projectRefinementHistory: [],
      projectActiveRefinementIndex: 0,
    });
    track("adventure_v3_budget_selected", { budgetBandId: band.id, budgetLabel: band.label });
  }, [patchSnapshot, track]);

  const selectProject = useCallback((project: VisualPricingProject) => {
    if (!snapshot) return;
    setSelectedRefinementCategoryId(null);
    setRefinementMode(isMinimalVisualRoute(routeVersion) ? "vision" : "parts");
    patchSnapshot({
      selectedProjectId: project.assetId,
      estimateConfig: { ...DEFAULT_ESTIMATE_CONFIG },
      refinementPrompt: "",
      refinementSuggestions: [],
      refinementPriceImpact: 0,
      projectRefinementHistory: [],
      projectActiveRefinementIndex: 0,
      personalizedConcepts: [],
      personalizedBaseRange: null,
      personalizedRange: null,
      personalizedRefinements: [],
      personalizedRefinementChoiceId: null,
      personalizedRefinementPrompt: "",
      personalizedActiveConceptIndex: 0,
    });
    track("adventure_v3_visual_project_selected", {
      assetId: project.assetId,
      scope: project.scope,
      budgetBandId: snapshot.budgetBandId,
    }, project.assetId);
    if (snapshot.lead.emailCaptured) patchSnapshot({
      selectedProjectId: project.assetId,
      stage: "details",
      estimateConfig: { ...DEFAULT_ESTIMATE_CONFIG },
      refinementPrompt: "",
      refinementSuggestions: [],
      refinementPriceImpact: 0,
      projectRefinementHistory: [],
      projectActiveRefinementIndex: 0,
      personalizedConcepts: [],
      personalizedBaseRange: null,
      personalizedRange: null,
      personalizedRefinements: [],
      personalizedRefinementChoiceId: null,
      personalizedRefinementPrompt: "",
      personalizedActiveConceptIndex: 0,
    });
    else setEmailOpen(true);
  }, [patchSnapshot, routeVersion, snapshot, track]);

  const toggleFavorite = useCallback((projectId: string) => {
    if (!snapshot?.lead.emailCaptured) return;
    const favorite = snapshot.favoriteProjectIds.includes(projectId);
    patchSnapshot({
      favoriteProjectIds: favorite
        ? snapshot.favoriteProjectIds.filter((id) => id !== projectId)
        : [...snapshot.favoriteProjectIds, projectId],
    });
    track(favorite ? "adventure_v3_favorite_removed" : "adventure_v3_favorite_added", { projectId });
  }, [patchSnapshot, snapshot, track]);

  const sendPricingEmail = useCallback(async (submissionId: string, project: VisualPricingProject) => {
    try {
      const response = await fetch("/api/v2/leads/results-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          instanceId,
          serviceName: selectedService?.label || project.serviceLabel,
          scope: project.scope,
          canvasUrl: project.imageUrl,
          pricing: {
            totalMin: project.priceMin,
            totalMax: project.priceMax,
            currency: project.currency,
            source: "v3_visual_pricing",
          },
          assumptions: project.assumptions,
        }),
      });
      return response.ok;
    } catch {
      return false;
    }
  }, [instanceId, selectedService?.label]);

  const captureEmail = useCallback(async (email: string, name: string) => {
    if (!snapshot || !selectedService || !selectedBudget || !selectedProject) return;
    setEmailBusy(true);
    setEmailError(null);
    try {
      const response = await fetch("/api/v3/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          sessionId: snapshot.sessionId,
          email,
          name,
          submissionData: {
            experienceVersion: "v3",
            experiment: "visual_pricing_two_stage",
            service: selectedService,
            budgetBand: selectedBudget,
            selectedProject,
            visualPricingGallery: snapshot.projects.map((project) => ({
              assetId: project.assetId,
              title: project.title,
              scope: project.scope,
              priceMin: project.priceMin,
              priceMax: project.priceMax,
            })),
          },
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.submissionId) throw new Error(data?.error || "Unable to unlock pricing.");
      const submissionId = String(data.submissionId);
      setSnapshot((previous) => previous ? {
        ...previous,
        stage: "details",
        lead: {
          ...previous.lead,
          emailCaptured: true,
          submissionId,
          email,
          name,
          emailStatus: "sending",
        },
        updatedAt: Date.now(),
      } : previous);
      setEmailOpen(false);
      track("adventure_v3_email_captured", { submissionId, projectId: selectedProject.assetId }, submissionId);
      void (async () => {
        const sent = await sendPricingEmail(submissionId, selectedProject);
        setSnapshot((previous) => previous ? {
          ...previous,
          lead: { ...previous.lead, emailStatus: sent ? "sent" : "failed" },
          updatedAt: Date.now(),
        } : previous);
        track(sent ? "adventure_v3_results_email_sent" : "adventure_v3_results_email_failed", { submissionId }, submissionId);
      })();
    } catch (captureError) {
      setEmailError(captureError instanceof Error ? captureError.message : "Unable to unlock pricing.");
    } finally {
      setEmailBusy(false);
    }
  }, [instanceId, selectedBudget, selectedProject, selectedService, sendPricingEmail, snapshot, track]);

  const uploadRoom = useCallback(async (file: File, advanceToPersonalize = false) => {
    if (!snapshot) return;
    setUploadBusy(true);
    setError(null);
    try {
      const image = await readFileAsDataUrl(file);
      const response = await fetch(`/api/v2/assets/${encodeURIComponent(instanceId)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: snapshot.sessionId, kind: "scene", image }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.asset?.url) throw new Error(data?.error || "Unable to upload that photo.");
      const asset = data.asset as StableAsset;
      patchSnapshot({
        sourceAsset: asset,
        personalizedConcepts: [],
        personalizedBaseRange: null,
        personalizedRange: null,
        personalizedRefinements: [],
        personalizedRefinementChoiceId: null,
        personalizedRefinementPrompt: "",
        personalizedActiveConceptIndex: 0,
        ...(advanceToPersonalize ? { stage: "personalize" as const } : {}),
      });
      track("adventure_v3_personalization_photo_uploaded", { assetId: asset.assetId }, asset.assetId);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Unable to upload that photo.");
    } finally {
      setUploadBusy(false);
    }
  }, [instanceId, patchSnapshot, snapshot, track]);

  const refineSelectedProject = useCallback(async (bypassGate = false) => {
    if (!snapshot || !selectedService || !selectedProject || projectRefinementBusy) return;
    const instructions = [
      ...snapshot.refinementSuggestions,
      snapshot.refinementPrompt.trim(),
    ].filter(Boolean);
    if (instructions.length === 0) return;
    if (
      !bypassGate
      && snapshot.lead.phoneStatus !== "unlocked"
      && routeVersion === "v3"
      && snapshot.projectRefinementHistory.length >= FREE_PERSONALIZED_REFINEMENTS
    ) {
      setPendingPhoneAction({ kind: "project-refinement" });
      setPhoneError(null);
      setPhoneOpen(true);
      track("adventure_v3_project_refinement_gate_viewed", {
        projectId: selectedProject.assetId,
        refinementCount: snapshot.projectRefinementHistory.length,
      });
      return;
    }

    setProjectRefinementBusy(true);
    setError(null);
    try {
      const estimateConfig = snapshot.estimateConfig || DEFAULT_ESTIMATE_CONFIG;
      const activeIndex = Math.max(0, Math.min(
        snapshot.projectActiveRefinementIndex,
        snapshot.projectRefinementHistory.length
      ));
      const activeHistory = snapshot.projectRefinementHistory.slice(0, activeIndex);
      const priorChanges = activeHistory.map((entry) => entry.changeLabel || "").filter(Boolean);
      const configuredRange = configuredProjectRange(selectedProject, estimateConfig, {
        suggestions: [...priorChanges, ...snapshot.refinementSuggestions],
        prompt: snapshot.refinementPrompt,
        priceImpact: snapshot.refinementSuggestions.length > 0 ? snapshot.refinementPriceImpact : undefined,
      });
      const budgetMidpoint = Math.round((configuredRange.totalMin + configuredRange.totalMax) / 2);
      const currentImageUrl = activeIndex > 0
        ? snapshot.projectRefinementHistory[activeIndex - 1]?.imageUrl || selectedProject.imageUrl
        : selectedProject.imageUrl;
      const prompt = [
        "Refine this exact project concept without changing the camera position, room envelope, openings, or recognizable layout.",
        `Project: ${selectedProject.title}. Scope: ${selectedProject.scope}.`,
        `Apply these requested design changes: ${instructions.join("; ")}.`,
        `Use a ${estimateConfig.finishLevel} finish level, ${estimateConfig.scopeLevel} project coverage, and ${estimateConfig.sourcing} materials.`,
        "Keep the result cohesive, realistic, residential, and buildable. Change only what the request requires. No people, text, or logos.",
      ].join(" ");
      const response = await fetch(`/api/v2/ai-form/${encodeURIComponent(instanceId)}/canvas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "edit",
          sessionId: snapshot.sessionId,
          serviceId: selectedService.value,
          serviceName: selectedService.label,
          industryName: selectedService.industryName,
          serviceSummary: selectedService.serviceSummary,
          components: selectedService.subcategoryComponents,
          scope: selectedProject.scope,
          budget: budgetMidpoint,
          experienceMode: "scene",
          sourceAssets: { scene: { url: currentImageUrl } },
          currentCanvasUrl: currentImageUrl,
          prompt,
          modelId: PERSONALIZATION_MODEL_ID,
          generationIntent: "v3_concept",
          priorChanges,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.canvas?.imageUrl) throw new Error(data?.error || "Unable to refine this design.");
      const canvas = data.canvas as StarterCanvas;
      const historyEntry: PricedCanvasHistoryEntry = {
        ...canvas,
        changeLabel: instructions.join(" · "),
        planningRange: {
          totalMin: configuredRange.totalMin,
          totalMax: configuredRange.totalMax,
          currency: configuredRange.currency,
        },
        designInstruction: {
          mode: "whole_design",
          directionLabel: selectedProject.title,
          customInstruction: instructions.join("; "),
          readableSummary: instructions.join(" · "),
        },
      };
      setSnapshot((previous) => previous ? {
        ...previous,
        projectRefinementHistory: [
          ...(previous.projectRefinementHistory || []).slice(0, activeIndex),
          historyEntry,
        ],
        projectActiveRefinementIndex: activeIndex + 1,
        refinementPrompt: "",
        refinementSuggestions: [],
        refinementPriceImpact: 0,
        updatedAt: Date.now(),
      } : previous);
      track("adventure_v3_project_refined", {
        projectId: selectedProject.assetId,
        refinementCount: activeIndex + 1,
        priceMultiplier: configuredRange.multiplier,
      }, canvas.predictionId || canvas.assetId);
    } catch (refinementError) {
      const message = refinementError instanceof Error ? refinementError.message : "";
      setError(
        /image generation failed|could not create a result|returned no usable image/i.test(message)
          ? "We couldn’t create that version. Try again or simplify the request."
          : message || "Unable to refine this design."
      );
    } finally {
      setProjectRefinementBusy(false);
    }
  }, [instanceId, projectRefinementBusy, routeVersion, selectedProject, selectedService, snapshot, track]);

  const requestPersonalizedCanvas = useCallback(async (
    variant: string,
    options: {
      currentCanvasUrl?: string;
      instructions?: string[];
      priorChanges?: string[];
    } = {}
  ): Promise<CanvasHistoryEntry> => {
    if (!snapshot?.sourceAsset || !selectedService || !selectedProject) throw new Error("Upload a photo first.");
    const estimateConfig = snapshot.estimateConfig || DEFAULT_ESTIMATE_CONFIG;
    const configuredRange = configuredProjectRange(selectedProject, estimateConfig, {
      suggestions: snapshot.refinementSuggestions,
      prompt: snapshot.refinementPrompt,
      priceImpact: snapshot.refinementSuggestions.length > 0 ? snapshot.refinementPriceImpact : undefined,
    });
    const budgetMidpoint = Math.round((configuredRange.totalMin + configuredRange.totalMax) / 2);
    const refinementInstructions = options.instructions || [
      ...snapshot.refinementSuggestions,
      snapshot.refinementPrompt.trim(),
    ].filter(Boolean);
    const currentCanvasUrl = options.currentCanvasUrl || snapshot.sourceAsset.url;
    const isRevision = Boolean(options.currentCanvasUrl);
    const prompt = [
      isRevision
        ? `Edit the supplied current personalized ${selectedService.label.toLowerCase()} concept. Preserve everything except the requested change.`
        : `Apply the coordinated look and material language of the supplied reference project to this exact uploaded ${selectedService.label.toLowerCase()} space.`,
      `Target project: ${selectedProject.title}. Scope: ${selectedProject.scope}.`,
      estimateConfig.layoutPlan === "keep" && snapshot.keepLayout
        ? "Keep the current room layout, camera position, perspective, walls, openings, plumbing locations, and recognizable architecture exactly intact."
        : "The layout may be improved where necessary, but preserve the camera position, outer room envelope, openings, and recognizable architecture.",
      `Use a ${estimateConfig.finishLevel} finish level, ${estimateConfig.scopeLevel} project coverage, and ${estimateConfig.sourcing} materials.`,
      snapshot.featuresToKeep.length > 0
        ? `Preserve these existing features: ${snapshot.featuresToKeep.join(", ")}.`
        : "Preserve every unrelated feature outside the selected project scope.",
      refinementInstructions.length > 0
        ? `Apply these user refinements: ${refinementInstructions.join("; ")}.`
        : "Refine the design with a cohesive, service-appropriate result.",
      `Create a ${variant} interpretation using realistic, buildable residential materials. No people, text, logos, or a different room.`,
    ].join(" ");
    const response = await fetch(`/api/v2/ai-form/${encodeURIComponent(instanceId)}/canvas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "edit",
        sessionId: snapshot.sessionId,
        serviceId: selectedService.value,
        serviceName: selectedService.label,
        industryName: selectedService.industryName,
        serviceSummary: selectedService.serviceSummary,
        components: selectedService.subcategoryComponents,
        scope: selectedProject.scope,
        budget: budgetMidpoint,
        experienceMode: "scene",
        sourceAssets: { scene: snapshot.sourceAsset },
        currentCanvasUrl,
        referenceProjectImageUrl: snapshot.projectRefinementHistory.at(-1)?.imageUrl || selectedProject.imageUrl,
        prompt,
        modelId: PERSONALIZATION_MODEL_ID,
        generationIntent: "v3_personalized_preview",
        priorChanges: options.priorChanges || [],
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.canvas?.imageUrl) throw new Error(data?.error || "Unable to personalize that space.");
    const canvas = data.canvas as StarterCanvas;
    return {
      ...canvas,
      changeLabel: variant,
      designInstruction: {
        mode: "finished_version",
        directionLabel: selectedProject.title,
        versionId: variant.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
        preserve: snapshot.featuresToKeep,
        layoutConstraints: snapshot.keepLayout ? ["Keep existing layout"] : [],
        readableSummary: `${selectedProject.title} · ${variant}`,
      },
    };
  }, [instanceId, selectedProject, selectedService, snapshot]);

  const generatePreview = useCallback(async () => {
    if (!snapshot?.sourceAsset || !selectedProject || previewBusy) return;
    setPreviewBusy(true);
    setError(null);
    try {
      const preview = await requestPersonalizedCanvas("Balanced personalized preview");
      const configuredRange = configuredProjectRange(
        selectedProject,
        snapshot.estimateConfig || DEFAULT_ESTIMATE_CONFIG,
        {
          suggestions: snapshot.refinementSuggestions,
          prompt: snapshot.refinementPrompt,
          priceImpact: snapshot.refinementSuggestions.length > 0 ? snapshot.refinementPriceImpact : undefined,
        }
      );
      const personalizedRange = personalizedProjectRange({
        ...selectedProject,
        priceMin: configuredRange.totalMin,
        priceMax: configuredRange.totalMax,
      }, snapshot.keepLayout && (snapshot.estimateConfig?.layoutPlan || "keep") === "keep");
      patchSnapshot({
        personalizedConcepts: [preview],
        personalizedBaseRange: personalizedRange,
        personalizedRange,
        personalizedRefinements: [],
        personalizedRefinementChoiceId: null,
        personalizedRefinementPrompt: "",
        personalizedActiveConceptIndex: 0,
        stage: "personalized-preview",
      });
      track("adventure_v3_personalized_preview_ready", {
        projectId: selectedProject.assetId,
        modelId: preview.modelId,
      }, preview.predictionId || preview.assetId);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : "Unable to personalize that space.");
    } finally {
      setPreviewBusy(false);
    }
  }, [patchSnapshot, previewBusy, requestPersonalizedCanvas, selectedProject, snapshot, track]);

  const applyPersonalizedRefinement = useCallback(async (bypassGate = false) => {
    if (!snapshot || !selectedProject || personalizedRefinementBusy) return;
    const activeConceptIndex = Math.max(0, Math.min(
      snapshot.personalizedActiveConceptIndex,
      snapshot.personalizedConcepts.length - 1
    ));
    const activeConcept = snapshot.personalizedConcepts[activeConceptIndex];
    const option = personalizedRefinementOptions(selectedProject)
      .find((item) => item.id === snapshot.personalizedRefinementChoiceId);
    const customPrompt = snapshot.personalizedRefinementPrompt.trim();
    if (!activeConcept || (!option && !customPrompt)) return;

    const refinementCount = snapshot.personalizedRefinements.length;
    const unlocked = snapshot.lead.phoneStatus === "unlocked";
    // V4 reveals one personalized concept before asking for a phone number.
    // From there, every additional personalized revision is a phone-unlocked tool.
    const refinementLimit = isMinimalVisualRoute(routeVersion) ? 0 : FREE_PERSONALIZED_REFINEMENTS;
    if (!bypassGate && !unlocked && refinementCount >= refinementLimit) {
      setPhoneError(null);
      setPendingPhoneAction({ kind: "personalized-refinement" });
      setPhoneOpen(true);
      track("adventure_v3_personalized_refinement_gate_viewed", {
        projectId: selectedProject.assetId,
        refinementCount,
        gateAtRefinement: refinementLimit + 1,
      });
      return;
    }

    const instructions = [option?.instruction, customPrompt].filter((item): item is string => Boolean(item));
    const priceImpact = Math.max(-0.18, Math.min(0.2,
      (option?.priceImpact || 0) + customRefinementPriceImpact(customPrompt)
    ));
    const currentRange = personalizedRangeAt(snapshot, activeConceptIndex);
    setPersonalizedRefinementBusy(true);
    setError(null);
    try {
      const nextNumber = activeConceptIndex + 1;
      const revision = await requestPersonalizedCanvas(`Refinement ${nextNumber}`, {
        currentCanvasUrl: activeConcept.imageUrl,
        instructions,
        priorChanges: snapshot.personalizedRefinements.slice(0, activeConceptIndex).map((item) => item.instruction),
      });
      const nextRange = currentRange ? adjustedPersonalizedRange(currentRange, priceImpact) : null;
      const record: PersonalizedRefinementRecord = {
        id: `${Date.now()}-${nextNumber}`,
        label: [option?.label, customPrompt].filter(Boolean).join(" · "),
        instruction: instructions.join(" "),
        priceImpact,
        resultingRange: nextRange,
        createdAt: Date.now(),
      };
      setSnapshot((previous) => {
        if (!previous) return previous;
        const baseConcepts = previous.personalizedConcepts.slice(0, activeConceptIndex + 1);
        const baseRefinements = previous.personalizedRefinements.slice(0, activeConceptIndex);
        return {
          ...previous,
          stage: bypassGate || previous.lead.phoneStatus === "unlocked" ? "personalized-result" : "personalized-preview",
          personalizedConcepts: [...baseConcepts, revision],
          personalizedRange: nextRange || previous.personalizedRange,
          personalizedRefinements: [...baseRefinements, record],
          personalizedRefinementChoiceId: null,
          personalizedRefinementPrompt: "",
          personalizedActiveConceptIndex: baseConcepts.length,
          updatedAt: Date.now(),
        };
      });
      track("adventure_v3_personalized_refinement_ready", {
        projectId: selectedProject.assetId,
        refinementCount: refinementCount + 1,
        priceImpact,
        beforeRange: currentRange,
        afterRange: nextRange,
        phoneUnlocked: unlocked || bypassGate,
      }, revision.predictionId || revision.assetId);
    } catch (refinementError) {
      const message = refinementError instanceof Error ? refinementError.message : "";
      setError(
        /image generation failed|could not create a result|returned no usable image/i.test(message)
          ? "We couldn’t create that revision. Try a simpler change."
          : message || "Unable to refine this project."
      );
    } finally {
      setPersonalizedRefinementBusy(false);
    }
  }, [personalizedRefinementBusy, requestPersonalizedCanvas, routeVersion, selectedProject, snapshot, track]);

  const downloadImage = useCallback(async (imageUrl: string, label: string) => {
    const safeName = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project-design";
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("Download unavailable");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${safeName}.jpg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000);
    } catch {
      const link = document.createElement("a");
      link.href = imageUrl;
      link.target = "_blank";
      link.rel = "noreferrer";
      document.body.appendChild(link);
      link.click();
      link.remove();
    }
  }, []);

  const requestImageAction = useCallback((
    kind: "download" | "fullscreen",
    imageUrl: string,
    label: string
  ) => {
    if (!snapshot) return;
    if (snapshot.lead.phoneStatus !== "unlocked") {
      setPendingPhoneAction({ kind, imageUrl, label });
      setPhoneError(null);
      setPhoneOpen(true);
      track("adventure_v3_project_tool_gate_viewed", { tool: kind, stage: snapshot.stage });
      return;
    }
    if (kind === "fullscreen") setFullscreenAsset({ imageUrl, label });
    else void downloadImage(imageUrl, label);
  }, [downloadImage, snapshot, track]);

  const capturePhone = useCallback(async (phone: string) => {
    if (!snapshot?.lead.submissionId) return;
    setPhoneBusy(true);
    setPhoneError(null);
    try {
      const response = await fetch("/api/v3/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          submissionId: snapshot.lead.submissionId,
          phone,
          intent: "personalized_plan",
          refinementCount: pendingPhoneAction?.kind === "project-refinement"
            ? snapshot.projectRefinementHistory.length
            : snapshot.personalizedRefinements.length,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || "Unable to unlock your personalized plan.");
      setSnapshot((previous) => previous ? {
        ...previous,
        stage: previous.sourceAsset && previous.personalizedConcepts.length > 0
          ? "personalized-result"
          : previous.stage,
        lead: { ...previous.lead, phone, phoneStatus: "unlocked" },
        updatedAt: Date.now(),
      } : previous);
      setPhoneOpen(false);
      const unlockedAction = pendingPhoneAction;
      setPendingPhoneAction(null);
      track("adventure_v3_phone_captured", {
        intent: unlockedAction?.kind || "continued_refinement",
        refinementCount: unlockedAction?.kind === "project-refinement"
          ? snapshot.projectRefinementHistory.length
          : snapshot.personalizedRefinements.length,
      }, snapshot.lead.submissionId);
      if (unlockedAction?.kind === "personalized-refinement") {
        void applyPersonalizedRefinement(true);
      } else if (unlockedAction?.kind === "project-refinement") {
        void refineSelectedProject(true);
      } else if (unlockedAction?.kind === "fullscreen") {
        setFullscreenAsset({ imageUrl: unlockedAction.imageUrl, label: unlockedAction.label });
      } else if (unlockedAction?.kind === "download") {
        void downloadImage(unlockedAction.imageUrl, unlockedAction.label);
      }
    } catch (captureError) {
      setPhoneError(captureError instanceof Error ? captureError.message : "Unable to unlock your personalized plan.");
    } finally {
      setPhoneBusy(false);
    }
  }, [applyPersonalizedRefinement, downloadImage, instanceId, pendingPhoneAction, refineSelectedProject, snapshot, track]);

  const requestConsultation = useCallback(async () => {
    if (!snapshot?.lead.submissionId || !snapshot.lead.phone) return;
    patchSnapshot({ lead: { ...snapshot.lead, consultationStatus: "requesting" } });
    try {
      const response = await fetch("/api/v3/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          submissionId: snapshot.lead.submissionId,
          phone: snapshot.lead.phone,
          intent: "consultation",
        }),
      });
      if (!response.ok) throw new Error("Unable to request expert review.");
      patchSnapshot({ lead: { ...snapshot.lead, consultationStatus: "requested" } });
      track("adventure_v3_consultation_requested", {}, snapshot.lead.submissionId);
    } catch {
      patchSnapshot({ lead: { ...snapshot.lead, consultationStatus: "failed" } });
    }
  }, [instanceId, patchSnapshot, snapshot, track]);

  const goBack = useCallback(() => {
    if (!snapshot) return;
    const fallback: Partial<Record<VisualPricingStage, VisualPricingStage>> = {
      project: "intro",
      scope: services.length > 1 ? "project" : "intro",
      budget: selectedScopes.length > 1 ? "scope" : services.length > 1 ? "project" : "intro",
      gallery: "budget",
      details: "gallery",
      customize: "details",
      personalize: isMinimalVisualRoute(routeVersion) ? "customize" : "details",
      "personalized-preview": "personalize",
      "personalized-result": "personalized-preview",
    };
    const next = fallback[snapshot.stage];
    if (next && next !== snapshot.stage) patchSnapshot({ stage: next });
  }, [patchSnapshot, routeVersion, selectedScopes.length, services.length, snapshot]);

  if (!snapshot || snapshot.stage === "loading") {
    return (
      <div ref={rootRef} className={styles.root} data-adventure-version={routeVersion} data-v3-funnel="visual-pricing">
        <div className={styles.loadingState}><LoaderCircle className={styles.spin} /> Loading visual pricing…</div>
      </div>
    );
  }

  const themedSurface = design.prompt_background_color && design.prompt_background_color !== "transparent"
    ? design.prompt_background_color
    : design.suggestion_background_color || "#ffffff";
  const rootStyle = {
    "--v3-accent": design.primary_color || design.submit_button_background_color || "#172033",
    "--v3-on-accent": design.submit_button_text_color || "#ffffff",
    "--v3-text": design.prompt_text_color || design.brand_name_color || "#172033",
    "--v3-muted": design.prompt_placeholder_color || design.uploader_text_color || "#6f7785",
    "--v3-surface": themedSurface,
    "--v3-soft": design.prompt_input_background_color || design.background_color || "#f1f2f3",
    "--v3-border": design.prompt_border_color || design.suggestion_border_color || "rgba(23, 32, 51, 0.12)",
    "--v3-radius": `${Math.max(0, Number(design.border_radius ?? 14))}px`,
    backgroundColor: design.background_color || "#f7f6f3",
    backgroundImage: design.background_gradient || undefined,
    fontFamily: design.font_family || '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", Arial, sans-serif',
    fontSize: design.base_font_size ? `${design.base_font_size}px` : undefined,
  } as React.CSSProperties;
  const versionClass = (baseClass: string, minimalClass: string) => {
    if (isMinimalRoute) return `${baseClass} ${minimalClass}`;
    return baseClass;
  };
  const progressSteps = routeVersion === "v4"
      ? ["Inspiration", "Investment", "Personalize", "Your space", "Continue"]
      : ["Project", "Budget", "Options", "Your space"];
  const progressIndex = routeVersion === "v4"
      ? snapshot.stage === "details"
        ? 1
        : snapshot.stage === "customize"
          ? 2
          : snapshot.stage === "personalize"
            ? 3
            : snapshot.stage === "personalized-preview" || snapshot.stage === "personalized-result"
              ? 4
              : 0
      : snapshot.stage === "intro" || snapshot.stage === "project" || snapshot.stage === "scope"
        ? 0
        : snapshot.stage === "budget"
          ? 1
          : snapshot.stage === "gallery" || snapshot.stage === "details" || snapshot.stage === "customize"
            ? 2
            : 3;
  const isMinimalCustomizeStage = isMinimalRoute && snapshot.stage === "customize";
  const canGoBack = snapshot.stage !== "intro";
  const primerNextStage = firstQuestionStage(selectedService);
  const primerDescription = routeVersion === "v4"
    ? services.length > 1
      ? "We’ll start with what you need, then use an investment range to curate design inspiration."
      : "We already know the project. One quick investment question will help us curate the right design directions."
    : services.length > 1
      ? "We’ll start with what you need, then narrow the details and budget so the pricing actually fits."
      : selectedScopes.length > 1
        ? `We already know the project type. Next, choose the part of your ${selectedService?.label.toLowerCase() || "project"} you want priced.`
        : "We already know the project. One quick budget question will tailor the designs and pricing you see.";
  const estimateConfig = snapshot.estimateConfig || DEFAULT_ESTIMATE_CONFIG;
  const refinementCategories = selectedProject
    ? refinementComponentsForProject(selectedProject, selectedService)
    : [];
  const selectedRefinementCategory = refinementCategories
    .find((category) => category.id === selectedRefinementCategoryId) || null;
  const refinementThumbnailPool = Array.from(new Set([
    selectedProject?.imageUrl,
    ...snapshot.projects.map((project) => project.imageUrl),
  ].filter((imageUrl): imageUrl is string => Boolean(imageUrl))));
  const refinementThumbnail = (index: number) => refinementThumbnailPool[index % Math.max(1, refinementThumbnailPool.length)] || activeProjectImageUrl;
  const projectActiveIndex = Math.max(0, Math.min(
    snapshot.projectActiveRefinementIndex,
    snapshot.projectRefinementHistory.length
  ));
  const activeProjectEntry = projectActiveIndex > 0
    ? snapshot.projectRefinementHistory[projectActiveIndex - 1]
    : undefined;
  const activeProjectImageUrl = activeProjectEntry?.imageUrl || selectedProject?.imageUrl || "";
  const selectedRefinementOption = selectedRefinementCategory?.options
    .find((option) => snapshot.refinementSuggestions.includes(option.instruction)) || null;
  const hasPendingRefinement = snapshot.refinementSuggestions.length > 0 || Boolean(snapshot.refinementPrompt.trim());
  const activeProjectChanges = snapshot.projectRefinementHistory
    .slice(0, projectActiveIndex)
    .map((entry) => entry.changeLabel || "")
    .filter(Boolean);
  const liveRange = selectedProject
    ? hasPendingRefinement
      ? configuredProjectRange(selectedProject, estimateConfig, {
          suggestions: [...activeProjectChanges, ...snapshot.refinementSuggestions],
          prompt: snapshot.refinementPrompt,
          priceImpact: snapshot.refinementSuggestions.length > 0 ? snapshot.refinementPriceImpact : undefined,
        })
      : storedPlanningRange(activeProjectEntry) || configuredProjectRange(selectedProject, estimateConfig, {
          suggestions: activeProjectChanges,
        })
    : null;
  const liveRangeDelta = liveRange && selectedProject
    ? Math.round((((liveRange.totalMin + liveRange.totalMax) / (selectedProject.priceMin + selectedProject.priceMax)) - 1) * 100)
    : 0;
  const showRangeDelta = liveRangeDelta !== 0 && (!isMinimalRoute || isMinimalCustomizeStage);
  const v4VisionPathsForProject = v4VisionPaths(selectedService);
  const selectedVisionPath = v4VisionPathsForProject
    .find((path) => snapshot.refinementSuggestions.includes(path.instruction)) || null;
  const displayedInvestmentRange = liveRange
    ? investmentRangeText(liveRange)
    : selectedProject
      ? investmentRangeText({
          totalMin: selectedProject.priceMin,
          totalMax: selectedProject.priceMax,
          currency: selectedProject.currency,
        })
      : "";
  const personalizedActiveIndex = Math.max(0, Math.min(
    snapshot.personalizedActiveConceptIndex,
    Math.max(0, snapshot.personalizedConcepts.length - 1)
  ));
  const selectedPreview = snapshot.personalizedConcepts[personalizedActiveIndex] || null;
  const activePersonalizedRange = personalizedRangeAt(snapshot, personalizedActiveIndex);
  const personalizedOptions = selectedProject ? personalizedRefinementOptions(selectedProject) : [];
  const selectedPersonalizedOption = personalizedOptions.find((option) => option.id === snapshot.personalizedRefinementChoiceId);
  const hasPendingPersonalizedRefinement = Boolean(selectedPersonalizedOption || snapshot.personalizedRefinementPrompt.trim());
  const pendingPersonalizedImpact = Math.max(-0.18, Math.min(0.2,
    (selectedPersonalizedOption?.priceImpact || 0) + customRefinementPriceImpact(snapshot.personalizedRefinementPrompt)
  ));
  const personalizedLiveRange = activePersonalizedRange && hasPendingPersonalizedRefinement
    ? adjustedPersonalizedRange(activePersonalizedRange, pendingPersonalizedImpact)
    : activePersonalizedRange;
  const personalizedUnlocked = snapshot.lead.phoneStatus === "unlocked";
  const personalizedRefinementLimit = isMinimalRoute ? 0 : FREE_PERSONALIZED_REFINEMENTS;
  const projectRefinementLimit = routeVersion === "v4"
      ? Number.POSITIVE_INFINITY
      : FREE_PERSONALIZED_REFINEMENTS;
  const projectRefinementGateWillOpen = !personalizedUnlocked
    && Number.isFinite(projectRefinementLimit)
    && snapshot.projectRefinementHistory.length >= projectRefinementLimit;
  const personalizedGateWillOpen = !personalizedUnlocked
    && snapshot.personalizedRefinements.length >= personalizedRefinementLimit;
  const personalizedIterationsRemaining = Math.max(
    0,
    personalizedRefinementLimit - snapshot.personalizedRefinements.length
  );

  return (
    <div ref={rootRef} className={styles.root} style={rootStyle} data-adventure-version={routeVersion} data-v3-funnel="visual-pricing">
      <div className={styles.brandFrame}>
        <BrandHeader config={design} compact />
      </div>
      <main className={styles.shell} data-stage={snapshot.stage}>
        <header className={`${styles.topbar}`} data-primer={snapshot.stage === "intro" ? "true" : "false"}>
          <button type="button" className={styles.iconButton} onClick={goBack} disabled={!canGoBack} aria-label="Go back">
            <ArrowLeft size={18} />
          </button>
          <div className={styles.funnelRail} aria-label={`Step ${progressIndex + 1} of ${progressSteps.length}: ${progressSteps[progressIndex]}`}>
            {progressSteps.map((label, index) => (
              <span key={label} data-state={index < progressIndex ? "done" : index === progressIndex ? "active" : "upcoming"}>
                <i /><b>{label}</b>
              </span>
            ))}
          </div>
          <button type="button" className={`${styles.restartButton}`} onClick={() => resetExperience("in_form")}>
            <RotateCcw size={14} /> <span>Start over</span>
          </button>
        </header>

        {snapshot.stage === "intro" ? (
          <section className={styles.primerStep}>
            <div className={styles.primerContent}>
              <span className={styles.primerKicker}>Before we begin</span>
              <h1>Before we price it, we need a little context.</h1>
              <p>{primerDescription}</p>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => {
                  patchSnapshot({ stage: primerNextStage });
                  track("adventure_v3_primer_completed", {
                    nextStage: primerNextStage,
                    servicePreselected: Boolean(selectedService),
                  });
                }}
              >
                Start my estimate <ArrowRight size={16} />
              </button>
              <small>About a minute · no measurements needed</small>
            </div>
          </section>
        ) : null}

        {snapshot.stage === "project" ? (
          <section className={`${styles.narrowStep} ${styles.choiceStep}`}>
            <h1>What are you planning?</h1>
            <p>Choose the closest option to see relevant examples and pricing.</p>
            <div className={`${styles.choiceGrid}`}>
              {services.map((service) => (
                <button key={service.value} type="button" className={`${styles.choiceCard}`} onClick={() => chooseService(service)}>
                  <strong>{service.label}</strong><ArrowRight size={18} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "scope" ? (
          <section className={`${styles.narrowStep} ${styles.choiceStep}`}>
            <div className={styles.sectionIntro}>
              <div>
                <h1>What do you need?</h1>
                <p>Choose the closest option.</p>
              </div>
              <SelectionBubbles items={[selectedService?.label]} />
            </div>
            <div className={`${styles.choiceGrid}`}>
              {selectedScopes.map((scope) => (
                <button key={scope} type="button" className={`${styles.choiceCard}`} onClick={() => chooseScope(scope)}>
                  <strong>{scope}</strong><ArrowRight size={18} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "budget" ? (
          <section className={`${styles.narrowStep} ${styles.budgetStep}`}>
            <div className={styles.sectionIntro}>
              <div>
                <h1>{isMinimalRoute ? "What feels like the right starting investment?" : "What’s your budget?"}</h1>
                <p>{isMinimalRoute ? "This helps us curate inspiration. It does not cap your project." : "Choose a range."}</p>
              </div>
              <SelectionBubbles items={[selectedService?.label, snapshot.selectedScope]} />
            </div>
            <div className={`${styles.budgetGrid}`}>
              {BUDGET_BANDS.map((band) => (
                <button key={band.id} type="button" data-unsure={band.id === "not-sure" ? "true" : "false"} onClick={() => chooseBudget(band)}>
                  <span>{band.label}</span><ArrowRight size={17} />
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "gallery" ? (
          <section className={versionClass(styles.galleryStep, v4Styles.galleryStep)}>
            <div className={versionClass(styles.galleryHeader, v4Styles.galleryHeader)}>
              <div className={versionClass(styles.galleryTitle, v4Styles.galleryTitle)}>
                <h1>{isMinimalRoute ? "See what’s possible at your budget" : "Projects that fit your budget"}</h1>
                <p>{isMinimalRoute
                  ? "These projects are commonly built around this investment level. Choose the direction you love—your range can evolve from there."
                  : "Choose the look closest to what you have in mind."}</p>
              </div>
              <div className={versionClass(styles.galleryHeaderMeta, v4Styles.galleryMeta)}>
                <SelectionBubbles items={[selectedService?.label, snapshot.selectedScope, selectedBudget?.galleryLabel]} />
                {snapshot.projects.length > 6 ? (
                  <span className={styles.catalogCount} aria-label={`${snapshot.projects.length} ideas. Scroll the gallery to explore more.`}>
                    {snapshot.projects.length} ideas <ArrowDown size={12} />
                  </span>
                ) : null}
                {snapshot.lead.emailCaptured ? (
                  <div className={styles.unlockedBadge}><CheckCircle2 size={15} /> Pricing unlocked</div>
                ) : null}
              </div>
            </div>
            {catalogBusy ? (
              <div className={styles.galleryScroll}>
                <div className={styles.gallerySkeleton}>
                  {Array.from({ length: 10 }, (_, index) => <div key={index} data-shape={["wide", "portrait", "square", "portrait", "portrait", "square", "wide"][index % 7]} />)}
                </div>
              </div>
            ) : snapshot.projects.length > 0 ? (
              <div className={styles.galleryScroll}>
                <div className={styles.projectGallery}>
                  {snapshot.projects.map((project, index) => (
                    <ProjectCard
                      key={project.assetId}
                      project={project}
                      index={index}
                      unlocked={snapshot.lead.emailCaptured}
                      favorite={snapshot.favoriteProjectIds.includes(project.assetId)}
                      routeVersion={routeVersion}
                      onSelect={() => selectProject(project)}
                      onFavorite={() => toggleFavorite(project.assetId)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div className={styles.emptyState}>
                <ImagePlus size={24} />
                <strong>We couldn’t load the project gallery.</strong>
                <small>{error || "Try the catalog again."}</small>
                <button type="button" className={styles.secondaryButton} onClick={() => { setError(null); setCatalogNonce((value) => value + 1); }}>
                  Try again
                </button>
              </div>
            )}
          </section>
        ) : null}

        {(snapshot.stage === "details" || isMinimalCustomizeStage) && selectedProject ? (
          <section className={versionClass(styles.detailStep, v4Styles.detailStep)}>
            <header className={versionClass(styles.detailPageHeader, v4Styles.detailHeader)}>
              <h1>{isMinimalCustomizeStage ? "Customize this design" : "Review and customize"}</h1>
              <p>{isMinimalCustomizeStage
                ? "Change individual features and see what each choice does to the project range."
                : "See your project estimate, then make the design your own."}</p>
            </header>
            <div className={versionClass(styles.detailHero, v4Styles.detailGrid)}>
              <section className={versionClass(styles.priceSummaryBar, v4Styles.priceSummary)} aria-label="Project pricing summary">
                <div className={versionClass(styles.priceSummaryMain, v4Styles.priceMain)}>
                  <div className={versionClass(styles.priceSummaryTopline, v4Styles.priceTopline)}>
                    <span className={versionClass(styles.priceSummaryLabel, v4Styles.priceLabel)}>{isMinimalRoute ? "Estimated investment" : "Estimated project range"}</span>
                    <span className={versionClass(styles.priceFitBadge, v4Styles.fitBadge)}><Check size={13} /> {isMinimalRoute ? "Planning range, not a quote" : selectedProject.fitLabel}</span>
                  </div>
                  <div className={versionClass(styles.livePriceRow, v4Styles.livePrice)}>
                    <strong className={versionClass(styles.detailPrice, v4Styles.priceAmount)}>{isMinimalRoute ? displayedInvestmentRange : liveRange ? rangeText(liveRange) : projectRangeText(selectedProject)}</strong>
                    {showRangeDelta ? <small>{liveRangeDelta > 0 ? "+" : ""}{liveRangeDelta}%</small> : null}
                  </div>
                  <div className={versionClass(styles.priceSummaryContext, v4Styles.priceContext)}>
                    <strong>{selectedProject.title}</strong>
                    <span>{isMinimalRoute
                      ? "A helpful starting range for this direction. Your choices and site conditions shape the final investment."
                      : "Updates with every design change"}</span>
                  </div>
                </div>
                {isMinimalRoute ? (
                  <>
                    {snapshot.stage === "details" ? (
                      <>
                        <div className={v4Styles.priceRevealContent}>
                          <section className={v4Styles.priceRevealGroup}>
                            <span>This type of project typically includes</span>
                            <ul>{selectedProject.inclusions.slice(0, 4).map((item) => <li key={item}><Check size={11} /> {item}</li>)}</ul>
                          </section>
                          <section className={v4Styles.investmentFactors}>
                            <span>Final investment depends on</span>
                            <div>
                              <article><strong>Size</strong><small>Square footage and the overall scale of the work.</small></article>
                              <article><strong>Materials</strong><small>Standard selections versus premium stone and finishes.</small></article>
                              <article><strong>Features</strong><small>Focal elements, utilities, and custom details.</small></article>
                              <article><strong>Site conditions</strong><small>Access, grading, drainage, and existing removal.</small></article>
                            </div>
                          </section>
                        </div>
                        <button
                          type="button"
                          className={v4Styles.priceRevealCta}
                          onClick={() => {
                            setRefinementMode("vision");
                            setSelectedRefinementCategoryId(null);
                            patchSnapshot({ stage: "customize", refinementPrompt: "", refinementSuggestions: [], refinementPriceImpact: 0 });
                          }}
                        >
                          <span>
                            <strong>Want to adjust this design to match your goals?</strong>
                            <small>Personalize your vision and see how each direction shapes the range.</small>
                          </span>
                          <ArrowRight size={16} />
                        </button>
                      </>
                    ) : null}
                    {isMinimalCustomizeStage ? <p className={v4Styles.priceCustomizationNote}>Your estimate updates as you make each choice.</p> : null}
                  </>
                ) : (
                  <div className={styles.priceSummaryAside}>
                    <details className={styles.priceScopeDetails}>
                      <summary>What’s covered <ChevronRight size={13} /></summary>
                      <div>{selectedProject.inclusions.slice(0, 3).map((item) => <small key={item}><Check size={11} /> {item}</small>)}</div>
                    </details>
                  </div>
                )}
              </section>
              <div className={versionClass(styles.detailImage, v4Styles.projectImage)}>
                <img src={activeProjectImageUrl} alt={selectedProject.title} />
                {projectRefinementBusy ? (
                  <div className={styles.projectRefinementOverlay} role="status" aria-live="polite">
                    <LoaderCircle className={styles.spin} size={24} />
                    <strong>Refining this concept…</strong>
                    <span>Applying your design choices while preserving the original setting.</span>
                  </div>
                ) : null}
                {snapshot.projectRefinementHistory.length > 0 ? <span className={styles.aiConceptBadge}><Sparkles size={13} /> AI refined</span> : null}
                {snapshot.projectRefinementHistory.length > 0 ? (
                  <div className={styles.versionNavigator} aria-label="Design version navigation">
                    <button
                      type="button"
                      aria-label="Previous design version"
                      disabled={projectActiveIndex === 0}
                      onClick={() => patchSnapshot({
                        projectActiveRefinementIndex: Math.max(0, projectActiveIndex - 1),
                        refinementPrompt: "",
                        refinementSuggestions: [],
                        refinementPriceImpact: 0,
                      })}
                    ><ChevronLeft size={16} /></button>
                    <span>{projectActiveIndex + 1} / {snapshot.projectRefinementHistory.length + 1}</span>
                    <button
                      type="button"
                      aria-label="Next design version"
                      disabled={projectActiveIndex >= snapshot.projectRefinementHistory.length}
                      onClick={() => patchSnapshot({
                        projectActiveRefinementIndex: Math.min(snapshot.projectRefinementHistory.length, projectActiveIndex + 1),
                        refinementPrompt: "",
                        refinementSuggestions: [],
                        refinementPriceImpact: 0,
                      })}
                    ><ChevronRight size={16} /></button>
                  </div>
                ) : null}
                <div className={versionClass(styles.detailImageActions, v4Styles.imageActions)}>
                  <button
                    type="button"
                    className={styles.imageUtilityAction}
                    aria-label={personalizedUnlocked ? "Download this design" : "Unlock design download"}
                    title={personalizedUnlocked ? "Download" : "Unlock download"}
                    onClick={() => requestImageAction("download", activeProjectImageUrl, `${selectedProject.title}-version-${projectActiveIndex + 1}`)}
                  ><Download size={16} />{!personalizedUnlocked ? <LockKeyhole className={styles.toolLock} size={9} /> : null}</button>
                  <button
                    type="button"
                    className={styles.imageUtilityAction}
                    aria-label={personalizedUnlocked ? "View this design fullscreen" : "Unlock fullscreen view"}
                    title={personalizedUnlocked ? "Fullscreen" : "Unlock fullscreen"}
                    onClick={() => requestImageAction("fullscreen", activeProjectImageUrl, `${selectedProject.title} · Version ${projectActiveIndex + 1}`)}
                  ><Maximize2 size={16} />{!personalizedUnlocked ? <LockKeyhole className={styles.toolLock} size={9} /> : null}</button>
                  <button
                    type="button"
                    className={styles.imageSaveAction}
                    onClick={() => toggleFavorite(selectedProject.assetId)}
                    data-favorite={snapshot.favoriteProjectIds.includes(selectedProject.assetId) ? "true" : "false"}
                  >
                    <Heart size={17} fill={snapshot.favoriteProjectIds.includes(selectedProject.assetId) ? "currentColor" : "none"} />
                    {snapshot.favoriteProjectIds.includes(selectedProject.assetId) ? "Saved" : "Save"}
                  </button>
                </div>
              </div>
              {(!isMinimalRoute || isMinimalCustomizeStage) ? (
              <div className={versionClass(styles.detailConfigurator, v4Styles.customizationWrap)}>
                <section
                  className={versionClass(styles.refinementPanel, v4Styles.customizationPanel)}
                  data-mode={refinementMode}
                  data-has-history={snapshot.projectRefinementHistory.length > 0 ? "true" : "false"}
                >
                  {isMinimalRoute ? (
                    <>
                      <input ref={uploadRef} type="file" accept="image/*" hidden onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void uploadRoom(file, true);
                      }} />
                      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
                        const file = event.target.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void uploadRoom(file, true);
                      }} />
                      <div className={v4Styles.customizationHeader}>
                        <div>
                          <strong>Personalize your vision</strong>
                          <span>Start with the version of this design that feels most like you.</span>
                        </div>
                        <IterationMeter
                          count={snapshot.projectRefinementHistory.length}
                          unlocked={personalizedUnlocked}
                          limit={1}
                        />
                      </div>

                      <div className={v4Styles.customizationTabs} role="tablist" aria-label="Choose a customization method">
                        <button
                          type="button"
                          role="tab"
                          aria-selected={refinementMode === "vision"}
                          data-active={refinementMode === "vision" ? "true" : "false"}
                          onClick={() => {
                            setRefinementMode("vision");
                            setSelectedRefinementCategoryId(null);
                            patchSnapshot({ refinementPrompt: "", refinementSuggestions: [], refinementPriceImpact: 0 });
                          }}
                        >Your vision</button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={refinementMode === "parts"}
                          data-active={refinementMode === "parts" ? "true" : "false"}
                          onClick={() => {
                            setRefinementMode("parts");
                            patchSnapshot({ refinementPrompt: "" });
                          }}
                        >Choose a part</button>
                        <button
                          type="button"
                          role="tab"
                          aria-selected={refinementMode === "describe"}
                          data-active={refinementMode === "describe" ? "true" : "false"}
                          onClick={() => {
                            setRefinementMode("describe");
                            setSelectedRefinementCategoryId(null);
                            patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                          }}
                        ><WandSparkles size={12} /> Describe a change</button>
                      </div>

                      <div className={v4Styles.customizationBody}>
                        {refinementMode === "vision" ? (
                          <div className={v4Styles.visionPaths}>
                            {v4VisionPathsForProject.map((path) => {
                              const selected = selectedVisionPath?.id === path.id;
                              return (
                                <button
                                  key={path.id}
                                  type="button"
                                  data-selected={selected ? "true" : "false"}
                                  aria-pressed={selected}
                                  onClick={() => {
                                    patchSnapshot({
                                      refinementPrompt: "",
                                      refinementSuggestions: selected ? [] : [path.instruction],
                                      refinementPriceImpact: selected ? 0 : path.priceImpact,
                                    });
                                    track("adventure_v4_vision_path_selected", { path: path.id, selected: !selected });
                                  }}
                                >
                                  <strong>{path.label}</strong>
                                  <span>{path.details.map((detail) => <small key={detail}><Check size={11} /> {detail}</small>)}</span>
                                </button>
                              );
                            })}
                            {selectedVisionPath ? (
                              <button type="button" className={v4Styles.customizationApply} onClick={() => void refineSelectedProject()} disabled={projectRefinementBusy}>
                                {projectRefinementBusy
                                  ? <LoaderCircle className={styles.spin} size={15} />
                                  : projectRefinementGateWillOpen
                                    ? <LockKeyhole size={15} />
                                    : <WandSparkles size={15} />}
                                {projectRefinementBusy
                                  ? "Creating your version…"
                                  : projectRefinementGateWillOpen
                                    ? "Unlock next change"
                                    : "Preview this direction"}
                              </button>
                            ) : null}
                          </div>
                        ) : refinementMode === "describe" ? (
                          <form className={v4Styles.customizationPrompt} onSubmit={(event) => {
                            event.preventDefault();
                            if (snapshot.refinementPrompt.trim() && !projectRefinementBusy) void refineSelectedProject();
                          }}>
                            <WandSparkles size={16} />
                            <input
                              value={snapshot.refinementPrompt}
                              onChange={(event) => patchSnapshot({ refinementPrompt: event.target.value })}
                              aria-label="Describe a specific design change"
                              placeholder="Try “Use warmer stone and softer planting”"
                            />
                            <button type="submit" aria-label="Preview this change" disabled={!snapshot.refinementPrompt.trim() || projectRefinementBusy}>
                              {projectRefinementBusy
                                ? <LoaderCircle className={styles.spin} size={15} />
                                : projectRefinementGateWillOpen
                                  ? <LockKeyhole size={15} />
                                  : <ArrowRight size={15} />}
                            </button>
                          </form>
                        ) : selectedRefinementCategory ? (
                          <div className={v4Styles.customizationPicker}>
                            <div className={v4Styles.customizationPickerHeader}>
                              <strong>{refinementCategoryHeading(selectedRefinementCategory.label)}</strong>
                              <button
                                type="button"
                                className={v4Styles.customizationBack}
                                onClick={() => {
                                  setSelectedRefinementCategoryId(null);
                                  patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                                }}
                              ><ArrowLeft size={12} /> All parts</button>
                            </div>
                            <div className={v4Styles.customizationOptions}>
                              {selectedRefinementCategory.options.map((option, index) => {
                                const selected = selectedRefinementOption?.id === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    data-selected={selected ? "true" : "false"}
                                    aria-pressed={selected}
                                    onClick={() => {
                                      patchSnapshot({
                                        refinementSuggestions: selected ? [] : [option.instruction],
                                        refinementPriceImpact: selected ? 0 : option.priceImpact,
                                      });
                                      track("adventure_v3_refinement_option_selected", {
                                        category: selectedRefinementCategory.label,
                                        option: option.label,
                                        selected: !selected,
                                      });
                                    }}
                                  >
                                    <span><img src={refinementThumbnail(index + refinementCategories.length)} alt="" /></span>
                                    <strong>{option.label}</strong>
                                    <small>{option.priceImpact > 0 ? "+" : ""}{Math.round(option.priceImpact * 100)}%</small>
                                  </button>
                                );
                              })}
                            </div>
                            {selectedRefinementOption ? (
                              <button type="button" className={v4Styles.customizationApply} onClick={() => void refineSelectedProject()} disabled={projectRefinementBusy}>
                                {projectRefinementBusy
                                  ? <LoaderCircle className={styles.spin} size={15} />
                                  : projectRefinementGateWillOpen
                                    ? <LockKeyhole size={15} />
                                    : <WandSparkles size={15} />}
                                {projectRefinementBusy
                                  ? "Creating your version…"
                                  : projectRefinementGateWillOpen
                                    ? "Unlock next change"
                                    : "Preview this change"}
                              </button>
                            ) : null}
                          </div>
                        ) : (
                          <div className={v4Styles.customizationCategories}>
                            {refinementCategories.map((category, index) => (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => {
                                  setSelectedRefinementCategoryId(category.id);
                                  patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                                  track("adventure_v3_refinement_category_selected", { category: category.label });
                                }}
                              >
                                <span><img src={refinementThumbnail(index)} alt="" /></span>
                                <strong>{category.label}</strong>
                                <ChevronRight size={13} />
                              </button>
                            ))}
                          </div>
                        )}

                        {snapshot.projectRefinementHistory.length > 0 ? (
                          <div className={v4Styles.projectHistory}>
                            <div className={v4Styles.projectHistoryHeading}>
                              <strong>Project versions</strong>
                              <span>{projectActiveIndex + 1} of {snapshot.projectRefinementHistory.length + 1}</span>
                            </div>
                            <div className={v4Styles.projectHistoryRail}>
                              <button
                                type="button"
                                data-current={projectActiveIndex === 0 ? "true" : "false"}
                                aria-label="View original design"
                                onClick={() => patchSnapshot({
                                  projectActiveRefinementIndex: 0,
                                  refinementPrompt: "",
                                  refinementSuggestions: [],
                                  refinementPriceImpact: 0,
                                })}
                              >
                                <img src={selectedProject.imageUrl} alt="" />
                                <span>Original</span>
                              </button>
                              {snapshot.projectRefinementHistory.map((entry, index) => (
                                <button
                                  key={`${entry.assetId}-${index}`}
                                  type="button"
                                  data-current={projectActiveIndex === index + 1 ? "true" : "false"}
                                  aria-label={`View design change ${index + 1}`}
                                  onClick={() => patchSnapshot({
                                    projectActiveRefinementIndex: index + 1,
                                    refinementPrompt: "",
                                    refinementSuggestions: [],
                                    refinementPriceImpact: 0,
                                  })}
                                >
                                  <img src={entry.imageUrl} alt="" />
                                  <span>Change {index + 1}</span>
                                </button>
                              ))}
                            </div>
                          </div>
                        ) : null}
                        {error ? <div className={styles.formError}>{error}</div> : null}
                        {snapshot.lead.emailStatus === "sent" ? <span className={styles.emailSent}><CheckCircle2 size={14} /> Pricing sent to your email</span> : null}
                      </div>

                      <section className={v4Styles.personalizationFallback} aria-label="Optional own-space preview">
                        <div>
                          <span>Optional next step</span>
                          <strong>See your version in your space</strong>
                          <small>Upload a photo and we’ll apply your selected design and personalization choices.</small>
                        </div>
                        <div className={v4Styles.personalizationActions}>
                          <button type="button" onClick={() => uploadRef.current?.click()} disabled={uploadBusy}>
                            {uploadBusy ? <LoaderCircle className={styles.spin} size={15} /> : <ImagePlus size={15} />}
                            Upload my space
                          </button>
                          <button type="button" className={v4Styles.takePhotoAction} onClick={() => cameraRef.current?.click()} disabled={uploadBusy}>
                            <Camera size={15} /> Take a photo
                          </button>
                        </div>
                      </section>

                      <div className={v4Styles.customizationFooter}>
                        <button type="button" className={v4Styles.tryAnotherButton} onClick={() => patchSnapshot({ stage: "gallery" })}>
                          <ArrowLeft size={13} /> Try another project direction
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                  <div className={styles.configSectionHeading}>
                    <div className={styles.configTitleRow}>
                      <strong>Make it yours</strong>
                      <IterationMeter count={snapshot.projectRefinementHistory.length} unlocked={personalizedUnlocked} />
                    </div>
                    <span>Choose how you want to change this design.</span>
                  </div>
                  <div className={styles.refinementModeTabs} role="tablist" aria-label="Choose a refinement method">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={refinementMode === "parts"}
                      data-active={refinementMode === "parts" ? "true" : "false"}
                      onClick={() => {
                        setRefinementMode("parts");
                        patchSnapshot({ refinementPrompt: "" });
                      }}
                    >Choose a part</button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={refinementMode === "describe"}
                      data-active={refinementMode === "describe" ? "true" : "false"}
                      onClick={() => {
                        setRefinementMode("describe");
                        setSelectedRefinementCategoryId(null);
                        patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                      }}
                    ><WandSparkles size={13} /> Describe a change</button>
                  </div>
                  <div className={styles.refinementPanelBody}>
                    {refinementMode === "describe" ? (
                      <form className={styles.refinementPrompt} onSubmit={(event) => {
                        event.preventDefault();
                        if (snapshot.refinementPrompt.trim() && !projectRefinementBusy) void refineSelectedProject();
                      }}>
                        <span className={styles.refinementPromptIcon} aria-hidden="true"><WandSparkles size={17} /></span>
                        <label className={styles.refinementPromptBody}>
                          <strong>What should change?</strong>
                          <input
                            autoFocus
                            value={snapshot.refinementPrompt}
                            onChange={(event) => patchSnapshot({ refinementPrompt: event.target.value })}
                            aria-label="Describe a specific design change"
                            placeholder="Try “Make the vanity floating”"
                          />
                        </label>
                        <button
                          type="submit"
                          aria-label="Preview the described change"
                          disabled={!snapshot.refinementPrompt.trim() || projectRefinementBusy}
                        >
                          {projectRefinementBusy
                            ? <LoaderCircle className={styles.spin} size={16} />
                            : projectRefinementGateWillOpen
                              ? <LockKeyhole size={16} />
                              : <ArrowRight size={17} />}
                        </button>
                      </form>
                    ) : selectedRefinementCategory ? (
                      <div className={styles.refinementBrowser}>
                        <div className={styles.refinementBrowserHeader}>
                          <button
                            type="button"
                            className={styles.refinementBack}
                            onClick={() => {
                              setSelectedRefinementCategoryId(null);
                              patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                            }}
                          >
                            <ArrowLeft size={13} /> Back to all
                          </button>
                          <strong className={styles.refinementBrowserTitle}>{refinementCategoryHeading(selectedRefinementCategory.label)}</strong>
                        </div>
                        <div className={styles.refinementVisualGrid}>
                          {selectedRefinementCategory.options.map((option, index) => {
                            const selected = selectedRefinementOption?.id === option.id;
                            const impactPercent = Math.round(option.priceImpact * 100);
                            const impactHelp = impactPercent > 0
                              ? `This option may increase the current estimate by about ${impactPercent}%.`
                              : impactPercent < 0
                                ? `This option may lower the current estimate by about ${Math.abs(impactPercent)}%.`
                                : "This option is not expected to materially change the estimate.";
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={styles.refinementVisualCard}
                                data-selected={selected ? "true" : "false"}
                                aria-pressed={selected}
                                onClick={() => {
                                  patchSnapshot({
                                    refinementSuggestions: selected ? [] : [option.instruction],
                                    refinementPriceImpact: selected ? 0 : option.priceImpact,
                                  });
                                  track("adventure_v3_refinement_option_selected", {
                                    category: selectedRefinementCategory.label,
                                    option: option.label,
                                    selected: !selected,
                                  });
                                }}
                              >
                                <span className={styles.refinementVisualThumb}><img src={refinementThumbnail(index + refinementCategories.length)} alt="" /></span>
                                <strong>{option.label}</strong>
                                <span
                                  className={styles.refinementCostHint}
                                  data-tone={impactPercent > 0 ? "up" : impactPercent < 0 ? "down" : "flat"}
                                  data-tooltip={impactHelp}
                                  aria-label={impactHelp}
                                  title={impactHelp}
                                >{impactPercent > 0 ? "+" : ""}{impactPercent}%</span>
                              </button>
                            );
                          })}
                        </div>
                        {selectedRefinementOption ? (
                          <button
                            type="button"
                            className={styles.refineProjectCta}
                            onClick={() => void refineSelectedProject()}
                            disabled={projectRefinementBusy}
                          >
                            {projectRefinementBusy
                              ? <LoaderCircle className={styles.spin} size={16} />
                              : projectRefinementGateWillOpen
                                ? <LockKeyhole size={16} />
                                : <WandSparkles size={16} />}
                            {projectRefinementBusy
                              ? "Creating your version…"
                              : projectRefinementGateWillOpen
                                ? "Unlock next change"
                                : "Preview this change"}
                          </button>
                        ) : null}
                      </div>
                    ) : (
                      <div className={styles.refinementVisualGrid}>
                        {refinementCategories.map((category, index) => (
                          <button
                            key={category.id}
                            type="button"
                            className={styles.refinementVisualCard}
                            onClick={() => {
                              setSelectedRefinementCategoryId(category.id);
                              patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                              track("adventure_v3_refinement_category_selected", { category: category.label });
                            }}
                          >
                            <span className={styles.refinementVisualThumb}><img src={refinementThumbnail(index)} alt="" /></span>
                            <strong>{category.label}</strong>
                            <ArrowRight size={13} />
                          </button>
                        ))}
                      </div>
                    )}

                    {snapshot.projectRefinementHistory.length > 0 ? (
                      <div className={styles.projectHistoryPanel}>
                        <div className={styles.projectHistoryHeading}>
                          <strong>Versions</strong>
                          <span>{projectActiveIndex + 1} of {snapshot.projectRefinementHistory.length + 1}</span>
                        </div>
                        <div className={styles.projectHistoryRail}>
                          <button
                            type="button"
                            data-current={projectActiveIndex === 0 ? "true" : "false"}
                            aria-label="View original design"
                            onClick={() => patchSnapshot({
                              projectActiveRefinementIndex: 0,
                              refinementPrompt: "",
                              refinementSuggestions: [],
                              refinementPriceImpact: 0,
                            })}
                          >
                            <img src={selectedProject.imageUrl} alt="" />
                            <span>Original</span>
                          </button>
                          {snapshot.projectRefinementHistory.map((entry, index) => (
                            <button
                              key={`${entry.assetId}-${index}`}
                              type="button"
                              data-current={projectActiveIndex === index + 1 ? "true" : "false"}
                              aria-label={`View design change ${index + 1}`}
                              onClick={() => patchSnapshot({
                                projectActiveRefinementIndex: index + 1,
                                refinementPrompt: "",
                                refinementSuggestions: [],
                                refinementPriceImpact: 0,
                              })}
                            >
                              <img src={entry.imageUrl} alt="" />
                              <span>Change {index + 1}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {error ? <div className={styles.formError}>{error}</div> : null}
                  </div>
                  {snapshot.lead.emailStatus === "sent" ? <span className={styles.emailSent}><CheckCircle2 size={14} /> Pricing sent to your email</span> : null}
                  <div className={styles.refinementRoomAction}>
                    <input ref={uploadRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
                      const file = event.target.files?.[0];
                      event.currentTarget.value = "";
                      if (file) void uploadRoom(file, true);
                    }} />
                    <button type="button" className={styles.uploadProjectCta} onClick={() => uploadRef.current?.click()} disabled={uploadBusy}>
                      {uploadBusy ? <LoaderCircle className={styles.spin} size={18} /> : <ImagePlus size={18} />}
                      <span><strong>See it in your room</strong><small>Upload a photo</small></span>
                      <ArrowRight size={16} />
                    </button>
                  </div>
                    </>
                  )}
                </section>
              </div>
              ) : null}
            </div>

          </section>
        ) : null}

        {snapshot.stage === "personalize" && selectedProject ? (
          <section className={styles.personalizeStep}>
            <div className={styles.sectionIntro}>
              <div>
              <h1>See this direction in your own space.</h1>
              <p>Upload a photo and we’ll create a version using your actual setting. Your budget and selections carry forward automatically.</p>
              </div>
              <SelectionBubbles items={[snapshot.selectedScope, selectedBudget?.galleryLabel, selectedProject.title]} />
            </div>
            <input ref={uploadRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
              const file = event.target.files?.[0];
              event.currentTarget.value = "";
              if (file) void uploadRoom(file);
            }} />
            {!snapshot.sourceAsset ? (
              <button type="button" className={styles.uploadDropzone} onClick={() => uploadRef.current?.click()} disabled={uploadBusy}>
                {uploadBusy ? <LoaderCircle className={styles.spin} size={28} /> : <Upload size={28} />}
                <strong>{uploadBusy ? "Uploading your photo…" : "Upload or take a photo"}</strong>
                <small>JPG, PNG, or WebP · up to 10 MB</small>
              </button>
            ) : (
              <>
                <div className={styles.personalizeCompare}>
                  <figure><img src={snapshot.sourceAsset.url} alt="Your uploaded space" /><figcaption>Your space</figcaption></figure>
                  <figure><img src={selectedProject.imageUrl} alt={selectedProject.title} /><figcaption>Look to apply</figcaption></figure>
                </div>
                <button type="button" className={styles.replacePhoto} onClick={() => uploadRef.current?.click()}>Replace photo</button>
                <div className={styles.lightQuestions}>
                  <div>
                    <strong>Keep the current layout?</strong>
                    <small>This is the main price-driving personalization question.</small>
                    <span className={styles.segmented}>
                      <button type="button" data-selected={snapshot.keepLayout ? "true" : "false"} onClick={() => patchSnapshot({ keepLayout: true })}>Yes, keep it</button>
                      <button type="button" data-selected={!snapshot.keepLayout ? "true" : "false"} onClick={() => patchSnapshot({ keepLayout: false })}>Open to changes</button>
                    </span>
                  </div>
                  <div>
                    <strong>Anything important to keep?</strong>
                    <small>Optional—choose only what matters.</small>
                    <span className={styles.featureChips}>
                      {components.map((component) => {
                        const selected = snapshot.featuresToKeep.includes(component);
                        return (
                          <button key={component} type="button" data-selected={selected ? "true" : "false"} onClick={() => patchSnapshot({
                            featuresToKeep: selected
                              ? snapshot.featuresToKeep.filter((item) => item !== component)
                              : [...snapshot.featuresToKeep, component],
                          })}>
                            <Check size={12} /> {component}
                          </button>
                        );
                      })}
                    </span>
                  </div>
                </div>
                <button type="button" className={styles.primaryButton} onClick={() => void generatePreview()} disabled={previewBusy}>
                  {previewBusy ? <LoaderCircle className={styles.spin} size={16} /> : <Sparkles size={16} />}
                  {previewBusy ? "Creating your preview…" : "Create my personalized preview"}
                </button>
              </>
            )}
            {error ? <div className={styles.formError}>{error}</div> : null}
            <button type="button" className={styles.textButton} onClick={() => patchSnapshot({ stage: "gallery" })}>Keep browsing visual pricing</button>
          </section>
        ) : null}

        {(snapshot.stage === "personalized-preview" || snapshot.stage === "personalized-result") && selectedProject && selectedPreview ? (
          <section className={styles.personalizedWorkspaceStep} data-unlocked={personalizedUnlocked ? "true" : "false"}>
            <div className={styles.sectionIntro}>
              <div>
                <h1>This look, in your space.</h1>
                <p>{personalizedUnlocked
                  ? "Keep shaping the design. Every revision updates the image and planning price together."
                  : "Your concept is ready. Make one refinement and see the image and estimate change together."}</p>
              </div>
              <SelectionBubbles items={[snapshot.selectedScope, selectedProject.title]} />
            </div>

            <div className={styles.personalizedWorkspace}>
              <div className={styles.workspaceVisual}>
                <img src={selectedPreview.imageUrl} alt={personalizedActiveIndex === 0 ? "Your first personalized concept" : `Your room at revision ${personalizedActiveIndex}`} />
                <span className={styles.workspaceVisualLabel}>
                  {personalizedActiveIndex > 0 ? `Revision ${personalizedActiveIndex}` : "Your first concept"}
                </span>
                <div className={styles.workspaceToolBar}>
                  <button
                    type="button"
                    aria-label={personalizedUnlocked ? "Download this version" : "Unlock version download"}
                    title={personalizedUnlocked ? "Download" : "Unlock download"}
                    onClick={() => requestImageAction("download", selectedPreview.imageUrl, `${selectedProject.title}-revision-${personalizedActiveIndex}`)}
                  ><Download size={16} />{!personalizedUnlocked ? <LockKeyhole className={styles.toolLock} size={9} /> : null}</button>
                  <button
                    type="button"
                    aria-label={personalizedUnlocked ? "View this version fullscreen" : "Unlock fullscreen view"}
                    title={personalizedUnlocked ? "Fullscreen" : "Unlock fullscreen"}
                    onClick={() => requestImageAction("fullscreen", selectedPreview.imageUrl, `${selectedProject.title} · Revision ${personalizedActiveIndex}`)}
                  ><Maximize2 size={16} />{!personalizedUnlocked ? <LockKeyhole className={styles.toolLock} size={9} /> : null}</button>
                </div>
                {snapshot.personalizedConcepts.length > 1 ? (
                  <div className={styles.workspaceVersionNavigator} aria-label="Personalized version navigation">
                    <button
                      type="button"
                      aria-label="Previous personalized version"
                      disabled={personalizedActiveIndex === 0}
                      onClick={() => patchSnapshot({
                        personalizedActiveConceptIndex: Math.max(0, personalizedActiveIndex - 1),
                        personalizedRefinementChoiceId: null,
                        personalizedRefinementPrompt: "",
                      })}
                    ><ChevronLeft size={17} /></button>
                    <span>{personalizedActiveIndex + 1} / {snapshot.personalizedConcepts.length}</span>
                    <button
                      type="button"
                      aria-label="Next personalized version"
                      disabled={personalizedActiveIndex >= snapshot.personalizedConcepts.length - 1}
                      onClick={() => patchSnapshot({
                        personalizedActiveConceptIndex: Math.min(snapshot.personalizedConcepts.length - 1, personalizedActiveIndex + 1),
                        personalizedRefinementChoiceId: null,
                        personalizedRefinementPrompt: "",
                      })}
                    ><ChevronRight size={17} /></button>
                  </div>
                ) : null}
                {snapshot.sourceAsset?.url ? (
                  <figure className={styles.workspaceBefore}>
                    <img src={snapshot.sourceAsset.url} alt="Your space before personalization" />
                    <figcaption>Before</figcaption>
                  </figure>
                ) : null}
                {personalizedRefinementBusy ? (
                  <div className={styles.workspaceGenerating}>
                    <LoaderCircle className={styles.spin} size={24} />
                    <strong>Creating your revision…</strong>
                    <small>Your current design stays here until the new one is ready.</small>
                  </div>
                ) : null}
              </div>

              <aside className={styles.workspaceControls}>
                <div className={styles.workspaceControlHeader}>
                  <div>
                    <span className={styles.workspaceEyebrow}>Make this design yours</span>
                    <h2>What should change?</h2>
                  </div>
                  <IterationMeter count={snapshot.personalizedRefinements.length} unlocked={personalizedUnlocked} limit={personalizedRefinementLimit} />
                </div>

                <div className={styles.workspacePrice} data-previewing={hasPendingPersonalizedRefinement ? "true" : "false"}>
                  <span>{hasPendingPersonalizedRefinement ? "Estimate with this change" : "Current planning estimate"}</span>
                  <div>
                        <strong>{personalizedLiveRange
                      ? `${formatCurrency(personalizedLiveRange.totalMin, personalizedLiveRange.currency)}–${formatCurrency(personalizedLiveRange.totalMax, personalizedLiveRange.currency)}`
                      : projectRangeText(selectedProject)}</strong>
                    {hasPendingPersonalizedRefinement && pendingPersonalizedImpact !== 0 ? (
                      <small>{pendingPersonalizedImpact > 0 ? "+" : ""}{Math.round(pendingPersonalizedImpact * 100)}%</small>
                    ) : null}
                  </div>
                  <p>{hasPendingPersonalizedRefinement
                    ? "Preview pricing now. It becomes your new estimate when the revision succeeds."
                    : "Changes to your selections and requests update this range."}</p>
                </div>

                {!personalizedUnlocked && isMinimalRoute ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => {
                      setPhoneError(null);
                      setPendingPhoneAction(null);
                      setPhoneOpen(true);
                      track("adventure_v3_personalized_refinements_unlock_viewed", {
                        projectId: selectedProject.assetId,
                        refinementCount: snapshot.personalizedRefinements.length,
                      });
                    }}
                  >
                    <Phone size={15} /> Unlock continued refinements
                  </button>
                ) : null}

                <div className={styles.personalizedRefinementChoices}>
                  {personalizedOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-selected={snapshot.personalizedRefinementChoiceId === option.id ? "true" : "false"}
                      onClick={() => patchSnapshot({
                        personalizedRefinementChoiceId: snapshot.personalizedRefinementChoiceId === option.id ? null : option.id,
                      })}
                    >
                      <Sparkles size={12} /> {option.label}
                      <small>{option.priceImpact > 0 ? "+" : ""}{Math.round(option.priceImpact * 100)}%</small>
                    </button>
                  ))}
                </div>

                <label className={styles.personalizedPrompt}>
                  <WandSparkles size={16} />
                  <input
                    value={snapshot.personalizedRefinementPrompt}
                    onChange={(event) => patchSnapshot({ personalizedRefinementPrompt: event.target.value })}
                    placeholder="Or describe a change…"
                  />
                </label>

                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={!hasPendingPersonalizedRefinement || personalizedRefinementBusy}
                  onClick={() => void applyPersonalizedRefinement()}
                >
                  {personalizedRefinementBusy
                    ? <LoaderCircle className={styles.spin} size={16} />
                    : personalizedGateWillOpen
                      ? <LockKeyhole size={16} />
                      : <Sparkles size={16} />}
                  {personalizedRefinementBusy
                    ? "Creating revision…"
                    : personalizedGateWillOpen
                      ? "Unlock next refinement"
                      : "Apply refinement"}
                </button>
                <small className={styles.workspaceHelper}>
                  {personalizedUnlocked
                    ? "Your revision history and latest price stay together below."
                    : personalizedIterationsRemaining > 0
                      ? `${personalizedIterationsRemaining} included design ${personalizedIterationsRemaining === 1 ? "change" : "changes"} remaining before continued iteration unlocks.`
                        : isMinimalRoute
                          ? "Your first personalized concept is ready. Unlock continued refinements to keep designing."
                          : `Your ${personalizedRefinementLimit} included design changes are saved. Unlock the next one to keep designing.`}
                </small>
                {error ? <div className={styles.formError}>{error}</div> : null}
              </aside>
            </div>

            {snapshot.personalizedConcepts.length > 1 ? (
              <div className={styles.revisionHistory}>
                <div className={styles.revisionHistoryHeading}>
                  <strong>Revision history</strong>
                  <span>{snapshot.personalizedConcepts.length} saved versions</span>
                </div>
                <div className={styles.revisionRail}>
                  {snapshot.personalizedConcepts.map((concept, index) => {
                    const refinement = index > 0 ? snapshot.personalizedRefinements[index - 1] : null;
                    return (
                      <figure
                        key={`${concept.assetId}-${index}`}
                        data-current={index === personalizedActiveIndex ? "true" : "false"}
                        role="button"
                        tabIndex={0}
                        onClick={() => patchSnapshot({
                          personalizedActiveConceptIndex: index,
                          personalizedRefinementChoiceId: null,
                          personalizedRefinementPrompt: "",
                        })}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            patchSnapshot({
                              personalizedActiveConceptIndex: index,
                              personalizedRefinementChoiceId: null,
                              personalizedRefinementPrompt: "",
                            });
                          }
                        }}
                      >
                        <img src={concept.imageUrl} alt={index === 0 ? "First personalized concept" : `Refinement ${index}`} />
                        <figcaption>
                          <strong>{index === 0 ? "First concept" : `Revision ${index}`}</strong>
                          <small>{refinement?.label || "Saved direction"}</small>
                        </figcaption>
                        {refinement?.priceImpact ? (
                          <span>{refinement.priceImpact > 0 ? "+" : ""}{Math.round(refinement.priceImpact * 100)}%</span>
                        ) : null}
                      </figure>
                    );
                  })}
                </div>
              </div>
            ) : null}

            {personalizedUnlocked ? (
              <>
                <div className={styles.resultDetails}>
                  <section>
                    <h2>What’s included</h2>
                    <ul>
                      {selectedProject.inclusions.map((item) => <li key={item}><Check size={14} /> {item}</li>)}
                      <li><Check size={14} /> {snapshot.keepLayout ? "Existing layout retained" : "Layout flexibility included"}</li>
                      {snapshot.featuresToKeep.map((item) => <li key={item}><Check size={14} /> Preserve existing {item.toLowerCase()}</li>)}
                    </ul>
                  </section>
                  <section>
                    <h2>Recommended priorities</h2>
                    <ul>
                      <li><ArrowRight size={14} /> Finalize the highest-visibility surfaces first</li>
                      <li><ArrowRight size={14} /> Confirm field conditions before custom orders</li>
                      <li><ArrowRight size={14} /> Compare practical and upgraded material allowances</li>
                    </ul>
                  </section>
                </div>
                    <div className={styles.consultationCard}>
                      <div><Phone size={20} /><span><strong>{isMinimalRoute ? "Want contractor feedback?" : "Want a specialist to review this?"}</strong><small>{isMinimalRoute
                        ? "Ask the contractor to review your project, confirm feasibility, and discuss next steps."
                        : "Get a human review and a higher-confidence estimate."}</small></span></div>
                  {snapshot.lead.consultationStatus === "requested" ? (
                    <span className={styles.consultationSuccess}><CheckCircle2 size={16} /> Review requested</span>
                  ) : (
                        <button type="button" className={styles.secondaryButton} onClick={() => void requestConsultation()} disabled={snapshot.lead.consultationStatus === "requesting"}>
                          {snapshot.lead.consultationStatus === "requesting" ? "Requesting…" : isMinimalRoute ? "Get contractor feedback" : "Request expert review"}
                        </button>
                  )}
                </div>
              </>
            ) : null}
            <button type="button" className={styles.textButton} onClick={() => patchSnapshot({ stage: "gallery" })}>Try another project direction</button>
          </section>
        ) : null}
      </main>

      <EmailGate
        open={emailOpen}
        busy={emailBusy}
        error={emailError}
        project={selectedProject}
        routeVersion={routeVersion}
        onClose={() => { setEmailOpen(false); setEmailError(null); }}
        onSubmit={(email, name) => void captureEmail(email, name)}
      />
          <PhoneGate
            open={phoneOpen}
            busy={phoneBusy}
            error={phoneError}
            routeVersion={routeVersion}
        onClose={() => { setPhoneOpen(false); setPhoneError(null); setPendingPhoneAction(null); }}
        onSubmit={(phone) => void capturePhone(phone)}
      />
      {fullscreenAsset ? (
        <div className={styles.fullscreenBackdrop} role="dialog" aria-modal="true" aria-label={fullscreenAsset.label}>
          <img src={fullscreenAsset.imageUrl} alt={fullscreenAsset.label} />
          <div className={styles.fullscreenTopbar}>
            <span>{fullscreenAsset.label}</span>
            <button type="button" onClick={() => void downloadImage(fullscreenAsset.imageUrl, fullscreenAsset.label)}>
              <Download size={17} /> Download
            </button>
            <button type="button" onClick={() => setFullscreenAsset(null)} aria-label="Close fullscreen view">
              <X size={18} />
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
