type Props = {
  url: string;
  categoryName: string;
  subcategory: string;
  instanceType: 'ecomm' | 'service' | 'both';
  description?: string | null;
};

export default function SubcategoryStructuredData({ url, categoryName, subcategory, instanceType, description }: Props) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${subcategory} – ${categoryName}`,
    description: description || `${subcategory} solutions for ${instanceType} use-cases by Adventure`,
    url,
    brand: { "@type": "Brand", name: "Adventure" },
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
      description: "Free trial available",
      url,
      availability: "https://schema.org/InStock",
    },
    category: categoryName,
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} />
  );
}

