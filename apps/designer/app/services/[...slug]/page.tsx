import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, BarChart3, Check, PlugZap, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getServiceBySlug, SITE_URL } from "@/config/services";
import ServiceStructuredData from "@/components/seo/ServiceStructuredData";
import SubcategoryStructuredData from "@/components/seo/SubcategoryStructuredData";
import { toSubcategorySlug } from "@/utils/slug";
import { generateServiceSummary } from "@/lib/ai/serviceSummary";
import { createClient } from "@supabase/supabase-js";
import { formatSubcategoryLabel, stripTypeSuffixFromServiceSlug } from "@/utils/subcategory";

type Params = { slug: string[] };

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SERVICE_GRADIENT_CLASS_BY_SLUG: Record<string, string> = {
  "fashion-boutique": "from-pink-600 via-purple-600 to-pink-800",
  "furniture-store": "from-amber-600 via-orange-600 to-amber-800",
  "hair-salon": "from-purple-600 via-pink-600 to-purple-800",
  "interior-design": "from-orange-600 via-red-600 to-orange-800",
  "landscaping": "from-green-600 to-emerald-700",
};

function parseServicePathSegments(segments: string[]) {
  const safe = Array.isArray(segments) ? segments.filter(Boolean) : [];
  const slugSegment = safe.length > 0 ? safe[safe.length - 1] : "";
  const slugParam = slugSegment.split("@")[0];
  const shouldRedirect = safe.length > 1;
  return { shouldRedirect, slugParam, slugSegment };
}

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return h >>> 0;
}

function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickKeywords(seedKey: string, keywords: string[], count: number): string[] {
  const seen = new Set<string>();
  const list = (keywords || []).map((k) => k.trim()).filter(Boolean);
  const rnd = mulberry32(hashString(seedKey));
  // Fisher–Yates shuffle (seeded)
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  const out: string[] = [];
  for (const k of list) {
    const lower = k.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      out.push(k);
      if (out.length >= count) break;
    }
  }
  return out;
}

function buildHeroParagraph(subject: string, keywords: string[], seedKey: string): string {
  const base = subject.replace(/\s+/g, ' ').trim();
  const selected = pickKeywords(seedKey + ':a', keywords, 8);
  const k1 = selected[0];
  const k2 = selected[1];
  const k3 = selected[2];
  const sentence1 = `Adventure helps ${base} businesses turn browsing into confident decisions with AI‑guided, on‑brand previews directly on your site.`;
  const sentence2 = `Customers can explore options, compare outcomes, and move forward faster — which typically improves conversion rates and reduces mismatched expectations.`;
  const sentence3 = k1 || k2 || k3
    ? `Common searches in this space include ${[k1, k2, k3].filter(Boolean).join(", ")} — we build pages and widgets that match how people actually look for ${base} services online.`
    : `We build pages and widgets that match how people actually look for ${base} services online.`;
  return [sentence1, sentence2, sentence3].join(" ");
}

function splitIntoParagraphs(text: string): string[] {
  return (text || "")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function splitIntoBlurbs(text: string, maxBlurbs: number = 4): string[] {
  const sentences = (text || "")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const blurbs: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if (!current) {
      current = sentence;
      continue;
    }

    if ((current + " " + sentence).length <= 220) {
      current = current + " " + sentence;
      continue;
    }

    blurbs.push(current);
    current = sentence;

    if (blurbs.length >= maxBlurbs) break;
  }

  if (current && blurbs.length < maxBlurbs) blurbs.push(current);
  return blurbs;
}

async function loadCategoryGalleryByCategoryName(categoryName: string) {
  const name = String(categoryName || "").trim();
  if (!name) return [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const { data: category } = await supabase
    .from("categories")
    .select("id,name,status")
    .eq("status", "active")
    .eq("name", name)
    .maybeSingle();

  if (!category?.id) return [];

  const { data: subs } = await supabase
    .from("categories_subcategories")
    .select("id")
    .eq("status", "active")
    .eq("category_id", category.id)
    .limit(80);

  const subIds = (subs || []).map((s: any) => s.id).filter(Boolean);
  if (subIds.length === 0) return [];

  const { data: imgs } = await supabase
    .from("images")
    .select("id,image_url,created_at")
    .in("subcategory_id", subIds)
    .order("created_at", { ascending: false })
    .limit(6);

  return (imgs || [])
    .map((img: any, idx: number) => ({
      alt: `${name} AI visualization example ${idx + 1}`,
      src: String(img.image_url || "").trim(),
    }))
    .filter((x: any) => Boolean(x.src));
}

function BreadcrumbStructuredData({
  items,
}: {
  items: { item: string; name: string }[];
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((x, idx) => ({
      "@type": "ListItem",
      item: x.item,
      name: x.name,
      position: idx + 1,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

function FAQStructuredData({
  faqs,
}: {
  faqs: { question: string; answer: string }[];
}) {
  if (!Array.isArray(faqs) || faqs.length === 0) return null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((qa) => ({
      "@type": "Question",
      acceptedAnswer: { "@type": "Answer", text: qa.answer },
      name: qa.question,
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

function normalizeFaq(faq: any): { answer: string; question: string }[] {
  if (!Array.isArray(faq)) return [];
  return faq
    .map((qa) => {
      const question = String(qa?.question ?? qa?.q ?? "").trim();
      const answer = String(qa?.answer ?? qa?.a ?? "").trim();
      return question && answer ? { answer, question } : null;
    })
    .filter(Boolean) as { answer: string; question: string }[];
}

function normalizeUseCases(useCases: any): { description: string; title: string }[] {
  if (!Array.isArray(useCases)) return [];
  return useCases
    .map((uc) => {
      const title = String(uc?.title ?? uc?.name ?? "").trim();
      const description = String(uc?.desc ?? uc?.description ?? "").trim();
      return title && description ? { description, title } : null;
    })
    .filter(Boolean) as { description: string; title: string }[];
}

type ServiceKnowledge = {
  comparisons?: { point: string; vs: string }[];
  definition?: string;
  examples?: { result?: string; scenario: string }[];
  how_people_buy?: string[];
  objections?: { objection: string; response: string }[];
  who_its_for?: string[];
  why_visualization_matters?: string[];
  workflow_steps?: { detail?: string; title: string }[];
};

function normalizeStringList(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((x) => String(x ?? "").trim())
    .filter(Boolean);
}

function normalizeServiceKnowledge(input: unknown): ServiceKnowledge {
  const raw = (input && typeof input === "object" ? input : {}) as any;
  const definition = typeof raw.definition === "string" ? raw.definition.trim() : "";
  const who_its_for = normalizeStringList(raw.who_its_for);
  const how_people_buy = normalizeStringList(raw.how_people_buy);
  const why_visualization_matters = normalizeStringList(raw.why_visualization_matters);

  const objections = Array.isArray(raw.objections)
    ? raw.objections
        .map((o: any) => {
          const objection = String(o?.objection ?? "").trim();
          const response = String(o?.response ?? "").trim();
          return objection && response ? { objection, response } : null;
        })
        .filter(Boolean)
    : [];

  const workflow_steps = Array.isArray(raw.workflow_steps)
    ? raw.workflow_steps
        .map((s: any) => {
          const title = String(s?.title ?? "").trim();
          const detail = String(s?.detail ?? s?.desc ?? s?.description ?? "").trim();
          return title ? (detail ? { detail, title } : { title }) : null;
        })
        .filter(Boolean)
    : [];

  const comparisons = Array.isArray(raw.comparisons)
    ? raw.comparisons
        .map((c: any) => {
          const vs = String(c?.vs ?? "").trim();
          const point = String(c?.point ?? "").trim();
          return vs && point ? { point, vs } : null;
        })
        .filter(Boolean)
    : [];

  const examples = Array.isArray(raw.examples)
    ? raw.examples
        .map((e: any) => {
          const scenario = String(e?.scenario ?? "").trim();
          const result = String(e?.result ?? "").trim();
          return scenario ? (result ? { result, scenario } : { scenario }) : null;
        })
        .filter(Boolean)
    : [];

  const out: ServiceKnowledge = {};
  if (definition) out.definition = definition;
  if (who_its_for.length > 0) out.who_its_for = who_its_for;
  if (how_people_buy.length > 0) out.how_people_buy = how_people_buy;
  if (why_visualization_matters.length > 0) out.why_visualization_matters = why_visualization_matters;
  if (objections.length > 0) out.objections = objections as { objection: string; response: string }[];
  if (workflow_steps.length > 0) out.workflow_steps = workflow_steps as { detail?: string; title: string }[];
  if (comparisons.length > 0) out.comparisons = comparisons as { point: string; vs: string }[];
  if (examples.length > 0) out.examples = examples as { result?: string; scenario: string }[];
  return out;
}

async function loadSubcategoryBySlug(slug: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  const canonicalSlug = stripTypeSuffixFromServiceSlug(slug);
  const candidateSlugs = Array.from(
    new Set([
      slug,
      canonicalSlug,
      `${canonicalSlug}-service`,
      `${canonicalSlug}-ecomm`,
      `${canonicalSlug}-e-commerce`,
    ].filter(Boolean)),
  );

  // 1) Load subcategory by slug candidates (lets us merge service/ecomm pairs)
  const { data: subs, error: subError } = await supabase
    .from('categories_subcategories')
    .select('*, category_subcategory_seo(*)')
    .in('slug', candidateSlugs)
    .eq('status', 'active')
    .order('updated_at', { ascending: false })
    .limit(5);
  if (subError || !subs || subs.length === 0) return null;

  const bySlug = new Map<string, any>();
  for (const s of subs as any[]) bySlug.set(String(s.slug || ""), s);
  const canonical = bySlug.get(canonicalSlug);
  const exact = bySlug.get(slug);
  const sub = (exact || canonical || (subs[0] as any)) as any;

  const hasService = (subs as any[]).some((s) => (s as any).instance_type === "service");
  const hasEcomm = (subs as any[]).some((s) => (s as any).instance_type === "ecomm");
  const effectiveInstanceType =
    hasService && hasEcomm ? "both" : ((sub as any).instance_type || "service");
  (sub as any).effective_instance_type = effectiveInstanceType;
  (sub as any).display_subcategory = formatSubcategoryLabel((sub as any).subcategory || "");
  const shouldRedirectToCanonical = Boolean(slug !== canonicalSlug && canonical && hasService && hasEcomm);

  // 2) Load category (and siblings) for the subcategory
  const { data: cat } = await supabase
    .from('categories')
    .select('id,name,status,categories_subcategories(id,subcategory,slug,status)')
    .eq('id', (sub as any).category_id)
    .eq('status', 'active')
    .maybeSingle();

  // 2.5) If service_summary is missing, generate it in real-time and persist it.
  try {
    const isMissing =
      !(sub as any).service_summary || String((sub as any).service_summary).trim().length === 0;
    const instanceType = ((sub as any).instance_type as string) || "service";
    // Only auto-generate for service/both pages (you can widen this later if you want).
    const shouldGenerate = isMissing && instanceType !== "ecomm";
    if (shouldGenerate) {
      const summary = await generateServiceSummary({
        categoryName: (cat?.name as string) || null,
        instanceType,
        serviceName: String((sub as any).subcategory || ""),
      });

      // Persist only if we have a service role key; otherwise just return the generated text.
      if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
        await supabase
          .from("categories_subcategories")
          .update({ service_summary: summary })
          .eq("id", (sub as any).id);
      }
      (sub as any).service_summary = summary;
    }
  } catch {
    // If AI generation fails, don't break the page render.
  }

  const siblings = (cat?.categories_subcategories || [])
    .filter((x: any) => x.status === 'active' && x.id !== (sub as any).id)
    .slice(0, 12)
    .map((x: any) => ({ slug: (x.slug as string) || toSubcategorySlug(x.subcategory as string), text: x.subcategory as string }));

  // 3) Load example images for the subcategory
  const { data: imgs } = await supabase
    .from('images')
    .select('id,image_url')
    .eq('subcategory_id', (sub as any).id)
    .limit(8);

  return {
    canonicalSlug,
    categoryName: (cat?.name as string) || '',
    images: imgs || [],
    shouldRedirectToCanonical,
    siblings,
    sub,
  } as any;
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { slugParam, slugSegment } = parseServicePathSegments(params.slug);
  const service = getServiceBySlug(slugSegment);
  if (service) {
    const url = `${SITE_URL}/services/${service.slug}`;
    return {
      alternates: { canonical: url },
      description: service.metaDescription,
      keywords: service.keywords,
      openGraph: { description: service.metaDescription, title: service.metaTitle, type: 'website', url },
      title: service.metaTitle,
      twitter: { card: 'summary_large_image', description: service.metaDescription, title: service.metaTitle },
    };
  }
  const match = await loadSubcategoryBySlug(slugParam);
  if (match) {
    const type =
      (match.sub.effective_instance_type as 'ecomm' | 'service' | 'both') ||
      (match.sub.instance_type as 'ecomm' | 'service' | 'both') ||
      'service';
    const seo = (match.sub as any).category_subcategory_seo || {};
    const displaySub =
      (match.sub.display_subcategory as string) || formatSubcategoryLabel(match.sub.subcategory as string);
    const rawTitle = (seo.seo_title as string) || `${displaySub} | Adventure`;
    const title = /Adventure/i.test(rawTitle) ? rawTitle : `${rawTitle} | Adventure`;
    const description = (seo.seo_description as string) || (match.sub.description as string) || undefined;
    const canonicalPath =
      (seo.canonical_path as string) || `/services/${match.canonicalSlug || slugParam}`;
    const url = `${SITE_URL}${canonicalPath.startsWith('/') ? '' : '/'}${canonicalPath}`;
    const noindex = Boolean(seo.noindex);
    const ogImage = (seo.og_image_url as string) || undefined;
    const twitterImage = (seo.twitter_image_url as string) || ogImage || undefined;
    return {
      alternates: { canonical: url },
      description,
      keywords: Array.isArray(seo.seo_keywords) && (seo.seo_keywords as string[]).length > 0
        ? (seo.seo_keywords as string[])
        : [displaySub, match.categoryName, type, 'AI visualization', 'Adventure'],
      openGraph: {
        description,
        images: ogImage ? [{ url: ogImage }] : undefined,
        title,
        type: 'website',
        url,
      },
      robots: noindex ? { follow: true, index: false } : { follow: true, index: true },
      title,
      twitter: {
        card: 'summary_large_image',
        description,
        images: twitterImage ? [twitterImage] : undefined,
        title,
      },
    };
  }
  return { robots: { follow: false, index: false } };
}

export default async function ServiceOrSubcategoryPage({ params }: { params: Params }) {
  const { shouldRedirect, slugParam, slugSegment } = parseServicePathSegments(params.slug);
  if (shouldRedirect) {
    redirect(`/services/${slugSegment}`);
  }

	  const service = getServiceBySlug(slugSegment);
	  if (service) {
	    const breadcrumbItems = [
	      { href: "/", name: "Home" },
	      { href: "/services", name: "Services" },
	      { href: `/services/${service.slug}`, name: service.name },
	    ];
	    const gradientClass =
	      SERVICE_GRADIENT_CLASS_BY_SLUG[service.slug] || "from-foreground to-foreground";
	    const categoryGallery = await loadCategoryGalleryByCategoryName(service.name);
	    const hasHeroMedia = categoryGallery.length > 0;
	    return (
	      <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
	        <ServiceStructuredData service={service} />
	        <BreadcrumbStructuredData
	          items={breadcrumbItems.map((x) => ({ item: `${SITE_URL}${x.href}`, name: x.name }))}
        />

        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,0,0,0.08),transparent)] dark:bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),transparent)] blur-2xl" />
        </div>

        <main className="mx-auto w-full max-w-[1320px] px-4 md:px-8 pt-10 pb-16">
          <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
            <ol className="flex flex-wrap items-center gap-2">
              {breadcrumbItems.map((item, idx) => (
                <li key={item.href} className="flex items-center gap-2">
                  <Link href={item.href} className="hover:text-foreground transition-colors">
                    {item.name}
                  </Link>
                  {idx < breadcrumbItems.length - 1 && <span aria-hidden>/</span>}
                </li>
              ))}
            </ol>
	          </nav>
	
	          <header className={`mt-6 grid items-start gap-10 ${hasHeroMedia ? "lg:grid-cols-2" : ""}`}>
	            <div>
	              <div className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
	                <Sparkles className="h-3.5 w-3.5" />
	                AI visualization widget
	              </div>

              <h1
                className="mt-5 max-w-[22ch] text-4xl md:text-5xl font-bold tracking-tight leading-[1.02] font-fraunces"
              >
                {service.hero.headingLead}{" "}
                <span className={`bg-gradient-to-r ${gradientClass} bg-clip-text text-transparent`}>
                  {service.hero.headingGradient}
                </span>{" "}
                {service.hero.headingTrail}
              </h1>

              <p className="mt-4 max-w-[72ch] text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
                {service.metaDescription}
              </p>

              <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
                <Button asChild size="lg" className="rounded-full px-7">
                  <Link href="/auth">
                    Start free trial <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                  <Link href={`/playground?service=${encodeURIComponent(slugParam)}`}>Explore demo</Link>
                </Button>
                <Button asChild size="lg" variant="ghost" className="rounded-full px-4">
                  <Link href="/contact">Talk to sales</Link>
                </Button>
              </div>

              <ul className="mt-7 grid gap-2 text-sm text-muted-foreground">
                {[
                  "On‑brand previews in seconds",
                  "Embed in minutes (no heavy rebuild)",
                  "Capture leads and measure intent",
                ].map((x) => (
                  <li key={x} className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-foreground/70" />
                    <span>{x}</span>
                  </li>
	                ))}
	              </ul>
	            </div>
	
	            {hasHeroMedia && (
	              <div className="relative">
	                <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
	                  <img
	                    src={categoryGallery[0].src}
	                    alt={categoryGallery[0].alt || `${service.name} preview`}
	                    className="h-auto w-full object-cover"
	                    loading="eager"
	                  />
	                </div>
	
	                {categoryGallery.length > 1 && (
	                  <div className="mt-3 grid grid-cols-3 gap-3">
	                    {categoryGallery.slice(1, 4).map((img) => (
	                      <div key={img.src} className="overflow-hidden rounded-xl border bg-card">
	                        <img
	                          src={img.src}
	                          alt={img.alt}
	                          className="h-24 w-full object-cover"
	                          loading="lazy"
	                        />
	                      </div>
	                    ))}
	                  </div>
	                )}
	              </div>
	            )}
	          </header>

          <section id="overview" className="mt-14">
            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4" />
                  Better conversion
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Show outcomes before commitment, so more visitors take the next step.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <ShieldCheck className="h-4 w-4" />
                  Fewer surprises
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Clear previews set expectations and reduce time-wasting back-and-forth.
                </p>
              </div>
              <div className="rounded-2xl border bg-card p-6">
                <div className="flex items-center gap-2 text-sm font-medium">
                  <PlugZap className="h-4 w-4" />
                  Fast to launch
                </div>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  Add the widget to your site quickly, then iterate with analytics and learnings.
                </p>
              </div>
            </div>
          </section>

          <section id="use-cases" className="mt-16">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
                  What it’s great for
                </h2>
                <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
                  Built around the real decision points your customers have in {service.name.toLowerCase()} workflows.
                </p>
              </div>
              <Link
                href="/services"
                className="hidden sm:inline-flex text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Browse all services →
              </Link>
            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {service.features.map((feature) => (
                <div key={feature} className="rounded-2xl border bg-card p-5">
                  <div className="flex items-start gap-2">
                    <Check className="mt-0.5 h-4 w-4 text-foreground/70" />
                    <div>
                      <h3 className="text-sm font-semibold">{feature}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        Interactive AI preview for this scenario.
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section id="cta" className="mt-16">
            <div className="rounded-3xl border bg-gradient-to-br from-background to-muted/40 p-8 md:p-10">
              <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
                    Ready to add {service.name} previews to your site?
                  </h2>
                  <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
                    Start a free trial, explore the demo playground, or talk with our team about a custom rollout.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" className="rounded-full px-7">
                    <Link href="/auth">
                      Start free trial <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                    <Link href="/pricing">See pricing</Link>
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <footer className="mt-16 border-t pt-10 text-sm text-muted-foreground">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div>© {new Date().getFullYear()} Adventure. All rights reserved.</div>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
                <Link href="/pricing" className="hover:text-foreground transition-colors">
                  Pricing
                </Link>
                <Link href="/agency" className="hover:text-foreground transition-colors">
                  Agency
                </Link>
                <Link href="/services" className="hover:text-foreground transition-colors">
                  Services
                </Link>
                <Link href="/auth" className="hover:text-foreground transition-colors">
                  Start trial
                </Link>
              </div>
            </div>
          </footer>
        </main>
      </div>
    );
  }

  const match = await loadSubcategoryBySlug(slugParam);
  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Not found</h1>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Please return to services and pick a subcategory.</p>
          <Link href="/services"><Button>Back to Services</Button></Link>
        </div>
      </div>
    );
  }

  if (match.shouldRedirectToCanonical) {
    redirect(`/services/${match.canonicalSlug}`);
  }

  const type =
    (match.sub.effective_instance_type as 'ecomm' | 'service' | 'both') ||
    (match.sub.instance_type as 'ecomm' | 'service' | 'both') ||
    'service';
  const seo = (match.sub as any).category_subcategory_seo || {};
  const displaySub =
    (match.sub.display_subcategory as string) || formatSubcategoryLabel(match.sub.subcategory as string);
  const heading = seo.h1 || (seo.seo_title ? (seo.seo_title as string).replace(/\s*\|\s*Adventure.*/i, '') : `Visualize ${displaySub} With AI`);
  const defaultTagline = `Instant AI previews for ${displaySub}`;
  const heroTagline = (seo.hero_tagline as string) || '';
  const tagline = (heroTagline && heroTagline.trim()) || defaultTagline;
  const kws = Array.isArray(seo.seo_keywords) ? (seo.seo_keywords as string[]) : [];
  const fallbackBody = buildHeroParagraph(displaySub.toLowerCase(), kws, slugParam);
  // Prefer structured, meaningful copy from `categories_subcategories.service_summary`.
  // `category_subcategory_seo.content` historically contained keyword-stuffed blobs; ignore it here.
  const paragraph = String((match.sub as any).service_summary || "").trim() || fallbackBody;
  const paragraphs = splitIntoParagraphs(paragraph);
  const blurbs = splitIntoBlurbs(paragraph, 4);
  const knowledge = normalizeServiceKnowledge((seo as any).service_knowledge);
  const hasStructuredSections =
    Boolean(knowledge.workflow_steps && knowledge.workflow_steps.length > 0) ||
    Boolean(knowledge.why_visualization_matters && knowledge.why_visualization_matters.length > 0) ||
    Boolean(knowledge.how_people_buy && knowledge.how_people_buy.length > 0) ||
    Boolean(knowledge.objections && knowledge.objections.length > 0) ||
    Boolean(knowledge.comparisons && knowledge.comparisons.length > 0) ||
    Boolean(knowledge.examples && knowledge.examples.length > 0) ||
    Boolean(knowledge.who_its_for && knowledge.who_its_for.length > 0);
  const useCases = normalizeUseCases((match.sub as any).use_cases);
  const faqs = normalizeFaq((seo as any).faq);
  const galleryImages = Array.isArray((match as any).images) ? ((match as any).images as any[]) : [];
  const seoSampleImages = Array.isArray((seo as any).sample_images) ? ((seo as any).sample_images as any[]) : [];
  const topGallery = (seoSampleImages.length > 0 ? seoSampleImages : galleryImages).slice(0, 6);
  const hasHeroMedia = topGallery.length > 0;
  const breadcrumbItems = [
    { href: "/", name: "Home" },
    { href: "/services", name: "Services" },
    { href: "/services", name: match.categoryName || "Category" },
    { href: `/services/${match.canonicalSlug || slugParam}`, name: displaySub },
  ];

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      <SubcategoryStructuredData
        url={`${SITE_URL}/services/${match.canonicalSlug || slugParam}`}
        categoryName={match.categoryName}
        subcategory={displaySub}
        instanceType={type}
        description={match.sub.description}
      />
      <BreadcrumbStructuredData
        items={breadcrumbItems.map((x) => ({ item: `${SITE_URL}${x.href}`, name: x.name }))}
      />
      <FAQStructuredData faqs={faqs} />

      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-32 left-1/2 h-[520px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(0,0,0,0.08),transparent)] dark:bg-[radial-gradient(closest-side,rgba(255,255,255,0.10),transparent)] blur-2xl" />
      </div>

      <main className="mx-auto w-full max-w-[1100px] px-4 md:px-8 pt-12 pb-16 md:pt-14 md:pb-20">
        <nav aria-label="Breadcrumb" className="text-sm text-muted-foreground">
          <ol className="flex flex-wrap items-center gap-2">
            {breadcrumbItems.map((item, idx) => (
              <li key={item.href} className="flex items-center gap-2">
                <Link href={item.href} className="hover:text-foreground transition-colors">
                  {item.name}
                </Link>
                {idx < breadcrumbItems.length - 1 && <span aria-hidden>/</span>}
              </li>
            ))}
          </ol>
        </nav>

        <header className={`mt-6 grid items-start gap-10 ${hasHeroMedia ? "lg:grid-cols-2" : ""}`}>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                {match.categoryName}
              </span>
              <span className="inline-flex items-center rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground">
                {type === "ecomm" ? "E‑commerce" : type === "both" ? "E‑commerce + services" : "Services"}
              </span>
            </div>

            <h1
              className="mt-5 max-w-[26ch] text-4xl md:text-5xl font-bold tracking-tight leading-[1.02] font-fraunces"
            >
              {heading}
            </h1>

            {tagline && (
              <p className="mt-4 max-w-[72ch] text-[15px] md:text-[16px] text-muted-foreground leading-relaxed">
                {tagline}
              </p>
            )}

            <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
              <Button asChild size="lg" className="rounded-full px-7">
                <Link href={seo.hero_cta_url || "/auth"}>
                  {seo.hero_cta_text || "Start free trial"} <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                <Link href={`/playground?service=${encodeURIComponent(slugParam)}`}>Explore demo</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full px-4">
                <Link href="/pricing">Pricing</Link>
              </Button>
            </div>

            <ul className="mt-7 grid gap-2 text-sm text-muted-foreground">
              {[
                `On‑brand previews for ${displaySub}`,
                "Clear previews reduce back‑and‑forth",
              ].map((x) => (
                <li key={x} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 text-foreground/70" />
                  <span>{x}</span>
                </li>
              ))}
            </ul>
          </div>

          {hasHeroMedia && (
            <div className="relative">
              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <img
                  src={topGallery[0].image_url || topGallery[0].url || topGallery[0].src}
                  alt={topGallery[0].alt || `${displaySub} preview`}
                  className="h-auto w-full object-cover"
                  loading="eager"
                />
              </div>

              {topGallery.length > 1 && (
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {topGallery.slice(1, 4).map((img: any, idx: number) => (
                    <div key={idx} className="overflow-hidden rounded-xl border bg-card">
                      <img
                        src={img.image_url || img.url || img.src}
                        alt={img.alt || `${displaySub} example ${idx + 2}`}
                        className="h-24 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </header>

        <section id="overview" className="mt-14">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
            Overview
          </h2>

          {knowledge.definition ? (
            <div className="mt-4 rounded-2xl border bg-card p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Definition</div>
              <p className="mt-3 text-[15px] md:text-[16px] leading-relaxed">{knowledge.definition}</p>
            </div>
          ) : null}

          {(!knowledge.definition || !hasStructuredSections) && (
            <div className="mt-4 space-y-4 text-sm md:text-[15px] leading-relaxed text-muted-foreground">
              {(paragraphs.length > 0 ? paragraphs : [fallbackBody])
                .slice(0, knowledge.definition ? 2 : 6)
                .map((p, idx) => (
                  <p key={idx}>{p}</p>
                ))}
            </div>
          )}

          {knowledge.why_visualization_matters && knowledge.why_visualization_matters.length > 0 && (
            <div className="mt-6 rounded-2xl border bg-card p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Why visualization matters
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed">
                {knowledge.why_visualization_matters.slice(0, 6).map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>
          )}

          {knowledge.how_people_buy && knowledge.how_people_buy.length > 0 && (
            <div className="mt-6 rounded-2xl border bg-card p-6">
              <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                How people buy {displaySub}
              </div>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground leading-relaxed">
                {knowledge.how_people_buy.slice(0, 6).map((x) => (
                  <li key={x}>• {x}</li>
                ))}
              </ul>
            </div>
          )}

          {knowledge.objections && knowledge.objections.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold">Common objections</h3>
              <div className="mt-3 space-y-3">
                {knowledge.objections.slice(0, 6).map((o) => (
                  <details key={o.objection} className="rounded-2xl border bg-card p-6">
                    <summary className="cursor-pointer select-none text-sm font-semibold">
                      {o.objection}
                    </summary>
                    <div className="mt-3 text-sm text-muted-foreground leading-relaxed">{o.response}</div>
                  </details>
                ))}
              </div>
            </div>
          )}

        </section>

        {(useCases.length > 0 ||
          (knowledge.who_its_for && knowledge.who_its_for.length > 0) ||
          (knowledge.examples && knowledge.examples.length > 0)) && (
          <section id="use-cases" className="mt-16">
            <div className="flex items-end justify-between gap-6">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
                  Use cases
                </h2>
                <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
                  {blurbs[0] || `Practical ways teams use the widget for ${displaySub.toLowerCase()}.`}
                </p>
              </div>
            </div>

            {knowledge.who_its_for && knowledge.who_its_for.length > 0 && (
              <div className="mt-6 rounded-2xl border bg-card p-6">
                <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  Who it’s for
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {knowledge.who_its_for.slice(0, 10).map((x) => (
                    <span
                      key={x}
                      className="inline-flex items-center rounded-full border bg-background/70 px-3 py-1 text-xs text-muted-foreground"
                    >
                      {x}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {useCases.length > 0 && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {useCases.slice(0, 9).map((uc) => (
                  <div key={uc.title} className="rounded-2xl border bg-card p-6">
                    <h3 className="text-sm font-semibold">{uc.title}</h3>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{uc.description}</p>
                  </div>
                ))}
              </div>
            )}

            {knowledge.examples && knowledge.examples.length > 0 && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {knowledge.examples.slice(0, 4).map((e) => (
                  <div key={e.scenario} className="rounded-2xl border bg-card p-6">
                    <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Example</div>
                    <h3 className="mt-2 text-sm font-semibold">{e.scenario}</h3>
                    {e.result ? (
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{e.result}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        <section id="how" className="mt-16">
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
            How it works
          </h2>
          <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
            {blurbs[1] || "A simple flow that keeps customers engaged and moves them toward action."}
          </p>
          <div className="mt-6 grid gap-4 md:grid-cols-2">
            {(knowledge.workflow_steps && knowledge.workflow_steps.length > 0
              ? knowledge.workflow_steps
              : [
                  {
                    detail: "Customers upload or select a starting point for accurate results.",
                    title: "Start with a photo or template",
                  },
                  {
                    detail: "Choose styles, materials, and preferences that match your offerings.",
                    title: "Customize options",
                  },
                  {
                    detail: "Share results, collect leads, and guide next steps with CTAs.",
                    title: "Preview + capture intent",
                  },
                ]
            )
              .slice(0, 6)
              .map((step, idx) => (
                <div key={step.title} className="rounded-2xl border bg-card p-6">
                  <div className="text-xs text-muted-foreground">Step {idx + 1}</div>
                  <h3 className="mt-2 text-sm font-semibold">{step.title}</h3>
                  {step.detail ? (
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{step.detail}</p>
                  ) : null}
                </div>
              ))}
          </div>
        </section>

        {knowledge.comparisons && knowledge.comparisons.length > 0 && (
          <section id="comparison" className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
              Comparisons
            </h2>
            <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
              What this is (and is not) compared to nearby alternatives.
            </p>
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {knowledge.comparisons.slice(0, 6).map((c, idx) => (
                <div key={`${c.vs}:${idx}`} className="rounded-2xl border bg-card p-6">
                  <div className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    Vs {c.vs}
                  </div>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{c.point}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {faqs.length > 0 && (
          <section id="faq" className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
              Frequently asked questions
            </h2>
            {blurbs[2] && (
              <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
                {blurbs[2]}
              </p>
            )}
            <div className="mt-6 space-y-3">
              {faqs.map((qa) => (
                <div key={qa.question} className="rounded-2xl border bg-card">
                  <details>
                    <summary className="cursor-pointer list-none px-5 py-4 text-sm font-semibold">
                      {qa.question}
                    </summary>
                    <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{qa.answer}</div>
                  </details>
                </div>
              ))}
            </div>
          </section>
        )}

        {(topGallery.length > 0 || (knowledge.examples && knowledge.examples.length > 0)) && (
          <section id="examples" className="mt-16">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
              Examples
            </h2>

            {knowledge.examples && knowledge.examples.length > 0 && (
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {knowledge.examples.slice(0, 4).map((e) => (
                  <div key={e.scenario} className="rounded-2xl border bg-card p-6">
                    <h3 className="text-sm font-semibold">{e.scenario}</h3>
                    {e.result ? (
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{e.result}</p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}

            {topGallery.length > 0 && (
              <>
                <p className="mt-6 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
                  Visual examples for {displaySub.toLowerCase()}.
                </p>
                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
                  {topGallery.slice(0, 6).map((img: any, idx: number) => (
                    <div key={idx} className="overflow-hidden rounded-2xl border bg-card">
                      <img
                        src={img.image_url || img.url || img.src}
                        alt={img.alt || `${displaySub} example ${idx + 1}`}
                        className="h-44 w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </section>
        )}

        <section id="related" className="mt-16">
          <div className="flex items-end justify-between gap-6">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
                Related in {match.categoryName}
              </h2>
              <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
                More pages that pair well with {displaySub.toLowerCase()}.
              </p>
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2">
            {((match as any).siblings as any[]).slice(0, 12).map((s) => (
              <Link
                key={s.slug}
                href={`/services/${s.slug}`}
                className="inline-flex items-center rounded-full border bg-background/70 px-3 py-1 text-sm text-muted-foreground hover:text-foreground hover:bg-background transition-colors"
              >
                {s.text}
              </Link>
            ))}
          </div>
        </section>

        <section id="cta" className="mt-16">
          <div className="rounded-3xl border bg-gradient-to-br from-background to-muted/40 p-8 md:p-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-fraunces">
                  Get the {displaySub} widget live on your site
                </h2>
                <p className="mt-2 text-sm md:text-[15px] text-muted-foreground max-w-[80ch]">
                  {blurbs[3] || "Launch a clean, on‑brand preview experience built for SEO and conversion."}
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3">
                <Button asChild size="lg" className="rounded-full px-7">
                  <Link href={seo.hero_cta_url || "/auth"}>
                    {seo.hero_cta_text || "Start free trial"} <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="rounded-full px-7">
                  <Link href="/contact">Talk to sales</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <footer className="mt-16 border-t pt-10 text-sm text-muted-foreground">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>© {new Date().getFullYear()} Adventure. All rights reserved.</div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <Link href="/pricing" className="hover:text-foreground transition-colors">
                Pricing
              </Link>
              <Link href="/agency" className="hover:text-foreground transition-colors">
                Agency
              </Link>
              <Link href="/services" className="hover:text-foreground transition-colors">
                Services
              </Link>
              <Link href="/auth" className="hover:text-foreground transition-colors">
                Start trial
              </Link>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}
