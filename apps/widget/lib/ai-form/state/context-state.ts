/**
 * Context State Management
 * 
 * Tracks accumulated context that persists through the form funnel.
 * Context entries are editable and contribute to the image generation prompt.
 */

import type { StepIntent, StepDefinition, FormPlanItem, UIStep } from "@/types/ai-form";
import type { PromptState } from "../context/prompt-state";
import { buildPromptStateFromStepData } from "../context/prompt-state";
import { STEP_INTENT_METADATA, persistsContext, allowsContextEditing } from "./step-intent-metadata";
import { computeSatietyFromStepData, normalizePlanWeights } from "@/lib/ai-form/satiety";

// Constants for satiety and adaptive questioning
// Single source of truth: the whole system should use the same threshold.
// Threshold for when we consider the planning phase complete and are ready to proceed
// to the deterministic “upload → generate” flow.
//
// Product requirement: satiety must be 100% (all planned questions answered) before
// we show the uploader / generate images.
export const IMAGE_GEN_THRESHOLD = 1.0;
export const LOW_CONFIDENCE_THRESHOLD = 0.4; // Below this, ask big picture questions
export const MEDIUM_CONFIDENCE_THRESHOLD = 0.7; // Above this, ask drill-down questions
export const FRICTION_THRESHOLD = 2; // Max sum of friction in last 2 steps

export type ContextEntry = {
  stepId: string;
  stepIntent: StepIntent;
  question: string;
  answer: any;
  /** Semantic slot mapping (e.g., "material", "style", "budget") */
  slot?: string;
  /** Normalized value for the slot */
  normalizedValue?: any;
  /** AI normalization confidence (0.0-1.0) */
  confidence: number;
  /** How the answer was normalized */
  normalizedBy: "ai" | "deterministic" | "none";
  timestamp: number;
  editable: boolean;
  confidenceImpact: number;
};

export type ContextState = {
  entries: ContextEntry[];
  promptState: PromptState;
  confidence: number;
  isComplete: boolean;
  canEdit: boolean;
  /** Satiety metric: answered plan items / total plan items (0.0-1.0) */
  satiety?: number;
};

// NOTE: satiety scoring is centralized in `lib/ai-form/satiety.ts`

/**
 * Normalize FormPlan importance weights so 100% is reachable.
 * - Clamp each weight to [0,1]
 * - If sum <= 0, fall back to uniform weights
 * - Renormalize so sum(weights) = 1.0
 */
export function normalizeFormPlanWeights(formPlan: FormPlanItem[]): FormPlanItem[] {
  return normalizePlanWeights(formPlan);
}

/**
 * Build context state from step data and step definitions
 */
export function buildContextState(params: {
  stepDataSoFar: Record<string, any>;
  steps: (StepDefinition | UIStep)[];
  metadata?: typeof STEP_INTENT_METADATA;
  extra?: { useCase?: string; subcategoryName?: string | null };
}): ContextState {
  const { stepDataSoFar, steps, metadata = STEP_INTENT_METADATA, extra } = params;
  
  // Create a map of step definitions by ID
  const stepMap = new Map<string, StepDefinition | UIStep>(steps.map((s) => [s.id, s]));
  
  // Filter stepData to only include context-persisting steps
  const contextEntries: ContextEntry[] = [];
  const contextStepData: Record<string, any> = {};
  
  for (const [stepId, answer] of Object.entries(stepDataSoFar || {})) {
    // Skip internal/reserved keys
    if (stepId.startsWith("__")) continue;
    
    const step = stepMap.get(stepId);
    if (!step) continue;
    
    // Derived or explicit intent
    let stepIntent: StepIntent | undefined;
    let question = "";
    let confidenceImpact = 0.1;

    if ('type' in step && !('componentType' in step)) {
      // NEW: UIStep (shared contract) - default to collect_context
      stepIntent = "collect_context";
      question = String((step as UIStep).question || stepId);
      confidenceImpact = (step as UIStep).metric_gain || 0.12;
    } else {
      // LEGACY: StepDefinition
      const legacyStep = step as StepDefinition;
      stepIntent = legacyStep.intentV2?.stepIntent as StepIntent;
      question = legacyStep.copy?.headline || legacyStep.intent || stepId;
      confidenceImpact = legacyStep.intentV2?.confidenceImpact || 0.1;
    }

    if (!stepIntent) continue;
    
    // Only include steps that persist context
    if (!persistsContext(stepIntent)) continue;
    
    // Only include steps with non-empty answers
    if (answer === null || answer === undefined) continue;
    if (typeof answer === "string" && answer.trim().length === 0) continue;
    if (Array.isArray(answer) && answer.length === 0) continue;
    if (typeof answer === "object" && Object.keys(answer).length === 0) continue;
    
    const editable = allowsContextEditing(stepIntent);
    
    contextEntries.push({
      stepId,
      stepIntent,
      question,
      answer,
      slot: stepId.replace(/^step-/, ""), // Default slot from ID
      confidence: 1.0, // Default for deterministic choices
      normalizedBy: "deterministic",
      timestamp: Date.now(),
      editable,
      confidenceImpact,
    });
    
    // Include in context step data for prompt state building
    contextStepData[stepId] = answer;
  }
  
  // Build prompt state from context entries
  const promptState = buildPromptStateFromStepData({
    stepDataSoFar: contextStepData,
    extra,
  });
  
  const confidence = promptState.confidence;
  
  // Determine if context collection is complete
  // This is a heuristic - could be enhanced with more sophisticated logic
  const isComplete = confidence >= 0.6 || contextEntries.length >= 10;
  
  // Can edit if any entry is editable
  const canEdit = contextEntries.some((e) => e.editable);
  
  // Note: satiety will be calculated separately using calculateSatiety() when formPlan is available
  // We don't calculate it here because we need the formPlan to know importance_weight values
  
  return {
    entries: contextEntries,
    promptState,
    confidence,
    isComplete,
    canEdit,
  };
}

/**
 * Update a context entry
 */
export function updateContextEntry(
  contextState: ContextState,
  stepId: string,
  newAnswer: any,
  steps: (StepDefinition | UIStep)[],
  extra?: { useCase?: string; subcategoryName?: string | null }
): ContextState {
  const entryIndex = contextState.entries.findIndex((e) => e.stepId === stepId);
  if (entryIndex === -1) {
    // Entry doesn't exist, return unchanged
    return contextState;
  }
  
  const entry = contextState.entries[entryIndex];
  if (!entry.editable) {
    // Entry is not editable, return unchanged
    return contextState;
  }
  
  // Create updated entries array
  const updatedEntries = [...contextState.entries];
  updatedEntries[entryIndex] = {
    ...entry,
    answer: newAnswer,
    timestamp: Date.now(),
  };
  
  // Rebuild context step data
  const contextStepData: Record<string, any> = {};
  for (const e of updatedEntries) {
    contextStepData[e.stepId] = e.answer;
  }
  
  // Rebuild prompt state
  const promptState = buildPromptStateFromStepData({
    stepDataSoFar: contextStepData,
    extra,
  });
  
  const confidence = promptState.confidence;
  const isComplete = confidence >= 0.6 || updatedEntries.length >= 10;
  
  return {
    entries: updatedEntries,
    promptState,
    confidence,
    isComplete,
    canEdit: updatedEntries.some((e) => e.editable),
  };
}

/**
 * Remove a context entry
 */
export function removeContextEntry(
  contextState: ContextState,
  stepId: string,
  steps: (StepDefinition | UIStep)[],
  extra?: { useCase?: string; subcategoryName?: string | null }
): ContextState {
  const entryIndex = contextState.entries.findIndex((e) => e.stepId === stepId);
  if (entryIndex === -1) {
    return contextState;
  }
  
  const entry = contextState.entries[entryIndex];
  if (!entry.editable) {
    // Entry is not editable, return unchanged
    return contextState;
  }
  
  // Remove entry
  const updatedEntries = contextState.entries.filter((e) => e.stepId !== stepId);
  
  // Rebuild context step data
  const contextStepData: Record<string, any> = {};
  for (const e of updatedEntries) {
    contextStepData[e.stepId] = e.answer;
  }
  
  // Rebuild prompt state
  const promptState = buildPromptStateFromStepData({
    stepDataSoFar: contextStepData,
    extra,
  });
  
  const confidence = promptState.confidence;
  const isComplete = confidence >= 0.6 || updatedEntries.length >= 10;
  
  return {
    entries: updatedEntries,
    promptState,
    confidence,
    isComplete,
    canEdit: updatedEntries.some((e) => e.editable),
  };
}

/**
 * Get context entries for a specific StepIntent
 */
export function getContextEntriesByIntent(
  contextState: ContextState,
  stepIntent: StepIntent
): ContextEntry[] {
  return contextState.entries.filter((e) => e.stepIntent === stepIntent);
}

/**
 * Calculate satiety metric: answered plan items / total plan items.
 * This determines if we have enough context to generate an image.
 * 
 * @param contextState - Current context state with answered questions
 * @param formPlan - Complete form plan with all question intents
 * @returns Satiety calculation result
 */
export function calculateSatiety(
  contextState: ContextState,
  formPlan: FormPlanItem[]
): {
  satiety: number; // Answered / total plan items
  missingHighImpact: FormPlanItem[]; // Unanswered high-impact questions
  readyForImageGen: boolean; // Unlock ONLY when all planned questions are answered (100% satiety)
} {
  const stepDataSoFar: Record<string, any> = {};
  for (const e of contextState.entries || []) stepDataSoFar[e.stepId] = e.answer;
  return calculateSatietyFromStepData(stepDataSoFar, formPlan);
}

/**
 * Calculate satiety from raw step answers (monotonic).
 * This is the preferred computation because it counts *every answered plan step*,
 * independent of StepIntent metadata/persistence rules.
 */
export function calculateSatietyFromStepData(
  stepDataSoFar: Record<string, any>,
  formPlan: FormPlanItem[]
): {
  satiety: number;
  missingHighImpact: FormPlanItem[];
  readyForImageGen: boolean;
} {
  const res = computeSatietyFromStepData(stepDataSoFar || {}, formPlan || []);

  // Back-compat: code expects "missingHighImpact" (used to decide what to prioritize next).
  // We now define it as "highest-weight missing plan items", which is simpler and deterministic.
  const missingHighImpact = res.missingItemsSorted.slice(0, 10);
  const readyForImageGen = res.ready && res.satiety >= IMAGE_GEN_THRESHOLD;

  return { satiety: res.satiety, missingHighImpact, readyForImageGen };
}
