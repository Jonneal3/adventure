/**
 * Persist Adventure V7 curation events and optional write-back of winning generations
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
  priceTier?: string;
  modelId?: string;
  writeBack?: Record<string, unknown>;
};

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
  const preferences =
    body.preferences && typeof body.preferences === "object"
      ? (body.preferences as Record<string, unknown>)
      : null;
  const project =
    body.project && typeof body.project === "object"
      ? (body.project as Record<string, unknown>)
      : null;

  const supabase = supabaseAdmin();
  if (!supabase) {
    return NextResponse.json(
      { ok: false, error: "supabase_unconfigured", recorded: false },
      { status: 503 }
    );
  }

  let preferencesSaved = 0;
  if (preferences) {
    try {
      const scopes = Array.isArray((preferences as any).scopes)
        ? ((preferences as any).scopes as unknown[]).map((s) => String(s))
        : Array.isArray((project as any)?.scope?.items)
          ? ((project as any).scope.items as any[]).map((i) => String(i?.label || i?.key || ""))
          : [];
      const { error: prefError } = await supabase.from("adventure_preference_events").insert({
        instance_id: id,
        session_id: String((preferences as any).sessionId || body.sessionId || "") || null,
        service_id: String((preferences as any).serviceId || (project as any)?.service?.id || "") || null,
        scopes: scopes.filter(Boolean),
        budget: Number((preferences as any).budget ?? (project as any)?.budget?.amount) || null,
        preferences,
        project,
      });
      if (!prefError) preferencesSaved = 1;
    } catch {
      // Non-fatal — preference persistence must not break the experience.
    }
  }

  // Performance counters live on metadata.adventure_stats of matching image rows.
  let eventsApplied = 0;
  for (const event of events) {
    const url = String(event?.url || "").trim();
    const type = String(event?.type || "").trim().toLowerCase();
    if (!url || !type) continue;
    try {
      const { data: rows } = await supabase
        .from("images")
        .select("id, metadata")
        .eq("image_url", url)
        .limit(3);
      for (const row of rows || []) {
        const meta =
          row?.metadata && typeof row.metadata === "object" ? { ...(row.metadata as object) } : {};
        const stats =
          (meta as any).adventure_stats && typeof (meta as any).adventure_stats === "object"
            ? { ...(meta as any).adventure_stats }
            : { shown: 0, selected: 0, saved: 0, conversions: 0 };
        if (type === "shown") stats.shown = Number(stats.shown || 0) + 1;
        if (type === "selected" || type === "favorite") stats.selected = Number(stats.selected || 0) + 1;
        if (type === "saved") stats.saved = Number(stats.saved || 0) + 1;
        if (type === "conversion" || type === "quote") stats.conversions = Number(stats.conversions || 0) + 1;
        (meta as any).adventure_stats = stats;
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

      // Skip if this URL is already in the catalog.
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
      const metadata = {
        generated_for: "adventure_v7",
        catalog_key: `adventure:${id}:${Buffer.from(url).toString("base64url").slice(0, 24)}`,
        catalog_scope: "adventure",
        option_label: label,
        option_value: label.toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 48) || "design",
        option_description: candidate.scope || "",
        starter_scope: String((wb as any).starter_scope || candidate.scope || ""),
        scope_keys: scopeKeys,
        price_tier: candidate.priceTier || "",
        category_name: candidate.industry || "",
        subcategory_name: candidate.serviceLabel || "",
        subcategory_id: subcategoryId,
        adventure_mode: (wb as any).adventure_mode || "ideas",
        origin_instance_id: id,
        ai_model: candidate.modelId || (wb as any).model_id || "",
        model_id: candidate.modelId || (wb as any).model_id || "",
        adventure_stats: { shown: 0, selected: 1, saved: 0, conversions: 0 },
        source: "adventure_v7_writeback",
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
    preferencesSaved,
  });
}
