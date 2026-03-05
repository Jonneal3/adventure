// Prompt state: latent preference + constraint model for visual-first form flows.
// This file is intentionally dependency-light so it can run both server-side (flow planner)
// and client-side (designer prompt construction).

import type { StepDefinition, StepIntent } from "@/types/ai-form";
import { persistsContext } from "../state/step-intent-metadata";

export type PromptEvidence =
  | { type: "service_selected"; value: string | string[] }
  | { type: "anchor"; key: string; value: any }
  | { type: "reference_visual"; value: string | string[] }
  | { type: "comparative_visual"; value: string | string[] }
  | { type: "upload_present"; role: "sceneImage" | "userImage" | "productImage" }
  | { type: "freeform"; note: string };

export type PromptState = {
  hard_constraints: Array<{ key: string; value: any }>;
  soft_preferences: Array<{ key: string; value: any }>;
  exclusions: Array<{ key: string; value: any }>;
  weights: Record<string, number>;
  confidence: number; // system certainty that generation/pricing will be meaningful (not user certainty)
  evidence: PromptEvidence[];
};

export function initPromptState(): PromptState {
  return {
    hard_constraints: [],
    soft_preferences: [],
    exclusions: [],
    weights: {},
    confidence: 0,
    evidence: [],
  };
}

function upsertKV(arr: Array<{ key: string; value: any }>, key: string, value: any) {
  const idx = arr.findIndex((x) => x.key === key);
  if (idx >= 0) arr[idx] = { key, value };
  else arr.push({ key, value });
}

function clamp01(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function isNonEmpty(v: any) {
  if (v === null || v === undefined) return false;
  if (typeof v === "string") return v.trim().length > 0;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}

export function applyAnswerToPromptState(params: {
  state: PromptState;
  stepId: string;
  step?: StepDefinition | null;
  answer: any;
}) {
  const { state, stepId, step, answer } = params;
  if (!isNonEmpty(answer)) return state;

  // Explicitly ignore "framing" steps that shouldn't influence prompt construction.
  if (stepId === "step-pricing-accuracy-consent") {
    return state;
  }

  // Service selection (Phase 0)
  if (stepId === "step-service" || stepId === "step-service-primary") {
    state.evidence.push({ type: "service_selected", value: answer });
    // Keep as soft preference; it primarily scopes the space.
    upsertKV(state.soft_preferences, "service", answer);
    state.weights.service = Math.max(state.weights.service ?? 0, 0.9);
    return state;
  }

  // Styleboard (Phase 2): reference visuals (no generation)
  if (stepId === "step-styleboard" || stepId.startsWith("step-styleboard-")) {
    state.evidence.push({ type: "reference_visual", value: answer });
    upsertKV(state.soft_preferences, "styleboard_choice", answer);
    state.weights.styleboard_choice = Math.max(state.weights.styleboard_choice ?? 0, 1.0);
    return state;
  }

  // Post-designer A/B refinement (Phase 6): comparative visuals
  if (stepId === "step-refine-visual") {
    state.evidence.push({ type: "comparative_visual", value: answer });
    upsertKV(state.soft_preferences, "refine_choice", answer);
    state.weights.refine_choice = Math.max(state.weights.refine_choice ?? 0, 0.8);
    return state;
  }

  // Upload steps (Phase 4)
  if (step?.componentType === "upload") {
    const role = (step.data as any)?.uploadRole as ("sceneImage" | "userImage" | "productImage") | undefined;
    if (role) state.evidence.push({ type: "upload_present", role });
    upsertKV(state.hard_constraints, stepId, "[uploaded]");
    state.weights.upload = Math.max(state.weights.upload ?? 0, 1.0);
    return state;
  }

  // Anchors (Phase 1): we keep this generic, keyed off stepId.
  // You can later make this domain-specific per subcategory.
  if (stepId.startsWith("step-anchor-")) {
    const key = stepId.replace(/^step-anchor-/, "");
    state.evidence.push({ type: "anchor", key, value: answer });
    // Treat anchors as “semi-hard”: they constrain meaningfully but may be revisited.
    upsertKV(state.soft_preferences, key, answer);
    state.weights[key] = Math.max(state.weights[key] ?? 0, 0.7);
    return state;
  }

  // Generic fallback: store as previousAnswers-derived signal.
  if (step?.intent) {
    const key = step.intent;
    upsertKV(state.soft_preferences, key, answer);
    state.weights[key] = Math.max(state.weights[key] ?? 0, 0.35);
  }
  return state;
}

export function buildPromptState(params: {
  steps: StepDefinition[];
  stepDataSoFar: Record<string, any>;
  extra?: { useCase?: string; subcategoryName?: string | null };
}): PromptState {
  const state = initPromptState();
  const byId = new Map<string, StepDefinition>(params.steps.map((s) => [s.id, s]));

  for (const [stepId, answer] of Object.entries(params.stepDataSoFar || {})) {
    if (stepId.startsWith("__")) continue; // reserved/internal keys
    const step = byId.get(stepId) || null;
    applyAnswerToPromptState({ state, stepId, step, answer });
  }

  // Add a small amount of context to evidence (useful for DSPy/debugging)
  if (params.extra?.useCase) {
    state.evidence.push({ type: "freeform", note: `use_case=${String(params.extra.useCase)}` });
  }
  if (params.extra?.subcategoryName) {
    state.evidence.push({ type: "freeform", note: `subcategory=${String(params.extra.subcategoryName)}` });
  }

  state.confidence = computeConfidence(state);
  return state;
}

/**
 * Server-friendly builder when you only have stepDataSoFar (no step definitions).
 * This is sufficient for confidence gating + DSPy context.
 * 
 * Enhanced to support context state integration - can filter to only context-persisting steps.
 */
export function buildPromptStateFromStepData(params: {
  stepDataSoFar: Record<string, any>;
  extra?: { useCase?: string; subcategoryName?: string | null };
  steps?: StepDefinition[];
  onlyContextPersisting?: boolean;
}): PromptState {
  const state = initPromptState();
  const stepDataSoFar = params.stepDataSoFar || {};
  const steps = params.steps || [];
  const onlyContextPersisting = params.onlyContextPersisting === true;

  // Create step map for lookup
  const stepMap = new Map<string, StepDefinition>(steps.map((s) => [s.id, s]));

  for (const [stepId, answer] of Object.entries(stepDataSoFar)) {
    if (stepId.startsWith("__")) continue;

    // If filtering to context-persisting steps only, check step intent
    if (onlyContextPersisting) {
      const step = stepMap.get(stepId);
      if (step) {
        const stepIntent = step.intentV2?.stepIntent;
        if (stepIntent && !persistsContext(stepIntent)) {
          continue; // Skip non-context-persisting steps
        }
      }
    }

    // Upload role inference from known IDs.
    if (stepId === "step-upload-scene-image") {
      if (isNonEmpty(answer)) state.evidence.push({ type: "upload_present", role: "sceneImage" });
      if (isNonEmpty(answer)) upsertKV(state.hard_constraints, stepId, "[uploaded]");
      continue;
    }
    if (stepId === "step-upload-user-image") {
      if (isNonEmpty(answer)) state.evidence.push({ type: "upload_present", role: "userImage" });
      if (isNonEmpty(answer)) upsertKV(state.hard_constraints, stepId, "[uploaded]");
      continue;
    }
    if (stepId === "step-upload-product-image") {
      if (isNonEmpty(answer)) state.evidence.push({ type: "upload_present", role: "productImage" });
      if (isNonEmpty(answer)) upsertKV(state.hard_constraints, stepId, "[uploaded]");
      continue;
    }

    const step = stepMap.get(stepId) || null;
    applyAnswerToPromptState({ state, stepId, step, answer });
  }

  if (params.extra?.useCase) state.evidence.push({ type: "freeform", note: `use_case=${String(params.extra.useCase)}` });
  if (params.extra?.subcategoryName) state.evidence.push({ type: "freeform", note: `subcategory=${String(params.extra.subcategoryName)}` });

  state.confidence = computeConfidence(state);
  return state;
}

export function computeConfidence(state: PromptState): number {
  // Confidence is system certainty that generation/pricing will be meaningful.
  // Not user certainty.
  let c = 0;

  const hasService = state.soft_preferences.some((x) => x.key === "service" && isNonEmpty(x.value));
  if (hasService) c += 0.25;

  // Anchors: count a few key anchors if present.
  const anchorKeys = new Set(state.soft_preferences.map((x) => x.key));
  const anchorHits = ["context", "goal", "style", "budget"].filter((k) => anchorKeys.has(k)).length;
  c += Math.min(0.35, anchorHits * 0.12);

  const hasStyleboard = state.soft_preferences.some((x) => x.key === "styleboard_choice" && isNonEmpty(x.value));
  if (hasStyleboard) c += 0.25;

  // Uploads are “high certainty” for generation feasibility.
  const hasAnyUpload = state.hard_constraints.some((x) => String(x.value) === "[uploaded]");
  if (hasAnyUpload) c += 0.15;

  // A/B refinement indicates engaged feedback loop (helps quoting + iteration).
  const hasRefine = state.soft_preferences.some((x) => x.key === "refine_choice" && isNonEmpty(x.value));
  if (hasRefine) c += 0.1;

  return clamp01(c);
}

export function toDSPyContext(state: PromptState) {
  // Keep this small and stable; DSPy should not receive huge blobs.
  return {
    hard_constraints: state.hard_constraints,
    soft_preferences: state.soft_preferences,
    exclusions: state.exclusions,
    weights: state.weights,
    confidence: state.confidence,
    evidence: state.evidence.slice(-12),
  };
}

