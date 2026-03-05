export type ServiceConfig = {
  slug: string;
  name: string;
  shortTagline: string; // badge text, e.g., "Perfect for Hair Salons"
  metaTitle: string;
  metaDescription: string;
  keywords: string[];
  hero: {
    headingLead: string; // text before gradient span
    headingGradient: string; // text inside gradient span
    headingTrail: string; // text after gradient span
    gradientFrom: string; // tailwind color token without brackets, e.g., 'purple-600'
    gradientVia?: string;
    gradientTo: string;
    accent: string; // primary accent color token, e.g., 'purple-600'
  };
  features: string[]; // bullets list for "Perfect for:"
};

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://adventure.app";

export const SERVICES: ServiceConfig[] = [
  {
    slug: "hair-salon",
    name: "Hair Salon",
    shortTagline: "Perfect for Hair Salons",
    metaTitle: "Hair Salon AI Visualization Widget | Adventure",
    metaDescription:
      "Transform your hair salon website with AI visualization. Let clients see hairstyles, colors, and cuts before booking. Increase bookings and reduce no-shows.",
    keywords: [
      "hair salon software",
      "hairstyle visualization",
      "hair color preview",
      "salon booking widget",
      "AI hair styling",
      "virtual hair try-on",
      "salon website tools",
      "hair consultation tool",
    ],
    hero: {
      headingLead: "Let Your Clients",
      headingGradient: "See Their New Look",
      headingTrail: "Before Booking",
      gradientFrom: "purple-600",
      gradientVia: "pink-600",
      gradientTo: "purple-800",
      accent: "blue-600",
    },
    features: [
      "Hair color changes",
      "Haircut styles",
      "Hair extensions",
      "Styling services",
    ],
  },
  {
    slug: "fashion-boutique",
    name: "Fashion Boutique",
    shortTagline: "Perfect for Fashion Boutiques",
    metaTitle: "Fashion Boutique AI Try-On Widget | Adventure",
    metaDescription:
      "Transform your fashion boutique with AI virtual try-on. Let customers see how clothes look on them before buying. Increase sales and reduce returns.",
    keywords: [
      "fashion boutique software",
      "virtual try-on",
      "clothing visualization",
      "fashion widget",
      "AI fashion try-on",
      "virtual fitting room",
      "fashion website tools",
      "clothing preview tool",
    ],
    hero: {
      headingLead: "Virtual",
      headingGradient: "Try-On Experience",
      headingTrail: "for Your Customers",
      gradientFrom: "pink-600",
      gradientVia: "purple-600",
      gradientTo: "pink-800",
      accent: "pink-600",
    },
    features: [
      "Dresses & tops",
      "Outerwear",
      "Accessories",
      "Complete outfits",
    ],
  },
  {
    slug: "interior-design",
    name: "Interior Design",
    shortTagline: "Perfect for Interior Designers",
    metaTitle: "Interior Design AI Visualization Widget | Adventure",
    metaDescription:
      "Transform your interior design business with AI visualization. Let clients see room transformations before hiring you. Win more projects and close deals faster.",
    keywords: [
      "interior design software",
      "room visualization",
      "design visualization",
      "interior design widget",
      "AI room design",
      "virtual room makeover",
      "interior design tools",
      "room transformation tool",
    ],
    hero: {
      headingLead: "Let Clients",
      headingGradient: "See Their Dream Space",
      headingTrail: "Before You Start",
      gradientFrom: "orange-600",
      gradientVia: "red-600",
      gradientTo: "orange-800",
      accent: "orange-600",
    },
    features: [
      "Living rooms",
      "Kitchens",
      "Bedrooms",
      "Bathrooms",
    ],
  },
  {
    slug: "furniture-store",
    name: "Furniture Store",
    shortTagline: "Perfect for Furniture Stores",
    metaTitle: "Furniture Store AI Visualization Widget | Adventure",
    metaDescription:
      "Transform your furniture store with AI visualization. Let customers see furniture in their space before buying. Increase sales and reduce returns.",
    keywords: [
      "furniture store software",
      "furniture visualization",
      "room furniture preview",
      "furniture widget",
      "AI furniture placement",
      "virtual furniture try-on",
      "furniture website tools",
      "furniture preview tool",
    ],
    hero: {
      headingLead: "Let Customers",
      headingGradient: "See Furniture in Their Space",
      headingTrail: "Before Buying",
      gradientFrom: "amber-600",
      gradientVia: "orange-600",
      gradientTo: "amber-800",
      accent: "amber-600",
    },
    features: [
      "Living room furniture",
      "Bedroom furniture",
      "Dining room sets",
      "Office furniture",
    ],
  },
  {
    slug: "landscaping",
    name: "Landscaping",
    shortTagline: "Perfect for Landscaping",
    metaTitle: "Landscaping AI Visualization Widget | Adventure",
    metaDescription:
      "Outdoor design visualization for landscaping projects. Help customers preview gardens, hardscapes, and more before committing.",
    keywords: [
      "landscaping software",
      "garden visualization",
      "outdoor design tool",
      "landscape widget",
    ],
    hero: {
      headingLead: "Let Homeowners",
      headingGradient: "See Outdoor Designs",
      headingTrail: "Before Breaking Ground",
      gradientFrom: "green-600",
      gradientTo: "emerald-700",
      accent: "green-600",
    },
    features: [
      "Garden design",
      "Hardscaping",
      "Tree & shrub planting",
      "Water features",
    ],
  },
];

export function getServiceBySlug(slug: string): ServiceConfig | undefined {
  return SERVICES.find((s) => s.slug === slug);
}

