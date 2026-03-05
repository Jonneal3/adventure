import { NextRequest, NextResponse } from 'next/server';
import { getShopFromRequest } from '@/lib/sessionToken';
import { getSupabaseServiceClient } from '@/lib/supabaseServer';
import {
  createRecurringCharge,
  getRecurringCharge,
  listRecurringCharges,
  activateRecurringCharge,
  cancelRecurringCharge,
} from '@/lib/shopify';

/**
 * GET /api/billing - List all charges for a shop
 */
export async function GET(req: NextRequest) {
  try {
    const shop = await getShopFromRequest(req);
    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter. Please provide shop in query string or use session token authentication.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: store, error } = await supabase
      .from('shopify_stores')
      .select('access_token')
      .eq('store_domain', shop)
      .maybeSingle();

    if (error) throw error;
    if (!store?.access_token) {
      return NextResponse.json(
        { error: 'Store not found or not installed. Please install the app first.' },
        { status: 404 }
      );
    }

    const charges = await listRecurringCharges(shop, store.access_token);
    return NextResponse.json({ charges });
  } catch (e: any) {
    const message = e?.message || 'Failed to fetch billing information';
    console.error('[billing GET] error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/billing - Create a new recurring charge
 * Body: { name: string, price: number (in cents), returnUrl: string, test?: boolean }
 */
export async function POST(req: NextRequest) {
  try {
    const shop = await getShopFromRequest(req);
    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter. Please provide shop in query string or use session token authentication.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { name, price, returnUrl, test = false } = body;

    if (!name || typeof price !== 'number' || !returnUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: name, price (number in cents), and returnUrl are required.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: store, error } = await supabase
      .from('shopify_stores')
      .select('access_token')
      .eq('store_domain', shop)
      .maybeSingle();

    if (error) throw error;
    if (!store?.access_token) {
      return NextResponse.json(
        { error: 'Store not found or not installed. Please install the app first.' },
        { status: 404 }
      );
    }

    const appUrl = process.env.SHOPIFY_APP_URL;
    if (!appUrl) {
      throw new Error('SHOPIFY_APP_URL environment variable is not set');
    }

    const charge = await createRecurringCharge(
      shop,
      store.access_token,
      name,
      price,
      returnUrl || `${appUrl}/?shop=${encodeURIComponent(shop)}`,
      test
    );

    return NextResponse.json({ charge });
  } catch (e: any) {
    const message = e?.message || 'Failed to create billing charge';
    console.error('[billing POST] error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/billing - Activate a charge
 * Body: { chargeId: number }
 */
export async function PUT(req: NextRequest) {
  try {
    const shop = await getShopFromRequest(req);
    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter. Please provide shop in query string or use session token authentication.' },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { chargeId } = body;

    if (typeof chargeId !== 'number') {
      return NextResponse.json(
        { error: 'Missing or invalid chargeId. Please provide a valid charge ID.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: store, error } = await supabase
      .from('shopify_stores')
      .select('access_token')
      .eq('store_domain', shop)
      .maybeSingle();

    if (error) throw error;
    if (!store?.access_token) {
      return NextResponse.json(
        { error: 'Store not found or not installed. Please install the app first.' },
        { status: 404 }
      );
    }

    await activateRecurringCharge(shop, store.access_token, chargeId);
    const charge = await getRecurringCharge(shop, store.access_token, chargeId);

    return NextResponse.json({ charge });
  } catch (e: any) {
    const message = e?.message || 'Failed to activate billing charge';
    console.error('[billing PUT] error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/billing - Cancel a charge
 * Query: ?chargeId=123
 */
export async function DELETE(req: NextRequest) {
  try {
    const shop = await getShopFromRequest(req);
    if (!shop) {
      return NextResponse.json(
        { error: 'Missing shop parameter. Please provide shop in query string or use session token authentication.' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(req.url);
    const chargeId = searchParams.get('chargeId');
    const chargeIdNum = chargeId ? parseInt(chargeId, 10) : null;

    if (!chargeIdNum || isNaN(chargeIdNum)) {
      return NextResponse.json(
        { error: 'Missing or invalid chargeId. Please provide a valid charge ID in the query string.' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServiceClient();
    const { data: store, error } = await supabase
      .from('shopify_stores')
      .select('access_token')
      .eq('store_domain', shop)
      .maybeSingle();

    if (error) throw error;
    if (!store?.access_token) {
      return NextResponse.json(
        { error: 'Store not found or not installed. Please install the app first.' },
        { status: 404 }
      );
    }

    await cancelRecurringCharge(shop, store.access_token, chargeIdNum);

    return NextResponse.json({ success: true, message: 'Charge cancelled successfully' });
  } catch (e: any) {
    const message = e?.message || 'Failed to cancel billing charge';
    console.error('[billing DELETE] error:', message);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

