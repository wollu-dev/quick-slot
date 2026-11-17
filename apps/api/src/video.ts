/**
 * Video downloader (server tool) on top of yt-dlp.
 *
 * - One video per address: playlists are refused, and a download never takes more than one item.
 * - Only yt-dlp's site-specific extractors run; the generic one, which would fetch any URL, is turned off.
 *   The address must also resolve to a public network address (see netguard.ts).
 * - Downloads run as jobs: create, poll progress, fetch the file once. The file is deleted as soon as
 *   it has been sent, or 10 minutes after it is ready if nobody fetches it. Nothing else is kept.
 * - Size, length, concurrency and per-client limits keep one user from filling the server.
 */
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import dns from 'node:dns/promises';
import { createReadStream } from 'node:fs';
import { mkdir, readdir, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from './config.ts';
import { isPrivateAddress, parseTarget } from './netguard.ts';

export type VideoError = 'invalidUrl' | 'blockedAddress' | 'notFound' | 'unsupported' | 'unavailable' | 'live' | 'tooLong' | 'tooLarge' | 'busy' | 'failed';
export class VideoFailure extends Error {
  code: VideoError;
  constructor(code: VideoError) {
    super(code);
    this.code = code;
  }
}

export type VideoFormat = 'mp4-1080' | 'mp4-720' | 'mp4-480' | 'm4a' | 'mp3';
export const FORMATS: VideoFormat[] = ['mp4-1080', 'mp4-720', 'mp4-480', 'm4a', 'mp3'];

// Node (already in the image) runs the JavaScript some sites, such as YouTube, need
const BASE_ARGS = ['--js-runtimes', 'node', '--no-playlist', '--playlist-items', '1', '--use-extractors', 'default,-generic', '--no-warnings', '--no-cache-dir', '--no-mtime', '--socket-timeout', '20'];

function run(args: string[], timeoutMs: number, onLine?: (line: string) => void): Promise<{ code: number; out: string; err: string }> {
  return new Promise((resolve) => {
    const child = spawn(config.ytdlp.cmd, [...config.ytdlp.pre, ...args], { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    let out = '';
    let err = '';
    let partial = '';
    child.stdout.on('data', (d: Buffer) => {
      const s = d.toString();
      out += s.length + out.length < 4_000_000 ? s : '';
      if (onLine) {
        partial += s;
        const lines = partial.split(/\r?\n/);
        partial = lines.pop() ?? '';
        lines.forEach(onLine);
      }
    });
    child.stderr.on('data', (d: Buffer) => {
      err = (err + d.toString()).slice(-4000);
    });
    const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? 1, out, err });
    });
    child.on('error', () => {
      clearTimeout(timer);
      resolve({ code: 1, out, err: 'spawn failed' });
    });
  });
}

/** Maps yt-dlp's error text to a code (the text itself is never sent to the browser or logged) */
function classify(err: string): VideoError {
  if (/Unsupported URL|no suitable extractor|is not a valid URL/i.test(err)) return 'unsupported';
  if (/larger than max-filesize|File is larger/i.test(err)) return 'tooLarge';
  if (/does not pass filter|skipping/i.test(err)) return 'tooLong';
  // Only yt-dlp's messages about the video itself; an HTTP error such as '503 Service Unavailable' is not one of them
  if (/Private video|Sign in to|members[- ]only|Join this channel|Video unavailable|video is (no longer )?(un)?available|not available in your country|has been removed|copyright|age[- ]restricted|confirm your age/i.test(err)) return 'unavailable';
  return 'failed';
}

/** Checks the address and that its host is a public address */
export async function checkUrl(input: string): Promise<URL> {
  const url = parseTarget(input);
  if (config.allowPrivateTargets) return url;
  let addresses: { address: string }[];
  try {
    addresses = await dns.lookup(url.hostname, { all: true });
  } catch {
    throw new VideoFailure('notFound');
  }
  if (!addresses.length || addresses.some((a) => isPrivateAddress(a.address))) throw new VideoFailure('blockedAddress');
  return url;
}

export interface VideoInfo {
  title: string;
  uploader?: string;
  duration?: number;
  site: string;
  /** Heights offered, highest first */
  heights: number[];
}

export async function info(url: URL): Promise<VideoInfo> {
  const r = await run([...BASE_ARGS, '-J', '--skip-download', '--flat-playlist', url.href], 45_000);
  if (r.code !== 0) throw new VideoFailure(classify(r.err));
  let j: { _type?: string; title?: string; uploader?: string; channel?: string; duration?: number; is_live?: boolean; extractor_key?: string; formats?: { height?: number | null; vcodec?: string }[] };
  try {
    j = JSON.parse(r.out);
  } catch {
    throw new VideoFailure('failed');
  }
  // One video per address: a playlist or channel page is refused instead of downloading everything in it
  if (j._type === 'playlist' || j._type === 'multi_video') throw new VideoFailure('unsupported');
  if (j.is_live) throw new VideoFailure('live');
  if (j.duration && j.duration > config.videoMaxMinutes * 60) throw new VideoFailure('tooLong');
  const heights = [...new Set((j.formats ?? []).filter((f) => f.height && f.vcodec !== 'none').map((f) => f.height as number))].sort((a, b) => b - a);
  return { title: j.title ?? '', uploader: j.uploader ?? j.channel, duration: j.duration, site: j.extractor_key ?? url.hostname, heights };
}

export function formatArgs(f: VideoFormat): string[] {
  if (f === 'm4a') return ['-f', 'ba[ext=m4a]/ba', '-x', '--audio-format', 'm4a'];
  if (f === 'mp3') return ['-f', 'ba', '-x', '--audio-format', 'mp3', '--audio-quality', '192K'];
  const h = Number(f.split('-')[1]);
  const v = `bv*[height<=${h}]`;
  // H.264 first: it plays everywhere, while AV1 or VP9 in an MP4 does not play on many phones and PCs
  return ['-f', `${v}[vcodec^=avc1]+ba[ext=m4a]/b[height<=${h}][vcodec^=avc1]/${v}[ext=mp4]+ba[ext=m4a]/b[height<=${h}][ext=mp4]/${v}+ba/b[height<=${h}]`, '--merge-output-format', 'mp4'];
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

interface Job {
  id: string;
  owner: string;
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  dir: string;
  file?: string;
  name?: string;
  size?: number;
  error?: VideoError;
  expires?: NodeJS.Timeout;
}

const jobs = new Map<string, Job>();
const queue: (() => void)[] = [];
let running = 0;
/** Jobs started per client, for the hourly limit */
const starts = new Map<string, number[]>();

const LINGER = 10 * 60_000;

async function cleanup(job: Job) {
  clearTimeout(job.expires);
  jobs.delete(job.id);
  await rm(job.dir, { recursive: true, force: true }).catch(() => {});
}

export function createJob(url: URL, format: VideoFormat, owner: string): Job {
  const now = Date.now();
  const recent = (starts.get(owner) ?? []).filter((t) => now - t < 3_600_000);
  const active = [...jobs.values()].filter((j) => j.owner === owner && (j.status === 'queued' || j.status === 'running')).length;
  if (recent.length >= config.videoPerHour || active >= 2) throw new VideoFailure('busy');
  starts.set(owner, [...recent, now]);
  const job: Job = { id: randomUUID(), owner, status: 'queued', progress: 0, dir: join(config.videoWorkDir, randomUUID()) };
  jobs.set(job.id, job);
  const start = () => {
    running++;
    job.status = 'running';
    work(job, url, format).finally(() => {
      running--;
      queue.shift()?.();
    });
  };
  if (running < config.videoConcurrent) start();
  else queue.push(start);
  return job;
}

async function work(job: Job, url: URL, format: VideoFormat) {
  try {
    try {
      await attempt(job, url, format);
    } catch (e) {
      // Sites fail now and then for no lasting reason: try once more when the cause is unknown
      if (!(e instanceof VideoFailure && e.code === 'failed')) throw e;
      await rm(job.dir, { recursive: true, force: true }).catch(() => {});
      job.progress = 0;
      await attempt(job, url, format);
    }
    job.progress = 1;
    job.status = 'done';
  } catch (e) {
    job.status = 'error';
    job.error = e instanceof VideoFailure ? e.code : 'failed';
    await rm(job.dir, { recursive: true, force: true }).catch(() => {});
  }
  job.expires = setTimeout(() => cleanup(job), LINGER);
  job.expires.unref();
}

async function attempt(job: Job, url: URL, format: VideoFormat) {
  await mkdir(job.dir, { recursive: true });
  // Downloads of video and audio each go 0→100 %; count the parts so the bar keeps moving forward
  let part = 0;
  let last = 0;
  const parts = format.startsWith('mp4') ? 2 : 1;
  const r = await run(
    [
      ...BASE_ARGS,
      ...formatArgs(format),
      '--max-filesize',
      `${config.videoMaxMb}M`,
      '--match-filter',
      `!is_live & duration <= ${config.videoMaxMinutes * 60}`,
      '--newline',
      '--progress-template',
      'download:qs-progress %(progress._percent_str)s',
      '-o',
      join(job.dir, '%(title).120B.%(ext)s'),
      url.href,
    ],
    config.videoMaxMinutes * 60_000,
    (line) => {
      const m = line.match(/^qs-progress\s+([\d.]+)%/);
      if (!m) return;
      const p = Number(m[1]) / 100;
      if (p < last - 0.5) part = Math.min(parts - 1, part + 1);
      last = p;
      job.progress = Math.min(0.99, (part + p) / parts);
    },
  );
  if (r.code !== 0) throw new VideoFailure(classify(r.err));
  const files = (await readdir(job.dir)).filter((f) => !f.endsWith('.part') && !f.endsWith('.ytdl'));
  if (!files.length) throw new VideoFailure(classify(r.err + r.out));
  const sized = await Promise.all(files.map(async (f) => ({ f, size: (await stat(join(job.dir, f))).size })));
  const best = sized.sort((a, b) => b.size - a.size)[0];
  job.file = join(job.dir, best.f);
  job.name = best.f;
  job.size = best.size;
}

export function getJob(id: string, owner: string): Job | undefined {
  const j = jobs.get(id);
  return j && j.owner === owner ? j : undefined;
}

/** The finished file as a stream; the job and its folder are removed once the stream ends */
export function takeFile(job: Job) {
  const stream = createReadStream(job.file!);
  const done = () => cleanup(job);
  stream.on('close', done);
  stream.on('error', done);
  return stream;
}

/** Content-Disposition with the original (possibly non-ASCII) name, plus an ASCII fallback */
export function disposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

/** Removes job folders left behind if the server stopped in the middle of a download */
export async function clearLeftovers() {
  const names = await readdir(config.videoWorkDir).catch(() => [] as string[]);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  await Promise.all(names.filter((n) => uuid.test(n)).map((n) => rm(join(config.videoWorkDir, n), { recursive: true, force: true }).catch(() => {})));
}
