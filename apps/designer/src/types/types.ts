// Common types used across the app
import { LayoutMode, WidgetStyle } from './design';

export type Theme = {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
};

// Database types (only the ones we actually use across apps)
export type Instance = {
  id: string;
  name: string;
  settings: {
    theme: Theme;
    layout: LayoutMode;
    style: WidgetStyle;
  };
};

export type User = {
  id: string;
  email: string;
  credits: number;
};

export type ModelWithSamples = {
  id: string;
  name: string;
  provider: string;
  model_id: string;
  status: 'active' | 'inactive';
  samples?: string[];
};

export type Suggestion = {
  text: string;
  category?: string;
  subcategory?: string;
  prompt?: string;
  style?: string;
  model?: string;
  negative_prompt?: string;
  settings?: any;
};

// API types (only the shared ones)
export type ApiResponse<T> = {
  data?: T;
  error?: string;
};

export type ImageGenRequest = {
  prompt: string;
  style?: string;
  settings?: any; // We can type this better when we actually need it
};

// Utility types we actually use
export type Optional<T> = T | undefined;
export type Nullable<T> = T | null; 