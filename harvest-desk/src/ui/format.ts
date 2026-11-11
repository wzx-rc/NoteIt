/** French number formats used across the app. */
export const fmt = (v: number, d = 2) => v.toFixed(d).replace(".", ",").replace("-", "−");
export const nf = (v: number) => Math.round(v).toLocaleString("fr-FR").replace("-", "−");
export const signed = (v: number, d = 2) => (v < 0 ? "−" : "+") + fmt(Math.abs(v), d);
export const usd = (v: number) => (Math.abs(v) >= 100 ? nf(v) : fmt(v)) + " $";

const FR: Record<string, string> = {
  Wheat: "blé", Kale: "kale", Barley: "orge", Rice: "riz", Grape: "raisin", Olive: "olive",
  Sunflower: "tournesol", Potato: "pomme de terre", Pumpkin: "citrouille", Carrot: "carotte",
  Cabbage: "chou", Soybean: "soja", Beetroot: "betterave", Cauliflower: "chou-fleur",
  Parsnip: "panais", Eggplant: "aubergine", Corn: "maïs", Radish: "radis", Onion: "oignon",
  Turnip: "navet", Yam: "igname", Rhubarb: "rhubarbe", Zucchini: "courgette", Broccoli: "brocoli",
  Pepper: "poivron", Artichoke: "artichaut", Tomato: "tomate", Lemon: "citron",
};
/** French name of a crop, falling back to the game's English name. */
export const frCrop = (name: string) => FR[name] ?? name;

export const MONTH = 30.4;
