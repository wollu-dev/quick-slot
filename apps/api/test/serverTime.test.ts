import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

process.env.LOG_REQUESTS = 'false';
process.env.ALLOW_PRIVATE_TARGETS = 'true';
process.env.SERVER_TIME_PER_MINUTE = '100';
const { isPrivateAddress, parseTarget } = await import('../src/netguard.ts');
const { measure } = await import('../src/serverTime.ts');
const { createApp } = await import('../src/app.ts');

/** A site whose clock runs `skew` ms ahead of ours and reports it, whole seconds only, in Date */
function fakeSite(skew: number, opts: { frozen?: boolean } = {}) {
  const frozen = new Date(Date.now() + skew).toUTCString();
  const server = http.createServer((req, res) => {
    res.setHeader('Date', opts.frozen ? frozen : new Date(Date.now() + skew).toUTCString());
    res.end();
  });
  return new Promise<{ url: string; close: () => void }>((resolve) =>
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address() as { port: number };
      resolve({ url: `http://127.0.0.1:${port}/`, close: () => server.close() });
    }),
  );
}

const sites: { close: () => void }[] = [];
after(() => sites.forEach((s) => s.close()));

for (const skew of [0, 3456, -1250]) {
  test(`measures a clock ${skew} ms off to within 60 ms`, async () => {
    const site = await fakeSite(skew);
    sites.push(site);
    const m = await measure(new URL(site.url));
    assert.ok(Math.abs(m.offset - skew) <= 60, `offset ${m.offset} for skew ${skew}`);
    assert.ok(m.precision <= 45, `precision ${m.precision}`);
    assert.ok(m.samples <= 25, `samples ${m.samples}`);
  });
}

test('a frozen Date header is reported, not guessed', async () => {
  const site = await fakeSite(0, { frozen: true });
  sites.push(site);
  await assert.rejects(measure(new URL(site.url)), (e: { code: string }) => e.code === 'staticDate');
});

test('private and reserved addresses are blocked', () => {
  for (const a of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', '224.0.0.1'])
    assert.equal(isPrivateAddress(a), true, a);
  for (const a of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPrivateAddress(a), false, a);
});

test('only plain http(s) addresses on default ports', () => {
  assert.equal(parseTarget('example.com').href, 'https://example.com/');
  assert.equal(parseTarget('http://example.com/a?b=1').host, 'example.com');
  for (const bad of ['ftp://example.com', 'file:///etc/passwd', 'https://user:pw@example.com', 'javascript:alert(1)', 'https://']) assert.throws(() => parseTarget(bad), bad);
});

test('the endpoint answers with the offset, and errors as codes', async () => {
  const site = await fakeSite(2000);
  sites.push(site);
  const app = createApp();
  const ok = await app.request('/api/server-time', { method: 'POST', body: JSON.stringify({ url: site.url }), headers: { 'content-type': 'application/json' } });
  assert.equal(ok.status, 200);
  const m = (await ok.json()) as { offset: number; now: number };
  assert.ok(Math.abs(m.offset - 2000) <= 60 && m.now > 0);
  const bad = await app.request('/api/server-time', { method: 'POST', body: JSON.stringify({ url: 'ftp://x' }), headers: { 'content-type': 'application/json' } });
  assert.deepEqual([bad.status, await bad.json()], [400, { error: 'invalidUrl' }]);
  const t = await app.request('/api/time');
  assert.ok(((await t.json()) as { now: number }).now > 1.7e12);
});

test('an address typed without a scheme falls back to http when https does not connect', async () => {
  const site = await fakeSite(1500);
  sites.push(site);
  const bare = site.url.replace('http://', '').replace(/\/$/, '');
  const res = await createApp().request('/api/server-time', { method: 'POST', body: JSON.stringify({ url: bare }), headers: { 'content-type': 'application/json' } });
  assert.equal(res.status, 200);
  const m = (await res.json()) as { offset: number };
  assert.ok(Math.abs(m.offset - 1500) <= 60, `offset ${m.offset}`);
});
