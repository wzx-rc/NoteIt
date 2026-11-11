/**
 * Electron's own installer downloads its zip, then unzips it with extract-zip.
 * On Windows with recent Node versions the unzip step can stop after one file,
 * leaving no electron.exe. This finishes the job from the zip already in the cache,
 * using the tar that ships with Windows 10 and later.
 */
import { existsSync, readdirSync, rmSync, mkdirSync, writeFileSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";

if (process.platform !== "win32") process.exit(0);
const require = createRequire(import.meta.url);
const dir = dirname(require.resolve("electron/package.json"));
const exe = join(dir, "dist", "electron.exe");
if (existsSync(exe) && existsSync(join(dir, "path.txt"))) process.exit(0);

const { version } = require("electron/package.json");
const name = `electron-v${version}-win32-${process.arch}.zip`;
const cache = process.env.electron_config_cache ?? join(process.env.LOCALAPPDATA ?? join(homedir(), "AppData", "Local"), "electron", "Cache");
const find = (d) => {
  if (!existsSync(d)) return undefined;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (e === name) return p;
    if (statSync(p).isDirectory()) { const f = find(p); if (f) return f; }
  }
};
const zip = find(cache);
if (!zip) {
  console.error(`Electron ${version} n'est pas dans le cache (${cache}). Relance : node node_modules/electron/install.js`);
  process.exit(1);
}
console.log(`Décompression d'Electron ${version} depuis ${zip}`);
rmSync(join(dir, "dist"), { recursive: true, force: true });
mkdirSync(join(dir, "dist"));
execFileSync("tar", ["-xf", zip, "-C", join(dir, "dist")], { stdio: "inherit" });
writeFileSync(join(dir, "path.txt"), "electron.exe");
console.log("Electron est prêt.");
