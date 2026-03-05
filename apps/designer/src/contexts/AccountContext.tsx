"use client";

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { useParams, usePathname } from 'next/navigation';
import { useUserAccountRelationship } from './UserAccountRelationshipContext';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { pathNeedsAccountData } from '@/lib/account-paths';

interface Account {
  created_at: string;
  description: string | null;
  id: string;
  name: string;
  slug: string;
  updated_at: string;
}

interface UserAccount {
  account_id: string;
  created_at: string;
  id: string;
  updated_at: string;
  user_id: string;
  user_status: string; // Accept string from Supabase, cast as needed
}

interface AccountContextType {
  accountInstances: any[];
  accounts: Account[];
  accountsLoaded: boolean;
  accountUsers: UserAccount[];
  currentAccount: Account | null;
  loadingAccountInstances: boolean;
  loadingAccounts: boolean;
  loadingAccountUsers: boolean;
  refreshAccountInstances: () => Promise<void>;
  refreshAccounts: () => Promise<void>;
  refreshAccountUsers: () => Promise<void>;
  setCurrentAccount: (account: Account | null) => void;
  userAccounts: any[]; // Add this to match the context value
}

const AccountContext = createContext<AccountContextType | undefined>(undefined);

// Declare the global property for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var __hasFetchedAccounts: boolean | undefined;
  // eslint-disable-next-line no-var
  var __isFetchingAccounts: boolean | undefined;
}
// 🔒 global fetch guard to prevent re-fetching across remounts
if (typeof globalThis.__hasFetchedAccounts === 'undefined') globalThis.__hasFetchedAccounts = false;
if (typeof globalThis.__isFetchingAccounts === 'undefined') globalThis.__isFetchingAccounts = false;

export function AccountProvider({ children }: { children: React.ReactNode }) {
  // console.log('[AccountProvider] MOUNT');
  const { session } = useAuth();
  const supabase = useSupabaseClientWithAuth();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [accountUsers, setAccountUsers] = useState<UserAccount[]>([]);
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingAccountUsers, setLoadingAccountUsers] = useState(false);
  const [accountInstances, setAccountInstances] = useState<any[]>([]);
  const [loadingAccountInstances, setLoadingAccountInstances] = useState(false);
  const [userAccounts, setUserAccounts] = useState<any[]>([]);
  const params = useParams();
  const pathname = usePathname() || '';
  const urlAccountId = params?.accountId as string | undefined;
  const { refreshUserAccounts } = useUserAccountRelationship();

  /**
   * Explicitly fetch accounts from the API and update state.
   * Only call this after login or after a successful account creation.
   * No auto-fetching on mount or session change.
   */
  const refreshAccounts = useCallback(async () => {
    if (!session?.user) {
      setAccounts([]);
      setUserAccounts([]);
      setCurrentAccount(null);
      setAccountsLoaded(false);
      return;
    }
    // Prevent multiple simultaneous API calls
    if (globalThis.__isFetchingAccounts) {
      return;
    }
    globalThis.__isFetchingAccounts = true;
    setLoadingAccounts(true);

    try {
      const url = '/api/accounts/list';
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        }
      });
      if (!response.ok) {
        throw new Error('Failed to fetch accounts');
      }

      const responseData = await response.json();
      const nextUserAccounts = Array.isArray(responseData?.userAccounts)
        ? responseData.userAccounts
        : [];

      setUserAccounts([...nextUserAccounts]);

      const accountData = nextUserAccounts
        .map((ua: any) => ua?.accounts)
        .filter(Boolean);

      setAccounts(accountData);

      const nextAccount =
        (urlAccountId ? accountData.find((acc: any) => acc?.id === urlAccountId) : null) ??
        (currentAccount ? accountData.find((acc: any) => acc?.id === currentAccount.id) : null) ??
        (accountData[0] ?? null);

      if (nextAccount) {
        setCurrentAccount(prev => (prev?.id === nextAccount.id
          ? prev
          : {
              ...nextAccount,
              description: nextAccount.description ?? '',
            }));
      } else {
        setCurrentAccount(null);
      }
    } catch {
      // Keep existing state on refresh failures once we've bootstrapped at least once.
      if (!accountsLoaded) {
        setAccounts([]);
        setUserAccounts([]);
        setCurrentAccount(null);
      }
    } finally {
      setLoadingAccounts(false);
      setAccountsLoaded(true);
      globalThis.__isFetchingAccounts = false;
    }
  }, [session?.user?.id, session?.access_token, urlAccountId, currentAccount?.id, accountsLoaded]);

  /**
   * Clear all account state (optional, for logout or reset scenarios)
   */
  const resetAccounts = useCallback(() => {
    setAccounts([]);
    setUserAccounts([]);
    setCurrentAccount(null);
    setAccountsLoaded(false);
  }, []);

  // Fetch all users for the current account (use cached userAccounts)
  const refreshAccountUsers = useCallback(async () => {
    if (!session?.user || !currentAccount) {
      setAccountUsers([]);
      setLoadingAccountUsers(false);
      return;
    }
    setLoadingAccountUsers(true);
    try {
      const currentAccountUsers = (userAccounts || []).filter((ua: any) => ua.account_id === currentAccount.id);
      setAccountUsers(currentAccountUsers as UserAccount[]);
    } catch {
      setAccountUsers([]);
    } finally {
      setLoadingAccountUsers(false);
    }
  }, [session?.user?.id, currentAccount?.id, userAccounts]);

  // Fetch all instances for the current account
  const refreshAccountInstances = useCallback(async () => {
    if (!session?.user || !currentAccount || !supabase) {
      setAccountInstances([]);
      setLoadingAccountInstances(false);
      return;
    }
    setLoadingAccountInstances(true);
    const { data, error } = await supabase
      .from('instances')
      .select('*')
      .eq('account_id', currentAccount.id);
    if (!error && data) setAccountInstances(data);
    setLoadingAccountInstances(false);
  }, [session?.user?.id, currentAccount?.id, supabase]);

  // Handle session changes - reset accounts when session is lost, fetch once when restored
  const hasAutoFetchedRef = useRef(false);
  useEffect(() => {
    const isShopifyPath = pathname.startsWith('/shopify');
    const shouldBootstrapAccounts = pathNeedsAccountData(pathname);
    if (!session?.user) {
      resetAccounts();
      hasAutoFetchedRef.current = false;
      return;
    }
    if (isShopifyPath) {
      // Never auto-fetch via API inside Shopify iframe; client-side pages fetch directly via Supabase
      return;
    }
    if (!shouldBootstrapAccounts) {
      // Keep public/marketing pages fast: don't block the app boot by loading account data.
      return;
    }
    if (!hasAutoFetchedRef.current && !accountsLoaded && !loadingAccounts) {
      hasAutoFetchedRef.current = true;
      refreshAccounts();
    }
  }, [pathname, session?.user?.id, session, accountsLoaded, loadingAccounts, resetAccounts, refreshAccounts]);

  // Keep currentAccount in sync with the URL param when available
  useEffect(() => {
    if (!urlAccountId || !userAccounts || userAccounts.length === 0) return;
    const isMismatch = !currentAccount || currentAccount.id !== urlAccountId;
    if (isMismatch) {
      const match = userAccounts.find((ua: any) => ua.account_id === urlAccountId);
      if (match && match.accounts) {
        const acc = match.accounts;
        setCurrentAccountWithLog({
          created_at: acc.created_at ?? '',
          description: acc.description ?? '',
          id: acc.id,
          name: acc.name,
          slug: acc.slug,
          updated_at: acc.updated_at ?? ''
        });
      }
    }
  }, [urlAccountId, userAccounts, currentAccount?.id]);

  // Cleanup global flags on unmount
  useEffect(() => {
    return () => {
      globalThis.__isFetchingAccounts = false;
    };
  }, []);

  // Wrap setCurrentAccount to log when it is called
  const setCurrentAccountWithLog = (account: Account | null) => {
    // Only update if the account is different
    if (
      (account && currentAccount && account.id === currentAccount.id) ||
      (!account && !currentAccount)
    ) {
      return;
    }
    setCurrentAccount(account);
    if (account?.id) {
      refreshUserAccounts(account.id);
    }
  };

  const value: AccountContextType & { resetAccounts: () => void } = {
    accountInstances,
    accounts,
    accountsLoaded,
    accountUsers,
    currentAccount,
    loadingAccountInstances,
    loadingAccounts,
    loadingAccountUsers,
    refreshAccountInstances,
    refreshAccounts,
    refreshAccountUsers,
    resetAccounts, // expose for manual reset after mutation
    setCurrentAccount: setCurrentAccountWithLog,
    userAccounts, // Expose userAccounts for status info
  };

  return (
    <AccountContext.Provider value={value}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error('useAccount must be used within an AccountProvider');
  return ctx;
} 
