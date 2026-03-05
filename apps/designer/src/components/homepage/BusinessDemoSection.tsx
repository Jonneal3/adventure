"use client"

import React, { useState, useRef, useEffect } from "react"
import { motion, useInView, AnimatePresence } from "framer-motion"
import { Building2, TreePine, Home, ArrowRight, Sparkles } from "lucide-react"
import { Button } from "../ui/button"

interface BusinessDemo {
  id: string
  name: string
  type: string
  icon: React.ReactNode
  prompt: string
  color: string
}

export default function BusinessDemoSection() {
  const [activeIndex, setActiveIndex] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const isInView = useInView(ref, { once: true, amount: 0.3 })

  const businessDemos: BusinessDemo[] = [
    {
      id: "thrift",
      name: "Dave's Thrift Store",
      type: "Online vintage shop",
      icon: <Building2 className="h-5 w-5" />,
      prompt: "Generate a rustic product display with vintage accessories",
      color: "blue"
    },
    {
      id: "landscaping", 
      name: "Luxe Landscaping Co.",
      type: "Backyard design specialist",
      icon: <TreePine className="h-5 w-5" />,
      prompt: "Design a modern backyard oasis with outdoor seating",
      color: "green"
    },
    {
      id: "interiors",
      name: "Bella Interiors", 
      type: "Home staging & design",
      icon: <Home className="h-5 w-5" />,
      prompt: "Create a cozy living room with modern farmhouse style",
      color: "purple"
    }
  ]

  // Auto-rotate every 4 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % businessDemos.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [businessDemos.length])

  const currentDemo = businessDemos[activeIndex]

  return (
    <section ref={ref} className="py-12 md:py-16 bg-gray-50/30 dark:bg-gray-900/10 transition-colors duration-500">
      <div className="container px-4 md:px-6 mx-auto max-w-4xl">
        
        {/* Compact Header */}
        <motion.div 
          className="text-center mb-8 space-y-3"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 20 }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-block px-3 py-1 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-full text-xs bg-gray-50/50 dark:bg-gray-900/20 transition-colors duration-300">
            <Sparkles className="h-3 w-3 mr-1 inline" />
            See It in Action
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white transition-colors duration-300">
            How businesses use our AI widget
          </h2>
        </motion.div>

        {/* Single Rotating Demo */}
        <motion.div
          className="bg-white dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg p-6 md:p-8 transition-colors duration-300"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: isInView ? 1 : 0, y: isInView ? 0 : 30 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={activeIndex}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.5 }}
            >
              {/* Business Header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-gray-100 dark:bg-gray-700 rounded-lg transition-colors duration-300">
                    {currentDemo.icon}
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white transition-colors duration-300">
                      {currentDemo.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 transition-colors duration-300">
                      {currentDemo.type}
                    </p>
                  </div>
                </div>
                
                {/* Business Indicators */}
                <div className="flex gap-2">
                  {businessDemos.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveIndex(index)}
                      className={`w-2 h-2 rounded-full transition-all duration-300 ${
                        index === activeIndex 
                          ? 'bg-gray-900 dark:bg-white' 
                          : 'bg-gray-300 dark:bg-gray-600'
                      }`}
                    />
                  ))}
                </div>
              </div>

              {/* Demo Content */}
              <div className="grid md:grid-cols-2 gap-6 items-center">
                
                {/* Left: Prompt */}
                <div className="space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 dark:text-gray-500 mb-2 font-medium">
                      CUSTOMER ENTERS:
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md p-3 text-sm text-gray-700 dark:text-gray-300 transition-colors duration-300">
                      "{currentDemo.prompt}"
                    </div>
                  </div>
                  
                  <Button 
                    size="sm" 
                    className="bg-gray-900 hover:bg-gray-800 text-white transition-all duration-300"
                  >
                    Try This Example
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Button>
                </div>

                {/* Right: Before/After */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="relative aspect-square">
                    <div className="absolute top-2 left-2 z-10 bg-white/90 dark:bg-gray-800/90 text-gray-700 dark:text-gray-300 text-xs px-2 py-1 rounded-full">
                      Before
                    </div>
                    <div className="w-full h-full bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center text-gray-400 dark:text-gray-500 text-xs">
                      Original
                    </div>
                  </div>
                  
                  <div className="relative aspect-square">
                    <div className="absolute top-2 left-2 z-10 bg-gray-900/90 dark:bg-white/90 text-white dark:text-gray-900 text-xs px-2 py-1 rounded-full">
                      AI Result
                    </div>
                    <div className="w-full h-full bg-gradient-to-br from-gray-100 to-gray-200 dark:from-gray-800/30 dark:to-gray-700/30 rounded-md flex items-center justify-center text-gray-700 dark:text-gray-300 text-xs font-medium">
                      Generated
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* Simple CTA */}
        <motion.div 
          className="text-center mt-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: isInView ? 1 : 0 }}
          transition={{ duration: 0.6, delay: 0.6 }}
        >
          <p className="text-gray-600 dark:text-gray-400 text-xs transition-colors duration-300">
            Ready to add this to your site? <span className="text-gray-900 dark:text-white">Start free trial →</span>
          </p>
        </motion.div>
      </div>
    </section>
  )
} 