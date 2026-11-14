import data from "./data/recipes.json";
import { COINS_PER_FLOWER } from "./gameData";
import type { Market } from "./engine";

type Recipe = { items: Record<string, number>; coins?: number };
const RECIPES = data.recipes as Record<string, Recipe | null>;
const FISH = new Set(data.fish);
/** Crab trap catches: valued at one Crab Pot set, like fish at one Rod cast. */
const CRUSTACEANS = new Set(["Hermit Crab", "Shrimp", "Crab", "Lobster", "Mussel", "Oyster", "Sea Urchin", "Isopod", "Blue Crab", "Barnacle", "Sea Slug", "Sea Snail", "Garden Eel", "Sea Grapes", "Octopus", "Anemone"]);

export interface Value {
  /** FLOWER. */
  flower: number;
  /** True when a part of it is a rough guess (fish, crab trap catches). */
  estimated: boolean;
  /** Items with no price at all, counted as 0. */
  unknown: string[];
}

/**
 * What an item costs to produce or buy, in FLOWER.
 * Order: coins at the bank rate, marketplace price, recipe, then estimates for catches.
 */
export class Valuer {
  private memo = new Map<string, Value>();
  /** `known`: prices worked out elsewhere, such as Oil from the farm's own drills. */
  constructor(private market: Market, private known: Record<string, number> = {}) {}

  item(name: string, depth = 0): Value {
    const hit = this.memo.get(name);
    if (hit) return hit;
    let v: Value;
    const price = this.market.prices[name] ?? this.known[name];
    if (name === "coins") v = { flower: 1 / COINS_PER_FLOWER, estimated: false, unknown: [] };
    else if (price) v = { flower: price, estimated: false, unknown: [] };
    else if (RECIPES[name] && depth < 6) v = this.recipe(RECIPES[name]!, depth);
    else if (FISH.has(name) && !CRUSTACEANS.has(name)) v = { ...this.recipe(RECIPES["Rod"]!, depth), estimated: true };
    else if (CRUSTACEANS.has(name) && RECIPES["Crab Pot"]) v = { ...this.scale(this.recipe(RECIPES["Crab Pot"]!, depth), 0.25), estimated: true };
    else v = { flower: 0, estimated: false, unknown: [name] };
    this.memo.set(name, v);
    return v;
  }

  /** Total value of a basket of items ({ Kale: 10, coins: 800 }). */
  basket(items: Record<string, number>): Value {
    const out: Value = { flower: 0, estimated: false, unknown: [] };
    for (const [name, qty] of Object.entries(items)) {
      const v = this.item(name);
      out.flower += v.flower * qty;
      out.estimated ||= v.estimated;
      out.unknown.push(...v.unknown);
    }
    out.unknown = [...new Set(out.unknown)];
    return out;
  }

  private recipe(r: Recipe, depth: number): Value {
    const v = { flower: 0, estimated: false, unknown: [] as string[] };
    for (const [name, qty] of Object.entries(r.items)) {
      const x = this.item(name, depth + 1);
      v.flower += x.flower * qty;
      v.estimated ||= x.estimated;
      v.unknown.push(...x.unknown);
    }
    v.flower += (r.coins ?? 0) / COINS_PER_FLOWER;
    return v;
  }
  private scale(v: Value, k: number): Value {
    return { ...v, flower: v.flower * k };
  }
}
