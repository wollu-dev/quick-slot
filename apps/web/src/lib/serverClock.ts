/**
 * Server time check, browser side. Two offsets are combined:
 *   1. our API's clock vs this device's clock, from a few quick round trips to /api/time
 *   2. the site's clock vs our API's clock, measured by the API (see apps/api/src/serverTime.ts)
 * The site's time is then simply Date.now() + both offsets.
 */

export type ClockError = 'invalidUrl' | 'blockedAddress' | 'notFound' | 'unreachable' | 'timeout' | 'noDate' | 'staticDate' | 'rateLimited' | 'offline';

export class ClockFailure extends Error {
  code: ClockError;
  constructor(code: ClockError) {
    super(code);
    this.code = code;
  }
}

const now = () => performance.timeOrigin + performance.now();

/** Our API's clock minus this device's clock, from the quickest of a few round trips */
export async function syncWithApi(rounds = 5): Promise<{ offset: number; rtt: number }> {
  let best: { offset: number; rtt: number } | null = null;
  for (let i = 0; i < rounds; i++) {
    const sent = now();
    let res: Response;
    try {
      res = await fetch('/api/time', { cache: 'no-store' });
    } catch {
      throw new ClockFailure('offline');
    }
    const got = now();
    if (!res.ok) throw new ClockFailure(res.status === 429 ? 'rateLimited' : 'offline');
    const { now: server } = (await res.json()) as { now: number };
    const rtt = got - sent;
    if (!best || rtt < best.rtt) best = { offset: server - (sent + got) / 2, rtt };
  }
  return best!;
}

export interface SiteClock {
  host: string;
  /** Site clock minus this device's clock, in ms */
  offset: number;
  /** How far off the estimate can be, in ms */
  precision: number;
  /** Our API's clock minus this device's clock (the device's own error against a synced server) */
  deviceError: number;
}

export async function measureSite(url: string): Promise<SiteClock> {
  const api = await syncWithApi();
  let res: Response;
  try {
    res = await fetch('/api/server-time', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url }), cache: 'no-store' });
  } catch {
    throw new ClockFailure('offline');
  }
  if (res.status === 429) throw new ClockFailure('rateLimited');
  const body = (await res.json().catch(() => ({}))) as { error?: ClockError; host?: string; offset?: number; precision?: number };
  if (!res.ok || body.error) throw new ClockFailure(body.error ?? 'offline');
  return {
    host: body.host!,
    offset: api.offset + body.offset!,
    precision: Math.round(body.precision! + api.rtt / 2),
    deviceError: api.offset,
  };
}

/** Recent addresses, kept only in this browser */
const RECENT = 'quickslot:server-time:recent';
export function recentSites(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT) ?? '[]') as string[];
  } catch {
    return [];
  }
}
export function rememberSite(host: string) {
  try {
    localStorage.setItem(RECENT, JSON.stringify([host, ...recentSites().filter((h) => h !== host)].slice(0, 6)));
  } catch {
    /* storage unavailable */
  }
}
export function forgetSites() {
  try {
    localStorage.removeItem(RECENT);
  } catch {
    /* storage unavailable */
  }
}

/** Consent to send addresses to our server, asked once (server tool rule) */
const CONSENT = 'quickslot:consent:server-time';
export const hasConsent = () => {
  try {
    return localStorage.getItem(CONSENT) === '1';
  } catch {
    return false;
  }
};
export const giveConsent = () => {
  try {
    localStorage.setItem(CONSENT, '1');
  } catch {
    /* storage unavailable: the question comes back next time */
  }
};
