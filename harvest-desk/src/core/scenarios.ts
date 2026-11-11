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
    const r = new Engine(farm, rates, market, option.extra).report();
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
  return new Engine(farm, rates, market, mergeExtras(options.map((o) => o.extra))).report();
}
