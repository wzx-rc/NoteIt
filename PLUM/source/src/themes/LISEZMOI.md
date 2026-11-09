# Thèmes de PLUM

Chaque thème est un dossier de `src/themes/`. Le build (`node build.mjs`) les ajoute tous tout seul :
il n'y a aucune liste à tenir à jour ailleurs. Le choix se fait dans **Réglages → UI → Thème**,
et le passage d'un thème à l'autre se fait en fondu, sans recharger l'app.

```
src/themes/
  briques/    Briques (0.2.66 : jouet de construction, plaque à tenons sous la barre latérale, briques rouges pour l’actif et les boutons, Fredoka + Rubik, images Recraft ; base Minimal Sommet + studs.css)
  sommet/     Sommet (0.2.59 : monochrome, Geist Mono, pilules noires, paysages peints Recraft sur le HUB et la PAGE, croquis au crayon dans les pages vides ; règles de Minimal + sommet.css)
  minimal/     Minimal, le thème par défaut (esprit Evernote : aplats, filets, Instrument Sans et Instrument Serif, icônes bicolores, barre d'outils des notes fondue dans la page)
  notely/      Nuit, d'après le thème Nuit de WZX Web (l'id "notely" est gardé pour les données existantes ; ses couleurs de base restent dans style.css)
  inkspace/    Éclipse, d'après le thème Éclipse de WZX Web (id "inkspace" gardé)
  nature/      Nature
  farmer/      Farmer (ferme peinte d’après les deux planches « ferme » : rail en noyer, enseigne en bois, onglets bois, cadres, post-it, icônes peintes extraites avec Gemini ; Kalam et Nunito)
  pokedex/     Pokédex (éléments peints du kit : boîtiers en neuf-tranches, rail anthracite, icônes stickers, roue peinte, mascotte ; polices Nunito et Kalam intégrées)
  _modele/     modèle à copier (un dossier qui commence par _ n'est pas inclus dans l'app)
```

Un dossier de thème contient :

| Fichier | Rôle |
|---|---|
| `theme.js` | la fiche du thème : nom, mode clair/sombre, nuanciers, icônes redessinées, habillage |
| `theme.css` | son apparence : couleurs (variables), composants restylés, habillage, aperçu dans Réglages |
| autres `*.css` | ajoutés après `theme.css` (ex. `nature/assets.css`, images générées) |
| `assets/` | images et icônes peintes ; on les cite par `asset:nom.png`, le build les intègre |

## Ajouter un thème (à partir d'un concept)

1. Copier `_modele` vers `themes/<id>` (id court en minuscules, ex. `ocean`).
2. Dans `theme.js` et `theme.css`, remplacer `modele` par l'id.
3. **Couleurs** : remplir les variables de `:root[data-skin="<id>"]` dans `theme.css`
   (barre latérale, pages, textes, accent, barre de titre Windows `--tb-*`, logo `--br-*`).
4. **Gamme de couleurs** (`scheme` dans `theme.js`) : 20 couleurs numérotées, toujours dans le même rôle
   (n°1 encre, n°5 couleur du thème = flèches et lignes, 6–14 teintes, 15–20 pastels des post-it et des fonds ;
   voir `_modele/theme.js`). Tous les sélecteurs de couleur la proposent. Une couleur prise dans la gamme garde son
   numéro : au changement de thème, les boards, les stylos et les réglages par défaut passent à la couleur du même
   numéro. `colors.space` garde les pastilles des espaces.
5. **Icônes** (`icons`) : nom de l'icône → nouveau dessin SVG 24×24, ou une image peinte
   `<image href="asset:icones/x.png" width="24" height="24"/>`. Les noms sont les `<symbol id="i-…">`
   de `src/body.html` (home, note, tasks, board, pen, rect, sticky, gear, …). Le changement est immédiat partout.
6. **Habillage** (`decor`) : chaque entrée ajoute un calque `<div class="th-decor <cls>">` dans un
   élément qui reste en place (`#side`, `#main`, `body`) ; `theme.css` le place et lui donne son image
   (`background: url("asset:feuille.png")`). Les calques sont retirés quand on change de thème.
   On peut aussi décorer avec `::before` / `::after` comme le fait Nature.
7. **Outils et composants** : toute partie de l'interface se restyle dans `theme.css` avec des
   règles qui commencent par `[data-skin="<id>"]` (îlots d'outils `.isl`, outils `.tl`, panneau
   `.props`, post-it `.it.note`, cartes `.card`, atelier `.atl-*`, etc.).
8. **Polices** : déposer les .woff2 dans `assets/fonts/` et les déclarer en haut de `theme.css`
   (`@font-face { font-family: "X"; src: url("asset:fonts/x.woff2") format("woff2"); }`), puis
   `--font-ui` / `--font-hand` dans les variables. Exemple : `pokedex/theme.css`.
9. **Aperçu** dans Réglages : les règles `.sk-<id> .skin-pv` en bas de `theme.css`.
10. `node build.mjs` : le thème apparaît dans Réglages.

Règles :

- tout ce qui est dans `theme.css` doit commencer par `[data-skin="<id>"]` (ou `.sk-<id>` pour l'aperçu),
  sinon la règle s'applique aussi aux autres thèmes ;
- chaque `asset:<fichier>` cité doit exister dans `assets/` (même dans un commentaire), sinon le build s'arrête ;
- les images sont intégrées dans l'app : préférer le WebP ou le SVG, et des tailles raisonnables ;
- ne pas renommer l'id d'un thème déjà livré : c'est lui qui est enregistré dans les réglages.

## Ce que la fiche `theme.js` peut dire

| Clé | Par défaut | Sens |
|---|---|---|
| `id`, `label`, `desc`, `order` | | identifiant, nom et phrase dans Réglages, place dans la liste |
| `mode` | `'user'` | `'user'` = Système / Clair / Sombre au choix ; `'dark'` / `'light'` = imposé |
| `meta` | `''` | couleur de la barre du navigateur / iPad |
| `chalk`, `hand` | `#ECEAE5`, `''` | couleur de l'encre presque noire sur fond sombre, et du texte manuscrit |
| `scheme` | `SCHEME_BASE` | les 20 couleurs de la gamme (`SCHEME_NAMES` dans 00-util.js) ; stylo, surligneur, contours, fonds, post-it et mind map en sont tirés |
| `colors` | base | `space` : couleurs des espaces |
| `palettes` | `[]` | palettes en plus dans l'atelier de dessin |
| `icons` | `{}` | icônes redessinées |
| `decor` | `[]` | calques d'habillage |
| `ring` | `'grain'` | roue de l'atelier : `'grain'` ou `'patches'` (touches posées à la main) |
| `mindTags` | `false` | mindmaps à la façon de l'ancien Inkspace |
| `tints` | `null` | « Couleur du thème » dans Réglages : `[{ id, name, h, c }]`, teinte et chroma des gris, posés sur `<html>` en `--th-h` / `--th-c` (le premier est celui par défaut). Le `theme.css` écrit ses gris en `oklch(L var(--th-c) var(--th-h))` (exemple : `notely/theme.css`) |
| `accents` | `null` | « Couleur d'accent » dans Réglages : `[{ name, value }]`, la première est celle du thème. Une autre couleur pose `<html data-accent="custom">` avec `--accent-c` et `--on-accent-c` (texte lisible dessus), que le `theme.css` reprend dans `--accent` |
| `boardInset` | `0` | place (px) que prend à gauche du board un rail d’outils du thème : « Tout voir » cadre le contenu à côté (Farmer : 150) |
| `headSolid` | `false` | les pointes de flèche « Flèche » deviennent pleines et barbelées (Farmer) |
| `mindList` | `false` | mind map : les sous-idées en liste sous leur branche, sur une ligne-crochet avec puces (Farmer) |
| `mindRoot` | — | mind map : `[largeur min, hauteur min, marge verticale, largeur max du texte]` de l’idée centrale |
| `mindArt` | — | mind map : `[[regex, 'asset:…'], …]` image peinte à côté d’une branche dont les mots correspondent |
| `apply(on)` | | code lancé à la mise en place (`true`) et au retrait (`false`) du thème |

Le code de l'app lit le thème par `theme()` (fiche du thème courant) et `themeColors(clé, base)`
(un nuancier), définis dans `src/js/00-util.js` ; la mise en place est `applyTheme()` dans `src/js/03-app.js`.

## Chargement du CSS (0.2.24)
Seules les règles qui contiennent `[data-skin="<id>"]` sont chargées à la demande : la page ne garde que celles du thème actif.
Une règle sans `data-skin` (aperçu `.sk-<id> .skin-pv`, variables `:root` d'images) reste chargée en permanence pour tous les thèmes.
Préfixez donc chaque règle propre au thème par `[data-skin="<id>"]`.
