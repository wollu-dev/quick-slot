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
 * The ZIP format cannot represent dates before 1980, so those are clamped to 1980-01-01.
 */
export function makeZip(entries: ZipEntry[], level: 0 | 6 = 0): Blob {
  const names = dedupeNames(entries.map((e) => e.name));
  const zippable: Zippable = {};
  const minDate = new Date(1980, 0, 1, 0, 0, 2);
  entries.forEach((e, i) => {
    const mtime = e.mtime ? (e.mtime < minDate ? minDate : e.mtime) : undefined;
    zippable[names[i]] = [e.data, { level, mtime }];
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
