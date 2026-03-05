/**
 * StepIntent Metadata System
 * 
 * Controls AI behavior and constraints per StepIntent type.
 * This allows different levels of AI freedom for different stages of the funnel.
 */

import type { StepIntent } from "@/types/ai-form";

export type StepIntentMetadata = {
  /** Max steps DSPy can generate for this intent */
  maxSteps?: number;
  /** Max user questions allowed (context/refinement) */
  maxAIQuestions?: number;
  /** Enforce required fields only (strict schema validation) */
  strictSchema?: boolean;
  /** Allow AI to pick layout/variation */
  aiVariationAllowed?: boolean;
  /** Allow users to edit previous answers */
  allowContextEditing?: boolean;
  /** This intent contributes to persistent context state */
  contextStatePersists?: boolean;
};

/**
 * StepIntent metadata configuration
 * 
 * High AI freedom: collect_context, refine_preferences
 * Low AI freedom: visual_hook, collect_lead, show_pricing, confirmation
 */
export const STEP_INTENT_METADATA: Record<StepIntent, StepIntentMetadata> = {
  collect_context: {
    maxSteps: 25,
    maxAIQuestions: 25,
    strictSchema: false,
    aiVariationAllowed: true,
    allowContextEditing: true,
    contextStatePersists: true,
  },
  refine_preferences: {
    maxSteps: 10,
    maxAIQuestions: 10,
    strictSchema: false,
    aiVariationAllowed: true,
    allowContextEditing: true,
    contextStatePersists: true,
  },
  visual_hook: {
    maxSteps: 1,
    maxAIQuestions: 0,
    strictSchema: true,
    aiVariationAllowed: false,
    allowContextEditing: false,
    contextStatePersists: false,
  },
  collect_lead: {
    maxSteps: 1,
    maxAIQuestions: 0,
    strictSchema: true,
    aiVariationAllowed: false,
    allowContextEditing: false,
    contextStatePersists: false,
  },
  show_pricing: {
    maxSteps: 1,
    maxAIQuestions: 0,
    strictSchema: true,
    aiVariationAllowed: false,
    allowContextEditing: false,
    contextStatePersists: false,
  },
  confirmation: {
    maxSteps: 1,
    maxAIQuestions: 0,
    strictSchema: true,
    aiVariationAllowed: false,
    allowContextEditing: false,
    contextStatePersists: false,
  },
};

/**
 * Get metadata for a specific StepIntent
 */
export function getStepIntentMetadata(stepIntent: StepIntent): StepIntentMetadata {
  return STEP_INTENT_METADATA[stepIntent] || {};
}

/**
 * Check if a StepIntent allows context editing
 */
export function allowsContextEditing(stepIntent: StepIntent): boolean {
  return getStepIntentMetadata(stepIntent).allowContextEditing === true;
}

/**
 * Check if a StepIntent contributes to persistent context
 */
export function persistsContext(stepIntent: StepIntent): boolean {
  return getStepIntentMetadata(stepIntent).contextStatePersists === true;
}

