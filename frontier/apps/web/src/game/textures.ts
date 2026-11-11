import type { CropName } from "@frontier/core";

/**
 * Petits éléments dessinés en code (bacs, pousses, graines, charge, $HALO) dans la
 * palette du kit Recraft. Ils servent à la fois à Phaser et aux icônes de l'interface.
 */
export const CROP_COLORS: Record<CropName, [string, string, string]> = {
  spore: ["#3f7a4a", "#6fae78", "#b6e3a0"],
  algue: ["#1b4d55", "#3aa6b4", "#5fd4e0"],
  quartz: ["#5d47b0", "#8a6ee0", "#c7b8ff"],
};

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.imageSmoothingEnabled = false;
  draw(g);
  return c;
}
const R = (g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: string) => { g.fillStyle = c; g.fillRect(x, y, w, h); };

export function bedCanvas() {
  return canvas(64, 44, g => {
    R(g, 2, 8, 60, 34, "#0b0d12"); R(g, 3, 9, 58, 32, "#4a5260"); R(g, 3, 9, 58, 3, "#8b96a6");
    R(g, 7, 14, 50, 22, "#2a2219");
    for (let i = 0; i < 5; i++) R(g, 9 + i * 10, 16 + (i % 2) * 8, 4, 2, "#3a2e20");
    R(g, 56, 12, 3, 2, "#5fd4e0");
  });
}

export function cropCanvas(col: [string, string, string], stage: 0 | 1 | 2) {
  return canvas(16, 16, g => {
    if (stage === 0) { R(g, 7, 10, 2, 4, col[0]); R(g, 6, 9, 1, 1, col[1]); R(g, 9, 9, 1, 1, col[1]); }
    else if (stage === 1) { R(g, 7, 6, 2, 8, col[0]); R(g, 4, 8, 3, 2, col[1]); R(g, 9, 7, 3, 2, col[1]); R(g, 6, 5, 4, 2, col[1]); }
    else { R(g, 7, 5, 2, 9, col[0]); R(g, 3, 7, 4, 3, col[1]); R(g, 9, 6, 4, 3, col[1]); R(g, 5, 2, 6, 4, col[1]); R(g, 6, 2, 4, 2, col[2]); R(g, 4, 7, 1, 1, col[2]); R(g, 11, 6, 1, 1, col[2]); }
  });
}

export function seedCanvas(col: [string, string, string]) {
  return canvas(16, 16, g => { R(g, 3, 4, 10, 10, "#8b6b3e"); R(g, 4, 5, 8, 3, "#a8844e"); R(g, 6, 9, 4, 3, col[1]); R(g, 7, 9, 2, 1, col[2]); });
}

export function chargeCanvas() {
  return canvas(16, 16, g => { R(g, 5, 2, 6, 12, "#4a5260"); R(g, 6, 3, 4, 3, "#8b96a6"); R(g, 5, 8, 6, 2, "#f0a648"); R(g, 7, 0, 2, 2, "#e5635b"); });
}

export function haloCanvas() {
  return canvas(16, 16, g => { R(g, 3, 3, 10, 10, "#5d47b0"); R(g, 4, 4, 8, 8, "#8a6ee0"); R(g, 6, 5, 4, 1, "#c7b8ff"); R(g, 5, 6, 1, 4, "#c7b8ff"); R(g, 10, 6, 1, 4, "#c7b8ff"); R(g, 6, 10, 4, 1, "#c7b8ff"); });
}
