import { useMemo, useState } from "react";
import { farmValue, type PriceSource, type ValueGroup, type ValueGroupKey } from "../../core/farmValue";
import type { AppState } from "../../shared/types";
import { Icon } from "../icons";
import { fmt, nf, usd } from "../format";

const LOOK: Record<ValueGroupKey, { icon: string; color: string }> = {
  nfts: { icon: "market", color: "var(--gold)" },
  wearables: { icon: "bag", color: "var(--fruit)" },
  buds: { icon: "flower", color: "var(--sheep)" },
  resources: { icon: "wood", color: "var(--wood)" },
  flower: { icon: "flower", color: "var(--honey)" },
  coins: { icon: "coins", color: "var(--dim)" },
};

const SOURCE: Record<PriceSource, string> = {
  floor: "plancher",
  collection: "plancher de la collection",
  sale: "dernière vente",
  bank: "taux de la banque",
  cash: "solde",
};

const qty = (q: number) => (Number.isInteger(q) ? nf(q) : fmt(q, q < 10 ? 2 : 0));

/** What the farm is worth today: every priced item, NFT and balance, at marketplace prices. */
export function FarmValueView({ state }: { state: AppState }) {
  const farm = state.farm!, market = state.market!;
  const v = useMemo(() => farmValue(farm, market), [farm, market]);
  const rate = market.flowerUsd;
  const nftTotal = v.groups.filter((g) => g.key === "nfts" || g.key === "wearables" || g.key === "buds").reduce((a, g) => a + g.total, 0);
  const shown = v.groups.filter((g) => g.total > 0);
  const max = Math.max(...shown.map((g) => g.total), 1);

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="l">Valeur de la ferme</div>
          <div className="v gold">{usd(v.total * rate)}</div>
          <div className="d dim">{nf(v.total)} FLOWER, au prix du marché du {new Date(market.date).toLocaleDateString("fr-FR")}</div>
        </div>
        <div className="kpi">
          <div className="l">Si tu vendais tout</div>
          <div className="v">{usd(v.netIfSold * rate)}</div>
          <div className="d dim">après la taxe de 10 % du marché, sans les coins</div>
        </div>
        <div className="kpi">
          <div className="l">Dont NFT</div>
          <div className="v">{usd(nftTotal * rate)}</div>
          <div className="d dim">{v.total ? Math.round((nftTotal / v.total) * 100) : 0} % de la valeur : collectibles, wearables, Buds</div>
        </div>
      </div>

      <section className="card stat" aria-labelledby="h-split">
        <h2 id="h-split">Répartition</h2>
        <p className="hint">Ce que pèse chaque famille dans la valeur totale.</p>
        <div className="bars wide">
          {shown.map((g) => (
            <div className="br" key={g.key}>
              <span className="lb"><Icon name={LOOK[g.key].icon} size={18} />{g.label}</span>
              <span className="tr"><b style={{ left: 0, width: `${(g.total / max) * 100}%`, background: LOOK[g.key].color }} /></span>
              <span className="n">{usd(g.total * rate)}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="grid even">
        {shown.filter((g) => g.key !== "flower" && g.key !== "coins").map((g) => <GroupCard key={g.key} g={g} rate={rate} />)}
      </div>

      <p className="foot">
        Collectibles et wearables au prix plancher, ou à la dernière vente quand aucun n'est en vente. Un Bud qui n'est pas en vente compte au plancher de tous les Buds.
        Ressources à la dernière vente : en vendre beaucoup d'un coup ferait baisser le prix. Coins au taux de la banque (320 pour 1 FLOWER), ils ne se revendent pas.
        La terre elle-même n'a pas de prix de marché.
      </p>
      {v.unpriced.length ? (
        <details className="foot">
          <summary>{v.unpriced.length} objets sans prix, comptés 0 (pas échangeables ou jamais vendus)</summary>
          <p>{v.unpriced.join(", ")}</p>
        </details>
      ) : null}
    </>
  );
}

function GroupCard({ g, rate }: { g: ValueGroup; rate: number }) {
  const [all, setAll] = useState(false);
  const list = all ? g.items : g.items.slice(0, 8);
  const id = `h-val-${g.key}`;
  return (
    <section className="card" aria-labelledby={id}>
      <h2 id={id}>{g.label} <small className="dim">{usd(g.total * rate)}</small></h2>
      <p className="hint">{g.items.length} objet{g.items.length > 1 ? "s" : ""} chiffré{g.items.length > 1 ? "s" : ""}, du plus cher au moins cher.</p>
      <ul className="moves">
        {list.map((i) => (
          <li className="move deal" key={i.name}>
            <span className="chip" style={{ color: LOOK[g.key].color }}><Icon name={LOOK[g.key].icon} size={18} /></span>
            <span className="t">
              <b>{i.name}</b>
              <span>{i.qty !== 1 ? `${qty(i.qty)} × ` : ""}{i.unit < 100 ? fmt(i.unit, i.unit < 1 ? 3 : 2) : nf(i.unit)} F · {SOURCE[i.source]}</span>
            </span>
            <span className="g"><b className="gold">{usd(i.value * rate)}</b><span>{qty(i.value)} F</span></span>
          </li>
        ))}
      </ul>
      {g.items.length > 8 ? <button className="btn" style={{ marginTop: 12 }} onClick={() => setAll((a) => !a)}>{all ? "Réduire" : `Tout voir (${g.items.length})`}</button> : null}
    </section>
  );
}
