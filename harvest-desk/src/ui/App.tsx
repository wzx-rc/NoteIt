import { useEffect, useMemo } from "react";
import { DeliveriesView } from "./components/DeliveriesView";
import { FarmValueView } from "./components/FarmValueView";
import { GrowthCurve } from "./components/GrowthCurve";
import { LedgerView } from "./components/LedgerView";
import { MarketView } from "./components/MarketView";
import { Kpis } from "./components/Kpis";
import { MineralsCard } from "./components/MineralsCard";
import { PaybackCard } from "./components/PaybackCard";
import { Rail, viewLabel, type View } from "./components/Rail";
import { RevenueCard } from "./components/RevenueCard";
import { SkillsView } from "./components/SkillsView";
import { SettingsView } from "./components/SettingsView";
import { Shortcuts } from "./components/Shortcuts";
import { Simulator } from "./components/Simulator";
import { TitleBar } from "./components/TitleBar";
import { TopBar } from "./components/TopBar";
import { buildModel, useScenario, type Model } from "./model";
import { bridge, useAppState } from "./useAppState";
import type { AppState } from "../shared/types";
import { usePersisted } from "./usePersisted";

export function App() {
  const { state, refresh, importHistory, addEntry, removeEntry } = useAppState();
  const [view, setView] = usePersisted<View>("view", () => (location.hash.slice(1) as View) || "revenue");
  useEffect(() => {
    const onHash = () => { if (location.hash.length > 1) setView(location.hash.slice(1) as View); };
    onHash();
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const ready = !!(state.farm && state.market);
  const busy = state.status === "loading";
  const current: View = state.status === "needs-setup" ? "settings" : view;

  return (
    <div className="page">
      <TitleBar />
      <div className="app">
        <Rail view={current} onView={setView} />
        <main className="main">
          <TopBar title={viewLabel(current)} username={state.username} farmId={state.farmId} flowerUsd={state.market?.flowerUsd}
            demo={state.mode === "demo"} busy={busy} fetchedAt={state.fetchedAt} onRefresh={() => refresh(true)} />
          <Banner state={state} onRetry={() => refresh(true)} onImport={importHistory} />
          {current === "settings" ? <SettingsView state={state} onImport={importHistory} />
            : !ready ? null
            : current === "value" ? <FarmValueView state={state} />
            : current === "market" ? <MarketView state={state} />
            : current === "deliveries" ? <DeliveriesView state={state} />
            : current === "skills" ? <SkillsView state={state} />
            : current === "ledger" ? <LedgerView state={state} onAdd={addEntry} onRemove={removeEntry} />
            : <Dashboard state={state} />}
          {current !== "settings" && !ready ? (
            <p className="skeleton">{busy || state.status === "idle" ? "Lecture de la ferme…" : "Rien à afficher pour l'instant."}</p>
          ) : null}
        </main>
      </div>
    </div>
  );
}

function Banner({ state, onRetry, onImport }: { state: AppState; onRetry: () => void; onImport: () => void }) {
  if (state.status === "needs-setup") {
    return <div className="banner"><p>Bienvenue. Colle ta clé API Community et ton numéro de ferme pour commencer.</p></div>;
  }
  if (state.error) {
    return <div className="banner err" role="alert"><p>{state.error}</p><button className="btn" onClick={onRetry}>Réessayer</button></div>;
  }
  if (state.importing) {
    return <div className="banner" role="status"><p>Lecture des sauvegardes du jeu pour remplir les 7 derniers jours. Les chiffres se mettront à jour à la fin.</p></div>;
  }
  const s = state.snapshots;
  if (state.status === "ready" && (s.length < 2 || s[s.length - 1].at - s[0].at < 3_600_000)) {
    return (
      <div className="banner"><p>Pas encore assez d'historique pour calculer une moyenne. L'app peut le remplir avec les sauvegardes du jeu.</p>
        <button className="btn primary" onClick={onImport}>Remplir l'historique</button></div>
    );
  }
  return null;
}

function Dashboard({ state }: { state: AppState }) {
  const farm = state.farm!, market = state.market!, snaps = state.snapshots;
  const model = useMemo<Model>(() => buildModel(farm, snaps, market), [farm, snaps, market]);
  const [on, setOn] = usePersisted<Set<string>>("simulator", () => new Set<string>());
  const toggle = (id: string) => setOn((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const sc = useScenario(farm, snaps, market, model, on);
  const baseTotal = model.base.net * model.usd;

  return (
    <>
      <Kpis total={sc.total} base={baseTotal} />
      <div className="grid">
        <RevenueCard values={sc.cat} baseValues={model.baseCat} total={sc.total} base={baseTotal}
          scale={Math.max(model.ceiling, sc.total, 0.01)} days={model.days} subtitles={model.subtitles} />
        <Simulator results={model.results} on={on} toggle={toggle} rate={model.usd} />
      </div>
      <GrowthCurve base={baseTotal} total={sc.total} cost={sc.cost} />
      <div className="row3">
        <MineralsCard lines={model.base.categories.minerals.lines} rate={model.usd} />
        <PaybackCard results={model.results} />
        <Shortcuts fetchedAt={state.fetchedAt} />
      </div>
    </>
  );
}
