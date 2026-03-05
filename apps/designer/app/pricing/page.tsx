import { PlansGrid } from '@/components/pricing/PlansGrid'
import { Badge } from '@/components/ui/badge'
import { headers } from 'next/headers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export default async function PricingPage() {
  let plans: any[] = []
  try {
    const h = await headers()
    const host = h.get('x-forwarded-host') ?? h.get('host')
    const proto = h.get('x-forwarded-proto') ?? 'http'
    const baseUrl =
      (host ? `${proto}://${host}` : null) ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      'http://localhost:3000'

    const res = await fetch(`${baseUrl}/api/plans`, { cache: 'no-store' })
    const data = await res.json().catch(() => null)
    if (!res.ok) {
      console.error('GET /api/plans failed', data)
    } else {
      plans = Array.isArray(data) ? data : []
    }
  } catch (err) {
    console.error('GET /api/plans error', err)
  }

  return (
    <div className="relative min-h-[calc(100dvh-4rem)] bg-background text-foreground overflow-x-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-24 -left-24 h-56 w-56 rounded-full bg-gradient-to-br from-fuchsia-300/25 via-purple-300/15 to-transparent blur-3xl opacity-60 dark:opacity-35" />
        <div className="absolute -bottom-28 -right-20 h-64 w-64 rounded-full bg-gradient-to-tl from-amber-300/25 via-rose-300/15 to-transparent blur-3xl opacity-60 dark:opacity-35" />
      </div>

      <main className="relative">
        <section className="container mx-auto px-4 md:px-6 pt-10 pb-12">
          <div className="mx-auto max-w-2xl text-center space-y-3">
            <Badge variant="secondary" className="mx-auto w-fit">
              Pricing
            </Badge>
            <h1
              className="mx-auto max-w-[28ch] text-3xl sm:text-4xl font-bold tracking-tight leading-[1.05] font-fraunces"
            >
              Simple pricing that scales with you
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Start free, upgrade when you’re ready. Change plans anytime.
            </p>
          </div>

          <div className="mt-8 mx-auto max-w-5xl">
            <PlansGrid initialPlans={plans} />
          </div>

          <p className="mt-8 text-center text-sm text-muted-foreground">
            Need help choosing? Email{' '}
            <a className="underline underline-offset-4 hover:text-foreground" href="mailto:hello@sif.ai">
              hello@sif.ai
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  )
}
