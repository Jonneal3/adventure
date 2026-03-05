// Step state persistence and hydration

import { StepState, StepDefinition } from '@/types/ai-form';

const STORAGE_PREFIX = 'ai_form_state_';

export function saveStepState(instanceId: string, state: StepState): void {
  try {
    const key = `${STORAGE_PREFIX}${instanceId}`;
    // CRITICAL: Preserve ALL step fields including options - only remove functions/complex objects
    const serialized = {
      ...state,
      completedSteps: Array.from(state.completedSteps),
      steps: state.steps.map(step => {
        // Log if multiple_choice step is missing options
        const stepType = (step as any).type ?? (step as any).componentType;
        const hasOptions =
          Array.isArray((step as any).options) ||
          Array.isArray((step as any).content?.options) ||
          Array.isArray((step as any).data?.options);
        if ((stepType === 'multiple_choice' || stepType === 'choice') && !hasOptions) {
          console.warn('[saveStepState] ⚠️ Step missing options before save:', {
            stepId: step.id,
            type: stepType,
            stepKeys: Object.keys(step),
          });
        }
        return {
          ...step, // Spread ALL fields first
          // Don't store functions or complex objects
          skipCondition: undefined
        };
      })
    };
    localStorage.setItem(key, JSON.stringify(serialized));
  } catch (error) {
    console.error('Failed to save step state:', error);
  }
}

export function loadStepState(instanceId: string): StepState | null {
  try {
    const key = `${STORAGE_PREFIX}${instanceId}`;
    const stored = localStorage.getItem(key);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    return {
      ...parsed,
      completedSteps: new Set(parsed.completedSteps || []),
      steps: parsed.steps || []
    };
  } catch (error) {
    console.error('Failed to load step state:', error);
    return null;
  }
}

export function clearStepState(instanceId: string): void {
  try {
    const key = `${STORAGE_PREFIX}${instanceId}`;
    localStorage.removeItem(key);
  } catch (error) {
    console.error('Failed to clear step state:', error);
  }
}

export function generateSessionId(): string {
  return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

