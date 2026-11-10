/**
 * Strips image metadata at the byte level without re-encoding (zero quality loss).
 * Supported: JPEG, PNG, WebP
 *
 * No UI text is produced here. Item kinds, descriptions and errors are returned as codes,
 * and the UI (MetadataRemover) maps them through the per-language dictionary.
 */

export type ItemKind = 'exif' | 'xmp' | 'icc' | 'iptc' | 'app' | 'comment' | 'text' | 'time';
export type ItemDetail = 'exif' | 'exifOrientationKept' | 'xmp' | 'iptc' | 'app' | 'aiPrompt';

export interface FoundItem {
  kind: ItemKind;
  /** APPn number when kind='app', PNG text key when kind='text' */
  param?: string | number;
  /** Description to be mapped through the per-language dictionary */
  detail?: ItemDetail;
  /** Excerpt of what the file actually contained (comment/text) */
  preview?: string;
  bytes: number;
  removed: boolean;
}

export type MetadataErrorCode = 'unsupported' | 'corruptJpeg' | 'corruptPng';

export class MetadataError extends Error {
  code: MetadataErrorCode;
  constructor(code: MetadataErrorCode) {
    super(code);
    this.code = code;
    this.name = 'MetadataError';
  }
}

export interface ExifSummary {
  make?: string;
  model?: string;
  software?: string;
  dateTime?: string;
  orientation?: number;
  gps?: { lat: number; lon: number } | 'present';
}

export interface StripResult {
  format: 'jpeg' | 'png' | 'webp';
  data: Uint8Array;
  items: FoundItem[];
  exif?: ExifSummary;
}

export interface StripOptions {
  /** Keep only the rotation (Orientation) info so the photo doesn't turn sideways after EXIF is removed */
  keepOrientation: boolean;
  /** Keep the color profile (ICC). Removing it can make colors look different */
  keepIcc: boolean;
}

export function detectFormat(b: Uint8Array): StripResult['format'] | null {
  if (b[0] === 0xff && b[1] === 0xd8) return 'jpeg';
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'png';
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 4) === 'WEBP') return 'webp';
  return null;
}

export function stripMetadata(bytes: Uint8Array, opts: StripOptions): StripResult {
  const format = detectFormat(bytes);
  if (format === 'jpeg') return stripJpeg(bytes, opts);
  if (format === 'png') return stripPng(bytes, opts);
  if (format === 'webp') return stripWebp(bytes, opts);
  throw new MetadataError('unsupported');
}

// ───────────────────────── JPEG ─────────────────────────

function stripJpeg(b: Uint8Array, opts: StripOptions): StripResult {
  const out: Uint8Array[] = [b.subarray(0, 2)];
  const items: FoundItem[] = [];
  let exif: ExifSummary | undefined;
  let pos = 2;

  while (pos < b.length) {
    if (b[pos] !== 0xff) throw new MetadataError('corruptJpeg');
    let mpos = pos + 1;
    while (b[mpos] === 0xff) mpos++; // fill bytes
    const marker = b[mpos];
    const segStart = pos;

    // Everything after SOS is compressed image data → copy as is
    if (marker === 0xda) {
      out.push(b.subarray(segStart));
      break;
    }
    // Markers without a length
    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      out.push(b.subarray(segStart, mpos + 1));
      pos = mpos + 1;
      continue;
    }
    const len = (b[mpos + 1] << 8) | b[mpos + 2];
    const end = mpos + 1 + len;
    if (end > b.length) throw new MetadataError('corruptJpeg');
    const payload = b.subarray(mpos + 3, end);
    const seg = b.subarray(segStart, end);

    let remove = false;
    let kind: ItemKind | undefined;
    let detail: ItemDetail | undefined;
    let param: number | undefined;
    let preview: string | undefined;

    if (marker === 0xe1 && ascii(payload, 0, 6) === 'Exif\0\0') {
      kind = 'exif';
      detail = 'exif';
      remove = true;
      try {
        exif = parseExif(payload.subarray(6));
      } catch {
        /* Only the summary failed; removal continues */
      }
    } else if (marker === 0xe1) {
      kind = 'xmp';
      detail = 'xmp';
      remove = true;
    } else if (marker === 0xe2 && ascii(payload, 0, 11) === 'ICC_PROFILE') {
      kind = 'icc';
      remove = !opts.keepIcc;
    } else if (marker === 0xed) {
      kind = 'iptc';
      detail = 'iptc';
      remove = true;
    } else if (marker === 0xee) {
      // APP14 Adobe: holds color transform info, removing it can break colors → keep
    } else if (marker >= 0xe3 && marker <= 0xef) {
      kind = 'app';
      param = marker - 0xe0;
      detail = 'app';
      remove = true;
    } else if (marker === 0xfe) {
      kind = 'comment';
      preview = decodeText(payload).slice(0, 80);
      remove = true;
    }

    if (kind) items.push({ kind, param, detail, preview, bytes: seg.length, removed: remove });
    if (!remove) out.push(seg);
    pos = end;
  }

  if (opts.keepOrientation && exif?.orientation && exif.orientation !== 1) {
    // Insert a minimal EXIF holding only the orientation right after SOI (or after JFIF)
    const insertAt = out.length > 1 && isJfif(out[1]) ? 2 : 1;
    out.splice(insertAt, 0, minimalOrientationApp1(exif.orientation));
    const it = items.find((i) => i.kind === 'exif');
    if (it) it.detail = 'exifOrientationKept';
  }

  return { format: 'jpeg', data: concat(out), items, exif };
}

function isJfif(seg: Uint8Array) {
  return seg[1] === 0xe0 && ascii(seg, 4, 5) === 'JFIF\0';
}

function minimalOrientationApp1(orientation: number): Uint8Array {
  // "Exif\0\0" + TIFF (II) header + IFD0 (1 entry: 0x0112 SHORT) + next IFD 0
  const tiff = [
    0x49, 0x49, 0x2a, 0x00, 0x08, 0x00, 0x00, 0x00, // header, IFD0 offset 8
    0x01, 0x00, // 1 entry
    0x12, 0x01, 0x03, 0x00, 0x01, 0x00, 0x00, 0x00, orientation & 0xff, 0x00, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00, // no next IFD
  ];
  const payload = [...'Exif\0\0'].map((c) => c.charCodeAt(0)).concat(tiff);
  const len = payload.length + 2;
  return new Uint8Array([0xff, 0xe1, len >> 8, len & 0xff, ...payload]);
}

// ───────────────────────── PNG ─────────────────────────

const PNG_TEXT = new Set(['tEXt', 'zTXt', 'iTXt']);

function stripPng(b: Uint8Array, opts: StripOptions): StripResult {
  const out: Uint8Array[] = [b.subarray(0, 8)];
  const items: FoundItem[] = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 8;

  while (pos + 12 <= b.length) {
    const len = dv.getUint32(pos);
    const type = ascii(b, pos + 4, 4);
    const end = pos + 12 + len;
    if (end > b.length) throw new MetadataError('corruptPng');
    const chunk = b.subarray(pos, end);
    const data = b.subarray(pos + 8, pos + 8 + len);

    let remove = false;
    if (PNG_TEXT.has(type)) {
      const key = ascii(data, 0, Math.max(0, data.indexOf(0)));
      remove = true;
      items.push({
        kind: 'text',
        param: key || type,
        detail: key === 'parameters' ? 'aiPrompt' : undefined,
        preview: key === 'parameters' ? undefined : pngTextPreview(type, data),
        bytes: chunk.length,
        removed: true,
      });
    } else if (type === 'eXIf') {
      remove = true;
      items.push({ kind: 'exif', detail: 'exif', bytes: chunk.length, removed: true });
    } else if (type === 'tIME') {
      remove = true;
      items.push({ kind: 'time', bytes: chunk.length, removed: true });
    } else if (type === 'iCCP') {
      remove = !opts.keepIcc;
      items.push({ kind: 'icc', bytes: chunk.length, removed: remove });
    }

    if (!remove) out.push(chunk);
    pos = end;
    if (type === 'IEND') break;
  }
  return { format: 'png', data: concat(out), items };
}

function pngTextPreview(type: string, data: Uint8Array): string | undefined {
  if (type !== 'tEXt') return undefined;
  const nul = data.indexOf(0);
  return decodeText(data.subarray(nul + 1)).slice(0, 80) || undefined;
}

// ───────────────────────── WebP ─────────────────────────

function stripWebp(b: Uint8Array, opts: StripOptions): StripResult {
  const items: FoundItem[] = [];
  const kept: Uint8Array[] = [];
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let pos = 12;
  let vp8xIndex = -1;
  let exif: ExifSummary | undefined;

  while (pos + 8 <= b.length) {
    const fourcc = ascii(b, pos, 4);
    const size = dv.getUint32(pos + 4, true);
    const end = pos + 8 + size + (size & 1);
    const chunk = b.subarray(pos, Math.min(end, b.length));

    let remove = false;
    if (fourcc === 'EXIF') {
      remove = true;
      try {
        const d = b.subarray(pos + 8, pos + 8 + size);
        exif = parseExif(ascii(d, 0, 6) === 'Exif\0\0' ? d.subarray(6) : d);
      } catch {
        /* ignore */
      }
      items.push({ kind: 'exif', detail: 'exif', bytes: chunk.length, removed: true });
    } else if (fourcc === 'XMP ') {
      remove = true;
      items.push({ kind: 'xmp', detail: 'xmp', bytes: chunk.length, removed: true });
    } else if (fourcc === 'ICCP') {
      remove = !opts.keepIcc;
      items.push({ kind: 'icc', bytes: chunk.length, removed: remove });
    }
    if (!remove) {
      if (fourcc === 'VP8X') vp8xIndex = kept.length;
      kept.push(chunk.slice());
    }
    pos = end;
  }

  // Clear the VP8X flags for removed chunks (ICC 0x20, EXIF 0x08, XMP 0x04)
  if (vp8xIndex >= 0) {
    const vp8x = kept[vp8xIndex];
    let flags = vp8x[8];
    flags &= ~0x08 & ~0x04;
    if (!opts.keepIcc) flags &= ~0x20;
    vp8x[8] = flags;
  }

  const body = concat(kept);
  const header = new Uint8Array(12);
  header.set(b.subarray(0, 12));
  new DataView(header.buffer).setUint32(4, body.length + 4, true);
  return { format: 'webp', data: concat([header, body]), items, exif };
}

// ───────────────────────── EXIF summary ─────────────────────────

function parseExif(tiff: Uint8Array): ExifSummary {
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const le = ascii(tiff, 0, 2) === 'II';
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const summary: ExifSummary = {};

  type Entry = { tag: number; type: number; count: number; valueOff: number };
  const readIfd = (off: number): Entry[] => {
    if (off <= 0 || off + 2 > tiff.length) return [];
    const n = u16(off);
    const list: Entry[] = [];
    for (let i = 0; i < n && off + 2 + i * 12 + 12 <= tiff.length; i++) {
      const e = off + 2 + i * 12;
      list.push({ tag: u16(e), type: u16(e + 2), count: u32(e + 4), valueOff: e + 8 });
    }
    return list;
  };
  const str = (e: Entry) => {
    const off = e.count <= 4 ? e.valueOff : u32(e.valueOff);
    return decodeText(tiff.subarray(off, off + e.count)).replace(/\0+$/, '').trim();
  };
  const rationals = (e: Entry) => {
    const off = u32(e.valueOff);
    return Array.from({ length: e.count }, (_, i) => u32(off + i * 8) / (u32(off + i * 8 + 4) || 1));
  };

  for (const e of readIfd(u32(4))) {
    if (e.tag === 0x010f) summary.make = str(e);
    else if (e.tag === 0x0110) summary.model = str(e);
    else if (e.tag === 0x0131) summary.software = str(e);
    else if (e.tag === 0x0132) summary.dateTime ??= str(e);
    else if (e.tag === 0x0112) summary.orientation = u16(e.valueOff);
    else if (e.tag === 0x8769) {
      for (const s of readIfd(u32(e.valueOff))) if (s.tag === 0x9003) summary.dateTime = str(s);
    } else if (e.tag === 0x8825) {
      summary.gps = 'present';
      try {
        const g = readIfd(u32(e.valueOff));
        const get = (t: number) => g.find((x) => x.tag === t);
        const lat = get(2), lon = get(4), latRef = get(1), lonRef = get(3);
        if (lat && lon) {
          const dms = (v: number[]) => v[0] + (v[1] ?? 0) / 60 + (v[2] ?? 0) / 3600;
          let la = dms(rationals(lat));
          let lo = dms(rationals(lon));
          if (latRef && str(latRef) === 'S') la = -la;
          if (lonRef && str(lonRef) === 'W') lo = -lo;
          if (la || lo) summary.gps = { lat: la, lon: lo };
        }
      } catch {
        /* If the coordinates can't be parsed, just report them as present */
      }
    }
  }
  return summary;
}

// ───────────────────────── Utils ─────────────────────────

function ascii(b: Uint8Array, off: number, len: number): string {
  let s = '';
  for (let i = off; i < off + len && i < b.length; i++) s += String.fromCharCode(b[i]);
  return s;
}

function decodeText(b: Uint8Array): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('latin1').decode(b);
  }
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
