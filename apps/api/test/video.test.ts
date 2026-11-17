import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const work = join(tmpdir(), `qs-video-test-${process.pid}`);
process.env.LOG_REQUESTS = 'false';
process.env.ALLOW_PRIVATE_TARGETS = 'true';
process.env.VIDEO_WORK_DIR = work;
process.env.VIDEO_PER_HOUR = '100';
process.env.YTDLP_PATH = process.execPath;
process.env.YTDLP_ARGS = fileURLToPath(new URL('./fake-ytdlp.mjs', import.meta.url));
const { createApp } = await import('../src/app.ts');

const app = createApp();
const post = (path: string, body: object) => app.request(path, { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
const waitDone = async (id: string) => {
  for (let i = 0; i < 100; i++) {
    const s = (await (await app.request(`/api/video/jobs/${id}`)).json()) as { status: string; progress: number; error?: string; name?: string; size?: number };
    if (s.status === 'done' || s.status === 'error') return s;
    await new Promise((r) => setTimeout(r, 50));
  }
  throw new Error('job never finished');
};

test('info lists the title and the heights', async () => {
  const res = await post('/api/video/info', { url: 'https://videos.test/ok' });
  assert.equal(res.status, 200);
  const j = (await res.json()) as { title: string; heights: number[]; site: string };
  assert.equal(j.title, 'Test video / 테스트 영상');
  assert.deepEqual(j.heights, [1080, 720, 360]);
  assert.equal(j.site, 'FakeTube');
});

test('errors come back as codes, never as yt-dlp text', async () => {
  for (const [path, code] of [
    ['/private', 'unavailable'],
    ['/unsupported', 'unsupported'],
    ['/live', 'live'],
    ['/long', 'tooLong'],
    ['/list', 'unsupported'],
  ]) {
    const res = await post('/api/video/info', { url: `https://videos.test${path}` });
    assert.deepEqual(await res.json(), { error: code }, path);
  }
  assert.deepEqual(await (await post('/api/video/info', { url: 'ftp://x' })).json(), { error: 'invalidUrl' });
});

test('a download job reports progress, serves the file once, then deletes it', async () => {
  const created = await post('/api/video/jobs', { url: 'https://videos.test/ok', format: 'mp4-720' });
  assert.equal(created.status, 202);
  const { id } = (await created.json()) as { id: string };
  const s = await waitDone(id);
  assert.equal(s.status, 'done');
  assert.equal(s.progress, 1);
  assert.equal(s.size, 4096);
  assert.ok(s.name!.endsWith('.mp4'));
  const file = await app.request(`/api/video/jobs/${id}/file`);
  assert.equal(file.status, 200);
  assert.match(file.headers.get('content-disposition')!, /filename\*=UTF-8''Test%20video%20%E2%A7%B8%20/);
  assert.equal((await file.arrayBuffer()).byteLength, 4096);
  await new Promise((r) => setTimeout(r, 100));
  assert.equal((await app.request(`/api/video/jobs/${id}/file`)).status, 404, 'second fetch refused');
  assert.equal(existsSync(join(work, id)), false);
});

test('audio formats and size limits', async () => {
  const mp3 = (await (await post('/api/video/jobs', { url: 'https://videos.test/ok', format: 'mp3' })).json()) as { id: string };
  const s = await waitDone(mp3.id);
  assert.ok(s.name!.endsWith('.mp3') && s.size === 2048);
  const big = (await (await post('/api/video/jobs', { url: 'https://videos.test/big', format: 'mp4-1080' })).json()) as { id: string };
  assert.deepEqual([(await waitDone(big.id)).status, (await waitDone(big.id)).error], ['error', 'tooLarge']);
  assert.deepEqual(await (await post('/api/video/jobs', { url: 'https://videos.test/ok', format: 'webm-8k' })).json(), { error: 'invalidFormat' });
});

test('a job belongs to the client that started it', async () => {
  const { id } = (await (await post('/api/video/jobs', { url: 'https://videos.test/ok', format: 'm4a' })).json()) as { id: string };
  await waitDone(id);
  const other = await app.request(`/api/video/jobs/${id}`, { headers: {} }, { incoming: { socket: { remoteAddress: '203.0.113.9' } } });
  assert.equal(other.status, 404);
});

test('an unexplained failure is retried once', async () => {
  const { id } = (await (await post('/api/video/jobs', { url: 'https://videos.test/flaky', format: 'mp4-480' })).json()) as { id: string };
  const s = await waitDone(id);
  assert.equal(s.status, 'done');
});

test('MP4 asks for H.264 first, so the file plays everywhere', async () => {
  const { formatArgs } = await import('../src/video.ts');
  const f = formatArgs('mp4-720')[1];
  assert.ok(f.split('/')[0].includes('[height<=720][vcodec^=avc1]'), f);
});
