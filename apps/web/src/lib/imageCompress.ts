import { decodeImage } from './convert/image';
import { detectFile, type FormatId } from './convert/formats';

/** Formats this tool writes */
export type OutFormat = 'jpeg' | 'png' | 'webp' | 'avif';
/** "keep" writes the same format as the input where possible */
export type OutChoice = 'keep' | OutFormat;

/** Inputs this tool accepts. Animated GIF is left out: re-encoding would drop its frames. */
export const INPUTS: FormatId[] = ['jpeg', 'png', 'webp', 'avif', 'heic', 'bmp'];
export const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif,image/bmp,.heic,.heif';

export const MIME: Record<OutFormat, string> = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' };
export const EXT: Record<OutFormat, string> = { jpeg: 'jpg', png: 'png', webp: 'webp', avif: 'avif' };

export interface CompressOptions {
  format: OutChoice;
  /** 0–1 for JPEG, WebP and AVIF */
  quality: number;
  /** PNG: reduce to 256 colors (lossy, much smaller) */
  pngColors: boolean;
  /** Longest side in pixels; 0 keeps the size */
  maxSide: number;
}

export interface EncodeRequest {
  id: number;
  image: ImageData;
  format: OutFormat;
  quality: number;
  pngColors: boolean;
}
export type EncodeResponse = { id: number; buffer: ArrayBuffer; error?: undefined } | { id: number; error: string; buffer?: undefined };

export type CompressErrorCode = 'unsupported' | 'decode' | 'encode';
export class CompressError extends Error {
  constructor(public code: CompressErrorCode) {
    super(code);
  }
}

export interface CompressResult {
  blob: Blob;
  format: OutFormat;
  width: number;
  height: number;
  /** The original was already smaller, so it is returned unchanged */
  keptOriginal: boolean;
}

/** HEIC and BMP have no good on-the-web equivalent, so "keep" turns them into JPEG and PNG */
export function outputFormat(source: FormatId, choice: OutChoice): OutFormat {
  if (choice !== 'keep') return choice;
  if (source === 'png' || source === 'bmp') return 'png';
  if (source === 'webp' || source === 'avif') return source;
  return 'jpeg';
}

let worker: Worker | undefined;
let nextId = 1;
const pending = new Map<number, { resolve: (b: ArrayBuffer) => void; reject: (e: Error) => void }>();

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(new URL('./imageCompress.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<EncodeResponse>) => {
      const p = pending.get(e.data.id);
      pending.delete(e.data.id);
      if (!p) return;
      if (e.data.buffer) p.resolve(e.data.buffer);
      else p.reject(new CompressError('encode'));
    };
    worker.onerror = () => {
      pending.forEach((p) => p.reject(new CompressError('encode')));
      pending.clear();
      worker = undefined;
    };
  }
  return worker;
}

/** Encodes pixels in the worker (MozJPEG, OxiPNG, libwebp, libavif). The ImageData buffer is transferred. */
export function encodeImage(image: ImageData, format: OutFormat, quality: number, pngColors = false): Promise<Blob> {
  const id = nextId++;
  return new Promise<ArrayBuffer>((resolve, reject) => {
    pending.set(id, { resolve, reject });
    getWorker().postMessage({ id, image, format, quality, pngColors } satisfies EncodeRequest, [image.data.buffer]);
  }).then((buffer) => new Blob([buffer], { type: MIME[format] }));
}

/**
 * Draws the source rectangle (sx, sy, sw, sh) of an image at w × h.
 * Large reductions go through halving steps so they stay sharp instead of aliased.
 * `opaque` puts transparent areas on white (for JPEG, which has no transparency).
 */
export function renderRegion(src: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, w: number, h: number, opaque: boolean): ImageData {
  let cur = src;
  let cx = sx;
  let cy = sy;
  let cw = sw;
  let ch = sh;
  while (cw / 2 >= w * 1.5 && ch / 2 >= h * 1.5) {
    const half = document.createElement('canvas');
    half.width = Math.round(cw / 2);
    half.height = Math.round(ch / 2);
    const hc = half.getContext('2d')!;
    hc.imageSmoothingQuality = 'high';
    hc.drawImage(cur, cx, cy, cw, ch, 0, 0, half.width, half.height);
    cur = half;
    cx = 0;
    cy = 0;
    cw = half.width;
    ch = half.height;
  }
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const c = canvas.getContext('2d', { willReadFrequently: true })!;
  if (opaque) {
    c.fillStyle = '#ffffff';
    c.fillRect(0, 0, w, h);
  }
  c.imageSmoothingQuality = 'high';
  c.drawImage(cur, cx, cy, cw, ch, 0, 0, w, h);
  return c.getImageData(0, 0, w, h);
}

/** The whole bitmap, scaled so its longest side is at most maxSide (0 keeps the size) */
function toImageData(bitmap: ImageBitmap, maxSide: number, opaque: boolean): ImageData {
  let w = bitmap.width;
  let h = bitmap.height;
  if (maxSide && Math.max(w, h) > maxSide) {
    const s = maxSide / Math.max(w, h);
    w = Math.max(1, Math.round(w * s));
    h = Math.max(1, Math.round(h * s));
  }
  return renderRegion(bitmap, 0, 0, bitmap.width, bitmap.height, w, h, opaque);
}

export async function sourceFormat(file: File): Promise<FormatId | null> {
  const f = await detectFile(file);
  return f && INPUTS.includes(f) ? f : null;
}

export async function compressImage(file: File, source: FormatId, opts: CompressOptions): Promise<CompressResult> {
  const format = outputFormat(source, opts.format);
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file, source);
  } catch {
    throw new CompressError('decode');
  }
  let image: ImageData;
  const resized = !!opts.maxSide && Math.max(bitmap.width, bitmap.height) > opts.maxSide;
  try {
    image = toImageData(bitmap, opts.maxSide, format === 'jpeg');
  } finally {
    bitmap.close();
  }
  const { width, height } = image;
  const blob = await encodeImage(image, format, opts.quality, opts.pngColors);
  // Same format and size but no smaller: hand back the original rather than a bigger copy
  if (!resized && format === source && blob.size >= file.size) return { blob: file, format, width, height, keptOriginal: true };
  return { blob, format, width, height, keptOriginal: false };
}

/** "photo.HEIC" + webp → "photo.webp"; with a suffix, "photo-1080x1080.webp" */
export function outputName(name: string, format: OutFormat, suffix = ''): string {
  const dot = name.lastIndexOf('.');
  return `${dot > 0 ? name.slice(0, dot) : name}${suffix}.${EXT[format]}`;
}
