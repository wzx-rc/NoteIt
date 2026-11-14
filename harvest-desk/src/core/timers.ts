/**
 * When each thing on the farm is ready: crops, rocks, trees, animals, hives, kitchens, power skills…
 *
 * The game stores, for each timer, its start and its `baseDurationMs` of work (permanent boosts already
 * folded in). Temporary boosts (totems, hourglasses, pet shrines, Power Hour, sunshower, Rapid Root…) are
 * speed windows: while one covers the timer, work accrues faster. The ready time is when the accrued work
 * reaches `baseDurationMs`. Same model as the game (src/features/game/lib/boostWindows.ts), written again
 * here without any dependency so the same file can run in the app, the desktop widget and the phone widget.
 */

export type TimerGroup =
  | "crops" | "greenhouse" | "machine" | "fruits" | "flowers"
  | "trees" | "stone" | "iron" | "gold" | "crimstone" | "sunstone" | "oil"
  | "chickens" | "cows" | "sheep" | "pigs" | "honey"
  | "compost" | "cooking" | "aging" | "crabs" | "power";

export const TIMER_GROUPS: { key: TimerGroup; label: string; icon: string }[] = [
  { key: "crops", label: "Parcelles", icon: "wheat" },
  { key: "greenhouse", label: "Serre", icon: "rice" },
  { key: "machine", label: "Machine à crops", icon: "wheat" },
  { key: "fruits", label: "Fruits", icon: "fruit" },
  { key: "flowers", label: "Fleurs", icon: "flower" },
  { key: "trees", label: "Arbres", icon: "wood" },
  { key: "stone", label: "Pierre", icon: "pick" },
  { key: "iron", label: "Fer", icon: "iron" },
  { key: "gold", label: "Or", icon: "gold" },
  { key: "crimstone", label: "Crimstone", icon: "crim" },
  { key: "sunstone", label: "Sunstone", icon: "gold" },
  { key: "oil", label: "Pétrole", icon: "lightning" },
  { key: "chickens", label: "Poules", icon: "sheep" },
  { key: "cows", label: "Vaches", icon: "sheep" },
  { key: "sheep", label: "Moutons", icon: "sheep" },
  { key: "pigs", label: "Cochons", icon: "sheep" },
  { key: "honey", label: "Ruches", icon: "honey" },
  { key: "compost", label: "Composteurs", icon: "bag" },
  { key: "cooking", label: "Cuisine", icon: "coins" },
  { key: "aging", label: "Vieillissement", icon: "timers" },
  { key: "crabs", label: "Casiers", icon: "timers" },
  { key: "power", label: "Power skills", icon: "lightning" },
];

export interface Timer {
  group: TimerGroup;
  /** What is growing or cooking: "Rice", "Pizza Margherita", "Instant Growth"… */
  label: string;
  /** Epoch ms. `null` when it is idle (empty plot, composter not started) or paused (hive without flowers). */
  readyAt: number | null;
  /** Why it is idle or paused. */
  state?: "empty" | "paused" | "sick";
  /** When it started, for progress bars. */
  startedAt?: number;
}

export interface GroupSummary {
  key: TimerGroup;
  label: string;
  icon: string;
  total: number;
  /** Ready now. */
  ready: number;
  /** Empty slots waiting for you (plot, pot, composter…). */
  empty: number;
  /** Paused or sick. */
  blocked: number;
  /** Next one to be ready, if any is still running. */
  nextAt: number | null;
  /** When everything running is ready. */
  allAt: number | null;
  /** The main things inside, most common first: "Riz ×3". */
  what: string;
  /** 0 to 1: how far the next one is (1 when something is ready). */
  progress: number;
}

// ---------- Boost windows ----------

type Window = { from: number; to: number; speed: number };
const FAR = Number.MAX_SAFE_INTEGER;
const H = 3_600_000, D = 24 * H;

/** How long each temporary collectible lasts once placed. Pet shrines last 7 days. */
const EXPIRY: Record<string, number> = {
  "Time Warp Totem": 4 * H, "Super Totem": 7 * D,
  "Gourmet Hourglass": 6 * H, "Harvest Hourglass": 9 * H, "Timber Hourglass": 4 * H, "Ore Hourglass": 5 * H,
  "Orchard Hourglass": 8 * H, "Blossom Hourglass": 12 * H,
  "Legendary Shrine": D,
};
const SHRINE_DAYS = 7 * D;

function merge(ws: Window[]): Window[] {
  const s = [...ws].sort((a, b) => a.from - b.from);
  const out: Window[] = [];
  for (const w of s) {
    const last = out[out.length - 1];
    if (last && last.speed === w.speed && w.from <= last.to) last.to = Math.max(last.to, w.to);
    else out.push({ ...w });
  }
  return out;
}

/** The ready instant: work accrues at the product of the covering windows' speeds, 1× elsewhere. */
export function readyAt(startedAt: number, work: number, windows: Window[]): number {
  if (!(work > 0)) return startedAt;
  const clipped = windows.map((w) => ({ from: Math.max(w.from, startedAt), to: w.to, speed: w.speed })).filter((w) => w.to > w.from);
  if (!clipped.length) return startedAt + work;
  const cuts = [...new Set([startedAt, ...clipped.flatMap((w) => [w.from, w.to])])].sort((a, b) => a - b);
  let done = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const from = cuts[i], to = cuts[i + 1], mid = (from + to) / 2;
    const speed = clipped.reduce((a, w) => (w.from <= mid && mid < w.to ? a * w.speed : a), 1);
    const seg = (to - from) * speed;
    if (done + seg >= work) return from + (work - done) / speed;
    done += seg;
  }
  return cuts[cuts.length - 1] + (work - done);
}

type AnyFarm = any; // the raw farm JSON from the API

function placed(farm: AnyFarm, name: string): any[] {
  return [
    ...(farm.collectibles?.[name] ?? []),
    ...(farm.home?.collectibles?.[name] ?? []),
    ...(farm.interior?.ground?.collectibles?.[name] ?? []),
    ...(farm.interior?.level_one?.collectibles?.[name] ?? []),
  ];
}

function boost(farm: AnyFarm, name: string, speed: number): Window[] {
  const life = EXPIRY[name] ?? (/Shrine$/.test(name) ? SHRINE_DAYS : 0);
  const live = placed(farm, name)
    .filter((p) => p.createdAt !== undefined)
    .map((p) => {
      const end = p.createdAt + life + (p.extendedMs ?? 0);
      return { from: p.createdAt, to: p.removedAt !== undefined ? Math.min(end, p.removedAt) : end, speed };
    });
  const past = (farm.boostHistory?.[name] ?? []).map((w: any) => ({ from: w.from, to: w.to, speed }));
  return merge([...live, ...past].filter((w) => w.to > w.from));
}

const totems = (farm: AnyFarm) => merge([...boost(farm, "Super Totem", 2), ...boost(farm, "Time Warp Totem", 2)]);

function powerHour(farm: AnyFarm): Window[] {
  const b = farm.buffs?.["Power hour"];
  const live = b?.startedAt !== undefined ? [{ from: b.startedAt, to: b.startedAt + (b.durationMS ?? H), speed: 2 }] : [];
  const past = (farm.boostHistory?.["Power hour"] ?? []).filter((w: any) => w.from !== b?.startedAt).map((w: any) => ({ from: w.from, to: w.to, speed: 2 }));
  return merge([...live, ...past].filter((w) => w.to > w.from));
}

function sunshower(farm: AnyFarm): Window[] {
  const past: Window[] = (farm.boostHistory?.Sunshower ?? []).map((w: any) => ({ from: w.from, to: w.to, speed: 2 }));
  const at = farm.calendar?.sunshower?.startedAt;
  if (at === undefined || past.some((w) => w.from === at)) return past;
  const d = new Date(at);
  return [{ from: at, to: Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1), speed: 2 }, ...past];
}

const W = {
  crops: (f: AnyFarm) => [...boost(f, "Sparrow Shrine", 1.35), ...boost(f, "Harvest Hourglass", 1.35), ...totems(f), ...powerHour(f), ...sunshower(f)],
  trees: (f: AnyFarm) => [...totems(f), ...boost(f, "Timber Hourglass", 1.35), ...boost(f, "Badger Shrine", 1.35)],
  fruits: (f: AnyFarm) => [...totems(f), ...boost(f, "Orchard Hourglass", 1.35), ...boost(f, "Toucan Shrine", 1.35)],
  flowers: (f: AnyFarm) => [...boost(f, "Blossom Hourglass", 1.35), ...boost(f, "Moth Shrine", 1.35)],
  oil: (f: AnyFarm) => boost(f, "Stag Shrine", 1.35),
  greenhouse: (f: AnyFarm, plant: string) => [
    ...totems(f), ...boost(f, "Tortoise Shrine", 1.5),
    ...(plant === "Grape" ? boost(f, "Orchard Hourglass", 1.35) : boost(f, "Harvest Hourglass", 1.35)),
  ],
  mine: (f: AnyFarm, family: "stone" | "iron" | "gold" | "crimstone" | "sunstone") =>
    family === "stone" ? [...totems(f), ...boost(f, "Ore Hourglass", 2), ...boost(f, "Badger Shrine", 1.35)]
      : family === "iron" || family === "gold" ? [...totems(f), ...boost(f, "Ore Hourglass", 2), ...boost(f, "Mole Shrine", 1.35)]
        : family === "crimstone" ? boost(f, "Mole Shrine", 1.35) : [],
  animal: (f: AnyFarm, type: string) =>
    type === "Chicken" ? boost(f, "Bantam Shrine", 1.35) : type === "Cow" || type === "Sheep" ? boost(f, "Collie Shrine", 1.35) : [],
};

/** A fertiliser speeds up its own plot or pot from the moment it was applied, until harvest. */
function fertiliserWindow(fert: any, names: Record<string, number>): Window[] {
  const speed = fert && names[fert.name];
  return speed && fert.fertilisedAt !== undefined ? [{ from: fert.fertilisedAt, to: FAR, speed }] : [];
}

// ---------- Power skills ----------

/** Cooldown by rank, in hours (bumpkinSkills.ts). */
const POWER_COOLDOWN: Record<string, number[]> = {
  "Instant Growth": [72, 60, 48],
  "Tree Blitz": [24, 18, 12],
  "Barnyard Rouse": [120, 96, 84],
  "Greenhouse Guru": [96, 84, 72],
  "Instant Gratification": [96, 84, 72],
  "Petal Blessed": [96, 84, 72],
  "Grease Lightning": [96, 84, 72],
  "Salt Surge": [72, 60, 48],
};
const COOLDOWN_WEARABLES: Record<string, number> = { "Luna's Crescent": 0.5, "Ascension Staff": 0.9 };

// ---------- All timers ----------

const ROCKS: Record<string, "stone" | "iron" | "gold" | "crimstone" | "sunstone"> = {
  stones: "stone", iron: "iron", gold: "gold", crimstones: "crimstone", sunstones: "sunstone",
};
const ROCK_NAME: Record<string, string> = { stone: "Stone Rock", iron: "Iron Rock", gold: "Gold Rock", crimstone: "Crimstone Rock", sunstone: "Sunstone Rock" };
const ANIMAL_GROUP: Record<string, TimerGroup> = { Chicken: "chickens", Cow: "cows", Sheep: "sheep", Pig: "pigs" };

const values = (o: any): any[] => (o && typeof o === "object" ? Object.values(o) : []);
const isPlaced = (n: any) => n && (n.x !== undefined || n.coordinates !== undefined);

export function farmTimers(farm: AnyFarm): Timer[] {
  const out: Timer[] = [];
  if (!farm) return out;
  const add = (group: TimerGroup, label: string, at: number | null, state?: Timer["state"], startedAt?: number) => out.push({ group, label, readyAt: at, state, startedAt });

  // Plots.
  const cropW = W.crops(farm);
  for (const plot of values(farm.crops)) {
    if (!isPlaced(plot)) continue;
    const c = plot.crop;
    if (!c) { add("crops", "Parcelle vide", null, "empty"); continue; }
    if (c.baseDurationMs === undefined) continue;
    add("crops", c.name, readyAt(c.plantedAt, c.baseDurationMs, [...cropW, ...fertiliserWindow(plot.fertiliser, { "Rapid Root": 2, "Sproutroot Surprise": 2 })]), undefined, c.plantedAt);
  }

  // Greenhouse pots.
  for (const pot of values(farm.greenhouse?.pots)) {
    const p = pot.plant;
    if (!p) { add("greenhouse", "Pot vide", null, "empty"); continue; }
    if (p.baseDurationMs === undefined) continue;
    add("greenhouse", p.name, readyAt(p.plantedAt, p.baseDurationMs, [...W.greenhouse(farm, p.name), ...fertiliserWindow(pot.fertiliser, { "Greenhouse Glow": 1.25 })]), undefined, p.plantedAt);
  }

  // Crop machine: each pack keeps its own ready time.
  for (const m of farm.buildings?.["Crop Machine"] ?? []) {
    for (const q of m.queue ?? []) if (q.readyAt) add("machine", q.crop, q.readyAt, undefined, q.startTime);
  }

  // Fruit patches: a fruit regrows from its last harvest.
  const fruitW = W.fruits(farm);
  for (const patch of values(farm.fruitPatches)) {
    if (!isPlaced(patch)) continue;
    const fr = patch.fruit;
    if (!fr || !(fr.harvestsLeft > 0)) { add("fruits", "Arbre fruitier vide", null, "empty"); continue; }
    if (fr.baseDurationMs === undefined) continue;
    add("fruits", fr.name, readyAt(fr.harvestedAt || fr.plantedAt, fr.baseDurationMs, [...fruitW, ...fertiliserWindow(patch.fertiliser, { "Turbofruit Mix": 1.25 })]), undefined, fr.harvestedAt || fr.plantedAt);
  }

  // Flowers.
  const flowerW = W.flowers(farm);
  for (const bed of values(farm.flowers?.flowerBeds)) {
    const fl = bed.flower;
    if (!fl) { add("flowers", "Parterre vide", null, "empty"); continue; }
    if (fl.baseDurationMs === undefined) continue;
    add("flowers", fl.name, readyAt(fl.plantedAt, fl.baseDurationMs, flowerW), undefined, fl.plantedAt);
  }

  // Trees.
  const treeW = W.trees(farm);
  for (const t of values(farm.trees)) {
    if (!isPlaced(t) || !t.wood) continue;
    add("trees", t.name ?? "Tree", readyAt(t.wood.choppedAt, t.wood.baseDurationMs ?? 0, treeW), undefined, t.wood.choppedAt);
  }

  // Rocks.
  for (const [key, family] of Object.entries(ROCKS)) {
    const ws = W.mine(farm, family);
    for (const r of values(farm[key])) {
      if (!isPlaced(r) || !r.stone) continue;
      add(family, r.name ?? ROCK_NAME[family], readyAt(r.stone.minedAt, r.stone.baseDurationMs ?? 0, ws), undefined, r.stone.minedAt);
    }
  }

  // Oil reserves.
  const oilW = W.oil(farm);
  for (const r of values(farm.oilReserves)) {
    if (!isPlaced(r) || !r.oil) continue;
    add("oil", "Réserve de pétrole", readyAt(r.oil.drilledAt, r.oil.baseDurationMs ?? 0, oilW), undefined, r.oil.drilledAt);
  }

  // Animals: ready when awake. A sick animal needs care first.
  for (const home of [farm.henHouse, farm.barn, farm.pigpen]) {
    for (const a of values(home?.animals)) {
      const group = ANIMAL_GROUP[a.type];
      if (!group) continue;
      if (a.state === "sick") { add(group, a.type, null, "sick"); continue; }
      const work = a.baseDurationMs ?? Math.max((a.awakeAt ?? 0) - (a.asleepAt ?? 0), 0);
      add(group, a.type, readyAt(a.asleepAt ?? 0, work, W.animal(farm, a.type)), undefined, a.asleepAt);
    }
  }

  // Hives: full after 24 h of production, at the rate of the flowers attached. No flower, no honey.
  const FULL = 24 * H;
  for (const hive of values(farm.beehives)) {
    if (!isPlaced(hive)) continue;
    const produced = hive.honey?.produced ?? 0;
    if (produced >= FULL) { add("honey", "Ruche pleine", hive.honey?.updatedAt ?? 0); continue; }
    let t = hive.honey?.updatedAt ?? 0, left = FULL - produced, at: number | null = null;
    const flowers = [...(hive.flowers ?? [])].sort((a: any, b: any) => a.attachedUntil - b.attachedUntil);
    for (const fl of flowers) {
      if (fl.attachedUntil <= t) continue;
      const span = fl.attachedUntil - Math.max(t, fl.attachedAt ?? t);
      const rate = fl.rate ?? 1;
      if (span * rate >= left) { at = Math.max(t, fl.attachedAt ?? t) + left / rate; break; }
      left -= span * rate; t = fl.attachedUntil;
    }
    add("honey", "Ruche", at, at === null ? "paused" : undefined, at === null ? undefined : at - FULL / Math.max(0.01, hive.flowers?.[0]?.rate ?? 1));
  }

  // Composters.
  for (const name of ["Compost Bin", "Turbo Composter", "Premium Composter"]) {
    for (const b of farm.buildings?.[name] ?? []) {
      if (b.producing?.readyAt) add("compost", name, b.producing.readyAt, undefined, b.producing.startedAt);
      else add("compost", name, null, "empty");
    }
  }

  // Kitchens: every recipe in the queue.
  for (const name of ["Fire Pit", "Kitchen", "Bakery", "Deli", "Smoothie Shack"]) {
    for (const b of farm.buildings?.[name] ?? []) {
      const queue = Array.isArray(b.crafting) ? b.crafting : b.crafting ? [b.crafting] : [];
      for (const c of queue) if (c.readyAt) add("cooking", c.name, c.readyAt, undefined, c.startedAt);
    }
  }

  // Aging shed racks.
  for (const rack of values(farm.agingShed?.racks)) {
    for (const it of Array.isArray(rack) ? rack : []) if (it.readyAt) add("aging", it.recipe ?? it.name ?? "Rack", it.readyAt, undefined, it.startedAt);
  }

  // Crab traps.
  for (const spot of values(farm.crabTraps?.trapSpots)) {
    const t = spot.waterTrap;
    if (t?.readyAt) add("crabs", t.type ?? "Casier", t.readyAt, undefined, t.placedAt);
  }

  // Power skills the bumpkin has.
  const skills = farm.bumpkin?.skills ?? {};
  const used = farm.bumpkin?.previousPowerUseAt ?? {};
  const worn = Object.values(farm.bumpkin?.equipped ?? {}) as string[];
  const factor = worn.reduce((a, w) => a * (COOLDOWN_WEARABLES[w] ?? 1), 1);
  for (const [skill, cds] of Object.entries(POWER_COOLDOWN)) {
    const rank = Math.min(Number(skills[skill] ?? 0), 3);
    if (!rank) continue;
    const last = used[skill];
    add("power", skill, last ? last + cds[rank - 1] * H * factor : 0, undefined, last || undefined);
  }

  return out;
}

/** One line per group: how many are ready, the next one and when all are done. */
export function summarize(timers: Timer[], now: number): GroupSummary[] {
  return TIMER_GROUPS.map(({ key, label, icon }) => {
    const list = timers.filter((t) => t.group === key);
    const running = list.filter((t) => t.readyAt !== null && t.readyAt > now).map((t) => t.readyAt!) ;
    const counts = new Map<string, number>();
    for (const t of list) if (!t.state) counts.set(t.label, (counts.get(t.label) ?? 0) + 1);
    const what = [...counts].sort((a, b) => b[1] - a[1]).slice(0, 2).map(([n, c]) => (c > 1 ? `${n} ×${c}` : n)).join(", ");
    return {
      key, label, icon, total: list.length,
      ready: list.filter((t) => t.readyAt !== null && t.readyAt <= now).length,
      empty: list.filter((t) => t.state === "empty").length,
      blocked: list.filter((t) => t.state === "paused" || t.state === "sick").length,
      nextAt: running.length ? Math.min(...running) : null,
      progress: progressOf(list, now),
      allAt: running.length ? Math.max(...running) : null,
      what,
    };
  }).filter((g) => g.total > 0);
}

function progressOf(list: Timer[], now: number): number {
  if (list.some((t) => t.readyAt !== null && t.readyAt <= now)) return 1;
  const next = list.filter((t) => t.readyAt !== null && t.readyAt > now).sort((a, b) => a.readyAt! - b.readyAt!)[0];
  if (!next || next.startedAt === undefined || next.readyAt! <= next.startedAt) return 0;
  return Math.min(1, Math.max(0, (now - next.startedAt) / (next.readyAt! - next.startedAt)));
}

/** Families the widget groups its rows into. */
export const TIMER_FAMILIES: { key: string; label: string; groups: TimerGroup[] }[] = [
  { key: "crops", label: "Cultures", groups: ["crops", "greenhouse", "machine", "fruits", "flowers"] },
  { key: "resources", label: "Ressources", groups: ["trees", "stone", "iron", "gold", "crimstone", "sunstone", "oil"] },
  { key: "animals", label: "Animaux", groups: ["chickens", "cows", "sheep", "pigs", "honey"] },
  { key: "workshops", label: "Ateliers", groups: ["cooking", "compost", "aging", "crabs"] },
  { key: "power", label: "Power skills", groups: ["power"] },
];

/** "2 h 10", "35 min", "3 j 4 h". */
export function countdown(ms: number): string {
  if (ms <= 0) return "prêt";
  const m = Math.ceil(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  if (h < 24) return r ? `${h} h ${String(r).padStart(2, "0")}` : `${h} h`;
  const d = Math.floor(h / 24), hh = h % 24;
  return hh ? `${d} j ${hh} h` : `${d} j`;
}
