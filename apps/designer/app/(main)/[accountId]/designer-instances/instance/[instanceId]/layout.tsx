export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const fetchCache = 'force-no-store';
export const runtime = 'nodejs';

import React from 'react';

export default function InstanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>{children}</>
  );
}


