import { Engine, type CategoryKey, type Market, type Rates, type Report } from "./engine";
import { type Extra, type Farm, FarmView } from "./farm";
import { COINS_PER_FLOWER } from "./gameData";
import ids from "./data/ids.json";

const PLACEABLE = new Set(ids.placeable);

/** NFTs whose effect the engine computes (their name appears in engine.ts). */
const YIELD_COLLECTIBLES = [
  "Alien Chicken", "Ascended Chicken", "Ascended Sheep", "Astronaut Sheep", "Ayam Cemani", "Bale", "Chicken Coop", "Cluckulator",
  "Crim Peckster", "Crimson Carp", "Dr Cow", "Fat Chicken", "Giant Kale", "Giant Yam", "Gilded Swordfish", "Gold Beetle", "Hoot",
  "Iron Beetle", "Iron Idol", "Kuebiko", "Longhorn Cowfish", "Mermaid Sheep", "Moo-ver", "Mootant", "Mushroom Chicken", "Nugget",
  "Pharaoh Gnome", "Quarry", "Radiant Ray", "Rice Panda", "Rich Chicken", "Rock Golem", "Rocky the Mole", "Scarecrow",
  "Sheaf of Plenty", "Spa Cow", "Squid Chicken", "Stone Beetle", "Toxic Tuft", "Tunnel Mole", "Undead Rooster",
  "Golden Sheep", "Golden Cow", "Gold Egg",
  "Knowledge Crab", "Vinny", "Grape Granny", "Ladybug Cow", "Knight Chicken", "Battle Fish",
];
const YIELD_WEARABLES = [
  "Black Sheep Onesie", "Cattlegrim", "Chicken Suit", "Cowbell Necklace", "Crimstone Armor", "Crimstone Hammer", "Frozen Heart",
  "Green Amulet", "Infernal Bullwhip", "Infernal Pitchfork", "Merino Jumper", "Milk Apron", "Non La Hat", "Olive Royalty Shirt",
  "Olive Shield", "Rice Shirt", "Sickle", "White Sheep Onesie", "Grape Pants", "Antique Dress", "Oil Can", "Oil Overalls", "Oil Gallon",
];

/**
 * Speed boosts: the engine reads measured actions, which already include them,
 * so their effect is a share of a category or line, assuming you collect as soon as it is ready.
 * `m` is the time multiplier from the game code.
 */
type Target = { cat: CategoryKey; line?: string };
const SPEED: Record<string, { m: number; on: Target; wearable?: boolean; note: string }> = {
  "Turbo Sprout": { m: 0.5, on: { cat: "greenhouse" }, note: "serre 2× plus rapide" },
  "Farm Dog": { m: 0.75, on: { cat: "animals", line: "Sheep" }, note: "moutons −25 % de sommeil" },
  "Dream Scarf": { m: 0.8, on: { cat: "animals", line: "Sheep" }, wearable: true, note: "moutons −20 % de sommeil" },
  Mammoth: { m: 0.75, on: { cat: "animals", line: "Cow" }, note: "vaches −25 % de sommeil" },
  // mineGold.ts: 10 % of rocks come back instantly, the others 15 % faster → 0.9 × 0.85.
  "Pickaxe Shark": { m: 0.9 * 0.85, on: { cat: "minerals", line: "Gold" }, wearable: true, note: "or −15 % de repousse, 1 fois sur 10 instantané" },
  "Lunar Calendar": { m: 0.9, on: { cat: "crops" }, note: "cultures −10 % de pousse" },
};

/** Boosts that only work in one of the four in-game seasons (they rotate every week). */
const ONE_SEASON: Record<string, string> = { "Frozen Heart": "hiver seulement, 1 semaine sur 4" };

export interface Deal {
  name: string;
  /** FLOWER. Floor price to buy, or what a sale brings after the 10 % marketplace tax. */
  price: number;
  /** FLOWER per day gained (buy) or lost (sell). */
  perDay: number;
  /** Category most affected, for the icon. */
  cat: CategoryKey | "wood" | null;
  /** True when the app cannot put a number on its effect. */
  unknownEffect: boolean;
  /** Owned more than once: selling one copy keeps the boost. */
  spare?: boolean;
  note?: string;
}

export const MARKET_TAX = 0.1;

function lineNet(r: Report, t: Target) {
  const c = r.categories[t.cat];
  return t.line ? c.lines.find((l) => l.key === t.line)?.net ?? 0 : c.net;
}

function topCat(a: Report, b: Report): CategoryKey | null {
  let best: CategoryKey | null = null, d = 1e-9;
  for (const k of Object.keys(a.categories) as CategoryKey[]) {
    const x = Math.abs(a.categories[k].net - b.categories[k].net);
    if (x > d) { d = x; best = k; }
  }
  return best;
}

/** A copy of the farm without one NFT (placed, stored or worn). */
export function without(farm: Farm, name: string): Farm {
  const f = structuredClone(farm);
  for (const c of [f.collectibles, f.home?.collectibles, f.interior?.ground?.collectibles, f.interior?.level_one?.collectibles, f.petHouse?.pets]) {
    if (c && c[name]) delete c[name];
  }
  if (f.inventory?.[name]) delete f.inventory[name];
  const uneq = (e?: Record<string, string>) => { if (e) for (const k of Object.keys(e)) if (e[k] === name) delete e[k]; };
  uneq(f.bumpkin?.equipped);
  Object.values(f.farmHands?.bumpkins ?? {}).forEach((b) => uneq(b.equipped));
  return f;
}

/** Best NFTs to buy: every computable NFT you do not have, by payback time. */
export function buyDeals(farm: Farm, rates: Rates, market: Market): Deal[] {
  const view = new FarmView(farm);
  const base = new Engine(farm, rates, market).report();
  const out: Deal[] = [];
  const consider = [
    ...YIELD_COLLECTIBLES.map((n) => ({ n, w: false })),
    ...YIELD_WEARABLES.map((n) => ({ n, w: true })),
    ...Object.entries(SPEED).map(([n, s]) => ({ n, w: !!s.wearable })),
  ];
  for (const { n, w } of consider) {
    const price = market.nftFloors[n];
    if (!price || (w ? view.wears(n) : view.has(n))) continue;
    const s = SPEED[n];
    let perDay: number, cat: Deal["cat"];
    if (s) {
      perDay = lineNet(base, s.on) * (1 / s.m - 1);
      cat = s.on.cat;
    } else {
      const extra: Extra = w ? { wearables: [n] } : { collectibles: [n] };
      const r = new Engine(farm, rates, market, extra).report();
      perDay = r.net - base.net;
      cat = topCat(base, r);
      if (ONE_SEASON[n]) perDay = new FarmView(farm).season === "winter" ? perDay / 4 : 0;
    }
    if (perDay > 1e-6) out.push({ name: n, price, perDay, cat, unknownEffect: false, note: s?.note ?? ONE_SEASON[n] });
  }
  return out.sort((a, b) => a.price / a.perDay - b.price / b.perDay);
}

/**
 * Best NFTs to sell: everything you own with a floor price, ranked by how many days
 * of lost income the sale covers. Items with no computed effect come first, by price.
 */
export function sellDeals(farm: Farm, rates: Rates, market: Market): Deal[] {
  const base = new Engine(farm, rates, market).report();
  const known = new Set([...YIELD_COLLECTIBLES, ...YIELD_WEARABLES, ...Object.keys(SPEED), "Foreman Beaver", "Barn Blueprint", "Nancy", "Tin Turtle", "Emerald Turtle",
    // Area boosts: the engine reads where they stand, so they only count when selling.
    "Scary Mike", "Laurie the Chuckle Crow"]);
  const owned = new Map<string, number>();
  for (const [k, v] of Object.entries(farm.inventory ?? {})) if (PLACEABLE.has(k) && Number(v) >= 1) owned.set(k, Math.floor(Number(v)));
  for (const [k, v] of Object.entries(farm.wardrobe ?? {})) if (v >= 1) owned.set(k, (owned.get(k) ?? 0) + v);
  const out: Deal[] = [];
  for (const [n, count] of owned) {
    const floor = market.nftFloors[n];
    if (!floor || floor < 5) continue;
    const price = floor * (1 - MARKET_TAX);
    const spare = count > 1;
    let perDay = 0, cat: Deal["cat"] = null;
    if (!spare && known.has(n)) {
      if (n === "Foreman Beaver") {
        // Free axes: one per tree chop, weighted by the tree's multiplier (chop.ts).
        perDay = (rates["Tree Chopped"] ?? 0) * 20 / COINS_PER_FLOWER;
        cat = "wood";
      } else if (n === "Barn Blueprint") {
        // +5 barn animals: without it, the 5 least useful would have to go.
        const barn = Object.values(farm.barn?.animals ?? {});
        const lines = base.categories.animals.lines.filter((l) => l.key === "Sheep" || l.key === "Cow");
        const perAnimal = Math.min(...lines.map((l) => l.net / Math.max(1, barn.filter((a) => a.type === l.key).length)));
        perDay = barn.length ? 5 * perAnimal : 0;
        cat = "animals";
      } else if (SPEED[n]) {
        perDay = lineNet(base, SPEED[n].on) * (1 - SPEED[n].m);
        cat = SPEED[n].on.cat;
      } else {
        const r = new Engine(without(farm, n), rates, market).report();
        perDay = base.net - r.net;
        cat = topCat(base, r);
      }
    }
    const view = new FarmView(farm);
    const note = n === "Barn Blueprint" ? "+5 places dans l'étable"
      : n === "Nancy" && (view.has("Scarecrow") || view.has("Kuebiko")) ? "inactive : ton Scarecrow fait déjà pareil"
      : SPEED[n]?.note ?? ONE_SEASON[n];
    out.push({ name: n, price, perDay: Math.max(0, perDay), cat, spare, unknownEffect: !spare && !known.has(n), note });
  }
  // Nothing lost first (by price), then the most sale per day of income lost.
  return out.sort((a, b) => {
    const ra = a.perDay < 1e-6 ? Infinity : a.price / a.perDay, rb = b.perDay < 1e-6 ? Infinity : b.price / b.perDay;
    return rb === ra ? b.price - a.price : rb - ra;
  });
}
