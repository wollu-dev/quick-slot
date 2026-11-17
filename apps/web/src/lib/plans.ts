/**
 * Plans shown on the pricing page. Prices live here only (the dictionaries hold the words).
 * Whether Pro is on sale comes from the API (/api/billing/config): the buy button stays 'coming soon' until
 * the server has payments set up. Keep these prices equal to the Paddle prices.
 */
export const PRO_PRICE = { currency: 'USD', monthly: 5, yearly: 50 } as const;

export type PlanId = 'free' | 'pro' | 'enterprise';
export const PLAN_IDS: readonly PlanId[] = ['free', 'pro', 'enterprise'];
