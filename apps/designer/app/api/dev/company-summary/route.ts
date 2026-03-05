import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import type { Database } from "@/types/database";
import {
  generateCompanySummaryFromUrl,
  type CompanySummaryProvider,
} from "@/lib/ai/companySummary";

export const dynamic = "force-dynamic";

function isDevEnabled() {
  // Never allow this endpoint in prod.
  if (process.env.NODE_ENV === "production") return false;
  // Explicit opt-in (keeps it “bones only” until you flip it).
  return process.env.ENABLE_DEV_COMPANY_SUMMARY === "true";
}

function createSupabaseClient() {
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookies().getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookies().set(name, value, options)
            );
          } catch {
            // Called from a Server Component; ignore.
          }
        },
      },
    }
  );
}

export async function POST(request: NextRequest) {
  if (!isDevEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  try {
    const supabase = createSupabaseClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const url = typeof body?.url === "string" ? body.url : "";
    const provider =
      body?.provider === "openai" || body?.provider === "groq"
        ? (body.provider as CompanySummaryProvider)
        : undefined;

    if (!url.trim()) {
      return NextResponse.json({ error: "url is required" }, { status: 400 });
    }

    const result = await generateCompanySummaryFromUrl({ url, provider });

    return NextResponse.json({
      success: true,
      ...result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

