/**
 * Bill splitting. All math is done in integer minor units (won, yen, cents) so the shares
 * always add up to the total exactly.
 */

export type Currency = 'KRW' | 'JPY' | 'USD' | 'EUR';

/** Digits after the decimal point for each currency */
export const MINOR_DIGITS: Record<Currency, number> = { KRW: 0, JPY: 0, USD: 2, EUR: 2 };

/** Rounding steps offered for each currency, in minor units */
export const ROUNDING_STEPS: Record<Currency, number[]> = {
  KRW: [1, 10, 100, 1000],
  JPY: [1, 10, 100],
  USD: [1, 10, 100],
  EUR: [1, 10, 100],
};

export const toMinor = (amount: number, c: Currency) => Math.round(amount * 10 ** MINOR_DIGITS[c]);
export const fromMinor = (minor: number, c: Currency) => minor / 10 ** MINOR_DIGITS[c];

export type RoundMode = 'up' | 'down';

export interface SplitResult {
  /** What each person pays, in minor units; index 0 is the organizer */
  shares: number[];
  /** Organizer's share minus what it would be without rounding (positive = the organizer pays more) */
  organizerAdjust: number;
  /** The amount split evenly before extras, in minor units */
  base: number;
  /** What a person without an extra pays (rounded like everyone except the organizer) */
  perPerson: number;
}

/**
 * Splits `total` among people. Each person pays an even part of (total − all extras) plus their own extra.
 * Every share except the organizer's is rounded to `step` (up or down); the organizer takes the
 * remainder so the shares add up to the total exactly.
 * Returns null when the extras exceed the total.
 */
export function split(total: number, extras: number[], step: number, mode: RoundMode): SplitResult | null {
  const n = extras.length;
  if (n === 0) return null;
  const pool = total - extras.reduce((a, b) => a + b, 0);
  if (pool < 0) return null;
  const raw = extras.map((e) => pool / n + e);
  const round = (v: number) => (mode === 'up' ? Math.ceil(v / step) : Math.floor(v / step)) * step;
  const shares = raw.map((v, i) => (i === 0 ? 0 : Math.max(0, round(v))));
  shares[0] = total - shares.slice(1).reduce((a, b) => a + b, 0);
  return { shares, organizerAdjust: shares[0] - raw[0], base: pool / n, perPerson: n === 1 ? total : round(pool / n) };
}
