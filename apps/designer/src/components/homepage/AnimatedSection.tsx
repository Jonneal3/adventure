"use client"

import { motion } from "framer-motion"
import { useScrollAnimation, scrollAnimations } from "@/hooks"

interface AnimatedSectionProps {
  children: React.ReactNode
  className?: string
  animation?: keyof typeof scrollAnimations
  delay?: number
  duration?: number
}

export default function AnimatedSection({ 
  children, 
  className = "", 
  animation = "fadeUp",
  delay = 0,
  duration = 0.6
}: AnimatedSectionProps) {
  const { ref, isInView } = useScrollAnimation()

  const customVariants = {
    hidden: { 
      ...scrollAnimations[animation].hidden,
      transition: { duration, delay }
    },
    visible: { 
      ...scrollAnimations[animation].visible,
      transition: { 
        duration,
        delay,
        ease: "easeOut"
      }
    }
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={customVariants}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  )
}

// Example usage components
export function AnimatedCard({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <AnimatedSection animation="scaleIn" className={className}>
      {children}
    </AnimatedSection>
  )
}

export function AnimatedList({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  const { ref, isInView } = useScrollAnimation()

  return (
    <motion.div
      ref={ref}
      className={className}
      variants={scrollAnimations.staggerContainer}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
    >
      {children}
    </motion.div>
  )
}

export function AnimatedListItem({ children, className = "" }: { children: React.ReactNode, className?: string }) {
  return (
    <motion.div
      className={className}
      variants={scrollAnimations.staggerChildren}
    >
      {children}
    </motion.div>
  )
} 