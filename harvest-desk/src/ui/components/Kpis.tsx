import { MONTH, fmt, nf } from "../format";

/** Day, month (×30.4) and year (×365) totals, with the gain from the chosen options. */
export function Kpis({ total, base }: { total: number; base: number }) {
  const d = total - base;
  const on = d > 0.005;
  const rows = [
    { l: "Par jour", v: fmt(total) + " $", dv: fmt(d) },
    { l: "Par mois", v: nf(total * MONTH) + " $", dv: nf(d * MONTH) },
    { l: "Par an", v: nf(total * 365) + " $", dv: nf(d * 365), hero: true },
  ];
  return (
    <div className="kpis">
      {rows.map((r) => (
        <div className="kpi" key={r.l}>
          <div className="l">{r.l}</div>
          <div className={"v" + (r.hero ? " gold" : "")}>{r.v}</div>
          <div className="d" aria-live="polite">{on ? `+${r.dv} $ avec tes options` : ""}</div>
        </div>
      ))}
    </div>
  );
}
