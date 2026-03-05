// Database
export type { Database, Json } from './database';

// Design (only unique types)
export type {
  LayoutMode,
  BorderStyle,
  ShadowStyle,
  TextAlign,
  PromptAlignment,
  ModalPosition,
  ModalAnimationType,
  DesignSettings,
  DesignTheme,
  WidgetStyle,
  Template,
  TemplateCategory,
  LayoutProps,
  Suggestion,
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
