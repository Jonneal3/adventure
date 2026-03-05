import React, { useState, useEffect } from 'react';
import { DesignSettings } from '../../../types';

interface AutoDemoOverlayProps {
  onDismiss: () => void;
  config: DesignSettings;
}

interface TooltipStep {
  target: string;
  message: string;
  position: 'top' | 'bottom' | 'left' | 'right';
}

export function AutoDemoOverlay({ onDismiss, config }: AutoDemoOverlayProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [loopCount, setLoopCount] = useState(0);
  const [tooltipPosition, setTooltipPosition] = useState<{x: number, y: number, position: string} | null>(null);

  const steps: TooltipStep[] = [
    { target: '[data-tour="upload-area"]', message: '📸 Upload your reference images to guide the AI', position: 'bottom' },
    { target: '[data-tour="prompt-input"]', message: '✍️ Type what you want to create', position: 'top' },
    { target: '[data-tour="submit-button"]', message: '🚀 Click to generate images', position: 'left' },
    { target: '[data-tour="gallery-area"]', message: '✨ Your AI-generated images will appear here', position: 'top' },
  ];

  const stepTimings = [3000, 3500, 3000, 4000];

  // Calculate intelligent tooltip positioning
  const calculateTooltipPosition = (targetElement: Element, position: string) => {
    const rect = targetElement.getBoundingClientRect();
    const tooltipWidth = 200;
    const tooltipHeight = 50; // Increased height estimate
    const offset = 20; // Increased offset for better spacing

    let x = 0, y = 0;
    let finalPosition = position;

    // Calculate initial position
    switch (position) {
      case 'top':
        x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        y = rect.top - tooltipHeight - offset;
        // If tooltip would go off top of screen, use bottom instead
        if (y < 16) {
          finalPosition = 'bottom';
          y = rect.bottom + offset;
        }
        break;
      case 'bottom':
        x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
        y = rect.bottom + offset;
        // If tooltip would go off bottom of screen, use top instead
        if (y + tooltipHeight > window.innerHeight - 16) {
          finalPosition = 'top';
          y = rect.top - tooltipHeight - offset;
        }
        break;
      case 'left':
        x = rect.left - tooltipWidth - offset;
        y = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        // If tooltip would go off left of screen, use right instead
        if (x < 16) {
          finalPosition = 'right';
          x = rect.right + offset;
        }
        break;
      case 'right':
        x = rect.right + offset;
        y = rect.top + (rect.height / 2) - (tooltipHeight / 2);
        // If tooltip would go off right of screen, use left instead
        if (x + tooltipWidth > window.innerWidth - 16) {
          finalPosition = 'left';
          x = rect.left - tooltipWidth - offset;
        }
        break;
    }

    // Final boundary checks - keep tooltip fully on screen
    x = Math.max(16, Math.min(x, window.innerWidth - tooltipWidth - 16));
    y = Math.max(16, Math.min(y, window.innerHeight - tooltipHeight - 16));

    // For gallery area, force it to be above and more visible
    if (targetElement.matches('[data-tour="gallery-area"]')) {
      finalPosition = 'top';
      y = Math.max(16, rect.top - tooltipHeight - 30); // Extra offset above gallery
      x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      // Keep it on screen horizontally
      x = Math.max(16, Math.min(x, window.innerWidth - tooltipWidth - 16));
    }

    // For prompt input, position it clearly above with extra spacing
    if (targetElement.matches('[data-tour="prompt-input"]')) {
      finalPosition = 'top';
      y = Math.max(16, rect.top - tooltipHeight - 25); // Extra spacing above
      x = rect.left + (rect.width / 2) - (tooltipWidth / 2);
      // Keep it on screen horizontally
      x = Math.max(16, Math.min(x, window.innerWidth - tooltipWidth - 16));
    }

    return { x, y, position: finalPosition };
  };

  // Start tour
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsRunning(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Handle step progression and positioning
  useEffect(() => {
    if (!isRunning) return;

    const step = steps[currentStep];
    const targetElement = document.querySelector(step.target);
    
    if (targetElement) {
      // Highlight the element
      targetElement.classList.add('demo-highlight');
      
      // Position tooltip
      const position = calculateTooltipPosition(targetElement, step.position);
      setTooltipPosition(position);

      // Auto-advance
      const timer = setTimeout(() => {
        targetElement.classList.remove('demo-highlight');
        
        if (currentStep + 1 >= steps.length) {
          setLoopCount(prev => prev + 1);
          setCurrentStep(0);
        } else {
          setCurrentStep(prev => prev + 1);
        }
      }, stepTimings[currentStep] || 3000);

      return () => {
        clearTimeout(timer);
        targetElement.classList.remove('demo-highlight');
      };
    }
  }, [currentStep, isRunning]);

  // Auto-dismiss after loops
  useEffect(() => {
    if (loopCount >= (config.demo_loop_count ?? 3)) {
      setIsRunning(false);
      setTimeout(onDismiss, 1000);
    }
  }, [loopCount, onDismiss, config.demo_loop_count]);

  // Handle click-to-dismiss functionality
  useEffect(() => {
    if (!config.demo_click_to_dismiss) return;

    const handleGlobalClick = (e: MouseEvent) => {
      // Don't dismiss if clicking on the demo elements themselves
      const target = e.target as Element;
      if (target.closest('[data-tour]') || 
          target.closest('.demo-highlight') ||
          target.closest('.pointer-arrow') ||
          target.closest('button')) {
        return;
      }
      
      // Dismiss the demo permanently
      onDismiss();
    };

    document.addEventListener('click', handleGlobalClick);
    return () => document.removeEventListener('click', handleGlobalClick);
  }, [config.demo_click_to_dismiss, onDismiss]);

  if (!isRunning) {
    return null;
  }

  const currentStepData = steps[currentStep];

  return (
    <>
      {/* Elegant overlay */}
      <div 
        className="fixed inset-0 backdrop-blur-[1px] z-[9999]"
        style={{ 
          backgroundColor: config.overlay_background_color || 'rgba(0,0,0,0.3)',
          pointerEvents: 'none', // Always set to none since we use global click listener
          cursor: 'default'
        }}
      />
      
      {/* Custom positioned tooltip (render only when we have a target position) */}
      {tooltipPosition && (
      <div
        className="fixed z-[10002]"
        style={{
          left: tooltipPosition.x,
          top: tooltipPosition.y,
          animation: 'tooltip-appear 0.3s ease-out',
          pointerEvents: 'none' // Make tooltip non-interactive
        }}
      >
        <div className="relative">
          <div className="bg-black/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 max-w-[200px] relative z-[10003]">
            <p className="text-sm font-medium leading-relaxed text-center">{currentStepData.message}</p>
          </div>
          
          {/* Beautiful Arrow Pointer */}
          <div 
            className={`absolute pointer-arrow pointer-arrow-${tooltipPosition.position}`}
            style={{
              '--arrow-size': '8px'
            } as React.CSSProperties}
          />
        </div>
      </div>
      )}

      {/* Fallback tooltip when targets are not yet found */}
      {!tooltipPosition && (
        <div
          className="fixed inset-0 z-[10002] flex items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <div className="bg-black/90 backdrop-blur-md text-white px-4 py-3 rounded-xl shadow-2xl border border-white/10 max-w-[260px] text-center">
            <p className="text-sm font-medium leading-relaxed">
              Getting things ready… the walkthrough will start in a moment.
            </p>
          </div>
        </div>
      )}

      {/* Elegant dismiss button */}
      <button
        onClick={onDismiss}
        className="fixed top-6 right-6 z-[10001] w-10 h-10 bg-black/80 backdrop-blur-md text-white rounded-full border border-white/20 hover:bg-black/90 transition-all duration-200 flex items-center justify-center group"
      >
        <svg className="w-5 h-5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Click-to-dismiss instruction (only show when enabled) */}
      {config.demo_click_to_dismiss && (
        <div className="fixed bottom-6 left-6 z-[10001] bg-black/80 backdrop-blur-md text-white px-3 py-2 rounded-lg text-sm border border-white/20">
          💡 Click anywhere to dismiss
        </div>
      )}

      {/* Enhanced highlight styling */}
      <style jsx global>{`
        @keyframes tooltip-appear {
          from {
            opacity: 0;
            transform: translateY(8px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes demo-pulse {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }

        @keyframes image-shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }

        @keyframes gallery-sparkle {
          0%, 100% {
            transform: scale(1);
          }
          50% {
            transform: scale(1.03);
          }
        }

        @keyframes glitter {
          0%, 100% {
            opacity: 0;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes sparkle-cascade-top {
          0%, 10% {
            opacity: 0;
          }
          15%, 50% {
            opacity: 1;
          }
          55%, 100% {
            opacity: 0;
          }
        }

        @keyframes sparkle-cascade-middle {
          0%, 30% {
            opacity: 0;
          }
          35%, 70% {
            opacity: 1;
          }
          75%, 100% {
            opacity: 0;
          }
        }

        @keyframes sparkle-cascade-bottom {
          0%, 50% {
            opacity: 0;
          }
          55%, 95% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }

        .demo-highlight {
          position: relative;
          z-index: 10001;
          animation: demo-pulse 2s ease-in-out infinite;
          border-radius: 8px;
          filter: brightness(1.15);
        }

        /* Special handling for prompt input - cleaner brightness */
        [data-tour="prompt-input"].demo-highlight {
          filter: brightness(1.4) contrast(1.1);
        }

        /* Gallery gets magical sparkling effect */
        [data-tour="gallery-area"].demo-highlight {
          animation: gallery-sparkle 2s ease-in-out infinite;
          filter: brightness(1.1);
          position: relative;
          overflow: visible;
        }

        /* Remove the shimmer wave - not needed */
        [data-tour="gallery-area"].demo-highlight::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 20% 5%, rgba(255, 255, 255, 0.9) 2px, transparent 2px),
            radial-gradient(circle at 50% 8%, rgba(255, 255, 255, 0.8) 1.5px, transparent 1.5px),
            radial-gradient(circle at 80% 12%, rgba(255, 255, 255, 0.9) 2px, transparent 2px);
          background-size: 100px 100px, 80px 80px, 120px 120px;
          animation: sparkle-cascade-top 8s ease-in-out infinite;
          z-index: 10007;
          pointer-events: none;
        }

        /* Full gallery sparkle cascade effect */
        [data-tour="gallery-area"].demo-highlight::after {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-image: 
            radial-gradient(circle at 15% 50%, rgba(255, 255, 255, 0.8) 1.5px, transparent 1.5px),
            radial-gradient(circle at 60% 45%, rgba(255, 255, 255, 0.9) 2px, transparent 2px),
            radial-gradient(circle at 85% 55%, rgba(255, 255, 255, 0.7) 1.5px, transparent 1.5px),
            radial-gradient(circle at 25% 90%, rgba(255, 255, 255, 0.8) 2px, transparent 2px),
            radial-gradient(circle at 55% 88%, rgba(255, 255, 255, 0.9) 1.5px, transparent 1.5px),
            radial-gradient(circle at 75% 95%, rgba(255, 255, 255, 0.7) 2px, transparent 2px);
          background-size: 90px 90px, 110px 110px, 85px 85px, 95px 95px, 70px 70px, 100px 100px;
          animation: sparkle-cascade-bottom 8s ease-in-out infinite;
          z-index: 10006;
          pointer-events: none;
        }

        /* Beautiful Arrow Pointers */
        .pointer-arrow {
          --arrow-size: 8px;
          width: 0;
          height: 0;
          z-index: 10004;
        }

        /* Arrow pointing down (tooltip above target) */
        .pointer-arrow-top {
          top: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-left: var(--arrow-size) solid transparent;
          border-right: var(--arrow-size) solid transparent;
          border-top: var(--arrow-size) solid rgba(0, 0, 0, 0.9);
          filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
        }

        /* Arrow pointing up (tooltip below target) */
        .pointer-arrow-bottom {
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          border-left: var(--arrow-size) solid transparent;
          border-right: var(--arrow-size) solid transparent;
          border-bottom: var(--arrow-size) solid rgba(0, 0, 0, 0.9);
          filter: drop-shadow(0 -2px 4px rgba(0, 0, 0, 0.3));
        }

        /* Arrow pointing right (tooltip left of target) */
        .pointer-arrow-left {
          top: 50%;
          left: 100%;
          transform: translateY(-50%);
          border-top: var(--arrow-size) solid transparent;
          border-bottom: var(--arrow-size) solid transparent;
          border-left: var(--arrow-size) solid rgba(0, 0, 0, 0.9);
          filter: drop-shadow(2px 0 4px rgba(0, 0, 0, 0.3));
        }

        /* Arrow pointing left (tooltip right of target) */
        .pointer-arrow-right {
          top: 50%;
          right: 100%;
          transform: translateY(-50%);
          border-top: var(--arrow-size) solid transparent;
          border-bottom: var(--arrow-size) solid transparent;
          border-right: var(--arrow-size) solid rgba(0, 0, 0, 0.9);
          filter: drop-shadow(-2px 0 4px rgba(0, 0, 0, 0.3));
        }

        /* Enhanced arrow with subtle glow effect */
        .pointer-arrow::after {
          content: '';
          position: absolute;
          width: 100%;
          height: 100%;
          top: 0;
          left: 0;
          filter: blur(1px);
          opacity: 0.6;
        }
      `}</style>
    </>
  );
} 