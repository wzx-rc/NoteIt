import { contextBridge, ipcRenderer } from "electron";
import type { AppState, HarvestBridge } from "../src/shared/types";

const bridge: HarvestBridge = {
  getState: () => ipcRenderer.invoke("state:get"),
  refresh: () => ipcRenderer.invoke("state:refresh"),
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
};

contextBridge.exposeInMainWorld("harvest", bridge);
