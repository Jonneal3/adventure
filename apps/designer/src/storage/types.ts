import { SupabaseClient } from '@supabase/supabase-js';

export interface StorageConfig {
  supabaseClient?: SupabaseClient;
  s3Config?: {
    endpoint: string;
    region: string;
    credentials: {
      accessKeyId: string;
      secretAccessKey: string;
    };
    forcePathStyle?: boolean;
  };
}

export interface ImageUploadOptions {
  /**
   * The bucket to upload to. Defaults to 'images'.
   */
  bucket?: string;
  
  /**
   * Content type of the image. Defaults to 'image/png'.
   */
  contentType?: string;
  
  /**
   * Whether to overwrite existing files. Defaults to false.
   */
  upsert?: boolean;
  
  /**
   * Custom path/filename. If not provided, a random name will be generated.
   */
  path?: string;
  
  /**
   * Match the images table schema
   */
  instanceId?: string;
  modelId?: string;
  promptId?: string;
  userId?: string;
  negativePrompt?: string;
  metadata?: Record<string, any>; // For any additional metadata
}

export interface ImageDeleteOptions {
  /**
   * The bucket to delete from. Defaults to 'images'.
   */
  bucket?: string;
}

export interface ImageStorageAPI {
  /**
   * Upload an image to storage and get its public URL
   */
  uploadImage(imageData: string | Blob, options?: ImageUploadOptions): Promise<string>;
  
  /**
   * Delete an image from storage
   */
  deleteImage(imageUrl: string, options?: ImageDeleteOptions): Promise<void>;
  
  /**
   * Get the public URL for an image
   */
  getPublicUrl(path: string, bucket?: string): string;
} 