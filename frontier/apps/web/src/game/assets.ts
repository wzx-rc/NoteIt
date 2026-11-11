/**
 * Kit peint généré avec Recraft (src/assets), style « QG 1 ».
 * Les images sont stockées au double de leur taille d'affichage (RES) pour rester nettes au zoom.
 */
const files = import.meta.glob("../assets/*.{webp,jpg}", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const icons = import.meta.glob("../assets/icons/*.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

const byName = (m: Record<string, string>) =>
  Object.fromEntries(Object.entries(m).map(([path, url]) => [path.split("/").pop()!.replace(/\.(webp|jpg)$/, ""), url]));

export const ASSET_URL: Record<string, string> = byName(files);
export const ICON_URL: Record<string, string> = byName(icons);

/** Facteur entre la taille des textures et leur taille dans le monde. */
export const RES = 2;
