# Contributing to QuickSlot

**English** · [한국어](CONTRIBUTING.ko.md) · [日本語](CONTRIBUTING.ja.md)

Thank you for helping. Bug reports, translations, new tools and fixes are all welcome.

## Before you start

- Read **[AGENTS.md](AGENTS.md)**. It holds every rule for code, design, translations, commits and pull
  requests, for people and AI coding agents alike.
- For a new tool or a large change, open an issue first so we can agree on the idea before you build it.
- Bugs and ideas go to [issues](https://github.com/wollu-dev/quick-slot/issues). Please include the browser,
  the language of the site and the steps to reproduce.

## How to send a change

1. Fork the repository and create a branch from the latest `main`, named like `feat/qr-code` or
   `fix/heic-orientation` (see AGENTS.md).
2. Make the change. Every text shown to users goes into the Korean, English and Japanese dictionaries.
3. Run `npm run check`, `npm test` and `npm run build`.
4. Open a pull request. The title follows Conventional Commits, and the description says what changed and how
   you checked it.
5. On your first pull request, the CLA bot asks you to sign the
   [Contributor License Agreement](CLA.md). Pull requests can be merged only after it is signed.

## License of your contribution

QuickSlot is source-available under the [Sustainable Use License](LICENSE.md), and paid features (files with
`.ee.` in their name or in `ee/` folders) are under the [QuickSlot Enterprise License](LICENSE_EE.md).

The [CLA](CLA.md) lets the project use your contribution under these licenses and under commercial licenses,
and change them later. **You keep the copyright** in what you wrote. Signing takes one click on GitHub.

## Code of conduct

Be kind and constructive. Criticize code, not people.
