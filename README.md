# QuickSlot

설치 없이 브라우저에서 바로 쓰는 생활·개발 도구 모음.
기본 원칙은 **파일이 사용자의 PC를 떠나지 않는 것**(모든 처리를 브라우저에서).

## 실행

```bash
npm install
npm run dev      # 개발 서버 (http://localhost:4321)
npm run build    # 정적 사이트 빌드 → apps/web/dist
npm run check    # 타입 검사
```

## 구조

```
apps/
  web/                  프론트엔드 (Astro + React + Tailwind)
    src/
      tools/registry.ts   ★ 툴 목록(매니페스트) — 검색·홈·퀵슬롯이 모두 여기서 읽음
      tools/<분류>/*.tsx  각 툴의 React 컴포넌트
      pages/tools/*.astro 툴별 페이지 (SEO용 정적 HTML)
      pages/tools/[slug].astro  status:'soon' 툴의 "준비 중" 페이지 자동 생성
      components/         검색 팔레트, 퀵슬롯, 공용 UI (DropZone, CopyButton)
      lib/                files.ts(ZIP·다운로드), metadata.ts(메타데이터 제거), slots.ts
  api/                  (예정) 서버 처리가 꼭 필요한 툴용 백엔드
```

## 새 툴 추가하기

1. `src/tools/registry.ts` 에 항목 추가 (`status: 'soon'` 이면 여기서 끝, 준비 중 페이지가 자동 생성됨)
2. `src/tools/<분류>/MyTool.tsx` 컴포넌트 작성
3. `src/pages/tools/<slug>.astro` 생성:
   ```astro
   ---
   import ToolLayout from '../../layouts/ToolLayout.astro';
   import MyTool from '../../tools/dev/MyTool';
   ---
   <ToolLayout slug="my-tool"><MyTool client:load /></ToolLayout>
   ```
   현재 시각·랜덤 값을 처음 화면에 그리는 툴은 `client:only="react"` 를 쓴다 (서버 렌더 결과와 달라지는 문제 방지).
4. registry 의 `status` 를 `'ready'` 로 변경

## 키보드

- `Ctrl K` 또는 `/` : QuickSlot 검색
- `Alt 1~9` : 퀵슬롯에 등록한 툴 열기

## 기여하기

브랜치·커밋·PR 규칙은 [AGENTS.md](AGENTS.md) 에 있습니다 (사람과 AI 에이전트 공통).

## 라이선스

[MIT](LICENSE)
