/**
 * How far a web site's clock is from ours, to the hundredth of a second, from its HTTP Date header.
 *
 * The Date header only has whole seconds, so one request is ±0.5 s at best. Instead we watch for the
 * moment the header's second changes: requests every 80 ms bracket that moment, then two more probes
 * in the following seconds halve the bracket each time. A request's own time is taken as the midpoint
 * between sending it and receiving the headers (the site stamps Date roughly in between).
 */
import http from 'node:http';
import https from 'node:https';
import { GuardError, guardedLookup } from './netguard.ts';

export type MeasureError = 'notFound' | 'unreachable' | 'timeout' | 'noDate' | 'staticDate';
export class MeasureFailure extends Error {
  code: MeasureError;
  constructor(code: MeasureError) {
    super(code);
    this.code = code;
  }
}

interface Sample {
  mid: number;
  rtt: number;
  /** The site's clock, whole seconds, in ms */
  date: number;
}

export interface Measurement {
  host: string;
  /** Site clock minus our clock, in ms */
  offset: number;
  /** Half the width of the final bracket, in ms */
  precision: number;
  /** Median round trip to the site, in ms */
  rtt: number;
  samples: number;
}

const now = () => performance.timeOrigin + performance.now();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
const TIMEOUT = 4000;

function head(url: URL, agent: http.Agent): Promise<Sample> {
  const lib = url.protocol === 'https:' ? https : http;
  return new Promise((resolve, reject) => {
    const sent = now();
    const req = lib.request(
      url,
      {
        method: 'HEAD',
        agent,
        lookup: guardedLookup,
        timeout: TIMEOUT,
        headers: { 'user-agent': 'QuickSlot-ServerTime/1.0 (+server clock check)', 'cache-control': 'no-cache', accept: '*/*' },
      },
      (res) => {
        const got = now();
        res.resume();
        const date = Date.parse(res.headers.date ?? '');
        if (!Number.isFinite(date)) return reject(new MeasureFailure('noDate'));
        resolve({ mid: (sent + got) / 2, rtt: got - sent, date });
      },
    );
    req.on('timeout', () => req.destroy(new MeasureFailure('timeout')));
    req.on('error', (e: NodeJS.ErrnoException) => {
      if (e instanceof GuardError || e instanceof MeasureFailure) return reject(e);
      if (e.code === 'ENOTFOUND' || e.code === 'EAI_AGAIN') return reject(new MeasureFailure('notFound'));
      reject(new MeasureFailure('unreachable'));
    });
    req.end();
  });
}

export async function measure(url: URL): Promise<Measurement> {
  // One kept-alive connection: after the first request there is no new TCP or TLS handshake, so round trips stay short and even
  const agent = new (url.protocol === 'https:' ? https.Agent : http.Agent)({ keepAlive: true, maxSockets: 1 });
  const rtts: number[] = [];
  const take = async () => {
    const s = await head(url, agent);
    rtts.push(s.rtt);
    return s;
  };
  try {
    await take(); // warm-up: connection setup makes this one slow
    let prev = await take();
    let next: Sample | null = null;
    // Pass 1: sample every 80 ms until the second changes (at most about 1.6 s)
    for (let i = 0; i < 20 && !next; i++) {
      await sleep(80 - (now() - prev.mid) % 80);
      const s = await take();
      if (s.date > prev.date) next = s;
      else prev = s;
    }
    if (!next) throw new MeasureFailure('staticDate');
    // The second `next.date` began between these two moments of our clock
    let lo = prev.mid + (next.date - prev.date - 1000);
    let hi = next.mid;
    const second = next.date;
    // Pass 2: aim one probe at the middle of the bracket in each of the next seconds
    for (let k = 1; k <= 2; k++) {
      const aim = (lo + hi) / 2 + k * 1000;
      const rtt = rtts.slice(-4).sort((a, b) => a - b)[1] ?? 50;
      await sleep(aim - now() - rtt / 2);
      const s = await take();
      const at = s.mid - k * 1000;
      if (s.date >= second + k * 1000) hi = Math.min(hi, at);
      else lo = Math.max(lo, at);
    }
    const boundary = (lo + hi) / 2;
    const sorted = [...rtts.slice(1)].sort((a, b) => a - b);
    return {
      host: url.host,
      offset: Math.round(second - boundary),
      precision: Math.max(1, Math.round((hi - lo) / 2)),
      rtt: Math.round(sorted[sorted.length >> 1] ?? 0),
      samples: rtts.length,
    };
  } finally {
    agent.destroy();
  }
}
