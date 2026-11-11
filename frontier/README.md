# Frontier : prototype de jeu web

Jeu de colonie spatiale au style peint vu du dessus (kit Recraft), construit sur la même architecture que Sunflower Land. Tout tourne dans le navigateur : il n'y a pas encore de serveur, et la blockchain est simulée.

## Lancer le jeu

```bash
pnpm install
pnpm dev           # http://localhost:5173
pnpm test          # tests du moteur de jeu
pnpm --filter @frontier/web build:single   # un seul fichier HTML, à partager
```

## Comment c'est construit

| Partie | Rôle | Équivalent Sunflower Land |
| --- | --- | --- |
| `packages/core` | Règles du jeu en TypeScript pur : état, actions, `processEvent`, tirages déterministes | `src/features/game/events` et `types` |
| `apps/web/src/machine` | Machine d'état XState : wallet, création de la colonie, partie, sauvegarde automatique | `gameMachine.ts` |
| `apps/web/src/game` | Carte de la colonie en Phaser 3 (sprites Recraft, animations, caméra) | scènes Phaser de l'île |
| `apps/web/src/ui` | Interface React : barre du haut, objets, comptoir, raffinerie, livraisons, wallet | composants React du HUD |
| `apps/web/src/lib/sim.ts` | Serveur et blockchain **simulés** (localStorage) | API + contrats sur Polygon/Base |

### Le principe des actions

Le client n'envoie jamais un état, seulement des actions horodatées (`crop.planted`, `node.mined`, `order.delivered`…). Toutes les 3 secondes, la machine envoie le lot d'actions au « serveur ». Celui-ci les rejoue avec le même `processEvent` et garde le seul état qui fait foi. Si une action est impossible, le lot entier est refusé et la colonie revient au dernier état validé.

Les tirages (commandes des colons, bonus de forage) viennent d'une graine propre à la colonie. Le client et le serveur obtiennent donc les mêmes résultats, et un client modifié ne peut pas choisir ses tirages.

Pour brancher un vrai serveur, il suffit de remplacer `lib/sim.ts` : `@frontier/core` tourne tel quel dans Node.

### Ce qui est simulé

- **Wallet** : une adresse générée au hasard.
- **NFT de colonie** : un numéro.
- **Token $HALO** : un solde dans le navigateur.
  - Retrait : 5 % de frais brûlés.
  - Dépôt : la moitié est brûlée, l'autre moitié va au trésor.

Ces règles sont celles prévues pour les futurs contrats sur Base.

## Contenu du niveau 1 au niveau 5

| Niveau | Ce qui se débloque |
| --- | --- |
| 1 | Spores, forage de ferrite avec des charges, comptoir, livraisons |
| 2 | Algues bleues, raffinerie (une recette à la fois, comme le feu de camp), alliage, ration |
| 3 | Extension de la colonie (3 bacs, 2 gisements, geyser de xénon), cellule d'énergie |
| 4 | Champignons de quartz, tourelle de défense, raids de drones |
| 5 | Fin du prototype : retrait de $HALO vers le wallet |

Les boutons **+1 min** et **+10 min** avancent l'horloge du jeu pour tester sans attendre. Les actions restent horodatées et validées.

Les sprites de `apps/web/src/assets` ont été générés avec Recraft pour ce projet.
