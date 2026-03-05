import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';

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
      .order('sort_order')
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error fetching sample gallery:', error);
      return NextResponse.json(
        { error: 'Failed to fetch sample gallery images' },
        { status: 500 }
      );
    }

    // Transform the data to match the expected format
    const transformedImages = galleryImages?.map(item => ({
      id: item.images?.id || item.image_id,
      image: item.images?.image_url || '',
      prompt: item.images?.prompts?.prompt || null, // Get prompt from prompts table
      category: item.images?.metadata?.category || null,
      subcategory: item.images?.metadata?.subcategory || null,
      generated_for_gallery: true, // These are sample gallery images
      created_at: item.images?.created_at || item.created_at,
      prompt_id: item.images?.prompt_id || null,
      subcategory_id: item.images?.metadata?.subcategory_id || null,
      sort_order: item.sort_order
    })).filter(img => img.image) || [];


    


    return NextResponse.json({
      success: true,
      images: transformedImages,
      total: transformedImages.length,
      hasMore: transformedImages.length === limit
    });

  } catch (error) {
    logger.error('Error in sample gallery API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch sample gallery images' },
      { status: 500 }
    );
  }
}
