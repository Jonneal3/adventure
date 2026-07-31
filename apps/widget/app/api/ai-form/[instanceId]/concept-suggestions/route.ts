import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";
import { createSupabaseAdminClient } from "@/lib/supabase/server-admin";
import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GeneratedSuggestion = {
  label: string;
  prompt: string;
};

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function parseSuggestions(content: string, serviceName: string): GeneratedSuggestion[] {
  try {
    const parsed = JSON.parse(content);
    const raw = Array.isArray(parsed?.suggestions) ? parsed.suggestions : [];
    const seen = new Set<string>();
    return raw
      .map((item: any) => {
        const label = cleanText(item?.label, 52);
        let prompt = cleanText(item?.prompt, 320);
        if (!label || !prompt) return null;
        const dedupeKey = label.toLowerCase();
        if (seen.has(dedupeKey)) return null;
        seen.add(dedupeKey);
        if (!prompt.toLowerCase().includes(serviceName.toLowerCase())) {
          prompt = `For this ${serviceName}, ${prompt.charAt(0).toLowerCase()}${prompt.slice(1)}`;
        }
        return { label, prompt };
      })
      .filter((item: GeneratedSuggestion | null): item is GeneratedSuggestion => Boolean(item))
      .slice(0, 5);
  } catch {
    return [];
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } },
) {
  const instanceId = cleanText(params.instanceId, 120);
  try {
    const body = await request.json().catch(() => ({}));
    const selectedServiceId = cleanText(body?.selectedServiceId, 120);
    if (!instanceId || !selectedServiceId) {
      return NextResponse.json({ ok: false, error: "instanceId and selectedServiceId are required" }, { status: 400 });
    }

    const { supabase } = createSupabaseAdminClient();
    const [{ data: instance, error: instanceError }, { data: service, error: serviceError }] = await Promise.all([
      supabase.from("instances").select("*").eq("id", instanceId).single(),
      supabase
        .from("categories_subcategories")
        .select("id, subcategory, service_summary, subcategory_components, categories(name)")
        .eq("id", selectedServiceId)
        .single(),
    ]);

    if (instanceError || serviceError || !instance || !service) {
      logger.warn("[concept-suggestions] grounding_lookup_failed", {
        instanceId,
        selectedServiceId,
        instanceError: instanceError?.message || null,
        serviceError: serviceError?.message || null,
      });
      return NextResponse.json({ ok: false, error: "Instance or selected service not found" }, { status: 404 });
    }

    const serviceName = cleanText((service as any).subcategory, 100);
    if (!serviceName) {
      return NextResponse.json({ ok: false, error: "Selected service has no name" }, { status: 422 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ ok: false, error: "AI suggestion service is unavailable" }, { status: 503 });
    }

    const componentKeys = Array.isArray((service as any).subcategory_components)
      ? (service as any).subcategory_components
          .map((component: any) => cleanText(component?.label || component?.name || component?.key, 80))
          .filter(Boolean)
          .slice(0, 20)
      : [];
    const projectInterest = Array.isArray(body?.projectInterest)
      ? body.projectInterest.map((value: unknown) => cleanText(value, 120)).filter(Boolean).slice(0, 12)
      : [];
    const budget = Number(body?.budget);
    const directionTitle = cleanText(body?.directionTitle, 100);
    const directionSummary = cleanText(body?.directionSummary, 240);
    const starterLabel = cleanText(body?.starterLabel, 120);
    const imageUrl = cleanText(body?.imageUrl, 4_000);
    const hasUsableImage = /^(https?:\/\/|data:image\/)/i.test(imageUrl);

    const groq = new Groq({ apiKey });
    const configuredModel = hasUsableImage
      ? process.env.CONCEPT_SUGGESTIONS_VISION_MODEL || "qwen/qwen3.6-27b"
      : process.env.CONCEPT_SUGGESTIONS_MODEL ||
        process.env.DSPY_MODEL ||
        process.env.DSPY_MODEL_LOCK ||
        "openai/gpt-oss-20b";
    const model = configuredModel.replace(/^groq\//, "");
    const requestContext = JSON.stringify({
      task: "Inspect the current design image and generate 5 distinct refinement suggestions.",
      selectedService: serviceName,
      serviceSummary: cleanText((service as any).service_summary, 600),
      serviceComponents: componentKeys,
      projectInterest,
      budget: Number.isFinite(budget) && budget > 0 ? budget : null,
      selectedStarter: starterLabel || null,
      currentDirection: {
        title: directionTitle || null,
        summary: directionSummary || null,
      },
      requirements: [
        `Every suggestion must apply only to ${serviceName}.`,
        "Ground each suggestion in a fixture, material, finish, or feature actually visible in the supplied image.",
        "Keep every recommendation technically plausible, moisture-appropriate, and commonly buildable for the selected service.",
        "Keep the current image composition and room layout recognizable.",
        "Make each chip materially different and immediately understandable.",
        "Do not suggest outdoor, landscaping, kitchen, or unrelated-room work unless that is the selected service.",
        "Do not mention pricing or AI.",
      ],
    });
    const completion = await groq.chat.completions.create({
      model,
      temperature: hasUsableImage ? 0.7 : 0.35,
      ...(hasUsableImage ? { top_p: 0.8, reasoning_effort: "none" } : {}),
      max_completion_tokens: 700,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You create concise, actionable image-edit suggestion chips for a home-service visual pricing experience. " +
            "Every suggestion must be specifically valid for the selected service and current design direction. " +
            "When an image is supplied, inspect it and ground every suggestion in what is visibly present. " +
            "Never mention another room, trade, project type, or feature outside the selected service. " +
            "Suggest visible changes to materials, fixtures, lighting, finish level, storage, or service-specific features. " +
            "Do not suggest changing structural geometry unless the context explicitly asks for it. " +
            'Return strict JSON: {"suggestions":[{"label":"2-6 word chip","prompt":"complete image-edit instruction"}]}.',
        },
        {
          role: "user",
          content: hasUsableImage
            ? ([
                { type: "text", text: requestContext },
                { type: "image_url", image_url: { url: imageUrl } },
              ] as any)
            : requestContext,
        },
      ],
    });

    const suggestions = parseSuggestions(completion.choices[0]?.message?.content || "", serviceName);
    if (suggestions.length < 3) {
      return NextResponse.json({ ok: false, error: "AI returned too few valid suggestions" }, { status: 502 });
    }

    return NextResponse.json(
      {
        ok: true,
        serviceId: selectedServiceId,
        serviceName,
        suggestions,
      },
      { headers: { "Cache-Control": "private, max-age=300" } },
    );
  } catch (error) {
    logger.error("[concept-suggestions] generation_failed", {
      instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Failed to generate concept suggestions" }, { status: 500 });
  }
}
