import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { email, accountId, role } = await request.json();
    if (!email || !accountId || !role) {
      return NextResponse.json(
        { error: 'Email, accountId, and role are required' },
        { status: 400 }
      );
    }
    if (role === 'owner') {
      return NextResponse.json(
        { error: 'Cannot invite a user as owner' },
        { status: 400 }
      );
    }
    // Create authenticated Supabase client
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookies().getAll()
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookies().set(name, value, options)
              )
            } catch {
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
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
    // Check if user has permission to invite (owner or admin)
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
        { error: 'Only owners and admins can invite users' },
        { status: 403 }
      );
    }
    // Check if user exists in auth.users
    const { data: userList, error: userListError } = await supabaseAdmin.auth.admin.listUsers();
    if (userListError) {
      return NextResponse.json(
        { error: 'Failed to fetch users from auth.users' },
        { status: 500 }
      );
    }
    const foundUser = userList.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    let invitedUserId = foundUser?.id;
    let inviteStatus = 'accepted';
    if (!foundUser) {
      // Create user in auth.users (invite)
      const { data: newUser, error: createUserError } = await supabaseAdmin.auth.admin.createUser({
        email,
        email_confirm: false,
      });
      if (createUserError) {
        return NextResponse.json(
          { error: `Failed to create user: ${createUserError.message || createUserError}` },
          { status: 500 }
        );
      }
      invitedUserId = newUser.user?.id;
      inviteStatus = 'invited';
    }
    // Check if already in user_accounts
    const { data: existingUserAccount } = await supabase
      .from('user_accounts')
      .select('id, status')
      .eq('user_id', invitedUserId)
      .eq('account_id', accountId)
      .maybeSingle();
    if (existingUserAccount) {
      return NextResponse.json(
        { error: 'User is already a member or invited to this account' },
        { status: 400 }
      );
    }
    // Always set status to 'invited' on invite
    const { error: insertError } = await supabaseAdmin
      .from('user_accounts')
      .insert([{
        user_id: invitedUserId,
        account_id: accountId,
        user_status: role,
        status: 'invited'
      }]);
    if (insertError) {
      return NextResponse.json(
        { error: `Failed to add user to account: ${insertError.message || insertError}` },
        { status: 500 }
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
          <div style=\"font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;\">
            <h2 style=\"color: #3b82f6;\">Welcome to Adventure!</h2>
            <p>You\'ve been invited to join <strong>${accountName}</strong> as a <strong>${role}</strong>.</p>
            <p>Adventure is an AI-powered design tool that helps you create stunning visuals for your business.</p>
            <div style=\"background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;\">
              <h3 style=\"margin-top: 0;\">What you can do:</h3>
              <ul>
                <li>Create and manage design instances</li>
                <li>Generate AI-powered visuals</li>
                <li>Collaborate with your team</li>
                <li>Access shared resources and designs</li>
              </ul>
            </div>
            <p>To get started, please create your account:</p>
            <a href=\"${process.env.NEXT_PUBLIC_APP_URL}/auth\" style=\"display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;\">
              Create Your Account
            </a>
            <p style=\"margin-top: 20px; font-size: 14px; color: #6b7280;\">
              If you have any questions, please contact your account administrator.
            </p>
          </div>
        `,
      });
    } catch (emailError) {}
    return NextResponse.json({
      success: true,
      message: `User invited to account and invitation email sent to ${email}.`,
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 
