/**
 * Step Variation Schema
 * 
 * Defines the type system for step variations - allowing DSPy to choose
 * between different component compositions for the same StepIntent.
 */

import type { ComponentType, StepIntent } from "@/types/ai-form";
export type { StepIntent } from "@/types/ai-form";

/**
 * Component tree node - maps directly to existing step components
 * This represents the structure of components that will be rendered
 */
export type ComponentTreeNode = {
  /** Component name (LeadCaptureStep, ChoiceStep, SliderStep, etc.) */
  type: string;
  /** Props DSPy should fill in */
  props?: Record<string, any>;
  /** For composite components */
  children?: ComponentTreeNode[];
  /** Sub-variation identifier (optional) */
  variation?: string;
};

/**
 * Variation definition - a specific way to render a StepIntent
 */
export interface StepVariation {
  /** Unique identifier (e.g., "simple_email", "modal", "embedded_with_slider") */
  id: string;
  /** Human-readable name */
  name: string;
  /** When to use this variation */
  description: string;
  /** Primary component type */
  componentType: ComponentType;
  /** Component structure */
  componentTree: ComponentTreeNode;
  /** Schema constraints for DSPy generation */
  schema: {
    /** Fields DSPy must provide */
    requiredFields: string[];
    /** Optional fields */
    optionalFields?: string[];
    /** Validation rules */
    validation?: Record<string, any>;
  };
  /** Layout hints for rendering */
  layoutHints?: {
    layout?: "modal" | "inline" | "embedded" | "fullscreen";
    density?: "compact" | "comfortable" | "spacious";
    emphasis?: "visual" | "text" | "balanced";
  };
  /** UX characteristics */
  uxCharacteristics?: {
    friction?: "low" | "medium" | "high";
    focus?: "high" | "medium" | "low";
    /** Expected time in milliseconds */
    timeBudget?: number;
  };
}

/**
 * StepIntent catalog - all variations for a specific StepIntent
 */
export interface StepIntentCatalog {
  stepIntent: StepIntent;
  variations: StepVariation[];
  metadata: {
    description: string;
    typicalUseCases: string[];
    priority?: number;
  };
}

