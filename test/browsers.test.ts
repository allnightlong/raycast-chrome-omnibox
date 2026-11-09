import { test } from "node:test";
import assert from "node:assert/strict";
import { chromiumUserData, parseRegisteredBrowsers } from "../src/browsers.ts";

// Trimmed real `reg query HKLM\SOFTWARE\Clients\StartMenuInternet /s` output.
const REG = `
HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\Zen-ABC
    (Default)    REG_SZ    Zen

HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\Zen-ABC\\DefaultIcon
    (Default)    REG_SZ    "C:\\Program Files\\Zen Browser\\zen.exe",0

HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\Zen-ABC\\shell\\open\\command
    (Default)    REG_SZ    "C:\\Program Files\\Zen Browser\\zen.exe"

HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\IEXPLORE.EXE\\shell\\open\\command
    (Default)    REG_SZ    C:\\Program Files\\Internet Explorer\\iexplore.exe

HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\Microsoft Edge\\shell\\open\\command
    (Default)    REG_SZ    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"

HKEY_LOCAL_MACHINE\\SOFTWARE\\Clients\\StartMenuInternet\\Yandex.XYZ\\shell\\open\\command
    (Default)    REG_SZ    "C:\\Program Files\\Yandex\\YandexBrowser\\Application\\browser.exe"
`.replace(/\n/g, "\r\n");

const ROOTS = ["C:\\Users\\me\\AppData\\Local", "C:\\Program Files", "C:\\Program Files (x86)"];
const LOCAL = ROOTS[0];

test("reads only shell\\open\\command executables", () => {
  assert.deepEqual(parseRegisteredBrowsers(REG), [
    "C:\\Program Files\\Zen Browser\\zen.exe",
    "C:\\Program Files\\Internet Explorer\\iexplore.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
    "C:\\Program Files\\Yandex\\YandexBrowser\\Application\\browser.exe",
  ]);
});

test("Chromium installer layout maps exe to User Data; non-Chromium browsers are skipped", () => {
  const ud = (exe: string) => chromiumUserData(exe, ROOTS, LOCAL);
  assert.equal(ud("C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe"), `${LOCAL}\\Microsoft\\Edge\\User Data`);
  assert.equal(ud("C:\\Program Files\\Yandex\\YandexBrowser\\Application\\browser.exe"), `${LOCAL}\\Yandex\\YandexBrowser\\User Data`);
  assert.equal(ud(`${LOCAL}\\Google\\Chrome\\Application\\chrome.exe`), `${LOCAL}\\Google\\Chrome\\User Data`);
  assert.equal(ud("c:\\program files\\Vivaldi\\Application\\vivaldi.exe"), `${LOCAL}\\Vivaldi\\User Data`);
  assert.equal(ud("C:\\Program Files\\Zen Browser\\zen.exe"), undefined);
  assert.equal(ud("C:\\Program Files\\Internet Explorer\\iexplore.exe"), undefined);
  assert.equal(ud("D:\\Portable\\Thing\\Application\\x.exe"), undefined);
});
