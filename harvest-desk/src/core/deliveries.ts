import chapters from "./data/chapters.json";
import type { Farm, Order } from "./farm";
import { FarmView } from "./farm";
import type { Market } from "./engine";
import { Valuer } from "./valuation";
import { COINS_PER_FLOWER } from "./gameData";

const TICKETS = chapters.tickets as Record<string, number>;
const BOOSTS = chapters.boosts as Record<string, string[]>;
const CHAPTERS = chapters.chapters as Record<string, { start: string; end: string }>;
const WEEK = 7 * 86_400_000;

const DAY = 86_400_000;

export interface Chapter {
  name: string; start: number; end: number; weeks: number; weeksLeft: number;
  /** Ticket deliveries are frozen from the chapter start to its month's second Monday (getChapterHolidayPeriod). */
  ticketsFrom: number;
  /** Days with ticket deliveries, in the whole chapter and from today on (today included). */
  ticketDays: number; ticketDaysLeft: number;
}

/** Midnight UTC of the day holding `t`. */
export const utcDay = (t: number) => Math.floor(t / DAY) * DAY;

function secondMonday(start: number): number {
  const d = new Date(start);
  const first = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  const toMonday = (1 - new Date(first).getUTCDay() + 7) % 7;
  return first + (toMonday + 7) * DAY;
}

export function currentChapter(now: number): Chapter | null {
  for (const [name, c] of Object.entries(CHAPTERS)) {
    const start = Date.parse(c.start), end = Date.parse(c.end);
    if (now >= start && now < end) {
      const ticketsFrom = Math.max(start, secondMonday(start));
      return {
        name, start, end, weeks: Math.round((end - start) / WEEK), weeksLeft: Math.max(0, Math.ceil((end - now) / WEEK)),
        ticketsFrom,
        ticketDays: Math.round((end - ticketsFrom) / DAY),
        ticketDaysLeft: Math.max(0, Math.round((end - Math.max(utcDay(now), ticketsFrom)) / DAY)),
      };
    }
  }
  return null;
}

/** Tickets one delivery to this NPC gives (deliver.ts → generateDeliveryTickets, without the double-delivery event). */
export function ticketsFor(npc: string, farm: Farm, now: number, chapter: string | undefined): number {
  const base = TICKETS[npc];
  if (!base) return 0;
  const f = new FarmView(farm);
  const vip = (farm.vip?.expiresAt ?? 0) > now;
  const boosts = (chapter ? BOOSTS[chapter] ?? [] : []).filter((i) => f.has(i) || f.wears(i)).length;
  return base + (vip ? 2 : 0) + boosts;
}

export type NpcKind = "tickets" | "flower" | "coins";

export interface NpcSummary {
  npc: string;
  kind: NpcKind;
  /** Distinct orders seen for this NPC. */
  samples: number;
  /** Average FLOWER cost of the items asked. */
  cost: number;
  /** Average FLOWER reward (FLOWER or coins at the bank rate), 0 for ticket NPCs. */
  reward: number;
  tickets: number;
  estimated: boolean;
  unknown: string[];
  /** The order waiting now, if any. */
  current?: { cost: number; items: Record<string, number> };
}

const kindOf = (o: Order): NpcKind => (TICKETS[o.from] ? "tickets" : o.reward?.sfl ? "flower" : "coins");

/** Averages every order seen per NPC. */
export function summarizeDeliveries(orders: Order[], farm: Farm, market: Market, now: number): { chapter: Chapter | null; npcs: NpcSummary[] } {
  const chapter = currentChapter(now);
  const valuer = new Valuer(market);
  const pending = new Map((farm.delivery?.orders ?? []).map((o) => [o.from, o]));
  const by = new Map<string, Order[]>();
  for (const o of orders) {
    if (!o.items || !Object.keys(o.items).length) continue;
    by.set(o.from, [...(by.get(o.from) ?? []), o]);
  }
  const npcs: NpcSummary[] = [];
  for (const [npc, list] of by) {
    const vals = list.map((o) => valuer.basket(o.items));
    const rewards = list.map((o) => (o.reward?.sfl ?? 0) + (o.reward?.coins ?? 0) / COINS_PER_FLOWER);
    const cur = pending.get(npc);
    npcs.push({
      npc, kind: kindOf(list[0]), samples: list.length,
      cost: vals.reduce((a, v) => a + v.flower, 0) / list.length,
      reward: rewards.reduce((a, b) => a + b, 0) / list.length,
      tickets: ticketsFor(npc, farm, now, chapter?.name),
      estimated: vals.some((v) => v.estimated),
      unknown: [...new Set(vals.flatMap((v) => v.unknown))],
      current: cur ? { cost: valuer.basket(cur.items).flower, items: cur.items } : undefined,
    });
  }
  return { chapter, npcs: npcs.sort((a, b) => b.cost - a.cost) };
}
