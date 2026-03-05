import { BasicInfoSettings } from './BasicInfoSettings';
import { PlaceholderImagesSettings } from './PlaceholderImagesSettings';
import { IndustryServicesSettings } from './IndustryServicesSettings';
import { AccessControlSettings } from './AccessControlSettings';
import { CreditsSettings } from './CreditsSettings';
import { WebhooksSettings } from './WebhooksSettings';
import { ServiceConfigSettings } from './ServiceConfigSettings';
import { ApiConfigSettings } from './ApiConfigSettings';
import { UsageLimitsSettings } from './UsageLimitsSettings';
import { NotificationsSettings } from './NotificationsSettings';
import { DatabaseSettings } from './DatabaseSettings';
import { SecuritySettings } from './SecuritySettings';
import { MonitoringSettings } from './MonitoringSettings';

export const SETTINGS_REGISTRY = {
  'basic-info': BasicInfoSettings,
  'placeholder-images': PlaceholderImagesSettings,
  'industry-services': IndustryServicesSettings,
  'access-control': AccessControlSettings,
  'credits': CreditsSettings,
  'webhooks': WebhooksSettings,
  'service-config': ServiceConfigSettings,
  'api-config': ApiConfigSettings,
  'usage-limits': UsageLimitsSettings,
  'notifications': NotificationsSettings,
  'database': DatabaseSettings,
  'security': SecuritySettings,
  'monitoring': MonitoringSettings,
} as const;

export type SettingsId = keyof typeof SETTINGS_REGISTRY; 