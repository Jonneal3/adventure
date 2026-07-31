import type { SupabaseClient } from "@supabase/supabase-js";

export const V2_SERVICE_STARTER_GENERATED_FOR = "v2_service_starter";

export type ServiceStarterRow = {
  created_at: string | null;
  id: string;
  image_url: string;
  metadata: Record<string, unknown> | null;
  model_id: string | null;
};

export async function findV2ServiceStarter(params: {
  supabase: SupabaseClient<any, "public", any>;
  subcategoryId: string;
}): Promise<ServiceStarterRow | null> {
  const result = await params.supabase
    .from("images")
    .select("id, image_url, metadata, model_id, created_at")
    .eq("subcategory_id", params.subcategoryId)
    .is("account_id", null)
    .eq("status", "completed")
    .eq("metadata->>generated_for", V2_SERVICE_STARTER_GENERATED_FOR)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (result.error) {
    throw new Error(`Unable to load the neutral service starter: ${result.error.message}`);
  }

  const row = result.data as ServiceStarterRow | null;
  return row?.id && row?.image_url ? row : null;
}
