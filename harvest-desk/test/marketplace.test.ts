import { describe, expect, it } from "vitest";
import fixture from "../src/demo/fixture.json";
import { dailyRates, Engine, type Market } from "../src/core/engine";
import type { Farm } from "../src/core/farm";
import { buyDeals, MARKET_TAX, sellDeals, without } from "../src/core/marketplace";

const farm = fixture.farm as unknown as Farm;
const market = fixture.market as Market;
const { rates } = dailyRates(fixture.snapshots);

describe("buyDeals", () => {
  const buy = buyDeals(farm, rates, market);
  it("only lists NFTs the farm lacks, with a gain", () => {
    expect(buy.length).toBeGreaterThan(3);
    expect(buy.every((d) => d.perDay > 0 && d.price > 0)).toBe(true);
    expect(buy.find((d) => d.name === "Golden Sheep")).toBeUndefined();
  });
  it("ranks by payback and keeps Quarry's gain", () => {
    const pay = buy.map((d) => d.price / d.perDay);
    expect([...pay].sort((a, b) => a - b)).toEqual(pay);
    expect(buy.find((d) => d.name === "Quarry")!.perDay * market.flowerUsd).toBeCloseTo(2.07, 1);
  });
});

describe("sellDeals", () => {
  const sell = sellDeals(farm, rates, market);
  it("takes the marketplace tax off the price", () => {
    const n = sell.find((d) => d.name === "Nancy")!;
    expect(n.price).toBeCloseTo(market.nftFloors.Nancy * (1 - MARKET_TAX));
    expect(n.perDay).toBe(0);
  });
  it("puts items with no income effect first, then the weakest earners", () => {
    const firstPaid = sell.findIndex((d) => d.perDay > 0);
    expect(sell.slice(0, firstPaid).every((d) => d.perDay === 0)).toBe(true);
    expect(sell.find((d) => d.name === "Golden Sheep")!.perDay).toBeGreaterThan(10);
  });
  it("counts Turbo Sprout as half the greenhouse", () => {
    const gh = new Engine(farm, rates, market).report().categories.greenhouse.net;
    expect(sell.find((d) => d.name === "Turbo Sprout")!.perDay).toBeCloseTo(gh / 2);
  });
});

describe("without", () => {
  it("removes a placed NFT without touching the original", () => {
    const f = without(farm, "Golden Sheep");
    expect(f.interior?.ground?.collectibles?.["Golden Sheep"]).toBeUndefined();
    expect(farm.interior?.ground?.collectibles?.["Golden Sheep"]).toBeDefined();
  });
});

describe("Tin Turtle", () => {
  const tt = sellDeals(farm, rates, market).find((d) => d.name === "Tin Turtle")!;
  it("counts the stone from the 8 rocks around it", () => {
    expect(tt.unknownEffect).toBe(false);
    expect(tt.perDay).toBeGreaterThan(0.1);
    expect(tt.perDay).toBeLessThan(0.5);
  });
});
