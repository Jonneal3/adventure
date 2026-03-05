import "server-only";

import { createClient } from "@supabase/supabase-js";

type SubscriptionStatus = "active" | "trialing" | "past_due" | "canceled" | "inactive" | string | null;

function createServerSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseKey) return null;

  return createClient(supabaseUrl, supabaseKey, {
    db: { schema: "public" },
    global: {
      // Ensure we never accidentally cache subscription reads.
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
}

export function resolveInstanceDisplayName(instance: any): string | null {
  const rawName = typeof instance?.name === "string" ? instance.name : null;
  const name = rawName?.trim() || "";
  if (name) return name;

  const rawBrandName = typeof instance?.config?.brand_name === "string" ? instance.config.brand_name : null;
  const brandName = rawBrandName?.trim() || "";
  if (brandName) return brandName;

  return null;
}

export async function isAccountActivePaying(accountId: string | null | undefined): Promise<boolean> {
  if (!accountId) return false;
  const supabase = createServerSupabase();
  if (!supabase) return false;

  const { data: sub, error: subErr } = await supabase
    .from("user_subscriptions")
    .select("status, monthly_price_cents, stripe_subscription_id")
    .eq("account_id", accountId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (subErr || !sub) return false;

  const status = (sub.status as SubscriptionStatus) ?? null;
  const statusLower = status?.toLowerCase() ?? "";
  const isActive = statusLower === "active";

  const hasStripeSubscription = Boolean(sub.stripe_subscription_id);
  const hasPrice = (sub.monthly_price_cents ?? 0) > 0;
  const isPaying = hasStripeSubscription || hasPrice;

  return isActive && isPaying;
}

export async function buildInstanceTitle(params: {
  brandName?: string;
  instance: any;
}): Promise<string> {
  const brandName = (params.brandName || "Adventure").trim() || "Adventure";
  const displayName = resolveInstanceDisplayName(params.instance);

  // If we can't resolve a name, stick to the core brand.
  if (!displayName) return brandName;

  const accountId = (params.instance as any)?.account_id as string | null | undefined;
  const isPaying = await isAccountActivePaying(accountId);

  // Paid plans can use ONLY their business/widget name.
  if (isPaying) return displayName;

  // Otherwise, include the platform brand prefix.
  return `${brandName} - ${displayName}`;
}

