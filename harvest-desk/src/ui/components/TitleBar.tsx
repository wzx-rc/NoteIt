import { useEffect, useState } from "react";
import type { WindowInfo } from "../../shared/types";
import { Icon } from "../icons";
import { bridge } from "../useAppState";

/**
 * The window's own title bar (the system frame is hidden). The whole bar drags the window;
 * buttons opt out. Hidden outside the desktop app.
 */
export function TitleBar({ status }: { status?: string }) {
  const b = bridge();
  const [w, setW] = useState<WindowInfo>({ maximized: false, pinned: false });
  useEffect(() => b?.onWindow(setW), [b]);
  if (!b) return null;
  const act = (a: "minimize" | "maximize" | "close" | "pin") => () => b.windowAction(a);

  return (
    <header className="titlebar" onDoubleClick={act("maximize")}>
      <span className="tb-mark" aria-hidden="true"><Icon name="logo" size={14} /></span>
      <span className="tb-title">Harvest Desk</span>
      {status ? <span className="tb-status">{status}</span> : null}
      <span className="tb-drag" />
      <div className="tb-buttons" onDoubleClick={(e) => e.stopPropagation()}>
        <button className={`tb-btn${w.pinned ? " on" : ""}`} onClick={act("pin")} aria-pressed={w.pinned}
          title={w.pinned ? "Ne plus garder au premier plan" : "Garder au premier plan"} aria-label="Garder au premier plan">
          <svg viewBox="0 0 24 24" width="14" height="14"><path d="M9 3h6l-1 6 4 4H6l4-4zM12 13v8" fill={w.pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </button>
        <button className="tb-btn" onClick={act("minimize")} aria-label="Réduire" title="Réduire">
          <svg viewBox="0 0 12 12" width="11" height="11"><path d="M1 6h10" stroke="currentColor" strokeWidth="1.1" /></svg>
        </button>
        <button className="tb-btn" onClick={act("maximize")} aria-label={w.maximized ? "Restaurer" : "Agrandir"} title={w.maximized ? "Restaurer" : "Agrandir"}>
          {w.maximized
            ? <svg viewBox="0 0 12 12" width="11" height="11"><path d="M3 1h8v8M1 3h8v8H1z" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>
            : <svg viewBox="0 0 12 12" width="11" height="11"><rect x="1" y="1" width="10" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>}
        </button>
        <button className="tb-btn close" onClick={act("close")} aria-label="Fermer" title="Fermer">
          <svg viewBox="0 0 12 12" width="11" height="11"><path d="M1.5 1.5l9 9M10.5 1.5l-9 9" stroke="currentColor" strokeWidth="1.1" /></svg>
        </button>
      </div>
    </header>
  );
}
