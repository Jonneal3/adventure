"use client";

import React, { useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Eye, EyeOff, Copy, Check } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { SettingsPageHeader, SettingsRow, SettingsSection } from '@/components/features/settings/SettingsPrimitives';

interface BasicInfoSettingsProps {
  onSave?: () => void;
}

export function BasicInfoSettings({ onSave }: BasicInfoSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const [apiCopied, setApiCopied] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: currentInstance?.name || '',
    description: currentInstance?.description || '',
    slug: currentInstance?.slug || '',
    is_public: currentInstance?.is_public || false,
    api_key: (currentInstance as any)?.api_key || '',
    api_access_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).api_access_enabled : false),
    api_endpoint: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).api_endpoint : ''),
  });

  // Sync form data when currentInstance changes
  useEffect(() => {
    if (currentInstance) {
      setFormData({
        name: currentInstance.name || '',
        description: currentInstance.description || '',
        slug: currentInstance.slug || '',
        is_public: currentInstance.is_public || false,
        api_key: (currentInstance as any)?.api_key || '',
        api_access_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).api_access_enabled : false),
        api_endpoint: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).api_endpoint : ''),
      });
    }
  }, [currentInstance]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updateData = {
        name: formData.name,
        slug: formData.slug,
        is_public: formData.is_public,
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          api_access_enabled: formData.api_access_enabled,
          api_endpoint: formData.api_endpoint,
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
      <SettingsPageHeader
        title="Basic information"
        description="Core details, visibility, and API access for this instance."
      />
      
      <SettingsSection title="Instance">
        <div className="space-y-2.5">
          <Label htmlFor="instance-id">Instance ID</Label>
          <div className="flex gap-2">
            <Input id="instance-id" value={currentInstance?.id || ''} readOnly className="h-9 font-mono" />
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (!currentInstance?.id) return;
                navigator.clipboard?.writeText(currentInstance.id);
                setCopied(true);
                setTimeout(() => setCopied(false), 1200);
              }}
              aria-label={copied ? 'Copied' : 'Copy instance ID'}
              title={copied ? 'Copied' : 'Copy instance ID'}
            >
              {copied ? (
                <>
                  <Check className="mr-2 h-4 w-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="mr-2 h-4 w-4" />
                  Copy
                </>
              )}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Read-only unique identifier.</p>
        </div>
      </SettingsSection>
      
      <SettingsSection title="Details">
        <div className="space-y-4">
          <div className="space-y-2.5">
            <Label htmlFor="name">Instance name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="My widget instance"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">A friendly name.</p>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Brief description of this widget instance"
              rows={3}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">What this instance does and who it’s for.</p>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="slug">URL Slug</Label>
            <Input
              id="slug"
              value={formData.slug}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
              placeholder="my-widget-instance"
              className="h-9"
            />
            <p className="text-xs text-muted-foreground">Used in your widget URL.</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection title="Visibility">
        <SettingsRow
          title="Public instance"
          description="Allow public access to this widget."
          control={
            <Switch checked={formData.is_public} onCheckedChange={(checked) => setFormData({ ...formData, is_public: checked })} />
          }
        />
      </SettingsSection>

      <SettingsSection title="API">
        <SettingsRow
          title="Enable API access"
          description="Allow programmatic access to your widget data."
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
