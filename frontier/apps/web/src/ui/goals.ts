/** Objectifs affichés par niveau (guident le joueur, l'XP reste la seule condition de passage). */
export const GOALS: Record<number, Array<[string, string, number]>> = {
  1: [["Forer 3 fois un gisement de ferrite", "mine_ferrite", 3], ["Récolter 5 spores", "harvest_spore", 5], ["Vendre des récoltes au comptoir", "sell", 1], ["Terminer 1 livraison", "deliver", 1]],
  2: [["Construire la raffinerie", "build_raffinerie", 1], ["Raffiner 2 alliages", "craft_alliage", 2], ["Récolter 3 algues bleues", "harvest_algue", 3], ["Terminer 3 livraisons", "deliver", 3]],
  3: [["Étendre la colonie", "expand", 1], ["Extraire 2 xénon au geyser", "mine_xenon", 2], ["Fabriquer 1 cellule d'énergie", "craft_cellule", 1], ["Terminer 5 livraisons", "deliver", 5]],
  4: [["Récolter 3 champignons de quartz", "harvest_quartz", 3], ["Construire la tourelle de défense", "build_tourelle", 1], ["Repousser un raid de drones", "raid", 1], ["Terminer 8 livraisons", "deliver", 8]],
  5: [["Retirer des $HALO vers ton wallet", "withdraw", 1]],
};

export const UNLOCKS: Record<number, string> = {
  2: "Algues bleues, raffinerie, alliage et ration compacte.",
  3: "Extension de la colonie, geyser de xénon, cellule d'énergie.",
  4: "Champignons de quartz, tourelle de défense, raids de drones.",
  5: "Fin du prototype. Prochaine étape : choix de faction.",
};
