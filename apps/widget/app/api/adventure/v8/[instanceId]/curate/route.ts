/**
 * Persist Adventure V8 curation events and write winning generations
 * into the images catalog so future customers can retrieve them.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ instanceId: string }> };

function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

type CurationEvent = {
  type?: string;
  url?: string;
  source?: string;
  mode?: string;
};

type WriteBackCandidate = {
  url?: string;
  label?: string;
  serviceId?: string;
  serviceLabel?: string;
  industry?: string;
  scope?: string;
  finishTier?: string;
  /** Legacy only; new catalog writes use finishTier. */
  priceTier?: string;
  priceRange?: { min?: number; max?: number; currency?: string; source?: string } | null;
  modelId?: string;
  projectManifest?: Record<string, unknown> | null;
  writeBack?: Record<string, unknown>;
};

function statKeyForEvent(type: string): "shown" | "selected" | "saved" | "shared" | "conversions" | null {
  if (type === "shown") return "shown";
  if (type === "selected" || type === "favorite") return "selected";
  if (type === "saved") return "saved";
  if (type === "share" || type === "shared") return "shared";
  if (type === "conversion" || type === "quote") return "conversions";
  return null;
}

function emptyStats() {
  return { shown: 0, selected: 0, saved: 0, shared: 0, conversions: 0, impressions: 0, clicks: 0 };
}

function incrementStat(stats: Record<string, unknown>, type: string) {
  const key = statKeyForEvent(type);
  if (!key) return;
  stats[key] = Number(stats[key] || 0) + 1;
  if (key === "shown") stats.impressions = Number(stats.impressions || 0) + 1;
  if (key === "selected") stats.clicks = Number(stats.clicks || 0) + 1;
}

function isWorthKeeping(stats: Record<string, unknown>): boolean {
  return (
    Number(stats.selected || 0) > 0 ||
    Number(stats.saved || 0) > 0 ||
    Number(stats.shared || 0) > 0 ||
    Number(stats.conversions || 0) > 0
  );
}

export async function POST(req: NextRequest, ctx: Ctx) {
  const { instanceId } = await ctx.params;
  const id = String(instanceId || "").trim();
  if (!id) {
    return NextResponse.json({ ok: false, error: "missing_instance" }, { status: 400 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }

  const events = Array.isArray(body.events) ? (body.events as CurationEvent[]) : [];
  const writeBack = body.writeBack === true || body.persist === true;
  const candidates = Array.isArray(body.candidates)
    ? (body.candidates as WriteBackCandidate[])
    : body.candidate
      ? [body.candidate as WriteBackCandidate]
      : [];

  const supabase = supabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "supabase_unconfigured", recorded: false },
      { status: 503 }
    );
  }

  let eventsApplied = 0;
  for (const event of events) {
    const url = String(event?.url || "").trim();
    const type = String(event?.type || "").trim().toLowerCase();
    if (!url || !type) continue;
    try {
      const { data: rows } = await supabase
        .from("images")
        .select("id, metadata, instance_id")
        .eq("image_url", url)
        .limit(3);
      for (const row of rows || []) {
        const meta =
          row?.metadata && typeof row.metadata === "object" ? { ...(row.metadata as object) } : {};
        const stats =
          (meta as any).adventure_stats && typeof (meta as any).adventure_stats === "object"
            ? { ...(meta as any).adventure_stats }
            : emptyStats();
        incrementStat(stats, type);
        (meta as any).adventure_stats = stats;

        const usage =
          (meta as any).adventure_usage && typeof (meta as any).adventure_usage === "object"
            ? { ...(meta as any).adventure_usage }
            : {};
        const byInstance =
          usage.by_instance && typeof usage.by_instance === "object"
            ? { ...usage.by_instance }
            : {};
        const alreadyTracked = Boolean(byInstance[id]);
        const localStats =
          byInstance[id] && typeof byInstance[id] === "object"
            ? { ...byInstance[id] }
            : emptyStats();
        incrementStat(localStats, type);
        localStats.last_used_at = new Date().toISOString();
        byInstance[id] = localStats;
        const trackedEntries = Object.entries(byInstance);
        if (trackedEntries.length > 40) {
          trackedEntries
            .sort((a, b) => String((b[1] as any)?.last_used_at || "").localeCompare(String((a[1] as any)?.last_used_at || "")))
            .slice(40)
            .forEach(([instanceKey]) => delete byInstance[instanceKey]);
        }
        usage.by_instance = byInstance;
        usage.instance_count = Math.max(
          Number(usage.instance_count || 0) + (alreadyTracked ? 0 : 1),
          Object.keys(byInstance).length
        );
        usage.last_instance_id = id;
        (meta as any).adventure_usage = usage;
        (meta as any).worth_keeping = isWorthKeeping(stats);
        (meta as any).reusable_status = isWorthKeeping(stats) ? "reusable" : "candidate";
        await supabase.from("images").update({ metadata: meta }).eq("id", row.id);
        eventsApplied += 1;
      }
    } catch {
      // Non-fatal — curation must not break the experience.
    }
  }

  let written = 0;
  if (writeBack) {
    for (const candidate of candidates) {
      const url = String(candidate?.url || "").trim();
      if (!url || !/^https?:\/\//i.test(url)) continue;
      const wb = candidate.writeBack && typeof candidate.writeBack === "object" ? candidate.writeBack : {};
      const subcategoryId = String(
        candidate.serviceId || (wb as any).subcategory_id || ""
      ).trim();
      if (!subcategoryId) continue;

      const { data: existing } = await supabase
        .from("images")
        .select("id")
        .eq("image_url", url)
        .limit(1);
      if (existing && existing.length > 0) continue;

      const label = String(candidate.label || (wb as any).option_label || "Adventure design").trim();
      const scopeKeys = Array.isArray((wb as any).scope_keys)
        ? (wb as any).scope_keys
        : Array.isArray((candidate as any).scopeKeys)
          ? (candidate as any).scopeKeys
          : [];
      const mode = String((wb as any).adventure_mode || "ideas");
      const finishTier = String(
        candidate.finishTier || (wb as any).finish_tier || candidate.priceTier || (wb as any).price_tier || ""
      ).trim();
      const demandKey = String((wb as any).catalog_demand_key || "").trim();
      if (demandKey) {
        const { data: cachedDemand } = await supabase
          .from("images")
          .select("id")
          .eq("subcategory_id", subcategoryId)
          .contains("metadata", { catalog_demand_key: demandKey })
          .limit(1);
        if (cachedDemand && cachedDemand.length > 0) continue;
      }
      const initialStats: Record<string, unknown> = emptyStats();
      for (const event of events) {
        if (String(event?.url || "").trim() !== url) continue;
        incrementStat(initialStats, String(event?.type || "").trim().toLowerCase());
      }
      const hasUsage = Object.values(initialStats).some((value) => Number(value || 0) > 0);
      const worthKeeping = isWorthKeeping(initialStats);
      const projectManifest =
        candidate.projectManifest && typeof candidate.projectManifest === "object"
          ? candidate.projectManifest
          : (wb as any).project_manifest && typeof (wb as any).project_manifest === "object"
            ? (wb as any).project_manifest
            : null;
      const discovery =
        (wb as any).discovery && typeof (wb as any).discovery === "object"
          ? (wb as any).discovery
          : null;
      const manifestComponents = Array.isArray((projectManifest as any)?.components)
        ? (projectManifest as any).components
            .map((component: any) => String(component?.label || component?.key || "").trim())
            .filter(Boolean)
        : [];
      const metadata = {
        generated_for: "adventure_v8",
        catalog_key: `adventure:${id}:${Buffer.from(url).toString("base64url").slice(0, 24)}`,
        catalog_scope: "adventure",
        option_label: label,
        option_value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48) || "design",
        option_description: candidate.scope || "",
        starter_scope: String((wb as any).starter_scope || candidate.scope || ""),
        starter_scope_key: String((wb as any).starter_scope_key || ""),
        scope_keys: scopeKeys,
        tags: Array.isArray((wb as any).tags)
          ? (wb as any).tags.map((t: unknown) => String(t || "").trim()).filter(Boolean)
          : scopeKeys,
        finish_tier: finishTier,
        price_range: candidate.priceRange || (wb as any).price_range || null,
        price_relationship: String((wb as any).price_relationship || finishTier || ""),
        catalog_demand_key: demandKey,
        category_name: candidate.industry || "",
        subcategory_name: candidate.serviceLabel || "",
        subcategory_id: subcategoryId,
        adventure_mode: mode,
        origin_instance_id: id,
        ai_model: candidate.modelId || (wb as any).model_id || "",
        model_id: candidate.modelId || (wb as any).model_id || "",
        visual_prompt: (wb as any).visual_prompt || (wb as any).visual_direction || "",
        visual_direction: (wb as any).visual_direction || (wb as any).visual_prompt || "",
        palette: (wb as any).palette || "",
        surfaces: (wb as any).surfaces || "",
        fixtures: (wb as any).fixtures || "",
        materials: Array.isArray((wb as any).materials)
          ? (wb as any).materials.map((item: unknown) => String(item || "").trim()).filter(Boolean)
          : [],
        style: (wb as any).style || "",
        palette_family: (wb as any).palette_family || "",
        discovery,
        project_manifest: projectManifest,
        included_items: manifestComponents,
        image_description: String((projectManifest as any)?.description || ""),
        adventure_stats: initialStats,
        adventure_usage: {
          instance_count: hasUsage ? 1 : 0,
          last_instance_id: hasUsage ? id : "",
          by_instance: hasUsage
            ? { [id]: { ...initialStats, last_used_at: new Date().toISOString() } }
            : {},
        },
        worth_keeping: worthKeeping,
        reusable_status: worthKeeping ? "reusable" : "candidate",
        source: "adventure_v8_writeback",
      };

      const { error } = await supabase.from("images").insert({
        image_url: url,
        subcategory_id: subcategoryId,
        instance_id: id,
        status: "completed",
        model_id: candidate.modelId || null,
        metadata,
      });
      if (!error) written += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    eventsApplied,
    written,
    writeBack,
  });
}
