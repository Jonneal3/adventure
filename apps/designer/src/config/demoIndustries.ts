export type DemoGoal =
  | "book_consult"
  | "request_quote"
  | "buy_product"
  | "capture_lead";

export type DemoPlacement =
  | "homepage_hero"
  | "product_page"
  | "portfolio_gallery"
  | "pricing_page";

export type BrandVibe =
  | "modern"
  | "luxury"
  | "playful"
  | "earthy"
  | "minimal";

export interface DemoIndustryAssets {
  beforeImage: string;
  afterImage: string;
  thumbnailStrip: string[];
}

export interface DemoIndustryMetrics {
  labelBefore: string;
  labelAfter: string;
}

export interface DemoIndustry {
  id: string;
  label: string;
  /** Short context describing where on the site this widget typically lives */
  siteContext: string;
  defaultGoal: DemoGoal;
  defaultPlacement: DemoPlacement;
  defaultCtaLabel: string;
  heroSubtitle: string;
  colorToken:
    | "emerald"
    | "amber"
    | "purple"
    | "orange"
    | "pink";
  assets: DemoIndustryAssets;
  metrics: DemoIndustryMetrics;
}

export const demoIndustries: DemoIndustry[] = [
  {
    id: "landscaping",
    label: "Landscaping",
    siteContext: "Landscaping Services - Portfolio Section",
    defaultGoal: "request_quote",
    defaultPlacement: "portfolio_gallery",
    defaultCtaLabel: "Get a quote",
    heroSubtitle: "Professional landscaping design and installation.",
    colorToken: "emerald",
    assets: {
      beforeImage: "/homepage/landscaping/before.png",
      afterImage: "/homepage/landscaping/after.png",
      thumbnailStrip: [
        "/services/landscaping/landscaping1.png",
        "/services/landscaping/landscaping2.png",
        "/services/landscaping/landscaping3.png",
      ],
    },
    metrics: {
      labelBefore: "2% contact rate",
      labelAfter: "12% contact rate",
    },
  },
  {
    id: "furniture",
    label: "Furniture & Decor",
    siteContext: "Furniture Store - Product Pages",
    defaultGoal: "buy_product",
    defaultPlacement: "product_page",
    defaultCtaLabel: "Add to cart",
    heroSubtitle: "Quality furniture for every room.",
    colorToken: "amber",
    assets: {
      beforeImage: "/homepage/furniture/before.png",
      afterImage: "/homepage/furniture/after.png",
      thumbnailStrip: [
        "/services/furniture/furniture1.png",
        "/services/furniture/furniture2.png",
        "/services/furniture/furniture3.png",
      ],
    },
    metrics: {
      labelBefore: "3% add to cart",
      labelAfter: "18% add to cart",
    },
  },
  {
    id: "fashion",
    label: "Fashion & Beauty",
    siteContext: "Fashion Boutique - Try-On Experience",
    defaultGoal: "buy_product",
    defaultPlacement: "product_page",
    defaultCtaLabel: "Shop this look",
    heroSubtitle: "New arrivals and timeless essentials.",
    colorToken: "purple",
    assets: {
      beforeImage: "/homepage/fashion/before.png",
      afterImage: "/homepage/fashion/after.png",
      thumbnailStrip: [
        "/services/fashion/fashion1.png",
        "/services/fashion/fashion2.png",
        "/services/fashion/fashion3.png",
      ],
    },
    metrics: {
      labelBefore: "5% email signups",
      labelAfter: "28% email signups",
    },
  },
  {
    id: "interior",
    label: "Interior Design",
    siteContext: "Interior Design Studio - Consultation Widget",
    defaultGoal: "book_consult",
    defaultPlacement: "homepage_hero",
    defaultCtaLabel: "Book consult",
    heroSubtitle: "Personalized interior design for your home.",
    colorToken: "orange",
    assets: {
      beforeImage: "/homepage/interior/before.png",
      afterImage: "/homepage/interior/after.png",
      thumbnailStrip: [
        "/services/interior/interior1.png",
        "/services/interior/interior2.png",
        "/services/interior/interior3.png",
      ],
    },
    metrics: {
      labelBefore: "8% consultation bookings",
      labelAfter: "31% consultation bookings",
    },
  },
  {
    id: "bathroom",
    label: "Bathroom Remodeling",
    siteContext: "Bathroom Remodeling - Quote Request",
    defaultGoal: "request_quote",
    defaultPlacement: "homepage_hero",
    defaultCtaLabel: "Get my bathroom design",
    heroSubtitle: "Custom bathroom renovations from concept to completion.",
    colorToken: "pink",
    assets: {
      beforeImage: "/homepage/bathroom/before.png",
      afterImage: "/homepage/bathroom/after.png",
      thumbnailStrip: [
        "/services/bathroom/bathroom1.png",
        "/services/bathroom/bathroom2.png",
        "/services/bathroom/bathroom3.png",
      ],
    },
    metrics: {
      labelBefore: "4% quote requests",
      labelAfter: "22% quote requests",
    },
  },
];

