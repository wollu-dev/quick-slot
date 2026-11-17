import { randomBytes } from 'node:crypto';
import { serve } from '@hono/node-server';
import { createApp, type Deps, type Plugin } from './app.ts';
import { config } from './config.ts';
import { clearLeftovers } from './video.ts';

await clearLeftovers();

/**
 * Paid features live in ./ee (QuickSlot Enterprise License). Only this entry point loads them, and only when
 * the folder exists: without it the free build still runs.
 */
async function loadEe() {
  try {
    // A path in a variable, so type checking doesn't require the folder either
    const path = './ee/index.ts';
    return (await import(path)) as { plugins: Plugin[]; migrations: URL[] };
  } catch (e) {
    if ((e as { code?: string }).code === 'ERR_MODULE_NOT_FOUND' && String((e as Error).message).includes('ee')) return null;
    throw e;
  }
}

/** Accounts are on only when DATABASE_URL is set; the tools work either way */
async function accounts(): Promise<Deps & { close?: () => Promise<void> }> {
  if (!config.databaseUrl) {
    console.log('[api] accounts off (no DATABASE_URL)');
    return {};
  }
  if (process.env.NODE_ENV === 'production' && !process.env.SITE_URL) throw new Error('SITE_URL is required when DATABASE_URL is set (sign-in links point to it)');
  if (!config.authSecret) {
    if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET is required when DATABASE_URL is set');
    config.authSecret = randomBytes(32).toString('base64url');
    console.log('[api] no AUTH_SECRET: using a random one, so sign-ins end when the server restarts');
  }
  const { connect, migrate, CORE_MIGRATIONS } = await import('./db/index.ts');
  const { createAuth } = await import('./auth.ts');
  const { createMailer } = await import('./mail.ts');
  const { db, close } = await connect(config.databaseUrl);
  const ee = await loadEe();
  const applied = await migrate(db, [CORE_MIGRATIONS, ...(ee?.migrations ?? [])]);
  if (applied.length) console.log(`[api] database migrations applied: ${applied.join(', ')}`);
  const mailer = createMailer();
  if (!mailer) console.log('[api] email sign-in off (no SMTP_URL)');
  if (!config.paddle) console.log('[api] payments off (no PADDLE_* settings)');
  return { auth: createAuth(db, mailer), mailer, db, close, plugins: ee?.plugins ?? [] };
}

const deps = await accounts();
const server = serve({ fetch: createApp(deps).fetch, port: config.port }, (info) => {
  console.log(`[api] listening on :${info.port}`);
});

// Finish in-flight requests on shutdown (docker stop sends SIGTERM)
for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    server.close(async () => {
      await deps.close?.().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => process.exit(0), 10_000).unref();
  });
}
