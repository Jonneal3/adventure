import React from 'react';
import { MenuPrefetch } from './MenuPrefetch';

export default function MenuLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { accountId: string };
}) {
  return (
    <div className="min-h-screen bg-transparent">
      <div className="container max-w-7xl mx-auto px-6 py-8">
        <MenuPrefetch accountId={params.accountId} />
        {children}
      </div>
    </div>
  );
}
