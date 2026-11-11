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
  "1": { x: 110, y: 380 }, "2": { x: 186, y: 380 }, "3": { x: 262, y: 380 },
  "4": { x: 760, y: 190 }, "5": { x: 836, y: 190 }, "6": { x: 760, y: 260 },
};

export const NODE_POS: Record<string, { x: number; y: number }> = {
  "1": { x: 600, y: 110 }, "2": { x: 650, y: 210 }, "3": { x: 560, y: 250 },
  "4": { x: 790, y: 390 }, "5": { x: 850, y: 310 }, "6": { x: 770, y: 480 },
};

/** Forme du terrain en tuiles : île principale et zone d'extension (ellipses). */
const inEllipse = (x: number, y: number, cx: number, cy: number, rx: number, ry: number) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 < 1;
export const onMain = (x: number, y: number) => inEllipse(x, y, 11.5, 9.8, 12.6, 9.2);
export const onExpansion = (x: number, y: number) => inEllipse(x, y, 25.5, 12.2, 5.8, 7.6);
