import { test } from 'node:test';
import assert from 'node:assert/strict';

// Production settings: private targets and non-default ports are refused
delete process.env.ALLOW_PRIVATE_TARGETS;
const { parseTarget, guardedLookup } = await import('../src/netguard.ts');

test('non-default ports are refused', () => {
  assert.throws(() => parseTarget('https://example.com:8443'), (e: { code: string }) => e.code === 'blockedAddress');
});

test('a host that resolves to a private address is refused at connect time', async () => {
  const err = await new Promise<NodeJS.ErrnoException | null>((resolve) => guardedLookup('localhost', {}, (e) => resolve(e)));
  assert.equal((err as { code?: string } | null)?.code, 'blockedAddress');
});
