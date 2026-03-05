import { DesignSettings } from './design';
import { Suggestion } from './types';

export interface LayoutProps {
  config: DesignSettings;
  prompt: string;
  setPrompt: (prompt: string) => void;
  isLoading: boolean;
  suggestions: Suggestion[];
  referenceImages: string[];
  generatedImages: Array<{ image: string | null }>;
  fullPage?: boolean;
  deployment?: boolean;
  containerWidth?: number;
  instanceId?: string;
  onGenerateGallery?: () => void;
  onPromptSubmit: () => void;
  onSuggestionClick: (suggestion: Suggestion) => void;
  onImageUpload: (imageData: string | null) => void;
  onImageRemove: (index: number) => void;
  onRefreshSuggestions: () => void;
  isSubmissionLimitReached?: boolean;
  submissionCount?: number;
  maxSubmissions?: number;
  hideInMobile?: boolean;
}

// Layout utility functions
export const getLayoutEffectivePadding = (settings: DesignSettings, isMobile: boolean = false) => {
  const basePadding = 16; // Default padding since it's not in DesignSettings
  return isMobile ? Math.max(8, Math.min(basePadding, 16)) : basePadding;
};

export const getLayoutPaddingCSS = (settings: DesignSettings, isMobile: boolean = false) => {
  const padding = getLayoutEffectivePadding(settings, isMobile);
  return {
    padding: `${padding}px`,
    gap: `${padding}px`
  };
}; 