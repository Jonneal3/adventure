"use client";

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

// Accept accountId as a prop (or get from context if you have an AccountContext)
export function ClientSideCredits({ accountId }: { accountId: string }) {
  const [credits, setCredits] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const { session } = useAuth();

  useEffect(() => {
    if (!session?.user || !accountId) {
      setLoading(false);
      return;
    }

    const fetchCredits = async () => {
      try {
        const response = await fetch(`/api/user-subscriptions/credits?accountId=${accountId}`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          return;
        }

        const { credits: accountCredits } = await response.json();
        setCredits(accountCredits || 0);
      } catch (error) {} finally {
        setLoading(false);
      }
    };

    fetchCredits();
  }, [session?.user?.id, accountId]);

  // Set up real-time subscription for credit updates
  useEffect(() => {
    if (!session?.user || !accountId) return;

    const channel = supabase
      .channel(`credits_${accountId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `account_id=eq.${accountId}`
        },
        (payload) => {
          if (payload.new && payload.new.ai_credits_balance !== undefined) {
            setCredits(payload.new.ai_credits_balance);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, accountId]);

  if (loading) {
    return <span className="text-sm text-muted-foreground">Loading...</span>;
  }

  return (
    <span className="text-sm text-muted-foreground">
      {credits !== null ? `${credits} credits` : 'No credits'}
    </span>
  );
}
