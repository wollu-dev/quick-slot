/**
 * Calendar date math for the date calculator. Dates are plain calendar days ("YYYY-MM-DD");
 * everything is done on UTC day numbers so daylight saving time can never shift a result.
 */

export interface Ymd {
  y: number;
  m: number; // 1–12
  d: number;
}

const DAY = 86_400_000;

export function parseYmd(v: string): Ymd | null {
  const m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const ymd = { y: +m[1], m: +m[2], d: +m[3] };
  return toYmd(dayNumber(ymd)).d === ymd.d ? ymd : null;
}

export const formatYmd = ({ y, m, d }: Ymd) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
export const todayYmd = (now = new Date()): Ymd => ({ y: now.getFullYear(), m: now.getMonth() + 1, d: now.getDate() });

/** Days since 1970-01-01 */
export const dayNumber = ({ y, m, d }: Ymd) => Date.UTC(y, m - 1, d) / DAY;
export function toYmd(n: number): Ymd {
  const dt = new Date(n * DAY);
  return { y: dt.getUTCFullYear(), m: dt.getUTCMonth() + 1, d: dt.getUTCDate() };
}
/** 0 = Sunday … 6 = Saturday */
export const weekday = (v: Ymd) => new Date(dayNumber(v) * DAY).getUTCDay();
/** A Date at local midnight, for formatting with Intl */
export const toLocalDate = ({ y, m, d }: Ymd) => new Date(y, m - 1, d);

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Signed number of days from a to b */
export const daysBetween = (a: Ymd, b: Ymd) => dayNumber(b) - dayNumber(a);

/**
 * Whole years, months and days from a to b (a ≤ b), counted on the calendar:
 * 2024-01-31 → 2024-03-01 is 1 month 1 day.
 */
export function diffYmd(a: Ymd, b: Ymd): { years: number; months: number; days: number } {
  let months = (b.y - a.y) * 12 + (b.m - a.m);
  if (b.d < a.d) months--;
  const anchor = addMonths(a, months);
  const days = daysBetween(anchor, b);
  return { years: Math.floor(months / 12), months: months % 12, days };
}

/** Adds months, keeping the day but clamping to the month's last day (Jan 31 + 1 month = Feb 28/29) */
export function addMonths(v: Ymd, n: number): Ymd {
  const total = v.y * 12 + (v.m - 1) + n;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return { y, m, d: Math.min(v.d, daysInMonth(y, m)) };
}

export const addDays = (v: Ymd, n: number) => toYmd(dayNumber(v) + n);

const isWeekend = (n: number) => {
  const wd = new Date(n * DAY).getUTCDay();
  return wd === 0 || wd === 6;
};

/** Weekdays (Mon–Fri) after a, up to and including b. Negative when b is before a. */
export function businessDaysBetween(a: Ymd, b: Ymd): number {
  const [from, to, sign] = dayNumber(a) <= dayNumber(b) ? [dayNumber(a), dayNumber(b), 1] : [dayNumber(b), dayNumber(a), -1];
  const total = to - from;
  const fullWeeks = Math.floor(total / 7);
  let count = fullWeeks * 5;
  for (let n = from + fullWeeks * 7 + 1; n <= to; n++) if (!isWeekend(n)) count++;
  return count * sign;
}

/** Moves n weekdays forward (or back when negative), skipping Saturdays and Sundays */
export function addBusinessDays(v: Ymd, n: number): Ymd {
  let day = dayNumber(v);
  const step = n < 0 ? -1 : 1;
  for (let left = Math.abs(n); left > 0; ) {
    day += step;
    if (!isWeekend(day)) left--;
  }
  return toYmd(day);
}

/** International age: full years since birth. A Feb 29 birthday counts on Feb 28 in common years. */
export function ageOn(birth: Ymd, on: Ymd): number {
  let age = on.y - birth.y;
  const bd = Math.min(birth.d, daysInMonth(on.y, birth.m));
  if (on.m < birth.m || (on.m === birth.m && on.d < bd)) age--;
  return age;
}

/** Next birthday on or after `on` */
export function nextBirthday(birth: Ymd, on: Ymd): Ymd {
  const inYear = (y: number): Ymd => ({ y, m: birth.m, d: Math.min(birth.d, daysInMonth(y, birth.m)) });
  const thisYear = inYear(on.y);
  return daysBetween(on, thisYear) >= 0 ? thisYear : inYear(on.y + 1);
}
