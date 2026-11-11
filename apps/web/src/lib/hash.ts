import { createCRC32, createMD5, createSHA1, createSHA256, createSHA512, type IHasher } from 'hash-wasm';

export type Algo = 'md5' | 'sha1' | 'sha256' | 'sha512' | 'crc32';

export const ALGOS: { id: Algo; label: string; hexLength: number }[] = [
  { id: 'md5', label: 'MD5', hexLength: 32 },
  { id: 'sha1', label: 'SHA-1', hexLength: 40 },
  { id: 'sha256', label: 'SHA-256', hexLength: 64 },
  { id: 'sha512', label: 'SHA-512', hexLength: 128 },
  { id: 'crc32', label: 'CRC32', hexLength: 8 },
];

export const algoLabel = (a: Algo) => ALGOS.find((x) => x.id === a)!.label;

const CREATE: Record<Algo, () => Promise<IHasher>> = {
  md5: createMD5,
  sha1: createSHA1,
  sha256: createSHA256,
  sha512: createSHA512,
  crc32: () => createCRC32(),
};

/** Files are read in slices of this size, so large files never sit in memory at once */
const CHUNK = 8 * 1024 * 1024;

export class HashCancelled extends Error {}

/**
 * Hashes a file or text with several algorithms in one pass.
 * `onProgress` gets 0..1; `keepGoing` is checked between chunks and stops the work when it returns false.
 */
export async function hashData(
  data: Blob | string,
  algos: Algo[],
  onProgress?: (done: number) => void,
  keepGoing: () => boolean = () => true,
): Promise<Partial<Record<Algo, string>>> {
  const hashers = await Promise.all(algos.map((a) => CREATE[a]()));
  hashers.forEach((h) => h.init());
  if (typeof data === 'string') {
    const bytes = new TextEncoder().encode(data);
    hashers.forEach((h) => h.update(bytes));
  } else {
    for (let pos = 0; pos < data.size; pos += CHUNK) {
      if (!keepGoing()) throw new HashCancelled();
      const bytes = new Uint8Array(await data.slice(pos, pos + CHUNK).arrayBuffer());
      hashers.forEach((h) => h.update(bytes));
      onProgress?.(Math.min(1, (pos + bytes.length) / data.size));
    }
  }
  return Object.fromEntries(algos.map((a, i) => [a, hashers[i].digest('hex')]));
}

/**
 * Normalizes a pasted hash: takes the first token of `sha256sum` style output ("<hash>  <name>"),
 * the value of BSD style output ("SHA256 (name) = <hash>"), drops a "SHA256:" style prefix, and lowercases it.
 * Returns '' when it doesn't look like hex.
 */
export function normalizeHash(input: string): string {
  const bsd = input.match(/=\s*([0-9a-f]+)\s*$/i);
  let s = bsd ? bsd[1] : (input.trim().split(/\s+/)[0] ?? '');
  s = s.replace(/^[a-z0-9-]+:/i, '');
  s = s.toLowerCase();
  return /^[0-9a-f]+$/.test(s) ? s : '';
}

/** Algorithm whose output has this length (MD5 32, SHA-1 40, …) */
export const algoForLength = (n: number): Algo | undefined => ALGOS.find((a) => a.hexLength === n)?.id;
