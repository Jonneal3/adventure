import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';
import { localizeGalleryPricing, type GalleryPricingResult } from '@/components/adventure/v8/galleryEnrichment';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json(
        { error: 'Missing required environment variables' },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '12');
    const offset = parseInt(searchParams.get('offset') || '0');

    const { data: instance } = await supabase
      .from('instances')
      .select('*')
      .eq('id', params.instanceId)
      .maybeSingle();
    const instanceMetadata = instance?.metadata && typeof instance.metadata === 'object'
      ? instance.metadata as Record<string, unknown>
      : {};
    const pricingLocation = {
      city: instance?.location_city || instance?.business_city || instance?.city || instanceMetadata.city || '',
      state: instance?.location_state || instance?.business_state || instance?.state || instanceMetadata.state || '',
    };

    // Fetch sample gallery images with their associated image data and prompts
    const { data: galleryImages, error } = await supabase
      .from('instance_sample_gallery')
      .select(`
        *,
        images (
          id,
          image_url,
          prompt_id,
          metadata,
          created_at,
          prompts (
            id,
            prompt
          )
        )
      `)
      .eq('instance_id', params.instanceId)
      .order('sort_order');

    if (error) {
      logger.error('Error fetching sample gallery:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sample gallery images' },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const readyGalleryImages = (galleryImages || []).filter((item: any) =>
      item?.images?.metadata?.gallery_enrichment?.version === 1 &&
      item?.images?.metadata?.gallery_enrichment?.publish?.status === "ready"
    );
    const transformedImages = readyGalleryImages.slice(offset, offset + limit).map((item: any) => {
      const enrichment = item.images?.metadata?.gallery_enrichment;
      const pricing = localizeGalleryPricing(enrichment.pricing as GalleryPricingResult, pricingLocation);
      return {
        id: item.images?.id || item.image_id,
        image: item.images?.image_url || '',
        prompt: item.images?.prompts?.prompt || null,
        category: item.images?.metadata?.category || null,
        subcategory: item.images?.metadata?.subcategory || null,
        generated_for_gallery: true,
        created_at: item.images?.created_at || item.created_at,
        prompt_id: item.images?.prompt_id || null,
        subcategory_id: item.images?.metadata?.subcategory_id || null,
        sort_order: item.sort_order,
        gallery_enrichment: { ...enrichment, pricing },
        before_image_url: enrichment.before?.url || null,
        priceable_manifest: enrichment.priceableManifest || null,
        verification_confidence: enrichment.verification?.confidence ?? null,
        pricing_confidence: pricing.confidence || null,
        price_range: pricing.localizedRange,
        pricing_breakdown: pricing.breakdown,
        pricing_assumptions: pricing.assumptions || [],
        badge: item.images?.metadata?.gallery_badge || "Project example",
        disclosure: enrichment.before?.status === "success" && enrichment.before?.url
          ? "AI-generated illustrative before"
          : null,
      };
    }).filter(img => img.image) || [];


    


    return NextResponse.json({
      success: true,
      images: transformedImages,
      total: transformedImages.length,
      hasMore: offset + transformedImages.length < readyGalleryImages.length
    });

  } catch (error) {
    logger.error('Error in sample gallery API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sample gallery images' },
      { status: 500 }
    );
  }
}
