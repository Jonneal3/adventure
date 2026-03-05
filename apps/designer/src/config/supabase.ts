"use client";

import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '../types/database';

export const createClientComponent = () => {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
};

export type { Database } from '../types/database'; 