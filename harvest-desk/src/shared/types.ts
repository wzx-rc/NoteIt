import type { Farm } from "../core/farm";
import type { Market } from "../core/engine";

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
}

export interface Settings { apiKey: string; farmId: string; apiBase: string }

/** What the preload script exposes on window.harvest. */
export interface HarvestBridge {
  getState(): Promise<AppState>;
  refresh(): Promise<AppState>;
  importHistory(): Promise<AppState>;
  getSettings(): Promise<Omit<Settings, "apiKey"> & { hasKey: boolean }>;
  saveSettings(s: Partial<Settings>): Promise<AppState>;
  onState(cb: (s: AppState) => void): () => void;
  openExternal(url: string): void;
}
