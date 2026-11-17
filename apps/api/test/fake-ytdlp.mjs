// Stands in for yt-dlp in tests: answers by the URL path, so no real site is ever contacted.
import { mkdirSync, writeFileSync } from 'node:fs';
import { existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const args = process.argv.slice(2);
const url = new URL(args.at(-1));
const has = (a) => args.includes(a);
const after = (a) => args[args.indexOf(a) + 1];

// The safety flags must always be there
if (after('--use-extractors') !== 'default,-generic' || !has('--no-playlist') || after('--playlist-items') !== '1') {
  process.stderr.write('ERROR: missing safety flags\n');
  process.exit(2);
}

const title = 'Test video / 테스트 영상';
const fail = (msg) => {
  process.stderr.write(`ERROR: [fake] ${msg}\n`);
  process.exit(1);
};

switch (url.pathname) {
  case '/private':
    fail('abc: Private video. Sign in if you have access');
  case '/unsupported':
    fail(`Unsupported URL: ${url.href}`);
  case '/flaky': {
    // Fails the first download with an unexplained error, then works
    const mark = join(tmpdir(), `qs-fake-flaky-${process.ppid}`);
    if (!has('-J') && !existsSync(mark)) {
      writeFileSync(mark, '');
      fail('HTTP Error 503: Service Unavailable');
    }
    if (!has('-J')) rmSync(mark);
    break;
  }
  case '/big':
    if (!has('-J')) fail('File is larger than max-filesize (2000000000 bytes > 1073741824 bytes). Aborting.');
}

if (has('-J') && url.pathname === '/list') {
  process.stdout.write(JSON.stringify({ _type: 'playlist', title: 'A list', entries: [] }));
  process.exit(0);
}

if (has('-J')) {
  const info = { title, uploader: 'Uploader', duration: url.pathname === '/long' ? 999999 : 61, is_live: url.pathname === '/live', extractor_key: 'FakeTube', formats: [{ height: 1080, vcodec: 'avc1' }, { height: 720, vcodec: 'avc1' }, { height: 360, vcodec: 'avc1' }, { height: null, vcodec: 'none' }] };
  process.stdout.write(JSON.stringify(info));
  process.exit(0);
}

// Download: progress lines for each part, then the finished file
const audio = has('-x');
const ext = audio ? after('--audio-format') : 'mp4';
const parts = audio ? 1 : 2;
const out = after('-o').replace('%(title).120B', title.replace(/\//g, '⧸')).replace('%(ext)s', ext);
mkdirSync(dirname(out), { recursive: true });
let i = 0;
const steps = [10, 50, 100];
const timer = setInterval(() => {
  const p = steps[i % steps.length];
  process.stdout.write(`qs-progress ${p.toFixed(1)}%\n`);
  i++;
  if (i === steps.length * parts) {
    clearInterval(timer);
    writeFileSync(out, Buffer.alloc(audio ? 2048 : 4096, 7));
    process.exit(0);
  }
}, 30);
