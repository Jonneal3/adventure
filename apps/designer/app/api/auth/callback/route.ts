import { createServerClient } from '@supabase/ssr'
import { isAuthApiError } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import type { Database } from '@/types/database'

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const error = requestUrl.searchParams.get("error");
  const next = requestUrl.searchParams.get("next") || "/";
  const error_description = requestUrl.searchParams.get("error_description");

  if (code) {
    const cookieStore = cookies()
    
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: any) {
            try {
              cookieStore.set({ name, value, ...options })
            } catch (error) {
              // The `set` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
          remove(name: string, options: any) {
            try {
              cookieStore.set({ name, value: '', ...options })
            } catch (error) {
              // The `delete` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )

    try {
      await supabase.auth.exchangeCodeForSession(code);

      const { data: user, error: userError } = await supabase.auth.getUser();

      if (userError || !user) {
        return NextResponse.redirect(
          `${requestUrl.origin}/auth?error=500`
        );
      }

      return NextResponse.redirect(`${requestUrl.origin}/accounts`);

    } catch (error) {
      if (isAuthApiError(error)) {
        return NextResponse.redirect(
          `${requestUrl.origin}/auth?error=AuthApiError`
        );
      } else {
        return NextResponse.redirect(
          `${requestUrl.origin}/auth?error=500`
        );
      }
    }
  }
  return NextResponse.redirect(new URL(next, req.url));
}
