"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Cog } from 'lucide-react';
import { SETTINGS_REGISTRY, SettingsId } from './settings/SettingsRegistry';

interface SettingsInputViewerProps {
  instanceId: string;
  selectedItem: string;
  onComplete?: () => void;
}

export default function SettingsInputViewer({ instanceId, selectedItem, onComplete }: SettingsInputViewerProps) {
  const { toast } = useToast();

  const handleSave = () => {
    toast({
      title: "Success",
      description: "Settings saved successfully!",
    });
    onComplete?.();
  };

  // Get the component from the registry
  const SettingsComponent = SETTINGS_REGISTRY[selectedItem as SettingsId];

  if (SettingsComponent) {
    // Use full-width layout for placeholder-images settings
    const isFullWidth = selectedItem === 'placeholder-images';
    
    return (
      <div className={`${isFullWidth ? 'p-12 md:p-16 lg:p-20 w-full' : 'p-6 md:p-8 lg:p-10 max-w-2xl mx-auto'}`}>
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