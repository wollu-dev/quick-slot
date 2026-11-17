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
import { GuardError, parseTarget } from './netguard.ts';
import { rateLimit } from './rateLimit.ts';
import { measure, MeasureFailure } from './serverTime.ts';
import { checkUrl, createJob, disposition, FORMATS, getJob, info, takeFile, VideoFailure, type VideoFormat } from './video.ts';
import { Readable } from 'node:stream';
import { CLIENT_IP_HEADER, providers, type Auth } from './auth.ts';
import type { Mailer } from './mail.ts';

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

export interface Deps {
  /** null when accounts are off (no DATABASE_URL) */
  auth?: Auth | null;
  mailer?: Mailer | null;
}

export function createApp({ auth = null, mailer = null }: Deps = {}) {
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

  /** Our clock, so the browser can tell how far its own clock is from ours */
  app.get('/api/time', (c) => c.json({ now: performance.timeOrigin + performance.now() }));

  /** How far a site's clock is from ours (server time check). The address is used for this request only. */
  app.post('/api/server-time', rateLimit({ windowMs: 60_000, max: config.serverTimePerMinute }), async (c) => {
    let body: { url?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'invalidUrl' }, 400);
    }
    if (typeof body.url !== 'string' || body.url.length > 2048) return c.json({ error: 'invalidUrl' }, 400);
    try {
      const url = parseTarget(body.url);
      let m;
      try {
        m = await measure(url);
      } catch (e) {
        // Typed without a scheme and https didn't connect: the site may only speak plain http
        const bare = !/^[a-z][a-z0-9+.-]*:\/\//i.test(body.url.trim());
        if (!(bare && e instanceof MeasureFailure && e.code === 'unreachable')) throw e;
        url.protocol = 'http:';
        m = await measure(url);
      }
      return c.json({ ...m, now: performance.timeOrigin + performance.now() });
    } catch (e) {
      if (e instanceof GuardError) return c.json({ error: e.code }, 400);
      if (e instanceof MeasureFailure) return c.json({ error: e.code }, 502);
      throw e;
    }
  });

  /* Video downloader: info → job → progress → file (sent once, then deleted) */
  const videoUrl = async (c: Context<Env>): Promise<{ url?: URL; format?: unknown; error?: string }> => {
    let body: { url?: unknown; format?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return { error: 'invalidUrl' };
    }
    if (typeof body.url !== 'string' || body.url.length > 2048) return { error: 'invalidUrl' };
    try {
      return { url: await checkUrl(body.url), format: body.format };
    } catch (e) {
      return { error: e instanceof GuardError || e instanceof VideoFailure ? e.code : 'invalidUrl' };
    }
  };
  const videoError = (c: Context<Env>, e: unknown) => {
    if (e instanceof VideoFailure) return c.json({ error: e.code }, e.code === 'busy' ? 429 : 422);
    throw e;
  };

  app.post('/api/video/info', rateLimit({ windowMs: 60_000, max: 10 }), async (c) => {
    const { url, error } = await videoUrl(c);
    if (!url) return c.json({ error }, 400);
    try {
      return c.json(await info(url));
    } catch (e) {
      return videoError(c, e);
    }
  });

  app.post('/api/video/jobs', rateLimit({ windowMs: 60_000, max: 6 }), async (c) => {
    const { url, format, error } = await videoUrl(c);
    if (!url) return c.json({ error }, 400);
    if (!FORMATS.includes(format as VideoFormat)) return c.json({ error: 'invalidFormat' }, 400);
    try {
      const job = createJob(url, format as VideoFormat, c.get('ip'));
      return c.json({ id: job.id }, 202);
    } catch (e) {
      return videoError(c, e);
    }
  });

  app.get('/api/video/jobs/:id', (c) => {
    const job = getJob(c.req.param('id'), c.get('ip'));
    if (!job) return c.json({ error: 'notFound' }, 404);
    return c.json({ status: job.status, progress: job.progress, name: job.name, size: job.size, error: job.error });
  });

  app.get('/api/video/jobs/:id/file', (c) => {
    const job = getJob(c.req.param('id'), c.get('ip'));
    if (!job || job.status !== 'done' || !job.file) return c.json({ error: 'notFound' }, 404);
    const stream = takeFile(job);
    return new Response(Readable.toWeb(stream) as ReadableStream, {
      headers: {
        'content-type': 'application/octet-stream',
        'content-length': String(job.size),
        'content-disposition': disposition(job.name!),
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
      },
    });
  });

  /* Accounts: only for people who want Pro features. Everything above works without them. */
  app.get('/api/account/providers', (c) => c.json({ enabled: !!auth, ...(auth ? providers(mailer) : { email: false, google: false, apple: false }) }));

  app.on(['GET', 'POST'], '/api/auth/*', (c) => {
    if (!auth) return c.json({ error: 'accountsDisabled' }, 503);
    // better-auth reads the client address from this header (for its rate limit). Set it from the address
    // this app already worked out, and drop any copy the client sent, so it can't be spoofed.
    const headers = new Headers(c.req.raw.headers);
    headers.set(CLIENT_IP_HEADER, c.get('ip'));
    return auth.handler(new Request(c.req.raw, { headers }));
  });

  app.notFound((c) => c.json({ error: 'notFound' }, 404));
  app.onError((err, c) => {
    console.error('[api] unhandled error', err instanceof Error ? err.message : err);
    return c.json({ error: 'internal' }, 500);
  });
  return app;
}
