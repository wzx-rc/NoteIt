/** Sprites pixel art générés avec Recraft (src/assets). */
const files = import.meta.glob("../assets/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export const ASSET_URL: Record<string, string> = Object.fromEntries(
  Object.entries(files).map(([path, url]) => [path.split("/").pop()!.replace(".png", ""), url]),
);

/** Planches d'animation : taille d'une image. */
export const SHEETS: Record<string, { w: number; h: number }> = {
  turret: { w: 40, h: 40 },
  drone: { w: 40, h: 36 },
  colonist: { w: 24, h: 32 },
  "xenon-geyser": { w: 32, h: 48 },
  icons: { w: 32, h: 32 },
  explosion: { w: 40, h: 40 },
};

/** Ordre des icônes dans icons.png. */
export const ICON_FRAME = { ferrite: 0, xenon: 1, alliage: 2, ration: 3, cellule: 4, credit: 5 } as const;
