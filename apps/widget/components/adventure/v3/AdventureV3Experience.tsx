"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Download,
  Expand,
  Image as ImageIcon,
  ImagePlus,
  LoaderCircle,
  Mail,
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

import { resolveServiceProfile } from "../v2/capabilities";
import type {
  CanvasHistoryEntry,
  ResolvedServiceProfile,
  ServiceOption,
  StableAsset,
  StarterCanvas,
  V2Pricing,
} from "../v2/types";
import {
  calculatePlanningRange,
  configuredPricingBounds,
  generalServiceRange,
} from "./pricing";
import {
  clearV3Snapshot,
  getOrCreateV3SessionId,
  loadV3Snapshot,
  saveV3Snapshot,
} from "./storage";
import styles from "./adventure-v3.module.css";
import type {
  AdventureV3Snapshot,
  StartingRoomMethod,
  V3ExampleRoom,
  V3PlanningRange,
  V3Stage,
  V3StyleDirection,
} from "./types";

type Props = {
  instanceId: string;
  initialInstanceData?: any;
  initialDesignConfig?: DesignSettings;
};

const CONCEPT_COUNT = 4;
const CONCEPT_MODEL_ID = "black-forest-labs/flux-2-pro";

const STYLE_DIRECTIONS: V3StyleDirection[] = [
  {
    id: "warm-modern",
    label: "Warm modern",
    description: "Natural texture, warm neutrals, and clean tailored details.",
    prompt: "Create a coordinated warm-modern design with natural texture, warm neutral materials, clean lines, and restrained tailored details.",
  },
  {
    id: "timeless",
    label: "Timeless",
    description: "Balanced proportions and durable, quietly classic finishes.",
    prompt: "Create a timeless, highly buildable design with balanced proportions, durable classic materials, and understated polished details.",
  },
  {
    id: "spa-like",
    label: "Spa-like",
    description: "Soft light, calm stone, and an uncluttered atmosphere.",
    prompt: "Create a calm spa-like design using soft natural light, quiet pale stone, tactile surfaces, and an uncluttered atmosphere.",
  },
  {
    id: "organic",
    label: "Organic",
    description: "Earthy materials, gentle contrast, and natural character.",
    prompt: "Create an organic design with earthy natural materials, gentle contrast, crafted detail, and authentic natural character.",
  },
  {
    id: "minimal",
    label: "Minimal",
    description: "Architectural simplicity with low visual noise.",
    prompt: "Create a refined minimal design with architectural simplicity, precise construction, concealed clutter, and low visual noise.",
  },
  {
    id: "bold-luxury",
    label: "Bold luxury",
    description: "Confident contrast and elevated statement materials.",
    prompt: "Create a bold luxury design with confident controlled contrast, elevated statement materials, and realistic premium detailing.",
  },
];

const STAGE_LABELS: Array<{ id: V3Stage; label: string }> = [
  { id: "project", label: "Project" },
  { id: "scope", label: "Scope" },
  { id: "details", label: "Details" },
  { id: "starting-room", label: "Starting room" },
  { id: "look", label: "Look" },
  { id: "concepts", label: "Concepts" },
  { id: "result", label: "Price" },
];

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

function rangeText(range: Pick<V3PlanningRange, "totalMin" | "totalMax" | "currency">): string {
  return `${formatCurrency(range.totalMin, range.currency)}–${formatCurrency(range.totalMax, range.currency)}`;
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

function defaultSnapshot(sessionId: string, selectedServiceId: string | null): AdventureV3Snapshot {
  return {
    version: 3,
    sessionId,
    stage: selectedServiceId ? "scope" : "project",
    selectedServiceId,
    scope: null,
    costDrivers: {
      layout: "keep",
      finishLevel: "premium",
      size: "average",
      components: [],
    },
    startingRoomMethod: null,
    selectedExampleRoom: null,
    sourceAsset: null,
    selectedStyleId: null,
    concepts: [],
    selectedConceptIndex: -1,
    detailedPricing: null,
    lead: { emailCaptured: false, emailStatus: "idle", consultationStatus: "idle" },
    updatedAt: Date.now(),
  };
}

function syntheticCanvas(params: {
  sourceAsset?: StableAsset | null;
  example?: V3ExampleRoom | null;
  serviceId: string;
  scope: string;
  budget: number;
}): StarterCanvas | null {
  const source = params.sourceAsset
    ? {
        assetId: params.sourceAsset.assetId,
        imageUrl: params.sourceAsset.url,
        storagePath: params.sourceAsset.storagePath,
        modelId: null,
      }
    : params.example
      ? {
          assetId: params.example.assetId,
          imageUrl: params.example.imageUrl,
          storagePath: params.example.storagePath,
          modelId: params.example.modelId || null,
        }
      : null;
  if (!source) return null;
  return {
    ...source,
    sourceType: params.sourceAsset ? "uploaded" : "generated",
    predictionId: null,
    prompt: null,
    serviceId: params.serviceId,
    scope: params.scope,
    budget: params.budget,
    experienceMode: "scene",
    createdAt: Date.now(),
  };
}

function valueLabel(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function EmailGate(props: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (email: string, name: string) => void;
}) {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  if (!props.open) return null;
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="v3-email-title">
        <button className={styles.modalClose} type="button" onClick={props.onClose} aria-label="Close">
          <X size={17} />
        </button>
        <div className={styles.modalIcon}><Mail size={21} /></div>
        <h2 id="v3-email-title">Unlock your full project estimate</h2>
        <p>Save your concepts, see the detailed range, and receive your project summary by email.</p>
        <label>
          Name <span>optional</span>
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" />
        </label>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
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
          {props.busy ? <LoaderCircle className={styles.spin} size={16} /> : <Sparkles size={16} />}
          Unlock and save
        </button>
        <small className={styles.privacyNote}>No phone number required. This remains a planning estimate.</small>
      </div>
    </div>
  );
}

function ConsultationGate(props: {
  open: boolean;
  busy: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (phone: string) => void;
}) {
  const [phone, setPhone] = useState("");
  if (!props.open) return null;
  return (
    <div className={styles.modalBackdrop} role="presentation">
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="v3-phone-title">
        <button className={styles.modalClose} type="button" onClick={props.onClose} aria-label="Close">
          <X size={17} />
        </button>
        <div className={styles.modalIcon}><Phone size={21} /></div>
        <h2 id="v3-phone-title">Request contractor review</h2>
        <p>Share a phone number only if you want a consultation or a higher-confidence estimate from a person.</p>
        <label>
          Phone number
          <input
            type="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            autoComplete="tel"
          />
        </label>
        {props.error ? <div className={styles.formError}>{props.error}</div> : null}
        <button
          type="button"
          className={styles.primaryButton}
          disabled={props.busy || phone.replace(/\D/g, "").length < 10}
          onClick={() => props.onSubmit(phone)}
        >
          {props.busy ? <LoaderCircle className={styles.spin} size={16} /> : <Phone size={16} />}
          Request consultation
        </button>
      </div>
    </div>
  );
}

export function AdventureV3Experience({
  instanceId,
  initialInstanceData,
  initialDesignConfig,
}: Props) {
  const [instance, setInstance] = useState<any>(initialInstanceData || null);
  const [design, setDesign] = useState<DesignSettings>(() =>
    withWidgetDesignDefaults(initialDesignConfig || initialInstanceData?.config || {}, initialInstanceData?.name)
  );
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [snapshot, setSnapshot] = useState<AdventureV3Snapshot | null>(null);
  const [exampleRooms, setExampleRooms] = useState<V3ExampleRoom[]>([]);
  const [roomsBusy, setRoomsBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [conceptsBusy, setConceptsBusy] = useState(false);
  const [conceptError, setConceptError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneBusy, setPhoneBusy] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const uploadRef = useRef<HTMLInputElement | null>(null);
  const replacePhotoRef = useRef<HTMLInputElement | null>(null);
  const generationKeyRef = useRef<string | null>(null);

  const selectedService = useMemo(
    () => services.find((service) => service.value === snapshot?.selectedServiceId) || null,
    [services, snapshot?.selectedServiceId]
  );
  const profile: ResolvedServiceProfile | null = useMemo(
    () => (selectedService ? resolveServiceProfile(instance, selectedService) : null),
    [instance, selectedService]
  );
  const bounds = useMemo(() => configuredPricingBounds(instance), [instance]);
  const planningRange = useMemo(
    () =>
      snapshot
        ? calculatePlanningRange({
            bounds,
            service: selectedService,
            scope: snapshot.scope,
            costDrivers: snapshot.costDrivers,
          })
        : generalServiceRange(bounds, selectedService),
    [bounds, selectedService, snapshot]
  );
  const budgetContext = Math.round((planningRange.totalMin + planningRange.totalMax) / 2);
  const selectedStyle = STYLE_DIRECTIONS.find((direction) => direction.id === snapshot?.selectedStyleId) || null;
  const selectedConcept =
    snapshot && snapshot.selectedConceptIndex >= 0
      ? snapshot.concepts[snapshot.selectedConceptIndex] || null
      : null;
  const sourceCanvas = useMemo(
    () =>
      snapshot && selectedService && snapshot.scope
        ? syntheticCanvas({
            sourceAsset: snapshot.sourceAsset,
            example: snapshot.selectedExampleRoom,
            serviceId: selectedService.value,
            scope: snapshot.scope,
            budget: budgetContext,
          })
        : null,
    [budgetContext, selectedService, snapshot]
  );
  const resultCanvas = selectedConcept || snapshot?.concepts[0] || sourceCanvas;

  const patchSnapshot = useCallback((patch: Partial<AdventureV3Snapshot>) => {
    setSnapshot((previous) =>
      previous ? { ...previous, ...patch, updatedAt: Date.now() } : previous
    );
  }, []);

  const track = useCallback(
    (eventType: string, payload: Record<string, unknown> = {}, modelRequestId?: string | null) => {
      if (!snapshot?.sessionId) return;
      emitTelemetry({
        sessionId: snapshot.sessionId,
        instanceId,
        eventType,
        modelRequestId: modelRequestId || undefined,
        payload: { ...payload, experienceVersion: "v3", experience_version: "v3" },
      });
    },
    [instanceId, snapshot?.sessionId]
  );

  const resetExperience = useCallback(
    (source: "in_form" | "designer_refresh") => {
      clearV3Snapshot(instanceId);
      const sessionId = getOrCreateV3SessionId(instanceId);
      const implicit = services.length === 1 ? services[0] : null;
      setSnapshot(defaultSnapshot(sessionId, implicit?.value || null));
      setExampleRooms([]);
      setConceptError(null);
      setError(null);
      generationKeyRef.current = null;
      track("adventure_v3_restarted", { source });
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
          const markerKey = `adventure:v3:fresh-consumed:${instanceId}`;
          shouldStartFresh = window.sessionStorage.getItem(markerKey) !== freshNonce;
          if (shouldStartFresh) window.sessionStorage.setItem(markerKey, freshNonce);
        }
      } catch {}
      if (shouldStartFresh) clearV3Snapshot(instanceId);
      const sessionId = getOrCreateV3SessionId(instanceId);
      const saved = shouldStartFresh ? null : loadV3Snapshot(instanceId);
      try {
        const response = await fetch(`/api/widget/${encodeURIComponent(instanceId)}`, { cache: "no-store" });
        if (!response.ok) throw new Error("Unable to load this pricing experience.");
        const data = await response.json();
        if (cancelled) return;
        const nextInstance = data?.instance || initialInstanceData || {};
        const normalized = normalizeServices(data?.serviceOptions);
        const nextServices =
          normalized.length > 0
            ? normalized
            : [
                {
                  value: "general-service",
                  label: String(nextInstance?.name || "Your project"),
                  serviceName: String(nextInstance?.name || "Your project"),
                  serviceSummary: nextInstance?.service_summary || nextInstance?.company_summary || null,
                } satisfies ServiceOption,
              ];
        setInstance(nextInstance);
        setDesign((previous) =>
          withWidgetDesignDefaults(nextInstance?.config || previous, nextInstance?.name || initialInstanceData?.name)
        );
        setServices(nextServices);
        const savedService = nextServices.find((service) => service.value === saved?.selectedServiceId);
        const hintedService = nextServices.find(
          (service) =>
            service.value === hintedServiceId || service.label.toLowerCase() === hintedServiceId.toLowerCase()
        );
        const implicit = hintedService || savedService || (nextServices.length === 1 ? nextServices[0] : null);
        setSnapshot(
          saved && savedService
            ? saved
            : defaultSnapshot(sessionId, implicit?.value || null)
        );
      } catch (bootstrapError) {
        if (!cancelled) {
          setError(bootstrapError instanceof Error ? bootstrapError.message : "Unable to load this experience.");
        }
      }
    }
    void bootstrap();
    return () => {
      cancelled = true;
    };
  }, [initialInstanceData, instanceId]);

  useEffect(() => {
    if (!snapshot) return;
    saveV3Snapshot(instanceId, snapshot);
  }, [instanceId, snapshot]);

  useEffect(() => {
    if (!snapshot?.stage || snapshot.stage === "loading" || typeof window === "undefined") return;
    rootRef.current?.scrollTo({ top: 0, left: 0, behavior: "auto" });
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [snapshot?.stage]);

  useEffect(() => {
    if (!snapshot?.sessionId) return;
    track("adventure_experience_started", { routeVersion: "v3" });
  }, [snapshot?.sessionId, track]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.parent?.postMessage({ type: "FORM_READY", version: "v3" }, "*");
      window.parent?.postMessage({ type: "WIDGET_READY", surface: "form", version: "v3" }, "*");
    } catch {}
    const onMessage = (event: MessageEvent) => {
      if (event.source !== window.parent || !event.data || typeof event.data !== "object") return;
      if (event.data.type === "SIF_RESET_SESSION" || event.data.type === "RESET_SESSION") {
        resetExperience("designer_refresh");
        try {
          window.parent?.postMessage({ type: "RESET_SESSION_ACK", version: "v3" }, event.origin || "*");
        } catch {}
      }
      if (event.data.type === "UPDATE_CONFIG" && event.data.config && typeof event.data.config === "object") {
        setDesign(withWidgetDesignDefaults(event.data.config, instance?.name));
        try {
          window.parent?.postMessage({ type: "UPDATE_CONFIG_ACK", version: "v3" }, event.origin || "*");
        } catch {}
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [instance?.name, resetExperience]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      try {
        window.parent?.postMessage(
          {
            type: "ADVENTURE_RESIZE",
            instanceId,
            phase: snapshot?.stage || "project",
            height: Math.ceil(root.scrollHeight),
            version: "v3",
          },
          "*"
        );
      } catch {}
    });
    observer.observe(root);
    return () => observer.disconnect();
  }, [instanceId, snapshot?.stage]);

  useEffect(() => {
    if (
      snapshot?.stage !== "starting-room" ||
      !snapshot.scope ||
      !selectedService ||
      exampleRooms.length > 0 ||
      roomsBusy
    ) {
      return;
    }
    let cancelled = false;
    setRoomsBusy(true);
    const params = new URLSearchParams({ serviceId: selectedService.value, scope: snapshot.scope });
    fetch(`/api/v3/ai-form/${encodeURIComponent(instanceId)}/starting-rooms?${params.toString()}`, {
      cache: "no-store",
    })
      .then(async (response) => {
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Unable to load similar rooms.");
        if (!cancelled) setExampleRooms(Array.isArray(data?.rooms) ? data.rooms : []);
      })
      .catch((roomError) => {
        if (!cancelled) setError(roomError instanceof Error ? roomError.message : "Unable to load similar rooms.");
      })
      .finally(() => {
        if (!cancelled) setRoomsBusy(false);
      });
    return () => {
      cancelled = true;
    };
  }, [exampleRooms.length, instanceId, selectedService, snapshot?.scope, snapshot?.stage]);

  const chooseService = useCallback(
    (service: ServiceOption) => {
      if (!snapshot) return;
      setSnapshot({
        ...defaultSnapshot(snapshot.sessionId, service.value),
        stage: "scope",
        updatedAt: Date.now(),
      });
      setExampleRooms([]);
      track("adventure_v3_project_selected", { serviceId: service.value, serviceName: service.label });
    },
    [snapshot, track]
  );

  const chooseScope = useCallback(
    (scope: string) => {
      if (!snapshot) return;
      patchSnapshot({
        scope,
        stage: "details",
        costDrivers: { ...snapshot.costDrivers, components: [] },
        startingRoomMethod: null,
        selectedExampleRoom: null,
        sourceAsset: null,
        selectedStyleId: null,
        concepts: [],
        selectedConceptIndex: -1,
        detailedPricing: null,
      });
      setExampleRooms([]);
      track("adventure_v3_scope_selected", { scope, serviceId: selectedService?.value });
    },
    [patchSnapshot, selectedService?.value, snapshot, track]
  );

  const componentOptions = useMemo(() => {
    const configured = (selectedService?.subcategoryComponents || [])
      .slice()
      .sort((a, b) => a.priority - b.priority)
      .map((component) => component.label)
      .filter(Boolean)
      .slice(0, 6);
    if (configured.length > 0) return configured;
    const searchable = `${selectedService?.label || ""} ${snapshot?.scope || ""}`.toLowerCase();
    if (/bath|shower|tub|vanity|tile/.test(searchable)) {
      return ["Shower or tub", "Vanity", "Flooring", "Lighting & fixtures", "Plumbing"];
    }
    if (/landscap|garden|patio|lawn|outdoor/.test(searchable)) {
      return ["Planting", "Hardscape", "Lawn", "Lighting", "Irrigation"];
    }
    return ["Main focal area", "Surrounding surfaces", "Fixtures & details", "Lighting"];
  }, [selectedService, snapshot?.scope]);

  const updateDriver = useCallback(
    <K extends keyof AdventureV3Snapshot["costDrivers"]>(
      key: K,
      value: AdventureV3Snapshot["costDrivers"][K]
    ) => {
      setSnapshot((previous) =>
        previous
          ? {
              ...previous,
              costDrivers: { ...previous.costDrivers, [key]: value },
              detailedPricing: null,
              updatedAt: Date.now(),
            }
          : previous
      );
    },
    []
  );

  const toggleComponent = useCallback(
    (component: string) => {
      if (!snapshot) return;
      const selected = snapshot.costDrivers.components.includes(component);
      updateDriver(
        "components",
        selected
          ? snapshot.costDrivers.components.filter((item) => item !== component)
          : [...snapshot.costDrivers.components, component]
      );
    },
    [snapshot, updateDriver]
  );

  const uploadPhoto = useCallback(
    async (file: File, fromWorkspace = false) => {
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
        if (!response.ok || !data?.asset?.url) {
          throw new Error(data?.error || "Unable to upload that image.");
        }
        const asset = data.asset as StableAsset;
        patchSnapshot({
          startingRoomMethod: "upload",
          sourceAsset: asset,
          selectedExampleRoom: null,
          concepts: [],
          selectedConceptIndex: -1,
          selectedStyleId: fromWorkspace ? snapshot.selectedStyleId : null,
          detailedPricing: null,
          stage: fromWorkspace ? "look" : snapshot.stage,
        });
        generationKeyRef.current = null;
        track("adventure_v3_room_uploaded", { fromWorkspace, assetId: asset.assetId }, asset.assetId);
      } catch (uploadError) {
        setError(uploadError instanceof Error ? uploadError.message : "Unable to upload that image.");
      } finally {
        setUploadBusy(false);
      }
    },
    [instanceId, patchSnapshot, snapshot, track]
  );

  const callCanvas = useCallback(
    async (action: "starter" | "edit", prompt?: string, currentCanvasUrl?: string): Promise<StarterCanvas> => {
      if (!snapshot || !selectedService || !profile || !snapshot.scope) {
        throw new Error("Complete the project and scope steps first.");
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
          budget: budgetContext,
          experienceMode: profile.mode,
          sourceAssets: snapshot.sourceAsset ? { scene: snapshot.sourceAsset } : {},
          currentCanvasUrl,
          prompt,
          modelId: action === "edit" ? CONCEPT_MODEL_ID : undefined,
          generationIntent: action === "edit" ? "v3_concept" : "v3_starting_room",
          priorChanges: [],
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.canvas?.imageUrl) {
        throw new Error(data?.error || "The image model could not create a result.");
      }
      return data.canvas as StarterCanvas;
    },
    [budgetContext, instanceId, profile, selectedService, snapshot]
  );

  const createFallbackRoom = useCallback(async () => {
    setRoomsBusy(true);
    setError(null);
    try {
      const canvas = await callCanvas("starter");
      const room: V3ExampleRoom = {
        assetId: canvas.assetId,
        imageUrl: canvas.imageUrl,
        storagePath: canvas.storagePath,
        label: "Similar starting room",
        modelId: canvas.modelId,
        createdAt: canvas.createdAt,
      };
      setExampleRooms([room]);
      patchSnapshot({ selectedExampleRoom: room, startingRoomMethod: "example" });
    } catch (fallbackError) {
      setError(fallbackError instanceof Error ? fallbackError.message : "Unable to prepare a starting room.");
    } finally {
      setRoomsBusy(false);
    }
  }, [callCanvas, patchSnapshot]);

  const generateConcepts = useCallback(async () => {
    if (!snapshot || !sourceCanvas || !selectedStyle || conceptsBusy) return;
    const generationKey = `${sourceCanvas.assetId}:${selectedStyle.id}:${snapshot.scope}`;
    generationKeyRef.current = generationKey;
    setConceptsBusy(true);
    setConceptError(null);
    patchSnapshot({ concepts: [], selectedConceptIndex: -1, stage: "concepts", detailedPricing: null });
    track("adventure_v3_concepts_requested", {
      style: selectedStyle.label,
      roomMethod: snapshot.startingRoomMethod,
      count: CONCEPT_COUNT,
    });
    const interpretations = [
      "restrained, practical, and broadly appealing",
      "bright, polished, and quietly elevated",
      "warm, tactile, and naturally detailed",
      "architectural, confident, and presentation-ready",
    ];
    let successful = 0;
    await Promise.allSettled(
      interpretations.map(async (interpretation, index) => {
        const prompt = [
          `Transform this exact current space into a complete ${selectedStyle.label} concept focused on ${snapshot.scope}.`,
          selectedStyle.prompt,
          `Make this version ${interpretation}.`,
          `Respect the selected pricing scope and included components: ${snapshot.costDrivers.components.join(", ") || "the selected scope"}.`,
          "Preserve the camera position, crop, perspective, openings, room geometry, and all recognizable architecture.",
          "Do not invent a different room. Keep unrelated areas unchanged. Use realistic, buildable residential materials and no people or text.",
        ].join(" ");
        const canvas = await callCanvas("edit", prompt, sourceCanvas.imageUrl);
        if (generationKeyRef.current !== generationKey) return;
        successful += 1;
        const entry: CanvasHistoryEntry = {
          ...canvas,
          changeLabel: `${selectedStyle.label} concept ${index + 1}`,
          designInstruction: {
            mode: "finished_version",
            directionId: selectedStyle.id,
            directionLabel: selectedStyle.label,
            versionId: `v3-${index + 1}`,
            customInstruction: interpretation,
            readableSummary: `${selectedStyle.label} · ${interpretation}`,
          },
        };
        setSnapshot((previous) => {
          if (!previous) return previous;
          const concepts = [...previous.concepts, entry];
          return {
            ...previous,
            concepts,
            selectedConceptIndex: previous.selectedConceptIndex < 0 ? 0 : previous.selectedConceptIndex,
            updatedAt: Date.now(),
          };
        });
        track(
          "adventure_v3_concept_ready",
          { style: selectedStyle.label, conceptNumber: index + 1, modelId: canvas.modelId },
          canvas.predictionId || canvas.assetId
        );
      })
    );
    if (generationKeyRef.current === generationKey && successful === 0) {
      setConceptError("Concept generation is unavailable right now. Your planning range is still ready.");
    }
    setConceptsBusy(false);
  }, [callCanvas, conceptsBusy, patchSnapshot, selectedStyle, snapshot, sourceCanvas, track]);

  const requestPricing = useCallback(async (): Promise<V2Pricing> => {
    if (!snapshot || !selectedService || !profile) {
      return {
        totalMin: planningRange.totalMin,
        totalMax: planningRange.totalMax,
        currency: planningRange.currency,
        source: "v3_planning_engine",
      };
    }
    try {
      const response = await fetch(`/api/ai-form/${encodeURIComponent(instanceId)}/pricing`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: snapshot.sessionId,
          useCase: snapshot.concepts.length > 0 ? "scene-refinement" : profile.mode,
          stepDataSoFar: {
            "step-project-v3": selectedService.value,
            "step-scope-v3": snapshot.scope,
            "step-layout-v3": snapshot.costDrivers.layout,
            "step-components-v3": snapshot.costDrivers.components,
            "step-finish-v3": snapshot.costDrivers.finishLevel,
            "step-size-v3": snapshot.costDrivers.size,
            "step-starting-room-v3": snapshot.startingRoomMethod,
            "step-style-v3": selectedStyle?.label,
          },
          answeredQA: [
            { question: "Project", answer: selectedService.label },
            { question: "Scope", answer: snapshot.scope },
            { question: "Layout", answer: snapshot.costDrivers.layout },
            { question: "Included components", answer: snapshot.costDrivers.components.join(", ") },
            { question: "Finish level", answer: snapshot.costDrivers.finishLevel },
            { question: "Approximate size", answer: snapshot.costDrivers.size },
          ],
          askedStepIds: [
            "step-project-v3",
            "step-scope-v3",
            "step-layout-v3",
            "step-components-v3",
            "step-finish-v3",
            "step-size-v3",
          ],
          instanceContext: {
            service: { id: selectedService.value, name: selectedService.label },
            industry: selectedService.industryName ? { name: selectedService.industryName } : undefined,
            serviceSummary: selectedService.serviceSummary,
          },
          previewImageUrl: resultCanvas?.imageUrl,
          budgetRange: budgetContext,
          pricingScenario: "v3_progressive_certainty",
          noCache: true,
        }),
      });
      const data = await response.json().catch(() => ({}));
      const estimate = data?.estimate || data;
      const totalMin = Number(estimate?.totalMin ?? estimate?.total_min);
      const totalMax = Number(estimate?.totalMax ?? estimate?.total_max);
      const source = typeof estimate?.source === "string" ? estimate.source.trim() : "pricing_service";
      if (
        response.ok &&
        !/^(fallback|configured_preview)/i.test(source) &&
        Number.isFinite(totalMin) &&
        Number.isFinite(totalMax)
      ) {
        return {
          totalMin: Math.min(totalMin, totalMax),
          totalMax: Math.max(totalMin, totalMax),
          currency: typeof estimate?.currency === "string" ? estimate.currency : planningRange.currency,
          source,
        };
      }
    } catch {}
    return {
      totalMin: planningRange.totalMin,
      totalMax: planningRange.totalMax,
      currency: planningRange.currency,
      source: "v3_planning_engine",
    };
  }, [budgetContext, instanceId, planningRange, profile, resultCanvas?.imageUrl, selectedService, selectedStyle?.label, snapshot]);

  const sendResultsEmail = useCallback(
    async (submissionId: string, pricing: V2Pricing): Promise<boolean> => {
      if (!selectedService || !snapshot) return false;
      try {
        const response = await fetch("/api/v2/leads/results-email", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            submissionId,
            instanceId,
            serviceName: selectedService.label,
            scope: snapshot.scope,
            canvasUrl: resultCanvas?.imageUrl,
            pricing,
            assumptions: planningRange.assumptions,
          }),
        });
        return response.ok;
      } catch {
        return false;
      }
    },
    [instanceId, planningRange.assumptions, resultCanvas?.imageUrl, selectedService, snapshot]
  );

  const captureEmail = useCallback(
    async (email: string, name: string) => {
      if (!snapshot || !selectedService || !profile) return;
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
              service: selectedService,
              scope: snapshot.scope,
              costDrivers: snapshot.costDrivers,
              planningRange,
              startingRoomMethod: snapshot.startingRoomMethod,
              selectedExampleRoom: snapshot.selectedExampleRoom,
              selectedStyle,
              concepts: snapshot.concepts,
              selectedConcept: resultCanvas,
            },
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || !data?.submissionId) {
          throw new Error(data?.error || "Unable to save your estimate.");
        }
        const submissionId = String(data.submissionId);
        const immediatePricing: V2Pricing = {
          totalMin: planningRange.totalMin,
          totalMax: planningRange.totalMax,
          currency: planningRange.currency,
          source: "v3_planning_engine",
        };
        setSnapshot((previous) =>
          previous
            ? {
                ...previous,
                detailedPricing: immediatePricing,
                lead: {
                  ...previous.lead,
                  emailCaptured: true,
                  submissionId,
                  email,
                  name,
                  emailStatus: "sending",
                },
                updatedAt: Date.now(),
              }
            : previous
        );
        setEmailOpen(false);
        track("adventure_v3_email_captured", { submissionId }, submissionId);

        void (async () => {
          const pricing = await requestPricing();
          setSnapshot((previous) =>
            previous
              ? { ...previous, detailedPricing: pricing, updatedAt: Date.now() }
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
          track(sent ? "adventure_v3_results_email_sent" : "adventure_v3_results_email_failed", { submissionId }, submissionId);
        })();
      } catch (captureError) {
        setEmailError(captureError instanceof Error ? captureError.message : "Unable to save your estimate.");
      } finally {
        setEmailBusy(false);
      }
    },
    [instanceId, planningRange, profile, requestPricing, resultCanvas, selectedService, selectedStyle, sendResultsEmail, snapshot, track]
  );

  const requestConsultation = useCallback(
    async (phone: string) => {
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
          }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data?.error || "Unable to request a consultation.");
        setSnapshot((previous) =>
          previous
            ? {
                ...previous,
                lead: {
                  ...previous.lead,
                  phone,
                  consultationStatus: "requested",
                },
                updatedAt: Date.now(),
              }
            : previous
        );
        setPhoneOpen(false);
        track("adventure_v3_consultation_requested", { submissionId: snapshot.lead.submissionId });
      } catch (consultationError) {
        setPhoneError(consultationError instanceof Error ? consultationError.message : "Unable to request a consultation.");
      } finally {
        setPhoneBusy(false);
      }
    },
    [instanceId, snapshot?.lead.submissionId, track]
  );

  const goBack = useCallback(() => {
    if (!snapshot) return;
    const order: V3Stage[] = services.length > 1
      ? ["project", "scope", "details", "starting-room", "look", "concepts", "result"]
      : ["scope", "details", "starting-room", "look", "concepts", "result"];
    const current = order.indexOf(snapshot.stage);
    if (current > 0) patchSnapshot({ stage: order[current - 1] });
  }, [patchSnapshot, services.length, snapshot]);

  const selectRoomMethod = useCallback(
    (method: StartingRoomMethod) => {
      patchSnapshot({ startingRoomMethod: method });
      track("adventure_v3_starting_room_method_selected", { method });
    },
    [patchSnapshot, track]
  );

  const openFullscreen = useCallback(() => {
    if (!resultCanvas || !snapshot?.lead.emailCaptured) return;
    const popup = window.open(resultCanvas.imageUrl, "_blank", "noopener,noreferrer");
    if (!popup) setError("Your browser blocked the full-screen window.");
  }, [resultCanvas, snapshot?.lead.emailCaptured]);

  const downloadConcept = useCallback(async () => {
    if (!resultCanvas || !snapshot?.lead.emailCaptured) return;
    try {
      const response = await fetch(resultCanvas.imageUrl);
      if (!response.ok) throw new Error("Unable to download the concept.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${String(selectedService?.label || "adventure-concept").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Unable to download the concept.");
    }
  }, [resultCanvas, selectedService?.label, snapshot?.lead.emailCaptured]);

  if (!snapshot || snapshot.stage === "loading") {
    return (
      <div ref={rootRef} className={styles.root} data-adventure-version="v3">
        <div className={styles.loadingState}><LoaderCircle className={styles.spin} /> Loading pricing…</div>
      </div>
    );
  }

  const background = design.background_color || "#f5f3ee";
  const accent = design.primary_color || design.submit_button_background_color || "#172033";
  const textColor = design.prompt_text_color || design.brand_name_color || "#172033";
  const rootStyle = {
    "--v3-accent": accent,
    "--v3-text": textColor,
    "--v3-radius": `${Math.max(10, Number(design.border_radius || 18))}px`,
    backgroundColor: background,
    backgroundImage: design.background_gradient || undefined,
    fontFamily: design.font_family || "Inter, sans-serif",
  } as React.CSSProperties;
  const visibleStages = services.length > 1 ? STAGE_LABELS : STAGE_LABELS.filter((stage) => stage.id !== "project");
  const activeStageIndex = Math.max(0, visibleStages.findIndex((stage) => stage.id === snapshot.stage));
  const canContinueRoom = Boolean(snapshot.sourceAsset || snapshot.selectedExampleRoom);
  const activeDetailedPricing = snapshot.detailedPricing || planningRange;
  const breakdownMidpoint = (activeDetailedPricing.totalMin + activeDetailedPricing.totalMax) / 2;
  const breakdown = [
    ["Labor & construction", 0.42],
    ["Materials & fixtures", 0.35],
    ["Project overhead", 0.15],
    ["Planning contingency", 0.08],
  ] as const;

  return (
    <div ref={rootRef} className={styles.root} style={rootStyle} data-adventure-version="v3">
      <BrandHeader config={design} compact />

      {snapshot.stage !== "result" ? (
        <main className={styles.stepShell}>
          <div className={styles.stepTopbar}>
            <button
              type="button"
              className={styles.iconButton}
              onClick={goBack}
              disabled={activeStageIndex === 0}
              aria-label="Go back"
            >
              <ArrowLeft size={18} />
            </button>
            <div className={styles.phaseRail} aria-label={`Step ${activeStageIndex + 1} of ${visibleStages.length}`}>
              {visibleStages.map((stage, index) => (
                <span key={stage.id} data-active={index <= activeStageIndex ? "true" : "false"}>
                  <i />
                  <small>{stage.label}</small>
                </span>
              ))}
            </div>
            <button type="button" className={styles.restartButton} onClick={() => resetExperience("in_form")}>
              <RotateCcw size={14} /> Start over
            </button>
          </div>

          {snapshot.stage === "project" ? (
            <section className={styles.stepContent}>
              <div className={styles.eyebrow}>Pricing orientation</div>
              <h1>What are you planning?</h1>
              <p>Start with a real planning range. You can personalize the space after we establish the project.</p>
              <div className={styles.choiceGrid}>
                {services.map((service) => {
                  const range = generalServiceRange(bounds, service);
                  return (
                    <button key={service.value} type="button" className={styles.choiceCard} onClick={() => chooseService(service)}>
                      <span>
                        <strong>{service.label}</strong>
                        <small>Typical projects {rangeText(range)}</small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {snapshot.stage === "scope" && profile ? (
            <section className={styles.stepContent}>
              <div className={styles.eyebrow}>{selectedService?.label}</div>
              <h1>What level of work are you considering?</h1>
              <p>Choose the closest scope. You can revise it later without restarting.</p>
              <div className={styles.choiceGrid}>
                {profile.scopeOptions.map((scope) => {
                  const range = calculatePlanningRange({
                    bounds,
                    service: selectedService,
                    scope,
                    costDrivers: snapshot.costDrivers,
                  });
                  return (
                    <button key={scope} type="button" className={styles.choiceCard} onClick={() => chooseScope(scope)}>
                      <span>
                        <strong>{scope}</strong>
                        <small>Planning range {rangeText(range)}</small>
                      </span>
                      <ArrowRight size={18} />
                    </button>
                  );
                })}
              </div>
            </section>
          ) : null}

          {snapshot.stage === "details" ? (
            <section className={`${styles.stepContent} ${styles.detailsStep}`}>
              <div className={styles.eyebrow}>{snapshot.scope}</div>
              <h1>What will materially change the price?</h1>
              <p>Only the decisions below affect this planning range. Visual style comes next.</p>
              <div className={styles.driverStack}>
                <div className={styles.driverGroup}>
                  <div><strong>Layout</strong><small>Moving plumbing or walls is a major cost driver.</small></div>
                  <div className={styles.segmentedControl}>
                    {(["keep", "change"] as const).map((value) => (
                      <button key={value} type="button" data-selected={snapshot.costDrivers.layout === value ? "true" : "false"} onClick={() => updateDriver("layout", value)}>
                        {value === "keep" ? "Keep the layout" : "Change the layout"}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.driverGroup}>
                  <div><strong>Major components</strong><small>Select everything likely to be included.</small></div>
                  <div className={styles.chipGrid}>
                    {componentOptions.map((component) => (
                      <button key={component} type="button" data-selected={snapshot.costDrivers.components.includes(component) ? "true" : "false"} onClick={() => toggleComponent(component)}>
                        <Check size={13} /> {component}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.driverGroup}>
                  <div><strong>Finish level</strong><small>This reflects material and fixture quality—not visual style.</small></div>
                  <div className={styles.threeChoice}>
                    {(["standard", "premium", "luxury"] as const).map((value) => (
                      <button key={value} type="button" data-selected={snapshot.costDrivers.finishLevel === value ? "true" : "false"} onClick={() => updateDriver("finishLevel", value)}>
                        <strong>{valueLabel(value)}</strong>
                        <small>{value === "standard" ? "Reliable in-stock" : value === "premium" ? "Upgraded finishes" : "Custom statement"}</small>
                      </button>
                    ))}
                  </div>
                </div>
                <div className={styles.driverGroup}>
                  <div><strong>Approximate size</strong><small>A rough category is enough for planning.</small></div>
                  <div className={styles.segmentedControl}>
                    {(["compact", "average", "large"] as const).map((value) => (
                      <button key={value} type="button" data-selected={snapshot.costDrivers.size === value ? "true" : "false"} onClick={() => updateDriver("size", value)}>
                        {valueLabel(value)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button type="button" className={styles.primaryButton} onClick={() => patchSnapshot({ stage: "starting-room" })}>
                Choose a starting room <ArrowRight size={16} />
              </button>
            </section>
          ) : null}

          {snapshot.stage === "starting-room" ? (
            <section className={styles.stepContent}>
              <div className={styles.eyebrow}>Your range is established</div>
              <h1>What should we use as your starting room?</h1>
              <p>Both paths lead to the same concept experience. Your pricing selections stay intact.</p>
              {!snapshot.startingRoomMethod ? (
                <div className={styles.roomMethodGrid}>
                  <button type="button" onClick={() => selectRoomMethod("upload")}>
                    <span className={styles.roomMethodIcon}><Upload size={22} /></span>
                    <strong>Use my photo</strong>
                    <p>Upload or take a photo for the most personalized concept.</p>
                    <small>Most personalized</small>
                  </button>
                  <button type="button" onClick={() => selectRoomMethod("example")}>
                    <span className={styles.roomMethodIcon}><ImageIcon size={22} /></span>
                    <strong>Choose a similar room</strong>
                    <p>Pick the example closest to yours and start immediately.</p>
                    <small>Fastest option</small>
                  </button>
                </div>
              ) : null}

              {snapshot.startingRoomMethod === "upload" ? (
                <div className={styles.uploadPanel}>
                  <input ref={uploadRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.currentTarget.value = "";
                    if (file) void uploadPhoto(file);
                  }} />
                  {snapshot.sourceAsset ? (
                    <div className={styles.uploadedPreview}>
                      <img src={snapshot.sourceAsset.url} alt="Your uploaded starting room" />
                      <div>
                        <Check size={16} />
                        <span><strong>Your room is ready</strong><small>We’ll preserve its recognizable layout.</small></span>
                        <button type="button" onClick={() => uploadRef.current?.click()}>Replace</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" className={styles.uploadDropzone} onClick={() => uploadRef.current?.click()} disabled={uploadBusy}>
                      {uploadBusy ? <LoaderCircle className={styles.spin} size={25} /> : <ImagePlus size={25} />}
                      <strong>{uploadBusy ? "Uploading your room…" : "Upload or take a photo"}</strong>
                      <small>JPG, PNG, or WebP · up to 10 MB</small>
                    </button>
                  )}
                  <button type="button" className={styles.textButton} onClick={() => patchSnapshot({ startingRoomMethod: null, sourceAsset: null })}>
                    Choose a different starting method
                  </button>
                </div>
              ) : null}

              {snapshot.startingRoomMethod === "example" ? (
                <div className={styles.exampleRoomSection}>
                  <div className={styles.exampleRoomHeading}>
                    <strong>Choose the closest room</strong>
                    <small>These examples are filtered to your selected service and scope.</small>
                  </div>
                  {roomsBusy ? (
                    <div className={styles.roomGallery}>
                      {Array.from({ length: 4 }, (_, index) => <div key={index} className={styles.roomSkeleton} />)}
                    </div>
                  ) : exampleRooms.length > 0 ? (
                    <div className={styles.roomGallery}>
                      {exampleRooms.map((room) => (
                        <button key={room.assetId} type="button" data-selected={snapshot.selectedExampleRoom?.assetId === room.assetId ? "true" : "false"} onClick={() => patchSnapshot({ selectedExampleRoom: room, sourceAsset: null })}>
                          <img src={room.imageUrl} alt={room.label} />
                          <span>{room.label}</span>
                          <i><Check size={13} /></i>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className={styles.emptyRooms}>
                      <ImageIcon size={22} />
                      <strong>Prepare a neutral room for this scope</strong>
                      <small>We couldn’t find a saved example, but pricing can continue independently.</small>
                      <button type="button" className={styles.secondaryButton} onClick={() => void createFallbackRoom()}>
                        <Sparkles size={15} /> Prepare room
                      </button>
                    </div>
                  )}
                  <button type="button" className={styles.textButton} onClick={() => patchSnapshot({ startingRoomMethod: null, selectedExampleRoom: null })}>
                    Choose a different starting method
                  </button>
                </div>
              ) : null}
              {error ? <div className={styles.errorBanner}>{error}</div> : null}
              {snapshot.startingRoomMethod ? (
                <button type="button" className={styles.primaryButton} disabled={!canContinueRoom} onClick={() => patchSnapshot({ stage: "look" })}>
                  Choose a look <ArrowRight size={16} />
                </button>
              ) : null}
            </section>
          ) : null}

          {snapshot.stage === "look" ? (
            <section className={`${styles.stepContent} ${styles.lookStep}`}>
              <div className={styles.eyebrow}>Visual direction</div>
              <h1>Which direction feels closest?</h1>
              <p>This changes the concept—not the price. Choose one broad direction and we’ll show several finished interpretations.</p>
              <div className={styles.lookLayout}>
                {sourceCanvas ? (
                  <div className={styles.startingRoomPreview}>
                    <img src={sourceCanvas.imageUrl} alt="Selected starting room" />
                    <span>{snapshot.startingRoomMethod === "upload" ? "Your room" : "Similar room"}</span>
                  </div>
                ) : null}
                <div className={styles.styleGrid}>
                  {STYLE_DIRECTIONS.map((direction, index) => (
                    <button key={direction.id} type="button" data-selected={snapshot.selectedStyleId === direction.id ? "true" : "false"} onClick={() => patchSnapshot({ selectedStyleId: direction.id, concepts: [], selectedConceptIndex: -1, detailedPricing: null })}>
                      <span className={styles.styleNumber}>0{index + 1}</span>
                      <strong>{direction.label}</strong>
                      <small>{direction.description}</small>
                      <i><Check size={13} /></i>
                    </button>
                  ))}
                </div>
              </div>
              <button type="button" className={styles.primaryButton} disabled={!selectedStyle || !sourceCanvas || conceptsBusy} onClick={() => void generateConcepts()}>
                <WandSparkles size={16} /> Show me 4 finished concepts
              </button>
            </section>
          ) : null}

          {snapshot.stage === "concepts" ? (
            <section className={`${styles.stepContent} ${styles.conceptStep}`}>
              <div className={styles.eyebrow}>{selectedStyle?.label || "Your look"}</div>
              <h1>Here are several ways it could come together.</h1>
              <p>Concepts appear as they finish. Choose the strongest direction—or continue to pricing if visualization is unavailable.</p>
              <div className={styles.conceptGrid}>
                {snapshot.concepts.map((concept, index) => (
                  <button key={concept.assetId} type="button" data-selected={snapshot.selectedConceptIndex === index ? "true" : "false"} onClick={() => patchSnapshot({ selectedConceptIndex: index })}>
                    <img src={concept.imageUrl} alt={`${selectedStyle?.label || "Design"} concept ${index + 1}`} />
                    <span>Concept {index + 1}</span>
                    <i><Check size={14} /></i>
                  </button>
                ))}
                {conceptsBusy
                  ? Array.from({ length: Math.max(0, CONCEPT_COUNT - snapshot.concepts.length) }, (_, index) => (
                      <div key={`concept-loading-${index}`} className={styles.conceptSkeleton}>
                        <LoaderCircle className={styles.spin} size={22} />
                        <span>Creating concept…</span>
                      </div>
                    ))
                  : null}
              </div>
              {conceptError ? <div className={styles.errorBanner}>{conceptError}</div> : null}
              <div className={styles.conceptActions}>
                <button type="button" className={styles.secondaryButton} onClick={() => patchSnapshot({ stage: "look" })}>Adjust the look</button>
                {!conceptsBusy ? (
                  <button type="button" className={styles.primaryButton} onClick={() => patchSnapshot({ stage: "result" })}>
                    {snapshot.concepts.length > 0 ? "Use this concept" : "Continue to pricing"} <ArrowRight size={16} />
                  </button>
                ) : null}
              </div>
            </section>
          ) : null}

          {snapshot.stage !== "project" ? (
            <aside className={styles.livePriceBar} aria-live="polite">
              <div>
                <small>Current planning range</small>
                <strong>{rangeText(planningRange)}</strong>
              </div>
              <span>Updates as price-driving choices change</span>
            </aside>
          ) : null}
        </main>
      ) : null}

      {snapshot.stage === "result" ? (
        <main className={styles.workspace}>
          <header className={styles.workspaceHeader}>
            <div>
              <div className={styles.eyebrow}>{selectedService?.label} · {snapshot.scope}</div>
              <h1>Your project is financially mapped.</h1>
              <p>This is a planning estimate—not a binding contractor quote.</p>
            </div>
            <button type="button" className={styles.restartButton} onClick={() => resetExperience("in_form")}>
              <RotateCcw size={14} /> New project
            </button>
          </header>
          <div className={styles.workspaceGrid}>
            <section className={styles.workspaceVisual}>
              {resultCanvas ? (
                <div className={styles.resultImageFrame}>
                  <img src={resultCanvas.imageUrl} alt="Selected project concept" />
                  <span>{selectedConcept ? "Selected concept" : snapshot.startingRoomMethod === "upload" ? "Your starting room" : "Selected similar room"}</span>
                </div>
              ) : (
                <div className={styles.noConcept}><ImageIcon size={28} /><strong>Your pricing result is ready</strong><small>Visualization did not affect the estimate.</small></div>
              )}
              <div className={styles.visualActions}>
                <input ref={replacePhotoRef} type="file" accept="image/*" capture="environment" hidden onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.currentTarget.value = "";
                  if (file) void uploadPhoto(file, true);
                }} />
                <button type="button" onClick={() => replacePhotoRef.current?.click()} disabled={uploadBusy}>
                  <ImagePlus size={14} /> {snapshot.startingRoomMethod === "upload" ? "Replace photo" : "Use my photo"}
                </button>
                <button type="button" onClick={() => patchSnapshot({ stage: "look" })}><Sparkles size={14} /> Change look</button>
                {snapshot.lead.emailCaptured && resultCanvas ? (
                  <>
                    <button type="button" onClick={openFullscreen}><Expand size={14} /> Full screen</button>
                    <button type="button" onClick={() => void downloadConcept()}><Download size={14} /> Download</button>
                  </>
                ) : null}
              </div>
            </section>
            <aside className={styles.estimatePanel}>
              <section className={styles.rangeCard}>
                <small>{snapshot.lead.emailCaptured ? "Your detailed planning range" : "Your estimated project range"}</small>
                <strong>{rangeText(activeDetailedPricing)}</strong>
                <p>Based on the scope and cost drivers you selected.</p>
              </section>
              <section className={styles.assumptionsCard}>
                <button type="button" className={styles.cardHeading} onClick={() => setDetailsOpen((open) => !open)}>
                  <span><strong>What this includes</strong><small>{planningRange.assumptions.length} pricing assumptions</small></span>
                  <ChevronDown size={16} data-open={detailsOpen ? "true" : "false"} />
                </button>
                <ul className={detailsOpen ? styles.assumptionsOpen : ""}>
                  {planningRange.assumptions.map((assumption) => <li key={assumption}><Check size={13} /> {assumption}</li>)}
                </ul>
                <button type="button" className={styles.editScopeButton} onClick={() => patchSnapshot({ stage: "details" })}>Edit project details</button>
              </section>
              {snapshot.lead.emailCaptured ? (
                <section className={styles.breakdownCard}>
                  <div className={styles.cardHeadingStatic}><strong>Planning breakdown</strong><small>Illustrative allocation</small></div>
                  {breakdown.map(([label, share]) => (
                    <div key={label} className={styles.breakdownRow}>
                      <span>{label}</span>
                      <strong>{formatCurrency(breakdownMidpoint * share, activeDetailedPricing.currency)}</strong>
                    </div>
                  ))}
                  <div className={styles.deliveryStatus} data-status={snapshot.lead.emailStatus}>
                    <Mail size={14} />
                    {snapshot.lead.emailStatus === "sent"
                      ? `Summary sent to ${snapshot.lead.email}`
                      : snapshot.lead.emailStatus === "failed"
                        ? "Estimate saved; email delivery needs attention"
                        : "Saving and preparing your email…"}
                  </div>
                </section>
              ) : (
                <section className={styles.unlockCard}>
                  <Mail size={20} />
                  <div><strong>Unlock the detailed estimate</strong><p>Save concepts, see the breakdown, download the design, and receive your project summary.</p></div>
                  <button type="button" className={styles.primaryButton} onClick={() => setEmailOpen(true)}>Unlock with email</button>
                  <small>No phone number required</small>
                </section>
              )}
              <section className={styles.priceFactors}>
                <div><strong>May increase price</strong>{planningRange.increases.map((item) => <span key={item}>+ {item}</span>)}</div>
                <div><strong>May reduce price</strong>{planningRange.reductions.map((item) => <span key={item}>− {item}</span>)}</div>
              </section>
              {snapshot.lead.emailCaptured ? (
                <section className={styles.consultationCard}>
                  {snapshot.lead.consultationStatus === "requested" ? (
                    <div className={styles.consultationSuccess}><Check size={18} /><span><strong>Consultation requested</strong><small>A project professional can now follow up.</small></span></div>
                  ) : (
                    <>
                      <div><Phone size={18} /><span><strong>Want higher certainty?</strong><small>Request contractor review or a consultation.</small></span></div>
                      <button type="button" className={styles.secondaryButton} onClick={() => setPhoneOpen(true)}>Request review</button>
                    </>
                  )}
                </section>
              ) : null}
              {error ? <div className={styles.errorBanner}>{error}</div> : null}
            </aside>
          </div>
        </main>
      ) : null}

      <EmailGate open={emailOpen} busy={emailBusy} error={emailError} onClose={() => setEmailOpen(false)} onSubmit={captureEmail} />
      <ConsultationGate open={phoneOpen} busy={phoneBusy} error={phoneError} onClose={() => setPhoneOpen(false)} onSubmit={requestConsultation} />
    </div>
  );
}
