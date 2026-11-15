import { useMemo } from "react";
import { procStats, TREE_FR, treeMults, type ProcEvent } from "../../core/procs";
import { COINS_PER_FLOWER } from "../../core/gameData";
import type { AppState } from "../../shared/types";
import { Icon } from "../icons";
import { dayLabel, fmt, MONTH, nf, usd } from "../format";

const SKILL = "Money Tree";

/** Money Tree pops seen between farm readings, against what the skill should give. */
export function ProcsView({ state }: { state: AppState }) {
  const farm = state.farm as any, log = state.procs;
  const rank = Number(farm?.bumpkin?.skills?.[SKILL] ?? 0);
  const rate = state.market?.flowerUsd ?? 0;
  const s = useMemo(() => (log && farm ? procStats(log, rank, treeMults(farm)) : null), [log, farm, rank]);
  const toUsd = (coins: number) => (coins / COINS_PER_FLOWER) * rate;

  if (!log || !s) {
    return (
      <section className="card">
        <h2>Pops Money Tree</h2>
        <p className="hint">Le suivi démarre à la prochaine lecture de ta ferme. L'app note chaque pop qu'elle voit, toutes les 10 minutes.</p>
      </section>
    );
  }

  const days = Math.max(s.hours / 24, 1 / 24);
  // Real gain per day: coins per chop while followed × every chop of the day (app open or not).
  const perDay = s.chops && s.chopsPerDay ? (s.coins / s.chops) * s.chopsPerDay : s.coins / days;
  const expectedPerDay = s.chops && s.chopsPerDay ? (s.expectedCoins / s.chops) * s.chopsPerDay : s.expectedCoins / days;
  const luck = s.expectedPops ? s.pops / s.expectedPops : 0;
  const last = [...log.events].filter((e) => e.boost === SKILL).reverse();
  const shownDays = s.perDay.slice(-14);
  const maxBar = Math.max(...shownDays.map((d) => Math.max(d.coins, d.expectedCoins)), 1);

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="l">Pops relevés</div>
          <div className="v gold">{s.pops}</div>
          <div className="d dim">
            depuis le {new Date(log.since).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}, sur {fmt(s.hours, 0)} h suivies
            {rank ? `. Rang ${rank} : ${[1, 2, 3][Math.min(rank, 3) - 1]} % de chance par coupe` : ". Skill pas pris"}
          </div>
        </div>
        <div className="kpi">
          <div className="l">Gain moyen par jour</div>
          <div className="v">{nf(perDay)} coins</div>
          <div className="d dim">≈ {usd(toUsd(perDay))} par jour, {usd(toUsd(perDay) * MONTH)} par mois. En moyenne théorique : {nf(expectedPerDay)} coins</div>
        </div>
        <div className="kpi">
          <div className="l">Ta chance</div>
          <div className={"v" + (luck >= 1 ? " gold" : "")}>{s.expectedPops >= 0.5 ? `${Math.round(luck * 100)} %` : "—"}</div>
          <div className="d dim">{s.pops} pops pour {fmt(s.expectedPops, 1)} attendus sur tes {nf(s.chops)} coupes suivies. 100 % = pile la moyenne{s.expectedPops < 10 ? ". Encore trop peu de pops pour conclure : attends une dizaine de pops attendus" : ""}</div>
        </div>
      </div>

      <div className="grid">
        <section className="card" aria-labelledby="h-pd">
          <h2 id="h-pd">Coins par jour</h2>
          <p className="hint">Barre : ce que Money Tree t'a donné. Trait : ce qu'il aurait dû donner en moyenne avec tes coupes du jour.</p>
          <div className="pchart" role="img" aria-label="Coins Money Tree par jour, réel et attendu">
            {shownDays.map((d) => (
              <div className="pcol" key={d.day} title={`${dayLabel(d.day)} : ${d.pops} pop${d.pops > 1 ? "s" : ""}, ${nf(d.coins)} coins (attendu ${nf(d.expectedCoins)})`}>
                <div className="pplot">
                  <b style={{ height: `${(d.coins / maxBar) * 100}%` }} />
                  <i style={{ bottom: `${(d.expectedCoins / maxBar) * 100}%` }} />
                </div>
                <span className="pn">{d.pops || ""}</span>
                <span className="pd">{new Date(d.day).toLocaleDateString("fr-FR", { day: "numeric", month: "numeric" })}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="h-pt">
          <h2 id="h-pt">Par arbre</h2>
          <p className="hint">Un pop vaut 200 coins × le multiplicateur de l'arbre coupé.</p>
          <div className="ptree">
            {s.byTree.map((t) => (
              <div key={t.tree} className="pt-row">
                <span className="lb"><Icon name="wood" size={18} />{TREE_FR[t.tree]}</span>
                <span>{t.pops} <small className="dim">/ {fmt(t.expectedPops, 1)} att.</small></span>
                <b>{nf(t.coins)}</b>
              </div>
            ))}
            {s.unknown ? <p className="hint">{s.unknown} pop{s.unknown > 1 ? "s" : ""} sur un arbre déjà recoupé avant la lecture : compté au gain moyen d'un pop.</p> : null}
          </div>
        </section>
      </div>

      <section className="card" aria-labelledby="h-pl">
        <h2 id="h-pl">Derniers pops</h2>
        {last.length ? (
          <ul className="plist">
            {last.slice(0, 30).map((e: ProcEvent) => (
              <li key={e.at}>
                <span>{new Date(e.at).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="dim">{e.tree ? TREE_FR[e.tree] : "arbre inconnu"}{e.before ? " · avant le suivi" : ""}</span>
                <b>{e.coins !== undefined ? `+${nf(e.coins)} coins` : "—"}</b>
              </li>
            ))}
          </ul>
        ) : <p className="hint">Aucun pop pour l'instant.</p>}
      </section>

      <p className="foot">
        Le jeu ne garde que l'heure du dernier pop. L'app la relit toutes les 10 minutes quand elle est ouverte : deux pops dans les mêmes 10 minutes comptent pour un.
        Quand l'app est fermée, les pops peuvent passer inaperçus : ces heures-là ne comptent ni pour les pops ni pour les coupes. Le gain par jour applique tes coins par coupe à toutes tes coupes de la journée.
        Coins comptés au taux de la banque (320 pour 1 FLOWER).
      </p>
    </>
  );
}
