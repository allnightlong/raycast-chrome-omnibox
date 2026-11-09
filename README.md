# Yandex Browser for Raycast

Address-bar style launcher for Yandex Browser on Windows. Hit a hotkey, type part of a site you've visited, press Enter.

- `you` → youtube.com, `t3.ch` → t3.chat, `gm` → Gmail — learned from your browser history, no aliases to maintain.
- Something that looks like an address (`habr.com`, `localhost:3000`) opens directly.
- Anything else goes to Google (configurable search URL with `%s`).

Ranking: prefix of the address > start of a host label or title word > substring; ties broken by visit count, typed count (×2) and recency. Pages of one site are collapsed into the site root, so a prefix lands on `t3.chat/`, not on some deep page.

## Install (Windows)

```powershell
npm install
npm run dev
```

Then in Raycast: Settings → Extensions → Yandex Browser → Open Site → Record Hotkey.

Preferences: profile folder (`Default`, `Profile 1`, …) and search URL.

## Develop

```bash
npm test        # ranking tests (node:test, no Raycast needed)
npm run lint
npm run build
```
