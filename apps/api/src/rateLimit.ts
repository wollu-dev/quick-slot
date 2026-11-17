import type { Context, Next } from 'hono';
import type { Env } from './app.ts';

/**
 * Fixed-window rate limit per client address, kept in memory (one API instance is enough for this site).
 * Answers 429 with Retry-After when a client goes over.
 */
export function rateLimit({ windowMs, max }: { windowMs: number; max: number }) {
  const hits = new Map<string, { count: number; reset: number }>();
  // Forget old windows now and then so the map doesn't grow without bound
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
  }, windowMs).unref();

  return async (c: Context<Env>, next: Next) => {
    const now = Date.now();
    const key = c.get('ip');
    let h = hits.get(key);
    if (!h || h.reset <= now) {
      h = { count: 0, reset: now + windowMs };
      hits.set(key, h);
    }
    h.count++;
    c.header('RateLimit-Limit', String(max));
    c.header('RateLimit-Remaining', String(Math.max(0, max - h.count)));
    if (h.count > max) {
      c.header('Retry-After', String(Math.ceil((h.reset - now) / 1000)));
      return c.json({ error: 'rateLimited' }, 429);
    }
    await next();
  };
}
