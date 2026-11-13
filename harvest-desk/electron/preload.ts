import { contextBridge, ipcRenderer } from "electron";
import type { AppState, HarvestBridge, WidgetConfig, WindowInfo } from "../src/shared/types";

const bridge: HarvestBridge = {
  getState: () => ipcRenderer.invoke("state:get"),
  refresh: (full?: boolean) => ipcRenderer.invoke("state:refresh", full),
  importHistory: () => ipcRenderer.invoke("history:import"),
  getSettings: () => ipcRenderer.invoke("settings:get"),
  saveSettings: (s) => ipcRenderer.invoke("settings:save", s),
  onState: (cb) => {
    const h = (_e: unknown, s: AppState) => cb(s);
    ipcRenderer.on("state", h);
    return () => ipcRenderer.removeListener("state", h);
  },
  openExternal: (url) => ipcRenderer.send("open", url),
  addEntry: (e) => ipcRenderer.invoke("ledger:add", e),
  removeEntry: (id) => ipcRenderer.invoke("ledger:remove", id),
  log: (level, where, message) => ipcRenderer.send("log", level, where, message),
  openLogs: () => ipcRenderer.invoke("log:open"),
  windowAction: (action) => ipcRenderer.send("window", action),
  onWindow: (cb) => {
    const h = (_e: unknown, w: WindowInfo) => cb(w);
    ipcRenderer.on("window", h);
    return () => ipcRenderer.removeListener("window", h);
  },
  platform: process.platform,
  getWidget: () => ipcRenderer.invoke("widget:get"),
  setWidget: (patch) => ipcRenderer.invoke("widget:set", patch),
  onWidget: (cb) => {
    const h = (_e: unknown, w: WidgetConfig) => cb(w);
    ipcRenderer.on("widget", h);
    return () => ipcRenderer.removeListener("widget", h);
  },
};

contextBridge.exposeInMainWorld("harvest", bridge);
