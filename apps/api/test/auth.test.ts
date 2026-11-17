import { after, test } from 'node:test';
import assert from 'node:assert/strict';
import { sql } from 'drizzle-orm';

process.env.LOG_REQUESTS = 'false';
const { createApp } = await import('../src/app.ts');
const { connect, migrate, rowsOf } = await import('../src/db/index.ts');
const { createAuth, CLIENT_IP_HEADER } = await import('../src/auth.ts');
const { config } = await import('../src/config.ts');
type Mail = import('../src/mail.ts').Mail;

config.authSecret = 'test-secret-that-is-long-enough-1234567890';
const { db, close } = await connect('pglite:memory');
await migrate(db);
after(() => close());

const sent: Mail[] = [];
const mailer = async (m: Mail) => {
  sent.push(m);
};
const app = createApp({ auth: createAuth(db, mailer), mailer });
const origin = config.siteUrl;
const json = (body: object, extra: Record<string, string> = {}) => ({
  method: 'POST',
  body: JSON.stringify(body),
  headers: { 'content-type': 'application/json', origin, ...extra },
});
const linkIn = (m: Mail) => {
  const u = new URL(m.text.match(/https?:\/\/\S+/)![0]);
  return u.pathname + u.search;
};
const cookieOf = (res: Response) =>
  res.headers
    .getSetCookie()
    .map((c) => c.split(';')[0])
    .join('; ');

async function signIn(email: string, lang = 'en') {
  const before = sent.length;
  const res = await app.request('/api/auth/sign-in/magic-link', json({ email, callbackURL: '/', metadata: { lang } }));
  assert.equal(res.status, 200, await res.clone().text());
  assert.equal(sent.length, before + 1);
  const verify = await app.request(linkIn(sent.at(-1)!), { headers: { origin } });
  assert.equal(verify.status, 302);
  return cookieOf(verify);
}

test('migrations run once', async () => {
  assert.deepEqual(await migrate(db), []);
  const tables = rowsOf<{ name: string }>(await db.execute(sql`SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY 1`)).map((r) => r.name);
  assert.deepEqual(tables, ['account', 'quickslot_migrations', 'session', 'user', 'verification']);
});

test('the site learns which sign-in methods are on', async () => {
  const res = await app.request('/api/account/providers');
  assert.deepEqual(await res.json(), { enabled: true, email: true, google: false, apple: false });
});

test('sign in with an emailed link, in the language asked for', async () => {
  const cookie = await signIn('Reader@Example.com', 'ja');
  assert.equal(sent.at(-1)!.subject, 'QuickSlot ログインリンク');
  assert.match(sent.at(-1)!.html, /<a href="http:\/\/localhost:4321\/api\/auth\/magic-link\/verify\?token=/);
  const session = await app.request('/api/auth/get-session', { headers: { cookie } });
  const body = (await session.json()) as { user: { email: string } };
  assert.equal(body.user.email, 'reader@example.com');
});

test('sessions keep no IP address or user agent, and link tokens are stored hashed', async () => {
  await app.request('/api/auth/sign-in/magic-link', json({ email: 'hash@example.com', callbackURL: '/' }, { 'user-agent': 'TestBrowser/1.0' }));
  const token = new URL(sent.at(-1)!.text.match(/https?:\/\/\S+/)![0]).searchParams.get('token')!;
  const stored = rowsOf<{ identifier: string; value: string }>(await db.execute(sql`SELECT identifier, value FROM verification`));
  assert.ok(stored.length > 0);
  assert.ok(stored.every((r) => !r.identifier.includes(token) && !r.value.includes(token)), 'raw token not in the database');

  await app.request(linkIn(sent.at(-1)!), { headers: { origin, 'user-agent': 'TestBrowser/1.0' } });
  const sessions = rowsOf<{ ip_address: string | null; user_agent: string | null }>(await db.execute(sql`SELECT ip_address, user_agent FROM session`));
  assert.ok(sessions.length >= 2);
  assert.ok(sessions.every((s) => s.ip_address === null && s.user_agent === null));
});

test('a link signs in only once', async () => {
  await app.request('/api/auth/sign-in/magic-link', json({ email: 'once@example.com', callbackURL: '/' }));
  const link = linkIn(sent.at(-1)!);
  assert.equal((await app.request(link, { headers: { origin } })).status, 302);
  const again = await app.request(link, { headers: { origin } });
  assert.equal(cookieOf(again).includes('session_token=') && !cookieOf(again).includes('session_token=;'), false);
});

test('deleting the account removes the user and their sessions', async () => {
  const cookie = await signIn('leaving@example.com');
  const res = await app.request('/api/auth/delete-user', json({}, { cookie }));
  assert.equal(res.status, 200, await res.clone().text());
  const users = rowsOf<{ n: number }>(await db.execute(sql`SELECT count(*)::int AS n FROM "user" WHERE email = 'leaving@example.com'`));
  assert.equal(users[0].n, 0);
  const session = await app.request('/api/auth/get-session', { headers: { cookie } });
  assert.equal(await session.json(), null);
});

test('a spoofed client address header does not get around the sign-in rate limit', async () => {
  // A fresh app, so earlier tests' requests don't count
  const fresh = createApp({ auth: createAuth(db, mailer), mailer });
  let limited = false;
  let tries = 0;
  for (let i = 0; i < 10 && !limited; i++, tries++) {
    const res = await fresh.request('/api/auth/sign-in/magic-link', json({ email: `spam${i}@example.com`, callbackURL: '/' }, { [CLIENT_IP_HEADER]: `198.51.100.${i}` }));
    limited = res.status === 429;
  }
  assert.ok(limited, 'rate limited despite a different spoofed address on each request');
  assert.ok(tries > 1 && tries <= 6, `limited after ${tries} requests`);
});

test('without a database, accounts are off and the tools still work', async () => {
  const plain = createApp();
  assert.equal((await plain.request('/api/auth/get-session')).status, 503);
  assert.deepEqual(await (await plain.request('/api/account/providers')).json(), { enabled: false, email: false, google: false, apple: false });
  assert.equal((await plain.request('/api/health')).status, 200);
});
