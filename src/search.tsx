import {
  Action,
  ActionPanel,
  closeMainWindow,
  environment,
  getApplications,
  Icon,
  Image,
  List,
  open,
  popToRoot,
} from "@raycast/api";
import { executeSQL, useSQL } from "@raycast/utils";
import { existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { useEffect, useRef, useState } from "react";
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
 * The browser + profile you actually use: every installed Chromium browser and profile
 * (Default, Profile 1, …) is a candidate, the one whose History was written most recently wins.
 * A fixed priority list would always pick Edge on Windows, since it's preinstalled.
 */
function detect(): { browser: Browser; dir: string } | undefined {
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
      .map((p) => join(userData, p))
      .filter((dir) => existsSync(join(dir, "History")))
      .map((dir) => ({ browser, dir, mtime: statSync(join(dir, "History")).mtimeMs }));
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

const sqlText = (s: string) => `'${s.replace(/'/g, "''")}'`;
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

const originOf = (url: string) => {
  try {
    return new URL(url).origin;
  } catch {
    return "";
  }
};

const FAVICON_DIR = join(environment.supportPath, "favicons");

/** Largest favicon per origin from the profile's own Favicons DB, cached as PNG files. Nothing leaves the machine. */
async function loadFavicons(profileDir: string, origins: string[]): Promise<Record<string, string>> {
  const db = join(profileDir, "Favicons");
  if (!existsSync(db)) return {};
  // page_url range instead of LIKE so the icon_mapping_page_url_idx index is used ('0' sorts right after '/').
  const perOrigin = origins.map(
    (o) => `SELECT * FROM (SELECT ${sqlText(o)} AS origin, b.id || '-' || (b.last_updated / 1000000) AS key,
              hex(b.image_data) AS data
            FROM icon_mapping m JOIN favicon_bitmaps b ON b.icon_id = m.icon_id
            WHERE m.page_url >= ${sqlText(o + "/")} AND m.page_url < ${sqlText(o + "0")}
            ORDER BY b.width DESC LIMIT 1)`,
  );
  const rows = await executeSQL<{ origin: string; key: string; data: string }>(db, perOrigin.join(" UNION ALL "));
  mkdirSync(FAVICON_DIR, { recursive: true });
  return Object.fromEntries(
    rows.map((r) => {
      const file = join(FAVICON_DIR, `${r.key}.png`);
      if (!existsSync(file)) writeFileSync(file, Buffer.from(r.data, "hex"));
      return [r.origin, file];
    }),
  );
}

function useFavicons(profileDir: string | undefined, items: Suggestion[]): Record<string, string> {
  const [icons, setIcons] = useState<Record<string, string>>({});
  const asked = useRef(new Set<string>());
  const missing = [...new Set(items.filter((s) => s.kind === "history").map((s) => originOf(s.url)))].filter(
    (o) => o && !asked.current.has(o),
  );
  useEffect(() => {
    if (!profileDir || missing.length === 0) return;
    missing.forEach((o) => asked.current.add(o));
    loadFavicons(profileDir, missing)
      .then((found) => setIcons((prev) => ({ ...prev, ...found })))
      .catch(() => undefined); // icons are cosmetic; generic globe stays
  }, [profileDir, missing.join("\n")]);
  return icons;
}

const icon = (s: Suggestion, favicons: Record<string, string>): Image.ImageLike =>
  s.kind === "search"
    ? Icon.MagnifyingGlass
    : s.kind === "url"
      ? Icon.Link
      : favicons[originOf(s.url)]
        ? { source: favicons[originOf(s.url)], fallback: Icon.Globe }
        : Icon.Globe;

const detected = detect();

export default function Command() {
  const [query, setQuery] = useState("");
  const history = detected ? join(detected.dir, "History") : "";
  const { data, isLoading, permissionView } = useSQL<Row>(history, candidatesSql(query), { execute: !!detected });

  const items = suggest(query, data ?? [], SEARCH_URL);
  const favicons = useFavicons(detected?.dir, items);

  if (permissionView) return permissionView;

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
          icon={icon(s, favicons)}
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
