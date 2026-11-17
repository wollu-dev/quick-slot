/**
 * Subscriptions, browser side. Paddle sells Pro on the web (as Merchant of Record): the site opens Paddle's
 * checkout and Paddle tells our API about the subscription. Card details never touch QuickSlot.
 *
 * Paddle.js is the one script that comes from another site: Paddle requires loading it from its own CDN.
 * It is loaded only when someone presses the buy button, never on page load.
 */

export interface CheckoutConfig {
  provider: 'paddle';
  environment: 'sandbox' | 'production';
  clientToken: string;
  prices: { monthly: string; yearly: string };
}

export interface PlanInfo {
  plan: 'free' | 'pro';
  status: string | null;
  periodEnd: string | null;
  cancelAt: string | null;
  provider: string | null;
}

export type Period = 'monthly' | 'yearly';

interface BillingConfig {
  checkout: CheckoutConfig | null;
  /** Subscribers can open Paddle's customer portal */
  portal: boolean;
}
let billingConfig: Promise<BillingConfig> | null = null;
function getBillingConfig(): Promise<BillingConfig> {
  billingConfig ??= fetch('/api/billing/config', { cache: 'no-store' })
    .then((r) => (r.ok ? (r.json() as Promise<BillingConfig>) : { checkout: null, portal: false }))
    .catch(() => ({ checkout: null, portal: false }));
  return billingConfig;
}

/** null when payments aren't set up on this server (or it can't be reached) */
export const getCheckoutConfig = async () => (await getBillingConfig()).checkout;
export const portalAvailable = async () => (await getBillingConfig()).portal;

/**
 * Sends the user to Paddle's customer portal (cancel, change card, invoices). The API makes a fresh,
 * short-lived link each time, so it is never stored. Throws when the link can't be made.
 */
export async function openPortal(): Promise<void> {
  const res = await fetch('/api/billing/portal', { method: 'POST', credentials: 'same-origin', cache: 'no-store' });
  const body = (await res.json().catch(() => ({}))) as { url?: string };
  if (!res.ok || !body.url) throw new Error('portal');
  location.assign(body.url);
}

/** The signed-in user's plan; null when signed out or accounts are off */
export async function getPlan(): Promise<PlanInfo | null> {
  try {
    const res = await fetch('/api/billing/me', { cache: 'no-store', credentials: 'same-origin' });
    if (!res.ok) return null;
    return (await res.json()) as PlanInfo;
  } catch {
    return null;
  }
}

/* Paddle.js, typed only as far as we use it */
interface PaddleEvent {
  name?: string;
}
interface PaddleJs {
  Environment: { set: (env: string) => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEvent) => void }) => void;
  Checkout: {
    open: (opts: {
      items: { priceId: string; quantity: number }[];
      customer?: { email: string };
      customData?: Record<string, string>;
      settings?: { displayMode?: 'overlay'; locale?: string; theme?: 'light' | 'dark'; allowLogout?: boolean };
    }) => void;
  };
}

const PADDLE_JS = 'https://cdn.paddle.com/paddle/v2/paddle.js';
let paddle: Promise<PaddleJs> | null = null;
let onEvent: ((e: PaddleEvent) => void) | null = null;

function loadPaddle(cfg: CheckoutConfig): Promise<PaddleJs> {
  paddle ??= new Promise<PaddleJs>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = PADDLE_JS;
    s.async = true;
    s.onload = () => {
      const P = (window as unknown as { Paddle?: PaddleJs }).Paddle;
      if (!P) return reject(new Error('paddle'));
      if (cfg.environment === 'sandbox') P.Environment.set('sandbox');
      P.Initialize({ token: cfg.clientToken, eventCallback: (e) => onEvent?.(e) });
      resolve(P);
    };
    s.onerror = () => {
      paddle = null;
      reject(new Error('paddle'));
    };
    document.head.append(s);
  });
  return paddle;
}

/**
 * Opens Paddle's checkout over the page. The user's ID goes along as custom data, so the webhook knows
 * whose subscription it is. `onCompleted` runs when the payment went through.
 */
export async function openCheckout(cfg: CheckoutConfig, period: Period, user: { id: string; email: string }, lang: string, onCompleted: () => void) {
  const P = await loadPaddle(cfg);
  onEvent = (e) => {
    if (e.name === 'checkout.completed') onCompleted();
  };
  P.Checkout.open({
    items: [{ priceId: cfg.prices[period], quantity: 1 }],
    customer: { email: user.email },
    customData: { userId: user.id },
    settings: { displayMode: 'overlay', locale: lang, theme: document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light', allowLogout: false },
  });
}

/** Asks for the plan until it turns Pro (the webhook can take a few seconds), up to about a minute */
export async function waitForPro(signal?: AbortSignal): Promise<boolean> {
  for (let i = 0; i < 30; i++) {
    if (signal?.aborted) return false;
    if ((await getPlan())?.plan === 'pro') return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

/** Opens the settings sheet (where signing in happens) from anywhere on the page */
export const OPEN_SETTINGS_EVENT = 'quickslot:open-settings';
export const openSettings = () => window.dispatchEvent(new Event(OPEN_SETTINGS_EVENT));
