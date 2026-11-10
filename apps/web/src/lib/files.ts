import { zipSync, type Zippable } from 'fflate';

export function downloadBlob(data: Blob, filename: string) {
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export interface ZipEntry {
  name: string;
  data: Uint8Array;
  /** Modification time recorded in the ZIP (applied when the archive is extracted) */
  mtime?: Date;
  /** Creation time. Restored by extractors that read the NTFS extra field (e.g. Bandizip, 7-Zip). */
  ctime?: Date;
  /** Last access time. Restored by the same extractors as ctime. */
  atime?: Date;
}

/** Windows FILETIME: 100-nanosecond ticks since 1601-01-01 UTC */
const toFiletime = (d: Date) => (BigInt(d.getTime()) + 11_644_473_600_000n) * 10_000n;

/**
 * NTFS extra field (0x000a): exact modification, access and creation times.
 * Bandizip restores all three; Windows Explorer uses the modification time for all of them.
 */
function ntfsExtra(mtime: Date, atime: Date, ctime: Date): Uint8Array {
  const b = new Uint8Array(32);
  const dv = new DataView(b.buffer);
  // 4 reserved bytes, then attribute tag 1 with 24 bytes of data
  dv.setUint16(4, 0x0001, true);
  dv.setUint16(6, 24, true);
  dv.setBigUint64(8, toFiletime(mtime), true);
  dv.setBigUint64(16, toFiletime(atime), true);
  dv.setBigUint64(24, toFiletime(ctime), true);
  return b;
}

/** Extended timestamp extra field (0x5455, "UT"): the Unix modification time, read by macOS and Linux tools */
function unixTimeExtra(mtime: Date): Uint8Array {
  const b = new Uint8Array(5);
  b[0] = 0x01; // flag: modification time present
  new DataView(b.buffer).setUint32(1, Math.max(0, Math.floor(mtime.getTime() / 1000)), true);
  return b;
}

/** If the name is already taken, append a number like "name (2).ext" */
export function dedupeNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const key = name.toLowerCase();
    const n = seen.get(key) ?? 0;
    seen.set(key, n + 1);
    if (n === 0) return name;
    const { base, ext } = splitName(name);
    return `${base} (${n + 1})${ext ? '.' + ext : ''}`;
  });
}

/**
 * level 0 = store only, no compression (faster for already-compressed images/video, with about the same size)
 * The basic ZIP date field cannot represent dates before 1980, so it is clamped to 1980-01-01;
 * the NTFS and Unix extra fields still carry the exact date for tools that read them.
 */
export function makeZip(entries: ZipEntry[], level: 0 | 6 = 0): Blob {
  const names = dedupeNames(entries.map((e) => e.name));
  const zippable: Zippable = {};
  const minDate = new Date(1980, 0, 1, 0, 0, 2);
  entries.forEach((e, i) => {
    const mtime = e.mtime ? (e.mtime < minDate ? minDate : e.mtime) : undefined;
    const extra: Record<number, Uint8Array> = {};
    // Only one of the two: when both are present, Bandizip reads the Unix field and ignores
    // the NTFS creation and access times (verified with Bandizip 7).
    if (e.mtime && (e.ctime || e.atime)) extra[0x000a] = ntfsExtra(e.mtime, e.atime ?? e.mtime, e.ctime ?? e.mtime);
    else if (e.mtime) extra[0x5455] = unixTimeExtra(e.mtime);
    zippable[names[i]] = [e.data, { level, mtime, extra }];
  });
  const out = zipSync(zippable);
  return new Blob([out as Uint8Array<ArrayBuffer>], { type: 'application/zip' });
}

export async function readBytes(file: File): Promise<Uint8Array> {
  return new Uint8Array(await file.arrayBuffer());
}

/** "a.tar.gz" → { base: "a.tar", ext: "gz" }, ".gitignore" → { base: ".gitignore", ext: "" } */
export function splitName(name: string): { base: string; ext: string } {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return { base: name, ext: '' };
  return { base: name.slice(0, dot), ext: name.slice(dot + 1) };
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = n / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v < 10 ? 2 : 1)} ${units[i]}`;
}

export function timestampForFilename(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}
