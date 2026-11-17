/**
 * Plans shown on the pricing page. Prices live here only (the dictionaries hold the words).
 * Pro is not on sale yet: PRO_AVAILABLE turns on the buy button once billing ships.
 */
export const PRO_PRICE = { currency: 'USD', monthly: 5, yearly: 50 } as const;
export const PRO_AVAILABLE = false;

export type PlanId = 'free' | 'pro' | 'enterprise';
export const PLAN_IDS: readonly PlanId[] = ['free', 'pro', 'enterprise'];
