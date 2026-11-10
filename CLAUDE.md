# QuickSlot

README.md 에 구조와 툴 추가 방법이 있다. 요점:

- npm workspaces 모노레포. 프론트는 `apps/web` (Astro 7 + React 19 islands + Tailwind 4), 백엔드 `apps/api` 는 아직 없음.
- 툴의 단일 진실 공급원은 `apps/web/src/tools/registry.ts`. 툴 추가·상태 변경은 여기부터.
- 원칙: 툴은 기본적으로 브라우저 안에서만 처리(`processing: 'client'`). 서버가 필요한 툴만 `'server'` 로 표시.
- UI 문구는 한국어. 색은 global.css 의 `@theme` 토큰(bg, panel, line, fg, muted, accent, danger, ok)만 사용.
- 변경 후 `npm run check` 와 `npm run build` 로 확인.
- 개발 서버는 백그라운드로: `npx astro dev --background` (apps/web 에서), 중지는 `npx astro dev stop`.
