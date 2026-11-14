import type { OptionResult } from "../../core/scenarios";
import { Icon } from "../icons";
import { nf } from "../format";

/** Days to pay back each purchase at today's floor price. Shorter is better. */
export function PaybackCard({ results }: { results: OptionResult[] }) {
  const rows = results.filter((r) => r.paybackDays !== null).sort((a, b) => a.paybackDays! - b.paybackDays!);
  const max = Math.max(1, ...rows.map((r) => r.paybackDays!));
  const shorts = rows.filter((r) => r.option.short && r.option.short !== r.option.name);
  return (
    <section className="card stat">
      <h2>Achats qui se remboursent vite</h2>
      <p className="hint">Prix plancher du marketplace aujourd'hui.</p>
      <div className="bars">
        {rows.length === 0 ? <p className="empty">Aucun achat à évaluer.</p> : null}
        {rows.map(({ option: o, paybackDays: d }) => (
          <div className="br" key={o.id}>
            <span className="lb"><Icon name={o.icon} size={18} />{o.short ?? o.name}</span>
            <span className="tr">
              <b style={{ left: 0, width: `${(d! / max) * 100}%`, background: d! < 200 ? "var(--sheep)" : d! < 700 ? "var(--gold)" : "var(--loss)" }} />
            </span>
            <span className="n">{nf(d!)} j</span>
          </div>
        ))}
        <p className="hint" style={{ marginTop: 4 }}>
          Nombre de jours pour rembourser l'achat.{shorts.map((r) => ` ${r.option.short} = ${r.option.name}.`).join("")}
        </p>
      </div>
    </section>
  );
}
