import type { Metadata } from "next";
import Link from "next/link";

import { TYPE_B_PAGES } from "@/config/seo/typeBPages";

export const metadata: Metadata = {
  description: "Guide pages that explain how to reduce friction and revisions in service sales workflows.",
  title: "Guides",
};

export default function GuidesIndexPage() {
  const pages = TYPE_B_PAGES.filter((p) => p.kind === "guide");

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <main className="mx-auto w-full max-w-[900px] px-4 md:px-8 pt-12 pb-16 md:pt-14 md:pb-20">
        <header className="max-w-[76ch]">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.04] font-fraunces">Guides</h1>
          <p className="mt-4 text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
            These guides go deeper on the workflows behind “preview before pricing.”
          </p>
        </header>

        <section className="mt-12 grid gap-4">
          {pages.map((p) => (
            <Link
              key={p.slug}
              href={`/guides/${p.slug}`}
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
