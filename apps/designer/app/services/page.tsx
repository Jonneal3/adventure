import type { Metadata } from "next";
import { toSubcategorySlug } from "@/utils/slug";
import { headers } from "next/headers";
import ServicesDirectory from "@/components/services/ServicesDirectory";
import { formatSubcategoryLabel } from "@/utils/subcategory";

export const metadata: Metadata = {
  description: "Browse services and subcategories.",
  keywords: [
    "services",
    "subcategories",
    "adventure"
  ],
  openGraph: {
    description: "Browse services and subcategories.",
    title: "Services | adventure",
  },
  robots: { follow: true, index: true },
  title: "Services | adventure",
};

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export default async function ServicesPage() {
  // Server-side fetch needs an absolute URL.
  const h = headers();
  const proto = h.get("x-forwarded-proto") ?? "http";
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const baseUrl = `${proto}://${host}`;

  const res = await fetch(`${baseUrl}/api/public/categories?ts=${Date.now()}`, { cache: 'no-store' });
  const json = res.ok ? await res.json() : { categories: [] };
  const bySlug = new Map<string, string>();
  for (const cat of (json.categories || [])) {
    for (const s of (cat.categories_subcategories || [])) {
      const canonicalSlug = toSubcategorySlug(s.subcategory as string);
      if (!canonicalSlug) continue;
      if (bySlug.has(canonicalSlug)) continue;
      bySlug.set(canonicalSlug, formatSubcategoryLabel(s.subcategory as string));
    }
  }
  const uniqueSubs = Array.from(bySlug.entries())
    .map(([slug, text]) => ({ slug, text }))
    .sort((a, b) => a.text.localeCompare(b.text));

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Subtle "Apple-ish" atmosphere without fighting the content */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,0,0,0.08),transparent)] dark:bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),transparent)] blur-2xl" />
      </div>
      <main className="mx-auto w-full max-w-[1320px] px-4 md:px-8 pt-12 pb-16 md:pt-14 md:pb-20">
        <header className="text-center">
          <div className="mx-auto h-px w-16 bg-border/80" />
          <h1
            className="mx-auto mt-8 max-w-[18ch] text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-[1.02] font-fraunces"
          >
            Find a service.
          </h1>
          <p className="mx-auto mt-5 max-w-[72ch] text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
            A minimal directory of every subcategory page, designed to be scanned quickly.
          </p>
        </header>

        <section className="mt-12">
          {uniqueSubs.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground">No services available.</div>
          ) : (
            <ServicesDirectory items={uniqueSubs} />
          )}
        </section>
      </main>
    </div>
  );
}
