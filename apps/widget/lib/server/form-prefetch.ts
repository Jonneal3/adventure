import { createClient } from "@supabase/supabase-js";

import { defaultDesignSettings, type DesignSettings } from "@/types/design";

function extractFormDesignConfig(instance: any): DesignSettings {
  return (
    instance?.designSettings ||
    instance?.designConfig ||
    instance?.design_settings ||
    instance?.config?.designSettings ||
    instance?.config?.design ||
    instance?.design ||
    defaultDesignSettings
  );
}

export async function prefetchFormInstance(instanceId: string): Promise<{
  instance: any;
  designConfig: DesignSettings;
} | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) return null;

  const supabase = createClient(supabaseUrl, supabaseKey, {
    db: { schema: "public" },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const { data: instance, error } = await supabase.from("instances").select("*").eq("id", instanceId).single();
  if (error || !instance) return null;

  const designConfig = extractFormDesignConfig(instance);
  return { instance, designConfig };
}
