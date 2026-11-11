import { app, BrowserWindow, ipcMain, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { parseMarket } from "../src/core/market";
import type { AppState, Settings, Snapshot } from "../src/shared/types";
import { SflClient, cleanKey, snapshotFromDump, trimActivity } from "./sfl";

const FARM_EVERY = 10 * 60_000;
const MARKET_EVERY = 6 * 3_600_000;
const KEEP_DAYS = 35;

const dir = () => app.getPath("userData");
const file = (n: string) => join(dir(), n);
function readJson<T>(n: string, fallback: T): T {
  try { return JSON.parse(readFileSync(file(n), "utf8")); } catch { return fallback; }
}
function writeJson(n: string, v: unknown) {
  if (!existsSync(dir())) mkdirSync(dir(), { recursive: true });
  writeFileSync(file(n), JSON.stringify(v));
}

/** Settings live in the user's app data folder. The env variables are a fallback for developers. */
function settings(): Settings {
  const s = readJson<Partial<Settings>>("settings.json", {});
  return {
    apiKey: cleanKey(s.apiKey || process.env.SFL_API_KEY || ""),
    farmId: s.farmId || process.env.SFL_FARM_ID || "",
    apiBase: s.apiBase || process.env.SFL_API_BASE || "https://api.sunflower-land.com",
  };
}

let state: AppState = { mode: "live", status: "idle", snapshots: readJson<Snapshot[]>("snapshots.json", []) };
let marketAt = 0;
let win: BrowserWindow | null = null;

function publish(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  win?.webContents.send("state", state);
  return state;
}

function addSnapshot(s: Snapshot) {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const list = [...state.snapshots.filter((x) => x.at !== s.at && x.at > cutoff), s].sort((a, b) => a.at - b.at);
  writeJson("snapshots.json", list);
  return list;
}

let running: Promise<AppState> | null = null;
function refresh(): Promise<AppState> {
  if (running) return running;
  running = (async () => {
    const s = settings();
    if (!s.apiKey || !s.farmId) return publish({ status: "needs-setup" });
    publish({ status: "loading", error: undefined });
    try {
      const client = new SflClient(s.apiBase, s.apiKey);
      const res = await client.farm(s.farmId);
      const snapshots = addSnapshot({ at: Date.now(), farmActivity: trimActivity(res.farm.farmActivity ?? {}) });
      let market = state.market ?? readJson("market.json", undefined);
      if (!market || Date.now() - marketAt > MARKET_EVERY) {
        market = parseMarket(await client.marketplace());
        marketAt = Date.now();
        writeJson("market.json", market);
      }
      return publish({
        status: "ready", farm: res.farm, farmId: Number(res.id), username: res.farm.username,
        fetchedAt: new Date().toISOString(), snapshots, market,
      });
    } catch (e) {
      return publish({ status: "error", error: (e as Error).message });
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Fills the history from the oldest and newest nightly dumps (kept 7 days by the game). */
async function importHistory(): Promise<AppState> {
  const s = settings();
  if (!s.apiKey || !s.farmId) return publish({ status: "needs-setup" });
  publish({ importing: true, error: undefined });
  try {
    const list = (await new SflClient(s.apiBase, s.apiKey).dumps()).data
      .map((d) => d.filename).filter((f) => f.endsWith("/active.jsonl.gz")).sort();
    const picks = [...new Set([list[0], list[list.length - 1]])].filter(Boolean);
    let snapshots = state.snapshots;
    for (const f of picks) {
      const snap = await snapshotFromDump(f, s.farmId);
      if (snap) { state.snapshots = snapshots = addSnapshot(snap); }
    }
    return publish({ importing: false, snapshots });
  } catch (e) {
    return publish({ importing: false, error: (e as Error).message });
  }
}

function createWindow() {
  win = new BrowserWindow({
    width: 1200, height: 940, minWidth: 420, minHeight: 600,
    backgroundColor: "#120d0f", title: "Harvest Desk", autoHideMenuBar: true,
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("state:get", () => state);
  ipcMain.handle("state:refresh", () => refresh());
  ipcMain.handle("history:import", () => importHistory());
  ipcMain.handle("settings:get", () => {
    const { apiKey, ...rest } = settings();
    return { ...rest, hasKey: !!apiKey };
  });
  ipcMain.handle("settings:save", (_e, patch: Partial<Settings>) => {
    const cur = readJson<Partial<Settings>>("settings.json", {});
    const next = { ...cur, ...Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined && v !== "")) };
    if (next.apiKey) next.apiKey = cleanKey(next.apiKey);
    writeJson("settings.json", next);
    return refresh();
  });
  ipcMain.on("open", (_e, url: string) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

  createWindow();
  refresh().then((s) => {
    const span = s.snapshots.length > 1 ? s.snapshots[s.snapshots.length - 1].at - s.snapshots[0].at : 0;
    if (s.status === "ready" && span < 86_400_000) importHistory();
  });
  setInterval(refresh, FARM_EVERY);
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
