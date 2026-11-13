import { DevPanel, usePortal } from "@sfl-portals/kit/react";
import { PORTAL_CONFIG } from "./config";

/**
 * Point de départ d'un nouveau Portal.
 * Remplacer le contenu de <main> par le jeu.
 */
export function App() {
  const { portal, state } = usePortal(PORTAL_CONFIG);

  if (state.status === "loading") return <p className="center">Chargement…</p>;
  if (state.status === "error") {
    return (
      <div className="center">
        <p>Impossible de charger la ferme : {state.error}</p>
        <button onClick={() => portal.authorise()}>Se reconnecter</button>
      </div>
    );
  }

  const farm = portal.farm!;
  return (
    <>
      <main className="card">
        <h1>Nouveau Portal</h1>
        <p>
          Ferme #{farm.farmId} · {farm.inventory.Wheat ?? 0} Wheat ·{" "}
          {farm.balance.toFixed(2)} FLOWER
        </p>
        <button onClick={() => portal.purchase({ items: { Wheat: 10 } })}>
          Dépenser 10 Wheat
        </button>
        <button onClick={() => portal.submitScore(42)}>Envoyer un score</button>
        <button onClick={() => portal.goHome()}>Quitter</button>
      </main>
      <DevPanel portal={portal} />
    </>
  );
}
