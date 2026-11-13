import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { Portal, type PortalConfig, type FarmSnapshot } from "./portal";

type State =
  | { status: "loading" }
  | { status: "error"; error: string }
  | { status: "ready"; farm: FarmSnapshot };

/** Crée le Portal, charge la ferme et re-rend à chaque changement. */
export function usePortal(config: PortalConfig) {
  const portal = useMemo(() => new Portal(config), [config.portalId]);
  const [state, setState] = useState<State>({ status: "loading" });
  const version = useSyncExternalStore(
    (fn) => portal.subscribe(fn),
    () => portal.version,
  );

  useEffect(() => {
    portal.load().then(
      (farm) => setState({ status: "ready", farm }),
      (e: Error) => setState({ status: "error", error: e.message }),
    );
  }, [portal]);

  return { portal, state, version };
}

const panel: React.CSSProperties = {
  position: "fixed", right: 12, bottom: 12, width: 300, maxHeight: "45vh",
  overflow: "auto", background: "rgba(20,16,12,.92)", color: "#f3e7c9",
  font: "12px/1.4 ui-monospace, monospace", borderRadius: 10, padding: 10,
  boxShadow: "0 6px 24px rgba(0,0,0,.35)", zIndex: 9999,
};

/** Petit panneau de développement : mode, ferme, journal. Masqué en jeu. */
export function DevPanel({ portal }: { portal: Portal }) {
  const [open, setOpen] = useState(true);
  useSyncExternalStore((fn) => portal.subscribe(fn), () => portal.version);
  if (portal.mode === "game") return null;
  const farm = portal.farm;
  return (
    <div style={panel}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
        <b>Portal · {portal.mode === "mock" ? "simulé" : "testnet"}</b>
        <button onClick={() => setOpen(!open)} style={{ fontSize: 11 }}>
          {open ? "réduire" : "ouvrir"}
        </button>
      </div>
      {open && (
        <>
          {portal.mode === "mock" && (
            <button onClick={() => portal.authorise()} style={{ marginBottom: 6 }}>
              Se connecter au jeu de test
            </button>
          )}
          {farm && (
            <div style={{ marginBottom: 6 }}>
              Ferme #{farm.farmId} · {farm.balance.toFixed(2)} FLOWER
              <div style={{ opacity: 0.8 }}>
                {Object.entries(farm.inventory)
                  .filter(([, n]) => n > 0)
                  .slice(0, 14)
                  .map(([k, n]) => `${k} ${Math.round(n * 100) / 100}`)
                  .join(" · ")}
              </div>
            </div>
          )}
          {[...portal.log].reverse().map((l) => (
            <div key={l.at + l.message} style={{ color: l.kind === "error" ? "#ff9b8a" : undefined }}>
              {new Date(l.at).toLocaleTimeString()} {l.message}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
