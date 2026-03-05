import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type"); // 'industry' | 'prospect' (optional)
    const requireFlowConfig =
      searchParams.get("requireFlowConfig") === "true" || searchParams.get("requireFlowConfig") === "1";
    const excludeFlowConfig =
      searchParams.get("excludeFlowConfig") === "true" || searchParams.get("excludeFlowConfig") === "1";

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

    const supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const isFormEnabled = (config: any): boolean => {
      if (!config || typeof config !== "object") return false;
      return (config as any).form_status_enabled === true;
    };

    let query = supabase
      .from("instances")
      .select("id, name, demo_instance_type, updated_at, config")
      .eq("demo_instance", true)
      .order("updated_at", { ascending: false })
      .limit(25);

    if (type && (type === "industry" || type === "prospect")) {
      query = query.eq("demo_instance_type", type as any);
    }

    const { data, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = Array.isArray(data) ? data : [];

    const instance = requireFlowConfig
      ? rows.find((row: any) => isFormEnabled(row.config)) || null
      : excludeFlowConfig
        ? rows.find((row: any) => !isFormEnabled(row.config)) || null
        : rows[0] || null;

    let flowConfigured = Boolean(instance);

    // Fallback: if we required flow config but didn't find any, return the latest demo instance anyway.
    if (requireFlowConfig && !instance) {
      flowConfigured = false;
      const fallbackInstance = rows?.[0] || null;
      if (!fallbackInstance) {
        return NextResponse.json(
          {
            error:
              "No demo instance found. Mark an instance as demo_instance=true (and optionally demo_instance_type='industry').",
          },
          { status: 404 },
        );
      }

      return NextResponse.json({
        instanceId: fallbackInstance.id,
        name: fallbackInstance.name || null,
        demoInstanceType: fallbackInstance.demo_instance_type || null,
        flowConfigured,
      });
    }

    if (!instance) {
      return NextResponse.json(
        {
          error:
            "No demo instance found. Mark an instance as demo_instance=true (and optionally demo_instance_type='industry').",
        },
        { status: 404 },
      );
    }

    return NextResponse.json({
      instanceId: instance.id,
      name: instance.name || null,
      demoInstanceType: instance.demo_instance_type || null,
      flowConfigured,
    });
  } catch {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
