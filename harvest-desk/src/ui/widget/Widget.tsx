import { useMemo } from "react";
import { countdown, farmTimers, summarize, type GroupSummary } from "../../core/timers";
import { Icon } from "../icons";
import { bridge, useAppState } from "../useAppState";
import { clock, GROUP_COLOR, subLine, useNow, useWidgetConfig } from "./timerUi";

/** Ready first, then the soonest. Groups waiting on you (empty, paused) come right after the ready ones. */
export function sortSummaries(list: GroupSummary[]): GroupSummary[] {
  const rank = (g: GroupSummary) => (g.ready > 0 ? 0 : g.empty + g.blocked > 0 ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.nextAt ?? Infinity) - (b.nextAt ?? Infinity));
}

/** The desktop widget: a small see-through list of what is ready and what comes next. */
export function Widget() {
  const { state } = useAppState();
  const [cfg, update] = useWidgetConfig();
  const now = useNow();
  const timers = useMemo(() => (state.farm ? farmTimers(state.farm) : []), [state.farm]);
  const rows = useMemo(() => sortSummaries(summarize(timers, now).filter((g) => cfg.groups.includes(g.key))), [timers, now, cfg.groups]);
  const b = bridge();
  const read = state.fetchedAt ? Math.max(0, Math.round((now - Date.parse(state.fetchedAt)) / 60_000)) : null;

  return (
    <div className="wg" style={{ ["--wg-alpha" as string]: String(cfg.opacity) }}>
      <header className="wg-head">
        <span className="wg-mark" aria-hidden="true"><Icon name="logo" size={11} /></span>
        <span className="wg-title">Harvest Desk</span>
        <span className="wg-sub">{state.status === "loading" ? "lecture…" : read === null ? "" : read < 1 ? "à l'instant" : `lu il y a ${read} min`}</span>
        <span className="wg-grow" />
        <div className="wg-btns">
          <button className="wg-btn" title="Ouvrir Harvest Desk" aria-label="Ouvrir Harvest Desk" onClick={() => b?.windowAction("app")}><Icon name="revenue" size={13} /></button>
          <button className={`wg-btn${cfg.onTop ? " on" : ""}`} title={cfg.onTop ? "Ne plus garder au premier plan" : "Garder au premier plan"} aria-pressed={cfg.onTop}
            aria-label="Garder au premier plan" onClick={() => update({ onTop: !cfg.onTop })}>
            <svg viewBox="0 0 24 24" width="12" height="12"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" fill={cfg.onTop ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" /></svg>
          </button>
          <button className="wg-btn" title="Fermer le widget" aria-label="Fermer le widget" onClick={() => update({ open: false })}>
            <svg viewBox="0 0 12 12" width="10" height="10"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.3" /></svg>
          </button>
        </div>
      </header>
      {rows.length ? (
        <ul className="wg-list">{rows.map((g) => <Row key={g.key} g={g} now={now} />)}</ul>
      ) : (
        <p className="wg-empty">{state.farm ? "Choisis quoi suivre dans Harvest Desk, onglet Minuteurs." : "Lecture de la ferme…"}</p>
      )}
    </div>
  );
}

export function Row({ g, now }: { g: GroupSummary; now: number }) {
  const done = g.ready > 0 && g.nextAt === null;
  const waiting = g.empty + g.blocked;
  return (
    <li className={"wg-row" + (g.ready > 0 ? " is-ready" : "")}>
      <span className="wg-ic" style={{ color: GROUP_COLOR[g.key] }}><Icon name={g.icon} size={15} /></span>
      <span className="wg-name">
        <b>{g.label}</b>
        <span>{subLine(g.key, g.what, g.total) || (waiting ? "rien en cours" : "")}</span>
      </span>
      <span className="wg-when">
        {g.ready > 0
          ? <b className="wg-pill">{done ? "Prêt" : `${g.ready} prêt${g.ready > 1 ? "s" : ""}`}{done && g.total > 1 ? ` · ${g.ready}` : ""}</b>
          : g.nextAt !== null ? <b>{countdown(g.nextAt - now)}</b>
            : waiting ? <b className="wg-pill warn">{g.blocked ? (g.key === "honey" ? "en pause" : "malade") : `${g.empty} vide${g.empty > 1 ? "s" : ""}`}</b> : <b>—</b>}
        <span>
          {g.ready > 0 && g.nextAt !== null ? `reste ${countdown(g.allAt! - now)}`
            : g.ready === 0 && g.allAt !== null && g.allAt !== g.nextAt ? `tout ${clock(g.allAt, now)}`
              : g.ready === 0 && g.nextAt !== null ? clock(g.nextAt, now)
                : g.ready > 0 && waiting ? `${g.empty} vide${g.empty > 1 ? "s" : ""}` : ""}
        </span>
      </span>
    </li>
  );
}
