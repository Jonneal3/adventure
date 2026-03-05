"use client"

import { Badge } from "../ui/badge"
import { Sparkles, Code2, Palette, Users } from "lucide-react"

export default function HowItWorksSection() {
  const steps = [
    {
      title: "Configure your widget",
      description:
        "Pick your industry, goal, and brand style once in the dashboard. We handle the AI prompts and flows underneath.",
      icon: <Palette className="h-5 w-5" />,
    },
    {
      title: "Paste one line of code",
      description:
        "Drop a single embed snippet into your site builder or CMS. No backend changes or heavy integration required.",
      icon: <Code2 className="h-5 w-5" />,
    },
    {
      title: "Visitors see their design",
      description:
        "Your website visitors answer a few questions and instantly see tailored designs for their space or product.",
      icon: <Sparkles className="h-5 w-5" />,
    },
    {
      title: "You capture qualified leads",
      description:
        "Every download or saved design can create a contact in your CRM or email tool with full context.",
      icon: <Users className="h-5 w-5" />,
    },
  ]

  return (
    <section className="border-t bg-white dark:bg-black py-16 md:py-24">
      <div className="container px-4 md:px-6 mx-auto max-w-6xl">
        <div className="flex flex-col items-center text-center gap-4 mb-12">
          <Badge variant="secondary" className="px-3 py-1 border">
            <Sparkles className="h-4 w-4 mr-1" />
            How installation works
          </Badge>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold tracking-tight text-gray-900 dark:text-white">
            From snippet to live leads in minutes
          </h2>
          <p className="max-w-xl text-sm md:text-base text-gray-600 dark:text-gray-400">
            The same flow your visitors just saw in the demo is what you&apos;ll
            run on your real site—no complex onboarding, just paste and go.
          </p>
        </div>

        <div className="grid gap-6 md:gap-8 md:grid-cols-2 lg:grid-cols-4">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative rounded-2xl border border-gray-200 dark:border-gray-800 bg-gray-50/70 dark:bg-gray-950/60 p-5 flex flex-col gap-3 shadow-sm"
            >
              <div className="inline-flex items-center justify-center rounded-full bg-white dark:bg-black border border-gray-200 dark:border-gray-800 h-9 w-9">
                <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                  {index + 1}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <div className="text-gray-900 dark:text-white">{step.icon}</div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  {step.title}
                </h3>
              </div>
              <p className="text-xs md:text-sm text-gray-600 dark:text-gray-400">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

