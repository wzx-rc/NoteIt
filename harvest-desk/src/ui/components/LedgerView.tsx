import { useMemo, useState } from "react";
import type { EntryKind, LedgerEntry } from "../../core/ledger";
import type { AppState, ManualEntry } from "../../shared/types";
import { Icon } from "../icons";
import { dayLabel, fmt, nf } from "../format";

const DAY = 86_400_000;
const PERIODS = [
  { k: "7", label: "7 jours", days: 7 },
  { k: "30", label: "30 jours", days: 30 },
  { k: "all", label: "Tout", days: Infinity },
] as const;

const KIND: Record<EntryKind, { label: string; icon: string; color: string }> = {
  withdraw: { label: "Retrait", icon: "out", color: "var(--sky)" },
  delivery: { label: "Livraisons", icon: "delivery", color: "var(--sheep)" },
  purchase: { label: "Achat", icon: "bag", color: "var(--loss)" },
  sale: { label: "Vente", icon: "coins", color: "var(--sheep)" },
  spend: { label: "Dépense en jeu", icon: "out", color: "var(--wheat)" },
  income: { label: "Autre gain", icon: "in", color: "var(--sheep)" },
  manual: { label: "Saisi à la main", icon: "pen", color: "var(--ore)" },
};

const money = (v: number) => (v < 0 ? "−" : "+") + (Math.abs(v) >= 100 ? nf(Math.abs(v)) : fmt(Math.abs(v))) + " $";

/** FLOWER coming in and going out, in dollars, found between farm readings or typed by hand. */
export function LedgerView({ state, onAdd, onRemove }: { state: AppState; onAdd: (e: ManualEntry) => void; onRemove: (id: string) => void }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]["k"]>("30");
  const now = state.fetchedAt ? Date.parse(state.fetchedAt) : Date.now();
  const days = PERIODS.find((p) => p.k === period)!.days;
  const list = useMemo(() => state.ledger.filter((e) => now - e.at <= days * DAY), [state.ledger, now, days]);
  const inflow = list.filter((e) => e.usd > 0).reduce((a, e) => a + e.usd, 0);
  const outflow = list.filter((e) => e.usd < 0).reduce((a, e) => a + e.usd, 0);
  const net = inflow + outflow;
  const first = state.ledger.length ? Math.min(...state.ledger.map((e) => e.at)) : now;

  return (
    <>
      <div className="top2">
        <div className="seg" role="group" aria-label="Période">
          {PERIODS.map((p) => (
            <button key={p.k} className="btn" aria-pressed={period === p.k} onClick={() => setPeriod(p.k)}>{p.label}</button>
          ))}
        </div>
        <span className="dim small">Suivi depuis le {new Date(first).toLocaleDateString("fr-FR")}. Les nouveaux mouvements s'ajoutent à chaque actualisation.</span>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="l">Entrées</div><div className="v pos">{money(inflow)}</div><div className="d dim">ventes, livraisons, saisies</div></div>
        <div className="kpi"><div className="l">Sorties</div><div className="v neg">{money(outflow)}</div><div className="d dim">achats, dépenses, retraits</div></div>
        <div className="kpi"><div className="l">Solde de la période</div><div className={"v " + (net >= 0 ? "gold" : "neg")}>{money(net)}</div><div className="d dim">{list.length} mouvement{list.length > 1 ? "s" : ""}</div></div>
      </div>

      <FlowChart entries={list} now={now} days={days === Infinity ? Math.max(7, Math.ceil((now - first) / DAY) + 1) : days} />

      <div className="grid">
        <section className="card" aria-labelledby="h-list">
          <h2 id="h-list">Mouvements</h2>
          <p className="hint">Le plus récent en haut. Chaque montant est converti au cours du FLOWER du moment.</p>
          <ul className="moves">
            {list.length === 0 ? <li className="empty">Aucun mouvement sur cette période.</li> : null}
            {list.map((e) => <Move key={e.id} e={e} onRemove={e.kind === "manual" ? () => onRemove(e.id) : undefined} />)}
          </ul>
        </section>
        <AddEntry onAdd={onAdd} />
      </div>
    </>
  );
}

function Move({ e, onRemove }: { e: LedgerEntry; onRemove?: () => void }) {
  const k = KIND[e.kind];
  return (
    <li className="move">
      <span className="chip" style={{ color: k.color }}><Icon name={k.icon} size={18} /></span>
      <span className="t">
        <b>{e.label}</b>
        <span title={e.detail}>{dayLabel(e.at)} · {e.detail ?? k.label}</span>
      </span>
      <span className="g">
        <b className={e.usd < 0 ? "neg" : "pos"}>{money(e.usd)}</b>
        <span>{e.flower !== undefined ? `${e.flower < 0 ? "−" : "+"}${fmt(Math.abs(e.flower), Math.abs(e.flower) < 10 ? 2 : 0)} F` : "saisi en $"}</span>
      </span>
      {onRemove ? <button className="iconbtn sm" aria-label={`Supprimer ${e.label}`} title="Supprimer" onClick={onRemove}><Icon name="close" size={14} /></button> : <span />}
    </li>
  );
}

function AddEntry({ onAdd }: { onAdd: (e: ManualEntry) => void }) {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [dir, setDir] = useState<"in" | "out">("out");
  const value = Number(amount.replace(",", "."));
  const ok = label.trim() && Number.isFinite(value) && value > 0;
  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!ok) return;
    onAdd({ at: Date.parse(date + "T12:00:00"), usd: dir === "in" ? value : -value, label: label.trim() });
    setLabel(""); setAmount("");
  };
  return (
    <section className="card" aria-labelledby="h-add">
      <h2 id="h-add">Ajouter un mouvement</h2>
      <p className="hint">Pour ce que l'app ne voit pas : FLOWER acheté par carte ou en crypto, revente hors jeu, abonnement VIP…</p>
      <form onSubmit={submit}>
        <div className="seg" role="group" aria-label="Sens">
          <button type="button" className="btn" aria-pressed={dir === "out"} onClick={() => setDir("out")}>Sortie</button>
          <button type="button" className="btn" aria-pressed={dir === "in"} onClick={() => setDir("in")}>Entrée</button>
        </div>
        <div className="field"><label htmlFor="m-label">Libellé</label>
          <input id="m-label" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Achat de 500 FLOWER" maxLength={120} /></div>
        <div className="row2">
          <div className="field"><label htmlFor="m-amount">Montant en $</label>
            <input id="m-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="70" /></div>
          <div className="field"><label htmlFor="m-date">Date</label>
            <input id="m-date" type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} /></div>
        </div>
        <div className="actions"><button className="btn primary" type="submit" disabled={!ok}>Ajouter</button></div>
      </form>
    </section>
  );
}

/** Daily bars: money in above the line, money out below. Weekly bars past 60 days. */
function FlowChart({ entries, now, days }: { entries: LedgerEntry[]; now: number; days: number }) {
  const W = 760, H = 200, L = 56, R = 12, T = 12, B = 26;
  const step = days > 60 ? 7 : 1;
  const n = Math.ceil(days / step);
  const start = new Date(now - (n * step - 1) * DAY); start.setHours(0, 0, 0, 0);
  const bins = [...Array(n)].map((_, i) => ({ t: start.getTime() + i * step * DAY, inn: 0, out: 0 }));
  for (const e of entries) {
    const i = Math.floor((e.at - start.getTime()) / (step * DAY));
    if (i < 0 || i >= n) continue;
    if (e.usd > 0) bins[i].inn += e.usd; else bins[i].out += e.usd;
  }
  const hi = Math.max(1, ...bins.map((b) => b.inn)), lo = Math.min(-1, ...bins.map((b) => b.out));
  const span = hi - lo;
  const y = (v: number) => T + ((hi - v) / span) * (H - T - B);
  const bw = (W - L - R) / n;
  const labelEvery = Math.ceil(n / 10);
  return (
    <section className="card" aria-labelledby="h-flow">
      <h2 id="h-flow">Entrées et sorties {step === 7 ? "par semaine" : "par jour"}</h2>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Barres des entrées et sorties">
        {[hi, 0, lo].map((v) => (
          <g key={v}>
            <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} stroke={v === 0 ? "var(--dim)" : "var(--line)"} />
            <text x={L - 8} y={y(v) + 3} textAnchor="end">{money(v).replace("+0,00 $", "0 $")}</text>
          </g>
        ))}
        {bins.map((b, i) => (
          <g key={b.t}>
            {b.inn > 0 ? <rect x={L + i * bw + bw * 0.18} width={bw * 0.64} y={y(b.inn)} height={y(0) - y(b.inn)} rx="2" fill="var(--sheep)"><title>{`${dayLabel(b.t)} : ${money(b.inn)}`}</title></rect> : null}
            {b.out < 0 ? <rect x={L + i * bw + bw * 0.18} width={bw * 0.64} y={y(0)} height={y(b.out) - y(0)} rx="2" fill="var(--loss)"><title>{`${dayLabel(b.t)} : ${money(b.out)}`}</title></rect> : null}
            {i % labelEvery === 0 ? <text x={L + i * bw + bw / 2} y={H - 8} textAnchor="middle">{new Date(b.t).toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}</text> : null}
          </g>
        ))}
      </svg>
      <div className="lg2">
        <span><i style={{ background: "var(--sheep)" }} />Entrées</span>
        <span><i style={{ background: "var(--loss)" }} />Sorties</span>
      </div>
    </section>
  );
}
