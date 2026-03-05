import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { LOCAL_SEO_CITIES, LOCAL_SEO_SERVICES, toCityStateSlug } from "@/config/seo/localServicePages";
import { getTypeBPage, TYPE_B_PAGES } from "@/config/seo/typeBPages";

type Params = { slug: string };

function getExampleLocalPageLinks(max = 3) {
  const links: { label: string; href: string }[] = [];
  for (const service of LOCAL_SEO_SERVICES) {
    for (const city of LOCAL_SEO_CITIES) {
      const cityState = toCityStateSlug(city.city, city.state);
      links.push({
        href: `/services/${service.slug}/ai-visualization/${cityState}`,
        label: `${service.name} · ${city.city}, ${city.state}`,
      });
      if (links.length >= max) return links;
    }
  }
  return links;
}

export function generateStaticParams() {
  return TYPE_B_PAGES.filter((p) => p.kind === "problem").map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const page = getTypeBPage("problem", params.slug);
  if (!page) return { robots: { follow: false, index: false } };
  return {
    description: page.description,
    robots: { follow: true, index: true },
    title: page.title,
  };
}

export default function ProblemPage({ params }: { params: Params }) {
  const page = getTypeBPage("problem", params.slug);
  if (!page) notFound();

  const examples = getExampleLocalPageLinks(3);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <main className="mx-auto w-full max-w-[900px] px-4 md:px-8 pt-12 pb-16 md:pt-14 md:pb-20">
        <header className="max-w-[76ch]">
          <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Problem</p>
          <h1 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight leading-[1.04] font-fraunces">
            {page.title}
          </h1>
          <p className="mt-4 text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">{page.lede}</p>

          <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href="/playground">
                Try a visual preview <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link href="/contact">Add this to your site</Link>
            </Button>
          </div>
        </header>

        {page.sections.map((s) => (
          <section key={s.heading} className="mt-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">{s.heading}</h2>
            <div className="mt-4 space-y-3 text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
              {s.body.map((p) => (
                <p key={p}>{p}</p>
              ))}
            </div>
          </section>
        ))}

        {page.related && page.related.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">Related</h2>
            <ul className="mt-4 space-y-2 text-[15px] md:text-[16px] text-muted-foreground">
              {page.related.map((r) => (
                <li key={r.href}>
                  <Link className="underline underline-offset-2 hover:text-foreground" href={r.href}>
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {examples.length > 0 ? (
          <section className="mt-14">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">Local examples</h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              These are examples of the local (Type A) pages that connect to this topic.
            </p>
            <ul className="mt-4 space-y-2 text-[15px] md:text-[16px] text-muted-foreground">
              {examples.map((x) => (
                <li key={x.href}>
                  <Link className="underline underline-offset-2 hover:text-foreground" href={x.href}>
                    {x.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </main>
    </div>
  );
}
