/** Règles du pet, sans interface : faciles à tester et à réutiliser côté serveur. */

export type PetState = {
  name: string;
  /** 100 = rassasié, 0 = affamé. */
  hunger: number;
  /** 100 = ravi, 0 = triste. */
  joy: number;
  xp: number;
  /** Dernier calcul de l'usure (ms). */
  lastTick: number;
  /** Dernière partie de jeu (ms), pour le temps de recharge. */
  lastPlay: number;
  /** Jours consécutifs où le pet a été nourri. */
  streak: number;
  /** Dernier jour où il a été nourri (AAAA-MM-JJ). */
  lastFedDay: string;
  /** Semaine (lundi, AAAA-MM-JJ) de la dernière récompense réclamée. */
  lastRewardWeek: string;
};

export const HUNGER_PER_HOUR = 4;
export const JOY_PER_HOUR = 3;
export const PLAY_COOLDOWN_MS = 10 * 60 * 1000;
export const STREAK_FOR_REWARD = 7;

export type Food = {
  label: string;
  /** Ce que coûte un repas, en ressources du jeu. */
  cost: Record<string, number>;
  hunger: number;
  joy: number;
};

export const FOODS: Food[] = [
  { label: "Bouillie de blé", cost: { Wheat: 10 }, hunger: 25, joy: 0 },
  { label: "Carottes", cost: { Carrot: 5 }, hunger: 20, joy: 2 },
  { label: "Pomme", cost: { Apple: 2 }, hunger: 30, joy: 6 },
];

const clamp = (n: number) => Math.max(0, Math.min(100, n));
export const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
export const weekKey = (t: number) => {
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return dayKey(d.getTime());
};

export function newPet(now: number): PetState {
  return {
    name: "Pousse",
    hunger: 80,
    joy: 70,
    xp: 0,
    lastTick: now,
    lastPlay: 0,
    streak: 0,
    lastFedDay: "",
    lastRewardWeek: "",
  };
}

/** Applique l'usure du temps écoulé (speed > 1 pour tester plus vite). */
export function tick(pet: PetState, now: number, speed = 1): PetState {
  const hours = ((now - pet.lastTick) / 3_600_000) * speed;
  if (hours <= 0) return pet;
  return {
    ...pet,
    hunger: clamp(pet.hunger - hours * HUNGER_PER_HOUR),
    joy: clamp(pet.joy - hours * JOY_PER_HOUR * (pet.hunger < 30 ? 2 : 1)),
    lastTick: now,
  };
}

export function feed(pet: PetState, food: Food, now: number): PetState {
  const today = dayKey(now);
  const yesterday = dayKey(now - 86_400_000);
  const streak =
    pet.lastFedDay === today ? pet.streak : pet.lastFedDay === yesterday ? pet.streak + 1 : 1;
  return {
    ...pet,
    hunger: clamp(pet.hunger + food.hunger),
    joy: clamp(pet.joy + food.joy),
    xp: pet.xp + 5,
    streak,
    lastFedDay: today,
  };
}

export function canPlay(pet: PetState, now: number) {
  return now - pet.lastPlay >= PLAY_COOLDOWN_MS && pet.hunger >= 15;
}

export function play(pet: PetState, now: number): PetState {
  return { ...pet, joy: clamp(pet.joy + 15), hunger: clamp(pet.hunger - 5), xp: pet.xp + 3, lastPlay: now };
}

export function cuddle(pet: PetState): PetState {
  return { ...pet, joy: clamp(pet.joy + 4) };
}

export const level = (pet: PetState) => 1 + Math.floor(pet.xp / 50);

export function mood(pet: PetState): "ravi" | "content" | "grognon" | "affamé" {
  if (pet.hunger < 25) return "affamé";
  if (pet.joy < 35) return "grognon";
  if (pet.joy > 75 && pet.hunger > 60) return "ravi";
  return "content";
}

export function rewardReady(pet: PetState, now: number) {
  return pet.streak >= STREAK_FOR_REWARD && pet.lastRewardWeek !== weekKey(now);
}
