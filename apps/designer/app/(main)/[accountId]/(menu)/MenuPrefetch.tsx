"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function MenuPrefetch({ accountId }: { accountId: string }) {
  const router = useRouter();

  useEffect(() => {
    if (!accountId) return;
    const routes = [
      `/${accountId}/accounts`,
      `/${accountId}/billing`,
      `/${accountId}/users`,
      `/${accountId}/designer-instances`,
    ];
    for (const href of routes) {
      router.prefetch(href);
    }
  }, [accountId, router]);

  return null;
}

