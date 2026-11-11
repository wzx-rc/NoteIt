import { useState } from "react";
import {
  BUILDINGS, CROPS, EXPANSION, LEVEL_XP, RECIPES, SELLABLE, TOOLS, WITHDRAW, isBuilt, levelForXp, withdrawFee,
  type BuildingName, type CraftName, type CropName, type GameAction, type GameState, type ItemName,
} from "@frontier/core";
import { ASSET_URL } from "../game/assets";
import { now } from "../lib/clock";
import { ICONS } from "../lib/icons";
import type { ChainTx, Wallet } from "../lib/sim";
import { Icon, Modal, Need, fmtNum, fmtTime, hasAll, label } from "./kit";
import { UNLOCKS } from "./goals";

export type DialogName = "shop" | "refinery" | "orders" | "inventory" | "wallet" | "hq" | "expansion" | BuildingName;
interface P { s: GameState; play: (a: GameAction) => void; close: () => void }

export function ShopDialog({ s, play, close }: P) {
  const [tab, setTab] = useState<"buy" | "sell">("buy");
  const L = levelForXp(s.xp);
  const buy: Array<{ item: `graine-${CropName}` | "charge"; price: number; level: number }> = [
    ...(Object.keys(CROPS) as CropName[]).map(c => ({ item: `graine-${c}` as const, price: CROPS[c].seedPrice, level: CROPS[c].level })),
    { item: "charge", price: TOOLS.charge.price, level: TOOLS.charge.level },
  ];
  const buyAct = (item: string, amount: number): GameAction => item === "charge" ? { type: "tool.bought", item: "charge", amount } : { type: "seed.bought", item: item as `graine-${CropName}`, amount };
  return (
    <Modal title="Comptoir" icon={ASSET_URL.capsule} onClose={close}>
      <div className="tabs">
        <button className={`tab ${tab === "buy" ? "on" : ""}`} onClick={() => setTab("buy")}>Acheter</button>
        <button className={`tab ${tab === "sell" ? "on" : ""}`} onClick={() => setTab("sell")}>Vendre</button>
      </div>
      <div className="rows">
        {tab === "buy" ? buy.map(b => (
          <div className="row" key={b.item}>
            <Icon k={b.item} />
            <div><b>{label(b.item)}</b><small>{b.level > L ? `Niveau ${b.level} requis` : `${b.price} cr · tu en as ${s.inventory[b.item] ?? 0}`}</small></div>
            <div className="acts">
              {[1, 5].map(n => <button key={n} className="btn" disabled={b.level > L || s.credits < b.price * n} onClick={() => play(buyAct(b.item, n))}>×{n}</button>)}
            </div>
          </div>
        )) : (Object.entries(SELLABLE) as Array<[ItemName, number]>).map(([k, price]) => {
          const n = s.inventory[k] ?? 0;
          return (
            <div className="row" key={k}>
              <Icon k={k} />
              <div><b>{label(k)}</b><small>{price} cr pièce · tu en as {n}</small></div>
              <div className="acts">
                <button className="btn" disabled={n < 1} onClick={() => play({ type: "item.sold", item: k, amount: 1 })}>×1</button>
                <button className="btn" disabled={n < 1} onClick={() => play({ type: "item.sold", item: k, amount: n })}>Tout</button>
              </div>
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

export function RefineryDialog({ s, play, close }: P) {
  const t = now(), L = levelForXp(s.xp), c = s.crafting;
  return (
    <Modal title="Raffinerie" icon={ASSET_URL.extractor} onClose={close}>
      <p>Une recette à la fois, avec un temps de préparation.</p>
      <div className="rows">
        {c && (
          <div className="row">
            <Icon k={c.item} />
            <div><b>{RECIPES[c.item].label}</b><small>{t >= c.readyAt ? "Prêt à récupérer" : `En cours : ${fmtTime(c.readyAt - t)}`}</small></div>
            <button className="btn primary" disabled={t < c.readyAt} onClick={() => play({ type: "recipe.collected" })}>Récupérer</button>
          </div>
        )}
        {(Object.entries(RECIPES) as Array<[CraftName, (typeof RECIPES)[CraftName]]>).map(([k, r]) => (
          <div className="row" key={k}>
            <Icon k={k} />
            <div><b>{r.label}</b><small>{r.level > L ? `Niveau ${r.level} requis` : `${fmtTime(r.seconds * 1000)} · +${r.xp} XP`}</small><Need s={s} need={r.ingredients} /></div>
            <button className="btn" disabled={r.level > L || !!c || !hasAll(s, r.ingredients)} onClick={() => play({ type: "recipe.started", recipe: k })}>Lancer</button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function OrdersDialog({ s, play, close }: P) {
  return (
    <Modal title="Livraisons" icon={ICONS.credit} onClose={close}>
      <p>Les colons commandent des produits et paient en crédits ou en $HALO. Une commande remplie est remplacée.</p>
      <div className="rows">
        {s.orders.map(o => (
          <div className="order" key={o.id}>
            <div className="who"><b>{o.from}</b><span className={`reward ${o.reward.halo ? "halo" : ""}`}>{o.reward.halo ? `+${fmtNum(o.reward.halo)} $HALO` : `+${o.reward.credits} cr`} · +{o.xp} XP</span></div>
            <Need s={s} need={o.items} />
            <div className="acts">
              <button className={`btn ${o.reward.halo ? "halo" : "primary"}`} disabled={!hasAll(s, o.items)} onClick={() => play({ type: "order.delivered", orderId: o.id })}>Livrer</button>
              <button className="btn" onClick={() => play({ type: "order.skipped", orderId: o.id })}>Passer</button>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

export function BuildDialog({ s, play, close, b }: P & { b: BuildingName }) {
  const cfg = BUILDINGS[b], L = levelForXp(s.xp), t = now();
  const busy = Object.values(s.buildings).some(x => x && x.readyAt > t);
  if (isBuilt(s, b, t) && b === "tourelle") return (
    <Modal title={cfg.label} icon={ICONS.ferrite} onClose={close}>
      <p>La tourelle repousse les raids de drones : +15 crédits et +20 XP à chaque raid.</p>
      <p>{s.raid.nextAt ? `Prochain raid dans ${fmtTime(s.raid.nextAt - t)}.` : "Aucun raid prévu."}</p>
    </Modal>
  );
  return (
    <Modal title={cfg.label} icon={ASSET_URL.construction} onClose={close}>
      <p>{b === "raffinerie" ? "Transforme ferrite, spores et xénon en produits demandés par les livraisons." : "Protège la colonie : sans elle, les drones volent ta ferrite."}</p>
      <Need s={s} need={cfg.ingredients} credits={cfg.credits} />
      <p>Chantier : {fmtTime(cfg.seconds * 1000)} · +{cfg.xp} XP{cfg.level > L ? ` · niveau ${cfg.level} requis` : ""}{busy ? " · un autre chantier est en cours" : ""}</p>
      <button className="btn primary" disabled={cfg.level > L || busy || !!s.buildings[b] || !hasAll(s, cfg.ingredients, cfg.credits)} onClick={() => { play({ type: "building.constructed", building: b }); close(); }}>Construire</button>
    </Modal>
  );
}

export function ExpansionDialog({ s, play, close }: P) {
  const L = levelForXp(s.xp);
  return (
    <Modal title="Extension de la colonie" icon={ASSET_URL.construction} onClose={close}>
      <p>De nouvelles cases avec 3 bacs, 2 gisements de ferrite et un geyser de xénon.</p>
      <Need s={s} need={EXPANSION.ingredients} credits={EXPANSION.credits} />
      <p>Durée : {fmtTime(EXPANSION.seconds * 1000)} · +{EXPANSION.xp} XP{EXPANSION.level > L ? ` · niveau ${EXPANSION.level} requis` : ""}</p>
      <button className="btn primary" disabled={EXPANSION.level > L || s.expansion.readyAt !== undefined || !hasAll(s, EXPANSION.ingredients, EXPANSION.credits)} onClick={() => { play({ type: "land.expanded" }); close(); }}>Étendre la colonie</button>
    </Modal>
  );
}

export function InventoryDialog({ s, close }: Omit<P, "play">) {
  const items = Object.entries(s.inventory).filter(([, n]) => (n ?? 0) > 0);
  return (
    <Modal title="Inventaire" onClose={close}>
      <div className="rows">
        {items.length ? items.map(([k, n]) => (
          <div className="row" key={k}><Icon k={k} /><div><b>{label(k)}</b></div><b>{n}</b></div>
        )) : <p>Inventaire vide.</p>}
      </div>
    </Modal>
  );
}

export function HqDialog({ s, close, wallet }: Omit<P, "play"> & { wallet: Wallet | null }) {
  const L = levelForXp(s.xp);
  return (
    <Modal title="Quartier général" icon={ASSET_URL.hq} onClose={close}>
      <div className="kv">
        <span>Colonie</span><span>#{wallet?.colonyId}</span>
        <span>Niveau</span><span>{L} ({s.xp} XP{L < 5 ? `, prochain à ${LEVEL_XP[L]}` : ""})</span>
        <span>Livraisons</span><span>{s.stats.deliver ?? 0}</span>
        <span>Récoltes</span><span>{(s.stats.harvest_spore ?? 0) + (s.stats.harvest_algue ?? 0) + (s.stats.harvest_quartz ?? 0)}</span>
        <span>Forages</span><span>{(s.stats.mine_ferrite ?? 0) + (s.stats.mine_xenon ?? 0)}</span>
        <span>Raids repoussés</span><span>{s.stats.raid ?? 0}</span>
      </div>
    </Modal>
  );
}

export function WalletDialog({ s, close, wallet, busy, onWithdraw, onDeposit }: Omit<P, "play"> & { wallet: Wallet; busy: boolean; onWithdraw: (n: number) => void; onDeposit: (n: number) => void }) {
  const [w, setW] = useState(String(Math.floor(s.halo)));
  const [d, setD] = useState("");
  const wn = Number(w.replace(",", ".")), dn = Number(d.replace(",", "."));
  const kind = (t: ChainTx) => (t.kind === "mint" ? "NFT colonie créé" : t.kind === "withdraw" ? "Retrait" : "Dépôt");
  return (
    <Modal title="Wallet" icon={ICONS.halo} onClose={close}>
      <p><span className="sim">SIMULÉ</span> Aucune vraie blockchain : ce wallet, le NFT et le token sont simulés dans ton navigateur, avec les mêmes règles que les futurs contrats sur Base.</p>
      <div className="kv">
        <span>Adresse</span><span className="mono">{wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}</span>
        <span>NFT colonie</span><span>#{wallet.colonyId}</span>
        <span>$HALO dans le jeu</span><span>{fmtNum(s.halo)}</span>
        <span>$HALO sur le wallet</span><span>{fmtNum(wallet.halo)}</span>
      </div>
      <p><b>Retirer vers le wallet</b> · frais de {WITHDRAW.feeBps / 100} % brûlés, minimum {WITHDRAW.minHalo} $HALO.</p>
      <div className="field">
        <input inputMode="decimal" value={w} onChange={e => setW(e.target.value)} aria-label="Montant à retirer" />
        <button className="btn halo" disabled={busy || !(wn >= WITHDRAW.minHalo) || wn > s.halo} onClick={() => onWithdraw(wn)}>{busy ? <span className="spin" /> : null}Retirer</button>
        {wn > 0 && <small style={{ color: "var(--muted)" }}>tu reçois {fmtNum(wn - withdrawFee(wn))}</small>}
      </div>
      <p><b>Déposer dans le jeu</b> · la moitié est brûlée, l'autre va au trésor ; tu reçois tout le montant en jeu.</p>
      <div className="field">
        <input inputMode="decimal" value={d} onChange={e => setD(e.target.value)} placeholder="0" aria-label="Montant à déposer" />
        <button className="btn" disabled={busy || !(dn > 0) || dn > wallet.halo} onClick={() => onDeposit(dn)}>Déposer</button>
      </div>
      {wallet.txs.length > 0 && <>
        <p><b>Transactions</b></p>
        <div className="rows">
          {wallet.txs.slice(0, 6).map(t => (
            <div className="tx" key={t.hash}><span>{kind(t)}</span><span className="mono">{t.hash.slice(0, 14)}…</span><span>{t.kind === "mint" ? "" : `${t.kind === "withdraw" ? "+" : "−"}${fmtNum(t.amount)}`}</span></div>
          ))}
        </div>
      </>}
    </Modal>
  );
}

export function LevelUpDialog({ level, close }: { level: number; close: () => void }) {
  return (
    <Modal title={`Niveau ${level} !`} icon={ASSET_URL.hq} onClose={close}>
      <p>Débloqué : {UNLOCKS[level]}</p>
      <button className="btn primary" onClick={close}>Continuer</button>
    </Modal>
  );
}
