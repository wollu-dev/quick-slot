import { test } from 'node:test';
import assert from 'node:assert/strict';

process.env.RATE_LIMIT_PER_MINUTE = '3';
process.env.LOG_REQUESTS = 'false';
const { createApp } = await import('../src/app.ts');

test('health answers with security headers', async () => {
  const res = await createApp().request('/api/health');
  assert.equal(res.status, 200);
  const body = (await res.json()) as { ok: boolean; version: string };
  assert.equal(body.ok, true);
  assert.match(body.version, /^\d+\.\d+\.\d+$/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('referrer-policy'), 'no-referrer');
});

test('unknown routes are a JSON 404', async () => {
  const res = await createApp().request('/api/nope');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'notFound' });
});

test('rate limit per client', async () => {
  const app = createApp();
  const statuses = [];
  for (let i = 0; i < 4; i++) statuses.push((await app.request('/api/health')).status);
  assert.deepEqual(statuses, [200, 200, 200, 429]);
  const res = await app.request('/api/health');
  assert.ok(Number(res.headers.get('retry-after')) > 0);
});
