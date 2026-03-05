"use client"

import { motion, AnimatePresence } from "framer-motion"
import { ReactNode } from "react"
import { SectionType } from '@/hooks/use-section-transition';

interface SectionContainerProps {
  sectionType: SectionType
  currentSection: SectionType
  isTransitioning: boolean
  children: ReactNode
  className?: string
}

export default function SectionContainer({
  sectionType,
  currentSection,
  isTransitioning,
  children,
  className = ""
}: SectionContainerProps) {
  const isActive = currentSection === sectionType

  const variants = {
    enter: {
      opacity: 0,
      y: 50,
      scale: 0.95,
      transition: {
        duration: 0.3,
        ease: "easeOut"
      }
    },
    center: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    },
    exit: {
      opacity: 0,
      y: -50,
      scale: 0.95,
      transition: {
        duration: 0.3,
        ease: "easeIn"
      }
    }
  }

  return (
    <AnimatePresence mode="wait">
      {isActive && (
        <motion.div
          key={sectionType}
          className={`h-screen w-full overflow-hidden ${className}`}
          style={{ overflow: 'hidden' }}
          variants={variants}
          initial="enter"
          animate="center"
          exit="exit"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
} 