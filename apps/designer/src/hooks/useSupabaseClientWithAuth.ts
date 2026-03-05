import { supabase } from '@/lib/supabase';
export function useSupabaseClientWithAuth() {
  return supabase;
} 