import { describe, expect, it } from "vitest";
import { procStats, updateProcs } from "../src/core/procs";

const T0 = Date.parse("2026-11-15T08:00:00Z");
const MIN = 60_000;
const farm = (at: number, chops: [number, number, number], pop?: { at: number; tree?: "Sacred Tree" | "Tree" }) => ({
  boostsUsedAt: pop ? { "Money Tree": pop.at } : {},
  farmActivity: { "Basic Tree Chopped": chops[0], "Ancient Tree Chopped": chops[1], "Sacred Tree Chopped": chops[2] },
  trees: {
    a: { name: "Tree", multiplier: 1, wood: { choppedAt: pop?.tree === "Tree" ? pop.at : at - 5 * MIN } },
    s: { name: "Sacred Tree", multiplier: 16, wood: { choppedAt: pop?.tree === "Sacred Tree" ? pop.at : at - 5 * MIN } },
  },
});

describe("Money Tree pops", () => {
  it("marks the pop already there at the first reading as before the tracking", () => {
    const log = updateProcs(null, farm(T0, [0, 0, 0], { at: T0 - 3_600_000 }), T0);
    expect(log.events).toHaveLength(1);
    expect(log.events[0].before).toBe(true);
    expect(procStats(log, 1, { "Basic Tree": 1, "Sacred Tree": 16 }).pops).toBe(0);
  });

  it("counts a new pop once, finds its tree and its coins", () => {
    let log = updateProcs(null, farm(T0, [0, 0, 0]), T0);
    log = updateProcs(log, farm(T0 + 10 * MIN, [50, 0, 10], { at: T0 + 8 * MIN, tree: "Sacred Tree" }), T0 + 10 * MIN);
    log = updateProcs(log, farm(T0 + 20 * MIN, [100, 0, 20], { at: T0 + 8 * MIN }), T0 + 20 * MIN);
    expect(log.events).toHaveLength(1);
    expect(log.events[0]).toMatchObject({ tree: "Sacred Tree", mult: 16, coins: 3200 });
    const s = procStats(log, 1, { "Basic Tree": 1, "Sacred Tree": 16 });
    expect(s.pops).toBe(1);
    expect(s.coins).toBe(3200);
    expect(s.chops).toBe(120);
    // 100 basic × 1 % × 200 + 20 sacred × 1 % × 3200.
    expect(s.expectedCoins).toBeCloseTo(200 + 640);
    expect(s.expectedPops).toBeCloseTo(1.2);
  });

  it("leaves out pops and chops seen across a long gap", () => {
    let log = updateProcs(null, farm(T0, [0, 0, 0]), T0);
    log = updateProcs(log, farm(T0 + 5 * 3_600_000, [500, 0, 0], { at: T0 + 2 * 3_600_000, tree: "Tree" }), T0 + 5 * 3_600_000);
    const s = procStats(log, 1, { "Basic Tree": 1 });
    expect(s.pops).toBe(0);
    expect(s.chops).toBe(0);
    expect(log.events).toHaveLength(1);
  });
});
