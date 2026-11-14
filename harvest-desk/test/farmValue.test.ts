import { describe, expect, it } from "vitest";
import fixture from "../src/demo/fixture.json";
import { farmValue } from "../src/core/farmValue";
import type { Farm } from "../src/core/farm";
import type { Market } from "../src/core/engine";

const farm = fixture.farm as unknown as Farm;
const market = fixture.market as Market;

describe("farmValue", () => {
  const v = farmValue(farm, market);
  it("adds every group into the total and keeps coins out of the sale value", () => {
    const sum = v.groups.reduce((a, g) => a + g.total, 0);
    expect(v.total).toBeCloseTo(sum, 6);
    const coins = v.groups.find((g) => g.key === "coins")!.total;
    const balance = Number(farm.balance ?? 0);
    expect(v.netIfSold).toBeCloseTo((v.total - coins - balance) * 0.9 + balance, 6);
  });
  it("prices a placed NFT at its floor", () => {
    const beaver = v.groups.find((g) => g.key === "nfts")!.items.find((i) => i.name === "Foreman Beaver")!;
    expect(beaver.unit).toBe(market.nftFloors["Foreman Beaver"]);
    expect(beaver.source).toBe("floor");
  });
  it("prices an unlisted Bud at the cheapest Bud on sale, ignoring old bids", () => {
    const m: Market = { ...market, buds: { "7": { offer: 1, sale: 2 }, "8": { floor: 1700 }, "9": { floor: 2500 } } };
    const f = { ...farm, buds: { "7": { type: "Cave", aura: "No Aura" } } } as Farm;
    const bud = farmValue(f, m).groups.find((g) => g.key === "buds")!.items[0];
    expect(bud).toMatchObject({ unit: 1700, source: "collection" });
  });
});
