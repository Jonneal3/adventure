import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest, { params }: { params: { planId: string } }) {
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

    const { data: plan, error } = await supabase
      .from('plans')
      .select('*')
      .eq('plan_id', params.planId)
      .single();

    if (error) {
      console.error('Error fetching plan:', error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    if (!plan) {
      return new Response(JSON.stringify({ error: 'Plan not found' }), { status: 404, headers: { 'Cache-Control': 'no-store' } });
    }

    return new Response(JSON.stringify(plan), {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error: any) {
    console.error('Unexpected error in /api/plans/[planId]:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Unknown error' }), { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
}
