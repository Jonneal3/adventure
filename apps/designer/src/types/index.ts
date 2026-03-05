// Database
export type { Database, Json } from './database';

// Design (only unique types)
export type {
  LayoutMode,
  BorderStyle,
  ShadowStyle,
  TextAlign,
  PromptAlignment,
  DesignSettings,
  DesignTheme,
  WidgetStyle,
  Template,
  TemplateCategory,
} from './design';
export {
  getCompleteTheme,
  loadGoogleFont,
  getFontsByCategory,
  hexToRgba,
  getBackgroundColor,
  getEffectivePadding,
  getPaddingCSS,
  generateTheme,
  fontOptions,
  fontOptionsArray,
  fontCategories,
  defaultDesignSettings,
  stylePresets,
  designThemes,
} from './design';



// Layout (only unique types)
export type { LayoutProps } from './layout';
export { getLayoutEffectivePadding, getLayoutPaddingCSS } from './layout';

// Shared (only unique types/values not in design)
export type { DesignTheme as SharedDesignTheme } from './shared';
export { DEFAULT_THEMES } from './shared';

// Events
export type {
  InputChangeEvent,
  TextAreaChangeEvent,
  ButtonClickEvent,
  DivClickEvent,
  FormSubmitEvent,
  InputChangeHandler,
  TextAreaChangeHandler,
  ButtonClickHandler,
  DivClickHandler,
  FormSubmitHandler,
} from './events';

// Types
export type {
  Theme,
  Instance,
  User,
  ModelWithSamples,
  Suggestion,
  ApiResponse,
  ImageGenRequest,
  Optional,
  Nullable,
} from './types';

// Plans
export type { Plan, AICreditPack, UserSubscription } from './plans';

// Flow
export type {
  FlowQuestionType,
  FlowStepType,
  DesignGenerationStrategy,
  QuestionGenerationMode,
  FlowQuestion,
  FlowStep,
  FlowComponent,
  FlowDataCollection,
  FlowField,
  FlowConfig,
  FlowState,
  FlowSubmission,
} from './flow';

// Zod
export { fileUploadFormSchema } from './zod'; 