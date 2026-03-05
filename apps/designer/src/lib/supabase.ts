import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton client for the browser (original, unchanged behavior)
export const supabase = createBrowserClient<Database>(supabaseUrl, supabaseAnonKey);

// Export createClient for use in other files (for backward compatibility)
export const createClient = createBrowserClient;