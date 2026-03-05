"use client"

import React, { useRef } from "react"
import { motion, useInView } from "framer-motion"
import { Check, Sparkles } from "lucide-react"
import Link from "next/link"
import { Button } from "../ui/button"

export default function SimplePricingSection() {
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  return (
    <section id="pricing" ref={ref} className="py-16 md:py-24 bg-white dark:bg-black transition-colors duration-500">
      <div className="container px-4 md:px-6 mx-auto max-w-4xl">
        
        {/* Section Header */}
        <motion.div 
          className="text-center mb-12 space-y-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-sm bg-gray-50/50 dark:bg-gray-900/20 transition-colors duration-300">
            <Sparkles className="h-4 w-4 mr-2 inline" />
            Simple Pricing
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
            Start free, scale as you grow
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto transition-colors duration-300">
            No setup fees, no hidden costs. Pay only for what you use.
          </p>
        </motion.div>

        {/* Pricing Card */}
        <motion.div
          className="max-w-md mx-auto"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <div className="bg-white dark:bg-gray-800/50 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-8 text-center transition-colors duration-300">
            
            {/* Price */}
            <div className="mb-6">
              <div className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
                Free
              </div>
              <div className="text-gray-600 dark:text-gray-400 transition-colors duration-300">
                to start, then pay-per-use
              </div>
            </div>

            {/* Features */}
            <div className="space-y-4 mb-8">
              {[
                "Unlimited widget embeds",
                "Custom branding & styling", 
                "Lead capture included",
                "AI image generation",
                "Mobile responsive",
                "5-minute setup"
              ].map((feature, index) => (
                <div key={index} className="flex items-center gap-3">
                  <div className="flex-shrink-0 w-5 h-5 bg-gray-200 dark:bg-gray-800/40 rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-gray-900 dark:text-white" />
                  </div>
                  <span className="text-gray-700 dark:text-gray-300 text-left transition-colors duration-300">
                    {feature}
                  </span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link href="/auth" className="w-full block">
              <Button 
                size="lg" 
                className="w-full bg-gray-900 hover:bg-gray-800 text-white transition-all duration-300 border-0 shadow-md hover:shadow-lg"
              >
                Start Free Trial
              </Button>
            </Link>
            
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 transition-colors duration-300">
              No credit card required • Cancel anytime
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  )
} 