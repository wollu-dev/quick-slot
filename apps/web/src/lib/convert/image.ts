/**
 * Image conversion in the browser.
 *
 * Decode: the browser's own decoders (createImageBitmap) for JPEG, PNG, WebP, AVIF, GIF, BMP,
 * ICO and SVG; HEIC/HEIF through heic-to (libheif in WebAssembly, ~3 MB, loaded only when needed).
 * Encode: canvas for JPEG, PNG and WebP; small writers in this file for BMP and ICO;
 * gifenc for GIF; @jsquash/avif (WebAssembly, loaded only when needed) for AVIF.
 */
import type { FormatId } from './formats';

export interface ImageOptions {
  /** 0–1, for lossy formats (JPEG, WebP, AVIF) */
  quality: number;
  /** Fill color behind transparent pixels for formats without transparency (JPEG, BMP) */
  background: string;
}

const OPAQUE: FormatId[] = ['jpeg', 'bmp'];

async function decode(file: Blob, source: FormatId): Promise<ImageBitmap> {
  if (source === 'heic') {
    const { heicTo } = await import('heic-to');
    return heicTo({ blob: file, type: 'bitmap' });
  }
  if (source === 'svg') {
    // SVG has no intrinsic pixel size in every browser; draw it through an <img> first
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return await createImageBitmap(img);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
  return createImageBitmap(file);
}

function draw(bitmap: ImageBitmap, target: FormatId, opts: ImageOptions, maxSize?: number) {
  let { width, height } = bitmap;
  if (maxSize && Math.max(width, height) > maxSize) {
    const s = maxSize / Math.max(width, height);
    width = Math.max(1, Math.round(width * s));
    height = Math.max(1, Math.round(height * s));
  }
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  if (OPAQUE.includes(target)) {
    ctx.fillStyle = opts.background;
    ctx.fillRect(0, 0, width, height);
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  return { canvas, ctx, width, height };
}

const toBlob = (canvas: HTMLCanvasElement, mime: string, quality?: number) =>
  new Promise<Blob>((resolve, reject) =>
    canvas.toBlob((b) => (b && b.type === mime ? resolve(b) : reject(new Error('encode-unsupported'))), mime, quality),
  );

/** 24-bit BMP (bottom-up rows, padded to 4 bytes) */
function encodeBmp(data: ImageData): Blob {
  const { width, height } = data;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const size = 54 + rowSize * height;
  const buf = new ArrayBuffer(size);
  const dv = new DataView(buf);
  const out = new Uint8Array(buf);
  out[0] = 0x42; // 'B'
  out[1] = 0x4d; // 'M'
  dv.setUint32(2, size, true);
  dv.setUint32(10, 54, true); // pixel data offset
  dv.setUint32(14, 40, true); // BITMAPINFOHEADER size
  dv.setInt32(18, width, true);
  dv.setInt32(22, height, true);
  dv.setUint16(26, 1, true); // planes
  dv.setUint16(28, 24, true); // bits per pixel
  dv.setUint32(34, rowSize * height, true);
  dv.setInt32(38, 2835, true); // 72 DPI
  dv.setInt32(42, 2835, true);
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      out[row + x * 3] = data.data[i + 2];
      out[row + x * 3 + 1] = data.data[i + 1];
      out[row + x * 3 + 2] = data.data[i];
    }
  }
  return new Blob([buf], { type: 'image/bmp' });
}

/** ICO holding PNG images at the common icon sizes (PNG-in-ICO is supported since Windows Vista) */
async function encodeIco(bitmap: ImageBitmap): Promise<Blob> {
  const sizes = [16, 32, 48, 64, 128, 256].filter((s) => s <= Math.max(bitmap.width, bitmap.height));
  if (!sizes.length) sizes.push(Math.max(bitmap.width, bitmap.height));
  const pngs: Uint8Array[] = [];
  for (const s of sizes) {
    const canvas = document.createElement('canvas');
    canvas.width = s;
    canvas.height = s;
    const ctx = canvas.getContext('2d')!;
    // Fit inside a square, keeping the aspect ratio
    const scale = s / Math.max(bitmap.width, bitmap.height);
    const w = Math.round(bitmap.width * scale);
    const h = Math.round(bitmap.height * scale);
    ctx.drawImage(bitmap, (s - w) / 2, (s - h) / 2, w, h);
    pngs.push(new Uint8Array(await (await toBlob(canvas, 'image/png')).arrayBuffer()));
  }
  const header = 6 + 16 * pngs.length;
  const total = header + pngs.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  const dv = new DataView(out.buffer);
  dv.setUint16(2, 1, true); // type: icon
  dv.setUint16(4, pngs.length, true);
  let offset = header;
  pngs.forEach((png, i) => {
    const s = sizes[i];
    const e = 6 + i * 16;
    out[e] = s >= 256 ? 0 : s; // 0 means 256
    out[e + 1] = s >= 256 ? 0 : s;
    dv.setUint16(e + 4, 1, true); // color planes
    dv.setUint16(e + 6, 32, true); // bits per pixel
    dv.setUint32(e + 8, png.length, true);
    dv.setUint32(e + 12, offset, true);
    out.set(png, offset);
    offset += png.length;
  });
  return new Blob([out], { type: 'image/x-icon' });
}

/** Single-frame GIF with a 256-color palette */
async function encodeGif(data: ImageData): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc');
  const palette = quantize(data.data, 256, { format: 'rgba4444', oneBitAlpha: true });
  const index = applyPalette(data.data, palette, 'rgba4444');
  const transparentIndex = palette.findIndex((c) => c.length > 3 && c[3] === 0);
  const gif = GIFEncoder();
  gif.writeFrame(index, data.width, data.height, {
    palette,
    transparent: transparentIndex >= 0,
    transparentIndex: Math.max(0, transparentIndex),
  });
  gif.finish();
  return new Blob([gif.bytes() as Uint8Array<ArrayBuffer>], { type: 'image/gif' });
}

async function encodeAvif(data: ImageData, quality: number): Promise<Blob> {
  const { default: encode } = await import('@jsquash/avif/encode');
  const buf = await encode(data, { quality: Math.round(quality * 100) });
  return new Blob([buf], { type: 'image/avif' });
}

export async function convertImage(file: Blob, source: FormatId, target: FormatId, opts: ImageOptions): Promise<Blob> {
  const bitmap = await decode(file, source);
  try {
    if (target === 'ico') return await encodeIco(bitmap);
    const { canvas, ctx, width, height } = draw(bitmap, target, opts);
    switch (target) {
      case 'jpeg':
        return await toBlob(canvas, 'image/jpeg', opts.quality);
      case 'png':
        return await toBlob(canvas, 'image/png');
      case 'webp':
        return await toBlob(canvas, 'image/webp', opts.quality);
      case 'bmp':
        return encodeBmp(ctx.getImageData(0, 0, width, height));
      case 'gif':
        return await encodeGif(ctx.getImageData(0, 0, width, height));
      case 'avif':
        return await encodeAvif(ctx.getImageData(0, 0, width, height), opts.quality);
      default:
        throw new Error('encode-unsupported');
    }
  } finally {
    bitmap.close();
  }
}
