import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';

process.env.LOG_REQUESTS = 'false';
const { createApp } = await import('../../app.ts');
const { connect, migrate, rowsOf, CORE_MIGRATIONS } = await import('../../db/index.ts');
const { createAuth } = await import('../../auth.ts');
const { config } = await import('../../config.ts');
const ee = await import('../index.ts');
type Mail = import('../../mail.ts').Mail;

const SECRET = 'sync_webhook_secret';
config.authSecret = 'test-secret-that-is-long-enough-1234567890';
config.paddle = { environment: 'sandbox', clientToken: 't', webhookSecret: SECRET, prices: { monthly: 'm', yearly: 'y' }, apiKey: '', apiBase: '' };

const { db, close } = await connect('pglite:memory');
const applied = await migrate(db, [CORE_MIGRATIONS, ...ee.migrations]);
after(() => close());
const sent: Mail[] = [];
const mailer = async (m: Mail) => {
  sent.push(m);
};
const app = createApp({ auth: createAuth(db, mailer), mailer, db, plugins: ee.plugins });
const origin = config.siteUrl;

async function signIn(email: string) {
  await app.request('/api/auth/sign-in/magic-link', { method: 'POST', body: JSON.stringify({ email, callbackURL: '/' }), headers: { 'content-type': 'application/json', origin } });
  const u = new URL(sent.at(-1)!.text.match(/https?:\/\/\S+/)![0]);
  const res = await app.request(u.pathname + u.search, { headers: { origin } });
  const cookie = res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');
  const s = (await (await app.request('/api/auth/get-session', { headers: { cookie } })).json()) as { user: { id: string } };
  return { cookie, userId: s.user.id };
}
async function makePro(userId: string) {
  const body = JSON.stringify({ event_id: `evt_${userId}`, event_type: 'subscription.created', occurred_at: new Date().toISOString(), data: { id: `sub_${userId}`, status: 'active', custom_data: { userId } } });
  const ts = Math.floor(Date.now() / 1000);
  const h1 = createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex');
  await app.request('/api/billing/paddle/webhook', { method: 'POST', body, headers: { 'paddle-signature': `ts=${ts};h1=${h1}` } });
}
const put = (cookie: string, key: string, body: unknown, extra: Record<string, string> = {}) =>
  app.request(`/api/sync/${key}`, { method: 'PUT', body: typeof body === 'string' ? body : JSON.stringify(body), headers: { 'content-type': 'application/json', origin, cookie, ...extra } });

const tools = [{ id: 'abc123', name: 'My chat', url: 'https://chat.example.com/', color: 2 }];

test('paid migrations run after the core ones', () => {
  assert.equal(applied.at(-1), 'ee_0001_sync.sql');
});

test('sync is for Pro: 401 signed out, 403 on the free plan', async () => {
  assert.equal((await app.request('/api/sync')).status, 401);
  const { cookie } = await signIn('free@example.com');
  assert.equal((await app.request('/api/sync', { headers: { cookie } })).status, 403);
  assert.equal((await put(cookie, 'slots', { data: [], baseVersion: 0 })).status, 403);
});

test('save, read back, and refuse a stale version with the server copy', async () => {
  const { cookie, userId } = await signIn('pro@example.com');
  await makePro(userId);
  assert.deepEqual(await (await app.request('/api/sync', { headers: { cookie } })).json(), { items: {} });

  assert.deepEqual(await (await put(cookie, 'customTools', { data: tools, baseVersion: 0 })).json(), { version: 1 });
  assert.deepEqual(await (await put(cookie, 'slots', { data: ['json-formatter', null, 'custom:abc123'], baseVersion: 0 })).json(), { version: 1 });
  assert.deepEqual(await (await app.request('/api/sync', { headers: { cookie } })).json(), {
    items: { customTools: { data: tools, version: 1 }, slots: { data: ['json-formatter', null, 'custom:abc123'], version: 1 } },
  });

  // Another device saves first; this one still thinks it's at version 0
  const stale = await put(cookie, 'slots', { data: ['qr-code'], baseVersion: 0 });
  assert.equal(stale.status, 409);
  assert.deepEqual(await stale.json(), { error: 'conflict', data: ['json-formatter', null, 'custom:abc123'], version: 1 });
  assert.deepEqual(await (await put(cookie, 'slots', { data: ['qr-code'], baseVersion: 1 })).json(), { version: 2 });
});

test('only the known shapes are stored', async () => {
  const { cookie, userId } = await signIn('shapes@example.com');
  await makePro(userId);
  const bad = [
    ['slots', { data: Array(10).fill(null), baseVersion: 0 }],
    ['slots', { data: [{ x: 1 }], baseVersion: 0 }],
    ['customTools', { data: [{ ...tools[0], url: 'javascript:alert(1)' }], baseVersion: 0 }],
    ['customTools', { data: [{ ...tools[0], extra: 'nope' }], baseVersion: 0 }],
    ['customTools', { data: tools }],
    ['customTools', 'not json'],
  ] as const;
  for (const [key, body] of bad) assert.equal((await put(cookie, key, body)).status, 400, JSON.stringify(body));
  assert.equal((await put(cookie, 'passwords', { data: [], baseVersion: 0 })).status, 404);
  assert.equal((await put(cookie, 'slots', JSON.stringify({ data: [], baseVersion: 0, pad: 'x'.repeat(70_000) }))).status, 413);
  assert.equal((await put(cookie, 'slots', { data: [], baseVersion: 0 }, { origin: 'https://evil.example' })).status, 403);
});

test('each user sees only their own items, and they go with the account', async () => {
  const a = await signIn('owner@example.com');
  const b = await signIn('other@example.com');
  await makePro(a.userId);
  await makePro(b.userId);
  await put(a.cookie, 'customTools', { data: tools, baseVersion: 0 });
  assert.deepEqual(await (await app.request('/api/sync', { headers: { cookie: b.cookie } })).json(), { items: {} });

  // Cancel so the account can be deleted, then delete it
  const body = JSON.stringify({ event_id: `evt_cancel_${a.userId}`, event_type: 'subscription.canceled', occurred_at: new Date(Date.now() + 1000).toISOString(), data: { id: `sub_${a.userId}`, status: 'canceled' } });
  const ts = Math.floor(Date.now() / 1000);
  await app.request('/api/billing/paddle/webhook', { method: 'POST', body, headers: { 'paddle-signature': `ts=${ts};h1=${createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')}` } });
  assert.equal((await app.request('/api/auth/delete-user', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin, cookie: a.cookie } })).status, 200);
  const left = rowsOf<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM sync_item WHERE user_id = ${a.userId}`));
  assert.equal(left[0].n, 0);
});

test('without the paid folder there is no sync route', async () => {
  const free = createApp({ auth: createAuth(db, mailer), mailer, db });
  assert.equal((await free.request('/api/sync')).status, 404);
});
