import { Icon } from "../icons";

export type View = "revenue" | "value" | "market" | "deliveries" | "skills" | "ledger" | "settings";

export const VIEWS: { v: View; label: string; icon: string }[] = [
  { v: "revenue", label: "Revenus", icon: "revenue" },
  { v: "value", label: "Valeur de la ferme", icon: "coins" },
  { v: "market", label: "Marketplace", icon: "market" },
  { v: "deliveries", label: "Livraisons", icon: "delivery" },
  { v: "skills", label: "Skills", icon: "skills" },
  { v: "ledger", label: "Entrées et sorties", icon: "ledger" },
];

export const viewLabel = (v: View) => (v === "settings" ? "Réglages" : VIEWS.find((m) => m.v === v)?.label ?? "");

/**
 * Windows 11 style navigation pane: icon + label, the active item marked by a short accent bar.
 * Collapses to icons only on narrow windows (CSS). Timers is planned, shown disabled.
 */
export function Rail({ view, onView }: { view: View; onView: (v: View) => void }) {
  const item = (v: View, label: string, icon: string) => (
    <button key={v} className="nav-item" aria-current={view === v} title={label} onClick={() => onView(v)}>
      <Icon name={icon} /><span>{label}</span>
    </button>
  );
  return (
    <nav className="rail" aria-label="Navigation">
      <div className="mark" aria-hidden="true"><Icon name="logo" size={18} /></div>
      {VIEWS.map((m) => item(m.v, m.label, m.icon))}
      <button className="nav-item" disabled title="Timers, bientôt"><Icon name="timers" /><span>Timers</span></button>
      <span className="grow" />
      {item("settings", "Réglages", "settings")}
    </nav>
  );
}
