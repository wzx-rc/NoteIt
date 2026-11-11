import {
  COINS_PER_FLOWER, CROPS, DIET_SKILLS, FEED_RECIPES, FOOD_QTY, GREENHOUSE, TOOLS, WINTER_CROPS,
  ANIMAL_DROPS, AOE_RANKS, AOE_YIELD, GREENHOUSE_FRUITS, OIL, cropTier, favouriteFood, isOvernight,
} from "./gameData";
import { Extra, Farm, FarmView, animalLevel, animals } from "./farm";

/** Daily action counts, keyed like the game's farmActivity ("Wheat Harvested", "Sheep Fed"…). */
export type Rates = Record<string, number>;

export interface Market {
  /** USD per FLOWER. */
  flowerUsd: number;
  date: string;
  /** Latest marketplace sale per item, in FLOWER. */
  prices: Record<string, number>;
  /** Floor price per NFT, in FLOWER. */
  nftFloors: Record<string, number>;
}

export interface Line { key: string; label: string; qty?: number; gross: number; cost: number; net: number }
export type CategoryKey = "crops" | "animals" | "greenhouse" | "minerals";
export interface Category { key: CategoryKey; gross: number; cost: number; net: number; lines: Line[] }
export interface Report { categories: Record<CategoryKey, Category>; net: number; gross: number; cost: number }

const line = (key: string, label: string, gross: number, cost: number, qty?: number): Line => ({ key, label, qty, gross, cost, net: gross - cost });
const sumCat = (key: CategoryKey, lines: Line[]): Category => ({
  key, lines,
  gross: lines.reduce((a, l) => a + l.gross, 0),
  cost: lines.reduce((a, l) => a + l.cost, 0),
  net: lines.reduce((a, l) => a + l.net, 0),
});

const FREE_FEED: Record<string, string> = { Sheep: "Golden Sheep", Cow: "Golden Cow", Chicken: "Gold Egg" };

export class Engine {
  readonly f: FarmView;
  constructor(farm: Farm, private rates: Rates, private market: Market, extra: Extra = {}) {
    this.f = new FarmView(farm, extra);
  }

  price(item: string): number { return this.market.prices[item] ?? 0; }
  coins(n: number): number { return n / COINS_PER_FLOWER; }
  rate(key: string): number { return this.rates[key] ?? 0; }

  // ---------- Crops (events/landExpansion/harvest.ts → getCropYieldAmount) ----------

  /** Expected yield of one harvest. `plot` false for crop machine seeds and greenhouse pots. */
  cropYield(crop: string, plot = true): number {
    const f = this.f;
    let amount = 1;
    if (f.wears("Green Amulet")) amount *= 0.9 + 0.1 * 10; // 10 % chance of x10
    if (f.has("Scarecrow") || f.has("Kuebiko")) amount *= 1.2;
    if (f.inventory("Coder") > 0) amount *= 1.2;

    if (f.wears("Infernal Pitchfork")) amount += 3;
    if (f.faction && f.wears(f.faction.wings)) amount += 0.25;
    if (WINTER_CROPS.includes(crop) && CROPS[crop] && f.season === "winter" && f.wears("Frozen Heart")) amount += 1;
    if (isOvernight(crop) && f.has("Hoot")) amount += 0.5;
    if (crop === "Wheat" && f.wears("Sickle")) amount += 2;
    if (crop === "Kale" && f.has("Giant Kale")) amount += 2;
    if (crop === "Barley" && f.has("Sheaf of Plenty")) amount += 2;
    if (crop === "Yam" && f.has("Giant Yam")) amount += 0.5;

    const tier = cropTier(crop);
    if (plot) {
      const plots = Object.values(f.raw.crops ?? {});
      const swarms = plots.reduce((a, p) => a + (p.beeSwarm?.count ?? 0), 0) / Math.max(plots.length, 1);
      amount += swarms * (0.2 + f.rank("Pollen Power Up"));
      // Sprout Mix (or Sproutroot Surprise) on the plot: +0.2, +0.2 more with Knowledge Crab.
      amount += this.fertilisedShare() * (0.2 + (f.has("Knowledge Crab") ? 0.2 : 0));
      // Scary Mike (medium crops) and Laurie (advanced crops) boost the plots in their area.
      if (tier === "medium") amount += this.aoeBonus("Scary Mike", "Horror Mike");
      if (tier === "advanced") amount += this.aoeBonus("Laurie the Chuckle Crow", "Laurie's Gains");
    }

    // Tier skills only exist for plot crops: greenhouse crops are neither basic, medium nor advanced.
    if (tier === "basic") amount += f.rank("Young Farmer");
    if (tier === "medium") amount += f.rank("Experienced Farmer");
    if (tier === "advanced") amount += f.rank("Old Farmer");
    if (tier === "advanced") amount += f.buff("Acre Farm") - f.debuff("Hectare Farm");
    if (tier === "basic" || tier === "medium") amount += f.buff("Hectare Farm") - f.debuff("Acre Farm");
    return amount;
  }

  /** Share of plot harvests that had Sprout Mix: measured from "Crop Fertilised", else what the plots carry now. */
  fertilisedShare(): number {
    const planted = Object.keys(CROPS).reduce((a, c) => a + this.rate(`${c} Planted`), 0);
    const measured = planted > 0 ? this.rate("Crop Fertilised") / planted : NaN;
    // A ratio above 1 means the older snapshot did not keep the counter: fall back to the plots.
    if (measured >= 0 && measured <= 1.05 && this.rate("Crop Fertilised") > 0) return Math.min(1, measured);
    const plots = Object.values(this.f.raw.crops ?? {});
    if (!plots.length) return 0;
    return plots.filter((p) => ["Sprout Mix", "Sproutroot Surprise"].includes(p.fertiliser?.name ?? "")).length / plots.length;
  }

  /** Average bonus per plot harvest from a scarecrow-type item: share of plots in its area × its bonus. */
  aoeBonus(item: string, skill: string): number {
    const at = this.f.raw.collectibles?.[item]?.find((c) => c.coordinates)?.coordinates;
    const plots = Object.values(this.f.raw.crops ?? {});
    if (!at || !plots.length) return 0;
    const lvl = Math.min(this.f.skill(skill), 3);
    const e = lvl ? AOE_RANKS[lvl - 1] : { xLeft: 1, xRight: 1, depth: 3 };
    const inside = plots.filter((p) => p.x !== undefined && p.y !== undefined
      && p.x >= at.x - e.xLeft && p.x <= at.x + e.xRight && p.y <= at.y - 1 && p.y >= at.y - e.depth).length;
    return (inside / plots.length) * (0.2 + (lvl ? AOE_YIELD[lvl - 1] : 0));
  }

  seedCost(crop: string): number {
    if (this.f.has("Kuebiko")) return 0;
    return this.coins(CROPS[crop]?.seed ?? GREENHOUSE[crop]?.seed ?? 0);
  }

  crops(): Category {
    const lines: Line[] = [];
    let machineSeeds = 0;
    for (const crop of Object.keys(CROPS)) {
      const harvested = this.rate(`${crop} Harvested`);
      if (!harvested) continue;
      // The crop machine counts seeds in "Harvested" but nothing in "Planted".
      const plots = Math.min(this.rate(`${crop} Planted`), harvested);
      const machine = harvested - plots;
      const qty = plots * this.cropYield(crop) + machine * this.cropYield(crop, false);
      lines.push(line(crop, crop, qty * this.price(crop), harvested * this.seedCost(crop), qty));
      machineSeeds += machine;
    }
    // The crop machine burns oil around the clock while it has seeds to grow.
    if (machineSeeds > 0) lines.push(line("machine-oil", "Huile de la Crop Machine", 0, 24 * this.machineOilPerHour() * this.oilPrice()));
    return sumCat("crops", lines.sort((a, b) => b.net - a.net));
  }

  // ---------- Greenhouse (events/landExpansion/harvestGreenHouse.ts) ----------

  greenhouseYield(crop: string): number {
    const f = this.f;
    let amount: number;
    if (GREENHOUSE_FRUITS.includes(crop)) {
      // Grape goes through getFruitYield: only the faction wings and grape items apply.
      amount = 1;
      if (f.faction && f.wears(f.faction.wings)) amount += 0.25;
      if (f.has("Vinny")) amount += 0.25;
      if (f.has("Grape Granny")) amount += 1;
      if (f.wears("Grape Pants")) amount += 0.2;
    } else {
      amount = this.cropYield(crop, false);
    }
    if (crop === "Rice") {
      if (f.wears("Non La Hat")) amount += 1;
      if (f.has("Rice Panda")) amount += 0.25;
      if (f.wears("Rice Shirt")) amount += 1;
    }
    if (crop === "Olive") {
      if (f.wears("Olive Royalty Shirt")) amount += 0.25;
      if (f.wears("Olive Shield")) amount += 1;
    }
    const gamble = f.skill("Greenhouse Gamble");
    if (gamble) amount += [0.3, 0.4, 0.5][Math.min(gamble, 3) - 1];
    if (f.has("Pharaoh Gnome")) amount += 2;
    if (crop === "Grape" && f.wears("Antique Dress")) amount += 0.1 * 10;
    const glass = f.skill("Glass Room");
    if (glass) amount += [0.1, 0.15, 0.2][Math.min(glass, 3) - 1];
    const bounty = f.skill("Seeded Bounty");
    if (bounty) amount += [0.5, 0.75, 1][Math.min(bounty, 3) - 1];
    const greasy = f.skill("Greasy Plants");
    if (greasy) amount += OIL.greasyPlants.yield[Math.min(greasy, 3) - 1];
    return amount;
  }

  /** FLOWER per oil: an Oil Drill (coins, Wood, Iron, Wool or Leather) divided by the oil it brings up. */
  oilPrice(): number {
    const f = this.f;
    const rig = Math.min(f.skill("Oil Rig"), 3);
    const items: Record<string, number> = { ...OIL.drill, ...(rig ? { Wool: OIL.drillWool[rig - 1] } : { Leather: 10 }) };
    const drill = this.coins(OIL.drillCoins) + Object.entries(items).reduce((a, [k, n]) => a + n * this.price(k), 0);
    const ext = Math.min(f.skill("Oil Extraction"), 3);
    const drop = OIL.drop + (ext ? OIL.extraction[ext - 1] : 0)
      + (f.wears("Oil Can") ? 2 : 0) + (f.wears("Oil Overalls") ? 10 : 0) + (f.wears("Oil Gallon") ? 5 : 0)
      + (f.has("Ladybug Cow") ? 1 : 0) + (f.has("Knight Chicken") ? 0.1 : 0) + (f.has("Battle Fish") ? 0.05 : 0);
    return drill / drop;
  }

  /** Oil per greenhouse plant (plantGreenhouse.ts → getOilUsage). */
  greenhouseOil(crop: string): number {
    const f = this.f;
    let use = OIL.greenhouse[crop] ?? 0;
    const greasy = Math.min(f.skill("Greasy Plants"), 3);
    if (greasy) use *= OIL.greasyPlants.oil[greasy - 1];
    const slick = Math.min(f.skill("Slick Saver"), 3);
    if (slick) use -= OIL.slickSaver[slick - 1];
    if (crop === "Rice" && f.wears("Rice Shirt")) use *= 0.5;
    return Math.max(0, use);
  }

  /** Crop machine oil per hour (supplyCropMachine.ts → OIL_PER_HOUR_CONSUMPTION). */
  machineOilPerHour(): number {
    const r = (n: string, t: number[]) => { const l = Math.min(this.f.skill(n), 3); return l ? t[l - 1] : 0; };
    return (1 + r("Crop Processor Unit", OIL.cropProcessor) + r("Rapid Rig", OIL.rapidRig))
      * (1 - r("Oil Gadget", OIL.oilGadget) - r("Efficiency Extension Module", OIL.efficiencyModule));
  }

  greenhouse(): Category {
    const lines: Line[] = [];
    for (const crop of Object.keys(GREENHOUSE)) {
      const n = this.rate(`${crop} Harvested`);
      if (!n) continue;
      const qty = n * this.greenhouseYield(crop);
      // Seedy Business makes greenhouse seeds cheaper; Seeded Bounty takes one more seed per pot.
      const seedy = this.f.skill("Seedy Business");
      const seeds = (this.f.skill("Seeded Bounty") ? 2 : 1) * (seedy ? [0.85, 0.8, 0.75][Math.min(seedy, 3) - 1] : 1);
      const oil = n * this.greenhouseOil(crop) * this.oilPrice();
      lines.push(line(crop, crop, qty * this.price(crop), n * seeds * this.seedCost(crop) + oil, qty));
    }
    return sumCat("greenhouse", lines);
  }

  // ---------- Minerals (stoneMine.ts, ironMine.ts, mineGold.ts, mineCrimstone.ts) ----------

  private nodeTypes(nodes: Record<string, { name?: string; tier?: number; multiplier?: number }> | undefined, base: string) {
    const types = new Map<string, { tier: number; mult: number }>([[base, { tier: 1, mult: 1 }]]);
    Object.values(nodes ?? {}).forEach((n) => types.set(n.name ?? base, { tier: n.tier ?? 1, mult: n.multiplier ?? 1 }));
    return types;
  }
  private withTier(perNode: number, t: { tier: number; mult: number }) {
    return perNode * t.mult + (t.tier === 2 ? 0.5 : t.tier === 3 ? 2.5 : 0);
  }
  private shieldAndVolcano() {
    const f = this.f;
    return (f.faction && f.wears(f.faction.secondaryTool) ? 0.25 : 0) + (f.pastVolcano ? 0.1 : 0);
  }

  /**
   * Tin and Emerald Turtles add to the rocks on the 8 tiles around them (stoneMine.ts,
   * collisionDetection.ts). Spread over all rocks, weighted by each rock's multiplier.
   */
  private turtle(name: string, rocks: Record<string, { x?: number; y?: number; multiplier?: number }> | undefined, bonus: number): number {
    const at = this.f.raw.collectibles?.[name]?.[0]?.coordinates;
    if (!at || !rocks) return 0;
    let near = 0, all = 0;
    for (const r of Object.values(rocks)) {
      const w = r.multiplier ?? 1;
      all += w;
      if (r.x === undefined || r.y === undefined) continue;
      const dx = r.x - at.x, dy = r.y - at.y;
      if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1 && (dx || dy)) near += w;
    }
    return all ? bonus * near / all : 0;
  }

  stoneYield(): number {
    const f = this.f;
    return 1 + 0.2 /* 20 % native crit */
      + (f.has("Rock Golem") ? 0.2 : 0) + (f.inventory("Prospector") ? 0.2 : 0)
      + (f.has("Tunnel Mole") ? 0.25 : 0) + (f.has("Stone Beetle") ? 0.1 : 0)
      + f.rank("Rock'N'Roll") + f.buff("Rocky Favor") - f.debuff("Ferrous Favor")
      + this.turtle("Tin Turtle", this.f.raw.stones, 0.1) + this.turtle("Emerald Turtle", this.f.raw.stones, 0.5)
      + this.shieldAndVolcano();
  }
  ironYield(): number {
    const f = this.f;
    return 1 + 0.2
      + (f.has("Rocky the Mole") ? 0.25 : 0) + (f.has("Radiant Ray") ? 0.1 : 0)
      + (f.has("Iron Idol") ? 1 : 0) + (f.has("Iron Beetle") ? 0.1 : 0)
      + f.rank("Iron Bumpkin") - f.debuff("Rocky Favor") + f.buff("Ferrous Favor")
      + this.turtle("Emerald Turtle", this.f.raw.iron, 0.5)
      + this.shieldAndVolcano();
  }
  goldYield(): number {
    const f = this.f;
    return 1 + 0.2
      + (f.inventory("Gold Rush") ? 0.5 : 0) + f.rank("Golden Touch")
      + (f.has("Nugget") ? 0.25 : 0) + (f.has("Gilded Swordfish") ? 0.1 : 0) + (f.has("Gold Beetle") ? 0.1 : 0)
      + this.turtle("Emerald Turtle", this.f.raw.gold, 0.5)
      + this.shieldAndVolcano();
  }
  /** Average per mine, a crimstone rock giving 5 mines with the bonus on the last one. */
  crimstoneYield(): number {
    const f = this.f;
    const each = 1 + (f.has("Crimson Carp") ? 0.05 : 0) + (f.has("Crim Peckster") ? 0.1 : 0) + (f.wears("Crimstone Armor") ? 0.1 : 0);
    const last = 2 + (f.wears("Crimstone Hammer") ? 2 : 0) + f.rank("Fire Kissed") + (f.has("Mushroom Chicken") ? 0.5 : 0);
    return each + last / 5;
  }

  toolCost(tool: string): number {
    const t = TOOLS[tool];
    let crafted = this.rate(`${tool} Crafted`);
    if (tool === "Pickaxe" && this.f.has("Quarry")) crafted = 0; // stone needs no pickaxe at all
    const fm = this.f.skill("Frugal Miner");
    const frugal = tool.endsWith("Pickaxe") && fm ? [0.8, 0.7, 0.6][Math.min(fm, 3) - 1] : 1;
    const unit = this.coins(t.coins * frugal) + Object.entries(t.items).reduce((a, [i, q]) => a + q * this.price(i), 0);
    return crafted * unit;
  }

  minerals(): Category {
    const stoneTypes = this.nodeTypes(this.f.raw.stones, "Stone Rock");
    const ironTypes = this.nodeTypes(this.f.raw.iron, "Iron Rock");
    const goldTypes = this.nodeTypes(this.f.raw.gold, "Gold Rock");
    const qty = (types: Map<string, { tier: number; mult: number }>, perNode: number) =>
      [...types].reduce((a, [name, t]) => a + this.rate(`${name} Mined`) * this.withTier(perNode, t), 0);

    const stone = qty(stoneTypes, this.stoneYield());
    const iron = qty(ironTypes, this.ironYield());
    const gold = qty(goldTypes, this.goldYield());
    const crim = this.rate("Crimstone Mined") * this.crimstoneYield();
    return sumCat("minerals", [
      line("Gold", "Or", gold * this.price("Gold"), this.toolCost("Iron Pickaxe"), gold),
      line("Iron", "Fer", iron * this.price("Iron"), this.toolCost("Stone Pickaxe"), iron),
      line("Crimstone", "Crimstone", crim * this.price("Crimstone"), this.toolCost("Gold Pickaxe"), crim),
      line("Stone", "Pierre", stone * this.price("Stone"), this.toolCost("Pickaxe"), stone),
    ]);
  }

  // ---------- Animals (lib/animals.ts → getResourceDropAmount, getBoostedFoodQuantity) ----------

  private bale(): number {
    if (!this.f.has("Bale")) return 0;
    const db = this.f.skill("Double Bale");
    return 0.1 * (db ? [2, 2.5, 3][Math.min(db, 3) - 1] : 1);
  }
  private allProduce(): number {
    return (this.f.wears("Cattlegrim") ? 0.25 : 0) + (this.f.inventory("Barn Manager") > 0 ? 0.1 : 0);
  }
  private fibre(favoured: string): number {
    const f = this.f;
    let b = f.rank("Fine Fibers");
    for (const s of ["Featherweight", "Merino Whisperer", "Leathercraft Mastery"] as const) {
      b += s === favoured ? f.buff(s) : -f.debuff(s);
    }
    return b;
  }

  /** Extra amount added to each produce, on top of the level's base. */
  produceBonus(resource: string): number {
    const f = this.f, ah = f.rank("Abundant Harvest"), econ = f.skill("Bale Economy") ? this.bale() : 0;
    const all = this.allProduce();
    switch (resource) {
      case "Egg": return all + ah + this.bale()
        + (f.has("Chicken Coop") ? 1 : 0) + (f.has("Rich Chicken") ? 0.1 : 0) + (f.has("Undead Rooster") ? 0.1 : 0)
        + (f.has("Ayam Cemani") ? 0.2 : 0) + (f.has("Squid Chicken") ? 0.1 : 0) + (f.has("Ascended Chicken") ? 0.1 : 0);
      case "Feather": return all + (f.wears("Chicken Suit") ? 1 : 0) + (f.has("Alien Chicken") ? 0.1 : 0) + this.fibre("Featherweight");
      case "Wool": return all + ah + econ + (f.wears("Black Sheep Onesie") ? 2 : 0) + (f.wears("White Sheep Onesie") ? 0.25 : 0)
        + (f.has("Astronaut Sheep") ? 0.1 : 0) + (f.has("Ascended Sheep") ? 0.05 : 0);
      case "Merino Wool": return all + (f.wears("Merino Jumper") ? 1 : 0) + (f.has("Toxic Tuft") ? 0.1 : 0) + this.fibre("Merino Whisperer");
      case "Milk": return all + ah + econ + (f.has("Longhorn Cowfish") ? 0.2 : 0) + (f.has("Spa Cow") ? 0.1 : 0)
        + (f.wears("Milk Apron") ? 0.5 : 0) + (f.wears("Cowbell Necklace") ? 2 : 0);
      case "Leather": return all + (f.has("Moo-ver") ? 0.25 : 0) + (f.has("Mootant") ? 0.1 : 0) + this.fibre("Leathercraft Mastery");
      default: return all;
    }
  }

  /** Food units eaten per feeding (getBoostedFoodQuantity). */
  foodQty(type: string): number {
    const f = this.f;
    let q = FOOD_QTY[type] ?? 1;
    if (type === "Chicken" && f.has("Fat Chicken")) q *= 0.9;
    if (type === "Cow" && f.has("Dr Cow")) q *= 0.95;
    if (type === "Sheep" && f.has("Mermaid Sheep")) q *= 0.95;
    if (type === "Chicken" && f.has("Cluckulator")) q *= 0.75;
    if ((type === "Sheep" || type === "Cow") && f.wears("Infernal Bullwhip")) q *= 0.5;
    const ef = f.rank("Efficient Feeding");
    if (ef) q *= ef;
    for (const [skill, animal] of Object.entries(DIET_SKILLS)) {
      if (!f.skill(skill)) continue;
      q *= animal === type ? f.buff(skill as keyof typeof DIET_SKILLS) : f.debuff(skill as keyof typeof DIET_SKILLS);
    }
    return q;
  }

  feedPrice(food: string): number {
    return Object.entries(FEED_RECIPES[food] ?? {}).reduce((a, [i, q]) => a + q * this.price(i), 0);
  }

  animalLine(type: string, label: string): Line | null {
    const herd = animals(this.f.raw, type);
    const fed = this.rate(`${type} Fed`);
    if (!herd.length || !fed) return null;
    const drops = ANIMAL_DROPS[type];
    // feedAnimal.ts: a placed golden animal makes every feeding of its kind free.
    const free = this.f.has(FREE_FEED[type] ?? "");
    let value = 0, food = 0;
    for (const a of herd) {
      const lvl = animalLevel(type, a.experience);
      for (const [res, table] of Object.entries(drops)) {
        value += (table[lvl] * (a.multiplier ?? 1) + this.produceBonus(res)) * this.price(res);
      }
      food += type === "Pig" || free ? 0 : this.foodQty(type) * this.feedPrice(favouriteFood(lvl));
    }
    return line(type, label, (fed * value) / herd.length, (fed * food) / herd.length);
  }

  animals(): Category {
    const lines = [
      this.animalLine("Sheep", "Moutons"),
      this.animalLine("Cow", "Vaches"),
      this.animalLine("Chicken", "Poules"),
      this.animalLine("Pig", "Cochons"),
    ].filter((l): l is Line => !!l);
    return sumCat("animals", lines);
  }

  report(): Report {
    const categories = { crops: this.crops(), animals: this.animals(), greenhouse: this.greenhouse(), minerals: this.minerals() };
    const cats = Object.values(categories);
    return {
      categories,
      net: cats.reduce((a, c) => a + c.net, 0),
      gross: cats.reduce((a, c) => a + c.gross, 0),
      cost: cats.reduce((a, c) => a + c.cost, 0),
    };
  }
}

/** Daily rates from two or more farmActivity snapshots (oldest first). */
export function dailyRates(snaps: { at: number; farmActivity: Record<string, number> }[]): { rates: Rates; days: number } {
  if (snaps.length < 2) return { rates: {}, days: 0 };
  const a = snaps[0], b = snaps[snaps.length - 1];
  const days = (b.at - a.at) / 86_400_000;
  if (days <= 0) return { rates: {}, days: 0 };
  const rates: Rates = {};
  for (const k of new Set([...Object.keys(a.farmActivity), ...Object.keys(b.farmActivity)])) {
    const d = (b.farmActivity[k] ?? 0) - (a.farmActivity[k] ?? 0);
    if (d > 0) rates[k] = d / days;
  }
  return { rates, days };
}
