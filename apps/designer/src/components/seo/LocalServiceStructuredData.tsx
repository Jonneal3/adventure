import { SITE_URL } from "@/config/services";
import type { LocalSeoCity, LocalSeoService } from "@/config/seo/localServicePages";
import { toCityStateSlug, toAbsoluteUrl } from "@/config/seo/localServicePages";

type Props = {
  service: LocalSeoService;
  city: LocalSeoCity;
  faqs: { question: string; answer: string }[];
};

function ScriptJsonLd({ data }: { data: any }) {
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />
  );
}

export default function LocalServiceStructuredData({ service, city, faqs }: Props) {
  const cityState = toCityStateSlug(city.city, city.state);
  const pathname = `/services/${service.slug}/ai-visualization/${cityState}`;
  const url = toAbsoluteUrl(pathname);

  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Services", item: `${SITE_URL}/services` },
      {
        "@type": "ListItem",
        position: 3,
        name: `${service.name} AI Visualization`,
        item: `${SITE_URL}/services/${service.slug}`,
      },
      { "@type": "ListItem", position: 4, name: `${city.city}, ${city.state}`, item: url },
    ],
  };

  const serviceJsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: `AI ${service.name} Visualization`,
    description: service.definition,
    url,
    provider: {
      "@type": "Organization",
      name: "Adventure",
      url: SITE_URL,
    },
    areaServed: {
      "@type": "City",
      name: city.city,
      address: {
        "@type": "PostalAddress",
        addressLocality: city.city,
        addressRegion: city.state,
        addressCountry: "US",
      },
    },
    serviceType: `${service.name} visualization`,
  };

  const faqJsonLd =
    Array.isArray(faqs) && faqs.length > 0
      ? {
          "@context": "https://schema.org",
          "@type": "FAQPage",
          mainEntity: faqs.map((qa) => ({
            "@type": "Question",
            name: qa.question,
            acceptedAnswer: { "@type": "Answer", text: qa.answer },
          })),
        }
      : null;

  return (
    <>
      <ScriptJsonLd data={breadcrumbs} />
      <ScriptJsonLd data={serviceJsonLd} />
      {faqJsonLd ? <ScriptJsonLd data={faqJsonLd} /> : null}
    </>
  );
}
