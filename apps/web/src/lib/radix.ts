/** Integer base conversion with BigInt, so any size stays exact */

export type RadixError = 'empty' | 'digit' | 'width';

const DIGITS = '0123456789abcdefghijklmnopqrstuvwxyz';
const PREFIX: Record<number, RegExp> = { 2: /^0b/i, 8: /^0o/i, 16: /^0x/i };

/**
 * Parses an integer written in `base`. Accepts a leading sign, the usual prefix for the base (0b, 0o, 0x),
 * and spaces, underscores, commas or apostrophes used as digit separators.
 */
export function parseRadix(input: string, base: number): { value: bigint } | { error: RadixError; at?: string } {
  let s = input.trim().replace(/[\s_,']/g, '').toLowerCase();
  if (!s) return { error: 'empty' };
  let negative = false;
  if (s[0] === '-' || s[0] === '+') {
    negative = s[0] === '-';
    s = s.slice(1);
  }
  if (PREFIX[base]) s = s.replace(PREFIX[base], '');
  if (!s) return { error: 'empty' };
  const b = BigInt(base);
  let v = 0n;
  for (const ch of s) {
    const d = DIGITS.indexOf(ch);
    if (d < 0 || d >= base) return { error: 'digit', at: ch };
    v = v * b + BigInt(d);
  }
  return { value: negative ? -v : v };
}

/** Writes `value` in `base`, optionally grouping digits from the right (e.g. 4 for binary and hex, 3 for decimal) */
export function formatRadix(value: bigint, base: number, opts: { group?: number; upper?: boolean } = {}): string {
  const negative = value < 0n;
  let s = (negative ? -value : value).toString(base);
  if (opts.upper) s = s.toUpperCase();
  if (opts.group) {
    const parts: string[] = [];
    for (let i = s.length; i > 0; i -= opts.group) parts.unshift(s.slice(Math.max(0, i - opts.group), i));
    s = parts.join(base === 10 ? ',' : ' ');
  }
  return negative ? `-${s}` : s;
}

/** The bit pattern of `value` in `bits` bits (two's complement), or null if it doesn't fit as signed or unsigned */
export function toTwos(value: bigint, bits: number): bigint | null {
  const size = 1n << BigInt(bits);
  const min = -(size >> 1n);
  if (value < min || value >= size) return null;
  return value < 0n ? size + value : value;
}

/** Reads a `bits`-bit pattern as a signed number */
export function fromTwos(pattern: bigint, bits: number): bigint {
  const size = 1n << BigInt(bits);
  return pattern >= size >> 1n ? pattern - size : pattern;
}

/** Number of bits needed for the magnitude (0 needs 1) */
export const bitLength = (v: bigint) => (v < 0n ? -v : v).toString(2).length;
