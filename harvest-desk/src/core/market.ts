import ids from "./data/ids.json";
import type { Market, TokenQuote } from "./engine";

interface ItemReport { latestSale?: number; floor?: number; bestOffer?: number }
interface MarketplaceActivity { data: { flowerPrice: number; reports: Record<string, { items: Record<string, ItemReport> }> } }

/**
 * Turns /community/data?type=marketplaceActivity into prices by item name.
 * `prices` uses the last sale (or the floor) of every tradable item,
 * `nftFloors` the floor of every collectible and wearable.
 */
export function parseMarket(json: MarketplaceActivity): Market {
  const dates = Object.keys(json.data.reports).sort();
  const date = dates[dates.length - 1];
  const items = json.data.reports[date].items;
  const prices: Record<string, number> = {};
  const nftFloors: Record<string, number> = {};
  for (const [name, id] of Object.entries(ids.collectibles)) {
    const r = items[`collectibles-${id}`];
    if (!r) continue;
    const p = r.latestSale ?? r.floor;
    if (p) prices[name] = p;
    if (r.floor) nftFloors[name] = r.floor;
  }
  const wearableSales: Record<string, number> = {};
  for (const [name, id] of Object.entries(ids.wearables)) {
    const r = items[`wearables-${id}`];
    if (r?.floor) nftFloors[name] = r.floor;
    if (r?.latestSale) wearableSales[name] = r.latestSale;
  }
  const buds: Record<string, TokenQuote> = {}, pets: Record<string, TokenQuote> = {};
  for (const [key, r] of Object.entries(items)) {
    const m = /^(buds|pets)-(\d+)$/.exec(key);
    if (!m) continue;
    (m[1] === "buds" ? buds : pets)[m[2]] = { floor: r.floor, sale: r.latestSale, offer: r.bestOffer };
  }
  return { flowerUsd: json.data.flowerPrice, date, prices, nftFloors, wearableSales, buds, pets };
}
