import { useCallback, useEffect, useState } from "react";
import { ledgerFromMetas, type LedgerEntry } from "../core/ledger";
import type { AppState, HarvestBridge, ManualEntry } from "../shared/types";

declare global { interface Window { harvest?: HarvestBridge } }

/** The Electron bridge, or undefined when the page runs in a plain browser. */
export const bridge = (): HarvestBridge | undefined => window.harvest;

const sortLedger = (l: LedgerEntry[]) => [...l].sort((a, b) => b.at - a.at);

async function demoState(): Promise<AppState> {
  const { metas, ...f } = (await import("../demo/fixture.json")).default as any;
  return { mode: "demo", status: "ready", ...f, ledger: sortLedger(ledgerFromMetas(metas)) };
}

/** App state from the main process, or the bundled example farm outside Electron. */
export function useAppState() {
  const [state, setState] = useState<AppState>({ mode: "live", status: "idle", snapshots: [], orders: [], ledger: [] });

  useEffect(() => {
    const b = bridge();
    if (!b) { demoState().then(setState); return; }
    b.getState().then(setState);
    return b.onState(setState);
  }, []);

  const refresh = useCallback(() => { bridge()?.refresh().then(setState); }, []);
  const importHistory = useCallback(() => { bridge()?.importHistory().then(setState); }, []);
  /** In the demo, hand-typed moves live in memory only. */
  const addEntry = useCallback((e: ManualEntry) => {
    const b = bridge();
    if (b) b.addEntry(e).then(setState);
    else setState((s) => ({ ...s, ledger: sortLedger([...s.ledger, { id: `m-${Date.now()}`, kind: "manual", ...e }]) }));
  }, []);
  const removeEntry = useCallback((id: string) => {
    const b = bridge();
    if (b) b.removeEntry(id).then(setState);
    else setState((s) => ({ ...s, ledger: s.ledger.filter((x) => x.id !== id) }));
  }, []);
  return { state, refresh, importHistory, addEntry, removeEntry };
}
