# Chromium Omnibox for Raycast

Address-bar style launcher for Chromium browsers on Windows: Chrome, Edge, Brave, Yandex Browser, Vivaldi, Chromium. Hit a hotkey, type part of a site you've visited, press Enter.

- `you` → youtube.com, `t3.ch` → t3.chat, `gm` → Gmail — learned from your browser history, no aliases to maintain.
- Something that looks like an address (`habr.com`, `localhost:3000`) opens directly.
- Anything else goes to Google (configurable search URL with `%s`).

Ranking: prefix of the address > start of a host label or title word > substring; ties broken by visit count, typed count (×2) and recency. Pages of one site are collapsed into the site root, so a prefix lands on `t3.chat/`, not on some deep page.

## Install (Windows)

```powershell
npm install
npm run dev
```

**From WSL (no Node on Windows):** `npm install && npm run dev:win`. It builds into the Windows profile's
`.config\raycast\extensions\` and pings Windows Raycast, which picks the extension up in its Development section.

Then in Raycast: Settings → Extensions → Chromium Omnibox → pick your **Browser**, then Open Site → Record Hotkey.

Preferences: browser, profile folder (`Default`, `Profile 1`, …), search URL.

## Develop

```bash
npm test        # ranking tests (node:test, no Raycast needed)
npm run lint
npm run build
```
