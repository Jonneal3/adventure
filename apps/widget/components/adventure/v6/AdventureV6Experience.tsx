"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Circle,
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
import { configuredPricingBounds } from "../v3/pricing";
import {
  adjustedPersonalizedRange,
  budgetBandById,
  budgetBandsForService,
  buildVisualProjects,
  configuredProjectRange,
  DEFAULT_ESTIMATE_CONFIG,
  personalizedProjectRange,
  priceDetailsForService,
  projectDesignSummary,
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
  forceVisualPricingSession,
  getOrCreateVisualPricingSession,
  loadVisualPricingSnapshot,
  saveVisualPricingSnapshot,
} from "../v3/visual-storage";

/** Locked session for ?demo=1 — same walkthrough every recording. */
const DEMO_SESSION_ID = "v6-demo-locked";
import css from "./visual-pricing-v6.module.css";

type Props = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
};

/** Fast edit model for concept drafts (canvas also pins this for v3_personalized_preview). */
const PERSONALIZATION_MODEL_ID = "prunaai/p-image-edit";
const VISUAL_CATALOG_REVISION = "2026-08-08-v6-budget-finish-fit";
/** Inspiration wall: 50 looks for the selected scope alone. */
const GALLERY_LIMIT = 50;
const CONCEPT_COUNT = 8;
type PersonalizedRefinementOption = {
  id: string;
  label: string;
  instruction: string;
  priceImpact: number;
};

type PlanningRange = { totalMin: number; totalMax: number; currency: string };
type PricedCanvasHistoryEntry = CanvasHistoryEntry & { planningRange?: PlanningRange | null };
/** V6 asks for a phone number in one place only: the consultation step. */
type PendingPhoneAction = { kind: "consultation" };

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

function serviceSearchText(service: ServiceOption | null | undefined, extra = ""): string {
  return `${service?.label || ""} ${service?.serviceName || ""} ${service?.serviceSummary || ""} ${extra}`.trim();
}

function serviceLabelLower(service: ServiceOption | null | undefined, fallback = "project"): string {
  const label = service?.label?.trim();
  return label ? label.toLowerCase() : fallback;
}

function isBathroomServiceOption(service: ServiceOption | null | undefined, extra = ""): boolean {
  return /bath|shower|tub|vanity|powder room/i.test(serviceSearchText(service, extra));
}

function isKitchenServiceOption(service: ServiceOption | null | undefined, extra = ""): boolean {
  return /kitchen|cabinet|countertop|pantry/i.test(serviceSearchText(service, extra));
}

function personalizedRefinementOptions(project: VisualPricingProject): PersonalizedRefinementOption[] {
  const bathroom = isBathroomServiceOption(null, `${project.serviceLabel} ${project.scope}`);
  const kitchen = isKitchenServiceOption(null, `${project.serviceLabel} ${project.scope}`);
  const landscape = /landscap|outdoor|garden|patio|lawn|hardscape/i.test(`${project.serviceLabel} ${project.scope}`);
  const upgrade = bathroom
    ? { id: "upgrade-feature", label: "Upgrade the shower", instruction: "Upgrade the shower with more premium glass, fixtures, waterproofing details, and finish materials.", priceImpact: 0.12 }
    : kitchen
      ? { id: "upgrade-feature", label: "Upgrade the island and counters", instruction: "Upgrade the island, counters, and hardware with more premium materials and detailing.", priceImpact: 0.12 }
      : landscape
        ? { id: "upgrade-feature", label: "Upgrade the focal outdoor feature", instruction: "Upgrade the primary outdoor focal feature with more premium materials and detailing.", priceImpact: 0.12 }
        : { id: "upgrade-feature", label: "Upgrade the focal feature", instruction: "Upgrade the primary focal feature with more premium materials and detailing.", priceImpact: 0.12 };
  const keepExisting = bathroom
    ? { id: "keep-existing", label: "Keep the existing vanity", instruction: "Keep and reuse the existing vanity while coordinating the surrounding design around it.", priceImpact: -0.06 }
    : kitchen
      ? { id: "keep-existing", label: "Keep existing cabinets", instruction: "Keep and reuse the existing cabinets while coordinating new surfaces and finishes around them.", priceImpact: -0.06 }
      : landscape
        ? { id: "keep-existing", label: "Keep mature planting", instruction: "Keep mature trees and planting where they fit while coordinating the new hardscape around them.", priceImpact: -0.06 }
        : { id: "keep-existing", label: "Keep existing built-ins", instruction: "Keep and reuse the existing built-ins while coordinating the surrounding design around them.", priceImpact: -0.06 };
  return [
    { id: "modern", label: "Make it more modern", instruction: "Make the design more modern with cleaner lines and restrained detailing.", priceImpact: 0.03 },
    upgrade,
    keepExisting,
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

/** Directional teaser shown blurred on locked cards — curiosity without exact unlock. */
function partialPriceTeaser(project: VisualPricingProject): string {
  const mid = (project.priceMin + project.priceMax) / 2;
  const low = Math.max(1_000, Math.floor((mid * 0.88) / 1_000) * 1_000);
  const high = Math.max(low + 2_000, Math.ceil((mid * 1.12) / 1_000) * 1_000);
  return `${formatCurrency(low, project.currency)}–${formatCurrency(high, project.currency)}`;
}

function priceRangeText(range: { totalMin: number; totalMax: number; currency: string }): string {
  const span = Math.max(0, range.totalMax - range.totalMin);
  const increment = span < 8_000 ? 500 : span < 20_000 ? 1_000 : 2_500;
  const lower = Math.max(increment, Math.floor(range.totalMin / increment) * increment);
  const upper = Math.max(lower + increment, Math.ceil(range.totalMax / increment) * increment);
  return `${formatCurrency(lower, range.currency)}–${formatCurrency(upper, range.currency)}`;
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
  const stage = showPrimer ? "intro" : firstQuestionStage(service);
  return {
    version: 3,
    experiment: "visual_pricing_two_stage",
    sessionId,
    stage,
    selectedServiceId: service?.value || null,
    selectedScope: scopes.length === 1 ? scopes[0] : null,
    budgetBandId: null,
    projects: [],
    selectedProjectId: null,
    favoriteProjectIds: [],
    startPath: null,
    uploadChangeNote: "",
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
  "path",
  "personalize",
  "inspiration",
  "concepts",
  "customize",
  "details",
  "consultation",
];

/** Saves required before inspiration can be turned into concepts. */
const MIN_SAVED_INSPIRATION = 3;
const MAX_SAVED_INSPIRATION = 5;

const CONCEPT_STATUS_LABELS = [
  "Reading your inspiration…",
  "Working out materials and finishes…",
  "Designing your space…",
  "Almost there…",
];

type ConceptVariant = { id: string; label: string; instruction: string };

/**
 * Eight service-aware directions. Generic “warmer/elevated” clones read as the
 * same picture — these force obvious, trade-specific differences.
 */
function conceptVariantsForService(service: ServiceOption | null | undefined): ConceptVariant[] {
  const serviceName = serviceLabelLower(service, "project");
  if (isBathroomServiceOption(service)) {
    return [
      { id: "spa", label: "Spa retreat", instruction: `Design a spa-like ${serviceName}: freestanding or sculptural soaking focus, soft stone, calm neutrals, hotel lighting. Must look obviously different from a builder-basic bath.` },
      { id: "modern", label: "Clean modern", instruction: `Ultra-modern ${serviceName}: flat planes, minimal hardware, large-format tile, frameless glass, cool palette. Sharp and uncluttered.` },
      { id: "warm-wood", label: "Warm wood + stone", instruction: `Warm residential ${serviceName}: natural wood vanity, soft stone or zellige, brass or bronze accents, softer ambient light.` },
      { id: "bold-tile", label: "Bold tile statement", instruction: `Make tile the hero of this ${serviceName}: distinctive pattern or color-blocked walls, coordinated floor, fixtures that support the tile story.` },
      { id: "luxury", label: "Quiet luxury", instruction: `Quiet-luxury ${serviceName}: premium stone, integrated lighting, refined metal finishes, tailored millwork. Elevated without looking flashy.` },
      { id: "compact", label: "Small-space smart", instruction: `Optimize a compact ${serviceName}: clever storage, niche shelves, space-saving fixtures, bright finishes that make the room feel larger.` },
      { id: "classic", label: "Timeless classic", instruction: `Timeless classic ${serviceName}: subway or marble look, traditional vanity silhouette, polished nickel or chrome, symmetrical mirrors.` },
      { id: "dark-moody", label: "Dark and moody", instruction: `Dark moody ${serviceName}: deep wall tones, dramatic contrast stone, matte black fixtures, intimate lighting. Must read dark at a glance.` },
    ];
  }
  if (isKitchenServiceOption(service)) {
    return [
      { id: "chef", label: "Chef-ready island", instruction: `Chef-forward ${serviceName}: oversized island, pro-style range presence, durable counters, strong task lighting.` },
      { id: "modern", label: "Sleek modern", instruction: `Sleek modern ${serviceName}: handleless cabinets, continuous counters, hidden storage, cool minimal palette.` },
      { id: "warm-wood", label: "Warm wood kitchen", instruction: `Warm wood ${serviceName}: natural oak or walnut cabinets, soft stone counters, brass hardware, inviting light.` },
      { id: "two-tone", label: "Two-tone cabinets", instruction: `Two-tone ${serviceName}: contrasting upper/lower cabinets, statement island color, coordinated hardware.` },
      { id: "luxury", label: "Quiet luxury", instruction: `Quiet-luxury ${serviceName}: premium stone slab, integrated appliances feel, refined lighting, tailored details.` },
      { id: "open-bright", label: "Open and bright", instruction: `Bright open ${serviceName}: light cabinets, reflective counters, generous daylight feel, airy styling.` },
      { id: "classic", label: "Classic timeless", instruction: `Classic timeless ${serviceName}: shaker cabinets, marble or marble-look, traditional hardware, balanced layout.` },
      { id: "entertain", label: "Entertainer’s kitchen", instruction: `Entertainer ${serviceName}: generous island seating, bar-ready zone, layered lighting, social layout.` },
    ];
  }
  if (/landscap|outdoor|garden|patio|lawn|hardscape/i.test(serviceSearchText(service))) {
    return [
      { id: "courtyard", label: "Courtyard lounge", instruction: `Courtyard lounge outdoor space: seating focus, layered planting, evening light, intimate enclosure.` },
      { id: "modern", label: "Modern hardscape", instruction: `Modern hardscape: clean stone planes, geometric planting, minimal furniture, strong lines.` },
      { id: "lush", label: "Lush garden", instruction: `Lush garden: dense layered planting, soft paths, natural textures, abundant green.` },
      { id: "fire", label: "Fire + dining", instruction: `Outdoor fire and dining: fire feature, dining table zone, warm night lighting, durable paving.` },
      { id: "poolside", label: "Poolside resort", instruction: `Poolside resort feel: lounging, water adjacency, resort planting, clean decking.` },
      { id: "family", label: "Family lawn", instruction: `Family lawn: open play lawn, durable edges, simple planting, practical circulation.` },
      { id: "zen", label: "Quiet zen", instruction: `Quiet zen outdoor: gravel, stone, restrained planting, calm water or sculpture cue.` },
      { id: "evening", label: "Evening glow", instruction: `Evening-glow landscape: lighting as the hero, warm path lights, lit trees, night atmosphere.` },
    ];
  }
  return [
    { id: "faithful", label: "Closest to your taste", instruction: `Faithful blend of the references into a new ${serviceName}. Invent a fresh room — do not copy any single reference.` },
    { id: "modern", label: "More modern", instruction: `Clearly more modern ${serviceName}: cleaner lines, simpler detailing, contemporary materials.` },
    { id: "warm", label: "Warmer and softer", instruction: `Clearly warmer ${serviceName}: natural wood, soft neutrals, tactile textures, softer light.` },
    { id: "elevated", label: "A step more elevated", instruction: `Clearly more elevated ${serviceName}: richer materials, better lighting, refined detailing.` },
    { id: "bold", label: "Bolder statement", instruction: `Bolder ${serviceName}: a strong focal material or color move that is obvious at a glance.` },
    { id: "bright", label: "Brighter and airier", instruction: `Brighter airier ${serviceName}: lighter palette, more reflective surfaces, open feeling.` },
    { id: "moody", label: "Darker and moodier", instruction: `Darker moodier ${serviceName}: deeper tones, contrast, intimate lighting.` },
    { id: "practical", label: "Most practical build", instruction: `Practical buildable ${serviceName}: durable finishes, simple details, realistic construction.` },
  ].slice(0, CONCEPT_COUNT);
}

function signedDeltaText(value: number, currency: string): string {
  const magnitude = Math.abs(value);
  const increment = magnitude >= 20_000 ? 5_000 : magnitude >= 4_000 ? 1_000 : 500;
  const rounded = Math.max(increment, Math.round(magnitude / increment) * increment);
  return `${value >= 0 ? "+" : "−"}${formatCurrency(rounded, currency)}`;
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
  previewImageUrl: string | null;
  previewLabel: string;
  initialEmail?: string | null;
  onClose: () => void;
  onSubmit: (email: string) => void;
}) {
  const [email, setEmail] = useState(props.initialEmail || "");
  useEffect(() => {
    if (props.open && props.initialEmail) setEmail(props.initialEmail);
  }, [props.initialEmail, props.open]);
  if (!props.open) return null;
  const ready = /.+@.+\..+/.test(email.trim());
  return (
    <Sheet open={props.open} labelledBy="v6-email-title" onClose={props.onClose}>
      {props.previewImageUrl ? (
        <figure className={css.sheetPreview}>
          <img src={props.previewImageUrl} alt="" />
          <span className={css.sheetPreviewBadge} aria-hidden="true"><Mail size={16} /></span>
          <figcaption>{props.previewLabel}</figcaption>
        </figure>
      ) : null}
      <h2 id="v6-email-title" className={css.sheetTitle}>Save your design and estimate</h2>
      <p className={css.sheetBody}>
        Your price range appears on this screen straight away. We’ll email you this design so you don’t lose it.
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
          Show my estimate
        </button>
      </form>
      <small className={css.sheetNote}>
        No waiting and no sales call to see the number. Unsubscribe anytime.
      </small>
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
    <Sheet open={props.open} labelledBy="v6-phone-title" onClose={props.onClose}>
      <span className={css.sheetIcon} aria-hidden="true"><Phone size={20} /></span>
      <h2 id="v6-phone-title" className={css.sheetTitle}>Ready to bring this design to life?</h2>
      <p className={css.sheetBody}>
        Leave your number and a local pro will follow up about this design — usually within one business day.
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
          {props.busy ? <LoaderCircle className={css.spin} size={17} /> : <Phone size={16} />}
          Request consultation
        </button>
      </form>
      <small className={css.sheetNote}>
        We’ll only use this number to schedule your consultation.
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
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={css.choice}
      data-quiet={props.quiet ? "true" : "false"}
      onClick={props.onClick}
    >
      <span className={css.choiceCopy}>
        <strong>{props.label}</strong>
        {props.hint ? <small>{props.hint}</small> : null}
      </span>
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

/**
 * The only waiting state in V6. Boot, catalog, and generation all render this,
 * so a visitor never sees two different kinds of "hold on" in one session.
 */
function LoadingState(props: { label: string; hint?: string }) {
  return (
    <div className={css.loading} role="status" aria-live="polite">
      <span className={css.loadingTrack} aria-hidden="true" />
      <strong>{props.label}</strong>
      {props.hint ? <small>{props.hint}</small> : null}
    </div>
  );
}

/**
 * Service and scope are recognized faster from a picture than read from a list.
 * The thumbnail is decoration, so the card still works before it loads.
 */
function VisualChoiceCard(props: {
  label: string;
  imageUrl?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className={css.visualChoice} onClick={props.onClick}>
      <span className={css.visualChoiceFrame}>
        {props.imageUrl ? <img src={props.imageUrl} alt="" loading="lazy" /> : null}
      </span>
      <span className={css.visualChoiceLabel}>{props.label}</span>
    </button>
  );
}

/**
 * Inspiration cards are pure taste signal — no pricing chrome, because the
 * estimate is not revealed until the visitor has a design of their own.
 */
function InspirationCard(props: {
  project: VisualPricingProject;
  shape: LookShape;
  saved: boolean;
  atLimit: boolean;
  onToggle: () => void;
}) {
  const disabled = props.atLimit && !props.saved;
  return (
    <article className={css.look} data-shape={props.shape} data-saved={props.saved ? "true" : "false"}>
      <button
        type="button"
        className={css.lookSelect}
        onClick={props.onToggle}
        disabled={disabled}
        aria-pressed={props.saved}
        aria-label={props.saved
          ? `Deselect ${props.project.title}`
          : `Select ${props.project.title}`}
      >
        <span className={css.lookFrame} data-shape={props.shape}>
          <img src={props.project.imageUrl} alt={props.project.title} loading="lazy" />
          <span className={css.saveMark} data-on={props.saved ? "true" : "false"} aria-hidden="true">
            {props.saved ? <Check size={14} strokeWidth={2.5} /> : <Circle size={14} strokeWidth={2} />}
          </span>
          <span className={css.lookMeta}>
            <strong className={css.lookTitle}>{props.project.title}</strong>
          </span>
        </span>
      </button>
    </article>
  );
}

export function AdventureV6Experience({ instanceId, initialInstanceData, initialDesignConfig }: Props) {
  const routeVersion = "v6" as const;
  const [instance, setInstance] = useState<any>(initialInstanceData || null);
  const [design, setDesign] = useState<DesignSettings>(() =>
    withWidgetDesignDefaults(initialDesignConfig || initialInstanceData?.config || {}, initialInstanceData?.name)
  );
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [snapshot, setSnapshot] = useState<VisualPricingSnapshot | null>(null);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogNonce, setCatalogNonce] = useState(0);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [conceptsBusy, setConceptsBusy] = useState(false);
  const [stepImages, setStepImages] = useState<{
    services: Record<string, string>;
    scopes: Record<string, string>;
  }>({ services: {}, scopes: {} });
  const [conceptStatusIndex, setConceptStatusIndex] = useState(0);
  const [personalizedRefinementBusy, setPersonalizedRefinementBusy] = useState(false);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [showAllServices, setShowAllServices] = useState(false);
  const [otherScopeOpen, setOtherScopeOpen] = useState(false);
  const [otherScopeText, setOtherScopeText] = useState("");
  const [pendingPhoneAction, setPendingPhoneAction] = useState<PendingPhoneAction | null>(null);
  const [fullscreenAsset, setFullscreenAsset] = useState<{ imageUrl: string; label: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<HTMLElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const catalogCacheRef = useRef(new Map<string, VisualPricingProject[]>());
  const catalogInflightRef = useRef(new Map<string, Promise<VisualPricingProject[]>>());
  const selectedService = useMemo(
    () => services.find((service) => service.value === snapshot?.selectedServiceId) || null,
    [services, snapshot?.selectedServiceId]
  );
  const selectedBudget = budgetBandById(snapshot?.budgetBandId || null, selectedService);
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
      let demoMode = false;
      let hintedServiceId = "";
      try {
        const params = new URLSearchParams(window.location.search);
        hintedServiceId = params.get("serviceId") || params.get("service_id") || "";
        demoMode = params.get("demo") === "1" || params.get("demo") === "true";
        const freshRequested = params.get("fresh") === "1" || params.get("fresh") === "true";
        const freshNonce = params.get("freshNonce") || "";
        if (freshRequested && freshNonce) {
          const markerKey = `adventure:${routeVersion}:visual-fresh-consumed:${instanceId}`;
          shouldStartFresh = window.sessionStorage.getItem(markerKey) !== freshNonce;
          if (shouldStartFresh) window.sessionStorage.setItem(markerKey, freshNonce);
        }
      } catch {}
      // Demo mode: wipe prior progress and pin the session so every take matches.
      if (demoMode) {
        shouldStartFresh = true;
        clearVisualPricingSnapshot(instanceId, routeVersion);
      }
      if (shouldStartFresh) clearVisualPricingSnapshot(instanceId, routeVersion);
      const sessionId = demoMode
        ? forceVisualPricingSession(instanceId, DEMO_SESSION_ID, routeVersion)
        : getOrCreateVisualPricingSession(instanceId, routeVersion);
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
          // Snapshots saved by earlier funnel versions can name stages V6 no
          // longer renders, so anything unrecognized restarts at the fork.
          stage: saved.stage === "intro"
            ? firstQuestionStage(savedService)
            : STAGE_SEQUENCE.includes(saved.stage)
              ? saved.stage
              : "path",
          budgetBandId: saved.budgetBandId || null,
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

  // Service and scope are picked from pictures, so their thumbnails are fetched
  // as soon as the options are known rather than when the step is reached.
  useEffect(() => {
    if (services.length === 0) return;
    const serviceIds = services.map((service) => service.value).filter(Boolean);
    if (serviceIds.length === 0) return;
    let cancelled = false;
    const url = `/api/v6/ai-form/${encodeURIComponent(instanceId)}/step-images`
      + `?serviceIds=${encodeURIComponent(serviceIds.join(","))}`;
    void fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.services) return;
        setStepImages((previous) => ({ ...previous, services: { ...previous.services, ...data.services } }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [instanceId, services]);

  useEffect(() => {
    if (!selectedService || selectedScopes.length === 0) return;
    let cancelled = false;
    const url = `/api/v6/ai-form/${encodeURIComponent(instanceId)}/step-images`
      + `?serviceId=${encodeURIComponent(selectedService.value)}`
      + selectedScopes.map((scope) => `&scope=${encodeURIComponent(scope)}`).join("");
    void fetch(url)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled || !data?.scopes) return;
        setStepImages((previous) => ({ ...previous, scopes: { ...previous.scopes, ...data.scopes } }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [instanceId, selectedScopes, selectedService]);

  const resolveCatalogScope = useCallback((scope: string | null | undefined) => {
    const requested = String(scope || "").trim();
    if (requested && selectedScopes.includes(requested)) return requested;
    return selectedScopes[0] || requested || "Typical project";
  }, [selectedScopes]);

  const loadCatalogForScope = useCallback(async (
    service: ServiceOption,
    scope: string,
    budget: BudgetBand
  ) => {
    const catalogScope = resolveCatalogScope(scope);
    const cacheKey = `${service.value}::${catalogScope}::${budget.id}::${VISUAL_CATALOG_REVISION}`;
    const cached = catalogCacheRef.current.get(cacheKey);
    if (cached?.length) return cached;
    const inflight = catalogInflightRef.current.get(cacheKey);
    if (inflight) return inflight;

    const request = (async () => {
      const params = new URLSearchParams({
        serviceId: service.value,
        limit: String(GALLERY_LIMIT),
        budgetBandId: budget.id,
        catalogRevision: VISUAL_CATALOG_REVISION,
        strictScope: "1",
      });
      // Strict: only the selected scope. Mixing scopes is what put vanities
      // on a "shower or tub" wall.
      params.append("scope", catalogScope);
      const catalogUrl = `/api/v3/ai-form/${encodeURIComponent(instanceId)}/visual-projects?${params.toString()}`;
      let lastError: Error | null = null;
      for (let attempt = 0; attempt < 2; attempt += 1) {
        try {
          const response = await fetch(catalogUrl);
          const data = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(data?.error || "Unable to load projects.");
          const rawProjects = Array.isArray(data?.projects) ? data.projects as RawVisualProject[] : [];
          const projects = buildVisualProjects({
            rawProjects,
            service,
            budgetBand: budget,
            bounds,
            budgetMode: "lens",
          }).slice(0, GALLERY_LIMIT);
          if (projects.length === 0) throw new Error("No visual projects are available for this service yet.");
          catalogCacheRef.current.set(cacheKey, projects);
          // Warm the first screen of images while the user is still choosing.
          for (const project of projects.slice(0, 18)) {
            const image = new Image();
            image.decoding = "async";
            image.src = project.imageUrl;
          }
          return projects;
        } catch (catalogError) {
          lastError = catalogError instanceof Error ? catalogError : new Error("Unable to load projects.");
          if (attempt < 1) await new Promise((resolve) => window.setTimeout(resolve, 180));
        }
      }
      throw lastError || new Error("Unable to load projects.");
    })();

    catalogInflightRef.current.set(cacheKey, request);
    try {
      return await request;
    } finally {
      catalogInflightRef.current.delete(cacheKey);
    }
  }, [bounds, instanceId, resolveCatalogScope]);

  // Prefetch catalogs as soon as the service is known — ideally before gallery.
  useEffect(() => {
    if (!selectedService || !bounds || !snapshot?.stage) return;
    if (snapshot.stage === "loading" || snapshot.stage === "intro") return;
    const budget = selectedBudget || budgetBandById("not-sure", selectedService);
    if (!budget) return;
    const scopesToWarm = (
      selectedScopes.length > 0
        ? selectedScopes
        : [snapshot.selectedScope || "Typical project"]
    ).filter(Boolean).slice(0, 6) as string[];
    for (const scope of scopesToWarm) {
      void loadCatalogForScope(selectedService, scope, budget).catch(() => {});
    }
  }, [bounds, loadCatalogForScope, selectedBudget, selectedScopes, selectedService, snapshot?.selectedScope, snapshot?.stage]);

  // The upload path never shows the gallery but still needs a catalog project to
  // anchor pricing, so both branches load the same catalog.
  const catalogStage = snapshot?.stage === "inspiration"
    || snapshot?.stage === "path"
    || snapshot?.stage === "personalize";

  useEffect(() => {
    if (!catalogStage || !selectedService || !snapshot) return;
    const showsGallery = snapshot.stage === "inspiration";
    const budget = selectedBudget || budgetBandById("not-sure", selectedService);
    if (!budget) return;
    const scope = snapshot.selectedScope || selectedScopes[0] || "Typical project";
    const cacheKey = `${selectedService.value}::${resolveCatalogScope(scope)}::${budget.id}::${VISUAL_CATALOG_REVISION}`;
    const cached = catalogCacheRef.current.get(cacheKey);
    let cancelled = false;
    setError(null);

    if (cached?.length) {
      if (snapshot.projects.length === 0) patchSnapshot({ projects: cached });
      setCatalogBusy(false);
      return;
    }

    setCatalogBusy(showsGallery && snapshot.projects.length === 0);
    void loadCatalogForScope(selectedService, scope, budget)
      .then((projects) => {
        if (!cancelled) patchSnapshot({ projects });
      })
      .catch((catalogError) => {
        if (!cancelled && showsGallery) {
          setError(catalogError instanceof Error ? catalogError.message : "Unable to load projects.");
        }
      })
      .finally(() => { if (!cancelled) setCatalogBusy(false); });
    return () => { cancelled = true; };
  }, [
    bounds,
    catalogNonce,
    catalogStage,
    loadCatalogForScope,
    patchSnapshot,
    resolveCatalogScope,
    selectedBudget,
    selectedScopes,
    selectedService,
    snapshot?.projects.length,
    snapshot?.selectedScope,
    snapshot?.stage,
  ]);

  const chooseService = useCallback((service: ServiceOption) => {
    if (!snapshot) return;
    setSnapshot(defaultSnapshot(snapshot.sessionId, service, false));
    track("adventure_v3_project_selected", { serviceId: service.value, serviceName: service.label });
  }, [snapshot, track]);

  const chooseScope = useCallback((scope: string) => {
    setOtherScopeOpen(false);
    setOtherScopeText("");
    patchSnapshot({
      selectedScope: scope,
      projects: [],
      selectedProjectId: null,
      stage: "budget",
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
    track("adventure_v3_scope_selected", { serviceId: selectedService?.value, scope });
  }, [patchSnapshot, selectedScopes, selectedService, track]);

  const chooseBudget = useCallback((bandId: BudgetBandId) => {
    patchSnapshot({ budgetBandId: bandId, projects: [], stage: "path" });
    track("adventure_v6_budget_selected", { serviceId: selectedService?.value, budgetBandId: bandId });
  }, [patchSnapshot, selectedService, track]);

  const choosePath = useCallback((path: "upload" | "inspiration") => {
    patchSnapshot({
      startPath: path,
      favoriteProjectIds: [],
      selectedProjectId: null,
      sourceAsset: null,
      uploadChangeNote: "",
      personalizedConcepts: [],
      personalizedActiveConceptIndex: 0,
      stage: path === "upload" ? "personalize" : "inspiration",
    });
    track("adventure_v6_start_path_selected", { path });
  }, [patchSnapshot, track]);

  const toggleFavorite = useCallback((projectId: string) => {
    if (!snapshot) return;
    const saved = snapshot.favoriteProjectIds.includes(projectId);
    if (!saved && snapshot.favoriteProjectIds.length >= MAX_SAVED_INSPIRATION) return;
    patchSnapshot({
      favoriteProjectIds: saved
        ? snapshot.favoriteProjectIds.filter((id) => id !== projectId)
        : [...snapshot.favoriteProjectIds, projectId],
    });
    track(saved ? "adventure_v3_favorite_removed" : "adventure_v3_favorite_added", { projectId });
  }, [patchSnapshot, snapshot, track]);

  const sendPricingEmail = useCallback(async (
    submissionId: string,
    project: VisualPricingProject,
    // The visitor built a design; the email should show that, not the catalog
    // project that only exists to anchor the price.
    canvasUrl: string
  ) => {
    try {
      const response = await fetch("/api/v2/leads/results-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          submissionId,
          instanceId,
          serviceName: selectedService?.label || project.serviceLabel,
          scope: project.scope,
          canvasUrl,
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
    const activeConcept = snapshot.personalizedConcepts[
      Math.max(0, Math.min(snapshot.personalizedActiveConceptIndex, snapshot.personalizedConcepts.length - 1))
    ];
    const designImageUrl = activeConcept?.imageUrl || selectedProject.imageUrl;
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
        const sent = await sendPricingEmail(submissionId, selectedProject, designImageUrl);
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

  /**
   * Concept generation has to work from either an uploaded room or a set of
   * saved catalog images, so the base and reference images are passed in rather
   * than read off `sourceAsset` the way the upload-only preview does.
   */
  const requestConceptCanvas = useCallback(async (
    variant: ConceptVariant,
    input: {
      baseImageUrl: string;
      referenceImageUrls: string[];
      anchor: VisualPricingProject;
      /** Inspiration path: invent a new room. Upload path: revise the photo. */
      blendMode: "inspire" | "revise";
    }
  ): Promise<CanvasHistoryEntry> => {
    if (!snapshot || !selectedService) throw new Error("Pick a project first.");
    const estimateConfig = snapshot.estimateConfig || DEFAULT_ESTIMATE_CONFIG;
    const configuredRange = configuredProjectRange(input.anchor, estimateConfig, {});
    const budgetMidpoint = Math.round((configuredRange.totalMin + configuredRange.totalMax) / 2);
    const changeNote = (snapshot.uploadChangeNote || "").trim();
    const allRefs = Array.from(new Set(
      [input.baseImageUrl, ...input.referenceImageUrls].filter(Boolean)
    ));
    const prompt = input.blendMode === "inspire"
      ? [
          `Create a brand-new ${selectedService.label.toLowerCase()} concept. Invent a fresh room — do not reproduce or lightly retouch any single reference image.`,
          `Blend the material language, colour palette, and lighting cues from ALL ${allRefs.length} supplied reference designs into one buildable space.`,
          `Scope: ${input.anchor.scope}.`,
          `Budget about ${formatCurrency(budgetMidpoint, input.anchor.currency)} — realistic, buildable finishes.`,
          `DIRECTION (must be visually obvious vs the other concepts): ${variant.instruction}`,
          "Photorealistic residential photography. No people, text, logos, or watermarks.",
        ].filter(Boolean).join(" ")
      : [
          `Revise this uploaded ${selectedService.label.toLowerCase()} space into a new design direction.`,
          "Keep the camera position and room envelope recognizable, but the finishes and styling must change enough that the direction is obvious.",
          `Scope: ${input.anchor.scope}.`,
          changeNote ? `The homeowner specifically wants: ${changeNote}.` : "",
          `Budget about ${formatCurrency(budgetMidpoint, input.anchor.currency)}.`,
          `DIRECTION (must be visually obvious vs the other concepts): ${variant.instruction}`,
          "Photorealistic. No people, text, logos, or watermarks.",
        ].filter(Boolean).join(" ");

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
        scope: input.anchor.scope,
        budget: budgetMidpoint,
        experienceMode: "scene",
        ...(input.blendMode === "revise" && snapshot.sourceAsset
          ? { sourceAssets: { scene: snapshot.sourceAsset } }
          : {}),
        currentCanvasUrl: input.baseImageUrl,
        referenceProjectImageUrl: input.referenceImageUrls[0] || input.anchor.imageUrl,
        referenceImageUrls: allRefs,
        prompt,
        modelId: PERSONALIZATION_MODEL_ID,
        generationIntent: "v3_personalized_preview",
        conceptBlendMode: input.blendMode,
        priorChanges: [],
        designInstruction: {
          mode: "finished_version",
          directionLabel: variant.label,
          versionId: variant.id,
        },
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data?.canvas?.imageUrl) throw new Error(data?.error || "Unable to create concepts.");
    const canvas = data.canvas as StarterCanvas;
    return {
      ...canvas,
      changeLabel: variant.label,
      designInstruction: {
        mode: "finished_version",
        directionLabel: variant.label,
        versionId: variant.id,
        preserve: snapshot.featuresToKeep,
        layoutConstraints: input.blendMode === "revise" && snapshot.keepLayout ? ["Keep existing layout"] : [],
        readableSummary: `${variant.label} · ${input.anchor.scope}`,
      },
    };
  }, [instanceId, selectedService, snapshot]);

  const generateConcepts = useCallback(async () => {
    if (!snapshot || conceptsBusy) return;
    const fromUpload = snapshot.startPath === "upload";
    const savedProjects = snapshot.projects.filter((project) =>
      snapshot.favoriteProjectIds.includes(project.assetId));

    // Pricing needs a catalog range behind it; on the upload path nothing was
    // picked by hand, so the best budget fit stands in.
    const anchor = savedProjects[0]
      || snapshot.projects.find((project) => project.assetId === snapshot.selectedProjectId)
      || snapshot.projects[0]
      || null;
    if (!anchor) {
      setError("We couldn’t load pricing for this project yet. Try again in a moment.");
      return;
    }
    if (!fromUpload && savedProjects.length === 0) {
      setError("Pick a few designs first.");
      return;
    }
    if (fromUpload && !snapshot.sourceAsset?.url) {
      setError("Upload a photo of your space first.");
      return;
    }

    setConceptsBusy(true);
    setError(null);
    const baseRange = personalizedProjectRange(anchor, fromUpload && snapshot.keepLayout);
    // Clear prior concepts and show the wait state immediately; first image
    // appears as soon as any variant returns (usually a few seconds).
    patchSnapshot({
      selectedProjectId: anchor.assetId,
      stage: "concepts",
      personalizedConcepts: [],
      personalizedActiveConceptIndex: 0,
      personalizedBaseRange: baseRange,
      personalizedRange: baseRange,
      personalizedRefinements: [],
      personalizedRefinementChoiceId: null,
      personalizedRefinementPrompt: "",
    });
    track("adventure_v6_concepts_requested", {
      path: snapshot.startPath,
      savedCount: savedProjects.length,
      anchorId: anchor.assetId,
    });

    try {
      const variants = conceptVariantsForService(selectedService).slice(0, CONCEPT_COUNT);
      const slots: Array<CanvasHistoryEntry | null> = variants.map(() => null);
      const publishReady = () => {
        const ready = slots.filter((entry): entry is CanvasHistoryEntry => Boolean(entry));
        if (ready.length === 0) return;
        patchSnapshot({
          personalizedConcepts: ready,
          personalizedActiveConceptIndex: 0,
          personalizedBaseRange: baseRange,
          personalizedRange: baseRange,
        });
      };

      const results = await Promise.allSettled(
        variants.map(async (variant, index) => {
          // Rotate which saved look is the primary anchor so each concept
          // starts from a different picture — otherwise the preserve-edit
          // path redraws the same bathroom three times.
          const rotated = savedProjects.length > 0
            ? [
                ...savedProjects.slice(index % savedProjects.length),
                ...savedProjects.slice(0, index % savedProjects.length),
              ]
            : [];
          const baseImageUrl = fromUpload
            ? snapshot.sourceAsset!.url
            : (rotated[0]?.imageUrl || anchor.imageUrl);
          const referenceImageUrls = fromUpload
            ? [anchor.imageUrl, ...savedProjects.map((project) => project.imageUrl)].filter(Boolean)
            : rotated.slice(1).map((project) => project.imageUrl);

          const canvas = await requestConceptCanvas(variant, {
            baseImageUrl,
            referenceImageUrls,
            anchor: rotated[0] || anchor,
            blendMode: fromUpload ? "revise" : "inspire",
          });
          slots[index] = canvas;
          publishReady();
          return canvas;
        })
      );
      const concepts = results
        .filter((result): result is PromiseFulfilledResult<CanvasHistoryEntry> => result.status === "fulfilled")
        .map((result) => result.value);
      if (concepts.length === 0) {
        const failure = results.find((result) => result.status === "rejected") as PromiseRejectedResult | undefined;
        throw failure?.reason instanceof Error ? failure.reason : new Error("Unable to create concepts.");
      }
      // Final ordered publish (settled order may have shuffled progressive inserts).
      const ordered = slots.filter((entry): entry is CanvasHistoryEntry => Boolean(entry));
      patchSnapshot({
        personalizedConcepts: ordered,
        personalizedActiveConceptIndex: 0,
        personalizedBaseRange: baseRange,
        personalizedRange: baseRange,
        personalizedRefinements: [],
        personalizedRefinementChoiceId: null,
        personalizedRefinementPrompt: "",
      });
      track("adventure_v6_concepts_ready", { count: ordered.length });
    } catch (conceptError) {
      setError(conceptError instanceof Error ? conceptError.message : "Unable to create concepts.");
    } finally {
      setConceptsBusy(false);
    }
  }, [conceptsBusy, patchSnapshot, requestConceptCanvas, selectedService, snapshot, track]);

  const applyPersonalizedRefinement = useCallback(async () => {
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

    // Refining is deliberately ungated: V6 asks for a phone number only at the
    // consultation step, so visitors can iterate as long as they like.
    const refinementCount = snapshot.personalizedRefinements.length;
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
          stage: "customize",
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

  const capturePhone = useCallback(async (phone: string) => {
    if (!snapshot?.lead.submissionId) return;
    setPhoneBusy(true);
    setPhoneError(null);
    const consultationIntent = pendingPhoneAction?.kind === "consultation";
    try {
      const response = await fetch("/api/v3/leads", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instanceId,
          submissionId: snapshot.lead.submissionId,
          phone,
          intent: consultationIntent ? "consultation" : "personalized_plan",
          refinementCount: snapshot.personalizedRefinements.length,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data?.error || (consultationIntent
          ? "Unable to request a consultation."
          : "Unable to unlock your personalized plan."));
      }
      setSnapshot((previous) => previous ? {
        ...previous,
        stage: previous.stage,
        lead: {
          ...previous.lead,
          phone,
          phoneStatus: "unlocked",
          ...(consultationIntent ? { consultationStatus: "requested" as const } : {}),
        },
        updatedAt: Date.now(),
      } : previous);
      setPhoneOpen(false);
      setPendingPhoneAction(null);
      track("adventure_v3_phone_captured", {
        intent: "consultation",
        refinementCount: snapshot.personalizedRefinements.length,
      }, snapshot.lead.submissionId);
      if (consultationIntent) {
        track("adventure_v3_consultation_requested", {}, snapshot.lead.submissionId);
      }
    } catch (captureError) {
      setPhoneError(captureError instanceof Error ? captureError.message : "Unable to book your consultation.");
    } finally {
      setPhoneBusy(false);
    }
  }, [instanceId, pendingPhoneAction, snapshot, track]);

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

  const bookConsultation = useCallback(() => {
    if (!snapshot?.lead.emailCaptured) {
      setEmailOpen(true);
      return;
    }
    if (snapshot.lead.consultationStatus === "requested") return;
    if (snapshot.lead.phone && snapshot.lead.phoneStatus === "unlocked") {
      void requestConsultation();
      return;
    }
    setPendingPhoneAction({ kind: "consultation" });
    setPhoneError(null);
    setPhoneOpen(true);
    track("adventure_v6_consultation_cta_viewed", {}, snapshot.lead.submissionId);
  }, [requestConsultation, snapshot, track]);

  // Generation runs long enough that a static spinner reads as a hang.
  useEffect(() => {
    if (!conceptsBusy) {
      setConceptStatusIndex(0);
      return;
    }
    const timer = window.setInterval(() => {
      setConceptStatusIndex((index) => Math.min(index + 1, CONCEPT_STATUS_LABELS.length - 1));
    }, 6_000);
    return () => window.clearInterval(timer);
  }, [conceptsBusy]);

  const goBack = useCallback(() => {
    if (!snapshot) return;
    const entry = firstQuestionStage(selectedService);
    const beforeBudget = selectedScopes.length > 1
      ? "scope"
      : services.length > 1 ? "project" : entry;
    const fallback: Partial<Record<VisualPricingStage, VisualPricingStage>> = {
      scope: services.length > 1 ? "project" : entry,
      budget: beforeBudget,
      path: "budget",
      personalize: "path",
      inspiration: "path",
      concepts: snapshot.startPath === "upload" ? "personalize" : "inspiration",
      customize: "concepts",
      details: "customize",
      consultation: "details",
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
      <div ref={rootRef} className={css.root} data-adventure-version="v6" data-v3-funnel="visual-pricing">
        <LoadingState label="Getting things ready" />
      </div>
    );
  }

  const rootStyle = {
    // Two anchors (background + ink) plus the brand accent; every other tone in
    // the stylesheet is mixed from these so any tenant palette stays coherent.
    "--v6-bg": design.background_color || "#f6f6f7",
    "--v6-ink": design.prompt_text_color || design.brand_name_color || "#101216",
    "--v6-accent": design.primary_color || design.submit_button_background_color || "#101216",
    "--v6-on-accent": design.submit_button_text_color || "#ffffff",
    "--v6-lift": "#ffffff",
    "--v6-radius": `${Math.min(28, Math.max(10, Number(design.border_radius ?? 16)))}px`,
    backgroundImage: design.background_gradient || undefined,
    fontFamily: design.font_family || '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", "Helvetica Neue", Arial, sans-serif',
    fontSize: design.base_font_size ? `${design.base_font_size}px` : undefined,
  } as React.CSSProperties;

  const progressSteps = ["Project", "Inspiration", "Design", "Estimate"];
  const progressIndex = snapshot.stage === "intro"
    || snapshot.stage === "project"
    || snapshot.stage === "scope"
    || snapshot.stage === "budget"
    ? 0
    : snapshot.stage === "path" || snapshot.stage === "personalize" || snapshot.stage === "inspiration"
      ? 1
      : snapshot.stage === "concepts" || snapshot.stage === "customize"
        ? 2
        : 3;
  const entryStage = firstQuestionStage(selectedService);
  const canGoBack = snapshot.stage !== "intro" && snapshot.stage !== entryStage;
  const serviceName = serviceLabelLower(selectedService);
  const pricingVisible = Boolean(snapshot.lead.emailCaptured);
  const savedCount = snapshot.favoriteProjectIds.length;
  const canGenerateConcepts = savedCount >= MIN_SAVED_INSPIRATION;
  const conceptStatusLabel = CONCEPT_STATUS_LABELS[conceptStatusIndex] || CONCEPT_STATUS_LABELS[0];
  const brandConfigured = Boolean(
    (design.logo_enabled && design.logo_url)
    || ((design.brand_name_enabled !== false) && design.brand_name)
  );
  const brandFallback = !brandConfigured
    ? String(design.brand_name || instance?.name || "").trim()
    : "";
  const visibleServices = showAllServices || services.length <= 4
    ? services
    : services.slice(0, 4);
  const hiddenServiceCount = Math.max(0, services.length - visibleServices.length);
  const estimateConfig = snapshot.estimateConfig || DEFAULT_ESTIMATE_CONFIG;
  const projectActiveIndex = Math.max(0, Math.min(
    snapshot.projectActiveRefinementIndex,
    snapshot.projectRefinementHistory.length
  ));
  const activeProjectEntry = projectActiveIndex > 0 ? snapshot.projectRefinementHistory[projectActiveIndex - 1] : undefined;
  const activeProjectImageUrl = activeProjectEntry?.imageUrl || selectedProject?.imageUrl || "";
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
  const personalizedOptions = selectedProject ? personalizedRefinementOptions(selectedProject) : [];
  const selectedPersonalizedOption = personalizedOptions.find((option) => option.id === snapshot.personalizedRefinementChoiceId);
  const hasPendingPersonalizedRefinement = Boolean(selectedPersonalizedOption || snapshot.personalizedRefinementPrompt.trim());

  return (
    <div
      ref={rootRef}
      className={css.root}
      style={rootStyle}
      data-adventure-version="v6"
      data-v3-funnel="visual-pricing"
    >
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
          <div className={css.progressTrack}>
            {progressSteps.map((label, index) => (
              <span
                key={label}
                data-state={index < progressIndex ? "done" : index === progressIndex ? "current" : "todo"}
              />
            ))}
          </div>
          <span className={css.progressLabel}>{progressSteps[progressIndex]}</span>
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
              title="What are you planning?"
              body="Choose the closest option to see relevant examples and pricing."
            />
            <div className={css.visualChoices}>
              {visibleServices.map((service) => (
                <VisualChoiceCard
                  key={service.value}
                  label={service.label}
                  imageUrl={stepImages.services[service.value]}
                  onClick={() => chooseService(service)}
                />
              ))}
            </div>
            {hiddenServiceCount > 0 ? (
              <div className={css.stepFoot}>
                <button
                  type="button"
                  className={css.linkAction}
                  onClick={() => setShowAllServices(true)}
                >
                  Show {hiddenServiceCount} more options
                </button>
              </div>
            ) : null}
          </section>
        ) : null}

        {snapshot.stage === "scope" ? (
          <section className={css.step} key="scope">
            <StepHead
              title="What do you need?"
              body={selectedService
                ? `Choose the closest option for ${serviceName}.`
                : "Choose the closest option."}
            />
            <div className={css.visualChoices}>
              {selectedScopes.map((scope) => (
                <VisualChoiceCard
                  key={scope}
                  label={scope}
                  imageUrl={stepImages.scopes[scope]}
                  onClick={() => chooseScope(scope)}
                />
              ))}
            </div>
            <div className={css.choices}>
              {otherScopeOpen ? (
                <form
                  className={css.choiceOther}
                  onSubmit={(event) => {
                    event.preventDefault();
                    const value = otherScopeText.trim();
                    if (!value) return;
                    chooseScope(value);
                  }}
                >
                  <input
                    className={css.choiceOtherInput}
                    value={otherScopeText}
                    onChange={(event) => setOtherScopeText(event.target.value)}
                    placeholder="Describe what you need"
                    aria-label="Describe what you need"
                    autoFocus
                    maxLength={120}
                  />
                  <button
                    type="submit"
                    className={css.choiceOtherSubmit}
                    disabled={!otherScopeText.trim()}
                  >
                    Continue
                  </button>
                </form>
              ) : (
                <ChoiceRow
                  label="Other"
                  quiet
                  onClick={() => setOtherScopeOpen(true)}
                />
              )}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "budget" ? (
          <section className={css.step} key="budget">
            <StepHead
              title="What’s your budget?"
              body={selectedService
                ? `Typical ranges for ${serviceLabelLower(selectedService, "this kind of work")}.`
                : "Choose a range that fits the work."}
            />
            <div className={css.choices}>
              {budgetBandsForService(selectedService).map((band) => (
                <ChoiceRow
                  key={band.id}
                  label={band.label}
                  quiet={band.id === "not-sure"}
                  onClick={() => chooseBudget(band.id)}
                />
              ))}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "path" ? (
          <section className={css.step} key="path">
            <StepHead
              title="Where should we start?"
              body="A photo of your space gets the most accurate design. Or browse inspiration first if you’re still deciding the look."
            />
            <div className={css.pathChoices}>
              <button
                type="button"
                className={css.pathChoice}
                onClick={() => choosePath("upload")}
              >
                <span className={css.pathCopy}>
                  <strong>Upload my space</strong>
                  <small>Designs based on a photo of your actual room.</small>
                </span>
              </button>
              <button
                type="button"
                className={css.pathChoice}
                onClick={() => choosePath("inspiration")}
              >
                <span className={css.pathCopy}>
                  <strong>Start with inspiration</strong>
                  <small>Browse looks you like, then create concepts from them.</small>
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {snapshot.stage === "inspiration" ? (
          <section className={css.step} key="inspiration">
            <StepHead
              title="Find inspiration you love."
              body={
                selectedBudget && selectedBudget.id !== "not-sure"
                  ? `Pick ${MIN_SAVED_INSPIRATION} looks that fit a ${selectedBudget.galleryLabel} finish level. We’ll use them to shape your concept.`
                  : `Pick ${MIN_SAVED_INSPIRATION} designs that feel close to what you want. We’ll use them to create your personalized concept.`
              }
            />
            {catalogBusy ? (
              <LoadingState label="Finding designs for your project" />
            ) : snapshot.projects.length > 0 ? (
              <>
                <div className={css.lookFlow}>
                  {snapshot.projects.map((project, index) => (
                    <InspirationCard
                      key={project.assetId}
                      project={project}
                      shape={lookShapeAt(index)}
                      saved={snapshot.favoriteProjectIds.includes(project.assetId)}
                      atLimit={savedCount >= MAX_SAVED_INSPIRATION}
                      onToggle={() => toggleFavorite(project.assetId)}
                    />
                  ))}
                </div>
                <div className={css.saveBar} data-ready={canGenerateConcepts ? "true" : "false"}>
                  <span className={css.saveCount}>
                    {savedCount === 0
                      ? `Pick ${MIN_SAVED_INSPIRATION} to continue`
                      : canGenerateConcepts
                        ? `${savedCount} selected`
                        : `${savedCount} of ${MIN_SAVED_INSPIRATION} selected`}
                  </span>
                  <button
                    type="button"
                    className={css.primaryAction}
                    disabled={!canGenerateConcepts || conceptsBusy}
                    onClick={() => void generateConcepts()}
                  >
                    Create my concepts <ArrowRight size={16} />
                  </button>
                </div>
              </>
            ) : (
              <div className={css.empty}>
                <ImagePlus size={22} />
                <strong>We couldn’t load the inspiration gallery.</strong>
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

        {snapshot.stage === "personalize" ? (
          <section className={css.step} key="personalize">
            <div className={css.personalize}>
              <StepHead
                title="Show us your space."
                body="One photo is enough. We’ll redesign this exact room, keeping the walls and windows where they are."
              />
              {!snapshot.sourceAsset ? (
                <button type="button" className={css.dropzone} onClick={() => uploadRef.current?.click()} disabled={uploadBusy}>
                  {uploadBusy ? <LoaderCircle className={css.spin} size={26} /> : <Upload size={26} />}
                  <strong>{uploadBusy ? "Uploading your photo…" : "Upload or take a photo"}</strong>
                  <small>JPG, PNG, or WebP · up to 10 MB · private, not posted</small>
                </button>
              ) : (
                <>
                  <div className={css.uploadPreview}>
                    <img src={snapshot.sourceAsset.url} alt="Your uploaded space" />
                  </div>
                  <div className={css.stepFoot}>
                    <button type="button" className={css.linkAction} onClick={() => uploadRef.current?.click()}>
                      Replace photo
                    </button>
                  </div>
                  <div className={css.questions}>
                    <div>
                      <strong>What would you like to change?</strong>
                      <small>Optional. A sentence is plenty.</small>
                      <textarea
                        className={css.noteInput}
                        value={snapshot.uploadChangeNote || ""}
                        onChange={(event) => patchSnapshot({ uploadChangeNote: event.target.value.slice(0, 400) })}
                        placeholder="Bigger shower, more storage, lighter colours…"
                        aria-label="What would you like to change?"
                        rows={3}
                      />
                    </div>
                    <div>
                      <strong>Keep the current layout?</strong>
                      <small>The single biggest driver of cost.</small>
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
                    onClick={() => void generateConcepts()}
                    disabled={conceptsBusy || snapshot.projects.length === 0}
                  >
                    {conceptsBusy ? <LoaderCircle className={css.spin} size={16} /> : <Sparkles size={16} />}
                    {conceptsBusy ? "Creating your concepts…" : "Create my concepts"}
                  </button>
                </>
              )}
              {error ? <p className={css.fieldError}>{error}</p> : null}
            </div>
          </section>
        ) : null}

        {snapshot.stage === "concepts" ? (
          <section className={css.step} key="concepts">
            {snapshot.personalizedConcepts.length === 0 ? (
              <>
                <LoadingState
                  label={conceptsBusy ? conceptStatusLabel : "Couldn’t create concepts"}
                  hint={conceptsBusy ? "Usually ready in a few seconds." : (error || "Try again — this usually takes a few seconds.")}
                />
                {!conceptsBusy ? (
                  <button
                    type="button"
                    className={css.primaryAction}
                    onClick={() => void generateConcepts()}
                  >
                    Try again <ArrowRight size={16} />
                  </button>
                ) : null}
              </>
            ) : (
              <>
                <StepHead
                  title="Here’s what your project could look like."
                  body={snapshot.startPath === "upload"
                    ? `${CONCEPT_COUNT} directions for your room. Pick the one closest to right—you can change it next.`
                    : `${CONCEPT_COUNT} directions based on what you picked. Pick the one closest to right—you can change it next.`}
                />
                <div className={css.conceptGrid}>
                  {snapshot.personalizedConcepts.map((concept, index) => (
                    <button
                      key={concept.assetId || index}
                      type="button"
                      className={css.conceptCard}
                      data-on={index === personalizedActiveIndex ? "true" : "false"}
                      onClick={() => patchSnapshot({ personalizedActiveConceptIndex: index })}
                    >
                      <span className={css.conceptFrame}>
                        <img src={concept.imageUrl} alt={concept.changeLabel || `Concept ${index + 1}`} />
                      </span>
                      <span className={css.conceptLabel}>{concept.changeLabel}</span>
                    </button>
                  ))}
                  {conceptsBusy
                    ? Array.from(
                        { length: Math.max(0, CONCEPT_COUNT - snapshot.personalizedConcepts.length) },
                        (_, index) => (
                          <div key={`pending-${index}`} className={css.conceptPending} aria-hidden="true">
                            <span className={css.conceptFrame} data-pending="true" />
                            <span className={css.conceptLabel}>Still working…</span>
                          </div>
                        )
                      )
                    : null}
                </div>
                {error ? <p className={css.fieldError}>{error}</p> : null}
                <button
                  type="button"
                  className={css.primaryAction}
                  disabled={conceptsBusy || snapshot.personalizedConcepts.length === 0}
                  onClick={() => patchSnapshot({ stage: "customize" })}
                >
                  Customize this design <ArrowRight size={16} />
                </button>
              </>
            )}
          </section>
        ) : null}

        {snapshot.stage === "details" && selectedProject ? (
          <section className={css.step} key="details" data-compact="true">
            <StepHead
              title="Your design, and what it costs."
              body={selectedService
                ? `A planning range for this ${serviceName}, based on the design you built.`
                : "A planning range based on the design you built."}
            />
            <div className={css.split}>
              <div className={css.splitMedia}>
                <figure className={css.canvas}>
                  <img
                    src={selectedPreview?.imageUrl || activeProjectImageUrl}
                    alt={selectedPreview?.changeLabel || "Your design"}
                  />
                  <div className={css.canvasTools}>
                    <button
                      type="button"
                      aria-label="View fullscreen"
                      onClick={() => setFullscreenAsset({
                        imageUrl: selectedPreview?.imageUrl || activeProjectImageUrl,
                        label: "Your design",
                      })}
                    >
                      <Maximize2 size={15} />
                    </button>
                  </div>
                </figure>
              </div>
              <div className={css.splitPanel}>
                <div className={css.customizeStack}>
                  <header className={css.customizeHead}>
                    <PriceBlock
                      label="Your estimate"
                      value={displayedEstimateRange}
                      note="Planning range, not a quote"
                    />
                    {snapshot.lead.emailStatus === "sent" ? (
                      <p className={css.sentNote}><CheckCircle2 size={14} /> Pricing sent to your email</p>
                    ) : null}
                  </header>
                  <div className={css.customizeActions}>
                    {snapshot.lead.emailCaptured ? (
                      <>
                        <button
                          type="button"
                          className={css.primaryAction}
                          onClick={() => patchSnapshot({ stage: "consultation" })}
                        >
                          Book a consultation <ArrowRight size={16} />
                        </button>
                        <button
                          type="button"
                          className={css.secondaryAction}
                          onClick={() => patchSnapshot({ stage: "customize" })}
                        >
                          Change something
                        </button>
                        <p className={css.context}>
                          A local pro can confirm this range for your space.
                        </p>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          className={css.primaryAction}
                          onClick={() => { setEmailError(null); setEmailOpen(true); }}
                        >
                          Save your design and estimate
                          <ArrowRight size={16} />
                        </button>
                        <p className={css.context}>
                          Enter your email to see the full range and keep this design.
                        </p>
                      </>
                    )}
                  </div>
                  <details className={css.disclosure}>
                    <summary>What’s covered <ChevronRight size={14} /></summary>
                    <div className={css.disclosureBody}>
                      <section>
                        <h3>
                          {selectedService
                            ? `This ${serviceName} direction typically includes`
                            : "This direction typically includes"}
                        </h3>
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
                          {(selectedProject.priceIncreases.length > 0
                            ? selectedProject.priceIncreases
                            : (selectedService
                              ? priceDetailsForService(selectedService).increases
                              : [
                                  "Expanded scope or structural changes",
                                  "Custom fabrication or premium materials",
                                  "Hidden damage, permit changes, or difficult access",
                                ])
                          ).slice(0, 3).map((item) => (
                            <li key={item}>
                              <Check size={13} />
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </section>
                    </div>
                  </details>
                  <footer className={css.revealDesign}>
                    <p>{projectDesignSummary(selectedProject)}</p>
                  </footer>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {snapshot.stage === "customize" && selectedProject && selectedPreview ? (
          <section className={css.step} key="customize" data-compact="true">
            <StepHead
              title="Make it yours."
              body="Change anything you like. Each revision redraws the design."
            />
            <div className={css.split}>
              <div className={css.splitMedia}>
                <figure className={css.canvas}>
                  <img
                    key={selectedPreview.imageUrl}
                    src={selectedPreview.imageUrl}
                    alt={selectedPreview.changeLabel || "Your concept"}
                  />
                  <span className={css.canvasBadge}>
                    {personalizedActiveIndex > 0 ? `Revision ${personalizedActiveIndex}` : selectedPreview.changeLabel}
                  </span>
                  <div className={css.canvasTools}>
                    <button
                      type="button"
                      aria-label="View this version fullscreen"
                      onClick={() => setFullscreenAsset({
                        imageUrl: selectedPreview.imageUrl,
                        label: selectedPreview.changeLabel || "Your concept",
                      })}
                    >
                      <Maximize2 size={15} />
                    </button>
                  </div>
                  {snapshot.personalizedConcepts.length > 1 ? (
                    <div className={css.canvasPager} aria-label="Concept navigation">
                      <button
                        type="button"
                        aria-label="Previous version"
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
                        aria-label="Next version"
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
                      <img src={snapshot.sourceAsset.url} alt="Your space before" />
                      <figcaption>Before</figcaption>
                    </figure>
                  ) : null}
                  {personalizedRefinementBusy ? (
                    <div className={css.canvasBusy} role="status" aria-live="polite">
                      <LoaderCircle className={css.spin} size={22} />
                      <strong>Redrawing your design…</strong>
                      <small>Your current version stays here until the new one is ready.</small>
                    </div>
                  ) : null}
                </figure>
              </div>

              <div className={css.splitPanel}>
                <div className={css.refineIntro}>
                  <strong>What would you change?</strong>
                  <small>Pick a starting point or describe it in your own words.</small>
                </div>

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
                    </button>
                  ))}
                </div>

                <label className={css.promptRow}>
                  <WandSparkles size={16} aria-hidden="true" />
                  <input
                    value={snapshot.personalizedRefinementPrompt}
                    onChange={(event) => patchSnapshot({ personalizedRefinementPrompt: event.target.value })}
                    placeholder="Make the walls green, add a bigger shower…"
                    aria-label="Describe a change"
                  />
                </label>

                <button
                  type="button"
                  className={css.secondaryAction}
                  disabled={!hasPendingPersonalizedRefinement || personalizedRefinementBusy}
                  onClick={() => void applyPersonalizedRefinement()}
                >
                  {personalizedRefinementBusy
                    ? <LoaderCircle className={css.spin} size={16} />
                    : <Sparkles size={16} />}
                  {personalizedRefinementBusy ? "Redrawing…" : "Apply change"}
                </button>

                {error ? <p className={css.fieldError}>{error}</p> : null}

                <button
                  type="button"
                  className={css.primaryAction}
                  disabled={personalizedRefinementBusy}
                  onClick={() => patchSnapshot({ stage: "details" })}
                >
                  I love this—what does it cost? <ArrowRight size={16} />
                </button>

                {snapshot.personalizedConcepts.length > 1 ? (
                  <div className={css.rail}>
                    <div className={css.railHead}>
                      <strong>Your versions</strong>
                      <span>{snapshot.personalizedConcepts.length} saved</span>
                    </div>
                    <div className={css.railTrack}>
                      {snapshot.personalizedConcepts.map((concept, index) => (
                        <button
                          key={`${concept.assetId}-${index}`}
                          type="button"
                          data-on={index === personalizedActiveIndex ? "true" : "false"}
                          aria-label={`View version ${index + 1}`}
                          onClick={() => patchSnapshot({
                            personalizedActiveConceptIndex: index,
                            personalizedRefinementChoiceId: null,
                            personalizedRefinementPrompt: "",
                          })}
                        >
                          <img src={concept.imageUrl} alt="" loading="lazy" />
                          <span>{concept.changeLabel || `Version ${index + 1}`}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}

        {snapshot.stage === "consultation" && selectedProject ? (
          <section className={css.step} key="consultation" data-compact="true">
            <StepHead
              title="Ready to bring this design to life?"
              body="A local pro will confirm this range against your actual space, usually within one business day."
            />
            <div className={css.consult}>
              {selectedPreview ? (
                <figure className={css.consultPreview}>
                  <img src={selectedPreview.imageUrl} alt="Your design" />
                </figure>
              ) : null}
              <PriceBlock
                label="Your estimate"
                value={displayedEstimateRange}
                note="Planning range, not a quote"
              />
              {snapshot.lead.consultationStatus === "requested" ? (
                <p className={css.sentNote}><CheckCircle2 size={15} /> Consultation requested. We’ll be in touch shortly.</p>
              ) : (
                <button
                  type="button"
                  className={css.primaryAction}
                  onClick={bookConsultation}
                  disabled={snapshot.lead.consultationStatus === "requesting"}
                >
                  <Phone size={16} />
                  {snapshot.lead.consultationStatus === "requesting" ? "Requesting…" : "Book my consultation"}
                </button>
              )}
              {error ? <p className={css.fieldError}>{error}</p> : null}
              <div className={css.stepFoot}>
                <button
                  type="button"
                  className={css.linkAction}
                  onClick={() => patchSnapshot({ stage: "customize" })}
                >
                  Keep refining the design
                </button>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      <EmailSheet
        open={emailOpen && !snapshot.lead.emailCaptured}
        busy={emailBusy}
        error={emailError}
        previewImageUrl={selectedPreview?.imageUrl || selectedProject?.imageUrl || null}
        previewLabel={selectedPreview?.changeLabel || "Your design"}
        initialEmail={snapshot.lead.email}
        onClose={() => { setEmailOpen(false); setEmailError(null); }}
        onSubmit={(email) => void captureEmail(email, "")}
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
