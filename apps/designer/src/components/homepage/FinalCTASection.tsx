"use client"

import Link from "next/link"
import { ArrowRight, CheckCircle } from "lucide-react"
import { Button } from "../ui/button"

const benefits = [
  "14-day free trial",
  "No credit card required",
  "Cancel anytime",
  "24/7 support",
  "White-label solution",
  "Analytics dashboard"
]

export default function FinalCTASection() {
  return (
    <section className="py-24 md:py-32 px-4 md:px-12 bg-white dark:bg-black transition-all duration-500">
      <div className="max-w-4xl mx-auto text-center space-y-8">
        <div className="space-y-6">
          <div className="inline-block px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm bg-gray-50/50 dark:bg-gray-900/20 transition-colors duration-300">
            Ready to Get Started?
          </div>
          
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-balance leading-tight text-gray-900 dark:text-white transition-colors duration-300">
            Transform Your Business Today
          </h2>
          
          <p className="text-lg md:text-xl text-gray-600 dark:text-gray-400 max-w-prose mx-auto text-balance leading-relaxed transition-colors duration-300">
            Join thousands of businesses that have increased conversions and customer satisfaction 
            with our AI-powered visualization widgets.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 mb-8">
          <Link href="/auth" className="w-full sm:w-auto">
            <Button 
              size="lg" 
              className="group w-full sm:w-auto bg-gray-900 hover:bg-gray-800 text-white transition-all duration-300 border-0 shadow-md hover:shadow-lg"
            >
              Start Free Trial
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Button>
          </Link>
          <Link href="#pricing" className="w-full sm:w-auto">
            <Button 
              size="lg" 
              variant="outline" 
              className="w-full sm:w-auto bg-transparent hover:bg-gray-50 border-gray-300 text-gray-700 hover:text-gray-900 dark:bg-transparent dark:hover:bg-gray-900 dark:border-gray-700 dark:text-gray-300 dark:hover:text-white transition-all duration-300"
            >
              View Pricing
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap justify-center gap-2 md:gap-3 max-w-3xl mx-auto">
			{benefits.map((benefit, index) => (
				<div
					key={index}
					className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-gray-800 bg-gray-50/60 dark:bg-gray-900/40 px-3 py-1.5 text-[12px] md:text-sm text-gray-700 dark:text-gray-300"
				>
					<CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />
					<span className="font-medium whitespace-nowrap">{benefit}</span>
				</div>
			))}
		</div>
      </div>
    </section>
  )
} 