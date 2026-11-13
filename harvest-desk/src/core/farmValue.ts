import ids from "./data/ids.json";
import type { Farm } from "./farm";
import type { Market, TokenQuote } from "./engine";
import { MARKET_TAX } from "./marketplace";
import { COINS_PER_FLOWER } from "./gameData";

export type ValueGroupKey = "flower" | "nfts" | "wearables" | "buds" | "resources" | "coins";

/** How a price was found: its listing floor, the cheapest listing of its collection, its latest sale, the bank rate for coins. */
export type PriceSource = "floor" | "collection" | "sale" | "bank" | "cash";

export interface ValueItem { name: string; qty: number; unit: number; value: number; source: PriceSource }
export interface ValueGroup { key: ValueGroupKey; label: string; items: ValueItem[]; total: number; sellable: boolean }
export interface FarmValue {
  groups: ValueGroup[];
  /** Everything priced, in FLOWER. */
  total: number;
  /** What selling all marketplace items would leave after the 10 % tax, plus the FLOWER balance. Coins are left out. */
  netIfSold: number;
  /** Owned items the marketplace gives no price for (not tradable, or never traded). */
  unpriced: string[];
}

const PLACEABLE = new Set<string>(ids.placeable);
const n = (v: unknown) => Number(v ?? 0) || 0;

/**
 * A token's price: its own listing when it has one, otherwise the cheapest listing of its collection
 * (a single token's last sale or offer is often years old or a 1 FLOWER bid, so it says little).
 */
function quote(q: TokenQuote | undefined, all: Record<string, TokenQuote> | undefined): { unit: number; source: PriceSource } | null {
  if (q?.floor) return { unit: q.floor, source: "floor" };
  const floors = Object.values(all ?? {}).map((t) => t.floor ?? 0).filter((f) => f > 0);
  if (floors.length) return { unit: Math.min(...floors), source: "collection" };
  if (q?.sale) return { unit: q.sale, source: "sale" };
  return null;
}

/**
 * What the farm is worth today at marketplace prices, not what it earns.
 * Collectibles and wearables at their floor, or the latest sale when none is listed. A Bud or pet
 * not listed itself counts at the cheapest listing of its collection.
 * Resources at their latest sale. Coins at the bank rate (320 per FLOWER), shown apart since they cannot be sold.
 */
export function farmValue(farm: Farm, market: Market): FarmValue {
  const unpriced: string[] = [];
  const resources: ValueItem[] = [], nfts: ValueItem[] = [], wearables: ValueItem[] = [], buds: ValueItem[] = [];

  for (const [name, v] of Object.entries(farm.inventory ?? {})) {
    const qty = n(v);
    if (qty <= 0) continue;
    if (PLACEABLE.has(name)) {
      const floor = market.nftFloors[name], sale = market.prices[name];
      const unit = floor ?? sale;
      if (unit) nfts.push({ name, qty, unit, value: unit * qty, source: floor ? "floor" : "sale" });
      else unpriced.push(name);
    } else {
      const unit = market.prices[name];
      if (unit) resources.push({ name, qty, unit, value: unit * qty, source: "sale" });
      else unpriced.push(name);
    }
  }

  for (const [name, v] of Object.entries(farm.wardrobe ?? {})) {
    const qty = n(v);
    if (qty <= 0) continue;
    const floor = market.nftFloors[name], sale = market.wearableSales?.[name];
    const unit = floor ?? sale;
    if (unit) wearables.push({ name, qty, unit, value: unit * qty, source: floor ? "floor" : "sale" });
    else unpriced.push(name);
  }

  for (const [id, bud] of Object.entries(farm.buds ?? {})) {
    const name = `Bud #${id}${bud.type ? ` (${bud.type}${bud.aura && bud.aura !== "No Aura" ? `, aura ${bud.aura}` : ""})` : ""}`;
    const q = quote(market.buds?.[id], market.buds);
    if (q) buds.push({ name, qty: 1, unit: q.unit, value: q.unit, source: q.source });
    else unpriced.push(`Bud #${id}`);
  }
  for (const [id, pet] of Object.entries(farm.pets?.nfts ?? {})) {
    const name = `${pet.name ?? "Pet"} #${id}`;
    const q = quote(market.pets?.[id], market.pets);
    if (q) buds.push({ name, qty: 1, unit: q.unit, value: q.unit, source: q.source });
    else unpriced.push(name);
  }

  const balance = n(farm.balance);
  const coins = n(farm.coins);
  const group = (key: ValueGroupKey, label: string, items: ValueItem[], sellable: boolean): ValueGroup => {
    const sorted = [...items].sort((a, b) => b.value - a.value);
    return { key, label, items: sorted, total: sorted.reduce((a, i) => a + i.value, 0), sellable };
  };
  const groups = [
    group("nfts", "Collectibles NFT", nfts, true),
    group("wearables", "Wearables", wearables, true),
    group("buds", "Buds et pets", buds, true),
    group("resources", "Ressources et objets", resources, true),
    group("flower", "FLOWER", balance > 0 ? [{ name: "Solde FLOWER", qty: balance, unit: 1, value: balance, source: "cash" }] : [], false),
    group("coins", "Coins", coins > 0 ? [{ name: "Coins", qty: coins, unit: 1 / COINS_PER_FLOWER, value: coins / COINS_PER_FLOWER, source: "bank" }] : [], false),
  ];
  const total = groups.reduce((a, g) => a + g.total, 0);
  const sellable = groups.filter((g) => g.sellable).reduce((a, g) => a + g.total, 0);
  return { groups, total, netIfSold: sellable * (1 - MARKET_TAX) + balance, unpriced: unpriced.sort() };
}
