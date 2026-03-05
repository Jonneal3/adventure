"use client";

import { useAuth } from '@/contexts/AuthContext';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useSupabaseClientWithAuth } from '@/hooks/useSupabaseClientWithAuth';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { ThemeToggle } from '@/components/homepage/theme-toggle';
import { Check, CreditCard, LogOut, User as UserIcon, Building2, Users } from 'lucide-react';
import { useCredits } from '@/contexts/CreditContext';
import ServicesDropdown from '@/components/homepage/ServicesDropdown';
import { primeAccountUsers } from '@/lib/account-users-cache';
import { primeBillingSnapshot } from '@/lib/billing-snapshot-cache';
import { setAccountSubscriptionStatusCache } from '@/hooks/use-account-subscription';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { AvatarIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import { useAccount } from '@/contexts/AccountContext';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

function getInitials(name: string | null | undefined) {
  const trimmed = (name || '').trim();
  if (!trimmed) return 'A';
  const parts = trimmed.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const last = (parts.length > 1 ? parts[parts.length - 1]?.[0] : '') || '';
  return (first + last).toUpperCase();
}

function getRelationshipStatusLabel(status: string | null | undefined) {
  const normalized = (status || '').toLowerCase();
  if (normalized === 'accepted') return 'Active';
  if (normalized === 'invited') return 'Invited';
  return status || '';
}

function NavbarLink({
  badge,
  className,
  disabled,
  href,
  isActive,
  label,
  onClick,
  prefetch,
}: {
  badge?: string;
  className?: string;
  disabled?: boolean;
  href: string;
  isActive?: boolean;
  label: string;
  onClick?: (e: React.MouseEvent<HTMLAnchorElement>) => void;
  prefetch?: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
        disabled
          ? 'text-muted-foreground/70 cursor-not-allowed'
          : isActive
          ? 'bg-accent/70 text-foreground'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent/50',
        className,
      )}
      aria-current={isActive ? 'page' : undefined}
      aria-disabled={disabled ? true : undefined}
      onClick={onClick}
      prefetch={prefetch ?? !disabled}
    >
      <span className="inline-flex items-center gap-2">
        <span>{label}</span>
        {badge ? (
          <span className="rounded-full border border-border bg-background/60 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
            {badge}
          </span>
        ) : null}
      </span>
    </Link>
  );
}

export default function Navbar() {
  const { session, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { toast } = useToast();
  const supabase = useSupabaseClientWithAuth();
  const [mounted, setMounted] = useState(false);
  // REMOVE local userAccounts and currentAccount state
  // const [userAccounts, setUserAccounts] = useState<any[]>([]);
  // const [currentAccount, setCurrentAccount] = useState<any>(null);
  const { currentAccount, setCurrentAccount: setGlobalCurrentAccount, userAccounts } = useAccount();
  const { credits } = useCredits();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // REMOVE fetch to /api/accounts/list and useEffect that loads user accounts
  // Use context values only

  // Determine navbar state based on pathname and auth
  const isDesignPage = mounted && pathname?.includes('/designer-instances/') && pathname?.split('/').length > 2;
  const isAccountBasedPage = mounted && pathname?.match(/^\/[^\/]+\/(designer-instances|billing|contact|users|accounts)/); // /[accountId]/designer-instances, /[accountId]/billing, etc.
  const isAuthenticatedPage = mounted && (pathname?.startsWith('/designer-instances') || 
                              pathname?.startsWith('/billing') || 
                              pathname?.startsWith('/accounts') ||
                              pathname?.startsWith('/new-account') ||
                              isAccountBasedPage);
  const isAuthPage = mounted && pathname?.startsWith('/auth');
  const isSubscriptionPage = mounted && /^\/[a-f0-9\-]+\/subscription(\/|$)/.test(pathname || '');
  const isAccountsPage = mounted && pathname === '/accounts';

  // Show account switcher on authenticated pages when user has multiple accounts
  const shouldShowAccountSwitcher = mounted && session && user && userAccounts.length > 1 && !isAuthPage && !isDesignPage && !isSubscriptionPage && isAuthenticatedPage;
  // console.log('Navbar: isAccountPage', isAccountPage, 'userAccounts.length', userAccounts.length);

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      router.push('/auth');
    } catch (error) {
      console.error('Error signing out:', error);
      toast({
        description: 'Failed to sign out. Please try again.',
        title: 'Error',
        variant: 'destructive',
      });
    }
  };

  const handleAccountSwitch = (userAccount: any) => {
    if (!session?.user?.id) {
      router.push('/auth');
      return;
    }

    const acc = userAccount.accounts;
    const fullAccount = {
      account_id: userAccount.account_id,
      created_at: acc.created_at ?? '',
      description: acc.description ?? '',
      id: acc.id,
      name: acc.name,
      slug: acc.slug,
      updated_at: acc.updated_at ?? '',
      user_status: userAccount.user_status,
    };
    setGlobalCurrentAccount(fullAccount);

    const nextAccountId = userAccount.account_id as string;

    const prefetchRoutes = [
      `/${nextAccountId}/designer-instances`,
      `/${nextAccountId}/accounts`,
      `/${nextAccountId}/billing`,
      `/${nextAccountId}/users`,
    ];
    for (const href of prefetchRoutes) {
      router.prefetch(href);
    }

    void fetch('/api/stripe/plans').catch(() => null);
    void fetch(`/api/user-subscriptions/credits?accountId=${nextAccountId}`).catch(() => null);
    primeAccountUsers(nextAccountId);
    primeBillingSnapshot(session.user.id, nextAccountId);

    (async () => {
      try {
        const res = await fetch('/api/accounts/subscription-status', {
          body: JSON.stringify({ accountId: nextAccountId }),
          headers: { 'Content-Type': 'application/json' },
          method: 'POST',
        });

        if (res.status === 401) {
          router.push('/auth');
          return;
        }
        if (res.status === 403) {
          router.push('/accounts');
          return;
        }

        const data = await res.json().catch(() => ({}));
        const route = (data as any)?.route as string | null;
        if (route) {
          setAccountSubscriptionStatusCache(session.user.id, nextAccountId, {
            account: (data as any)?.account ?? null,
            checkedAt: Date.now(),
            ownerUserId: (data as any)?.ownerUserId ?? null,
            reason: (data as any)?.reason ?? null,
            route: route as any,
            subscription: (data as any)?.subscription ?? null,
            userRole: (data as any)?.userRole ?? null,
          });

          if (route === 'active') {
            router.push(`/${nextAccountId}/designer-instances`);
            return;
          }
          router.push(`/${nextAccountId}/subscription/${route}`);
          return;
        }
      } catch {}

      router.push(`/${nextAccountId}`);
    })();
  };

  // Don't render anything until mounted to prevent hydration mismatch
  if (!mounted) {
    return null;
  }

  // Minimal navbar for subscription routes
  if (isSubscriptionPage) {
    return (
      <header className="sticky top-0 z-[100] w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-background/80">
          <div className="container flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center text-foreground hover:text-primary transition-colors"
            prefetch={true}
          >
            <span className="text-3xl font-extrabold lowercase tracking-tight font-fraunces">adventure</span>
          </Link>
          {session && (
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Log out
            </Button>
          )}
        </div>
      </header>
    );
  }

  // Minimal navbar for /accounts page
  if (isAccountsPage) {
    return (
      <header className="sticky top-0 z-[100] w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-background/80">
        <div className="container flex h-16 items-center justify-between px-6">
          <Link
            href="/"
            className="flex items-center text-foreground hover:text-primary transition-colors"
            prefetch={true}
          >
            <span className="text-3xl font-extrabold lowercase tracking-tight font-fraunces">adventure</span>
          </Link>
          {session && (
            <Button variant="outline" size="sm" onClick={handleSignOut}>
              Log out
            </Button>
          )}
        </div>
      </header>
    );
  }

  // Don't show navbar on auth pages or design pages
  if (isAuthPage || isDesignPage) {
    return null;
  }

  // Authenticated navbar (for dashboard pages)
  if (session && user && isAuthenticatedPage) {
    const designerHref = currentAccount ? `/${currentAccount.id}/designer-instances` : '/accounts';
    const isDesignerActive =
      !!currentAccount && !!pathname && pathname.startsWith(`/${currentAccount.id}/designer-instances`);

    return (
      <header className="sticky top-0 z-[100] w-full bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 dark:bg-background/80">
        <div className="container flex h-16 items-center justify-between px-6">
          <Link
            href={currentAccount ? `/${currentAccount.id}/accounts` : "/accounts"}
            className="flex items-center text-foreground hover:text-primary transition-colors"
            prefetch={true}
          >
            <span className="text-3xl font-extrabold lowercase tracking-tight font-fraunces">adventure</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 ml-4">
            <NavbarLink href={designerHref} label="Adventures" isActive={isDesignerActive} />
          </nav>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="hidden sm:flex md:hidden items-center gap-1">
              {currentAccount && (
                <NavbarLink href={designerHref} label="Adventures" isActive={isDesignerActive} className="px-2" />
              )}
            </div>

            {/* Credits Display - account-based */}
            {currentAccount && (
              <div className="hidden sm:inline-flex h-8 items-center rounded-full border border-border bg-background/60 px-2.5 text-xs text-muted-foreground">
                <span className="font-medium tabular-nums text-foreground">{credits}</span>
                <span className="ml-1">credits</span>
              </div>
            )}

            {/* Account Switcher - show when user has multiple accounts */}
            {shouldShowAccountSwitcher && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-full border border-border bg-background/60 px-2.5 flex items-center gap-2 hover:bg-accent/60"
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground truncate max-w-[160px]">
                      {currentAccount?.name}
                    </span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-72 z-[101] bg-popover border-border p-1">
                  <DropdownMenuLabel className="px-2 py-1.5 text-xs text-muted-foreground">
                    Select account
                  </DropdownMenuLabel>
                  {userAccounts.map((userAccount) => {
                    const relationshipStatus = (userAccount.status || '').toLowerCase();
                    const isAccepted = relationshipStatus === 'accepted';
                    const isCurrent = userAccount.account_id === currentAccount?.id;
                    const statusLabel = getRelationshipStatusLabel(userAccount.status);
                    const roleLabel = userAccount.user_status ? String(userAccount.user_status) : null;

                    return (
                      <DropdownMenuItem
                        key={userAccount.account_id}
                        onClick={isAccepted ? () => handleAccountSwitch(userAccount) : undefined}
                        disabled={!isAccepted}
                        className={cn(
                          'cursor-pointer rounded-md px-2 py-2 focus:bg-accent/50',
                          !isAccepted && 'cursor-not-allowed opacity-70',
                        )}
                      >
                        <div className="flex w-full items-center gap-3">
                          <Avatar className="h-7 w-7">
                            <AvatarFallback className="bg-muted text-[11px] text-muted-foreground">
                              {getInitials(userAccount.accounts?.name)}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {userAccount.accounts?.name}
                              </span>
                              {isCurrent ? <Check className="h-4 w-4 text-primary" /> : null}
                            </div>
                            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
                              {roleLabel ? <span className="capitalize">{roleLabel}</span> : null}
                              {roleLabel && statusLabel ? (
                                <span className="h-1 w-1 rounded-full bg-muted-foreground/50" aria-hidden="true" />
                              ) : null}
                              {statusLabel ? (
                                <span className={cn(statusLabel === 'Active' ? 'text-emerald-600 dark:text-emerald-400' : undefined)}>
                                  {statusLabel}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator className="my-1 bg-border" />
                  <DropdownMenuItem
                    onClick={() => router.push('/accounts')}
                    className="cursor-pointer rounded-md px-2 py-2 text-muted-foreground focus:bg-accent/50"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none">+</span>
                      <span className="text-sm">Manage accounts</span>
                    </div>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}

            <ThemeToggle />

            {/* Profile/User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full border border-border bg-background/60 p-0 text-muted-foreground transition-colors hover:bg-accent/60 hover:text-foreground"
                >
                  <AvatarIcon className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 z-[101] bg-popover border-border">
                <DropdownMenuLabel className="text-primary text-left overflow-hidden text-ellipsis font-medium">
                  {user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-border" />
                <Link href={currentAccount ? `/${currentAccount.id}/accounts` : "/accounts"}>
                  <Button
                    className="w-full text-left text-foreground justify-start font-normal text-sm"
                    variant="ghost"
                    size="sm"
                  >
                    <UserIcon className="mr-2 h-4 w-4" />
                    {currentAccount ? "Account Settings" : "My Accounts"}
                  </Button>
                </Link>
                {currentAccount && (
                  <Link href={`/${currentAccount.id}/billing`}>
                    <Button
                      className="w-full text-left text-foreground justify-start font-normal text-sm"
                      variant="ghost"
                      size="sm"
                    >
                      <CreditCard className="h-4 w-4 mr-2" />
                      Billing
                    </Button>
                  </Link>
                )}
                {currentAccount && (
                  <Link href={`/${currentAccount.id}/users`}>
                    <Button
                      className="w-full text-left text-foreground justify-start font-normal text-sm"
                      variant="ghost"
                      size="sm"
                    >
                      <Users className="h-4 w-4 mr-2" />
                      Team Members
                    </Button>
                  </Link>
                )}
                {!currentAccount && (
                  <Link href="/accounts">
                    <Button
                      className="w-full text-left text-foreground justify-start font-normal text-sm"
                      variant="ghost"
                      size="sm"
                    >
                      <CreditCard className="mr-2 h-4 w-4" />
                      Billing & Credits
                    </Button>
                  </Link>
                )}
                <DropdownMenuSeparator className="bg-border" />
                <Button
                  onClick={handleSignOut}
                  className="w-full text-left text-foreground font-normal text-sm"
                  variant="ghost"
                  size="sm"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </Button>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>
    );
  }

  // Public navbar (homepage, pricing, etc.)
  return (
    <header className="sticky top-0 z-[100] w-full bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 md:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Logo */}
          <Link 
            href="/" 
            className="flex items-center group"
          >
            <span className="text-gray-900 dark:text-white text-3xl md:text-4xl font-extrabold lowercase tracking-tight font-fraunces">
              adventure
            </span>
          </Link>
          
          {/* Navigation */}
          <nav className="hidden md:flex items-center gap-1 ml-4">
            <ServicesDropdown isActive={pathname === '/services' || pathname?.startsWith('/services/')} />
            <NavbarLink href="/pricing" label="Pricing" isActive={pathname === '/pricing'} />
            {/*
              Playground link temporarily hidden.
              We moved `/playground` behind auth/subscription gating via account-scoped route.
            */}
            {/* <NavbarLink href="/playground" label="Playground" isActive={pathname === "/playground"} /> */}
          </nav>

          {/* Right side actions */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex md:hidden items-center gap-1">
              <NavbarLink href="/pricing" label="Pricing" isActive={pathname === '/pricing'} className="px-2" />
              {/* <NavbarLink href="/playground" label="Playground" isActive={pathname === "/playground"} className="px-2" /> */}
            </div>
            <ThemeToggle />
            
            {/* Sign In */}
            <Link 
              href="/auth" 
              className={cn(
                'hidden sm:inline-flex items-center rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                'text-muted-foreground hover:text-foreground',
              )}
            >
              Sign In
            </Link>
            
            {/* CTA Button */}
            <Link href="/auth">
              <Button 
                className="rounded-full text-sm px-4 shadow-sm hover:shadow-md"
              >
                Get Started
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
} 
