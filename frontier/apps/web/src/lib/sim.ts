/**
 * Serveur et blockchain SIMULÉS dans le navigateur.
 *
 * L'architecture est celle de Sunflower Land : le client envoie des lots d'actions
 * horodatées, le « serveur » les rejoue avec le même moteur (`@frontier/core`) et
 * garde le seul état qui fait foi. Ici ce serveur vit dans le localStorage ; le
 * remplacer par une vraie API ne touche que ce fichier.
 *
 * La « chaîne » simule un wallet, le NFT de colonie et le token $HALO (ERC-20),
 * avec les frais de retrait et le brûlage au dépôt prévus dans l'étude.
 */
import { CLOCK_SKEW_MS, WITHDRAW, createInitialState, replay, withdrawFee, type GameState, type TimedAction } from "@frontier/core";
import { now } from "./clock";

const SERVER_KEY = "frontier:server";
const CHAIN_KEY = "frontier:chain";
const LATENCY = 250;

export interface ChainTx { hash: string; kind: "mint" | "withdraw" | "deposit"; amount: number; fee: number; at: number }
export interface Wallet { address: string; halo: number; colonyId: number | null; txs: ChainTx[] }
interface ServerRecord { colonyId: number; state: GameState; lastEventAt: number; withdrawNonce: number }

const wait = (ms = LATENCY) => new Promise(r => setTimeout(r, ms));
const hex = (n: number) => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, "0")).join("");
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Copie en mémoire : le jeu reste jouable si le stockage du navigateur est bloqué. */
const memory = new Map<string, string>();
function read<T>(k: string): T | null {
  let v: string | null = null;
  try { v = localStorage.getItem(k); } catch { /* stockage indisponible */ }
  v ??= memory.get(k) ?? null;
  return v ? (JSON.parse(v) as T) : null;
}
function write(k: string, v: unknown) {
  const s = JSON.stringify(v);
  memory.set(k, s);
  try { localStorage.setItem(k, s); } catch { /* quota ou mode privé */ }
}

export class SaveRejected extends Error {
  constructor(message: string, readonly state: GameState) { super(message); }
}

export const sim = {
  wallet(): Wallet | null { return read<Wallet>(CHAIN_KEY); },

  async connectWallet(): Promise<Wallet> {
    await wait(600);
    const w = read<Wallet>(CHAIN_KEY) ?? { address: `0x${hex(20)}`, halo: 0, colonyId: null, txs: [] };
    write(CHAIN_KEY, w);
    return w;
  },

  /** Crée le NFT de colonie (simulé) puis la sauvegarde côté serveur. */
  async mintColony(): Promise<{ wallet: Wallet; state: GameState }> {
    await wait(1200);
    const w = read<Wallet>(CHAIN_KEY);
    if (!w) throw new Error("Wallet non connecté");
    const colonyId = w.colonyId ?? 1000 + Math.floor(Math.random() * 9000);
    w.colonyId = colonyId;
    w.txs.unshift({ hash: `0x${hex(32)}`, kind: "mint", amount: 0, fee: 0, at: now() });
    write(CHAIN_KEY, w);
    const t = now();
    const rec: ServerRecord = { colonyId, state: createInitialState(t, crypto.getRandomValues(new Uint32Array(1))[0]), lastEventAt: t, withdrawNonce: 0 };
    write(SERVER_KEY, rec);
    return { wallet: w, state: rec.state };
  },

  async loadSession(): Promise<{ wallet: Wallet | null; state: GameState | null }> {
    await wait();
    const rec = read<ServerRecord>(SERVER_KEY);
    return { wallet: read<Wallet>(CHAIN_KEY), state: rec?.state ?? null };
  },

  /** Rejoue un lot d'actions. Refuse tout le lot si une seule action est invalide. */
  async autosave(actions: TimedAction[]): Promise<GameState> {
    await wait();
    const rec = read<ServerRecord>(SERVER_KEY);
    if (!rec) throw new Error("Aucune colonie");
    const serverNow = now();
    let last = rec.lastEventAt;
    for (const a of actions) {
      if (a.createdAt < last) throw new SaveRejected("Actions dans le désordre", rec.state);
      if (a.createdAt > serverNow + CLOCK_SKEW_MS) throw new SaveRejected("Action datée du futur", rec.state);
      last = a.createdAt;
    }
    const r = replay(rec.state, actions);
    if (!r.ok) throw new SaveRejected(`Action refusée (${actions[r.index].type}) : ${r.error}`, rec.state);
    rec.state = r.state;
    rec.lastEventAt = last;
    write(SERVER_KEY, rec);
    return r.state;
  },

  /** Retrait : le serveur débite le jeu et signe un bon ; la chaîne crée les $HALO moins les frais. */
  async withdraw(amount: number): Promise<{ wallet: Wallet; state: GameState; tx: ChainTx }> {
    await wait(900);
    const rec = read<ServerRecord>(SERVER_KEY), w = read<Wallet>(CHAIN_KEY);
    if (!rec || !w) throw new Error("Aucune colonie");
    amount = round2(amount);
    if (!(amount >= WITHDRAW.minHalo)) throw new Error(`Minimum ${WITHDRAW.minHalo} $HALO`);
    if (amount > rec.state.halo) throw new Error("Solde en jeu insuffisant");
    rec.state = { ...rec.state, halo: round2(rec.state.halo - amount) };
    rec.withdrawNonce += 1;
    const fee = withdrawFee(amount);
    const tx: ChainTx = { hash: `0x${hex(32)}`, kind: "withdraw", amount: round2(amount - fee), fee, at: now() };
    w.halo = round2(w.halo + amount - fee);
    w.txs.unshift(tx);
    write(SERVER_KEY, rec); write(CHAIN_KEY, w);
    return { wallet: w, state: rec.state, tx };
  },

  /** Dépôt : la moitié est brûlée, l'autre va au trésor ; le joueur reçoit tout le montant en jeu. */
  async deposit(amount: number): Promise<{ wallet: Wallet; state: GameState; tx: ChainTx }> {
    await wait(900);
    const rec = read<ServerRecord>(SERVER_KEY), w = read<Wallet>(CHAIN_KEY);
    if (!rec || !w) throw new Error("Aucune colonie");
    amount = round2(amount);
    if (!(amount > 0)) throw new Error("Montant invalide");
    if (amount > w.halo) throw new Error("Solde du wallet insuffisant");
    w.halo = round2(w.halo - amount);
    const tx: ChainTx = { hash: `0x${hex(32)}`, kind: "deposit", amount, fee: round2(amount / 2), at: now() };
    w.txs.unshift(tx);
    rec.state = { ...rec.state, halo: round2(rec.state.halo + amount) };
    write(SERVER_KEY, rec); write(CHAIN_KEY, w);
    return { wallet: w, state: rec.state, tx };
  },

  reset() {
    memory.clear();
    try { localStorage.removeItem(SERVER_KEY); localStorage.removeItem(CHAIN_KEY); } catch { /* ignore */ }
  },
};
