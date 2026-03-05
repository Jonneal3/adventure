import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

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
}

interface UseInstanceImagesReturn {
  images: InstanceImage[];
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

export function useInstanceImages(instanceId: string | null): UseInstanceImagesReturn {
  const { session, user, isLoading } = useAuth();
  const [images, setImages] = useState<InstanceImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  const fetchImages = async (isLoadMore = false) => {
    if (!instanceId) return;
    
    // Don't fetch if user is not authenticated or auth is still loading
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
      const response = await fetch(`/api/images/${instanceId}?limit=12&offset=${currentOffset}`, {
        credentials: 'include', // Include cookies for authentication
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Authentication required');
          return;
        }
        throw new Error(`Failed to fetch images: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (data.success) {
        if (isLoadMore) {
          setImages(prev => [...prev, ...data.images]);
        } else {
          setImages(data.images);
        }
        
        setHasMore(data.hasMore);
        setOffset(currentOffset + data.images.length);
      } else {
        throw new Error(data.error || 'Failed to fetch images');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError(errorMessage);
      
      // Only log non-authentication errors to avoid console spam
      if (!errorMessage.includes('Authentication') && !errorMessage.includes('401')) {}
    } finally {
      setLoading(false);
      setIsInitialLoad(false);
    }
  };

  useEffect(() => {
    // Add a small delay to ensure auth context is fully established
    const timer = setTimeout(() => {
      if (instanceId && session && user && !isLoading) {
        setOffset(0);
        setIsInitialLoad(true);
        fetchImages(false);
      } else if (!isLoading && (!session || !user)) {
        // Clear images if user is not authenticated
        setImages([]);
        setHasMore(true);
        setOffset(0);
        setError(null);
      } else if (!instanceId) {
        setImages([]);
        setHasMore(true);
        setOffset(0);
      }
    }, 100); // Small delay to ensure auth is ready

    return () => clearTimeout(timer);
  }, [instanceId, session, user, isLoading]);

  const loadMore = () => {
    if (!loading && hasMore && session && user && !isLoading) {
      fetchImages(true);
    }
  };

  const refresh = () => {
    if (session && user && !isLoading) {
      setOffset(0);
      setIsInitialLoad(true);
      fetchImages(false);
    }
  };

  return {
    images,
    loading: loading || isLoading,
    error,
    hasMore,
    loadMore,
    refresh
  };
} 