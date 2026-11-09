import { Action, ActionPanel, closeMainWindow, getApplications, Icon, List, open, popToRoot } from "@raycast/api";
import { useSQL } from "@raycast/utils";
import { existsSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { useState } from "react";
import { Row, Suggestion, suggest } from "./rank";

const SEARCH_URL = "https://www.google.com/search?q=%s";

// Chromium "User Data" dir per OS (relative to %LOCALAPPDATA% / ~/Library/Application Support),
// and the app names Raycast knows the browser by (Start Menu / .app name).
type Browser = { names: string[]; win?: string[]; mac?: string[] };
const BROWSERS: Browser[] = [
  { names: ["Google Chrome"], win: ["Google", "Chrome", "User Data"], mac: ["Google", "Chrome"] },
  { names: ["Microsoft Edge"], win: ["Microsoft", "Edge", "User Data"], mac: ["Microsoft Edge"] },
  {
    names: ["Brave", "Brave Browser"],
    win: ["BraveSoftware", "Brave-Browser", "User Data"],
    mac: ["BraveSoftware", "Brave-Browser"],
  },
  {
    names: ["Yandex", "Yandex Browser", "Яндекс", "Яндекс Браузер"],
    win: ["Yandex", "YandexBrowser", "User Data"],
    mac: ["Yandex", "YandexBrowser"],
  },
  { names: ["Vivaldi"], win: ["Vivaldi", "User Data"], mac: ["Vivaldi"] },
  { names: ["Arc"], mac: ["Arc", "User Data"] },
  { names: ["Chromium"], win: ["Chromium", "User Data"], mac: ["Chromium"] },
];

const isWin = process.platform === "win32";
const appSupport = isWin
  ? (process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"))
  : join(homedir(), "Library", "Application Support");

/**
 * The History file of the browser + profile you actually use: every installed Chromium
 * browser and profile (Default, Profile 1, …) is a candidate, the most recently written wins.
 * A fixed priority list would always pick Edge on Windows, since it's preinstalled.
 */
function detect(): { browser: Browser; history: string } | undefined {
  const found = BROWSERS.flatMap((browser) => {
    const rel = isWin ? browser.win : browser.mac;
    if (!rel) return [];
    const userData = join(appSupport, ...rel);
    let profiles: string[];
    try {
      profiles = readdirSync(userData);
    } catch {
      return [];
    }
    return profiles
      .map((p) => join(userData, p, "History"))
      .filter((history) => existsSync(history))
      .map((history) => ({ browser, history, mtime: statSync(history).mtimeMs }));
  });
  return found.sort((a, b) => b.mtime - a.mtime)[0];
}

// Like the Zen reference: let the OS resolve the app by name instead of hardcoding an executable.
async function openInBrowser(browser: Browser | undefined, url: string) {
  const names = new Set(browser?.names.map((n) => n.toLowerCase()));
  const app = (await getApplications()).find((a) => names.has(a.name.toLowerCase()));
  try {
    await open(url, app);
  } catch {
    await open(url); // app found but refused the URL: system default browser still gets the user there
  }
  await closeMainWindow({ clearRootSearch: true });
  await popToRoot();
}

const escapeLike = (term: string) => term.replace(/'/g, "''").replace(/[\\%_]/g, "\\$&");

// Fetch candidates broadly, rank precisely in rank.ts.
function candidatesSql(query: string): string {
  const terms = query.trim().split(/\s+/).filter(Boolean);
  const where = terms
    .map((t) => `(url LIKE '%${escapeLike(t)}%' ESCAPE '\\' OR title LIKE '%${escapeLike(t)}%' ESCAPE '\\')`)
    .join(" AND ");
  // Chromium time is µs since 1601 and exceeds 2^53, so convert to unix ms inside SQLite.
  return `SELECT url, title, visit_count, typed_count, last_visit_time / 1000 - 11644473600000 AS last_visit_ms FROM urls
          WHERE hidden = 0 ${where ? `AND ${where}` : ""}
          ORDER BY visit_count DESC LIMIT 500;`;
}

// ponytail: generic icons; real favicons would need a favicon service (leaks history domains) or the browser's Favicons DB.
const icon = (s: Suggestion) =>
  s.kind === "search" ? Icon.MagnifyingGlass : s.kind === "url" ? Icon.Link : Icon.Globe;

const detected = detect();

export default function Command() {
  const [query, setQuery] = useState("");
  const { data, isLoading, permissionView } = useSQL<Row>(detected?.history ?? "", candidatesSql(query), {
    execute: !!detected,
  });

  if (permissionView) return permissionView;

  const items = suggest(query, data ?? [], SEARCH_URL);

  return (
    <List
      filtering={false}
      onSearchTextChange={setQuery}
      isLoading={!!detected && isLoading}
      searchBarPlaceholder="Site or search query"
      throttle
    >
      {!detected && (
        <List.EmptyView
          title="No Chromium browser history found"
          description={BROWSERS.map((b) => b.names[0]).join(", ")}
        />
      )}
      {items.map((s) => (
        <List.Item
          key={`${s.kind}:${s.url}`}
          icon={icon(s)}
          title={s.title}
          subtitle={s.subtitle}
          actions={
            <ActionPanel>
              <Action
                title={`Open in ${detected?.browser.names[0] ?? "Browser"}`}
                icon={Icon.Globe}
                onAction={() => openInBrowser(detected?.browser, s.url)}
              />
              <Action.CopyToClipboard title="Copy URL" content={s.url} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
