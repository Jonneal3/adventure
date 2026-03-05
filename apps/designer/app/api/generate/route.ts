import { NextRequest, NextResponse } from 'next/server';
import Replicate from 'replicate';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { CreditService } from '@/lib/stripe/credit-reloads/credit-service';
import { resolveUseCaseConfig } from '@/config/use-cases';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let prompt = body.prompt;
    let modelId = body.modelId || 'google/nano-banana';
    const negativePrompt = body.negativePrompt;
    const width = body.width || 1024;
    const height = body.height || 1024;
    const numOutputs = body.numOutputs || body.gallery_max_images || 1;
    const guidanceScale = body.guidanceScale || 7.5;
    const numInferenceSteps = body.numInferenceSteps || 20;
    const accountId = body.accountId;
    const instanceId = body.instanceId as string | undefined;
    const flowAnswers = body.flowAnswers as Record<string, any> | undefined;

    if (!prompt) {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    if (!accountId) {
      return NextResponse.json({ error: 'Account ID is required' }, { status: 400 });
    }

    // Initialize Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookies().set(name, value, options)
              );
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );

    // Get the current user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Resolve use_case and config for instance if provided
    let useCase: 'tryon' | 'scene' | null = null;
    let instanceModelProfile: string | null = null;
    let capabilities: any = null;
    if (instanceId) {
      const { data: inst } = await supabase
        .from('instances')
        .select('id, use_case, config, instance_type')
        .eq('id', instanceId)
        .maybeSingle();
      if (inst) {
        useCase = (inst.use_case as any) || null;
        capabilities = (inst as any).config?.capabilities || null;
        // Basic inference for legacy widgets: fallback to scene if missing
        if (!useCase) {
          // If we ever have better inference rules (e.g., categories), plug here
          useCase = 'scene';
        }
        // Model hint override from config map
        const uc = resolveUseCaseConfig(useCase);
        if (!body.modelId) {
          // Instance-level model profile removed; fall back to use case hints
          if (uc?.modelHints?.modelId) {
            modelId = uc.modelHints.modelId;
          }
        }
      }
    }

    // Check credits before generation (but don't deduct yet)
    const creditService = new CreditService();
    const requiredCredits = numOutputs; // 1 credit per image
    const operation = `image_generation_${modelId}${useCase ? `_${useCase}` : ''}`;

    const creditCheck = await creditService.checkCredits(accountId, requiredCredits);

    if (!creditCheck.hasEnough) {
      if (creditCheck.canAutoPurchase) {
        // Auto-purchase is available - initiate it
        const autoPurchaseResult = await creditService.autoPurchaseCredits(accountId, creditCheck.shortfall);
        if (autoPurchaseResult.success) {
          return NextResponse.json({ 
            error: 'Auto-purchase initiated',
            autoPurchased: true,
            paymentIntentId: autoPurchaseResult.paymentIntentId,
            message: 'Credits are being purchased automatically. Please retry in a few seconds.'
          }, { status: 202 }); // 202 Accepted
        }
      }
      
      // Insufficient credits and no auto-purchase available
      return NextResponse.json({ 
        error: 'Insufficient credits',
        currentBalance: creditCheck.currentBalance,
        requiredCredits,
        shortfall: creditCheck.shortfall,
        canAutoPurchase: false
      }, { status: 402 });
    }

    const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json({ error: 'REPLICATE_API_KEY or REPLICATE_API_TOKEN not configured' }, { status: 400 });
    }

    const replicate = new Replicate({ auth: apiKey });

    // NOTE: modelId can be either a Replicate model slug (e.g. 'google/nano-banana')
    // or a specific version string (e.g. 'owner/model:version-id').

    const input: Record<string, any> = {
      prompt,
      num_outputs: numOutputs,
      guidance_scale: guidanceScale,
      width,
      height,
      num_inference_steps: numInferenceSteps,
    };
    if (negativePrompt) input.negative_prompt = negativePrompt;

    // Enhance prompt with flow answers if provided
    if (flowAnswers && Object.keys(flowAnswers).length > 0) {
      // Build context from flow answers
      const flowContext = Object.entries(flowAnswers)
        .map(([key, value]) => {
          if (Array.isArray(value)) {
            return `${key}: ${value.join(', ')}`;
          }
          return `${key}: ${value}`;
        })
        .join(', ');
      
      // Append flow context to prompt
      prompt = `${prompt}. Context: ${flowContext}`;
    }

    // Simple logging for analytics/debug
    console.log('[Generate] use_case:', useCase, 'capabilities:', capabilities, 'modelId:', modelId, 'flowAnswers:', flowAnswers ? 'provided' : 'none');

    let prediction;
    try {
      prediction = await replicate.predictions.create({
        ...(String(modelId).includes(':') ? { version: modelId } : { model: modelId }),
        input,
      });
    } catch (err) {
      return NextResponse.json({ error: err instanceof Error ? err.message : 'Replicate API error' }, { status: 500 });
    }

    // Deduct credits after successful generation
    const creditResult = await creditService.deductCredits(accountId, requiredCredits, operation);

    if (!creditResult.success) {
      // Even though generation succeeded, we couldn't deduct credits
      // This is a critical error - the user got images without paying
      return NextResponse.json(
        { error: 'Generation succeeded but credit deduction failed. Please contact support.' },
        { status: 500 }
      );
    }

    // Return the prediction object as-is for the client to poll
    return NextResponse.json({
      success: true,
      prediction,
      images: prediction.output ? (Array.isArray(prediction.output) ? prediction.output : [prediction.output]) : [],
      predictionId: prediction.id,
      status: prediction.status,
      provider: 'replicate',
      modelId,
      creditsDeducted: requiredCredits,
      newBalance: creditResult.newBalance,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to generate images' }, { status: 500 });
  }
} 