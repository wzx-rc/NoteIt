import type { Farm, Order } from "../core/farm";
import type { Market } from "../core/engine";
import type { LedgerEntry } from "../core/ledger";
import type { TimerGroup } from "../core/timers";

export interface Snapshot { at: number; farmActivity: Record<string, number> }

export interface AppState {
  /** "demo" when running in a browser with example data. */
  mode: "live" | "demo";
  status: "idle" | "loading" | "ready" | "error" | "needs-setup";
  error?: string;
  farmId?: number;
  username?: string;
  fetchedAt?: string;
  farm?: Farm;
  snapshots: Snapshot[];
  market?: Market;
  /** True while the nightly dump is being read to fill the history. */
  importing?: boolean;
  /** Every distinct delivery order seen, newest kept. */
  orders: Order[];
  /** FLOWER moves found between farm readings, plus the ones typed by hand. */
  ledger: LedgerEntry[];
}

/** A move typed by hand in the ledger tab, in dollars. */
export interface ManualEntry { at: number; usd: number; label: string }

export interface Settings { apiKey: string; farmId: string; apiBase: string }

/** What the desktop widget shows, and whether it pings when a group is fully ready. */
export interface WidgetConfig {
  groups: TimerGroup[];
  /** Groups that send a system notification when everything in them is ready. */
  notify: TimerGroup[];
  open: boolean;
  /** 0.4 to 1. */
  opacity: number;
  onTop: boolean;
  /** "auto": soonest to 100 % first. "custom": the order below. */
  order: "auto" | "custom";
  familyOrder: string[];
  groupOrder: TimerGroup[];
}

/** What the preload script exposes on window.harvest. */
export interface HarvestBridge {
  getState(): Promise<AppState>;
  /** Re-reads the farm; with `full`, the marketplace prices too. */
  refresh(full?: boolean): Promise<AppState>;
  importHistory(): Promise<AppState>;
  getSettings(): Promise<Omit<Settings, "apiKey"> & { hasKey: boolean }>;
  saveSettings(s: Partial<Settings>): Promise<AppState>;
  onState(cb: (s: AppState) => void): () => void;
  openExternal(url: string): void;
  addEntry(e: ManualEntry): Promise<AppState>;
  removeEntry(id: string): Promise<AppState>;
  /** Writes a renderer error to the crash journal. */
  log(level: "warn" | "error", where: string, message: string): void;
  /** Opens the folder that holds the crash journal. */
  openLogs(): Promise<string>;
  /** Custom title bar buttons. */
  windowAction(action: "minimize" | "maximize" | "close" | "pin" | "app"): void;
  onWindow(cb: (w: WindowInfo) => void): () => void;
  platform: string;
  getWidget(): Promise<WidgetConfig>;
  setWidget(patch: Partial<WidgetConfig>): Promise<WidgetConfig>;
  onWidget(cb: (w: WidgetConfig) => void): () => void;
  /** Asks the widget window to take this content height (capped to the screen). */
  fitWidget(height: number): void;
}

export interface WindowInfo { maximized: boolean; pinned: boolean }
