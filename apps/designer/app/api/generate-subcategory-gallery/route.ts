import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

// Types
interface GenerateGalleryRequest {
  subcategoryId: string;
  categoryName: string;
  subcategoryName: string;
  categoryDescription?: string;
  subcategoryDescription?: string;
  numImages?: number;
  userId: string;
}

interface GenerateImageRequest {
  prompt: string;
  provider: string;
  modelId: string;
  negativePrompt?: string;
  width?: number;
  height?: number;
  numOutputs?: number;
  guidanceScale?: number;
  numInferenceSteps?: number;
}

// Simplified Provider Factory
class ProviderFactory {
  static async generateImage(
    provider: string,
    request: GenerateImageRequest,
    apiKey: string
  ): Promise<{ images?: string[]; error?: string; predictionId?: string; status?: string }> {
    if (provider === 'replicate') {
      try {
        const response = await fetch('https://api.replicate.com/v1/predictions', {
          method: 'POST',
          headers: {
            'Authorization': `Token ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ...(String(request.modelId).includes(':') ? { version: request.modelId } : { model: request.modelId }),
            input: {
              prompt: request.prompt,
              num_outputs: request.numOutputs || 1,
              guidance_scale: request.guidanceScale || 7.5,
              width: request.width || 1024,
              height: request.height || 1024,
              num_inference_steps: request.numInferenceSteps || 20,
              ...(request.negativePrompt && { negative_prompt: request.negativePrompt }),
            },
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.detail || `HTTP ${response.status}`);
        }

        const prediction = await response.json();

        return {
          predictionId: prediction.id,
          status: prediction.status,
          images: prediction.output ? (Array.isArray(prediction.output) ? prediction.output : [prediction.output]) : [],
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error.message : 'Unknown error occurred',
        };
      }
    }

    throw new Error(`Unknown provider: ${provider}`);
  }
}

// Generate prompts for a subcategory
function generateSubcategoryPrompts(
  categoryName: string,
  subcategoryName: string,
  categoryDescription?: string,
  subcategoryDescription?: string
): string[] {
  const basePrompts = [
    `Professional ${subcategoryName} service, high quality, detailed, ${categoryName} industry, commercial photography style`,
    `Before and after ${subcategoryName} transformation, professional ${categoryName} work, realistic results`,
    `${subcategoryName} project showcase, ${categoryName} expertise, premium quality work, detailed close-up`,
    `Modern ${subcategoryName} design, ${categoryName} innovation, professional presentation, clean composition`,
    `Traditional ${subcategoryName} approach, ${categoryName} craftsmanship, authentic results, natural lighting`,
    `Contemporary ${subcategoryName} solution, ${categoryName} best practices, high-end finish, professional grade`,
    `${subcategoryName} work in progress, ${categoryName} process, behind the scenes, realistic documentation`,
    `Premium ${subcategoryName} result, ${categoryName} excellence, award-winning quality, showcase presentation`
  ];

  // Add context from descriptions if available
  if (categoryDescription || subcategoryDescription) {
    const context = [categoryDescription, subcategoryDescription].filter(Boolean).join(', ');
    return basePrompts.map(prompt => `${prompt}, ${context}`);
  }

  return basePrompts;
}

export async function POST(request: NextRequest) {
  try {
    // Authenticate user first
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookies().set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: Omit<GenerateGalleryRequest, 'userId'> = await request.json();

    // Validate required fields (userId comes from auth, not request)
    if (!body.subcategoryId || !body.categoryName || !body.subcategoryName) {
      return NextResponse.json(
        { error: 'Missing required fields: subcategoryId, categoryName, subcategoryName' },
        { status: 400 }
      );
    }

    // Use service role for bulk operations (this is legitimate since user is authenticated)
    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if subcategory already has images
    const { count: existingImages } = await supabase
      .from('images')
      .select('*', { count: 'exact', head: true })
      .eq('subcategory_id', body.subcategoryId);

    if (existingImages && existingImages > 0) {
      return NextResponse.json(
        { error: 'Subcategory already has placeholder images' },
        { status: 400 }
      );
    }

    // Check user's credits
    const { data: billingData, error: billingError } = await serviceSupabase
      .from('billing')
      .select('credits')
      .eq('user_id', user.id)
      .single();

    if (billingError) {
      return NextResponse.json(
        { error: 'Failed to check user credits' },
        { status: 500 }
      );
    }

    const requiredCredits = body.numImages || 8;
    const currentCredits = billingData?.credits || 0;

    if (currentCredits < requiredCredits) {
      return NextResponse.json(
        { 
          error: 'Insufficient credits',
          requiredCredits,
          currentCredits,
          shortfall: requiredCredits - currentCredits
        },
        { status: 402 }
      );
    }

    // Get Replicate API key
    const apiKey = process.env.REPLICATE_API_KEY || process.env.REPLICATE_API_TOKEN;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'REPLICATE_API_KEY or REPLICATE_API_TOKEN not configured' },
        { status: 500 }
      );
    }

    // Generate prompts for the subcategory
    const prompts = generateSubcategoryPrompts(
      body.categoryName,
      body.subcategoryName,
      body.categoryDescription,
      body.subcategoryDescription
    );

    const numImages = body.numImages || 8;
    const imagesToGenerate = Math.min(numImages, prompts.length);

    // Generate images
    const generatedImages: Array<{
      imageUrl: string;
      prompt: string;
      metadata: any;
    }> = [];

    for (let i = 0; i < imagesToGenerate; i++) {
      const prompt = prompts[i];

      const generateRequest: GenerateImageRequest = {
        prompt: prompt,
        provider: 'replicate',
        modelId: 'google/nano-banana',
        width: 1024,
        height: 1024,
        numOutputs: 1,
        guidanceScale: 7.5,
        numInferenceSteps: 20,
      };

      const response = await ProviderFactory.generateImage(
        'replicate',
        generateRequest,
        apiKey
      );

      if (response.error) {
        continue;
      }

      if (response.images && response.images.length > 0) {
        // Save image to database
        const { data: savedImage, error: saveError } = await supabase
          .from('images')
          .insert({
            image_url: response.images[0],
            subcategory_id: body.subcategoryId,
            user_id: user.id,
            metadata: {
              prompt: prompt,
              category: body.categoryName,
              subcategory: body.subcategoryName,
              generated_for_gallery: true,
              generation_timestamp: new Date().toISOString(),
              model: 'google/nano-banana',
              provider: 'replicate'
            }
          })
          .select()
          .single();

        if (saveError) {
          continue;
        }

        generatedImages.push({
          imageUrl: response.images[0],
          prompt: prompt,
          metadata: savedImage
        });
      }

      // Add a small delay between generations to avoid rate limiting
      if (i < imagesToGenerate - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Deduct credits from user's account
    const newCredits = currentCredits - generatedImages.length;
    const { error: updateError } = await serviceSupabase
      .from('billing')
      .update({ credits: newCredits })
      .eq('user_id', user.id);

    if (updateError) {}

    return NextResponse.json({
      success: true,
      images: generatedImages,
      totalGenerated: generatedImages.length,
      subcategoryId: body.subcategoryId,
      subcategoryName: body.subcategoryName,
      creditsDeducted: generatedImages.length,
      newBalance: newCredits
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to generate subcategory gallery' },
      { status: 500 }
    );
  }
} 