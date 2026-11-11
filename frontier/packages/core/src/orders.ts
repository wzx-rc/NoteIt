import { NPCS, ORDER_HALO_CHANCE, ORDER_HALO_RATE, ORDER_VALUE, levelForXp, type ItemName } from "./config";
import { nextRandom, randomInt } from "./rng";
import type { GameState, Order } from "./state";

/** Génère une commande de PNJ adaptée au niveau, de façon déterministe. */
export function generateOrder(state: GameState): Order {
  const level = levelForXp(state.xp);
  const r = (n: number) => randomInt(state, n);
  const pool: Array<() => Partial<Record<ItemName, number>>> = [
    () => ({ spore: 3 + r(4) }),
    () => ({ ferrite: 3 + r(4) }),
    () => ({ spore: 2 + r(3), ferrite: 2 + r(3) }),
  ];
  if (level >= 2) pool.push(() => ({ algue: 2 + r(2) }), () => ({ alliage: 1 + r(2) }), () => ({ ration: 1 }), () => ({ algue: 2, ferrite: 4 }));
  if (level >= 3) pool.push(() => ({ xenon: 1 + r(2) }), () => ({ cellule: 1 }), () => ({ alliage: 2, spore: 4 }));
  if (level >= 4) pool.push(() => ({ quartz: 2 + r(2) }), () => ({ cellule: 1, ration: 1 }), () => ({ quartz: 1, alliage: 2 }));

  const items = pool[r(pool.length)]();
  const value = Object.entries(items).reduce((sum, [k, n]) => sum + (n ?? 0) * (ORDER_VALUE[k as ItemName] ?? 3), 0);
  const paysHalo = nextRandom(state) < ORDER_HALO_CHANCE;
  const id = `o${state.rngCounter}-${Math.floor(nextRandom(state) * 1e6).toString(36)}`;
  return {
    id,
    from: NPCS[r(NPCS.length)],
    items,
    reward: paysHalo ? { halo: Math.max(0.5, Math.round((value / ORDER_HALO_RATE) * 2) / 2) } : { credits: Math.round(value * 1.4) },
    xp: Math.round(8 + value / 3),
  };
}
