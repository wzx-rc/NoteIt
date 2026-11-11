import { useMemo, useState } from "react";
import type { NpcSummary } from "../../core/deliveries";
import type { Farm } from "../../core/farm";
import { ticketPlan, verdict, type Source } from "../../core/tickets";
import { Icon } from "../icons";
import { nf, usd } from "../format";

const read = (k: string, d: number) => { try { const v = Number(localStorage.getItem(k)); return v > 0 ? v : d; } catch { return d; } };
const write = (k: string, v: number) => { try { localStorage.setItem(k, String(v)); } catch { /* private window */ } };

const COLOR: Record<Source["id"], string> = { deliveries: "var(--gold)", bounties: "var(--sheep)", chores: "var(--sky)", track: "var(--glass)", tywin: "var(--loss)" };

/** Can the chapter goal (one or two 9000-ticket items) be reached before the end, and is Tywin needed? */
export function TicketGoal({ farm, now, npcs, rate }: { farm: Farm; now: number; npcs: NpcSummary[]; rate: number }) {
  const plan = useMemo(() => ticketPlan(farm, now), [farm, now]);
  const key = plan ? `hd.tickets.${plan.chapter.name}` : "";
  const [owned, setOwned] = useState(() => (plan ? read(key + ".owned", plan.seen) : 0));
  const [goal, setGoal] = useState(() => (plan ? read(key + ".goal", 18000) : 18000));
  if (!plan) return null;
  const v = verdict(plan, owned, goal);
  const costOf = (pick: (n: NpcSummary) => boolean) => npcs.filter(pick).reduce((a, n) => a + n.cost, 0) * plan.chapter.ticketDaysLeft;
  const costOthers = costOf((n) => n.npc !== "tywin"), costTywin = costOf((n) => n.npc === "tywin");
  const shortDays = Math.ceil(v.missing / Math.max(1, plan.perDay));
  const tone = v.verdict === "easy" ? "pos" : v.verdict === "tight" ? "gold" : "neg";
  const title = {
    easy: "Jouable sans Tywin",
    tight: "Jouable sans Tywin, mais sans rater un jour",
    tywin: "Pas sans Tywin",
    no: "Chaud, même avec Tywin",
  }[v.verdict];
  const scale = Math.max(goal, owned + v.withTywin);
  const parts = [{ id: "owned", label: "Déjà à toi", total: owned, color: "var(--dim)" },
    ...plan.sources.filter((s) => s.total > 0).map((s) => ({ id: s.id, label: s.label, total: s.total, color: COLOR[s.id] }))];

  return (
    <section className="card" aria-labelledby="h-goal">
      <div className="top2">
        <h2 id="h-goal"><Icon name="ticket" size={18} /> Objectif {plan.ticket}</h2>
        <span className="spacer" />
        <div className="seg" role="group" aria-label="Objectif">
          {[9000, 18000].map((g) => (
            <button key={g} className="btn" aria-pressed={goal === g} onClick={() => { setGoal(g); write(key + ".goal", g); }}>
              {g === 9000 ? "1 objet à 9 000" : "2 objets à 9 000"}
            </button>
          ))}
        </div>
      </div>
      <p className="hint">
        Ce que tu peux encore gagner d'ici la fin du chapitre ({nf(plan.daysLeft)} jours), en faisant chaque jour toutes les livraisons à tickets
        et chaque semaine tout le tableau de bounties et les chores.
      </p>

      <div className="goal">
        <div>
          <div className={"big " + tone}>{title}</div>
          <p className="small">
            Sans Tywin : <b>{nf(owned + v.without)}</b> sur {nf(goal)}
            {v.missing > 0 ? <>, il manque <b className="neg">{nf(v.missing)}</b> (environ {shortDays} jours de livraisons de plus)</> : <>, marge de <b className="pos">{nf(owned + v.without - goal)}</b></>}.
            <br />Avec Tywin : <b>{nf(owned + v.withTywin)}</b>
            {owned + v.withTywin < goal ? <>, il manque encore <b className="neg">{nf(goal - owned - v.withTywin)}</b></> : null}.
          </p>
        </div>
        <label className="field owned">
          <span>{plan.ticket} que tu as</span>
          <input type="number" min={0} value={owned} onChange={(e) => { const n = Math.max(0, Math.floor(Number(e.target.value) || 0)); setOwned(n); write(key + ".owned", n); }} />
          <small>L'API ne donne pas ce nombre : corrige-le avec celui du jeu.</small>
        </label>
      </div>

      <div className="stack" role="img" aria-label={`${nf(owned + v.withTywin)} ${plan.ticket} possibles sur ${nf(goal)}`}>
        {parts.map((p) => <b key={p.id} style={{ width: `${(p.total / scale) * 100}%`, background: p.color }} title={`${p.label} : ${nf(p.total)}`} />)}
        <i style={{ left: `${(goal / scale) * 100}%` }} />
      </div>

      <ul className="sources">
        {parts.map((p) => {
          const s = plan.sources.find((x) => x.id === p.id);
          return (
            <li key={p.id}>
              <span className="dot" style={{ background: p.color }} />
              <span className="t"><b>{p.label}</b>{s ? <span>{s.detail}</span> : <span>le nombre du jeu, à corriger dans la case</span>}</span>
              <span className="n">{p.id === "owned" ? "" : "+"}{nf(p.total)}</span>
            </li>
          );
        })}
      </ul>

      <p className="foot">
        Coût des livraisons d'ici la fin, aux prix d'aujourd'hui : {usd(costOthers * rate)} sans Tywin, et {usd(costTywin * rate)} de plus pour Tywin.
        {plan.doubles.estimated ? ` Doubles livraisons : ${plan.doubles.known} au calendrier, ${plan.doubles.estimated} supposées ensuite (une par semaine).` : ""}
        {" "}{plan.sources.find((s) => s.id === "track")!.label} : {plan.sources.find((s) => s.id === "track")!.detail}.
      </p>
    </section>
  );
}
