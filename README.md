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
      tools/registry.ts   ★ 툴 목록(매니페스트) — 검색·홈·독이 모두 여기서 읽음
      tools/<분류>/*.tsx  각 툴의 React 컴포넌트
      i18n/               언어별 사전 (ko.ts 가 기준, en.ts·ja.ts 는 같은 구조)
      views/              HomePage.astro, ToolPage.astro — 모든 언어가 같이 쓰는 페이지 템플릿
      pages/              주소별 페이지 (한국어 `/…`, 영어·일본어 `/[lang]/…`) — 템플릿만 불러옴
      components/         헤더 검색, 설정 시트, 독, 공용 UI (DropZone, CopyButton, Select …)
      lib/                files.ts(ZIP·다운로드), metadata.ts, slots.ts, theme.ts, dock.ts
  api/                  (예정) 서버 처리가 꼭 필요한 툴용 백엔드
```

## 환경 변수

| 이름 | 용도 | 없으면 |
|---|---|---|
| `SITE_URL` | 사이트 전체 주소 (예: `https://example.com`). 다른 언어 페이지 주소(`hreflang`)·대표 주소(`canonical`)를 만든다 | 상대 주소로 대신 (개발용으로는 충분) |

도메인은 코드에 쓰지 않는다. 빌드하는 곳에서 넣는다.

- 내 PC: `apps/web/.env.example` 을 `apps/web/.env` 로 복사해서 값 수정 (`.env` 는 git 에 안 올라감)
- GitHub Actions: 저장소 Settings → Secrets and variables → Actions → **Variables** 에 `SITE_URL`
- Docker: `docker build --build-arg SITE_URL=https://… .` (Dockerfile 에서 `ARG SITE_URL` → 빌드 시 환경 변수로)

## 언어

한국어(`/`), English(`/en/`), 日本語(`/ja/`). 언어마다 정적 페이지가 따로 만들어진다.

- 브라우저 언어가 페이지 언어와 다르면 상단에 **"이 페이지를 ○○로도 볼 수 있어요"** 제안 배너를 띄운다. 자동으로 이동시키지는 않는다 — 검색엔진 로봇(대부분 영어)이 항상 다른 언어로 넘어가 한국어·일본어 페이지가 수집되지 않기 때문 (Google 권장 방식).
- 설정이나 배너에서 고른 언어는 브라우저에 저장되고, 다른 언어 주소로 들어오면 고른 언어 주소로 옮겨진다 (로봇은 저장값이 없으므로 영향 없음).

## 새 툴 추가하기

1. `src/tools/registry.ts` 에 항목 추가
2. `src/i18n/ko.ts`, `en.ts`, `ja.ts` 의 `tools` 에 이름·설명 추가 (빠지면 타입 오류)
   → `status: 'soon'` 이면 여기서 끝. 준비 중 화면이 세 언어로 자동 생성됨
3. `src/tools/<분류>/MyTool.tsx` 컴포넌트 작성
   - 문구는 사전에 넣고 `useT()` 로 꺼내 쓴다. 컴포넌트는 `export default withI18n(MyTool)` 로 내보낸다.
4. `src/views/ToolPage.astro` 의 "툴 화면 연결"에 한 줄 추가:
   ```astro
   {slug === 'my-tool' && <MyTool client:load lang={lang} />}
   ```
   현재 시각·랜덤 값·브라우저 정보를 처음 화면에 그리는 툴은 `client:only="react"` 를 쓴다 (서버 렌더 결과와 달라지는 문제 방지).
5. registry 의 `status` 를 `'ready'` 로 변경

## 키보드

- `Ctrl K` 또는 `/` : QuickSlot 검색
- `Alt 1~9` : 퀵슬롯에 등록한 툴 열기

## 기여하기

브랜치·커밋·PR 규칙은 [AGENTS.md](AGENTS.md) 에 있습니다 (사람과 AI 에이전트 공통).

## 라이선스

[MIT](LICENSE)
