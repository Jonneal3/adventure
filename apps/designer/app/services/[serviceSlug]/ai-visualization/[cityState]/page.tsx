import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import LocalServiceStructuredData from "@/components/seo/LocalServiceStructuredData";
import {
  getLocalSeoCityBySlug,
  getLocalSeoServiceBySlug,
  isLocalSeoPageIndexable,
} from "@/config/seo/localServicePages";
import { getUsCity20kBySlug } from "@/config/seo/usCities20k";
import {
  buildLocalFaqs,
  buildLocalMarketContext,
  buildLocalServiceHeroSubhead,
  buildLocalServiceHeroTitle,
  buildLocalServiceMetadata,
  pickExampleScenario,
  toGenericLocalSeoCity,
} from "@/lib/seo/localServiceSeo";

type Params = { serviceSlug: string; cityState: string };

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const service = getLocalSeoServiceBySlug(params.serviceSlug);
  const indexedCity = getLocalSeoCityBySlug(params.cityState);
  const dbCity = getUsCity20kBySlug(params.cityState);
  const city = indexedCity ? indexedCity : dbCity ? toGenericLocalSeoCity(dbCity.city, dbCity.state) : null;
  if (!service || !city) return { robots: { follow: false, index: false } };
  const indexable = Boolean(indexedCity) && isLocalSeoPageIndexable(service.slug, params.cityState);
  return buildLocalServiceMetadata({ city, indexable, service });
}

export default async function LocalServiceAiVisualizationPage({ params }: { params: Params }) {
  const service = getLocalSeoServiceBySlug(params.serviceSlug);
  const indexedCity = getLocalSeoCityBySlug(params.cityState);
  const dbCity = getUsCity20kBySlug(params.cityState);
  const city = indexedCity ? indexedCity : dbCity ? toGenericLocalSeoCity(dbCity.city, dbCity.state) : null;
  if (!service || !city) notFound();

  const heroTitle = buildLocalServiceHeroTitle(service, city);
  const heroSubhead = buildLocalServiceHeroSubhead(service);
  const marketContext = buildLocalMarketContext(service, city);
  const faqs = buildLocalFaqs(service, city);
  const exampleScenario = pickExampleScenario(service, city);

  const primary = service.useCases.find((u) => u.kind === "primary");
  const secondary = service.useCases.find((u) => u.kind === "secondary");

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <main className="mx-auto w-full max-w-[1100px] px-4 md:px-8 pt-12 pb-16 md:pt-14 md:pb-20">
        <LocalServiceStructuredData service={service} city={city} faqs={faqs} />

        {/* 1) Declarative hero */}
        <header className="max-w-[76ch]">
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight leading-[1.04] font-fraunces">
            {heroTitle}
          </h1>
          <p className="mt-4 text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
            {heroSubhead}
          </p>
          <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href={`/playground?service=${encodeURIComponent(service.slug)}`}>
                Try a visual preview <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link href="/contact">Add this to your site</Link>
            </Button>
          </div>
	          <p className="mt-3 text-xs text-muted-foreground">
	            Looking for the workflow?{" "}
	            <Link
	              href="/workflows/visual-pre-selling-before-pricing"
	              className="underline underline-offset-2 hover:text-foreground"
	            >
	              Visual pre-selling before pricing (2-minute walkthrough)
	            </Link>
	            .
	          </p>
	        </header>

        {/* 2) Definition block */}
	        <section id="definition" className="mt-14">
	          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
	            Definition
	          </h2>
	          <div className="mt-4 rounded-2xl border bg-card p-6">
	            <p className="text-[15px] md:text-[16px] leading-relaxed">{service.definition}</p>
	            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
	              This workflow is used by {service.name.toLowerCase()} businesses to align on design direction and scope before pricing discussions.
	            </p>
	            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
	              Previews are for visual alignment and scope discussion; final measurements and local codes are confirmed before delivery or installation.
	            </p>
	          </div>
	        </section>

        {/* 3) Local market context */}
	        <section id="local-context" className="mt-14">
	          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
	            Local context for {city.city}, {city.state}
	          </h2>
	          <div className="mt-4 space-y-3 text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
	            {marketContext.map((s) => (
	              <p key={s}>{s}</p>
	            ))}
	            <p>
	              In {city.city}, factors like {city.pricingFactors.slice(0, 2).join(" and ")} often influence scope, which is why a visual preview helps before quoting.
	            </p>
	          </div>
	        </section>

        {/* 4) Service-specific use cases */}
        <section id="use-cases" className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
            Service-specific sales use cases
          </h2>
	          <div className="mt-6 grid gap-4 md:grid-cols-2">
	            {[primary, secondary].filter(Boolean).map((uc) => (
	              <div key={uc!.kind} className="rounded-2xl border bg-card p-6">
	                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
	                  {uc!.kind === "primary" ? "Primary use case" : "Secondary use case"}
	                </div>
	                <h3 className="mt-2 text-lg font-semibold">{uc!.title}</h3>
	                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{uc!.description}</p>
	                <p className="mt-4 text-sm leading-relaxed">
	                  <span className="font-medium">Conversion benefit:</span>{" "}
	                  <span className="text-muted-foreground">{uc!.conversionBenefit}</span>
	                </p>
	              </div>
	            ))}
	          </div>
	          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
	            Directional outcome: teams typically see higher-quality estimate requests and fewer revisions after pricing when a preview is part of the first touch.
	          </p>
	        </section>

        {/* 5) How it works */}
        <section id="how-it-works" className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
            How it works
          </h2>
          <ol className="mt-6 grid gap-4 md:grid-cols-2">
            {[
              {
                desc: "The customer uses a photo of their space so the preview matches the real environment.",
                title: "Upload a real photo",
              },
              {
                desc: "Choices map to the decisions you quote against, not generic prompts.",
                title: "Select options that affect scope",
              },
              {
                desc: "The result is a visual reference that sets expectations before pricing.",
                title: "Generate a realistic preview",
              },
              {
                desc: "You receive the preview plus the buyer’s choices, so follow-up is specific and fast.",
                title: "Capture the lead with context",
              },
            ].map((step, idx) => (
              <li key={step.title} className="rounded-2xl border bg-card p-6">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Step {idx + 1}
                </div>
                <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </li>
            ))}
          </ol>
          {exampleScenario ? (
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              Example: {exampleScenario}
            </p>
          ) : null}
        </section>

        {/* 6) Comparison section */}
        <section id="comparison" className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
            Comparison: what this is and what it is not
          </h2>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="text-lg font-semibold">Compared to generic AI image generators</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed">
                {service.comparison.vsAiGenerators.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border bg-card p-6">
              <h3 className="text-lg font-semibold">Compared to “Get a Quote” forms</h3>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed">
                {service.comparison.vsQuoteForms.map((b) => (
                  <li key={b}>• {b}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* 7) Dynamic FAQs */}
        <section id="faq" className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">FAQs</h2>
          <div className="mt-6 space-y-3">
            {faqs.map((qa) => (
              <details key={qa.question} className="group rounded-2xl border bg-card p-6">
                <summary className="cursor-pointer select-none text-[15px] md:text-[16px] font-medium">
                  {qa.question}
                </summary>
                <div className="mt-3 text-sm text-muted-foreground leading-relaxed">{qa.answer}</div>
              </details>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
