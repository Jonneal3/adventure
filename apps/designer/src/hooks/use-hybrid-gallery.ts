import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

interface GalleryImage {
  id: string;
  image: string;
  prompt: string | null;
  category?: string | null;
  subcategory?: string | null;
  created_at: string;
  isPreloaded: boolean; // Distinguish between preloaded and generated images
  sort_order?: number;
}

interface UseHybridGalleryReturn {
  images: GalleryImage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  addGeneratedImage: (image: Omit<GalleryImage, 'isPreloaded'>) => void;
  removeImage: (imageId: string) => void;
}

export function useHybridGallery(instanceId: string | null): UseHybridGalleryReturn {
  const { session, user, isLoading } = useAuth();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  // Fetch both preloaded and generated images
  const fetchHybridImages = useCallback(async (isLoadMore = false) => {
    if (!instanceId) return;
    
    if (isLoading || !session || !user) {
      if (!isLoading) {
        setError('User not authenticated');
      }
      setLoading(false);
      setIsInitialLoad(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const currentOffset = isLoadMore ? offset : 0;
      
      // Fetch preloaded sample gallery images
      const sampleResponse = await fetch(`/api/sample_image_gallery?instanceId=${instanceId}`, {
        credentials: 'include',
      });
      
      let preloadedImages: GalleryImage[] = [];
      if (sampleResponse.ok) {
        const sampleData = await sampleResponse.json();
        preloadedImages = (sampleData.galleryImages || []).map((item: any) => ({
          id: item.id,
          image: item.images?.image_url || '',
          prompt: item.images?.prompt_id || null, // Using prompt_id since there's no direct prompt field
          category: item.images?.metadata?.category || null,
          subcategory: item.images?.metadata?.subcategory || null,
          created_at: item.images?.created_at || new Date().toISOString(),
          isPreloaded: true,
          sort_order: item.sort_order || 0,
        }));
      }

      // Fetch user-generated images
      const generatedResponse = await fetch(`/api/images/${instanceId}?limit=12&offset=${currentOffset}`, {
        credentials: 'include',
      });
      
      let generatedImages: GalleryImage[] = [];
      let hasMoreGenerated = false;
      
      if (generatedResponse.ok) {
        const generatedData = await generatedResponse.json();
        if (generatedData.success) {
          generatedImages = (generatedData.images || []).map((img: any) => ({
            id: img.id,
            image: img.image_url, // Using image_url from the images table
            prompt: img.prompt_id || null, // Using prompt_id since there's no direct prompt field
            category: img.metadata?.category || null,
            subcategory: img.metadata?.subcategory || null,
            created_at: img.created_at,
            isPreloaded: false,
          }));
          hasMoreGenerated = generatedData.hasMore;
        }
      }

      // Combine images: preloaded first (sorted by sort_order), then generated
      const sortedPreloaded = preloadedImages.sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
      const combinedImages = [...sortedPreloaded, ...generatedImages];

      if (isLoadMore) {
        setImages(prev => {
          // Remove duplicates and combine
          const existingIds = new Set(prev.map(img => img.id));
          const newImages = combinedImages.filter(img => !existingIds.has(img.id));
          return [...prev, ...newImages];
        });
      } else {
        setImages(combinedImages);
      }
      
      setHasMore(hasMoreGenerated);
      setOffset(currentOffset + generatedImages.length);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      
      if (!errorMessage.includes('Authentication') && !errorMessage.includes('401')) {}
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  }, [instanceId, session, user, isLoading, offset]);

  // Add a newly generated image to the gallery
  const addGeneratedImage = useCallback((image: Omit<GalleryImage, 'isPreloaded'>) => {
    const newImage: GalleryImage = {
      ...image,
      isPreloaded: false,
    };
    
    setImages(prev => {
      // Add to the end of generated images (after preloaded)
      const preloadedImages = prev.filter(img => img.isPreloaded);
      const generatedImages = prev.filter(img => !img.isPreloaded);
      return [...preloadedImages, ...generatedImages, newImage];
    });
  }, []);

  // Remove an image from the gallery
  const removeImage = useCallback((imageId: string) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
  }, []);

  const loadMore = useCallback(() => {
    if (!loading && hasMore) {
      fetchHybridImages(true);
    }
  }, [loading, hasMore, fetchHybridImages]);

  const refresh = useCallback(() => {
    setOffset(0);
    setIsInitialLoad(true);
    fetchHybridImages(false);
  }, [fetchHybridImages]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (instanceId && session && user && !isLoading) {
        setOffset(0);
        setIsInitialLoad(true);
        fetchHybridImages(false);
      } else if (!isLoading && (!session || !user)) {
        setImages([]);
        setError('User not authenticated');
        setIsInitialLoad(false);
      }
    }, 100);

    return () => clearTimeout(timer);
  }, [instanceId, session, user, isLoading, fetchHybridImages]);

  return {
    images,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    addGeneratedImage,
    removeImage,
  };
} 