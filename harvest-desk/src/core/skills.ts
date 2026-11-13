import data from "./data/skills.json";
import { Engine, type CategoryKey, type Market, type Rates, type Report } from "./engine";
import { animals, type Farm } from "./farm";
import { CROPS, cropTier, SKILL_RANKS, SPLIT_SKILLS } from "./gameData";

/**
 * Skill tree analysis: what each skill brings on this farm, and the best tree for the points.
 * Rules from the game code: types/bumpkinSkills.ts, events/landExpansion/choseSkill.ts,
 * upgradeSkill.ts, resetSkills.ts and lib/level.ts.
 */

export interface SkillDef {
  name: string;
  tree: string;
  tier: 1 | 2 | 3;
  points: number;
  maxLevel: number;
  kind: string | null;
  ranks: number[] | null;
  power: boolean;
  disabled: boolean;
  buff: string | null;
  debuff: string | null;
}

export const SKILL_DEFS = data.skills as SkillDef[];
const DEF = new Map(SKILL_DEFS.map((d) => [d.name, d]));

/** Points for each rank above 1, by the skill's tier (getSkillUpgradeCost). */
export const UPGRADE_POINTS: Record<number, number> = { 1: 1, 2: 3, 3: 6 };
/** Each rank above 1 also costs Ascension Shards, as many as the skill's tier. A reset gives them back. */
export const shardsOf = (ranks: Record<string, number>) =>
  Object.entries(ranks).reduce((a, [n, r]) => a + (DEF.get(n) && r > 1 ? DEF.get(n)!.tier * (r - 1) : 0), 0);
/** Shards one Ascension Crystal gives (mineAscensionCrystal.ts). */
export const SHARDS_PER_CRYSTAL = 3;

/** Skills the revenue engine models directly: valued by running it with and without them. */
const ENGINE_SKILLS = new Set<string>([
  ...Object.keys(SKILL_RANKS), ...Object.keys(SPLIT_SKILLS),
  "Double Bale", "Bale Economy", "Glass Room", "Greenhouse Gamble", "Seeded Bounty", "Seedy Business", "Frugal Miner",
  "Tough Tree", "Lumberjack's Extra", "Money Tree", "Feller's Discount",
  "Horror Mike", "Laurie's Gains", "Greasy Plants", "Slick Saver", "Oil Extraction", "Oil Rig", "Oil Gadget", "Efficiency Extension Module",
]);

/**
 * Speed skills. The engine reads measured activity, which already includes them, so their
 * value is a share of the lines they speed up, assuming you collect as soon as it is ready.
 */
type Target = { cat: CategoryKey; line?: (key: string) => boolean };
const advanced = (k: string) => !!CROPS[k] && cropTier(k) === "advanced";
const only = (...keys: string[]) => (k: string) => keys.includes(k);
const SPEED: Record<string, Target> = {
  "Green Thumb": { cat: "crops" },
  "Strong Roots": { cat: "crops", line: advanced },
  "Restless Animals": { cat: "animals" },
  "Rice and Shine": { cat: "greenhouse" },
  "Rice Rocket": { cat: "greenhouse", line: only("Rice") },
  "Olive Express": { cat: "greenhouse", line: only("Olive") },
  "Vine Velocity": { cat: "greenhouse", line: only("Grape") },
  "Speed Miner": { cat: "minerals", line: only("Stone") },
  "Iron Hustle": { cat: "minerals", line: only("Iron") },
  "Midas Sprint": { cat: "minerals", line: only("Gold") },
  "Midas Rush": { cat: "minerals", line: only("Gold") },
  "Fireside Alchemist": { cat: "minerals", line: only("Crimstone") },
  "Tree Charge": { cat: "wood" },
  // A rank % chance that the tree is back at once: average time × (1 − chance).
  "Tree Turnaround": { cat: "wood" },
};
const CHANCE_SPEED: Record<string, number[]> = { "Tree Turnaround": [0.15, 0.25, 0.35] };

/** Time multiplier at a rank: from the rank table, or the "x0.8 …" of the description. */
function speedAt(def: SkillDef, rank: number): number {
  const c = CHANCE_SPEED[def.name];
  if (c) return 1 - c[Math.min(rank, c.length) - 1];
  if (def.ranks?.length) return def.ranks[Math.min(rank, def.ranks.length) - 1];
  const m = /^x([\d.]+)/.exec(def.buff ?? "");
  return m ? Number(m[1]) : 1;
}

function targetNet(r: Report, t: Target): number {
  const c = r.categories[t.cat];
  return t.line ? c.lines.filter((l) => t.line!(l.key)).reduce((a, l) => a + l.net, 0) : c.net;
}

/**
 * Power skills that finish a whole cycle at once (skillUsed.ts): one extra harvest of every
 * plot, pot or animal per cooldown, assuming you use it as soon as it is back.
 * Cooldowns in hours per rank (types/bumpkinSkills.ts).
 */
const POWER: Record<string, { cat: CategoryKey; hours: number[] }> = {
  "Instant Growth": { cat: "crops", hours: [72, 60, 48] },
  "Greenhouse Guru": { cat: "greenhouse", hours: [96, 84, 72] },
  "Barnyard Rouse": { cat: "animals", hours: [120, 96, 84] },
  "Tree Blitz": { cat: "wood", hours: [24, 18, 12] },
};

/** FLOWER earned by one full cycle of a category: its daily net divided by cycles per day. */
function cycleValue(farm: Farm, rates: Rates, r: Report, cat: CategoryKey): number {
  const rate = (k: string) => rates[k] ?? 0;
  if (cat === "crops") {
    // Plots only: the crop machine is not touched by Instant Growth.
    const plots = Object.keys(farm.crops ?? {}).length;
    let net = 0, harvests = 0;
    for (const l of r.categories.crops.lines) {
      const h = rate(`${l.key} Harvested`);
      if (!h) continue;
      const p = Math.min(rate(`${l.key} Planted`), h);
      net += l.net * (p / h); harvests += p;
    }
    return harvests ? (net * plots) / harvests : 0;
  }
  if (cat === "greenhouse") {
    const pots = Object.keys((farm as { greenhouse?: { pots?: object } }).greenhouse?.pots ?? {}).length || 4;
    const harvests = r.categories.greenhouse.lines.reduce((a, l) => a + rate(`${l.key} Harvested`), 0);
    return harvests ? (r.categories.greenhouse.net * pots) / harvests : 0;
  }
  if (cat === "wood") {
    const trees = Object.keys(farm.trees ?? {}).length;
    const chops = r.categories.wood.lines.reduce((a, l) => a + rate(`${l.key === "Tree" ? "Basic Tree" : l.key} Chopped`), 0);
    return chops ? (r.categories.wood.net * trees) / chops : 0;
  }
  // Animals: each type's net per feeding round of the whole herd.
  return r.categories.animals.lines.reduce((a, l) => {
    const fed = rate(`${l.key} Fed`), herd = animals(farm, l.key).length;
    return a + (fed ? (l.net * herd) / fed : 0);
  }, 0);
}

export type How = "engine" | "speed" | "power" | "none";
export interface SkillValue {
  def: SkillDef;
  /** Rank owned now, 0 when not learnt. */
  current: number;
  /** FLOWER per day at rank 1..maxLevel, compared with not having the skill. */
  value: number[];
  how: How;
  /** Category the skill feeds, for the icon. */
  cat: CategoryKey | null;
}

/** What each skill of the tree brings on this farm, per rank. */
export function valueSkills(farm: Farm, rates: Rates, market: Market): SkillValue[] {
  const owned = farm.bumpkin?.skills ?? {};
  const base = new Engine(farm, rates, market).report();
  return SKILL_DEFS.filter((d) => !d.disabled).map((def) => {
    const current = Math.max(0, Math.min(Math.floor(owned[def.name] ?? 0), def.maxLevel));
    const levels = [...Array(def.maxLevel)].map((_, i) => i + 1);
    if (ENGINE_SKILLS.has(def.name)) {
      const none = new Engine(farm, rates, market, { removeSkills: [def.name] }).report();
      const value = levels.map((r) => new Engine(farm, rates, market, { skills: { [def.name]: r } }).report().net - none.net);
      return { def, current, value, how: "engine" as const, cat: biggest(base, none) };
    }
    const t = SPEED[def.name];
    if (t) {
      // Measured income is at the current multiplier m0; throughput goes with 1 / multiplier.
      const n0 = targetNet(base, t), m0 = current ? speedAt(def, current) : 1;
      const value = levels.map((r) => n0 * m0 * (1 / speedAt(def, r) - 1));
      return { def, current, value, how: "speed" as const, cat: t.cat };
    }
    const pw = POWER[def.name];
    if (pw) {
      const cycle = cycleValue(farm, rates, base, pw.cat);
      return { def, current, value: levels.map((r) => (cycle * 24) / pw.hours[r - 1]), how: "power" as const, cat: pw.cat };
    }
    return { def, current, value: levels.map(() => 0), how: "none" as const, cat: null };
  });
}

function biggest(a: Report, b: Report): CategoryKey | null {
  let best: CategoryKey | null = null, d = 1e-9;
  for (const k of Object.keys(a.categories) as CategoryKey[]) {
    const x = Math.abs(a.categories[k].net - b.categories[k].net);
    if (x > d) { d = x; best = k; }
  }
  return best;
}

// ---------- Points and tiers ----------

const LEVELS = data.levels as Record<string, number>;
const PRE_ASCENSION_MAX = 150, PER_ASCENSION = 50;
const bandXp = (a: number) => Math.round((50_000_000 * 1.45 ** (a - 1)) / 5_000_000) * 5_000_000;
const levelXp = (a: number, n: number) => (bandXp(a) * (1 + 0.03 * n)) / 85.75;

/** Total bumpkin level, ascension bands included: one skill point per level (lib/level.ts). */
export function totalLevel(experience: number, ascension: number): number {
  if (ascension < 1) {
    let lvl = 1;
    for (let l = 1; l <= PRE_ASCENSION_MAX; l++) if (experience >= (LEVELS[l] ?? Infinity)) lvl = l; else break;
    return lvl;
  }
  let start = LEVELS[PRE_ASCENSION_MAX];
  for (let b = 1; b < ascension; b++) start += bandXp(b);
  let level = 0;
  if (experience >= start + bandXp(ascension)) level = PER_ASCENSION;
  else if (experience >= start) {
    level = 1;
    for (let n = 1; n < PER_ASCENSION - 1; n++) {
      const next = start + levelXp(ascension, n);
      if (experience >= next) { level = n + 1; start = next; } else break;
    }
  }
  return PRE_ASCENSION_MAX + (ascension - 1) * PER_ASCENSION + level;
}

/** Points a set of skills costs: the base price, plus each rank above 1. */
export function pointsOf(ranks: Record<string, number>): number {
  let p = 0;
  for (const [n, r] of Object.entries(ranks)) {
    const d = DEF.get(n);
    if (!d || r < 1) continue;
    p += d.points + (r > 1 ? UPGRADE_POINTS[d.tier] * (r - 1) : 0);
  }
  return p;
}

const THRESHOLDS = new Map<string, [number, number]>();
for (const tree of new Set(SKILL_DEFS.map((d) => d.tree))) {
  const t1 = SKILL_DEFS.filter((d) => d.tree === tree && d.tier === 1).map((d) => d.points).sort((a, b) => a - b);
  const sum = (x: number[]) => x.reduce((a, b) => a + b, 0);
  THRESHOLDS.set(tree, [sum(t1.slice(0, Math.ceil(t1.length / 2))), sum(t1) + 1]);
}

/** Base points spent in a tree's tier 1 and 2 skills, and the totals that open tiers 2 and 3. */
export function tierProgress(ranks: Record<string, number>, tree: string): { spent: number; t2: number; t3: number } {
  let spent = 0;
  for (const [n, r] of Object.entries(ranks)) {
    const d = DEF.get(n);
    if (d && r > 0 && d.tree === tree && d.tier !== 3) spent += d.points;
  }
  const [t2, t3] = THRESHOLDS.get(tree) ?? [0, 0];
  return { spent, t2, t3 };
}

/** Highest tier open in a tree: base points spent on its tier 1 and 2 skills (getUnlockedTierForTree). */
export function unlockedTier(ranks: Record<string, number>, tree: string): number {
  let spent = 0;
  for (const [n, r] of Object.entries(ranks)) {
    const d = DEF.get(n);
    if (d && r > 0 && d.tree === tree && d.tier !== 3) spent += d.points;
  }
  const [t2, t3] = THRESHOLDS.get(tree)!;
  return spent >= t3 ? 3 : spent >= t2 ? 2 : 1;
}

/** Tier the tree must have open to buy `toRank` (base purchase or rank-up). */
const tierNeeded = (d: SkillDef, toRank: number) => (toRank <= 1 ? d.tier : Math.min(3, d.tier + toRank - 1));

// ---------- Best tree ----------

export interface Plan {
  ranks: Record<string, number>;
  points: number;
  shards: number;
  /** FLOWER per day from the skills the app can put a number on. */
  value: number;
}

const valueAt = (v: SkillValue, rank: number) => (rank > 0 ? v.value[rank - 1] : 0);

/**
 * Greedy tree for a point budget: starts from `keep`, then repeatedly buys the move with the
 * best FLOWER per point. A move is a skill or a rank-up, plus the cheapest skills of the same
 * tree needed to open its tier. Moves that lose money are never bought.
 */
export function bestTree(values: SkillValue[], budget: number, keep: Record<string, number> = {}, shardBudget = Infinity): Plan {
  const byName = new Map(values.map((v) => [v.def.name, v]));
  const ranks: Record<string, number> = { ...keep };
  let points = pointsOf(ranks);
  let shards = shardsOf(ranks);

  for (let guard = 0; guard < 500; guard++) {
    let best: { gain: number; cost: number; add: Record<string, number>; sh: number } | null = null;
    for (const v of values) {
      if (v.how === "none") continue;
      const r = ranks[v.def.name] ?? 0;
      if (r >= v.def.maxLevel) continue;
      const gain0 = valueAt(v, r + 1) - valueAt(v, r);
      if (gain0 <= 1e-6) continue;
      const add: Record<string, number> = { [v.def.name]: r + 1 };
      const sh = r === 0 ? 0 : v.def.tier;
      if (shards + sh > shardBudget) continue;
      let cost = r === 0 ? v.def.points : UPGRADE_POINTS[v.def.tier];
      let gain = gain0;
      // Open the tier with the best-value cheap skills of the same tree.
      const trial = { ...ranks, ...add };
      const need = tierNeeded(v.def, r + 1);
      let ok = true;
      while (unlockedTier(trial, v.def.tree) < need) {
        const open = unlockedTier(trial, v.def.tree);
        const fill = values
          .filter((x) => x.def.tree === v.def.tree && x.def.tier < 3 && x.def.tier <= open && !(trial[x.def.name] > 0) && !x.def.power)
          .sort((a, b) => valueAt(b, 1) / b.def.points - valueAt(a, 1) / a.def.points || a.def.points - b.def.points)[0];
        if (!fill) { ok = false; break; }
        trial[fill.def.name] = 1; add[fill.def.name] = 1;
        cost += fill.def.points; gain += valueAt(fill, 1);
      }
      if (!ok || points + cost > budget || gain <= 1e-6) continue;
      if (!best || gain / cost > best.gain / best.cost) best = { gain, cost, add, sh };
    }
    if (!best) break;
    Object.assign(ranks, best.add);
    points += best.cost;
    shards += best.sh;
  }
  const value = Object.entries(ranks).reduce((a, [n, r]) => a + (byName.get(n) ? valueAt(byName.get(n)!, r) : 0), 0);
  return { ranks, points, shards, value };
}

export interface SkillAnalysis {
  values: SkillValue[];
  earned: number;
  used: number;
  current: Plan;
  /** Best tree after a reset, built from scratch with all the points and shards. */
  proposed: Plan;
  /** Best use of the points not spent yet, without a reset. */
  topUp: Plan;
  reset: { freeAt: number; gems: number };
  /** Ascension Shards: mined (3 per crystal), spent on ranks now, and left if the game reports them. */
  shards: { mined: number; spent: number; held: number; known: boolean };
}

const DAY = 86_400_000;

export function analyseSkills(farm: Farm, rates: Rates, market: Market): SkillAnalysis {
  const values = valueSkills(farm, rates, market);
  const owned: Record<string, number> = {};
  for (const [n, r] of Object.entries(farm.bumpkin?.skills ?? {})) if (DEF.has(n) && r > 0) owned[n] = Math.min(Math.floor(r), DEF.get(n)!.maxLevel);
  const earned = totalLevel(farm.bumpkin?.experience ?? 0, farm.island?.ascensionLevel ?? 0);
  const used = pointsOf(owned);
  const byName = new Map(values.map((v) => [v.def.name, v]));
  const valueOf = (ranks: Record<string, number>) =>
    Object.entries(ranks).reduce((a, [n, r]) => a + (byName.get(n) ? valueAt(byName.get(n)!, r) : 0), 0);
  const spent = shardsOf(owned);
  const mined = (farm.farmActivity?.["Ascension Crystal Mined"] ?? 0) * SHARDS_PER_CRYSTAL;
  const inv = farm.inventory?.["Ascension Shard"];
  // The Community API leaves the shard count out: assume mined minus spent.
  const held = inv !== undefined ? Number(inv) : Math.max(0, mined - spent);
  // After a reset everything comes back: the ideal tree starts from nothing, with every point and shard.
  const proposed = bestTree(values, Math.max(earned, used), {}, held + spent);
  const topUp = bestTree(values, Math.max(earned, used), owned, held + spent);
  const b = farm.bumpkin ?? {};
  return {
    values, earned, used, shards: { mined, spent, held, known: inv !== undefined },
    current: { ranks: owned, points: used, shards: spent, value: valueOf(owned) },
    proposed, topUp,
    reset: { freeAt: (b.previousFreeSkillResetAt ?? 0) + 180 * DAY, gems: 200 * 2 ** (b.paidSkillResets ?? 0) },
  };
}
