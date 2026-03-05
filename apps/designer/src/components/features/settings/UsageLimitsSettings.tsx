"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { SettingsPageHeader, SettingsRow, SettingsSection } from '@/components/features/settings/SettingsPrimitives';

interface UsageLimitsSettingsProps {
  onSave?: () => void;
}

export function UsageLimitsSettings({ onSave }: UsageLimitsSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    submission_limit_enabled: currentInstance?.submission_limit_enabled || false,
    max_submissions_per_session: currentInstance?.max_submissions_per_session || 5,
    rate_limit_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).rate_limit_enabled : false),
    requests_per_minute: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).requests_per_minute : 10),
    daily_limit: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).daily_limit : 100),
    session_timeout_minutes: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).session_timeout_minutes : 30),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        submission_limit_enabled: formData.submission_limit_enabled,
        max_submissions_per_session: formData.max_submissions_per_session,
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          rate_limit_enabled: formData.rate_limit_enabled,
          requests_per_minute: formData.requests_per_minute,
          daily_limit: formData.daily_limit,
          session_timeout_minutes: formData.session_timeout_minutes,
        }
      });
      onSave?.();
    } catch (error) {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Usage limits" description="Rate limiting and usage quotas for this instance." />

      <SettingsSection title="Session limits">
        <SettingsRow
          title="Enable submission limits"
          description="Limit submissions per user session."
          control={
            <Switch
              checked={formData.submission_limit_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, submission_limit_enabled: checked })}
            />
          }
        />

          {formData.submission_limit_enabled && (
            <div className="space-y-2.5 pt-2">
              <Label htmlFor="max_submissions">Max submissions per session</Label>
              <Input
                id="max_submissions"
                type="number"
                min="1"
                max="50"
                value={formData.max_submissions_per_session}
                onChange={(e) => setFormData({ ...formData, max_submissions_per_session: parseInt(e.target.value) || 5 })}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Number of image generations allowed per user session
              </p>
            </div>
          )}
      </SettingsSection>

      <SettingsSection title="Rate limiting">
        <SettingsRow
          title="Enable rate limiting"
          description="Limit requests per minute per user."
          control={
            <Switch
              checked={formData.rate_limit_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, rate_limit_enabled: checked })}
            />
          }
        />

          {formData.rate_limit_enabled && (
            <div className="space-y-2.5 pt-2">
              <Label htmlFor="requests_per_minute">Requests per minute</Label>
              <Input
                id="requests_per_minute"
                type="number"
                min="1"
                max="100"
                value={formData.requests_per_minute}
                onChange={(e) => setFormData({ ...formData, requests_per_minute: parseInt(e.target.value) || 10 })}
                className="h-9"
              />
            </div>
          )}
      </SettingsSection>

      <SettingsSection title="Daily limit">
        <div className="space-y-2.5">
          <Label htmlFor="daily_limit">Daily generation limit</Label>
          <Input
            id="daily_limit"
            type="number"
            min="1"
            max="10000"
            value={formData.daily_limit}
            onChange={(e) => setFormData({ ...formData, daily_limit: parseInt(e.target.value) || 100 })}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">Maximum image generations per day across all users.</p>
        </div>
      </SettingsSection>

      <SettingsSection title="Session timeout">
        <div className="space-y-2.5">
          <Label htmlFor="session_timeout">Session timeout (minutes)</Label>
          <Input
            id="session_timeout"
            type="number"
            min="5"
            max="1440"
            value={formData.session_timeout_minutes}
            onChange={(e) => setFormData({ ...formData, session_timeout_minutes: parseInt(e.target.value) || 30 })}
            className="h-9"
          />
          <p className="text-xs text-muted-foreground">How long before a user session expires (5–1440 minutes).</p>
        </div>
      </SettingsSection>

      <div className="flex items-center justify-end">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving…
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Save changes
            </>
          )}
        </Button>
      </div>
    </div>
  );
} 
