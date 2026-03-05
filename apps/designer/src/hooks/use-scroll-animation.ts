import { useInView } from "framer-motion"
import { useRef } from "react"

export interface ScrollAnimationOptions {
  threshold?: number
  once?: boolean
  amount?: number
  margin?: string
}

export function useScrollAnimation(options: ScrollAnimationOptions = {}) {
  const ref = useRef(null)
  const isInView = useInView(ref, {
    once: options.once ?? true,
    amount: options.amount ?? 0.3,
    margin: options.margin ?? "0px 0px -100px 0px"
  })

  return { ref, isInView }
}

// Predefined animation variants for common effects
export const scrollAnimations = {
  // Fade in from bottom
  fadeUp: {
    hidden: { 
      opacity: 0, 
      y: 50,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  },

  // Fade in from top
  fadeDown: {
    hidden: { 
      opacity: 0, 
      y: -50,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      y: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  },

  // Fade in from left
  fadeLeft: {
    hidden: { 
      opacity: 0, 
      x: -50,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  },

  // Fade in from right
  fadeRight: {
    hidden: { 
      opacity: 0, 
      x: 50,
      scale: 0.95
    },
    visible: { 
      opacity: 1, 
      x: 0,
      scale: 1,
      transition: {
        duration: 0.6,
        ease: "easeOut"
      }
    }
  },

  // Scale in
  scaleIn: {
    hidden: { 
      opacity: 0, 
      scale: 0.8
    },
    visible: { 
      opacity: 1, 
      scale: 1,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  },

  // Slide in from bottom with bounce
  slideUpBounce: {
    hidden: { 
      opacity: 0, 
      y: 100
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.8,
        ease: [0.25, 0.46, 0.45, 0.94] // Custom easing for bounce effect
      }
    }
  },

  // Stagger children animation
  staggerContainer: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  },

  // Stagger children with fade up
  staggerChildren: {
    hidden: { 
      opacity: 0, 
      y: 30 
    },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        ease: "easeOut"
      }
    }
  }
} 