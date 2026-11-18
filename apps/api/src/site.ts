/**
 * Serves the built website (apps/web/dist) from the same server as the API, so one container runs everything.
 * Used only when SITE_DIR is set (the Docker image sets it); in development Astro's dev server does this.
 *
 * - `/tools/qr-code`, `/tools/qr-code/` and `/tools/qr-code.html` all find the page, like a static host would
 * - hashed build files (`/_astro/`, `/pdfjs/`) are cached for a year, everything else is revalidated (ETag)
 * - text files are compressed; nothing outside the folder can be reached
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { join, normalize, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import type { Context } from 'hono';
import { getMimeType } from 'hono/utils/mime';

/** Security headers for the site. Camera, microphone and screen are used by the recorder tools. */
export const SITE_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(self), microphone=(self), display-capture=(self), geolocation=()',
};

const IMMUTABLE = ['/_astro/', '/pdfjs/'];
export const COMPRESSIBLE = /^(text\/|application\/(javascript|json|manifest\+json|wasm|xml)|image\/svg\+xml)/;

async function file(path: string) {
  try {
    const s = await stat(path);
    return s.isFile() ? s : null;
  } catch {
    return null;
  }
}

/** The file for a URL path, or null. Never leaves `root`. */
async function find(root: string, urlPath: string) {
  let decoded: string;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const base = resolve(root, '.' + normalize('/' + decoded));
  if (base !== root && !base.startsWith(root + sep)) return null;
  const candidates = decoded.endsWith('/') ? [join(base, 'index.html')] : [base, join(base, 'index.html'), base + '.html'];
  for (const path of candidates) {
    const s = await file(path);
    if (s) return { path, size: s.size, mtime: s.mtime };
  }
  return null;
}

export function serveSite(dir: string) {
  const root = resolve(dir);
  return async (c: Context) => {
    const found = await find(root, new URL(c.req.url).pathname);
    if (!found) return c.text('Not found', 404, SITE_HEADERS);

    const pathname = new URL(c.req.url).pathname;
    const etag = `"${found.size.toString(36)}-${found.mtime.getTime().toString(36)}"`;
    const headers: Record<string, string> = {
      ...SITE_HEADERS,
      'Content-Type': getMimeType(found.path) ?? 'application/octet-stream',
      'Cache-Control': IMMUTABLE.some((p) => pathname.startsWith(p)) ? 'public, max-age=31536000, immutable' : 'no-cache',
      ETag: etag,
      'Last-Modified': found.mtime.toUTCString(),
    };
    const match = c.req.header('if-none-match');
    if (match && match.split(',').some((t) => t.trim().replace(/^W\//, '') === etag)) return c.body(null, 304, headers);
    headers['Content-Length'] = String(found.size);
    if (c.req.method === 'HEAD') return c.body(null, 200, headers);
    return c.body(Readable.toWeb(createReadStream(found.path)) as ReadableStream, 200, headers);
  };
}
