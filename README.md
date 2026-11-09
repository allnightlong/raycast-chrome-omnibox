# Chromium Omnibox for Raycast

Address-bar style launcher for Chromium browsers on Windows and macOS: Chrome, Edge, Brave, Yandex Browser, Vivaldi, Arc, Chromium and other forks. Hit a hotkey, type part of a site you've visited, press Enter.

- `you` → youtube.com, `t3.ch` → t3.chat, `gm` → Gmail — learned from your browser history, no aliases to maintain.
- Something that looks like an address (`habr.com`, `localhost:3000`) opens directly.
- Anything else goes to Google.
- Zero config: the browser and profile whose history was written most recently is the one you use, so that's the one searched and opened.
- Favicons come from the browser's own `Favicons` database; nothing is sent over the network.

### How browsers are found

- **Windows:** no list of browser names. A browser qualifies if Windows has it registered as a web browser (`HKCU`/`HKLM\SOFTWARE\Clients\StartMenuInternet`) *and* it uses Chromium's installer layout: `<Program Files or %LOCALAPPDATA%>\<base>\Application\<exe>` with profiles in `%LOCALAPPDATA%\<base>\User Data`. That excludes Firefox-based browsers and the many Electron/WebView2 apps that also carry a `Local State` file.
- **macOS:** known apps by name (Chrome, Edge, Brave, Yandex, Vivaldi, Arc, Chromium) — macOS has no equivalent registry tied to the data layout.

Ranking: prefix of the address > start of a host label or title word > substring; ties broken by visit count, typed count (×2) and recency. Pages of one site are collapsed into the site root, so a prefix lands on `t3.chat/`, not on some deep page.

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
