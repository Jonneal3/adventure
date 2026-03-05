import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  logger.info('🔗 Webhook route called');
  try {
    const body = await request.json();
    const { webhookUrl, payload, instanceId } = body;
    
    logger.info('📥 Webhook request body:', { webhookUrl, instanceId, payload });
    
    if (!webhookUrl) {
      logger.warn('❌ No webhook URL provided');
      return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
    }

    // If we have an instanceId, we can also save the lead to the database
    if (instanceId && payload.email) {
      logger.info('💾 Saving lead to database:', { instanceId, email: payload.email });
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      if (supabaseUrl && supabaseKey) {
        const supabase = createClient(supabaseUrl, supabaseKey);
        
        try {
          // Determine if this is a partial submission
          const isPartial = payload.metadata?.is_partial || (!payload.name || !payload.phone);
          
          logger.info('📊 Lead status determined:', { isPartial });
          
          // Get client information from headers if available
          const userAgent = request.headers.get('user-agent') || null;
          const referrer = request.headers.get('referer') || null;
          
          // Get IP address
          const forwarded = request.headers.get('x-forwarded-for');
          const realIp = request.headers.get('x-real-ip');
          const ipAddress = forwarded ? forwarded.split(',')[0] : realIp || null;
          
          await supabase
            .from('form_submissions')
            .insert({
              instance_id: instanceId,
              email: payload.email,
              name: payload.name || null,
              phone: payload.phone || null,
              is_partial: isPartial,
              submission_data: payload.metadata || {},
              user_agent: userAgent,
              ip_address: ipAddress,
              referrer,
              session_id: payload.metadata?.session_id || null
            });
          
          logger.info('✅ Form submission saved to database successfully');
        } catch (dbError) {
          logger.error('❌ Failed to save form submission to database:', dbError);
          // Don't fail the webhook if DB save fails
        }
      } else {
        logger.warn('⚠️ Missing Supabase credentials');
      }
    } else {
      logger.warn('⚠️ No instanceId or email provided for database save');
    }

    logger.info('🌐 Sending webhook to:', webhookUrl);
    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mage-Widget-Webhook/1.0'
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    });
    
    const webhookResponseText = await webhookResponse.text();
    let webhookResponseData;
    try {
      webhookResponseData = JSON.parse(webhookResponseText);
    } catch {
      webhookResponseData = webhookResponseText;
    }
    
    logger.info('📡 Webhook response:', { status: webhookResponse.status, data: webhookResponseData });
    
    return NextResponse.json({
      success: webhookResponse.ok,
      webhookStatus: webhookResponse.status,
      webhookResponse: webhookResponseData
    });
  } catch (error) {
    logger.error('Webhook error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
