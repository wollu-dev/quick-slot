// @ts-check
import { cpSync, existsSync, readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Serves the data files pdf.js loads at run time (character maps for CJK text, standard fonts,
 * image decoder WebAssembly, ICC profiles) from this site, never from a CDN.
 * The folder carries the pdf.js version, so a new version never mixes with cached old files.
 * In development they are served straight from node_modules; on build they are copied into the output.
 */
const require = createRequire(import.meta.url);
const root = dirname(require.resolve('pdfjs-dist/package.json'));
const { version } = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const DIRS = ['cmaps', 'standard_fonts', 'wasm', 'iccs'];
/** The scripting engine (QuickJS) is only for PDF forms with JavaScript, which these tools don't run */
const SKIP = /quickjs/i;

export const PDFJS_BASE = `/pdfjs/${version}/`;

/** @type {Record<string, string>} */
const TYPES = { '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream', '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.js': 'text/javascript', '.icc': 'application/vnd.iccprofile' };

/** @returns {import('astro').AstroIntegration} */
export default function pdfjsAssets() {
  return {
    name: 'quickslot:pdfjs-assets',
    hooks: {
      'astro:config:setup': ({ updateConfig }) => {
        // The base path reaches client code as a constant
        updateConfig({ vite: { define: { 'import.meta.env.PUBLIC_PDFJS_BASE': JSON.stringify(PDFJS_BASE) } } });
      },
      'astro:server:setup': ({ server }) => {
        server.middlewares.use((req, res, next) => {
          const url = req.url?.split('?')[0] ?? '';
          if (!url.startsWith(PDFJS_BASE)) return next();
          const rel = normalize(decodeURIComponent(url.slice(PDFJS_BASE.length)));
          const [dir] = rel.split(sep);
          const file = join(root, rel);
          if (!DIRS.includes(dir) || SKIP.test(rel) || !file.startsWith(root + sep) || !existsSync(file) || !statSync(file).isFile()) return next();
          res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
          res.end(readFileSync(file));
        });
      },
      'astro:build:done': ({ dir }) => {
        const out = join(fileURLToPath(dir), 'pdfjs', version);
        for (const d of DIRS) cpSync(join(root, d), join(out, d), { recursive: true, filter: (src) => !SKIP.test(src) });
      },
    },
  };
}
