/**
 * Video downloader, browser side. The work runs on our API (apps/api/src/video.ts):
 * read the video's details, start a job, poll its progress, then fetch the file once.
 * The server deletes the file as soon as it has been sent.
 */

export type VideoError =
  | 'invalidUrl'
  | 'blockedAddress'
  | 'notFound'
  | 'unsupported'
  | 'unavailable'
  | 'live'
  | 'tooLong'
  | 'tooLarge'
  | 'busy'
  | 'failed'
  | 'expired'
  | 'rateLimited'
  | 'offline';

const KNOWN: VideoError[] = ['invalidUrl', 'blockedAddress', 'notFound', 'unsupported', 'unavailable', 'live', 'tooLong', 'tooLarge', 'busy', 'failed'];

export class VideoFailure extends Error {
  code: VideoError;
  constructor(code: VideoError) {
    super(code);
    this.code = code;
  }
}

export type VideoFormat = 'mp4-1080' | 'mp4-720' | 'mp4-480' | 'm4a' | 'mp3';

export interface VideoInfo {
  title: string;
  uploader?: string;
  /** Seconds */
  duration?: number;
  site: string;
  heights: number[];
}

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { cache: 'no-store', ...init });
  } catch {
    throw new VideoFailure('offline');
  }
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (res.ok && !body.error) return body;
  if (res.status === 429 && body.error !== 'busy') throw new VideoFailure('rateLimited');
  if (res.status === 404 && path.includes('/jobs/')) throw new VideoFailure('expired');
  throw new VideoFailure(KNOWN.includes(body.error as VideoError) ? (body.error as VideoError) : res.status >= 500 || !body.error ? 'offline' : 'failed');
}

const post = <T>(path: string, data: object) => call<T>(path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(data) });

export const videoInfo = (url: string) => post<VideoInfo>('/api/video/info', { url });

/** The formats worth offering for a video, best first */
export function formatsFor(info: VideoInfo): VideoFormat[] {
  const top = info.heights[0] ?? 0;
  const video: VideoFormat[] = [];
  if (top >= 1080) video.push('mp4-1080');
  if (top >= 720) video.push('mp4-720');
  if (top > 0) video.push('mp4-480');
  return [...video, 'm4a', 'mp3'];
}

export interface JobState {
  status: 'queued' | 'running' | 'done' | 'error';
  progress: number;
  name?: string;
  size?: number;
}

/**
 * Downloads on the server, reporting progress, and resolves with the address of the finished file
 * (which can be fetched once). Stops early when `signal` is aborted.
 */
export async function prepare(url: string, format: VideoFormat, onProgress: (s: JobState) => void, signal?: AbortSignal): Promise<{ href: string; name: string; size: number }> {
  const { id } = await post<{ id: string }>('/api/video/jobs', { url, format });
  for (;;) {
    if (signal?.aborted) throw new DOMException('aborted', 'AbortError');
    const s = await call<JobState & { error?: VideoError }>(`/api/video/jobs/${id}`);
    onProgress(s);
    if (s.status === 'done') return { href: `/api/video/jobs/${id}/file`, name: s.name ?? 'video', size: s.size ?? 0 };
    if (s.status === 'error') throw new VideoFailure(s.error && KNOWN.includes(s.error) ? s.error : 'failed');
    await new Promise((r) => setTimeout(r, 700));
  }
}

/** Starts the browser's own download of the prepared file (the response is an attachment) */
export function save(href: string, name: string) {
  const a = document.createElement('a');
  a.href = href;
  a.download = name;
  a.rel = 'noopener';
  document.body.append(a);
  a.click();
  a.remove();
}

/** Consent to send addresses to our server, asked once (server tool rule) */
const CONSENT = 'quickslot:consent:video-downloader';
export const hasConsent = () => {
  try {
    return localStorage.getItem(CONSENT) === '1';
  } catch {
    return false;
  }
};
export const giveConsent = () => {
  try {
    localStorage.setItem(CONSENT, '1');
  } catch {
    /* storage unavailable: the question comes back next time */
  }
};
