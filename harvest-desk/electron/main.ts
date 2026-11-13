import { app, BrowserWindow, ipcMain, nativeTheme, Notification, screen, shell } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Market } from "../src/core/engine";
import type { Farm, Order } from "../src/core/farm";
import { type FarmMeta, ledgerFromMetas, metaOf, thinMetas } from "../src/core/ledger";
import { parseMarket } from "../src/core/market";
import type { AppState, ManualEntry, Settings, Snapshot, WidgetConfig } from "../src/shared/types";
import { farmTimers, TIMER_GROUPS, type TimerGroup } from "../src/core/timers";
import { SflClient, cleanKey, farmFromDump, trimActivity } from "./sfl";
import { installCrashHandlers, log, logDir, setSecrets } from "./log";

// Same data folder for `npm start` and the installed app (the installer may rename the app).
app.setPath("userData", join(app.getPath("appData"), "harvest-desk"));
installCrashHandlers();
// Windows shows notifications only for an app with an id (the installer's appId).
if (process.platform === "win32") app.setAppUserModelId("com.wzx.harvestdesk");

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
  const out = {
    apiKey: cleanKey(s.apiKey || process.env.SFL_API_KEY || ""),
    farmId: String(s.farmId || process.env.SFL_FARM_ID || "").trim(),
    apiBase: (s.apiBase || process.env.SFL_API_BASE || "https://api.sunflower-land.com").trim().replace(/\/+$/, ""),
  };
  setSecrets([out.apiKey]);
  return out;
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
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("state", state);
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
/**
 * `full` also re-reads the marketplace prices, which are otherwise kept 6 hours.
 * `running` is cleared after the promise is stored: when the job ends without awaiting
 * (no key yet), clearing it inside the job would run first and leave a stale promise forever.
 */
function refresh(full = false): Promise<AppState> {
  if (running) return full ? running.then(() => refresh(true)) : running;
  const job = refreshNow(full);
  running = job;
  job.finally(() => { if (running === job) running = null; });
  return job;
}

async function refreshNow(full: boolean): Promise<AppState> {
  {
    const s = settings();
    if (!s.apiKey || !s.farmId) {
      log("info", "refresh", `needs setup (key: ${s.apiKey ? "yes" : "no"}, farm: ${s.farmId || "none"})`);
      return publish({ status: "needs-setup" });
    }
    publish({ status: "loading", error: undefined });
    try {
      const client = new SflClient(s.apiBase, s.apiKey);
      const res = await client.farm(s.farmId);
      let market: Market | undefined = state.market ?? readJson<Market | undefined>("market.json", undefined);
      if (full || !market || Date.now() - marketAt > MARKET_EVERY) {
        market = parseMarket(await client.marketplace());
        marketAt = Date.now();
        writeJson("market.json", market);
      }
      return publish({
        status: "ready", farm: res.farm, farmId: Number(res.id), username: res.farm.username,
        fetchedAt: new Date().toISOString(), market, ...record(Date.now(), res.farm, market),
      });
    } catch (e) {
      log("error", "refresh", e);
      return publish({ status: "error", error: (e as Error).message });
    }
  }
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
    // The index can list a dump that has already expired (403): skip it, keep the others.
    let found = 0;
    for (const f of list) {
      try {
        const row = await farmFromDump(f, s.farmId);
        if (row) { found++; publish(record(row.at, row.farm, state.market)); }
      } catch (e) {
        log("warn", "importHistory", `${f} ignoré : ${(e as Error).message}`);
      }
    }
    if (!found) return publish({ importing: false, error: "Aucune sauvegarde du jeu n'a pu être lue. L'historique se remplira avec les relevés de l'app, un toutes les 10 minutes." });
    return publish({ importing: false });
  } catch (e) {
    log("error", "importHistory", e);
    return publish({ importing: false, error: (e as Error).message });
  }
}

// ---------- Desktop widget ----------

type WidgetFile = WidgetConfig & { bounds?: { x: number; y: number; width: number; height: number } };
const WIDGET_DEFAULT: WidgetFile = {
  groups: ["crops", "greenhouse", "trees", "stone", "iron", "gold", "sheep", "cooking", "power"],
  notify: [], open: false, opacity: 0.92, onTop: false,
};
let widgetCfg: WidgetFile = { ...WIDGET_DEFAULT, ...readJson<Partial<WidgetFile>>("widget.json", {}) };
let widget: BrowserWindow | null = null;
let quitting = false;

const publicWidget = (): WidgetConfig => {
  const { bounds: _b, ...rest } = widgetCfg;
  return rest;
};

function saveWidget(patch: Partial<WidgetFile>) {
  widgetCfg = { ...widgetCfg, ...patch };
  writeJson("widget.json", widgetCfg);
}

function setWidget(patch: Partial<WidgetConfig>): WidgetConfig {
  const clean: Partial<WidgetConfig> = {};
  const known = new Set(TIMER_GROUPS.map((g) => g.key));
  if (Array.isArray(patch.groups)) clean.groups = patch.groups.filter((g) => known.has(g));
  if (Array.isArray(patch.notify)) clean.notify = patch.notify.filter((g) => known.has(g));
  if (typeof patch.opacity === "number") clean.opacity = Math.min(1, Math.max(0.4, patch.opacity));
  if (typeof patch.onTop === "boolean") clean.onTop = patch.onTop;
  if (typeof patch.open === "boolean") clean.open = patch.open;
  saveWidget(clean);
  if (clean.open === true) openWidget();
  if (clean.open === false) widget?.close();
  if (clean.onTop !== undefined) widget?.setAlwaysOnTop(clean.onTop, "floating");
  for (const w of BrowserWindow.getAllWindows()) w.webContents.send("widget", publicWidget());
  return publicWidget();
}

/** Small frameless, see-through window for the desktop. Remembers where it was left. */
function openWidget() {
  if (widget) { widget.showInactive(); return; }
  const area = screen.getPrimaryDisplay().workArea;
  const b = widgetCfg.bounds ?? { width: 300, height: 560, x: area.x + area.width - 320, y: area.y + 20 };
  widget = new BrowserWindow({
    ...b, minWidth: 220, minHeight: 120,
    frame: false, transparent: true, backgroundColor: "#00000000", hasShadow: false,
    resizable: true, maximizable: false, fullscreenable: false, skipTaskbar: true,
    alwaysOnTop: widgetCfg.onTop, title: "Harvest Desk widget", show: false,
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  widget.once("ready-to-show", () => widget?.showInactive());
  let t: NodeJS.Timeout | undefined;
  const keep = () => { clearTimeout(t); t = setTimeout(() => widget && saveWidget({ bounds: widget.getBounds() }), 400); };
  widget.on("move", keep);
  widget.on("resize", keep);
  widget.on("closed", () => {
    widget = null;
    if (!quitting) { saveWidget({ open: false }); for (const w of BrowserWindow.getAllWindows()) w.webContents.send("widget", publicWidget()); }
  });
  widget.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  if (process.env.VITE_DEV_SERVER_URL) widget.loadURL(process.env.VITE_DEV_SERVER_URL + "#widget");
  else widget.loadFile(join(__dirname, "../dist/index.html"), { hash: "widget" });
  saveWidget({ open: true });
}

/** A system notification when every timer of a followed group is done. Never for what was already done at launch. */
const notified = new Map<TimerGroup, number>();
const startedAt = Date.now();
function checkNotifications() {
  if (!state.farm || !widgetCfg.notify.length || !Notification.isSupported()) return;
  const now = Date.now();
  const timers = farmTimers(state.farm);
  for (const key of widgetCfg.notify) {
    const times = timers.filter((t) => t.group === key && t.readyAt !== null).map((t) => t.readyAt!);
    if (!times.length) continue;
    const all = Math.max(...times);
    if (all > now || all <= startedAt || all <= (notified.get(key) ?? 0)) continue;
    notified.set(key, all);
    const label = TIMER_GROUPS.find((g) => g.key === key)!.label;
    const n = new Notification({ title: `${label} : tout est prêt`, body: `${times.length} prêt${times.length > 1 ? "s" : ""} à récolter.`, silent: false });
    n.on("click", showMain);
    n.show();
  }
}

function showMain() {
  if (win) { if (win.isMinimized()) win.restore(); win.show(); win.focus(); }
  else createWindow();
}

function createWindow() {
  nativeTheme.themeSource = "dark";
  const isWin = process.platform === "win32";
  win = new BrowserWindow({
    width: 1180, height: 860, minWidth: 420, minHeight: 560,
    title: "Harvest Desk", autoHideMenuBar: true,
    icon: join(__dirname, "../dist/icon.png"),
    // Frameless with our own title bar; Windows 11 gives it Mica and rounded corners.
    frame: false, titleBarStyle: "hidden",
    ...(isWin ? { backgroundMaterial: "mica" as const, backgroundColor: "#00000000" } : { backgroundColor: "#1b1416" }),
    webPreferences: { preload: join(__dirname, "preload.js"), contextIsolation: true, nodeIntegration: false },
  });
  const sendWin = () => win?.webContents.send("window", { maximized: !!win?.isMaximized(), pinned: !!win?.isAlwaysOnTop() });
  win.on("maximize", sendWin);
  win.on("unmaximize", sendWin);
  win.on("always-on-top-changed", sendWin);
  win.webContents.on("did-finish-load", sendWin);
  win.webContents.on("console-message", (_e, level, message, line, source) => {
    if (level >= 3) log("error", "renderer console", `${message} (${source}:${line})`);
  });
  win.webContents.on("did-fail-load", (_e, code, desc, url) => log("error", "did-fail-load", code, desc, url));
  win.on("unresponsive", () => log("warn", "window", "unresponsive"));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: "deny" }; });
  win.on("closed", () => { win = null; });
  if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
  else win.loadFile(join(__dirname, "../dist/index.html"));
}

app.whenReady().then(() => {
  ipcMain.handle("state:get", () => state);
  ipcMain.handle("state:refresh", (_e, full?: boolean) => refresh(!!full));
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
    log("info", "settings:save", `key ${patch.apiKey ? "replaced" : "kept"}, farm ${next.farmId ?? "none"}`);
    return refresh(true);
  });
  ipcMain.on("log", (_e, level: "warn" | "error", where: string, msg: string) => {
    log(level === "warn" ? "warn" : "error", `renderer ${String(where).slice(0, 60)}`, String(msg).slice(0, 4000));
  });
  ipcMain.handle("log:open", () => shell.openPath(logDir()));
  ipcMain.on("window", (e, action: string) => {
    const w = BrowserWindow.fromWebContents(e.sender);
    if (!w) return;
    if (action === "minimize") w.minimize();
    else if (action === "maximize") w.isMaximized() ? w.unmaximize() : w.maximize();
    else if (action === "close") w.close();
    else if (action === "pin") {
      if (w === widget) setWidget({ onTop: !w.isAlwaysOnTop() });
      else w.setAlwaysOnTop(!w.isAlwaysOnTop(), "floating");
    }
    else if (action === "app") showMain();
  });
  ipcMain.handle("widget:get", () => publicWidget());
  ipcMain.handle("widget:set", (_e, patch: Partial<WidgetConfig>) => setWidget(patch ?? {}));
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
  if (widgetCfg.open) openWidget();
  setInterval(checkNotifications, 30_000);
  if (process.env.HARVEST_SHOTS) { void shots(process.env.HARVEST_SHOTS); return; }
  refresh().then((s) => {
    const span = s.snapshots.length > 1 ? s.snapshots[s.snapshots.length - 1].at - s.snapshots[0].at : 0;
    if (s.status === "ready" && span < 2 * 86_400_000) importHistory();
  });
  setInterval(() => refresh(), FARM_EVERY);
});

/** Dev helper: HARVEST_SHOTS=<folder> saves one PNG per view with the real farm, then quits. */
async function shots(out: string) {
  const s = await refresh();
  log("info", "shots", `status ${s.status}`);
  mkdirSync(out, { recursive: true });
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 60 && state.status !== "ready"; i++) await wait(1000);
  win!.webContents.setBackgroundThrottling(false);
  win!.setAlwaysOnTop(true);
  win!.show(); win!.focus();
  for (const v of ["revenue", "market", "deliveries", "ledger", "settings"]) {
    await win!.webContents.executeJavaScript(`location.hash = ${JSON.stringify(v)}`);
    await wait(v === "market" ? 7000 : 3000);
    win!.webContents.invalidate();
    await wait(500);
    writeFileSync(join(out, `${v}.png`), (await win!.webContents.capturePage()).toPNG());
  }
  app.quit();
}

app.on("before-quit", () => { quitting = true; });
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
