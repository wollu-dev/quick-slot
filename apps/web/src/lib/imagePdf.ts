import { decodeImage } from './convert/image';
import type { FormatId } from './convert/formats';

/**
 * Images → PDF. JPEG and PNG go into the PDF as they are (no re-encoding, no quality loss);
 * other formats, and JPEGs that rely on EXIF rotation, are drawn upright first.
 */

export type PageSize = 'fit' | 'a4' | 'letter' | 'a5';
export type Orientation = 'auto' | 'portrait' | 'landscape';

export interface LayoutOptions {
  size: PageSize;
  orientation: Orientation;
  /** Margin in millimetres */
  margin: number;
}

export interface ImageItem {
  file: File;
  source: FormatId;
  /** Upright size in pixels (EXIF orientation applied) */
  width: number;
  height: number;
  /** Extra clockwise rotation chosen by the user */
  rotate: number;
}

/** Page sizes in PDF points (1/72 inch), portrait */
const SIZES: Record<Exclude<PageSize, 'fit'>, [number, number]> = {
  a4: [595.28, 841.89],
  letter: [612, 792],
  a5: [419.53, 595.28],
};
const MM = 72 / 25.4;
/** Pixels to points when the page follows the image (96 dpi, like browsers) */
const PX = 0.75;

/** EXIF orientation of a JPEG (1 = upright), read from the APP1 segment */
export function jpegOrientation(b: Uint8Array): number {
  if (b[0] !== 0xff || b[1] !== 0xd8) return 1;
  let p = 2;
  while (p + 4 < b.length && b[p] === 0xff) {
    const marker = b[p + 1];
    const len = (b[p + 2] << 8) | b[p + 3];
    if (marker === 0xda) break;
    if (marker === 0xe1 && b[p + 4] === 0x45 && b[p + 5] === 0x78 && b[p + 6] === 0x69 && b[p + 7] === 0x66) {
      const t = p + 10;
      const le = b[t] === 0x49;
      const u16 = (o: number) => (le ? b[t + o] | (b[t + o + 1] << 8) : (b[t + o] << 8) | b[t + o + 1]);
      const u32 = (o: number) => (le ? (b[t + o] | (b[t + o + 1] << 8) | (b[t + o + 2] << 16)) + b[t + o + 3] * 0x1000000 : ((b[t + o] << 16) | (b[t + o + 1] << 8) | b[t + o + 2]) * 256 + b[t + o + 3]);
      const ifd = u32(4);
      const n = u16(ifd);
      for (let i = 0; i < n; i++) {
        const e = ifd + 2 + i * 12;
        if (t + e + 12 > b.length) break;
        if (u16(e) === 0x0112) return u16(e + 8) || 1;
      }
      return 1;
    }
    p += 2 + len;
  }
  return 1;
}

/** Page size and the box the (rotated) image is drawn in, in points */
export function layout(img: { width: number; height: number; rotate: number }, o: LayoutOptions) {
  const turned = img.rotate % 180 !== 0;
  const iw = turned ? img.height : img.width;
  const ih = turned ? img.width : img.height;
  const m = o.margin * MM;
  let pw: number;
  let ph: number;
  if (o.size === 'fit') {
    pw = iw * PX + 2 * m;
    ph = ih * PX + 2 * m;
  } else {
    const [w, h] = SIZES[o.size];
    const landscape = o.orientation === 'landscape' || (o.orientation === 'auto' && iw > ih);
    [pw, ph] = landscape ? [h, w] : [w, h];
  }
  const s = Math.min((pw - 2 * m) / iw, (ph - 2 * m) / ih);
  const bw = iw * s;
  const bh = ih * s;
  return { pw, ph, bx: (pw - bw) / 2, by: (ph - bh) / 2, bw, bh };
}

async function canvasBlob(canvas: HTMLCanvasElement, type: string, q?: number) {
  return new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('encode'))), type, q));
}

/** Image bytes ready for pdf-lib: the original when possible, otherwise drawn upright as JPEG (opaque) or PNG */
async function embeddable(item: ImageItem, optimize: boolean): Promise<{ kind: 'jpg' | 'png'; bytes: Uint8Array }> {
  const bytes = new Uint8Array(await item.file.arrayBuffer());
  if (!optimize && item.source === 'jpeg' && jpegOrientation(bytes) === 1) return { kind: 'jpg', bytes };
  if (!optimize && item.source === 'png') return { kind: 'png', bytes };
  const bitmap = await decodeImage(item.file, item.source);
  const max = optimize ? 2000 : Infinity;
  const s = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * s));
  canvas.height = Math.max(1, Math.round(bitmap.height * s));
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let opaque = true;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 255) { opaque = false; break; }
  const blob = opaque ? await canvasBlob(canvas, 'image/jpeg', optimize ? 0.8 : 0.92) : await canvasBlob(canvas, 'image/png');
  return { kind: opaque ? 'jpg' : 'png', bytes: new Uint8Array(await blob.arrayBuffer()) };
}

export async function imagesToPdf(items: ImageItem[], o: LayoutOptions, optimize: boolean, onProgress?: (done: number) => void): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const pdf = await PDFDocument.create();
  for (const [i, item] of items.entries()) {
    const e = await embeddable(item, optimize);
    const img = e.kind === 'jpg' ? await pdf.embedJpg(e.bytes) : await pdf.embedPng(e.bytes);
    const { pw, ph, bx, by, bw, bh } = layout(item, o);
    const page = pdf.addPage([pw, ph]);
    // pdf-lib rotates counter-clockwise around the image's lower-left corner; place that corner so the
    // clockwise-rotated image fills the box exactly
    const r = ((item.rotate % 360) + 360) % 360;
    const at = {
      0: { x: bx, y: by, width: bw, height: bh },
      90: { x: bx, y: by + bh, width: bh, height: bw },
      180: { x: bx + bw, y: by + bh, width: bw, height: bh },
      270: { x: bx + bw, y: by, width: bh, height: bw },
    }[r as 0 | 90 | 180 | 270];
    page.drawImage(img, { ...at, rotate: degrees(-r) });
    onProgress?.((i + 1) / items.length);
  }
  pdf.setProducer('QuickSlot');
  pdf.setCreator('QuickSlot');
  return pdf.save({ useObjectStreams: true });
}

/** Upright size and a small preview of an image */
export async function preview(file: File, source: FormatId, side = 240): Promise<{ width: number; height: number; thumb: Blob }> {
  const bitmap = await decodeImage(file, source);
  const s = Math.min(1, side / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * s));
  canvas.height = Math.max(1, Math.round(bitmap.height * s));
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const out = { width: bitmap.width, height: bitmap.height, thumb: await canvasBlob(canvas, 'image/png') };
  bitmap.close();
  return out;
}
