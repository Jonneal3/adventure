"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Images,
  ImagePlus,
  LoaderCircle,
  Lock,
  Mail,
  Maximize2,
  MousePointer2,
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

import { resolveServiceProfile } from "./capabilities";
import {
  premadeConceptPrompt,
  regionStylePreviewPrompt,
  resolveScopeExperienceConfig,
} from "./refinement-experience";
import styles from "./adventure-v2.module.css";
import {
  clearV2Snapshot,
  getOrCreateV2SessionId,
  loadV2Snapshot,
  saveV2Snapshot,
} from "./storage";
import type {
  AdventureV2Snapshot,
  CanvasHistoryEntry,
  ExperienceMode,
  RegionConfig,
  ResolvedServiceProfile,
  StableAsset,
  StarterCanvas,
  StructuredDesignInstruction,
  V2Pricing,
  V2Stage,
  ServiceOption,
} from "./types";

type AdventureV2ExperienceProps = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
};

type UploadKind = "scene" | "person" | "product";
type LeadGateReason = "pricing" | "edit_limit";
type FinishedVersionCandidate = {
  id: string;
  title: string;
  summary: string;
  canvas: StarterCanvas;
  instruction: StructuredDesignInstruction;
};
type RegionSelectionPoint = {
  frameX: number;
  frameY: number;
  imageX: number;
  imageY: number;
  contentFrame: {
    left: number;
    top: number;
    width: number;
    height: number;
  };
};
type RegionHighlight = {
  left: number;
  top: number;
  width: number;
  height: number;
};
type RegionMapEntry = {
  regionId: string;
  confidence: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
};
type RegionStyleCandidate = {
  id: string;
  optionId: string;
  title: string;
  canvas: StarterCanvas;
};

const MINIMUM_PRICING_EDITS = 3;
const PRE_EMAIL_EDIT_LIMIT = 10;
const AUTO_CONCEPT_COUNT = 6;
const REGION_STYLE_PREVIEW_COUNT = 3;
const FAST_CONCEPT_MODEL_ID = "black-forest-labs/flux-schnell";

function regionAtPoint(
  regions: RegionMapEntry[],
  x: number,
  y: number
): RegionMapEntry | null {
  const containing = regions
    .filter(({ bounds }) => {
      const padding = 0.018;
      return (
        x >= bounds.x - padding &&
        x <= bounds.x + bounds.width + padding &&
        y >= bounds.y - padding &&
        y <= bounds.y + bounds.height + padding
      );
    })
    .sort((left, right) => {
      const leftArea = left.bounds.width * left.bounds.height;
      const rightArea = right.bounds.width * right.bounds.height;
      return leftArea - rightArea || right.confidence - left.confidence;
    });
  if (containing[0]) return containing[0];

  const nearest = regions
    .map((region) => {
      const centerX = region.bounds.x + region.bounds.width / 2;
      const centerY = region.bounds.y + region.bounds.height / 2;
      return {
        region,
        distance: Math.hypot(x - centerX, y - centerY),
      };
    })
    .sort((left, right) => left.distance - right.distance)[0];
  return nearest && nearest.distance <= 0.09 ? nearest.region : null;
}

function stageAfterService(service: ServiceOption | null): V2Stage {
  return service ? "scope" : "service";
}

function createSnapshot(sessionId: string, selectedServiceId: string | null): AdventureV2Snapshot {
  return {
    version: 2,
    sessionId,
    stage: selectedServiceId ? "scope" : "service",
    selectedServiceId,
    scope: null,
    budget: null,
    sourceAssets: {},
    canvasHistory: [],
    activeCanvasIndex: -1,
    successfulEditCount: 0,
    promptHistory: [],
    lead: { captured: false, emailStatus: "idle", pricingStatus: "idle" },
    pricing: null,
    updatedAt: Date.now(),
  };
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

function activeCanvasIndexFor(snapshot: Pick<AdventureV2Snapshot, "activeCanvasIndex" | "canvasHistory">): number {
  if (snapshot.canvasHistory.length === 0) return -1;
  const requested = Number(snapshot.activeCanvasIndex);
  if (!Number.isInteger(requested)) return snapshot.canvasHistory.length - 1;
  return Math.min(Math.max(0, requested), snapshot.canvasHistory.length - 1);
}

function isDesignEditEntry(entry: CanvasHistoryEntry, index: number): boolean {
  const label = String(entry.changeLabel || "").trim();
  return (
    index > 0 &&
    entry.sourceType === "generated" &&
    Boolean(label) &&
    !/^AI starter$/i.test(label) &&
    !/^Uploaded (?:a new )?photo$/i.test(label)
  );
}

function promptHistoryForCanvases(history: CanvasHistoryEntry[]): string[] {
  return history
    .map((entry, index) => (isDesignEditEntry(entry, index) ? String(entry.changeLabel || "").trim() : ""))
    .filter(Boolean)
    .slice(-30);
}

function activeCanvasBranch(snapshot: AdventureV2Snapshot): CanvasHistoryEntry[] {
  return snapshot.canvasHistory.slice(0, activeCanvasIndexFor(snapshot) + 1);
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

function normalizeServices(raw: unknown): ServiceOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item: any) => {
      const value = typeof item?.value === "string" ? item.value.trim() : "";
      const label =
        typeof item?.label === "string" && item.label.trim()
          ? item.label.trim()
          : typeof item?.serviceName === "string"
            ? item.serviceName.trim()
            : "";
      if (!value || !label) return null;
      return {
        value,
        label,
        serviceName: typeof item?.serviceName === "string" ? item.serviceName : label,
        industryId: typeof item?.industryId === "string" ? item.industryId : null,
        industryName: typeof item?.industryName === "string" ? item.industryName : null,
        serviceSummary: typeof item?.serviceSummary === "string" ? item.serviceSummary : null,
        subcategoryComponents: Array.isArray(item?.subcategoryComponents) ? item.subcategoryComponents : undefined,
        subcategoryScope: Array.isArray(item?.subcategoryScope) ? item.subcategoryScope : undefined,
      } satisfies ServiceOption;
    })
    .filter(Boolean) as ServiceOption[];
}

function UploadCard(props: {
  kind: UploadKind;
  title: string;
  description: string;
  asset?: StableAsset | null;
  busy: boolean;
  required?: boolean;
  onUpload: (kind: UploadKind, file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <div className={styles.uploadCard} data-upload-kind={props.kind}>
      <div className={styles.uploadCopy}>
        <div className={styles.uploadIcon}>
          <ImagePlus size={19} />
        </div>
        <div>
          <strong>{props.title}</strong>
          <p>{props.description}</p>
        </div>
      </div>
      {props.asset?.url ? (
        <div className={styles.uploadPreview}>
          <img src={props.asset.url} alt={props.title} />
          <span><Check size={14} /> Ready</span>
        </div>
      ) : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) props.onUpload(props.kind, file);
          event.currentTarget.value = "";
        }}
      />
      <button
        type="button"
        className={styles.secondaryButton}
        onClick={() => inputRef.current?.click()}
        disabled={props.busy}
      >
        {props.busy ? <LoaderCircle className={styles.spin} size={16} /> : <Upload size={16} />}
        {props.asset ? "Replace photo" : `Upload${props.required ? "" : " (optional)"}`}
      </button>
    </div>
  );
}

function LeadGate(props: {
  open: boolean;
  busy: boolean;
  error: string | null;
  reason: LeadGateReason;
  onClose: () => void;
  onSubmit: (email: string, name: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const reachedEditLimit = props.reason === "edit_limit";
  if (!props.open) return null;
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="v2-lead-title">
        <div className={styles.modalIcon}><Mail size={22} /></div>
        <h2 id="v2-lead-title">
          {reachedEditLimit ? "Keep refining your design" : "Reveal your personalized price range"}
        </h2>
        <p>
          {reachedEditLimit
            ? `You’ve completed ${PRE_EMAIL_EDIT_LIMIT} preview edits. Enter your email to keep making changes, reveal pricing, and unlock full-screen viewing and download.`
            : "Enter your email to unlock pricing, full-screen viewing, and download for this design. We’ll also send the concept so you can keep it."}
        </p>
        <label>
          Name <span>(optional)</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            placeholder="you@example.com"
            required
          />
        </label>
        {props.error ? <div className={styles.formError}>{props.error}</div> : null}
        <button
          type="button"
          className={styles.primaryButton}
          disabled={props.busy || !email.trim()}
          onClick={() => props.onSubmit(email, name)}
        >
          {props.busy ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={17} />}
          {reachedEditLimit ? "Continue and reveal price" : "Reveal my price"}
        </button>
        <button type="button" className={styles.textButton} onClick={props.onClose} disabled={props.busy}>
          Not yet
        </button>
      </div>
    </div>
  );
}

function modeLabel(mode: ExperienceMode): string {
  if (mode === "tryon") return "try-on";
  if (mode === "placement") return "placement";
  return "design";
}

export function AdventureV2Experience({
  instanceId,
  initialInstanceData,
  initialDesignConfig,
}: AdventureV2ExperienceProps) {
  const [instance, setInstance] = useState<any>(initialInstanceData || null);
  const [design, setDesign] = useState<DesignSettings>(() =>
    withWidgetDesignDefaults(initialDesignConfig || initialInstanceData?.config || {}, initialInstanceData?.name)
  );
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [snapshot, setSnapshot] = useState<AdventureV2Snapshot | null>(null);
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadBusy, setUploadBusy] = useState<UploadKind | null>(null);
  const [prompt, setPrompt] = useState("");
  const [finishedVersions, setFinishedVersions] = useState<FinishedVersionCandidate[]>([]);
  const [selectedFinishedVersionId, setSelectedFinishedVersionId] = useState<string | null>(null);
  const [finishedVersionsBusy, setFinishedVersionsBusy] = useState(false);
  const [conceptGenerationError, setConceptGenerationError] = useState<string | null>(null);
  const [regionDetectionBusy, setRegionDetectionBusy] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState<(RegionConfig & { confidence: number }) | null>(null);
  const [selectedRegionOptionId, setSelectedRegionOptionId] = useState<string | null>(null);
  const [regionSelectionPoint, setRegionSelectionPoint] = useState<RegionSelectionPoint | null>(null);
  const [regionHighlight, setRegionHighlight] = useState<RegionHighlight | null>(null);
  const [regionSelectionMessage, setRegionSelectionMessage] = useState<string | null>(null);
  const [regionMap, setRegionMap] = useState<RegionMapEntry[]>([]);
  const [regionMapAssetId, setRegionMapAssetId] = useState<string | null>(null);
  const [regionStylePreviews, setRegionStylePreviews] = useState<RegionStyleCandidate[]>([]);
  const [regionStylePreviewsBusy, setRegionStylePreviewsBusy] = useState(false);
  const [regionStylePreviewError, setRegionStylePreviewError] = useState<string | null>(null);
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadReason, setLeadReason] = useState<LeadGateReason>("pricing");
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [emailRetryBusy, setEmailRetryBusy] = useState(false);
  const [downloadBusy, setDownloadBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const imageFrameRef = useRef<HTMLDivElement | null>(null);
  const refinementPanelRef = useRef<HTMLElement | null>(null);
  const canvasImageRef = useRef<HTMLImageElement | null>(null);
  const canvasUploadRef = useRef<HTMLInputElement | null>(null);
  const conceptGenerationKeyRef = useRef<string | null>(null);
  const conceptRequestTokenRef = useRef(0);
  const regionStyleRequestTokenRef = useRef(0);

  const selectedService = useMemo(
    () => services.find((service) => service.value === snapshot?.selectedServiceId) || null,
    [services, snapshot?.selectedServiceId]
  );
  const profile: ResolvedServiceProfile | null = useMemo(
    () => (selectedService ? resolveServiceProfile(instance, selectedService) : null),
    [instance, selectedService]
  );
  const scopeExperience = useMemo(
    () =>
      profile
        ? resolveScopeExperienceConfig(profile, snapshot?.scope)
        : null,
    [profile, snapshot?.scope]
  );
  const selectedFinishedVersion = useMemo(
    () =>
      finishedVersions.find(
        (version) => version.id === selectedFinishedVersionId
      ) || null,
    [finishedVersions, selectedFinishedVersionId]
  );
  const selectedRegionOption = useMemo(
    () =>
      selectedRegion?.options.find(
        (option) => option.id === selectedRegionOptionId
      ) || null,
    [selectedRegion, selectedRegionOptionId]
  );
  const activeCanvasIndex = snapshot ? activeCanvasIndexFor(snapshot) : -1;
  const currentCanvas =
    snapshot && activeCanvasIndex >= 0
      ? snapshot.canvasHistory[activeCanvasIndex] || null
      : null;
  const displayedCanvas = selectedFinishedVersion?.canvas || currentCanvas;
  const personalizedPricing = useMemo(() => {
    const pricing = snapshot?.pricing;
    if (!pricing) return null;
    const source = String(pricing.source || "").trim();
    return /^(fallback|configured_preview)/i.test(source) ? null : pricing;
  }, [snapshot?.pricing]);

  useEffect(() => {
    conceptRequestTokenRef.current += 1;
    setFinishedVersionsBusy(false);
    setFinishedVersions([]);
    setSelectedFinishedVersionId(null);
    setConceptGenerationError(null);
    setSelectedRegion(null);
    setSelectedRegionOptionId(null);
    setRegionSelectionPoint(null);
    setRegionHighlight(null);
    setRegionSelectionMessage(null);
    setRegionMap([]);
    setRegionMapAssetId(null);
    regionStyleRequestTokenRef.current += 1;
    setRegionStylePreviews([]);
    setRegionStylePreviewsBusy(false);
    setRegionStylePreviewError(null);
  }, [currentCanvas?.assetId]);

  useEffect(() => {
    if (
      !selectedRegion ||
      typeof window === "undefined" ||
      !window.matchMedia("(max-width: 860px)").matches
    ) {
      return;
    }
    const frame = window.requestAnimationFrame(() => {
      refinementPanelRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [selectedRegion]);

  const pricingBounds = useMemo(() => {
    const root = instance?.config && typeof instance.config === "object" ? instance.config : {};
    const legacy = root?.aiFormConfig && typeof root.aiFormConfig === "object" ? root.aiFormConfig : {};
    const configured = root.previewPricing ?? legacy.previewPricing ?? {};
    const rawMin = Number(configured.totalMin);
    const rawMax = Number(configured.totalMax);
    const min = Number.isFinite(rawMin) && rawMin > 0 ? rawMin : 2_000;
    const maxCandidate = Number.isFinite(rawMax) && rawMax > min ? rawMax : 50_000;
    const max = Math.max(min + 1_000, maxCandidate);
    const span = max - min;
    const step = span <= 20_000 ? 1_000 : span <= 75_000 ? 2_500 : 5_000;
    return { min, max, step, currency: typeof configured.currency === "string" ? configured.currency : "USD" };
  }, [instance]);

  const fallbackPricing = useMemo<V2Pricing>(
    () => ({
      totalMin: pricingBounds.min,
      totalMax: pricingBounds.max,
      currency: pricingBounds.currency,
      source: "configured_preview",
    }),
    [pricingBounds]
  );

  const track = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}, modelRequestId?: string | null) => {
      if (!snapshot?.sessionId) return;
      emitTelemetry({
        sessionId: snapshot.sessionId,
        instanceId,
        eventType,
        modelRequestId: modelRequestId || undefined,
        payload: { ...payload, experienceVersion: "v2", experience_version: "v2" },
      });
    },
    [instanceId, snapshot?.sessionId]
  );

  const resetExperience = useCallback(
    (source: "in_form" | "designer_refresh") => {
      clearV2Snapshot(instanceId);
      const sessionId = getOrCreateV2SessionId(instanceId);
      const implicit = services.length === 1 ? services[0] : null;
      setSnapshot(createSnapshot(sessionId, implicit?.value || null));
      setPrompt("");
      setFinishedVersions([]);
      setSelectedFinishedVersionId(null);
      setConceptGenerationError(null);
      conceptGenerationKeyRef.current = null;
      setSelectedRegion(null);
      setSelectedRegionOptionId(null);
      setRegionSelectionPoint(null);
      setRegionHighlight(null);
      setRegionSelectionMessage(null);
      setLeadOpen(false);
      setLeadReason("pricing");
      setLeadError(null);
      setError(null);
      track("adventure_v2_restarted", { source });
    },
    [instanceId, services, track]
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      let hintedServiceId = "";
      let shouldStartFresh = false;
      try {
        const params = new URLSearchParams(window.location.search);
        hintedServiceId = params.get("serviceId") || params.get("service_id") || "";
        const freshRequested = params.get("fresh") === "1" || params.get("fresh") === "true";
        const freshNonce = params.get("freshNonce") || "";
        if (freshRequested && freshNonce) {
          const markerKey = `adventure:v2:fresh-consumed:${instanceId}`;
          shouldStartFresh = window.sessionStorage.getItem(markerKey) !== freshNonce;
          if (shouldStartFresh) window.sessionStorage.setItem(markerKey, freshNonce);
        }
      } catch {}
      if (shouldStartFresh) clearV2Snapshot(instanceId);
      const sessionId = getOrCreateV2SessionId(instanceId);
      const saved = shouldStartFresh ? null : loadV2Snapshot(instanceId);
      try {
        const response = await fetch(`/api/widget/${encodeURIComponent(instanceId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load this experience.");
        const data = await response.json();
        if (cancelled) return;
        const nextInstance = data?.instance || initialInstanceData || {};
        const normalizedServices = normalizeServices(data?.serviceOptions);
        const nextServices =
          normalizedServices.length > 0
            ? normalizedServices
            : [
                {
                  value: "general-service",
                  label:
                    typeof nextInstance?.name === "string" && nextInstance.name.trim()
                      ? nextInstance.name.trim()
                      : "Your project",
                  serviceName:
                    typeof nextInstance?.name === "string" && nextInstance.name.trim()
                      ? nextInstance.name.trim()
                      : "Your project",
                  serviceSummary:
                    typeof nextInstance?.service_summary === "string"
                      ? nextInstance.service_summary
                      : typeof nextInstance?.company_summary === "string"
                        ? nextInstance.company_summary
                        : null,
                } satisfies ServiceOption,
              ];
        setInstance(nextInstance);
        setDesign((previous) =>
          withWidgetDesignDefaults(nextInstance?.config || previous, nextInstance?.name || initialInstanceData?.name)
        );
        setServices(nextServices);

        const savedService = nextServices.find((service) => service.value === saved?.selectedServiceId);
        const hintedService = nextServices.find(
          (service) => service.value === hintedServiceId || service.label.toLowerCase() === hintedServiceId.toLowerCase()
        );
        const implicit = hintedService || savedService || (nextServices.length === 1 ? nextServices[0] : null);
        const nextSnapshot =
          saved && savedService
            ? { ...saved, stage: saved.stage === "loading" ? stageAfterService(savedService) : saved.stage }
            : createSnapshot(sessionId, implicit?.value || null);
        setSnapshot(nextSnapshot);
      } catch (bootstrapError) {
        if (!cancelled) setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to load this experience.");
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [initialInstanceData, instanceId]);

  useEffect(() => {
    if (!snapshot) return;
    saveV2Snapshot(instanceId, { ...snapshot, updatedAt: Date.now() });
  }, [instanceId, snapshot]);

  useEffect(() => {
    if (!snapshot?.sessionId) return;
    track("adventure_experience_started", { routeVersion: "v2" });
  }, [snapshot?.sessionId, track]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.parent?.postMessage({ type: "FORM_READY", version: "v2" }, "*");
      window.parent?.postMessage({ type: "WIDGET_READY", surface: "form", version: "v2" }, "*");
    } catch {}
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "SIF_RESET_SESSION" || event.data.type === "RESET_SESSION") {
        resetExperience("designer_refresh");
        try {
          window.parent?.postMessage({ type: "RESET_SESSION_ACK", version: "v2" }, event.origin || "*");
        } catch {}
        return;
      }
      if (event.data.type === "UPDATE_CONFIG" && event.data.config && typeof event.data.config === "object") {
        setDesign(withWidgetDesignDefaults(event.data.config, instance?.name));
        try {
          window.parent?.postMessage({ type: "UPDATE_CONFIG_ACK", version: "v2" }, event.origin || "*");
        } catch {}
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [instance?.name, resetExperience]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const phase =
      snapshot?.lead.captured ? "estimate" : snapshot?.stage === "canvas" ? "concepts" : "project";
    const observer = new ResizeObserver(() => {
      try {
        window.parent?.postMessage(
          {
            type: "ADVENTURE_RESIZE",
            instanceId,
            phase,
            height: Math.ceil(root.scrollHeight),
            version: "v2",
          },
          "*"
        );
      } catch {}
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [instanceId, snapshot?.lead.captured, snapshot?.stage]);

  const patchSnapshot = useCallback((patch: Partial<AdventureV2Snapshot>) => {
    setSnapshot((previous) => (previous ? { ...previous, ...patch, updatedAt: Date.now() } : previous));
  }, []);

  const chooseService = useCallback(
    (service: ServiceOption) => {
      setError(null);
      setSnapshot((previous) =>
        previous
          ? {
              ...createSnapshot(previous.sessionId, service.value),
              stage: "scope",
              updatedAt: Date.now(),
            }
          : previous
      );
      track("adventure_v2_service_selected", { serviceId: service.value, serviceName: service.label });
    },
    [track]
  );

  const chooseScope = useCallback(
    (scope: string) => {
      patchSnapshot({ scope, stage: "budget", budget: snapshot?.budget ?? null });
      track("adventure_v2_scope_selected", { serviceId: selectedService?.value, scope, mode: profile?.mode });
    },
    [patchSnapshot, profile?.mode, selectedService?.value, snapshot?.budget, track]
  );

  const continueBudget = useCallback(() => {
    const budget =
      snapshot?.budget ??
      Math.round((pricingBounds.min + (pricingBounds.max - pricingBounds.min) * 0.35) / pricingBounds.step) *
        pricingBounds.step;
    patchSnapshot({ budget, stage: "inputs" });
    track("adventure_v2_budget_selected", { budget, serviceId: selectedService?.value });
  }, [patchSnapshot, pricingBounds, selectedService?.value, snapshot?.budget, track]);

  const uploadAsset = useCallback(
    async (kind: UploadKind, file: File): Promise<StableAsset | null> => {
      if (!snapshot?.sessionId) return null;
      setError(null);
      setUploadBusy(kind);
      try {
        const image = await readFileAsDataUrl(file);
        const response = await fetch(`/api/v2/assets/${encodeURIComponent(instanceId)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: snapshot.sessionId, kind, image }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.asset?.url) throw new Error(data?.error || "Unable to upload that image.");
        const asset = data.asset as StableAsset;
        setSnapshot((previous) =>
          previous
            ? {
                ...previous,
                sourceAssets: { ...previous.sourceAssets, [kind]: asset },
                updatedAt: Date.now(),
              }
            : previous
        );
        track("adventure_v2_asset_uploaded", { kind, assetId: asset.assetId }, asset.assetId);
        return asset;
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Unable to upload that image.");
        return null;
      } finally {
        setUploadBusy(null);
      }
    },
    [instanceId, snapshot?.sessionId, track]
  );

  const callCanvas = useCallback(
    async (
      action: "starter" | "edit" | "concept",
      requestedChange?: string,
      sourceAssetsOverride?: AdventureV2Snapshot["sourceAssets"],
      designInstruction?: StructuredDesignInstruction | null,
      options?: {
        currentCanvasUrl?: string;
        modelId?: string;
        generationIntent?: string;
      }
    ): Promise<StarterCanvas> => {
      if (!snapshot || !selectedService || !profile || !snapshot.scope || !snapshot.budget) {
        throw new Error("Finish the service, scope, and budget steps first.");
      }
      const response = await fetch(`/api/v2/ai-form/${encodeURIComponent(instanceId)}/canvas`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          sessionId: snapshot.sessionId,
          serviceId: selectedService.value,
          serviceName: selectedService.label,
          industryName: selectedService.industryName,
          serviceSummary: selectedService.serviceSummary,
          components: selectedService.subcategoryComponents,
          scope: snapshot.scope,
          budget: snapshot.budget,
          experienceMode: profile.mode,
          sourceAssets: sourceAssetsOverride || snapshot.sourceAssets,
          currentCanvasUrl:
            options?.currentCanvasUrl || currentCanvas?.imageUrl,
          prompt: requestedChange,
          designInstruction,
          modelId: options?.modelId,
          generationIntent: options?.generationIntent,
          priorChanges: action === "edit" ? snapshot.promptHistory.slice(-6) : [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.canvas?.imageUrl) {
        throw new Error(data?.error || "The image model could not create a result.");
      }
      return data.canvas as StarterCanvas;
    },
    [currentCanvas?.imageUrl, instanceId, profile, selectedService, snapshot]
  );

  const replaceCanvasWithUpload = useCallback(
    async (file: File) => {
      if (!snapshot || !selectedService || !profile || !snapshot.scope || !snapshot.budget || busyMessage) return;
      const kind: UploadKind = profile.mode === "tryon" ? "person" : "scene";
      setError(null);
      setBusyMessage("Uploading your photo…");
      try {
        const asset = await uploadAsset(kind, file);
        if (!asset) return;

        const nextSourceAssets = { ...snapshot.sourceAssets, [kind]: asset };
        if (profile.mode === "scene") {
          const replacement: CanvasHistoryEntry = {
            assetId: asset.assetId,
            imageUrl: asset.url,
            storagePath: asset.storagePath,
            sourceType: "uploaded",
            modelId: null,
            predictionId: null,
            prompt: null,
            serviceId: selectedService.value,
            scope: snapshot.scope,
            budget: snapshot.budget,
            experienceMode: profile.mode,
            createdAt: Date.now(),
            changeLabel: "Uploaded a new photo",
          };
          setSnapshot((previous) =>
            previous
              ? (() => {
                  const nextHistory = [...activeCanvasBranch(previous), replacement];
                  return {
                    ...previous,
                    sourceAssets: { ...previous.sourceAssets, [kind]: asset },
                    canvasHistory: nextHistory,
                    activeCanvasIndex: nextHistory.length - 1,
                    promptHistory: promptHistoryForCanvases(nextHistory),
                    updatedAt: Date.now(),
                  };
                })()
              : previous
          );
          track(
            "adventure_v2_canvas_photo_replaced",
            { mode: profile.mode, editCount: snapshot.successfulEditCount },
            asset.assetId
          );
          return;
        }

        setBusyMessage(`Rebuilding your ${modeLabel(profile.mode)} from the new photo…`);
        const canvas = await callCanvas("starter", undefined, nextSourceAssets);
        setSnapshot((previous) =>
          previous
            ? (() => {
                const nextHistory = [
                  ...activeCanvasBranch(previous),
                  { ...canvas, changeLabel: "Uploaded a new photo" },
                ];
                return {
                  ...previous,
                  sourceAssets: { ...previous.sourceAssets, [kind]: asset },
                  canvasHistory: nextHistory,
                  activeCanvasIndex: nextHistory.length - 1,
                  promptHistory: promptHistoryForCanvases(nextHistory),
                  updatedAt: Date.now(),
                };
              })()
            : previous
        );
        track(
          "adventure_v2_canvas_photo_replaced",
          {
            mode: profile.mode,
            editCount: snapshot.successfulEditCount,
            modelId: canvas.modelId,
          },
          canvas.predictionId || canvas.assetId
        );
      } catch (uploadError) {
        const message =
          uploadError instanceof Error ? uploadError.message : "Unable to use that photo for the design.";
        setError(message);
        track("adventure_v2_generation_failed", {
          action: "replace_canvas_photo",
          mode: profile.mode,
          error: message,
        });
      } finally {
        setBusyMessage(null);
      }
    },
    [busyMessage, callCanvas, profile, selectedService, snapshot, track, uploadAsset]
  );

  const generateStarter = useCallback(async () => {
    if (!profile) return;
    setError(null);
    setBusyMessage(
      profile.mode === "scene"
        ? "Opening a plain sample space…"
        : `Creating your ${modeLabel(profile.mode)} starter…`
    );
    try {
      const canvas = await callCanvas("starter");
      patchSnapshot({
        canvasHistory: [{ ...canvas, changeLabel: "AI starter" }],
        activeCanvasIndex: 0,
        stage: "canvas",
      });
      track(
        "adventure_v2_starter_ready",
        {
          sourceType: "generated",
          mode: profile.mode,
          modelId: canvas.modelId,
          starterExperimentKey: canvas.starterExperimentKey,
          starterVariantId: canvas.starterVariantId,
          starterVariantLabel: canvas.starterVariantLabel,
        },
        canvas.predictionId || canvas.assetId
      );
    } catch (generationError) {
      const message = generationError instanceof Error ? generationError.message : "Unable to create a starter.";
      setError(message);
      track("adventure_v2_generation_failed", { action: "starter", mode: profile.mode, error: message });
    } finally {
      setBusyMessage(null);
    }
  }, [callCanvas, patchSnapshot, profile, track]);

  useEffect(() => {
    if (
      snapshot?.stage !== "inputs" ||
      profile?.mode !== "scene" ||
      snapshot.canvasHistory.length > 0 ||
      busyMessage
    ) {
      return;
    }
    void generateStarter();
  }, [
    busyMessage,
    generateStarter,
    profile?.mode,
    snapshot?.canvasHistory.length,
    snapshot?.stage,
  ]);

  const openLeadGate = useCallback(
    (reason: LeadGateReason, editCount = snapshot?.successfulEditCount ?? 0) => {
      setLeadError(null);
      setLeadReason(reason);
      setLeadOpen(true);
      track(
        reason === "edit_limit"
          ? "adventure_v2_edit_limit_reached"
          : "adventure_v2_pricing_preview_clicked",
        {
          editCount,
          minimumPricingEdits: MINIMUM_PRICING_EDITS,
          preEmailEditLimit: PRE_EMAIL_EDIT_LIMIT,
        }
      );
    },
    [snapshot?.successfulEditCount, track]
  );

  const applyEdit = useCallback(
    async (
      requestedChange: string,
      designInstruction?: StructuredDesignInstruction | null,
      currentCanvasUrlOverride?: string
    ) => {
      const cleaned = requestedChange.trim();
      if (!cleaned || !snapshot || !profile) return false;
      if (!snapshot.lead.captured && snapshot.successfulEditCount >= PRE_EMAIL_EDIT_LIMIT) {
        openLeadGate("edit_limit");
        return false;
      }
      setError(null);
      setBusyMessage("Applying your change…");
      try {
        const canvas = await callCanvas(
          "edit",
          cleaned,
          undefined,
          designInstruction,
          currentCanvasUrlOverride
            ? { currentCanvasUrl: currentCanvasUrlOverride }
            : undefined
        );
        const nextCount = snapshot.successfulEditCount + 1;
        setSnapshot((previous) =>
          previous
            ? (() => {
                const nextHistory = [
                  ...activeCanvasBranch(previous),
                  {
                    ...canvas,
                    changeLabel:
                      designInstruction?.readableSummary || cleaned,
                    designInstruction: designInstruction || null,
                  },
                ];
                return {
                  ...previous,
                  canvasHistory: nextHistory,
                  activeCanvasIndex: nextHistory.length - 1,
                  successfulEditCount: previous.successfulEditCount + 1,
                  promptHistory: promptHistoryForCanvases(nextHistory),
                  updatedAt: Date.now(),
                };
              })()
            : previous
        );
        setPrompt("");
        track(
          "adventure_v2_edit_succeeded",
          {
            editNumber: nextCount,
            prompt: cleaned,
            editMode: designInstruction?.mode || "custom_prompt",
            directionId: designInstruction?.directionId || null,
            targetRegionId: designInstruction?.targetRegion?.id || null,
            mode: profile.mode,
            modelId: canvas.modelId,
          },
          canvas.predictionId || canvas.assetId
        );
        if (!snapshot.lead.captured && nextCount >= PRE_EMAIL_EDIT_LIMIT) {
          openLeadGate("edit_limit", nextCount);
        }
        return true;
      } catch (editError) {
        const message = editError instanceof Error ? editError.message : "Unable to apply that change.";
        setError(message);
        track("adventure_v2_generation_failed", {
          action: "edit",
          editNumber: snapshot.successfulEditCount + 1,
          error: message,
        });
        return false;
      } finally {
        setBusyMessage(null);
      }
    },
    [callCanvas, openLeadGate, profile, snapshot, track]
  );

  const generatePremadeConcepts = useCallback(async () => {
    if (
      !snapshot ||
      !profile ||
      !scopeExperience ||
      !scopeExperience.supportsFinishedVersions ||
      finishedVersionsBusy ||
      busyMessage ||
      !currentCanvas
    ) {
      return;
    }
    setConceptGenerationError(null);
    setFinishedVersionsBusy(true);
    setFinishedVersions([]);
    setSelectedFinishedVersionId(null);
    track("adventure_v2_premade_concepts_requested", {
      count: AUTO_CONCEPT_COUNT,
      scope: snapshot.scope,
      sourceAssetId: currentCanvas.assetId,
      modelId: FAST_CONCEPT_MODEL_ID,
    });
    const requestToken = conceptRequestTokenRef.current + 1;
    conceptRequestTokenRef.current = requestToken;
    try {
      const requests = Array.from(
        { length: AUTO_CONCEPT_COUNT },
        (_, index) => {
        const versionDirection =
          scopeExperience.directions[
            index % Math.max(1, scopeExperience.directions.length)
          ] ||
          scopeExperience.directions[0] ||
          null;
        const basePrompt = premadeConceptPrompt(
          scopeExperience,
          selectedService?.label || "this service",
          snapshot.scope || scopeExperience.scopeId,
          index
        );
        const requestedChange = basePrompt;
        const instruction: StructuredDesignInstruction = {
          mode: "finished_version",
          directionId: versionDirection?.id || null,
          directionLabel: versionDirection?.label || null,
          versionId: `premade-${index + 1}`,
          style: versionDirection?.label || null,
          materials: versionDirection?.materials || [],
          colors: versionDirection?.colors || [],
          fixtures: versionDirection?.fixtures || [],
          affectedRegions: versionDirection?.affectedRegions || [],
          preserve: [
            ...scopeExperience.wholeDesignPreserveRules,
            ...(versionDirection?.preserve || []),
          ],
          customInstruction: null,
          readableSummary: versionDirection
            ? `Premade concept · ${versionDirection.label}`
            : `Premade concept ${index + 1}`,
        };
        return callCanvas(
          "concept",
          requestedChange,
          undefined,
          instruction,
          {
            modelId: FAST_CONCEPT_MODEL_ID,
            generationIntent: "concept_preview",
          }
        ).then((canvas) => ({
          id: `premade-${canvas.assetId}-${index + 1}`,
          title:
            index < scopeExperience.directions.length
              ? versionDirection?.label ||
                `Concept ${String.fromCharCode(65 + index)}`
              : `Elevated ${versionDirection?.label || `concept ${index + 1}`}`,
          summary:
            index < scopeExperience.directions.length
              ? "Complete coordinated concept"
              : "A more finished interpretation",
          canvas,
          instruction,
        }));
      });
      const results = await Promise.allSettled(requests);
      const candidates = results
        .filter(
          (
            result
          ): result is PromiseFulfilledResult<FinishedVersionCandidate> =>
            result.status === "fulfilled"
        )
        .map((result) => result.value);
      if (candidates.length === 0) {
        const firstFailure = results.find(
          (result): result is PromiseRejectedResult =>
            result.status === "rejected"
        );
        throw firstFailure?.reason instanceof Error
          ? firstFailure.reason
          : new Error("Unable to create concept options.");
      }
      if (conceptRequestTokenRef.current !== requestToken) return;
      setFinishedVersions(candidates);
      track("adventure_v2_premade_concepts_ready", {
        count: candidates.length,
        modelId: FAST_CONCEPT_MODEL_ID,
      });
    } catch (versionError) {
      if (conceptRequestTokenRef.current !== requestToken) return;
      const message =
        versionError instanceof Error
          ? versionError.message
          : "Unable to create concept options.";
      setConceptGenerationError(message);
      track("adventure_v2_generation_failed", {
        action: "premade_concepts",
        error: message,
      });
    } finally {
      if (conceptRequestTokenRef.current === requestToken) {
        setFinishedVersionsBusy(false);
      }
    }
  }, [
    busyMessage,
    callCanvas,
    currentCanvas,
    finishedVersionsBusy,
    profile,
    scopeExperience,
    selectedService?.label,
    snapshot,
    track,
  ]);

  useEffect(() => {
    if (
      snapshot?.stage !== "canvas" ||
      snapshot.successfulEditCount !== 0 ||
      !currentCanvas ||
      currentCanvas.sourceType !== "generated" ||
      !/^AI starter$/i.test(String(currentCanvas.changeLabel || "")) ||
      !scopeExperience?.supportsFinishedVersions ||
      finishedVersions.length > 0 ||
      finishedVersionsBusy ||
      busyMessage
    ) {
      return;
    }
    const generationKey = `${currentCanvas.assetId}:${snapshot.scope || ""}`;
    if (conceptGenerationKeyRef.current === generationKey) return;
    conceptGenerationKeyRef.current = generationKey;
    void generatePremadeConcepts();
  }, [
    currentCanvas,
    busyMessage,
    finishedVersions.length,
    finishedVersionsBusy,
    generatePremadeConcepts,
    scopeExperience?.supportsFinishedVersions,
    snapshot?.scope,
    snapshot?.stage,
    snapshot?.successfulEditCount,
  ]);

  useEffect(() => {
    if (
      snapshot?.stage !== "canvas" ||
      !displayedCanvas ||
      !selectedService ||
      !scopeExperience ||
      scopeExperience.supportedRegions.length === 0
    ) {
      setRegionMap([]);
      setRegionMapAssetId(null);
      return;
    }
    const controller = new AbortController();
    const assetId = displayedCanvas.assetId;
    setRegionMap([]);
    setRegionMapAssetId(null);
    void fetch(
      `/api/v2/ai-form/${encodeURIComponent(instanceId)}/regions`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          action: "map",
          imageUrl: displayedCanvas.imageUrl,
          serviceName: selectedService.label,
          scope: snapshot.scope,
          supportedRegions: scopeExperience.supportedRegions.map(
            ({ id, label, description }) => ({ id, label, description })
          ),
        }),
      }
    )
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !Array.isArray(data?.regions)) return;
        const mapped = data.regions
          .map((region: any) => {
            const bounds = region?.bounds;
            const configured = scopeExperience.supportedRegions.find(
              (candidate) => candidate.id === region?.id
            );
            if (
              !configured ||
              !bounds ||
              !Number.isFinite(Number(bounds.x)) ||
              !Number.isFinite(Number(bounds.y)) ||
              !Number.isFinite(Number(bounds.width)) ||
              !Number.isFinite(Number(bounds.height))
            ) {
              return null;
            }
            return {
              regionId: configured.id,
              confidence: Math.max(
                0,
                Math.min(1, Number(region.confidence) || 0)
              ),
              bounds: {
                x: Math.max(0, Math.min(1, Number(bounds.x))),
                y: Math.max(0, Math.min(1, Number(bounds.y))),
                width: Math.max(
                  0.04,
                  Math.min(1, Number(bounds.width))
                ),
                height: Math.max(
                  0.04,
                  Math.min(1, Number(bounds.height))
                ),
              },
            } satisfies RegionMapEntry;
          })
          .filter(
            (region: RegionMapEntry | null): region is RegionMapEntry =>
              Boolean(region)
          );
        if (!controller.signal.aborted) {
          setRegionMap(mapped);
          setRegionMapAssetId(assetId);
        }
      })
      .catch(() => {
        // Point detection remains available when ahead-of-click mapping fails.
      });
    return () => controller.abort();
  }, [
    displayedCanvas,
    instanceId,
    scopeExperience,
    selectedService,
    snapshot?.scope,
    snapshot?.stage,
  ]);

  const generateRegionStylePreviews = useCallback(
    async (region: RegionConfig, canvas: StarterCanvas) => {
      if (
        !snapshot ||
        !selectedService ||
        !snapshot.scope ||
        region.options.length === 0
      ) {
        return;
      }
      const requestToken = regionStyleRequestTokenRef.current + 1;
      regionStyleRequestTokenRef.current = requestToken;
      setRegionStylePreviews([]);
      setRegionStylePreviewError(null);
      setRegionStylePreviewsBusy(true);
      track("adventure_v2_region_styles_requested", {
        assetId: canvas.assetId,
        regionId: region.id,
        count: Math.min(REGION_STYLE_PREVIEW_COUNT, region.options.length),
        modelId: FAST_CONCEPT_MODEL_ID,
      });
      try {
        const requests = region.options
          .slice(0, REGION_STYLE_PREVIEW_COUNT)
          .map((option, index) => {
            const instruction: StructuredDesignInstruction = {
              mode: "target_region",
              targetRegion: {
                id: region.id,
                label: region.label,
              },
              optionId: option.id,
              optionLabel: option.label,
              affectedRegions: [region.label],
              customInstruction: null,
              readableSummary: `${region.label} · ${option.label}`,
            };
            return callCanvas(
              "concept",
              regionStylePreviewPrompt(
                selectedService.label,
                snapshot.scope || "",
                region,
                option
              ),
              undefined,
              instruction,
              {
                currentCanvasUrl: canvas.imageUrl,
                modelId: FAST_CONCEPT_MODEL_ID,
                generationIntent: "concept_preview",
              }
            ).then(
              (styleCanvas): RegionStyleCandidate => ({
                id: `${region.id}-${option.id}-${styleCanvas.assetId}-${index}`,
                optionId: option.id,
                title: option.label,
                canvas: styleCanvas,
              })
            );
          });
        const results = await Promise.allSettled(requests);
        if (regionStyleRequestTokenRef.current !== requestToken) return;
        const candidates = results
          .filter(
            (
              result
            ): result is PromiseFulfilledResult<RegionStyleCandidate> =>
              result.status === "fulfilled"
          )
          .map((result) => result.value);
        setRegionStylePreviews(candidates);
        if (candidates.length === 0) {
          setRegionSelectionMessage(
            `Selected: ${region.label}. Choose an option or describe the change.`
          );
          setRegionStylePreviewError(
            "Visual styles are unavailable right now. Choose a written option below."
          );
        } else {
          setRegionSelectionMessage(
            `Selected: ${region.label}. Choose a style or describe the change.`
          );
        }
        track("adventure_v2_region_styles_ready", {
          regionId: region.id,
          count: candidates.length,
          modelId: FAST_CONCEPT_MODEL_ID,
        });
      } catch {
        if (regionStyleRequestTokenRef.current === requestToken) {
          setRegionSelectionMessage(
            `Selected: ${region.label}. Choose an option or describe the change.`
          );
          setRegionStylePreviewError(
            "Visual styles are unavailable right now. Choose a written option below."
          );
        }
      } finally {
        if (regionStyleRequestTokenRef.current === requestToken) {
          setRegionStylePreviewsBusy(false);
        }
      }
    },
    [callCanvas, selectedService, snapshot, track]
  );

  const adoptFinishedVersion = useCallback(async () => {
    if (!selectedFinishedVersion || !snapshot || !profile) return false;
    if (
      !snapshot.lead.captured &&
      snapshot.successfulEditCount >= PRE_EMAIL_EDIT_LIMIT
    ) {
      openLeadGate("edit_limit");
      return false;
    }
    const nextCount = snapshot.successfulEditCount + 1;
    const candidate = selectedFinishedVersion;
    setSnapshot((previous) =>
      previous
        ? (() => {
            const nextHistory = [
              ...activeCanvasBranch(previous),
              {
                ...candidate.canvas,
                changeLabel: candidate.instruction.readableSummary,
                designInstruction: candidate.instruction,
              },
            ];
            return {
              ...previous,
              canvasHistory: nextHistory,
              activeCanvasIndex: nextHistory.length - 1,
              successfulEditCount: previous.successfulEditCount + 1,
              promptHistory: promptHistoryForCanvases(nextHistory),
              updatedAt: Date.now(),
            };
          })()
        : previous
    );
    setPrompt("");
    track(
      "adventure_v2_finished_version_applied",
      {
        versionId: candidate.instruction.versionId,
        directionId: candidate.instruction.directionId,
        editNumber: nextCount,
        mode: profile.mode,
        modelId: candidate.canvas.modelId,
      },
      candidate.canvas.predictionId || candidate.canvas.assetId
    );
    if (!snapshot.lead.captured && nextCount >= PRE_EMAIL_EDIT_LIMIT) {
      openLeadGate("edit_limit", nextCount);
    }
    return true;
  }, [
    openLeadGate,
    profile,
    selectedFinishedVersion,
    snapshot,
    track,
  ]);

  const clearRegionSelection = useCallback(() => {
    regionStyleRequestTokenRef.current += 1;
    setRegionDetectionBusy(false);
    setSelectedRegion(null);
    setSelectedRegionOptionId(null);
    setRegionSelectionPoint(null);
    setRegionHighlight(null);
    setRegionSelectionMessage(null);
    setRegionStylePreviews([]);
    setRegionStylePreviewsBusy(false);
    setRegionStylePreviewError(null);
  }, []);

  const detectRegionAtPoint = useCallback(
    async (event: React.MouseEvent<HTMLImageElement>) => {
      if (
        regionDetectionBusy ||
        !scopeExperience ||
        scopeExperience.supportedRegions.length === 0 ||
        !displayedCanvas ||
        !selectedService
      ) {
        return;
      }
      const image = canvasImageRef.current;
      const frame = imageFrameRef.current;
      if (!image || !frame || image.naturalWidth <= 0 || image.naturalHeight <= 0) {
        return;
      }
      const imageRect = image.getBoundingClientRect();
      const frameRect = frame.getBoundingClientRect();
      const scale = Math.min(
        imageRect.width / image.naturalWidth,
        imageRect.height / image.naturalHeight
      );
      const renderedWidth = image.naturalWidth * scale;
      const renderedHeight = image.naturalHeight * scale;
      const renderedLeft =
        imageRect.left + (imageRect.width - renderedWidth) / 2;
      const renderedTop =
        imageRect.top + (imageRect.height - renderedHeight) / 2;
      const localX = event.clientX - renderedLeft;
      const localY = event.clientY - renderedTop;
      if (
        localX < 0 ||
        localY < 0 ||
        localX > renderedWidth ||
        localY > renderedHeight
      ) {
        setRegionSelectionMessage(
          "Click directly on the visible image to select an area."
        );
        return;
      }
      const point: RegionSelectionPoint = {
        frameX: Math.max(
          0,
          Math.min(1, (event.clientX - frameRect.left) / frameRect.width)
        ),
        frameY: Math.max(
          0,
          Math.min(1, (event.clientY - frameRect.top) / frameRect.height)
        ),
        imageX: Math.max(0, Math.min(1, localX / renderedWidth)),
        imageY: Math.max(0, Math.min(1, localY / renderedHeight)),
        contentFrame: {
          left: (renderedLeft - frameRect.left) / frameRect.width,
          top: (renderedTop - frameRect.top) / frameRect.height,
          width: renderedWidth / frameRect.width,
          height: renderedHeight / frameRect.height,
        },
      };
      const selectDetectedRegion = (
        configuredRegion: RegionConfig,
        confidence: number,
        bounds: RegionMapEntry["bounds"] | null,
        source: "map" | "point"
      ) => {
        setSelectedRegion({ ...configuredRegion, confidence });
        const fallbackLeft = Math.max(0, point.frameX - 0.11);
        const fallbackTop = Math.max(0, point.frameY - 0.11);
        setRegionHighlight(
          bounds
            ? {
                left:
                  point.contentFrame.left +
                  bounds.x * point.contentFrame.width,
                top:
                  point.contentFrame.top +
                  bounds.y * point.contentFrame.height,
                width: Math.min(
                  bounds.width * point.contentFrame.width,
                  1 -
                    (point.contentFrame.left +
                      bounds.x * point.contentFrame.width)
                ),
                height: Math.min(
                  bounds.height * point.contentFrame.height,
                  1 -
                    (point.contentFrame.top +
                      bounds.y * point.contentFrame.height)
                ),
              }
            : {
                left: fallbackLeft,
                top: fallbackTop,
                width: Math.min(0.22, 1 - fallbackLeft),
                height: Math.min(0.22, 1 - fallbackTop),
              }
        );
        setRegionSelectionMessage(
          source === "map"
            ? `Selected: ${configuredRegion.label}. Preparing visual styles…`
            : `Selected: ${configuredRegion.label}. Preparing visual styles…`
        );
        track("adventure_v2_region_selected", {
          regionId: configuredRegion.id,
          regionLabel: configuredRegion.label,
          confidence,
          detectionSource: source,
        });
        void generateRegionStylePreviews(configuredRegion, displayedCanvas);
      };
      setRegionSelectionPoint(point);
      setRegionHighlight(null);
      setSelectedRegion(null);
      setSelectedRegionOptionId(null);
      regionStyleRequestTokenRef.current += 1;
      setRegionStylePreviews([]);
      setRegionStylePreviewsBusy(false);
      setRegionStylePreviewError(null);
      track("adventure_v2_region_selection_started", {
        scope: snapshot?.scope,
        supportedRegionCount: scopeExperience.supportedRegions.length,
      });
      const mappedRegion =
        regionMapAssetId === displayedCanvas.assetId
          ? regionAtPoint(regionMap, point.imageX, point.imageY)
          : null;
      const mappedConfig = mappedRegion
        ? scopeExperience.supportedRegions.find(
            (regionConfig) => regionConfig.id === mappedRegion.regionId
          )
        : null;
      if (mappedRegion && mappedConfig) {
        selectDetectedRegion(
          mappedConfig,
          mappedRegion.confidence,
          mappedRegion.bounds,
          "map"
        );
        return;
      }
      setRegionSelectionMessage("Identifying that area…");
      setRegionDetectionBusy(true);
      track("adventure_v2_region_detection_requested", {
        x: point.imageX,
        y: point.imageY,
        assetId: displayedCanvas.assetId,
      });
      try {
        const response = await fetch(
          `/api/v2/ai-form/${encodeURIComponent(instanceId)}/regions`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              imageUrl: displayedCanvas.imageUrl,
              serviceName: selectedService.label,
              scope: snapshot?.scope,
              point: { x: point.imageX, y: point.imageY },
              supportedRegions: scopeExperience.supportedRegions.map(
                ({ id, label, description }) => ({ id, label, description })
              ),
            }),
          }
        );
        const data = await response.json().catch(() => ({}));
        const detected = data?.region;
        const configuredRegion = scopeExperience.supportedRegions.find(
          (regionConfig) => regionConfig.id === detected?.id
        );
        if (!response.ok || !configuredRegion) {
          setRegionSelectionMessage(
            data?.message ||
              data?.error ||
              "We couldn’t isolate that area. Describe what you’d like changed."
          );
          track("adventure_v2_region_detection_failed", {
            assetId: displayedCanvas.assetId,
            reason: data?.error || data?.message || "no_supported_region",
          });
          return;
        }
        const confidence = Math.max(
          0,
          Math.min(1, Number(detected.confidence) || 0)
        );
        const rawBounds = detected?.bounds;
        const bounds =
          rawBounds &&
          Number.isFinite(Number(rawBounds.x)) &&
          Number.isFinite(Number(rawBounds.y)) &&
          Number.isFinite(Number(rawBounds.width)) &&
          Number.isFinite(Number(rawBounds.height))
            ? {
                x: Math.max(0, Math.min(1, Number(rawBounds.x))),
                y: Math.max(0, Math.min(1, Number(rawBounds.y))),
                width: Math.max(
                  0.08,
                  Math.min(1, Number(rawBounds.width))
                ),
                height: Math.max(
                  0.08,
                  Math.min(1, Number(rawBounds.height))
                ),
              }
            : null;
        selectDetectedRegion(configuredRegion, confidence, bounds, "point");
      } catch (regionError) {
        setRegionSelectionMessage(
          "We couldn’t isolate that area. Describe what you’d like changed."
        );
        track("adventure_v2_region_detection_failed", {
          assetId: displayedCanvas.assetId,
          reason:
            regionError instanceof Error
              ? regionError.message
              : "request_failed",
        });
      } finally {
        setRegionDetectionBusy(false);
      }
    },
    [
      displayedCanvas,
      generateRegionStylePreviews,
      instanceId,
      regionMap,
      regionMapAssetId,
      regionDetectionBusy,
      scopeExperience,
      selectedService,
      snapshot?.scope,
      track,
    ]
  );

  const applyPendingRefinement = useCallback(async () => {
    if (!scopeExperience) return;
    const customInstruction = prompt.trim();
    if (selectedRegion) {
      const requestedChange = [
        selectedRegionOption?.prompt || "",
        customInstruction,
      ]
        .filter(Boolean)
        .join(" ");
      if (!requestedChange) return;
      const instruction: StructuredDesignInstruction = {
        mode: "target_region",
        targetRegion: {
          id: selectedRegion.id,
          label: selectedRegion.label,
          confidence: selectedRegion.confidence,
        },
        optionId: selectedRegionOption?.id || null,
        optionLabel: selectedRegionOption?.label || null,
        affectedRegions: [selectedRegion.label],
        preserve: [
          ...scopeExperience.regionEditPreserveRules,
          ...(selectedRegion.preserve || []),
        ],
        customInstruction: customInstruction || null,
        readableSummary: [
          selectedRegion.label,
          selectedRegionOption?.label || customInstruction,
        ]
          .filter(Boolean)
          .join(" · "),
      };
      const succeeded = await applyEdit(
        requestedChange,
        instruction,
        selectedFinishedVersion?.canvas.imageUrl
      );
      if (succeeded) clearRegionSelection();
      return;
    }
    if (selectedFinishedVersion && !customInstruction) {
      await adoptFinishedVersion();
      return;
    }
    if (!customInstruction) return;
    const requestedChange = [
      customInstruction,
      ...scopeExperience.wholeDesignPreserveRules,
    ].join(" ");
    const instruction: StructuredDesignInstruction = {
      mode: "whole_design",
      directionId: selectedFinishedVersion?.instruction.directionId || null,
      directionLabel:
        selectedFinishedVersion?.instruction.directionLabel || null,
      versionId: selectedFinishedVersion?.instruction.versionId || null,
      style: selectedFinishedVersion?.instruction.style || null,
      materials: selectedFinishedVersion?.instruction.materials || [],
      colors: selectedFinishedVersion?.instruction.colors || [],
      fixtures: selectedFinishedVersion?.instruction.fixtures || [],
      affectedRegions:
        selectedFinishedVersion?.instruction.affectedRegions || [],
      preserve: scopeExperience.wholeDesignPreserveRules,
      customInstruction,
      readableSummary: customInstruction,
    };
    await applyEdit(
      requestedChange,
      instruction,
      selectedFinishedVersion?.canvas.imageUrl
    );
  }, [
    adoptFinishedVersion,
    applyEdit,
    clearRegionSelection,
    prompt,
    scopeExperience,
    selectedFinishedVersion,
    selectedRegion,
    selectedRegionOption,
  ]);

  const requestPricing = useCallback(async (): Promise<V2Pricing | null> => {
    if (!snapshot || !selectedService || !profile) return null;
    const changedRefinementKeys = snapshot.promptHistory.slice(-PRE_EMAIL_EDIT_LIMIT).map((label, index) => ({
      key: `design-revision-${index + 1}`,
      label,
    }));
    try {
      const response = await fetch(`/api/ai-form/${encodeURIComponent(instanceId)}/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: snapshot.sessionId,
          useCase:
            profile.mode === "placement"
              ? "scene-placement"
              : profile.mode === "scene" && snapshot.successfulEditCount > 0
                ? "scene-refinement"
                : profile.mode,
          stepDataSoFar: {
            "step-service-primary": selectedService.value,
            "step-scope-v2": snapshot.scope,
            "step-budget-v2": snapshot.budget,
            "step-design-revisions-v2": snapshot.promptHistory,
            "step-design-edit-count-v2": snapshot.successfulEditCount,
          },
          answeredQA: [
            { question: "Service", answer: selectedService.label },
            { question: "Scope", answer: snapshot.scope },
            { question: "Budget", answer: snapshot.budget },
            {
              question: "Design revisions",
              answer: snapshot.promptHistory.length > 0 ? snapshot.promptHistory.join("; ") : "Starter concept unchanged",
            },
          ],
          askedStepIds: [
            "step-service-primary",
            "step-scope-v2",
            "step-budget-v2",
            "step-design-revisions-v2",
          ],
          instanceContext: {
            service: { id: selectedService.value, name: selectedService.label },
            industry: selectedService.industryName ? { name: selectedService.industryName } : undefined,
            serviceSummary: selectedService.serviceSummary,
          },
          previewImageUrl: currentCanvas?.imageUrl,
          budgetRange: snapshot.budget,
          pricingScenario: snapshot.successfulEditCount > 0 ? "refinement" : "initial",
          changedRefinementKeys,
          noCache: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const estimate = data?.estimate || data;
      const totalMin = Number(estimate?.totalMin ?? estimate?.total_min);
      const totalMax = Number(estimate?.totalMax ?? estimate?.total_max);
      const source = typeof estimate?.source === "string" ? estimate.source.trim() : "pricing_service";
      const isFallback = /^(fallback|configured_preview)/i.test(source);
      if (!response.ok || isFallback || !Number.isFinite(totalMin) || !Number.isFinite(totalMax)) return null;
      return {
        totalMin: Math.min(totalMin, totalMax),
        totalMax: Math.max(totalMin, totalMax),
        currency: typeof estimate?.currency === "string" ? estimate.currency : fallbackPricing.currency,
        source,
      };
    } catch {
      return null;
    }
  }, [currentCanvas?.imageUrl, fallbackPricing, instanceId, profile, selectedService, snapshot]);

  const sendResultsEmail = useCallback(
    async (submissionId: string, pricing: V2Pricing): Promise<boolean> => {
      if (!snapshot || !selectedService) return false;
      try {
        const response = await fetch("/api/v2/leads/results-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId,
            instanceId,
            serviceName: selectedService.label,
            scope: snapshot.scope,
            canvasUrl: currentCanvas?.imageUrl,
            pricing,
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [currentCanvas?.imageUrl, instanceId, selectedService, snapshot]
  );

  const captureLead = useCallback(
    async (email: string, name: string) => {
      if (!snapshot || !selectedService || !profile || !currentCanvas) return;
      setLeadBusy(true);
      setLeadError(null);
      try {
        const response = await fetch("/api/v2/leads", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            instanceId,
            sessionId: snapshot.sessionId,
            email,
            name,
            submissionData: {
              experienceVersion: "v2",
              service: selectedService,
              scope: snapshot.scope,
              budget: snapshot.budget,
              experienceMode: profile.mode,
              capabilityKeys: profile.capabilityKeys,
              resolvedModules: profile.modules.map((module) => module.key),
              successfulEditCount: snapshot.successfulEditCount,
              promptHistory: snapshot.promptHistory,
              canvasHistory: snapshot.canvasHistory.slice(0, activeCanvasIndex + 1),
              finalCanvas: currentCanvas,
            },
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.submissionId) throw new Error(data?.error || "Unable to save your results.");
        const submissionId = String(data.submissionId);
        setSnapshot((previous) =>
          previous
            ? {
                ...previous,
                lead: {
                  captured: true,
                  submissionId,
                  email,
                  emailStatus: "idle",
                  pricingStatus: "calculating",
                },
                pricing: null,
                updatedAt: Date.now(),
              }
            : previous
        );
        setLeadOpen(false);
        track("adventure_v2_lead_captured", { submissionId, editCount: snapshot.successfulEditCount }, submissionId);

        void (async () => {
          const pricing = await requestPricing();
          if (!pricing) {
            setSnapshot((previous) =>
              previous
                ? {
                    ...previous,
                    pricing: null,
                    lead: { ...previous.lead, pricingStatus: "failed", emailStatus: "idle" },
                    updatedAt: Date.now(),
                  }
                : previous
            );
            track("adventure_v2_pricing_failed", { submissionId }, submissionId);
            return;
          }
          setSnapshot((previous) =>
            previous
              ? {
                  ...previous,
                  pricing,
                  lead: { ...previous.lead, pricingStatus: "ready", emailStatus: "sending" },
                  updatedAt: Date.now(),
                }
              : previous
          );
          track("adventure_v2_pricing_revealed", { submissionId, pricingSource: pricing.source }, submissionId);
          const sent = await sendResultsEmail(submissionId, pricing);
          setSnapshot((previous) =>
            previous
              ? {
                  ...previous,
                  lead: { ...previous.lead, emailStatus: sent ? "sent" : "failed" },
                  updatedAt: Date.now(),
                }
              : previous
          );
          track(
            sent ? "adventure_v2_results_email_sent" : "adventure_v2_results_email_failed",
            { submissionId },
            submissionId
          );
        })();
      } catch (captureError) {
        setLeadError(captureError instanceof Error ? captureError.message : "Unable to save your results.");
      } finally {
        setLeadBusy(false);
      }
    },
    [
      currentCanvas,
      activeCanvasIndex,
      instanceId,
      profile,
      requestPricing,
      selectedService,
      sendResultsEmail,
      snapshot,
      track,
    ]
  );

  const retryResultsEmail = useCallback(async () => {
    const submissionId = snapshot?.lead.submissionId;
    const pricing = snapshot?.pricing;
    if (!submissionId || !pricing) return;
    setEmailRetryBusy(true);
    setSnapshot((previous) =>
      previous
        ? { ...previous, lead: { ...previous.lead, emailStatus: "sending" }, updatedAt: Date.now() }
        : previous
    );
    const sent = await sendResultsEmail(submissionId, pricing);
    setSnapshot((previous) =>
      previous
        ? {
            ...previous,
            lead: { ...previous.lead, emailStatus: sent ? "sent" : "failed" },
            updatedAt: Date.now(),
          }
        : previous
    );
    setEmailRetryBusy(false);
    track(
      sent ? "adventure_v2_results_email_sent" : "adventure_v2_results_email_failed",
      { submissionId, retry: true },
      submissionId
    );
  }, [sendResultsEmail, snapshot?.lead.submissionId, snapshot?.pricing, track]);

  const retryPricing = useCallback(async () => {
    const submissionId = snapshot?.lead.submissionId;
    if (!submissionId) return;
    setSnapshot((previous) =>
      previous
        ? {
            ...previous,
            pricing: null,
            lead: { ...previous.lead, pricingStatus: "calculating", emailStatus: "idle" },
            updatedAt: Date.now(),
          }
        : previous
    );
    const pricing = await requestPricing();
    if (!pricing) {
      setSnapshot((previous) =>
        previous
          ? {
              ...previous,
              lead: { ...previous.lead, pricingStatus: "failed", emailStatus: "idle" },
              updatedAt: Date.now(),
            }
          : previous
      );
      track("adventure_v2_pricing_failed", { submissionId, retry: true }, submissionId);
      return;
    }
    setSnapshot((previous) =>
      previous
        ? {
            ...previous,
            pricing,
            lead: { ...previous.lead, pricingStatus: "ready", emailStatus: "sending" },
            updatedAt: Date.now(),
          }
        : previous
    );
    track(
      "adventure_v2_pricing_revealed",
      { submissionId, pricingSource: pricing.source, retry: true },
      submissionId
    );
    const sent = await sendResultsEmail(submissionId, pricing);
    setSnapshot((previous) =>
      previous
        ? {
            ...previous,
            lead: { ...previous.lead, emailStatus: sent ? "sent" : "failed" },
            updatedAt: Date.now(),
          }
        : previous
    );
  }, [requestPricing, sendResultsEmail, snapshot?.lead.submissionId, track]);

  const restart = useCallback(() => {
    resetExperience("in_form");
  }, [resetExperience]);

  const goBack = useCallback(() => {
    if (!snapshot) return;
    if (snapshot.stage === "scope") patchSnapshot({ stage: services.length > 1 ? "service" : "scope" });
    if (snapshot.stage === "budget") patchSnapshot({ stage: "scope" });
    if (snapshot.stage === "inputs") patchSnapshot({ stage: "budget" });
  }, [patchSnapshot, services.length, snapshot]);

  const goToCanvasRevision = useCallback(
    (requestedIndex: number) => {
      if (!snapshot || snapshot.canvasHistory.length <= 1 || busyMessage) return;
      const nextIndex = Math.min(
        Math.max(0, requestedIndex),
        snapshot.canvasHistory.length - 1
      );
      if (nextIndex === activeCanvasIndex) return;
      setSnapshot((previous) => {
        if (!previous) return previous;
        const safeIndex = Math.min(
          Math.max(0, nextIndex),
          previous.canvasHistory.length - 1
        );
        return {
          ...previous,
          activeCanvasIndex: safeIndex,
          promptHistory: promptHistoryForCanvases(
            previous.canvasHistory.slice(0, safeIndex + 1)
          ),
          updatedAt: Date.now(),
        };
      });
      track("adventure_v2_revision_navigated", {
        fromRevision: activeCanvasIndex + 1,
        toRevision: nextIndex + 1,
        totalRevisions: snapshot.canvasHistory.length,
      });
    },
    [activeCanvasIndex, busyMessage, snapshot, track]
  );

  const viewCanvasFullscreen = useCallback(async () => {
    if (!snapshot?.lead.captured || !currentCanvas || !imageFrameRef.current) return;
    setError(null);
    try {
      const frame = imageFrameRef.current as HTMLDivElement & {
        webkitRequestFullscreen?: () => Promise<void> | void;
      };
      if (typeof frame.requestFullscreen === "function") {
        await frame.requestFullscreen();
      } else if (typeof frame.webkitRequestFullscreen === "function") {
        await frame.webkitRequestFullscreen();
      } else {
        window.open(currentCanvas.imageUrl, "_blank", "noopener,noreferrer");
      }
      track("adventure_v2_canvas_fullscreen_opened", {
        assetId: currentCanvas.assetId,
        revision: activeCanvasIndex + 1,
      });
    } catch (fullscreenError) {
      setError(
        fullscreenError instanceof Error
          ? fullscreenError.message
          : "Unable to open the design full screen."
      );
    }
  }, [activeCanvasIndex, currentCanvas, snapshot?.lead.captured, track]);

  const downloadCurrentCanvas = useCallback(async () => {
    if (!snapshot?.lead.captured || !currentCanvas || downloadBusy) return;
    setDownloadBusy(true);
    setError(null);
    try {
      const response = await fetch(currentCanvas.imageUrl, {
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Unable to download this design.");
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const fileBase = String(selectedService?.label || "project-design")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "project-design";
      link.href = objectUrl;
      link.download = `${fileBase}-revision-${activeCanvasIndex + 1}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      track("adventure_v2_canvas_downloaded", {
        assetId: currentCanvas.assetId,
        revision: activeCanvasIndex + 1,
      });
    } catch (downloadError) {
      setError(
        downloadError instanceof Error
          ? downloadError.message
          : "Unable to download this design."
      );
    } finally {
      setDownloadBusy(false);
    }
  }, [
    activeCanvasIndex,
    currentCanvas,
    downloadBusy,
    selectedService?.label,
    snapshot?.lead.captured,
    track,
  ]);

  const background = design.background_color || "#f3f1ec";
  const accent = design.primary_color || design.submit_button_background_color || "#172033";
  const textColor = design.prompt_text_color || design.brand_name_color || "#172033";
  const rootStyle = {
    "--v2-accent": accent,
    "--v2-text": textColor,
    "--v2-radius": `${Math.max(8, Number(design.border_radius || 18))}px`,
    backgroundColor: background,
    backgroundImage: design.background_gradient || undefined,
    fontFamily: design.font_family || "Inter, sans-serif",
  } as React.CSSProperties;

  if (!snapshot || snapshot.stage === "loading") {
    return (
      <div ref={rootRef} className={styles.root} style={rootStyle} data-adventure-version="v2">
        <div className={styles.loadingState}><LoaderCircle className={styles.spin} /> Loading your experience…</div>
      </div>
    );
  }

  const budgetValue =
    snapshot.budget ??
    Math.round((pricingBounds.min + (pricingBounds.max - pricingBounds.min) * 0.35) / pricingBounds.step) *
      pricingBounds.step;
  const editsUntilPricingUnlock = Math.max(0, MINIMUM_PRICING_EDITS - snapshot.successfulEditCount);
  const editsRemainingBeforeEmail = Math.max(0, PRE_EMAIL_EDIT_LIMIT - snapshot.successfulEditCount);
  const pricingUnlockAvailable = snapshot.successfulEditCount >= MINIMUM_PRICING_EDITS;
  const atPreEmailEditLimit = !snapshot.lead.captured && editsRemainingBeforeEmail === 0;
  const preCanvasStage = snapshot.stage !== "canvas";
  const stageOrder: V2Stage[] =
    profile?.mode === "scene"
      ? ["service", "scope", "budget"]
      : ["service", "scope", "budget", "inputs"];
  const progressStage =
    profile?.mode === "scene" && snapshot.stage === "inputs"
      ? "budget"
      : snapshot.stage;
  const progressIndex = Math.max(0, stageOrder.indexOf(progressStage));
  const interactionBusy =
    Boolean(busyMessage) || regionDetectionBusy;
  const canApplyRefinement = selectedFinishedVersion
    ? true
    : selectedRegion
      ? Boolean(selectedRegionOption || prompt.trim())
      : Boolean(prompt.trim());
  const regionPanelActive = Boolean(
    selectedRegion ||
      regionDetectionBusy ||
      regionSelectionPoint ||
      regionSelectionMessage
  );
  const uploadsReady =
    profile?.mode === "tryon"
      ? Boolean(snapshot.sourceAssets.person && snapshot.sourceAssets.product)
      : profile?.mode === "placement"
        ? Boolean(snapshot.sourceAssets.scene && snapshot.sourceAssets.product)
        : true;
  const canvasUsesUploadedPhoto =
    profile?.mode === "tryon"
      ? Boolean(snapshot.sourceAssets.person)
      : profile?.mode === "placement"
        ? Boolean(snapshot.sourceAssets.scene)
        : snapshot.canvasHistory.some((entry) => entry.sourceType === "uploaded");

  return (
    <div ref={rootRef} className={styles.root} style={rootStyle} data-adventure-version="v2">
      <BrandHeader config={design} compact />

      {preCanvasStage ? (
        <main className={styles.stepShell}>
          <div className={styles.stepTopbar}>
            {snapshot.stage !== "service" && !(snapshot.stage === "scope" && services.length <= 1) ? (
              <button type="button" className={styles.iconButton} onClick={goBack} aria-label="Go back">
                <ArrowLeft size={18} />
              </button>
            ) : <span />}
            <div
              className={styles.progress}
              aria-label={`Step ${progressIndex + 1} of ${stageOrder.length}`}
            >
              {stageOrder.map((_, item) => (
                <span key={item} className={item <= progressIndex ? styles.progressActive : ""} />
              ))}
            </div>
            <button type="button" className={styles.restartButton} onClick={restart}>
              <RotateCcw size={14} /> Start over
            </button>
          </div>

          {snapshot.stage === "service" ? (
            <section className={styles.stepContent}>
              <div className={styles.eyebrow}>Choose a service</div>
              <h1>What would you like to visualize?</h1>
              <p>We’ll build the next steps and starter canvas around this service.</p>
              <div className={styles.choiceGrid}>
                {services.map((service) => (
                  <button key={service.value} type="button" className={styles.choiceCard} onClick={() => chooseService(service)}>
                    <span>{service.label}</span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {snapshot.stage === "scope" && profile ? (
            <section className={styles.stepContent}>
              <div className={styles.eyebrow}>{selectedService?.label}</div>
              <h1>Which part should we focus on?</h1>
              <p>Your scope guides the suggestions, revisions, and estimate.</p>
              <div className={styles.choiceGrid}>
                {profile.scopeOptions.map((scope) => (
                  <button key={scope} type="button" className={styles.choiceCard} onClick={() => chooseScope(scope)}>
                    <span>{scope}</span>
                    <ArrowRight size={18} />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          {snapshot.stage === "budget" ? (
            <section className={styles.stepContent}>
              <div className={styles.eyebrow}>{snapshot.scope}</div>
              <h1>What budget are you working with?</h1>
              <p>This keeps the starter direction and later pricing grounded in a realistic range.</p>
              <div className={styles.budgetCard}>
                <strong>{formatCurrency(budgetValue, pricingBounds.currency)}</strong>
                <input
                  type="range"
                  min={pricingBounds.min}
                  max={pricingBounds.max}
                  step={pricingBounds.step}
                  value={budgetValue}
                  onChange={(event) => patchSnapshot({ budget: Number(event.target.value) })}
                  aria-label="Project budget"
                />
                <div><span>{formatCurrency(pricingBounds.min, pricingBounds.currency)}</span><span>{formatCurrency(pricingBounds.max, pricingBounds.currency)}</span></div>
              </div>
              <button type="button" className={styles.primaryButton} onClick={continueBudget}>
                Continue <ArrowRight size={17} />
              </button>
            </section>
          ) : null}

          {snapshot.stage === "inputs" && profile?.mode === "scene" ? (
            <section className={styles.stepContent}>
              <div className={styles.loadingState}>
                <LoaderCircle className={styles.spin} />
                Opening a plain sample space…
              </div>
              {error ? <div className={styles.errorBanner}>{error}</div> : null}
            </section>
          ) : null}

          {snapshot.stage === "inputs" && profile && profile.mode !== "scene" ? (
            <section className={styles.stepContent}>
              <div className={styles.eyebrow}>{selectedService?.label} · {snapshot.scope}</div>
              <h1>
                {profile.mode === "tryon"
                    ? "Add the person and product photos"
                    : "Add the scene and product photos"}
              </h1>
              <p>These photos are required so the result stays grounded in the real person, product, and scene.</p>
              <div className={styles.uploadGrid}>
                {profile.mode !== "tryon" ? (
                  <UploadCard
                    kind="scene"
                    title={profile.mode === "placement" ? "Scene photo" : "Your current photo"}
                    description={profile.mode === "placement" ? "The place where the product should appear." : "The space or area you want to change."}
                    asset={snapshot.sourceAssets.scene}
                    busy={uploadBusy === "scene"}
                    required={profile.mode === "placement"}
                    onUpload={uploadAsset}
                  />
                ) : null}
                {profile.mode === "tryon" ? (
                  <UploadCard
                    kind="person"
                    title="Person photo"
                    description="A clear photo of the person who will try the item."
                    asset={snapshot.sourceAssets.person}
                    busy={uploadBusy === "person"}
                    required
                    onUpload={uploadAsset}
                  />
                ) : null}
                <UploadCard
                  kind="product"
                  title="Product photo"
                  description="A clear image of the exact product to use."
                  asset={snapshot.sourceAssets.product}
                  busy={uploadBusy === "product"}
                  required
                  onUpload={uploadAsset}
                />
              </div>
              {error ? <div className={styles.errorBanner}>{error}</div> : null}
              <div className={styles.inputActions}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={generateStarter}
                  disabled={Boolean(busyMessage) || !uploadsReady}
                >
                  {busyMessage ? <LoaderCircle className={styles.spin} size={17} /> : <Sparkles size={17} />}
                  {`Create ${modeLabel(profile.mode)} starter`}
                </button>
              </div>
            </section>
          ) : null}
        </main>
      ) : null}

      {snapshot.stage === "canvas" && profile && currentCanvas ? (
        <main className={styles.canvasShell}>
          <header className={styles.canvasHeader}>
            <div>
              <div className={styles.eyebrow}>{selectedService?.label} · {snapshot.scope}</div>
              <h1>Refine it until it feels right.</h1>
              <p>
                {canvasUsesUploadedPhoto
                  ? "This design uses your photo. Try a suggestion or describe any change."
                  : "This is an intentionally plain sample space—let’s start styling it. Upload your photo anytime to use your real space."}
              </p>
            </div>
            <button type="button" className={styles.restartButton} onClick={restart}>
              <RotateCcw size={14} /> New project
            </button>
          </header>

          <div className={styles.canvasGrid}>
            <section className={styles.imagePanel}>
              <div
                ref={imageFrameRef}
                className={`${styles.imageFrame} ${
                  scopeExperience?.supportedRegions.length
                    ? styles.imageFrameDirectSelect
                    : ""
                }`}
              >
                <img
                  ref={canvasImageRef}
                  src={displayedCanvas?.imageUrl || currentCanvas.imageUrl}
                  alt={`Current ${selectedService?.label || "project"} concept`}
                  onClick={detectRegionAtPoint}
                  aria-label="Current design. Click or tap an area to change it."
                />
                {regionDetectionBusy ? (
                  <div className={styles.selectionModeBadge}>
                    <LoaderCircle className={styles.spin} size={14} />
                    Identifying area…
                  </div>
                ) : null}
                {selectedRegion && regionHighlight ? (
                  <div
                    className={styles.regionHighlight}
                    style={{
                      left: `${regionHighlight.left * 100}%`,
                      top: `${regionHighlight.top * 100}%`,
                      width: `${regionHighlight.width * 100}%`,
                      height: `${regionHighlight.height * 100}%`,
                    }}
                    aria-hidden="true"
                  >
                    <strong>{selectedRegion.label}</strong>
                  </div>
                ) : regionSelectionPoint ? (
                  <div
                    className={styles.regionMarker}
                    style={{
                      left: `${regionSelectionPoint.frameX * 100}%`,
                      top: `${regionSelectionPoint.frameY * 100}%`,
                    }}
                    aria-hidden="true"
                  >
                    <span />
                  </div>
                ) : null}
                {!regionPanelActive &&
                scopeExperience?.supportedRegions.length ? (
                  <>
                    <div className={styles.imageHoverHint}>
                      <MousePointer2 size={13} /> Click any area to change it
                    </div>
                    <div className={styles.imageTapHint}>
                      <MousePointer2 size={13} /> Tap an area to change it
                    </div>
                  </>
                ) : null}
                {selectedFinishedVersion ? (
                  <div className={styles.conceptPreviewBadge}>
                    Previewing {selectedFinishedVersion.title}
                  </div>
                ) : null}
                {busyMessage ? (
                  <div className={styles.generatingOverlay}>
                    <LoaderCircle className={styles.spin} size={28} />
                    <strong>{busyMessage}</strong>
                    <span>Keeping the rest of your canvas consistent</span>
                  </div>
                ) : null}
              </div>
              {scopeExperience?.supportsFinishedVersions &&
              snapshot.successfulEditCount === 0 &&
              currentCanvas.sourceType === "generated" ? (
                <div className={styles.conceptRail}>
                  <div className={styles.conceptRailHeader}>
                    <div>
                      <Images size={14} />
                      <span>Premade concepts</span>
                    </div>
                    <small>
                      {finishedVersionsBusy
                        ? "Preparing 6 quick options…"
                        : "Choose one to preview"}
                    </small>
                  </div>
                  <div className={styles.conceptRailScroller}>
                    {finishedVersionsBusy
                      ? Array.from({ length: AUTO_CONCEPT_COUNT }, (_, index) => (
                          <div
                            key={`concept-loading-${index}`}
                            className={styles.conceptSkeleton}
                            aria-hidden="true"
                          />
                        ))
                      : finishedVersions.map((version) => (
                          <button
                            key={version.id}
                            type="button"
                            className={styles.conceptThumbnail}
                            data-selected={
                              selectedFinishedVersionId === version.id
                                ? "true"
                                : "false"
                            }
                            onClick={() => {
                              clearRegionSelection();
                              setSelectedFinishedVersionId((current) =>
                                current === version.id ? null : version.id
                              );
                            }}
                          >
                            <img
                              src={version.canvas.imageUrl}
                              alt={`${version.title}: ${version.summary}`}
                            />
                            <span>{version.title}</span>
                            <i aria-hidden="true">
                              <Check size={12} />
                            </i>
                          </button>
                        ))}
                    {conceptGenerationError && !finishedVersionsBusy ? (
                      <button
                        type="button"
                        className={styles.conceptRetryButton}
                        onClick={() => {
                          conceptGenerationKeyRef.current = null;
                          void generatePremadeConcepts();
                        }}
                      >
                        <RotateCcw size={14} />
                        Try concepts again
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : null}
              <div className={styles.canvasMeta}>
                <div className={styles.canvasMetaSource}>
                  <span>
                    {selectedFinishedVersion
                      ? "Concept preview"
                      : canvasUsesUploadedPhoto
                        ? "Based on your photo"
                        : "AI starter"}
                  </span>
                  <input
                    ref={canvasUploadRef}
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (file) void replaceCanvasWithUpload(file);
                      event.currentTarget.value = "";
                    }}
                  />
                  <button
                    type="button"
                    className={styles.canvasUploadButton}
                    onClick={() => canvasUploadRef.current?.click()}
                    disabled={Boolean(busyMessage) || uploadBusy !== null}
                  >
                    {uploadBusy !== null ? (
                      <LoaderCircle className={styles.spin} size={13} />
                    ) : (
                      <ImagePlus size={13} />
                    )}
                    {canvasUsesUploadedPhoto ? "Replace photo" : "Upload your photo"}
                  </button>
                </div>
                <div className={styles.canvasMetaActions}>
                  {snapshot.canvasHistory.length > 1 ? (
                    <div className={styles.revisionNav} aria-label="Design revision history">
                      <button
                        type="button"
                        onClick={() => goToCanvasRevision(activeCanvasIndex - 1)}
                        disabled={activeCanvasIndex <= 0 || Boolean(busyMessage)}
                        aria-label="Undo to previous design version"
                        title="Undo to previous version"
                      >
                        <ChevronLeft size={14} />
                      </button>
                      <span>
                        {activeCanvasIndex === snapshot.canvasHistory.length - 1
                          ? "Current"
                          : `Version ${activeCanvasIndex + 1} of ${snapshot.canvasHistory.length}`}
                        {" · "}
                        {snapshot.successfulEditCount} {snapshot.successfulEditCount === 1 ? "edit" : "edits"}
                      </span>
                      <button
                        type="button"
                        onClick={() => goToCanvasRevision(activeCanvasIndex + 1)}
                        disabled={
                          activeCanvasIndex >= snapshot.canvasHistory.length - 1 ||
                          Boolean(busyMessage)
                        }
                        aria-label="Redo next design version"
                        title="Redo next version"
                      >
                        <ChevronRight size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className={styles.canvasReadyLabel}>Ready to edit</span>
                  )}
                  {snapshot.lead.captured ? (
                    <div className={styles.unlockedCanvasTools}>
                      <button
                        type="button"
                        onClick={viewCanvasFullscreen}
                        disabled={Boolean(busyMessage)}
                        aria-label="View design full screen"
                        title="View full screen"
                      >
                        <Maximize2 size={13} />
                        Full screen
                      </button>
                      <button
                        type="button"
                        onClick={downloadCurrentCanvas}
                        disabled={Boolean(busyMessage) || downloadBusy}
                        aria-label="Download design"
                        title="Download design"
                      >
                        {downloadBusy ? (
                          <LoaderCircle className={styles.spin} size={13} />
                        ) : (
                          <Download size={13} />
                        )}
                        Download
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <aside className={styles.editorPanel}>
              <section className={styles.projectSummary} data-pricing-revealed={snapshot.lead.captured ? "true" : "false"}>
                <div className={styles.budgetSummary}>
                  <span>Budget <Check size={11} aria-label="Saved" /></span>
                  <strong>{formatCurrency(snapshot.budget || budgetValue, pricingBounds.currency)}</strong>
                </div>
                <span className={styles.summaryDivider} aria-hidden="true" />
                <div className={styles.priceSummary}>
                  {snapshot.lead.captured ? (
                    personalizedPricing ? (
                      <>
                        <span>Estimated range</span>
                        <strong>
                          {formatCurrency(personalizedPricing.totalMin, personalizedPricing.currency)}
                          {" – "}
                          {formatCurrency(personalizedPricing.totalMax, personalizedPricing.currency)}
                        </strong>
                        <small>
                          {snapshot.lead.emailStatus === "sent"
                            ? `Sent to ${snapshot.lead.email}`
                            : snapshot.lead.emailStatus === "failed"
                              ? "Unlocked · email can be retried"
                              : "Unlocked · preparing email…"}
                        </small>
                        {snapshot.lead.emailStatus === "failed" ? (
                          <button
                            type="button"
                            className={styles.emailRetryButton}
                            disabled={emailRetryBusy}
                            onClick={retryResultsEmail}
                          >
                            {emailRetryBusy ? <LoaderCircle className={styles.spin} size={13} /> : <Mail size={13} />}
                            Retry email
                          </button>
                        ) : null}
                      </>
                    ) : snapshot.lead.pricingStatus === "failed" ||
                      (!snapshot.lead.pricingStatus && snapshot.lead.emailStatus !== "sending") ? (
                      <>
                        <span>Personalized estimate</span>
                        <strong className={styles.pricePending}>Estimate unavailable</strong>
                        <small>No placeholder price was shown</small>
                        <button
                          type="button"
                          className={styles.emailRetryButton}
                          onClick={retryPricing}
                        >
                          <RotateCcw size={13} />
                          Try again
                        </button>
                      </>
                    ) : (
                      <div className={styles.pricingCalculation} role="status" aria-live="polite">
                        <span>Personalized estimate</span>
                        <strong className={styles.pricePending}>
                          <LoaderCircle className={styles.spin} size={14} />
                          Calculating…
                        </strong>
                        <small>Reviewing your final design and revisions</small>
                      </div>
                    )
                  ) : (
                    <>
                      {pricingUnlockAvailable ? (
                        <>
                          <span>Price estimate</span>
                          <div className={styles.lockedPrice}>
                            <strong className={styles.blurredPrice} aria-hidden="true">
                              {formatCurrency(fallbackPricing.totalMin, fallbackPricing.currency)}
                              {" – "}
                              {formatCurrency(fallbackPricing.totalMax, fallbackPricing.currency)}
                            </strong>
                            <Lock size={14} aria-hidden="true" />
                            <span className={styles.srOnly}>Price hidden until email is provided</span>
                          </div>
                          <button
                            type="button"
                            className={styles.revealPriceButton}
                            onClick={() => openLeadGate(atPreEmailEditLimit ? "edit_limit" : "pricing")}
                          >
                            {atPreEmailEditLimit ? "Unlock & keep editing" : "Reveal with email"}
                          </button>
                        </>
                      ) : (
                        <>
                          <span>Estimate status</span>
                          <strong className={styles.pricePending}>Not ready yet</strong>
                          <small>
                            {editsUntilPricingUnlock} design {editsUntilPricingUnlock === 1 ? "edit" : "edits"} needed
                          </small>
                        </>
                      )}
                    </>
                  )}
                </div>
              </section>

              <section ref={refinementPanelRef} className={styles.refinementPanel}>
                {regionPanelActive ? (
                  <div className={styles.regionEditor}>
                    <div className={styles.regionEditorHeader}>
                      <div>
                        <small>Change one part</small>
                        <span>
                          {selectedRegion
                            ? `Editing: ${selectedRegion.label}`
                            : "Select an area in the image"}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={clearRegionSelection}
                        aria-label="Return to whole-design controls"
                      >
                        <X size={15} />
                      </button>
                    </div>
                    <div
                      className={styles.regionStatus}
                      data-confirmed={selectedRegion ? "true" : "false"}
                      role="status"
                      aria-live="polite"
                    >
                      {regionDetectionBusy ? (
                        <LoaderCircle className={styles.spin} size={14} />
                      ) : selectedRegion ? (
                        <Check size={14} />
                      ) : (
                        <MousePointer2 size={14} />
                      )}
                      <span>
                        {regionSelectionMessage ||
                          "Click the part of the image you want to change."}
                      </span>
                    </div>
                    {selectedRegion ? (
                      <>
                        <div className={styles.regionStyleSection}>
                          <div className={styles.regionStyleHeading}>
                            <span>Style the {selectedRegion.label.toLowerCase()}</span>
                            <small>
                              {regionStylePreviewsBusy
                                ? "Preparing quick visual options…"
                                : "Choose one, then update"}
                            </small>
                          </div>
                          <div className={styles.regionStyleGrid}>
                            {regionStylePreviewsBusy
                              ? Array.from(
                                  {
                                    length: Math.min(
                                      REGION_STYLE_PREVIEW_COUNT,
                                      selectedRegion.options.length
                                    ),
                                  },
                                  (_, index) => (
                                    <div
                                      key={`region-style-loading-${index}`}
                                      className={styles.regionStyleSkeleton}
                                      aria-hidden="true"
                                    />
                                  )
                                )
                              : regionStylePreviews.map((candidate) => (
                                  <button
                                    key={candidate.id}
                                    type="button"
                                    data-selected={
                                      selectedRegionOptionId ===
                                      candidate.optionId
                                        ? "true"
                                        : "false"
                                    }
                                    onClick={() =>
                                      setSelectedRegionOptionId((current) =>
                                        current === candidate.optionId
                                          ? null
                                          : candidate.optionId
                                      )
                                    }
                                    disabled={interactionBusy}
                                  >
                                    <img
                                      src={candidate.canvas.imageUrl}
                                      alt={`${candidate.title} style for ${selectedRegion.label}`}
                                    />
                                    <span>{candidate.title}</span>
                                    <i aria-hidden="true">
                                      <Check size={12} />
                                    </i>
                                  </button>
                                ))}
                          </div>
                          {regionStylePreviewError ? (
                            <p className={styles.regionStyleError}>
                              {regionStylePreviewError}
                            </p>
                          ) : null}
                        </div>
                        {!regionStylePreviewsBusy &&
                        regionStylePreviews.length === 0 ? (
                          <div className={styles.contextOptionGrid}>
                            {selectedRegion.options.map((option) => (
                              <button
                                key={option.id}
                                type="button"
                                data-selected={
                                  selectedRegionOptionId === option.id
                                    ? "true"
                                    : "false"
                                }
                                onClick={() =>
                                  setSelectedRegionOptionId((current) =>
                                    current === option.id ? null : option.id
                                  )
                                }
                                disabled={interactionBusy}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        <p className={styles.selectAgainHint}>
                          Click or tap another image area to switch the selection.
                        </p>
                      </>
                    ) : null}
                    <div className={styles.promptComposer}>
                      <label htmlFor="v2-region-change-prompt">
                        Describe a change for this item
                      </label>
                      <textarea
                        id="v2-region-change-prompt"
                        aria-label="Describe another change to the selected area"
                        value={prompt}
                        maxLength={800}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={
                          selectedRegion
                            ? `Describe another change to the ${selectedRegion.label.toLowerCase()}…`
                            : "Describe what you’d like changed…"
                        }
                      />
                      <button
                        type="button"
                        className={styles.applyPromptButton}
                        onClick={applyPendingRefinement}
                        disabled={!canApplyRefinement || interactionBusy}
                      >
                        <WandSparkles size={16} />
                        {selectedRegion
                          ? `Update ${selectedRegion.label.toLowerCase()}`
                          : "Update design"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className={styles.panelHeading}>
                      <div>
                        <span>Refine this concept</span>
                        <small>
                          Click the image to change one part, or describe a change.
                        </small>
                      </div>
                    </div>

                    {selectedFinishedVersion ? (
                      <div className={styles.selectedConceptSummary}>
                        <img
                          src={selectedFinishedVersion.canvas.imageUrl}
                          alt=""
                        />
                        <div>
                          <small>Previewing concept</small>
                          <strong>{selectedFinishedVersion.title}</strong>
                          <span>
                            Use it as-is, or add another instruction below.
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedFinishedVersionId(null)}
                          aria-label="Return to the starter concept"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <div className={styles.directSelectNote}>
                        <MousePointer2 size={14} />
                        <span>
                          <strong>Want to change one thing?</strong>
                          Click or tap it directly in the image.
                        </span>
                      </div>
                    )}

                    <div className={styles.promptComposer}>
                      <label htmlFor="v2-change-prompt">
                        Describe another change
                      </label>
                      <textarea
                        id="v2-change-prompt"
                        aria-label="Describe your own change"
                        value={prompt}
                        maxLength={800}
                        onChange={(event) => setPrompt(event.target.value)}
                        placeholder={`Describe another change to your ${snapshot.scope?.toLowerCase() || selectedService?.label?.toLowerCase() || "design"}…`}
                      />
                      <button
                        type="button"
                        className={styles.applyPromptButton}
                        onClick={applyPendingRefinement}
                        disabled={!canApplyRefinement || interactionBusy}
                      >
                        <WandSparkles size={16} />
                        {selectedFinishedVersion
                          ? prompt.trim()
                            ? "Update this concept"
                            : "Use this concept"
                          : "Update design"}
                      </button>
                    </div>
                  </>
                )}
              </section>

              {error ? <div className={styles.errorBanner}>{error}</div> : null}
            </aside>
          </div>
        </main>
      ) : null}

      <LeadGate
        open={leadOpen}
        busy={leadBusy}
        error={leadError}
        reason={leadReason}
        onClose={() => setLeadOpen(false)}
        onSubmit={captureLead}
      />
    </div>
  );
}
