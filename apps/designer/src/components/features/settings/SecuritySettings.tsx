"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Save, Shield, Lock, Users, Globe } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';

interface SecuritySettingsProps {
  onSave?: () => void;
}

export function SecuritySettings({ onSave }: SecuritySettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    auth_required: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).auth_required : false),
    allowed_domains: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).allowed_domains : ''),
    rate_limiting_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).rate_limiting_enabled : false),
    rate_limit_per_hour: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).rate_limit_per_hour : 10),
    ip_whitelist_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).ip_whitelist_enabled : false),
    ip_whitelist: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).ip_whitelist : ''),
    ssl_required: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).ssl_required : true),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          auth_required: formData.auth_required,
          allowed_domains: formData.allowed_domains,
          rate_limiting_enabled: formData.rate_limiting_enabled,
          rate_limit_per_hour: formData.rate_limit_per_hour,
          ip_whitelist_enabled: formData.ip_whitelist_enabled,
          ip_whitelist: formData.ip_whitelist,
          ssl_required: formData.ssl_required,
        }
      });
      onSave?.();
    } catch (error) {} finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-medium text-foreground">Security Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure authentication and access controls.</p>
      </div>
      
      <div className="space-y-6">
        {/* Authentication */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require Authentication</Label>
              <p className="text-sm text-muted-foreground">
                Require users to authenticate before using the widget
              </p>
            </div>
            <Switch
              checked={formData.auth_required}
              onCheckedChange={(checked) => setFormData({ ...formData, auth_required: checked })}
            />
          </div>
          
          {formData.auth_required && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label>Allowed Domains</Label>
                <Textarea
                  value={formData.allowed_domains}
                  onChange={(e) => setFormData({ ...formData, allowed_domains: e.target.value })}
                  placeholder="example.com&#10;another-site.com"
                  className="resize-none"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground">
                  One domain per line. Leave empty to allow all domains.
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Rate Limiting */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Rate Limiting</Label>
              <p className="text-sm text-muted-foreground">
                Limit requests per user to prevent abuse
              </p>
            </div>
            <Switch
              checked={formData.rate_limiting_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, rate_limiting_enabled: checked })}
            />
          </div>
          
          {formData.rate_limiting_enabled && (
            <div className="space-y-2.5">
              <Label>Requests per Hour</Label>
              <Input
                type="number"
                value={formData.rate_limit_per_hour}
                onChange={(e) => setFormData({ ...formData, rate_limit_per_hour: parseInt(e.target.value) || 10 })}
                min={1}
                max={1000}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Maximum requests allowed per hour per user
              </p>
            </div>
          )}
        </div>

        {/* IP Whitelist */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>IP Address Whitelist</Label>
              <p className="text-sm text-muted-foreground">
                Restrict access to specific IP addresses
              </p>
            </div>
            <Switch
              checked={formData.ip_whitelist_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, ip_whitelist_enabled: checked })}
            />
          </div>
          
          {formData.ip_whitelist_enabled && (
            <div className="space-y-2.5">
              <Label>Allowed IP Addresses</Label>
              <Textarea
                value={formData.ip_whitelist}
                onChange={(e) => setFormData({ ...formData, ip_whitelist: e.target.value })}
                placeholder="192.168.1.1&#10;10.0.0.0/8&#10;172.16.0.0/12"
                className="resize-none"
                rows={3}
              />
              <p className="text-xs text-muted-foreground">
                One IP address or CIDR range per line
              </p>
            </div>
          )}
        </div>

        {/* SSL/TLS */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Require SSL/TLS</Label>
              <p className="text-sm text-muted-foreground">
                Require HTTPS connections for all requests
              </p>
            </div>
            <Switch
              checked={formData.ssl_required}
              onCheckedChange={(checked) => setFormData({ ...formData, ssl_required: checked })}
            />
          </div>
        </div>

        {/* Security Status */}
        <div className="space-y-4">
          <div className="p-4 border border-border rounded-lg">
            <h4 className="text-sm font-medium mb-2">Security Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">SSL/TLS</span>
                <span className="text-sm text-green-600 dark:text-green-400">✓ Enabled</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Rate Limiting</span>
                <span className={`text-sm ${formData.rate_limiting_enabled ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {formData.rate_limiting_enabled ? '✓ Enabled' : '⚠ Disabled'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Authentication</span>
                <span className={`text-sm ${formData.auth_required ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400'}`}>
                  {formData.auth_required ? '✓ Required' : '⚠ Optional'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">IP Whitelist</span>
                <span className={`text-sm ${formData.ip_whitelist_enabled ? 'text-green-600 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {formData.ip_whitelist_enabled ? '✓ Enabled' : 'Disabled'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </>
        ) : (
          <>
            <Save className="mr-2 h-4 w-4" />
            Save Security Settings
          </>
        )}
      </Button>
    </div>
  );
} 