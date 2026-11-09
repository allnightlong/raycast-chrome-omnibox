import { Action, ActionPanel, closeMainWindow, environment, Icon, Image, List, open, popToRoot } from "@raycast/api";
import { executeSQL, useCachedPromise, useSQL } from "@raycast/utils";
import { spawn } from "child_process";
import { existsSync, mkdirSync, writeFileSync } from "fs";
import { join } from "path";
import { useEffect, useRef, useState } from "react";
import { findInstalls, Install, latestProfile } from "./browsers";
import { Row, Suggestion, suggest } from "./rank";

const SEARCH_URL = "https://www.google.com/search?q=%s";

async function openUrl(install: Install | undefined, url: string) {
  if (install?.exe) {
    // Exe comes from the OS browser registry; args without a shell, so the URL is never parsed as a command.
    spawn(install.exe, [url], { detached: true, stdio: "ignore" })
      .on("error", () => open(url))
      .unref();
  } else {
    await open(url, install?.app).catch(() => open(url));
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

export default function Command() {
  const [query, setQuery] = useState("");
  // Cached across launches, so the list shows instantly; re-detected in the background each time.
  const { data: profile, isLoading: detecting } = useCachedPromise(async () => latestProfile(await findInstalls()));
  const history = profile ? join(profile.dir, "History") : "";
  const { data, isLoading, permissionView } = useSQL<Row>(history, candidatesSql(query), { execute: !!profile });

  const items = suggest(query, data ?? [], SEARCH_URL);
  const favicons = useFavicons(profile?.dir, items);

  if (permissionView) return permissionView;

  return (
    <List
      filtering={false}
      onSearchTextChange={setQuery}
      isLoading={detecting || (!!profile && isLoading)}
      searchBarPlaceholder="Site or search query"
      throttle
    >
      {!detecting && !profile && <List.EmptyView title="No Chromium browser history found" />}
      {items.map((s) => (
        <List.Item
          key={`${s.kind}:${s.url}`}
          icon={icon(s, favicons)}
          title={s.title}
          subtitle={s.subtitle}
          actions={
            <ActionPanel>
              <Action
                title={`Open in ${profile?.install.name ?? "Browser"}`}
                icon={Icon.Globe}
                onAction={() => openUrl(profile?.install, s.url)}
              />
              <Action.CopyToClipboard title="Copy URL" content={s.url} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}
