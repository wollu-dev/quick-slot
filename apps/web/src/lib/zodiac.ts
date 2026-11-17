import type { Ymd } from './dateCalc';

/**
 * Zodiac animal (띠 / 干支) of a date.
 * The sexagenary year cycle: stem = (year − 4) mod 10, branch = (year − 4) mod 12 (1984 was 甲子).
 * Korea and the Chinese zodiac change the animal at the Lunar New Year; Japan changes it on January 1.
 */

export type ZodiacBoundary = 'lunarNewYear' | 'january1';

export interface Zodiac {
  /** 0–9: 甲 乙 丙 丁 戊 己 庚 辛 壬 癸 */
  stem: number;
  /** 0–11: 子 丑 寅 卯 辰 巳 午 未 申 酉 戌 亥 (rat … pig) */
  branch: number;
  /** The Gregorian year the zodiac year is named after */
  year: number;
  /** Born before the Lunar New Year: the Gregorian year alone would give a different animal */
  beforeNewYear: boolean;
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

let lunar: Intl.DateTimeFormat | null | undefined;
/** Gregorian year in which the lunar year containing this date began, if the browser has the Chinese calendar */
function lunarYear(v: Ymd): number | null {
  if (lunar === undefined) {
    try {
      lunar = new Intl.DateTimeFormat('en-u-ca-chinese', { year: 'numeric', timeZone: 'UTC' });
    } catch {
      lunar = null;
    }
  }
  if (!lunar) return null;
  // "relatedYear" (the Gregorian year of the lunar year) is missing from TypeScript's part type list
  const part = lunar.formatToParts(new Date(Date.UTC(v.y, v.m - 1, v.d, 12))).find((p) => (p.type as string) === 'relatedYear');
  return part ? Number(part.value) : null;
}

export function zodiacOf(v: Ymd, boundary: ZodiacBoundary): Zodiac {
  const year = boundary === 'lunarNewYear' ? (lunarYear(v) ?? v.y) : v.y;
  return { stem: mod(year - 4, 10), branch: mod(year - 4, 12), year, beforeNewYear: year !== v.y };
}

/** Five elements of the stems, two stems each: wood, fire, earth, metal, water */
export const element = (stem: number) => Math.floor(stem / 2);
