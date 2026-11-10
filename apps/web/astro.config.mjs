// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';

/**
 * 사이트 주소는 코드에 쓰지 않고 빌드할 때 환경 변수 SITE_URL 로 받는다.
 *  - 내 PC:   apps/web/.env 파일 (.env.example 참고, git 에는 안 올라감)
 *  - GitHub:  저장소 Settings → Secrets and variables → Actions → Variables 의 SITE_URL
 *  - Docker:  docker build --build-arg SITE_URL=https://…
 * 없으면 다른 언어 페이지 주소(hreflang)·대표 주소(canonical)를 상대 주소로 대신 쓴다 (개발용으로는 충분).
 */
const { SITE_URL } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const site = SITE_URL?.trim() || undefined;

if (site) {
  const u = new URL(site); // 형식이 틀리면 여기서 빌드를 멈춘다
  if (!/^https?:$/.test(u.protocol)) throw new Error(`SITE_URL 은 http(s) 주소여야 합니다: ${site}`);
} else if (process.argv.includes('build')) {
  console.warn('[quickslot] SITE_URL 이 없어서 hreflang·canonical 을 상대 주소로 만듭니다. 배포 빌드에서는 SITE_URL 을 넣어 주세요.');
}

// https://astro.build/config
export default defineConfig({
  site,
  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },
});
