import { describe, expect, it } from "vitest";
import fixture from "../src/demo/fixture.json";
import { dailyRates, type Market } from "../src/core/engine";
import type { Farm } from "../src/core/farm";
import { analyseSkills, bestTree, pointsOf, SKILL_DEFS, totalLevel, unlockedTier, valueSkills } from "../src/core/skills";

const farm = fixture.farm as unknown as Farm;
const market = fixture.market as Market;
const { rates } = dailyRates(fixture.snapshots);

describe("skill points", () => {
  it("counts one point per level, ascension bands included", () => {
    expect(totalLevel(0, 0)).toBe(1);
    expect(totalLevel(94_333_905, 0)).toBe(150);
    expect(totalLevel(farm.bumpkin!.experience!, 2)).toBe(249);
  });
  it("prices a rank-up by the skill's tier", () => {
    // Restless Animals is tier 1 (1 point), two rank-ups at 1 point each.
    expect(pointsOf({ "Restless Animals": 3 })).toBe(3);
    // Rice Rocket is tier 2 (2 points), one rank-up at 3 points.
    expect(pointsOf({ "Rice Rocket": 2 })).toBe(5);
  });
  it("opens tiers with tier 1 spending", () => {
    expect(unlockedTier({}, "Crops")).toBe(1);
    const all = Object.fromEntries(SKILL_DEFS.filter((d) => d.tree === "Crops" && d.tier === 1).map((d) => [d.name, 1]));
    expect(unlockedTier(all, "Crops")).toBe(2);
    const t2 = SKILL_DEFS.find((d) => d.tree === "Crops" && d.tier === 2)!;
    expect(unlockedTier({ ...all, [t2.name]: 1 }, "Crops")).toBe(3);
  });
});

describe("skill tree", () => {
  const values = valueSkills(farm, rates, market);
  it("values speed and engine skills, leaves the rest at 0", () => {
    const by = (n: string) => values.find((v) => v.def.name === n)!;
    expect(by("Restless Animals").how).toBe("speed");
    expect(by("Restless Animals").value[2]).toBeGreaterThan(by("Restless Animals").value[0]);
    expect(by("Double Bale").how).toBe("engine");
    expect(values.filter((v) => v.how === "none").every((v) => v.value.every((x) => x === 0))).toBe(true);
  });
  it("never spends more than the budget and never buys a loss", () => {
    const plan = bestTree(values, 20);
    expect(plan.points).toBeLessThanOrEqual(20);
    expect(pointsOf(plan.ranks)).toBe(plan.points);
    expect(plan.value).toBeGreaterThan(0);
    for (const t of new Set(SKILL_DEFS.map((d) => d.tree))) {
      for (const [n, r] of Object.entries(plan.ranks)) {
        const d = SKILL_DEFS.find((x) => x.name === n)!;
        if (d.tree === t) expect(unlockedTier(plan.ranks, t)).toBeGreaterThanOrEqual(Math.min(3, r <= 1 ? d.tier : d.tier + r - 1));
      }
    }
  });
  it("spends the free points and proposes a better tree after a reset", () => {
    const a = analyseSkills(farm, rates, market);
    expect(a.earned).toBe(249);
    expect(a.used).toBe(225);
    expect(a.topUp.points).toBeLessThanOrEqual(a.earned);
    expect(a.topUp.value).toBeGreaterThan(a.current.value);
    expect(a.proposed.value).toBeGreaterThanOrEqual(a.topUp.value - 1e-9);
    // Stone loses money on this farm: the reset drops Speed Miner.
    expect(a.proposed.ranks["Speed Miner"] ?? 0).toBe(0);
    expect(a.reset.gems).toBe(200);
  });
});
