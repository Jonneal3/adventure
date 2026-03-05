"use client";

import * as React from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { AccountSettingsNav } from "@/components/layout/AccountSettingsNav";

export function SettingsShell({
  accountId,
  active,
  actions,
  children,
  description,
  title,
}: {
  accountId: string;
  active: "accounts" | "billing" | "users";
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description={description}
        actions={actions}
        className="mb-4"
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <AccountSettingsNav accountId={accountId} active={active} />
      </div>

      <div className="min-w-0">{children}</div>
    </div>
  );
}

