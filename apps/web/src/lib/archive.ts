import { inflateSync, Zip, ZipDeflate, ZipPassThrough } from 'fflate';

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** Name encodings offered for archives whose names are not marked as UTF-8 */
export const NAME_ENCODINGS = ['utf-8', 'euc-kr', 'shift_jis', 'gbk', 'big5'] as const;
export type NameEncoding = (typeof NAME_ENCODINGS)[number];

export type ArchiveErrorCode = 'notZip' | 'corrupt' | 'multiDisk';
export class ArchiveError extends Error {
  constructor(public code: ArchiveErrorCode) {
    super(code);
  }
}

/** Why one entry can't be extracted */
export type EntryProblem = 'encrypted' | 'method' | 'corrupt';

export interface ArchiveEntry {
  /** Raw name bytes as stored */
  rawName: Uint8Array;
  /** Name from the Info-ZIP Unicode Path extra field, or the name when the UTF-8 flag is set */
  utf8Name?: string;
  isDir: boolean;
  method: number;
  encrypted: boolean;
  crc: number;
  compressedSize: number;
  size: number;
  localOffset: number;
  mtime?: Date;
}

export interface Archive {
  file: Blob;
  entries: ArchiveEntry[];
}

const u16 = (d: DataView, o: number) => d.getUint16(o, true);
const u32 = (d: DataView, o: number) => d.getUint32(o, true);
const u64 = (d: DataView, o: number) => Number(d.getBigUint64(o, true));
const read = async (f: Blob, start: number, end: number) => new Uint8Array(await f.slice(start, end).arrayBuffer());
const view = (b: Uint8Array) => new DataView(b.buffer, b.byteOffset, b.byteLength);

function dosDate(date: number, time: number): Date | undefined {
  if (!date) return undefined;
  return new Date(1980 + (date >> 9), ((date >> 5) & 15) - 1, date & 31, time >> 11, (time >> 5) & 63, (time & 31) * 2);
}

/**
 * Reads the central directory only. File data stays in the Blob until an entry is extracted,
 * so large archives are never loaded into memory as a whole.
 */
export async function openArchive(file: Blob): Promise<Archive> {
  // End of central directory: 22 bytes plus a comment of up to 65535 bytes
  const tailStart = Math.max(0, file.size - 22 - 65535 - 20);
  const tail = await read(file, tailStart, file.size);
  const tv = view(tail);
  let e = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (u32(tv, i) === 0x06054b50) {
      e = i;
      break;
    }
  }
  if (e < 0) {
    const head = await read(file, 0, 4);
    throw new ArchiveError(head.length === 4 && view(head).getUint32(0, true) === 0x04034b50 ? 'corrupt' : 'notZip');
  }
  if (u16(tv, e + 4) !== 0 || u16(tv, e + 6) !== 0) throw new ArchiveError('multiDisk');
  let count = u16(tv, e + 10);
  let cdSize = u32(tv, e + 12);
  let cdOffset = u32(tv, e + 16);

  // ZIP64 end of central directory locator sits right before the classic record
  if (e >= 20 && u32(tv, e - 20) === 0x07064b50) {
    const z64 = u64(tv, e - 12);
    const rec = view(await read(file, z64, z64 + 56));
    if (rec.byteLength === 56 && u32(rec, 0) === 0x06064b50) {
      count = u64(rec, 32);
      cdSize = u64(rec, 40);
      cdOffset = u64(rec, 48);
    }
  }
  if (cdOffset + cdSize > file.size) throw new ArchiveError('corrupt');

  const cd = await read(file, cdOffset, cdOffset + cdSize);
  const v = view(cd);
  const entries: ArchiveEntry[] = [];
  let p = 0;
  for (let i = 0; i < count; i++) {
    if (p + 46 > cd.length || u32(v, p) !== 0x02014b50) throw new ArchiveError('corrupt');
    const flags = u16(v, p + 8);
    const method = u16(v, p + 10);
    const mtime = dosDate(u16(v, p + 14), u16(v, p + 12));
    const crc = u32(v, p + 16);
    let compressedSize = u32(v, p + 20);
    let size = u32(v, p + 24);
    const nameLen = u16(v, p + 28);
    const extraLen = u16(v, p + 30);
    const commentLen = u16(v, p + 32);
    let localOffset = u32(v, p + 42);
    const rawName = cd.slice(p + 46, p + 46 + nameLen);
    let utf8Name = flags & 0x800 ? new TextDecoder().decode(rawName) : undefined;

    // Extra fields: ZIP64 sizes (0x0001) and Info-ZIP Unicode Path (0x7075)
    let x = p + 46 + nameLen;
    const xEnd = x + extraLen;
    while (x + 4 <= xEnd) {
      const id = u16(v, x);
      const len = u16(v, x + 2);
      const body = x + 4;
      if (id === 0x0001) {
        let q = body;
        if (size === 0xffffffff && q + 8 <= body + len) (size = u64(v, q)), (q += 8);
        if (compressedSize === 0xffffffff && q + 8 <= body + len) (compressedSize = u64(v, q)), (q += 8);
        if (localOffset === 0xffffffff && q + 8 <= body + len) localOffset = u64(v, q);
      } else if (id === 0x7075 && len > 5 && v.getUint8(body) === 1 && !utf8Name) {
        // Only trust it when it was written for this exact name (CRC of the raw name)
        if (u32(v, body + 1) === crc32(rawName)) {
          try {
            utf8Name = new TextDecoder('utf-8', { fatal: true }).decode(cd.subarray(body + 5, body + len));
          } catch {
            /* ignore a broken field */
          }
        }
      }
      x = body + len;
    }

    // A trailing backslash (Windows PowerShell 5.1 writes those) only counts for empty entries,
    // because 0x5c can also be the second byte of a Shift_JIS character
    const last = rawName[rawName.length - 1];
    const isDir = last === 0x2f || (last === 0x5c && size === 0 && compressedSize === 0);
    entries.push({ rawName, utf8Name, isDir, method, encrypted: !!(flags & 1), crc, compressedSize, size, localOffset, mtime });
    p += 46 + nameLen + extraLen + commentLen;
  }
  return { file, entries };
}

const isAscii = (b: Uint8Array) => b.every((c) => c < 0x80);
const tryDecode = (b: Uint8Array, enc: NameEncoding) => {
  try {
    return new TextDecoder(enc, { fatal: true }).decode(b);
  } catch {
    return undefined;
  }
};

/**
 * Picks the encoding for names that are not marked as UTF-8.
 * UTF-8 wins when every name is valid UTF-8 (macOS often omits the flag); otherwise the first
 * encoding in `preferred` order that decodes every name without errors.
 */
export function detectEncoding(entries: ArchiveEntry[], preferred: NameEncoding[]): NameEncoding {
  const raw = entries.filter((e) => !e.utf8Name && !isAscii(e.rawName)).map((e) => e.rawName);
  if (!raw.length) return 'utf-8';
  for (const enc of ['utf-8', ...preferred] as NameEncoding[]) if (raw.every((b) => tryDecode(b, enc) !== undefined)) return enc;
  return preferred[0] ?? 'utf-8';
}

/** True when some names depend on the chosen encoding (not ASCII and not marked as UTF-8) */
export const hasLegacyNames = (entries: ArchiveEntry[]) => entries.some((e) => !e.utf8Name && !isAscii(e.rawName));

/**
 * Decoded name with "/" separators. Backslashes are replaced after decoding
 * (Windows PowerShell 5.1 writes "folder\file"; decoding first keeps Shift_JIS trail bytes intact).
 */
export function entryName(e: ArchiveEntry, enc: NameEncoding): string {
  const name = e.utf8Name ?? new TextDecoder(enc).decode(e.rawName);
  return name.replace(/\\/g, '/');
}

/**
 * Makes a stored path safe to write: forward slashes, no leading slash or drive letter,
 * no "." or ".." segments (protects against "zip slip"), no characters Windows forbids.
 */
export function safePath(name: string): string {
  return name
    .replace(/\\/g, '/')
    .split('/')
    .filter((s) => s && s !== '.' && s !== '..')
    .map((s) => s.replace(/^[a-zA-Z]:$/, '').replace(/[<>:"|?*\u0000-\u001f]/g, '_'))
    .filter(Boolean)
    .join('/');
}

export function entryProblem(e: ArchiveEntry): EntryProblem | undefined {
  if (e.encrypted) return 'encrypted';
  if (e.method !== 0 && e.method !== 8) return 'method';
  return undefined;
}

/** Extracts one entry and checks its CRC */
export async function extractEntry(archive: Archive, e: ArchiveEntry): Promise<Uint8Array> {
  const problem = entryProblem(e);
  if (problem) throw new Error(problem);
  const lh = view(await read(archive.file, e.localOffset, e.localOffset + 30));
  if (lh.byteLength < 30 || u32(lh, 0) !== 0x04034b50) throw new Error('corrupt');
  const start = e.localOffset + 30 + u16(lh, 26) + u16(lh, 28);
  const data = await read(archive.file, start, start + e.compressedSize);
  if (data.length < e.compressedSize) throw new Error('corrupt');
  let out: Uint8Array;
  try {
    out = e.method === 0 ? data : inflateSync(data, { out: new Uint8Array(e.size) });
  } catch {
    throw new Error('corrupt');
  }
  if (out.length !== e.size || crc32(out) !== e.crc) throw new Error('corrupt');
  return out;
}

let table: Uint32Array | undefined;
export function crc32(data: Uint8Array): number {
  if (!table) {
    table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[i] = c >>> 0;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = table[(c ^ data[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

export type Level = 0 | 6 | 9;

export interface WriteItem {
  path: string;
  /** A file to read in chunks, or bytes already in memory */
  data: Blob | Uint8Array;
  mtime?: Date;
}

/** Formats that are already compressed: deflating them again costs time and saves almost nothing */
const PACKED = /\.(jpe?g|png|gif|webp|avif|heic|heif|jxl|mp3|m4a|aac|ogg|opus|flac|mp4|m4v|mov|webm|mkv|avi|zip|7z|rar|gz|tgz|bz2|xz|zst|br|jar|apk|ipa|docx|xlsx|pptx|hwpx|epub|woff2?|pdf)$/i;

/** The ZIP format can't store dates before 1980 */
const MIN_DATE = new Date(1980, 0, 1, 0, 0, 2);

/** Above this, the archive would need ZIP64, which the streaming writer doesn't produce */
export const MAX_ZIP_BYTES = 4 * 1024 * 1024 * 1024 - 1;

const CHUNK = 4 * 1024 * 1024;

/**
 * Builds a ZIP by streaming each item in chunks, yielding between chunks so the page stays responsive.
 * Names are stored as UTF-8 (fflate sets the UTF-8 flag for non-ASCII names).
 */
export async function writeZip(items: WriteItem[], level: Level, onProgress?: (done: number) => void, keepGoing: () => boolean = () => true): Promise<Blob> {
  const parts: Uint8Array[] = [];
  let failure: Error | undefined;
  const zip = new Zip((err, chunk) => {
    if (err) failure = err;
    else if (chunk) parts.push(chunk);
  });
  const total = items.reduce((n, it) => n + (it.data instanceof Blob ? it.data.size : it.data.length), 0) || 1;
  let done = 0;
  for (const it of items) {
    const entry = level === 0 || PACKED.test(it.path) ? new ZipPassThrough(it.path) : new ZipDeflate(it.path, { level });
    entry.mtime = it.mtime && it.mtime < MIN_DATE ? MIN_DATE : (it.mtime ?? new Date());
    zip.add(entry);
    const size = it.data instanceof Blob ? it.data.size : it.data.length;
    if (!size) entry.push(new Uint8Array(0), true);
    for (let pos = 0; pos < size; pos += CHUNK) {
      if (!keepGoing()) throw new Error('cancelled');
      const chunk = it.data instanceof Blob ? new Uint8Array(await it.data.slice(pos, pos + CHUNK).arrayBuffer()) : it.data.subarray(pos, pos + CHUNK);
      entry.push(chunk, pos + CHUNK >= size);
      done += chunk.length;
      onProgress?.(done / total);
      if (failure) throw failure;
      // Let the browser paint between chunks
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  zip.end();
  if (failure) throw failure;
  return new Blob(parts as Uint8Array<ArrayBuffer>[], { type: 'application/zip' });
}

/** System files that should not go into an archive (or be shown when extracting) */
export const isJunk = (path: string) => /(^|\/)(\.DS_Store|Thumbs\.db|desktop\.ini|__MACOSX(\/|$)|\._[^/]*$)/i.test(path);
