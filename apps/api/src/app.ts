/**
 * QuickSlot API. Only for tools that truly need a server (see AGENTS.md, "server tools").
 *
 * Privacy by construction:
 * - nothing users send is stored or logged; the access log has method, path (without the query), status and time only
 * - no cookies, no sessions, no analytics
 * - every route is rate limited per client address
 */
import { Hono, type Context, type Next } from 'hono';
import { config } from './config.ts';
import { rateLimit } from './rateLimit.ts';

export type Env = { Variables: { ip: string } };

/** The client address: from the reverse proxy's header when we trust it, else the socket */
function clientIp(c: Context): string {
  if (config.trustProxy) {
    const fwd = c.req.header('x-forwarded-for');
    if (fwd) return fwd.split(',')[0].trim();
  }
  const info = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming?.socket;
  return info?.remoteAddress ?? 'unknown';
}

export function createApp() {
  const app = new Hono<Env>();

  app.use('*', async (c: Context<Env>, next: Next) => {
    const started = performance.now();
    c.set('ip', clientIp(c));
    await next();
    // API responses are for the site itself: never cached by shared caches, never framed, no MIME sniffing
    c.header('Cache-Control', 'no-store');
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('Cross-Origin-Resource-Policy', 'same-origin');
    if (config.logRequests) console.log(`${c.req.method} ${new URL(c.req.url).pathname} ${c.res.status} ${Math.round(performance.now() - started)}ms`);
  });

  app.use('/api/*', rateLimit({ windowMs: 60_000, max: config.rateLimitPerMinute }));

  app.get('/api/health', (c) => c.json({ ok: true, version: config.version }));

  app.notFound((c) => c.json({ error: 'notFound' }, 404));
  app.onError((err, c) => {
    console.error('[api] unhandled error', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal' }, 500);
  });
  return app;
}
