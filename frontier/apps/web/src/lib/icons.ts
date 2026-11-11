import type { ItemName } from "@frontier/core";
import { ICON_URL } from "../game/assets";

export type IconKey = ItemName | "credit" | "halo";
/** Icônes peintes de l'interface (src/assets/icons). */
export const ICONS: Partial<Record<IconKey, string>> = ICON_URL;

/** Précharge les icônes pour éviter qu'elles n'apparaissent après l'interface. */
export async function loadIcons() {
  await Promise.all(Object.values(ICON_URL).map(src => { const i = new Image(); i.src = src; return i.decode().catch(() => undefined); }));
}
