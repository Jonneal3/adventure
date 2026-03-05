import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlaygroundPage() {
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookies().getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookies().set(name, value, options));
          } catch {
            // Called from a Server Component; safe to ignore.
          }
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: userAccounts } = await supabase
    .from("user_accounts")
    .select("account_id,status,user_status")
    .limit(50);

  const accepted =
    userAccounts?.find((ua: any) => String(ua?.status || ua?.user_status || "").toLowerCase() === "accepted") ??
    userAccounts?.[0] ??
    null;

  const accountId = (accepted as any)?.account_id as string | undefined;
  if (!accountId) {
    redirect("/accounts");
  }

  redirect(`/${accountId}/playground`);
}
