"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Eye, EyeOff } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { SettingsPageHeader, SettingsRow, SettingsSection } from '@/components/features/settings/SettingsPrimitives';

interface ApiConfigSettingsProps {
  onSave?: () => void;
}

export function ApiConfigSettings({ onSave }: ApiConfigSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [showApiKey, setShowApiKey] = React.useState(false);
  const [formData, setFormData] = React.useState({
    use_environment_keys: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).use_environment_keys : true),
    replicate_api_key: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).replicate_api_key : ''),
    openai_api_key: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).openai_api_key : ''),
    custom_api_endpoint: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).custom_api_endpoint : ''),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          use_environment_keys: formData.use_environment_keys,
          replicate_api_key: formData.replicate_api_key,
          openai_api_key: formData.openai_api_key,
          custom_api_endpoint: formData.custom_api_endpoint,
        }
      });
      onSave?.();
    } catch (error) {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="API configuration"
        description="Configure API keys and optional endpoints for AI services."
      />

      <SettingsSection title="Keys">
        <SettingsRow
          title="Use environment variables"
          description="Use API keys from server-side environment variables (recommended)."
          control={
            <Switch
              checked={formData.use_environment_keys}
              onCheckedChange={(checked) => setFormData({ ...formData, use_environment_keys: checked })}
            />
          }
        />

        {!formData.use_environment_keys && (
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="replicate_key">Replicate API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="replicate_key"
                  type={showApiKey ? "text" : "password"}
                  value={formData.replicate_api_key}
                  onChange={(e) => setFormData({ ...formData, replicate_api_key: e.target.value })}
                  placeholder="r8_..."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? "Hide keys" : "Show keys"}
                  title={showApiKey ? "Hide keys" : "Show keys"}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Get your API key from replicate.com</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="openai_key">OpenAI API Key</Label>
              <div className="flex gap-2">
                <Input
                  id="openai_key"
                  type={showApiKey ? "text" : "password"}
                  value={formData.openai_api_key}
                  onChange={(e) => setFormData({ ...formData, openai_api_key: e.target.value })}
                  placeholder="sk-..."
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowApiKey(!showApiKey)}
                  aria-label={showApiKey ? "Hide keys" : "Show keys"}
                  title={showApiKey ? "Hide keys" : "Show keys"}
                >
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Get your API key from platform.openai.com</p>
            </div>
          </div>
        )}
      </SettingsSection>

      <SettingsSection title="Endpoint" description="Optional override for custom integrations.">
        <div className="space-y-2.5">
          <Label htmlFor="custom_endpoint">Custom API endpoint</Label>
          <Input
            id="custom_endpoint"
            value={formData.custom_api_endpoint}
            onChange={(e) => setFormData({ ...formData, custom_api_endpoint: e.target.value })}
            placeholder="https://your-custom-api.com/v1"
          />
          <p className="text-xs text-muted-foreground">Leave empty to use defaults.</p>
        </div>
      </SettingsSection>

        {formData.use_environment_keys && (
          <SettingsSection title="Environment variables" description="Keys read from the server environment.">
            <div className="space-y-1 text-sm">
              <div>
                <code className="rounded bg-muted px-1 py-0.5 text-xs">REPLICATE_API_KEY</code>
              </div>
              <div>
                <code className="rounded bg-muted px-1 py-0.5 text-xs">OPENAI_API_KEY</code>
              </div>
            </div>
          </SettingsSection>
        )}

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
