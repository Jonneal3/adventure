/**
 * Step Variation Resolver
 * 
 * Functions to resolve, validate, and generate prompt summaries for variations.
 */

import type { StepDefinition } from "@/types/ai-form";
import type { StepIntent, StepVariation, StepIntentCatalog } from "./schema";
import { STEP_VARIATION_CATALOG } from "./registry";

/**
 * Get all variations for a specific StepIntent
 */
export function getVariationsForIntent(stepIntent: StepIntent): StepVariation[] {
  return STEP_VARIATION_CATALOG[stepIntent]?.variations || [];
}

/**
 * Get a specific variation by StepIntent and variation ID
 */
export function getVariation(
  stepIntent: StepIntent,
  variationId: string
): StepVariation | null {
  const catalog = STEP_VARIATION_CATALOG[stepIntent];
  if (!catalog) return null;
  return catalog.variations.find((v) => v.id === variationId) || null;
}

/**
 * Get the full catalog entry for a StepIntent
 */
export function getCatalogForIntent(
  stepIntent: StepIntent
): StepIntentCatalog | null {
  return STEP_VARIATION_CATALOG[stepIntent] || null;
}

/**
 * Validate that a step definition matches the variation schema
 */
export function validateVariationSchema(
  step: StepDefinition,
  variation: StepVariation
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check required fields
  for (const field of variation.schema.requiredFields) {
    // Check if field exists in step content or data
    const hasField =
      (step.content as any)?.[field] !== undefined ||
      (step.data as any)?.[field] !== undefined ||
      (step.copy as any)?.[field] !== undefined;

    if (!hasField) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  // Additional validation based on field type
  if (variation.schema.requiredFields.includes("options")) {
    const hasOptions =
      (Array.isArray(step.content?.options) &&
        step.content.options.length > 0) ||
      (Array.isArray(step.data?.options) && step.data.options.length > 0);

    if (!hasOptions) {
      errors.push("Missing required options array");
    }
  }

  if (variation.schema.requiredFields.includes("email")) {
    // Email validation would be done at runtime, but we can check if it's present
    const hasEmailField =
      step.data?.mode === "email" ||
      step.data?.requiredInputs?.includes("email") ||
      step.interaction?.validation?.type === "email";

    if (!hasEmailField && step.componentType !== "lead_capture") {
      errors.push("Email field not properly configured");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Generate a prompt-friendly summary of all variations for DSPy
 * This is used in the DSPy prompt to help it choose variations
 */
export function getVariationCatalogPromptSummary(): string {
  const lines: string[] = [];
  lines.push("STEP VARIATION CATALOG:");
  lines.push("Each StepIntent has multiple variations. Choose the variation that best fits the context.");
  lines.push("");

  for (const [stepIntent, catalog] of Object.entries(STEP_VARIATION_CATALOG)) {
    lines.push(`StepIntent: ${stepIntent}`);
    lines.push(`  Description: ${catalog.metadata.description}`);
    lines.push(`  Typical Use Cases: ${catalog.metadata.typicalUseCases.join(", ")}`);
    lines.push(`  Variations:`);

    for (const variation of catalog.variations) {
      lines.push(`    - ${variation.id} (${variation.name})`);
      lines.push(`      Description: ${variation.description}`);
      lines.push(`      ComponentType: ${variation.componentType}`);
      lines.push(
        `      Required Fields: ${variation.schema.requiredFields.join(", ")}`
      );
      if (variation.schema.optionalFields?.length) {
        lines.push(
          `      Optional Fields: ${variation.schema.optionalFields.join(", ")}`
        );
      }
      if (variation.uxCharacteristics) {
        const ux = variation.uxCharacteristics;
        if (ux.friction) lines.push(`      Friction: ${ux.friction}`);
        if (ux.focus) lines.push(`      Focus: ${ux.focus}`);
      }
      if (variation.layoutHints) {
        const hints = variation.layoutHints;
        if (hints.layout) lines.push(`      Layout: ${hints.layout}`);
        if (hints.emphasis) lines.push(`      Emphasis: ${hints.emphasis}`);
      }
      lines.push("");
    }
  }

  lines.push("VARIATION SELECTION GUIDELINES:");
  lines.push("- Low friction needed? Use variations with friction: low");
  lines.push("- Need high focus? Use variations with focus: high or layout: modal");
  lines.push("- Want to combine steps? Use composite variations");
  lines.push("- Visual emphasis? Use variations with emphasis: visual");
  lines.push(
    "- Output must include: variation: { stepIntent: '...', variationId: '...' }"
  );
  lines.push("- Fill in all requiredFields from the variation's schema");

  return lines.join("\n");
}

/**
 * Get a compact JSON summary for DSPy (truncated for context window)
 */
export function getVariationCatalogJSONSummary(maxLength: number = 3000): string {
  const summary: Record<string, any> = {};

  for (const [stepIntent, catalog] of Object.entries(STEP_VARIATION_CATALOG)) {
    summary[stepIntent] = {
      description: catalog.metadata.description,
      variations: catalog.variations.map((v) => ({
        id: v.id,
        name: v.name,
        description: v.description,
        componentType: v.componentType,
        requiredFields: v.schema.requiredFields,
        optionalFields: v.schema.optionalFields || [],
        uxCharacteristics: v.uxCharacteristics,
        layoutHints: v.layoutHints,
      })),
    };
  }

  const jsonStr = JSON.stringify(summary, null, 2);
  if (jsonStr.length <= maxLength) {
    return jsonStr;
  }

  // Truncate if too long
  return jsonStr.substring(0, maxLength - 100) + "... (truncated)";
}

