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
    // Check environment variables at runtime
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



    // Fetch images for this instance
    const { data: images, error } = await supabase
      .from('images')
      .select(`
        id,
        image_url,
        metadata,
        created_at,
        prompt_id,
        subcategory_id
      `)
      .eq('instance_id', params.instanceId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Error fetching images:', error);
      return NextResponse.json(
        { error: 'Failed to fetch images' },
        { status: 500 }
      );
    }

    // Transform images to include prompts from metadata
    const transformedImages = images?.map(img => ({
      id: img.id,
      image: img.image_url,
      prompt: img.metadata?.prompt || null,
      category: img.metadata?.category || null,
      subcategory: img.metadata?.subcategory || null,
      generated_for_gallery: img.metadata?.generated_for_gallery || false,
      created_at: img.created_at,
      prompt_id: img.prompt_id,
      subcategory_id: img.subcategory_id
    })) || [];



    return NextResponse.json({
      success: true,
      images: transformedImages,
      total: transformedImages.length,
      hasMore: transformedImages.length === limit
    });

  } catch (error) {
    logger.error('Error in images API:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
} 
