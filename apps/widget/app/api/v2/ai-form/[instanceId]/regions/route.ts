import { NextRequest, NextResponse } from "next/server";
import Groq from "groq-sdk";

import { logger } from "@/lib/server/logger";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupportedRegion = {
  id: string;
  label: string;
  description: string;
};

type RegionBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type RegionDetection = {
  region: SupportedRegion;
  confidence: number;
  bounds: RegionBounds | null;
};

function cleanText(value: unknown, maxLength: number): string {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizedCoordinate(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(1, parsed)) : null;
}

function parseSupportedRegions(raw: unknown): SupportedRegion[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw
    .map((item: any) => {
      const id = cleanText(item?.id, 100);
      const label = cleanText(item?.label, 140);
      const description = cleanText(item?.description, 260);
      if (!id || !label || seen.has(id)) return null;
      seen.add(id);
      return { id, label, description };
    })
    .filter((item: SupportedRegion | null): item is SupportedRegion => Boolean(item))
    .slice(0, 12);
}

function parseDetection(
  content: string,
  supportedRegions: SupportedRegion[]
): RegionDetection | null {
  try {
    const parsed = JSON.parse(content);
    const regionId = cleanText(parsed?.regionId, 100);
    const confidence = normalizedCoordinate(parsed?.confidence);
    const region = supportedRegions.find((candidate) => candidate.id === regionId);
    if (!region || confidence === null || confidence < 0.58) return null;
    const rawBounds = Array.isArray(parsed?.boundingBox)
      ? parsed.boundingBox
      : [];
    const normalizedBounds = rawBounds.slice(0, 4).map(normalizedCoordinate);
    const bounds =
      normalizedBounds.length === 4 &&
      normalizedBounds.every(
        (value: number | null): value is number => value !== null
      )
        ? {
            x: normalizedBounds[0],
            y: normalizedBounds[1],
            width: Math.min(normalizedBounds[2], 1 - normalizedBounds[0]),
            height: Math.min(normalizedBounds[3], 1 - normalizedBounds[1]),
          }
        : null;
    return { region, confidence, bounds };
  } catch {
    return null;
  }
}

function parseRegionMap(
  content: string,
  supportedRegions: SupportedRegion[]
): RegionDetection[] {
  try {
    const parsed = JSON.parse(content);
    const rawRegions = Array.isArray(parsed?.regions) ? parsed.regions : [];
    const seen = new Set<string>();
    return rawRegions
      .map((item: any) => {
        const regionId = cleanText(item?.regionId, 100);
        if (!regionId || seen.has(regionId)) return null;
        const region = supportedRegions.find(
          (candidate) => candidate.id === regionId
        );
        const confidence = normalizedCoordinate(item?.confidence);
        const rawBounds = Array.isArray(item?.boundingBox)
          ? item.boundingBox
          : [];
        const normalizedBounds = rawBounds
          .slice(0, 4)
          .map(normalizedCoordinate);
        if (
          !region ||
          confidence === null ||
          confidence < 0.48 ||
          normalizedBounds.length !== 4 ||
          !normalizedBounds.every(
            (value: number | null): value is number => value !== null
          )
        ) {
          return null;
        }
        seen.add(regionId);
        return {
          region,
          confidence,
          bounds: {
            x: normalizedBounds[0],
            y: normalizedBounds[1],
            width: Math.min(
              normalizedBounds[2],
              1 - normalizedBounds[0]
            ),
            height: Math.min(
              normalizedBounds[3],
              1 - normalizedBounds[1]
            ),
          },
        };
      })
      .filter(
        (item: RegionDetection | null): item is RegionDetection =>
          Boolean(item)
      )
      .slice(0, 10);
  } catch {
    return [];
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  const instanceId = cleanText(params.instanceId, 120);
  try {
    const body = await request.json().catch(() => ({}));
    const action = body?.action === "map" ? "map" : "point";
    const imageUrl = cleanText(body?.imageUrl, 4_000);
    const serviceName = cleanText(body?.serviceName, 180);
    const scope = cleanText(body?.scope, 240);
    const x = normalizedCoordinate(body?.point?.x);
    const y = normalizedCoordinate(body?.point?.y);
    const supportedRegions = parseSupportedRegions(body?.supportedRegions);

    if (
      !instanceId ||
      !/^https?:\/\//i.test(imageUrl) ||
      !serviceName ||
      !scope ||
      (action === "point" && (x === null || y === null)) ||
      supportedRegions.length === 0
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            action === "map"
              ? "Image, service, scope, and supported regions are required"
              : "Image, service, scope, click point, and supported regions are required",
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Region detection is unavailable" },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const groq = new Groq({ apiKey });
    const configuredModel =
      process.env.ADVENTURE_V2_REGION_VISION_MODEL ||
      process.env.CONCEPT_SUGGESTIONS_VISION_MODEL ||
      "qwen/qwen3.6-27b";
    const model = configuredModel.replace(/^groq\//, "");
    const prompt = JSON.stringify(
      action === "map"
        ? {
            task:
              "Map every visibly present supported editable semantic region in this image before the visitor clicks.",
            serviceName,
            scope,
            coordinateSystem:
              "x=0 is left, x=1 is right, y=0 is top, y=1 is bottom",
            supportedRegions,
            requirements: [
              "Inspect the image rather than guessing from the scope alone.",
              "Return only supported regions that are clearly visible and isolatable.",
              "Return one approximate normalized bounding box [x, y, width, height] for each visible supported region.",
              "Do not include allowed regions that are absent from the image.",
              "Prefer tight object or surface bounds that make subsequent click matching reliable.",
            ],
          }
        : {
            task:
              "Identify which supported editable semantic region contains or is visually nearest the supplied normalized click point.",
            serviceName,
            scope,
            normalizedClickPoint: { x, y },
            coordinateSystem:
              "x=0 is left, x=1 is right, y=0 is top, y=1 is bottom",
            supportedRegions,
            requirements: [
              "Inspect the image rather than guessing from the scope alone.",
              "Return only a supported region id that is visibly present at or very near the click.",
              "Return an approximate normalized bounding box [x, y, width, height] around the visible selected region.",
              "Do not return a region merely because it is allowed when the click is elsewhere.",
              "Use confidence below 0.58 when the target is ambiguous, absent, or not isolatable.",
            ],
          }
    );
    const completion = await groq.chat.completions.create({
      model,
      temperature: 0.05,
      top_p: 0.2,
      reasoning_effort: "none",
      max_completion_tokens: action === "map" ? 700 : 250,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            action === "map"
              ? 'You map editable semantic objects in a home-service image. Return strict JSON only: {"regions":[{"regionId":"supported_id","confidence":0.0,"boundingBox":[0.0,0.0,0.0,0.0]}]}.'
              : 'You identify a clicked semantic object in a home-service image. Return strict JSON only: {"regionId":"supported_id_or_none","confidence":0.0,"boundingBox":[0.0,0.0,0.0,0.0]}.',
        },
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: imageUrl } },
          ] as any,
        },
      ],
    });
    if (action === "map") {
      const detections = parseRegionMap(
        completion.choices[0]?.message?.content || "",
        supportedRegions
      );
      return NextResponse.json(
        {
          ok: true,
          regions: detections.map((detection) => ({
            ...detection.region,
            confidence: detection.confidence,
            bounds: detection.bounds,
          })),
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    const detection = parseDetection(
      completion.choices[0]?.message?.content || "",
      supportedRegions
    );
    if (!detection) {
      return NextResponse.json(
        {
          ok: true,
          region: null,
          message: "We couldn’t isolate that area. Describe what you’d like changed.",
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        region: {
          ...detection.region,
          confidence: detection.confidence,
          bounds: detection.bounds,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    logger.error("[adventure-v2:regions] detection failed", {
      instanceId,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      {
        ok: false,
        error: "We couldn’t isolate that area. Describe what you’d like changed.",
      },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}
