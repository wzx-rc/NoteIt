import { useEffect, useState } from "react";
import type { AppState } from "../../shared/types";
import { bridge } from "../useAppState";

interface Props { state: AppState; onImport: () => void }

/** API key, farm id and history. The key is sent to the main process and never read back. */
export function SettingsView({ state, onImport }: Props) {
  const b = bridge();
  const [farmId, setFarmId] = useState("");
  const [apiBase, setApiBase] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [hasKey, setHasKey] = useState(false);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    b?.getSettings().then((s) => { setFarmId(s.farmId); setApiBase(s.apiBase); setHasKey(s.hasKey); });
  }, [b]);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!b) return;
    setSaving(true); setSaved(false);
    await b.saveSettings({ farmId: farmId.trim(), apiBase: apiBase.trim(), apiKey: apiKey.trim() || undefined });
    setSaving(false); setSaved(true); setApiKey("");
    if (apiKey.trim()) setHasKey(true);
  };

  const snaps = state.snapshots;
  const span = snaps.length > 1 ? (snaps[snaps.length - 1].at - snaps[0].at) / 86_400_000 : 0;

  return (
    <div className="settings">
      <section className="card" aria-labelledby="h-api">
        <h2 id="h-api">Connexion à la ferme</h2>
        <p className="hint">La clé reste sur ce PC, dans le dossier de l'app. Elle n'est jamais affichée ni envoyée ailleurs qu'à l'API du jeu.</p>
        {!b ? <p className="empty">Les réglages sont disponibles dans l'app PC. Ici, la page montre des données d'exemple.</p> : null}
        <form onSubmit={save}>
          <div className="field">
            <label htmlFor="key">Clé API Community</label>
            <input id="key" type="password" autoComplete="off" value={apiKey} onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? "Clé enregistrée. Laisse vide pour la garder." : "Colle ta clé ici"} disabled={!b} />
            <small>Dans le jeu : Réglages, puis API Community. VIP actif et niveau 50 requis. Les chevrons &lt; &gt; sont retirés tout seuls.</small>
          </div>
          <div className="field">
            <label htmlFor="farm">Numéro de ferme</label>
            <input id="farm" inputMode="numeric" value={farmId} onChange={(e) => setFarmId(e.target.value)} placeholder="150782" disabled={!b} />
          </div>
          <div className="field">
            <label htmlFor="base">Adresse de l'API</label>
            <input id="base" value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="https://api.sunflower-land.com" disabled={!b} />
          </div>
          <div className="actions">
            <button className="btn primary" type="submit" disabled={!b || saving || !farmId.trim() || (!hasKey && !apiKey.trim())}>
              {saving ? "Connexion…" : "Enregistrer et actualiser"}
            </button>
            {saved && state.status === "ready" ? <span className="ok" role="status">Connecté à la ferme {state.farmId}.</span> : null}
          </div>
        </form>
      </section>

      <section className="card" aria-labelledby="h-hist">
        <h2 id="h-hist">Historique</h2>
        <p className="hint">Les revenus sont une moyenne entre la plus ancienne et la plus récente photo des compteurs de la ferme. L'app en prend une toutes les 10 minutes et les garde 35 jours.</p>
        <dl className="facts">
          <dt>Photos gardées</dt><dd>{snaps.length}</dd>
          <dt>Période couverte</dt><dd>{span ? `${span.toFixed(1).replace(".", ",")} jours` : "pas encore assez"}</dd>
        </dl>
        <div className="actions">
          <button className="btn" onClick={onImport} disabled={!b || state.importing || state.status === "needs-setup"}>
            {state.importing ? "Lecture des sauvegardes…" : "Remplir avec les 7 derniers jours"}
          </button>
        </div>
        <p className="foot">Lit les sauvegardes publiques du jeu (environ 800 Mo chacune, lues en flux, rien n'est gardé sur le disque). Compte quelques minutes.</p>
      </section>
    </div>
  );
}
