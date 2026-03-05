import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}));
    const ua = request.headers.get('user-agent') || '';
    const referer = request.headers.get('referer') || '';
    const origin = request.headers.get('origin') || '';

    // Server-side log for debugging Shopify -> Widget plumbing
    logger.info('🔎 [SIF DEBUG] Shopify context received', {
      event: payload?.event || 'unknown',
      shop: payload?.shop,
      productId: payload?.productId,
      productGid: payload?.productGid,
      productHandle: payload?.productHandle,
      productTitle: payload?.productTitle,
      imagesCount: Array.isArray(payload?.images) ? payload.images.length : 0,
      firstImages: Array.isArray(payload?.images) ? payload.images.slice(0, 3) : [],
      source: payload?.source || 'widget',
      originHint: payload?.origin || origin || null,
      referer,
      ua
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: 'Failed to log debug payload' }, { status: 400 });
  }
}

