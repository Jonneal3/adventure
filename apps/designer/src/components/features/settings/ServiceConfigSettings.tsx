"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, Cog, Zap } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { PROVIDERS } from '@/shared-api/config/providers';

interface ServiceConfigSettingsProps {
  onSave?: () => void;
}

export function ServiceConfigSettings({ onSave }: ServiceConfigSettingsProps) {
  const { currentInstance, updateInstance } = useInstance();
  const [saving, setSaving] = React.useState(false);
  const [formData, setFormData] = React.useState({
    provider: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).provider : 'replicate'),
    modelId: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).modelId : 'google/nano-banana'),
    generation_quality: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).generation_quality : 'quality'),
    gallery_max_images: (typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? (currentInstance.config as any).gallery_max_images : 4),
  });

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateInstance({
        config: {
          ...(typeof currentInstance?.config === 'object' && currentInstance?.config !== null ? currentInstance.config : {}),
          provider: formData.provider,
          modelId: formData.modelId,
          generation_quality: formData.generation_quality,
          gallery_max_images: formData.gallery_max_images,
        }
      });
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