import { assign, emit, enqueueActions, fromCallback, fromPromise, setup } from "xstate";
import { levelForXp, processEvent, type GameAction, type GameState, type TimedAction } from "@frontier/core";
import { now } from "../lib/clock";
import { SaveRejected, sim, type ChainTx, type Wallet } from "../lib/sim";

/**
 * Machine d'état du jeu (XState), sur le modèle de `gameMachine` de Sunflower Land :
 * chargement → wallet → création de la colonie → partie, avec sauvegarde
 * automatique par lots d'actions et resynchronisation si le serveur refuse.
 */
export interface Ctx {
  state: GameState | null;
  wallet: Wallet | null;
  pending: TimedAction[];
  saving: TimedAction[];
  lastSavedAt: number | null;
  error: string | null;
  lastTx: ChainTx | null;
}

export type Ev =
  | { type: "PLAY"; action: GameAction }
  | { type: "TICK" }
  | { type: "CONNECT" }
  | { type: "MINT" }
  | { type: "WITHDRAW"; amount: number }
  | { type: "DEPOSIT"; amount: number }
  | { type: "RETRY" }
  | { type: "SAVE_NOW" };

export type Emitted =
  | { type: "toast"; text: string; tone?: "good" | "bad" | "halo" }
  | { type: "levelUp"; level: number }
  | { type: "applied"; action: TimedAction; before: GameState; after: GameState };

const AUTOSAVE_AFTER_MS = 3000;

export const gameMachine = setup({
  types: { context: {} as Ctx, events: {} as Ev, emitted: {} as Emitted },
  actors: {
    load: fromPromise(() => sim.loadSession()),
    connect: fromPromise(() => sim.connectWallet()),
    mint: fromPromise(() => sim.mintColony()),
    save: fromPromise(({ input }: { input: { actions: TimedAction[] } }) => sim.autosave(input.actions)),
    transact: fromPromise(async ({ input }: { input: { pending: TimedAction[]; kind: "withdraw" | "deposit"; amount: number } }) => {
      if (input.pending.length) await sim.autosave(input.pending);
      return input.kind === "withdraw" ? sim.withdraw(input.amount) : sim.deposit(input.amount);
    }),
    ticker: fromCallback(({ sendBack }) => {
      const id = setInterval(() => sendBack({ type: "TICK" }), 1000);
      return () => clearInterval(id);
    }),
  },
  guards: {
    shouldSave: ({ context }) => context.pending.length > 0 && now() - context.pending[0].createdAt >= AUTOSAVE_AFTER_MS,
    hasPending: ({ context }) => context.pending.length > 0,
  },
}).createMachine({
  id: "frontier",
  context: { state: null, wallet: null, pending: [], saving: [], lastSavedAt: null, error: null, lastTx: null },
  initial: "loading",
  states: {
    loading: {
      invoke: {
        src: "load",
        onDone: [
          { guard: ({ event }) => !event.output.wallet, target: "connect" },
          { guard: ({ event }) => !event.output.state, target: "mint", actions: assign({ wallet: ({ event }) => event.output.wallet }) },
          { target: "game", actions: assign({ wallet: ({ event }) => event.output.wallet, state: ({ event }) => event.output.state }) },
        ],
        onError: { target: "error", actions: assign({ error: ({ event }) => String((event.error as Error)?.message ?? event.error) }) },
      },
    },
    connect: {
      initial: "idle",
      states: {
        idle: { on: { CONNECT: "connecting" } },
        connecting: {
          invoke: {
            src: "connect",
            onDone: { target: "#frontier.mint", actions: assign({ wallet: ({ event }) => event.output }) },
            onError: "idle",
          },
        },
      },
    },
    mint: {
      initial: "idle",
      states: {
        idle: { on: { MINT: "minting" } },
        minting: {
          invoke: {
            src: "mint",
            onDone: { target: "#frontier.game", actions: assign({ wallet: ({ event }) => event.output.wallet, state: ({ event }) => event.output.state }) },
            onError: "idle",
          },
        },
      },
    },
    game: {
      invoke: { src: "ticker" },
      on: {
        PLAY: {
          actions: enqueueActions(({ context, event, enqueue }) => {
            const action = { ...event.action, createdAt: now() } as TimedAction;
            let after: GameState;
            try { after = processEvent(context.state!, action); }
            catch (e) { enqueue.emit({ type: "toast", tone: "bad", text: e instanceof Error ? e.message : String(e) }); return; }
            const before = context.state!;
            enqueue.assign({ state: after, pending: [...context.pending, action] });
            enqueue.emit({ type: "applied", action, before, after });
            const l0 = levelForXp(before.xp), l1 = levelForXp(after.xp);
            if (l1 > l0) enqueue.emit({ type: "levelUp", level: l1 });
          }),
        },
        TICK: {
          actions: ({ context, self }) => {
            const s = context.state;
            if (s?.raid.nextAt && now() >= s.raid.nextAt) self.send({ type: "PLAY", action: { type: "raid.resolved" } });
          },
        },
      },
      initial: "playing",
      states: {
        playing: {
          on: {
            TICK: { guard: "shouldSave", target: "autosaving" },
            SAVE_NOW: { guard: "hasPending", target: "autosaving" },
            WITHDRAW: { target: "transacting" },
            DEPOSIT: { target: "transacting" },
          },
        },
        autosaving: {
          entry: assign({ saving: ({ context }) => context.pending }),
          invoke: {
            src: "save",
            input: ({ context }) => ({ actions: context.saving }),
            onDone: {
              target: "playing",
              actions: assign({
                pending: ({ context }) => context.pending.slice(context.saving.length),
                saving: [],
                lastSavedAt: () => now(),
              }),
            },
            onError: {
              target: "#frontier.rejected",
              actions: assign({
                error: ({ event }) => (event.error instanceof Error ? event.error.message : String(event.error)),
                state: ({ context, event }) => (event.error instanceof SaveRejected ? event.error.state : context.state),
                pending: [], saving: [],
              }),
            },
          },
        },
        transacting: {
          invoke: {
            src: "transact",
            input: ({ context, event }) => ({ pending: context.pending, kind: event.type === "WITHDRAW" ? "withdraw" : "deposit", amount: (event as { amount: number }).amount }),
            onDone: {
              target: "playing",
              actions: [
                assign({ state: ({ event }) => event.output.state, wallet: ({ event }) => event.output.wallet, lastTx: ({ event }) => event.output.tx, pending: [], lastSavedAt: () => now() }),
                emit(({ event }) => ({ type: "toast", tone: "halo", text: event.output.tx.kind === "withdraw" ? `${event.output.tx.amount} $HALO envoyés sur ton wallet` : `${event.output.tx.amount} $HALO déposés dans la colonie` })),
              ],
            },
            onError: {
              target: "playing",
              actions: emit(({ event }) => ({ type: "toast", tone: "bad", text: event.error instanceof Error ? event.error.message : String(event.error) })),
            },
          },
        },
      },
    },
    rejected: { on: { RETRY: "game" } },
    error: { on: { RETRY: "loading" } },
  },
});
