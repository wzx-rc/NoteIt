import { useEffect, useState } from "react";
import { loadSave, writeSave } from "@sfl-portals/kit";
import { DevPanel, usePortal } from "@sfl-portals/kit/react";
import { PORTAL_CONFIG } from "./config";
import {
  FOODS, STREAK_FOR_REWARD, canPlay, cuddle, feed, level, mood, newPet, play,
  rewardReady, tick, weekKey, type Food, type PetState,
} from "./pet";
import { PetSprite } from "./PetSprite";

/** Démo : un pet à nourrir avec les ressources de la ferme. */
export function App() {
  const { portal, state } = usePortal(PORTAL_CONFIG);
  const [pet, setPet] = useState<PetState | null>(null);
  const [speed, setSpeed] = useState(1);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());

  const farmId = state.status === "ready" ? state.farm.farmId : null;
  const id = PORTAL_CONFIG.portalId;

  // Charge la sauvegarde de cette ferme.
  useEffect(() => {
    if (farmId === null) return;
    setPet(tick(loadSave(id, farmId, newPet(Date.now())), Date.now()));
  }, [farmId, id]);

  // Le temps passe (et la faim avec).
  useEffect(() => {
    const t = setInterval(() => {
      setNow(Date.now());
      setPet((p) => (p ? tick(p, Date.now(), speed) : p));
    }, 1000);
    return () => clearInterval(t);
  }, [speed]);

  useEffect(() => {
    if (pet && farmId !== null) writeSave(id, farmId, pet);
  }, [pet, farmId, id]);

  if (state.status === "loading" || (state.status === "ready" && !pet)) {
    return <p className="center">Chargement…</p>;
  }
  if (state.status === "error") {
    return (
      <div className="center">
        <p>Impossible de charger la ferme : {state.error}</p>
        <button onClick={() => portal.authorise()}>Se reconnecter</button>
      </div>
    );
  }

  const p = pet!;
  const farm = portal.farm!;
  const m = mood(p);

  const giveFood = async (food: Food) => {
    setBusy(true);
    const ok = await portal.purchase({ items: food.cost });
    setBusy(false);
    if (ok) setPet((cur) => (cur ? feed(cur, food, Date.now()) : cur));
  };

  const claim = () => {
    portal.submitScore(p.streak);
    setPet({ ...p, lastRewardWeek: weekKey(now) });
    // En jeu, claimPrize() ferme le Portal et remet le prix défini avec l'équipe SFL.
    portal.claimPrize();
  };

  return (
    <>
      <main className="card">
        <header className="row">
          <h1>{p.name}</h1>
          <span className="badge">niveau {level(p)}</span>
        </header>

        <PetSprite mood={m} />
        <p className="mood">
          {p.name} est <b>{m}</b>
        </p>

        <Bar label="Ventre" value={p.hunger} />
        <Bar label="Joie" value={p.joy} />

        <h2>Nourrir</h2>
        <div className="foods">
          {FOODS.map((f) => {
            const [res, n] = Object.entries(f.cost)[0];
            const have = farm.inventory[res] ?? 0;
            return (
              <button key={f.label} disabled={busy || have < n || p.hunger >= 100} onClick={() => giveFood(f)}>
                {f.label}
                <small>
                  {n} {res} (tu en as {Math.floor(have)})
                </small>
              </button>
            );
          })}
        </div>

        <h2>S'occuper</h2>
        <button disabled={!canPlay(p, now)} onClick={() => setPet(play(p, Date.now()))}>
          Jouer
        </button>
        <button onClick={() => setPet(cuddle(p))}>Câlin</button>

        <h2>Récompense de la semaine</h2>
        <p>
          Nourri {p.streak} jour{p.streak > 1 ? "s" : ""} d'affilée sur {STREAK_FOR_REWARD}.
        </p>
        <button disabled={!rewardReady(p, now)} onClick={claim}>
          Réclamer
        </button>

        {portal.mode !== "game" && (
          <p className="dev">
            Vitesse du temps :{" "}
            {[1, 60, 600].map((s) => (
              <button key={s} className={s === speed ? "on" : ""} onClick={() => setSpeed(s)}>
                ×{s}
              </button>
            ))}
            <button onClick={() => setPet({ ...p, streak: STREAK_FOR_REWARD })}>Série à 7</button>
            <button onClick={() => setPet(newPet(Date.now()))}>Recommencer</button>
          </p>
        )}
      </main>
      <DevPanel portal={portal} />
    </>
  );
}

function Bar({ label, value }: { label: string; value: number }) {
  return (
    <div className="bar">
      <span>{label}</span>
      <div>
        <i style={{ width: `${value}%`, background: value < 30 ? "#c8553d" : "#6a9e3f" }} />
      </div>
      <span>{Math.round(value)}</span>
    </div>
  );
}
