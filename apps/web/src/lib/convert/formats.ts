/**
 * File formats the converter understands, and detection of a file's real format
 * from its content (magic bytes), not from its extension.
 *
 * Every format belongs to one kind. Conversion only happens within a kind, with one
 * exception: video can also be converted to audio (extract the sound track).
 */

export type Kind = 'image' | 'audio' | 'video' | 'data';

export type FormatId =
  // image
  | 'jpeg' | 'png' | 'webp' | 'avif' | 'gif' | 'bmp' | 'ico' | 'heic' | 'svg'
  // audio
  | 'mp3' | 'wav' | 'ogg' | 'm4a' | 'flac' | 'opus' | 'aac'
  // video
  | 'mp4' | 'webm' | 'mov' | 'mkv' | 'avi'
  // data
  | 'json' | 'yaml' | 'csv' | 'tsv' | 'xml';

export interface Format {
  id: FormatId;
  kind: Kind;
  /** Display name */
  label: string;
  /** Extensions, the first one is used for output files */
  exts: string[];
  mime: string;
  /** Can be produced by the converter */
  output: boolean;
}

const f = (id: FormatId, kind: Kind, label: string, exts: string[], mime: string, output = true): Format => ({ id, kind, label, exts, mime, output });

export const FORMATS: Record<FormatId, Format> = {
  jpeg: f('jpeg', 'image', 'JPG', ['jpg', 'jpeg', 'jpe', 'jfif'], 'image/jpeg'),
  png: f('png', 'image', 'PNG', ['png'], 'image/png'),
  webp: f('webp', 'image', 'WebP', ['webp'], 'image/webp'),
  avif: f('avif', 'image', 'AVIF', ['avif'], 'image/avif'),
  gif: f('gif', 'image', 'GIF', ['gif'], 'image/gif'),
  bmp: f('bmp', 'image', 'BMP', ['bmp', 'dib'], 'image/bmp'),
  ico: f('ico', 'image', 'ICO', ['ico'], 'image/x-icon'),
  heic: f('heic', 'image', 'HEIC', ['heic', 'heif', 'hif'], 'image/heic', false),
  svg: f('svg', 'image', 'SVG', ['svg'], 'image/svg+xml', false),

  mp3: f('mp3', 'audio', 'MP3', ['mp3'], 'audio/mpeg'),
  wav: f('wav', 'audio', 'WAV', ['wav'], 'audio/wav'),
  ogg: f('ogg', 'audio', 'OGG', ['ogg', 'oga'], 'audio/ogg'),
  m4a: f('m4a', 'audio', 'M4A', ['m4a'], 'audio/mp4'),
  flac: f('flac', 'audio', 'FLAC', ['flac'], 'audio/flac'),
  opus: f('opus', 'audio', 'Opus', ['opus'], 'audio/ogg; codecs=opus'),
  aac: f('aac', 'audio', 'AAC', ['aac'], 'audio/aac', false),

  mp4: f('mp4', 'video', 'MP4', ['mp4', 'm4v'], 'video/mp4'),
  webm: f('webm', 'video', 'WebM', ['webm'], 'video/webm'),
  mov: f('mov', 'video', 'MOV', ['mov', 'qt'], 'video/quicktime'),
  mkv: f('mkv', 'video', 'MKV', ['mkv'], 'video/x-matroska'),
  avi: f('avi', 'video', 'AVI', ['avi'], 'video/x-msvideo', false),

  json: f('json', 'data', 'JSON', ['json'], 'application/json'),
  yaml: f('yaml', 'data', 'YAML', ['yaml', 'yml'], 'application/yaml'),
  csv: f('csv', 'data', 'CSV', ['csv'], 'text/csv'),
  tsv: f('tsv', 'data', 'TSV', ['tsv', 'tab'], 'text/tab-separated-values'),
  xml: f('xml', 'data', 'XML', ['xml'], 'application/xml'),
};

/** Output targets offered for each kind, in display order */
export const TARGETS: Record<Kind, FormatId[]> = {
  image: ['jpeg', 'png', 'webp', 'avif', 'gif', 'bmp', 'ico'],
  audio: ['mp3', 'wav', 'm4a', 'ogg', 'opus', 'flac'],
  video: ['mp4', 'webm', 'mov', 'mkv', 'gif', 'mp3', 'm4a', 'wav'],
  data: ['json', 'yaml', 'csv', 'tsv', 'xml'],
};

export const formatByExt = (ext: string): Format | undefined => {
  const e = ext.toLowerCase();
  return Object.values(FORMATS).find((x) => x.exts.includes(e));
};

// ───────────── Detection ─────────────

const ascii = (b: Uint8Array, off: number, len: number) => String.fromCharCode(...b.subarray(off, off + len));
const startsWith = (b: Uint8Array, bytes: number[], off = 0) => bytes.every((v, i) => b[off + i] === v);

/** ISO base media file (MP4, MOV, HEIC, AVIF, M4A…): decide by the major and compatible brands */
function detectIsoBmff(b: Uint8Array): FormatId | null {
  if (ascii(b, 4, 4) !== 'ftyp') return null;
  const size = Math.min(new DataView(b.buffer, b.byteOffset).getUint32(0), b.length);
  const brands = [ascii(b, 8, 4)];
  for (let o = 16; o + 4 <= size; o += 4) brands.push(ascii(b, o, 4));
  const has = (...xs: string[]) => brands.some((x) => xs.includes(x));
  if (has('avif', 'avis')) return 'avif';
  if (has('heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1')) return 'heic';
  if (brands[0] === 'qt  ') return 'mov';
  if (has('M4A ', 'M4B ', 'F4A ')) return 'm4a';
  return 'mp4';
}

/** Matroska / WebM: the DocType element says which */
function detectEbml(b: Uint8Array): FormatId | null {
  if (!startsWith(b, [0x1a, 0x45, 0xdf, 0xa3])) return null;
  return ascii(b, 0, Math.min(64, b.length)).includes('webm') ? 'webm' : 'mkv';
}

/** OGG container: Opus or Vorbis audio, or video (Theora) which we treat as unsupported */
function detectOgg(b: Uint8Array): FormatId | null {
  if (ascii(b, 0, 4) !== 'OggS') return null;
  const head = ascii(b, 0, Math.min(128, b.length));
  if (head.includes('OpusHead')) return 'opus';
  return 'ogg';
}

/** Text formats: decided by content when it is unambiguous, otherwise by extension */
function detectText(b: Uint8Array, ext: string): FormatId | null {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(b.subarray(0, 4096));
  } catch {
    return null; // not text
  }
  const t = text.replace(/^﻿/, '').trimStart();
  if (/^<svg[\s>]/i.test(t) || (/^<\?xml/i.test(t) && /<svg[\s>]/i.test(t))) return 'svg';
  const byExt = formatByExt(ext);
  if (byExt?.kind === 'data') return byExt.id;
  if (t.startsWith('<?xml') || /^<[A-Za-z_][\w:.-]*[\s>/]/.test(t)) return 'xml';
  if (t.startsWith('{') || t.startsWith('[')) return 'json';
  return null;
}

/**
 * Real format of a file, read from its first bytes. Returns null when it's not a format
 * the converter supports. `ext` is only used to tell apart text formats (CSV vs TSV vs YAML).
 */
export function detectFormat(head: Uint8Array, ext: string): FormatId | null {
  const b = head;
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'png';
  if (ascii(b, 0, 6) === 'GIF87a' || ascii(b, 0, 6) === 'GIF89a') return 'gif';
  if (ascii(b, 0, 2) === 'BM') return 'bmp';
  if (startsWith(b, [0x00, 0x00, 0x01, 0x00])) return 'ico';
  if (ascii(b, 0, 4) === 'RIFF') {
    const type = ascii(b, 8, 4);
    if (type === 'WEBP') return 'webp';
    if (type === 'WAVE') return 'wav';
    if (type === 'AVI ') return 'avi';
  }
  const iso = detectIsoBmff(b);
  if (iso) return iso;
  const ebml = detectEbml(b);
  if (ebml) return ebml;
  const ogg = detectOgg(b);
  if (ogg) return ogg;
  if (ascii(b, 0, 4) === 'fLaC') return 'flac';
  if (ascii(b, 0, 3) === 'ID3') return 'mp3';
  // MPEG audio frame sync. 0xFFF1 / 0xFFF9 is AAC (ADTS), other 0xFFEx / 0xFFFx frames are MP3.
  if (b[0] === 0xff && (b[1] & 0xe0) === 0xe0) return (b[1] & 0x06) === 0 ? 'aac' : 'mp3';
  return detectText(b, ext);
}

export async function detectFile(file: File): Promise<FormatId | null> {
  const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
  const dot = file.name.lastIndexOf('.');
  return detectFormat(head, dot > 0 ? file.name.slice(dot + 1) : '');
}

/** Formats this file can be turned into. Same-format targets are allowed (that is a plain rename). */
export function targetsFor(source: FormatId): FormatId[] {
  const kind = FORMATS[source].kind;
  return TARGETS[kind];
}
