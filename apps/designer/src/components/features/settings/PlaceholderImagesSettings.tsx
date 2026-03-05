"use client";

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Images } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { GalleryBuilder } from '@/components/features/GalleryBuilder';
import { AvailableImagesSelector } from './AvailableImagesSelector';
import { SettingsPageHeader } from '@/components/features/settings/SettingsPrimitives';

interface PlaceholderImagesSettingsProps {
  onSave?: () => void;
}

export function PlaceholderImagesSettings({ onSave }: PlaceholderImagesSettingsProps) {
  const { currentInstance } = useInstance();
  const galleryBuilderRef = React.useRef<{ loadGalleryItems: () => Promise<void> } | null>(null);

  const handleGalleryChange = React.useCallback((galleryItems: any[]) => {
    // The gallery items are automatically saved via the API
    // No need to log or do anything else here
  }, []);

  const handleAddToGallery = async (imageIds: string[]) => {
    if (!currentInstance?.id) return;
    
    try {
      // Add images to the gallery via API
      const response = await fetch('/api/sample_image_gallery', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId: currentInstance.id,
          imageIds: imageIds,
        }),
      });
      
      if (response.ok) {
        // Refresh the gallery after adding images
        await galleryBuilderRef.current?.loadGalleryItems();
      } else {}
    } catch (error) {}
  };

  const handleGalleryRefresh = React.useCallback(async () => {
    await galleryBuilderRef.current?.loadGalleryItems();
  }, []);

  return (
    <div className="space-y-6">
      <SettingsPageHeader
        title="Placeholder images"
        description="Build your sample gallery by selecting and organizing images from your generated content."
      />

      {/* Main Gallery Builder */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left Column - Available Images */}
        <div className="h-full">
          <AvailableImagesSelector
            instanceId={currentInstance?.id || ''}
            onAddToGallery={handleAddToGallery}
            onGalleryRefresh={handleGalleryRefresh}
          />
        </div>

        {/* Right Column - Gallery Builder */}
        <div className="h-full">
          <Card className="h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Images className="h-5 w-5" />
                Your Gallery
              </CardTitle>
              <CardDescription>
                Drag and drop to reorder your sample gallery
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1">
              <GalleryBuilder
                ref={galleryBuilderRef}
                instanceId={currentInstance?.id || ''}
                onGalleryChange={handleGalleryChange}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 
