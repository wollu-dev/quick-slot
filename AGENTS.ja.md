# AGENTS.md（日本語）

[English](AGENTS.md) · [한국어](AGENTS.ko.md) · **日本語**

> このドキュメントは [AGENTS.md](AGENTS.md)（英語）の翻訳です。**基準は英語の原文**で、内容が異なる場合は原文に従います。

このリポジトリで作業するすべての人とAIエージェント（Claude Code、Codex、Cursor、Gemini、Copilot など）のための共通ルールです。
ツール別のファイル（`CLAUDE.md`、`GEMINI.md`、`.github/copilot-instructions.md`）は `AGENTS.md` を指すだけです。**ルールは `AGENTS.md` にだけ書きます。**

## プロジェクト

QuickSlot: ブラウザですぐ使える日常・開発ツール集。構成とツールの追加方法は [README.ja.md](README.ja.md) を参照。

- npm workspaces のモノレポ。ウェブサイトは `apps/web`（Astro 7 + React 19 islands + Tailwind 4）。バックエンド（`apps/api`）はまだありません。
- ツールの唯一の情報源は `apps/web/src/tools/registry.ts`。ツールの追加・状態変更はここから。
- 原則: ツールはすべての処理をブラウザ内で行う（`processing: 'client'`）。ユーザーのファイルをサーバーに送らない。本当にサーバーが必要なツールだけ `'server'` にする。

## リポジトリで使う言語

| 対象 | 言語 |
|---|---|
| コード、識別子、コメント、開発者向けメッセージ（ビルド警告、エラー） | **英語** |
| コミットメッセージ、PR のタイトル・説明、ブランチ名 | **英語** |
| ドキュメント（`README`、`AGENTS`） | **英語が原文**（`*.md`）、韓国語（`*.ko.md`）・日本語（`*.ja.md`）は翻訳 |
| ユーザーに表示するUI文言 | 韓国語・英語・日本語、i18n 辞書で（下記参照） |

- `README.md` や `AGENTS.md` を変更したら、`.ko.md`・`.ja.md` の翻訳も**同じ PR で**更新し、内容がずれないようにする。
- 製品データとしての韓国語はコードにあってよい: 韓国語辞書 `i18n/ko.ts`、`registry.ts` の韓国語検索 `keywords`。
- ドキュメント、コミットメッセージ、PR の説明は、飾らない率直な文章で書く。ダッシュ（—、——）はなるべく使わず、句点・読点・コロン・括弧で代える。

## 多言語対応（韓国語 · English · 日本語）

- **UIの文言をコードに直接書かない。** すべての文言はまず `apps/web/src/i18n/ko.ts` に入れ、`en.ts`・`ja.ts` に同じキーで翻訳する（キーが欠けると型エラー）。React では `useT()`、`.astro` では `getDict(lang)`。
- 文言内の強調は `**太字**`、`` `コード` `` で書き、`<Rich>` で描画する。文を断片に分けてつなげない（言語ごとに語順が違うため）。
- 数値・日付は `LANG_TAGS[lang]` で地域の形式に合わせる。数値を含む文言は辞書に関数として置く（例: `summary: (n) => …`）。
- ライブラリ（`lib/`）は文言ではなくコードを返し、画面側で翻訳する（例: `metadata.ts` の `ItemKind`、`MetadataError.code`）。
- 内部リンクは `localizePath(lang, path)` / `toolUrl(slug, lang)` で作る。`/tools/…` を直接書かない。
- React アイランドの最上位コンポーネントは `withI18n` で包み、Astro から `lang={lang}` を渡す。
- **ブラウザの言語で自動リダイレクトしない。** そうすると検索エンジンが他の言語のページを収集できなくなる。`LanguageSuggest` バナーは言語を「提案」するだけで、移動はユーザーが自分で選んだ言語（`quickslot:lang` の保存値）があるときだけ。クローラーにだけ違う内容を見せない（User-Agent 判定は禁止）。

## デプロイ

- **デプロイ方式: Docker イメージ → GitHub Container Registry（`ghcr.io`）→ セルフホスト。** 他のホスティング（GitHub Pages、Vercel、Netlify、Cloudflare Pages など）は使わないので、提案も設定もしない。
- **現状: まだ構築していない。** サービスが完成に近づいたら構築する。それまでに `Dockerfile` やイメージ公開のワークフローを追加しない。現在の自動化は CI（`.github/workflows/ci.yml`: 型チェックとビルド）だけ。
- 構築するときの方針: 2段階の `Dockerfile`（Node でビルド → nginx で静的な成果物だけを配信）、サイトURLは `ARG SITE_URL`。イメージの公開は `main` へのマージごとではなく、**バージョンタグ（`v*`）を push したときだけ**。
- **ドメインやURLをコードに書かない。** サイトURLはビルド環境変数 `SITE_URL` からのみ受け取る（`astro.config.mjs` → `Astro.site`）。絶対URLが必要なら `Astro.site` を使い、未設定のときは相対URLで動くようにする。
- プロジェクトのリンク（GitHub リポジトリ）と作者は、ルートの `package.json` の `repository`、`author` から取得する。画面のコードにURLを書かず、`apps/web/src/lib/project.ts` で読み込む。
- 環境変数を追加したら、`apps/web/.env.example` と README の「設定（Configuration）」表（3言語すべて）にも書く。

## デザインルール

無彩色の背景の上に、半透明のガラスの面。基準は `apps/web/src/styles/global.css`。

- **設定**: ヘッダー右の歯車 → 設定シート（`SettingsSheet`、iOS の設定のようなグループ化リスト）: 外観モード · クイックスロットの位置/サイズ · 言語。ユーザー設定はここにだけまとめる。
- **最初の描画前に適用**: テーマ（`data-theme`）、ドックの位置・サイズ（`data-dock`、`data-dock-size`）、言語のリダイレクトは `Layout.astro` の `<head>` インラインスクリプトが描画前に行う。その後の変更は `src/lib/theme.ts`、`src/lib/dock.ts`、`src/i18n` で行う。**保存キーとデフォルト値を両方そろえて直すこと。**
- **テーマ**: ライト / ダーク / 自動（デフォルト）。適用は `<html data-theme="light|dark">` だけ。CSS で `@media (prefers-color-scheme)` を使わず、ダークのスタイルは `[data-theme="dark"]` のトークンか Tailwind の `dark:` バリアントで作る。
- **ドック**: 配置・サイズ・拡大効果は `global.css` の `.dock*` ルールが `html[data-dock]` を見て決める。640px 未満では設定に関係なく下に小さく表示。ドックに隠れてはいけないページ最下部の要素には `.dock-safe`。
- **背景**: `global.css` の `body::before` だけで描く：無彩色の上から下への濃淡（`bg-top` → `bg-bottom`）+ 細かいノイズの質感。色のついたグラデーション・色のにじみ・パターンは入れない。ページごとに背景を敷かない。
- **色**: トークンだけを使う：`bg`、`panel`、`panel-2`、`line`、`fg`、`muted`、`accent`、`accent-fg`、`danger`、`ok`。色のハードコード禁止（例外: `registry.ts` のカテゴリタイルの色、設定の外観プレビュー）。
- **面**: カード・パネルは `panel`（= `glass` + 角丸）、検索ウィンドウは `glass-strong`、文字を読む浮いたウィンドウ（メニュー、設定シート）は `glass-menu`（より不透明）。大きな `textarea.input` は自動でガラスの面になる。
- **コントロール**: ボタン `btn` / `btn-primary` / `btn-tinted`、入力 `input`、ラベル `label`。選択肢が2〜3個なら `Segmented`、それ以上は `Select` コンポーネント。**ブラウザ標準の `<select>` は使わない**（開いたリストを装飾できない）。チェックボックスは CSS で自動的にスイッチの見た目になる。
- **テキストの入力・出力エリア**: `TextPanel` コンポーネントを使う（上のヘッダー行にタイトルとボタン、その下にテキストエリア）。コピーなどのボタンをテキストエリアの上に浮かせない。長い文章がボタンの下を通って重なるため。
- **高さ**: 1行のコントロール（ボタン、入力、`Select`、`Segmented`）はすべて 36px（`h-9`）。
- **アイコン**: `lucide-react` の線アイコンだけ。**絵文字をUIアイコンとして使わない。** ツールのアイコンは `AppIcon`（カテゴリ色のタイル）。
- **角**: カード 22px、大きな領域 26px、ボタン・バッジは完全な角丸（pill）。`rounded-sm/md/lg` のような角ばった角は使わない。
- **注意**: `backdrop-filter` がかかった要素内の `position: fixed` の子は、画面ではなくその要素を基準に配置される。モーダル・オーバーレイは `createPortal(…, document.body)` で表示する。
- **レイアウト**: ヘッダーは左にロゴ、右に検索と設定。クイックスロットのドック（`Dock`）は全ページに固定。ページごとに検索を開くボタンを別に作らない。検索関連の文言は辞書キー `header.search` ひとつに統一。
- **配置**: 本文はカードグリッドの左端にそろえる。中央寄せの要素を縦にいくつも積まない（下に行くほど広がるピラミッドになる）。
- **グリッド**: カードグリッドには列数を明示する（例: `grid-cols-1`。しないとモバイルで長い文字が画面からはみ出る）。
- 変更後は、ライト・ダーク、モバイル幅（390px）、3言語（特に文言が長い英語・日本語）で確認する。

## コマンド

```bash
npm install
npm run check    # 型チェック（変更後は必ず実行）
npm run build    # ビルド（変更後は必ず実行）
npm run dev      # 開発サーバー（http://localhost:4321）
```

エージェントが開発サーバーを起動するときはバックグラウンドで: `apps/web` で `npx astro dev --background`、停止は `npx astro dev stop`。

## Git ワークフロー（GitHub Flow）

- `main` は常にデプロイ可能な状態。**`main` に直接コミット・push しない。** すべての変更はブランチ → PR → squash merge。
- 作業前に最新の `main` からブランチを作る。1ブランチに1作業（1ツール）。
- マージ済みのブランチは削除する。
- PR は1つずつマージし、新しい作業は更新された `main` から始める。PR の上に PR を積むと、squash merge の後に衝突する。

### ブランチ名: `種類/短い説明`

| 接頭辞 | 用途 | 例 |
|---|---|---|
| `feat/` | 新しいツール・機能 | `feat/qr-code` |
| `fix/` | バグ修正 | `fix/heic-orientation` |
| `refactor/` | 動作を変えない構造の改善 | `refactor/dropzone` |
| `docs/` | ドキュメント | `docs/contributing` |
| `chore/` | 設定、依存関係、CI | `chore/ci-build` |

- 小文字とハイフン（-）だけ。
- ツールのブランチは `registry.ts` の slug に合わせる（`feat/qr-code` ↔ slug `qr-code`）。

### コミットメッセージ: Conventional Commits

```
<type>(<scope>): <summary>

<body: 何を、なぜ（任意）>
```

- 種類: `feat`、`fix`、`refactor`、`docs`、`chore`、`test`、`style`、`perf`
- スコープ（任意）: ツールの slug や領域。例: `feat(qr-code): add QR code generator`、`fix(json-formatter): fix error position calculation`
- 要約は**英語**、命令形、50文字以内、末尾にピリオドなし。

### プルリクエスト

- タイトルはコミットメッセージと同じ形式（squash merge でそのままコミットのタイトルになる）。
- 説明には、何を変えたか、どう確認したか（実行したコマンド、確認した画面）を書く。
- CI（`check`、`build`）が通らないとマージできない。
