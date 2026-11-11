import { useCallback, useEffect, useRef, useState } from "react";
import { useActorRef, useSelector } from "@xstate/react";
import {
  CROPS, LEVEL_XP, MAX_LEVEL, RESOURCES, isBuilt, levelForXp, needsAid,
  type CropName, type GameAction, type GameState, type ItemName, type TimedAction,
} from "@frontier/core";
import { gameMachine } from "./machine/gameMachine";
import { PhaserGame } from "./game/PhaserGame";
import { bridge, type Target } from "./game/ColonyScene";
import { ASSET_URL } from "./game/assets";
import { now, resetClock, skip } from "./lib/clock";
import { sim } from "./lib/sim";
import { Icon, fmtNum, fmtTime, label } from "./ui/kit";
import { GOALS, UNLOCKS } from "./ui/goals";
import {
  BuildDialog, ExpansionDialog, HqDialog, InventoryDialog, LevelUpDialog, OrdersDialog, RefineryDialog, ShopDialog, WalletDialog,
  type DialogName,
} from "./ui/Dialogs";

type Toast = { id: number; text: string; tone?: string };
type Selected = `graine-${CropName}` | "charge";

export default function App() {
  const actor = useActorRef(gameMachine);
  const phase = useSelector(actor, s => (s.matches("game") ? "game" : s.matches("connect") ? "connect" : s.matches("mint") ? "mint" : s.matches("rejected") ? "rejected" : s.matches("error") ? "error" : "loading"));
  const busy = useSelector(actor, s => s.matches({ connect: "connecting" }) || s.matches({ mint: "minting" }));
  const saving = useSelector(actor, s => s.matches({ game: "autosaving" }));
  const transacting = useSelector(actor, s => s.matches({ game: "transacting" }));
  const state = useSelector(actor, s => s.context.state);
  const wallet = useSelector(actor, s => s.context.wallet);
  const pending = useSelector(actor, s => s.context.pending.length);
  const error = useSelector(actor, s => s.context.error);

  const [dialog, setDialog] = useState<DialogName | null>(null);
  const [levelUp, setLevelUp] = useState<number | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [sel, setSel] = useState<Selected>("graine-spore");
  const [, setTick] = useState(0);
  const stateRef = useRef(state); stateRef.current = state;
  const selRef = useRef(sel); selRef.current = sel;

  const toast = useCallback((text: string, tone?: string) => {
    if (!text) return;
    const id = Math.random();
    setToasts(t => [...t.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 2600);
  }, []);

  useEffect(() => {
    const subs = [
      actor.on("toast", e => toast(e.text, e.tone)),
      actor.on("levelUp", e => setLevelUp(e.level)),
      actor.on("applied", e => feedback(e.action, e.before, e.after)),
    ];
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => { subs.forEach(s => s.unsubscribe()); clearInterval(id); };
  }, [actor, toast]);

  /** Petits retours visuels sur la carte après une action acceptée. */
  function feedback(a: TimedAction, before: GameState, after: GameState) {
    const diff = (k: ItemName) => (after.inventory[k] ?? 0) - (before.inventory[k] ?? 0);
    if (a.type === "crop.harvested") { const c = before.beds[a.bedId].crop!.name; bridge.emit("float", { target: `bed:${a.bedId}`, text: `+1 ${CROPS[c].label}` }); }
    if (a.type === "node.mined") { const k = before.nodes[a.nodeId].kind; bridge.emit("float", { target: `node:${a.nodeId}`, text: `+${diff(k)} ${RESOURCES[k].label}`, color: k === "xenon" ? "#5fd4e0" : "#f0a648" }); }
    if (a.type === "order.delivered") { const o = before.orders.find(x => x.id === a.orderId)!; toast(o.reward.halo ? `Livraison faite : +${fmtNum(o.reward.halo)} $HALO` : `Livraison faite : +${o.reward.credits} crédits`, o.reward.halo ? "halo" : "good"); }
    if (a.type === "recipe.collected") bridge.emit("float", { target: "place:raffinerie", text: `+1 ${label(before.crafting!.item)}`, color: "#f0a648" });
    if (a.type === "raid.resolved") {
      if ((after.stats.raid ?? 0) > (before.stats.raid ?? 0)) { bridge.emit("boom"); toast("Raid repoussé par la tourelle : +15 crédits", "good"); }
      else toast(diff("ferrite") < 0 ? `Les drones ont volé ${-diff("ferrite")} ferrite. Construis la tourelle !` : "Les drones repartent sans butin.", "bad");
    }
  }

  const play = useCallback((action: GameAction) => actor.send({ type: "PLAY", action }), [actor]);

  /** Clic sur la carte : comme dans SFL, l'objet sélectionné décide de l'action. */
  const onClick = useCallback((t: Target) => {
    const s = stateRef.current;
    if (!s) return;
    const tn = now();
    if (t.kind === "bed") {
      const bed = s.beds[t.id];
      if (bed.crop) {
        const left = bed.crop.plantedAt + CROPS[bed.crop.name].seconds * 1000 - tn;
        if (left > 0) return toast(`${CROPS[bed.crop.name].label} : prêt dans ${fmtTime(left)}`);
        return play({ type: "crop.harvested", bedId: t.id });
      }
      const seed = selRef.current;
      if (!seed.startsWith("graine-")) return toast("Choisis une graine dans la barre du bas.");
      if (!(s.inventory[seed] ?? 0)) { setDialog("shop"); return toast(`Plus de ${label(seed).toLowerCase()} : achètes-en au comptoir.`); }
      return play({ type: "crop.planted", bedId: t.id, crop: seed.slice(7) as CropName });
    }
    if (t.kind === "node") {
      const n = s.nodes[t.id], cfg = RESOURCES[n.kind];
      const left = n.minedAt ? n.minedAt + cfg.respawnSeconds * 1000 - tn : 0;
      if (left > 0) return toast(`Le gisement se reforme : ${fmtTime(left)}`);
      if ((s.inventory.charge ?? 0) < cfg.charges) { setSel("charge"); setDialog("shop"); return toast(`Il faut ${cfg.charges} charge${cfg.charges > 1 ? "s" : ""} de forage.`); }
      return play({ type: "node.mined", nodeId: t.id });
    }
    const L = levelForXp(s.xp);
    switch (t.id) {
      case "shop": return setDialog("shop");
      case "npc": return setDialog("orders");
      case "hq": return setDialog("hq");
      case "greenhouse": return toast("Les bacs de la serre sont juste en dessous.");
      case "zone":
        if (s.expansion.readyAt) return toast(`Extension en cours : ${fmtTime(s.expansion.readyAt - tn)}`);
        return L >= 3 ? setDialog("expansion") : toast("L'extension se débloque au niveau 3.");
      case "raffinerie": {
        const b = s.buildings.raffinerie;
        if (b && b.readyAt > tn) return toast(`Chantier : ${fmtTime(b.readyAt - tn)}`);
        if (isBuilt(s, "raffinerie", tn)) {
          if (s.crafting && tn >= s.crafting.readyAt) return play({ type: "recipe.collected" });
          return setDialog("refinery");
        }
        return L >= 2 ? setDialog("raffinerie") : toast("La raffinerie se débloque au niveau 2.");
      }
      case "tourelle": {
        const b = s.buildings.tourelle;
        if (b && b.readyAt > tn) return toast(`Chantier : ${fmtTime(b.readyAt - tn)}`);
        return L >= 4 ? setDialog("tourelle") : toast("La tourelle se débloque au niveau 4.");
      }
    }
  }, [play, toast]);

  // Aide automatique si le joueur est bloqué
  useEffect(() => { if (state && needsAid(state)) { play({ type: "aid.claimed" }); toast("Aide du Consortium : 3 graines et 2 charges offertes.", "good"); } }, [state, play, toast]);


  if (phase !== "game" || !state) {
    return (
      <div className="splash">
        <div className="card frame">
          <img className="hero" src={ASSET_URL.hq} alt="" />
          <h1>FRONTIER</h1>
          <p className="sub">Colonie minière de la ceinture d'Halcyon</p>
          {phase === "loading" && <p><span className="spin" />Chargement…</p>}
          {phase === "connect" && <>
            <p>Connecte un wallet pour retrouver ta colonie. <span className="sim">SIMULÉ</span></p>
            <button className="btn primary" disabled={busy} onClick={() => actor.send({ type: "CONNECT" })}>{busy && <span className="spin" />}Connecter le wallet</button>
          </>}
          {phase === "mint" && <>
            <p>Wallet {wallet?.address.slice(0, 6)}…{wallet?.address.slice(-4)} connecté. Crée ta colonie : un NFT qui porte ta sauvegarde. <span className="sim">SIMULÉ</span></p>
            <button className="btn primary" disabled={busy} onClick={() => actor.send({ type: "MINT" })}>{busy && <span className="spin" />}{busy ? "Transaction en cours…" : "Créer ma colonie"}</button>
          </>}
          {phase === "rejected" && <>
            <p>Le serveur a refusé la dernière sauvegarde : {error}. La colonie est rechargée depuis le dernier état validé.</p>
            <button className="btn primary" onClick={() => actor.send({ type: "RETRY" })}>Reprendre</button>
          </>}
          {phase === "error" && <><p>Erreur : {error}</p><button className="btn" onClick={() => actor.send({ type: "RETRY" })}>Réessayer</button></>}
        </div>
      </div>
    );
  }

  const L = levelForXp(state.xp);
  const a = LEVEL_XP[L - 1], b = LEVEL_XP[L] ?? state.xp;
  const pct = L >= MAX_LEVEL ? 100 : Math.round(((state.xp - a) / (b - a)) * 100);
  const slots: Selected[] = (["graine-spore", "graine-algue", "graine-quartz", "charge"] as Selected[])
    .filter(k => k === "charge" || (state.inventory[k] ?? 0) > 0 || CROPS[k.slice(7) as CropName].level <= L);
  const withdrawn = wallet?.txs.filter(t => t.kind === "withdraw").length ?? 0;
  const goalVal = (k: string) => (k === "withdraw" ? withdrawn : state.stats[k] ?? 0);
  const close = () => setDialog(null);
  const P = { s: state, play, close };

  return (
    <div>
      <PhaserGame state={state} onClick={onClick} />

      <div className="hud-top">
        <div className="chip level" title={`${state.xp} XP`}>
          <span className="badge">{L}</span>
          <div className="xp"><div className="track"><div className="fill" style={{ width: `${pct}%` }} /></div><small>{L >= MAX_LEVEL ? `${state.xp} XP` : `${state.xp}/${b} XP`}</small></div>
        </div>
        <div className="chip" title="Crédits (monnaie du jeu)"><Icon k="credit" size={22} />{fmtNum(state.credits)}</div>
        <button className="chip halo btn" title="$HALO gagnés en jeu" onClick={() => setDialog("wallet")}><Icon k="halo" size={22} />{fmtNum(state.halo)} $HALO</button>
        <button className="chip btn" onClick={() => setDialog("inventory")}>Inventaire</button>
        <span className="spacer" />
        <span className={`save ${saving || pending ? "busy" : ""}`}>{saving ? "Sauvegarde…" : pending ? `${pending} action${pending > 1 ? "s" : ""} à sauver` : "Sauvegardé"}</span>
        <button className="chip btn" onClick={() => setDialog("wallet")} title="Wallet simulé"><span className="mono">{wallet?.address.slice(0, 6)}…{wallet?.address.slice(-4)}</span></button>
      </div>

      <Goals level={L} val={goalVal} xpNext={L < MAX_LEVEL ? LEVEL_XP[L] : null} />

      <div className="hint">
        {sel === "charge" ? "Charge de forage : touche un gisement pour forer." : `${label(sel)} : touche un bac vide pour planter.`}
      </div>
      <div className="toolbar frame">
        {slots.map(k => (
          <button key={k} className={`slot ${sel === k ? "sel" : ""}`} title={label(k)} onClick={() => setSel(k)} aria-pressed={sel === k}>
            <Icon k={k} /><b>{state.inventory[k] ?? 0}</b>
          </button>
        ))}
      </div>

      <div className="dev" aria-label="Outils de test">
        <button onClick={() => skip(60_000)} title="Avance l'horloge du jeu d'une minute">+1 min</button>
        <button onClick={() => skip(600_000)} title="Avance l'horloge du jeu de dix minutes">+10 min</button>
        <ResetButton />
      </div>

      <div className="toasts" aria-live="polite">{toasts.map(t => <div key={t.id} className={`toast ${t.tone ?? ""}`}>{t.text}</div>)}</div>

      {dialog === "shop" && <ShopDialog {...P} />}
      {dialog === "refinery" && <RefineryDialog {...P} />}
      {dialog === "orders" && <OrdersDialog {...P} />}
      {dialog === "inventory" && <InventoryDialog s={state} close={close} />}
      {dialog === "hq" && <HqDialog s={state} close={close} wallet={wallet} />}
      {dialog === "expansion" && <ExpansionDialog {...P} />}
      {(dialog === "raffinerie" || dialog === "tourelle") && <BuildDialog {...P} b={dialog} />}
      {dialog === "wallet" && wallet && <WalletDialog s={state} close={close} wallet={wallet} busy={transacting}
        onWithdraw={n => actor.send({ type: "WITHDRAW", amount: n })} onDeposit={n => actor.send({ type: "DEPOSIT", amount: n })} />}
      {levelUp && !dialog && <LevelUpDialog level={levelUp} close={() => setLevelUp(null)} />}
    </div>
  );
}

function ResetButton() {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const id = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(id); }, [armed]);
  return armed
    ? <button onClick={() => { sim.reset(); resetClock(); location.reload(); }} style={{ color: "var(--bad)", borderColor: "var(--bad)" }}>Tout effacer ?</button>
    : <button onClick={() => setArmed(true)}>Recommencer</button>;
}

function Goals({ level, val, xpNext }: { level: number; val: (k: string) => number; xpNext: number | null }) {
  const [open, setOpen] = useState(() => window.innerWidth > 760);
  const list = GOALS[level];
  return (
    <aside className={`goals frame ${open ? "" : "collapsed"}`}>
      <h3>{level >= MAX_LEVEL ? "Niveau 5 atteint" : `Objectifs niveau ${level}`}<button className="link" onClick={() => setOpen(o => !o)}>{open ? "Réduire" : "Ouvrir"}</button></h3>
      <ul>
        {list.map(([t, k, n]) => {
          const v = Math.min(n, val(k));
          return <li key={k} className={v >= n ? "done" : ""}><span className="ck" /><span>{t}</span><span className="n">{v}/{n}</span></li>;
        })}
      </ul>
      <p className="unlock">{xpNext ? `Niveau ${level + 1} à ${xpNext} XP : ${UNLOCKS[level + 1]}` : UNLOCKS[5]}</p>
    </aside>
  );
}

