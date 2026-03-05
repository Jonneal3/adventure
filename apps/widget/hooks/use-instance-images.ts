import { useState, useEffect, useCallback, useRef } from 'react';

interface InstanceImage {
  id: string;
  image: string;
  prompt: string | null;
  category: string | null;
  subcategory: string | null;
  generated_for_gallery: boolean;
  created_at: string;
  prompt_id: string | null;
  subcategory_id: string | null;
  sort_order?: number | null;
}

interface UseInstanceImagesReturn {
  images: InstanceImage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
  isSampleGallery: boolean;
  isGenerating: boolean;
  setIsGenerating: (generating: boolean) => void;
}

export function useInstanceImages(instanceId: string | null): UseInstanceImagesReturn {
  const [images, setImages] = useState<InstanceImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isSampleGallery, setIsSampleGallery] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Track if we've already fetched for this instanceId
  const fetchedInstanceIdRef = useRef<string | null>(null);

  // Fetch sample gallery once when instanceId changes
  useEffect(() => {
    if (instanceId) {
      // Only fetch if we haven't already fetched for this instanceId
      if (fetchedInstanceIdRef.current !== instanceId) {
        fetchedInstanceIdRef.current = instanceId;
        
        const fetchSampleGallery = async () => {
          setLoading(true);
          setError(null);

          try {
            const response = await fetch(`/api/sample-gallery/${instanceId}?limit=12&offset=0`);
            
            if (!response.ok) {
              throw new Error('Failed to fetch sample gallery images');
            }

            const data = await response.json();
            
            if (data.success && data.images.length > 0) {
              setImages(data.images);
              setHasMore(data.hasMore || false);
              setIsSampleGallery(true);
            } else {
              setImages([]);
              setHasMore(false);
              setIsSampleGallery(false);
            }
          } catch (err) {
            console.error('❌ [useInstanceImages] Sample gallery error:', err);
            setError(err instanceof Error ? err.message : 'An error occurred');
          } finally {
            setLoading(false);
          }
        };
        
        fetchSampleGallery();
      }
    } else {
      setImages([]);
      setHasMore(false);
      setIsSampleGallery(false);
      setIsGenerating(false);
      fetchedInstanceIdRef.current = null;
    }
  }, [instanceId]); // Remove fetchSampleGallery from dependencies

  // Simple functions that don't do anything (for compatibility)
  const loadMore = useCallback(() => {
    // Not implemented for sample gallery
  }, []);

  const refresh = useCallback(() => {
    // Not implemented for sample gallery
  }, []);

  // Function to mark that generation has started
  const handleGenerationStart = useCallback((generating: boolean) => {
    setIsGenerating(generating);
  }, []);

  return {
    images,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    isSampleGallery,
    isGenerating,
    setIsGenerating: handleGenerationStart
  };
} 