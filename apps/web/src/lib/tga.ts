/**
 * Minimal Truevision TGA reader and writer for 24- and 32-bit true-color images,
 * the kind game engines and texture tools use for normal maps.
 */

export interface TgaImage {
  width: number;
  height: number;
  /** 3 = RGB, 4 = RGBA, top-to-bottom rows */
  channels: 3 | 4;
  data: Uint8Array;
}

export type TgaErrorCode = 'tgaUnsupported' | 'tgaCorrupt';
export class TgaError extends Error {
  constructor(public code: TgaErrorCode) {
    super(code);
  }
}

/** TGA has no magic number at the start; this checks that the header makes sense */
export function looksLikeTga(b: Uint8Array): boolean {
  if (b.length < 18) return false;
  const type = b[2];
  const depth = b[16];
  const w = b[12] | (b[13] << 8);
  const h = b[14] | (b[15] << 8);
  return [1, 2, 3, 9, 10, 11].includes(type) && [8, 15, 16, 24, 32].includes(depth) && w > 0 && h > 0 && b[1] <= 1;
}

export function decodeTga(b: Uint8Array): TgaImage {
  if (b.length < 18) throw new TgaError('tgaCorrupt');
  const idLength = b[0];
  const colorMapType = b[1];
  const type = b[2];
  const cmLength = b[5] | (b[6] << 8);
  const cmEntry = b[7];
  const width = b[12] | (b[13] << 8);
  const height = b[14] | (b[15] << 8);
  const depth = b[16];
  const desc = b[17];
  // Only true-color 24/32-bit, raw or RLE: normal maps are never grayscale or palette images
  if ((type !== 2 && type !== 10) || (depth !== 24 && depth !== 32) || colorMapType !== 0) throw new TgaError('tgaUnsupported');
  const bpp = depth / 8;
  const channels = bpp as 3 | 4;
  let p = 18 + idLength + (colorMapType ? cmLength * Math.ceil(cmEntry / 8) : 0);
  const count = width * height;
  const raw = new Uint8Array(count * bpp);

  if (type === 2) {
    if (p + raw.length > b.length) throw new TgaError('tgaCorrupt');
    raw.set(b.subarray(p, p + raw.length));
  } else {
    let o = 0;
    while (o < raw.length) {
      if (p >= b.length) throw new TgaError('tgaCorrupt');
      const head = b[p++];
      const n = (head & 0x7f) + 1;
      if (o + n * bpp > raw.length) throw new TgaError('tgaCorrupt');
      if (head & 0x80) {
        if (p + bpp > b.length) throw new TgaError('tgaCorrupt');
        for (let k = 0; k < n; k++) for (let c = 0; c < bpp; c++) raw[o++] = b[p + c];
        p += bpp;
      } else {
        if (p + n * bpp > b.length) throw new TgaError('tgaCorrupt');
        raw.set(b.subarray(p, p + n * bpp), o);
        o += n * bpp;
        p += n * bpp;
      }
    }
  }

  // Pixels are BGR(A); rows start at the bottom unless bit 5 is set, columns at the left unless bit 4 is set
  const topDown = !!(desc & 0x20);
  const rightLeft = !!(desc & 0x10);
  const data = new Uint8Array(count * channels);
  for (let y = 0; y < height; y++) {
    const sy = topDown ? y : height - 1 - y;
    for (let x = 0; x < width; x++) {
      const sx = rightLeft ? width - 1 - x : x;
      const s = (sy * width + sx) * bpp;
      const d = (y * width + x) * channels;
      data[d] = raw[s + 2];
      data[d + 1] = raw[s + 1];
      data[d + 2] = raw[s];
      if (channels === 4) data[d + 3] = raw[s + 3];
    }
  }
  return { width, height, channels, data };
}

/** Uncompressed TGA, top-left origin, with the TGA 2.0 footer */
export function encodeTga(img: TgaImage): Uint8Array {
  const { width, height, channels, data } = img;
  const footer = new TextEncoder().encode('\0\0\0\0\0\0\0\0TRUEVISION-XFILE.\0');
  const out = new Uint8Array(18 + width * height * channels + footer.length);
  out[2] = 2;
  out[12] = width & 255;
  out[13] = width >> 8;
  out[14] = height & 255;
  out[15] = height >> 8;
  out[16] = channels * 8;
  out[17] = (channels === 4 ? 8 : 0) | 0x20;
  let o = 18;
  for (let i = 0; i < width * height; i++) {
    const s = i * channels;
    out[o++] = data[s + 2];
    out[o++] = data[s + 1];
    out[o++] = data[s];
    if (channels === 4) out[o++] = data[s + 3];
  }
  out.set(footer, o);
  return out;
}
