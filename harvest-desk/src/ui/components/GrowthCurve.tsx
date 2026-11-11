import { MONTH, fmt, nf } from "../format";

const W = 760, H = 260, L = 56, RP = 16, T = 14, B = 30;

/** Cumulative gains over 12 months: current pace vs. chosen options with purchases deducted. */
export function GrowthCurve({ base, total, cost }: { base: number; total: number; cost: number }) {
  const on = total - base > 0.005;
  const months = [...Array(13).keys()];
  const baseLine = months.map((m) => base * MONTH * m);
  const optLine = months.map((m) => total * MONTH * m - cost);
  const shown = on ? [...baseLine, ...optLine] : baseLine;
  const lo = Math.min(0, ...shown), hi = Math.max(1, ...shown);
  const step = niceStep(hi - lo);
  const yMax = Math.ceil(hi / step) * step, yMin = Math.floor(lo / step) * step;
  const x = (m: number) => L + (m / 12) * (W - L - RP);
  const y = (v: number) => T + ((yMax - v) / (yMax - yMin)) * (H - T - B);
  const path = (a: number[]) => a.map((v, m) => `${m ? "L" : "M"}${x(m).toFixed(1)},${y(v).toFixed(1)}`).join("");
  const ticks: number[] = [];
  for (let v = yMin; v <= yMax + 1e-9; v += step) ticks.push(v);
  const be = on && cost > 0 ? cost / ((total - base) * MONTH) : null;
  const optAbove = optLine[12] > baseLine[12];

  return (
    <section className="card" aria-labelledby="h-curve">
      <h2 id="h-curve">Gains cumulés sur 12 mois</h2>
      <p className="hint">
        {!on ? "Ce que la ferme aura rapporté mois après mois, au rythme actuel."
          : cost > 0 ? `Avec tes options, achats déduits (${nf(cost)} $). La courbe or dépasse l'actuelle quand les achats sont remboursés.`
          : "Avec tes options, sans rien acheter."}
      </p>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img"
        aria-label={`Gains cumulés sur 12 mois : ${nf(baseLine[12])} $ au rythme actuel${on ? `, ${nf(optLine[12])} $ avec tes options` : ""}`}>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={W - RP} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--dim)" : "var(--line)"} strokeWidth="1" />
            <text x={L - 8} y={y(v) + 3} textAnchor="end">{nf(v)} $</text>
          </g>
        ))}
        {months.map((m) => <text key={m} x={x(m)} y={H - 10} textAnchor="middle">{m === 0 ? "auj." : `M${m}`}</text>)}
        <path d={`${path(baseLine)} L${x(12)},${y(0)} L${x(0)},${y(0)}Z`} fill="var(--sky)" opacity=".08" />
        <path d={path(baseLine)} fill="none" stroke="var(--sky)" strokeWidth="1.75" strokeLinejoin="round" />
        {baseLine.map((v, m) => (m ? <circle key={m} cx={x(m)} cy={y(v)} r="2.6" fill="var(--sky)" /> : null))}
        <circle cx={x(12)} cy={y(baseLine[12])} r="4.5" fill="var(--sky)" />
        <text x={x(12) - 8} y={y(baseLine[12]) + (on && optAbove ? 18 : -10)} textAnchor="end" style={{ fill: "var(--text)", fontWeight: 600, fontSize: 12 }}>{nf(baseLine[12])} $</text>
        {on ? (
          <>
            <path d={path(optLine)} fill="none" stroke="var(--gold)" strokeWidth="1.75" strokeLinejoin="round" />
            {optLine.map((v, m) => <circle key={m} cx={x(m)} cy={y(v)} r="2.6" fill="var(--gold)" />)}
            <circle cx={x(12)} cy={y(optLine[12])} r="4.5" fill="var(--gold)" />
            <text x={x(12) - 8} y={y(optLine[12]) + (optAbove ? -10 : 18)} textAnchor="end" style={{ fill: "var(--gold)", fontWeight: 600, fontSize: 12 }}>{nf(optLine[12])} $</text>
            {be !== null && be <= 12 ? (
              <>
                <line x1={x(be)} x2={x(be)} y1={T} y2={H - B} stroke="var(--gold)" strokeDasharray="3 4" opacity=".7" />
                <text x={x(be) - 6} y={H - B - 8} textAnchor="end" style={{ fill: "var(--gold)" }}>achats remboursés, {fmt(be, 1)} mois</text>
              </>
            ) : null}
          </>
        ) : null}
      </svg>
      <div className="lg2">
        <span><i style={{ background: "var(--sky)" }} />Au rythme actuel</span>
        {on ? <span><i style={{ background: "var(--gold)" }} />Avec tes options{cost ? ", achats déduits" : ""}</span>
          : <span>Active une option à droite pour comparer.</span>}
      </div>
    </section>
  );
}

function niceStep(span: number) {
  const raw = span / 5;
  const p = 10 ** Math.floor(Math.log10(Math.max(raw, 1)));
  return [1, 2, 5, 10].map((k) => k * p).find((s) => s >= raw) ?? 10 * p;
}
