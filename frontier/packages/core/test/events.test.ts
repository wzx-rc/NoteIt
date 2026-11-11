import { describe, expect, it } from "vitest";
import {
  BUILDINGS, CROPS, EXPANSION, RECIPES, RESOURCES, TOOLS, createInitialState, isBuilt, isExpanded, levelForXp,
  needsAid, processEvent, replay, type GameState, type TimedAction, type CropName, type ItemName,
} from "../src";

const T0 = 1_800_000_000_000;
const sec = (n: number) => n * 1000;

describe("processEvent", () => {
  it("plante puis récolte une fois le minuteur écoulé", () => {
    let s = createInitialState(T0, 42);
    s = processEvent(s, { type: "crop.planted", bedId: "1", crop: "spore", createdAt: T0 });
    expect(s.inventory["graine-spore"]).toBe(3);
    expect(() => processEvent(s, { type: "crop.harvested", bedId: "1", createdAt: T0 + sec(59) })).toThrow("Pas encore prêt");
    s = processEvent(s, { type: "crop.harvested", bedId: "1", createdAt: T0 + sec(60) });
    expect(s.inventory.spore).toBe(1);
    expect(s.xp).toBe(CROPS.spore.xp);
  });

  it("ne modifie pas l'état d'origine", () => {
    const s = createInitialState(T0, 1);
    processEvent(s, { type: "crop.planted", bedId: "1", crop: "spore", createdAt: T0 });
    expect(s.beds["1"].crop).toBeUndefined();
  });

  it("refuse les bacs et gisements de l'extension tant qu'elle n'est pas faite", () => {
    const s = createInitialState(T0, 1);
    expect(() => processEvent(s, { type: "crop.planted", bedId: "4", crop: "spore", createdAt: T0 })).toThrow("verrouillé");
    expect(() => processEvent(s, { type: "node.mined", nodeId: "6", createdAt: T0 })).toThrow("verrouillé");
  });

  it("consomme une charge par forage et attend la repousse", () => {
    let s = createInitialState(T0, 7);
    s = processEvent(s, { type: "node.mined", nodeId: "1", createdAt: T0 });
    expect(s.inventory.charge).toBe(5);
    expect(s.inventory.ferrite).toBeGreaterThanOrEqual(2);
    expect(() => processEvent(s, { type: "node.mined", nodeId: "1", createdAt: T0 + sec(10) })).toThrow("se reforme");
    s = processEvent(s, { type: "node.mined", nodeId: "1", createdAt: T0 + sec(RESOURCES.ferrite.respawnSeconds) });
    expect(s.inventory.charge).toBe(4);
  });

  it("refuse ce que le niveau ne permet pas", () => {
    const s = createInitialState(T0, 1);
    expect(() => processEvent(s, { type: "seed.bought", item: "graine-algue", amount: 1, createdAt: T0 })).toThrow("Niveau 2");
    expect(() => processEvent(s, { type: "building.constructed", building: "raffinerie", createdAt: T0 })).toThrow("Niveau 2");
  });

  it("refuse les quantités trichées", () => {
    const s = createInitialState(T0, 1);
    for (const amount of [0, -5, 1.5, 1e9]) expect(() => processEvent(s, { type: "tool.bought", item: "charge", amount, createdAt: T0 })).toThrow("Quantité");
    expect(() => processEvent(s, { type: "item.sold", item: "spore", amount: 1, createdAt: T0 })).toThrow();
  });

  it("produit les mêmes commandes et tirages au rejeu (client = serveur)", () => {
    const a = createInitialState(T0, 99), b = createInitialState(T0, 99);
    expect(a.orders).toEqual(b.orders);
    const acts: TimedAction[] = [{ type: "node.mined", nodeId: "1", createdAt: T0 }, { type: "node.mined", nodeId: "2", createdAt: T0 + 5 }];
    const ra = replay(a, acts), rb = replay(b, acts);
    expect(ra.ok && rb.ok && ra.state.inventory).toEqual(rb.ok && rb.state.inventory);
  });

  it("rejeu : indique la première action refusée", () => {
    const r = replay(createInitialState(T0, 1), [
      { type: "crop.planted", bedId: "1", crop: "spore", createdAt: T0 },
      { type: "crop.harvested", bedId: "1", createdAt: T0 + 1000 },
    ]);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.index).toBe(1);
  });

  it("aide de départ seulement si le joueur est bloqué", () => {
    const s = createInitialState(T0, 1);
    expect(needsAid(s)).toBe(false);
    const broke: GameState = { ...s, credits: 0, inventory: {} };
    expect(needsAid(broke)).toBe(true);
    const after = processEvent(broke, { type: "aid.claimed", createdAt: T0 });
    expect(after.inventory.charge).toBe(2);
  });
});

/** Joueur automatique qui n'utilise que processEvent : prouve que les niveaux 1 à 5 sont atteignables avec les règles du serveur. */
describe("partie complète", () => {
  it("atteint le niveau 5 avec extension, tourelle et raid repoussé", () => {
    let s = createInitialState(T0, 2024);
    let now = T0;
    const log: TimedAction[] = [];
    const tryDo = (a: Omit<TimedAction, "createdAt"> & Record<string, unknown>) => {
      const act = { ...a, createdAt: now } as TimedAction;
      try { s = processEvent(s, act); log.push(act); return true; } catch { return false; }
    };
    const inv = (k: ItemName) => s.inventory[k] ?? 0;
    for (let step = 0; step < 6 * 60 * 6 && !(levelForXp(s.xp) >= 5 && (s.stats.raid ?? 0) >= 1); step++) {
      now += sec(10);
      const L = levelForXp(s.xp);
      if (s.raid.nextAt && now >= s.raid.nextAt) tryDo({ type: "raid.resolved" });
      for (const id of Object.keys(s.beds)) tryDo({ type: "crop.harvested", bedId: id });
      const crop: CropName = L >= 4 && s.credits > 150 ? "quartz" : L >= 2 && (s.stats.harvest_algue ?? 0) < 6 ? "algue" : "spore";
      for (const [id, b] of Object.entries(s.beds)) {
        if (b.crop) continue;
        if (!inv(`graine-${crop}`)) tryDo({ type: "seed.bought", item: `graine-${crop}`, amount: 1 });
        tryDo({ type: "crop.planted", bedId: id, crop });
      }
      for (const [id, n] of Object.entries(s.nodes)) {
        while (inv("charge") < RESOURCES[n.kind].charges && s.credits >= TOOLS.charge.price) if (!tryDo({ type: "tool.bought", item: "charge", amount: 1 })) break;
        tryDo({ type: "node.mined", nodeId: id });
      }
      tryDo({ type: "building.constructed", building: "raffinerie" });
      if (!isExpanded(s, now)) tryDo({ type: "land.expanded" });
      tryDo({ type: "building.constructed", building: "tourelle" });
      tryDo({ type: "recipe.collected" });
      const want = (["cellule", "alliage", "ration"] as const).find(k =>
        (k === "cellule" ? inv("cellule") < 3 : k === "alliage" ? inv("alliage") < 7 : inv("ration") < 2) &&
        Object.entries(RECIPES[k].ingredients).every(([i, n]) => inv(i as ItemName) >= (n ?? 0)));
      if (want) tryDo({ type: "recipe.started", recipe: want });
      for (const o of [...s.orders]) tryDo({ type: "order.delivered", orderId: o.id });
      const keep = s.credits < 12 ? 0 : 10;
      for (const k of ["spore", "algue", "quartz"] as const) if (inv(k) > keep) tryDo({ type: "item.sold", item: k, amount: inv(k) - keep });
      if (inv("ferrite") > 25) tryDo({ type: "item.sold", item: "ferrite", amount: inv("ferrite") - 25 });
      if (step % 30 === 0 && s.orders[0]) tryDo({ type: "order.skipped", orderId: s.orders[0].id });
      tryDo({ type: "aid.claimed" });
    }
    expect(levelForXp(s.xp)).toBe(5);
    expect(isExpanded(s, now)).toBe(true);
    expect(isBuilt(s, "tourelle", now)).toBe(true);
    expect(s.stats.raid ?? 0).toBeGreaterThanOrEqual(1);
    expect(s.halo).toBeGreaterThan(0);
    // le serveur, en rejouant le journal depuis zéro, arrive exactement au même état
    const r = replay(createInitialState(T0, 2024), log);
    expect(r.ok).toBe(true);
    expect(r.state).toEqual(s);
    console.log(`niveau 5 en ${Math.round((now - T0) / 60000)} min de jeu, ${log.length} actions, ${s.halo} $HALO, ${s.credits} crédits`);
    void BUILDINGS; void EXPANSION;
  });
});
