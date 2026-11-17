/**
 * Reads and rewrites the EXIF block of a JPEG without touching the image data (no quality loss).
 *
 * Every tag of IFD0, the Exif IFD and the GPS IFD is read with its raw value, edited where asked,
 * and written back as a fresh little-endian TIFF structure with new offsets. Left out on purpose:
 * the thumbnail (IFD1), the Interoperability IFD and MakerNote, whose maker-specific contents hold
 * absolute offsets that would point to the wrong place once anything moves.
 */

type IfdName = 'ifd0' | 'exif' | 'gps';

interface Entry {
  type: number;
  count: number;
  /** Value bytes, little-endian */
  data: Uint8Array;
}

export type Tags = Record<IfdName, Map<number, Entry>>;

/** Size in bytes of one value of each TIFF type, and the size of the units to byte-swap */
const SIZE: Record<number, [number, number]> = {
  1: [1, 1], 2: [1, 1], 3: [2, 2], 4: [4, 4], 5: [8, 4], 6: [1, 1], 7: [1, 1], 8: [2, 2], 9: [4, 4], 10: [8, 4], 11: [4, 4], 12: [8, 8],
};

const POINTERS = { exif: 0x8769, gps: 0x8825, interop: 0xa005 };
const DROP = new Set([0x927c, POINTERS.interop, 0x0201, 0x0202]); // MakerNote, Interop pointer, old JPEG thumbnail pointers

export const TAG = {
  description: 0x010e,
  make: 0x010f,
  model: 0x0110,
  orientation: 0x0112,
  software: 0x0131,
  dateTime: 0x0132,
  artist: 0x013b,
  copyright: 0x8298,
  xpTitle: 0x9c9b,
  xpAuthor: 0x9c9d,
  dateOriginal: 0x9003,
  dateDigitized: 0x9004,
} as const;

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

/** The TIFF bytes of the first Exif APP1 segment, if any */
export function findExif(jpeg: Uint8Array): Uint8Array | null {
  let p = 2;
  while (p + 4 < jpeg.length && jpeg[p] === 0xff) {
    const marker = jpeg[p + 1];
    if (marker === 0xda || marker === 0xd9) break;
    const len = (jpeg[p + 2] << 8) | jpeg[p + 3];
    if (marker === 0xe1 && String.fromCharCode(...jpeg.subarray(p + 4, p + 10)) === 'Exif\0\0') return jpeg.subarray(p + 10, p + 2 + len);
    p += 2 + len;
  }
  return null;
}

export function readTags(tiff: Uint8Array | null): Tags {
  const tags: Tags = { ifd0: new Map(), exif: new Map(), gps: new Map() };
  if (!tiff || tiff.length < 8) return tags;
  const le = tiff[0] === 0x49;
  const dv = new DataView(tiff.buffer, tiff.byteOffset, tiff.byteLength);
  const u16 = (o: number) => dv.getUint16(o, le);
  const u32 = (o: number) => dv.getUint32(o, le);
  const readIfd = (off: number, into: Map<number, Entry>, depth = 0) => {
    if (off < 8 || off + 2 > tiff.length || depth > 2) return;
    const n = u16(off);
    for (let i = 0; i < n; i++) {
      const e = off + 2 + i * 12;
      if (e + 12 > tiff.length) break;
      const tag = u16(e);
      const type = u16(e + 2);
      const count = u32(e + 4);
      const size = SIZE[type];
      if (!size) continue;
      const total = size[0] * count;
      const at = total <= 4 ? e + 8 : u32(e + 8);
      if (at + total > tiff.length) continue;
      if (into === tags.ifd0 && (tag === POINTERS.exif || tag === POINTERS.gps)) {
        readIfd(u32(e + 8), tag === POINTERS.exif ? tags.exif : tags.gps, depth + 1);
        continue;
      }
      if (DROP.has(tag)) continue;
      const data = tiff.slice(at, at + total);
      // Store everything little-endian
      if (!le && size[1] > 1) for (let k = 0; k < data.length; k += size[1]) data.subarray(k, k + size[1]).reverse();
      into.set(tag, { type, count, data });
    }
  };
  readIfd(u32(4), tags.ifd0);
  return tags;
}

const latin = (b: Uint8Array) => {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(b);
  } catch {
    return new TextDecoder('latin1').decode(b);
  }
};

export function getText(tags: Tags, ifd: IfdName, tag: number): string | undefined {
  const e = tags[ifd].get(tag);
  if (!e) return undefined;
  if (e.type === 2) return latin(e.data).replace(/\0+$/, '').trim() || undefined;
  // Windows XP tags: UCS-2 little-endian in a BYTE array
  if (e.type === 1) return new TextDecoder('utf-16le').decode(e.data).replace(/\0+$/, '').trim() || undefined;
  return undefined;
}

const rationals = (e: Entry) => {
  const dv = new DataView(e.data.buffer, e.data.byteOffset, e.data.byteLength);
  return Array.from({ length: e.count }, (_, i) => dv.getUint32(i * 8, true) / (dv.getUint32(i * 8 + 4, true) || 1));
};

export function getGps(tags: Tags): { lat: number; lon: number } | null {
  const g = tags.gps;
  const lat = g.get(2);
  const lon = g.get(4);
  if (!lat || !lon || lat.type !== 5 || lon.type !== 5 || lat.count < 3 || lon.count < 3) return null;
  const dms = (v: number[]) => v[0] + v[1] / 60 + v[2] / 3600;
  const sign = (tag: number, neg: string) => (getText(tags, 'gps', tag)?.toUpperCase() === neg ? -1 : 1);
  return { lat: sign(1, 'S') * dms(rationals(lat)), lon: sign(3, 'W') * dms(rationals(lon)) };
}

/** "2024:05:06 07:08:09" → "2024-05-06T07:08:09" (the format the date picker uses) */
export function exifDateToLocal(s?: string): string | undefined {
  const m = s?.match(/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}` : undefined;
}
export const localToExifDate = (v: string) => v.replace(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?.*$/, (_, y, mo, d, h, mi, s) => `${y}:${mo}:${d} ${h}:${mi}:${s ?? '00'}`);

/** Moves an EXIF date by some minutes, keeping it a wall-clock time (no time zone involved) */
export function shiftExifDate(s: string, minutes: number): string {
  const local = exifDateToLocal(s);
  if (!local) return s;
  const [d, t] = local.split('T');
  const [y, mo, day] = d.split('-').map(Number);
  const [h, mi, se] = t.split(':').map(Number);
  const ms = Date.UTC(y, mo - 1, day, h, mi, se) + minutes * 60_000;
  const x = new Date(ms);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${x.getUTCFullYear()}:${p(x.getUTCMonth() + 1)}:${p(x.getUTCDate())} ${p(x.getUTCHours())}:${p(x.getUTCMinutes())}:${p(x.getUTCSeconds())}`;
}

/* ------------------------------------------------------------------ */
/* Editing                                                             */
/* ------------------------------------------------------------------ */

const ascii = (s: string): Entry => {
  const bytes = new TextEncoder().encode(`${s}\0`);
  return { type: 2, count: bytes.length, data: bytes };
};
const ucs2 = (s: string): Entry => {
  const data = new Uint8Array((s.length + 1) * 2);
  for (let i = 0; i < s.length; i++) {
    data[i * 2] = s.charCodeAt(i) & 255;
    data[i * 2 + 1] = s.charCodeAt(i) >> 8;
  }
  return { type: 1, count: data.length, data };
};
const rational = (values: [number, number][]): Entry => {
  const data = new Uint8Array(values.length * 8);
  const dv = new DataView(data.buffer);
  values.forEach(([n, d], i) => {
    dv.setUint32(i * 8, n, true);
    dv.setUint32(i * 8 + 4, d, true);
  });
  return { type: 5, count: values.length, data };
};

/** Sets a text tag; an empty value removes it */
export function setText(tags: Tags, ifd: IfdName, tag: number, value: string) {
  if (!value) tags[ifd].delete(tag);
  else tags[ifd].set(tag, tag === TAG.xpAuthor || tag === TAG.xpTitle ? ucs2(value) : ascii(value));
}

export function setGps(tags: Tags, pos: { lat: number; lon: number } | null) {
  tags.gps.clear();
  if (!pos) return;
  const dms = (v: number): [number, number][] => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const m = Math.floor((a - d) * 60);
    const s = Math.round(((a - d) * 60 - m) * 60 * 10000);
    return [
      [d, 1],
      [m, 1],
      [s, 10000],
    ];
  };
  tags.gps.set(0, { type: 1, count: 4, data: new Uint8Array([2, 3, 0, 0]) });
  tags.gps.set(1, ascii(pos.lat < 0 ? 'S' : 'N'));
  tags.gps.set(2, rational(dms(pos.lat)));
  tags.gps.set(3, ascii(pos.lon < 0 ? 'W' : 'E'));
  tags.gps.set(4, rational(dms(pos.lon)));
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/** A little-endian TIFF structure holding IFD0, and the Exif and GPS IFDs when they have entries */
export function writeTiff(tags: Tags): Uint8Array {
  const ifd0 = new Map(tags.ifd0);
  const hasExif = tags.exif.size > 0;
  const hasGps = tags.gps.size > 0;
  // Pointer placeholders; the real offsets are filled in below
  if (hasExif) ifd0.set(POINTERS.exif, { type: 4, count: 1, data: new Uint8Array(4) });
  else ifd0.delete(POINTERS.exif);
  if (hasGps) ifd0.set(POINTERS.gps, { type: 4, count: 1, data: new Uint8Array(4) });
  else ifd0.delete(POINTERS.gps);

  const ifds: [string, Map<number, Entry>][] = [['ifd0', ifd0]];
  if (hasExif) ifds.push(['exif', tags.exif]);
  if (hasGps) ifds.push(['gps', tags.gps]);

  // Layout: header, then each IFD (entries + next pointer) followed by its out-of-line values
  const sizeOf = (m: Map<number, Entry>) => {
    let n = 2 + m.size * 12 + 4;
    for (const e of m.values()) if (e.data.length > 4) n += e.data.length + (e.data.length & 1);
    return n;
  };
  const offsets: Record<string, number> = {};
  let at = 8;
  for (const [name, m] of ifds) {
    offsets[name] = at;
    at += sizeOf(m);
  }
  const out = new Uint8Array(at);
  const dv = new DataView(out.buffer);
  out.set([0x49, 0x49, 0x2a, 0x00]);
  dv.setUint32(4, 8, true);
  const ptr = (n: number) => {
    const d = new Uint8Array(4);
    new DataView(d.buffer).setUint32(0, n, true);
    return d;
  };
  if (hasExif) ifd0.set(POINTERS.exif, { type: 4, count: 1, data: ptr(offsets.exif) });
  if (hasGps) ifd0.set(POINTERS.gps, { type: 4, count: 1, data: ptr(offsets.gps) });

  for (const [name, m] of ifds) {
    const base = offsets[name];
    const entries = [...m.entries()].sort((a, b) => a[0] - b[0]);
    dv.setUint16(base, entries.length, true);
    let extra = base + 2 + entries.length * 12 + 4;
    entries.forEach(([tag, e], i) => {
      const p = base + 2 + i * 12;
      dv.setUint16(p, tag, true);
      dv.setUint16(p + 2, e.type, true);
      dv.setUint32(p + 4, e.count, true);
      if (e.data.length <= 4) out.set(e.data, p + 8);
      else {
        dv.setUint32(p + 8, extra, true);
        out.set(e.data, extra);
        extra += e.data.length + (e.data.length & 1);
      }
    });
    dv.setUint32(base + 2 + entries.length * 12, 0, true); // no next IFD (thumbnail dropped)
  }
  return out;
}

/**
 * Replaces the JPEG's Exif segment with `tiff` (or inserts one after SOI and a JFIF segment).
 * All other segments and the image data are copied byte for byte.
 */
export function replaceExif(jpeg: Uint8Array, tiff: Uint8Array): Uint8Array {
  if (tiff.length + 8 > 0xffff) throw new Error('exifTooLarge');
  const app1 = new Uint8Array(4 + 6 + tiff.length);
  app1.set([0xff, 0xe1, (app1.length - 2) >> 8, (app1.length - 2) & 255, 0x45, 0x78, 0x69, 0x66, 0, 0]);
  app1.set(tiff, 10);
  const parts: Uint8Array[] = [jpeg.subarray(0, 2)];
  let p = 2;
  let inserted = false;
  while (p + 4 <= jpeg.length && jpeg[p] === 0xff) {
    const marker = jpeg[p + 1];
    if (marker === 0xda) break;
    const len = (jpeg[p + 2] << 8) | jpeg[p + 3];
    const seg = jpeg.subarray(p, p + 2 + len);
    const isExif = marker === 0xe1 && String.fromCharCode(...jpeg.subarray(p + 4, p + 10)) === 'Exif\0\0';
    if (!inserted && marker !== 0xe0) {
      parts.push(app1);
      inserted = true;
    }
    if (!isExif) parts.push(seg);
    p += 2 + len;
  }
  if (!inserted) parts.push(app1);
  parts.push(jpeg.subarray(p));
  const total = parts.reduce((n, x) => n + x.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const x of parts) {
    out.set(x, o);
    o += x.length;
  }
  return out;
}
