import { describe, expect, it } from "vitest";
import fixture from "../src/demo/fixture.json";
import { currentChapter, summarizeDeliveries, ticketsFor } from "../src/core/deliveries";
import { Valuer } from "../src/core/valuation";
import type { Farm, Order } from "../src/core/farm";
import type { Market } from "../src/core/engine";

const farm = fixture.farm as unknown as Farm;
const market = fixture.market as Market;
const now = Date.parse("2026-11-11T12:00:00Z");

describe("currentChapter", () => {
  it("finds Cave Dwellers, 13 weeks long", () => {
    const c = currentChapter(now)!;
    expect(c.name).toBe("Cave Dwellers");
    expect(c.weeks).toBe(13);
    expect(c.weeksLeft).toBe(12);
  });
});

describe("ticketsFor", () => {
  it("adds 2 for VIP and 1 per chapter item worn or placed", () => {
    const base = { ...farm, vip: undefined, bumpkin: { ...farm.bumpkin, equipped: {} }, farmHands: {} } as Farm;
    expect(ticketsFor("tywin", base, now, "Cave Dwellers")).toBe(10);
    expect(ticketsFor("tywin", { ...base, vip: { expiresAt: now + 1 } }, now, "Cave Dwellers")).toBe(12);
    expect(ticketsFor("betty", base, now, "Cave Dwellers")).toBe(0);
  });
});

describe("Valuer", () => {
  const v = new Valuer(market);
  it("prices coins at the bank rate and recipes from their ingredients", () => {
    expect(v.item("coins").flower).toBeCloseTo(1 / 320);
    expect(v.item("Kale Stew").flower).toBeCloseTo(10 * market.prices.Kale, 6);
  });
  it("flags fish as estimated and unknown items as unknown", () => {
    expect(v.item("Parrotfish").estimated).toBe(true);
    expect(v.item("Anchovy").estimated).toBe(false);
    expect(v.basket({ "Not An Item": 2 }).unknown).toEqual(["Not An Item"]);
  });
});

describe("summarizeDeliveries", () => {
  const s = summarizeDeliveries(fixture.orders as Order[], farm, market, now);
  it("splits ticket, FLOWER and coin deliveries", () => {
    const kinds = new Map(s.npcs.map((n) => [n.npc, n.kind]));
    expect(kinds.get("tywin")).toBe("tickets");
    expect(kinds.get("guria")).toBe("flower");
    expect(kinds.get("betty")).toBe("coins");
  });
  it("averages every order seen per NPC", () => {
    const betty = s.npcs.find((n) => n.npc === "betty")!;
    expect(betty.samples).toBeGreaterThan(3);
    expect(betty.cost).toBeGreaterThan(0);
  });
  it("prices the Oil asked by an NPC from the farm's own Oil Drills", () => {
    const pharaoh = s.npcs.find((n) => n.npc === "pharaoh")!;
    expect(pharaoh.unknown).not.toContain("Oil");
  });
});
