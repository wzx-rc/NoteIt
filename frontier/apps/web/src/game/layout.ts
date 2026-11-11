/** Position des éléments sur la carte (pixels du monde, coin haut gauche des sprites). */
export const WORLD = { w: 960, h: 640, tile: 32 };

export const PLACES = {
  hq: { x: 380, y: 70 },
  shop: { x: 150, y: 120 },
  npc: { x: 290, y: 205 },
  greenhouse: { x: 130, y: 290 },
  raffinerie: { x: 440, y: 340 },
  tourelle: { x: 590, y: 440 },
  zone: { x: 740, y: 160, w: 170, h: 400 },
} as const;

export const BED_POS: Record<string, { x: number; y: number }> = {
  "1": { x: 104, y: 412 }, "2": { x: 180, y: 412 }, "3": { x: 256, y: 412 },
  "4": { x: 760, y: 190 }, "5": { x: 836, y: 190 }, "6": { x: 760, y: 260 },
};

export const NODE_POS: Record<string, { x: number; y: number }> = {
  "1": { x: 610, y: 100 }, "2": { x: 670, y: 196 }, "3": { x: 596, y: 270 },
  "4": { x: 790, y: 390 }, "5": { x: 850, y: 310 }, "6": { x: 770, y: 480 },
};

/** Forme du terrain en pixels du monde : île principale et zone d'extension (ellipses). */
export const ISLAND = {
  main: { cx: 368, cy: 314, rx: 403, ry: 294 },
  expansion: { cx: 816, cy: 390, rx: 186, ry: 243 },
} as const;
