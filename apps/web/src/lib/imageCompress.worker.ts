/// <reference lib="webworker" />
/**
 * Encodes images off the main thread, so large photos don't freeze the page.
 * The codecs (WebAssembly) are loaded the first time each one is needed.
 */
import type { EncodeRequest, EncodeResponse } from './imageCompress';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Reduces the image to at most 256 colors, so oxipng can store it as a palette PNG */
async function quantize(image: ImageData): Promise<ImageData> {
  const { quantize: q, applyPalette } = await import('gifenc');
  const hasAlpha = image.data.some((v, i) => i % 4 === 3 && v < 255);
  const format = hasAlpha ? 'rgba4444' : 'rgb565';
  const palette = q(image.data, 256, { format });
  const index = applyPalette(image.data, palette, format);
  const out = new Uint8ClampedArray(image.data.length);
  for (let i = 0; i < index.length; i++) {
    const c = palette[index[i]];
    out[i * 4] = c[0];
    out[i * 4 + 1] = c[1];
    out[i * 4 + 2] = c[2];
    out[i * 4 + 3] = hasAlpha ? (c[3] ?? 255) : 255;
  }
  return new ImageData(out, image.width, image.height);
}

async function encode({ image, format, quality, pngColors }: EncodeRequest): Promise<ArrayBuffer> {
  const q = Math.round(quality * 100);
  switch (format) {
    case 'jpeg': {
      const { default: enc } = await import('@jsquash/jpeg/encode');
      return enc(image, { quality: q, progressive: true, optimize_coding: true });
    }
    case 'webp': {
      const { default: enc } = await import('@jsquash/webp/encode');
      return enc(image, { quality: q, method: 4 });
    }
    case 'avif': {
      const { default: enc } = await import('@jsquash/avif/encode');
      return enc(image, { quality: q, speed: 6 });
    }
    case 'png': {
      const { default: optimise } = await import('@jsquash/oxipng/optimise');
      return optimise(pngColors ? await quantize(image) : image, { level: 2, optimiseAlpha: true });
    }
  }
}

ctx.onmessage = async (e: MessageEvent<EncodeRequest>) => {
  const { id } = e.data;
  try {
    const buffer = await encode(e.data);
    ctx.postMessage({ id, buffer } satisfies EncodeResponse, [buffer]);
  } catch (err) {
    ctx.postMessage({ id, error: (err as Error)?.message ?? String(err) } satisfies EncodeResponse);
  }
};
