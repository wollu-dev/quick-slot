# QuickSlot へのコントリビュート

[English](CONTRIBUTING.md) · [한국어](CONTRIBUTING.ko.md) · **日本語**

ご協力ありがとうございます。バグ報告、翻訳、新しいツール、修正、どれも歓迎です。

## 始める前に

- **[AGENTS.ja.md](AGENTS.ja.md)** をお読みください。コード・デザイン・翻訳・コミット・プルリクエストのルールが
  すべてあり、人にも AI コーディングエージェントにも適用されます。（原文: [AGENTS.md](AGENTS.md)、英語）
- 新しいツールや大きな変更は、まず Issue を立ててください。作る前に方向性をすり合わせましょう。
- バグやアイデアは [Issue](https://github.com/wollu-dev/quick-slot/issues) へ。ブラウザ、サイトの言語、再現手順を
  書いてください。

## 変更の送り方

1. リポジトリをフォークし、最新の `main` からブランチを作ります。名前は `feat/qr-code`、`fix/heic-orientation`
   のようにします（AGENTS 参照）。
2. 変更します。ユーザーに見える文言はすべて韓国語・英語・日本語の辞書に入れます。
3. `npm run check`、`npm test`、`npm run build` を実行します。
4. プルリクエストを開きます。タイトルは Conventional Commits 形式、説明には何を変え、どう確認したかを書きます。
5. 最初のプルリクエストで、CLA ボットが[コントリビューターライセンス契約（CLA）](CLA.md)への署名を求めます。
   署名後にマージできるようになります。

## コントリビュートしたコードのライセンス

QuickSlot はソースを公開した [Sustainable Use License](LICENSE.md) に従い、有料機能（名前に `.ee.` を含む
ファイルや `ee/` フォルダー）は [QuickSlot Enterprise License](LICENSE_EE.md) に従います。

[CLA](CLA.md) により、プロジェクトは皆さんのコントリビュートをこれらのライセンスと商用ライセンスで利用し、
将来ライセンスを変更できます。**著作権は皆さんに残ります。** 署名は GitHub 上でワンクリックです。

CLA は英語の原文のみが効力を持ちます。

## 行動規範

親切で建設的にお願いします。人ではなくコードを批評しましょう。
