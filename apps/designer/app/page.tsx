"use client";

import { useRef, Suspense } from "react";
import dynamic from "next/dynamic";

// Dynamically import HeroSection with loading fallback
const HeroSection = dynamic(() => import("@/components/homepage/HeroSection"), {
  loading: () => (
    <div className="w-full max-w-4xl mx-auto text-center space-y-6 animate-pulse">
      <div className="h-8 w-32 bg-gray-200 dark:bg-white/10 rounded mx-auto"></div>
      <div className="h-24 w-full max-w-2xl bg-gray-200 dark:bg-white/10 rounded mx-auto"></div>
      <div className="h-12 w-48 bg-gray-200 dark:bg-white/10 rounded mx-auto"></div>
    </div>
  ),
  ssr: false, // Disable SSR for this component since it uses browser APIs
});

export default function HomePage() {
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="bg-white dark:bg-black">
      <main>
        <div
          ref={containerRef}
          className="relative w-full bg-white dark:bg-black transition-colors duration-500"
        >
          <div className="relative box-border min-h-[calc(100vh-4rem)] flex items-start md:items-center justify-center overflow-x-hidden animate-in fade-in slide-in-from-bottom-4 duration-700 ease-out motion-reduce:animate-none">
            <Suspense
              fallback={
                <div className="w-full max-w-4xl mx-auto text-center space-y-6 animate-pulse">
                  <div className="h-8 w-32 bg-gray-200 dark:bg-white/10 rounded mx-auto"></div>
                  <div className="h-24 w-full max-w-2xl bg-gray-200 dark:bg-white/10 rounded mx-auto"></div>
                  <div className="h-12 w-48 bg-gray-200 dark:bg-white/10 rounded mx-auto"></div>
                </div>
              }
            >
              <HeroSection />
            </Suspense>
          </div>
        </div>
      </main>
    </div>
  );
}
