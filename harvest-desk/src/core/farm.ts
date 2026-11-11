import { ANIMAL_LEVELS, FACTION_ITEMS, ISLAND_ORDER, SKILL_RANKS, SPLIT_SKILLS } from "./gameData";

/** The parts of the game state Harvest Desk reads. Everything is optional: the API can drop fields. */
export interface Placed { coordinates?: { x: number; y: number }; readyAt?: number }
export interface Farm {
  inventory?: Record<string, string | number>;
  collectibles?: Record<string, Placed[]>;
  home?: { collectibles?: Record<string, Placed[]> };
  interior?: { ground?: { collectibles?: Record<string, Placed[]> }; level_one?: { collectibles?: Record<string, Placed[]> } };
  petHouse?: { pets?: Record<string, Placed[]> };
  bumpkin?: { skills?: Record<string, number>; equipped?: Record<string, string> };
  farmHands?: { bumpkins?: Record<string, { equipped?: Record<string, string> }> };
  faction?: { name?: string };
  island?: { type?: string };
  season?: { season?: string };
  stones?: Record<string, { name?: string; tier?: number; multiplier?: number }>;
  iron?: Record<string, { name?: string; tier?: number; multiplier?: number }>;
  gold?: Record<string, { name?: string; tier?: number; multiplier?: number }>;
  crimstones?: Record<string, { minesLeft?: number }>;
  crops?: Record<string, { beeSwarm?: { count?: number } }>;
  henHouse?: { animals?: Record<string, Animal> };
  barn?: { animals?: Record<string, Animal> };
  pigpen?: { animals?: Record<string, Animal> };
}
export interface Animal { type: string; experience: number; multiplier?: number }

/** Extra items a scenario pretends the farm has. */
export type Extra = { collectibles?: string[]; wearables?: string[]; skills?: Record<string, number>; removeSkills?: string[] };

export class FarmView {
  constructor(private farm: Farm, private extra: Extra = {}) {}

  /** Same rule as the game's isCollectibleBuilt: placed (with coordinates) on the farm, home, interior or pet house. */
  has(name: string): boolean {
    if (this.extra.collectibles?.includes(name)) return true;
    const f = this.farm;
    const lists = [
      f.collectibles?.[name],
      f.home?.collectibles?.[name],
      f.interior?.ground?.collectibles?.[name],
      f.interior?.level_one?.collectibles?.[name],
      f.petHouse?.pets?.[name],
    ];
    return lists.some((l) => l?.some((p) => !!p.coordinates));
  }

  /** Worn by the bumpkin or any farm hand (isWearableActive). */
  wears(name: string): boolean {
    if (this.extra.wearables?.includes(name)) return true;
    const sets = [this.farm.bumpkin?.equipped, ...Object.values(this.farm.farmHands?.bumpkins ?? {}).map((b) => b.equipped)];
    return sets.some((e) => e && Object.values(e).includes(name));
  }

  inventory(name: string): number {
    return Number(this.farm.inventory?.[name] ?? 0);
  }

  skill(name: string): number {
    if (this.extra.removeSkills?.includes(name)) return 0;
    return this.extra.skills?.[name] ?? this.farm.bumpkin?.skills?.[name] ?? 0;
  }

  /** Value of a ranked skill, 0 when not learnt. */
  rank(name: keyof typeof SKILL_RANKS): number {
    const l = this.skill(name);
    return l ? SKILL_RANKS[name][Math.min(l, 3) - 1] : 0;
  }
  buff(name: keyof typeof SPLIT_SKILLS): number {
    const l = this.skill(name);
    return l ? SPLIT_SKILLS[name].buff[Math.min(l, 3) - 1] : 0;
  }
  debuff(name: keyof typeof SPLIT_SKILLS): number {
    const l = this.skill(name);
    return l ? SPLIT_SKILLS[name].debuff[Math.min(l, 3) - 1] : 0;
  }

  get faction() {
    return FACTION_ITEMS[this.farm.faction?.name ?? ""];
  }
  get pastVolcano(): boolean {
    return ISLAND_ORDER.indexOf(this.farm.island?.type ?? "basic") >= ISLAND_ORDER.indexOf("volcano");
  }
  get season() {
    return this.farm.season?.season ?? "spring";
  }
  get raw() {
    return this.farm;
  }
}

export function animalLevel(type: string, xp: number): number {
  const t = ANIMAL_LEVELS[type];
  if (!t) return 0;
  let l = 0;
  t.forEach((th, i) => {
    if (xp >= th) l = i;
  });
  return l;
}

export function animals(farm: Farm, type: string): Animal[] {
  const all = [farm.henHouse, farm.barn, farm.pigpen].flatMap((b) => Object.values(b?.animals ?? {}));
  return all.filter((a) => a.type === type);
}
