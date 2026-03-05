"use client";

import { useState, useEffect } from "react";
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';

interface SubcategoryGalleryNotificationProps {
  instanceId: string;
  onDismiss?: () => void;
  onClick?: () => void; // New prop for handling clicks
}

interface SubcategoryInfo {
  id: string;
  subcategory: string;
  description?: string;
  categoryDescription?: string;
}

interface InstanceSubcategory {
  category_subcategory_id: string;
  categories_subcategories: {
    id: string;
    subcategory: string;
    description?: string;
    categories: {
      name: string;
      description?: string;
    };
  };
}

export function SubcategoryGalleryNotification({
  instanceId,
  onDismiss,
  onClick
}: SubcategoryGalleryNotificationProps) {
  const supabase = useSupabaseClientWithAuth();
  const [subcategoriesWithoutImages, setSubcategoriesWithoutImages] = useState<SubcategoryInfo[]>([]);
  const [selectedServices, setSelectedServices] = useState<SubcategoryInfo[]>([]);
  const [imageCount, setImageCount] = useState(6);
  const [userCredits, setUserCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  
  const { toast } = useToast();

  useEffect(() => {
    // Persist dismiss across reloads (per instance) to avoid being annoying.
    try {
      const key = `placeholder-gallery-tip-dismissed:${instanceId}`;
      if (typeof window !== "undefined" && window.localStorage.getItem(key) === "1") {
        setDismissed(true);
      }
    } catch {}
  }, [instanceId]);

  useEffect(() => {
    if (!supabase) return;
    checkSubcategoriesWithoutImages();
    fetchUserCredits();
  }, [instanceId, supabase]);

  const fetchUserCredits = async () => {
    if (!supabase) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // For now, set a mock credit amount since the credits table might not exist
        setUserCredits(10); // Mock credits for testing
      }
    } catch (error) {
      setUserCredits(0);
    }
  };

  const checkSubcategoriesWithoutImages = async () => {
    if (!supabase) return;
    try {
      setLoading(true);

      // Get all subcategories for this instance
      const { data: instanceSubcategories, error: instanceError } = await supabase
        .from('instance_subcategories')
        .select(`
          category_subcategory_id,
          categories_subcategories (
            id,
            subcategory,
            description,
            categories (
              name,
              description
            )
          )
        `)
        .eq('instance_id', instanceId);

      if (instanceError) throw instanceError;

      if (!instanceSubcategories || instanceSubcategories.length === 0) {
        setSubcategoriesWithoutImages([]);
        return;
      }

      // Extract subcategory IDs for batch querying
      const subcategoryIds = instanceSubcategories
        .map((instanceSub: any) => {
          const subcategoryData = instanceSub.categories_subcategories as unknown as InstanceSubcategory['categories_subcategories'];
          return subcategoryData?.id;
        })
        .filter(Boolean);

      if (subcategoryIds.length === 0) {
        setSubcategoriesWithoutImages([]);
        return;
      }

      // Check for placeholder images in instance_sample_gallery by joining with images table
      const { data: placeholderImages, error: placeholderError } = await supabase
        .from('instance_sample_gallery')
        .select(`
          image_id,
          images (
            subcategory_id
          )
        `)
        .eq('instance_id', instanceId);

      if (placeholderError) throw placeholderError;

      // Create a set of subcategory IDs that have placeholder images
      const subcategoriesWithPlaceholders = new Set(
        placeholderImages?.map((item: any) => item.images?.subcategory_id).filter(Boolean) || []
      );

      // Additional check: Verify that the placeholder images actually exist and are valid
      const validSubcategoriesWithPlaceholders = new Set<string>();

      const placeholderSubcategoryArray = Array.from(subcategoriesWithPlaceholders);
      for (let i = 0; i < placeholderSubcategoryArray.length; i++) {
        const subcategoryId = placeholderSubcategoryArray[i] as string;
        // Check if there are actual images in the sample gallery for this subcategory
        const { count: imageCount } = await supabase
          .from('instance_sample_gallery')
          .select('*', { count: 'exact', head: true })
          .eq('instance_id', instanceId)
          .in('image_id',
            (placeholderImages
              ?.filter((item: any) => item.images?.subcategory_id === subcategoryId)
              .map((item: any) => item.image_id)) || []
          );

        if (imageCount && imageCount > 0) {
          validSubcategoriesWithPlaceholders.add(subcategoryId);
        }
      }

      // Find subcategories without placeholder images
      const subcategoriesToCheck: SubcategoryInfo[] = [];

      for (let idx = 0; idx < instanceSubcategories.length; idx++) {
        const instanceSub = instanceSubcategories[idx] as any;
        const subcategoryData = instanceSub.categories_subcategories as any;
        if (!subcategoryData) continue;

        // Check if this subcategory has placeholder images using the validated result
        if (!validSubcategoriesWithPlaceholders.has(subcategoryData.id)) {
          subcategoriesToCheck.push({
            id: subcategoryData.id,
            subcategory: subcategoryData.subcategory,
            description: subcategoryData.description,
            categoryDescription: subcategoryData.categories?.description,
          });
        }
      }

      setSubcategoriesWithoutImages(subcategoriesToCheck);
      // Initialize selected services with all subcategories without images
      setSelectedServices(subcategoriesToCheck);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to check subcategory images",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Generation CTA is handled inside the Manage panel now (PlaceholderImagesPanel).

  const handleDismiss = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the card click
    setDismissed(true);
    try {
      const key = `placeholder-gallery-tip-dismissed:${instanceId}`;
      if (typeof window !== "undefined") window.localStorage.setItem(key, "1");
    } catch {}
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleCardClick = () => {
    if (onClick) {
      onClick();
    }
  };

  if (dismissed) {
    return null;
  }

  if (loading) {
    return null; // Don't show loading state to prevent flash
  }

  // Only show if there are subcategories without images AND we're not loading
  if (loading || subcategoriesWithoutImages.length === 0) {
    return null;
  }

  return (
    <Card className="w-full border border-border bg-card/80 shadow-sm">
      <CardContent className="p-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-semibold text-foreground/90">Set up your placeholder gallery</div>
            <div className="mt-1 text-xs text-muted-foreground">
              Your services don’t have placeholder images yet. Add a few so the gallery isn’t empty before the first generation.
            </div>
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleDismiss}
            className="h-7 w-7 p-0 hover:bg-background/50 shrink-0"
            aria-label="Dismiss"
            title="Dismiss"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-muted-foreground">
            {subcategoriesWithoutImages.length} services missing placeholders
          </div>
          <Button type="button" size="sm" className="h-8 text-xs" onClick={handleCardClick}>
            Generate placeholders
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 