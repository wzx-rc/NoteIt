import { useMemo, useState } from "react";
import { dailyRates } from "../../core/engine";
import { buyDeals, sellDeals, type Deal } from "../../core/marketplace";
import type { AppState } from "../../shared/types";
import { Icon } from "../icons";
import { MONTH, fmt, nf, usd } from "../format";

const CAT_ICON: Record<string, string> = { crops: "wheat", greenhouse: "rice", minerals: "gold", animals: "sheep", wood: "pick" };
const CAT_NAME: Record<string, string> = { crops: "crops", greenhouse: "serre", minerals: "minerais", animals: "animaux", wood: "bois" };

/** Top NFTs to buy (gain per month for their price) and to sell (price against income lost). */
export function MarketView({ state }: { state: AppState }) {
  const farm = state.farm!, market = state.market!;
  const rate = market.flowerUsd;
  const { buy, sell } = useMemo(() => {
    const { rates } = dailyRates(state.snapshots);
    return { buy: buyDeals(farm, rates, market), sell: sellDeals(farm, rates, market) };
  }, [farm, market, state.snapshots]);
  const [moreBuy, setMoreBuy] = useState(false);
  const [sellMode, setSellMode] = useState<"free" | "weak">("free");
  const free = sell.filter((d) => d.perDay < 1e-6);
  const weak = sell.filter((d) => d.perDay >= 1e-6);
  const sellList = (sellMode === "free" ? free : weak).slice(0, 5);
  const buyList = buy.slice(0, moreBuy ? 12 : 5);
  const top5 = buy.slice(0, 5);

  return (
    <>
      <div className="kpis">
        <div className="kpi">
          <div className="l">Les 5 achats conseillés</div>
          <div className="v">{usd(top5.reduce((a, d) => a + d.price, 0) * rate)}</div>
          <div className="d">+{usd(top5.reduce((a, d) => a + d.perDay, 0) * MONTH * rate)} par mois</div>
        </div>
        <div className="kpi">
          <div className="l">Ventes sans perte de revenu</div>
          <div className="v gold">{usd(free.slice(0, 5).reduce((a, d) => a + d.price, 0) * rate)}</div>
          <div className="d dim">les 5 premières, taxe de 10 % déduite</div>
        </div>
        <div className="kpi">
          <div className="l">Cours du jour</div>
          <div className="v">{fmt(rate, 3)} $</div>
          <div className="d dim">pour 1 FLOWER, prix plancher du {new Date(market.date).toLocaleDateString("fr-FR")}</div>
        </div>
      </div>

      <div className="grid even">
        <section className="card" aria-labelledby="h-buy">
          <h2 id="h-buy">À acheter</h2>
          <p className="hint">Les NFT que tu n'as pas, classés par temps de remboursement. Gain calculé sur ta ferme, à ton rythme actuel.</p>
          <ul className="moves">
            {buyList.map((d, i) => <BuyRow key={d.name} d={d} rank={i + 1} rate={rate} />)}
            {buy.length === 0 ? <li className="empty">Rien d'intéressant à acheter pour l'instant.</li> : null}
          </ul>
          {buy.length > 5 ? <button className="btn ghost" onClick={() => setMoreBuy((v) => !v)}>{moreBuy ? "Voir moins" : `Voir les ${Math.min(12, buy.length)} premiers`}</button> : null}
        </section>

        <section className="card" aria-labelledby="h-sell">
          <h2 id="h-sell">À vendre</h2>
          <p className="hint">Parmi ce que tu possèdes. Prix plancher moins la taxe de 10 % du marketplace.</p>
          <div className="seg" role="group" aria-label="Type de vente">
            <button className="btn" aria-pressed={sellMode === "free"} onClick={() => setSellMode("free")}>Sans effet sur tes revenus</button>
            <button className="btn" aria-pressed={sellMode === "weak"} onClick={() => setSellMode("weak")}>Rapportent peu pour leur prix</button>
          </div>
          <ul className="moves">
            {sellList.map((d, i) => <SellRow key={d.name} d={d} rank={i + 1} rate={rate} />)}
            {sellList.length === 0 ? <li className="empty">Rien dans cette liste.</li> : null}
          </ul>
          {sellMode === "free" ? (
            <p className="foot">« Effet non chiffré » : l'objet donne autre chose que du revenu (XP, pêche, protection contre les maladies, déco). Vérifie qu'il ne te sert pas avant de vendre.</p>
          ) : (
            <p className="foot">Classés par nombre de jours de revenu perdu que la vente rembourse : plus c'est haut, plus la vente est intéressante.</p>
          )}
        </section>
      </div>
      <p className="foot">
        Les bonus de vitesse (Turbo Sprout, Farm Dog, Dream Scarf…) supposent que tu récoltes dès que c'est prêt. Frozen Heart ne compte que l'hiver, une semaine sur quatre.
        Seuls les NFT dont l'app sait calculer l'effet apparaissent à l'achat.
      </p>
    </>
  );
}

function BuyRow({ d, rank, rate }: { d: Deal; rank: number; rate: number }) {
  const months = d.price / (d.perDay * MONTH);
  return (
    <li className="move deal">
      <span className="chip rank" data-rank={rank}><Icon name={CAT_ICON[d.cat ?? ""] ?? "flower"} size={18} /></span>
      <span className="t">
        <b>{d.name}</b>
        <span>{d.note ?? (d.cat ? `bonus ${CAT_NAME[d.cat]}` : "")} · remboursé en {months < 24 ? `${fmt(months, 1)} mois` : `${fmt(months / 12, 1)} ans`}</span>
      </span>
      <span className="g">
        <b className="pos">+{usd(d.perDay * MONTH * rate)}<small>/mois</small></b>
        <span>{usd(d.price * rate)} · {nf(d.price)} F</span>
      </span>
      <span />
    </li>
  );
}

function SellRow({ d, rank, rate }: { d: Deal; rank: number; rate: number }) {
  return (
    <li className="move deal">
      <span className="chip rank" data-rank={rank}><Icon name={CAT_ICON[d.cat ?? ""] ?? "bag"} size={18} /></span>
      <span className="t">
        <b>{d.name}</b>
        <span>
          {d.spare ? "en double, le bonus reste"
            : d.perDay > 1e-6 ? `${d.note ?? `bonus ${CAT_NAME[d.cat ?? ""] ?? ""}`} · vaut ${fmt(d.price / (d.perDay * MONTH), 0)} mois de ce qu'il rapporte`
            : d.note ?? (d.unknownEffect ? "effet non chiffré" : "aucun effet sur tes revenus")}
        </span>
      </span>
      <span className="g">
        <b className="gold">{usd(d.price * rate)}</b>
        <span>{d.perDay > 1e-6 ? `−${usd(d.perDay * MONTH * rate)}/mois` : "0 $ perdu"}</span>
      </span>
      <span />
    </li>
  );
}
