#!/usr/bin/env node

import { loadRegistryV1 } from "switchboard-ai-registry";
import { rankRoutes } from "switchboard-ai-router-ts";

function normalizeUseCase(raw) {
  const v = String(raw || "scene").trim().toLowerCase().replace(/_/g, "-");
  if (v === "try-on" || v === "tryon") return "tryon";
  if (v === "scene-placement") return "scene-placement";
  if (v === "drilldown") return "drilldown";
  return "scene";
}

function mapUseCaseTags(useCase) {
  switch (useCase) {
    case "tryon":
      return ["try-on", "portraits"];
    case "scene-placement":
      return ["scene-placement", "inpainting"];
    case "drilldown":
      return ["inpainting", "detail"];
    default:
      return ["landscapes", "scene"];
  }
}

function prioritiesForIntent(intent) {
  const normalized = String(intent || "").trim().toLowerCase().replace(/-/g, "_");
  if (normalized === "small_improvement") return ["highest_quality", "highest_reliability", "lowest_latency"];
  if (normalized === "regenerate") return ["highest_quality", "highest_reliability", "lowest_cost"];
  return ["highest_quality", "lowest_latency", "lowest_cost"];
}

try {
  const raw = process.argv[2] || "{}";
  const input = JSON.parse(raw);

  const useCase = normalizeUseCase(input.useCase);
  const numInputImages = Math.max(0, Number(input.numInputImages || 0));
  const hasInputImage = Boolean(input.hasInputImage) || numInputImages > 0;
  const intent = String(input.intent || "").trim();

  const policy = {
    defaults: {
      priorities: prioritiesForIntent(intent),
      constraints: {
        requireImageOutput: true,
        requireImageInput: hasInputImage || undefined,
      },
      topN: 3,
    },
  };

  const ranked = rankRoutes({
    registry: loadRegistryV1(),
    policy,
    providerAllowlist: ["replicate"],
    request: {
      task: "text-to-image",
      useCase,
      input: {
        prompt: String(input.prompt || ""),
        images: hasInputImage ? new Array(Math.max(numInputImages, 1)).fill("image-ref") : undefined,
      },
      inputShape: hasInputImage
        ? {
            image: true,
            multiImage: numInputImages > 1,
          }
        : undefined,
      preferTags: mapUseCaseTags(useCase),
      preferTraits: String(intent || "").toLowerCase().includes("small") ? ["high_prompt_adherence", "edit_preservation"] : undefined,
    },
  });

  const top = Array.isArray(ranked?.accepted) ? ranked.accepted[0] : null;
  process.stdout.write(
    JSON.stringify({
      ok: true,
      useCase,
      providerId: top?.providerId || null,
      modelId: top?.modelId || null,
      routeKey: top?.routeKey || null,
      acceptedCount: Array.isArray(ranked?.accepted) ? ranked.accepted.length : 0,
    }),
  );
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  process.stdout.write(JSON.stringify({ ok: false, error: message }));
}

