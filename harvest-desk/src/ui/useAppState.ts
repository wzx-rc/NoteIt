import { useCallback, useEffect, useState } from "react";
import type { AppState, HarvestBridge } from "../shared/types";

declare global { interface Window { harvest?: HarvestBridge } }

/** The Electron bridge, or undefined when the page runs in a plain browser. */
export const bridge = (): HarvestBridge | undefined => window.harvest;

async function demoState(): Promise<AppState> {
  const f = (await import("../demo/fixture.json")).default as any;
  return { mode: "demo", status: "ready", ...f };
}

/** App state from the main process, or the bundled example farm outside Electron. */
export function useAppState() {
  const [state, setState] = useState<AppState>({ mode: "live", status: "idle", snapshots: [] });

  useEffect(() => {
    const b = bridge();
    if (!b) { demoState().then(setState); return; }
    b.getState().then(setState);
    return b.onState(setState);
  }, []);

  const refresh = useCallback(() => { bridge()?.refresh().then(setState); }, []);
  const importHistory = useCallback(() => { bridge()?.importHistory().then(setState); }, []);
  return { state, refresh, importHistory };
}
