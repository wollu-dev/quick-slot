# AGENTS.md

이 저장소에서 작업하는 모든 AI 에이전트(Claude Code, Codex, Cursor, Gemini, Copilot 등)와 사람을 위한 공통 규칙이다.
도구별 설정 파일(`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`)은 이 파일을 가리키기만 한다. **규칙은 여기에만 쓴다.**

## 프로젝트

QuickSlot: 설치 없이 브라우저에서 바로 쓰는 생활·개발 도구 모음. 구조와 툴 추가 방법은 [README.md](README.md) 참고.

- npm workspaces 모노레포. 프론트는 `apps/web` (Astro 7 + React 19 islands + Tailwind 4). 백엔드 `apps/api` 는 아직 없음.
- 툴의 단일 진실 공급원은 `apps/web/src/tools/registry.ts`. 툴 추가·상태 변경은 여기부터.
- 원칙: 툴은 기본적으로 브라우저 안에서만 처리(`processing: 'client'`). 사용자 파일을 서버로 보내지 않는다. 서버가 꼭 필요한 툴만 `'server'` 로 표시.
- UI 문구는 한국어.

## 디자인 규칙

단색 배경 위의 반투명 유리(글래스) 표면, 라이트/다크는 시스템 설정을 따른다. 기준은 `apps/web/src/styles/global.css`.

- **배경**: `global.css` 의 `body::before` 하나로만 그린다 — 무채색 위→아래 명암(`bg-top` → `bg-bottom`) + 고운 노이즈 질감. 색이 들어간 그라데이션·색 번짐·패턴 배경은 넣지 않는다. 페이지마다 따로 배경을 깔지 않는다.

- **색**: 토큰만 사용 — `bg`, `panel`, `panel-2`, `line`, `fg`, `muted`, `accent`, `accent-fg`, `danger`, `ok`. 하드코딩 색 금지 (예외: `registry.ts` 의 카테고리 타일 색).
- **표면**: 카드·패널은 `panel`(= `glass` + 둥근 모서리), 위에 뜨는 창은 `glass-strong`. 넓은 `textarea.input` 은 자동으로 유리 표면이 된다.
- **컨트롤**: 버튼 `btn` / `btn-primary` / `btn-tinted`, 입력 `input`, 라벨 `label`, 선택지 2~3개는 `Segmented`, 그 이상은 `Select` 컴포넌트. **브라우저 기본 `<select>` 는 쓰지 않는다** (펼친 목록을 꾸밀 수 없음). 체크박스는 CSS 로 자동으로 스위치 모양이 된다.
- **높이**: 한 줄짜리 컨트롤(버튼, 입력, Select, Segmented)은 모두 36px(`h-9`)로 맞춘다.
- **아이콘**: `lucide-react` 선 아이콘만. **이모지를 UI 아이콘으로 쓰지 않는다.** 툴 아이콘은 `AppIcon` (카테고리 색 타일).
- **모서리**: 카드 22px, 큰 영역 26px, 버튼·뱃지는 완전히 둥글게(pill). `rounded-sm/md/lg` 처럼 각진 모서리는 쓰지 않는다.
- **주의**: `backdrop-filter` 가 걸린 요소 안의 `position: fixed` 자식은 화면이 아니라 그 요소 기준으로 배치된다. 모달·오버레이는 `createPortal(…, document.body)` 로 띄운다.
- **레이아웃**: 헤더는 왼쪽 로고 · 오른쪽 검색 하나, 화면 하단에 퀵슬롯 독(`Dock`)이 모든 페이지에 고정된다. 검색 창을 여는 버튼을 페이지마다 따로 만들지 않는다. 검색 관련 문구는 모두 **"QuickSlot 검색"** 으로 통일한다.
- **정렬**: 본문 요소는 왼쪽 정렬로 카드 그리드와 같은 선에 맞춘다. 가운데 정렬된 요소를 세로로 여러 개 쌓지 않는다 (아래로 갈수록 넓어지는 피라미드 모양이 됨).
- **그리드**: 카드 그리드에는 `grid-cols-1` 처럼 열 수를 명시한다 (안 하면 긴 텍스트 때문에 모바일에서 화면 밖으로 넘친다).
- 변경 후 라이트·다크, 그리고 모바일 폭(390px)에서 확인한다.

## 명령어

```bash
npm install
npm run check    # 타입 검사 — 변경 후 반드시 실행
npm run build    # 빌드 — 변경 후 반드시 실행
npm run dev      # 개발 서버 (http://localhost:4321)
```

에이전트가 개발 서버를 띄울 때는 백그라운드로: `apps/web` 에서 `npx astro dev --background`, 중지는 `npx astro dev stop`.

## Git 워크플로 (GitHub Flow)

- `main` 은 항상 배포 가능한 상태. **`main` 에 직접 커밋·push 하지 않는다.** 모든 변경은 브랜치 → PR → squash merge.
- 작업 시작 전 최신 `main` 에서 브랜치를 만든다. 브랜치 하나에 작업 하나(툴 하나)만.
- 머지된 브랜치는 삭제한다.

### 브랜치 이름: `종류/짧은-설명`

| 접두사 | 용도 | 예시 |
|---|---|---|
| `feat/` | 새 툴, 새 기능 | `feat/qr-code` |
| `fix/` | 버그 수정 | `fix/heic-orientation` |
| `refactor/` | 동작 변화 없는 구조 개선 | `refactor/dropzone` |
| `docs/` | 문서 | `docs/contributing` |
| `chore/` | 설정, 의존성, CI | `chore/ci-build` |

- 소문자와 하이픈(-)만 사용.
- 툴 작업 브랜치는 `registry.ts` 의 slug 와 맞춘다 (`feat/qr-code` ↔ slug `qr-code`).

### 커밋 메시지: Conventional Commits

```
<종류>(<범위>): <요약>

<본문 — 무엇을, 왜 (선택)>
```

- 종류: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`
- 범위(선택): 툴 slug 또는 영역 — 예: `feat(qr-code): QR 코드 생성기 추가`, `fix(json-formatter): 오류 위치 계산 수정`
- 요약은 한국어, 50자 이내, 마침표 없음.

### PR

- 제목은 커밋 메시지 형식과 같게 (squash merge 시 그대로 커밋 제목이 됨).
- 본문에 무엇을 바꿨는지, 어떻게 확인했는지(실행한 명령, 테스트한 화면)를 적는다.
- CI(`check`, `build`)가 통과해야 머지할 수 있다.
