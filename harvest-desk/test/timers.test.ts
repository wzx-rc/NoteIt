import { describe, expect, it } from "vitest";
import { farmTimers, readyAt, summarize, countdown } from "../src/core/timers";

const H = 3_600_000;

describe("readyAt (boost windows)", () => {
  it("is start + work with no window", () => expect(readyAt(1000, 5 * H, [])).toBe(1000 + 5 * H));
  it("a 2× window covering the whole run halves it", () => expect(readyAt(0, 4 * H, [{ from: 0, to: 1e15, speed: 2 }])).toBe(2 * H));
  it("only the covered part goes faster", () => {
    // 1 h at 2× = 2 h of work, then 2 h left at 1×.
    expect(readyAt(0, 4 * H, [{ from: 0, to: H, speed: 2 }])).toBe(3 * H);
  });
  it("overlapping boosts multiply", () => expect(readyAt(0, 4 * H, [{ from: 0, to: 1e15, speed: 2 }, { from: 0, to: 1e15, speed: 2 }])).toBe(H));
});

describe("farmTimers", () => {
  const farm = {
    crops: {
      a: { x: 0, y: 0, crop: { name: "Wheat", plantedAt: 0, baseDurationMs: 4 * H }, fertiliser: { name: "Rapid Root", fertilisedAt: 0 } },
      b: { x: 1, y: 0 },
    },
    stones: { s: { x: 0, y: 1, stone: { minedAt: 0, baseDurationMs: 2 * H } } },
    henHouse: { animals: { c: { type: "Chicken", asleepAt: 0, baseDurationMs: 10 * H, awakeAt: 10 * H } } },
    bumpkin: { skills: { "Tree Blitz": 2 }, previousPowerUseAt: { "Tree Blitz": 1000 } },
    collectibles: { "Super Totem": [{ createdAt: 0, coordinates: { x: 0, y: 0 } }] },
  };
  const t = farmTimers(farm);
  it("applies Rapid Root and a placed Super Totem to the crop (2 × 2 = 4× faster)", () => {
    expect(t.find((x) => x.group === "crops" && x.label === "Wheat")!.readyAt).toBe(H);
  });
  it("counts an empty plot", () => expect(t.filter((x) => x.state === "empty")).toHaveLength(1));
  it("uses the rank's power skill cooldown (Tree Blitz rank 2 = 18 h)", () => {
    expect(t.find((x) => x.group === "power")!.readyAt).toBe(1000 + 18 * H);
  });
  it("summarizes a group", () => {
    const s = summarize(t, 30 * 60_000).find((g) => g.key === "crops")!;
    expect(s).toMatchObject({ total: 2, ready: 0, empty: 1, nextAt: H });
    expect(summarize(t, 2 * H).find((g) => g.key === "stone")!.ready).toBe(1);
  });
  it("formats countdowns", () => {
    expect(countdown(35 * 60_000)).toBe("35 min");
    expect(countdown(2 * H + 10 * 60_000)).toBe("2 h 10");
    expect(countdown(28 * H)).toBe("1 j 4 h");
  });
});

import { sortSummaries } from "../src/ui/widget/Widget";
describe("widget order", () => {
  const g = (key: any, ready: number, nextAt: number | null) => ({ key, label: key, icon: "", total: 1, ready, empty: 0, blocked: 0, nextAt, allAt: nextAt, what: "", progress: 0 });
  const rows = [g("iron", 0, 300), g("stone", 0, 100), g("trees", 1, null)];
  it("auto: ready first, then soonest to 100 %", () => expect(sortSummaries(rows).map((r) => r.key)).toEqual(["trees", "stone", "iron"]));
  it("custom: the saved order", () => {
    expect(sortSummaries(rows, { order: "custom", groupOrder: ["iron", "trees", "stone"] }).map((r) => r.key)).toEqual(["iron", "trees", "stone"]);
  });
});
