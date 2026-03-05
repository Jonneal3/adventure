// Designer integration utilities

import { StepDefinition } from '@/types/ai-form';
import type { PromptState } from '../context/prompt-state';

export interface DesignerInput {
  businessContext?: string;
  industry?: string;
  subcategoryName?: string;
  preferences?: Record<string, any>;
  previousAnswers?: Record<string, any>;
  promptState?: PromptState;
}

export function prepareDesignerInput(
  steps: StepDefinition[],
  stepData: Record<string, any>,
  config?: { businessContext?: string; industry?: string; subcategoryName?: string; promptState?: PromptState }
): DesignerInput {
  // Extract relevant information from previous steps
  const preferences: Record<string, any> = {};
  const previousAnswers: Record<string, any> = {};

  steps.forEach(step => {
    if (step.componentType !== 'designer' && step.componentType !== 'lead_capture' && step.componentType !== 'confirmation') {
      const data = stepData[step.id];
      if (data !== undefined) {
        previousAnswers[step.intent] = data;
        
        // Extract preferences based on step intent
        if (step.intent.toLowerCase().includes('style') || 
            step.intent.toLowerCase().includes('preference') ||
            step.intent.toLowerCase().includes('color') ||
            step.intent.toLowerCase().includes('design')) {
          preferences[step.intent] = data;
        }
      }
    }
  });

  return {
    businessContext: config?.businessContext,
    industry: config?.industry,
    subcategoryName: config?.subcategoryName,
    preferences,
    previousAnswers,
    promptState: config?.promptState,
  };
}

export function generateDesignerPrompt(designerInput: DesignerInput): string {
  const safeLine = (v: any) => String(v ?? "").replace(/\s+/g, " ").trim();
  const lines: string[] = [];

  // High-level intent
  if (designerInput.subcategoryName) {
    lines.push(`Service: ${safeLine(designerInput.subcategoryName)}`);
  }
  if (designerInput.businessContext) {
    lines.push(`Business: ${safeLine(designerInput.businessContext)}`);
  }
  if (designerInput.industry) {
    lines.push(`Industry: ${safeLine(designerInput.industry)}`);
  }

  // Preferences (style-ish signals)
  const prefKeys = Object.keys(designerInput.preferences || {});
  if (prefKeys.length > 0) {
    lines.push("");
    lines.push("Style_preferences:");
    for (const k of prefKeys) {
      lines.push(`- ${safeLine(k)}: ${safeLine((designerInput.preferences as any)[k])}`);
  }
  }

  // Prompt-state (structured, model-friendly)
  if (designerInput.promptState) {
    const ps = designerInput.promptState;
    lines.push("");
    lines.push("Prompt_state:");
    if (Array.isArray(ps.hard_constraints) && ps.hard_constraints.length > 0) {
      lines.push("Hard_constraints:");
      for (const kv of ps.hard_constraints.slice(0, 12)) {
        lines.push(`- ${safeLine(kv.key)}: ${safeLine(kv.value)}`);
      }
    }
    if (Array.isArray(ps.soft_preferences) && ps.soft_preferences.length > 0) {
      lines.push("Soft_preferences:");
      for (const kv of ps.soft_preferences.slice(0, 12)) {
        lines.push(`- ${safeLine(kv.key)}: ${safeLine(kv.value)}`);
      }
    }
    if (Array.isArray(ps.exclusions) && ps.exclusions.length > 0) {
      lines.push("Exclusions:");
      for (const kv of ps.exclusions.slice(0, 8)) {
        lines.push(`- ${safeLine(kv.key)}: ${safeLine(kv.value)}`);
      }
    }
  }

  // All answers (structured list rather than JSON dump)
  const answerKeys = Object.keys(designerInput.previousAnswers || {});
  if (answerKeys.length > 0) {
    lines.push("");
    lines.push("Answers:");
    for (const k of answerKeys) {
      const v = (designerInput.previousAnswers as any)[k];
      // Skip huge base64 blobs if any accidentally get captured
      const sv = safeLine(v);
      if (sv.startsWith("data:image/") || sv.length > 800) continue;
      lines.push(`- ${safeLine(k)}: ${sv}`);
  }
  }

  // Output instruction: keep it short and directive
  lines.push("");
  lines.push("Output_requirements:");
  lines.push("- Generate a high-quality, realistic result that matches the answers above.");
  lines.push("- Follow must-haves and avoid disallowed elements if mentioned.");
  lines.push("- Keep the composition clean and commercially usable.");

  return lines.join("\n").trim();
}

