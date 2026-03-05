"use client"

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { Check, Image as ImageIcon, Mail, Phone } from 'lucide-react'

export interface Plan {
  ai_credits_included: number
  additional_credit_price: number | null
  analytics_level: string
  api_access: boolean
  exclusivity: boolean
  is_pricing_custom: boolean
  lead_capture_level: string
  max_widgets: number | null
  monthly_price_cents: number | null
  name: string
  onboarding_type: string
  plan_id: string
  prompt_packs_level: string
  revenue_share: boolean
  support_level: string
  white_label: boolean
}

function formatPrice(cents: number | null) {
  if (cents === null || cents === 0) return 'Free'
  return `$${(cents / 100).toLocaleString()}`
}

function formatAdditionalCreditPrice(price: number | null) {
  if (price === null || price === 0) return null
  const normalized = price > 5 ? price / 100 : price
  return `$${normalized.toFixed(2)}/credit`
}

function getAdditionalCreditPriceDollars(price: number | null) {
  if (price === null || price === 0) return null
  return price > 5 ? price / 100 : price
}

function getPlanFeatures(plan: Plan): string[] {
  const features: string[] = []

  if (plan.ai_credits_included === 999999) {
    features.push('Unlimited AI Credits')
  } else {
    features.push(`${plan.ai_credits_included?.toLocaleString() || 0} AI Credits/month`)
  }

  if (plan.max_widgets === null) {
    features.push('Unlimited Widgets')
  } else {
    features.push(`${plan.max_widgets} Widgets`)
  }

  switch (plan.lead_capture_level) {
    case 'basic': features.push('Basic Lead Capture'); break
    case 'crm': features.push('CRM Integration'); break
    case 'api': features.push('API Access & Webhooks'); break
  }

  switch (plan.support_level) {
    case 'standard': features.push('Standard Support'); break
    case 'priority': features.push('Priority Support'); break
    case 'dedicated': features.push('Dedicated Support'); break
  }

  switch (plan.analytics_level) {
    case 'basic': features.push('Basic Analytics'); break
    case 'advanced': features.push('Advanced Analytics'); break
    case 'enterprise': features.push('Enterprise Analytics'); break
  }

  if (plan.white_label) features.push('White Labeling')
  if (plan.api_access) features.push('Full API Access')
  if (plan.revenue_share) features.push('Revenue Share Options')
  if (plan.exclusivity) features.push('Exclusivity Options')

  return features
}

function formatMoney(amount: number) {
  return `$${amount.toFixed(2)}`
}

function UsagePricingLearnMore({ dollarsPerCredit }: { dollarsPerCredit: number | null }) {
  const exampleDollarsPerCredit = 0.07
  const leadCreditsExample = 80
  const leadDollarExample = leadCreditsExample * exampleDollarsPerCredit

  const creditsPerImageExample = 4
  const singleImageCreditsExample = creditsPerImageExample
  const singleImageDollarExample = singleImageCreditsExample * exampleDollarsPerCredit

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="link"
          size="sm"
          className="h-auto px-0 py-0 text-xs text-muted-foreground hover:text-foreground"
        >
          Learn more about usage pricing
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Usage pricing (simple examples)</DialogTitle>
          <DialogDescription>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="rounded-md border border-border/60 bg-muted/40 px-2 py-1 text-xs tabular-nums">
                {formatMoney(exampleDollarsPerCredit)}/credit
              </span>
              <span className="text-xs text-muted-foreground">
                Example only — credit price can change with volume{dollarsPerCredit !== null ? ' / plan' : ''}.
              </span>
            </div>

            <div className="mt-5 divide-y divide-border/60 rounded-lg border border-border/60 bg-muted/10">
              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    Leads
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    A lead can cost multiple credits (based on your services or industry).
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="inline-block rounded-lg bg-muted/20 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted-foreground">Example math</div>
                    <div className="mt-1 space-y-0.5 text-xs tabular-nums text-foreground/90">
                      <div>1 email lead = {leadCreditsExample} credits</div>
                      <div>
                        {leadCreditsExample} credits @ {formatMoney(exampleDollarsPerCredit)} → ≈ {formatMoney(leadDollarExample)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    Images
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Images can be multiple credits (example: {creditsPerImageExample}/image).
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="inline-block rounded-lg bg-muted/20 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted-foreground">Example math</div>
                    <div className="mt-1 space-y-0.5 text-xs tabular-nums text-foreground/90">
                      <div>
                        1 image = {singleImageCreditsExample} credits → ≈ {formatMoney(singleImageDollarExample)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  )
}

export function PlansGrid({ initialPlans }: { initialPlans: Plan[] }) {
  const [plans, setPlans] = useState<Plan[]>(initialPlans)
  const [isInitialLoad, setIsInitialLoad] = useState(initialPlans.length === 0)
  const subscribedRef = useRef(false)

  // Ensure we fetch plans at mount even if SSR had none
  useEffect(() => {
    (async () => {
      try {
        if (initialPlans.length === 0) setIsInitialLoad(true)
        const res = await fetch('/api/plans', { cache: 'no-store' })
        if (res.ok) {
          const next = await res.json()
          if (Array.isArray(next)) setPlans(next)
        }
      } catch {}
      finally {
        setIsInitialLoad(false)
      }
    })()
  }, [initialPlans.length])

  useEffect(() => {
    if (subscribedRef.current) return
    subscribedRef.current = true

    const channel = supabase
      .channel('realtime:public:plans')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'plans' }, async () => {
        try {
          const res = await fetch('/api/plans', { cache: 'no-store' })
          if (res.ok) {
            const next = await res.json()
            if (Array.isArray(next)) {
              setPlans(next)
            }
          }
        } catch {}
      })
      .subscribe()

    return () => {
      try { channel.unsubscribe() } catch {}
      subscribedRef.current = false
    }
  }, [])

  const combinedPlans = useMemo(() => {
    const orderedSelfServe = plans
      .filter((p) => !p.is_pricing_custom)
      .sort((a, b) => (a.monthly_price_cents ?? 0) - (b.monthly_price_cents ?? 0))
    const partner = plans.find((p) => p.is_pricing_custom) || null
    return partner ? [...orderedSelfServe, partner] : orderedSelfServe
  }, [plans])

  if (combinedPlans.length === 0) {
    if (isInitialLoad) return null
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">No plans found. Please set up your plans in the database.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 md:grid-cols-3">
      {combinedPlans.map((plan) => {
        const isPopular = !plan.is_pricing_custom && plan.name.toLowerCase().includes('pro')
        const isFree = !plan.is_pricing_custom && (plan.monthly_price_cents === 0 || plan.monthly_price_cents === null)
        const href = plan.is_pricing_custom
          ? '/partners'
          : `/auth?signup=true&plan=${encodeURIComponent(plan.name.toLowerCase())}`
        const additionalCreditPrice = formatAdditionalCreditPrice(plan.additional_credit_price)
        const dollarsPerCredit = getAdditionalCreditPriceDollars(plan.additional_credit_price)

        return (
          <Card
            key={plan.plan_id}
            className={cn(
              'relative border border-border/60 shadow-sm transition-all hover:shadow-md',
              isPopular && 'border-primary/25 ring-1 ring-primary/15',
              plan.is_pricing_custom && 'border-border/60'
            )}
          >
            {isPopular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge>Most popular</Badge>
              </div>
            )}

            <CardHeader className="p-5 pb-3 text-center">
              <CardTitle className="text-base">{plan.name}</CardTitle>
              <div className="mt-3 flex items-end justify-center gap-1">
                <span className="text-3xl font-semibold tracking-tight">
                  {plan.is_pricing_custom ? 'Custom' : formatPrice(plan.monthly_price_cents)}
                </span>
                {!plan.is_pricing_custom && !isFree && (
                  <span className="pb-1 text-sm text-muted-foreground">/month</span>
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">Also requires additional usage pricing</p>
              {plan.is_pricing_custom && (
                <p className="mt-2 text-sm text-muted-foreground">
                  For partners who need custom limits, onboarding, and support.
                </p>
              )}
            </CardHeader>

            <CardContent className="px-5 pb-0">
              <ul className="space-y-2">
                {getPlanFeatures(plan).map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start gap-2 text-[13px] text-foreground/80">
                    <Check className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              {!plan.is_pricing_custom && additionalCreditPrice && (
                <p className="mt-4 text-center text-xs text-muted-foreground">
                  Overage credits: {additionalCreditPrice}
                </p>
              )}

              <div className="mt-3 flex justify-center">
                <UsagePricingLearnMore dollarsPerCredit={dollarsPerCredit} />
              </div>
            </CardContent>

            <CardFooter className="px-5 pb-5 pt-4">
              <Button
                asChild
                className="w-full"
                size="lg"
                variant={plan.is_pricing_custom ? 'secondary' : isPopular ? 'default' : 'outline'}
              >
                <Link href={href}>
                  {plan.is_pricing_custom ? 'Talk to sales' : isFree ? 'Start free' : 'Get started'}
                </Link>
              </Button>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
