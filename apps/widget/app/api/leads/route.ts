import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/server/logger';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      instanceId,
      email,
      name,
      phone,
      isPartial = false,
      submissionData = {},
      sessionId
    } = body;

    // Validate required fields
    if (!instanceId || !email) {
      return NextResponse.json(
        { error: 'Missing required fields: instanceId and email' },
        { status: 400 }
      );
    }

    // Get client information
    const userAgent = request.headers.get('user-agent') || null;
    const referrer = request.headers.get('referer') || null;
    
    // Get IP address (handle different proxy scenarios)
    const forwarded = request.headers.get('x-forwarded-for');
    const realIp = request.headers.get('x-real-ip');
    const ipAddress = forwarded ? forwarded.split(',')[0] : realIp || request.ip || null;

    // Extract UTM parameters from referrer or submission data
    const url = new URL(request.url);
    const utmSource = url.searchParams.get('utm_source') || submissionData.utm_source || null;
    const utmMedium = url.searchParams.get('utm_medium') || submissionData.utm_medium || null;
    const utmCampaign = url.searchParams.get('utm_campaign') || submissionData.utm_campaign || null;
    const utmTerm = url.searchParams.get('utm_term') || submissionData.utm_term || null;
    const utmContent = url.searchParams.get('utm_content') || submissionData.utm_content || null;

    // Check if this session has already completed step 2 (within 24 hours)
    if (sessionId) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data: completedRows, error: checkError } = await supabase
        .from('form_submissions')
        .select('id')
        .eq('instance_id', instanceId)
        .eq('session_id', sessionId)
        .eq('is_partial', false)
        .gte('created_at', twentyFourHoursAgo)
        .limit(1);

      if (checkError) {
        logger.error('Error checking step 2 completion:', checkError);
      } else if (completedRows && completedRows.length > 0) {
        logger.info(`Session ${sessionId} already completed step 2 for instance ${instanceId}`);
        return NextResponse.json(
          { 
            success: false, 
            message: 'Session already completed step 2',
            step2Completed: true 
          },
          { status: 200 }
        );
      }
    }

    // Check partial submission limit if sessionId is provided (only for partial submissions)
    if (sessionId && isPartial) {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count, error: sessionError } = await supabase
        .from('form_submissions')
        .select('id', { count: 'exact' })
        .eq('instance_id', instanceId)
        .eq('session_id', sessionId)
        .eq('is_partial', true)
        .gte('created_at', twentyFourHoursAgo);

      if (sessionError) {
        logger.error('Error checking partial submission count:', sessionError);
      } else if ((count ?? 0) > 10) { // Limit to 10 partial submissions per session (last 24h)
        logger.info(`Session ${sessionId} has exceeded partial submission limit for instance ${instanceId}`);
        return NextResponse.json(
          { 
            success: false, 
            message: 'Session partial submission limit exceeded',
            sessionLimitExceeded: true 
          },
          { status: 429 }
        );
      }
    }

    // Insert the form submission
    const { data: submission, error: insertError } = await supabase
      .from('form_submissions')
      .insert({
        instance_id: instanceId,
        email,
        name: name || null,
        phone: phone || null,
        is_partial: isPartial,
        submission_data: submissionData,
        user_agent: userAgent,
        ip_address: ipAddress,
        referrer,
        utm_source: utmSource,
        utm_medium: utmMedium,
        utm_campaign: utmCampaign,
        utm_term: utmTerm,
        utm_content: utmContent,
        session_id: sessionId || null
      })
      .select()
      .single();

    if (insertError) {
      logger.error('Error inserting form submission:', insertError);
      return NextResponse.json(
        { error: 'Failed to save submission' },
        { status: 500 }
      );
    }

    logger.info('Form submission saved:', {
      id: submission.id,
      instanceId,
      email,
      isPartial,
      sessionId
    });

    // If this is a complete submission (not partial), you might want to trigger additional actions
    // like sending webhooks, notifications, etc.
    if (!isPartial && name && phone) {
      // TODO: Trigger webhook if instance has webhook_url configured
      // TODO: Send notification to account owner
      logger.info('Complete submission received - triggering additional actions');
    }

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      message: isPartial ? 'Partial submission saved' : 'Complete submission saved'
    });

  } catch (error) {
    logger.error('Error processing form submission:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const instanceId = searchParams.get('instanceId');
    const sessionId = searchParams.get('sessionId');

    if (!instanceId || !sessionId) {
      return NextResponse.json(
        { error: 'Missing required parameters: instanceId and sessionId' },
        { status: 400 }
      );
    }

    // Check if session has completed step 2 for this instance (within 24 hours)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: completedRows, error } = await supabase
      .from('form_submissions')
      .select('id')
      .eq('instance_id', instanceId)
      .eq('session_id', sessionId)
      .eq('is_partial', false)
      .gte('created_at', twentyFourHoursAgo)
      .limit(1);

    if (error) {
      logger.error('Error checking step 2 completion status:', error);
      return NextResponse.json(
        { error: 'Failed to check step 2 completion status' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      hasCompletedStep2: Array.isArray(completedRows) && completedRows.length > 0,
      sessionId,
      instanceId
    });

  } catch (error) {
    logger.error('Error checking session completion status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
