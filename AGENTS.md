# AGENTS.md

이 저장소에서 작업하는 모든 AI 에이전트(Claude Code, Codex, Cursor, Gemini, Copilot 등)와 사람을 위한 공통 규칙이다.
도구별 설정 파일(`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`)은 이 파일을 가리키기만 한다. **규칙은 여기에만 쓴다.**

## 프로젝트

QuickSlot: 설치 없이 브라우저에서 바로 쓰는 생활·개발 도구 모음. 구조와 툴 추가 방법은 [README.md](README.md) 참고.

- npm workspaces 모노레포. 프론트는 `apps/web` (Astro 7 + React 19 islands + Tailwind 4). 백엔드 `apps/api` 는 아직 없음.
- 툴의 단일 진실 공급원은 `apps/web/src/tools/registry.ts`. 툴 추가·상태 변경은 여기부터.
- 원칙: 툴은 기본적으로 브라우저 안에서만 처리(`processing: 'client'`). 사용자 파일을 서버로 보내지 않는다. 서버가 꼭 필요한 툴만 `'server'` 로 표시.
- UI 문구는 한국어. 색은 `apps/web/src/styles/global.css` 의 `@theme` 토큰(bg, panel, line, fg, muted, accent, danger, ok)만 사용.

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
