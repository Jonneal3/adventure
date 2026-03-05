import { createClient } from "@supabase/supabase-js";
import { createFetchWithTimeout } from "./fetch-with-timeout";

function decodeJwtRole(token: string): string | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const b64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const payload = JSON.parse(Buffer.from(padded, "base64").toString("utf8"));
    return typeof payload?.role === "string" ? payload.role : null;
  } catch {
    return null;
  }
}

export function createSupabaseAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const serviceKeyRole = serviceKey ? decodeJwtRole(serviceKey) : null;

  if (!supabaseUrl) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL.");
  }
  if (!serviceKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY. Server routes that need private DB access must use the service role key."
    );
  }
  if (serviceKeyRole !== "service_role") {
    throw new Error(
      `SUPABASE_SERVICE_ROLE_KEY is not a service_role key (decoded role=${serviceKeyRole || "unknown"}). Make sure you pasted the service_role secret, not the anon key.`
    );
  }

  const timeoutMsRaw = Number(process.env.SUPABASE_FETCH_TIMEOUT_MS);
  const supabaseFetchTimeoutMs =
    Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0
      ? timeoutMsRaw
      : process.env.NODE_ENV === "production"
        ? 15_000
        : 5_000;

  const supabase = createClient(supabaseUrl, serviceKey, {
    db: { schema: "public" },
    global: {
      fetch: createFetchWithTimeout(supabaseFetchTimeoutMs),
      headers: {
        "Cache-Control": "no-cache, no-store, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Cache-Bust": Date.now().toString(),
      },
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  return { supabase, serviceKeyRole };
}

