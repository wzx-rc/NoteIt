import type { OptionResult } from "../../core/scenarios";
import { Icon } from "../icons";
import { fmt, usd } from "../format";

/** What-if toggles. Each one shows its own gain per day and its floor price. */
export function Simulator({ results, on, toggle, rate }: { results: OptionResult[]; on: Set<string>; toggle: (id: string) => void; rate: number }) {
  return (
    <section className="card" aria-labelledby="h-sim">
      <h2 id="h-sim">Et si tu ajoutais…</h2>
      <p className="hint">Active une option pour voir le revenu changer.</p>
      <div className="sim">
        {results.length === 0 ? <p className="empty">Ta ferme a déjà toutes les options suivies.</p> : null}
        {results.map(({ option: o, gainTotal, cost }) => {
          const free = !o.nft && !o.price;
          return (
            <button key={o.id} className="toggle" aria-pressed={on.has(o.id)} onClick={() => toggle(o.id)}>
              <span className="sw" aria-hidden="true" />
              <span className="chip"><Icon name={o.icon} label={o.name} /></span>
              <span className="t">
                <b>{o.name}{free ? <span className="free">gratuit</span> : null}</b>
                <span>{o.effect}</span>
              </span>
              <span className="g">
                <b>+{fmt(gainTotal * rate)} $</b>
                <span>{free ? "par jour" : o.price ? o.price : cost ? usd(cost * rate) : "prix inconnu"}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
