import { Icon } from "../icons";

export type View = "revenue" | "market" | "deliveries" | "ledger" | "settings";

const MAIN: { v: View; label: string; icon: string }[] = [
  { v: "revenue", label: "Revenus", icon: "revenue" },
  { v: "market", label: "Marketplace", icon: "market" },
  { v: "deliveries", label: "Livraisons", icon: "delivery" },
  { v: "ledger", label: "Entrées et sorties", icon: "ledger" },
];

/** Slim icon rail. Timers is a planned view, shown disabled for now. */
export function Rail({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <nav className="rail" aria-label="Navigation">
      <div className="mark" aria-hidden="true"><Icon name="logo" size={20} /></div>
      {MAIN.map((m) => (
        <button key={m.v} aria-current={view === m.v} aria-label={m.label} title={m.label} onClick={() => onView(m.v)}><Icon name={m.icon} /></button>
      ))}
      <button disabled aria-label="Timers (bientôt)" title="Timers, bientôt"><Icon name="timers" /></button>
      <span className="grow" />
      <button aria-current={view === "settings"} aria-label="Réglages" title="Réglages" onClick={() => onView("settings")}><Icon name="settings" /></button>
    </nav>
  );
}
