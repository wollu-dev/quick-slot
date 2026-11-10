// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The site URL is not hard-coded; it comes from the SITE_URL environment variable at build time.
 *  - Locally: the apps/web/.env file (see .env.example; not committed to git)
 *  - GitHub:  SITE_URL under the repo's Settings → Secrets and variables → Actions → Variables
 *  - Docker:  docker build --build-arg SITE_URL=https://…
 * If it is missing, alternate-language (hreflang) and canonical URLs fall back to relative URLs (fine for development).
 */
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const site = SITE_URL?.trim() || undefined;

if (site) {
  const u = new URL(site); // An invalid URL stops the build here
  if (!/^https?:$/.test(u.protocol)) throw new Error(`SITE_URL must be an http(s) URL: ${site}`);
} else if (process.argv.includes('build')) {
  console.warn('[quickslot] SITE_URL is not set, so hreflang/canonical URLs will be relative. Set SITE_URL for production builds.');
}

// https://astro.build/config
export default defineConfig({
  site,
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
    // These ship their own workers and WebAssembly files; pre-bundling them breaks the relative URLs
    optimizeDeps: { exclude: ['@ffmpeg/ffmpeg', '@ffmpeg/util', '@jsquash/avif'] },
  },
});
