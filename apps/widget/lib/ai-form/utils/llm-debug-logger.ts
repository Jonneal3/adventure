/**
 * Minimal LLM Debug Logger
 * 
 * Provides clean, focused logging for LLM calls when debug mode is enabled.
 * Only shows essential info: input preview, output preview, latency, success/failure.
 */

const isDebugMode = (): boolean => {
  return process.env.AI_FORM_DEBUG === "true" || process.env.NODE_ENV === "development";
};

interface LLMCallInput {
  [key: string]: any;
}

interface LLMCallOutput {
  [key: string]: any;
}

/**
 * Log a successful LLM call
 */
export function logLLMCall(
  name: string,
  input: LLMCallInput,
  output: LLMCallOutput,
  latency: number,
  success: boolean = true
): void {
  if (!isDebugMode()) return;

  const status = success ? "✅" : "❌";
  const inputPreview = formatInputPreview(input);
  const outputPreview = formatOutputPreview(output);

  console.log(`[LLM] ${name} (${latency}ms) ${status}`);
  if (inputPreview) {
    console.log(`  → ${inputPreview}`);
  }
  if (outputPreview) {
    console.log(`  ← ${outputPreview}`);
  }
}

/**
 * Log a failed LLM call
 */
export function logLLMError(
  name: string,
  input: LLMCallInput,
  error: string | Error,
  latency: number
): void {
  if (!isDebugMode()) return;

  const errorMsg = error instanceof Error ? error.message : String(error);
  const inputPreview = formatInputPreview(input);

  console.log(`[LLM] ${name} (${latency}ms) ❌`);
  if (inputPreview) {
    console.log(`  → ${inputPreview}`);
  }
  console.log(`  ✗ Error: ${errorMsg}`);
}

/**
 * Format input preview for display
 */
function formatInputPreview(input: LLMCallInput): string {
  const parts: string[] = [];

  // For FormPlanner
  if (input.industry) parts.push(`industry: ${input.industry}`);
  if (input.services) {
    const services = Array.isArray(input.services) ? input.services.join(", ") : input.services;
    if (services) parts.push(`services: ${services}`);
  }
  if (input.useCase) parts.push(`useCase: ${input.useCase}`);
  if (input.use_case) parts.push(`useCase: ${input.use_case}`);

  // For StepGenerator
  if (input.key) parts.push(`key: ${input.key}`);
  if (input.component_hint) parts.push(`hint: ${input.component_hint}`);
  if (input.priority) parts.push(`priority: ${input.priority}`);

  return parts.join(" | ") || "—";
}

/**
 * Format output preview for display
 */
function formatOutputPreview(output: LLMCallOutput): string {
  const parts: string[] = [];

  if (output.stopReason) {
    parts.push(`stopReason: ${output.stopReason}`);
  }

  // For StepGenerator output
  if (output.id || output.step?.id) {
    const stepId = output.id || output.step?.id;
    parts.push(`id: ${stepId}`);
  }
  if (output.componentType || output.step?.componentType) {
    const componentType = output.componentType || output.step?.componentType;
    parts.push(`type: ${componentType}`);
  }
  if (output.step?.data?.options) {
    const optionsCount = Array.isArray(output.step.data.options) ? output.step.data.options.length : 0;
    parts.push(`options: ${optionsCount}`);
  } else if (output.data?.options) {
    const optionsCount = Array.isArray(output.data.options) ? output.data.options.length : 0;
    parts.push(`options: ${optionsCount}`);
  }

  return parts.join(" | ") || "—";
}
