import type { GameState } from "./state";

/**
 * Tirage déterministe (mulberry32) à partir de la graine de la colonie et d'un compteur.
 * Le client et le serveur rejouent les mêmes événements et obtiennent les mêmes tirages :
 * un client modifié ne peut pas choisir ses commandes ni ses bonus de forage.
 */
export function nextRandom(state: GameState): number {
  let t = (state.seed + Math.imul(state.rngCounter + 1, 0x6d2b79f5)) >>> 0;
  state.rngCounter += 1;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const randomInt = (state: GameState, n: number) => Math.floor(nextRandom(state) * n);
