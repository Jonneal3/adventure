"use client"

import Image from "next/image"
import { useEffect, useMemo, useState } from "react"
import { motion } from "framer-motion"
import { ArrowRight, CheckCircle2, MousePointer2 } from "lucide-react"
import {
  demoIndustries,
  type DemoIndustry,
  type DemoGoal,
  type DemoPlacement,
  type BrandVibe,
} from "@/config/demoIndustries"

type FormState = {
  industryId: string
  goal: DemoGoal
  placement: DemoPlacement
  brandVibe: BrandVibe
  wantsUploads: boolean
  wantsLeadCapture: boolean
  hasGenerated: boolean
  answers: Record<string, string | undefined>
}

const goalOptions: { value: DemoGoal; label: string }[] = [
  { value: "book_consult", label: "Book consultations" },
  { value: "request_quote", label: "Get quote requests" },
  { value: "buy_product", label: "Sell products" },
  { value: "capture_lead", label: "Grow email list" },
]

const placementOptions: { value: DemoPlacement; label: string }[] = [
  { value: "homepage_hero", label: "Homepage hero" },
  { value: "product_page", label: "Product pages" },
  { value: "portfolio_gallery", label: "Portfolio / gallery" },
  { value: "pricing_page", label: "Pricing page" },
]

const brandVibeOptions: { value: BrandVibe; label: string }[] = [
  { value: "modern", label: "Clean & modern" },
  { value: "luxury", label: "High-end & premium" },
  { value: "playful", label: "Fun & colorful" },
  { value: "earthy", label: "Natural & earthy" },
  { value: "minimal", label: "Ultra minimal" },
]

function getInitialState(): FormState {
  const firstIndustry = demoIndustries[0]
  return {
    industryId: firstIndustry?.id ?? "landscaping",
    goal: firstIndustry?.defaultGoal ?? "request_quote",
    placement: firstIndustry?.defaultPlacement ?? "homepage_hero",
    brandVibe: "modern",
    wantsUploads: true,
    wantsLeadCapture: true,
    hasGenerated: false,
    answers: {},
  }
}

function getIndustryById(id: string): DemoIndustry {
  return demoIndustries.find((i) => i.id === id) ?? demoIndustries[0]
}

function goalLabel(value: DemoGoal): string {
  return goalOptions.find((g) => g.value === value)?.label ?? "Book consultations"
}

function placementLabel(value: DemoPlacement): string {
  return placementOptions.find((p) => p.value === value)?.label ?? "Homepage hero"
}

function brandVibeLabel(value: BrandVibe): string {
  return brandVibeOptions.find((b) => b.value === value)?.label ?? "Clean & modern"
}

function getThemeClasses(colorToken: DemoIndustry["colorToken"]) {
  switch (colorToken) {
    case "emerald":
      return {
        pill: "border-emerald-200/70 bg-emerald-50/60 text-emerald-700 dark:border-emerald-400/40 dark:bg-emerald-900/30 dark:text-emerald-200",
        cta: "bg-emerald-600 hover:bg-emerald-700 text-white",
        badge: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-700",
        borderStrong: "border-emerald-200/80 dark:border-emerald-500/70",
      }
    case "amber":
      return {
        pill: "border-amber-200/70 bg-amber-50/60 text-amber-700 dark:border-amber-400/40 dark:bg-amber-900/30 dark:text-amber-200",
        cta: "bg-amber-600 hover:bg-amber-700 text-white",
        badge: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
        borderStrong: "border-amber-200/80 dark:border-amber-500/70",
      }
    case "purple":
      return {
        pill: "border-purple-200/70 bg-purple-50/60 text-purple-700 dark:border-purple-400/40 dark:bg-purple-900/30 dark:text-purple-200",
        cta: "bg-purple-600 hover:bg-purple-700 text-white",
        badge: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-200 dark:border-purple-700",
        borderStrong: "border-purple-200/80 dark:border-purple-500/70",
      }
    case "orange":
      return {
        pill: "border-orange-200/70 bg-orange-50/60 text-orange-700 dark:border-orange-400/40 dark:bg-orange-900/30 dark:text-orange-200",
        cta: "bg-orange-600 hover:bg-orange-700 text-white",
        badge: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-700",
        borderStrong: "border-orange-200/80 dark:border-orange-500/70",
      }
    case "pink":
      return {
        pill: "border-pink-200/70 bg-pink-50/60 text-pink-700 dark:border-pink-400/40 dark:bg-pink-900/30 dark:text-pink-200",
        cta: "bg-pink-600 hover:bg-pink-700 text-white",
        badge: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-900/30 dark:text-pink-200 dark:border-pink-700",
        borderStrong: "border-pink-200/80 dark:border-pink-500/70",
      }
  }
}

type DemoQuestion = {
  id: string
  label: string
  options: string[]
}

const industryQuestions: Record<string, DemoQuestion[]> = {
  landscaping: [
    {
      id: "area",
      label: "What part of the outdoor space are they dreaming about changing?",
      options: ["Front yard", "Back yard", "Side yard", "Patio / deck"],
    },
    {
      id: "vibe",
      label: "What should the space feel like once it’s finished?",
      options: ["Lush & green", "Low‑maintenance", "Perfect for entertaining", "Family friendly & safe"],
    },
    {
      id: "size",
      label: "Roughly how big is the area they want to work on?",
      options: ["A small corner", "One main zone", "Most of the yard", "The entire property"],
    },
  ],
  furniture: [
    {
      id: "room",
      label: "Which room are they trying to bring to life?",
      options: ["Living room", "Bedroom", "Home office", "Dining room"],
    },
    {
      id: "style",
      label: "What style should the room lean toward?",
      options: ["Modern & clean", "Cozy & layered", "Retro inspired", "Bold & colorful"],
    },
    {
      id: "budget",
      label: "What kind of budget are they working with for furniture?",
      options: ["Value focused", "Mid‑range mix", "Mostly premium pieces", "Open to a mix of all"],
    },
  ],
  fashion: [
    {
      id: "piece",
      label: "What are they mainly shopping for today?",
      options: ["A full outfit", "Just tops", "Just bottoms", "Accessories only"],
    },
    {
      id: "occasion",
      label: "What’s the main occasion they’re dressing for?",
      options: ["Everyday wear", "Work / professional", "Night out", "Special event"],
    },
    {
      id: "tone",
      label: "How would they describe their style vibe?",
      options: ["Minimal & neutral", "Colorful & playful", "Edgy & bold", "Classic & timeless"],
    },
  ],
  interior: [
    {
      id: "space",
      label: "Which space in the home are they planning to transform?",
      options: ["Living room", "Bedroom", "Kitchen", "Entryway / hallway"],
    },
    {
      id: "look",
      label: "How should the finished space feel when they walk in?",
      options: ["Bright & airy", "Warm & cozy", "Sleek & modern", "Bold & eclectic"],
    },
    {
      id: "ownership",
      label: "Are they renting or do they own the home?",
      options: ["Renting (limited changes)", "Own the home", "Not sure yet"],
    },
  ],
  bathroom: [
    {
      id: "scope",
      label: "What type of bathroom project are they planning?",
      options: ["Small refresh", "Full remodel", "New build", "Guest bath update"],
    },
    {
      id: "finish",
      label: "What finishes are they naturally drawn to?",
      options: ["Warm wood & stone", "All white & clean", "Moody & dark", "Colorful tile patterns"],
    },
    {
      id: "timeline",
      label: "When are they hoping to start this project?",
      options: ["ASAP", "In 1–3 months", "Later this year", "Just exploring ideas"],
    },
  ],
  default: [
    {
      id: "scenario",
      label: "What are visitors primarily hoping to visualize with your tool?",
      options: ["Room makeovers", "Products in their space", "Before / after results", "Multiple options side by side"],
    },
    {
      id: "confidence",
      label: "What would make them feel ready to say yes?",
      options: ["Seeing their exact space", "Comparing a few looks", "Clear before vs. after", "Price next to visuals"],
    },
  ],
}

function getQuestionsForIndustry(industryId: string): DemoQuestion[] {
  return industryQuestions[industryId] ?? industryQuestions.default
}

export default function HomepageExperience() {
  const [form, setForm] = useState<FormState>(() => getInitialState())
  const [hasUserInteracted, setHasUserInteracted] = useState(false)
  const [currentStep, setCurrentStep] = useState(0)
  const [demoStep, setDemoStep] = useState(0)
  const [cursorPos, setCursorPos] = useState<{ x: number; y: number }>({
    x: 32,
    y: 16,
  })
  const industry = useMemo(
    () => getIndustryById(form.industryId),
    [form.industryId]
  )
  const theme = getThemeClasses(industry.colorToken)
  const questions = useMemo(
    () => getQuestionsForIndustry(form.industryId),
    [form.industryId]
  )
  const totalSteps = questions.length + 1

  const handleGenerate = () => {
    setForm((prev) => ({ ...prev, hasGenerated: true }))
    setHasUserInteracted(true)
  }

  const goNext = () => {
    setHasUserInteracted(true)
    // Clear preview until we intentionally generate again.
    setForm((prev) => ({ ...prev, hasGenerated: false }))

    setCurrentStep((prev) => {
      // Question steps (0..questions.length-1) just move forward
      if (prev < questions.length - 1) {
        return prev + 1
      }
      // Last question step → generate and show image step
      if (prev === questions.length - 1) {
        setForm((current) => ({ ...current, hasGenerated: true }))
        return questions.length
      }
      // On the final image step, restart the flow.
      setForm(getInitialState())
      return 0
    })
  }

  const goBack = () => {
    setHasUserInteracted(true)
    setForm((prev) => ({ ...prev, hasGenerated: false }))
    setCurrentStep((prev) => (prev > 0 ? prev - 1 : 0))
  }

  // Simple auto-demo that moves a fake cursor through the form and
  // shows a generated preview. Stops as soon as the real user interacts.
  useEffect(() => {
    if (hasUserInteracted) return

    const timeouts: number[] = []
    const baseDelay = 1800

    const run = () => {
      if (hasUserInteracted) return

      // Reset base state but keep the currently selected industry
      setForm((prev) => ({
        ...getInitialState(),
        industryId: prev.industryId,
        goal: prev.goal,
        placement: prev.placement,
      }))

      const activeQuestions = getQuestionsForIndustry(form.industryId)
      const qCount = activeQuestions.length

      setDemoStep(0)
      setCurrentStep(0)
      // Move cursor over first question area
      setCursorPos({ x: 36, y: 26 })

      // For each question, move cursor and select the first option
      activeQuestions.forEach((q, index) => {
        timeouts.push(
          window.setTimeout(() => {
            if (hasUserInteracted) return
            setCurrentStep(index)
            setDemoStep(index + 1)
            setCursorPos({
              x: 40,
              y: 40 + index * 14,
            })
            setForm((prev) => ({
              ...prev,
              answers: {
                ...prev.answers,
                [q.id]: q.options[0],
              },
            }))
          }, baseDelay * (index + 1))
        )
      })

      // After last question, move to image step and generate
      timeouts.push(
        window.setTimeout(() => {
          if (hasUserInteracted) return
          setCurrentStep(qCount)
          setDemoStep(qCount + 1)
          setForm((prev) => ({ ...prev, hasGenerated: true }))
          setCursorPos({ x: 55, y: 70 })
        }, baseDelay * (qCount + 1))
      )

      // Hover near the image briefly
      timeouts.push(
        window.setTimeout(() => {
          if (hasUserInteracted) return
          setCursorPos({ x: 64, y: 44 })
        }, baseDelay * (qCount + 2))
      )

      // Loop again slowly
      timeouts.push(
        window.setTimeout(() => {
          if (hasUserInteracted) return
          run()
        }, baseDelay * (qCount + 4))
      )
    }

    // slight initial delay so hero can settle
    timeouts.push(
      window.setTimeout(() => {
        run()
      }, 1200)
    )

    return () => {
      timeouts.forEach((id) => window.clearTimeout(id))
    }
  }, [hasUserInteracted, questions])

  return (
    <div className="h-full flex flex-col text-left space-y-5">
      {/* Top-level industry toggles (like the old demo) */}
      <div className="flex flex-wrap justify-center gap-3">
        {demoIndustries.map((ind) => (
          <button
            key={ind.id}
            type="button"
            onClick={() => {
              setHasUserInteracted(true)
              setForm((prev) => ({
                ...prev,
                industryId: ind.id,
                goal: ind.defaultGoal,
                placement: ind.defaultPlacement,
                hasGenerated: false,
              }))
              setCurrentStep(0)
            }}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              form.industryId === ind.id
                ? "border-gray-900 dark:border-white bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                : "border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/80 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
            }`}
          >
            {ind.label}
          </button>
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative flex-1 rounded-2xl border border-gray-200/80 dark:border-gray-800/80 bg-white/80 dark:bg-black/60 shadow-sm overflow-hidden"
      >
        <div className="absolute inset-0 pointer-events-none opacity-50 dark:opacity-40">
          <div className="absolute -top-24 -left-24 h-56 w-56 rounded-full bg-gradient-to-br from-fuchsia-300/35 via-purple-300/25 to-transparent blur-3xl" />
          <div className="absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-gradient-to-tl from-amber-300/40 via-rose-300/25 to-transparent blur-3xl" />
        </div>

        <div className="relative z-10 h-full flex flex-col p-5 sm:p-7 md:p-8 space-y-4">
          {currentStep < totalSteps - 1 && (
            <>
              <div className="flex-1 flex flex-col items-center justify-center space-y-4">
                <div className="w-full flex items-center justify-between text-[10px] sm:text-[11px] text-gray-500 dark:text-gray-400">
                  <span>Step {Math.min(currentStep + 1, totalSteps)} of {totalSteps}</span>
                  <div className="flex gap-1">
                    {Array.from({ length: totalSteps }).map((_, i) => (
                      <span
                        key={i}
                        className={`h-1.5 w-4 rounded-full transition-colors ${
                          i === currentStep
                            ? "bg-gray-900 dark:bg-white"
                            : "bg-gray-200 dark:bg-gray-700"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                {/* Question steps */}
                {currentStep < questions.length && (
                  <div className="space-y-4 pt-3 w-full max-w-2xl">
                    {(() => {
                      const q = questions[currentStep]
                      return (
                        <>
                          <div className="text-[14px] sm:text-[16px] font-semibold text-gray-900 dark:text-gray-100">
                            {q.label}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {q.options.map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => {
                                  setHasUserInteracted(true)
                                  setForm((prev) => ({
                                    ...prev,
                                    answers: { ...prev.answers, [q.id]: opt },
                                  }))
                                }}
                                className={`rounded-lg border px-4 py-3 text-left text-[12px] sm:text-[13px] transition-colors ${
                                  form.answers[q.id] === opt
                                    ? "border-gray-900 dark:border-gray-200 bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                                    : "border-gray-200 dark:border-gray-700 bg-white/80 dark:bg-gray-900/70 text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                          </div>
                        </>
                      )
                    })()}
                  </div>
                )}

                {/* Image step intro */}
                {currentStep === questions.length && (
                  <div className="pt-2 text-[11px] sm:text-[12px] text-gray-600 dark:text-gray-400 max-w-md text-center">
                    You’re about to see a tailored example of what{" "}
                    <span className="font-medium text-gray-900 dark:text-gray-100">
                      {industry.label.toLowerCase()}
                    </span>{" "}
                    visitors could generate on your site.
                  </div>
                )}
              </div>

              {/* CTA */}
              <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={goNext}
                  className={`inline-flex items-center justify-center gap-1.5 rounded-full px-5 py-2 text-[12px] sm:text-[13px] font-medium shadow-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900 dark:focus-visible:ring-gray-100 ${theme.cta}`}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  <span>
                    {currentStep === questions.length
                      ? "Show sample design"
                      : "Next question"}
                  </span>
                </button>
                {currentStep > 0 && (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 px-3.5 py-1.5 text-[11px] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                  >
                    Back
                  </button>
                )}
              </div>
            </>
          )}
          {/* Final step: simple generated image preview */}
          {currentStep === totalSteps - 1 && (
            <div className="mt-2 flex-1 rounded-xl bg-white/90 dark:bg-black/80 border border-gray-200/80 dark:border-gray-800/80 p-3 flex flex-col gap-3">
              <div className="space-y-0.5">
                <div className="text-[11px] font-medium text-gray-900 dark:text-gray-100">
                  Sample design for {industry.label}
                </div>
                <p className="text-[10px] text-gray-600 dark:text-gray-400">
                  This is an example of the kind of image your visitor would see after they finish the steps.
                </p>
              </div>
              <div className="relative flex-1 min-h-[220px] rounded-xl overflow-hidden border border-gray-200/80 dark:border-gray-800/80 bg-gray-100 dark:bg-gray-900 shadow-sm">
                <Image
                  src={industry.assets.afterImage}
                  alt={`${industry.label} AI design`}
                  fill
                  sizes="(max-width: 1200px) 100vw, 720px"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute top-2 left-2 rounded-full bg-black/70 text-white text-[9px] px-2 py-0.5">
                  Generated sample
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center justify-center gap-1 rounded-full border border-gray-300 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 px-3 py-1 text-[10px] text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-800"
                >
                  <ArrowRight className="h-3 w-3" />
                  <span>Start again</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Demo cursor overlay (desktop only) */}
        {!hasUserInteracted && (
          <div className="pointer-events-none absolute inset-0 hidden md:block">
            <motion.div
              className="absolute -translate-x-2 -translate-y-2 z-20"
              animate={{
                left: `${cursorPos.x}%`,
                top: `${cursorPos.y}%`,
              }}
              transition={{ type: "spring", stiffness: 220, damping: 22, mass: 0.6 }}
            >
              <div className="flex items-center gap-1">
                <MousePointer2 className="h-4 w-4 text-gray-900 dark:text-white drop-shadow-sm" />
                <span className="rounded-full bg-black/70 text-white text-[9px] px-2 py-0.5">
                  Demo visitor
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </motion.div>
    </div>
  )
}
