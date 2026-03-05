import { StorageConfig, ImageUploadOptions, ImageDeleteOptions, ImageStorageAPI } from './types.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { SupabaseClient } from '@supabase/supabase-js';

export class ImageStorage implements ImageStorageAPI {
  private supabaseClient: SupabaseClient | null = null;
  private s3Client: S3Client | null = null;
  private defaultBucket = 'images';
  private s3Endpoint: string | null = null;

  constructor(config: StorageConfig) {
    if (config.s3Config) {
      this.s3Client = new S3Client({
        endpoint: config.s3Config.endpoint,
        region: config.s3Config.region,
        credentials: {
          accessKeyId: config.s3Config.credentials.accessKeyId,
          secretAccessKey: config.s3Config.credentials.secretAccessKey
        },
        forcePathStyle: config.s3Config.forcePathStyle ?? true
      });
      this.s3Endpoint = config.s3Config.endpoint;
    }

    if (config.supabaseClient) {
      this.supabaseClient = config.supabaseClient;
    } else if (config.s3Config) {
      this.s3Client = new S3Client({
        endpoint: config.s3Config.endpoint,
        region: config.s3Config.region,
        credentials: config.s3Config.credentials,
        forcePathStyle: true // Required for Supabase S3 API
      });
      this.s3Endpoint = config.s3Config.endpoint;
    } else {
      throw new Error('Either supabaseClient or s3Config must be provided');
    }
  }

  private async convertToBlob(imageData: string | Blob): Promise<Blob> {
    if (imageData instanceof Blob) {
      return imageData;
    }

    if (typeof imageData === 'string' && imageData.startsWith('data:')) {
      // Convert base64 to blob
      const base64Data = imageData.split(',')[1];
      const byteCharacters = atob(base64Data);
      const byteArrays = [];
      
      for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
        const slice = byteCharacters.slice(offset, offset + 1024);
        const byteNumbers = new Array(slice.length);
        for (let i = 0; i < slice.length; i++) {
          byteNumbers[i] = slice.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        byteArrays.push(byteArray);
      }
      
      return new Blob(byteArrays, { type: 'image/png' });
    }

    throw new Error('Invalid image data format');
  }

  private generateFileName(): string {
    const uniqueId = Math.random().toString(36).substring(2, 8);
    return `${uniqueId}.png`;
  }

  private extractPathFromUrl(url: string): { bucket: string; path: string } {
    const urlObj = new URL(url);
    const parts = urlObj.pathname.split('/');
    // Find the index of 's3' and use it as a reference point
    const s3Index = parts.findIndex(part => part === 's3');
    if (s3Index === -1) {
      throw new Error('Invalid S3 URL format');
    }
    const bucket = parts[s3Index + 1]; // After 's3'
    const path = parts.slice(s3Index + 2).join('/'); // Everything after bucket
    return { bucket, path };
  }

  async uploadImage(imageData: string | Blob, options: ImageUploadOptions = {}): Promise<string> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const bucket = options.bucket || this.defaultBucket;
    const path = options.path || `${Date.now()}.png`;
    let buffer: Uint8Array;

    if (imageData instanceof Blob) {
      buffer = new Uint8Array(await imageData.arrayBuffer());
    } else {
      // Handle base64 string
      const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
      buffer = Buffer.from(base64Data, 'base64');
    }

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: path,
      Body: buffer,
      ContentType: options.contentType || 'image/png'
    });

    await this.s3Client.send(command);

    // Get the URL for the uploaded image
    const imageUrl = this.getPublicUrl(path, bucket);

    // If Supabase client is configured, create a database record
    if (this.supabaseClient) {
      const { data: imageRecord, error: dbError } = await this.supabaseClient
        .from('images')
        .insert({
          image_url: imageUrl,
          instance_id: options.instanceId,
          model_id: options.modelId,
          prompt_id: options.promptId,
          user_id: options.userId,
          negative_prompt: options.negativePrompt,
          metadata: options.metadata || {}
        })
        .select()
        .single();

      if (dbError) {
        // If database insert fails, delete the uploaded file
        await this.deleteImage(imageUrl);
        throw dbError;
      }
    }

    return imageUrl;
  }

  async deleteImage(imageUrl: string, options: ImageDeleteOptions = {}): Promise<void> {
    if (!this.s3Client) {
      throw new Error('S3 client not configured');
    }

    const { bucket, path } = this.extractPathFromUrl(imageUrl);

    const command = new DeleteObjectCommand({
      Bucket: options.bucket || bucket,
      Key: path
    });

    await this.s3Client.send(command);

    // If Supabase client is configured, delete the database record
    if (this.supabaseClient) {
      const { error: dbError } = await this.supabaseClient
        .from('images')
        .delete()
        .eq('image_url', imageUrl);

      if (dbError) {
        throw dbError;
      }
    }
  }

  getPublicUrl(path: string, bucket: string = this.defaultBucket): string {
    if (!this.s3Client || !this.s3Endpoint) {
      throw new Error('S3 client not configured');
    }

    // For Supabase S3, we need to use the object/public endpoint
    // The endpoint is: https://xvpagpzufitqzoijoalz.supabase.co/storage/v1/s3
    // We need: https://xvpagpzufitqzoijoalz.supabase.co/storage/v1/object/public/images/filename.png
    const baseUrl = this.s3Endpoint.replace('/storage/v1/s3', '');
    return `${baseUrl}/storage/v1/object/public/${bucket}/${path}`;
  }
} 