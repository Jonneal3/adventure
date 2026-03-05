import type { Metadata } from "next";
import Link from "next/link";

import { TYPE_B_PAGES } from "@/config/seo/typeBPages";

export const metadata: Metadata = {
  description: "Problem pages that explain buyer friction and the workflows that reduce it.",
  title: "Problems",
};

export default function ProblemsIndexPage() {
  const pages = TYPE_B_PAGES.filter((p) => p.kind === "problem");

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <main className="mx-auto w-full max-w-[900px] px-4 md:px-8 pt-12 pb-16 md:pt-14 md:pb-20">
        <header className="max-w-[76ch]">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.04] font-fraunces">Problems</h1>
          <p className="mt-4 text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
            These pages explain common friction points in service sales and the workflows that address them.
          </p>
        </header>

        <section className="mt-12 grid gap-4">
          {pages.map((p) => (
            <Link
              key={p.slug}
              href={`/problems/${p.slug}`}
              className="rounded-2xl border bg-card p-6 hover:bg-accent/30 transition-colors"
            >
              <div className="text-lg font-semibold">{p.title}</div>
              <div className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.description}</div>
            </Link>
          ))}
        </section>
      </main>
    </div>
  );
}
