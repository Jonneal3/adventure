"use client";

import Link from "next/link";
import * as React from "react";

import { cn } from "@/lib/utils";

type AuthShellProps = {
  backHref?: string;
  backLabel?: string;
  children: React.ReactNode;
  className?: string;
  description?: string;
  footer?: React.ReactNode;
  title: string;
};

export default function AuthShell({
  backHref = "/",
  backLabel = "Back to home",
  children,
  className,
  description,
  footer,
  title,
}: AuthShellProps) {
  return (
    <main className="min-h-screen bg-background px-4 py-12">
      <div className={cn("mx-auto w-full max-w-sm", className)}>
        <div className="mb-8">
          <Link
            href={backHref}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            ← {backLabel}
          </Link>
        </div>

        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </header>

        <section className="rounded-xl border border-border/60 bg-card p-5 shadow-sm">
          {children}
        </section>

        {footer ? (
          <footer className="mt-6 text-center text-sm text-muted-foreground">
            {footer}
          </footer>
        ) : null}
      </div>
    </main>
  );
}
