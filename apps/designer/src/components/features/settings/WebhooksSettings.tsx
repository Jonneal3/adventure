"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Save, TestTube, ArrowLeft, Copy, ExternalLink } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { SettingsPageHeader, SettingsSection } from '@/components/features/settings/SettingsPrimitives';
import { cn } from '@/lib/utils';

interface WebhooksSettingsProps {
  onSave?: () => void;
}

export function WebhooksSettings({ onSave }: WebhooksSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [showWebhookConfig, setShowWebhookConfig] = React.useState(false);
  const [isTestingWebhook, setIsTestingWebhook] = React.useState(false);
  const [webhookTestResult, setWebhookTestResult] = React.useState<{ success: boolean; message: string } | null>(null);
  const [formData, setFormData] = React.useState({
    webhook_url: currentInstance?.webhook_url || '',
    webhook_secret: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).webhook_secret : ''),
    webhooks_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).webhooks_enabled : false),
    webhook_events: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).webhook_events : ['generation']),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        webhook_url: formData.webhook_url,
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          webhook_secret: formData.webhook_secret,
          webhooks_enabled: formData.webhooks_enabled,
          webhook_events: formData.webhook_events,
        }
      });
      onSave?.();
    } catch (error) {} finally {
      setSaving(false);
    }
  };

  const testWebhook = async () => {
    if (!formData.webhook_url) {
      setWebhookTestResult({
        success: false,
        message: 'Please enter a webhook URL first'
      });
      return;
    }

    setIsTestingWebhook(true);
    setWebhookTestResult(null);

    try {
      const testPayload = {
        lead_id: "test-" + Date.now(),
        timestamp: new Date().toISOString(),
        form: {
          name: "Test User",
          email: "test@example.com",
          phone: "+1234567890",
          notes: "This is a test webhook payload"
        },
        image: {
          prompt: "test image prompt",
          image_url: "https://example.com/test-image.png",
          thumbnail_url: "https://example.com/test-thumbnail.png",
          file_id: "test123",
          format: "png",
          width: 1024,
          height: 1024
        },
        source: {
          widget_id: currentInstance?.id || "test-widget",
          company_id: currentInstance?.account_id || "test-company",
          company_name: currentInstance?.name || "Test Company",
          page_url: "https://example.com/test"
        }
      };

      const response = await fetch('/api/webhook', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          webhookUrl: formData.webhook_url,
          payload: testPayload
        })
      });

      const result = await response.json();
      
      if (result.success) {
        setWebhookTestResult({
          success: true,
          message: '✅ Webhook test successful! Your endpoint received the test payload.'
        });
      } else {
        setWebhookTestResult({
          success: false,
          message: `❌ Webhook test failed: ${result.webhookStatus} - ${JSON.stringify(result.webhookResponse)}`
        });
      }
    } catch (error) {
      setWebhookTestResult({
        success: false,
        message: `❌ Webhook test error: ${error}`
      });
    } finally {
      setIsTestingWebhook(false);
    }
  };

  if (showWebhookConfig) {
    return (
      <div className="space-y-6">
        <SettingsPageHeader
          title="Webhook configuration"
          description="Configure your webhook endpoint and test delivery."
          actions={
            <Button variant="outline" onClick={() => setShowWebhookConfig(false)}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          }
        />

        <SettingsSection title="Endpoint">
          <div className="space-y-2.5">
            <Label htmlFor="webhook_url">Webhook URL</Label>
            <div className="flex gap-2">
              <Input
                id="webhook_url"
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                placeholder="https://your-webhook-endpoint.com"
                className="h-9 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!formData.webhook_url) return;
                  navigator.clipboard?.writeText(formData.webhook_url);
                }}
                aria-label="Copy webhook URL"
                title="Copy webhook URL"
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!formData.webhook_url) return;
                  window.open(formData.webhook_url, "_blank", "noopener,noreferrer");
                }}
                aria-label="Open webhook URL"
                title="Open webhook URL"
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Your endpoint for receiving form submissions.</p>
          </div>
        </SettingsSection>

        <SettingsSection title="Secret (optional)" description="If set, we include a signature in webhook headers.">
          <div className="space-y-2.5">
            <Label htmlFor="webhook_secret">Webhook secret</Label>
            <div className="flex gap-2">
              <Input
                id="webhook_secret"
                value={formData.webhook_secret}
                onChange={(e) => setFormData({ ...formData, webhook_secret: e.target.value })}
                placeholder="Enter secret key"
                className="h-9 font-mono"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  if (!formData.webhook_secret) return;
                  navigator.clipboard?.writeText(formData.webhook_secret);
                }}
                aria-label="Copy webhook secret"
                title="Copy webhook secret"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </SettingsSection>

        <SettingsSection title="Payload example" description="Example of the data sent to your endpoint.">
          <div className="relative">
            <pre className="rounded-lg border border-border/60 bg-muted/30 p-4 text-xs text-foreground overflow-x-auto">
                <code>{`{
  "lead_id": "2fcb84a1-1e3a-4c4a-bb91-9c219c99c1e7",
  "timestamp": "2025-06-16T17:30:00.000Z",

  "form": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "notes": "Looking for a modern Japanese garden with water features."
  },

  "image": {
    "prompt": "modern Japanese garden with water features",
    "image_url": "https://cdn.yourapp.com/images/abc123.png",
    "thumbnail_url": "https://cdn.yourapp.com/images/thumbs/abc123.png",
    "file_id": "abc123", 
    "format": "png",
    "width": 1024,
    "height": 1024
  },

  "source": {
    "widget_id": "company-xyz-garden-widget",
    "company_id": "company_abc123",
    "company_name": "GreenScape Designs",
    "page_url": "https://greenscape.com/garden-designer"
  }
}`}</code>
            </pre>
            <Button
              variant="outline"
              size="sm"
              className="absolute top-2 right-2"
                onClick={() => {
                  navigator.clipboard.writeText(`{
  "lead_id": "2fcb84a1-1e3a-4c4a-bb91-9c219c99c1e7",
  "timestamp": "2025-06-16T17:30:00.000Z",

  "form": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "+1234567890",
    "notes": "Looking for a modern Japanese garden with water features."
  },

  "image": {
    "prompt": "modern Japanese garden with water features",
    "image_url": "https://cdn.yourapp.com/images/abc123.png",
    "thumbnail_url": "https://cdn.yourapp.com/images/thumbs/abc123.png",
    "file_id": "abc123", 
    "format": "png",
    "width": 1024,
    "height": 1024
  },

  "source": {
    "widget_id": "company-xyz-garden-widget",
    "company_id": "company_abc123",
    "company_name": "GreenScape Designs",
    "page_url": "https://greenscape.com/garden-designer"
  }
}`);
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
          </div>
        </SettingsSection>

        <SettingsSection title="Test delivery" description="Send a test payload to verify your webhook configuration.">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-muted-foreground">
              Sends a lightweight test payload to your endpoint.
            </div>
            <Button onClick={testWebhook} disabled={isTestingWebhook}>
                {isTestingWebhook ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <TestTube className="mr-2 h-4 w-4" />
                    Send Test
                  </>
                )}
              </Button>
            {webhookTestResult && (
              <div
                className={cn(
                  "rounded-md border p-3 text-sm",
                  webhookTestResult.success ? "border-emerald-500/30 bg-emerald-500/10" : "border-destructive/30 bg-destructive/10"
                )}
              >
                {webhookTestResult.message}
              </div>
            )}
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

  return (
    <div className="space-y-6">
      <SettingsPageHeader title="Integrations" description="Connect your form to other apps and services." />

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {/* Webhooks - Active Integration */}
        <div 
          className="relative group cursor-pointer"
          onClick={() => setShowWebhookConfig(true)}
        >
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 hover:border-border transition-colors">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-foreground">Webhooks</span>
            <span className="text-xs text-muted-foreground">Configure</span>
          </div>
        </div>

        {/* Google Sheets - Coming Soon */}
        <div className="relative group">
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-foreground">Google Sheets</span>
            <span className="text-xs text-muted-foreground">Coming Soon</span>
          </div>
        </div>

        {/* Slack - Coming Soon */}
        <div className="relative group">
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-sm font-medium text-foreground">Slack</span>
            <span className="text-xs text-muted-foreground">Coming Soon</span>
          </div>
        </div>

        {/* Discord - Coming Soon */}
        <div className="relative group">
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8h2a2 2 0 012 2v6a2 2 0 01-2 2h-2v4l-4-4H9a1.994 1.994 0 01-1.414-.586m0 0L11 14h4a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2v4l.586-.586z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Discord</span>
            <span className="text-xs text-zinc-500">Coming Soon</span>
          </div>
        </div>

        {/* Zapier - Coming Soon */}
        <div className="relative group">
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Zapier</span>
            <span className="text-xs text-zinc-500">Coming Soon</span>
          </div>
        </div>

        {/* Airtable - Coming Soon */}
        <div className="relative group">
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Airtable</span>
            <span className="text-xs text-zinc-500">Coming Soon</span>
          </div>
        </div>

        {/* Notion - Coming Soon */}
        <div className="relative group">
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm font-medium">Notion</span>
            <span className="text-xs text-zinc-500">Coming Soon</span>
          </div>
        </div>

        {/* HubSpot - Coming Soon */}
        <div className="relative group">
          <div className="aspect-square rounded-lg border border-border/60 bg-card/40 p-4 flex flex-col items-center justify-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center">
              <svg className="w-6 h-6 text-zinc-600 dark:text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <span className="text-sm font-medium">HubSpot</span>
            <span className="text-xs text-zinc-500">Coming Soon</span>
          </div>
        </div>
      </div>
    </div>
  );
} 
