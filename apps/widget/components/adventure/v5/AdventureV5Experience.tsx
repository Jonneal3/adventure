"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Car,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Droplets,
  Flower2,
  Heart,
  Home,
  ImagePlus,
  Layers3,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Maximize2,
  Paintbrush,
  Phone,
  RotateCcw,
  Sparkles,
  TreePine,
  Upload,
  WandSparkles,
  X,
  type LucideIcon,
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
import { configuredPricingBounds } from "../v3/pricing";
import {
  refinementCategoryHeading,
  refinementComponentsForProject,
} from "../v3/refinement-component-library";
import {
  BUDGET_BANDS,
  adjustedPersonalizedRange,
  budgetBandById,
  buildVisualProjects,
  configuredProjectRange,
  DEFAULT_ESTIMATE_CONFIG,
  personalizedProjectRange,
  refreshProjectCoverage,
} from "../v3/visual-pricing";
import type {
  BudgetBand,
  BudgetBandId,
  PersonalizedRefinementRecord,
  RawVisualProject,
  VisualPricingProject,
  VisualPricingSnapshot,
  VisualPricingStage,
} from "../v3/visual-pricing-types";
import {
  clearVisualPricingSnapshot,
  getOrCreateVisualPricingSession,
  loadVisualPricingSnapshot,
  saveVisualPricingSnapshot,
} from "../v3/visual-storage";
import css from "./visual-pricing-v5.module.css";

type Props = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
};

const PERSONALIZATION_MODEL_ID = "black-forest-labs/flux-2-pro";
const VISUAL_CATALOG_REVISION = "2026-08-05-coverage-v4";
// V4 economics: refining the reference design stays open, while personalizing
// the customer's own photo is what the phone number unlocks.
const PROJECT_REFINEMENT_LIMIT = Number.POSITIVE_INFINITY;
const PERSONALIZED_REFINEMENT_LIMIT = 0;

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

/** Directional teaser shown blurred on locked cards — curiosity without exact unlock. */
function partialPriceTeaser(project: VisualPricingProject): string {
  const mid = (project.priceMin + project.priceMax) / 2;
  const low = Math.max(1_000, Math.floor((mid * 0.88) / 1_000) * 1_000);
  const high = Math.max(low + 2_000, Math.ceil((mid * 1.12) / 1_000) * 1_000);
  return `${formatCurrency(low, project.currency)}–${formatCurrency(high, project.currency)}`;
}

function choiceIconFor(label: string): LucideIcon {
  const value = label.toLowerCase();
  if (/full|renovat|complete/.test(value)) return Home;
  if (/patio|walkway|hardscape/.test(value)) return Layers3;
  if (/lawn|garden|plant/.test(value)) return Flower2;
  if (/driveway/.test(value)) return Car;
  if (/light/.test(value)) return Lightbulb;
  if (/irrigat|water/.test(value)) return Droplets;
  if (/tree|shrub|prun/.test(value)) return TreePine;
  if (/color|paint|refresh|cosmetic/.test(value)) return Paintbrush;
  return Sparkles;
}

function rangeText(range: { totalMin: number; totalMax: number; currency: string }): string {
  return `${formatCurrency(range.totalMin, range.currency)}–${formatCurrency(range.totalMax, range.currency)}`;
}

function priceRangeText(range: { totalMin: number; totalMax: number; currency: string }): string {
  const span = Math.max(0, range.totalMax - range.totalMin);
  const increment = span < 8_000 ? 500 : span < 20_000 ? 1_000 : 2_500;
  const lower = Math.max(increment, Math.floor(range.totalMin / increment) * increment);
  const upper = Math.max(lower + increment, Math.ceil(range.totalMax / increment) * increment);
  return `${formatCurrency(lower, range.currency)}–${formatCurrency(upper, range.currency)}`;
}

type VisionPath = {
  id: string;
  label: string;
  details: string[];
  instruction: string;
  priceImpact: number;
};

const LANDSCAPE_VISION_PATHS: VisionPath[] = [
  {
    id: "starting-range",
    label: "Closer to starting range",
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
    label: "Luxury version",
    details: ["Pergola", "Outdoor kitchen", "Entertainment area"],
    instruction: "Create a luxury outdoor retreat with a pergola, outdoor kitchen, and a dedicated entertainment area.",
    priceImpact: 0.22,
  },
];

const GENERAL_VISION_PATHS: VisionPath[] = [
  {
    id: "starting-range",
    label: "Closer to starting range",
    details: ["Simpler scope", "Standard materials", "Priority finishes"],
    instruction: "Keep the selected design direction with a simpler scope, standard materials, and the highest-impact finishes prioritized.",
    priceImpact: -0.1,
  },
  {
    id: "more-impact",
    label: "Add more impact",
    details: ["Elevated materials", "Statement lighting", "Focal feature"],
    instruction: "Add more visual impact through elevated materials, statement lighting, and one focal feature.",
    priceImpact: 0.1,
  },
  {
    id: "luxury-version",
    label: "Luxury version",
    details: ["Custom details", "Premium finishes", "Expanded scope"],
    instruction: "Create a luxury version with custom details, premium finishes, and an expanded project scope.",
    priceImpact: 0.22,
  },
];

function visionPathsFor(service: ServiceOption | null): VisionPath[] {
  const serviceText = `${service?.label || ""} ${service?.serviceName || ""} ${service?.serviceSummary || ""}`;
  return /landscap|outdoor|garden|patio|lawn|tree|shrub|hardscape|irrigation/i.test(serviceText)
    ? LANDSCAPE_VISION_PATHS
    : GENERAL_VISION_PATHS;
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
  showPrimer = false
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
      previewUnlocked: false,
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

// Stage order is the single source of truth for navigation direction, which in
// turn drives which way each step animates in.
const STAGE_SEQUENCE: VisualPricingStage[] = [
  "intro",
  "project",
  "scope",
  "budget",
  "gallery",
  "details",
  "customize",
  "personalize",
  "personalized-preview",
  "personalized-result",
];

function signedDeltaText(value: number, currency: string): string {
  const magnitude = Math.abs(value);
  const increment = magnitude >= 20_000 ? 5_000 : magnitude >= 4_000 ? 1_000 : 500;
  const rounded = Math.max(increment, Math.round(magnitude / increment) * increment);
  return `${value >= 0 ? "+" : "−"}${formatCurrency(rounded, currency)}`;
}

// Price impact is always spoken in money ("+$4,500"), never in percentages.
function impactDeltaText(project: VisualPricingProject, impact: number): string {
  if (impact === 0) return "No change";
  return signedDeltaText(((project.priceMin + project.priceMax) / 2) * impact, project.currency);
}

type StageDirection = "forward" | "back";

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

type LookShape = "wide" | "portrait" | "square";
// V4's cadence, kept exactly: a seven-card cycle that reads as an organic wall.
const LOOK_SHAPES: LookShape[] = ["wide", "portrait", "square", "portrait", "portrait", "square", "wide"];
const lookShapeAt = (index: number): LookShape => LOOK_SHAPES[index % LOOK_SHAPES.length];

function Sheet(props: {
  open: boolean;
  labelledBy: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!props.open) return null;
  return (
    <div className={css.scrim} role="presentation" onClick={props.onClose}>
      <div
        className={css.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={props.labelledBy}
        onClick={(event) => event.stopPropagation()}
      >
        <span className={css.sheetGrip} aria-hidden="true" />
        <button type="button" className={css.sheetClose} onClick={props.onClose} aria-label="Close">
          <X size={17} />
        </button>
        {props.children}
      </div>
    </div>
  );
}

function EmailSheet(props: {
  open: boolean;
  busy: boolean;
  error: string | null;
  project: VisualPricingProject | null;
  initialEmail?: string | null;
  onClose: () => void;
  onSubmit: (email: string) => void;
  onSkip?: () => void;
}) {
  const [email, setEmail] = useState(props.initialEmail || "");
  useEffect(() => {
    if (props.open && props.initialEmail) setEmail(props.initialEmail);
  }, [props.initialEmail, props.open]);
  if (!props.open || !props.project) return null;
  const ready = /.+@.+\..+/.test(email.trim());
  return (
    <Sheet open={props.open} labelledBy="v5-email-title" onClose={props.onClose}>
      <figure className={css.sheetPreview}>
        <img src={props.project.imageUrl} alt="" />
        <span className={css.sheetPreviewBadge} aria-hidden="true"><Mail size={16} /></span>
        <figcaption>{props.project.title}</figcaption>
      </figure>
      <h2 id="v5-email-title" className={css.sheetTitle}>Unlock {props.project.title} pricing</h2>
      <p className={css.sheetBody}>
        See the planning range and what’s typically included for this direction.
      </p>
      <form
        className={css.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !props.busy) props.onSubmit(email.trim());
        }}
      >
        <label className={css.field}>
          <span>Email address</span>
          <input
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="you@email.com"
            enterKeyHint="go"
            required
          />
        </label>
        {props.error ? <p className={css.fieldError}>{props.error}</p> : null}
        <button type="submit" className={css.primaryAction} disabled={props.busy || !ready}>
          {props.busy ? <LoaderCircle className={css.spin} size={17} /> : <LockKeyhole size={16} />}
          See pricing
        </button>
      </form>
      {props.onSkip ? (
        <button type="button" className={css.sheetSkip} onClick={props.onSkip} disabled={props.busy}>
          Skip for now — show a rough range
        </button>
      ) : null}
      <small className={css.sheetNote}>We’ll email your estimate. Unsubscribe anytime.</small>
    </Sheet>
  );
}

function PhoneSheet(props: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  if (!props.open) return null;
  const ready = phone.replace(/\D/g, "").length >= 10;
  return (
    <Sheet open={props.open} labelledBy="v5-phone-title" onClose={props.onClose}>
      <span className={css.sheetIcon} aria-hidden="true"><Phone size={20} /></span>
      <h2 id="v5-phone-title" className={css.sheetTitle}>Keep customizing your project</h2>
      <p className={css.sheetBody}>
        Unlock more personalized concepts, continued refinements, and updated pricing as you make changes.
      </p>
      <form
        className={css.sheetForm}
        onSubmit={(event) => {
          event.preventDefault();
          if (ready && !props.busy) props.onSubmit(phone);
        }}
      >
        <label className={css.field}>
          <span>Mobile number</span>
          <input
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="(555) 000-0000"
            enterKeyHint="go"
            required
          />
        </label>
        {props.error ? <p className={css.fieldError}>{props.error}</p> : null}
        <button type="submit" className={css.primaryAction} disabled={props.busy || !ready}>
          {props.busy ? <LoaderCircle className={css.spin} size={17} /> : <Sparkles size={16} />}
          Unlock continued refinements
        </button>
      </form>
      <small className={css.sheetNote}>
        This unlocks your project workspace. It does not request a consultation.
      </small>
    </Sheet>
  );
}

function StepHead({ kicker, title, body, context }: {
  kicker?: string;
  title: string;
  body?: string;
  context?: Array<string | null | undefined>;
}) {
  const line = Array.from(new Set(
    (context || []).map((value) => value?.trim()).filter((value): value is string => Boolean(value))
  ));
  return (
    <header className={css.stepHead}>
      {kicker ? <span className={css.kicker}>{kicker}</span> : null}
      <h1>{title}</h1>
      {body ? <p>{body}</p> : null}
      {line.length > 0 ? <p className={css.context}>{line.join(" · ")}</p> : null}
    </header>
  );
}

function ChoiceRow(props: {
  label: string;
  hint?: string | null;
  quiet?: boolean;
  icon?: LucideIcon | null;
  onClick: () => void;
}) {
  const Icon = props.icon || null;
  return (
    <button
      type="button"
      className={css.choice}
      data-quiet={props.quiet ? "true" : "false"}
      data-icon={Icon ? "true" : "false"}
      onClick={props.onClick}
    >
      {Icon ? (
        <span className={css.choiceThumb} aria-hidden="true">
          <Icon size={18} />
        </span>
      ) : null}
      <span className={css.choiceCopy}>
        <strong>{props.label}</strong>
        {props.hint ? <small>{props.hint}</small> : null}
      </span>
      <ChevronRight size={18} aria-hidden="true" />
    </button>
  );
}

function PriceBlock(props: {
  label: string;
  value: string;
  delta?: { amount: number; currency: string } | null;
  note: string;
}) {
  const delta = props.delta && Math.round(props.delta.amount) !== 0 ? props.delta : null;
  return (
    <div className={css.priceBlock} aria-live="polite">
      <span>{props.label}</span>
      <div className={css.priceRow}>
        <strong>{props.value}</strong>
        {delta ? (
          <span className={css.deltaChip} data-direction={delta.amount > 0 ? "up" : "down"}>
            {signedDeltaText(delta.amount, delta.currency)}
          </span>
        ) : null}
      </div>
      <small>{props.note}</small>
    </div>
  );
}

function LookCard(props: {
  project: VisualPricingProject;
  shape: LookShape;
  unlocked: boolean;
  favorite: boolean;
  showFitBadge?: boolean;
  onSelect: () => void;
  onFavorite: () => void;
}) {
  return (
    <article className={css.look} data-shape={props.shape}>
      <button
        type="button"
        className={css.lookSelect}
        onClick={props.onSelect}
        aria-label={`View pricing for ${props.project.title}`}
      >
        <span className={css.lookFrame} data-shape={props.shape}>
          <img src={props.project.imageUrl} alt={props.project.title} loading="lazy" />
          {props.showFitBadge ? (
            <span className={css.lookBadge}><Check size={12} /> Common at this level</span>
          ) : null}
          {/* Caption rides on the image, with the locked price doing the selling. */}
          <span className={css.lookMeta}>
            <strong className={css.lookTitle}>{props.project.title}</strong>
            <span className={css.lookPriceRow}>
              {props.unlocked ? (
                <em className={css.lookPrice}>{projectRangeText(props.project)}</em>
              ) : (
                <em className={css.lookLocked} aria-label="Estimated price hidden">
                  <LockKeyhole size={11} />
                  <span className={css.lookTeaser} aria-hidden="true">{partialPriceTeaser(props.project)}</span>
                  <span className={css.lookLockedLabel}>Est. price</span>
                </em>
              )}
              <span className={css.lookCta} aria-hidden="true">
                {props.unlocked ? "Details" : "View pricing"} <ArrowRight size={14} />
              </span>
            </span>
          </span>
        </span>
      </button>
      {props.unlocked ? (
        <button
          type="button"
          className={css.lookFavorite}
          data-on={props.favorite ? "true" : "false"}
          onClick={props.onFavorite}
          aria-label={props.favorite ? `Remove ${props.project.title} from saved` : `Save ${props.project.title}`}
        >
          <Heart size={15} fill={props.favorite ? "currentColor" : "none"} />
        </button>
      ) : null}
    </article>
  );
}

export function AdventureV5Experience({ instanceId, initialInstanceData, initialDesignConfig }: Props) {
  const routeVersion = "v5" as const;
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
  const [showAllScopes, setShowAllScopes] = useState(false);
  const [showAllServices, setShowAllServices] = useState(false);
  const [pendingPhoneAction, setPendingPhoneAction] = useState<PendingPhoneAction | null>(null);
  const [fullscreenAsset, setFullscreenAsset] = useState<{ imageUrl: string; label: string } | null>(null);
  const [selectedRefinementCategoryId, setSelectedRefinementCategoryId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const selectedService = useMemo(
    () => services.find((service) => service.value === snapshot?.selectedServiceId) || null,
    [services, snapshot?.selectedServiceId]
  );
  const selectedBudget = budgetBandById(snapshot?.budgetBandId || null);
  const selectedScopes = useMemo(() => scopesForService(selectedService), [selectedService]);
  const selectedProject = useMemo(() => {
    const project = snapshot?.projects.find((item) => item.assetId === snapshot.selectedProjectId) || null;
    if (!project || !selectedService) return project;
    return refreshProjectCoverage(project, selectedService);
  }, [selectedService, snapshot?.projects, snapshot?.selectedProjectId]);
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

  // Forward steps rise from below, backward steps settle from above.
  const [stageDirection, setStageDirection] = useState<StageDirection>("forward");
  const previousStageRef = useRef<VisualPricingStage | null>(null);

  /*
   * Stage changes are choreographed, not swapped. Where the browser supports
   * view transitions the outgoing screen leaves as deliberately as the next one
   * arrives; everywhere else the step's own enter animation carries it.
   */
  const patchSnapshot = useCallback((patch: Partial<VisualPricingSnapshot>) => {
    const commit = () => {
      setSnapshot((previous) => previous ? { ...previous, ...patch, updatedAt: Date.now() } : previous);
    };
    const nextStage = patch.stage;
    if (!nextStage || typeof document === "undefined") {
      commit();
      return;
    }
    const currentStage = previousStageRef.current;
    if (currentStage === nextStage) {
      commit();
      return;
    }
    const direction: StageDirection =
      currentStage && STAGE_SEQUENCE.indexOf(nextStage) < STAGE_SEQUENCE.indexOf(currentStage)
        ? "back"
        : "forward";
    const doc = document as ViewTransitionDocument;
    const start = doc.startViewTransition?.bind(doc);
    const reducedMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!start || reducedMotion) {
      setStageDirection(direction);
      commit();
      return;
    }
    /*
     * Native view transitions already animate the complete stage. Keep the
     * per-child fallback disabled for the rest of this mount; otherwise removing
     * the document transition flag below starts every child's CSS animation and
     * makes one click look like two consecutive page refreshes.
     */
    if (rootRef.current) rootRef.current.dataset.nativeTransitions = "true";
    doc.documentElement.dataset.adventureTransition = direction;
    const transition = start(() => {
      flushSync(() => {
        setStageDirection(direction);
        commit();
      });
    });
    void transition.finished
      .catch(() => undefined)
      .finally(() => { delete doc.documentElement.dataset.adventureTransition; });
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
          stage: saved.stage === "intro" ? firstQuestionStage(savedService) : saved.stage,
          lead: {
            ...saved.lead,
            previewUnlocked: Boolean(saved.lead?.previewUnlocked),
          },
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
    stageRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
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
            budgetMode: "lens",
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
    const pricingOpen = Boolean(snapshot.lead.emailCaptured || snapshot.lead.previewUnlocked);
    track("adventure_v3_visual_project_selected", {
      assetId: project.assetId,
      scope: project.scope,
      budgetBandId: snapshot.budgetBandId,
    }, project.assetId);
    patchSnapshot({
      selectedProjectId: project.assetId,
      ...(pricingOpen ? { stage: "details" as const } : {}),
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
    if (pricingOpen) {
      setEmailOpen(false);
      setEmailError(null);
      return;
    }
    setEmailOpen(true);
  }, [patchSnapshot, snapshot, track]);

  const skipEmailForPartialRange = useCallback(() => {
    if (!snapshot || !selectedProject) return;
    setEmailOpen(false);
    setEmailError(null);
    patchSnapshot({
      selectedProjectId: selectedProject.assetId,
      stage: "details",
      lead: {
        ...snapshot.lead,
        previewUnlocked: true,
      },
    });
    track("adventure_v5_pricing_preview_skipped", { projectId: selectedProject.assetId });
  }, [patchSnapshot, selectedProject, snapshot, track]);

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
      && (
        snapshot.projectRefinementHistory.length >= PROJECT_REFINEMENT_LIMIT
      )
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
    // One personalized concept is revealed before asking for a phone number.
    // From there, every additional revision is a phone-unlocked tool.
    const refinementLimit = PERSONALIZED_REFINEMENT_LIMIT;
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
    const entry = firstQuestionStage(selectedService);
    const fallback: Partial<Record<VisualPricingStage, VisualPricingStage>> = {
      scope: services.length > 1 ? "project" : entry,
      budget: selectedScopes.length > 1 ? "scope" : services.length > 1 ? "project" : entry,
      gallery: "budget",
      details: "gallery",
      customize: "details",
      personalize: "customize",
      "personalized-preview": "personalize",
      "personalized-result": "personalized-preview",
    };
    const next = fallback[snapshot.stage];
    if (!next || next === snapshot.stage) return;
    // Never walk back into the retired primer, or before the funnel entry question.
    if (next === "intro" || STAGE_SEQUENCE.indexOf(next) < STAGE_SEQUENCE.indexOf(entry)) return;
    patchSnapshot({ stage: next });
  }, [patchSnapshot, selectedScopes.length, selectedService, services.length, snapshot]);
  useEffect(() => {
    const stage = snapshot?.stage;
    if (!stage || stage === "loading") return;
    const previous = previousStageRef.current;
    if (previous && previous !== stage) {
      setStageDirection(
        STAGE_SEQUENCE.indexOf(stage) < STAGE_SEQUENCE.indexOf(previous) ? "back" : "forward"
      );
    }
    previousStageRef.current = stage;
  }, [snapshot?.stage]);

  if (!snapshot || snapshot.stage === "loading") {
    return (
      <div ref={rootRef} className={css.root} data-adventure-version="v5" data-v3-funnel="visual-pricing">
        <div className={css.booting} role="status">
          <LoaderCircle className={css.spin} size={20} />
          <span>Loading visual pricing…</span>
        </div>
      </div>
    );
  }

  const rootStyle = {
    // Two anchors (background + ink) plus the brand accent; every other tone in
    // the stylesheet is mixed from these so any tenant palette stays coherent.
    "--v5-bg": design.background_color || "#f6f6f7",
    "--v5-ink": design.prompt_text_color || design.brand_name_color || "#101216",
    "--v5-accent": design.primary_color || design.submit_button_background_color || "#101216",
    "--v5-on-accent": design.submit_button_text_color || "#ffffff",
    "--v5-lift": "#ffffff",
    "--v5-radius": `${Math.min(28, Math.max(10, Number(design.border_radius ?? 16)))}px`,
    backgroundImage: design.background_gradient || undefined,
    fontFamily: design.font_family || '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: design.base_font_size ? `${design.base_font_size}px` : undefined,
  } as React.CSSProperties;

  const progressSteps = ["Project", "Budget", "Inspiration", "Estimate", "Next steps"];
  const progressIndex = snapshot.stage === "intro" || snapshot.stage === "project" || snapshot.stage === "scope"
    ? 0
    : snapshot.stage === "budget"
      ? 1
      : snapshot.stage === "gallery"
        ? 2
        : snapshot.stage === "details" || snapshot.stage === "customize"
          ? 3
          : 4;
  const entryStage = firstQuestionStage(selectedService);
  const canGoBack = snapshot.stage !== "intro" && snapshot.stage !== entryStage;
  const serviceWord = selectedService?.label.toLowerCase() || "project";
  const pricingVisible = Boolean(snapshot.lead.emailCaptured || snapshot.lead.previewUnlocked);
  const brandConfigured = Boolean(
    (design.logo_enabled && design.logo_url)
    || ((design.brand_name_enabled !== false) && design.brand_name)
  );
  const brandFallback = !brandConfigured
    ? String(design.brand_name || instance?.name || "").trim()
    : "";
  const visibleScopes = showAllScopes || selectedScopes.length <= 4
    ? selectedScopes
    : selectedScopes.slice(0, 4);
  const hiddenScopeCount = Math.max(0, selectedScopes.length - visibleScopes.length);
  const visibleServices = showAllServices || services.length <= 4
    ? services
    : services.slice(0, 4);
  const hiddenServiceCount = Math.max(0, services.length - visibleServices.length);
  const openCustomize = () => {
    if (!snapshot.lead.emailCaptured) {
      setEmailOpen(true);
      return;
    }
    setSelectedRefinementCategoryId(null);
    const popular = visionPathsFor(selectedService).find((path) => path.id === "more-impact")
      || visionPathsFor(selectedService)[1]
      || null;
    patchSnapshot({
      stage: "customize",
      refinementPrompt: "",
      refinementSuggestions: popular ? [popular.instruction] : [],
      refinementPriceImpact: popular?.priceImpact ?? 0,
    });
  };

  const estimateConfig = snapshot.estimateConfig || DEFAULT_ESTIMATE_CONFIG;
  const refinementCategories = selectedProject ? refinementComponentsForProject(selectedProject, selectedService) : [];
  const selectedRefinementCategory = refinementCategories.find((category) => category.id === selectedRefinementCategoryId) || null;
  const projectActiveIndex = Math.max(0, Math.min(
    snapshot.projectActiveRefinementIndex,
    snapshot.projectRefinementHistory.length
  ));
  const activeProjectEntry = projectActiveIndex > 0 ? snapshot.projectRefinementHistory[projectActiveIndex - 1] : undefined;
  const activeProjectImageUrl = activeProjectEntry?.imageUrl || selectedProject?.imageUrl || "";
  const thumbnailPool = Array.from(new Set([
    selectedProject?.imageUrl,
    ...snapshot.projects.map((project) => project.imageUrl),
  ].filter((imageUrl): imageUrl is string => Boolean(imageUrl))));
  const thumbnailAt = (index: number) => thumbnailPool[index % Math.max(1, thumbnailPool.length)] || activeProjectImageUrl;
  const selectedRefinementOption = selectedRefinementCategory?.options
    .find((option) => snapshot.refinementSuggestions.includes(option.instruction)) || null;
  const hasPendingRefinement = snapshot.refinementSuggestions.length > 0 || Boolean(snapshot.refinementPrompt.trim());
  const activeProjectChanges = snapshot.projectRefinementHistory
    .slice(0, projectActiveIndex)
    .map((entry) => entry.changeLabel || "")
    .filter(Boolean);
  const baseProjectRange = selectedProject
    ? storedPlanningRange(activeProjectEntry) || configuredProjectRange(selectedProject, estimateConfig, {
        suggestions: activeProjectChanges,
      })
    : null;
  const liveRange = selectedProject
    ? hasPendingRefinement
      ? configuredProjectRange(selectedProject, estimateConfig, {
          suggestions: [...activeProjectChanges, ...snapshot.refinementSuggestions],
          prompt: snapshot.refinementPrompt,
          priceImpact: snapshot.refinementSuggestions.length > 0 ? snapshot.refinementPriceImpact : undefined,
        })
      : baseProjectRange
    : null;
  const pendingProjectDelta = hasPendingRefinement && liveRange && baseProjectRange
    ? ((liveRange.totalMin + liveRange.totalMax) - (baseProjectRange.totalMin + baseProjectRange.totalMax)) / 2
    : 0;
  const visionPaths = visionPathsFor(selectedService);
  const selectedVisionPath = visionPaths.find((path) => snapshot.refinementSuggestions.includes(path.instruction)) || null;
  const displayedPriceRange = liveRange
    ? priceRangeText(liveRange)
    : selectedProject
      ? priceRangeText({
          totalMin: selectedProject.priceMin,
          totalMax: selectedProject.priceMax,
          currency: selectedProject.currency,
        })
      : "";
  const displayedEstimateRange = pricingVisible
    ? displayedPriceRange
    : selectedProject
      ? partialPriceTeaser(selectedProject)
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
  const pendingPersonalizedDelta = hasPendingPersonalizedRefinement && personalizedLiveRange && activePersonalizedRange
    ? ((personalizedLiveRange.totalMin + personalizedLiveRange.totalMax)
        - (activePersonalizedRange.totalMin + activePersonalizedRange.totalMax)) / 2
    : 0;
  const personalizedUnlocked = snapshot.lead.phoneStatus === "unlocked";
  const projectRefinementGateWillOpen = !personalizedUnlocked
    && Number.isFinite(PROJECT_REFINEMENT_LIMIT)
    && snapshot.projectRefinementHistory.length >= PROJECT_REFINEMENT_LIMIT;
  const personalizedGateWillOpen = !personalizedUnlocked
    && snapshot.personalizedRefinements.length >= PERSONALIZED_REFINEMENT_LIMIT;
  const favorited = selectedProject ? snapshot.favoriteProjectIds.includes(selectedProject.assetId) : false;

  return (
    <div ref={rootRef} className={css.root} style={rootStyle} data-adventure-version="v5" data-v3-funnel="visual-pricing">
      <header className={css.chrome}>
        <div className={css.chromeInner}>
          <button
            type="button"
            className={css.iconAction}
            onClick={goBack}
            disabled={!canGoBack}
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={css.brand}>
            <BrandHeader config={design} compact />
            {brandFallback ? <span className={css.brandFallback}>{brandFallback}</span> : null}
          </div>
          <button
            type="button"
            className={css.iconAction}
            onClick={() => resetExperience("in_form")}
            aria-label="Start over"
            title="Start over"
          >
            <RotateCcw size={16} />
          </button>
        </div>
        <div
          className={css.progress}
          role="progressbar"
          aria-valuemin={1}
          aria-valuemax={progressSteps.length}
          aria-valuenow={progressIndex + 1}
          aria-label={`Step ${progressIndex + 1} of ${progressSteps.length}: ${progressSteps[progressIndex]}`}
        >
          {progressSteps.map((label, index) => (
            <span
              key={label}
              data-state={index < progressIndex ? "done" : index === progressIndex ? "current" : "todo"}
            />
          ))}
        </div>
      </header>

      <main ref={stageRef} className={css.stage} data-stage={snapshot.stage} data-direction={stageDirection}>
        <input
          ref={uploadRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.currentTarget.value = "";
            if (file) void uploadRoom(file, snapshot.stage !== "personalize");
          }}
        />

        {snapshot.stage === "project" ? (
          <section className={css.step} key="project">
            <StepHead
              kicker="Your project"
              title="What are you planning?"
              body="Choose the closest option to see relevant examples and pricing."
            />
            <div className={css.choices}>
              {visibleServices.map((service) => (
                <ChoiceRow
                  key={service.value}
                  label={service.label}
                  icon={choiceIconFor(service.label)}
                  onClick={() => chooseService(service)}
                />
              ))}
              {hiddenServiceCount > 0 ? (
                <ChoiceRow
                  label="Something else"
                  hint={`Show ${hiddenServiceCount} more options`}
                  quiet
                  onClick={() => setShowAllServices(true)}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "scope" ? (
          <section className={css.step} key="scope">
            <StepHead
              kicker="Your project"
              title="What do you need?"
              body="Choose the closest option."
              context={[selectedService?.label]}
            />
            <div className={css.choices}>
              {visibleScopes.map((scope) => (
                <ChoiceRow
                  key={scope}
                  label={scope}
                  icon={choiceIconFor(scope)}
                  onClick={() => chooseScope(scope)}
                />
              ))}
              {hiddenScopeCount > 0 ? (
                <ChoiceRow
                  label="Something else"
                  hint={`Show ${hiddenScopeCount} more options`}
                  quiet
                  onClick={() => setShowAllScopes(true)}
                />
              ) : null}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "budget" ? (
          <section className={css.step} key="budget">
            <StepHead
              kicker="Budget"
              title="What’s your budget?"
              body="This helps us curate inspiration. It does not cap your project."
              context={[selectedService?.label, snapshot.selectedScope]}
            />
            <div className={css.choices}>
              {BUDGET_BANDS.map((band) => (
                <ChoiceRow
                  key={band.id}
                  label={band.label}
                  hint={band.id === "not-sure" ? "We’ll show typical projects instead" : null}
                  quiet={band.id === "not-sure"}
                  onClick={() => chooseBudget(band)}
                />
              ))}
            </div>
            <p className={css.socialProof}>
              Most full {serviceWord} projects land in the $25,000–$40,000 range.
            </p>
          </section>
        ) : null}

        {snapshot.stage === "gallery" ? (
          <section className={css.step} key="gallery">
            <StepHead
              kicker="Inspiration"
              title="See what’s possible at your budget"
              body="Choose the direction you love—your range can evolve from there."
              context={[
                selectedService?.label,
                snapshot.selectedScope,
                selectedBudget?.galleryLabel,
                snapshot.projects.length > 6 ? `${snapshot.projects.length} ideas` : null,
              ]}
            />
            {pricingVisible ? (
              <div className={css.wallMeta}>
                <span className={css.wallUnlocked}>
                  <CheckCircle2 size={14} />
                  {snapshot.lead.emailCaptured ? "Pricing unlocked" : "Rough range unlocked"}
                </span>
              </div>
            ) : null}
            {catalogBusy ? (
              <div className={css.lookFlow} aria-hidden="true">
                {Array.from({ length: 9 }, (_, index) => (
                  <div key={index} className={css.lookSkeleton} data-shape={lookShapeAt(index)} />
                ))}
              </div>
            ) : snapshot.projects.length > 0 ? (
              <div className={css.lookFlow}>
                {snapshot.projects.map((project, index) => (
                  <LookCard
                    key={project.assetId}
                    project={project}
                    shape={lookShapeAt(index)}
                    unlocked={pricingVisible}
                    favorite={snapshot.favoriteProjectIds.includes(project.assetId)}
                    showFitBadge={index < 2 || index % 7 === 0}
                    onSelect={() => selectProject(project)}
                    onFavorite={() => toggleFavorite(project.assetId)}
                  />
                ))}
              </div>
            ) : (
              <div className={css.empty}>
                <ImagePlus size={22} />
                <strong>We couldn’t load the project gallery.</strong>
                <small>{error || "Try the catalog again."}</small>
                <button
                  type="button"
                  className={css.secondaryAction}
                  onClick={() => { setError(null); setCatalogNonce((value) => value + 1); }}
                >
                  Try again
                </button>
              </div>
            )}
          </section>
        ) : null}

        {snapshot.stage === "details" && selectedProject ? (
          <section className={css.step} key="details" data-compact="true">
            {/*
              Image-led reveal: big picture, one price, one primary action.
              Coverage stays collapsed so curiosity doesn’t bury the CTA.
            */}
            <div className={css.reveal}>
              <figure className={css.hero}>
                <img src={activeProjectImageUrl} alt={selectedProject.title} />
                <button
                  type="button"
                  className={css.heroSave}
                  data-on={favorited ? "true" : "false"}
                  aria-label={favorited ? "Remove from saved" : "Save this design"}
                  onClick={() => toggleFavorite(selectedProject.assetId)}
                >
                  <Heart size={17} fill={favorited ? "currentColor" : "none"} />
                </button>
              </figure>
              <div className={css.revealPanel}>
                <header className={css.revealHead}>
                  <span className={css.kicker}>Your estimate</span>
                  <h1>{selectedProject.title}</h1>
                </header>
                <div className={css.revealPrice}>
                  <span className={css.kicker}>
                    {snapshot.lead.emailCaptured ? "Estimated project range" : "Rough planning range"}
                  </span>
                  <p className={css.priceValue} data-partial={!snapshot.lead.emailCaptured ? "true" : "false"}>
                    {displayedEstimateRange}
                  </p>
                  <p className={css.priceContext}>
                    <span className={css.priceBadge}><Check size={12} /> Planning range, not a quote</span>
                    <span>
                      {!snapshot.lead.emailCaptured
                        ? "Email unlocks the tighter range and customize tools."
                        : selectedBudget && selectedBudget.id !== "not-sure"
                          ? `Based on your ${selectedBudget.galleryLabel} starting point.`
                          : "Based on this design direction."}
                    </span>
                  </p>
                  {snapshot.lead.emailStatus === "sent" ? (
                    <p className={css.sentNote}><CheckCircle2 size={14} /> Pricing sent to your email</p>
                  ) : null}
                </div>
                <div className={css.revealActions}>
                  <button type="button" className={css.primaryAction} onClick={openCustomize}>
                    {snapshot.lead.emailCaptured ? "Customize this design" : "Email to unlock full estimate"}
                    <ArrowRight size={16} />
                  </button>
                  <p className={css.context}>
                    {snapshot.lead.emailCaptured
                      ? "Adjust this estimate as you go."
                      : "Unlock customize tools and the tightened planning range."}
                  </p>
                </div>
                <div className={css.revealMeta}>
                  <details className={css.disclosure}>
                    <summary>What’s covered <ChevronRight size={14} /></summary>
                    <div className={css.disclosureBody}>
                      <section>
                        <h3>This direction typically includes</h3>
                        <ul>
                          {selectedProject.inclusions.slice(0, 5).map((item) => (
                            <li key={item}>
                              <Check size={13} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                      <section>
                        <h3>Final price depends on</h3>
                        <ul>
                          {(selectedProject.priceIncreases.length > 0 ? selectedProject.priceIncreases : [
                            "Square footage and the overall scale of the work",
                            "Standard selections versus premium stone and finishes",
                            "Focal elements, utilities, and custom details",
                            "Access, grading, drainage, and existing removal",
                          ]).slice(0, 3).map((item) => (
                            <li key={item}>
                              <Check size={13} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </details>
                  <button
                    type="button"
                    className={css.linkAction}
                    onClick={() => {
                      if (!snapshot.lead.emailCaptured) {
                        setEmailOpen(true);
                        return;
                      }
                      patchSnapshot({ stage: "personalize" });
                    }}
                  >
                    See your version in your space
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {snapshot.stage === "customize" && selectedProject ? (
          <section className={css.step} key="customize" data-compact="true">
            <div className={css.split}>
              <div className={css.splitMedia}>
                <figure className={css.canvas}>
                  <img key={activeProjectImageUrl} src={activeProjectImageUrl} alt={selectedProject.title} />
                  {snapshot.projectRefinementHistory.length > 0 ? (
                    <span className={css.canvasBadge}><Sparkles size={12} /> AI refined</span>
                  ) : null}
                  {snapshot.projectRefinementHistory.length > 0 ? (
                    <div className={css.canvasPager} aria-label="Design version navigation">
                      <button
                        type="button"
                        aria-label="Previous version"
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
                        aria-label="Next version"
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
                  <div className={css.canvasTools}>
                    <button
                      type="button"
                      aria-label={personalizedUnlocked ? "Download this design" : "Unlock download"}
                      onClick={() => requestImageAction("download", activeProjectImageUrl, `${selectedProject.title}-version-${projectActiveIndex + 1}`)}
                    >
                      <Download size={15} />
                      {!personalizedUnlocked ? <LockKeyhole className={css.toolLock} size={9} /> : null}
                    </button>
                    <button
                      type="button"
                      aria-label={personalizedUnlocked ? "View fullscreen" : "Unlock fullscreen"}
                      onClick={() => requestImageAction("fullscreen", activeProjectImageUrl, `${selectedProject.title} · Version ${projectActiveIndex + 1}`)}
                    >
                      <Maximize2 size={15} />
                      {!personalizedUnlocked ? <LockKeyhole className={css.toolLock} size={9} /> : null}
                    </button>
                    <button
                      type="button"
                      data-on={favorited ? "true" : "false"}
                      aria-label={favorited ? "Remove from saved" : "Save this design"}
                      onClick={() => toggleFavorite(selectedProject.assetId)}
                    >
                      <Heart size={15} fill={favorited ? "currentColor" : "none"} />
                    </button>
                  </div>
                  {projectRefinementBusy ? (
                    <div className={css.canvasBusy} role="status" aria-live="polite">
                      <LoaderCircle className={css.spin} size={22} />
                      <strong>Creating your version…</strong>
                      <small>Keeping the original setting intact.</small>
                    </div>
                  ) : null}
                </figure>
              </div>

              <div className={css.splitPanel}>
                <div className={css.customizeStack}>
                  <header className={css.customizeHead}>
                    <span className={css.kicker}>Make it yours</span>
                    <PriceBlock
                      label="Estimated project range"
                      value={displayedPriceRange}
                      delta={hasPendingRefinement && liveRange
                        ? { amount: pendingProjectDelta, currency: liveRange.currency }
                        : null}
                      note={hasPendingRefinement && liveRange && Math.round(pendingProjectDelta) !== 0
                        ? `About ${signedDeltaText(pendingProjectDelta, liveRange.currency)} from this choice`
                        : "Your estimate updates as you make each choice."}
                    />
                  </header>

                  <div className={css.dirOptions} role="group" aria-label="Design directions">
                    {visionPaths.map((path) => {
                      const selected = selectedVisionPath?.id === path.id;
                      const popular = path.id === "more-impact";
                      return (
                        <button
                          key={path.id}
                          type="button"
                          className={css.dirOption}
                          data-on={selected ? "true" : "false"}
                          aria-pressed={selected}
                          onClick={() => {
                            patchSnapshot({
                              refinementPrompt: "",
                              refinementSuggestions: selected ? [] : [path.instruction],
                              refinementPriceImpact: selected ? 0 : path.priceImpact,
                            });
                            track("adventure_v5_vision_path_selected", { path: path.id, selected: !selected });
                          }}
                        >
                          <strong>
                            {path.label}
                            {popular ? <em className={css.dirPopular}>Most popular</em> : null}
                          </strong>
                          <span>{path.details.join(" · ")}</span>
                          <span className={css.dirDelta}>
                            {impactDeltaText(selectedProject, path.priceImpact)}
                            <i className={css.dirCheck} aria-hidden="true"><Check size={13} /></i>
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {snapshot.projectRefinementHistory.length > 0 ? (
                    <div className={css.versionStrip} aria-label="Project versions">
                      <button
                        type="button"
                        data-on={projectActiveIndex === 0 ? "true" : "false"}
                        aria-label="View original design"
                        onClick={() => patchSnapshot({
                          projectActiveRefinementIndex: 0,
                          refinementPrompt: "",
                          refinementSuggestions: [],
                          refinementPriceImpact: 0,
                        })}
                      >
                        <img src={selectedProject.imageUrl} alt="" loading="lazy" />
                      </button>
                      {snapshot.projectRefinementHistory.map((entry, index) => (
                        <button
                          key={`${entry.assetId}-${index}`}
                          type="button"
                          data-on={projectActiveIndex === index + 1 ? "true" : "false"}
                          aria-label={`View version ${index + 2}`}
                          onClick={() => patchSnapshot({
                            projectActiveRefinementIndex: index + 1,
                            refinementPrompt: "",
                            refinementSuggestions: [],
                            refinementPriceImpact: 0,
                          })}
                        >
                          <img src={entry.imageUrl} alt="" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  ) : null}

                  {error ? <p className={css.fieldError}>{error}</p> : null}

                  <div className={css.customizeActions}>
                    {hasPendingRefinement ? (
                      <button
                        type="button"
                        className={css.secondaryAction}
                        onClick={() => void refineSelectedProject()}
                        disabled={projectRefinementBusy}
                      >
                        {projectRefinementBusy
                          ? <LoaderCircle className={css.spin} size={16} />
                          : projectRefinementGateWillOpen
                            ? <LockKeyhole size={16} />
                            : <WandSparkles size={16} />}
                        {projectRefinementBusy
                          ? "Creating your version…"
                          : projectRefinementGateWillOpen
                            ? "Unlock next change"
                            : "Preview this direction"}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={css.primaryAction}
                      onClick={() => patchSnapshot({ stage: "personalize" })}
                    >
                      See your version in your space
                      <ArrowRight size={16} />
                    </button>
                    <p className={css.context}>Upload a photo of your space, then keep editing.</p>
                  </div>

                  <div className={css.customizeLinks}>
                    <details className={css.moreWays}>
                      <summary>More ways to adjust <ChevronRight size={14} /></summary>
                      <div className={css.moreWaysBody}>
                        {selectedRefinementCategory ? (
                          <>
                            <div className={css.pickerHead}>
                              <strong>{refinementCategoryHeading(selectedRefinementCategory.label)}</strong>
                              <button
                                type="button"
                                className={css.linkAction}
                                onClick={() => {
                                  setSelectedRefinementCategoryId(null);
                                  patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                                }}
                              ><ArrowLeft size={12} /> All parts</button>
                            </div>
                            <div className={css.tiles}>
                              {selectedRefinementCategory.options.map((option, index) => {
                                const selected = selectedRefinementOption?.id === option.id;
                                return (
                                  <button
                                    key={option.id}
                                    type="button"
                                    className={css.tile}
                                    data-on={selected ? "true" : "false"}
                                    aria-pressed={selected}
                                    onClick={() => {
                                      patchSnapshot({
                                        refinementSuggestions: selected ? [] : [option.instruction],
                                        refinementPriceImpact: selected ? 0 : option.priceImpact,
                                      });
                                      track("adventure_v5_refinement_option_selected", {
                                        category: selectedRefinementCategory.label,
                                        option: option.label,
                                        selected: !selected,
                                      });
                                    }}
                                  >
                                    <img src={thumbnailAt(index + refinementCategories.length)} alt="" loading="lazy" />
                                    <strong>{option.label}</strong>
                                    <small>{impactDeltaText(selectedProject, option.priceImpact)}</small>
                                  </button>
                                );
                              })}
                            </div>
                          </>
                        ) : (
                          <div className={css.tiles}>
                            {refinementCategories.map((category, index) => (
                              <button
                                key={category.id}
                                type="button"
                                className={css.tile}
                                onClick={() => {
                                  setSelectedRefinementCategoryId(category.id);
                                  patchSnapshot({ refinementSuggestions: [], refinementPriceImpact: 0 });
                                  track("adventure_v5_refinement_category_selected", { category: category.label });
                                }}
                              >
                                <img src={thumbnailAt(index)} alt="" loading="lazy" />
                                <strong>{category.label}</strong>
                                <small>Adjust</small>
                              </button>
                            ))}
                          </div>
                        )}
                        <form
                          className={css.promptRow}
                          onSubmit={(event) => {
                            event.preventDefault();
                            if (snapshot.refinementPrompt.trim() && !projectRefinementBusy) void refineSelectedProject();
                          }}
                        >
                          <WandSparkles size={16} aria-hidden="true" />
                          <input
                            value={snapshot.refinementPrompt}
                            onChange={(event) => patchSnapshot({ refinementPrompt: event.target.value })}
                            aria-label="Describe a specific design change"
                            placeholder="Try “Use warmer materials and cleaner lines”"
                            enterKeyHint="go"
                          />
                          <button
                            type="submit"
                            aria-label="Preview this change"
                            disabled={!snapshot.refinementPrompt.trim() || projectRefinementBusy}
                          >
                            {projectRefinementBusy ? <LoaderCircle className={css.spin} size={15} /> : <ArrowRight size={15} />}
                          </button>
                        </form>
                      </div>
                    </details>
                    <button type="button" className={css.linkAction} onClick={() => patchSnapshot({ stage: "gallery" })}>
                      Try another project direction
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {snapshot.stage === "personalize" && selectedProject ? (
          <section className={css.step} key="personalize">
            <div className={css.personalize}>
              <StepHead
                kicker="Your space"
                title="See this direction in your own space."
                body="Upload a photo and we’ll create a version using your actual setting. Your budget and selections carry forward automatically."
                context={[snapshot.selectedScope, selectedBudget?.galleryLabel, selectedProject.title]}
              />
              {!snapshot.sourceAsset ? (
                <button type="button" className={css.dropzone} onClick={() => uploadRef.current?.click()} disabled={uploadBusy}>
                  {uploadBusy ? <LoaderCircle className={css.spin} size={26} /> : <Upload size={26} />}
                  <strong>{uploadBusy ? "Uploading your photo…" : "Upload or take a photo"}</strong>
                  <small>JPG, PNG, or WebP · up to 10 MB · private, not posted · about 20 seconds</small>
                </button>
              ) : (
                <>
                  <div className={css.compare}>
                    <figure>
                      <img src={snapshot.sourceAsset.url} alt="Your uploaded space" />
                      <figcaption>Your space</figcaption>
                    </figure>
                    <figure>
                      <img src={activeProjectImageUrl} alt={selectedProject.title} />
                      <figcaption>Look to apply</figcaption>
                    </figure>
                  </div>
                  <div className={css.stepFoot}>
                    <button type="button" className={css.linkAction} onClick={() => uploadRef.current?.click()}>
                      Replace photo
                    </button>
                  </div>
                  <div className={css.questions}>
                    <div>
                      <strong>Keep the current layout?</strong>
                      <small>This is the main price-driving personalization question.</small>
                      <span className={css.segmented}>
                        <button
                          type="button"
                          data-on={snapshot.keepLayout ? "true" : "false"}
                          onClick={() => patchSnapshot({ keepLayout: true })}
                        >Yes, keep it</button>
                        <button
                          type="button"
                          data-on={!snapshot.keepLayout ? "true" : "false"}
                          onClick={() => patchSnapshot({ keepLayout: false })}
                        >Open to changes</button>
                      </span>
                    </div>
                    <div>
                      <strong>Anything important to keep?</strong>
                      <small>Optional—choose only what matters.</small>
                      <span className={css.pills}>
                        {components.map((component) => {
                          const selected = snapshot.featuresToKeep.includes(component);
                          return (
                            <button
                              key={component}
                              type="button"
                              data-on={selected ? "true" : "false"}
                              onClick={() => patchSnapshot({
                                featuresToKeep: selected
                                  ? snapshot.featuresToKeep.filter((item) => item !== component)
                                  : [...snapshot.featuresToKeep, component],
                              })}
                            >
                              <Check size={12} /> {component}
                            </button>
                          );
                        })}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    className={css.primaryAction}
                    onClick={() => void generatePreview()}
                    disabled={previewBusy}
                  >
                    {previewBusy ? <LoaderCircle className={css.spin} size={16} /> : <Sparkles size={16} />}
                    {previewBusy ? "Creating your preview…" : "Create my personalized preview"}
                  </button>
                </>
              )}
              {error ? <p className={css.fieldError}>{error}</p> : null}
              <div className={css.stepFoot}>
                <button type="button" className={css.linkAction} onClick={() => patchSnapshot({ stage: "gallery" })}>
                  Keep browsing visual pricing
                </button>
              </div>
            </div>
          </section>
        ) : null}

        {(snapshot.stage === "personalized-preview" || snapshot.stage === "personalized-result")
          && selectedProject && selectedPreview ? (
          <section className={css.step} key="personalized">
            <StepHead
              kicker="Your space"
              title="This look, in your space."
              body={personalizedUnlocked
                ? "Keep shaping the design. Every revision updates the image and planning price together."
                : "Your concept is ready. Make one refinement and see the image and estimate change together."}
              context={[snapshot.selectedScope, selectedProject.title]}
            />

            <div className={css.split}>
              <div className={css.splitMedia}>
                <figure className={css.canvas}>
                  <img
                    key={selectedPreview.imageUrl}
                    src={selectedPreview.imageUrl}
                    alt={personalizedActiveIndex === 0 ? "Your first personalized concept" : `Revision ${personalizedActiveIndex}`}
                  />
                  <span className={css.canvasBadge}>
                    {personalizedActiveIndex > 0 ? `Revision ${personalizedActiveIndex}` : "Your first concept"}
                  </span>
                  <div className={css.canvasTools}>
                    <button
                      type="button"
                      aria-label={personalizedUnlocked ? "Download this version" : "Unlock version download"}
                      onClick={() => requestImageAction("download", selectedPreview.imageUrl, `${selectedProject.title}-revision-${personalizedActiveIndex}`)}
                    >
                      <Download size={15} />
                      {!personalizedUnlocked ? <LockKeyhole className={css.toolLock} size={9} /> : null}
                    </button>
                    <button
                      type="button"
                      aria-label={personalizedUnlocked ? "View this version fullscreen" : "Unlock fullscreen view"}
                      onClick={() => requestImageAction("fullscreen", selectedPreview.imageUrl, `${selectedProject.title} · Revision ${personalizedActiveIndex}`)}
                    >
                      <Maximize2 size={15} />
                      {!personalizedUnlocked ? <LockKeyhole className={css.toolLock} size={9} /> : null}
                    </button>
                  </div>
                  {snapshot.personalizedConcepts.length > 1 ? (
                    <div className={css.canvasPager} aria-label="Personalized version navigation">
                      <button
                        type="button"
                        aria-label="Previous personalized version"
                        disabled={personalizedActiveIndex === 0}
                        onClick={() => patchSnapshot({
                          personalizedActiveConceptIndex: Math.max(0, personalizedActiveIndex - 1),
                          personalizedRefinementChoiceId: null,
                          personalizedRefinementPrompt: "",
                        })}
                      ><ChevronLeft size={16} /></button>
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
                      ><ChevronRight size={16} /></button>
                    </div>
                  ) : null}
                  {snapshot.sourceAsset?.url ? (
                    <figure className={css.beforeChip}>
                      <img src={snapshot.sourceAsset.url} alt="Your space before personalization" />
                      <figcaption>Before</figcaption>
                    </figure>
                  ) : null}
                  {personalizedRefinementBusy ? (
                    <div className={css.canvasBusy} role="status" aria-live="polite">
                      <LoaderCircle className={css.spin} size={22} />
                      <strong>Creating your revision…</strong>
                      <small>Your current design stays here until the new one is ready.</small>
                    </div>
                  ) : null}
                </figure>
              </div>

              <div className={css.splitPanel}>
                <PriceBlock
                  label={hasPendingPersonalizedRefinement ? "Estimate with this change" : "Current planning estimate"}
                  value={personalizedLiveRange
                    ? `${formatCurrency(personalizedLiveRange.totalMin, personalizedLiveRange.currency)}–${formatCurrency(personalizedLiveRange.totalMax, personalizedLiveRange.currency)}`
                    : projectRangeText(selectedProject)}
                  delta={hasPendingPersonalizedRefinement && personalizedLiveRange
                    ? { amount: pendingPersonalizedDelta, currency: personalizedLiveRange.currency }
                    : null}
                  note={hasPendingPersonalizedRefinement && personalizedLiveRange && Math.round(pendingPersonalizedDelta) !== 0
                    ? `This change moves your estimate by about ${signedDeltaText(pendingPersonalizedDelta, personalizedLiveRange.currency)}.`
                    : "Changes to your selections and requests update this range."}
                />

                <div className={css.pills}>
                  {personalizedOptions.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      data-on={snapshot.personalizedRefinementChoiceId === option.id ? "true" : "false"}
                      onClick={() => patchSnapshot({
                        personalizedRefinementChoiceId: snapshot.personalizedRefinementChoiceId === option.id ? null : option.id,
                      })}
                    >
                      {option.label}
                      <small>{impactDeltaText(selectedProject, option.priceImpact)}</small>
                    </button>
                  ))}
                </div>

                <label className={css.promptRow}>
                  <WandSparkles size={16} aria-hidden="true" />
                  <input
                    value={snapshot.personalizedRefinementPrompt}
                    onChange={(event) => patchSnapshot({ personalizedRefinementPrompt: event.target.value })}
                    placeholder="Or describe a change…"
                    aria-label="Describe a change"
                  />
                </label>

                <button
                  type="button"
                  className={css.primaryAction}
                  disabled={!hasPendingPersonalizedRefinement || personalizedRefinementBusy}
                  onClick={() => void applyPersonalizedRefinement()}
                >
                  {personalizedRefinementBusy
                    ? <LoaderCircle className={css.spin} size={16} />
                    : personalizedGateWillOpen
                      ? <LockKeyhole size={16} />
                      : <Sparkles size={16} />}
                  {personalizedRefinementBusy
                    ? "Creating revision…"
                    : personalizedGateWillOpen
                      ? "Unlock next refinement"
                      : "Apply refinement"}
                </button>

                {!personalizedUnlocked ? (
                  <button
                    type="button"
                    className={css.secondaryAction}
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

                {error ? <p className={css.fieldError}>{error}</p> : null}

                {snapshot.personalizedConcepts.length > 1 ? (
                  <div className={css.rail}>
                    <div className={css.railHead}>
                      <strong>Revision history</strong>
                      <span>{snapshot.personalizedConcepts.length} saved versions</span>
                    </div>
                    <div className={css.railTrack}>
                      {snapshot.personalizedConcepts.map((concept, index) => {
                        const refinement = index > 0 ? snapshot.personalizedRefinements[index - 1] : null;
                        return (
                          <button
                            key={`${concept.assetId}-${index}`}
                            type="button"
                            data-on={index === personalizedActiveIndex ? "true" : "false"}
                            aria-label={index === 0 ? "View first personalized concept" : `View revision ${index}`}
                            onClick={() => patchSnapshot({
                              personalizedActiveConceptIndex: index,
                              personalizedRefinementChoiceId: null,
                              personalizedRefinementPrompt: "",
                            })}
                          >
                            <img src={concept.imageUrl} alt="" loading="lazy" />
                            <span>{index === 0 ? "First" : refinement?.label || `Revision ${index}`}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            {personalizedUnlocked ? (
              <>
                <div className={css.summaryGrid}>
                  <section>
                    <h2>What’s included</h2>
                    <ul>
                      {selectedProject.inclusions.map((item) => <li key={item}><Check size={13} /> {item}</li>)}
                      <li><Check size={13} /> {snapshot.keepLayout ? "Existing layout retained" : "Layout flexibility included"}</li>
                      {snapshot.featuresToKeep.map((item) => (
                        <li key={item}><Check size={13} /> Preserve existing {item.toLowerCase()}</li>
                      ))}
                    </ul>
                  </section>
                  <section>
                    <h2>Recommended priorities</h2>
                    <ul>
                      <li><ArrowRight size={13} /> Finalize the highest-visibility surfaces first</li>
                      <li><ArrowRight size={13} /> Confirm field conditions before custom orders</li>
                      <li><ArrowRight size={13} /> Compare practical and upgraded material allowances</li>
                    </ul>
                  </section>
                </div>

                <div className={css.consult}>
                  <span className={css.kicker}>When you’re ready</span>
                  <h2>Get a free pro review of this plan</h2>
                  <p>A local contractor can confirm if this range fits your yard and outline next steps — usually within 1 business day.</p>
                  {snapshot.lead.consultationStatus === "requested" ? (
                    <p className={css.sentNote}><CheckCircle2 size={15} /> Review requested</p>
                  ) : (
                    <button
                      type="button"
                      className={css.primaryAction}
                      onClick={() => void requestConsultation()}
                      disabled={snapshot.lead.consultationStatus === "requesting"}
                    >
                      {snapshot.lead.consultationStatus === "requesting" ? "Requesting…" : "Get a free contractor review"}
                    </button>
                  )}
                </div>
              </>
            ) : null}

            <div className={css.stepFoot}>
              <button type="button" className={css.linkAction} onClick={() => patchSnapshot({ stage: "gallery" })}>
                Try another project direction
              </button>
            </div>
          </section>
        ) : null}
      </main>

      <EmailSheet
        open={emailOpen && !snapshot.lead.emailCaptured}
        busy={emailBusy}
        error={emailError}
        project={selectedProject}
        initialEmail={snapshot.lead.email}
        onClose={() => { setEmailOpen(false); setEmailError(null); }}
        onSubmit={(email) => void captureEmail(email, "")}
        onSkip={skipEmailForPartialRange}
      />
      <PhoneSheet
        open={phoneOpen}
        busy={phoneBusy}
        error={phoneError}
        onClose={() => { setPhoneOpen(false); setPhoneError(null); setPendingPhoneAction(null); }}
        onSubmit={(phone) => void capturePhone(phone)}
      />

      {fullscreenAsset ? (
        <div className={css.viewer} role="dialog" aria-modal="true" aria-label={fullscreenAsset.label}>
          <div className={css.viewerBar}>
            <span>{fullscreenAsset.label}</span>
            <div>
              <button type="button" onClick={() => void downloadImage(fullscreenAsset.imageUrl, fullscreenAsset.label)}>
                <Download size={16} /> Download
              </button>
              <button type="button" onClick={() => setFullscreenAsset(null)} aria-label="Close fullscreen view">
                <X size={18} />
              </button>
            </div>
          </div>
          <img src={fullscreenAsset.imageUrl} alt={fullscreenAsset.label} />
        </div>
      ) : null}
    </div>
  );
}
