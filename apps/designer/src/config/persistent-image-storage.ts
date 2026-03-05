import { Database } from '../types/database';
import { createClient } from './client';

/**
 * Helper functions for persisting images in Supabase storage.
 */

/**
 * Uploads an image to Supabase storage and returns the public URL.
 * @param file The file to upload
 * @param path The path to store the file at
 * @returns The public URL of the uploaded file
 */
export async function uploadImage(file: File, path: string): Promise<string> {
  // Special-case: logos are uploaded from the designer and frequently hit Storage RLS.
  // We route these uploads through a server endpoint that verifies access and uses
  // the service role key to upload to the `images` bucket, then returns a public URL.
  if (typeof window !== 'undefined' && path.startsWith('logos/')) {
    const instanceId = path.split('/')[1] || '';
    if (!instanceId) throw new Error('Missing instance id for logo upload');

    const form = new FormData();
    form.set('instanceId', instanceId);
    form.set('file', file);

    const res = await fetch('/api/uploads/logo', { method: 'POST', body: form });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(json?.error || 'Upload failed');
    }
    if (!json?.url) throw new Error('Upload failed (missing URL)');
    return String(json.url);
  }

  const supabase = createClient();

  // Generate a unique filename
  const timestamp = Date.now();
  const filename = `${timestamp}-${file.name}`;
  const fullPath = `${path}/${filename}`;

  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from('images')
    .upload(fullPath, file, {
      cacheControl: '3600',
      upsert: false,
    });

  if (error) {
    // Surface the most actionable detail for RLS issues.
    const message = (error as any)?.message ? String((error as any).message) : String(error);
    throw new Error(message);
  }

  // Get the public URL
  const { data: { publicUrl } } = supabase.storage
    .from('images')
    .getPublicUrl(data.path);

  return publicUrl;
}

/**
 * Deletes an image from Supabase storage.
 * @param path The path of the file to delete
 */
export async function deleteImage(path: string): Promise<void> {
  const supabase = createClient();

  // Accept either a full public URL or a storage-relative path.
  // Supabase `remove()` expects the full object path (including folders) within the bucket.
  let objectPath: string | null = null;
  try {
    const url = new URL(path);
    const parts = url.pathname.split('/');
    const publicIndex = parts.findIndex((p) => p === 'public');
    if (publicIndex >= 0) {
      const bucket = parts[publicIndex + 1];
      const rest = parts.slice(publicIndex + 2).join('/');
      if (bucket === 'images' && rest) objectPath = rest;
    }
  } catch {
    // Not a URL; treat as storage-relative.
    objectPath = path.replace(/^\/+/, '');
  }

  if (!objectPath) throw new Error('Invalid path');

  const { error } = await supabase.storage
    .from('images')
    .remove([objectPath]);

  if (error) {
    const message = (error as any)?.message ? String((error as any).message) : String(error);
    throw new Error(message);
  }
} 