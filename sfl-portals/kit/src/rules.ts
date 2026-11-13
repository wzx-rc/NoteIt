/**
 * Règles d'achat d'un Portal, recopiées du jeu
 * (src/features/game/events/minigames/purchaseMinigameItem.ts).
 * Le mode simulé applique les mêmes contrôles que le vrai jeu.
 */

export const CROPS = [
  "Sunflower", "Potato", "Pumpkin", "Carrot", "Cabbage", "Soybean", "Beetroot",
  "Cauliflower", "Parsnip", "Eggplant", "Corn", "Radish", "Wheat", "Kale",
  "Barley", "Rhubarb", "Zucchini", "Yam", "Broccoli", "Pepper", "Onion",
  "Turnip", "Artichoke", "Saltwort", "Crystal Leaf",
] as const;

export const FRUITS = [
  "Apple", "Blueberry", "Orange", "Banana", "Tomato", "Lemon", "Celestine",
  "Lunara", "Duskberry",
] as const;

/** Commodities du jeu, sans "Mud" (exclue par le jeu). */
export const COMMODITIES = [
  "Wood", "Stone", "Iron", "Gold", "Crimstone", "Diamond", "Egg", "Honey",
  "Chicken", "Wild Mushroom", "Magic Mushroom", "Sunstone", "Ascension Shard",
  "Oil", "Obsidian", "Salt", "Refined Salt",
] as const;

export type PortalCurrency =
  | (typeof CROPS)[number]
  | (typeof FRUITS)[number]
  | (typeof COMMODITIES)[number];

export const PORTAL_CURRENCIES: readonly PortalCurrency[] = [
  ...CROPS,
  ...FRUITS,
  ...COMMODITIES,
];

/** FLOWER maximum par achat. */
export const FLOWER_LIMIT = 200;
/** Quantité maximum de chaque ressource par achat. */
export const ITEM_LIMIT = 1000;

export type PurchaseRequest = {
  /** FLOWER à dépenser (0 si aucun). */
  sfl?: number;
  items?: Partial<Record<PortalCurrency, number>>;
};

/** Renvoie un message d'erreur, ou null si l'achat est valide. */
export function validatePurchase(
  req: PurchaseRequest,
  balance: number,
  inventory: Record<string, number>,
): string | null {
  const sfl = req.sfl ?? 0;
  if (sfl < 0) return "Le montant de FLOWER doit être positif";
  if (sfl > FLOWER_LIMIT) return `Maximum ${FLOWER_LIMIT} FLOWER par achat`;
  if (balance < sfl) return "Pas assez de FLOWER";

  for (const [name, amount = 0] of Object.entries(req.items ?? {})) {
    if (!PORTAL_CURRENCIES.includes(name as PortalCurrency)) {
      return `${name} ne peut pas être dépensé dans un Portal`;
    }
    if (amount < 0) return `Quantité négative : ${name}`;
    if (amount > ITEM_LIMIT) return `Maximum ${ITEM_LIMIT} ${name} par achat`;
    if ((inventory[name] ?? 0) < amount) return `Pas assez de ${name}`;
  }
  return null;
}
