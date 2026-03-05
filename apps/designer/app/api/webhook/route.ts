import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const supabase = createServerClient<Database>(
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
    
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { webhookUrl, payload } = body;
    if (!webhookUrl) {
      return NextResponse.json({ error: 'Webhook URL is required' }, { status: 400 });
    }

    const webhookResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Adventure-Webhook/1.0'
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
    return NextResponse.json({
      success: webhookResponse.ok,
      webhookStatus: webhookResponse.status,
      webhookResponse: webhookResponseData
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 
