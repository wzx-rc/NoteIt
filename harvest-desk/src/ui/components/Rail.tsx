import { Icon } from "../icons";

export type View = "revenue" | "settings";

/** Slim icon rail. Timers and Marché are planned views, shown disabled for now. */
export function Rail({ view, onView }: { view: View; onView: (v: View) => void }) {
  return (
    <nav className="rail" aria-label="Navigation">
      <div className="mark" aria-hidden="true"><Icon name="logo" size={20} /></div>
      <button aria-current={view === "revenue"} aria-label="Revenus" title="Revenus" onClick={() => onView("revenue")}><Icon name="revenue" /></button>
      <button disabled aria-label="Timers (bientôt)" title="Timers, bientôt"><Icon name="timers" /></button>
      <button disabled aria-label="Marché (bientôt)" title="Marché, bientôt"><Icon name="trend" /></button>
      <span className="grow" />
      <button aria-current={view === "settings"} aria-label="Réglages" title="Réglages" onClick={() => onView("settings")}><Icon name="settings" /></button>
    </nav>
  );
}
