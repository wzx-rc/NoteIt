# Harvest Desk

Petite app PC qui montre ce que ta ferme Sunflower Land rapporte par jour, par mois et par an, et ce que changerait un achat (Quarry, Kuebiko, Hoot…). Outil perso, non officiel.

## Ce que fait l'app

- Lit ta ferme toutes les 10 minutes avec l'API Community, et les prix du marketplace toutes les 6 heures. Le bouton « Mettre à jour » en haut relit tout de suite la ferme et les prix, puis recalcule tous les onglets.
- Calcule le revenu net de chaque catégorie (crops, animaux, serre, minerais) à partir de tes vrais compteurs d'activité sur les 7 derniers jours, des bonus de ta ferme et des prix du marché.
- Simule les options que tu n'as pas encore, avec leur gain par jour, leur prix plancher et le temps pour les rembourser.
- Trace les gains cumulés sur 12 mois, achats déduits.
- **Marketplace** : les 5 NFT à acheter qui se remboursent le plus vite sur ta ferme (prix, gain en $ par mois) et, à côté, les 5 que tu possèdes à vendre : ceux sans effet sur tes revenus, ou ceux qui rapportent peu pour leur prix.
- **Livraisons** : coût moyen de chaque livraison à tickets de la saison en cours, le prix d'un ticket chez chaque personnage, et le total pour toute la saison ou pour les livraisons que tu coches. Montre aussi ce que rapportent les livraisons payées en coins ou en FLOWER.
- **Entrées et sorties** : historique en $ des FLOWER qui entrent et sortent (retraits, achats, ventes, livraisons, dépenses en jeu), plus ce que tu ajoutes à la main (FLOWER acheté par carte, etc.).

### Comment sont calculés les deux onglets

- Livraisons : l'app garde chaque commande vue à chaque actualisation, et fait la moyenne par personnage. Les objets sont comptés au prix du marketplace ; les plats et outils au prix de leurs ingrédients ; les coins à 320 pour 1 FLOWER. Les poissons non échangeables sont estimés au coût d'une canne. Une livraison à tickets par personnage et par semaine, 13 semaines par saison. Les tickets comptent le bonus VIP et les objets de saison que tu portes ou as posés.
- Entrées et sorties : l'app compare deux lectures de la ferme. La différence de solde FLOWER est découpée en retrait (compteur de retraits), livraisons payées (commandes disparues), puis achat ou vente (NFT apparus ou disparus, compteur de ventes). Le reste devient « Dépenses en jeu » ou « Autres gains ». Le cours du FLOWER est celui du moment de la lecture.

## Installer et lancer

Il faut Node.js 20 ou plus.

```bash
npm install
npm start          # construit puis ouvre l'app
npm run dist       # crée un .exe portable dans release/
```

Au premier lancement, l'app ouvre les réglages. Colle ta clé API Community (dans le jeu : Réglages, puis API Community, VIP actif et niveau 50 requis) et ton numéro de ferme. Les chevrons `< >` autour de la clé sont retirés tout seuls.

La clé est gardée sur ton PC, dans le dossier de données de l'app (`%APPDATA%/harvest-desk/settings.json` sous Windows). Elle reste dans le process principal d'Electron : la fenêtre ne la voit jamais. Pour développer, tu peux aussi passer `SFL_API_KEY`, `SFL_FARM_ID` et `SFL_API_BASE` en variables d'environnement.

## Historique

Le revenu est une moyenne entre la plus ancienne et la plus récente photo des compteurs (`farmActivity`). L'app en prend une à chaque actualisation et les garde 35 jours.

Au début, il n'y a qu'une photo. L'app remplit alors l'historique avec les sauvegardes publiques du jeu (`nightlyDump`, gardées 7 jours). Chaque fichier fait environ 800 Mo : il est lu en flux et rien n'est écrit sur le disque. Ça prend quelques minutes.

L'API limite à environ une requête toutes les 5 secondes. L'app espace ses appels de 5,5 s et attend 10 s après un refus 429.

## Développer

```bash
npm run dev        # Vite avec rechargement à chaud, dans Electron
npm run web        # l'interface seule dans le navigateur, avec la ferme d'exemple
npm test           # tests du moteur et du parseur de marché
```

| Dossier | Contenu |
|---|---|
| `src/core/` | Moteur de calcul, livraisons, valorisation, historique. Les formules suivent le code du jeu (`src/features/game/` du dépôt sunflower-land). |
| `src/core/data/` | Recettes, identifiants marketplace et règles des tickets, extraits du code du jeu par `python3 scripts/gen-game-data.py <dossier du jeu>`. |
| `src/ui/` | Interface React. Un composant par carte de la maquette. |
| `src/demo/fixture.json` | Ferme d'exemple pour le mode navigateur et les tests. |
| `electron/` | Process principal : API, réglages, historique. |

## Limites connues

- Les compteurs du jeu comptent des actions, pas des quantités. Le moteur recalcule les quantités avec les bonus de ta ferme : c'est une estimation proche, pas un relevé exact.
- La vue Timers du menu est prévue mais pas encore faite.
- Avant l'installation, l'historique ne remonte qu'à 7 jours (les sauvegardes du jeu).

## Images

Les icônes sont dessinées pour l'app. Les images du jeu ne sont pas réutilisables librement (le dépôt sunflower-land n'a pas de licence pour ses médias), donc aucune n'est incluse.
