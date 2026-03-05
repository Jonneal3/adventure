export type UseCase = 'tryon' | 'scene';

export interface UseCaseConfig {
  key: UseCase;
  title: string;
  description: string;
  // Prompt and model hints are optional and can be extended later
  defaultPromptHints?: string[];
  defaultNegativePrompts?: string[];
  modelHints?: {
    // e.g., preferred provider/model slugs
    provider?: 'replicate' | 'fal' | 'custom';
    modelId?: string;
  };
  uiToggles?: {
    showBodyGuides?: boolean;
    showRoomConstraints?: boolean;
  };
  // Suggest which categories tend to map to this use case
  categoryHints?: string[];
}

export const USE_CASES: Record<UseCase, UseCaseConfig> = {
  tryon: {
    key: 'tryon',
    title: 'Try‑ons',
    description: 'Users try on apparel/looks; best for fashion or personal styling.',
    defaultPromptHints: ['full body view', 'front-facing', 'consistent lighting'],
    defaultNegativePrompts: ['blurry', 'distorted body parts'],
    modelHints: { provider: 'replicate', modelId: 'google/nano-banana' },
    uiToggles: { showBodyGuides: true, showRoomConstraints: false },
    categoryHints: ['apparel', 'fashion', 'hair', 'makeup'],
  },
  scene: {
    key: 'scene',
    title: 'Scene',
    description: 'Users modify scenes (rooms, exteriors, products in context).',
    defaultPromptHints: ['wide angle', 'natural lighting', 'photorealistic'],
    defaultNegativePrompts: ['overexposed', 'artifact'],
    modelHints: { provider: 'replicate', modelId: 'google/nano-banana' },
    uiToggles: { showBodyGuides: false, showRoomConstraints: true },
    categoryHints: ['interior', 'bathroom', 'kitchen', 'landscaping', 'furniture'],
  },
};

export function resolveUseCaseConfig(useCase: UseCase | null | undefined): UseCaseConfig {
  if (!useCase) return USE_CASES.scene;
  return USE_CASES[useCase] ?? USE_CASES.scene;
}


