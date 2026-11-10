import { LANG_TAGS, type Lang } from '../i18n';

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60],
  ['second', 1],
];

/**
 * "3 days ago", "in 2 hours" … in the given language, using the largest unit that fits.
 * A unit is used once the next smaller one would round up to it, so 59 min 40 s reads
 * "in 1 hour" rather than "in 60 minutes".
 */
export function relativeTime(d: Date, lang: Lang, now = Date.now()): string {
  const rtf = new Intl.RelativeTimeFormat(LANG_TAGS[lang], { numeric: 'auto' });
  const diff = (d.getTime() - now) / 1000;
  const abs = Math.abs(diff);
  for (let i = 0; i < UNITS.length; i++) {
    const [unit, sec] = UNITS[i];
    const smaller = UNITS[i + 1]?.[1] ?? 0;
    if (abs >= sec - smaller / 2 || unit === 'second') return rtf.format(Math.round(diff / sec), unit);
  }
  return '';
}
