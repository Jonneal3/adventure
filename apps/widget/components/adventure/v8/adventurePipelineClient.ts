/**
 * Thin client for Adventure V8 → api-service adventure_pipeline.
 * Epicenter actions plus intake (the two Groq questions that produce a rough scope).
 */

export type V8DesignPayload = {
  instanceId: string;
  serviceId?: string | null;
  serviceLabel?: string | null;
  customerServiceLabel?: string | null;
  industry?: string | null;
  serviceSummary?: string | null;
  visualEligible?: boolean;
  scope?: string | null;
  scopes?: string[];
  scopeKeys?: string[];
  scopeOther?: string | null;
  budget?: number;
  budgetBandId?: string | null;
  finishTier?: string | null;
  startPath?: "inspiration" | "photo" | null;
  photoUrl?: string | null;
  favoriteUrls?: string[];
  selectedIdeaUrl?: string | null;
  refineNote?: string | null;
  lead?: {
    email?: string | null;
    phone?: string | null;
    intent?: string | null;
  };
};

export type AdventureAction =
  | "inspiration"
  | "ideas"
  | "refine"
  | "estimate"
  | "handoff"
  | "budget_bands"
  | "library"
  | "intake"
  | "visual_directions"
  | "discovery";

function extractImageUrls(data: Record<string, any> | null | undefined): string[] {
  if (!data) return [];
  const buckets: unknown[] = [];
  if (Array.isArray(data.images)) buckets.push(...data.images);
  if (Array.isArray(data.output)) buckets.push(...data.output);
  else if (typeof data.output === "string") buckets.push(data.output);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const item of buckets) {
    const url =
      typeof item === "string"
        ? item.trim()
        : item && typeof item === "object"
          ? String((item as any).url || (item as any).src || (item as any).image || "").trim()
          : "";
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
  }
  return out;
}

export async function callAdventurePipeline(
  action: AdventureAction,
  design: V8DesignPayload,
  extra?: Record<string, unknown>
): Promise<Record<string, any> | null> {
  const instanceId = String(design.instanceId || "").trim();
  if (!instanceId) return null;
  try {
    const res = await fetch(
      `/api/adventure/v8/${encodeURIComponent(instanceId)}/${encodeURIComponent(action)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          design,
          instruction: extra?.instruction,
          numOutputs: extra?.numOutputs,
          ...extra,
        }),
        cache: "no-store",
      }
    );
    const data = await res.json().catch(() => null);
    if (!data) return null;
    const hasStructuredImages =
      Array.isArray(data.images) &&
      data.images.some((img: unknown) => {
        if (typeof img === "string") return Boolean(img.trim());
        return Boolean(img && typeof img === "object" && ((img as any).url || (img as any).src || (img as any).image));
      });
    if (!hasStructuredImages) {
      const urls = extractImageUrls(data);
      if (urls.length) {
        data.images = urls.map((url, i) => ({ url, source: extra?.forceGenerate ? "generated" : "library", id: `img-${i + 1}` }));
      }
    }
    if (!res.ok && !(Array.isArray(data.images) && data.images.length)) return null;
    return data;
  } catch {
    return null;
  }
}

function catalogLookFromRow(raw: Record<string, any> | null | undefined): Record<string, any> | null {
  if (!raw || typeof raw !== "object") return null;
  const url = String(raw.url || raw.image || raw.image_url || "").trim();
  if (!/^https?:\/\//i.test(url)) return null;
  const tags = [raw.category, raw.subcategory, raw.prompt, raw.label]
    .filter((value) => value != null && String(value).trim())
    .map(String);
  return {
    id: String(raw.id || url.slice(-18)),
    url,
    label: String(raw.label || raw.subcategory || raw.category || "Look").trim() || "Look",
    description: String(raw.prompt || raw.description || "").trim(),
    tags,
    source: "library",
  };
}

/** Contractor catalog photos already on this instance (sample gallery + uploads). */
export async function fetchInstanceCatalogLooks(instanceId: string): Promise<Record<string, any>[]> {
  const id = String(instanceId || "").trim();
  if (!id) return [];
  const [gallery, images] = await Promise.all([
    fetch(`/api/sample-gallery/${encodeURIComponent(id)}?limit=80`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
    fetch(`/api/images/${encodeURIComponent(id)}?limit=80`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : null))
      .catch(() => null),
  ]);
  const seen = new Set<string>();
  const out: Record<string, any>[] = [];
  for (const raw of [...(gallery?.images || []), ...(images?.images || [])]) {
    const row = catalogLookFromRow(raw);
    if (!row || seen.has(row.url)) continue;
    seen.add(row.url);
    out.push(row);
  }
  return out;
}

/** Generate designs through the production image API (same path as the main widget). */
export async function generateV8DesignImages(opts: {
  instanceId: string;
  prompt: string;
  photoUrl?: string | null;
  styleUrls?: string[];
  service?: string | null;
  industry?: string | null;
  serviceSummary?: string | null;
  scope?: string | null;
  budget?: number;
  count?: number;
  variationNotes?: string[];
  modelId?: string | null;
  generationIntent?: string | null;
  useCase?: "scene" | "scene-placement" | "scene-refinement";
}): Promise<string[]> {
  const instanceId = String(opts.instanceId || "").trim();
  if (!instanceId) return [];
  const count = Math.max(1, Math.min(12, opts.count || 1));
  const hasPhoto = Boolean(opts.photoUrl);
  const useCase =
    opts.useCase ||
    (hasPhoto ? "scene-refinement" : "scene");
  const styleUrls = (opts.styleUrls || []).filter((url) => url && url !== opts.photoUrl).slice(0, 4);
  const exclude = new Set([opts.photoUrl, ...styleUrls].filter(Boolean) as string[]);
  const fanout = count > 1 && Boolean(opts.variationNotes?.length);

  if (fanout || (hasPhoto && count > 1)) {
    const notes = opts.variationNotes?.length
      ? opts.variationNotes.slice(0, count)
      : Array.from({ length: count }, (_, i) => `Variation ${i + 1}.`);
    const batches = await Promise.all(
      notes.map((note) =>
        generateV8DesignImages({
          ...opts,
          count: 1,
          prompt: `${opts.prompt} ${note}`,
        })
      )
    );
    const seen = new Set<string>();
    const out: string[] = [];
    for (const url of batches.flat()) {
      if (!url || exclude.has(url) || seen.has(url)) continue;
      seen.add(url);
      out.push(url);
    }
    return out;
  }

  const endpoint =
    useCase === "scene-placement"
      ? "/api/generate/scene-placement"
      : useCase === "scene-refinement"
        ? "/api/generate/scene-refinement"
        : "/api/generate/scene";
  const model = String(opts.modelId || "").toLowerCase();
  const timeoutMs = model.includes("flux-2") ? 90000 : 45000;
  const body: Record<string, unknown> = {
    instanceId,
    prompt: opts.prompt,
    refinementNotes: opts.prompt,
    numOutputs: count,
    generationIntent: opts.generationIntent || "initial",
    industry: opts.industry || opts.service || undefined,
    service: opts.service || undefined,
    serviceSummary: opts.serviceSummary || undefined,
    answeredQA: [
      { question: "Service", answer: opts.service || "" },
      { question: "Scope", answer: opts.scope || "" },
      { question: "Budget", answer: opts.budget != null ? String(opts.budget) : "" },
    ],
    stepDataSoFar: {
      service: opts.service,
      scope: opts.scope,
      budget: opts.budget,
    },
  };
  if (opts.modelId) body.modelId = opts.modelId;
  if (model.includes("schnell")) body.outputFormat = "webp";
  if (model.includes("imagen") || model.includes("p-image")) body.outputFormat = "jpg";
  body.useCase = useCase;
  if (useCase === "scene") {
    body.referenceMode = "guide_only";
    body.aspectRatio = "4:5";
    if (styleUrls.length) body.referenceImages = styleUrls;
  } else {
    if (!opts.photoUrl) return [];
    body.sceneImage = opts.photoUrl;
    body.aspectRatio = "match_input_image";
    if (styleUrls.length) body.referenceImages = styleUrls;
  }
  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const data = await res.json().catch(() => null);
    return extractImageUrls(data).filter((url) => !exclude.has(url));
  } catch {
    return [];
  }
}

export async function generateV8DesignImage(opts: Parameters<typeof generateV8DesignImages>[0]): Promise<string | null> {
  const urls = await generateV8DesignImages({ ...opts, count: 1 });
  return urls[0] || null;
}

/** Fire shown/selected counters and write winning generations back into the library. */
export async function curateAdventureImages(
  instanceId: string,
  payload: {
    events?: Array<{ type: string; url: string; source?: string; mode?: string }>;
    candidates?: Array<Record<string, unknown>>;
    writeBack?: boolean;
    sessionId?: string;
  }
): Promise<void> {
  const id = String(instanceId || "").trim();
  if (!id) return;
  try {
    await fetch(`/api/adventure/v8/${encodeURIComponent(id)}/curate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
  } catch {
    // Curation is best-effort — chips and ranking improve over time.
  }
}
