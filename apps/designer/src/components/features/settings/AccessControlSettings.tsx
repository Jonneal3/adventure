"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Shield, Lock, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { Textarea } from '@/components/ui/textarea';
import { SettingsPageHeader, SettingsRow, SettingsSection } from '@/components/features/settings/SettingsPrimitives';

interface AccessControlSettingsProps {
  onSave?: () => void;
}

export function AccessControlSettings({ onSave }: AccessControlSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [apiCopied, setApiCopied] = React.useState(false);
  const [formData, setFormData] = React.useState({
    is_public: currentInstance?.is_public || false,
    api_access_enabled: (currentInstance?.config as any)?.api_access_enabled || false,
    api_key: (currentInstance as any)?.api_key || '',
    api_endpoint: (currentInstance?.config as any)?.api_endpoint || '',
    allowed_domains: (currentInstance?.config as any)?.allowed_domains || '',
    require_authentication: (currentInstance?.config as any)?.require_authentication || false,
    allow_anonymous: (currentInstance?.config as any)?.allow_anonymous || true,
  });

  // Sync form data when currentInstance changes
  useEffect(() => {
    if (currentInstance) {
      setFormData({
        is_public: currentInstance.is_public || false,
        api_access_enabled: (currentInstance?.config as any)?.api_access_enabled || false,
        api_key: (currentInstance as any)?.api_key || '',
        api_endpoint: (currentInstance?.config as any)?.api_endpoint || '',
        allowed_domains: (currentInstance?.config as any)?.allowed_domains || '',
        require_authentication: (currentInstance?.config as any)?.require_authentication || false,
        allow_anonymous: (currentInstance?.config as any)?.allow_anonymous || true,
      });
    }
  }, [currentInstance]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        is_public: formData.is_public,
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          api_access_enabled: formData.api_access_enabled,
          api_endpoint: formData.api_endpoint,
          allowed_domains: formData.allowed_domains,
          require_authentication: formData.require_authentication,
          allow_anonymous: formData.allow_anonymous,
        }
      };

      await updateInstance(updateData);

      onSave?.();
    } catch (error) {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Access control" description="Manage who can access and use this instance." />
      
      <SettingsSection title="Visibility">
        <SettingsRow
          title="Public instance"
          description="Allow others to discover and use this instance."
          control={
            <Switch checked={formData.is_public} onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })} />
          }
        />
      </SettingsSection>

      <SettingsSection title="API">
        <SettingsRow
          title="Enable API access"
          description="Allow programmatic access to this instance."
          control={
            <Switch
              checked={formData.api_access_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, api_access_enabled: checked })}
            />
          }
        />

        {formData.api_access_enabled ? (
          <div className="space-y-4 pt-2">
            <div className="space-y-2.5">
              <Label htmlFor="api-key">API key</Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  value={showApiKey ? formData.api_key : formData.api_key ? "•".repeat(Math.min(32, formData.api_key.length)) : ""}
                  readOnly
                  className="h-9 font-mono"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(v => !v)}
                  aria-label={showApiKey ? "Hide API key" : "Show API key"}
                  title={showApiKey ? "Hide API key" : "Show API key"}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!formData.api_key) return;
                    navigator.clipboard?.writeText(formData.api_key);
                    setApiCopied(true);
                    setTimeout(() => setApiCopied(false), 1200);
                  }}
                  aria-label={apiCopied ? "Copied" : "Copy API key"}
                  title={apiCopied ? "Copied" : "Copy API key"}
                >
                  {apiCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Use this key to authenticate API requests.</p>
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="api-endpoint">API endpoint</Label>
              <Input id="api-endpoint" value={formData.api_endpoint} readOnly className="h-9 font-mono" />
              <p className="text-xs text-muted-foreground">Read-only endpoint for accessing widget data.</p>
            </div>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Authentication">
        <SettingsRow
          title="Require authentication"
          description="Require users to authenticate before using the widget."
          control={
            <Switch
              checked={formData.require_authentication}
              onCheckedChange={(checked) => setFormData({ ...formData, require_authentication: checked })}
            />
          }
        />
        {formData.require_authentication ? (
          <div className="space-y-2.5 pt-2">
            <Label htmlFor="allowed-domains">Allowed domains</Label>
            <Textarea
              id="allowed-domains"
              value={formData.allowed_domains}
              onChange={(e) => setFormData({ ...formData, allowed_domains: e.target.value })}
              placeholder={"example.com\nanother-site.com"}
              className="min-h-[96px] resize-none font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">One domain per line. Leave empty to allow all domains.</p>
          </div>
        ) : null}
      </SettingsSection>

      <SettingsSection title="Anonymous access">
        <SettingsRow
          title="Allow anonymous access"
          description="Allow users to use the widget without creating an account."
          control={<Switch checked={formData.allow_anonymous} onCheckedChange={(checked) => setFormData({ ...formData, allow_anonymous: checked })} />}
        />
      </SettingsSection>

      <SettingsSection title="Summary" description="Quick read-only snapshot of your current access settings.">
        <div className="grid gap-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Public access</span>
            <span className={formData.is_public ? "text-foreground" : "text-muted-foreground"}>
              {formData.is_public ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">API access</span>
            <span className={formData.api_access_enabled ? "text-foreground" : "text-muted-foreground"}>
              {formData.api_access_enabled ? "Enabled" : "Disabled"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Authentication</span>
            <span className={formData.require_authentication ? "text-foreground" : "text-muted-foreground"}>
              {formData.require_authentication ? "Required" : "Optional"}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Anonymous access</span>
            <span className={formData.allow_anonymous ? "text-foreground" : "text-muted-foreground"}>
              {formData.allow_anonymous ? "Allowed" : "Blocked"}
            </span>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Security actions" description="Administrative tools for managing access.">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" className="justify-start">
            <Shield className="mr-2 h-4 w-4" />
            Regenerate API key
          </Button>
          <Button variant="outline" className="justify-start">
            <Lock className="mr-2 h-4 w-4" />
            View access logs
          </Button>
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
