import { decodeImage } from './convert/image';
import type { FormatId } from './convert/formats';
import { CompressError, encodeImage, outputFormat, renderRegion, type OutFormat } from './imageCompress';

export type SizeMode = 'percent' | 'pixels' | 'long';
/** How an image meets a width × height box: fit inside, fill and crop, or stretch */
export type Fit = 'contain' | 'cover' | 'stretch';
export type ResizeFormat = 'keep' | 'jpeg' | 'png' | 'webp';

export interface ResizeOptions {
  mode: SizeMode;
  percent: number;
  width: number | '';
  height: number | '';
  fit: Fit;
  longSide: number;
  /** Never make an image larger than it is */
  noUpscale: boolean;
  format: ResizeFormat;
  quality: number;
}

/** Where the crop window sits when filling a box (0 = left/top, 1 = right/bottom) */
export interface Focus {
  x: number;
  y: number;
}

export interface Plan {
  width: number;
  height: number;
  /** Source rectangle that is drawn */
  sx: number;
  sy: number;
  sw: number;
  sh: number;
  cropped: boolean;
}

/** Browsers refuse canvases much larger than this on a side */
export const MAX_SIDE = 16384;

const clampSide = (n: number) => Math.min(MAX_SIDE, Math.max(1, Math.round(n)));

export function planResize(W: number, H: number, o: ResizeOptions, focus: Focus = { x: 0.5, y: 0.5 }): Plan {
  const full = { sx: 0, sy: 0, sw: W, sh: H, cropped: false };
  const scaled = (s: number): Plan => {
    if (o.noUpscale) s = Math.min(s, 1);
    // Keep the result within the canvas limit without changing the shape
    s = Math.min(s, MAX_SIDE / Math.max(W, H));
    return { width: clampSide(W * s), height: clampSide(H * s), ...full };
  };

  if (o.mode === 'percent') return scaled((o.percent || 100) / 100);
  if (o.mode === 'long') return scaled(o.longSide ? o.longSide / Math.max(W, H) : 1);

  const w = o.width || 0;
  const h = o.height || 0;
  if (!w && !h) return scaled(1);
  if (!h) return scaled(w / W);
  if (!w) return scaled(h / H);

  if (o.fit === 'contain') return scaled(Math.min(w / W, h / H));

  if (o.fit === 'stretch') {
    const ow = o.noUpscale ? Math.min(w, W) : w;
    const oh = o.noUpscale ? Math.min(h, H) : h;
    return { width: clampSide(ow), height: clampSide(oh), ...full };
  }

  // cover: crop the source to the box's shape at the focus point, then scale
  const r = w / h;
  let sw = W;
  let sh = H;
  if (W / H > r) sw = H * r;
  else sh = W / r;
  const sx = (W - sw) * Math.min(1, Math.max(0, focus.x));
  const sy = (H - sh) * Math.min(1, Math.max(0, focus.y));
  // Without upscaling, a box larger than the cropped area shrinks to it, keeping the box's shape
  const k = o.noUpscale ? Math.min(1, sw / w) : 1;
  const cropped = Math.round(sw) < W || Math.round(sh) < H;
  return { width: clampSide(w * k), height: clampSide(h * k), sx, sy, sw, sh, cropped };
}

export interface ResizeResult {
  blob: Blob;
  format: OutFormat;
  width: number;
  height: number;
}

export async function resizeImage(file: File, source: FormatId, o: ResizeOptions, focus?: Focus): Promise<ResizeResult> {
  const format = outputFormat(source, o.format);
  let bitmap: ImageBitmap;
  try {
    bitmap = await decodeImage(file, source);
  } catch {
    throw new CompressError('decode');
  }
  let image: ImageData;
  try {
    const p = planResize(bitmap.width, bitmap.height, o, focus);
    image = renderRegion(bitmap, p.sx, p.sy, p.sw, p.sh, p.width, p.height, format === 'jpeg');
  } finally {
    bitmap.close();
  }
  const { width, height } = image;
  const blob = await encodeImage(image, format, o.quality);
  return { blob, format, width, height };
}

/** Dimensions of an image without decoding all of it twice later (used for the list and the preview) */
export async function imageSize(file: File, source: FormatId): Promise<{ width: number; height: number }> {
  const bitmap = await decodeImage(file, source);
  const size = { width: bitmap.width, height: bitmap.height };
  bitmap.close();
  return size;
}
