import { app } from "electron";
import { appendFileSync, existsSync, mkdirSync, renameSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Crash and error journal: userData/logs/harvest-desk.log, rotated at 1 MB.
 * Anything that looks like an API key is masked before it is written.
 */
const MAX = 1_000_000;
let secrets: string[] = [];

export const logDir = () => join(app.getPath("userData"), "logs");
export const logFile = () => join(logDir(), "harvest-desk.log");

/** Values that must never reach the log (the API key). */
export function setSecrets(list: string[]) { secrets = list.filter((s) => s && s.length >= 6); }

function mask(text: string) {
  let out = text;
  for (const s of secrets) out = out.split(s).join("***");
  return out.replace(/(x-api-key["':\s]+)[^\s"',}]+/gi, "$1***");
}

function fmt(v: unknown): string {
  if (v instanceof Error) return `${v.name}: ${v.message}\n${v.stack ?? ""}`;
  if (typeof v === "string") return v;
  try { return JSON.stringify(v); } catch { return String(v); }
}

export function log(level: "info" | "warn" | "error", where: string, ...parts: unknown[]) {
  try {
    if (!existsSync(logDir())) mkdirSync(logDir(), { recursive: true });
    const f = logFile();
    if (existsSync(f) && statSync(f).size > MAX) renameSync(f, f + ".old");
    const line = `${new Date().toISOString()} [${level}] ${where}: ${mask(parts.map(fmt).join(" "))}\n`;
    appendFileSync(f, line);
    if (level === "error") console.error(line.trimEnd());
  } catch { /* the log must never crash the app */ }
}

/** Catches what would otherwise kill the main process silently. */
export function installCrashHandlers() {
  process.on("uncaughtException", (e) => log("error", "main uncaughtException", e));
  process.on("unhandledRejection", (e) => log("error", "main unhandledRejection", e));
  app.on("render-process-gone", (_e, _wc, d) => log("error", "renderer gone", d));
  app.on("child-process-gone", (_e, d) => log("error", "child process gone", d));
  log("info", "start", `Harvest Desk ${app.getVersion()} · Electron ${process.versions.electron} · ${process.platform} ${process.arch}`);
}
