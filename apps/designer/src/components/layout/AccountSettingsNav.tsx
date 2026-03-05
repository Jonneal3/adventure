"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

type SettingsSection = "accounts" | "billing" | "users";

export function AccountSettingsNav({
  accountId,
  active,
}: {
  accountId: string;
  active: SettingsSection;
}) {
  const items: Array<{ key: SettingsSection; href: string; label: string }> = [
    { key: "accounts", href: `/${accountId}/accounts`, label: "Accounts" },
    { key: "billing", href: `/${accountId}/billing`, label: "Billing" },
    { key: "users", href: `/${accountId}/users`, label: "Team" },
  ];

  return (
    <nav className="inline-flex items-center rounded-full border border-border bg-background p-1">
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={cn(
              "inline-flex h-8 items-center rounded-full px-3 text-xs font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            )}
            aria-current={isActive ? "page" : undefined}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
