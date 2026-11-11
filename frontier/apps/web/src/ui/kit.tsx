import { useEffect, type ReactNode } from "react";
import { ITEM_LABELS, type GameState, type ItemName } from "@frontier/core";
import { ICONS, type IconKey } from "../lib/icons";

export const Icon = ({ k, size = 32 }: { k: IconKey | string; size?: number }) =>
  ICONS[k as IconKey] ? <img src={ICONS[k as IconKey]} width={size} height={size} alt="" /> : <span style={{ width: size, display: "inline-block" }} />;

export const label = (k: string) => (k === "credit" ? "crédits" : ITEM_LABELS[k as ItemName] ?? k);
export const fmtNum = (n: number) => n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });

export function have(s: GameState, k: string) {
  return k === "credit" ? s.credits : s.inventory[k as ItemName] ?? 0;
}

export function Need({ s, need, credits }: { s: GameState; need: Partial<Record<string, number>>; credits?: number }) {
  const entries = Object.entries(need) as Array<[string, number]>;
  if (credits) entries.unshift(["credit", credits]);
  return (
    <div className="need">
      {entries.map(([k, n]) => (
        <span key={k} className={have(s, k) >= n ? "ok" : "no"}><Icon k={k} size={16} />{n} {label(k)}</span>
      ))}
    </div>
  );
}

export const hasAll = (s: GameState, need: Partial<Record<string, number>>, credits = 0) =>
  s.credits >= credits && Object.entries(need).every(([k, n]) => have(s, k) >= (n ?? 0));

export function Modal({ title, icon, onClose, children }: { title: string; icon?: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    addEventListener("keydown", k);
    return () => removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal frame" role="dialog" aria-modal="true" aria-label={title}>
        <header>
          {icon && <img src={icon} alt="" />}
          <h2>{title}</h2>
          <button className="x" type="button" onClick={onClose} aria-label="Fermer">X</button>
        </header>
        {children}
      </div>
    </div>
  );
}

export const fmtTime = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")}` : `${s} s`;
};
