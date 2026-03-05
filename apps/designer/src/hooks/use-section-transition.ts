import { useState, useCallback } from 'react'

export type SectionType = 'hero' | 'brands' | 'process' | 'features' | 'examples' | 'testimonials' | 'pricing' | 'faq' | 'cta'

export interface SectionTransitionOptions {
  duration?: number
  easing?: string
}

export function useSectionTransition(initialSection: SectionType = 'hero') {
  const [currentSection, setCurrentSection] = useState<SectionType>(initialSection)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const sections: SectionType[] = [
    'hero',
    'brands', 
    'process',
    'features',
    'examples',
    'testimonials',
    'pricing',
    'faq',
    'cta'
  ]

  const goToSection = useCallback((section: SectionType) => {
    if (isTransitioning || section === currentSection) return
    
    setIsTransitioning(true)
    setCurrentSection(section)
    
    // Reset transition state after animation
    setTimeout(() => {
      setIsTransitioning(false)
    }, 800) // Match animation duration
  }, [currentSection, isTransitioning])

  const goToNext = useCallback(() => {
    const currentIndex = sections.indexOf(currentSection)
    const nextIndex = (currentIndex + 1) % sections.length
    goToSection(sections[nextIndex])
  }, [currentSection, sections, goToSection])

  const goToPrevious = useCallback(() => {
    const currentIndex = sections.indexOf(currentSection)
    const prevIndex = currentIndex === 0 ? sections.length - 1 : currentIndex - 1
    goToSection(sections[prevIndex])
  }, [currentSection, sections, goToSection])

  const goToFirst = useCallback(() => {
    goToSection('hero')
  }, [goToSection])

  const goToLast = useCallback(() => {
    goToSection('cta')
  }, [goToSection])

  return {
    currentSection,
    isTransitioning,
    goToSection,
    goToNext,
    goToPrevious,
    goToFirst,
    goToLast,
    sections
  }
} 