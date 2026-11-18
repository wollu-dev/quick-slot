<div align="center">

<img src="apps/web/public/favicon.svg" width="72" height="72" alt="QuickSlot logo" />

# QuickSlot

**The tools you need, one click away in your browser.**

Everyday and developer utilities that run on your device.<br />
No install, no sign-up, and your files stay on your computer unless a tool clearly says otherwise.

[![CI](https://github.com/wollu-dev/quick-slot/actions/workflows/ci.yml/badge.svg)](https://github.com/wollu-dev/quick-slot/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
![Astro](https://img.shields.io/badge/Astro-7-BC52EE?logo=astro&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white)

**English** · [한국어](README.ko.md) · [日本語](README.ja.md)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/home-en-dark.png" />
  <img alt="QuickSlot home screen with the tool list and the Quick Slot dock" src="docs/assets/home-en-light.png" width="860" />
</picture>

</div>

## Why QuickSlot?

Renaming a batch of files, stripping GPS data from a photo, pretty-printing JSON. Small jobs like these usually mean hunting for a sketchy website and uploading your files to someone else's server.

- **🔒 Private by design.** Tools run in your browser by default, so your files are processed on your device. The rare tool that needs a server is marked as such, and files sent to it are deleted right after processing.
- **⚡ Instant.** Nothing to install or sign up for. Open a tool and drop your files in.
- **⭐ Quick Slots.** Pin up to 9 favorite tools to a macOS-style dock and open them with <kbd>Alt</kbd>+<kbd>1</kbd>–<kbd>9</kbd>.
- **🔗 Your own tools.** Add any website you use often (for example an AI chat) as a tool. It shows up in search and the dock, and opens in a new tab after a short warning about uploads, licenses and privacy.
- **🌏 Multilingual.** Korean, English and Japanese, with light, dark and auto appearance.

## Tools

| Tool | What it does |
|---|---|
| **File Converter** | Actually convert images, audio, video and data files (JPG, PNG, WebP, AVIF, HEIC, MP3, MP4, WebM, JSON, YAML, CSV, XML and more) |
| **Fix Split Characters (NFC)** | Fix file names from a Mac that show split Korean letters or detached accents: rename in place in a folder, get a ZIP, or convert text |
| **File Refinery** | One pass over many files: convert, strip metadata, rename, fix split names (NFC), set dates and add SHA-256 checksums, keeping folders, as one ZIP |
| **Batch Rename** | Numbering, find & replace, regex, case conversion |
| **File Date Changer** | Download files with new created and modified dates as a ZIP, or get a PowerShell / Bash script |
| **Merge PDF** | Combine PDFs in any order, optionally taking only some pages from each (e.g. 1-3, 5, 8-) |
| **Split PDF** | Pick, delete, rotate and reorder pages on thumbnails, then save, extract the selection, or split every N pages or by ranges |
| **Images → PDF** | One image per page on A4, Letter, A5 or image-sized pages, with orientation and margins; JPEG and PNG embedded without re-compression |
| **Video → GIF** | Trim a clip and turn it into an animated GIF with your choice of width, frame rate, speed and quality |
| **Screen Recorder** | Record a screen, window or tab with screen or tab audio and the microphone, pause and resume, and save as MP4 or WebM |
| **Video Downloader** (server) | Saves a video from its page address as MP4 or MP3/M4A with yt-dlp on our API; the file is deleted as soon as it is sent. Only for videos you have the rights to |
| **Metadata Remover & Editor** | Strip GPS, camera info and more from JPEG / PNG / WebP without losing quality, or edit the date taken (set or shift many photos at once), location, author, copyright and title of JPEGs |
| **Hash & Checksum** | MD5, SHA-1, SHA-256, SHA-512 and CRC32 of files or text, verify a published hash, and check whether files are identical |
| **ZIP & Unzip** | Zip files and folders with UTF-8 names, browse a ZIP and extract single files or everything into a folder, and fix garbled Korean or Japanese names |
| **Image Compressor** | Shrink JPEG, PNG, WebP, AVIF and HEIC with MozJPEG, OxiPNG, WebP and AVIF encoders, with a before and after comparison |
| **Image Resizer** | Resize many images by pixels, percentage or long side, or fill and crop to a size with a draggable crop position |
| **QR Code** | Create QR codes for links, text, Wi-Fi, contacts, email, phone and SMS (PNG, SVG, custom colors), and read them from images or the camera |
| **Character Counter** | Characters with and without spaces, words, bytes, reading time |
| **Korean ↔ English Keyboard Fix** | Fix text typed in the wrong Korean / English mode (dkssud → 안녕, ㅗ디ㅣㅐ → hello) |
| **Text Diff** | Compare two texts by line, word or character, with changed words highlighted and a unified diff to copy |
| **JSON Formatter** | Pretty-print, minify, and pinpoint the exact line and column of errors |
| **Base64 Encode / Decode** | Text and files, URL-safe and data-URL output |
| **Unix Timestamp** | Convert timestamps ↔ dates with auto-detected units |
| **UUID Generator** | Generate UUID v4 / v7 in bulk |
| **Password Generator** | Random passwords with the length and characters you choose, plus a strength meter |
| **JWT Decoder** | Read a token's header and payload, with expiry status and readable times (signature not verified) |
| **Color Converter** | Pick or paste a color and copy it as HEX, RGB, HSL, Unity, Unreal (linear) or Godot code, with a WCAG contrast check |
| **Number Base Converter** | Binary, octal, decimal, hex and any base from 2 to 36 at once, exact at any size, with 8 to 64-bit two's complement and clickable bits |
| **Normal Map Green Flip** | Convert normal maps between DirectX and OpenGL exactly (8 and 16-bit PNG, TGA, alpha kept), with a lit preview and _DX / _GL renaming |
| **Date Calculator** | Days between dates (D-day, weekdays), age with the Chinese zodiac sign, and adding days, weeks, months or weekdays to a date |
| **Unit Converter** | Length, weight, area (incl. pyeong), volume, temperature, speed and data size, all units at once |
| **Server Time Check** (server) | A site's server clock to the hundredth of a second (from its Date header, synced through our API), with a countdown and beeps for ticketing and sign-ups |
| **Draw Games** | Roulette, ladder (amidakuji) and pinball for fair random picks, using the browser's cryptographic random generator |
| **Bill Splitter** | Split a bill evenly or with extras per person, round to 10 / 100 / 1000, and copy a summary to share |

<details>
<summary><b>Coming soon</b> (1 tool)</summary>

| Category | Tools |
|---|---|
| PDF & Docs | Office → PDF |

</details>

## Features

- **Spotlight-style search.** Press <kbd>Ctrl</kbd>+<kbd>K</kbd> (or <kbd>/</kbd>) to find any tool, even by its name in another language.
- **Quick Slot dock.** Place it at the bottom, left or right, in three sizes. The tool you're using is marked with a dot, just like a running app.
- **Settings sheet.** Appearance, dock position and size, and language, in one place. Applied before the first paint, so there's no flicker.
- **Language suggestions.** If your browser language differs from the page, QuickSlot offers to switch instead of redirecting you, so every language stays crawlable by search engines.
- **Safe file conversion.** The real format is read from the file content, not the extension. When the format already matches, the file is only renamed with no re-encoding, and combinations that can't be converted are refused instead of producing a mislabeled file. Audio and video use ffmpeg.wasm (about 30 MB, downloaded only the first time).
- **Lossless where it matters.** The metadata remover edits bytes directly instead of re-encoding, and keeps rotation and color profiles unless you say otherwise.

## Getting started

**Requirements:** Node.js 22.23 or later and npm.

```bash
git clone https://github.com/wollu-dev/quick-slot.git
cd quick-slot
npm install
npm run dev
```

Then open <http://localhost:4321>.

| Command | Description |
|---|---|
| `npm run dev` | Start the dev server at `localhost:4321` |
| `npm run build` | Build the static site into `apps/web/dist` |
| `npm run preview` | Serve the production build locally |
| `npm run check` | Type-check the whole project |
| `npm run dev:api` | Start the API at `localhost:8787` (only server tools need it; the dev server proxies `/api` to it) |
| `npm test` | Run the API tests |

## Configuration

The site URL is never hard-coded. Set it, and which tools to show, where you build or run the site:

| Variable | Purpose | If unset |
|---|---|---|
| `SITE_URL` | Full site URL, e.g. `https://example.com`. Used for `hreflang` and `canonical` links | Relative URLs are used (fine for development) |
| `HIDE_TOOLS` | Tools to hide, comma separated: tool slugs (as in `registry.ts`, e.g. `video-downloader`) or categories (`file`, `pdf`, `image`, `media`, `text`, `dev`, `life`) | Every tool is shown |
| `SHOW_TOOLS` | The only tools or categories to show, in the same form, e.g. `pdf,image,qr-code` | Every tool is shown |

- **Locally:** copy `apps/web/.env.example` to `apps/web/.env` (git-ignored).
- **GitHub Actions:** add a repository **variable** named `SITE_URL`.
- **Docker:** set them on the container (see Deployment). It rebuilds the site when they change.

Hidden tools get no page and don't appear in the list, search or Quick Slots, and the API turns off the routes of hidden server tools.

The API (`apps/api`, see `apps/api/.env.example`) reads:

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | Port the API listens on | `8787` |
| `TRUST_PROXY` | Read the client address from `X-Forwarded-For` (set `true` only behind your own reverse proxy) | `false` |
| `RATE_LIMIT_PER_MINUTE` | Requests allowed per client address per minute | `60` |
| `LOG_REQUESTS` | One log line per request: method, path without query, status, time | `true` |
| `SERVER_TIME_PER_MINUTE` | Server time checks per client address per minute (each sends about 20 requests to the site) | `6` |
| `VIDEO_MAX_MB` | Largest file the video downloader makes, in MB | `1024` |
| `VIDEO_MAX_MINUTES` | Longest video it accepts, in minutes | `120` |
| `VIDEO_CONCURRENT` | Video downloads running at once on the server | `2` |
| `VIDEO_PER_HOUR` | Video downloads per client address per hour | `10` |
| `VIDEO_WORK_DIR` | Folder where downloads wait until they are sent (deleted right after) | system temp folder; `/work` in the image |
| `YTDLP_PATH` | The yt-dlp command | `yt-dlp` |
| `HIDE_TOOLS`, `SHOW_TOOLS` | The same lists as the site: routes of hidden server tools answer 404 | every tool on |
| `SITE_DIR` | Built site to serve next to the API (`apps/web/dist`) | only `/api` is served; `/app/apps/web/dist` in the image |
| `APP_VERSION` | Version reported by `/api/health` (set in the published images) | the package version |

## Project structure

```
quick-slot/
├─ apps/api/                 # API for the few server tools (Hono on Node 24)
├─ apps/web/                 # The website (Astro + React islands + Tailwind CSS)
│  ├─ src/
│  │  ├─ tools/registry.ts   # ★ Tool manifest that home, search and the dock all read from
│  │  ├─ tools/<category>/   # One React component per tool
│  │  ├─ i18n/               # Dictionaries: ko.ts (source of types), en.ts, ja.ts
│  │  ├─ views/              # Page templates shared by every language
│  │  ├─ pages/              # Routes: Korean at /…, English and Japanese at /[lang]/…
│  │  ├─ components/         # Search, settings sheet, dock, shared UI
│  │  ├─ lib/                # Files/ZIP, metadata stripping, slots, theme, dock settings
│  │  └─ styles/global.css   # Design tokens and the glass design system
│  └─ public/
├─ deploy/entrypoint.sh      # Container start: rebuild the site if settings changed, run the server
├─ Dockerfile                # The image: Node server with the API and the site
├─ docker-compose.yml        # Runs the published image
├─ docs/assets/              # Screenshots for the README
└─ AGENTS.md                 # Contribution rules for humans and AI agents
```

## Adding a tool

1. Add an entry to `apps/web/src/tools/registry.ts`.
2. Add its name and description under `tools` in `apps/web/src/i18n/ko.ts`, `en.ts` and `ja.ts` (a missing key is a type error).
   With `status: 'soon'` you're done. A "coming soon" page is generated in all three languages.
3. Write the component in `apps/web/src/tools/<category>/MyTool.tsx`.
   Put every UI string in the dictionaries, read them with `useT()`, and export with `export default withI18n(MyTool)`.
4. Wire it up in the "Tool component wiring" block of `apps/web/src/views/ToolPage.astro`:
   ```astro
   {slug === 'my-tool' && <MyTool client:load lang={lang} />}
   ```
   Use `client:only="react"` if the first render depends on the current time, randomness or browser APIs.
5. Set the tool's `status` to `'ready'`.

## Internationalization

| Language | URL |
|---|---|
| 한국어 (Korean) | `/` |
| English | `/en/` |
| 日本語 (Japanese) | `/ja/` |

Every language is a separate static page with `hreflang` links. QuickSlot never redirects based on the browser language, because that would send search-engine crawlers (which mostly browse in English) away from the Korean and Japanese pages. Instead it shows a suggestion banner, and only redirects once the user has chosen a language.

## Deployment

QuickSlot is self-hosted with Docker. The root `Dockerfile` builds **one image**: the Node server answers `/api` and serves the website on port 8080. CI builds it on every pull request and checks that it works.

### Running a release

Each GitHub release publishes the image to the GitHub Container Registry as `ghcr.io/wollu-dev/quick-slot`, tagged with its version (`1.2.0` and `1.2`) and `latest`. Merges to `main` publish nothing, so a server only changes when you pick a new version.

The quickest way is one command:

```bash
docker run -d --name quickslot -p 8080:8080 --restart unless-stopped \
  -e SITE_URL=https://example.com -e HIDE_TOOLS=video-downloader \
  ghcr.io/wollu-dev/quick-slot:1.2.0
```

Or put `docker-compose.yml` on the server with a `.env` file next to it:

```bash
QUICKSLOT_VERSION=1.2.0          # default: latest
QUICKSLOT_PORT=8080
SITE_URL=https://example.com
HIDE_TOOLS=video-downloader      # or SHOW_TOOLS=pdf,image
```

```bash
docker compose pull && docker compose up -d
```

With `SITE_URL`, `HIDE_TOOLS` or `SHOW_TOOLS` set, the container builds the site when it starts (about half a minute) and serves it after that; it builds again only when they change. Behind your own reverse proxy (for HTTPS), set `TRUST_PROXY=true` so rate limits see the real client address. To build the image from a checkout instead, run `docker compose build`.

### Publishing a release (maintainers)

1. Create a release with a version tag: `gh release create v1.2.0 --generate-notes` (or on GitHub under Releases).
2. The Release workflow (`.github/workflows/release.yml`) builds the image for `linux/amd64` and `linux/arm64` and pushes it. A pre-release gets only its own version tag, not `latest`. If a run fails, fix it and use **Run workflow** with the same tag.
3. The first time, open the `quick-slot` package under your GitHub profile → Packages and set its visibility to public, so servers can pull it without signing in.

## Contributing

Contributions are welcome! This project follows GitHub Flow: branch from `main`, open a pull request, and squash-merge once CI passes.

Please read **[AGENTS.md](AGENTS.md)** first. It holds the rules for code, design, i18n, commits and pull requests, for humans and AI coding agents alike. ([한국어](AGENTS.ko.md) · [日本語](AGENTS.ja.md))

## License

[MIT](LICENSE) © 2026 Jaeyun Jung (WolLu)
