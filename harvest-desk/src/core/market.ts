import { COLLECTIBLE_IDS, RESOURCE_IDS, WEARABLE_IDS } from "./itemIds";
import type { Market } from "./engine";

interface ItemReport { latestSale?: number; floor?: number }
interface MarketplaceActivity { data: { flowerPrice: number; reports: Record<string, { items: Record<string, ItemReport> }> } }

/** Turns /community/data?type=marketplaceActivity into the prices the engine needs. */
export function parseMarket(json: MarketplaceActivity): Market {
  const dates = Object.keys(json.data.reports).sort();
  const date = dates[dates.length - 1];
  const items = json.data.reports[date].items;
  const prices: Record<string, number> = {};
  for (const [name, id] of Object.entries(RESOURCE_IDS)) {
    const r = items[`collectibles-${id}`];
    const p = r?.latestSale ?? r?.floor;
    if (p) prices[name] = p;
  }
  const nftFloors: Record<string, number> = {};
  for (const [name, id] of Object.entries(COLLECTIBLE_IDS)) {
    const f = items[`collectibles-${id}`]?.floor;
    if (f) nftFloors[name] = f;
  }
  for (const [name, id] of Object.entries(WEARABLE_IDS)) {
    const f = items[`wearables-${id}`]?.floor;
    if (f) nftFloors[name] = f;
  }
  return { flowerUsd: json.data.flowerPrice, date, prices, nftFloors };
}
