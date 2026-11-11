import {
  BUILDINGS, CROPS, EXPANSION, ORDER_SLOTS, RAID, RECIPES, RESOURCES, SELLABLE, STARTER_AID, TOOLS,
  levelForXp, type BuildingName, type CraftName, type CropName, type ItemName, type SeedName, type ToolName,
} from "./config";
import { generateOrder } from "./orders";
import { nextRandom } from "./rng";
import { count, isBuilt, isExpanded, type GameState } from "./state";

/**
 * Toutes les actions qu'un joueur peut faire. Comme dans Sunflower Land, le client
 * n'envoie jamais un état mais une liste d'actions horodatées ; le serveur les
 * rejoue avec la même fonction `processEvent` et refuse la sauvegarde si une
 * action est impossible.
 */
export type GameAction =
  | { type: "seed.bought"; item: SeedName; amount: number }
  | { type: "tool.bought"; item: ToolName; amount: number }
  | { type: "item.sold"; item: ItemName; amount: number }
  | { type: "crop.planted"; bedId: string; crop: CropName }
  | { type: "crop.harvested"; bedId: string }
  | { type: "node.mined"; nodeId: string }
  | { type: "building.constructed"; building: BuildingName }
  | { type: "recipe.started"; recipe: CraftName }
  | { type: "recipe.collected" }
  | { type: "order.delivered"; orderId: string }
  | { type: "order.skipped"; orderId: string }
  | { type: "land.expanded" }
  | { type: "raid.resolved" }
  | { type: "aid.claimed" };

export type TimedAction = GameAction & { createdAt: number };

export class GameError extends Error {
  constructor(message: string) { super(message); this.name = "GameError"; }
}

const fail = (m: string): never => { throw new GameError(m); };
const isPosInt = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0 && n <= 1000;
const round2 = (n: number) => Math.round(n * 100) / 100;

function add(s: GameState, item: ItemName, n: number) {
  const v = count(s, item) + n;
  if (v < 0) fail(`Pas assez de ${item}`);
  if (v === 0) delete s.inventory[item]; else s.inventory[item] = v;
}
function spendCredits(s: GameState, n: number) {
  if (s.credits < n) fail("Pas assez de crédits");
  s.credits = round2(s.credits - n);
}
function payIngredients(s: GameState, ing: Partial<Record<ItemName, number>>) {
  for (const [k, n] of Object.entries(ing)) if (count(s, k as ItemName) < (n ?? 0)) fail(`Il manque ${k}`);
  for (const [k, n] of Object.entries(ing)) add(s, k as ItemName, -(n ?? 0));
}
function stat(s: GameState, k: string, n = 1) { s.stats[k] = (s.stats[k] ?? 0) + n; }
function requireLevel(s: GameState, lvl: number) { if (levelForXp(s.xp) < lvl) fail(`Niveau ${lvl} requis`); }

function gainXp(s: GameState, n: number, now: number) {
  const before = levelForXp(s.xp);
  s.xp += n;
  const after = levelForXp(s.xp);
  if (after >= RAID.level && before < RAID.level && s.raid.nextAt === undefined) s.raid.nextAt = now + RAID.firstDelaySeconds * 1000;
}
function refillOrders(s: GameState) { while (s.orders.length < ORDER_SLOTS) s.orders.push(generateOrder(s)); }

/** Applique une action. Ne modifie pas l'état reçu : renvoie un nouvel état ou lève une GameError. */
export function processEvent(state: GameState, action: TimedAction): GameState {
  const s: GameState = structuredClone(state);
  const now = action.createdAt;
  if (typeof now !== "number" || !Number.isFinite(now)) fail("Horodatage invalide");

  switch (action.type) {
    case "seed.bought": {
      const crop = String(action.item).replace("graine-", "") as CropName;
      const cfg = CROPS[crop];
      if (!cfg || action.item !== `graine-${crop}`) fail("Graine inconnue");
      if (!isPosInt(action.amount)) fail("Quantité invalide");
      requireLevel(s, cfg.level);
      spendCredits(s, cfg.seedPrice * action.amount);
      add(s, action.item, action.amount);
      break;
    }
    case "tool.bought": {
      const cfg = TOOLS[action.item];
      if (!cfg) fail("Outil inconnu");
      if (!isPosInt(action.amount)) fail("Quantité invalide");
      requireLevel(s, cfg.level);
      spendCredits(s, cfg.price * action.amount);
      add(s, action.item, action.amount);
      break;
    }
    case "item.sold": {
      const price = SELLABLE[action.item];
      if (price === undefined) return fail("Objet invendable");
      if (!isPosInt(action.amount)) fail("Quantité invalide");
      add(s, action.item, -action.amount);
      s.credits = round2(s.credits + price * action.amount);
      stat(s, "sell");
      break;
    }
    case "crop.planted": {
      const bed = s.beds[action.bedId];
      const cfg = CROPS[action.crop];
      if (!bed) fail("Bac inconnu");
      if (!cfg) fail("Culture inconnue");
      if (bed.expansion && !isExpanded(s, now)) fail("Bac verrouillé");
      if (bed.crop) fail("Bac déjà planté");
      requireLevel(s, cfg.level);
      add(s, `graine-${action.crop}`, -1);
      bed.crop = { name: action.crop, plantedAt: now };
      break;
    }
    case "crop.harvested": {
      const bed = s.beds[action.bedId];
      if (!bed?.crop) fail("Rien à récolter");
      const cfg = CROPS[bed!.crop!.name];
      if (now < bed!.crop!.plantedAt + cfg.seconds * 1000) fail("Pas encore prêt");
      add(s, bed!.crop!.name, 1);
      stat(s, `harvest_${bed!.crop!.name}`);
      delete bed!.crop;
      gainXp(s, cfg.xp, now);
      break;
    }
    case "node.mined": {
      const node = s.nodes[action.nodeId];
      if (!node) fail("Gisement inconnu");
      if (node.expansion && !isExpanded(s, now)) fail("Gisement verrouillé");
      const cfg = RESOURCES[node.kind];
      if (node.minedAt && now < node.minedAt + cfg.respawnSeconds * 1000) fail("Le gisement se reforme");
      add(s, "charge", -cfg.charges);
      const qty = node.kind === "xenon" ? 1 : 2 + (nextRandom(s) < 0.25 ? 1 : 0);
      add(s, node.kind, qty);
      node.minedAt = now;
      stat(s, `mine_${node.kind}`);
      gainXp(s, cfg.xp, now);
      break;
    }
    case "building.constructed": {
      const cfg = BUILDINGS[action.building];
      if (!cfg) fail("Bâtiment inconnu");
      if (s.buildings[action.building]) fail("Déjà construit");
      if (Object.values(s.buildings).some(b => b && b.readyAt > now)) fail("Un chantier est déjà en cours");
      requireLevel(s, cfg.level);
      spendCredits(s, cfg.credits);
      payIngredients(s, cfg.ingredients);
      s.buildings[action.building] = { readyAt: now + cfg.seconds * 1000 };
      stat(s, `build_${action.building}`);
      gainXp(s, cfg.xp, now);
      break;
    }
    case "recipe.started": {
      const cfg = RECIPES[action.recipe];
      if (!cfg) fail("Recette inconnue");
      if (!isBuilt(s, "raffinerie", now)) fail("Raffinerie non construite");
      if (s.crafting) fail("La raffinerie est occupée");
      requireLevel(s, cfg.level);
      payIngredients(s, cfg.ingredients);
      s.crafting = { item: action.recipe, readyAt: now + cfg.seconds * 1000 };
      break;
    }
    case "recipe.collected": {
      if (!s.crafting) fail("Rien en préparation");
      if (now < s.crafting!.readyAt) fail("Pas encore prêt");
      const item = s.crafting!.item;
      add(s, item, 1);
      delete s.crafting;
      stat(s, `craft_${item}`);
      gainXp(s, RECIPES[item].xp, now);
      break;
    }
    case "order.delivered": {
      const order = s.orders.find(o => o.id === action.orderId);
      if (!order) fail("Commande inconnue");
      payIngredients(s, order!.items);
      if (order!.reward.halo) s.halo = round2(s.halo + order!.reward.halo);
      if (order!.reward.credits) s.credits = round2(s.credits + order!.reward.credits);
      s.orders = s.orders.filter(o => o !== order);
      stat(s, "deliver");
      gainXp(s, order!.xp, now);
      refillOrders(s);
      break;
    }
    case "order.skipped": {
      if (!s.orders.some(o => o.id === action.orderId)) fail("Commande inconnue");
      s.orders = s.orders.filter(o => o.id !== action.orderId);
      refillOrders(s);
      break;
    }
    case "land.expanded": {
      if (s.expansion.readyAt !== undefined) fail("Extension déjà lancée");
      requireLevel(s, EXPANSION.level);
      spendCredits(s, EXPANSION.credits);
      payIngredients(s, EXPANSION.ingredients);
      s.expansion.readyAt = now + EXPANSION.seconds * 1000;
      stat(s, "expand");
      gainXp(s, EXPANSION.xp, now);
      break;
    }
    case "raid.resolved": {
      if (s.raid.nextAt === undefined || now < s.raid.nextAt) fail("Aucun raid en cours");
      if (isBuilt(s, "tourelle", s.raid.nextAt!)) {
        s.credits = round2(s.credits + RAID.rewardCredits);
        stat(s, "raid");
        gainXp(s, RAID.rewardXp, now);
      } else {
        const lost = Math.min(count(s, "ferrite"), RAID.ferriteStolen);
        if (lost) add(s, "ferrite", -lost);
        stat(s, "raid_lost");
      }
      s.raid.nextAt = now + RAID.intervalSeconds * 1000;
      break;
    }
    case "aid.claimed": {
      if (!needsAid(s)) fail("Aide indisponible");
      add(s, "graine-spore", STARTER_AID.seeds);
      add(s, "charge", STARTER_AID.charges);
      stat(s, "aid");
      break;
    }
    default:
      fail(`Action inconnue : ${(action as { type: string }).type}`);
  }
  return s;
}

/** Vrai si le joueur ne peut plus rien faire (aucun crédit, graine, charge, culture ni produit à vendre). */
export function needsAid(s: GameState): boolean {
  const worth = s.credits + Object.entries(SELLABLE).reduce((t, [k, p]) => t + count(s, k as ItemName) * (p ?? 0), 0);
  const seeds = (["graine-spore", "graine-algue", "graine-quartz"] as const).some(k => count(s, k) > 0);
  return worth < TOOLS.charge.price && !seeds && count(s, "charge") === 0 && !Object.values(s.beds).some(b => b.crop);
}

/** Rejoue une liste d'actions. Renvoie l'état final, ou l'index et le motif de la première action refusée. */
export function replay(state: GameState, actions: TimedAction[]): { ok: true; state: GameState } | { ok: false; index: number; error: string; state: GameState } {
  let s = state;
  for (let i = 0; i < actions.length; i++) {
    try { s = processEvent(s, actions[i]); }
    catch (e) { return { ok: false, index: i, error: e instanceof Error ? e.message : String(e), state: s }; }
  }
  return { ok: true, state: s };
}
