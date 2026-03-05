"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Activity, BarChart3, AlertTriangle, Eye } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';

interface MonitoringSettingsProps {
  onSave?: () => void;
}

export function MonitoringSettings({ onSave }: MonitoringSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    analytics_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).analytics_enabled : false),
    google_analytics_id: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).google_analytics_id : ''),
    error_logging_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).error_logging_enabled : false),
    performance_monitoring_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).performance_monitoring_enabled : false),
    log_level: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).log_level : 'info'),
    alert_threshold: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).alert_threshold : 5),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          analytics_enabled: formData.analytics_enabled,
          google_analytics_id: formData.google_analytics_id,
          error_logging_enabled: formData.error_logging_enabled,
          performance_monitoring_enabled: formData.performance_monitoring_enabled,
          log_level: formData.log_level,
          alert_threshold: formData.alert_threshold,
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
        <h2 className="text-xl font-medium text-foreground">Monitoring & Analytics</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure logging and analytics settings.</p>
      </div>
      
      <div className="space-y-6">
        {/* Analytics */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Analytics</Label>
              <p className="text-sm text-muted-foreground">
                Track usage and performance metrics
              </p>
            </div>
            <Switch
              checked={formData.analytics_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, analytics_enabled: checked })}
            />
          </div>
          
          {formData.analytics_enabled && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label>Google Analytics ID</Label>
                <Input
                  value={formData.google_analytics_id}
                  onChange={(e) => setFormData({ ...formData, google_analytics_id: e.target.value })}
                  placeholder="G-XXXXXXXXXX"
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Your Google Analytics 4 Measurement ID
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Error Logging */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Error Logging</Label>
              <p className="text-sm text-muted-foreground">
                Log errors and exceptions for debugging
              </p>
            </div>
            <Switch
              checked={formData.error_logging_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, error_logging_enabled: checked })}
            />
          </div>
          
          {formData.error_logging_enabled && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label>Log Level</Label>
                <select
                  value={formData.log_level}
                  onChange={(e) => setFormData({ ...formData, log_level: e.target.value })}
                  className="w-full p-2 border border-input rounded-md bg-background"
                >
                  <option value="debug">Debug</option>
                  <option value="info">Info</option>
                  <option value="warn">Warning</option>
                  <option value="error">Error</option>
                </select>
                <p className="text-xs text-muted-foreground">
                  Minimum level of logs to capture
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Performance Monitoring */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Performance Monitoring</Label>
              <p className="text-sm text-muted-foreground">
                Monitor response times and performance
              </p>
            </div>
            <Switch
              checked={formData.performance_monitoring_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, performance_monitoring_enabled: checked })}
            />
          </div>
          
          {formData.performance_monitoring_enabled && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label>Alert Threshold (seconds)</Label>
                <Input
                  type="number"
                  value={formData.alert_threshold}
                  onChange={(e) => setFormData({ ...formData, alert_threshold: parseInt(e.target.value) || 5 })}
                  min={1}
                  max={60}
                  className="h-9"
                />
                <p className="text-xs text-muted-foreground">
                  Alert when response time exceeds this threshold
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Monitoring Dashboard */}
        <div className="space-y-4">
          <div className="p-4 border border-border rounded-lg">
            <h4 className="text-sm font-medium mb-2">Current Status</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Uptime</span>
                <span className="text-sm text-green-600 dark:text-green-400">99.9%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Response Time</span>
                <span className="text-sm font-mono">245ms</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Error Rate</span>
                <span className="text-sm text-green-600 dark:text-green-400">0.1%</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Active Users</span>
                <span className="text-sm font-mono">42</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              View Analytics
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Performance Logs
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Error Logs
            </Button>
          </div>
        </div>

        {/* Alerts */}
        <div className="space-y-4">
          <div className="p-4 border border-border rounded-lg">
            <h4 className="text-sm font-medium mb-2">Recent Alerts</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>System running normally</span>
                <span className="text-xs text-muted-foreground ml-auto">2 min ago</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                <span>High response time detected</span>
                <span className="text-xs text-muted-foreground ml-auto">15 min ago</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span>Performance recovered</span>
                <span className="text-xs text-muted-foreground ml-auto">1 hour ago</span>
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
            Save Monitoring Settings
          </>
        )}
      </Button>
    </div>
  );
} 