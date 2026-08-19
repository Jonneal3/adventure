"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Cog } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { PROVIDERS } from '@/shared-api/config/providers';

interface ServiceConfigSettingsProps {
  onSave?: () => void;
}

function readAdventureBudget(config: any): { enabled: boolean; min: string; max: string; step: string } {
  const raw = config?.adventureBudget || config?.budgetBounds || null;
  if (!raw || typeof raw !== 'object') {
    return { enabled: false, min: '5000', max: '80000', step: '1000' };
  }
  return {
    enabled: true,
    min: String(Number(raw.min ?? raw.minBudget) || 5000),
    max: String(Number(raw.max ?? raw.maxBudget) || 80000),
    step: String(Number(raw.step) || 1000),
  };
}

export function ServiceConfigSettings({ onSave }: ServiceConfigSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const cfg =
    typeof currentInstance?.config === 'object' && currentInstance?.config !== null
      ? (currentInstance.config as any)
      : {};
  const budgetInit = readAdventureBudget(cfg);
  const [formData, setFormData] = React.useState({
    provider: cfg.provider || 'replicate',
    modelId: cfg.modelId || 'google/nano-banana',
    generation_quality: cfg.generation_quality || 'quality',
    gallery_max_images: cfg.gallery_max_images || 4,
    budgetEnabled: budgetInit.enabled,
    budgetMin: budgetInit.min,
    budgetMax: budgetInit.max,
    budgetStep: budgetInit.step,
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      const nextConfig: Record<string, unknown> = {
        ...cfg,
        provider: formData.provider,
        modelId: formData.modelId,
        generation_quality: formData.generation_quality,
        gallery_max_images: formData.gallery_max_images,
      };
      if (formData.budgetEnabled) {
        const min = Math.max(500, Number(formData.budgetMin) || 5000);
        const max = Math.max(min + 1000, Number(formData.budgetMax) || 80000);
        const step = Math.max(100, Number(formData.budgetStep) || 1000);
        nextConfig.adventureBudget = { min, max, step, currency: 'USD' };
      } else {
        delete nextConfig.adventureBudget;
        delete nextConfig.budgetBounds;
      }
      await updateInstance({ config: nextConfig });
      onSave?.();
    } catch (error) {} finally {
      setSaving(false);
    }
  };

  const selectedProvider = PROVIDERS[formData.provider as keyof typeof PROVIDERS];
  const availableModels = selectedProvider?.models || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cog className="h-5 w-5" />
          Service Configuration
        </CardTitle>
        <CardDescription>
          Configure AI model and generation settings
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="provider">AI Provider</Label>
          <Select value={formData.provider} onValueChange={(value) => setFormData({ ...formData, provider: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select AI provider" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PROVIDERS).map(([key, provider]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded bg-gradient-to-r ${provider.color}`} />
                    {provider.displayName}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="model">AI Model</Label>
          <Select value={formData.modelId} onValueChange={(value) => setFormData({ ...formData, modelId: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select AI model" />
            </SelectTrigger>
            <SelectContent>
              {availableModels.map((model) => (
                <SelectItem key={model} value={model}>
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Choose the AI model for image generation
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="quality">Generation Quality</Label>
          <Select value={formData.generation_quality} onValueChange={(value) => setFormData({ ...formData, generation_quality: value })}>
            <SelectTrigger>
              <SelectValue placeholder="Select quality" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="performance">Performance (Fast)</SelectItem>
              <SelectItem value="quality">Quality (High)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="max_images">Max Images per Generation</Label>
          <Select value={formData.gallery_max_images.toString()} onValueChange={(value) => setFormData({ ...formData, gallery_max_images: parseInt(value) })}>
            <SelectTrigger>
              <SelectValue placeholder="Select max images" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">1 Image</SelectItem>
              <SelectItem value="2">2 Images</SelectItem>
              <SelectItem value="4">4 Images</SelectItem>
              <SelectItem value="6">6 Images</SelectItem>
              <SelectItem value="8">8 Images</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Number of images generated per request
          </p>
        </div>

        <div className="rounded-md border p-4 space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <Label>Adventure budget slider override</Label>
              <p className="text-xs text-muted-foreground mt-1">
                When enabled, replaces platform service+scope ranges in the Adventure budget step.
              </p>
            </div>
            <Select
              value={formData.budgetEnabled ? 'on' : 'off'}
              onValueChange={(value) => setFormData({ ...formData, budgetEnabled: value === 'on' })}
            >
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="off">Platform</SelectItem>
                <SelectItem value="on">Override</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {formData.budgetEnabled ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="budget_min">Min ($)</Label>
                <Input
                  id="budget_min"
                  type="number"
                  min={500}
                  value={formData.budgetMin}
                  onChange={(e) => setFormData({ ...formData, budgetMin: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget_max">Max ($)</Label>
                <Input
                  id="budget_max"
                  type="number"
                  min={1000}
                  value={formData.budgetMax}
                  onChange={(e) => setFormData({ ...formData, budgetMax: e.target.value })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="budget_step">Step ($)</Label>
                <Input
                  id="budget_step"
                  type="number"
                  min={100}
                  value={formData.budgetStep}
                  onChange={(e) => setFormData({ ...formData, budgetStep: e.target.value })}
                />
              </div>
            </div>
          ) : null}
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
              Save Service Config
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
} 