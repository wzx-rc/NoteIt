import { describe, expect, it } from "vitest";
import fixture from "../src/demo/fixture.json";
import { Engine, dailyRates } from "../src/core/engine";
import { evaluate } from "../src/core/scenarios";
import type { Farm } from "../src/core/farm";
import type { Market } from "../src/core/engine";

const farm = fixture.farm as unknown as Farm;
const market = fixture.market as Market;
const { rates, days } = dailyRates(fixture.snapshots);
const usd = (flower: number) => flower * market.flowerUsd;

describe("dailyRates", () => {
  it("averages counters over the snapshot span", () => {
    expect(days).toBeGreaterThan(6.5);
    expect(days).toBeLessThan(7.5);
    const a = { at: 0, farmActivity: { "Wheat Harvested": 10, "Sheep Fed": 4 } };
    const b = { at: 2 * 86_400_000, farmActivity: { "Wheat Harvested": 30, "Sheep Fed": 4 } };
    expect(dailyRates([a, b])).toEqual({ rates: { "Wheat Harvested": 10 }, days: 2 });
  });
  it("returns nothing with a single snapshot", () => {
    expect(dailyRates([fixture.snapshots[0]])).toEqual({ rates: {}, days: 0 });
  });
});

describe("Engine on the example farm", () => {
  const r = new Engine(farm, rates, market).report();
  it("earns about 11 $ per day (Frugal Miner, Seedy Business and Seeded Bounty counted)", () => {
    expect(usd(r.net)).toBeGreaterThan(10.7);
    expect(usd(r.net)).toBeLessThan(11.3);
  });
  it("ranks animals first and minerals last", () => {
    const c = r.categories;
    expect(c.animals.net).toBeGreaterThan(c.crops.net);
    expect(c.minerals.net).toBeLessThan(c.greenhouse.net);
  });
  it("feeds sheep for free with the Golden Sheep placed", () => {
    const sheep = r.categories.animals.lines.find((l) => l.key === "Sheep")!;
    expect(sheep.cost).toBe(0);
    const noGolden = structuredClone(farm);
    delete noGolden.interior!.ground!.collectibles!["Golden Sheep"];
    const paid = new Engine(noGolden, rates, market).report().categories.animals.lines.find((l) => l.key === "Sheep")!;
    expect(paid.cost).toBeGreaterThan(5);
  });
  it("loses money on stone because of pickaxes", () => {
    const stone = r.categories.minerals.lines.find((l) => l.key === "Stone")!;
    expect(stone.net).toBeLessThan(0);
  });
});

describe("Scenarios", () => {
  const { results } = evaluate(farm, rates, market);
  const get = (id: string) => results.find((x) => x.option.id === id)!;
  it("Quarry makes stone pickaxes free (about +2.1 $ per day, Frugal Miner already cuts them 20 %)", () => {
    expect(usd(get("quarry").gainTotal)).toBeCloseTo(2.07, 1);
    expect(Object.keys(get("quarry").gain)).toEqual(["minerals"]);
  });
  it("Kuebiko frees seeds for crops and greenhouse", () => {
    const k = get("kuebiko");
    expect(usd(k.gainTotal)).toBeCloseTo(1.86, 1);
    expect(k.gain.crops).toBeGreaterThan(0);
    expect(k.gain.greenhouse).toBeGreaterThan(0);
  });
  it("finds no gain in sheep food savings when sheep eat for free", () => {
    expect(get("mermaid").gainTotal).toBeCloseTo(0, 6);
    expect(get("sheepwise").gainTotal).toBeLessThanOrEqual(0);
  });
  it("gives a payback time for paid options only", () => {
    expect(get("quarry").paybackDays).toBeGreaterThan(300);
    expect(get("sheepwise").cost).toBe(0);
    expect(get("sheepwise").paybackDays).toBeNull();
  });
});
