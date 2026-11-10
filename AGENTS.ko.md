# AGENTS.md (한국어)

[English](AGENTS.md) · **한국어** · [日本語](AGENTS.ja.md)

> 이 문서는 [AGENTS.md](AGENTS.md)(영어)의 번역입니다. **기준은 영어 원본**이며, 내용이 다르면 원본을 따릅니다.

이 저장소에서 작업하는 모든 사람과 AI 에이전트(Claude Code, Codex, Cursor, Gemini, Copilot 등)를 위한 공통 규칙입니다.
도구별 파일(`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`)은 `AGENTS.md` 를 가리키기만 합니다. **규칙은 `AGENTS.md` 에만 씁니다.**

## 프로젝트

QuickSlot: 브라우저에서 바로 쓰는 생활·개발 도구 모음. 구조와 툴 추가 방법은 [README.ko.md](README.ko.md) 참고.

- npm workspaces 모노레포. 웹사이트는 `apps/web` (Astro 7 + React 19 islands + Tailwind 4). 백엔드(`apps/api`)는 아직 없음.
- 툴의 단일 진실 공급원은 `apps/web/src/tools/registry.ts`. 툴 추가·상태 변경은 여기부터.
- 원칙: 툴은 기본적으로 모든 처리를 브라우저 안에서 한다(`processing: 'client'`). 서버 없이는 정말 안 되는 툴만 `'server'` 로 하고, 그 전에 브라우저용 엔진(WebAssembly)으로 가능한지 먼저 확인한다. *모든* 툴이 기기 안에서 처리된다고 약속하는 문구는 쓰지 않고, 처리 위치는 툴마다 설명한다.
- 서버 툴은 반드시: 서버 배지와 구름 아이콘을 표시하고(`processing` 으로 자동), 드롭 영역의 "기기 안에서 처리" 문구를 "업로드 후 처리 직후 삭제" 문구로 바꾸고, 처음 업로드하기 전에 확인을 받고, 파일을 저장하거나 내용을 로그로 남기지 않으며 결과를 돌려준 즉시 삭제하고, 출시 전에 개인정보 처리방침 페이지에 내용을 적는다.
- 내 도구(`lib/customTools.ts`)는 사용자가 직접 추가하는 외부 사이트 링크다. 브라우저에만 저장하고, http(s) 주소만 받으며, 외부 도구 경고(`ExternalToolWarning`)를 거친 뒤 `noopener,noreferrer` 로 새 탭에서 연다. 그 사이트에서 아무것도 불러오지 않는다(파비콘, 미리보기, iframe 금지).
- 무거운 엔진(ffmpeg.wasm, HEIC·AVIF 코덱 같은 WebAssembly)은 필요할 때만 동적 `import()` 로 불러오고, CDN 이 아니라 이 사이트에서 직접 제공한다.
- 파일 변환은 확장자와 내용이 다른 파일을 절대 만들지 않는다. 실제 형식은 바이트로 판단하고(`lib/convert/formats.ts`), 형식이 같을 때만 이름을 바꾸며, 변환할 수 없는 것은 거절한다.

## 저장소에서 쓰는 언어

| 대상 | 언어 |
|---|---|
| 코드, 식별자, 주석, 개발자용 메시지(빌드 경고, 오류 메시지) | **영어** |
| 커밋 메시지, PR 제목·본문, 브랜치 이름 | **영어** |
| 문서(`README`, `AGENTS`) | **영어가 원본**(`*.md`), 한국어(`*.ko.md`)·일본어(`*.ja.md`) 번역 |
| 사용자에게 보이는 UI 문구 | 한국어·영어·일본어, i18n 사전으로 (아래 참고) |

- `README.md` 나 `AGENTS.md` 를 바꾸면 `.ko.md`·`.ja.md` 번역도 **같은 PR 에서** 고쳐서 내용이 어긋나지 않게 한다.
- 제품 데이터인 한국어는 코드에 있어도 된다: 한국어 사전 `i18n/ko.ts`, `registry.ts` 의 한국어 검색 `keywords`.
- 문서, 커밋 메시지, PR 설명은 담백하고 직접적인 문장으로 쓴다. 대시(—)는 되도록 쓰지 않고 마침표·쉼표·콜론·괄호로 대신한다.

## 다국어 (한국어 · English · 日本語)

- **UI 문구를 코드에 직접 쓰지 않는다.** 모든 문구는 `apps/web/src/i18n/ko.ts` 에 먼저 넣고, `en.ts`·`ja.ts` 에 같은 키로 번역한다 (키가 빠지면 타입 오류). React 에서는 `useT()`, `.astro` 에서는 `getDict(lang)`.
- 문구 안 강조는 `**굵게**`, `` `코드` `` 로 쓰고 `<Rich>` 로 그린다. 문장을 조각내서 이어 붙이지 않는다 (언어마다 어순이 다름).
- 숫자·날짜는 `LANG_TAGS[lang]` 로 지역 형식에 맞춘다. 숫자가 들어가는 문구는 사전에 함수로 둔다 (예: `summary: (n) => …`).
- 라이브러리(`lib/`)는 문구 대신 코드를 돌려주고 화면에서 번역한다 (예: `metadata.ts` 의 `ItemKind`, `MetadataError.code`).
- 내부 링크는 `localizePath(lang, path)` / `toolUrl(slug, lang)` 로 만든다. `/tools/…` 를 직접 쓰지 않는다.
- React 섬(island) 최상위 컴포넌트는 `withI18n` 으로 감싸고, Astro 에서 `lang={lang}` 을 넘긴다.
- **브라우저 언어로 자동 이동시키지 않는다.** 그러면 검색엔진이 다른 언어 페이지를 수집하지 못한다. `LanguageSuggest` 배너는 언어를 "제안"만 하고, 이동은 사용자가 직접 고른 언어(`quickslot:lang` 저장값)가 있을 때만 한다. 로봇에게만 다르게 보여주지 않는다 (User-Agent 판별 금지).

## 배포

- **배포 방식: Docker 이미지 → GitHub Container Registry(`ghcr.io`) → 직접 호스팅.** 다른 호스팅(GitHub Pages, Vercel, Netlify, Cloudflare Pages 등)은 쓰지 않으므로 제안하거나 설정하지 않는다.
- **현재 상태: 아직 만들지 않음.** 서비스가 완성 단계에 가까워지면 만든다. 그 전에 `Dockerfile` 이나 이미지 게시 워크플로를 추가하지 않는다. 지금 자동화는 CI(`.github/workflows/ci.yml`: 타입 검사·빌드)뿐이다.
- 만들 때의 방향: 2단계 `Dockerfile` (Node 로 빌드 → nginx 에 정적 결과물만 담기), 사이트 주소는 `ARG SITE_URL`. 이미지 게시는 `main` 머지마다가 아니라 **버전 태그(`v*`)를 push 할 때만**.
- **도메인·주소를 코드에 쓰지 않는다.** 사이트 주소는 빌드 환경 변수 `SITE_URL` 로만 받는다 (`astro.config.mjs` → `Astro.site`). 전체 주소가 필요하면 `Astro.site` 를 쓰고, 없을 때는 상대 주소로 동작하게 만든다.
- 프로젝트 링크(GitHub 저장소)와 작성자는 루트 `package.json` 의 `repository`, `author` 에서 가져온다. 화면 코드에 주소를 쓰지 말고 `apps/web/src/lib/project.ts` 로 읽는다.
- 환경 변수를 추가하면 `apps/web/.env.example` 과 README 의 "설정(Configuration)" 표(세 언어 모두)에도 적는다.

## 디자인 규칙

무채색 배경 위의 반투명 유리 표면. 기준은 `apps/web/src/styles/global.css`.

- **설정**: 헤더 오른쪽 톱니바퀴 → 설정 시트(`SettingsSheet`, iOS 설정 같은 묶음 목록): 화면 모드 · 퀵슬롯 위치/크기 · 언어. 사용자 설정은 여기에만 모은다.
- **첫 화면 전에 적용**: 테마(`data-theme`), 독 위치·크기(`data-dock`, `data-dock-size`), 언어 이동은 `Layout.astro` 의 `<head>` 인라인 스크립트가 그리기 전에 한다. 이후 변경은 `src/lib/theme.ts`, `src/lib/dock.ts`, `src/i18n` 에서 한다. **저장 키·기본값을 양쪽 같이 고칠 것.**
- **테마**: 라이트 / 다크 / 자동(기본). 적용은 `<html data-theme="light|dark">` 로만. CSS 에 `@media (prefers-color-scheme)` 를 쓰지 말고, 다크 스타일은 `[data-theme="dark"]` 토큰이나 Tailwind `dark:` 변형으로.
- **독**: 배치·크기·확대 효과는 `global.css` 의 `.dock*` 규칙이 `html[data-dock]` 을 보고 정한다. 640px 미만에서는 설정과 상관없이 아래에 작게. 독에 가려지면 안 되는 페이지 맨 아래 요소에는 `.dock-safe`.
- **배경**: `global.css` 의 `body::before` 로만 그린다: 무채색 위→아래 명암(`bg-top` → `bg-bottom`) + 고운 노이즈 질감. 색이 들어간 그라데이션·색 번짐·패턴은 넣지 않는다. 페이지마다 배경을 따로 깔지 않는다.
- **색**: 토큰만 사용: `bg`, `panel`, `panel-2`, `line`, `fg`, `muted`, `accent`, `accent-fg`, `danger`, `ok`. 하드코딩 색 금지 (예외: `registry.ts` 의 카테고리 타일 색, 설정의 화면 모드 미리보기).
- **표면**: 카드·패널은 `panel`(= `glass` + 둥근 모서리), 검색 창은 `glass-strong`, 글을 읽어야 하는 떠 있는 창(메뉴, 설정 시트)은 `glass-menu`(더 불투명). 넓은 `textarea.input` 은 자동으로 유리 표면이 된다.
- **컨트롤**: 버튼 `btn` / `btn-primary` / `btn-tinted`, 입력 `input`, 라벨 `label`. 선택지 2~3개는 `Segmented`, 그 이상은 `Select` 컴포넌트. **브라우저 기본 `<select>` 는 쓰지 않는다** (펼친 목록을 꾸밀 수 없음). 마찬가지로 날짜·시간은 `DateTimePicker`, 숫자는 `NumberField` 를 쓰고 `<input type="datetime-local">` · `type="number"` 는 쓰지 않는다 (팝업과 화살표를 꾸밀 수 없고 사이트 언어를 따르지 않음). 체크박스는 CSS 로 자동으로 스위치 모양이 된다.
- **텍스트 입력·출력 영역**: `TextPanel` 컴포넌트를 쓴다 (위쪽 머리 줄에 제목과 버튼, 그 아래 텍스트 영역). 복사 같은 버튼을 텍스트 영역 위에 띄우지 않는다. 긴 글이 버튼 밑으로 지나가며 겹친다.
- **높이**: 한 줄짜리 컨트롤(버튼, 입력, `Select`, `Segmented`)은 모두 36px(`h-9`).
- **아이콘**: `lucide-react` 선 아이콘만. **이모지를 UI 아이콘으로 쓰지 않는다.** 툴 아이콘은 `AppIcon` (카테고리 색 타일).
- **모서리**: 카드 22px, 큰 영역 26px, 버튼·뱃지는 완전히 둥글게(pill). `rounded-sm/md/lg` 같은 각진 모서리는 쓰지 않는다.
- **주의**: `backdrop-filter` 가 걸린 요소 안의 `position: fixed` 자식은 화면이 아니라 그 요소 기준으로 배치된다. 모달·오버레이는 `createPortal(…, document.body)` 로 띄운다.
- **레이아웃**: 헤더는 왼쪽 로고, 오른쪽 검색과 설정. 퀵슬롯 독(`Dock`)은 모든 페이지에 고정. 페이지마다 검색을 여는 버튼을 따로 만들지 않는다. 검색 관련 문구는 사전 키 `header.search` 하나로.
- **정렬**: 본문은 카드 그리드의 왼쪽 선에 맞춘다. 가운데 정렬된 요소를 세로로 여러 개 쌓지 않는다 (아래로 갈수록 넓어지는 피라미드가 됨).
- **그리드**: 카드 그리드에는 열 수를 명시한다 (예: `grid-cols-1`. 안 하면 모바일에서 긴 글이 화면 밖으로 넘침).
- 변경 후 라이트·다크, 모바일 폭(390px), 세 언어(특히 문구가 긴 영어·일본어)에서 확인한다.

## 명령어

```bash
npm install
npm run check    # 타입 검사 (변경 후 반드시 실행)
npm run build    # 빌드 (변경 후 반드시 실행)
npm run dev      # 개발 서버 (http://localhost:4321)
```

에이전트가 개발 서버를 띄울 때는 백그라운드로: `apps/web` 에서 `npx astro dev --background`, 중지는 `npx astro dev stop`.

## Git 워크플로 (GitHub Flow)

- `main` 은 항상 배포 가능한 상태. **`main` 에 직접 커밋·push 하지 않는다.** 모든 변경은 브랜치 → PR → squash merge.
- 작업 전 최신 `main` 에서 브랜치를 만든다. 브랜치 하나에 작업 하나(툴 하나).
- 머지된 브랜치는 삭제한다.
- PR 은 하나씩 머지하고, 새 작업은 갱신된 `main` 에서 시작한다. PR 위에 PR 을 쌓으면 squash merge 후 충돌이 난다.

### 브랜치 이름: `종류/짧은-설명`

| 접두사 | 용도 | 예시 |
|---|---|---|
| `feat/` | 새 툴, 새 기능 | `feat/qr-code` |
| `fix/` | 버그 수정 | `fix/heic-orientation` |
| `refactor/` | 동작 변화 없는 구조 개선 | `refactor/dropzone` |
| `docs/` | 문서 | `docs/contributing` |
| `chore/` | 설정, 의존성, CI | `chore/ci-build` |

- 소문자와 하이픈(-)만.
- 툴 브랜치는 `registry.ts` 의 slug 와 맞춘다 (`feat/qr-code` ↔ slug `qr-code`).

### 커밋 메시지: Conventional Commits

```
<type>(<scope>): <summary>

<body: 무엇을, 왜 (선택)>
```

- 종류: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`
- 범위(선택): 툴 slug 나 영역. 예: `feat(qr-code): add QR code generator`, `fix(json-formatter): fix error position calculation`
- 요약은 **영어**, 명령형, 50자 이내, 마침표 없음.

### PR

- 제목은 커밋 메시지 형식과 같게 (squash merge 시 그대로 커밋 제목이 됨).
- 본문에 무엇을 바꿨는지, 어떻게 확인했는지(실행한 명령, 확인한 화면)를 적는다.
- CI(`check`, `build`)가 통과해야 머지할 수 있다.
