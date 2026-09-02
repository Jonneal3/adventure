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
  startPath?: "pricing" | "photo" | null;
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
  | "handoff"
  | "budget_bands"
  | "discovery"
  | "estimate"
  | "project_manifest"
  | "intake"
  | "refinement_suggestions";

export type V8StarterGenerationResult = {
  imageUrl: string;
  prompt: string;
  referenceImageId: string;
  referenceImageUrl: string;
  matchedScopeKeys: string[];
  missingScopeKeys: string[];
  modelId: string;
  provider?: string | null;
  predictionId?: string | null;
  latencyMs?: Record<string, unknown> | null;
  structuralValidation?: {
    checked: boolean;
    valid: boolean;
    defects: string[];
    summary: string;
  } | null;
  usedApprovedReferenceFallback?: boolean;
};

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
    if (!res.ok && !(Array.isArray(data.images) && data.images.length)) return null;
    return data;
  } catch {
    return null;
  }
}

/** Select an approved starter reference and generate one anchored variation. */
export async function generateV8StarterImage(opts: {
  instanceId: string;
  sessionId: string;
  serviceId: string;
  scopes: string[];
  otherScope?: string | null;
  budget: number;
  finishTier: string;
}): Promise<V8StarterGenerationResult | null> {
  const instanceId = String(opts.instanceId || "").trim();
  const serviceId = String(opts.serviceId || "").trim();
  if (!instanceId || !serviceId || !opts.sessionId || !opts.finishTier) return null;
  try {
    const response = await fetch(
      `/api/adventure/v8/${encodeURIComponent(instanceId)}/starter`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: opts.sessionId,
          serviceId,
          scopes: opts.scopes,
          otherScope: opts.otherScope || null,
          budget: opts.budget,
          finishTier: opts.finishTier,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(45_000),
      }
    );
    const data = await response.json().catch(() => null);
    const imageUrl = String(data?.imageUrl || "").trim();
    if (!response.ok || !data?.success || !/^https?:\/\//i.test(imageUrl)) return null;
    return {
      imageUrl,
      prompt: String(data.prompt || "").trim(),
      referenceImageId: String(data.referenceImageId || "").trim(),
      referenceImageUrl: String(data.referenceImageUrl || "").trim(),
      matchedScopeKeys: Array.isArray(data.matchedScopeKeys)
        ? data.matchedScopeKeys.map((key: unknown) => String(key || "")).filter(Boolean)
        : [],
      missingScopeKeys: Array.isArray(data.missingScopeKeys)
        ? data.missingScopeKeys.map((key: unknown) => String(key || "")).filter(Boolean)
        : [],
      modelId: String(data.modelId || "prunaai/p-image-edit").trim(),
      provider: data.provider ? String(data.provider) : null,
      predictionId: data.predictionId ? String(data.predictionId) : null,
      latencyMs:
        data.latencyMs && typeof data.latencyMs === "object"
          ? data.latencyMs
          : null,
      structuralValidation:
        data.structuralValidation && typeof data.structuralValidation === "object"
          ? data.structuralValidation
          : null,
      usedApprovedReferenceFallback: Boolean(data.usedApprovedReferenceFallback),
    };
  } catch {
    return null;
  }
}

export async function fetchV8RefinementCatalog(opts: {
  instanceId: string;
  serviceId: string;
  serviceLabel?: string | null;
  serviceSummary?: string | null;
  scopes: string[];
  budget: number;
  imageUrl: string;
}): Promise<import("./types").V8RefinementCatalog | null> {
  const instanceId = String(opts.instanceId || "").trim();
  const serviceId = String(opts.serviceId || "").trim();
  const imageUrl = String(opts.imageUrl || "").trim();
  if (!instanceId || !serviceId || !imageUrl) return null;
  try {
    const response = await fetch(
      `/api/adventure/v8/${encodeURIComponent(instanceId)}/refinement-catalog`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceId,
          serviceLabel: opts.serviceLabel || null,
          serviceSummary: opts.serviceSummary || null,
          scopes: opts.scopes,
          budget: opts.budget,
          imageUrl,
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(18_000),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.ok || !Array.isArray(data.categories)) return null;
    return {
      source: data.source === "vision" || data.source === "service" ? data.source : "fallback",
      diagnosis: String(data.diagnosis || "").trim(),
      categories: data.categories,
    } as import("./types").V8RefinementCatalog;
  } catch {
    return null;
  }
}

export async function generateV8RefinementOptionImages(opts: {
  instanceId: string;
  sessionId: string;
  serviceId: string;
  serviceLabel?: string | null;
  serviceSummary?: string | null;
  industry?: string | null;
  budget: number;
  category: import("./types").V8RefinementCategory;
}): Promise<Record<string, string>> {
  const instanceId = String(opts.instanceId || "").trim();
  const sessionId = String(opts.sessionId || "").trim();
  const categoryId = String(opts.category?.id || "").trim();
  if (!instanceId || !sessionId || !categoryId || !opts.category.options.length) return {};

  const categorySubject = String(opts.category.label || "item").trim();
  try {
    const response = await fetch(
      `/api/ai-form/${encodeURIComponent(instanceId)}/option-images/generate`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          generationPurpose: "v8-refinement-thumbnail",
          sessionId,
          serviceId: opts.serviceId,
          service: opts.serviceLabel || categorySubject,
          serviceSummary: opts.serviceSummary || null,
          industry: opts.industry || null,
          budgetRange: opts.budget,
          stepId: `v8-refinement-material-fixture-${categoryId}`,
          question: `Choose one ${categorySubject} fixture or material`,
          options: opts.category.options.slice(0, 5).map((option) => ({
            label: option.label,
            value: option.id,
            image_prompt: [
              option.imagePrompt ||
                `Exactly one ${option.label} ${categorySubject} selection.`,
              `Product-only catalog thumbnail of the ${categorySubject} choice.`,
              `Show exactly one isolated ${categorySubject} item or one continuous material sample, centered and filling about 75 percent of a square frame.`,
              "Neutral studio or minimal material backdrop; true-to-life construction, finish, proportions, and color.",
              `The picture must unmistakably show ${categorySubject}, not a room that merely contains it.`,
              "No full room, no bathroom scene, no kitchen scene, no collage, no people, no duplicate products, no unrelated fixtures, no text, and no labels.",
            ].join(" "),
          })),
        }),
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      }
    );
    const data = await response.json().catch(() => null);
    if (!response.ok || !Array.isArray(data?.options)) return {};
    return data.options.reduce((images: Record<string, string>, option: any) => {
      const id = String(option?.value || "").trim();
      const imageUrl = String(option?.imageUrl || "").trim();
      if (id && /^https?:\/\//i.test(imageUrl)) images[id] = imageUrl;
      return images;
    }, {});
  } catch {
    return {};
  }
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

export async function analyzeV8ProjectManifest(opts: {
  instanceId: string;
  imageUrl: string;
  serviceId?: string | null;
  serviceLabel?: string | null;
  scopes?: string[];
}): Promise<{
  manifest: import("./types").V8ProjectManifest;
  discovery?: Record<string, unknown> | null;
} | null> {
  const imageUrl = String(opts.imageUrl || "").trim();
  if (!imageUrl) return null;
  const data = await callAdventurePipeline(
    "project_manifest",
    {
      instanceId: opts.instanceId,
      serviceId: opts.serviceId,
      serviceLabel: opts.serviceLabel,
      scopes: opts.scopes,
      selectedIdeaUrl: imageUrl,
    },
    { imageUrl }
  );
  if (!data?.ok || !data.manifest || data.manifest.analysisStatus !== "verified") return null;
  return {
    manifest: data.manifest as import("./types").V8ProjectManifest,
    discovery: data.discovery && typeof data.discovery === "object" ? data.discovery : null,
  };
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
