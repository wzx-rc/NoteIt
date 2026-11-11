import { CROPS, type CropName, type ItemName } from "@frontier/core";
import { ASSET_URL, ICON_FRAME } from "../game/assets";
import { CROP_COLORS, chargeCanvas, cropCanvas, haloCanvas, seedCanvas } from "../game/textures";

export type IconKey = ItemName | "credit" | "halo";
export const ICONS: Partial<Record<IconKey, string>> = {};

/** Prépare les icônes de l'interface (planche Recraft + pictos dessinés en code). */
export async function loadIcons() {
  const img = new Image();
  img.src = ASSET_URL.icons;
  await img.decode().catch(() => undefined);
  const cut = (i: number) => {
    const c = document.createElement("canvas"); c.width = 32; c.height = 32;
    c.getContext("2d")!.drawImage(img, i * 32, 0, 32, 32, 0, 0, 32, 32);
    return c.toDataURL();
  };
  for (const [k, i] of Object.entries(ICON_FRAME)) ICONS[k as IconKey] = cut(i);
  for (const c of Object.keys(CROPS) as CropName[]) {
    ICONS[c] = cropCanvas(CROP_COLORS[c], 2).toDataURL();
    ICONS[`graine-${c}`] = seedCanvas(CROP_COLORS[c]).toDataURL();
  }
  ICONS.charge = chargeCanvas().toDataURL();
  ICONS.halo = haloCanvas().toDataURL();
}
