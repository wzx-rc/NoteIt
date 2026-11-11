import { useEffect, useState } from "react";
import { Icon } from "../icons";
import { fmt } from "../format";

interface Props { username?: string; farmId?: number; flowerUsd?: number; demo: boolean; busy: boolean; fetchedAt?: string; onRefresh?: () => void }

/** "il y a 4 min", or the time when it is older than an hour. */
function ago(iso?: string) {
  if (!iso) return "jamais";
  const min = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (min < 1) return "à l'instant";
  if (min < 60) return `il y a ${min} min`;
  return new Date(iso).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function TopBar({ username, farmId, flowerUsd, demo, busy, fetchedAt, onRefresh }: Props) {
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((n) => n + 1), 60_000); return () => clearInterval(t); }, []);
  return (
    <div className="top">
      <h1>Harvest Desk</h1>
      {farmId ? <span className="farm">Ferme de {username || "?"}, n° {farmId}</span> : null}
      {demo ? <span className="demo">Données d'exemple</span> : null}
      <span className="spacer" />
      {flowerUsd ? <span className="ticker"><Icon name="flower" size={16} />1 FLOWER = {fmt(flowerUsd, 3)} $</span> : null}
      {onRefresh ? (
        <span className="update">
          <button className="btn primary big" aria-busy={busy} disabled={busy} onClick={onRefresh}
            title="Relit ta ferme et les prix du marketplace, puis recalcule tout">
            <Icon name="refresh" size={18} />{busy ? "Mise à jour…" : "Mettre à jour"}
          </button>
          <span className="dim small">{busy ? "ferme et prix du marché" : `Données ${ago(fetchedAt)}`}</span>
        </span>
      ) : null}
    </div>
  );
}
