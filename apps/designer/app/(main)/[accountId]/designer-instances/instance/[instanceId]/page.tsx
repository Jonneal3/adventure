export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';
import React from 'react';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import ClientDesignInstancePage from './ClientPage';


async function logServerContext(accountId: string, instanceId: string) {
  try {
    const cookieStore = await cookies();
    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
        },
      }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError) {}

    let membership: any = null;
    if (user) {
      const { data: userAccount, error: uaError } = await supabase
        .from('user_accounts')
        .select('user_id, account_id, user_status, status')
        .eq('user_id', user.id)
        .eq('account_id', accountId)
        .maybeSingle();
      if (uaError) {}
      membership = userAccount ?? null;
    }

    const { data: instance, error: instError } = await supabase
      .from('instances')
      .select('id, account_id, status')
      .eq('id', instanceId)
      .maybeSingle();
    if (instError) {}
  } catch (err) {}
}

export default async function DesignInstancePage({ params }: { params: { accountId: string; instanceId: string } }) {
  // STEP 6: TEST ORIGINAL CLIENT PAGE (but with heavy components commented out)
  return <ClientDesignInstancePage accountId={params.accountId} instanceId={params.instanceId} />;
} 