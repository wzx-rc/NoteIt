import { useCallback, useEffect, useState } from "react";
import { TIMER_FAMILIES, TIMER_GROUPS, type TimerGroup } from "../../core/timers";
import type { WidgetConfig } from "../../shared/types";
import { bridge } from "../useAppState";
import { frCrop } from "../format";

export const GROUP_COLOR: Record<TimerGroup, string> = {
  crops: "var(--wheat)", greenhouse: "var(--glass)", machine: "var(--wheat)", fruits: "var(--fruit)", flowers: "var(--fruit)",
  trees: "var(--wood)", stone: "var(--ore)", iron: "var(--ore)", gold: "var(--gold)", crimstone: "var(--loss)", sunstone: "var(--gold)",
  oil: "var(--sky)", chickens: "var(--sheep)", cows: "var(--sheep)", sheep: "var(--sheep)", pigs: "var(--sheep)", honey: "var(--honey)",
  compost: "var(--wood)", cooking: "var(--gold)", aging: "var(--dim)", crabs: "var(--sky)", power: "var(--gold)",
};

const NAMES: Record<string, string> = {
  Tree: "arbre", "Ancient Tree": "arbre ancien", "Sacred Tree": "arbre sacré",
  "Stone Rock": "pierre", "Fused Stone Rock": "pierre fusionnée", "Reinforced Stone Rock": "pierre renforcée",
  "Iron Rock": "fer", "Refined Iron Rock": "fer raffiné", "Tempered Iron Rock": "fer trempé",
  "Gold Rock": "or", "Pure Gold Rock": "or pur", "Prime Gold Rock": "or suprême",
  "Crimstone Rock": "crimstone", "Sunstone Rock": "sunstone",
  Chicken: "poule", Cow: "vache", Sheep: "mouton", Pig: "cochon",
  "Réserve de pétrole": "réserve", Ruche: "ruche", "Ruche pleine": "ruche pleine",
  "Compost Bin": "Compost Bin", "Crab Pot": "casier", "Mariner Pot": "grand casier",
};

/** "Rice ×3, Grape" → "Riz ×3, raisin". */
export function frWhat(what: string): string {
  const s = what.split(", ").map((part) => {
    const m = /^(.*?)( ×\d+)?$/.exec(part)!;
    return (NAMES[m[1]] ?? frCrop(m[1])) + (m[2] ?? "");
  }).join(", ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const COUNT_NOUN: Partial<Record<TimerGroup, [string, string]>> = {
  chickens: ["poule", "poules"], cows: ["vache", "vaches"], sheep: ["mouton", "moutons"], pigs: ["cochon", "cochons"],
  honey: ["ruche", "ruches"], oil: ["réserve", "réserves"], trees: ["arbre", "arbres"],
};

/** The line under a group's name: what grows there, or a plain count when it is all the same thing. */
export function subLine(key: TimerGroup, what: string, total: number): string {
  const noun = COUNT_NOUN[key];
  if (noun && key !== "trees") return `${total} ${total > 1 ? noun[1] : noun[0]}`;
  return what ? frWhat(what) : "";
}

/** "14:20", or "demain 07:10", or "sam. 09:00". */
export function clock(at: number, now: number): string {
  const d = new Date(at), n = new Date(now);
  const hm = d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  const days = Math.round((new Date(d.toDateString()).getTime() - new Date(n.toDateString()).getTime()) / 86_400_000);
  if (days <= 0) return hm;
  if (days === 1) return `demain ${hm}`;
  return `${d.toLocaleDateString("fr-FR", { weekday: "short" })} ${hm}`;
}

export const WIDGET_DEFAULT: WidgetConfig = {
  groups: ["crops", "greenhouse", "trees", "stone", "iron", "gold", "sheep", "cooking", "power"],
  notify: [], open: false, opacity: 0.92, onTop: false,
  order: "auto", familyOrder: TIMER_FAMILIES.map((f) => f.key), groupOrder: TIMER_GROUPS.map((g) => g.key),
};

/** The widget settings, kept by the desktop app (or in this browser for the demo). */
export function useWidgetConfig() {
  const [cfg, setCfg] = useState<WidgetConfig>(() => {
    if (bridge()) return WIDGET_DEFAULT;
    try { return { ...WIDGET_DEFAULT, ...JSON.parse(localStorage.getItem("hd.widget") ?? "{}") }; } catch { return WIDGET_DEFAULT; }
  });
  useEffect(() => {
    const b = bridge();
    if (!b) return;
    b.getWidget().then(setCfg);
    return b.onWidget(setCfg);
  }, []);
  const update = useCallback((patch: Partial<WidgetConfig>) => {
    const b = bridge();
    if (b) { b.setWidget(patch).then(setCfg); return; }
    setCfg((c) => {
      const next = { ...c, ...patch };
      try { localStorage.setItem("hd.widget", JSON.stringify(next)); } catch { /* storage unavailable */ }
      return next;
    });
  }, []);
  return [cfg, update] as const;
}

/** Re-renders every `ms` so countdowns move. */
export function useNow(ms = 15_000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
