import { useState, useEffect } from 'react';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';

interface SubcategoryImageInfo {
  id: string;
  subcategory: string;
  hasImages: boolean;
  imageCount: number;
}

export function useSubcategoryImages(instanceId: string) {
  const [subcategories, setSubcategories] = useState<SubcategoryImageInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const supabase = useSupabaseClientWithAuth();

  useEffect(() => {
    if (!instanceId || !supabase) {
      setLoading(false);
      return;
    }
    checkSubcategoryImages();
  }, [instanceId, supabase]);

  const checkSubcategoryImages = async () => {
    if (!supabase) return;
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
        const categoryName = subcategoryData?.categories?.name || 'Unknown';
        subcategoryInfo.push({
          id: subcategoryData.id,
          subcategory: subcategoryData.subcategory,
          hasImages: (imageCount || 0) > 0,
          imageCount: imageCount || 0,
        });
      }
      setSubcategories(subcategoryInfo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return { subcategories, loading, error };
} 