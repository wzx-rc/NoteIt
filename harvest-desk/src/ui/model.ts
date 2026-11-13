import { useMemo } from "react";
import { dailyRates, type CategoryKey, type Market, type Report } from "../core/engine";
import type { Farm } from "../core/farm";
import { combined, evaluate, type OptionResult } from "../core/scenarios";
import type { Snapshot } from "../shared/types";
import { frCrop } from "./format";

export interface CatMeta { key: CategoryKey; name: string; icon: string; color: string }
export const CATS: CatMeta[] = [
  { key: "crops", name: "Crops", icon: "wheat", color: "var(--wheat)" },
  { key: "animals", name: "Animaux", icon: "sheep", color: "var(--sheep)" },
  { key: "greenhouse", name: "Serre", icon: "rice", color: "var(--glass)" },
  { key: "minerals", name: "Minerais", icon: "gold", color: "var(--ore)" },
  { key: "wood", name: "Bois", icon: "wood", color: "var(--wood)" },
];

/** Everything the dashboard shows, in $ per day. */
export interface Model {
  usd: number;
  days: number;
  base: Report;
  results: OptionResult[];
  /** Base net per day for each category, in $. */
  baseCat: Record<CategoryKey, number>;
  /** Highest total reachable with every option on, to keep the ring scale stable. */
  ceiling: number;
  subtitles: Record<CategoryKey, string>;
  plots: number;
}

export function buildModel(farm: Farm, snapshots: Snapshot[], market: Market): Model {
  const { rates, days } = dailyRates(snapshots);
  const { base, results } = evaluate(farm, rates, market);
  const usd = market.flowerUsd;
  const useful = results.filter((r) => r.gainTotal > 1e-6);
  const all = useful.length ? combined(farm, rates, market, useful.map((r) => r.option)) : base;
  const baseCat = Object.fromEntries(CATS.map((c) => [c.key, base.categories[c.key].net * usd])) as Record<CategoryKey, number>;
  const plots = Object.keys(farm.crops ?? {}).length;
  return { usd, days, base, results: useful, baseCat, ceiling: all.net * usd, subtitles: subtitles(farm, base, plots), plots };
}

function subtitles(farm: Farm, r: Report, plots: number): Record<CategoryKey, string> {
  const top = (k: CategoryKey) => [...r.categories[k].lines].sort((a, b) => b.net - a.net);
  const crops = top("crops");
  const ani = top("animals");
  const herd = (type: string) => Object.values({ ...farm.henHouse?.animals, ...farm.barn?.animals, ...farm.pigpen?.animals }).filter((a) => a.type === type).length;
  const typeOf: Record<string, string> = { Moutons: "Sheep", Vaches: "Cow", Poules: "Chicken", Cochons: "Pig" };
  const gh = r.categories.greenhouse.lines.map((l) => frCrop(l.label));
  const mins = top("minerals");
  const win = mins.filter((l) => l.net > 0).slice(0, 2).map((l) => l.label.toLowerCase());
  const lose = mins.filter((l) => l.net < 0).map((l) => l.label.toLowerCase());
  return {
    crops: crops.length ? `surtout le ${frCrop(crops[0].label)}${plots ? `, ${plots} parcelles` : ""}` : "aucune récolte mesurée",
    animals: ani.length ? `${herd(typeOf[ani[0].label] ?? "")} ${ani[0].label.toLowerCase()} font presque tout` : "aucun animal nourri",
    greenhouse: gh.length ? gh.join(", ") : "rien récolté",
    wood: top("wood").length ? `${top("wood").map((l) => l.label.toLowerCase()).join(", ")}` : "aucune coupe mesurée",
    minerals: [win.length ? `${win.map((w) => (w === "or" ? "l'or" : `le ${w}`)).join(" et ")} ${win.length > 1 ? "tirent" : "tire"}` : "",
      lose.length ? `${lose.map((w) => (w === "pierre" ? "la pierre" : `le ${w}`)).join(" et ")} ${lose.length > 1 ? "perdent" : "perd"}` : ""]
      .filter(Boolean).join(", ") || "aucun minage mesuré",
  };
}

/** Per-category $ per day with the chosen options switched on. */
export function useScenario(farm: Farm, snapshots: Snapshot[], market: Market, model: Model, on: Set<string>) {
  return useMemo(() => {
    const chosen = model.results.filter((r) => on.has(r.option.id));
    const report = chosen.length
      ? combined(farm, dailyRates(snapshots).rates, market, chosen.map((r) => r.option))
      : model.base;
    const cat = Object.fromEntries(CATS.map((c) => [c.key, report.categories[c.key].net * model.usd])) as Record<CategoryKey, number>;
    const cost = chosen.reduce((a, r) => a + r.cost, 0) * model.usd;
    return { cat, total: report.net * model.usd, cost };
  }, [farm, snapshots, market, model, on]);
}
