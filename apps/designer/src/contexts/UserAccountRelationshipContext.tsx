// UserAccountRelationshipContext.tsx
// Context for managing user-account relationships (user_accounts table) for a given account.

"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '@/lib/supabase';
import type { Database } from '@/types/database';

// Type for a row in the user_accounts table
export type UserAccount = Database['public']['Tables']['user_accounts']['Row'];

interface UserAccountRelationshipContextType {
  userAccounts: UserAccount[];
  loading: boolean;
  error: string | null;
  refreshUserAccounts: (accountId: string) => Promise<void>;
}

const UserAccountRelationshipContext = createContext<UserAccountRelationshipContextType | undefined>(undefined);

export function UserAccountRelationshipProvider({ children }: { children: ReactNode }) {
  const { session, user } = useAuth();
  const [userAccounts, setUserAccounts] = useState<UserAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user_accounts for a given accountId
  const refreshUserAccounts = async (accountId: string) => {
    if (!session?.user || !accountId || !supabase) {
      setUserAccounts([]);
      setError(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error } = await supabase
      .from('user_accounts')
      .select('*')
      .eq('account_id', accountId);
    if (error) {
      setUserAccounts([]);
      setError(error.message);
    } else {
      setUserAccounts(data || []);
      // Add logging for user state changes
      // console.log('[UserAccountRelationshipContext] setUserAccounts:', data || []);
      setError(null);
    }
    setLoading(false);
  };

  // No auto-fetch; consumer must call refreshUserAccounts(accountId)

  const value: UserAccountRelationshipContextType = {
    userAccounts,
    loading,
    error,
    refreshUserAccounts,
  };

  return (
    <UserAccountRelationshipContext.Provider value={value}>
      {children}
    </UserAccountRelationshipContext.Provider>
  );
}

export function useUserAccountRelationship() {
  const ctx = useContext(UserAccountRelationshipContext);
  if (!ctx) throw new Error('useUserAccountRelationship must be used within a UserAccountRelationshipProvider');
  return ctx;
} 