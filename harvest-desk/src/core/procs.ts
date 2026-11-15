/**
 * "Pops" of chance skills, read from the farm's boostsUsedAt.
 *
 * The game keeps only the time a boost was last used, not a count. A chance skill such as
 * Money Tree is recorded only when it triggers (chop.ts → getReward), so every new time seen
 * between two readings is one pop. Two pops between the same two readings show as one: with
 * readings every 10 minutes and ~1 to 2 pops a day this is rare.
 *
 * Only the time covered by close readings counts, for pops and for the chops they are compared
 * with: while the app is closed, pops can be missed, so those chops are left out too.
 */

export interface ProcEvent {
  at: number;
  boost: string;
  /** The tree chopped at that moment, when it was still in that state at the reading. */
  tree?: string;
  mult?: number;
  coins?: number;
  /** Seen at the first reading: it happened before the tracking started. */
  before?: boolean;
}

/** One reading: time, then the Basic, Ancient and Sacred Tree chop counters. */
export type ProcRead = [number, number, number, number];

export interface ProcLog { since: number; events: ProcEvent[]; reads: ProcRead[] }

/** Chance skills tracked, with their chance per action by rank. */
export const TRACKED: Record<string, { chance: number[]; coinsPer: number }> = {
  "Money Tree": { chance: [0.01, 0.02, 0.03], coinsPer: 200 },
};

export const KINDS = ["Basic Tree", "Ancient Tree", "Sacred Tree"] as const;
const TREE_KINDS: Record<string, string> = { Tree: "Basic Tree", "Ancient Tree": "Ancient Tree", "Sacred Tree": "Sacred Tree" };
export const TREE_FR: Record<string, string> = { "Basic Tree": "Arbre", "Ancient Tree": "Arbre ancien", "Sacred Tree": "Arbre sacré" };

/** Two readings further apart than this leave a gap: what happened in between is not counted. */
export const MAX_GAP = 25 * 60_000;
const KEEP = 90 * 86_400_000;

type FarmLike = {
  boostsUsedAt?: Record<string, number>;
  farmActivity?: Record<string, number>;
  trees?: Record<string, { name?: string; multiplier?: number; wood?: { choppedAt?: number } }>;
};

/** The tree whose last chop happened at `at` (same action, same timestamp, give or take a second). */
function treeAt(farm: FarmLike, at: number) {
  for (const t of Object.values(farm.trees ?? {})) {
    const c = t.wood?.choppedAt;
    if (c && Math.abs(c - at) <= 1000) return { tree: TREE_KINDS[t.name ?? "Tree"] ?? "Basic Tree", mult: t.multiplier ?? 1 };
  }
  return null;
}

/** Adds what this reading shows. The first reading starts the log. */
export function updateProcs(log: ProcLog | null, farm: FarmLike, now: number): ProcLog {
  const first = !log;
  const out: ProcLog = log
    ? { since: log.since, events: [...log.events], reads: (log.reads ?? []).filter((r) => r[0] > now - KEEP) }
    : { since: now, events: [], reads: [] };
  const fa = farm.farmActivity ?? {};
  out.reads.push([now, ...KINDS.map((k) => Number(fa[`${k} Chopped`] ?? 0))] as ProcRead);
  for (const [boost, def] of Object.entries(TRACKED)) {
    const at = farm.boostsUsedAt?.[boost];
    if (!at || out.events.some((e) => e.boost === boost && e.at === at)) continue;
    const t = treeAt(farm, at);
    out.events.push({
      at, boost,
      ...(t ? { tree: t.tree, mult: t.mult, coins: def.coinsPer * t.mult } : {}),
      ...(first || at < out.since ? { before: true } : {}),
    });
  }
  out.events.sort((a, b) => a.at - b.at);
  return out;
}

export interface DayStat { day: number; pops: number; coins: number; expectedPops: number; expectedCoins: number; chops: number; hours: number }
export interface ProcStats {
  /** Hours covered by close readings. */
  hours: number;
  pops: number;
  coins: number;
  chops: number;
  /** All chops per day, gaps included (from the first and last reading). */
  chopsPerDay: number;
  /** Pops whose tree could not be found: their coins are estimated at the average pop. */
  unknown: number;
  expectedPops: number;
  expectedCoins: number;
  perDay: DayStat[];
  byTree: { tree: string; pops: number; coins: number; expectedPops: number }[];
}

const DAY = 86_400_000;
const dayStart = (t: number) => { const d = new Date(t); d.setHours(0, 0, 0, 0); return d.getTime(); };

/**
 * Real pops against what the skill should give: chops between readings × chance × 200 coins
 * × the tree's multiplier. `mults` maps a tree kind to its multiplier on the farm.
 */
export function procStats(log: ProcLog, rank: number, mults: Record<string, number>, boost = "Money Tree"): ProcStats {
  const def = TRACKED[boost];
  const chance = rank > 0 ? def.chance[Math.min(rank, def.chance.length) - 1] : 0;
  const reads = [...(log.reads ?? [])].sort((a, b) => a[0] - b[0]);
  const events = log.events.filter((e) => e.boost === boost && !e.before);
  const days = new Map<number, DayStat>();
  const dayOf = (t: number) => {
    const d = dayStart(t);
    if (!days.has(d)) days.set(d, { day: d, pops: 0, coins: 0, expectedPops: 0, expectedCoins: 0, chops: 0, hours: 0 });
    return days.get(d)!;
  };
  const tree = Object.fromEntries(KINDS.map((k) => [k, { chops: 0, pops: 0, coins: 0 }]));
  const counted: ProcEvent[] = [];

  for (let i = 1; i < reads.length; i++) {
    const [t0, ...c0] = reads[i - 1], [t1, ...c1] = reads[i];
    const d = dayOf(t1);
    if (t1 - t0 > MAX_GAP) continue;
    d.hours += (t1 - t0) / 3_600_000;
    KINDS.forEach((k, j) => {
      const n = Math.max(0, c1[j] - c0[j]);
      tree[k].chops += n;
      d.chops += n;
      d.expectedPops += n * chance;
      d.expectedCoins += n * chance * def.coinsPer * (mults[k] ?? 1);
    });
    for (const e of events) if (e.at > t0 && e.at <= t1) counted.push(e);
  }

  const chops = KINDS.reduce((a, k) => a + tree[k].chops, 0);
  const avgCoins = chops ? KINDS.reduce((a, k) => a + tree[k].chops * def.coinsPer * (mults[k] ?? 1), 0) / chops : def.coinsPer;
  for (const e of counted) {
    const c = e.coins ?? avgCoins, d = dayOf(e.at);
    d.pops++; d.coins += c;
    if (e.tree && tree[e.tree]) { tree[e.tree].pops++; tree[e.tree].coins += c; }
  }

  const perDay = [...days.values()].sort((a, b) => a.day - b.day);
  // Fill missing days so the chart shows gaps as empty days.
  const filled: DayStat[] = [];
  for (let d = perDay[0]?.day; d !== undefined && d <= perDay[perDay.length - 1].day; d = dayStart(d + DAY + 3_600_000)) {
    filled.push(days.get(d) ?? { day: d, pops: 0, coins: 0, expectedPops: 0, expectedCoins: 0, chops: 0, hours: 0 });
  }

  return {
    hours: perDay.reduce((a, d) => a + d.hours, 0),
    chopsPerDay: reads.length > 1 && reads[reads.length - 1][0] - reads[0][0] > 3_600_000
      ? KINDS.reduce((a, _k, j) => a + Math.max(0, reads[reads.length - 1][j + 1] - reads[0][j + 1]), 0) / ((reads[reads.length - 1][0] - reads[0][0]) / DAY)
      : 0,
    pops: counted.length,
    coins: counted.reduce((a, e) => a + (e.coins ?? avgCoins), 0),
    chops,
    unknown: counted.filter((e) => e.coins === undefined).length,
    expectedPops: perDay.reduce((a, d) => a + d.expectedPops, 0),
    expectedCoins: perDay.reduce((a, d) => a + d.expectedCoins, 0),
    perDay: filled,
    byTree: KINDS.map((k) => ({ tree: k, pops: tree[k].pops, coins: tree[k].coins, expectedPops: tree[k].chops * chance })),
  };
}

/** Multiplier of each tree kind on the farm (the highest, if several). */
export function treeMults(farm: FarmLike): Record<string, number> {
  const out: Record<string, number> = {};
  for (const t of Object.values(farm.trees ?? {})) {
    const k = TREE_KINDS[t.name ?? "Tree"] ?? "Basic Tree";
    out[k] = Math.max(out[k] ?? 0, t.multiplier ?? 1);
  }
  return out;
}
