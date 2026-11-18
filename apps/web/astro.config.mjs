// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import react from '@astrojs/react';
import pdfjsAssets from './integrations/pdfjs-assets.mjs';
import tailwindcss from '@tailwindcss/vite';

/**
 * The site URL is not hard-coded; it comes from the SITE_URL environment variable at build time.
 *  - Locally: the apps/web/.env file (see .env.example; not committed to git)
 *  - GitHub:  SITE_URL under the repo's Settings → Secrets and variables → Actions → Variables
 *  - Docker:  the SITE_URL environment variable of the web container (it rebuilds the site at start)
 * If it is missing, alternate-language (hreflang) and canonical URLs fall back to relative URLs (fine for development).
 */
const env = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const { SITE_URL } = env;
const site = SITE_URL?.trim() || undefined;

if (site) {
  const u = new URL(site); // An invalid URL stops the build here
  if (!/^https?:$/.test(u.protocol)) throw new Error(`SITE_URL must be an http(s) URL: ${site}`);
} else if (process.argv.includes('build')) {
  console.warn('[quickslot] SITE_URL is not set, so hreflang/canonical URLs will be relative. Set SITE_URL for production builds.');
}

/**
 * Tools to leave out of this build (HIDE_TOOLS) or the only ones to keep (SHOW_TOOLS): comma-separated tool
 * slugs or category ids, e.g. HIDE_TOOLS=video-downloader,server-time or SHOW_TOOLS=pdf,image. Applied in
 * src/tools/registry.ts. The Docker web image rebuilds the site when these change (deploy/web-entrypoint.sh).
 */
const names = (/** @type {string | undefined} */ v) => (v ?? '').split(',').map((s) => s.trim()).filter(Boolean);
const toolFilter = { hide: names(env.HIDE_TOOLS), show: names(env.SHOW_TOOLS) };

// https://astro.build/config
export default defineConfig({
  site,
  integrations: [react(), pdfjsAssets()],

  vite: {
    plugins: [tailwindcss()],
    define: { __TOOL_FILTER__: JSON.stringify(toolFilter) },
    // These ship their own workers and WebAssembly files; pre-bundling them breaks the relative URLs
    optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@jsquash/avif', '@jsquash/jpeg', '@jsquash/oxipng', '@jsquash/webp'] },
    // Our own workers load codecs with dynamic import(), which needs ES module workers
    worker: { format: 'es' },
    // In development, /api goes to the API server (npm run dev:api); in production nginx does the same
    server: { proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 8787}`, changeOrigin: false } } },
    preview: { proxy: { '/api': { target: `http://localhost:${process.env.API_PORT || 8787}`, changeOrigin: false } } },
  },
});
