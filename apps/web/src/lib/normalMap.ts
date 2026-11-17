import { convertIndexedToRgb, decode as decodePng, encode as encodePng, hasPngSignature } from 'fast-png';
import { decodeTga, encodeTga, looksLikeTga, TgaError } from './tga';

/**
 * Normal maps need exact channel values, so PNG and TGA are read and written directly:
 * no canvas (which would drop 16-bit precision, premultiply alpha and apply color management).
 */

export type SourceKind = 'png' | 'tga' | 'other';

export interface Raster {
  width: number;
  height: number;
  channels: 3 | 4;
  depth: 8 | 16;
  data: Uint8Array | Uint16Array;
  kind: SourceKind;
}

export type NormalErrorCode = 'notColor' | 'unsupported' | 'corrupt';
export class NormalError extends Error {
  constructor(public code: NormalErrorCode) {
    super(code);
  }
}

export const ACCEPT = '.png,.tga,.jpg,.jpeg,.webp,.bmp,image/png,image/jpeg,image/webp,image/bmp,image/x-tga';

export async function readNormalMap(file: File): Promise<Raster> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (hasPngSignature(bytes)) {
    let png;
    try {
      png = decodePng(bytes);
    } catch {
      throw new NormalError('corrupt');
    }
    if (png.palette) {
      const data = convertIndexedToRgb(png);
      const channels = data.length / (png.width * png.height);
      if (channels !== 3 && channels !== 4) throw new NormalError('notColor');
      return { width: png.width, height: png.height, channels, depth: 8, data, kind: 'png' };
    }
    if (png.channels !== 3 && png.channels !== 4) throw new NormalError('notColor');
    if (png.depth !== 8 && png.depth !== 16) throw new NormalError('unsupported');
    return { width: png.width, height: png.height, channels: png.channels, depth: png.depth, data: png.data as Uint8Array | Uint16Array, kind: 'png' };
  }
  if (/\.tga$/i.test(file.name) || looksLikeTga(bytes)) {
    try {
      const t = decodeTga(bytes);
      return { ...t, depth: 8, kind: 'tga' };
    } catch (e) {
      if (e instanceof TgaError) throw new NormalError(e.code === 'tgaUnsupported' ? 'unsupported' : 'corrupt');
      throw e;
    }
  }
  // JPEG, WebP, BMP: the browser decodes them, asked not to convert colors or premultiply alpha
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { colorSpaceConversion: 'none', premultiplyAlpha: 'none' });
  } catch {
    throw new NormalError('unsupported');
  }
  const canvas = document.createElement('canvas');
  canvas.width = bitmap.width;
  canvas.height = bitmap.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();
  const rgba = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  // Drop the alpha channel when the image is fully opaque
  let opaque = true;
  for (let i = 3; i < rgba.length; i += 4) if (rgba[i] !== 255) { opaque = false; break; }
  if (!opaque) return { width: canvas.width, height: canvas.height, channels: 4, depth: 8, data: new Uint8Array(rgba.buffer), kind: 'other' };
  const rgb = new Uint8Array(canvas.width * canvas.height * 3);
  for (let i = 0, o = 0; i < rgba.length; i += 4) {
    rgb[o++] = rgba[i];
    rgb[o++] = rgba[i + 1];
    rgb[o++] = rgba[i + 2];
  }
  return { width: canvas.width, height: canvas.height, channels: 3, depth: 8, data: rgb, kind: 'other' };
}

export interface FlipOptions {
  /** Invert green (Y): DirectX ↔ OpenGL */
  green: boolean;
  /** Invert red (X), needed by a few tools */
  red: boolean;
}

/** New raster with the chosen channels inverted (max − value). Alpha and blue are untouched. */
export function flipChannels(r: Raster, o: FlipOptions): Raster {
  const max = r.depth === 16 ? 65535 : 255;
  const data = r.data.slice();
  for (let i = 0; i < data.length; i += r.channels) {
    if (o.red) data[i] = max - data[i];
    if (o.green) data[i + 1] = max - data[i + 1];
  }
  return { ...r, data };
}

/** PNG stays PNG (same bit depth), TGA stays TGA; anything else becomes a lossless PNG */
export function encodeRaster(r: Raster): { bytes: Uint8Array; ext: 'png' | 'tga'; mime: string } {
  if (r.kind === 'tga') return { bytes: encodeTga({ width: r.width, height: r.height, channels: r.channels, data: r.data as Uint8Array }), ext: 'tga', mime: 'image/x-tga' };
  const bytes = encodePng({ width: r.width, height: r.height, data: r.data, depth: r.depth, channels: r.channels });
  return { bytes, ext: 'png', mime: 'image/png' };
}

export type Convention = 'opengl' | 'directx';

const TOKEN = /([_\-. ])(directx|opengl|d3d|ogl|dx|gl)(?=[_\-. ]|$)/i;
const SWAP: Record<string, Record<Convention, string>> = {
  directx: { opengl: 'OpenGL', directx: 'DirectX' },
  opengl: { opengl: 'OpenGL', directx: 'DirectX' },
  d3d: { opengl: 'GL', directx: 'D3D' },
  ogl: { opengl: 'OGL', directx: 'DX' },
  dx: { opengl: 'GL', directx: 'DX' },
  gl: { opengl: 'GL', directx: 'DX' },
};

/**
 * Output file name for the target convention: an existing token ("_DX", "-OpenGL", ".gl") is swapped,
 * keeping its style and case; otherwise "_OpenGL" or "_DirectX" is appended.
 */
export function convertedName(name: string, ext: string, target: Convention, rename: boolean): string {
  const dot = name.lastIndexOf('.');
  let base = dot > 0 ? name.slice(0, dot) : name;
  if (rename) {
    const m = base.match(TOKEN);
    if (m) {
      let word = SWAP[m[2].toLowerCase()][target];
      if (m[2] === m[2].toLowerCase()) word = word.toLowerCase();
      else if (m[2] === m[2].toUpperCase()) word = word.toUpperCase();
      base = base.slice(0, m.index! + 1) + word + base.slice(m.index! + 1 + m[2].length);
    } else base += target === 'opengl' ? '_OpenGL' : '_DirectX';
  }
  return `${base}.${ext}`;
}

/**
 * Grayscale shading of the normal map read as OpenGL (green = up), lit from the top left.
 * Bumps look raised in an OpenGL map and sunken (lit from below) in a DirectX map.
 * `flip` previews the result without converting the full image.
 */
export function shade(r: Raster, flip: FlipOptions, maxSide = 360): ImageData {
  const s = Math.min(1, maxSide / Math.max(r.width, r.height));
  const w = Math.max(1, Math.round(r.width * s));
  const h = Math.max(1, Math.round(r.height * s));
  const out = new ImageData(w, h);
  const max = r.depth === 16 ? 65535 : 255;
  const L = [-0.5, 0.5, 0.71];
  const len = Math.hypot(...L);
  for (let y = 0; y < h; y++) {
    const sy = Math.min(r.height - 1, Math.floor(y / s));
    for (let x = 0; x < w; x++) {
      const sx = Math.min(r.width - 1, Math.floor(x / s));
      const i = (sy * r.width + sx) * r.channels;
      let nx = (r.data[i] / max) * 2 - 1;
      let ny = (r.data[i + 1] / max) * 2 - 1;
      const nz = (r.data[i + 2] / max) * 2 - 1;
      if (flip.red) nx = -nx;
      if (flip.green) ny = -ny;
      const d = Math.max(0, (nx * L[0] + ny * L[1] + nz * L[2]) / len / (Math.hypot(nx, ny, nz) || 1));
      const v = Math.round(40 + d * 215);
      const o = (y * w + x) * 4;
      out.data[o] = out.data[o + 1] = out.data[o + 2] = v;
      out.data[o + 3] = 255;
    }
  }
  return out;
}
