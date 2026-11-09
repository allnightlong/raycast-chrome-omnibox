# Chromium Omnibox for Raycast

Address-bar style launcher for Chromium browsers on Windows and macOS: Chrome (Stable/Beta/Dev/Canary), Chromium, Edge, Brave, Yandex Browser, Vivaldi, Opera, Opera GX, Arc, Dia, Comet, Helium, ChatGPT Atlas, Cốc Cốc, Iridium, 360, QQ Browser, Sogou. Hit a hotkey, type part of a site you've visited, press Enter.

- `you` → youtube.com, `t3.ch` → t3.chat, `gm` → Gmail — learned from your browser history, no aliases to maintain.
- Something that looks like an address (`habr.com`, `localhost:3000`) opens directly.
- Anything else goes to Google.
- Zero config: the browser and profile whose history was written most recently is the one you use, so that's the one searched and opened.
- Favicons come from the browser's own `Favicons` database; nothing is sent over the network.

## Install (Windows)

```powershell
npm install
npm run dev
```

**From WSL (no Node on Windows):** `npm install && npm run dev:win`. It builds into the Windows profile's
`.config\raycast\extensions\` and pings Windows Raycast, which picks the extension up in its Development section.

Then in Raycast: Settings → Extensions → Chromium Omnibox → Open Site → Record Hotkey.

## Develop

```bash
npm test        # ranking tests (node:test, no Raycast needed)
npm run lint
npm run build
```
