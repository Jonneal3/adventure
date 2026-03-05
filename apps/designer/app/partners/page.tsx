"use client";

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Users, Check } from "lucide-react";

export default function PartnersPage() {
  return (
    <main className="min-h-[calc(100vh-48px)] md:min-h-[calc(100vh-56px)] overflow-hidden bg-white dark:bg-black flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-600 rounded-full mb-3">
            <Users className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Strategic Partnerships
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-xl mx-auto text-sm">
            Done-for-you, performance-driven lead systems for high-volume teams. Custom proposals, application required.
          </p>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 md:p-6">
          <div className="mb-3 text-center">
            <span className="inline-flex items-center px-3 py-1 text-[10px] font-medium bg-blue-600 text-white rounded-full">Partnership</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 text-center">Custom Engagement</h3>
          <p className="text-gray-700 dark:text-gray-300 mb-5 text-center max-w-xl mx-auto text-sm">
            Tailored setup, dedicated team, and enterprise-grade integrations. Pricing via proposal.
          </p>
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-w-xl mx-auto mb-6">
            {['White Labeling','API & Webhooks','Performance-based Revenue Share','Exclusivity Options','Dedicated Support','Advanced Analytics'].map((f) => (
              <li key={f} className="flex items-center text-sm text-gray-700 dark:text-gray-300">
                <Check className="h-4 w-4 text-green-500 mr-2 flex-shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <div className="text-center">
            <Link href="/auth?signup=true&plan=partner">
              <Button className="bg-blue-600 hover:bg-blue-700 text-white text-sm md:text-base px-5 py-2">
                Get Started
              </Button>
            </Link>
            <p className="text-[11px] text-gray-600 dark:text-gray-400 mt-2">Sign up, create an account, then choose Partner during billing.</p>
          </div>
        </div>
      </div>
    </main>
  );
}