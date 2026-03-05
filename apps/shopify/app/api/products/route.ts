import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServiceClient } from '@/lib/supabaseServer';
import { fetchProducts } from '@/lib/shopify';
import { getShopFromRequest } from '@/lib/sessionToken';

export async function GET(req: NextRequest) {
  try {
    const shop = await getShopFromRequest(req);
    if (!shop) {
      return NextResponse.json(
        { 
          error: 'Missing shop parameter',
          message: 'Please provide shop in query string or use session token authentication.'
        }, 
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data, error } = await supabase
      .from('shopify_stores')
      .select('access_token')
      .eq('store_domain', shop)
      .maybeSingle();
    
    if (error) {
      console.error('[products GET] database error:', error);
      throw new Error('Database error occurred while fetching store information.');
    }
    
    if (!data?.access_token) {
      return NextResponse.json(
        { 
          error: 'Store not found or not installed',
          message: 'The store has not been installed. Please install the app first.'
        }, 
        { status: 404 }
      );
    }

    const products = await fetchProducts(shop, data.access_token);
    return NextResponse.json(products);
  } catch (e: any) {
    const message = e?.message || 'An unexpected error occurred while fetching products.';
    console.error('[products GET] error:', message, e);
    return NextResponse.json(
      { 
        error: message,
        details: 'If this problem persists, please try refreshing the page or contact support.'
      }, 
      { status: 500 }
    );
  }
}

