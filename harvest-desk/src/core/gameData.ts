/**
 * Game constants copied from the Sunflower Land source
 * (github.com/sunflower-land/sunflower-land, src/features/game/).
 * Only what Harvest Desk needs. Check the file named on each block when the game updates.
 */

/** types/bumpkinSkills.ts → SKILL_RANKS (values per rank 1..3). */
export const SKILL_RANKS = {
  "Rock'N'Roll": [0.1, 0.15, 0.2],
  "Iron Bumpkin": [0.1, 0.15, 0.2],
  "Golden Touch": [0.5, 0.75, 1],
  "Fire Kissed": [1, 1.35, 1.75],
  "Old Farmer": [0.1, 0.125, 0.15],
  "Young Farmer": [0.1, 0.125, 0.15],
  "Experienced Farmer": [0.1, 0.125, 0.15],
  "Pollen Power Up": [0.1, 0.15, 0.2],
  "Fine Fibers": [0.1, 0.15, 0.2],
  "Abundant Harvest": [0.2, 0.35, 0.5],
  "Double Bale": [2, 2.5, 3],
  "Efficient Feeding": [0.95, 0.94, 0.925],
} as const;

/** Skills with a buff on one thing and a debuff on another. */
export const SPLIT_SKILLS = {
  "Rocky Favor": { buff: [1, 1.4, 1.8], debuff: [0.5, 0.6, 0.7] },
  "Ferrous Favor": { buff: [1, 1.5, 2], debuff: [0.5, 0.6, 0.7] },
  "Acre Farm": { buff: [1, 1.4, 1.8], debuff: [0.5, 0.6, 0.7] },
  "Hectare Farm": { buff: [1, 1.4, 1.8], debuff: [0.5, 0.6, 0.7] },
  "Merino Whisperer": { buff: [0.35, 0.6, 0.9], debuff: [0.1, 0.15, 0.2] },
  "Featherweight": { buff: [0.35, 0.6, 0.9], debuff: [0.1, 0.15, 0.2] },
  "Leathercraft Mastery": { buff: [0.35, 0.6, 0.9], debuff: [0.1, 0.15, 0.2] },
  "Clucky Grazing": { buff: [0.75, 0.65, 0.5], debuff: [1.5, 1.55, 1.65] },
  "Sheepwise Diet": { buff: [0.75, 0.65, 0.5], debuff: [1.5, 1.55, 1.65] },
  "Cow-Smart Nutrition": { buff: [0.75, 0.65, 0.5], debuff: [1.5, 1.55, 1.65] },
} as const;

/** Diet skill → the animal it favours (lib/animals.ts → getBoostedFoodQuantity). */
export const DIET_SKILLS = {
  "Clucky Grazing": "Chicken",
  "Sheepwise Diet": "Sheep",
  "Cow-Smart Nutrition": "Cow",
} as const;

/** types/crops.ts → CROPS harvestSeconds, and CROP_SEEDS prices in coins. */
export const CROPS: Record<string, { seconds: number; seed: number }> = {
  Sunflower: { seconds: 60, seed: 0.01 },
  Potato: { seconds: 300, seed: 0.1 },
  Rhubarb: { seconds: 600, seed: 0.15 },
  Pumpkin: { seconds: 1800, seed: 0.2 },
  Zucchini: { seconds: 1800, seed: 0.2 },
  Carrot: { seconds: 3600, seed: 0.5 },
  Yam: { seconds: 3600, seed: 0.5 },
  Cabbage: { seconds: 7200, seed: 1 },
  Broccoli: { seconds: 7200, seed: 1 },
  Soybean: { seconds: 10800, seed: 1.5 },
  Beetroot: { seconds: 14400, seed: 2 },
  Pepper: { seconds: 14400, seed: 2 },
  Cauliflower: { seconds: 28800, seed: 3 },
  Parsnip: { seconds: 43200, seed: 5 },
  Eggplant: { seconds: 57600, seed: 6 },
  Corn: { seconds: 72000, seed: 7 },
  Onion: { seconds: 72000, seed: 7 },
  Radish: { seconds: 86400, seed: 7 },
  Wheat: { seconds: 86400, seed: 5 },
  Turnip: { seconds: 86400, seed: 5 },
  Kale: { seconds: 129600, seed: 7 },
  Artichoke: { seconds: 129600, seed: 7 },
  Barley: { seconds: 172800, seed: 10 },
};

/** Greenhouse crops: harvest seconds and seed price in coins. */
export const GREENHOUSE: Record<string, { seconds: number; seed: number }> = {
  Rice: { seconds: 32 * 3600, seed: 240 },
  Grape: { seconds: 12 * 3600, seed: 160 },
  Olive: { seconds: 44 * 3600, seed: 320 },
};

export const WINTER_CROPS = ["Potato", "Cabbage", "Beetroot", "Cauliflower", "Parsnip", "Onion", "Turnip", "Wheat", "Kale"];

/** types/crops.ts → isBasicCrop / isMediumCrop / isAdvancedCrop: plot crops only, greenhouse crops have no tier. */
export const cropTier = (crop: string): "basic" | "medium" | "advanced" | null => {
  const s = CROPS[crop]?.seconds;
  if (s === undefined) return null;
  if (s <= CROPS.Pumpkin.seconds) return "basic";
  if (s >= CROPS.Eggplant.seconds) return "advanced";
  return "medium";
};
/** types/crops.ts → isOvernightCrop: plot crops from Radish up, greenhouse crops between 24 and 36 h. */
export const isOvernight = (crop: string) => {
  if (CROPS[crop]) return CROPS[crop].seconds >= CROPS.Radish.seconds;
  const s = GREENHOUSE[crop]?.seconds ?? 0;
  return s >= 24 * 3600 && s <= 36 * 3600;
};

/** Greenhouse fruits use getFruitYield, not getCropYieldAmount (harvestGreenHouse.ts). */
export const GREENHOUSE_FRUITS = ["Grape"];

/**
 * Oil (drillOilReserve.ts, types/tools.ts, plantGreenhouse.ts, supplyCropMachine.ts).
 * Every third drill of a reserve gives 20 more oil.
 */
export const OIL = {
  drop: 10 + 20 / 3,
  drillCoins: 100,
  /** Oil Rig swaps the 10 Leather for Wool. */
  drill: { Wood: 20, Iron: 9 },
  drillWool: [20, 15, 10],
  greenhouse: { Grape: 3, Rice: 4, Olive: 6 } as Record<string, number>,
  extraction: [1, 1.5, 2],
  slickSaver: [1, 1.5, 2],
  greasyPlants: { yield: [1, 1.5, 2], oil: [2, 3, 4] },
  rapidRig: [0.4, 0.5, 0.6],
  cropProcessor: [0.1, 0.15, 0.2],
  oilGadget: [0.1, 0.15, 0.2],
  efficiencyModule: [0.3, 0.4, 0.5],
};

/** collisionDetection.ts → getAOEExtent: Horror Mike / Laurie's Gains widen the 3×3 area below the item. */
export const AOE_RANKS = [
  { xLeft: 3, xRight: 3, depth: 7 },
  { xLeft: 4, xRight: 3, depth: 8 },
  { xLeft: 4, xRight: 4, depth: 9 },
];
export const AOE_YIELD = [0.1, 0.15, 0.2];

/** types/tools.ts: coins + ingredients per tool. */
export const TOOLS: Record<string, { coins: number; items: Record<string, number> }> = {
  Pickaxe: { coins: 20, items: { Wood: 3 } },
  "Stone Pickaxe": { coins: 20, items: { Wood: 3, Stone: 5 } },
  "Iron Pickaxe": { coins: 80, items: { Wood: 3, Iron: 5 } },
  "Gold Pickaxe": { coins: 100, items: { Wood: 3, Gold: 3 } },
};

/** events/landExpansion/exchangeSFLtoCoins.ts: best package, 200 FLOWER → 64 000 coins. */
export const COINS_PER_FLOWER = 320;

/** types/animals.ts → ANIMAL_LEVELS (XP thresholds for levels 0..15). */
export const ANIMAL_LEVELS: Record<string, number[]> = {
  Chicken: [0, 60, 120, 240, 360, 480, 660, 840, 1020, 1200, 1440, 1680, 1920, 2160, 2400, 2720],
  Cow: [0, 180, 360, 720, 1080, 1440, 1980, 2520, 3060, 3600, 4320, 5040, 5760, 6480, 7200, 8160],
  Sheep: [0, 120, 240, 480, 720, 960, 1320, 1680, 2040, 2400, 2880, 3360, 3840, 4320, 4800, 5440],
  Pig: [0, 180, 360, 720, 1080, 1440, 1980, 2520, 3060, 3600, 4320, 5040, 5760, 6480, 7200, 8160],
};

/** types/animals.ts → ANIMAL_RESOURCE_DROP, base amount per level 0..15. */
export const ANIMAL_DROPS: Record<string, Record<string, number[]>> = {
  Chicken: {
    Egg: [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4, 4, 5],
    Feather: [0, 0, 0, 1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 3],
  },
  Cow: {
    Milk: [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4],
    Leather: [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4],
  },
  Sheep: {
    Wool: [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4],
    "Merino Wool": [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 4],
  },
  Pig: { Truffle: [0, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 3, 4] },
};

/** events/landExpansion/feedAnimal.ts → REQUIRED_FOOD_QTY. */
export const FOOD_QTY: Record<string, number> = { Chicken: 1, Sheep: 3, Cow: 5, Pig: 1 };

/** Favourite food by level (types/animals.ts → ANIMAL_FOOD_EXPERIENCE), same for the three. */
export const favouriteFood = (level: number) =>
  level < 3 ? "Kernel Blend" : level < 6 ? "Hay" : level < 10 ? "NutriBarley" : "Mixed Grain";

/** types/animals.ts → ANIMAL_FOODS recipes. */
export const FEED_RECIPES: Record<string, Record<string, number>> = {
  "Kernel Blend": { Corn: 1 },
  Hay: { Wheat: 1 },
  NutriBarley: { Barley: 1 },
  "Mixed Grain": { Wheat: 1, Corn: 1, Barley: 1 },
};

/** Islands that come after volcano get the +0.1 mineral bonus (types/game.ts → ISLAND_EXPANSIONS). */
export const ISLAND_ORDER = ["basic", "spring", "desert", "volcano", "swamp", "spooky", "crystal"];

/** Faction wearables (types/factions.ts → FACTION_ITEMS). */
export const FACTION_ITEMS: Record<string, { secondaryTool: string; wings: string }> = {
  sunflorians: { secondaryTool: "Sunflorian Shield", wings: "Sunflorian Quiver" },
  bumpkins: { secondaryTool: "Bumpkin Shield", wings: "Bumpkin Quiver" },
  goblins: { secondaryTool: "Goblin Shield", wings: "Goblin Quiver" },
  nightshades: { secondaryTool: "Nightshade Shield", wings: "Nightshade Quiver" },
};

/** types/fruits.ts → FRUIT_SEEDS: seed price in coins, keyed by fruit. */
export const FRUITS: Record<string, { seed: string; price: number }> = {
  Tomato: { seed: "Tomato Seed", price: 5 },
  Lemon: { seed: "Lemon Seed", price: 15 },
  Blueberry: { seed: "Blueberry Seed", price: 30 },
  Orange: { seed: "Orange Seed", price: 50 },
  Apple: { seed: "Apple Seed", price: 70 },
  Banana: { seed: "Banana Plant", price: 70 },
  Celestine: { seed: "Celestine Seed", price: 300 },
  Lunara: { seed: "Lunara Seed", price: 750 },
  Duskberry: { seed: "Duskberry Seed", price: 1250 },
};
