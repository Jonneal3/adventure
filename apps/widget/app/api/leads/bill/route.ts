import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CreditService } from '@/lib/credit-service';
import { logger } from '@/lib/server/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { instanceId, accountId, stage, sessionId, email, phone } = body as { instanceId: string; accountId: string; stage: 'email' | 'phone'; sessionId?: string; email?: string; phone?: string };

    if (!instanceId || !accountId || !stage) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch instance to read pricing and lead capture trigger
    const { data: instance, error: instErr } = await supabase
      .from('instances')
      .select('id, account_id, config, email_lead_price, phone_lead_price')
      .eq('id', instanceId)
      .single();

    if (instErr || !instance) {
      return NextResponse.json({ error: 'Instance not found' }, { status: 404 });
    }

    // Only bill if lead_capture_trigger === 'immediate'
    const config = (instance as any).config || {};
    const trigger = (config as any).lead_capture_trigger || 'submit';
    if (trigger !== 'immediate') {
    logger.info('Leads billing skipped: not_immediate', { instanceId, accountId, stage });
      return NextResponse.json({ billed: false, reason: 'not_immediate' });
    }

    // Pull configured prices as CREDIT COUNTS (not dollars)
    // Pricing: use ONLY the instance top-level fields (credits), not config
    const emailCredits = (instance as any).email_lead_price;
    const phoneCredits = (instance as any).phone_lead_price;

    const creditsToDeduct = stage === 'email' ? emailCredits : phoneCredits;
    logger.info('Leads billing computed credits', { instanceId, accountId, stage, creditsToDeduct });

    // Idempotency checks
    // 1) Check existing form submissions for this session/email/phone
    let shouldBillEmail = stage === 'email';
    let shouldBillPhone = stage === 'phone';

    // We will check the ledger too to ensure no double-charging
    // Prepare metadata for transaction records
    const txMetadata: Record<string, unknown> = {
      instanceId,
      stage,
      sessionId: sessionId || null,
      email: email || null,
      phone: phone || null,
    };

    // For idempotency, check if a transaction already exists for this stage & session
    // Note: We scope by account_id, instance_id, type, and optionally sessionId in metadata
    let ledgerQuery = supabase
      .from('account_credit_transactions')
      .select('id, metadata')
      .eq('account_id', accountId)
      .eq('instance_id', instanceId)
      .eq('type', stage === 'email' ? 'email_lead' : 'phone_lead')
      .order('created_at', { ascending: false })
      .limit(1);

    // Prefer matching by sessionId; else by email/phone if present
    if (sessionId) {
      // PostgREST jsonb contains
      ledgerQuery = ledgerQuery.contains('metadata', { sessionId });
    } else if (stage === 'email' && email) {
      ledgerQuery = ledgerQuery.contains('metadata', { email });
    } else if (stage === 'phone' && phone) {
      ledgerQuery = ledgerQuery.contains('metadata', { phone });
    }

    const { data: maybeExistingTx } = await ledgerQuery;
    if (maybeExistingTx && maybeExistingTx.length > 0) {
      const meta = (maybeExistingTx[0] as any)?.metadata || {};
      // If sessionId matches (when provided), consider it already billed
      if (!sessionId || meta.sessionId === sessionId) {
        if (stage === 'email') shouldBillEmail = false;
        if (stage === 'phone') shouldBillPhone = false;
      }
    }

    // If email stage and already billed, short-circuit
    if (stage === 'email' && !shouldBillEmail) {
      logger.info('Leads billing skipped: already_billed_email', { instanceId, accountId, stage, sessionId, email });
      return NextResponse.json({ billed: false, reason: 'already_billed_email' });
    }
    // If phone stage and already billed, short-circuit
    if (stage === 'phone' && !shouldBillPhone) {
      logger.info('Leads billing skipped: already_billed_phone', { instanceId, accountId, stage, sessionId, phone });
      return NextResponse.json({ billed: false, reason: 'already_billed_phone' });
    }

    // Try to ensure credits (attempt auto-top-up). If still insufficient, proceed with allow-negative.
    const creditService = new CreditService();
    const ensure = await creditService.ensureCredits(accountId, creditsToDeduct);

    if (ensure.hasEnough) {
      const result = await creditService.deductCredits(
        accountId,
        creditsToDeduct,
        stage === 'email' ? 'email_lead_billing' : 'phone_lead_billing',
        instanceId,
        stage === 'email' ? 'email_lead' : 'phone_lead',
        txMetadata
      );
      logger.info('Leads billing deducted (normal)', { instanceId, accountId, stage, creditsToDeduct, success: result.success, newBalance: result.newBalance });
      return NextResponse.json({ billed: result.success, creditsDeducted: creditsToDeduct, newBalance: result.newBalance });
    }

    // Auto-reload failed: allow lead and deduct into negative
    const negResult = await creditService.deductCreditsAllowNegative(
      accountId,
      creditsToDeduct,
      stage === 'email' ? 'email_lead_billing_allow_negative' : 'phone_lead_billing_allow_negative',
      instanceId,
      stage === 'email' ? 'email_lead' : 'phone_lead',
      txMetadata
    );
    logger.info('Leads billing deducted (allow_negative)', { instanceId, accountId, stage, creditsToDeduct, success: negResult.success, newBalance: negResult.newBalance });
    return NextResponse.json({ billed: negResult.success, creditsDeducted: creditsToDeduct, newBalance: negResult.newBalance, allowedNegative: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

