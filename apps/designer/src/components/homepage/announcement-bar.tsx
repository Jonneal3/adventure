"use client"

import { useState, useEffect } from "react"
import { usePathname } from "next/navigation"
import { X } from "lucide-react"
import { motion } from "framer-motion"

const isEnabled = process.env.NEXT_PUBLIC_ANNOUNCEMENT_ENABLED === "true"
const message = process.env.NEXT_PUBLIC_ANNOUNCEMENT_MESSAGE

export default function AnnouncementBar() {
  const [isVisible, setIsVisible] = useState(false)
  const [isClient, setIsClient] = useState(false)
  const [isLoaded, setIsLoaded] = useState(false)
  const pathname = usePathname()
  
  useEffect(() => {
    setIsClient(true)
    // Delay showing the announcement bar to be the last thing to load
    const timer = setTimeout(() => {
      setIsLoaded(true)
      setIsVisible(true)
    }, 1000) // 1 second delay

    return () => clearTimeout(timer)
  }, [])
  
  // Hide on design pages to save space
  const isDesignPage = isClient && pathname?.includes('/designer-instances/') && pathname?.includes('/[instanceId]')

  if (!isEnabled || !isVisible || isDesignPage || !isLoaded) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 py-2 px-4 text-center text-sm border-b border-gray-800 dark:border-gray-200 transition-all duration-500"
    >
      <div className="container mx-auto flex items-center justify-center">
        <p className="font-medium">{message}</p>
        <button
          onClick={() => setIsVisible(false)}
          className="absolute right-4 top-1/2 -translate-y-1/2 text-white/80 dark:text-gray-700 hover:text-white dark:hover:text-gray-900 transition-colors duration-300"
          aria-label="Close announcement"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </motion.div>
  )
}


