import { useMemo } from "react";
import { countdown, farmTimers, summarize, type GroupSummary, type TimerGroup } from "../../core/timers";
import type { AppState } from "../../shared/types";
import { Icon } from "../icons";
import { bridge } from "../useAppState";
import { clock, GROUP_COLOR, subLine, useNow, useWidgetConfig } from "../widget/timerUi";
import { Families, sortSummaries } from "../widget/Widget";

/** Every timer of the farm, what the desktop widget shows, and which groups send a notification. */
export function TimersView({ state }: { state: AppState }) {
  const [cfg, update] = useWidgetConfig();
  const now = useNow();
  const timers = useMemo(() => farmTimers(state.farm), [state.farm]);
  const all = useMemo(() => summarize(timers, now), [timers, now]);
  const shown = useMemo(() => sortSummaries(all.filter((g) => cfg.groups.includes(g.key))), [all, cfg.groups]);
  const desktop = !!bridge();
  const flip = (list: TimerGroup[], k: TimerGroup) => (list.includes(k) ? list.filter((x) => x !== k) : [...list, k]);

  return (
    <>
      <div className="grid">
        <section className="card" aria-labelledby="h-follow">
          <h2 id="h-follow">Quoi suivre</h2>
          <p className="hint">Coche ce que le widget affiche. La cloche envoie une notification quand tout le groupe est prêt.</p>
          <div className="sim">
            {all.map((g) => (
              <FollowRow key={g.key} g={g} now={now} on={cfg.groups.includes(g.key)} bell={cfg.notify.includes(g.key)}
                toggle={() => update({ groups: flip(cfg.groups, g.key) })} ring={() => update({ notify: flip(cfg.notify, g.key) })} />
            ))}
          </div>
        </section>

        <section className="card" aria-labelledby="h-wg">
            <h2 id="h-wg">Widget de bureau</h2>
            <p className="hint">Une petite fenêtre discrète à poser où tu veux sur ton bureau. Elle se met à jour toute seule.</p>
            <div className="wg-preview">
              <div className="wg" style={{ ["--wg-alpha" as string]: String(cfg.opacity) }}>
                <header className="wg-head"><span className="wg-mark" aria-hidden="true"><Icon name="logo" size={11} /></span><span className="wg-title">Harvest Desk</span><span className="wg-sub">aperçu</span></header>
                {shown.length ? <Families rows={shown} now={now} />
                  : <p className="wg-empty">Coche au moins un groupe à gauche.</p>}
              </div>
            </div>
            <div className="wg-settings">
              {desktop ? (
                <button className="btn primary" onClick={() => update({ open: !cfg.open })}>{cfg.open ? "Fermer le widget" : "Ouvrir le widget"}</button>
              ) : <span className="dim small">Le widget s'ouvre depuis l'app installée.</span>}
              <button className="toggle slim" aria-pressed={cfg.onTop} onClick={() => update({ onTop: !cfg.onTop })}>
                <span className="sw" aria-hidden="true" /><span className="t"><b>Toujours au premier plan</b></span>
              </button>
              <label className="field">
                <span>Opacité du fond : {Math.round(cfg.opacity * 100)} %</span>
                <input type="range" min={40} max={100} step={5} value={Math.round(cfg.opacity * 100)} onChange={(e) => update({ opacity: Number(e.target.value) / 100 })} />
              </label>
            </div>
        </section>
      </div>
      <p className="foot">
        Les minuteurs suivent les temps du jeu, boosts temporaires compris (totems, sabliers, shrines, Power Hour, Rapid Root…).
        La ferme est relue toutes les 10 minutes : une action faite dans le jeu apparaît à la lecture suivante, ou tout de suite avec « Mettre à jour ».
      </p>
    </>
  );
}

function FollowRow({ g, now, on, bell, toggle, ring }: { g: GroupSummary; now: number; on: boolean; bell: boolean; toggle: () => void; ring: () => void }) {
  const status = g.ready > 0 ? `${g.ready}/${g.total} prêts${g.nextAt !== null ? `, le reste ${clock(g.allAt!, now)}` : ""}`
    : g.nextAt !== null ? `prochain dans ${countdown(g.nextAt - now)}${g.allAt !== g.nextAt ? `, tout ${clock(g.allAt!, now)}` : ""}`
      : g.empty ? `${g.empty} vide${g.empty > 1 ? "s" : ""}` : g.blocked ? "en pause" : "";
  return (
    <div className="follow">
      <button className="toggle" aria-pressed={on} onClick={toggle}>
        <span className="sw" aria-hidden="true" />
        <span className="chip" style={{ color: GROUP_COLOR[g.key] }}><Icon name={g.icon} size={18} /></span>
        <span className="t"><b>{g.label}</b><span>{subLine(g.key, g.what, g.total) ? `${subLine(g.key, g.what, g.total)} · ` : ""}{status}</span></span>
        <span />
      </button>
      <button className={"bell" + (bell ? " on" : "")} aria-pressed={bell} onClick={ring}
        title={bell ? "Ne plus notifier" : "Me notifier quand tout est prêt"} aria-label={`Notification ${g.label}`}>
        <svg viewBox="0 0 24 24" width="16" height="16"><path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15zM10 20a2 2 0 004 0" fill={bell ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" /></svg>
      </button>
    </div>
  );
}
