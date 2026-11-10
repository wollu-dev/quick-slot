/**
 * Audio and video conversion with ffmpeg.wasm (single-threaded core, so no special
 * cross-origin isolation headers are needed).
 *
 * The core (~32 MB of WebAssembly) is served by this site itself, never from a CDN, and is
 * downloaded only the first time an audio or video file is converted.
 */
import type { FFmpeg } from '@ffmpeg/ffmpeg';
import type { FormatId } from './formats';

export type MediaQuality = 'high' | 'balanced' | 'small';

let instance: Promise<FFmpeg> | null = null;

/** Load ffmpeg once. `onDownload` reports the engine download progress from 0 to 1. */
export function loadFFmpeg(onDownload?: (ratio: number) => void): Promise<FFmpeg> {
  instance ??= (async () => {
    const [{ FFmpeg }, { toBlobURL }, core, wasm] = await Promise.all([
      import('@ffmpeg/ffmpeg'),
      import('@ffmpeg/util'),
      import('@ffmpeg/core?url'),
      import('@ffmpeg/core/wasm?url'),
    ]);
    // Download through blob URLs so we can show progress. The wasm file is by far the largest.
    const coreURL = await toBlobURL(core.default, 'text/javascript');
    const wasmURL = await toBlobURL(wasm.default, 'application/wasm', true, (e: { received: number; total: number }) => {
      if (e.total > 0) onDownload?.(Math.min(1, e.received / e.total));
    });
    const ffmpeg = new FFmpeg();
    await ffmpeg.load({ coreURL, wasmURL });
    onDownload?.(1);
    return ffmpeg;
  })().catch((err) => {
    instance = null; // allow a retry after a failed download
    throw err;
  });
  return instance;
}

const CRF: Record<MediaQuality, { h264: string; vp8: string; audio: string }> = {
  high: { h264: '20', vp8: '2500k', audio: '256k' },
  balanced: { h264: '24', vp8: '1500k', audio: '192k' },
  small: { h264: '30', vp8: '700k', audio: '128k' },
};

/** ffmpeg arguments that turn `input` into the target format */
function argsFor(target: FormatId, q: MediaQuality, input: string, output: string): string[] {
  const c = CRF[q];
  const audio: Partial<Record<FormatId, string[]>> = {
    mp3: ['-c:a', 'libmp3lame', '-b:a', c.audio],
    wav: ['-c:a', 'pcm_s16le'],
    m4a: ['-c:a', 'aac', '-b:a', c.audio],
    ogg: ['-c:a', 'libvorbis', '-b:a', c.audio],
    // libopus in this wasm build crashes on some stereo input (memory access out of bounds),
    // so use ffmpeg's own Opus encoder. It only runs at 48 kHz and is flagged experimental.
    opus: ['-c:a', 'opus', '-strict', '-2', '-ar', '48000', '-b:a', q === 'small' ? '64k' : '128k'],
    flac: ['-c:a', 'flac'],
  };
  if (audio[target]) return ['-i', input, '-vn', ...audio[target]!, output];

  const h264 = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', c.h264, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k'];
  switch (target) {
    case 'mp4':
    case 'mov':
      return ['-i', input, ...h264, '-movflags', '+faststart', output];
    case 'mkv':
      return ['-i', input, ...h264, output];
    case 'webm':
      // VP8 + Vorbis: much faster than VP9 in a single-threaded wasm build
      return ['-i', input, '-c:v', 'libvpx', '-b:v', c.vp8, '-deadline', 'realtime', '-cpu-used', '5', '-c:a', 'libvorbis', output];
    case 'gif':
      // Two-pass palette for good colors; capped size and frame rate keep files reasonable
      return [
        '-i', input,
        '-vf', `fps=${q === 'high' ? 15 : 10},scale='min(${q === 'small' ? 360 : 480},iw)':-2:flags=lanczos,split[a][b];[a]palettegen[p];[b][p]paletteuse`,
        '-loop', '0',
        output,
      ];
    default:
      throw new Error('encode-unsupported');
  }
}

/**
 * Convert an audio or video file. `onProgress` reports 0–1 while ffmpeg runs.
 * Input and output files live in ffmpeg's in-memory file system and are removed afterwards.
 */
export async function convertMedia(
  file: Blob,
  sourceExt: string,
  target: FormatId,
  outExt: string,
  quality: MediaQuality,
  mime: string,
  onProgress?: (ratio: number) => void,
  onDownload?: (ratio: number) => void,
): Promise<Blob> {
  const ffmpeg = await loadFFmpeg(onDownload);
  const id = Math.random().toString(36).slice(2);
  const input = `in-${id}.${sourceExt}`;
  const output = `out-${id}.${outExt}`;
  const progress = ({ progress }: { progress: number }) => onProgress?.(Math.max(0, Math.min(1, progress)));
  // Keep the tail of ffmpeg's log so a failure can be diagnosed from the developer console
  const log: string[] = [];
  const collect = ({ message }: { message: string }) => {
    log.push(message);
    if (log.length > 30) log.shift();
  };
  ffmpeg.on('progress', progress);
  ffmpeg.on('log', collect);
  try {
    await ffmpeg.writeFile(input, new Uint8Array(await file.arrayBuffer()));
    const args = argsFor(target, quality, input, output);
    let code: number;
    try {
      code = await ffmpeg.exec(args);
    } catch (err) {
      console.warn('[quickslot] ffmpeg crashed', { args, log, error: String(err) });
      // A crashed wasm instance can be left in a broken state: drop it so the next file gets a fresh one
      instance = null;
      try {
        ffmpeg.terminate();
      } catch {
        /* already gone */
      }
      throw new Error('media');
    }
    if (code !== 0) {
      console.warn('[quickslot] ffmpeg failed', { args, log });
      throw new Error('media');
    }
    const data = await ffmpeg.readFile(output);
    if (typeof data === 'string' || data.length === 0) throw new Error('media');
    return new Blob([data as Uint8Array<ArrayBuffer>], { type: mime });
  } finally {
    ffmpeg.off('progress', progress);
    ffmpeg.off('log', collect);
    await ffmpeg.deleteFile(input).catch(() => {});
    await ffmpeg.deleteFile(output).catch(() => {});
  }
}
