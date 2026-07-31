/**
 * Pricing lead gates: V1 captures email only. Name and phone copy remains for
 * consultation-specific follow-up surfaces outside the pricing funnel.
 */
export const PRICING_LEAD_COPY = {
  title: "Your personalized concept and price range are ready.",
  description: "Enter your email to reveal pricing, save this design, and keep editing.",
  finePrint: "Email only. Your concept and progress stay together.",
  ctaLabel: "Reveal my estimate",
  emailPlaceholder: "Enter your email",
  nameTitle: "Make it yours",
  nameDescription: "What name should appear with your design?",
  namePlaceholder: "Your full name",
  nameCtaLabel: "Continue",
  nameFinePrint: "Used to personalize your studio.",
  phoneTitle: "Keep your studio connected",
  phoneDescription: "Add a mobile number for your concept, estimate, and project follow-up.",
  phoneCtaLabel: "Open my studio",
  phoneFinePrint: "Only useful project follow-up.",
} as const;
