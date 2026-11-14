import { Engine, Market, Rates, Report, CategoryKey } from "./engine";
import { Extra, Farm, FarmView } from "./farm";

export interface Option {
  id: string;
  name: string;
  /** Label for narrow rows; defaults to name. */
  short?: string;
  /** Short line under the name. */
  effect: string;
  /** Icon key (see ui/icons.ts). */
  icon: string;
  /** NFT whose floor price is the cost; none for a free change. */
  nft?: string;
  /** Price paid in something else than FLOWER (chapter tickets), shown as is. */
  price?: string;
  /** Growth time multiplier on whole categories, valued on measured income (collect as soon as ready). */
  speed?: { m: number; cats: CategoryKey[] };
  extra: Extra;
  /** Hidden when the farm already has it. */
  owned: (f: FarmView) => boolean;
}

export const OPTIONS: Option[] = [
  { id: "quarry", name: "Quarry", effect: "Plus de pioche pour miner la pierre", icon: "quarry", nft: "Quarry",
    extra: { collectibles: ["Quarry"] }, owned: (f) => f.has("Quarry") },
  { id: "kuebiko", name: "Kuebiko", effect: "Toutes les graines gratuites, riz compris", icon: "kuebiko", nft: "Kuebiko",
    extra: { collectibles: ["Kuebiko"] }, owned: (f) => f.has("Kuebiko") },
  { id: "hoot", name: "Hoot", effect: "+0,5 sur blé, kale, orge et riz", icon: "hoot", nft: "Hoot",
    extra: { collectibles: ["Hoot"] }, owned: (f) => f.has("Hoot") },
  { id: "sheepwise", name: "Skill Sheepwise Diet", short: "Sheepwise", effect: "À la place de Cow-Smart Nutrition", icon: "lightning",
    extra: { skills: { "Sheepwise Diet": 1 }, removeSkills: ["Cow-Smart Nutrition"] },
    owned: (f) => f.skill("Sheepwise Diet") > 0 || f.skill("Cow-Smart Nutrition") === 0 },
  { id: "mermaid", name: "Mermaid Sheep", short: "Mermaid", effect: "−5 % de nourriture pour les moutons", icon: "mermaid", nft: "Mermaid Sheep",
    extra: { collectibles: ["Mermaid Sheep"] }, owned: (f) => f.has("Mermaid Sheep") },
  { id: "duende", name: "Duende Hat", short: "Duende", effect: "−10 % de pousse, crops et fruits", icon: "wheat",
    price: "9 000 Duende Cap", extra: { wearables: ["Duende Hat"] }, speed: { m: 0.9, cats: ["crops"] },
    owned: (f) => f.wears("Duende Hat") || f.owns("Duende Hat") },
  { id: "armor", name: "Crimstone Armor", short: "Armor", effect: "+0,1 par minage de crimstone", icon: "crim", nft: "Crimstone Armor",
    extra: { wearables: ["Crimstone Armor"] }, owned: (f) => f.wears("Crimstone Armor") },
];

export interface OptionResult {
  option: Option;
  /** FLOWER per day gained, per category. */
  gain: Partial<Record<CategoryKey, number>>;
  gainTotal: number;
  /** FLOWER, 0 for free changes. */
  cost: number;
  paybackDays: number | null;
}

export function mergeExtras(list: Extra[]): Extra {
  return {
    collectibles: list.flatMap((e) => e.collectibles ?? []),
    wearables: list.flatMap((e) => e.wearables ?? []),
    skills: Object.assign({}, ...list.map((e) => e.skills ?? {})),
    removeSkills: list.flatMap((e) => e.removeSkills ?? []),
  };
}

export function evaluate(farm: Farm, rates: Rates, market: Market) {
  const base = new Engine(farm, rates, market).report();
  const view = new FarmView(farm);
  const results: OptionResult[] = OPTIONS.filter((o) => !o.owned(view)).map((option) => {
    const r = withSpeed(new Engine(farm, rates, market, option.extra).report(), [option]);
    const gain: OptionResult["gain"] = {};
    (Object.keys(base.categories) as CategoryKey[]).forEach((k) => {
      const d = r.categories[k].net - base.categories[k].net;
      if (Math.abs(d) > 1e-6) gain[k] = d;
    });
    const gainTotal = r.net - base.net;
    const cost = option.nft ? market.nftFloors[option.nft] ?? 0 : 0;
    return { option, gain, gainTotal, cost, paybackDays: cost && gainTotal > 0 ? cost / gainTotal : null };
  });
  return { base, results };
}

/** Report with several options switched on at once. */
export function combined(farm: Farm, rates: Rates, market: Market, options: Option[]): Report {
  return withSpeed(new Engine(farm, rates, market, mergeExtras(options.map((o) => o.extra))).report(), options);
}

/** Applies growth speed options: the measured income of their categories grows with 1 / multiplier. */
export function withSpeed(r: Report, options: Option[]): Report {
  const f: Partial<Record<CategoryKey, number>> = {};
  for (const o of options) for (const c of o.speed?.cats ?? []) f[c] = (f[c] ?? 1) / o.speed!.m;
  if (!Object.keys(f).length) return r;
  const categories = { ...r.categories };
  for (const [k, x] of Object.entries(f) as [CategoryKey, number][]) {
    const c = categories[k];
    categories[k] = { ...c, gross: c.gross * x, cost: c.cost * x, net: c.net * x, lines: c.lines.map((l) => ({ ...l, gross: l.gross * x, cost: l.cost * x, net: l.net * x })) };
  }
  const cats = Object.values(categories);
  return { categories, net: cats.reduce((a, c) => a + c.net, 0), gross: cats.reduce((a, c) => a + c.gross, 0), cost: cats.reduce((a, c) => a + c.cost, 0) };
}
