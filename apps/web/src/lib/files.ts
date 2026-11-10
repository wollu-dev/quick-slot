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
  /** ZIP 안에 기록할 수정 시각 (압축을 풀면 이 날짜가 적용됨) */
  mtime?: Date;
}

/** 같은 이름이 있으면 "name (2).ext" 처럼 번호를 붙인다 */
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
 * level 0 = 압축 없이 묶기만 (이미 압축된 이미지·영상은 이게 빠르고 크기도 비슷)
 * ZIP 형식은 1980년 이전 날짜를 표현할 수 없어서 그 경우 1980-01-01로 맞춘다.
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
