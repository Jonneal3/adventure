import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, HttpException, Param, Post, Req, UnauthorizedException } from '@nestjs/common';
import { and, eq } from 'drizzle-orm';
import type { Request } from 'express';
import Stripe from 'stripe';
import { z } from 'zod';
import { auth } from './auth.js';
import { db } from './database/client.js';
import { accountBilling, plans, stripeEvents, userAccounts, walletEntries } from './database/schema.js';

const uuid = z.string().uuid();
const checkoutInput = z.object({ planCode: z.enum(['usage','basic','pro']), requestKey: uuid });
const depositInput = z.object({ amountCents: z.number().int().min(100).max(1_000_000), requestKey: uuid });
function stripeClient() {
  const key = process.env.ADVENTURE_STRIPE_SECRET_KEY;
  if (!key?.startsWith('sk_test_')) throw new HttpException('Adventure Stripe sandbox is not configured', 503);
  return new Stripe(key, { apiVersion: '2023-10-16' });
}
async function verifiedStripe() {
  const client = stripeClient();
  const expected = process.env.ADVENTURE_STRIPE_ACCOUNT_ID;
  if (!expected || (await client.accounts.retrieve()).id !== expected) throw new HttpException('Stripe sandbox account mismatch', 503);
  return client;
}
function requestHeaders(request: Request) {
  const headers = new Headers();
  for (const [key, value] of Object.entries(request.headers)) if (typeof value === 'string') headers.set(key, value);
  return headers;
}

@Controller('api/billing')
export class BillingController {
  private async owner(request: Request, accountId: string) {
    uuid.parse(accountId);
    const origin = request.headers.origin;
    const expected = process.env.NEXT_PUBLIC_SITE_URL;
    if (origin && expected && origin !== new URL(expected).origin) throw new ForbiddenException('Origin mismatch');
    const session = await auth.api.getSession({ headers: requestHeaders(request) });
    if (!session) throw new UnauthorizedException();
    const [member] = await db.select().from(userAccounts).where(and(eq(userAccounts.accountId, accountId), eq(userAccounts.userId, session.user.id), eq(userAccounts.status, 'accepted'))).limit(1);
    if (!member || member.userStatus !== 'owner') throw new ForbiddenException();
    return session.user;
  }

  @Get(':accountId')
  async snapshot(@Req() request: Request, @Param('accountId') accountId: string) {
    await this.owner(request, accountId);
    const [billing] = await db.select().from(accountBilling).where(eq(accountBilling.accountId, accountId)).limit(1);
    if (!billing) throw new BadRequestException('Billing account is unavailable');
    return { planCode: billing.planCode, status: billing.status, periodEnd: billing.periodEnd, trialEndsAt: billing.trialEndsAt, engagementsUsed: billing.engagementsUsed, aiDesignsUsed: billing.aiDesignsUsed, walletBalanceCents: billing.walletBalanceCents };
  }

  private async customer(client: Stripe, accountId: string, email: string) {
    const [billing] = await db.select().from(accountBilling).where(eq(accountBilling.accountId, accountId)).limit(1);
    if (!billing) throw new BadRequestException('Billing account is unavailable');
    if (billing.stripeCustomerId) return billing.stripeCustomerId;
    const customer = await client.customers.create({ email, metadata: { application: 'adventure', accountId } }, { idempotencyKey: `adventure-customer-${accountId}` });
    await db.update(accountBilling).set({ stripeCustomerId: customer.id }).where(eq(accountBilling.accountId, accountId));
    return customer.id;
  }

  @Post(':accountId/checkout')
  async checkout(@Req() request: Request, @Param('accountId') accountId: string, @Body() body: unknown) {
    const user = await this.owner(request, accountId);
    const input = checkoutInput.parse(body);
    const [plan] = await db.select().from(plans).where(and(eq(plans.code, input.planCode), eq(plans.active, true))).limit(1);
    if (!plan) throw new BadRequestException('Plan is unavailable');
    const [current] = await db.select().from(accountBilling).where(eq(accountBilling.accountId, accountId)).limit(1);
    if (current?.stripeSubscriptionId && ['active', 'trialing', 'past_due'].includes(current.status)) throw new ConflictException('Manage the existing subscription in Billing');
    const price = process.env[`ADVENTURE_STRIPE_PRICE_${input.planCode.toUpperCase()}`];
    if (!price) throw new HttpException('Adventure plan is not configured in Stripe sandbox', 503);
    const client = await verifiedStripe();
    const stripePrice = await client.prices.retrieve(price);
    if (!stripePrice.active || stripePrice.livemode || stripePrice.currency !== 'usd' || stripePrice.unit_amount !== plan.monthlyPriceCents || stripePrice.recurring?.interval !== 'month') throw new HttpException('Stripe plan does not match Adventure catalog', 503);
    const customer = await this.customer(client, accountId, user.email);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const session = await client.checkout.sessions.create({ mode: 'subscription', customer, line_items: [{ price, quantity: 1 }], metadata: { application: 'adventure', accountId, planCode: input.planCode }, subscription_data: { metadata: { application: 'adventure', accountId, planCode: input.planCode } }, success_url: `${origin}/platform?billing=success`, cancel_url: `${origin}/platform?billing=cancelled` }, { idempotencyKey: `adventure-plan-${accountId}-${input.requestKey}` });
    return { url: session.url };
  }

  @Post(':accountId/deposit')
  async deposit(@Req() request: Request, @Param('accountId') accountId: string, @Body() body: unknown) {
    const user = await this.owner(request, accountId);
    const input = depositInput.parse(body);
    const client = await verifiedStripe();
    const customer = await this.customer(client, accountId, user.email);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const session = await client.checkout.sessions.create({ mode: 'payment', customer, line_items: [{ price_data: { currency: 'usd', unit_amount: input.amountCents, product_data: { name: 'Adventure account balance' } }, quantity: 1 }], payment_intent_data: { metadata: { application: 'adventure', accountId, operationKey: `deposit:${input.requestKey}`, amountCents: String(input.amountCents) } }, success_url: `${origin}/platform?deposit=success`, cancel_url: `${origin}/platform?deposit=cancelled` }, { idempotencyKey: `adventure-deposit-${accountId}-${input.requestKey}` });
    return { url: session.url };
  }

  @Post('webhook')
  async webhook(@Req() request: Request) {
    const secret = process.env.ADVENTURE_STRIPE_WEBHOOK_SECRET;
    const signature = request.header('stripe-signature');
    if (!secret || !signature || !Buffer.isBuffer(request.body)) throw new BadRequestException('Signed raw Stripe event required');
    const client = await verifiedStripe();
    let event: Stripe.Event;
    try { event = client.webhooks.constructEvent(request.body, signature, secret); }
    catch { throw new BadRequestException('Invalid Stripe signature'); }
    if (event.livemode) throw new BadRequestException('Live Stripe events are not accepted');
    const checkout = event.type === 'checkout.session.completed' ? event.data.object as Stripe.Checkout.Session : null;
    const subscription = checkout?.mode === 'subscription' && checkout.subscription ? await client.subscriptions.retrieve(String(checkout.subscription)) : null;
    const eventSubscription = event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.deleted' ? event.data.object as Stripe.Subscription : null;
    await db.transaction(async tx => {
      const inserted = await tx.insert(stripeEvents).values({ id: event.id, type: event.type }).onConflictDoNothing().returning({ id: stripeEvents.id });
      if (!inserted.length) return;
      if (checkout) {
        if (checkout.metadata?.application !== 'adventure') return;
        if (subscription && checkout.metadata.accountId && checkout.metadata.planCode) {
          const code = checkout.metadata.planCode;
          if (subscription.metadata.application !== 'adventure' || subscription.metadata.accountId !== checkout.metadata.accountId || subscription.items.data[0]?.price.id !== process.env[`ADVENTURE_STRIPE_PRICE_${code.toUpperCase()}`]) throw new Error('Subscription metadata does not match Adventure catalog');
          await tx.update(accountBilling).set({ planCode: code, status: subscription.status, stripeSubscriptionId: subscription.id, periodStart: new Date(subscription.current_period_start * 1000), periodEnd: new Date(subscription.current_period_end * 1000), engagementsUsed: 0, aiDesignsUsed: 0 }).where(eq(accountBilling.accountId, checkout.metadata.accountId));
        }
      }
      if (eventSubscription?.metadata.application === 'adventure' && eventSubscription.metadata.accountId) {
        const code = eventSubscription.metadata.planCode;
        if (code && eventSubscription.items.data[0]?.price.id === process.env[`ADVENTURE_STRIPE_PRICE_${code.toUpperCase()}`]) {
          const [current] = await tx.select().from(accountBilling).where(eq(accountBilling.accountId, eventSubscription.metadata.accountId)).for('update').limit(1);
          if (current && (!current.stripeSubscriptionId || current.stripeSubscriptionId === eventSubscription.id)) {
            const renew = new Date(eventSubscription.current_period_start * 1000) > current.periodStart;
            await tx.update(accountBilling).set({ planCode: code, status: eventSubscription.status, stripeSubscriptionId: eventSubscription.id, periodStart: new Date(eventSubscription.current_period_start * 1000), periodEnd: new Date(eventSubscription.current_period_end * 1000), engagementsUsed: renew ? 0 : current.engagementsUsed, aiDesignsUsed: renew ? 0 : current.aiDesignsUsed }).where(eq(accountBilling.accountId, eventSubscription.metadata.accountId));
          }
        }
      }
      if (event.type === 'payment_intent.succeeded') {
        const payment = event.data.object as Stripe.PaymentIntent;
        const { accountId, operationKey, amountCents } = payment.metadata;
        if (payment.metadata.application === 'adventure' && accountId && operationKey?.startsWith('deposit:') && Number(amountCents) === payment.amount_received && payment.currency === 'usd') {
          const insertedWallet = await tx.insert(walletEntries).values({ accountId, operationKey, amountCents: payment.amount_received, kind: 'deposit' }).onConflictDoNothing().returning({ id: walletEntries.id });
          if (insertedWallet.length) await tx.update(accountBilling).set({ walletBalanceCents: (await tx.select().from(accountBilling).where(eq(accountBilling.accountId, accountId)).for('update').limit(1))[0].walletBalanceCents + payment.amount_received }).where(eq(accountBilling.accountId, accountId));
        }
      }
    });
    return { received: true };
  }
}
