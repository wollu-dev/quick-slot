/**
 * Subscriptions (Pro). Paddle is the seller (Merchant of Record) on the web: the site opens Paddle's checkout,
 * and Paddle tells this API about subscriptions through a signed webhook. We never see card details;
 * we keep only the subscription's status, price, renewal date and Paddle's customer ID.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import { eq } from 'drizzle-orm';
import type { Context, Next } from 'hono';
import { config } from './config.ts';
import type { Db } from './db/index.ts';
import { billingEvent, subscription } from './db/schema.ts';

export type Plan = 'free' | 'pro';

/** Statuses that give Pro. past_due keeps it while the provider retries the payment. */
const ACTIVE = ['active', 'trialing', 'past_due'];

export interface PlanInfo {
  plan: Plan;
  status: string | null;
  /** End of the paid period (the next renewal, or the last day when cancelled) */
  periodEnd: string | null;
  /** When a scheduled cancellation takes effect */
  cancelAt: string | null;
  provider: string | null;
}

export async function planOf(db: Db, userId: string): Promise<PlanInfo> {
  const rows = await db.select().from(subscription).where(eq(subscription.userId, userId));
  const now = Date.now();
  const live = rows
    .filter((r) => ACTIVE.includes(r.status) && (!r.cancelAt || r.cancelAt.getTime() > now))
    .sort((a, b) => (b.currentPeriodEnd?.getTime() ?? 0) - (a.currentPeriodEnd?.getTime() ?? 0))[0];
  if (!live) return { plan: 'free', status: null, periodEnd: null, cancelAt: null, provider: null };
  return {
    plan: 'pro',
    status: live.status,
    periodEnd: live.currentPeriodEnd?.toISOString() ?? null,
    cancelAt: live.cancelAt?.toISOString() ?? null,
    provider: live.provider,
  };
}

/** A subscription that will keep charging the user (active and not set to cancel) */
export async function hasRenewingSubscription(db: Db, userId: string): Promise<boolean> {
  const rows = await db
    .select({ status: subscription.status, cancelAt: subscription.cancelAt })
    .from(subscription)
    .where(eq(subscription.userId, userId));
  return rows.some((r) => ACTIVE.includes(r.status) && !r.cancelAt);
}

/* ------------------------------------------------------------------ */
/* Paddle                                                              */
/* ------------------------------------------------------------------ */

/**
 * Checks the Paddle-Signature header: "ts=<unix seconds>;h1=<hex HMAC-SHA256 of `${ts}:${body}`>".
 * Rejects signatures older than 5 minutes, so a captured request can't be replayed later.
 */
export function verifyPaddleSignature(body: string, header: string | undefined, secret: string, nowSec = Date.now() / 1000): boolean {
  if (!header || !secret) return false;
  const parts = Object.fromEntries(header.split(';').map((p) => p.split('=') as [string, string]));
  const ts = Number(parts.ts);
  const sigs = header
    .split(';')
    .filter((p) => p.startsWith('h1='))
    .map((p) => p.slice(3));
  if (!Number.isFinite(ts) || !sigs.length || Math.abs(nowSec - ts) > 300) return false;
  const expected = createHmac('sha256', secret).update(`${ts}:${body}`).digest();
  return sigs.some((h) => {
    const got = Buffer.from(h, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

interface PaddleSubscription {
  id: string;
  status: string;
  customer_id?: string;
  items?: { price?: { id?: string } }[];
  current_billing_period?: { ends_at?: string } | null;
  scheduled_change?: { action?: string; effective_at?: string } | null;
  canceled_at?: string | null;
  custom_data?: { userId?: unknown } | null;
}
export interface PaddleEvent {
  event_id: string;
  event_type: string;
  occurred_at: string;
  data: PaddleSubscription;
}

export type ApplyResult = 'applied' | 'duplicate' | 'ignored' | 'stale' | 'unknownUser';

/** Records a subscription event. Safe to call again with the same event (Paddle retries deliveries). */
export async function applyPaddleEvent(db: Db, event: PaddleEvent): Promise<ApplyResult> {
  if (!event.event_type?.startsWith('subscription.') || !event.data?.id) return 'ignored';
  const seen = await db.insert(billingEvent).values({ id: event.event_id }).onConflictDoNothing().returning({ id: billingEvent.id });
  if (!seen.length) return 'duplicate';

  const s = event.data;
  const eventAt = new Date(event.occurred_at);
  const [existing] = await db.select().from(subscription).where(eq(subscription.id, s.id));
  // The user comes from the checkout's custom data on the first event, then from our own row
  const userId = existing?.userId ?? (typeof s.custom_data?.userId === 'string' ? s.custom_data.userId : null);
  if (!userId) return 'unknownUser';
  if (existing && existing.eventAt >= eventAt) return 'stale';

  const cancelAt =
    s.scheduled_change?.action === 'cancel' && s.scheduled_change.effective_at
      ? new Date(s.scheduled_change.effective_at)
      : s.status === 'canceled'
        ? new Date(s.canceled_at ?? event.occurred_at)
        : null;
  const values = {
    status: s.status,
    priceId: s.items?.[0]?.price?.id ?? null,
    customerId: s.customer_id ?? null,
    currentPeriodEnd: s.current_billing_period?.ends_at ? new Date(s.current_billing_period.ends_at) : (existing?.currentPeriodEnd ?? null),
    cancelAt,
    eventAt,
    updatedAt: new Date(),
  };
  try {
    if (existing) await db.update(subscription).set(values).where(eq(subscription.id, s.id));
    else await db.insert(subscription).values({ id: s.id, userId, provider: 'paddle', ...values });
  } catch (e) {
    // e.g. the user deleted their account before the event arrived
    if (String((e as { cause?: unknown }).cause ?? e).includes('foreign key')) return 'unknownUser';
    throw e;
  }
  return 'applied';
}

/** What the site needs to open Paddle's checkout; null when payments aren't set up */
export function checkoutConfig() {
  const p = config.paddle;
  if (!p) return null;
  return { provider: 'paddle' as const, environment: p.environment, clientToken: p.clientToken, prices: p.prices };
}

/* ------------------------------------------------------------------ */
/* Guarding Pro routes                                                 */
/* ------------------------------------------------------------------ */

type SessionReader = (headers: Headers) => Promise<{ user: { id: string } } | null>;

/** Middleware for Pro-only routes: 401 when signed out, 403 { error: 'proRequired' } on the free plan */
export function requirePro(db: Db, session: SessionReader) {
  return async (c: Context, next: Next) => {
    const s = await session(c.req.raw.headers);
    if (!s) return c.json({ error: 'signInRequired' }, 401);
    if ((await planOf(db, s.user.id)).plan !== 'pro') return c.json({ error: 'proRequired' }, 403);
    c.set('userId' as never, s.user.id as never);
    await next();
  };
}

