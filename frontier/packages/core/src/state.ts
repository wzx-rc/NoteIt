import type { BuildingName, CraftName, CropName, ItemName, ResourceName } from "./config";
import { ORDER_SLOTS } from "./config";
import { generateOrder } from "./orders";

export interface Bed {
  expansion?: boolean;
  crop?: { name: CropName; plantedAt: number };
}

export interface ResourceNode {
  kind: ResourceName;
  /** Horodatage du dernier forage (0 = jamais). */
  minedAt: number;
  expansion?: boolean;
}

export interface Order {
  id: string;
  from: string;
  items: Partial<Record<ItemName, number>>;
  reward: { credits?: number; halo?: number };
  xp: number;
}

export interface GameState {
  version: 1;
  createdAt: number;
  /** Graine du générateur pseudo-aléatoire : client et serveur tirent les mêmes valeurs. */
  seed: number;
  rngCounter: number;
  credits: number;
  /** Solde $HALO dans le jeu (hors chaîne). Il passe sur Base par un retrait signé. */
  halo: number;
  xp: number;
  inventory: Partial<Record<ItemName, number>>;
  beds: Record<string, Bed>;
  nodes: Record<string, ResourceNode>;
  buildings: Partial<Record<BuildingName, { readyAt: number }>>;
  crafting?: { item: CraftName; readyAt: number };
  expansion: { readyAt?: number };
  orders: Order[];
  raid: { nextAt?: number };
  stats: Record<string, number>;
}

export function createInitialState(createdAt: number, seed: number): GameState {
  const state: GameState = {
    version: 1,
    createdAt,
    seed: seed >>> 0,
    rngCounter: 0,
    credits: 15,
    halo: 0,
    xp: 0,
    inventory: { charge: 6, "graine-spore": 4 },
    beds: {
      "1": {}, "2": {}, "3": {},
      "4": { expansion: true }, "5": { expansion: true }, "6": { expansion: true },
    },
    nodes: {
      "1": { kind: "ferrite", minedAt: 0 },
      "2": { kind: "ferrite", minedAt: 0 },
      "3": { kind: "ferrite", minedAt: 0 },
      "4": { kind: "ferrite", minedAt: 0, expansion: true },
      "5": { kind: "ferrite", minedAt: 0, expansion: true },
      "6": { kind: "xenon", minedAt: 0, expansion: true },
    },
    buildings: {},
    expansion: {},
    orders: [],
    raid: {},
    stats: {},
  };
  while (state.orders.length < ORDER_SLOTS) state.orders.push(generateOrder(state));
  return state;
}

export const isExpanded = (s: GameState, now: number) => s.expansion.readyAt !== undefined && s.expansion.readyAt <= now;
export const isBuilt = (s: GameState, b: BuildingName, now: number) => {
  const x = s.buildings[b];
  return !!x && x.readyAt <= now;
};
export const count = (s: GameState, item: ItemName) => s.inventory[item] ?? 0;
