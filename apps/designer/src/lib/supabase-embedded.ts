import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Provide a resilient storage that falls back to in-memory when third-party storage is blocked (Shopify iframe)
const memoryStorage = new Map<string, string>();
const safeStorage = {
  getItem(key: string) {
    try {
      return typeof window !== 'undefined' ? window.localStorage.getItem(key) : memoryStorage.get(key) ?? null;
    } catch {
      return memoryStorage.get(key) ?? null;
    }
  },
  setItem(key: string, value: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.setItem(key, value);
      else memoryStorage.set(key, value);
    } catch {
      memoryStorage.set(key, value);
    }
  },
  removeItem(key: string) {
    try {
      if (typeof window !== 'undefined') window.localStorage.removeItem(key);
      else memoryStorage.delete(key);
    } catch {
      memoryStorage.delete(key);
    }
  },
};

// Singleton client with storage fallback for embedded contexts
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: safeStorage as unknown as Storage,
  },
});
