import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
      console.error('Missing SUPABASE env: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      return new Response(JSON.stringify({ error: 'Missing Supabase configuration' }), { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    const supabase = createClient<Database>(supabaseUrl, serviceKey, {
      auth: { persistSession: false },
    });

    const { data: plans, error } = await supabase
      .from('plans')
      .select(
        'plan_id,name,monthly_price_cents,ai_credits_included,additional_credit_price,max_widgets,lead_capture_level,support_level,onboarding_type,analytics_level,prompt_packs_level,white_label,api_access,revenue_share,exclusivity,is_pricing_custom'
      )
      .order('monthly_price_cents', { ascending: true });

    if (error) {
      console.error('Error fetching plans:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    return new Response(JSON.stringify(plans ?? []), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    console.error('Unexpected error in /api/plans:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}

