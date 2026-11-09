// Finding installed Chromium browsers and the profile in use. No Raycast imports, so node --test can run it.
import { execFile } from "child_process";
import { existsSync, readdirSync, statSync } from "fs";
import { homedir } from "os";
import path from "path";
import { promisify } from "util";

export type Install = {
  name: string;
  userData: string; // Chromium "User Data" dir: contains "Local State" and one folder per profile
  exe?: string; // Windows: executable registered with the OS
  app?: string; // macOS: app name for open()
};
export type Profile = { install: Install; dir: string };

/** Executables from `reg query ...\Clients\StartMenuInternet /s`: the OS's own list of web browsers. */
export function parseRegisteredBrowsers(regOutput: string): string[] {
  const exes: string[] = [];
  let inCommand = false;
  for (const line of regOutput.split(/\r?\n/)) {
    if (/^HKEY_/i.test(line)) {
      inCommand = /\\shell\\open\\command$/i.test(line.trim());
      continue;
    }
    const value = inCommand && line.match(/REG_(?:EXPAND_)?SZ\s+(.+)$/)?.[1].trim();
    if (value) exes.push(value.startsWith('"') ? value.slice(1, value.indexOf('"', 1)) : value);
  }
  return exes;
}

/**
 * Chromium's Windows installer layout, shared by Chrome, Edge, Brave, Yandex, Vivaldi and other forks:
 * the exe lives in <root>\<base>\Application\ (root = Program Files or %LOCALAPPDATA%), and profiles
 * in %LOCALAPPDATA%\<base>\User Data. Anything else (Firefox, Zen, IE) is not Chromium and yields undefined.
 */
export function chromiumUserData(exe: string, roots: string[], localAppData: string): string | undefined {
  const w = path.win32;
  const appDir = w.dirname(exe);
  if (w.basename(appDir).toLowerCase() !== "application") return;
  const installDir = w.dirname(appDir);
  const root = roots.find((r) =>
    installDir.toLowerCase().startsWith(w.normalize(r).replace(/\\$/, "").toLowerCase() + "\\"),
  );
  return root && w.join(localAppData, w.relative(root, installDir), "User Data");
}

const run = promisify(execFile);

async function windowsInstalls(): Promise<Install[]> {
  const env = process.env;
  const local = env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local");
  const roots = [local, env.ProgramFiles, env["ProgramFiles(x86)"], env.ProgramW6432].filter((r): r is string => !!r);
  const keys = ["HKCU", "HKLM", "HKLM\\SOFTWARE\\WOW6432Node"].map((h) =>
    h.includes("\\") ? `${h}\\Clients\\StartMenuInternet` : `${h}\\SOFTWARE\\Clients\\StartMenuInternet`,
  );
  const outputs = await Promise.all(
    keys.map((k) =>
      run("reg", ["query", k, "/s"]).then(
        (r) => r.stdout,
        () => "",
      ),
    ),
  );
  const seen = new Set<string>();
  return outputs.flatMap(parseRegisteredBrowsers).flatMap((exe) => {
    const userData = chromiumUserData(exe, roots, local);
    if (!userData || seen.has(userData.toLowerCase()) || !existsSync(path.join(userData, "Local State"))) return [];
    seen.add(userData.toLowerCase());
    return [{ name: path.win32.basename(path.win32.dirname(path.win32.dirname(exe))), userData, exe }];
  });
}

// ponytail: macOS has no browser registry tied to the data layout, so known apps are listed by name.
// Add an entry when someone asks; Windows needs no list at all.
const MAC: [app: string, dataDir: string][] = [
  ["Google Chrome", "Google/Chrome"],
  ["Microsoft Edge", "Microsoft Edge"],
  ["Brave Browser", "BraveSoftware/Brave-Browser"],
  ["Yandex", "Yandex/YandexBrowser"],
  ["Vivaldi", "Vivaldi"],
  ["Arc", "Arc/User Data"],
  ["Chromium", "Chromium"],
];

function macInstalls(): Install[] {
  const support = path.join(homedir(), "Library", "Application Support");
  return MAC.map(([app, dir]) => ({ name: app, app, userData: path.join(support, dir) })).filter((i) =>
    existsSync(path.join(i.userData, "Local State")),
  );
}

export const findInstalls = async (): Promise<Install[]> =>
  process.platform === "win32" ? windowsInstalls() : macInstalls();

/**
 * The profile you actually use: most recently written History across every browser and profile.
 * A fixed priority would always pick Edge on Windows, since it's preinstalled.
 */
export function latestProfile(installs: Install[]): Profile | undefined {
  return installs
    .flatMap((install) => {
      let entries: string[];
      try {
        entries = readdirSync(install.userData);
      } catch {
        return [];
      }
      return entries
        .map((e) => path.join(install.userData, e))
        .filter((dir) => existsSync(path.join(dir, "History")))
        .map((dir) => ({ install, dir, mtime: statSync(path.join(dir, "History")).mtimeMs }));
    })
    .sort((a, b) => b.mtime - a.mtime)
    .map(({ install, dir }) => ({ install, dir }))[0];
}
