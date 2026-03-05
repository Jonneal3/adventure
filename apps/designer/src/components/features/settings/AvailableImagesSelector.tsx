"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Image, Loader2, Plus, Sparkles, X } from 'lucide-react';
import { useInstance } from '@/contexts/InstanceContext';
import { SubcategorySelector } from './SubcategorySelector';
import { useCreditValidation } from '@/hooks/use-credit-validation';
import { useToast } from '@/hooks/use-toast';

interface AvailableImagesSelectorProps {
  instanceId: string;
  onAddToGallery: (imageIds: string[]) => void;
  onGalleryRefresh?: () => void;
  variant?: "panel" | "dialog";
}

export function AvailableImagesSelector({
  instanceId,
  onAddToGallery,
  onGalleryRefresh,
  variant = "panel",
}: AvailableImagesSelectorProps) {
  const { currentInstance } = useInstance();
  const { validateAndDeduct } = useCreditValidation();
  const { toast } = useToast();
  const [availableImages, setAvailableImages] = React.useState<any[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [selectedImages, setSelectedImages] = React.useState<Set<string>>(new Set());
  const [selectedSubcategoryId, setSelectedSubcategoryId] = React.useState<string | null>(null);
  const [generatingImages, setGeneratingImages] = React.useState(false);
  const [selectedSubcategory, setSelectedSubcategory] = React.useState<any>(null);
  const [imageCount, setImageCount] = React.useState<string>('6');

  // Fetch available images for this instance
  const fetchAvailableImages = React.useCallback(async () => {
    if (!instanceId) {
      return;
    }

    setLoading(true);
    try {
      let url = `/api/sample_image_gallery/available-images?instanceId=${instanceId}&limit=50`;
      if (selectedSubcategoryId) {
        url += `&subcategoryId=${selectedSubcategoryId}`;
      }
      
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAvailableImages(data.images || []);
      } else {
        setAvailableImages([]);
      }
    } catch (error) {
      setAvailableImages([]);
    } finally {
      setLoading(false);
    }
  }, [instanceId, selectedSubcategoryId]);

  React.useEffect(() => {
    fetchAvailableImages();
  }, [fetchAvailableImages]);

  const handleImageSelect = (imageId: string) => {
    const newSelected = new Set(selectedImages);
    if (newSelected.has(imageId)) {
      newSelected.delete(imageId);
    } else {
      newSelected.add(imageId);
    }
    setSelectedImages(newSelected);
  };

  const handleAddSelected = async () => {
    if (selectedImages.size > 0) {
      await onAddToGallery(Array.from(selectedImages));
      setSelectedImages(new Set());
      // Refresh the gallery after adding images
      onGalleryRefresh?.();
    }
  };

  const handleAddAll = async () => {
    const allImageIds = availableImages.map(img => img.id);
    await onAddToGallery(allImageIds);
    // Refresh the gallery after adding images
    onGalleryRefresh?.();
  };

  const handleSubcategoryChange = (subcategoryId: string | null, subcategoryData?: any) => {
    setSelectedSubcategoryId(subcategoryId);
    setSelectedSubcategory(subcategoryData);
    setSelectedImages(new Set()); // Clear selection when changing subcategory
  };

  const handleGenerateSampleImages = async () => {
    if (!selectedSubcategoryId || !selectedSubcategory || !currentInstance?.account_id) {
      return;
    }

    const count = parseInt(imageCount);
    const requiredCredits = count; // 1 credit per image
    const operation = `sample_image_generation_${selectedSubcategory.subcategory}`;

    // Validate and deduct credits before generation
    const creditSuccess = await validateAndDeduct(requiredCredits, operation);
    if (!creditSuccess) {
      return; // Credit validation failed, don't proceed with generation
    }

    setGeneratingImages(true);
    try {
      const response = await fetch('/api/sample_image_gallery/generate-samples', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          instanceId,
          subcategoryId: selectedSubcategoryId,
          subcategoryName: selectedSubcategory.subcategory,
          accountId: currentInstance.account_id,
          count: count,
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        
        if (data.success) {
          // Refresh the available images to show the newly generated ones
          await fetchAvailableImages();
          toast({
            title: "Success",
            description: data.message,
          });
        } else {
          toast({
            title: "Generation Failed",
            description: data.message || "Failed to generate images",
            variant: "destructive",
          });
          if (data.errors && data.errors.length > 0) {
            console.error("Generation errors:", data.errors);
          }
        }
      } else {
        const errorData = await response.json();
        toast({
          title: "Error",
          description: errorData.error || "Failed to generate images",
          variant: "destructive",
        });
      }
    } catch (error) {} finally {
      setGeneratingImages(false);
    }
  };

  const countOptions = React.useMemo(() => ['3', '6', '12', '24'], []);
  const creditsText = `${imageCount} credit${imageCount === '1' ? '' : 's'}`;
  const canGenerate = Boolean(selectedSubcategoryId && selectedSubcategory && currentInstance?.account_id);
  const selectedCount = selectedImages.size;

  const body = (
    <div className="p-3 space-y-3">
      {/* Controls */}
      <div className="grid grid-cols-1 gap-2">
        <SubcategorySelector
          instanceId={instanceId}
          selectedSubcategoryId={selectedSubcategoryId}
          onSubcategoryChange={handleSubcategoryChange}
        />

        <div className="flex items-center gap-2">
          <Select value={imageCount} onValueChange={setImageCount} disabled={!selectedSubcategoryId}>
            <SelectTrigger className="h-9 w-32">
              <SelectValue placeholder="Count" />
            </SelectTrigger>
            <SelectContent>
              {countOptions.map((v) => (
                <SelectItem key={v} value={v}>
                  {v} images
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button onClick={handleGenerateSampleImages} disabled={!canGenerate || generatingImages} className="h-9 flex-1">
            {generatingImages ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Generating…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>

        {variant === "panel" ? (
          <div className="text-[11px] text-muted-foreground">
            {selectedSubcategoryId ? `Uses ${creditsText}.` : 'Select a subcategory to generate samples.'}
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : availableImages.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border/70 bg-background/30 px-4 py-6 text-center">
          <div className="text-xs font-medium text-foreground/90">
            {selectedSubcategoryId ? 'No samples yet.' : 'No images yet.'}
          </div>
          {variant === "panel" ? (
            <div className="mt-1 text-[11px] text-muted-foreground">
              {selectedSubcategoryId ? 'Generate a batch above.' : 'Choose a subcategory to get started.'}
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2 max-h-[420px] overflow-y-auto pr-1">
            {availableImages.map((image) => {
              const selected = selectedImages.has(image.id);
              const promptText = String(image.metadata?.prompt_text || '');
              return (
                <button
                  key={image.id}
                  type="button"
                  className={`group relative overflow-hidden rounded-lg border text-left transition ${
                    selected ? 'border-primary ring-2 ring-primary/20' : 'border-border hover:border-foreground/30'
                  }`}
                  onClick={() => handleImageSelect(image.id)}
                  aria-pressed={selected}
                  title={promptText || undefined}
                >
                  <div className="aspect-square bg-muted">
                    {image.status === 'generating' ? (
                      <div className="h-full w-full flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : image.status === 'failed' ? (
                      <div className="h-full w-full flex items-center justify-center">
                        <X className="h-5 w-5 text-muted-foreground" />
                      </div>
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={image.image_url} alt={promptText || 'Generated image'} className="h-full w-full object-cover" />
                    )}
                  </div>

                  <div
                    className={`absolute top-2 right-2 h-5 w-5 rounded-full border flex items-center justify-center text-[10px] ${
                      selected ? 'bg-primary text-primary-foreground border-primary' : 'bg-background/70 text-transparent border-border'
                    }`}
                  >
                    ✓
                  </div>

                  {variant === "panel" && promptText ? (
                    <div className="absolute inset-x-0 bottom-0 opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity">
                      <div className="bg-gradient-to-t from-black/70 to-transparent px-2 py-2">
                        <div className="text-[11px] text-white/90 truncate">{promptText}</div>
                      </div>
                    </div>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={handleAddSelected} disabled={selectedCount === 0} className="h-9 flex-1">
              <Plus className="h-4 w-4 mr-2" />
              Add {selectedCount > 0 ? `${selectedCount} selected` : 'selected'}
            </Button>
            <Button variant="ghost" onClick={handleAddAll} className="h-9">
              Add all
            </Button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    variant === "dialog" ? (
      <div className="rounded-lg border border-border/60 bg-card/40 shadow-sm">{body}</div>
    ) : (
      <div className="rounded-xl border border-border/60 bg-card/40 shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b border-border/50 px-3 py-2.5">
          <div className="flex items-center gap-2 min-w-0">
            <Image className="h-4 w-4 text-muted-foreground" />
            <div className="min-w-0">
              <div className="text-xs font-medium text-foreground/90">Add images</div>
              <div className="text-[11px] text-muted-foreground truncate">Generate a few samples, then add what you like.</div>
            </div>
          </div>
          {!loading && availableImages.length > 0 ? (
            <div className="text-[11px] text-muted-foreground">{availableImages.length} available</div>
          ) : null}
        </div>
        {body}
      </div>
    )
  );
} 