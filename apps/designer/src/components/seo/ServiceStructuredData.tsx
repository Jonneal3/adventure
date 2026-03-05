import { SITE_URL, type ServiceConfig } from "@/config/services";

type Props = {
  service: ServiceConfig;
};

export default function ServiceStructuredData({ service }: Props) {
  const url = `${SITE_URL}/services/${service.slug}`;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${service.name} AI Visualization Widget`,
    description: service.metaDescription,
    url,
    brand: {
      "@type": "Brand",
      name: "Adventure",
    },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free trial available",
      url,
      availability: "https://schema.org/InStock",
    },
    category: service.name,
    isRelatedTo: service.features.map((f) => ({ "@type": "Thing", name: f })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
    />
  );
}

