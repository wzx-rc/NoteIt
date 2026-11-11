import { Icon } from "../icons";
import { fmt } from "../format";

interface Props { username?: string; farmId?: number; flowerUsd?: number; demo: boolean; busy: boolean; onRefresh?: () => void }

export function TopBar({ username, farmId, flowerUsd, demo, busy, onRefresh }: Props) {
  return (
    <div className="top">
      <h1>Harvest Desk</h1>
      {farmId ? <span className="farm">Ferme de {username || "?"}, n° {farmId}</span> : null}
      {demo ? <span className="demo">Données d'exemple</span> : null}
      <span className="spacer" />
      {flowerUsd ? <span className="ticker"><Icon name="flower" size={16} />1 FLOWER = {fmt(flowerUsd, 3)} $</span> : null}
      {onRefresh ? (
        <button className="iconbtn" aria-label="Actualiser" title="Actualiser" aria-busy={busy} disabled={busy} onClick={onRefresh}>
          <Icon name="refresh" size={16} />
        </button>
      ) : null}
    </div>
  );
}
