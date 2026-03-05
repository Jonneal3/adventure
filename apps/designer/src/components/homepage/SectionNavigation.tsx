"use client"

import { motion } from "framer-motion"
import { ChevronUp, ChevronDown, Home, ArrowUp } from "lucide-react"
import { Button } from "../ui/button"
import { SectionType, useSectionTransition } from '@/hooks/use-section-transition';

interface SectionNavigationProps {
  currentSection: SectionType
  goToNext: () => void
  goToPrevious: () => void
  goToFirst: () => void
  isTransitioning: boolean
}

export default function SectionNavigation({
  currentSection,
  goToNext,
  goToPrevious,
  goToFirst,
  isTransitioning
}: SectionNavigationProps) {
  const sections = ['hero', 'brands', 'process', 'features', 'examples', 'testimonials', 'pricing', 'faq', 'cta']
  const currentIndex = sections.indexOf(currentSection)
  const isFirst = currentIndex === 0
  const isLast = currentIndex === sections.length - 1

  return (
    <div className="fixed right-[clamp(2%,3vw,4%)] top-1/2 transform -translate-y-1/2 z-50 flex flex-col gap-[clamp(0.5vh,1vw,1.5vh)]">
      {/* Section indicators */}
      <div className="flex flex-col gap-[clamp(0.3vh,0.5vw,0.8vh)]">
        {sections.map((section, index) => (
          <motion.button
            key={section}
            className={`w-[clamp(0.8vh,1.2vw,1.5vh)] h-[clamp(0.8vh,1.2vw,1.5vh)] rounded-full transition-all duration-300 ${
              currentSection === section
                ? 'bg-gray-900 dark:bg-white scale-125'
                : 'bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500'
            }`}
            onClick={() => {
              if (!isTransitioning) {
                // This would need to be passed as a prop or use context
                // For now, we'll just handle next/prev
              }
            }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.9 }}
            disabled={isTransitioning}
          />
        ))}
      </div>

      {/* Navigation buttons */}
      <div className="flex flex-col gap-[clamp(0.5vh,1vw,1.5vh)] mt-[clamp(1vh,2vw,3vh)]">
        <Button
          variant="outline"
          size="sm"
          onClick={goToPrevious}
          disabled={isTransitioning || isFirst}
          className="w-[clamp(2.5vh,3.5vw,4.5vh)] h-[clamp(2.5vh,3.5vw,4.5vh)] p-0 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800"
        >
          <ChevronUp 
            className="h-[clamp(1.2vh,1.8vw,2.2vh)] w-[clamp(1.2vh,1.8vw,2.2vh)]" 
          />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={goToFirst}
          disabled={isTransitioning || isFirst}
          className="w-[clamp(2.5vh,3.5vw,4.5vh)] h-[clamp(2.5vh,3.5vw,4.5vh)] p-0 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800"
        >
          <Home 
            className="h-[clamp(1.2vh,1.8vw,2.2vh)] w-[clamp(1.2vh,1.8vw,2.2vh)]" 
          />
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={goToNext}
          disabled={isTransitioning || isLast}
          className="w-[clamp(2.5vh,3.5vw,4.5vh)] h-[clamp(2.5vh,3.5vw,4.5vh)] p-0 rounded-full bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border-gray-200 dark:border-gray-700 hover:bg-white dark:hover:bg-slate-800"
        >
          <ChevronDown 
            className="h-[clamp(1.2vh,1.8vw,2.2vh)] w-[clamp(1.2vh,1.8vw,2.2vh)]" 
          />
        </Button>
      </div>

      {/* Progress indicator */}
      <div className="mt-[clamp(1vh,2vw,3vh)] text-center">
        <span 
          className="text-xs text-muted-foreground"
          style={{
            fontSize: 'clamp(0.7rem, 1vw, 0.9rem)'
          }}
        >
          {currentIndex + 1} / {sections.length}
        </span>
      </div>
    </div>
  )
} 