import { useState } from "react";
import ids from "../core/data/ids.json";
import { Icon } from "./icons";

/**
 * The game's public NFT pictures (the ones its marketplace metadata points to).
 * They are loaded from the game's site when shown, never copied into this app.
 */
const BASE = "https://sunflower-land.com/play";
const collectibles = ids.collectibles as Record<string, number>;
const wearables = ids.wearables as Record<string, number>;

export function itemImageUrl(name: string): string | undefined {
  if (collectibles[name]) return `${BASE}/erc1155/images/${collectibles[name]}.webp`;
  if (wearables[name]) return `${BASE}/wearables/images/${wearables[name]}.png`;
  return undefined;
}

/** The item's picture, or one of the app's own icons when it has none or it fails to load. */
export function ItemImage({ name, fallback, size = 30 }: { name: string; fallback: string; size?: number }) {
  const url = itemImageUrl(name);
  const [failed, setFailed] = useState(false);
  if (!url || failed) return <Icon name={fallback} size={Math.round(size * 0.65)} />;
  return (
    <span className="imgclip" style={{ width: size + 8, height: size + 8 }}>
      <img className="itemimg" src={url} alt="" width={size} height={size} loading="lazy"
        referrerPolicy="no-referrer" onError={() => setFailed(true)} />
    </span>
  );
}
