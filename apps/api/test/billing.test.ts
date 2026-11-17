import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Hono } from 'hono';

process.env.LOG_REQUESTS = 'false';
const { createApp } = await import('../src/app.ts');
const { connect, migrate } = await import('../src/db/index.ts');
const { createAuth } = await import('../src/auth.ts');
const { config } = await import('../src/config.ts');
const { verifyPaddleSignature, requirePro, planOf } = await import('../src/billing.ts');
type Mail = import('../src/mail.ts').Mail;

const SECRET = 'pdl_ntfset_test_secret';
config.authSecret = 'test-secret-that-is-long-enough-1234567890';
config.paddle = { environment: 'sandbox', clientToken: 'test_client_token', webhookSecret: SECRET, prices: { monthly: 'pri_month', yearly: 'pri_year' } };

const { db, close } = await connect('pglite:memory');
await migrate(db);
after(() => close());
const sent: Mail[] = [];
const mailer = async (m: Mail) => {
  sent.push(m);
};
const auth = createAuth(db, mailer);
const app = createApp({ auth, mailer, db });
const origin = config.siteUrl;

const sign = (body: string, ts = Math.floor(Date.now() / 1000), secret = SECRET) => `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')}`;
const deliver = (event: object, header?: string) => {
  const body = JSON.stringify(event);
  return app.request('/api/billing/paddle/webhook', { method: 'POST', body, headers: { 'content-type': 'application/json', 'paddle-signature': header ?? sign(body) } });
};
let n = 0;
const event = (type: string, data: object, occurredAt = new Date().toISOString()) => ({ event_id: `evt_${++n}`, event_type: type, occurred_at: occurredAt, data });
const days = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

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
const me = async (cookie: string) => (await (await app.request('/api/billing/me', { headers: { cookie } })).json()) as { plan: string; periodEnd: string | null; cancelAt: string | null };

test('Paddle signatures: valid, wrong secret, old, tampered', () => {
  const body = '{"a":1}';
  assert.equal(verifyPaddleSignature(body, sign(body), SECRET), true);
  assert.equal(verifyPaddleSignature(body, sign(body, undefined, 'other'), SECRET), false);
  assert.equal(verifyPaddleSignature(body, sign(body, Math.floor(Date.now() / 1000) - 600), SECRET), false, 'older than 5 minutes');
  assert.equal(verifyPaddleSignature('{"a":2}', sign(body), SECRET), false, 'body changed');
  assert.equal(verifyPaddleSignature(body, undefined, SECRET), false);
  // Paddle may send two h1 values while rotating secrets
  const ts = Math.floor(Date.now() / 1000);
  assert.equal(verifyPaddleSignature(body, `ts=${ts};h1=00ff;h1=${createHmac('sha256', SECRET).update(`${ts}:${body}`).digest('hex')}`, SECRET), true);
});

test('the site gets the checkout settings, and nothing secret', async () => {
  const body = (await (await app.request('/api/billing/config')).json()) as { checkout: Record<string, unknown> };
  assert.deepEqual(body.checkout, { provider: 'paddle', environment: 'sandbox', clientToken: 'test_client_token', prices: { monthly: 'pri_month', yearly: 'pri_year' } });
  assert.ok(!JSON.stringify(body).includes(SECRET));
});

test('a subscription makes the user Pro; repeats and old events change nothing', async () => {
  const { cookie, userId } = await signIn('buyer@example.com');
  assert.equal((await me(cookie)).plan, 'free');

  const created = event('subscription.created', { id: 'sub_1', status: 'active', customer_id: 'ctm_1', items: [{ price: { id: 'pri_month' } }], current_billing_period: { ends_at: days(30) }, custom_data: { userId } });
  assert.deepEqual(await (await deliver(created)).json(), { result: 'applied' });
  const pro = await me(cookie);
  assert.equal(pro.plan, 'pro');
  assert.ok(pro.periodEnd && new Date(pro.periodEnd).getTime() > Date.now());

  assert.deepEqual(await (await deliver(created)).json(), { result: 'duplicate' });
  const old = event('subscription.updated', { id: 'sub_1', status: 'canceled' }, new Date(Date.now() - 3_600_000).toISOString());
  assert.deepEqual(await (await deliver(old)).json(), { result: 'stale' });
  assert.equal((await me(cookie)).plan, 'pro');
});

test('the webhook refuses unsigned events', async () => {
  const res = await deliver(event('subscription.created', { id: 'sub_x', status: 'active', custom_data: { userId: 'someone' } }), 'ts=1;h1=00');
  assert.equal(res.status, 401);
});

test('an event for an unknown user is ignored', async () => {
  const res = await deliver(event('subscription.created', { id: 'sub_ghost', status: 'active', custom_data: { userId: 'no-such-user' } }));
  assert.deepEqual(await res.json(), { result: 'unknownUser' });
});

test('cancelling: Pro until the end of the period, then free; the account can then be deleted', async () => {
  const { cookie, userId } = await signIn('leaver@example.com');
  await deliver(event('subscription.created', { id: 'sub_2', status: 'active', items: [{ price: { id: 'pri_year' } }], current_billing_period: { ends_at: days(200) }, custom_data: { userId } }));

  // Renewing: deleting the account is refused, so the user isn't left paying for nothing
  const blocked = await app.request('/api/auth/delete-user', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin, cookie } });
  assert.equal(blocked.status, 400);
  assert.match(await blocked.text(), /activeSubscription/);

  await deliver(event('subscription.updated', { id: 'sub_2', status: 'active', current_billing_period: { ends_at: days(200) }, scheduled_change: { action: 'cancel', effective_at: days(200) } }));
  const ending = await me(cookie);
  assert.equal(ending.plan, 'pro');
  assert.ok(ending.cancelAt);

  await deliver(event('subscription.canceled', { id: 'sub_2', status: 'canceled', canceled_at: new Date().toISOString() }));
  assert.equal((await me(cookie)).plan, 'free');

  const deleted = await app.request('/api/auth/delete-user', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', origin, cookie } });
  assert.equal(deleted.status, 200);
  assert.equal((await planOf(db, userId)).plan, 'free');
});

test('Pro-only routes: 401 signed out, 403 on free, open on Pro', async () => {
  const guarded = new Hono();
  guarded.get('/pro', requirePro(db, async (headers) => (await auth.api.getSession({ headers })) as { user: { id: string } } | null), (c) => c.text('ok'));
  assert.equal((await guarded.request('/pro')).status, 401);
  const free = await signIn('free@example.com');
  const res = await guarded.request('/pro', { headers: { cookie: free.cookie } });
  assert.equal(res.status, 403);
  assert.deepEqual(await res.json(), { error: 'proRequired' });
  await deliver(event('subscription.created', { id: 'sub_3', status: 'trialing', custom_data: { userId: free.userId }, current_billing_period: { ends_at: days(7) } }));
  assert.equal((await guarded.request('/pro', { headers: { cookie: free.cookie } })).status, 200);
});

test('without payment settings the checkout is off and the webhook is not there', async () => {
  const saved = config.paddle;
  config.paddle = null;
  try {
    assert.deepEqual(await (await app.request('/api/billing/config')).json(), { checkout: null });
    assert.equal((await deliver(event('subscription.created', { id: 'x', status: 'active' }))).status, 404);
  } finally {
    config.paddle = saved;
  }
});
