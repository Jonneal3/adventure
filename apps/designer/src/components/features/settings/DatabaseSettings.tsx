"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Loader2, Save, Database, Trash2, Download, Upload } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';

interface DatabaseSettingsProps {
  onSave?: () => void;
}

export function DatabaseSettings({ onSave }: DatabaseSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    auto_delete_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).auto_delete_enabled : false),
    retention_days: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).retention_days : 30),
    backup_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).backup_enabled : false),
    backup_frequency: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).backup_frequency : 'daily'),
    data_export_enabled: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).data_export_enabled : false),
    export_format: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).export_format : 'csv'),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          auto_delete_enabled: formData.auto_delete_enabled,
          retention_days: formData.retention_days,
          backup_enabled: formData.backup_enabled,
          backup_frequency: formData.backup_frequency,
          data_export_enabled: formData.data_export_enabled,
          export_format: formData.export_format,
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
        <h2 className="text-xl font-medium text-foreground">Database Settings</h2>
        <p className="mt-1 text-sm text-muted-foreground">Configure storage and data retention settings.</p>
      </div>
      
      <div className="space-y-6">
        {/* Data Retention */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Auto-Delete Old Images</Label>
              <p className="text-sm text-muted-foreground">
                Automatically delete images older than specified days
              </p>
            </div>
            <Switch
              checked={formData.auto_delete_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, auto_delete_enabled: checked })}
            />
          </div>
          
          {formData.auto_delete_enabled && (
            <div className="space-y-2.5">
              <Label>Retention Period (Days)</Label>
              <Input
                type="number"
                value={formData.retention_days}
                onChange={(e) => setFormData({ ...formData, retention_days: parseInt(e.target.value) || 30 })}
                min={1}
                max={365}
                className="h-9"
              />
              <p className="text-xs text-muted-foreground">
                Images older than this will be automatically deleted
              </p>
            </div>
          )}
        </div>
        
        {/* Data Backup */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Data Backup</Label>
              <p className="text-sm text-muted-foreground">
                Automatically backup instance data
              </p>
            </div>
            <Switch
              checked={formData.backup_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, backup_enabled: checked })}
            />
          </div>
          
          {formData.backup_enabled && (
            <div className="space-y-2.5">
              <Label>Backup Frequency</Label>
              <select
                value={formData.backup_frequency}
                onChange={(e) => setFormData({ ...formData, backup_frequency: e.target.value })}
                className="w-full p-2 border border-input rounded-md bg-background"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <p className="text-xs text-muted-foreground">
                How often to create automatic backups
              </p>
            </div>
          )}
        </div>

        {/* Data Export */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Data Export</Label>
              <p className="text-sm text-muted-foreground">
                Allow exporting form submission data
              </p>
            </div>
            <Switch
              checked={formData.data_export_enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, data_export_enabled: checked })}
            />
          </div>
          
          {formData.data_export_enabled && (
            <div className="space-y-4">
              <div className="space-y-2.5">
                <Label>Export Format</Label>
                <select
                  value={formData.export_format}
                  onChange={(e) => setFormData({ ...formData, export_format: e.target.value })}
                  className="w-full p-2 border border-input rounded-md bg-background"
                >
                  <option value="csv">CSV</option>
                  <option value="json">JSON</option>
                  <option value="excel">Excel</option>
                </select>
              </div>
              
              <div className="flex gap-2">
                <Button variant="outline" className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  Export Data
                </Button>
                <Button variant="outline" className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
                  Import Data
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Data Management */}
        <div className="space-y-4">
          <div className="p-4 border border-border rounded-lg">
            <h4 className="text-sm font-medium mb-2">Data Management</h4>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Submissions</span>
                <span className="text-sm font-mono">1,234</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Total Images</span>
                <span className="text-sm font-mono">5,678</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm">Storage Used</span>
                <span className="text-sm font-mono">2.4 GB</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" className="flex items-center gap-2">
              <Trash2 className="h-4 w-4" />
              Clear All Data
            </Button>
            <Button variant="outline" className="flex items-center gap-2">
              <Database className="h-4 w-4" />
              Optimize Database
            </Button>
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
            Save Database Settings
          </>
        )}
      </Button>
    </div>
  );
} 