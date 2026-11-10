# AGENTS.md

**English** · [한국어](AGENTS.ko.md) · [日本語](AGENTS.ja.md)

Shared rules for everyone working in this repository, humans and AI agents alike (Claude Code, Codex, Cursor, Gemini, Copilot, …).
Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) only point here. **Rules live in this file only.**
This English file is the source of truth; `AGENTS.ko.md` and `AGENTS.ja.md` are translations for readers.

## Project

QuickSlot: everyday and developer tools that run right in the browser. See [README.md](README.md) for the structure and how to add a tool.

- npm workspaces monorepo. The website is `apps/web` (Astro 7 + React 19 islands + Tailwind 4). There is no backend (`apps/api`) yet.
- The single source of truth for tools is `apps/web/src/tools/registry.ts`. Adding a tool or changing its status starts there.
- Principle: tools process everything in the browser (`processing: 'client'`). Never send user files to a server. Mark a tool `'server'` only when it truly needs one.

## Languages of the repository

| What | Language |
|---|---|
| Code, identifiers, comments, developer-facing messages (build warnings, thrown errors) | **English** |
| Commit messages, PR titles and descriptions, branch names | **English** |
| Documentation (`README`, `AGENTS`) | **English is the source** (`*.md`), with Korean (`*.ko.md`) and Japanese (`*.ja.md`) translations |
| UI text shown to users | Korean · English · Japanese, through the i18n dictionaries (see below) |

- When you change `README.md` or `AGENTS.md`, update the `.ko.md` and `.ja.md` translations **in the same PR** so they never drift apart.
- Korean that is product data is fine in code: the Korean dictionary `i18n/ko.ts` and the Korean search `keywords` in `registry.ts`.
- Write docs, commit messages and PR descriptions in plain, direct prose. Avoid em dashes (—); use a period, comma, colon or parentheses instead.

## Internationalization (Korean · English · Japanese)

- **Never write UI text directly in code.** Add every string to `apps/web/src/i18n/ko.ts` first, then translate it under the same key in `en.ts` and `ja.ts` (a missing key is a type error). Use `useT()` in React and `getDict(lang)` in `.astro`.
- Emphasis inside a string uses `**bold**` and `` `code` `` and is rendered with `<Rich>`. Don't split a sentence into fragments and concatenate them, because word order differs between languages.
- Format numbers and dates with `LANG_TAGS[lang]`. Strings that contain numbers are functions in the dictionary (e.g. `summary: (n) => …`).
- Libraries (`lib/`) return codes instead of text, and the UI translates them (e.g. `ItemKind` and `MetadataError.code` in `metadata.ts`).
- Build internal links with `localizePath(lang, path)` / `toolUrl(slug, lang)`. Never hard-code `/tools/…`.
- Wrap the top-level component of every React island with `withI18n`, and pass `lang={lang}` from Astro.
- **Never redirect based on the browser language.** Search engines would then fail to crawl the other language versions. The `LanguageSuggest` banner only *suggests* a language; redirects happen only when the user has explicitly chosen one (the `quickslot:lang` stored value). Never show crawlers something different (no User-Agent sniffing).

## Deployment

- **Deployment method: Docker image → GitHub Container Registry (`ghcr.io`) → self-hosted.** Other hosting (GitHub Pages, Vercel, Netlify, Cloudflare Pages, …) is not used, so don't suggest or set it up.
- **Current status: not built yet.** It will be built when the service is close to complete. Don't add a `Dockerfile` or an image-publishing workflow before then. The only automation today is CI (`.github/workflows/ci.yml`: type check and build).
- Direction for when it's built: a two-stage `Dockerfile` (build with Node → serve only the static output with nginx), taking the site URL as `ARG SITE_URL`. Publish images **only when a version tag (`v*`) is pushed**, not on every merge to `main`.
- **Never hard-code a domain or URL.** The site URL comes only from the build environment variable `SITE_URL` (`astro.config.mjs` → `Astro.site`). When you need an absolute URL use `Astro.site`, and make it work with relative URLs when it's missing.
- Project links (the GitHub repository) and the author come from the root `package.json` (`repository`, `author`). Read them through `apps/web/src/lib/project.ts` instead of writing the URL in UI code.
- When you add an environment variable, also document it in `apps/web/.env.example` and in the "Configuration" table of the README (all three languages).

## Design rules

Translucent glass surfaces over a neutral background. The reference is `apps/web/src/styles/global.css`.

- **Settings**: the gear button at the right of the header opens the settings sheet (`SettingsSheet`, an iOS-style inset grouped list): appearance · Quick Slot position/size · language. All user preferences live here.
- **Applied before first paint**: theme (`data-theme`), dock position and size (`data-dock`, `data-dock-size`) and the language redirect are applied by the inline `<head>` script in `Layout.astro` before anything is drawn. Later changes go through `src/lib/theme.ts`, `src/lib/dock.ts` and `src/i18n`. **Keep the storage keys and defaults in sync on both sides.**
- **Theme**: Light / Dark / Auto (default). Applied only through `<html data-theme="light|dark">`. Don't use `@media (prefers-color-scheme)` in CSS; build dark styles with the `[data-theme="dark"]` tokens or Tailwind's `dark:` variant.
- **Dock**: placement, size and magnification are decided by the `.dock*` rules in `global.css` based on `html[data-dock]`. Below 640px it is always small and at the bottom, regardless of the setting. Elements at the very bottom of a page that must not be covered by the dock get `.dock-safe`.
- **Background**: drawn only by `body::before` in `global.css`: a neutral top-to-bottom shade (`bg-top` → `bg-bottom`) plus a fine noise texture. No colorful gradients, color blobs or patterns. Don't add per-page backgrounds.
- **Color**: tokens only: `bg`, `panel`, `panel-2`, `line`, `fg`, `muted`, `accent`, `accent-fg`, `danger`, `ok`. No hard-coded colors (exceptions: category tile colors in `registry.ts`, and the appearance previews in settings).
- **Surfaces**: cards and panels use `panel` (= `glass` + rounded corners), the search window uses `glass-strong`, and floating windows meant for reading (menus, the settings sheet) use `glass-menu` (more opaque). A large `textarea.input` automatically becomes a glass surface.
- **Controls**: buttons `btn` / `btn-primary` / `btn-tinted`, inputs `input`, labels `label`; use `Segmented` for 2–3 options and the `Select` component for more. **Never use the native `<select>`** (its open list can't be styled). Checkboxes are automatically styled as switches by CSS.
- **Text input and output areas**: use the `TextPanel` component (a header row with the title and buttons, the text area below). Never float buttons such as Copy over a text area; long text would run underneath them.
- **Height**: single-line controls (buttons, inputs, `Select`, `Segmented`) are all 36px (`h-9`).
- **Icons**: `lucide-react` line icons only. **Never use emoji as UI icons.** Tool icons use `AppIcon` (a category-colored tile).
- **Corners**: cards 22px, large areas 26px, buttons and badges fully rounded (pill). Don't use sharp corners like `rounded-sm/md/lg`.
- **Gotcha**: a `position: fixed` child inside an element with `backdrop-filter` is positioned relative to that element, not the viewport. Render modals and overlays with `createPortal(…, document.body)`.
- **Layout**: the header has the logo on the left and search plus settings on the right. The Quick Slot dock (`Dock`) is fixed on every page. Don't add extra buttons that open search on individual pages. All search-related wording comes from the single dictionary key `header.search`.
- **Alignment**: align body content to the left edge of the card grid. Don't stack several centered elements vertically (it turns into a pyramid that widens downward).
- **Grids**: always specify the column count on card grids, e.g. `grid-cols-1` (otherwise long text overflows the screen on mobile).
- After a change, check light and dark mode, mobile width (390px), and all three languages (especially the longer English and Japanese strings).

## Commands

```bash
npm install
npm run check    # type check (always run after a change)
npm run build    # build (always run after a change)
npm run dev      # dev server (http://localhost:4321)
```

When an agent starts the dev server, run it in the background: `npx astro dev --background` in `apps/web`, and stop it with `npx astro dev stop`.

## Git workflow (GitHub Flow)

- `main` is always deployable. **Never commit or push directly to `main`.** Every change goes branch → PR → squash merge.
- Branch from the latest `main` before starting. One task (one tool) per branch.
- Delete branches after they are merged.
- Merge pull requests one at a time, and branch new work from the updated `main`. Stacking PRs on top of each other causes conflicts after a squash merge.

### Branch names: `type/short-description`

| Prefix | Use | Example |
|---|---|---|
| `feat/` | New tool or feature | `feat/qr-code` |
| `fix/` | Bug fix | `fix/heic-orientation` |
| `refactor/` | Restructuring without behavior change | `refactor/dropzone` |
| `docs/` | Documentation | `docs/contributing` |
| `chore/` | Config, dependencies, CI | `chore/ci-build` |

- Lowercase letters and hyphens (-) only.
- Tool branches match the slug in `registry.ts` (`feat/qr-code` ↔ slug `qr-code`).

### Commit messages: Conventional Commits

```
<type>(<scope>): <summary>

<body: what and why (optional)>
```

- Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`, `style`, `perf`
- Scope (optional): a tool slug or area, e.g. `feat(qr-code): add QR code generator`, `fix(json-formatter): fix error position calculation`
- Summary in English, imperative mood, 50 characters or less, no trailing period.

### Pull requests

- The title follows the commit message format (it becomes the commit title on squash merge).
- The description covers what changed and how it was verified (commands run, screens tested).
- CI (`check`, `build`) must pass before merging.
