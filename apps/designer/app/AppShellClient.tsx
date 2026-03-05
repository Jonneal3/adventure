"use client";

import { usePathname } from 'next/navigation';
import Navbar from '@/components/layout/Navbar';
import { Providers } from '@/components/Providers';
import AuthGate from '@/components/AuthGate';

export default function AppShellClient({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() || '';
  const isShopify = pathname.startsWith('/shopify');
  const hideNavbar =
    pathname === '/playground' ||
    pathname.startsWith('/playground/') ||
    // Account-scoped playground (paywalled behind account layout)
    /^\/[0-9a-f-]{36}\/playground(\/|$)/i.test(pathname) ||
    // Legacy routes (kept for backwards compatibility)
    pathname.startsWith('/adventure/') ||
    // Legacy plural (kept for backwards compatibility)
    pathname.startsWith('/adventures/') ||
    pathname.startsWith('/form/') ||
    pathname.startsWith('/widget/');

  if (isShopify) {
    return <>{children}</>;
  }

  return (
    <Providers>
      <AuthGate>
        {!hideNavbar ? <Navbar /> : null}
        {children}
      </AuthGate>
    </Providers>
  );
}
