/**
 * Shared PDF helpers: pdf-lib edits documents (merge, split, reorder),
 * pdf.js renders page thumbnails. Both are loaded only when a PDF tool needs them.
 */
import type { PDFDocumentProxy } from 'pdfjs-dist';

export type PdfErrorCode = 'encrypted' | 'corrupt' | 'notPdf';
export class PdfError extends Error {
  constructor(public code: PdfErrorCode) {
    super(code);
  }
}

const isPdf = (b: Uint8Array) => {
  // "%PDF-" may be preceded by a little junk; readers accept it within the first 1 KB
  const head = new TextDecoder('latin1').decode(b.subarray(0, 1024));
  return head.includes('%PDF-');
};

export interface PdfInfo {
  pages: number;
  /** Page sizes in points, for layout and labels */
  sizes: { width: number; height: number }[];
}

/** Checks a PDF with pdf-lib: page count, and whether it can be edited at all (encrypted files can't) */
export async function inspectPdf(bytes: Uint8Array): Promise<PdfInfo> {
  if (!isPdf(bytes)) throw new PdfError('notPdf');
  const { PDFDocument } = await import('pdf-lib');
  let doc;
  try {
    // Open even encrypted files, only to tell them apart from damaged ones (pdf-lib's error class can't be checked with instanceof)
    doc = await PDFDocument.load(bytes, { updateMetadata: false, ignoreEncryption: true });
  } catch {
    throw new PdfError('corrupt');
  }
  if (doc.isEncrypted) throw new PdfError('encrypted');
  return { pages: doc.getPageCount(), sizes: doc.getPages().map((p) => p.getSize()) };
}

export interface PdfPart {
  bytes: Uint8Array;
  /** 0-based page indexes in output order */
  pages: number[];
  /** Extra clockwise rotation per page, in degrees (multiples of 90) */
  rotate?: number[];
}

/** Builds one PDF from pages of several (or one) source documents */
export async function buildPdf(parts: PdfPart[]): Promise<Uint8Array> {
  const { PDFDocument, degrees } = await import('pdf-lib');
  const out = await PDFDocument.create();
  for (const part of parts) {
    const src = await PDFDocument.load(part.bytes, { updateMetadata: false });
    const copied = await out.copyPages(src, part.pages);
    copied.forEach((page, i) => {
      const extra = part.rotate?.[i] ?? 0;
      if (extra) page.setRotation(degrees((page.getRotation().angle + extra) % 360));
      out.addPage(page);
    });
  }
  out.setProducer('QuickSlot');
  out.setCreator('QuickSlot');
  return out.save({ useObjectStreams: true });
}

/* ------------------------------------------------------------------ */
/* Page ranges                                                         */
/* ------------------------------------------------------------------ */

export type PageRangeError = { code: 'syntax' | 'outOfRange'; token: string };

/**
 * Parses "1-3, 5, 8-" (1-based, inclusive; "8-" means to the end, "-3" from the start) into 0-based indexes.
 * Order and repeats are kept as written. Empty input means every page.
 */
export function parseRanges(text: string, total: number): { pages: number[] } | { error: PageRangeError } {
  const t = text.trim();
  if (!t) return { pages: Array.from({ length: total }, (_, i) => i) };
  const pages: number[] = [];
  for (const raw of t.split(/[,，、]/)) {
    const token = raw.trim();
    if (!token) continue;
    const m = token.match(/^(\d*)\s*[-–~]\s*(\d*)$/);
    if (m) {
      const a = m[1] ? Number(m[1]) : 1;
      const b = m[2] ? Number(m[2]) : total;
      if (!m[1] && !m[2]) return { error: { code: 'syntax', token } };
      if (a < 1 || b < 1 || a > total || b > total) return { error: { code: 'outOfRange', token } };
      const step = a <= b ? 1 : -1;
      for (let p = a; p !== b + step; p += step) pages.push(p - 1);
    } else if (/^\d+$/.test(token)) {
      const p = Number(token);
      if (p < 1 || p > total) return { error: { code: 'outOfRange', token } };
      pages.push(p - 1);
    } else return { error: { code: 'syntax', token } };
  }
  return { pages };
}

/* ------------------------------------------------------------------ */
/* Thumbnails (pdf.js)                                                 */
/* ------------------------------------------------------------------ */

/** Where the pdf.js data files are served (see integrations/pdfjs-assets.mjs) */
const BASE: string = import.meta.env.PUBLIC_PDFJS_BASE;

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | undefined;
function pdfjs() {
  pdfjsReady ??= Promise.all([import('pdfjs-dist'), import('pdfjs-dist/build/pdf.worker.min.mjs?url')]).then(([lib, worker]) => {
    lib.GlobalWorkerOptions.workerSrc = worker.default;
    return lib;
  });
  return pdfjsReady;
}

export interface RenderDoc {
  doc: PDFDocumentProxy;
  /** Frees the document and its worker */
  close: () => Promise<void>;
}

/** Opens a PDF for rendering. The bytes are copied, because pdf.js hands its buffer to a worker. */
export async function openForRender(bytes: Uint8Array): Promise<RenderDoc> {
  const lib = await pdfjs();
  const task = lib.getDocument({
    data: bytes.slice(),
    cMapUrl: `${BASE}cmaps/`,
    cMapPacked: true,
    standardFontDataUrl: `${BASE}standard_fonts/`,
    wasmUrl: `${BASE}wasm/`,
    iccUrl: `${BASE}iccs/`,
    enableXfa: false,
  });
  return { doc: await task.promise, close: () => task.destroy() };
}

/** Renders one page (1-based) to a PNG blob about `width` pixels wide */
export async function renderPage(doc: PDFDocumentProxy, pageNo: number, width: number): Promise<Blob> {
  const page = await doc.getPage(pageNo);
  const base = page.getViewport({ scale: 1 });
  const viewport = page.getViewport({ scale: width / base.width });
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(viewport.width));
  canvas.height = Math.max(1, Math.round(viewport.height));
  await page.render({ canvas, viewport }).promise;
  page.cleanup();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('render'))), 'image/png'));
}
