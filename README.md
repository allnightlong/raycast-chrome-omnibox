<p align="center">
  <img src="assets/icon.png" width="128" height="128" alt="Chromium Omnibox icon">
</p>

<h1 align="center">Chromium Omnibox</h1>

<p align="center">
  Your browser's address bar, one hotkey away — in <a href="https://www.raycast.com">Raycast</a>.
</p>

<p align="center">
  <a href="https://github.com/allnightlong/raycast-chromium-omnibox/actions/workflows/ci.yml"><img src="https://github.com/allnightlong/raycast-chromium-omnibox/actions/workflows/ci.yml/badge.svg" alt="CI"></a>
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS-blue" alt="Platforms: Windows, macOS">
  <a href="LICENSE"><img src="https://img.shields.io/github/license/allnightlong/raycast-chromium-omnibox" alt="MIT license"></a>
</p>

<!-- Uncomment once the extension is live in the Store:
<p align="center">
  <a href="https://www.raycast.com/allnightlong/chromium-omnibox"><img src="https://www.raycast.com/allnightlong/chromium-omnibox/install_button@2x.png?v=1.1" height="64" alt="Install Chromium Omnibox in Raycast"></a>
</p>
-->

Hit a hotkey from any app, type a few letters of a site you've been to, press <kbd>Enter</kbd> — it opens in your browser. No aliases, no quicklinks to maintain: everything is learned from your browser history.

| You type | You get |
| --- | --- |
| `you` | youtube.com |
| `cla` | claude.ai |
| `gm` | Gmail |
| `habr.com`, `localhost:3000` | opened directly |
| `how to cook rice` | Google search |

## Features

- **One step.** The best guess is already selected; <kbd>Enter</kbd> does the right thing. Web search is always the next item.
- **Ranks like an address bar.** Address prefix beats a word match beats a substring; ties go to the sites you visit and type most, and visited recently. Pages of one site collapse into the site itself, so `cla` lands on `claude.ai/`, not on some old chat.
- **Zero config.** Finds every installed Chromium browser and profile and uses the one whose history was written most recently — the one you actually use.
- **Private.** History and favicons are read from the browser's local databases. Nothing is sent anywhere.

## Supported browsers

| | Windows | macOS |
| --- | :---: | :---: |
| Google Chrome (Stable, Beta, Dev, Canary), Chromium | ✓ | ✓ |
| Microsoft Edge, Brave, Vivaldi, Yandex Browser | ✓ | ✓ |
| Opera, Opera GX, Comet, Helium, Cốc Cốc | ✓ | ✓ |
| Arc, Dia, ChatGPT Atlas, Iridium | | ✓ |
| 360 Speed (X), QQ Browser, Sogou Explorer | ✓ | |

Missing yours? Open an issue with the browser name and its `chrome://version` → *Profile Path*.

## Setup

Assign a hotkey: Raycast Settings → Extensions → Chromium Omnibox → Open Site → Record Hotkey. <kbd>Ctrl</kbd>+<kbd>Alt</kbd>+<kbd>Space</kbd> (Windows) or <kbd>⌥</kbd>+<kbd>Space</kbd> (macOS) rarely clash with other apps.

## Development

```bash
npm install
npm run dev     # load into Raycast in development mode
npm test        # ranking tests (node:test, no Raycast needed)
npm run lint
npm run build
```

**Windows Raycast, toolchain in WSL:** `npm run dev:win` builds into the Windows profile's `.config\raycast\extensions\` and Windows Raycast picks it up in its Development section — no Node needed on Windows.

**Publishing:** `npm run publish` locally, or Actions → *Publish to Raycast Store* → Run workflow (needs repo secret `RAYCAST_PUBLISH_TOKEN`: classic PAT with `repo` scope). Either way it opens or updates the PR in [raycast/extensions](https://github.com/raycast/extensions).

## License

[MIT](LICENSE)
