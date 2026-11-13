import { type PurchaseRequest, validatePurchase } from "./rules";

/**
 * - "game"    : le Portal tourne dans Sunflower Land (iframe), tout est réel.
 * - "testnet" : ouvert hors du jeu avec un jeton du jeu de test ; les données
 *               sont lues sur l'API, mais les achats sont simulés.
 * - "mock"    : aucun jeton, ferme d'exemple en mémoire. Pour développer vite.
 */
export type PortalMode = "game" | "testnet" | "mock";

export type FarmSnapshot = {
  farmId: number;
  username?: string;
  /** Solde FLOWER. */
  balance: number;
  inventory: Record<string, number>;
  /** Données brutes renvoyées par l'API (GameState complet), absentes en mock. */
  raw?: unknown;
};

export type PortalConfig = {
  /** Nom du Portal, tel qu'enregistré par l'équipe SFL (ex. "pet-demo"). */
  portalId: string;
  /** API par défaut si l'URL ne précise pas ?network= (dev = api-dev). */
  apiUrl?: string;
  /** Jeu à utiliser pour obtenir un jeton (testnet par défaut). */
  gameUrl?: string;
  /** Ferme d'exemple pour le mode simulé. */
  mockFarm?: Partial<FarmSnapshot>;
};

export type PortalLogEntry = {
  at: number;
  kind: "info" | "purchase" | "event" | "error";
  message: string;
};

const DEV_API = "https://api-dev.sunflower-land.com";
const MAIN_API = "https://api.sunflower-land.com";
const TESTNET_GAME = "https://sunflower-land.com/testnet";

const DEFAULT_MOCK: FarmSnapshot = {
  farmId: 1,
  username: "ferme-de-test",
  balance: 50,
  inventory: {
    Sunflower: 500, Potato: 200, Carrot: 120, Wheat: 80, Kale: 40,
    Apple: 30, Wood: 300, Stone: 120, Iron: 40, Gold: 10, Egg: 60, Honey: 5,
  },
};

const params = () => new URLSearchParams(window.location.search);

export const isInGame = () => window.self !== window.top;

export function getJwt(): string {
  return params().get("jwt") ?? "";
}

/** Le jeu passe ?network=mainnet (ou autre) à côté du jeton. */
export function resolveApiUrl(fallback = DEV_API): string {
  const network = params().get("network");
  if (network === "mainnet") return MAIN_API;
  if (network) return DEV_API;
  return fallback;
}

/** Lit le contenu d'un JWT sans le vérifier (la vérification est faite par l'API). */
export function decodeJwt(token: string): { farmId?: number; exp?: number } {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const data = JSON.parse(atob(payload));
    return { ...data, ...(data.properties ?? {}) };
  } catch {
    return {};
  }
}

function toNumber(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? 0));
  return Number.isFinite(n) ? n : 0;
}

export class Portal {
  readonly config: Required<Omit<PortalConfig, "mockFarm">> & {
    mockFarm: FarmSnapshot;
  };
  readonly jwt: string;
  readonly mode: PortalMode;
  farm: FarmSnapshot | null = null;
  log: PortalLogEntry[] = [];
  /** Augmente à chaque changement (pratique pour React). */
  version = 0;
  private listeners = new Set<() => void>();
  private pending: {
    req: PurchaseRequest;
    resolve: (ok: boolean) => void;
  } | null = null;

  constructor(config: PortalConfig) {
    this.config = {
      portalId: config.portalId,
      apiUrl: resolveApiUrl(config.apiUrl ?? DEV_API),
      gameUrl: config.gameUrl ?? TESTNET_GAME,
      mockFarm: { ...DEFAULT_MOCK, ...config.mockFarm },
    };
    this.jwt = getJwt();
    this.mode = isInGame() && this.jwt ? "game" : this.jwt ? "testnet" : "mock";
    window.addEventListener("message", this.onMessage);
  }

  /** S'abonner aux changements (ferme, journal). Renvoie la fonction de désabonnement. */
  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.version++;
    this.listeners.forEach((fn) => fn());
  }

  private note(kind: PortalLogEntry["kind"], message: string) {
    this.log = [...this.log.slice(-49), { at: Date.now(), kind, message }];
    this.emit();
  }

  /** Charge la ferme du joueur (API en game/testnet, ferme d'exemple en mock). */
  async load(): Promise<FarmSnapshot> {
    if (this.mode === "mock") {
      this.farm = structuredClone(this.config.mockFarm);
      this.note("info", "Mode simulé : ferme d'exemple chargée");
      return this.farm;
    }
    const url = `${this.config.apiUrl}/portal/${this.config.portalId}/player`;
    const res = await fetch(url, {
      headers: {
        "content-type": "application/json;charset=UTF-8",
        Authorization: `Bearer ${this.jwt}`,
      },
    });
    if (res.status >= 400) {
      this.note("error", `Chargement refusé (${res.status})`);
      throw new Error(`Portal login error (${res.status})`);
    }
    const { farm } = (await res.json()) as { farm: any };
    const inventory: Record<string, number> = {};
    for (const [k, v] of Object.entries(farm?.inventory ?? {})) {
      inventory[k] = toNumber(v);
    }
    this.farm = {
      farmId: decodeJwt(this.jwt).farmId ?? 0,
      username: farm?.username,
      balance: toNumber(farm?.balance),
      inventory,
      raw: farm,
    };
    this.note("info", `Ferme #${this.farm.farmId} chargée (${this.mode})`);
    return this.farm;
  }

  /**
   * Dépenser des FLOWER et/ou des ressources du joueur.
   * En jeu : le joueur voit une confirmation ; la promesse se résout quand il
   * a accepté (true). Hors jeu : achat simulé avec les mêmes règles.
   */
  purchase(req: PurchaseRequest): Promise<boolean> {
    const farm = this.farm;
    if (!farm) return Promise.reject(new Error("Appeler load() d'abord"));

    const error = validatePurchase(req, farm.balance, farm.inventory);
    if (error) {
      this.note("error", error);
      return Promise.resolve(false);
    }

    if (this.mode === "game") {
      return new Promise((resolve) => {
        this.pending = { req, resolve };
        window.parent.postMessage(
          { event: "purchase", sfl: req.sfl ?? 0, items: req.items ?? {} },
          "*",
        );
        this.note("event", `Achat demandé : ${describe(req)}`);
      });
    }

    this.applyPurchase(req);
    this.note("purchase", `Achat simulé : ${describe(req)}`);
    return Promise.resolve(true);
  }

  private applyPurchase(req: PurchaseRequest) {
    if (!this.farm) return;
    this.farm.balance -= req.sfl ?? 0;
    for (const [name, n = 0] of Object.entries(req.items ?? {})) {
      this.farm.inventory[name] = (this.farm.inventory[name] ?? 0) - n;
    }
    this.emit();
  }

  private onMessage = (e: MessageEvent) => {
    const data = e.data;
    if (!data || typeof data !== "object") return;
    if (data.event === "purchased" && this.pending) {
      const { req, resolve } = this.pending;
      this.pending = null;
      this.applyPurchase(req);
      this.note("purchase", `Achat confirmé : ${describe(req)}`);
      resolve(true);
    }
  };

  private post(event: string, extra: Record<string, unknown> = {}) {
    if (this.mode === "game") {
      window.parent.postMessage({ event, ...extra }, "*");
    }
    this.note("event", `${event}${this.mode === "game" ? "" : " (simulé)"}`);
  }

  /** Début d'une partie (compte les tentatives côté jeu). */
  startAttempt() {
    this.post("attemptStarted");
  }

  /** Enregistre un score. À faire avant claimPrize(). */
  submitScore(score: number) {
    this.post("scoreSubmitted", { score });
  }

  /** Réclame le prix (s'il en existe un, défini avec l'équipe SFL). Ferme le Portal. */
  claimPrize() {
    this.post("claimPrize");
  }

  /** Quitte le Portal et revient au jeu. */
  goHome() {
    this.post("closePortal");
  }

  /** Hors jeu : part chercher un jeton sur le jeu de test, qui revient ici avec ?jwt=. */
  authorise() {
    const { gameUrl, portalId } = this.config;
    window.location.href = `${gameUrl}?portal=${portalId}&redirect=${encodeURIComponent(
      window.location.origin + window.location.pathname,
    )}`;
  }
}

function describe(req: PurchaseRequest): string {
  const parts = Object.entries(req.items ?? {}).map(([k, v]) => `${v} ${k}`);
  if (req.sfl) parts.unshift(`${req.sfl} FLOWER`);
  return parts.join(", ") || "rien";
}
