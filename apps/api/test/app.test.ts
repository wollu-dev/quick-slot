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

test('tools turned off with HIDE_TOOLS or SHOW_TOOLS lose their routes', async () => {
  const post = (app: ReturnType<typeof createApp>, path: string) => app.request(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
  const hidden = createApp({ hide: ['video-downloader'], show: [] });
  assert.equal((await post(hidden, '/api/video/info')).status, 404);
  assert.equal((await hidden.request('/api/video/jobs/abc')).status, 404);
  assert.equal((await post(hidden, '/api/server-time')).status, 400); // still there (empty body)
  const byCategory = createApp({ hide: ['life'], show: [] });
  assert.equal((await post(byCategory, '/api/server-time')).status, 404);
  const only = createApp({ hide: [], show: ['pdf'] });
  assert.equal((await post(only, '/api/server-time')).status, 404);
  assert.equal((await post(only, '/api/video/info')).status, 404);
  assert.equal((await only.request('/api/health')).status, 200);
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
