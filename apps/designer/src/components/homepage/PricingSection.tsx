import { Badge } from "../ui/badge"
import { Sparkles } from "lucide-react"
import { ModernPricing } from "./modern-pricing"

export default function PricingSection() {
  return (
    <section id="pricing" className="border-t py-16 md:py-24 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-500">
      <div className="container px-4 md:px-6 mx-auto">
        <div className="flex flex-col items-center justify-center gap-4 text-center md:gap-6 mb-12">
          <Badge variant="secondary" className="mb-2 px-4 py-2 bg-gray-50/50 dark:bg-gray-900/20 text-gray-700 dark:text-gray-300 border-gray-300 dark:border-gray-700">
            <Sparkles className="h-4 w-4 mr-2" />
            Simple Pricing
          </Badge>
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl md:text-4xl text-gray-900 dark:text-white transition-colors duration-300">
            Choose Your Plan
          </h2>
          <p className="max-w-[600px] text-gray-600 dark:text-gray-400 transition-colors duration-300">
            Start with a 14-day free trial. No credit card required. Choose the plan that fits your business needs.
          </p>
        </div>
        <div className="max-w-5xl mx-auto">
          <ModernPricing />
        </div>
      </div>
    </section>
  )
}