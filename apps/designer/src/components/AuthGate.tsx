"use client";
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useAccount } from '@/contexts/AccountContext';
import { pathNeedsAccountData } from '@/lib/account-paths';
import { FullPageLoader } from '@/components/ui/full-page-loader';

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading: authLoading, session } = useAuth();
  const { accountsLoaded } = useAccount();
  const pathname = usePathname() || '';
  const shouldBlockForAccounts = pathNeedsAccountData(pathname);

  if (shouldBlockForAccounts && (authLoading || (session?.user && !accountsLoaded))) {
    return <FullPageLoader height="screen" />;
  }

  // If not loading, always render children (even when there are zero accounts)
  return <>{children}</>;
}
