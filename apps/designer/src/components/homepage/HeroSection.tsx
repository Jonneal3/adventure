"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroGuidedDemo, {
  HERO_INDUSTRY_OPTIONS,
  type IndustryId,
} from "./HeroGuidedDemo";

export default function HeroSection() {
  const [industryId, setIndustryId] = useState<IndustryId>(() => "furniture");

  return (
    <section className="w-full max-w-[1320px] mx-auto px-4 md:px-8 py-10 md:py-0">
      <div className="grid items-center gap-8 lg:gap-12 lg:grid-cols-2">
        <div className="text-left">
          <h1
            className="max-w-[22ch] text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight leading-[1.02] text-gray-900 dark:text-white font-fraunces"
          >
            The buying experience—clear, visual, and guided by AI.
          </h1>
          <p className="mt-5 max-w-[60ch] text-[15px] md:text-[16px] text-gray-600 dark:text-gray-400 leading-relaxed">
            Show customers exactly what they’re buying before the sale, with
            AI‑guided visuals and conversations that turn uncertainty into
            confident decisions.
          </p>

          <div className="mt-7 flex flex-col sm:flex-row sm:items-center gap-3">
            <Button asChild size="lg" className="rounded-full px-7">
              <Link href="/auth">
                Get started <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full px-7"
            >
              <Link href="/playground">Demo playground</Link>
            </Button>
          </div>
        </div>

        <div className="w-full">
          <div className="mx-auto w-full max-w-[720px]">
            <div className="mb-2 flex w-full flex-wrap justify-center gap-2 text-center">
              {HERO_INDUSTRY_OPTIONS.map((opt) => {
                const selected = opt.id === industryId;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setIndustryId(opt.id)}
                    aria-pressed={selected}
                    className={[
                      "inline-flex items-center justify-center rounded-full border px-2.5 py-0.5 text-[10px] transition-colors",
                      selected
                        ? "border-gray-900 bg-gray-900 text-white dark:border-white dark:bg-white dark:text-gray-900"
                        : "border-gray-200 bg-white/70 text-gray-700 hover:bg-white dark:border-gray-800 dark:bg-black/30 dark:text-gray-300 dark:hover:bg-black/40",
                    ].join(" ")}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <HeroGuidedDemo
              industryId={industryId}
              onIndustryChange={setIndustryId}
              showIndustrySelector={false}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
