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
  it("earns about 11.7 $ per day (wood included, greenhouse without tier skills, oil counted)", () => {
    expect(usd(r.net)).toBeGreaterThan(11.4);
    expect(usd(r.net)).toBeLessThan(12);
    expect(usd(r.categories.wood.net)).toBeGreaterThan(1.8);
  });
  it("ranks animals, crops, minerals, then the greenhouse", () => {
    const c = r.categories;
    expect(c.animals.net).toBeGreaterThan(c.crops.net);
    expect(c.crops.net).toBeGreaterThan(c.minerals.net);
    expect(c.minerals.net).toBeGreaterThan(c.greenhouse.net);
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

describe("Crop yield rules from the game code", () => {
  const e = new Engine(farm, rates, market);
  it("gives Old Farmer and Acre Farm to plot crops only, not to greenhouse rice", () => {
    // Rice: 1 × 1.9 (Green Amulet) × 1.2 (Scarecrow) + 0.25 (wings), nothing from the advanced crop skills.
    expect(e.cropYield("Rice", false)).toBeCloseTo(2.53, 2);
    const noAcre = new Engine(farm, rates, market, { removeSkills: ["Acre Farm", "Old Farmer"] });
    expect(noAcre.greenhouseYield("Rice")).toBeCloseTo(e.greenhouseYield("Rice"), 6);
    expect(noAcre.cropYield("Wheat")).toBeLessThan(e.cropYield("Wheat") - 1.9);
  });
  it("counts Hoot on rice (32 h) but not on olives (44 h)", () => {
    const hoot = new Engine(farm, rates, market, { collectibles: ["Hoot"] });
    expect(hoot.cropYield("Rice", false) - e.cropYield("Rice", false)).toBeCloseTo(0.5, 6);
    expect(hoot.cropYield("Olive", false)).toBeCloseTo(e.cropYield("Olive", false), 6);
  });
  it("grows grapes with the fruit rules: no scarecrow or amulet multiplier", () => {
    // 1 + 0.25 (wings) + 0.4 (Greenhouse Gamble 2) + 0.1 (Glass Room 1)
    expect(e.greenhouseYield("Grape")).toBeCloseTo(1.75, 6);
  });
  it("adds Sprout Mix on every fertilised plot and Laurie on the 9 plots below her", () => {
    expect(e.fertilisedShare()).toBe(1);
    expect(e.aoeBonus("Laurie the Chuckle Crow", "Laurie's Gains")).toBeCloseTo((9 / 81) * 0.2, 6);
    expect(e.aoeBonus("Scary Mike", "Horror Mike")).toBeCloseTo((9 / 81) * 0.2, 6);
    expect(e.cropYield("Wheat") - e.cropYield("Wheat", false)).toBeCloseTo(0.3 + 0.2 + 0.2 / 9, 6);
  });
  it("prices oil from the drill and charges the greenhouse and the crop machine", () => {
    // (100 coins + 20 Wood + 9 Iron + 20 Wool) / (10 + 20/3 + 1 Oil Extraction)
    expect(e.oilPrice()).toBeCloseTo(0.1297, 3);
    expect(e.greenhouseOil("Rice")).toBe(1.5); // (4 − 1 Slick Saver) × 0.5 Rice Shirt
    expect(e.machineOilPerHour()).toBeCloseTo(1.4 * 0.6, 6);
    const oil = e.crops().lines.find((l) => l.key === "machine-oil")!;
    expect(oil.cost).toBeCloseTo(24 * 0.84 * e.oilPrice(), 6);
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
