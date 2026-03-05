import { ComponentType } from 'react';

interface SettingsComponent {
  onSave?: () => void;
}

// Lazy-loaded settings registry to avoid importing all components at once
export const SETTINGS_REGISTRY_LAZY = {
  'basic-info': () => import('.').then(m => m.BasicInfoSettings),
  'placeholder-images': () => import('.').then(m => m.PlaceholderImagesSettings),
  'industry-services': () => import('.').then(m => m.IndustryServicesSettings),
  'access-control': () => import('.').then(m => m.AccessControlSettings),
  'credits': () => import('.').then(m => m.CreditsSettings),
  'webhooks': () => import('.').then(m => m.WebhooksSettings),
  'service-config': () => import('.').then(m => m.ServiceConfigSettings),
  'api-config': () => import('.').then(m => m.ApiConfigSettings),
  'usage-limits': () => import('.').then(m => m.UsageLimitsSettings),
  'notifications': () => import('.').then(m => m.NotificationsSettings),
  'database': () => import('.').then(m => m.DatabaseSettings),
  'security': () => import('.').then(m => m.SecuritySettings),
  'monitoring': () => import('.').then(m => m.MonitoringSettings),
} as const;

export type SettingsIdLazy = keyof typeof SETTINGS_REGISTRY_LAZY;

export async function getSettingsComponent(settingsId: SettingsIdLazy): Promise<ComponentType<SettingsComponent> | null> {
  const loader = SETTINGS_REGISTRY_LAZY[settingsId];
  if (!loader) return null;
  
  try {
    return await loader();
  } catch (error) {
    return null;
  }
}
