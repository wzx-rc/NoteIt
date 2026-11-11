import { useMemo, useState } from "react";
import { dailyRates } from "../../core/engine";
import { analyseSkills, pointsOf, type Plan, type SkillValue } from "../../core/skills";
import type { AppState } from "../../shared/types";
import { Icon } from "../icons";
import { MONTH, fmt, signed, usd } from "../format";

const CAT_ICON: Record<string, string> = { crops: "wheat", greenhouse: "rice", minerals: "gold", animals: "sheep" };
const TREE_FR: Record<string, string> = {
  Crops: "Cultures", "Fruit Patch": "Fruits", Trees: "Arbres", Animals: "Animaux", Greenhouse: "Serre",
  Mining: "Minage", Cave: "Grotte", Compost: "Compost", Cooking: "Cuisine", Fishing: "Pêche",
  "Bees & Flowers": "Abeilles et fleurs", Machinery: "Machines", Aging: "Vieillissement",
};
const tree = (t: string) => TREE_FR[t] ?? t;
const DAY = 86_400_000;

interface Move { v: SkillValue; from: number; to: number; points: number; gain: number }

const at = (v: SkillValue, r: number) => (r > 0 ? v.value[r - 1] : 0);

/** Skills whose rank differs between the current tree and a plan, best gain first. */
function movesTo(values: SkillValue[], from: Record<string, number>, plan: Plan): Move[] {
  const by = new Map(values.map((v) => [v.def.name, v]));
  return [...new Set([...Object.keys(from), ...Object.keys(plan.ranks)])]
    .filter((n) => (from[n] ?? 0) !== (plan.ranks[n] ?? 0) && by.has(n))
    .map((n) => {
      const v = by.get(n)!, a = from[n] ?? 0, b = plan.ranks[n] ?? 0;
      return { v, from: a, to: b, points: pointsOf({ [n]: b }) - pointsOf({ [n]: a }), gain: at(v, b) - at(v, a) };
    })
    .sort((x, y) => y.gain - x.gain);
}

/** Skill tree: what each skill brings on this farm and the tree that earns the most. */
export function SkillsView({ state }: { state: AppState }) {
  const farm = state.farm!, market = state.market!;
  const rate = market.flowerUsd;
  const a = useMemo(() => analyseSkills(farm, dailyRates(state.snapshots).rates, market), [farm, market, state.snapshots]);
  const [mode, setMode] = useState<"topup" | "reset">("topup");
  const now = state.fetchedAt ? Date.parse(state.fetchedAt) : Date.now();
  const free = Math.max(0, a.earned - a.used);
  const m = (f: number) => f * MONTH * rate;
  const topGain = a.topUp.value - a.current.value;
  const resetGain = a.proposed.value - a.current.value;
  const resetExtra = a.proposed.value - a.topUp.value;
  const freeReset = a.reset.freeAt <= now;
  const freeDate = new Date(a.reset.freeAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
  const daysLeft = Math.ceil((a.reset.freeAt - now) / DAY);
  const moves = movesTo(a.values, a.current.ranks, mode === "topup" ? a.topUp : a.proposed);
  const plan = mode === "topup" ? a.topUp : a.proposed;
  const unvalued = a.values.filter((v) => v.how === "none" && v.current > 0).length;

  const verdict = freeReset
    ? `Ton reset gratuit est disponible : l'arbre idéal rapporte ${usd(m(resetExtra))} de plus par mois que de seulement dépenser tes points libres.`
    : m(resetExtra) < 3
      ? `Pas la peine de payer ${a.reset.gems} gems : le reset ne rapporte que ${usd(m(resetExtra))} de plus par mois que tes points libres. Attends le reset gratuit du ${freeDate}.`
      : `Le reset rapporte ${usd(m(resetExtra))} de plus par mois que tes points libres. Gratuit le ${freeDate} (dans ${daysLeft} jours), sinon ${a.reset.gems} gems.`;

  // Board: valued skills, grouped by tree, only the trees where something earns or is owned.
  const board = useMemo(() => {
    const rows = a.values.filter((v) => v.how !== "none" && (v.current > 0 || (plan.ranks[v.def.name] ?? 0) > 0 || v.value.some((x) => Math.abs(x) > 0.01)));
    const trees = [...new Set(rows.map((v) => v.def.tree))];
    return trees.map((t) => ({ tree: t, rows: rows.filter((v) => v.def.tree === t).sort((x, y) => x.def.tier - y.def.tier || Math.max(...y.value) - Math.max(...x.value)) }));
  }, [a, plan]);

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="l">Points de skill</div>
          <div className="v">{a.used} <small className="unit dim">/ {a.earned}</small></div>
          <div className="d">{free ? `${free} point${free > 1 ? "s" : ""} pas encore dépensé${free > 1 ? "s" : ""}` : "tout est dépensé"}</div>
        </div>
        <div className="kpi">
          <div className="l">Avec tes points libres, sans reset</div>
          <div className="v pos">+{usd(m(topGain))}<small className="unit dim"> /mois</small></div>
          <div className="d dim">{signed(topGain)} FLOWER par jour</div>
        </div>
        <div className="kpi">
          <div className="l">Arbre idéal après un reset</div>
          <div className="v gold">+{usd(m(resetGain))}<small className="unit dim"> /mois</small></div>
          <div className="d dim">{freeReset ? "reset gratuit disponible" : `reset gratuit le ${freeDate}, sinon ${a.reset.gems} gems`}</div>
        </div>
      </div>

      <div className="banner"><p>{verdict}</p></div>

      <div className="grid">
        <section className="card" aria-labelledby="h-moves">
          <div className="top2">
            <h2 id="h-moves">À choisir</h2>
            <span className="spacer" />
            <div className="seg" role="group" aria-label="Plan">
              <button className="btn" aria-pressed={mode === "topup"} onClick={() => setMode("topup")}>Sans reset</button>
              <button className="btn" aria-pressed={mode === "reset"} onClick={() => setMode("reset")}>Après un reset</button>
            </div>
          </div>
          <p className="hint">
            {mode === "topup"
              ? `Où mettre tes ${free} points libres, sans rien retirer. Classé par gain.`
              : "Ce que l'arbre idéal change par rapport au tien. Les skills que l'app ne sait pas chiffrer (pêche, cuisine, machines…) restent comme ils sont."}
          </p>
          <ul className="moves">
            {moves.map((mv) => <MoveRow key={mv.v.def.name} mv={mv} rate={rate} />)}
            {moves.length === 0 ? <li className="empty">Ton arbre est déjà le meilleur pour ces points.</li> : null}
          </ul>
          <p className="foot">{plan.points} points sur {a.earned} · {signed(m(plan.value - a.current.value))} $ par mois par rapport à aujourd'hui.</p>
        </section>

        <section className="card stat" aria-labelledby="h-now">
          <h2 id="h-now">Ce que tes skills rapportent</h2>
          <p className="hint">Gain des skills chiffrés, comparé à ne pas les avoir.</p>
          <div className="big">{usd(m(a.current.value))} <small className="unit">par mois aujourd'hui</small></div>
          <div className="bars">
            {[["Aujourd'hui", a.current.value], ["Sans reset", a.topUp.value], ["Après reset", a.proposed.value]].map(([l, v]) => (
              <div className="br" key={l as string}>
                <span className="lb">{l}</span>
                <span className="tr"><b style={{ left: 0, width: `${(Math.max(0, v as number) / Math.max(a.proposed.value, a.topUp.value, 0.01)) * 100}%`, background: l === "Aujourd'hui" ? "var(--dim)" : l === "Sans reset" ? "var(--sheep)" : "var(--gold)" }} /></span>
                <span className="n">{usd(m(v as number))}</span>
              </div>
            ))}
          </div>
          <p className="foot">
            {unvalued} de tes skills n'ont pas d'effet chiffrable sur tes revenus (pêche, cuisine, compost, machines…) : l'app les garde.
            Les skills de vitesse supposent que tu récoltes dès que c'est prêt.
          </p>
        </section>
      </div>

      <section className="card" aria-labelledby="h-board">
        <h2 id="h-board">Tableau des skills</h2>
        <p className="hint">Chaque skill qui touche tes revenus, avec son gain par rang sur ta ferme. ● ton rang actuel, ◆ le rang conseillé ({mode === "topup" ? "sans reset" : "après reset"}).</p>
        <div className="skt">
          {board.map((g) => (
            <div key={g.tree} className="skt-tree">
              <h3>{tree(g.tree)}</h3>
              {g.rows.map((v) => <BoardRow key={v.def.name} v={v} target={plan.ranks[v.def.name] ?? 0} rate={rate} />)}
            </div>
          ))}
        </div>
      </section>

      <p className="foot">
        Points : un par niveau, ascensions comprises. Prix d'un rang en plus : 1, 3 ou 6 points selon le palier du skill, et chaque rang demande le palier suivant ouvert dans l'arbre.
        Un reset rend tous les points ; il est gratuit tous les 180 jours, sinon 200 gems, puis le double à chaque fois. Gains au rythme mesuré de ta ferme, coins comptés 320 pour 1 FLOWER.
      </p>
    </>
  );
}

function MoveRow({ mv, rate }: { mv: Move; rate: number }) {
  const { v, from, to, points, gain } = mv;
  const what = to === 0 ? "à retirer" : from === 0 ? (v.def.maxLevel > 1 ? `à prendre, rang ${to}` : "à prendre") : `rang ${from} → ${to}`;
  const pts = points > 0 ? `${points} point${points > 1 ? "s" : ""}` : `rend ${-points} point${points < -1 ? "s" : ""}`;
  const g = gain * MONTH * rate;
  return (
    <li className="move deal">
      <span className="chip"><Icon name={CAT_ICON[v.cat ?? ""] ?? "flower"} size={20} /></span>
      <span className="t">
        <b>{v.def.name} <span className={"tag" + (to === 0 ? " out" : "")}>{what}</span></b>
        <span>{tree(v.def.tree)} · {v.def.buff ?? ""}{v.def.debuff ? `, ${v.def.debuff}` : ""}</span>
      </span>
      <span className="g">
        <b className={g >= 0 ? "pos" : "neg"}>{signed(g)} $<small>/mois</small></b>
        <span>{pts}</span>
      </span>
    </li>
  );
}

function BoardRow({ v, target, rate }: { v: SkillValue; target: number; rate: number }) {
  const best = target > 0 ? v.value[target - 1] : v.current > 0 ? v.value[v.current - 1] : Math.max(...v.value);
  const g = best * MONTH * rate;
  return (
    <div className="skt-row">
      <span className="skt-name"><b>{v.def.name}</b><span className="dim small">palier {v.def.tier} · {v.def.points} pt{v.def.points > 1 ? "s" : ""}</span></span>
      <span className="skt-ranks" aria-label={`Rang ${v.current} sur ${v.def.maxLevel}, conseillé ${target}`}>
        {v.value.map((x, i) => (
          <span key={i} className={"pip" + (i < v.current ? " own" : "") + (i < target ? " aim" : "")} title={`Rang ${i + 1} : ${signed(x * MONTH * rate)} $/mois`}>
            {fmt(x * MONTH * rate, Math.abs(x * MONTH * rate) < 10 ? 1 : 0)}
          </span>
        ))}
      </span>
      <span className={"n " + (g < -0.005 ? "neg" : g > 0.005 ? "pos" : "dim")}>{signed(g)} $</span>
    </div>
  );
}
