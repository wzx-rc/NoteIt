import { describe, expect, it } from "vitest";
import { parseMarket } from "../src/core/market";

describe("parseMarket", () => {
  const json = {
    data: {
      flowerPrice: 0.145,
      reports: {
        "2026-11-09": { items: { "collectibles-210": { latestSale: 0.001 } } },
        "2026-11-10": {
          items: {
            "collectibles-210": { latestSale: 0.002, floor: 0.003 },
            "collectibles-602": { floor: 0.05 },
            "collectibles-2259": { floor: 6750 },
            "wearables-282": { floor: 112 },
          },
        },
      },
    },
  };
  const m = parseMarket(json);
  it("uses the latest report", () => expect(m.date).toBe("2026-11-10"));
  it("prefers the last sale, then the floor", () => {
    expect(m.prices.Wheat).toBe(0.002);
    expect(m.prices.Stone).toBe(0.05);
  });
  it("reads NFT floors for collectibles and wearables", () => {
    expect(m.nftFloors.Quarry).toBe(6750);
    expect(m.nftFloors["Crimstone Armor"]).toBe(112);
  });
  it("keeps the FLOWER price", () => expect(m.flowerUsd).toBe(0.145));
});
