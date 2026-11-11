import type { Farm } from "./farm";
import type { Market } from "./engine";

/** What the ledger keeps of each farm reading. Small on purpose: one is stored per hour. */
export interface FarmMeta {
  at: number;
  /** USD per FLOWER when the reading was taken. */
  usd: number;
  balance: number;
  withdrawn: number;
  soldCount: number;
  /** Owned NFTs and wearables worth at least a few FLOWER, to name purchases and sales. */
  items: Record<string, number>;
  /** Pending orders paid in FLOWER. */
  flowerOrders: Record<string, { npc: string; sfl: number }>;
  delivered: Record<string, number>;
}

export type EntryKind = "withdraw" | "delivery" | "purchase" | "sale" | "spend" | "income" | "manual";

export interface LedgerEntry {
  id: string;
  at: number;
  kind: EntryKind;
  /** Signed: positive comes in, negative goes out. */
  flower?: number;
  usd: number;
  label: string;
  detail?: string;
}

const NFT_MIN = 20, WEARABLE_MIN = 5;

export function metaOf(farm: Farm, at: number, market: Market): FarmMeta {
  const items: Record<string, number> = {};
  for (const [k, v] of Object.entries(farm.inventory ?? {})) {
    if ((market.nftFloors[k] ?? 0) >= NFT_MIN && Number(v) > 0) items[k] = Number(v);
  }
  for (const [k, v] of Object.entries(farm.wardrobe ?? {})) {
    if ((market.nftFloors[k] ?? 0) >= WEARABLE_MIN && v > 0) items[`👕 ${k}`] = v;
  }
  const flowerOrders: FarmMeta["flowerOrders"] = {};
  for (const o of farm.delivery?.orders ?? []) if (o.reward?.sfl) flowerOrders[o.id] = { npc: o.from, sfl: o.reward.sfl };
  const delivered: Record<string, number> = {};
  for (const [k, v] of Object.entries(farm.npcs ?? {})) delivered[k] = v.deliveryCount ?? 0;
  return {
    at, usd: market.flowerUsd, balance: Number(farm.balance ?? 0), withdrawn: farm.bank?.withdrawnAmount ?? 0,
    soldCount: farm.trades?.soldCount ?? 0, items, flowerOrders, delivered,
  };
}

const names = (m: Record<string, number>) => Object.entries(m).map(([k, n]) => (n > 1 ? `${k} ×${n}` : k).replace("👕 ", "")).join(", ");

/** FLOWER moves between two readings, split by cause. Whatever is left is a purchase, a sale or in-game spending. */
export function diffMeta(a: FarmMeta, b: FarmMeta): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  const usd = b.usd;
  const push = (kind: EntryKind, flower: number, label: string, detail?: string) => {
    if (Math.abs(flower) < 0.01) return;
    out.push({ id: `${b.at}-${kind}`, at: b.at, kind, flower, usd: flower * usd, label, detail });
  };
  const withdrawn = b.withdrawn - a.withdrawn;
  push("withdraw", -withdrawn, "Retrait vers le portefeuille");

  let delivered = 0;
  const who: string[] = [];
  for (const [id, o] of Object.entries(a.flowerOrders)) {
    if (!b.flowerOrders[id] && (b.delivered[o.npc] ?? 0) > (a.delivered[o.npc] ?? 0)) { delivered += o.sfl; who.push(o.npc); }
  }
  push("delivery", delivered, "Livraisons payées en FLOWER", who.join(", "));

  const gained: Record<string, number> = {}, lost: Record<string, number> = {};
  for (const k of new Set([...Object.keys(a.items), ...Object.keys(b.items)])) {
    const d = (b.items[k] ?? 0) - (a.items[k] ?? 0);
    if (d > 0) gained[k] = d; else if (d < 0) lost[k] = -d;
  }
  const rest = b.balance - a.balance + withdrawn - delivered;
  if (rest < 0) push(Object.keys(gained).length ? "purchase" : "spend", rest, Object.keys(gained).length ? "Achats" : "Dépenses en jeu", names(gained) || undefined);
  else push(b.soldCount > a.soldCount || Object.keys(lost).length ? "sale" : "income", rest, b.soldCount > a.soldCount || Object.keys(lost).length ? "Ventes" : "Autres gains", names(lost) || undefined);
  return out;
}

export function ledgerFromMetas(metas: FarmMeta[]): LedgerEntry[] {
  const s = [...metas].sort((x, y) => x.at - y.at);
  const out: LedgerEntry[] = [];
  for (let i = 1; i < s.length; i++) out.push(...diffMeta(s[i - 1], s[i]));
  return out;
}

/** Keeps one reading per hour for 35 days, then one per day. Ledger totals do not change. */
export function thinMetas(metas: FarmMeta[], now: number): FarmMeta[] {
  const s = [...metas].sort((x, y) => x.at - y.at);
  const keep: FarmMeta[] = [];
  for (const m of s) {
    const slot = now - m.at > 35 * 86_400_000 ? 86_400_000 : 3_600_000;
    const last = keep[keep.length - 1];
    if (last && Math.floor(last.at / slot) === Math.floor(m.at / slot)) keep[keep.length - 1] = m;
    else keep.push(m);
  }
  return keep;
}
