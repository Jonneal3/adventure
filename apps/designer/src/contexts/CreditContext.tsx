"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { useAccount } from './AccountContext';
import { supabase } from '@/lib/supabase';

interface CreditContextType {
  credits: number;
  isLoading: boolean;
  refreshCredits: () => Promise<void>;
  updateCredits: (newBalance: number) => void;
}

const CreditContext = createContext<CreditContextType | undefined>(undefined);

export const useCredits = () => {
  const context = useContext(CreditContext);
  if (!context) {
    throw new Error('useCredits must be used within a CreditProvider');
  }
  return context;
};

interface CreditProviderProps {
  children: React.ReactNode;
}

export const CreditProvider: React.FC<CreditProviderProps> = ({ children }) => {
  const { session } = useAuth();
  const { currentAccount } = useAccount();
  const [credits, setCredits] = useState<number>(0);
  const [isLoading, setIsLoading] = useState(false);

  const accountId = currentAccount?.id ?? null;
  const accessToken = session?.access_token ?? null;
  const userId = session?.user?.id ?? null;

  const fetchCredits = useCallback(async () => {
    if (!userId || !accountId) {
      setCredits(0);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/user-subscriptions/credits?accountId=${accountId}`, {
        headers: {
          ...(accessToken ? { 'Authorization': `Bearer ${accessToken}` } : {}),
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const { credits: currentCredits } = await response.json();
        setCredits(currentCredits || 0);
      } else {
        setCredits(0);
      }
    } catch (error) {
      setCredits(0);
    } finally {
      setIsLoading(false);
    }
  }, [accessToken, accountId, userId]);

  const refreshCredits = useCallback(async () => {
    await fetchCredits();
  }, [fetchCredits]);

  const updateCredits = useCallback((newBalance: number) => {
    setCredits(Math.max(0, newBalance)); // Never allow negative credits
  }, []);

  // Fetch credits when session or account changes
  useEffect(() => {
    fetchCredits();
  }, [fetchCredits]);

  // Subscribe to realtime updates instead of polling
  useEffect(() => {
    if (!session?.user || !currentAccount?.id) return;

    const channel = supabase
      .channel(`credit_ctx_${currentAccount.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'user_subscriptions',
          filter: `account_id=eq.${currentAccount.id}`
        },
        (payload) => {
          if (payload.new && payload.new.ai_credits_balance !== undefined) {
            setCredits(Math.max(0, payload.new.ai_credits_balance));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [session?.user?.id, currentAccount?.id]);

  const value: CreditContextType = {
    credits,
    isLoading,
    refreshCredits,
    updateCredits,
  };

  return (
    <CreditContext.Provider value={value}>
      {children}
    </CreditContext.Provider>
  );
}; 
