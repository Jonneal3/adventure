import { StorageConfig } from './types.js';

export function getStorageConfigFromEnv(): StorageConfig {
  const accessKeyId = process.env.NEXT_PUBLIC_SUPABASE_S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.SUPABASE_S3_SECRET_ACCESS_KEY;
  const endpoint = process.env.NEXT_PUBLIC_SUPABASE_S3_ENDPOINT;
  const region = process.env.NEXT_PUBLIC_SUPABASE_S3_REGION;

  if (!accessKeyId || !secretAccessKey || !endpoint || !region) {
    throw new Error('Missing required S3 configuration in environment variables');
  }

  return {
    s3Config: {
      endpoint,
      region,
      credentials: {
        accessKeyId,
        secretAccessKey
      }
    }
  };
} 