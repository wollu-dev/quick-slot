import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.LOG_REQUESTS = 'false';
process.env.RATE_LIMIT_PER_MINUTE = '1000';
const { createApp } = await import('../src/app.ts');

// A small built site: home, one tool page, a hashed asset, and a secret file next to the folder
const parent = mkdtempSync(join(tmpdir(), 'quickslot-site-'));
const dir = join(parent, 'dist');
mkdirSync(join(dir, 'tools', 'qr-code'), { recursive: true });
mkdirSync(join(dir, '_astro'));
writeFileSync(join(dir, 'index.html'), '<h1>home</h1>');
writeFileSync(join(dir, 'tools', 'qr-code', 'index.html'), '<h1>qr</h1>');
writeFileSync(join(dir, '_astro', 'app.abc123.js'), 'console.log(1);\n'.repeat(200));
writeFileSync(join(parent, 'secret.txt'), 'nope');

const app = createApp({ siteDir: dir });

test('pages are found with or without a trailing slash', async () => {
  for (const path of ['/', '/tools/qr-code', '/tools/qr-code/']) {
    const res = await app.request(path);
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get('content-type') ?? '', /^text\/html/);
  }
  assert.equal(await (await app.request('/tools/qr-code')).text(), '<h1>qr</h1>');
});

test('site headers, caching and revalidation', async () => {
  const page = await app.request('/');
  assert.equal(page.headers.get('cache-control'), 'no-cache');
  assert.equal(page.headers.get('x-frame-options'), 'SAMEORIGIN');
  assert.equal(page.headers.get('referrer-policy'), 'strict-origin-when-cross-origin');
  assert.match(page.headers.get('permissions-policy') ?? '', /camera=\(self\)/);
  const again = await app.request('/', { headers: { 'if-none-match': page.headers.get('etag')! } });
  assert.equal(again.status, 304);

  const asset = await app.request('/_astro/app.abc123.js', { headers: { 'accept-encoding': 'gzip' } });
  assert.equal(asset.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(asset.headers.get('content-encoding'), 'gzip');
});

test('missing files are a 404 and nothing outside the folder is served', async () => {
  for (const path of ['/nope', '/../secret.txt', '/%2e%2e/secret.txt', '/tools/%2e%2e/%2e%2e/secret.txt', '/%00']) {
    const res = await app.request(path);
    assert.equal(res.status, 404, path);
    assert.doesNotMatch(await res.text(), /nope$/);
  }
});

test('the API keeps its own answers next to the site', async () => {
  const health = await app.request('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.headers.get('referrer-policy'), 'no-referrer');
  const missing = await app.request('/api/nope');
  assert.equal(missing.status, 404);
  assert.deepEqual(await missing.json(), { error: 'notFound' });
});

test('API requests with a large body are refused', async () => {
  const res = await app.request('/api/server-time', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: 'x'.repeat(70_000) }) });
  assert.equal(res.status, 413);
});

test('without SITE_DIR only the API answers', async () => {
  const res = await createApp({ siteDir: '' }).request('/');
  assert.equal(res.status, 404);
});
