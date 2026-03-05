"use client";

import React from "react";
import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { GalleryBuilder } from "@/components/features/GalleryBuilder";
import { AvailableImagesSelector } from "@/components/features/settings/AvailableImagesSelector";

export function PlaceholderImagesPanel({
  instanceId,
  onClose,
  onGalleryUpdated,
}: {
  instanceId: string;
  onClose: () => void;
  onGalleryUpdated?: () => void;
}) {
  const galleryBuilderRef = React.useRef<{ loadGalleryItems: () => Promise<void> } | null>(null);
  const [isAddOpen, setIsAddOpen] = React.useState(false);

  const handleAddToGallery = async (imageIds: string[]) => {
    if (!instanceId) return;
    try {
      const response = await fetch("/api/sample_image_gallery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instanceId, imageIds }),
      });
      if (response.ok) {
        await galleryBuilderRef.current?.loadGalleryItems();
        onGalleryUpdated?.();
        setIsAddOpen(false);
      }
    } catch {}
  };

  const handleGalleryRefresh = React.useCallback(async () => {
    await galleryBuilderRef.current?.loadGalleryItems();
    onGalleryUpdated?.();
  }, []);

  const handleGalleryChange = React.useCallback(() => {
    onGalleryUpdated?.();
  }, [onGalleryUpdated]);

  return (
    <div className="h-full w-full bg-zinc-100 dark:bg-zinc-900 overflow-auto">
      <div className="p-4 md:p-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="sm" className="h-8 px-2 text-xs" onClick={onClose}>
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>

          <Button size="sm" className="h-8 text-xs" onClick={() => setIsAddOpen(true)}>
            <Plus className="h-3.5 w-3.5 mr-1" />
            Add images
          </Button>
        </div>

        <Card className="h-full">
          <CardContent className="p-4">
            <GalleryBuilder ref={galleryBuilderRef} instanceId={instanceId} onGalleryChange={handleGalleryChange} />
          </CardContent>
        </Card>

        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Add images</DialogTitle>
            </DialogHeader>
            <AvailableImagesSelector
              variant="dialog"
              instanceId={instanceId}
              onAddToGallery={handleAddToGallery}
              onGalleryRefresh={handleGalleryRefresh}
            />
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

