import { Action, ActionPanel, closeMainWindow, getPreferenceValues, Icon, List, open, popToRoot } from "@raycast/api";
import { useSQL } from "@raycast/utils";
import { spawn } from "child_process";
import { existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { useState } from "react";
import { Row, Suggestion, suggest } from "./rank";

const localAppData = process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local");

// Every Chromium browser on Windows: <base>\User Data\<profile>\History and <base>\Application\<exe>.
// Keys must match the "browser" dropdown values in package.json.
const BROWSERS: Record<string, { base: string[]; exe: string }> = {
  chrome: { base: ["Google", "Chrome"], exe: "chrome.exe" },
  edge: { base: ["Microsoft", "Edge"], exe: "msedge.exe" },
  brave: { base: ["BraveSoftware", "Brave-Browser"], exe: "brave.exe" },
  yandex: { base: ["Yandex", "YandexBrowser"], exe: "browser.exe" },
  vivaldi: { base: ["Vivaldi"], exe: "vivaldi.exe" },
  chromium: { base: ["Chromium"], exe: "chrome.exe" },
};

const historyPath = (browser: string, profile: string) =>
  join(localAppData, ...BROWSERS[browser].base, "User Data", profile || "Default", "History");

// Per-user install first, then machine-wide.
const browserExe = (browser: string) =>
  [
    localAppData,
    process.env.ProgramFiles ?? "C:\\Program Files",
    process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)",
  ]
    .map((dir) => join(dir, ...BROWSERS[browser].base, "Application", BROWSERS[browser].exe))
    .find((p) => existsSync(p));

async function openInBrowser(browser: string, url: string) {
  const exe = browserExe(browser);
  if (exe) {
    // execFile-style args: no shell, so the URL is never parsed as a command.
    spawn(exe, [url], { detached: true, stdio: "ignore" }).unref();
  } else {
    await open(url);
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

export default function Command() {
  const { browser, profile, searchUrl } = getPreferenceValues<Preferences.Search>();
  const [query, setQuery] = useState("");
  const dbPath = historyPath(browser, profile);
  const installed = existsSync(dbPath);
  const { data, isLoading, permissionView } = useSQL<Row>(dbPath, candidatesSql(query), { execute: installed });

  if (permissionView) return permissionView;

  const items = suggest(query, data ?? [], searchUrl || "https://www.google.com/search?q=%s");

  return (
    <List
      filtering={false}
      onSearchTextChange={setQuery}
      isLoading={installed && isLoading}
      searchBarPlaceholder="Site or search query"
      throttle
    >
      {!installed && <List.EmptyView title="Browser history not found" description={dbPath} />}
      {items.map((s) => (
        <List.Item
          key={`${s.kind}:${s.url}`}
          icon={icon(s)}
          title={s.title}
          subtitle={s.subtitle}
          actions={
            <ActionPanel>
              <Action title="Open in Browser" icon={Icon.Globe} onAction={() => openInBrowser(browser, s.url)} />
              <Action.CopyToClipboard title="Copy URL" content={s.url} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
