import { app, BrowserWindow, ipcMain, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Market } from "../src/core/engine";
import type { Farm, Order } from "../src/core/farm";
import { type FarmMeta, ledgerFromMetas, metaOf, thinMetas } from "../src/core/ledger";
import { parseMarket } from "../src/core/market";
import type { AppState, ManualEntry, Settings, Snapshot } from "../src/shared/types";
import { SflClient, cleanKey, farmFromDump, trimActivity } from "./sfl";

const FARM_EVERY = 10 * 60_000;
const MARKET_EVERY = 6 * 3_600_000;
const KEEP_DAYS = 35;
const HOUR = 3_600_000;
const MAX_ORDERS = 3000;

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

let metas = readJson<FarmMeta[]>("metas.json", []);
let manual = readJson<(ManualEntry & { id: string })[]>("manual.json", []);
let orders = readJson<Order[]>("orders.json", []);

/** Ledger = moves found between readings + moves typed by hand. */
function ledger() {
  const auto = ledgerFromMetas(metas);
  const hand = manual.map((m) => ({ id: m.id, at: m.at, kind: "manual" as const, usd: m.usd, label: m.label }));
  return [...auto, ...hand].sort((a, b) => b.at - a.at);
}

let state: AppState = {
  mode: "live", status: "idle", snapshots: readJson<Snapshot[]>("snapshots.json", []),
  orders, ledger: ledger(),
};
let marketAt = 0;
let win: BrowserWindow | null = null;

function publish(patch: Partial<AppState>) {
  state = { ...state, ...patch };
  win?.webContents.send("state", state);
  return state;
}

/** Keeps one counters snapshot per hour over the last 35 days. */
function addSnapshot(s: Snapshot) {
  const cutoff = Date.now() - KEEP_DAYS * 86_400_000;
  const list = [...state.snapshots.filter((x) => x.at > cutoff && Math.floor(x.at / HOUR) !== Math.floor(s.at / HOUR)), s]
    .sort((a, b) => a.at - b.at);
  writeJson("snapshots.json", list);
  return list;
}

/** Stores what one farm reading tells: counters, ledger reading, delivery orders. */
function record(at: number, farm: Farm & { farmActivity?: Record<string, number> }, market: Market) {
  const snapshots = addSnapshot({ at, farmActivity: trimActivity(farm.farmActivity ?? {}) });
  metas = thinMetas([...metas.filter((m) => m.at !== at), metaOf(farm, at, market)], Date.now());
  writeJson("metas.json", metas);
  const byId = new Map(orders.map((o) => [o.id, o]));
  for (const o of farm.delivery?.orders ?? []) if (Object.keys(o.items ?? {}).length) byId.set(o.id, o);
  orders = [...byId.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, MAX_ORDERS);
  writeJson("orders.json", orders);
  state.snapshots = snapshots;
  return { snapshots, orders, ledger: ledger() };
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
      let market: Market | undefined = state.market ?? readJson<Market | undefined>("market.json", undefined);
      if (!market || Date.now() - marketAt > MARKET_EVERY) {
        market = parseMarket(await client.marketplace());
        marketAt = Date.now();
        writeJson("market.json", market);
      }
      return publish({
        status: "ready", farm: res.farm, farmId: Number(res.id), username: res.farm.username,
        fetchedAt: new Date().toISOString(), market, ...record(Date.now(), res.farm, market),
      });
    } catch (e) {
      return publish({ status: "error", error: (e as Error).message });
    } finally {
      running = null;
    }
  })();
  return running;
}

/**
 * Fills the history from the nightly dumps the game keeps (7 days), one day at a time.
 * Each dump is about 800 MB: it is streamed and only this farm's row is kept.
 */
async function importHistory(): Promise<AppState> {
  const s = settings();
  if (!s.apiKey || !s.farmId) return publish({ status: "needs-setup" });
  if (!state.market) return publish({ error: "Actualise la ferme une fois avant de remplir l'historique." });
  publish({ importing: true, error: undefined });
  try {
    const list = (await new SflClient(s.apiBase, s.apiKey).dumps()).data
      .map((d) => d.filename).filter((f) => f.endsWith("/active.jsonl.gz")).sort();
    for (const f of list) {
      const row = await farmFromDump(f, s.farmId);
      if (row) publish(record(row.at, row.farm, state.market));
    }
    return publish({ importing: false });
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
  ipcMain.handle("ledger:add", (_e, m: ManualEntry) => {
    if (!m || !Number.isFinite(m.usd) || !Number.isFinite(m.at) || typeof m.label !== "string") return state;
    manual = [...manual, { id: `m-${Date.now()}`, at: m.at, usd: m.usd, label: m.label.slice(0, 120) }];
    writeJson("manual.json", manual);
    return publish({ ledger: ledger() });
  });
  ipcMain.handle("ledger:remove", (_e, id: string) => {
    manual = manual.filter((m) => m.id !== id);
    writeJson("manual.json", manual);
    return publish({ ledger: ledger() });
  });
  ipcMain.on("open", (_e, url: string) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

  createWindow();
  refresh().then((s) => {
    const span = s.snapshots.length > 1 ? s.snapshots[s.snapshots.length - 1].at - s.snapshots[0].at : 0;
    if (s.status === "ready" && span < 2 * 86_400_000) importHistory();
  });
  setInterval(refresh, FARM_EVERY);
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
