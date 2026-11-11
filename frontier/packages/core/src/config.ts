/**
 * Données d'équilibrage du jeu. Partagées par le client (affichage, simulation
 * optimiste) et par le serveur (validation). Toute modification ici change les
 * règles pour tout le monde, comme les fichiers `types/` de Sunflower Land.
 *
 * Les durées sont en secondes.
 */

export const LEVEL_XP = [0, 40, 130, 300, 600] as const; // seuils des niveaux 1 à 5
export const MAX_LEVEL = LEVEL_XP.length;

export type CropName = "spore" | "algue" | "quartz";
export type ResourceName = "ferrite" | "xenon";
export type CraftName = "alliage" | "ration" | "cellule";
export type ToolName = "charge";
export type SeedName = `graine-${CropName}`;
export type ItemName = CropName | ResourceName | CraftName | ToolName | SeedName;
export type BuildingName = "raffinerie" | "tourelle";

export interface CropConfig {
  label: string;
  seedPrice: number; // en crédits
  seconds: number;
  sellPrice: number; // en crédits
  xp: number;
  level: number;
}

export const CROPS: Record<CropName, CropConfig> = {
  spore: { label: "Spores", seedPrice: 1, seconds: 60, sellPrice: 2, xp: 1, level: 1 },
  algue: { label: "Algues bleues", seedPrice: 3, seconds: 180, sellPrice: 7, xp: 3, level: 2 },
  quartz: { label: "Champignons de quartz", seedPrice: 8, seconds: 480, sellPrice: 20, xp: 8, level: 4 },
};

export const RESOURCES: Record<ResourceName, { label: string; respawnSeconds: number; charges: number; sellPrice: number; xp: number }> = {
  ferrite: { label: "Ferrite", respawnSeconds: 120, charges: 1, sellPrice: 3, xp: 2 },
  xenon: { label: "Xénon", respawnSeconds: 300, charges: 2, sellPrice: 9, xp: 6 },
};

export const TOOLS: Record<ToolName, { label: string; price: number; level: number }> = {
  charge: { label: "Charge de forage", price: 4, level: 1 },
};

export const RECIPES: Record<CraftName, { label: string; ingredients: Partial<Record<ItemName, number>>; seconds: number; xp: number; level: number }> = {
  alliage: { label: "Alliage", ingredients: { ferrite: 3 }, seconds: 60, xp: 10, level: 2 },
  ration: { label: "Ration compacte", ingredients: { spore: 4, algue: 1 }, seconds: 120, xp: 12, level: 2 },
  cellule: { label: "Cellule d'énergie", ingredients: { ferrite: 2, xenon: 1 }, seconds: 180, xp: 20, level: 3 },
};

export const BUILDINGS: Record<BuildingName, { label: string; level: number; credits: number; ingredients: Partial<Record<ItemName, number>>; seconds: number; xp: number }> = {
  raffinerie: { label: "Raffinerie", level: 2, credits: 40, ingredients: { ferrite: 10 }, seconds: 60, xp: 15 },
  tourelle: { label: "Tourelle de défense", level: 4, credits: 80, ingredients: { alliage: 4, cellule: 2 }, seconds: 120, xp: 40 },
};

export const EXPANSION = { level: 3, credits: 60, ingredients: { ferrite: 20, alliage: 3 } as Partial<Record<ItemName, number>>, seconds: 90, xp: 30 };

/** Raids de drones à partir du niveau 4 (équivalent des « mauvaises surprises » saisonnières). */
export const RAID = { level: 4, firstDelaySeconds: 150, intervalSeconds: 240, ferriteStolen: 4, rewardCredits: 15, rewardXp: 20 };

/** Valeur de référence des produits pour calculer la récompense d'une livraison. */
export const ORDER_VALUE: Partial<Record<ItemName, number>> = { spore: 2, ferrite: 3, algue: 7, alliage: 14, ration: 22, xenon: 12, cellule: 35, quartz: 20 };
export const ORDER_SLOTS = 3;
export const ORDER_HALO_CHANCE = 0.45;
/** 1 $HALO pour 12 crédits de valeur de commande, arrondi au demi. */
export const ORDER_HALO_RATE = 12;

/** Aide de départ si le joueur n'a plus rien (évite les parties bloquées). */
export const STARTER_AID = { seeds: 3, charges: 2 };

export const NPCS = ["Contremaître Vale", "Docteure Imre", "Okto le marchand", "Pilote Sanna"] as const;

export const ITEM_LABELS: Record<ItemName, string> = {
  spore: "Spores", algue: "Algues bleues", quartz: "Champignons de quartz",
  ferrite: "Ferrite", xenon: "Xénon",
  alliage: "Alliage", ration: "Ration compacte", cellule: "Cellule d'énergie",
  charge: "Charge de forage",
  "graine-spore": "Graine de spores", "graine-algue": "Graine d'algues", "graine-quartz": "Graine de quartz",
};

export const SELLABLE: Partial<Record<ItemName, number>> = {
  spore: CROPS.spore.sellPrice, algue: CROPS.algue.sellPrice, quartz: CROPS.quartz.sellPrice,
  ferrite: RESOURCES.ferrite.sellPrice, xenon: RESOURCES.xenon.sellPrice,
};

/** Retrait vers la chaîne : minimum et frais (brûlés), comme la taxe de retrait de SFL. */
export const WITHDRAW = { minHalo: 1, feeBps: 500 };

/** Tolérance d'horloge entre client et serveur pour les événements horodatés. */
export const CLOCK_SKEW_MS = 2 * 60 * 1000;

export function levelForXp(xp: number): number {
  let l = 1;
  LEVEL_XP.forEach((t, i) => { if (xp >= t) l = i + 1; });
  return l;
}
