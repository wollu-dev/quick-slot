# AGENTS.md

**English** · [한국어](AGENTS.ko.md) · [日本語](AGENTS.ja.md)

Shared rules for everyone working in this repository, humans and AI agents alike (Claude Code, Codex, Cursor, Gemini, Copilot, …).
Tool-specific files (`CLAUDE.md`, `GEMINI.md`, `.github/copilot-instructions.md`) only point here. **Rules live in this file only.**
This English file is the source of truth; `AGENTS.ko.md` and `AGENTS.ja.md` are translations for readers.

## Project

QuickSlot: everyday and developer tools that run right in the browser. See [README.md](README.md) for the structure and how to add a tool.

- npm workspaces monorepo. The website is `apps/web` (Astro 7 + React 19 islands + Tailwind 4). The backend is `apps/api` (Hono on Node 24, TypeScript run directly by Node), used only by server tools.
- The single source of truth for tools is `apps/web/src/tools/registry.ts`. Adding a tool or changing its status starts there.
- Principle: tools process everything in the browser by default (`processing: 'client'`). Use `'server'` only when a tool truly can't work without one, and check first whether a browser-side engine (WebAssembly) could do the job. Never write copy that promises *every* tool stays on the device; describe processing per tool.
- Server tools must: show the server badge and cloud icon (automatic from `processing`); replace the drop zone's on-device note with one saying the file is uploaded and deleted right after processing; ask for confirmation before the first upload; never store files or log their contents, and delete them as soon as the result is returned; and be covered by a privacy policy page before they ship.
- Custom tools (`lib/customTools.ts`) are links to external sites that users add themselves. They are stored only in the browser, accept only http(s) URLs, and are opened in a new tab with `noopener,noreferrer` after the external-tool warning (`ExternalToolWarning`). Never load anything from those sites (favicons, previews, iframes).
- Heavy engines (WebAssembly such as ffmpeg.wasm, HEIC and AVIF codecs) are loaded only when needed with dynamic `import()`, and served from this site, never from a CDN.
- The one script loaded from another site is **Paddle.js** (payments), because Paddle requires its own CDN. Load it only when the user presses a buy button (`lib/billing.ts`), never on page load.
- Billing (checkout, subscription status, the Paddle webhook) is regular code, not `ee`: it is how people buy Pro, not a Pro feature. Pro-only API routes use `requirePro()` from `apps/api/src/billing.ts`.
- File conversion must never produce a file whose extension doesn't match its content. Read the real format from the bytes (`lib/convert/formats.ts`), rename only when the format already matches, and refuse what can't be converted.

## License

- The project is source-available under the Sustainable Use License (`LICENSE.md`), like n8n. Versions up to commit `7ee6d28` stay MIT.
- **Code for paid features lives only in files with `.ee.` in the name or in an `ee/` folder**, covered by `LICENSE_EE.md`. Only the entry points load them, and only when the folder exists: `apps/api/src/index.ts` (API plugins and migrations) and `apps/web/src/layouts/Layout.astro` (`import.meta.glob`). No other code imports from `ee`; it talks to it through events. **Deleting the `ee` folders must leave a working free build** (`check`, `test`, `build`), so `ee` tests live inside `ee` too.
- **Tools that are free today stay free.** Paid plans add new things (AI, sync, higher limits); never move an existing free feature behind a subscription.
- Outside contributions need the signed Contributor License Agreement (`CLA.md`, English only), checked by the CLA bot on each pull request.
- Third-party engines keep their own licenses (ffmpeg.wasm is GPL-2.0-or-later, `heic-to` is LGPL-3.0). Load them as separate, unmodified files, as today. Don't copy code from other projects unless its license allows it (MIT, Apache-2.0, BSD and similar are fine).

## Languages of the repository

| What | Language |
|---|---|
| Code, identifiers, comments, developer-facing messages (build warnings, thrown errors) | **English** |
| Commit messages, PR titles and descriptions, branch names | **English** |
| Documentation (`README`, `AGENTS`, `CONTRIBUTING`) | **English is the source** (`*.md`), with Korean (`*.ko.md`) and Japanese (`*.ja.md`) translations |
| UI text shown to users | Korean · English · Japanese, through the i18n dictionaries (see below) |

- When you change `README.md`, `AGENTS.md` or `CONTRIBUTING.md`, update the `.ko.md` and `.ja.md` translations **in the same PR** so they never drift apart.
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
- **Images:** the root `Dockerfile` builds two targets. `web` is nginx serving the static build and passing `/api` to the API (`deploy/nginx.conf`); it takes the site URL as `ARG SITE_URL`. `api` is Node running `apps/api`. `docker-compose.yml` runs both; only the web container is published to a port.
- **CI** (`.github/workflows/ci.yml`) type-checks, tests and builds, and also builds both images and smoke-tests them together on every pull request. Nothing is pushed from CI.
- **Publishing:** images go to GHCR **only when a version tag (`v*`) is pushed**, never on every merge to `main`. The publishing workflow is not added yet; adding it needs the owner's approval because it publishes packages.
- **Logs never hold personal data:** nginx and the API log time, method, path without the query string, status, size and duration. No client addresses, no request bodies, no file names. Keep it that way when you add routes; the privacy page (`/privacy`) promises it.
- **Never hard-code a domain or URL.** The site URL comes only from the build environment variable `SITE_URL` (`astro.config.mjs` → `Astro.site`). When you need an absolute URL use `Astro.site`, and make it work with relative URLs when it's missing.
- Project links (the GitHub repository) and the author come from the root `package.json` (`repository`, `author`). Read them through `apps/web/src/lib/project.ts` instead of writing the URL in UI code.
- When you add an environment variable, also document it in `apps/web/.env.example` (site) or `apps/api/.env.example` (API) and in the "Configuration" table of the README (all three languages).

## Design rules

Translucent glass surfaces over a neutral background. The reference is `apps/web/src/styles/global.css`.

- **Settings**: the gear button at the right of the header opens the settings sheet (`SettingsSheet`, an iOS-style inset grouped list): appearance · Quick Slot position/size · language. All user preferences live here.
- **Applied before first paint**: theme (`data-theme`), dock position and size (`data-dock`, `data-dock-size`) and the language redirect are applied by the inline `<head>` script in `Layout.astro` before anything is drawn. Later changes go through `src/lib/theme.ts`, `src/lib/dock.ts` and `src/i18n`. **Keep the storage keys and defaults in sync on both sides.**
- **Theme**: Light / Dark / Auto (default). Applied only through `<html data-theme="light|dark">`. Don't use `@media (prefers-color-scheme)` in CSS; build dark styles with the `[data-theme="dark"]` tokens or Tailwind's `dark:` variant.
- **Dock**: placement, size and magnification are decided by the `.dock*` rules in `global.css` based on `html[data-dock]`. Below 640px it is always small and at the bottom, regardless of the setting. Elements at the very bottom of a page that must not be covered by the dock get `.dock-safe`.
- **Background**: drawn only by `body::before` in `global.css`: a neutral top-to-bottom shade (`bg-top` → `bg-bottom`) plus a fine noise texture. No colorful gradients, color blobs or patterns. Don't add per-page backgrounds.
- **Color**: tokens only: `bg`, `panel`, `panel-2`, `line`, `fg`, `muted`, `accent`, `accent-fg`, `danger`, `ok`. No hard-coded colors (exceptions: category tile colors in `registry.ts`, the appearance previews in settings, the color picker gradients in the Color Converter, and the segment and ball colors of the Draw Games).
- **Surfaces**: cards and panels use `panel` (= `glass` + rounded corners), the search window uses `glass-strong`, and floating windows meant for reading (menus, the settings sheet) use `glass-menu` (more opaque). A large `textarea.input` automatically becomes a glass surface.
- **Controls**: buttons `btn` / `btn-primary` / `btn-tinted`, inputs `input`, labels `label`; use `Segmented` for 2–3 options and the `Select` component for more. **Never use the native `<select>`** (its open list can't be styled). Likewise use `DateTimePicker` for dates and times and `NumberField` for numbers, never `<input type="datetime-local">` or `type="number"` (their popups and spinners can't be styled and ignore the site language). Checkboxes are automatically styled as switches by CSS.
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
npm run dev      # dev server (http://localhost:4321); /api is proxied to the API
npm run dev:api  # API server (http://localhost:8787), needed only by server tools
npm test         # API tests
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
