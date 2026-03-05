import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    // Server-side read with service role; do NOT expose service role to clients.
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        cookies: {
          getAll() {
            return [] as any;
          },
          setAll() {},
        },
      }
    );

    // Select only fields needed by the pricing UI
    const { data: plans, error } = await supabase
      .from('plans')
      .select(
        'plan_id,name,monthly_price_cents,ai_credits_included,max_widgets,lead_capture_level,support_level,onboarding_type,analytics_level,prompt_packs_level,white_label,api_access,revenue_share,exclusivity,is_pricing_custom'
      )
      .order('monthly_price_cents', { ascending: true });

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    return new Response(JSON.stringify(plans ?? []), {
      status: 200,
      headers: {
        'Cache-Control': 's-maxage=300, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Failed to fetch plans' }), { status: 500 });
  }
}