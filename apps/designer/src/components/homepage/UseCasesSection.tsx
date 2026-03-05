"use client"

import {
  Scissors,
  ShoppingBag,
  Home,
  Palette,
  Building2,
} from "lucide-react"
import { demoIndustries } from "@/config/demoIndustries"

const useCases = [
  {
    id: "landscaping",
    title: "Landscaping & Outdoor Spaces",
    description:
      "Let visitors see their yard fully landscaped before they ever request a quote.",
    icon: <Home className="h-6 w-6" />,
  },
  {
    id: "furniture",
    title: "Furniture & Decor Brands",
    description:
      "Drop sofas, tables, and decor into a realistic room scene that matches the shopper’s space.",
    icon: <Home className="h-6 w-6" />,
  },
  {
    id: "fashion",
    title: "Fashion & Beauty",
    description:
      "Preview outfits, styles, or looks so customers feel confident before they buy.",
    icon: <ShoppingBag className="h-6 w-6" />,
  },
  {
    id: "interior",
    title: "Interior Designers & Studios",
    description:
      "Turn site visitors into qualified consults with AI concepts for their rooms.",
    icon: <Palette className="h-6 w-6" />,
  },
  {
    id: "bathroom",
    title: "Renovation & Remodeling",
    description:
      "Show bathroom and kitchen makeovers visually, then capture project details and contact info.",
    icon: <Building2 className="h-6 w-6" />,
  },
  {
    id: "other",
    title: "Other Visual Services",
    description:
      "Any business where seeing is believing can plug in a tailored AI preview flow.",
    icon: <Scissors className="h-6 w-6" />,
  },
].map((useCase) => {
  const industry =
    useCase.id === "other"
      ? undefined
      : demoIndustries.find((ind) => ind.id === useCase.id)

  return {
    ...useCase,
    siteContext: industry?.siteContext,
    metrics: industry?.metrics,
  }
})

export default function UseCasesSection() {
  return (
    <section className="py-24 md:py-32 px-4 md:px-12 bg-white dark:bg-black transition-all duration-500">
      <div className="max-w-6xl mx-auto text-center space-y-12">
        <div className="space-y-6">
          <div className="inline-block px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm bg-gray-50/50 dark:bg-gray-900/20 transition-colors duration-300">
            Use Cases
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-tight text-gray-900 dark:text-white transition-colors duration-300">
            Perfect for Any Business That Sells Visual Products
          </h2>
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-prose mx-auto text-balance leading-relaxed transition-colors duration-300">
            From hair salons to furniture stores, our AI widget helps customers visualize before they buy, 
            leading to higher conversions and customer satisfaction.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {useCases.map((useCase, index) => (
            <div
              key={index}
              className="p-8 border border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700 transition-all duration-300"
            >
              <div className="h-12 w-12 border border-gray-200 dark:border-gray-800 flex items-center justify-center mb-6">
                <div className="text-gray-600 dark:text-gray-400">
                  {useCase.icon}
                </div>
              </div>
              <h3 className="font-bold text-xl mb-4 text-balance text-gray-900 dark:text-white transition-colors duration-300">
                {useCase.title}
              </h3>
              <p className="text-gray-600 dark:text-gray-400 text-balance leading-relaxed transition-colors duration-300">
                {useCase.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
} 