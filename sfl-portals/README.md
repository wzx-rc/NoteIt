# Portals Sunflower Land

Kit pour prototyper des idées jouables qui tournent **dans** Sunflower Land, sous forme de Portal (mini-jeu hébergé par nous, affiché dans le jeu).

Il n'y a pas besoin de forker tout le jeu : un Portal est une simple page web, et ce kit reprend les quelques fonctions du jeu dont un Portal a besoin.

## Ce qu'il y a dedans

- `kit/` : la liaison avec le jeu.
  - `Portal` : lit la ferme du joueur, dépense des FLOWER ou des ressources (`purchase`), enregistre un score, réclame un prix, quitte le Portal.
  - Les mêmes contrôles que le vrai jeu : 200 FLOWER au maximum par achat, 1 000 de chaque ressource au maximum, et seulement les cultures, les fruits et les ressources de base, sans la boue.
  - `usePortal` et `DevPanel` pour React. Le panneau affiche le mode, la ferme et le journal des événements. Il est masqué dans le vrai jeu.
  - `loadSave` / `writeSave` : sauvegarde de la partie par ferme, en local pour l'instant.
- `games/template/` : un Portal vide, prêt à copier.
- `games/pet-demo/` : une démo jouable. Un pet à nourrir avec le blé, les carottes ou les pommes de la ferme, avec ventre, joie, niveau, série de jours et récompense de la semaine.

## Les trois modes

| Mode | Quand | Données | Achats |
|---|---|---|---|
| **simulé** | page ouverte sans jeton | ferme d'exemple en mémoire | simulés, avec les mêmes règles |
| **testnet** | page ouverte avec `?jwt=` du jeu de test | vraie ferme de test, lue sur `api-dev` | simulés (il faut être dans le jeu pour les confirmer) |
| **jeu** | page affichée dans Sunflower Land | ferme du joueur | réels : le joueur confirme, et les ressources sont détruites |

## Démarrer

```bash
cd sfl-portals
npm install
npm run dev            # lance la démo du pet sur http://localhost:3000
```

En mode simulé, le panneau en bas à droite montre tout ce qui se passe. La démo a aussi des boutons pour accélérer le temps (×60, ×600).

### Créer une nouvelle idée

```bash
npm run new -- village-builder
npm install
npm run dev -w games/village-builder
```

Le jeu se code dans `games/<nom>/src/App.tsx`. On peut y ajouter Phaser si l'idée a besoin d'une carte, de déplacements ou de combats.

### Tester avec une vraie ferme (jeu de test)

1. Créer une ferme sur le jeu de test : https://sunflower-land.com/testnet/
2. Lancer le Portal en local, puis cliquer sur **Se connecter au jeu de test** dans le panneau. Le jeu de test renvoie vers la page avec un jeton (`?jwt=…`).
3. Le Portal lit alors la vraie ferme de test sur `https://api-dev.sunflower-land.com`.

Réglages possibles dans `games/<nom>/.env` (voir `.env.example`) : `VITE_PORTAL_ID`, `VITE_API_URL`, `VITE_PORTAL_GAME_URL`.

> Le jeton n'est délivré qu'à un Portal que le jeu connaît. Si la connexion échoue, c'est sans doute que notre nom de Portal n'est pas encore enregistré chez l'équipe : le mode simulé reste disponible en attendant.

## Mettre en ligne dans le vrai jeu

Ça se fait seulement quand une idée est prête :

1. Présenter le Portal à l'équipe Sunflower Land sur Discord.
2. S'ils l'acceptent, ils fournissent un sous-domaine (`<nom>.sunflower-land.com`) et des clés de déploiement.
3. `npm run build -w games/<nom>` produit le dossier `dist/` à publier.

Règles à connaître ([conditions des Portals](https://docs.sunflower-land.com/contributing/portals/portal-terms-of-service)) :
- le créateur touche 30 % des FLOWER dépensés dans son Portal, versés chaque mois, et 100 % des dons ;
- les jeux d'argent sont interdits, et tout autre moyen de gagner de l'argent doit être approuvé ;
- les prix (`claimPrize`) et la création d'Arcade Tokens se définissent avec l'équipe.

## Graphismes

Aucune image du jeu dans ce dépôt : leur licence ne le permet pas. Le pet de la démo est un dessin original et provisoire. Pour la direction artistique de SFL, le pack [Sunnyside World](https://danieldiggle.itch.io/sunnyside) est à prix libre et utilisable commercialement, mais on ne peut ni le revendre, ni le transformer en NFT, ni s'en servir pour entraîner une IA.

## Prochaines étapes possibles

- Un petit serveur qui garde l'état des parties, pour synchroniser le Portal avec un widget Windows ou une app iOS.
- Le village à construire, en commun, avec des ressources du jeu.
