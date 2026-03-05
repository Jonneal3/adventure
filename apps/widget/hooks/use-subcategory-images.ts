import { useState, useEffect } from 'react';
import { createBrowserClient } from '@supabase/ssr';

interface SubcategoryImageInfo {
  id: string;
  subcategory: string;
  category_name: string;
  hasImages: boolean;
  imageCount: number;
}

export function useSubcategoryImages(instanceId: string) {
  const [subcategories, setSubcategories] = useState<SubcategoryImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    if (!instanceId) {
      setLoading(false);
      return;
    }

    checkSubcategoryImages();
  }, [instanceId]);

  const checkSubcategoryImages = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get all subcategories for this instance
      const { data: instanceSubcategories, error: instanceError } = await supabase
        .from('instance_subcategories')
        .select(`
          category_subcategory_id,
          categories_subcategories (
            id,
            subcategory,
            categories ( name )
          )
        `)
        .eq('instance_id', instanceId);

      if (instanceError) throw instanceError;

      if (!instanceSubcategories || instanceSubcategories.length === 0) {
        setSubcategories([]);
        return;
      }

      // Check which subcategories have images
      const subcategoryInfo: SubcategoryImageInfo[] = [];

      for (const instanceSub of instanceSubcategories) {
        const subcategoryData = instanceSub.categories_subcategories as any;
        if (!subcategoryData) continue;

        // Check if this subcategory has images
        const { count: imageCount } = await supabase
          .from('images')
          .select('*', { count: 'exact', head: true })
          .eq('subcategory_id', subcategoryData.id);

        subcategoryInfo.push({
          id: subcategoryData.id,
          subcategory: subcategoryData.subcategory,
          category_name: (subcategoryData.categories?.name as string) || 'Unknown',
          hasImages: (imageCount || 0) > 0,
          imageCount: imageCount || 0,
        });
      }

      setSubcategories(subcategoryInfo);

    } catch (err) {
      console.error('Error checking subcategory images:', err);
      setError('Failed to check subcategory images');
    } finally {
      setLoading(false);
    }
  };

  const hasAnyImages = subcategories.some(sub => sub.hasImages);
  const subcategoriesWithoutImages = subcategories.filter(sub => !sub.hasImages);
  const subcategoriesWithImages = subcategories.filter(sub => sub.hasImages);

  return {
    subcategories,
    subcategoriesWithoutImages,
    subcategoriesWithImages,
    hasAnyImages,
    loading,
    error,
    refresh: checkSubcategoryImages,
  };
} 