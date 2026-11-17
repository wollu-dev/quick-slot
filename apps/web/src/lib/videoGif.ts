import { runFFmpeg } from './convert/media';

export type GifQuality = 'small' | 'balanced' | 'high';

export interface GifOptions {
  /** Clip start and end in seconds of the source video */
  start: number;
  end: number;
  /** Output width in pixels; 0 keeps the source width */
  width: number;
  fps: number;
  /** Playback speed (2 = twice as fast) */
  speed: number;
  loop: boolean;
  quality: GifQuality;
}

const fix = (n: number) => n.toFixed(3);

/**
 * ffmpeg arguments: seek and cut on the input (fast), change speed, resample the frame rate,
 * scale, and build a palette per clip so colors stay faithful.
 */
export function gifArgs(o: GifOptions, input: string, output: string): string[] {
  const filters = [`setpts=PTS/${o.speed}`, `fps=${o.fps}`];
  if (o.width) filters.push(`scale='min(${o.width},iw)':-2:flags=lanczos`);
  const colors = o.quality === 'small' ? 96 : o.quality === 'balanced' ? 192 : 256;
  // Bayer dithering compresses much better in GIF; error diffusion looks smoother but costs size
  const dither = o.quality === 'high' ? 'sierra2_4a' : `bayer:bayer_scale=${o.quality === 'small' ? 3 : 4}`;
  const vf = `${filters.join(',')},split[a][b];[a]palettegen=max_colors=${colors}:stats_mode=diff[p];[b][p]paletteuse=dither=${dither}:diff_mode=rectangle`;
  return ['-ss', fix(o.start), '-t', fix(Math.max(0.1, o.end - o.start)), '-i', input, '-vf', vf, '-loop', o.loop ? '0' : '-1', output];
}

/** Number of frames the GIF will have */
export const frameCount = (o: GifOptions) => Math.max(1, Math.round(((o.end - o.start) / o.speed) * o.fps));

export async function videoToGif(file: File, o: GifOptions, onProgress?: (ratio: number) => void, onDownload?: (ratio: number) => void): Promise<Blob> {
  const ext = file.name.match(/\.([a-z0-9]{1,5})$/i)?.[1]?.toLowerCase() ?? 'mp4';
  const outSeconds = (o.end - o.start) / o.speed;
  return runFFmpeg(
    file,
    ext,
    'gif',
    'image/gif',
    (input, output) => gifArgs(o, input, output),
    // time is the output position in microseconds
    ({ time }) => onProgress?.(Math.max(0, Math.min(1, time / 1e6 / outSeconds))),
    onDownload,
  );
}

/** 83.4 → "1:23.4" */
export function formatTime(s: number): string {
  const m = Math.floor(s / 60);
  const r = s - m * 60;
  return `${m}:${r.toFixed(1).padStart(4, '0')}`;
}
