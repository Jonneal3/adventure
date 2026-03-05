export default function StructuredData() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "https://adventure.app";

  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Adventure",
    "description": "AI-powered visualization widgets that let customers see exactly what they want before they buy. Perfect for fashion, furniture, interior design, and landscaping businesses.",
    "url": siteUrl,
    "applicationCategory": "BusinessApplication",
    "operatingSystem": "Web",
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD",
      "description": "Free trial available"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "ratingCount": "127",
      "bestRating": "5",
      "worstRating": "1"
    },
    "author": {
      "@type": "Organization",
      "name": "Adventure",
      "url": siteUrl
    },
    "featureList": [
      "AI-powered visualization",
      "White-labeled widgets",
      "Customizable branding",
      "Real-time processing",
      "Mobile responsive",
      "Easy integration"
    ],
    "screenshot": `${siteUrl}/screenshot.png`,
    "softwareVersion": "1.0",
    "datePublished": "2024-01-15",
    "dateModified": "2024-01-15"
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      suppressHydrationWarning
    />
  );
} 
