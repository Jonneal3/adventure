import { NextRequest, NextResponse } from 'next/server';
import { CreditService } from '../../../../lib/credit-service';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';

function normalizeServiceUrl(raw: unknown): string {
	let s = String(raw || "").trim();
	if (!s) return "";
	if (!/^https?:\/\//i.test(s)) s = `https://${s.replace(/^\/+/, "")}`;
	return s.replace(/\/+$/, "");
}

function resolveFormServiceBaseUrls(): string[] {
	const isDevMode = process.env.NEXT_PUBLIC_AI_FORM_DEV_MODE === "true" || process.env.NODE_ENV !== "production";
	const devUrl = normalizeServiceUrl(process.env.DEV_DSPY_SERVICE_URL || "");
	const prodUrl = normalizeServiceUrl(process.env.PROD_DSPY_SERVICE_URL || process.env.DSPY_SERVICE_URL || "");
	const urls: string[] = [];
	if (isDevMode) {
		if (devUrl) urls.push(devUrl);
		if (prodUrl) urls.push(prodUrl);
	} else {
		if (prodUrl) urls.push(prodUrl);
		if (devUrl) urls.push(devUrl);
	}
	return Array.from(new Set(urls)).filter(Boolean);
}

function imageRefSignatures(raw: unknown): string[] {
	const s = String(raw || "").trim();
	if (!s) return [];
	const out = new Set<string>([s]);
	if (/^https?:\/\//i.test(s)) {
		try {
			const u = new URL(s);
			out.add(`${u.origin}${u.pathname}`);
		} catch {}
	}
	return Array.from(out);
}

// Scene generation / editing
// - If an input image is provided: do Flux Kontext scene EDITING (single input image)
// - If no input image is provided: do text-to-image to generate an initial scene (no uploads required)
export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const generationIntent = String(body?.generationIntent || "").trim().toLowerCase();

		// Log incoming request for debugging
		logger.info('📥 [SCENE API] Received request:', {
			hasPrompt: !!body.prompt,
			promptPreview: body.prompt?.substring(0, 50),
			instanceId: body.instanceId,
			isDrillDown: body.isDrillDown,
			hasReferenceImages: Array.isArray(body.referenceImages),
			referenceImagesCount: Array.isArray(body.referenceImages) ? body.referenceImages.length : 0,
			hasSceneImage: !!body.sceneImage,
			hasProductImage: !!body.productImage,
			hasUserImage: !!body.userImage,
			requestKeys: Object.keys(body),
			bodySummary: {
				prompt: body.prompt?.substring(0, 100),
				instanceId: body.instanceId,
				referenceImages: body.referenceImages ? `[${body.referenceImages.length} items]` : 'missing',
				sceneImage: body.sceneImage ? '[present]' : 'missing',
				productImage: body.productImage ? '[present]' : 'missing',
				userImage: body.userImage ? '[present]' : 'missing',
				isDrillDown: body.isDrillDown
			}
		});

		// Validate required fields
		if (!body.prompt) {
			logger.error('❌ [SCENE API] Missing prompt');
			return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
		}
		if (!body.instanceId) {
			logger.error('❌ [SCENE API] Missing instanceId');
			return NextResponse.json({ error: 'Instance ID is required' }, { status: 400 });
		}

		// If this is a drilldown request (has isDrillDown flag), reject with helpful error
		// Drilldown is only for DrillDownModal when clicking on generated images
		if (body.isDrillDown) {
			logger.error('🚨 [SCENE API] Drilldown request incorrectly routed to scene endpoint:', {
				isDrillDown: body.isDrillDown,
				hasReferenceImages: Array.isArray(body.referenceImages) && body.referenceImages.length > 0,
				referenceImagesCount: Array.isArray(body.referenceImages) ? body.referenceImages.length : 0,
				hasSceneImage: !!body.sceneImage,
				hasProductImage: !!body.productImage,
				prompt: body.prompt?.substring(0, 50)
			});
			return NextResponse.json(
				{
					error: 'Drilldown requests should use /api/generate/drilldown endpoint, not /api/generate/scene'
				},
				{ status: 400 }
			);
		}

		// Determine if we're doing editing (image provided) or initial generation (no image).
		// Editing uses Flux Kontext Pro and supports ONE input image.
		const incomingRefs: string[] = Array.isArray(body.referenceImages)
			? (body.referenceImages as string[]).filter(Boolean)
			: [];
		// Prefer the most "uploaded"/primary image first so edits adhere to it.
		// NOTE: Flux Kontext scene editing supports a single input image, so we will pick one deterministically.
		const orderedCandidates = [body.userImage, body.sceneImage, body.productImage, ...incomingRefs].filter(
			Boolean
		) as string[];
		const allImages = Array.from(new Set(orderedCandidates));

		const isEdit = allImages.length > 0;

		if (isEdit && allImages.length > 1) {
			logger.warn(
				'⚠️ [SCENE API] Multiple input images provided; selecting the first to maximize adherence:',
				{
					imageCount: allImages.length,
					selectedImageSource: body.userImage
						? 'userImage'
						: body.sceneImage
							? 'sceneImage'
							: body.productImage
								? 'productImage'
								: 'referenceImages'
				}
			);
		}

		const primaryImage = isEdit ? allImages[0] : null;

		// Default model:
		// - editing: FLUX Kontext Pro (needs an input image)
		// - initial: FLUX 1.1 Pro (text-to-image, no uploads required)
		const modelId =
			body.modelId ||
			(generationIntent === "small_improvement" || generationIntent === "small-improvement"
				? 'black-forest-labs/flux-kontext-pro'
				: isEdit
					? 'black-forest-labs/flux-kontext-pro'
					: 'black-forest-labs/flux-1.1-pro');

		// Number of outputs
		const numOutputs =
			generationIntent === "small_improvement" || generationIntent === "small-improvement"
				? 1
				: body.numOutputs || body.gallery_max_images || 4;

		// Supabase setup
		const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
		const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
		if (!supabaseUrl || !supabaseKey) {
			return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
		}
		const supabase = createClient(supabaseUrl, supabaseKey);

		// Load instance for account id and credit price
		const { data: instance, error: instanceError } = await supabase
			.from('instances')
			.select('account_id, credit_price')
			.eq('id', body.instanceId)
			.single();
		if (instanceError || !instance) {
			return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
		}
		const accountId = (instance as any).account_id;
		if (!accountId) {
			return NextResponse.json({ error: 'Invalid instance configuration' }, { status: 400 });
		}

		// Credits
		const creditService = new CreditService();
		const creditPrice = (instance as any).credit_price;
		const requiredCredits = numOutputs * creditPrice;
		const operation = `widget_image_generation_${body.instanceId}_scene`;

		const creditCheck = await creditService.checkCredits(accountId, requiredCredits);
		if (!creditCheck.hasEnough) {
			const ensureForRequired = await creditService.ensureCredits(accountId, requiredCredits);
			if (!ensureForRequired.hasEnough) {
			 return NextResponse.json(
					{
						error: 'Insufficient credits',
						currentBalance: ensureForRequired.currentBalance,
						requiredCredits,
						shortfall: ensureForRequired.shortfall,
						autoTopUpAttempted: ensureForRequired.toppedUp,
						autoTopUpAmount: ensureForRequired.topUpAmount
					},
					{ status: 402 }
				);
			}
		} else {
			const predictedPost = (creditCheck.currentBalance || 0) - requiredCredits;
			if (predictedPost <= 0) {
				try {
					await creditService.ensureCredits(accountId, requiredCredits + 1);
				} catch {}
			}
		}

		// Build reference images:
		// - editing: Flux scene editing uses a SINGLE input image
		// - initial: no referenceImages
		const referenceImages: string[] | undefined = allImages.length > 1 ? allImages.slice(1) : undefined;

		const guidanceScale = body.guidanceScale ?? (isEdit ? 5.5 : 6.0);
		const numInferenceSteps = body.numInferenceSteps ?? (isEdit ? 25 : 18);
		const promptUpsampling = body.promptUpsampling ?? (isEdit ? true : undefined);
		const safetyTolerance =
			typeof body.safetyTolerance === 'number'
				? Math.min(body.safetyTolerance, isEdit ? 2 : 6)
				: undefined;

		// Derive aspect ratio from provided width/height if not explicitly set
		const deriveAspectRatio = (w?: number, h?: number): string | undefined => {
			if (!w || !h || w <= 0 || h <= 0) return undefined;
			const gcd = (a: number, b: number): number => b === 0 ? a : gcd(b, a % b);
			const g = gcd(Math.round(w), Math.round(h));
			const aw = Math.round(w / g);
			const ah = Math.round(h / g);
			return `${aw}:${ah}`;
		};
		const computedAspect = body.aspectRatio || deriveAspectRatio(body.width, body.height);

		const baseUrls = resolveFormServiceBaseUrls();
		if (baseUrls.length === 0) {
			return NextResponse.json({ error: "DSPY service URL is not configured" }, { status: 500 });
		}

		const upstreamPayload = {
			...body,
			instanceId: body.instanceId,
			modelId,
			numOutputs,
			aspectRatio: computedAspect || (isEdit ? 'match_input_image' : '1:1'),
			guidanceScale,
			numInferenceSteps,
			safetyTolerance,
			promptUpsampling,
			referenceImages: [primaryImage, ...(referenceImages || [])].filter(Boolean),
		};

		let upstream: any = null;
		let lastError: any = null;
		for (const baseUrl of baseUrls) {
			const endpoint = new URL("/v1/api/generate/scene", baseUrl).toString();
			try {
				const resp = await fetch(endpoint, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify(upstreamPayload),
					cache: "no-store",
				});
				const text = await resp.text().catch(() => "");
				const json = text ? (() => { try { return JSON.parse(text); } catch { return null; } })() : null;
				if (!resp.ok) {
					lastError = { status: resp.status, details: json ?? text.slice(0, 2000) };
					continue;
				}
				upstream = json;
				break;
			} catch (e) {
				lastError = e instanceof Error ? e.message : String(e);
			}
		}
		if (!upstream || upstream.ok === false) {
			return NextResponse.json({ error: "Image generation failed", details: lastError || upstream }, { status: 502 });
		}

		const upstreamImages = Array.isArray(upstream?.images)
			? upstream.images.filter((img: any) => typeof img === "string" && img.trim())
			: [];
		const inputImages = [primaryImage, ...(referenceImages || [])].filter(Boolean);
		const inputSignatures = new Set<string>(inputImages.flatMap((img) => imageRefSignatures(img)));
		const filteredImages = upstreamImages.filter((img: string) =>
			imageRefSignatures(img).every((sig) => !inputSignatures.has(sig))
		);

		if (upstreamImages.length === 0) {
			return NextResponse.json(
				{ error: "Image generation returned no images", details: { predictionId: upstream?.predictionId || upstream?.id || null } },
				{ status: 502 }
			);
		}
		if (isEdit && filteredImages.length === 0) {
			return NextResponse.json(
				{
					error: "Image generation did not produce a new image",
					details: { reason: "output_matches_input", predictionId: upstream?.predictionId || upstream?.id || null },
				},
				{ status: 502 }
			);
		}

		// Deduct credits
		const creditResult = await creditService.deductCredits(accountId, requiredCredits, operation, body.instanceId);
		if (!creditResult.success) {
		 return NextResponse.json(
				{ error: 'Generation succeeded but credit deduction failed. Please contact support.' },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			images: isEdit ? filteredImages : upstreamImages,
			predictionId: upstream?.predictionId || upstream?.id,
			status: upstream?.status,
			provider: "replicate",
			modelId: upstream?.modelId || modelId,
			instanceId: body.instanceId,
			creditsDeducted: requiredCredits,
			newBalance: creditResult.newBalance,
			useCase: 'scene'
		});
	} catch (error) {
		logger.error('💥 [SCENE API] Unexpected error:', error);
		return NextResponse.json({ error: 'Failed to generate scene placement images' }, { status: 500 });
	}
}
