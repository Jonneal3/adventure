"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Trash2, 
  GripVertical, 
  Image as ImageIcon,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface GalleryImage {
  id: string;
  image_url: string;
  prompt_id?: string | null;
  metadata?: any;
  created_at: string;
  categories_subcategories?: {
    subcategory: string;
  };
  prompts?: {
    id: string;
    prompt: string;
  };
}

interface GalleryItem {
  id: string;
  instance_id: string;
  image_id: string;
  sort_order: number;
  images: GalleryImage;
}

interface GalleryBuilderProps {
  instanceId: string;
  onGalleryChange?: (galleryItems: GalleryItem[]) => void;
}

export const GalleryBuilder = React.forwardRef<{ loadGalleryItems: () => Promise<void> }, GalleryBuilderProps>(
  ({ instanceId, onGalleryChange }, ref) => {
  const { toast } = useToast();
  const { session } = useAuth();
  const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [isReordering, setIsReordering] = useState(false);

  // Load gallery items
  const loadGalleryItems = useCallback(async () => {
    // Don't make API calls if session is not loaded
    if (!session) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sample_image_gallery?instanceId=${instanceId}`);
      const data = await response.json();
      
      if (response.ok) {
        setGalleryItems(data.galleryImages || []);
        onGalleryChange?.(data.galleryImages || []);
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to load gallery items",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load gallery items",
        variant: "destructive"
      });
    }
  }, [instanceId, onGalleryChange, toast, session]);



  // Remove image from gallery
  const removeImageFromGallery = async (galleryId: string) => {
    // Don't make API calls if session is not loaded
    if (!session) {
      return;
    }
    
    try {
      const response = await fetch(`/api/sample_image_gallery?id=${galleryId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await loadGalleryItems();
        toast({
          title: "Success",
          description: "Image removed from gallery"
        });
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to remove image from gallery",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to remove image from gallery",
        variant: "destructive"
      });
    }
  };

  // Update image order
  const updateImageOrder = async (galleryId: string, newIndex: number) => {
    // Don't make API calls if session is not loaded
    if (!session) {
      return;
    }
    
    setIsReordering(true);
    try {
      const response = await fetch('/api/sample_image_gallery', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          galleryId,
          newIndex,
          instanceId
        })
      });

      if (response.ok) {
        await loadGalleryItems();
      } else {
        const data = await response.json();
        toast({
          title: "Error",
          description: data.error || "Failed to update image order",
          variant: "destructive"
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update image order",
        variant: "destructive"
      });
    } finally {
      setIsReordering(false);
    }
  };

  // Move image up
  const moveImageUp = async (index: number) => {
    if (index <= 0 || !session) return;
    
    // Move to the previous position
    const newIndex = index - 1;
    const item = galleryItems[index];
    await updateImageOrder(item.id, newIndex);
  };

  // Move image down
  const moveImageDown = async (index: number) => {
    if (index >= galleryItems.length - 1 || !session) return;
    
    // Move to the next position
    const newIndex = index + 1;
    const item = galleryItems[index];
    await updateImageOrder(item.id, newIndex);
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, galleryId: string) => {
    if (isReordering) {
      e.preventDefault();
      return;
    }
    setDraggedItem(galleryId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (isReordering) {
      e.preventDefault();
      return;
    }
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e: React.DragEvent, targetGalleryId: string) => {
    e.preventDefault();
    
    if (!draggedItem || draggedItem === targetGalleryId || !session || isReordering) return;

    const draggedIndex = galleryItems.findIndex(item => item.id === draggedItem);
    const targetIndex = galleryItems.findIndex(item => item.id === targetGalleryId);
    
    if (draggedIndex === -1 || targetIndex === -1) return;

    // Calculate the new index for the dragged item
    let newIndex: number;
    
    if (draggedIndex < targetIndex) {
      // Moving down: insert at target position
      newIndex = targetIndex;
    } else {
      // Moving up: insert at target position
      newIndex = targetIndex;
    }

    await updateImageOrder(draggedItem, newIndex);
    setDraggedItem(null);
  };

  // Expose loadGalleryItems function via ref
  React.useImperativeHandle(ref, () => ({
    loadGalleryItems
  }), [loadGalleryItems]);

  // Load data on mount and when instanceId changes
  useEffect(() => {
    if (instanceId && session) {
      loadGalleryItems();
    }
  }, [instanceId, session]);

  return (
    <div className="space-y-4">
      {/* Reordering indicator */}
      {isReordering && (
        <div className="text-sm text-primary animate-pulse">
          • Reordering...
        </div>
      )}

      {/* Gallery Grid */}
      {galleryItems.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <p className="text-sm font-medium text-foreground/90">No gallery images yet</p>
          <p className="text-xs">Add a few images first, then reorder here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {galleryItems.map((item, index) => (
            <div
              key={item.id}
              className={`relative group border rounded-lg overflow-hidden bg-card hover:shadow-md transition-all duration-200 ${
                draggedItem === item.id ? 'opacity-50 scale-95' : ''
              }`}
              draggable
              onDragStart={(e) => handleDragStart(e, item.id)}
              onDragOver={handleDragOver}
              onDrop={(e) => handleDrop(e, item.id)}
            >
              {/* Number Badge */}
              <div className="absolute top-2 left-2 z-10">
                <div className="w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shadow-sm">
                  {index + 1}
                </div>
              </div>

              {/* Image */}
              <div className="aspect-square bg-muted relative">
                <img
                  src={item.images.image_url}
                  alt={item.images.prompts?.prompt || item.images.metadata?.prompt_text || item.images.prompt_id || 'Image'}
                  className="w-full h-full object-cover"
                />
                
                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => moveImageUp(index)}
                    disabled={index === 0 || isReordering}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowUp className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => moveImageDown(index)}
                    disabled={index === galleryItems.length - 1 || isReordering}
                    className="h-8 w-8 p-0"
                  >
                    <ArrowDown className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => removeImageFromGallery(item.id)}
                    disabled={isReordering}
                    className="h-8 w-8 p-0"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Content */}
              <div className="p-3">
                <p className="text-sm font-medium truncate mb-1">
                  {item.images.prompts?.prompt || item.images.metadata?.prompt_text || item.images.prompt_id || 'No prompt'}
                </p>
                {item.images.categories_subcategories && (
                  <Badge variant="secondary" className="text-xs">
                    {item.images.categories_subcategories.subcategory}
                  </Badge>
                )}
              </div>

              {/* Drag Handle */}
              <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="h-4 w-4 text-white drop-shadow-sm cursor-grab" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});