// Common types shared between Designer and Widget
export type BorderStyle = 'none' | 'solid' | 'dashed' | 'dotted';
export type ShadowStyle = 'none' | 'sm' | 'md' | 'lg';
export type TextAlign = 'left' | 'center' | 'right';
export type LayoutMode = 'left-right' | 'top-bottom';
export type PromptAlignment = 'left' | 'center' | 'right';
export type WidgetStyle = 'minimal' | 'modern' | 'classic';

export interface DesignTheme {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  text: string;
}

export const DEFAULT_THEMES: Record<string, DesignTheme> = {
  light: {
    primary: '#000000',
    secondary: '#666666',
    accent: '#0066cc',
    background: '#ffffff',
    text: '#000000'
  },
  dark: {
    primary: '#ffffff',
    secondary: '#999999',
    accent: '#3399ff',
    background: '#000000',
    text: '#ffffff'
  }
}; 