import { describe, expect, it } from "vitest";
import fixture from "../src/demo/fixture.json";
import { currentChapter } from "../src/core/deliveries";
import { dailyRates, Engine, type Market } from "../src/core/engine";
import type { Farm } from "../src/core/farm";
import { evaluate } from "../src/core/scenarios";
import { ticketPlan, verdict } from "../src/core/tickets";

const farm = fixture.farm as unknown as Farm;
const market = fixture.market as Market;
const now = Date.parse("2026-11-11T22:00:00Z");

describe("chapter ticket days", () => {
  it("freezes ticket deliveries until the second Monday", () => {
    const c = currentChapter(now)!;
    expect(new Date(c.ticketsFrom).toISOString().slice(0, 10)).toBe("2026-11-09");
    expect(c.ticketDays).toBe(84);
  });
});

describe("ticketPlan", () => {
  const p = ticketPlan(farm, now)!;
  it("uses the chapter ticket and one delivery per NPC per day", () => {
    expect(p.ticket).toBe("Duende Cap");
    // 34 base tickets without Tywin, +2 VIP and +3 Duende set (worn by a farm hand) for each of the 10 NPCs.
    expect(p.perDay).toBe(84);
    expect(p.tywinPerDay).toBe(15);
    expect(p.doubles.known).toBe(4);
  });
  it("counts the weekly bounty board, its bonus and the chores", () => {
    const b = p.sources.find((s) => s.id === "bounties")!;
    expect(b.total).toBeGreaterThan(4000);
    expect(p.sources.find((s) => s.id === "chores")!.total).toBeGreaterThan(300);
  });
  it("says 2 × 9000 is out of reach without Tywin from 1134", () => {
    const v = verdict(p, 1134, 18000);
    expect(v.verdict).toBe("no");
    expect(v.missing).toBeGreaterThan(2000);
    expect(verdict(p, 1134, 9000).verdict).toBe("easy");
  });
});

describe("Duende Hat", () => {
  it("speeds crops up by 1 / 0.9", () => {
    const { rates } = dailyRates(fixture.snapshots);
    const crops = new Engine(farm, rates, market).report().categories.crops.net;
    const d = evaluate(farm, rates, market).results.find((r) => r.option.id === "duende")!;
    expect(d.gainTotal).toBeCloseTo(crops * (1 / 0.9 - 1), 6);
    expect(d.cost).toBe(0);
  });
});
