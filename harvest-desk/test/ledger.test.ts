import { describe, expect, it } from "vitest";
import fixture from "../src/demo/fixture.json";
import { diffMeta, ledgerFromMetas, thinMetas, type FarmMeta } from "../src/core/ledger";

const meta = (p: Partial<FarmMeta>): FarmMeta => ({
  at: 0, usd: 0.1, balance: 100, withdrawn: 0, soldCount: 0, items: {}, flowerOrders: {}, delivered: {}, ...p,
});

describe("diffMeta", () => {
  it("splits a withdrawal, a FLOWER delivery and a purchase", () => {
    const a = meta({ flowerOrders: { o1: { npc: "guria", sfl: 1.5 } }, delivered: { guria: 3 } });
    const b = meta({ at: 1, balance: 100 - 50 + 1.5 - 20, withdrawn: 50, delivered: { guria: 4 }, items: { "Farm Dog": 1 } });
    const e = diffMeta(a, b);
    expect(e.map((x) => [x.kind, x.flower])).toEqual([["withdraw", -50], ["delivery", 1.5], ["purchase", -20]]);
    expect(e[2].detail).toBe("Farm Dog");
    expect(e[2].usd).toBeCloseTo(-2);
  });
  it("calls a rise a sale when the sold count moved", () => {
    expect(diffMeta(meta({}), meta({ at: 1, balance: 130, soldCount: 1 }))[0].kind).toBe("sale");
  });
  it("ignores dust", () => {
    expect(diffMeta(meta({}), meta({ at: 1, balance: 100.001 }))).toEqual([]);
  });
});

describe("ledgerFromMetas on the example farm", () => {
  const l = ledgerFromMetas(fixture.metas as FarmMeta[]);
  it("finds the Farm Dog purchase", () => {
    const dog = l.find((e) => e.detail?.includes("Farm Dog"))!;
    expect(dog.kind).toBe("purchase");
    expect(dog.flower!).toBeLessThan(-1500);
  });
  it("adds up to the balance change", () => {
    const m = fixture.metas as FarmMeta[];
    const sum = l.reduce((a, e) => a + (e.flower ?? 0), 0);
    expect(sum).toBeCloseTo(m[m.length - 1].balance - m[0].balance, 6);
  });
});

describe("thinMetas", () => {
  it("keeps one reading per hour", () => {
    const h = 3_600_000;
    const t = thinMetas([meta({ at: 10 }), meta({ at: 20 }), meta({ at: h + 5 })], 2 * h);
    expect(t.map((m) => m.at)).toEqual([20, h + 5]);
  });
});
