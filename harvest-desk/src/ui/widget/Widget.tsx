import { useEffect, useMemo, useRef } from "react";
import { countdown, farmTimers, summarize, TIMER_FAMILIES, type GroupSummary } from "../../core/timers";
import { Icon } from "../icons";
import { bridge, useAppState } from "../useAppState";
import { clock, GROUP_COLOR, subLine, useNow, useWidgetConfig } from "./timerUi";
import type { WidgetConfig } from "../../shared/types";

/**
 * Automatic order: whatever reaches 100 % first comes first. Ready rows are at 100 % already; rows waiting
 * on you (empty plot, hive without flowers) come next; then the soonest timer.
 * Custom order: the order set in the Minuteurs tab.
 */
export function sortSummaries(list: GroupSummary[], cfg?: Pick<WidgetConfig, "order" | "groupOrder">): GroupSummary[] {
  if (cfg?.order === "custom") return [...list].sort((a, b) => rankIn(cfg.groupOrder, a.key) - rankIn(cfg.groupOrder, b.key));
  const rank = (g: GroupSummary) => (g.ready > 0 ? 0 : g.empty + g.blocked > 0 ? 1 : 2);
  return [...list].sort((a, b) => rank(a) - rank(b) || (a.nextAt ?? Infinity) - (b.nextAt ?? Infinity));
}

/** Position in a saved order; anything not in it goes last, in its default place. */
export function rankIn<T>(order: T[], key: T, fallback: T[] = []) {
  const i = order.indexOf(key);
  return i >= 0 ? i : 1000 + fallback.indexOf(key);
}

/** The desktop widget: a small see-through list of what is ready and what comes next. */
export function Widget() {
  const { state } = useAppState();
  const [cfg, update] = useWidgetConfig();
  const now = useNow();
  const timers = useMemo(() => (state.farm ? farmTimers(state.farm) : []), [state.farm]);
  const rows = useMemo(() => sortSummaries(summarize(timers, now).filter((g) => cfg.groups.includes(g.key)), cfg), [timers, now, cfg]);
  const b = bridge();
  // The window follows the content's height, so nothing is cut and there is no empty space.
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (!el || !b) return;
    // Header + the list's full height (the list itself may be squeezed while the window is still short).
    const fit = () => b.fitWidget(Array.from(el.children).reduce((a, c) => a + (c as HTMLElement).scrollHeight, 0) + 2);
    const ro = new ResizeObserver(fit);
    for (const c of Array.from(el.querySelectorAll(".wg-head, .wg-fam, .wg-empty"))) ro.observe(c);
    fit();
    return () => ro.disconnect();
  }, [b, rows.length]);
  const read = state.fetchedAt ? Math.max(0, Math.round((now - Date.parse(state.fetchedAt)) / 60_000)) : null;

  return (
    <div className="wg wg-window" ref={box} style={{ ["--wg-alpha" as string]: String(cfg.opacity) }}>
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
        <Families rows={rows} now={now} cfg={cfg} />
      ) : (
        <p className="wg-empty">{state.farm ? "Choisis quoi suivre dans Harvest Desk, onglet Minuteurs." : "Lecture de la ferme…"}</p>
      )}
    </div>
  );
}

/** Rows boxed by family (cultures, ressources, animaux…), the family with the most urgent row first. */
export function Families({ rows, now, cfg }: { rows: GroupSummary[]; now: number; cfg: Pick<WidgetConfig, "order" | "familyOrder"> }) {
  const fams = TIMER_FAMILIES.map((f) => ({ ...f, rows: rows.filter((r) => f.groups.includes(r.key)) })).filter((f) => f.rows.length);
  const first = (f: { rows: GroupSummary[] }) => rows.indexOf(f.rows[0]);
  const defaults = TIMER_FAMILIES.map((f) => f.key);
  if (cfg.order === "custom") fams.sort((a, b) => rankIn(cfg.familyOrder, a.key, defaults) - rankIn(cfg.familyOrder, b.key, defaults));
  else fams.sort((a, b) => first(a) - first(b));
  return (
    <div className="wg-list">
      {fams.map((f) => (
        <section className="wg-fam" key={f.key} aria-label={f.label}>
          <h3>{f.label}</h3>
          <ul>{f.rows.map((g) => <Row key={g.key} g={g} now={now} />)}</ul>
        </section>
      ))}
    </div>
  );
}

export function Row({ g, now }: { g: GroupSummary; now: number }) {
  const done = g.ready > 0 && g.nextAt === null;
  const waiting = g.empty + g.blocked;
  return (
    <li className={"wg-row" + (g.ready > 0 ? " is-ready" : g.nextAt !== null ? " is-running" : "")}>
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
      <span className="wg-bar" aria-hidden="true"><b style={{ width: `${Math.round(g.progress * 100)}%`, background: g.ready > 0 ? "var(--sheep)" : GROUP_COLOR[g.key] }} /></span>
    </li>
  );
}
