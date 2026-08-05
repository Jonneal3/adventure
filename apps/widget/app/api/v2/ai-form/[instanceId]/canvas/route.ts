import { NextRequest, NextResponse } from "next/server";

import type {
  ExperienceMode,
  StarterCanvas,
  StructuredDesignInstruction,
} from "@/components/adventure/v2/types";
import {
  buildV2IterativeEditPrompt,
  isStructuralSceneChange,
} from "@/lib/adventure-v2/iterative-edit-prompt";
import {
  persistV2Image,
  V2_IMAGE_PERSIST_TIMEOUT_MS,
} from "@/lib/adventure-v2/server-assets";
import { findV2NeutralScopeStarter } from "@/lib/adventure-v2/scope-starter-catalog";
import { findV2ServiceStarter } from "@/lib/adventure-v2/service-starter-catalog";
import { buildV2StarterPrompt } from "@/lib/adventure-v2/starter-prompt";
import { logger } from "@/lib/server/logger";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PROMPT_LENGTH = 800;
const V3_EDIT_MODEL_ID = "black-forest-labs/flux-2-pro";
const V3_EDIT_FALLBACK_MODEL_ID = "prunaai/p-image-edit";

function normalizeMode(raw: unknown): ExperienceMode | null {
  const value = String(raw || "").trim().toLowerCase().replace(/_/g, "-");
  if (value === "scene") return "scene";
  if (value === "tryon" || value === "try-on") return "tryon";
  if (value === "placement" || value === "scene-placement") return "placement";
  return null;
}

function text(raw: unknown, max = 300): string {
  return typeof raw === "string" ? raw.trim().slice(0, max) : "";
}

function numberOrNull(raw: unknown): number | null {
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function componentLabel(raw: unknown): string {
  if (typeof raw === "string") return text(raw, 120);
  if (!raw || typeof raw !== "object") return "";
  const component = raw as Record<string, unknown>;
  return text(component.label ?? component.key, 120);
}

function sourceUrl(raw: unknown): string {
  if (typeof raw === "string" && /^https?:\/\//i.test(raw.trim())) return raw.trim();
  if (raw && typeof raw === "object" && typeof (raw as any).url === "string" && /^https?:\/\//i.test((raw as any).url)) {
    return String((raw as any).url).trim();
  }
  return "";
}

function stringList(raw: unknown, maxItems = 12): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => text(item, 160)).filter(Boolean).slice(0, maxItems);
}

function designInstruction(raw: unknown): StructuredDesignInstruction | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const value = raw as Record<string, any>;
  const mode =
    value.mode === "target_region" || value.mode === "finished_version"
      ? value.mode
      : "whole_design";
  const target = value.targetRegion && typeof value.targetRegion === "object"
    ? {
        id: text(value.targetRegion.id, 100),
        label: text(value.targetRegion.label, 140),
        confidence: Number.isFinite(Number(value.targetRegion.confidence))
          ? Math.max(0, Math.min(1, Number(value.targetRegion.confidence)))
          : null,
      }
    : null;
  const readableSummary = text(value.readableSummary, MAX_PROMPT_LENGTH);
  if (!readableSummary) return null;
  return {
    mode,
    directionId: text(value.directionId, 100) || null,
    directionLabel: text(value.directionLabel, 140) || null,
    versionId: text(value.versionId, 100) || null,
    targetRegion: target?.id && target?.label ? target : null,
    optionId: text(value.optionId, 100) || null,
    optionLabel: text(value.optionLabel, 140) || null,
    style: text(value.style, 180) || null,
    materials: stringList(value.materials),
    colors: stringList(value.colors),
    fixtures: stringList(value.fixtures),
    affectedRegions: stringList(value.affectedRegions),
    layoutConstraints: stringList(value.layoutConstraints),
    preserve: stringList(value.preserve),
    customInstruction: text(value.customInstruction, MAX_PROMPT_LENGTH) || null,
    readableSummary,
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const startedAt = Date.now();
  try {
    const body = await request.json().catch(() => ({}));
    const action =
      body?.action === "edit"
        ? "edit"
        : body?.action === "concept"
          ? "concept"
          : "starter";
    const sessionId = text(body?.sessionId, 160);
    const serviceId = text(body?.serviceId, 160);
    const serviceName = text(body?.serviceName, 200);
    const industryName = text(body?.industryName, 200);
    const serviceSummary = text(body?.serviceSummary, 1000);
    const components = Array.isArray(body?.components)
      ? body.components.map(componentLabel).filter(Boolean).slice(0, 20)
      : [];
    const scope = text(body?.scope, 300);
    const budget = numberOrNull(body?.budget);
    const mode = normalizeMode(body?.experienceMode);
    const requestedChange = text(body?.prompt, MAX_PROMPT_LENGTH);
    const structuredInstruction = designInstruction(body?.designInstruction);
    const generationIntent = text(body?.generationIntent, 60)
      .toLowerCase()
      .replace(/-/g, "_");
    const requestedModelId = text(body?.modelId, 160);
    const isConceptPreview =
      action === "concept" &&
      generationIntent === "concept_preview" &&
      requestedModelId === "black-forest-labs/flux-schnell";
    const isV3Concept =
      action === "edit" &&
      generationIntent === "v3_concept";
    const isV3PersonalizedPreview =
      action === "edit" &&
      generationIntent === "v3_personalized_preview";
    const priorChanges = Array.isArray(body?.priorChanges)
      ? body.priorChanges.map((change: unknown) => text(change, 220)).filter(Boolean).slice(-6)
      : [];
    const sourceAssets = body?.sourceAssets && typeof body.sourceAssets === "object" ? body.sourceAssets : {};
    const currentCanvasUrl = sourceUrl(body?.currentCanvasUrl);
    const referenceProjectImageUrl = sourceUrl(body?.referenceProjectImageUrl);

    if (!params.instanceId || !sessionId || !serviceId || !serviceName || !scope || !budget || !mode) {
      return NextResponse.json(
        { ok: false, error: "Missing required starter-canvas context" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (action === "edit" && (!requestedChange || !currentCanvasUrl)) {
      return NextResponse.json(
        { ok: false, error: "An edit prompt and current canvas are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (action === "concept" && (!requestedChange || !isConceptPreview)) {
      return NextResponse.json(
        { ok: false, error: "A supported concept prompt and model are required" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sceneUrl = sourceUrl(sourceAssets.scene);
    const personUrl = sourceUrl(sourceAssets.person);
    const productUrl = sourceUrl(sourceAssets.product);
    if (action === "starter" && mode === "tryon" && (!personUrl || !productUrl)) {
      return NextResponse.json(
        { ok: false, error: "A person photo and product photo are required for try-on" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    if (action === "starter" && mode === "placement" && (!sceneUrl || !productUrl)) {
      return NextResponse.json(
        { ok: false, error: "A scene photo and product photo are required for placement" },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const prompt =
      action === "edit"
        ? buildV2IterativeEditPrompt({
            serviceName,
            scope,
            budget,
            mode,
            requestedChange,
            priorChanges,
            designInstruction: structuredInstruction,
          })
        : action === "concept"
          ? requestedChange
        : buildV2StarterPrompt({
            serviceName,
            industryName,
            serviceSummary,
            scope,
            budget,
            mode,
            components,
          });
    const structural = action === "edit" && mode === "scene" && isStructuralSceneChange(requestedChange);

    if (action === "starter" && mode === "scene") {
      try {
        const { supabase } = createSupabaseAdminClient();
        const scopeStarter = await findV2NeutralScopeStarter({
          supabase,
          subcategoryId: serviceId,
          scope,
          sessionId,
        });
        const catalogStarter =
          scopeStarter ||
          (await findV2ServiceStarter({
            supabase,
            subcategoryId: serviceId,
          }));
        if (catalogStarter) {
          const metadata =
            catalogStarter.metadata && typeof catalogStarter.metadata === "object"
              ? catalogStarter.metadata
              : {};
          const canvas: StarterCanvas = {
            assetId: catalogStarter.id,
            imageUrl: catalogStarter.image_url,
            storagePath:
              typeof metadata.s3_path === "string" ? metadata.s3_path : "",
            sourceType: "generated",
            modelId:
              catalogStarter.model_id ||
              (typeof metadata.ai_model === "string" ? metadata.ai_model : null),
            predictionId: null,
            prompt:
              typeof metadata.prompt_text === "string"
                ? metadata.prompt_text
                : prompt,
            serviceId,
            scope,
            budget,
            experienceMode: mode,
            starterExperimentKey: scopeStarter?.experimentKey ?? null,
            starterVariantId: scopeStarter?.variantId ?? null,
            starterVariantLabel: scopeStarter?.variantLabel ?? null,
            createdAt: catalogStarter.created_at
              ? new Date(catalogStarter.created_at).getTime()
              : Date.now(),
          };
          logger.info("[adventure-v2:canvas] starter catalog hit", {
            instanceId: params.instanceId,
            sessionId,
            serviceId,
            scope,
            assetId: canvas.assetId,
            starterExperimentKey: canvas.starterExperimentKey,
            starterVariantId: canvas.starterVariantId,
            durationMs: Date.now() - startedAt,
          });
          return NextResponse.json(
            { ok: true, canvas },
            { headers: { "Cache-Control": "no-store" } }
          );
        }
      } catch (catalogError) {
        logger.warn("[adventure-v2:canvas] starter catalog lookup failed", {
          instanceId: params.instanceId,
          serviceId,
          scope,
          error:
            catalogError instanceof Error
              ? catalogError.message
              : String(catalogError),
        });
      }
    }

    let useCase: "scene" | "scene-refinement" | "tryon" | "scene-placement" = "scene";
    let modelId = "black-forest-labs/flux-2-pro";
    const generationBody: Record<string, unknown> = {
      instanceId: params.instanceId,
      sessionId,
      prompt,
      numOutputs: 1,
      budgetRange: budget,
      stepDataSoFar: {
        "step-service-primary": serviceId,
        "step-scope-v2": scope,
        "step-budget-v2": budget,
      },
      instanceContext: {
        service: { id: serviceId, name: serviceName },
        ...(industryName ? { industry: { name: industryName } } : {}),
        ...(serviceSummary ? { serviceSummary } : {}),
      },
    };

    if (action === "concept") {
      useCase = "scene";
      modelId = "black-forest-labs/flux-schnell";
      generationBody.aspectRatio = "4:3";
      generationBody.outputFormat = "webp";
      generationBody.numInferenceSteps = 4;
      generationBody.goFast = true;
    } else if (mode === "tryon") {
      useCase = "tryon";
      modelId = "google/nano-banana";
      generationBody.userImage = action === "edit" ? currentCanvasUrl : personUrl;
      generationBody.productImage = productUrl;
      generationBody.referenceImages = [action === "edit" ? currentCanvasUrl : personUrl, productUrl].filter(Boolean);
      generationBody.aspectRatio = "match_input_image";
    } else if (mode === "placement") {
      useCase = "scene-placement";
      modelId = "black-forest-labs/flux-2-pro";
      generationBody.sceneImage = action === "edit" ? currentCanvasUrl : sceneUrl;
      generationBody.productImage = productUrl;
      generationBody.referenceImages = [action === "edit" ? currentCanvasUrl : sceneUrl, productUrl].filter(Boolean);
      generationBody.aspectRatio = "match_input_image";
    } else if (action === "edit") {
      useCase = "scene-refinement";
      modelId = isV3Concept || isV3PersonalizedPreview
        ? V3_EDIT_MODEL_ID
        : "black-forest-labs/flux-2-pro";
      generationBody.sceneImage = currentCanvasUrl;
      if (isV3PersonalizedPreview && referenceProjectImageUrl) {
        generationBody.referenceImages = [currentCanvasUrl, referenceProjectImageUrl];
      } else {
        generationBody.referenceImages = [currentCanvasUrl];
      }
      generationBody.aspectRatio = "match_input_image";
      generationBody.outputFormat = "png";
      generationBody.previousPrompt = priorChanges.join(" | ");
      generationBody.refinementNotes = requestedChange;
      if (isV3Concept || isV3PersonalizedPreview) {
        generationBody.goFast = true;
        generationBody.numInferenceSteps = 12;
      }
    } else {
      useCase = "scene";
      modelId = "black-forest-labs/flux-2-pro";
      generationBody.aspectRatio = "4:3";
      generationBody.outputFormat = "png";
    }
    generationBody.useCase = useCase;
    generationBody.modelId = modelId;
    generationBody.generationIntent = action === "concept"
      ? "concept_preview"
      : action === "edit"
        ? isV3PersonalizedPreview
          ? "v3_personalized_preview"
          : "small_improvement"
        : "initial";

    const generateUrl = new URL("/api/generate", request.url);
    const requestGeneration = async (payload: Record<string, unknown>) => {
      const response = await fetch(generateUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        cache: "no-store",
      });
      return {
        response,
        data: await response.json().catch(() => null),
      };
    };

    let generationAttempt = await requestGeneration(generationBody);
    if (
      !generationAttempt.response.ok &&
      generationAttempt.response.status >= 500 &&
      (isV3Concept || isV3PersonalizedPreview) &&
      modelId === V3_EDIT_MODEL_ID
    ) {
      logger.warn("[adventure-v2:canvas] v3 edit model failed; retrying fallback", {
        instanceId: params.instanceId,
        sessionId,
        generationIntent,
        primaryModelId: modelId,
        fallbackModelId: V3_EDIT_FALLBACK_MODEL_ID,
        status: generationAttempt.response.status,
      });
      modelId = V3_EDIT_FALLBACK_MODEL_ID;
      generationAttempt = await requestGeneration({
        ...generationBody,
        modelId,
        outputFormat: "jpg",
      });
    }

    const generationResponse = generationAttempt.response;
    const generated = generationAttempt.data;
    if (!generationResponse.ok || !generated?.success) {
      const message =
        typeof generated?.error === "string"
          ? generated.error
          : "The image model could not create a result";
      return NextResponse.json(
        { ok: false, error: message, details: generated?.details ?? null },
        { status: generationResponse.status || 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const imageUrl = Array.isArray(generated.images)
      ? generated.images.find((value: unknown) => typeof value === "string" && /^https?:\/\//i.test(value))
      : null;
    if (!imageUrl) {
      return NextResponse.json(
        { ok: false, error: "The image model returned no usable image" },
        { status: 502, headers: { "Cache-Control": "no-store" } }
      );
    }

    const { supabase } = createSupabaseAdminClient({
      fetchTimeoutMs: V2_IMAGE_PERSIST_TIMEOUT_MS,
    });
    const asset = await persistV2Image({
      supabase,
      instanceId: params.instanceId,
      sessionId,
      imageRef: imageUrl,
      kind: "generated",
    });
    const canvas: StarterCanvas = {
      assetId: asset.assetId,
      imageUrl: asset.url,
      storagePath: asset.storagePath,
      sourceType: "generated",
      modelId: typeof generated.modelId === "string" ? generated.modelId : modelId,
      predictionId: typeof generated.predictionId === "string" ? generated.predictionId : null,
      prompt,
      serviceId,
      scope,
      budget,
      experienceMode: mode,
      createdAt: Date.now(),
    };

    logger.info("[adventure-v2:canvas] generated", {
      instanceId: params.instanceId,
      sessionId,
      action,
      mode,
      modelId: canvas.modelId,
      structural,
      durationMs: Date.now() - startedAt,
    });
    return NextResponse.json(
      { ok: true, canvas },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v2:canvas] failed", {
      instanceId: params.instanceId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Unable to create the canvas" },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
