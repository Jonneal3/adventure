"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Cog, Loader2 } from 'lucide-react';
import { getSettingsComponent, SettingsIdLazy } from './settings/SettingsRegistryLazy';

interface SettingsInputViewerLazyProps {
  instanceId: string;
  selectedItem: string;
  onComplete?: () => void;
}

export default function SettingsInputViewerLazy({ instanceId, selectedItem, onComplete }: SettingsInputViewerLazyProps) {
  const { toast } = useToast();
  const [SettingsComponent, setSettingsComponent] = useState<React.ComponentType<{ onSave?: () => void }> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const effectiveItem = selectedItem || 'basic-info';
  const isWideLayout = effectiveItem === 'placeholder-images' || effectiveItem === 'industry-services';

  const handleSave = () => {
    toast({
      title: "Success",
      description: "Settings saved successfully!",
    });
    onComplete?.();
  };

  useEffect(() => {
    const loadComponent = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const component = await getSettingsComponent(effectiveItem as SettingsIdLazy);
        setSettingsComponent(() => component);
      } catch (err) {
        setError(`Failed to load ${effectiveItem} settings`);
        setSettingsComponent(null);
      } finally {
        setLoading(false);
      }
    };

    loadComponent();
  }, [effectiveItem]);

  // Loading state
  if (loading) {
    return (
      <div
        className={
          isWideLayout
            ? "mx-auto flex w-full max-w-5xl min-h-0 flex-col overflow-hidden p-4 md:p-6 h-[calc(100dvh-140px)]"
            : "mx-auto max-w-3xl p-6 md:p-8"
        }
      >
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Loading {effectiveItem} settings...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div
        className={
          isWideLayout
            ? "mx-auto flex w-full max-w-5xl min-h-0 flex-col overflow-hidden p-4 md:p-6 h-[calc(100dvh-140px)]"
            : "mx-auto max-w-3xl p-6 md:p-8"
        }
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <Cog className="h-5 w-5" />
              Error Loading Settings
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Loaded component
  if (SettingsComponent) {
    return (
      <div
        className={
          isWideLayout
            ? "mx-auto flex w-full max-w-5xl min-h-0 flex-col overflow-hidden p-4 md:p-6 h-[calc(100dvh-140px)]"
            : "mx-auto max-w-3xl p-6 md:p-8"
        }
      >
        <SettingsComponent onSave={handleSave} />
      </div>
    );
  }

  // Default fallback for unknown settings
  return (
    <div className="p-6 md:p-8 lg:p-10 max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog className="h-5 w-5" />
            Settings
          </CardTitle>
          <CardDescription>
            Select a settings section from the sidebar to configure
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            <Cog className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Choose a settings section to get started</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
