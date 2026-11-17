/**
 * File Refinery: one pass over many files that can convert the format, strip metadata, rename,
 * fix decomposed (NFD) names, set dates and list checksums. Each step reuses the library of the
 * tool that does it on its own.
 */
import { convertFile, detectFile, FORMATS, type ConvertOptions, type FormatId, type Kind } from './convert';
import { exifDateToLocal, findExif, getText, readTags, TAG } from './exifEdit';
import { splitName } from './files';
import { hashData } from './hash';
import { stripMetadata } from './metadata';
import { buildName, type RenameOptions } from './rename';

export type DateMode = 'keep' | 'set' | 'exif';

export interface RefineOptions {
  convert: { enabled: boolean; targets: Partial<Record<Kind, FormatId>>; opts: ConvertOptions };
  strip: boolean;
  rename: { enabled: boolean; opts: RenameOptions };
  nfc: boolean;
  date: { mode: DateMode; value: Date; created: boolean };
  hash: boolean;
}

export interface Source {
  file: File;
  /** Folder part of the path, with a trailing slash, or '' */
  folder: string;
  format: FormatId | null;
  /** Date taken from EXIF (JPEG only) */
  taken?: Date;
}

export interface Planned {
  source: Source;
  target: FormatId | null;
  /** Output path inside the ZIP */
  path: string;
  mtime: Date;
  ctime?: Date;
  strip: boolean;
  regexError?: string;
}

const STRIPPABLE: FormatId[] = ['jpeg', 'png', 'webp'];

export async function inspect(file: File, path: string): Promise<Source> {
  const cut = path.lastIndexOf('/') + 1;
  const format = await detectFile(file);
  let taken: Date | undefined;
  if (format === 'jpeg') {
    try {
      // The EXIF block sits near the start: reading the first 256 KB is enough
      const head = new Uint8Array(await file.slice(0, 256 * 1024).arrayBuffer());
      const tags = readTags(findExif(head));
      const local = exifDateToLocal(getText(tags, 'exif', TAG.dateOriginal) ?? getText(tags, 'ifd0', TAG.dateTime));
      if (local) taken = new Date(local);
    } catch {
      /* no usable date */
    }
  }
  return { file, folder: path.slice(0, cut), format, taken };
}

/** Output names, formats and dates for every file (no file data is read) */
export function plan(sources: Source[], o: RefineOptions): Planned[] {
  return sources.map((s, i) => {
    const kind = s.format ? FORMATS[s.format].kind : null;
    const wanted = o.convert.enabled && kind ? o.convert.targets[kind] : undefined;
    const target = wanted && s.format && wanted !== s.format ? wanted : null;
    const outFormat = target ?? s.format;
    let name = s.file.name;
    if (target) name = `${splitName(name).base}.${FORMATS[target].exts[0]}`;
    const date = o.date.mode === 'set' ? o.date.value : o.date.mode === 'exif' && s.taken ? s.taken : new Date(s.file.lastModified);
    let regexError: string | undefined;
    if (o.rename.enabled) {
      const r = buildName(name, i, o.rename.opts, date);
      name = r.name;
      regexError = r.regexError;
    }
    let path = s.folder + name;
    if (o.nfc) path = path.normalize('NFC');
    return {
      source: s,
      target,
      path,
      mtime: date,
      ctime: o.date.mode !== 'keep' && o.date.created ? date : undefined,
      strip: o.strip && !!outFormat && STRIPPABLE.includes(outFormat) && !target,
      regexError,
    };
  });
}

/** Produces one output file. Converted images are re-encoded, so they carry no metadata anyway. */
export async function produce(p: Planned, o: RefineOptions, onProgress?: (r: number) => void, onEngine?: (r: number) => void): Promise<Uint8Array> {
  let blob: Blob = p.source.file;
  if (p.target && p.source.format) blob = (await convertFile(p.source.file, p.source.format, p.target, o.convert.opts, onProgress, onEngine)).blob;
  const bytes: Uint8Array = new Uint8Array(await blob.arrayBuffer());
  return p.strip ? stripMetadata(bytes, { keepOrientation: true, keepIcc: true }).data : bytes;
}

/** "hash  path" lines, the format sha256sum and most checksum tools read */
export async function checksums(files: { path: string; data: Uint8Array }[]): Promise<string> {
  const lines: string[] = [];
  for (const f of files) lines.push(`${(await hashData(new Blob([f.data as Uint8Array<ArrayBuffer>]), ['sha256'])).sha256}  ${f.path}`);
  return lines.join('\n') + '\n';
}
