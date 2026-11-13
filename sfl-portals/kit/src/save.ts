/**
 * Sauvegarde locale de la partie, rangée par ferme.
 * Provisoire : pour la synchro widget / iOS, il faudra un petit serveur
 * qui garde cet état (même forme de données, autre stockage).
 */
export function loadSave<T>(portalId: string, farmId: number, fallback: T): T {
  try {
    const raw = localStorage.getItem(`sfl-portal:${portalId}:${farmId}`);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

export function writeSave<T>(portalId: string, farmId: number, data: T): void {
  try {
    localStorage.setItem(`sfl-portal:${portalId}:${farmId}`, JSON.stringify(data));
  } catch {
    /* stockage indisponible : la partie continue sans sauvegarde */
  }
}
