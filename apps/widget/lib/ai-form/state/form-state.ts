// Form State: derive monotonic milestones (facts) + capabilities (permissions)
// and provide constraints/hints for DSPy step generation.
//
// Design invariants:
// - AI NEVER sets milestones. Milestones are derived only from user actions/data and deterministic rules.
// - Form state provides constraints and hints to DSPy, but DSPy generates all step content.
// - Form state tracks milestones, capabilities, budgets, confidence scores - this drives context for DSPy.

import type { AIFormConfig, ComponentType, StepDefinition, StepIntent } from "@/types/ai-form";
import { buildPromptStateFromStepData } from "../context/prompt-state";
import { STEP_INTENT_METADATA, type StepIntentMetadata } from "./step-intent-metadata";
import { buildContextState, type ContextState } from "./context-state";

export enum FunnelMilestone {
  SERVICE_SELECTED = "SERVICE_SELECTED",
  // Note: you may prefer SUFFICIENT_CONTEXT or CONFIDENCE_THRESHOLD_MET; we keep QUALIFIED_MINIMUM for now.
  QUALIFIED_MINIMUM = "QUALIFIED_MINIMUM",
  ASSETS_AVAILABLE = "ASSETS_AVAILABLE",
  VISUAL_SHOWN = "VISUAL_SHOWN",
  VALUE_EXPERIENCED = "VALUE_EXPERIENCED",
  LEAD_CAPTURED = "LEAD_CAPTURED",
  PRICING_SHOWN = "PRICING_SHOWN",
  CONFIRMED = "CONFIRMED",
}

export type FunnelCapabilities = {
  canAskQuestions: boolean;
  canRequestUploads: boolean;
  canShowDesigner: boolean;
  canRefineDesigner: boolean;
  canShowStage3: boolean;
  canRefineImage: boolean;
  canShowPricingInStage3: boolean;
  canRequestLead: boolean;
  canShowPricing: boolean;
  canConfirm: boolean;
  /** What the *next* AI-generated step should be trying to accomplish (content lane only). */
  currentStepIntent: StepIntent;
};

export type RequiredUpload = {
  stepId: string;
  label: string;
  role: "sceneImage" | "userImage" | "productImage";
  /**
   * Whether the upload is required to proceed.
   * If omitted, UI may treat it as required by default.
   */
  required?: boolean;
  /**
   * Whether the user is allowed to skip the upload.
   * If omitted, UI may infer from `required`.
   */
  allowSkip?: boolean;
};

export type FunnelState = {
  milestones: Set<FunnelMilestone>;
  capabilities: FunnelCapabilities;
  meta: {
    confidence: number;
    qualifyThreshold: number;
    pricingThreshold: number;
    minQuestionsBeforeVisual: number;
    missingUploads: RequiredUpload[];
    pricingAllowed: boolean;
    maxQualifyQuestions: number;
    questionsAnswered: number;
    questionsRemaining: number;
  };
};

function isNonEmpty(v: any) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

function isValidEmail(v: any) {
  if (typeof v !== "string") return false;
  const s = v.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function pickServiceIds(stepDataSoFar: Record<string, any>): string[] {
  const v = stepDataSoFar["step-service-primary"] ?? stepDataSoFar["step-service"];
  if (Array.isArray(v)) return v.map(String).filter(Boolean).slice(0, 5);
  if (typeof v === "string" && v.trim()) return [v.trim()];
  return [];
}

function extractLeadEmail(stepDataSoFar: Record<string, any>): string | null {
  // Prefer the legacy/stable lead step id used across the repo.
  const v = stepDataSoFar["step-lead-capture"];
  if (typeof v === "string" && isValidEmail(v)) return v.trim();
  if (v && typeof v === "object") {
    const maybe = (v as any).email || (v as any).value || (v as any).answer;
    if (isValidEmail(maybe)) return String(maybe).trim();
  }
  // Fallback: find any object-like answer with an email field.
  for (const [_k, val] of Object.entries(stepDataSoFar)) {
    if (!val || typeof val !== "object") continue;
    const maybe = (val as any).email;
    if (isValidEmail(maybe)) return String(maybe).trim();
  }
  return null;
}

function hasConfirmed(stepDataSoFar: Record<string, any>) {
  const v = stepDataSoFar["step-confirmation"];
  if (v && typeof v === "object" && (v as any).confirmed === true) return true;
  return false;
}

function countAnsweredQuestions(stepDataSoFar: Record<string, any>) {
  // Rough heuristic: count user-facing answers, exclude internal __ keys, and exclude structural steps.
  const excludedPrefixes = ["__"];
  const excludedStepIds = new Set([
    "step-pricing-accuracy-consent",
    "step-service",
    "step-service-primary",
    "step-upload-scene-image",
    "step-upload-user-image",
    "step-upload-product-image",
    "step-designer",
    "step-pricing",
    "step-confirmation",
    "step-lead-capture",
    "step-lead-name",
    "step-lead-phone",
  ]);
  let n = 0;
  for (const [k, v] of Object.entries(stepDataSoFar || {})) {
    if (excludedPrefixes.some((p) => k.startsWith(p))) continue;
    if (excludedStepIds.has(k)) continue;
    if (!isNonEmpty(v)) continue;
    n++;
  }
  return n;
}

export function deriveFunnelState(params: {
  stepDataSoFar: Record<string, any>;
  aiFormConfig: AIFormConfig;
  useCase: "tryon" | "scene-placement" | "scene";
  requiredUploads: RequiredUpload[];
  subcategoryName?: string | null;
}): FunnelState {
  const stepDataSoFar = params.stepDataSoFar || {};
  const cfg = params.aiFormConfig || {};
  // TEMPORARILY DISABLED: Form-level upload step removed. Upload happens inside ImagePreviewExperience only.
  const requiredUploads: RequiredUpload[] = []; // params.requiredUploads || [];

  const ps = buildPromptStateFromStepData({
    stepDataSoFar,
    extra: { useCase: params.useCase, subcategoryName: params.subcategoryName ?? null },
  });
  const confidence = ps.confidence || 0;

  const qualifyThreshold = typeof cfg.minConfidenceForUploads === "number" ? cfg.minConfidenceForUploads : 0.35;
  const pricingThreshold = typeof cfg.minConfidenceForPricing === "number" ? cfg.minConfidenceForPricing : 0.6;
  const maxQualifyQuestions = typeof (cfg as any).maxQualifyQuestions === "number" ? Number((cfg as any).maxQualifyQuestions) : 4;
  const minQuestionsBeforeVisual =
    typeof (cfg as any).minQuestionsBeforeVisual === "number" ? Number((cfg as any).minQuestionsBeforeVisual) : 3;

  const serviceIds = pickServiceIds(stepDataSoFar);
  const serviceSelected = serviceIds.length > 0;

  const missingUploads = (requiredUploads || []).filter((u) => !isNonEmpty(stepDataSoFar[u.stepId]));
  const assetsAvailable = missingUploads.length === 0;

  const visualShown = Boolean(stepDataSoFar["step-designer"]) || Boolean(stepDataSoFar["__hasDesigner"]);
  const pricingShown = Boolean(stepDataSoFar["step-pricing"]) || Boolean(stepDataSoFar["__hasPricing"]);
  const leadEmail = extractLeadEmail(stepDataSoFar);
  const leadCaptured = Boolean(leadEmail);
  const confirmed = hasConfirmed(stepDataSoFar);

  // "Value experienced" is the psychological moment the user got something tangible.
  const valueExperienced = visualShown || pricingShown;

  const questionsAnswered = countAnsweredQuestions(stepDataSoFar);
  const questionsRemaining = Math.max(0, maxQualifyQuestions - questionsAnswered);

  // QUALIFIED_MINIMUM can be satisfied by confidence OR by exhausting the question budget.
  // This prevents dead-ends when confidence remains low but we still need to progress.
  const qualifiedMinimum = confidence >= qualifyThreshold || (serviceSelected && questionsRemaining === 0);

  // Pricing is "enabled at all" if visibility + mode allow it.
  // NOTE: We enforce the pricing-after-lead invariant elsewhere (canShowPricing requires leadCaptured).
  const pricingAllowed = (cfg.pricingVisibility ?? "never") !== "never" && (cfg.pricingMode ?? "hidden") !== "hidden";

  const milestones = new Set<FunnelMilestone>();
  if (serviceSelected) milestones.add(FunnelMilestone.SERVICE_SELECTED);
  if (qualifiedMinimum) milestones.add(FunnelMilestone.QUALIFIED_MINIMUM);
  if (assetsAvailable) milestones.add(FunnelMilestone.ASSETS_AVAILABLE);
  if (visualShown) milestones.add(FunnelMilestone.VISUAL_SHOWN);
  if (valueExperienced) milestones.add(FunnelMilestone.VALUE_EXPERIENCED);
  if (leadCaptured) milestones.add(FunnelMilestone.LEAD_CAPTURED);
  if (pricingShown) milestones.add(FunnelMilestone.PRICING_SHOWN);
  if (confirmed) milestones.add(FunnelMilestone.CONFIRMED);

  // Step goal selection (AI-visible): this is NOT a flow controller; it is guidance for content generation.
  const currentStepIntent: StepIntent = (() => {
    if (!serviceSelected) return "collect_context";
    if (!valueExperienced) return "refine_preferences";
    if (!leadCaptured) return "collect_lead";
    if (!pricingShown && pricingAllowed) return "show_pricing";
    return "confirmation";
  })();

  const canAskQuestions = !confirmed && questionsRemaining > 0 && !leadCaptured && !valueExperienced;
  const canRequestUploads = serviceSelected && qualifiedMinimum && !assetsAvailable && (requiredUploads || []).length > 0;
  
  // COLD-START ESCAPE HATCH: If satiety/confidence is low but user has answered several questions,
  // allow showing designer anyway to prevent frustration.
  const answeredContextQuestions = questionsAnswered;
  const isStrugglingToQualify = answeredContextQuestions >= 5 && confidence < qualifyThreshold;
  
  const canShowDesigner =
    serviceSelected && 
    (qualifiedMinimum || isStrugglingToQualify) && 
    assetsAvailable && 
    !visualShown && 
    questionsAnswered >= minQuestionsBeforeVisual;
    
    const canRefineDesigner = Boolean((cfg as any).allowRefinement) && valueExperienced && !leadCaptured;
    
    // Stage 3 capabilities
    const canShowStage3 = visualShown && valueExperienced; // Can show Stage 3 after initial image
    const canRefineImage = visualShown && valueExperienced && !leadCaptured; // Can refine before lead capture
    const canShowPricingInStage3 = visualShown && (pricingShown || leadCaptured); // Show pricing if already shown or lead captured
  const canRequestLead = serviceSelected && milestones.has(FunnelMilestone.VALUE_EXPERIENCED) && !leadCaptured && cfg.leadCaptureRequired !== false;
  const canShowPricing = leadCaptured && !pricingShown && pricingAllowed && confidence >= pricingThreshold;
  const canConfirm = leadCaptured && !confirmed && (pricingShown || !pricingAllowed);

  return {
    milestones,
    capabilities: {
      canAskQuestions,
      canRequestUploads,
      canShowDesigner,
      canRefineDesigner,
      canShowStage3,
      canRefineImage,
      canShowPricingInStage3,
      canRequestLead,
      canShowPricing,
      canConfirm,
      currentStepIntent,
    },
    meta: {
      confidence,
      qualifyThreshold,
      pricingThreshold,
      minQuestionsBeforeVisual,
      missingUploads,
      pricingAllowed,
      maxQualifyQuestions,
      questionsAnswered,
      questionsRemaining,
    },
  };
}

export function getAllowedComponentTypes(params: {
  state: FunnelState;
}): ComponentType[] {
  const { state } = params;

  const questionTypes: ComponentType[] = [
    "choice",
    "segmented_choice",
    "chips_multi",
    "yes_no",
    "slider",
    "image_choice_grid",
  ];

  const allowed: ComponentType[] = [];

  // Add question types when allowed
  if (state.capabilities.canRefineDesigner || state.capabilities.canAskQuestions) {
    allowed.push(...questionTypes);
  }

  // Add structural step types when capabilities allow (DSPy will generate them)
  if (state.capabilities.canRequestUploads) {
    allowed.push("upload");
  }
  if (state.capabilities.canShowDesigner) {
    allowed.push("designer");
  }
  if (state.capabilities.canRequestLead) {
    allowed.push("lead_capture");
  }
  if (state.capabilities.canShowPricing) {
    allowed.push("pricing");
  }
  if (state.capabilities.canConfirm) {
    allowed.push("confirmation");
  }

  return allowed;
}

export function isStepAllowed(params: {
  step: StepDefinition;
  allowedComponentTypes: ComponentType[];
  avoidStepIds: string[];
}): boolean {
  const { step, allowedComponentTypes, avoidStepIds } = params;
  if (!step?.id || typeof step.id !== "string") return false;
  if (avoidStepIds.includes(step.id)) return false;
  if (!allowedComponentTypes.includes(step.componentType)) return false;

  // All component types are allowed if they're in allowedComponentTypes
  // (structural steps are now allowed when capabilities permit)
  return true;
}

/**
 * Generate a hint/template for DSPy when generating an upload step.
 * This is guidance only - DSPy generates the actual step content.
 */
export function getStepHintForUpload(u: RequiredUpload): Partial<StepDefinition> {
  return {
    componentType: "upload",
    intent: `Upload ${u.role}`,
    data: {
      maxFiles: 1,
      accept: { "image/*": [] },
      uploadRole: u.role,
    },
    copy: {
      headline: "", // Let DSPy generate dynamically
      subtext: "", // Let DSPy generate dynamically
    },
    intentV2: { goal: "qualify", stepIntent: "collect_context", confidenceImpact: 0.2, chunk: "anchors" },
  };
}


/**
 * Generate a hint/template for DSPy when generating a designer step.
 * This is guidance only - DSPy generates the actual step content.
 */
export function getStepHintForDesigner(): Partial<StepDefinition> {
  return {
    componentType: "designer",
    intent: "Generate visual design",
    data: {
      // UI will auto-generate on entry.
      allowRefinements: true,
    },
    copy: {
      headline: "", // Let DSPy generate dynamically
      subtext: "", // Let DSPy generate dynamically
    },
    intentV2: { goal: "visual_hook", stepIntent: "visual_hook", confidenceImpact: 0.25, chunk: "style" },
  };
}


/**
 * Generate a hint/template for DSPy when generating a lead capture step.
 * This is guidance only - DSPy generates the actual step content.
 */
export function getStepHintForLead(mode: "email" | "name" | "phone", requiredInputs: string[]): Partial<StepDefinition> {
  return {
    componentType: "lead_capture",
    intent: `Capture ${mode}`,
    data: {
      mode,
      requiredInputs,
      compact: true,
    },
    copy: {
      headline: "", // Let DSPy generate dynamically
      subtext: "", // Let DSPy generate dynamically
    },
    intentV2: { goal: "convert", stepIntent: "collect_lead", confidenceImpact: 0.1, chunk: "lead" },
  };
}


/**
 * Generate a hint/template for DSPy when generating a pricing step.
 * This is guidance only - DSPy generates the actual step content.
 */
export function getStepHintForPricing(cfg: AIFormConfig): Partial<StepDefinition> {
  const pricingMode = cfg.pricingMode ?? "range";
  return {
    componentType: "pricing",
    intent: "Show pricing",
    data: {
      pricingMode,
      // Placeholder: PricingStep currently can render static pricing.
      // A later rollout can fill this from a pricing service.
    },
    copy: {
      headline: "", // Let DSPy generate dynamically
      subtext: "", // Let DSPy generate dynamically
    },
    intentV2: { goal: "convert", stepIntent: "show_pricing", confidenceImpact: 0.1, chunk: "pricing" },
  };
}


/**
 * Generate a hint/template for DSPy when generating a confirmation step.
 * This is guidance only - DSPy generates the actual step content.
 */
export function getStepHintForConfirmation(): Partial<StepDefinition> {
  return {
    componentType: "confirmation",
    intent: "Review and confirm",
    data: {
      // Placeholder; instances can override with step.data.scheduleUrl for external scheduling (Calendly, etc.)
      scheduleUrl: "https://calendly.com/demo",
    },
    copy: {
      headline: "", // Let DSPy generate dynamically
      subtext: "", // Let DSPy generate dynamically
    },
    intentV2: { goal: "confirm", stepIntent: "confirmation", confidenceImpact: 0.0, chunk: "lead" },
  };
}


function buildAnchorStep(params: { id: string; headline: string; options: Array<{ label: string; value: string }> }): StepDefinition {
  return {
    id: params.id,
    componentType: "choice",
    intent: params.headline,
    data: { options: params.options, multiple: false },
    copy: { headline: "", subtext: "" }, // Let DSPy generate dynamically
    intentV2: { goal: "qualify", stepIntent: "refine_preferences", confidenceImpact: 0.12, chunk: "anchors" },
  };
}

/**
 * Get form state constraints and hints for DSPy step generation.
 * This provides all the context DSPy needs to generate the next step fully informed.
 * 
 * The state machine drives context - all state (milestones, capabilities, budgets, confidence)
 * is passed to DSPy so it generates fully informed steps.
 */
export function getFormStateConstraints(params: {
  state: FunnelState;
  stepDataSoFar: Record<string, any>;
  aiFormConfig: AIFormConfig;
  requiredUploads: RequiredUpload[];
  steps?: StepDefinition[];
  extra?: { useCase?: string; subcategoryName?: string | null };
}): {
  allowedComponentTypes: ComponentType[];
  requiredStepIntent?: StepIntent;
  stepHints: Partial<StepDefinition>[];
  milestoneGates: {
    milestones: FunnelMilestone[];
    capabilities: FunnelCapabilities;
  };
  formStateContext: {
    confidence: number;
    qualifyThreshold: number;
    pricingThreshold: number;
    questionsAnswered: number;
    questionsRemaining: number;
    maxQualifyQuestions: number;
    minQuestionsBeforeVisual: number;
  };
  stepIntentMetadata: Record<StepIntent, StepIntentMetadata>;
  contextState: ContextState;
} {
  const { state, stepDataSoFar, aiFormConfig, requiredUploads, steps = [], extra } = params;

  const allowedComponentTypes = getAllowedComponentTypes({ state });
  const stepHints: Partial<StepDefinition>[] = [];
  let requiredStepIntent: StepIntent | undefined;

  // Determine if a structural step is required and provide hints
  if (state.capabilities.canRequestUploads) {
    const nextMissing = state.meta.missingUploads[0] || requiredUploads[0];
    if (nextMissing) {
      requiredStepIntent = "collect_context";
      stepHints.push(getStepHintForUpload(nextMissing));
    }
  } else if (state.capabilities.canShowDesigner) {
    requiredStepIntent = "visual_hook";
    stepHints.push(getStepHintForDesigner());
  } else if (state.capabilities.canRequestLead) {
    requiredStepIntent = "collect_lead";
    const required = Array.isArray(aiFormConfig.requiredInputs) && aiFormConfig.requiredInputs.length > 0 ? aiFormConfig.requiredInputs : ["email"];
    const email = extractLeadEmail(stepDataSoFar);
    const hasName = isNonEmpty(stepDataSoFar["step-lead-name"]);
    const hasPhone = isNonEmpty(stepDataSoFar["step-lead-phone"]);

    // Provide hints for the next required lead field
    if (!email) {
      stepHints.push(getStepHintForLead("email", ["email"]));
    } else if (required.includes("name") && !hasName) {
      stepHints.push(getStepHintForLead("name", ["name"]));
    } else if (required.includes("phone") && !hasPhone) {
      stepHints.push(getStepHintForLead("phone", ["phone_optional"]));
    }
  } else if (state.capabilities.canShowPricing) {
    requiredStepIntent = "show_pricing";
    stepHints.push(getStepHintForPricing(aiFormConfig));
  } else if (state.capabilities.canConfirm) {
    requiredStepIntent = "confirmation";
    stepHints.push(getStepHintForConfirmation());
  }

  // Build context state from step data
  const contextState = buildContextState({
    stepDataSoFar,
    steps,
    extra,
  });

  return {
    allowedComponentTypes,
    requiredStepIntent,
    stepHints,
    milestoneGates: {
      milestones: Array.from(state.milestones),
      capabilities: state.capabilities,
    },
    formStateContext: {
      confidence: state.meta.confidence,
      qualifyThreshold: state.meta.qualifyThreshold,
      pricingThreshold: state.meta.pricingThreshold,
      questionsAnswered: state.meta.questionsAnswered,
      questionsRemaining: state.meta.questionsRemaining,
      maxQualifyQuestions: state.meta.maxQualifyQuestions,
      minQuestionsBeforeVisual: state.meta.minQuestionsBeforeVisual,
    },
    stepIntentMetadata: STEP_INTENT_METADATA,
    contextState,
  };
}


// NOTE: We intentionally removed all "safe fallback step" generation.
// If DSPy cannot generate a valid next step inside allowed component types, the server should hard-fail.
