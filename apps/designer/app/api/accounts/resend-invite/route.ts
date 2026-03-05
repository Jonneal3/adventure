import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const { email, accountId } = await request.json();
    if (!email || !accountId) {
      return NextResponse.json(
        { error: 'Email and accountId are required' },
        { status: 400 }
      );
    }
    // Extract access token from Authorization header
    const authHeader = request.headers.get('authorization');
    const accessToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice(7)
      : null;
    if (!accessToken) {
      return NextResponse.json(
        { error: 'Unauthorized: No access token provided' },
        { status: 401 }
      );
    }
    // Create Supabase client with access token
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        },
      }
    );
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
    // Check if user has permission to resend (owner or admin)
    const { data: userAccount, error: userAccountError } = await supabase
      .from('user_accounts')
      .select('user_status')
      .eq('user_id', user.id)
      .eq('account_id', accountId)
      .single();
    if (userAccountError || !userAccount) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
    if (userAccount.user_status !== 'owner' && userAccount.user_status !== 'admin') {
      return NextResponse.json(
        { error: 'Only owners and admins can resend invites' },
        { status: 403 }
      );
    }
    // Find the invited user
    const { data: invitedUser, error: invitedUserError } = await supabase
      .from('user_accounts')
      .select('email, user_status')
      .eq('account_id', accountId)
      .eq('email', email)
      .eq('status', 'invited')
      .maybeSingle();
    if (invitedUserError || !invitedUser) {
      return NextResponse.json(
        { error: 'No pending invite found for this user' },
        { status: 404 }
      );
    }
    // Send invite email
    try {
      const resend = new Resend(process.env.RESEND_API_KEY);
      const { data: accountData } = await supabase
        .from('accounts')
        .select('name')
        .eq('id', accountId)
        .single();
      const accountName = accountData?.name || 'your account';
      await resend.emails.send({
        from: 'Adventure <noreply@adventure.app>',
        to: [email],
        subject: `You\'ve been invited to join ${accountName} on Adventure`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #3b82f6;">Welcome to Adventure!</h2>
            <p>You\'ve been invited to join <strong>${accountName}</strong> as a <strong>${invitedUser.user_status}</strong>.</p>
            <p>Adventure is an AI-powered design tool that helps you create stunning visuals for your business.</p>
            <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3 style="margin-top: 0;">What you can do:</h3>
              <ul>
                <li>Create and manage design instances</li>
                <li>Generate AI-powered visuals</li>
                <li>Collaborate with your team</li>
                <li>Access shared resources and designs</li>
              </ul>
            </div>
            <p>To get started, please create your account:</p>
            <a href="${process.env.NEXT_PUBLIC_APP_URL}/auth" style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
              Create Your Account
            </a>
            <p style="margin-top: 20px; font-size: 14px; color: #6b7280;">
              If you have any questions, please contact your account administrator.
            </p>
          </div>
        `,
      });
    } catch (emailError) {
      return NextResponse.json(
        { error: 'Failed to resend invitation email' },
        { status: 500 }
      );
    }
    return NextResponse.json({
      success: true,
      message: `Invitation email resent to ${email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
