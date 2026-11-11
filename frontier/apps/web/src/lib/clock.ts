/**
 * Horloge du jeu. En prototype, un décalage permet d'avancer le temps (boutons « +1 min »)
 * sans fausser les règles : toutes les actions restent horodatées et validées.
 */
const KEY = "frontier:clock-offset";
let offset = 0;
try { offset = Number(localStorage.getItem(KEY)) || 0; } catch { /* stockage indisponible */ }

export const now = () => Date.now() + offset;
export function skip(ms: number) {
  offset += ms;
  try { localStorage.setItem(KEY, String(offset)); } catch { /* ignore */ }
}
export function resetClock() {
  offset = 0;
  try { localStorage.removeItem(KEY); } catch { /* ignore */ }
}
