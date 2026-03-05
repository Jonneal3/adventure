import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

interface CreditPurchaseStatus {
  paymentIntentId: string;
  amount: number;
  creditsToAdd: number;
  status: 'processing' | 'success' | 'failed';
  message: string;
  timestamp: number;
  accountId: string;
}

export function useCreditPurchaseStatus(accountId?: string) {
  const [pendingPurchases, setPendingPurchases] = useState<CreditPurchaseStatus[]>([]);
  const [completedPurchases, setCompletedPurchases] = useState<CreditPurchaseStatus[]>([]);

  // Add a new pending purchase
  const addPendingPurchase = useCallback((purchase: Omit<CreditPurchaseStatus, 'status' | 'timestamp'>) => {
    const newPurchase: CreditPurchaseStatus = {
      ...purchase,
      status: 'processing',
      timestamp: Date.now()
    };
    
    setPendingPurchases(prev => [...prev, newPurchase]);
    
    // Store in localStorage for persistence
    const stored = JSON.parse(localStorage.getItem('pendingCreditPurchases') || '[]');
    stored.push(newPurchase);
    localStorage.setItem('pendingCreditPurchases', JSON.stringify(stored));
  }, []);

  // Mark purchase as completed
  const markPurchaseCompleted = useCallback((paymentIntentId: string, status: 'success' | 'failed', message?: string) => {
    setPendingPurchases(prev => {
      const updated = prev.filter(p => p.paymentIntentId !== paymentIntentId);
      
      const completed = prev.find(p => p.paymentIntentId === paymentIntentId);
      if (completed) {
        const completedPurchase: CreditPurchaseStatus = {
          ...completed,
          status,
          message: message || (status === 'success' ? 'Payment completed successfully!' : 'Payment failed'),
          timestamp: Date.now()
        };
        
        setCompletedPurchases(prevCompleted => [...prevCompleted, completedPurchase]);
        
        // Remove from localStorage
        const stored = JSON.parse(localStorage.getItem('pendingCreditPurchases') || '[]');
        const filtered = stored.filter((p: any) => p.paymentIntentId !== paymentIntentId);
        localStorage.setItem('pendingCreditPurchases', JSON.stringify(filtered));
      }
      
      return updated;
    });
  }, []);

  // Check if a payment is pending
  const isPaymentPending = useCallback((paymentIntentId: string) => {
    return pendingPurchases.some(p => p.paymentIntentId === paymentIntentId);
  }, [pendingPurchases]);

  // Get the most recent pending purchase
  const getLatestPendingPurchase = useCallback(() => {
    const latest = pendingPurchases.length > 0 ? pendingPurchases[pendingPurchases.length - 1] : null;
    return latest;
  }, [pendingPurchases]);

  // Get the most recent completed purchase
  const getLatestCompletedPurchase = useCallback(() => {
    return completedPurchases.length > 0 ? completedPurchases[completedPurchases.length - 1] : null;
  }, [completedPurchases]);

  // Clear completed purchases
  const clearCompletedPurchases = useCallback(() => {
    setCompletedPurchases([]);
  }, []);

  // Load pending purchases from localStorage on mount
  useEffect(() => {
    const stored = JSON.parse(localStorage.getItem('pendingCreditPurchases') || '[]');
    if (stored.length > 0) {
      // Backfill missing accountId if older entries exist
      const normalized = stored.map((p: any) => ({ accountId: accountId || p.accountId || '', ...p }));
      setPendingPurchases(normalized);
    }
  }, [accountId]);

  // On mount or account change, reconcile stale pending purchases by checking latest balance
  useEffect(() => {
    const reconcile = async () => {
      try {
        if (!accountId) return;
        const res = await fetch(`/api/user-subscriptions/credits?accountId=${accountId}`, { headers: { 'Content-Type': 'application/json' } });
        if (!res.ok) return;
        const data = await res.json();
        const currentBalance = Number(data?.credits ?? 0);

        const stored: CreditPurchaseStatus[] = JSON.parse(localStorage.getItem('pendingCreditPurchases') || '[]');
        if (!Array.isArray(stored) || stored.length === 0) return;

        // Query recent transactions and clear any matching pending items
        let changed = false;
        const txRes = await fetch(`/api/user-subscriptions/credit-transactions?accountId=${accountId}`, { headers: { 'Content-Type': 'application/json' } });
        const txData = txRes.ok ? await txRes.json() : { transactions: [] };
        const transactions: Array<{ type: string; delta_credits: number; created_at: string }>= txData.transactions || [];
        const recentReloads = transactions.filter(t => t.type === 'credit_reload');

        const remaining = stored.filter((p) => {
          if (p.accountId && p.accountId !== accountId) return true;
          const matched = recentReloads.some(t => Math.abs(t.delta_credits) === Math.abs(p.creditsToAdd));
          const tooOld = Date.now() - (p.timestamp || 0) > 90_000;
          if (matched || tooOld) {
            changed = true;
            return false;
          }
          return true;
        });

        if (changed) {
          localStorage.setItem('pendingCreditPurchases', JSON.stringify(remaining));
          setPendingPurchases(remaining);
        }
      } catch {}
    };
    reconcile();
  }, [accountId]);

  // Auto-clear pending purchases after 60 seconds (fallback timeout)
  useEffect(() => {
    if (pendingPurchases.length > 0) {
      const timeout = setTimeout(() => {
        setPendingPurchases([]);
        localStorage.removeItem('pendingCreditPurchases');
      }, 60000); // 60 seconds

      return () => clearTimeout(timeout);
    }
  }, [pendingPurchases]);

  // Set up real-time subscription for credit updates (scoped to account when provided)
  useEffect(() => {
    const channel = supabase
      .channel(`credit_purchase_${accountId || 'all'}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          ...(accountId ? { filter: `account_id=eq.${accountId}` } : {}),
        } as any,
        (payload: RealtimePostgresChangesPayload<Database['public']['Tables']['user_subscriptions']['Row']>) => {
          // Check if any pending purchases for this account match the update
          pendingPurchases.forEach(purchase => {
            if (accountId && purchase.accountId !== accountId) {
              return;
            }
            if (payload?.new && payload?.old) {
              const oldBalance = (payload.old as any)?.ai_credits_balance ?? 0;
              const newBalance = (payload.new as any)?.ai_credits_balance ?? 0;
              const increase = newBalance - oldBalance;
              if (increase >= purchase.creditsToAdd) {
                markPurchaseCompleted(purchase.paymentIntentId, 'success', `${purchase.creditsToAdd} credits added successfully!`);
              }
            }
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [accountId, pendingPurchases, markPurchaseCompleted]);

  return {
    pendingPurchases,
    completedPurchases,
    addPendingPurchase,
    markPurchaseCompleted,
    isPaymentPending,
    getLatestPendingPurchase,
    getLatestCompletedPurchase,
    clearCompletedPurchases
  };
} 