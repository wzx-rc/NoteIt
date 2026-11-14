import type { Line } from "../../core/engine";
import { Icon } from "../icons";
import { signed } from "../format";

const ICON: Record<string, string> = { Gold: "gold", Iron: "iron", Crimstone: "crim", Stone: "pick" };

/** Net per mineral, as bars diverging around zero. */
export function MineralsCard({ lines, rate }: { lines: Line[]; rate: number }) {
  const rows = lines.map((l) => ({ ...l, v: l.net * rate }));
  const worst = rows.filter((r) => r.v < 0).sort((a, b) => a.v - b.v)[0];
  const lim = Math.max(0.01, ...rows.map((r) => Math.abs(r.v))) * 1.05;
  const z = 50;
  return (
    <section className="card stat">
      <h2>Minerais, nœud par nœud</h2>
      <p className="hint">{!worst ? "Chaque minerai rapporte plus que ses pioches."
        : worst.key === "Stone" ? "La pierre coûte plus en pioches qu'elle ne rapporte."
        : `${worst.label} : les pioches coûtent plus que ce qu'il rapporte.`}</p>
      {worst ? <div className="big loss">{signed(worst.v)} $ / jour</div>
        : <div className="big">{signed(rows.reduce((a, r) => a + r.v, 0))} $ / jour</div>}
      <div className="bars">
        {rows.length === 0 ? <p className="empty">Aucun minage mesuré.</p> : null}
        {rows.map((r) => {
          const w = (Math.abs(r.v) / lim) * 50;
          return (
            <div className="br" key={r.key}>
              <span className="lb"><Icon name={ICON[r.key] ?? "pick"} size={18} />{r.label}</span>
              <span className="tr">
                <span className="axis" style={{ left: `${z}%` }} />
                <b style={{ left: `${r.v < 0 ? z - w : z}%`, width: `${w}%`, background: r.v < 0 ? "var(--loss)" : "var(--ore)" }} />
              </span>
              <span className={"n" + (r.v < 0 ? " loss" : "")}>{signed(r.v)} $</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
