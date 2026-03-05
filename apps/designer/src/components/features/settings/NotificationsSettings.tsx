"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { SettingsPageHeader, SettingsRow, SettingsSection } from '@/components/features/settings/SettingsPrimitives';

interface NotificationsSettingsProps {
  onSave?: () => void;
}

export function NotificationsSettings({ onSave }: NotificationsSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    email_notifications_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).email_notifications_enabled : false),
    notification_email: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).notification_email : ''),
    notification_types: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).notification_types : ['usage']),
    auto_response_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).auto_response_enabled : false),
    auto_response_subject: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).auto_response_subject : ''),
    auto_response_body: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).auto_response_body : ''),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          email_notifications_enabled: formData.email_notifications_enabled,
          notification_email: formData.notification_email,
          notification_types: formData.notification_types,
          auto_response_enabled: formData.auto_response_enabled,
          auto_response_subject: formData.auto_response_subject,
          auto_response_body: formData.auto_response_body,
        }
      });
      onSave?.();
    } catch (error) {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Notifications" description="Configure email notifications and optional auto-responses." />

      <SettingsSection title="Email notifications">
        <SettingsRow
          title="Enable email notifications"
          description="Receive email notifications for important events."
          control={
            <Switch
              checked={formData.email_notifications_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, email_notifications_enabled: checked })}
            />
          }
        />
        
        {formData.email_notifications_enabled && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2.5">
              <Label>Notification Email</Label>
              <Input
                value={formData.notification_email}
                onChange={(e) => setFormData({ ...formData, notification_email: e.target.value })}
                placeholder="your-email@example.com"
                className="h-9"
                type="email"
              />
            </div>
            
            <div className="space-y-2.5">
              <Label>Notification Types</Label>
              <div className="grid gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formData.notification_types.includes('usage')}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true;
                      const types = formData.notification_types;
                      const nextTypes = enabled
                        ? (types.includes('usage') ? types : [...types, 'usage'])
                        : types.filter((t: string) => t !== 'usage');
                      setFormData({ ...formData, notification_types: nextTypes });
                    }}
                  />
                  Usage alerts
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formData.notification_types.includes('errors')}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true;
                      const types = formData.notification_types;
                      const nextTypes = enabled
                        ? (types.includes('errors') ? types : [...types, 'errors'])
                        : types.filter((t: string) => t !== 'errors');
                      setFormData({ ...formData, notification_types: nextTypes });
                    }}
                  />
                  Error alerts
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={formData.notification_types.includes('billing')}
                    onCheckedChange={(checked) => {
                      const enabled = checked === true;
                      const types = formData.notification_types;
                      const nextTypes = enabled
                        ? (types.includes('billing') ? types : [...types, 'billing'])
                        : types.filter((t: string) => t !== 'billing');
                      setFormData({ ...formData, notification_types: nextTypes });
                    }}
                  />
                  Billing alerts
                </label>
              </div>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Auto-response" description="Optional email sent after form submissions.">
        <SettingsRow
          title="Enable auto-response"
          description="Send an automatic response email to form submissions."
          control={
            <Switch
              checked={formData.auto_response_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_response_enabled: checked })}
            />
          }
        />
        {formData.auto_response_enabled ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2.5">
              <Label htmlFor="auto-response-subject">Response subject</Label>
              <Input
                id="auto-response-subject"
                value={formData.auto_response_subject}
                onChange={(e) => setFormData({ ...formData, auto_response_subject: e.target.value })}
                placeholder="Thanks for reaching out"
                className="h-9"
              />
            </div>
            <div className="space-y-2.5">
              <Label htmlFor="auto-response-body">Response body</Label>
              <Textarea
                id="auto-response-body"
                value={formData.auto_response_body}
                onChange={(e) => setFormData({ ...formData, auto_response_body: e.target.value })}
                placeholder="Write the message you want to send…"
                className="min-h-[120px] resize-none"
              />
            </div>
          </div>
        ) : null}
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
