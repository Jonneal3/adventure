import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CreditService } from '@/lib/credit-service';

export async function GET(
  request: NextRequest,
  { params }: { params: { instanceId: string } }
) {
  try {
    const { instanceId } = params;
    const url = new URL(request.url);
    const requiredParam = url.searchParams.get('required') || url.searchParams.get('requiredCredits');
    const requiredCredits = Math.max(1, Number(requiredParam) || 1);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: instance, error: instErr } = await supabase
      .from('instances')
      .select('id, account_id, config')
      .eq('id', instanceId)
      .single();

    if (instErr || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    const accountId = (instance as any).account_id;
    const creditService = new CreditService();
    // Attempt to ensure credits (auto-reload if enabled) for the requested amount
    const ensure = await creditService.ensureCredits(accountId, requiredCredits);

    return NextResponse.json({
      available: ensure.hasEnough,
      hasEnough: ensure.hasEnough,
      currentBalance: ensure.currentBalance,
      shortfall: ensure.shortfall,
      toppedUp: ensure.toppedUp,
      topUpAmount: ensure.topUpAmount,
      required: requiredCredits
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}


