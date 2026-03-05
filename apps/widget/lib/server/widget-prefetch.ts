import { createClient } from "@supabase/supabase-js";
import { unstable_noStore as noStore } from "next/cache";

import { type DesignSettings } from "@/types/design";

export async function prefetchWidgetInstance(instanceId: string): Promise<{
  instance: any;
  designConfig: DesignSettings;
  rawInstanceConfig: DesignSettings;
} | null> {
  // Ensure Next.js does not cache any fetches in this helper.
  // Without this, Supabase reads can return stale instance.config across refreshes.
  noStore();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: "public" },
    global: {
      // Force all Supabase HTTP calls to bypass Next's fetch cache.
      fetch: (input: any, init?: any) =>
        fetch(input, {
          ...(init || {}),
          cache: "no-store",
        }),
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: instance, error } = await supabase.from("instances").select("*").eq("id", instanceId).single();
  if (error || !instance) {
    console.error("[prefetchWidgetInstance] Failed to load instance:", error);
    return null;
  }

  const rawInstanceConfig: DesignSettings = (instance.config || {}) as any;
  const designConfig: DesignSettings = (rawInstanceConfig || {}) as any;

  return { instance, designConfig, rawInstanceConfig };
}
