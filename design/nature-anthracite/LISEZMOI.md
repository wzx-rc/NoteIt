# Nature Anthracite : pack de design

Éléments isolés de l'atelier de dessin Notely, au plus près du concept d'origine
(`reference/concept-original.png`, 1536 × 1024). Chaque élément existe à part,
en SVG et/ou en PNG à fond transparent. Aperçu de tout le pack : `apercu/planche.png`.

## Deux familles d'éléments

| Dossier | Ce que c'est | Formats |
|---|---|---|
| `svg/` + `png/` | **Redessiné en vecteur** : roue, taches, traits, feuilles, icônes, boutons, panneaux, rails, flèches | SVG + PNG @1x @2x (@4x pour couleur, pinceau, botanique ; icônes en 24, 48, 96, 192 px) |
| `extraits-concept/` | **Découpé directement dans l'image concept** : ce qui ne se refait pas fidèlement en vecteur (feuillages peints, taches réelles, roue d'origine, tuiles Forme / Texture / Dynamique, paysages, loupe, écriture à la craie) | PNG natif + @2x |
| `png/textures/` | Textures raccordables : fond anthracite, voile de grain papier, voile de marbrure, dents de papier | PNG 256 ou 512 px |
| `tokens/` | Couleurs échantillonnées dans le concept, en CSS (`--na-*`) et en JSON | CSS, JSON |

## Le côté artisanal

- **Roue chromatique** (`svg/couleur/roue/`) : 16 touches de pastel posées une par une sur une sous-couche, dans un ordre mélangé. Chaque touche a sa teinte décalée de quelques degrés, des bords irréguliers (le bord intérieur est plus déchiqueté, comme sur le concept) et des passages plus clairs ou plus sombres à l'intérieur. Les teintes viennent de l'anneau du concept, mesuré tous les 15°. Ce n'est pas un dégradé.
- **Taches et pastilles** (`svg/couleur/taches/`, `pastilles/`) : une par couleur du concept (46), chacune avec sa forme propre. Les `masques/` sont les mêmes formes en blanc, pour teindre n'importe quelle couleur en CSS (`mask-image`).
- **Traits** (`svg/pinceau/traits/`) : le crayon naturel, le pastel sec et le charbon sont faits de milliers de hachures obliques, serrées au centre et effilochées sur les bords. La gouache et le feutre sont faits de fibres.
- Tout est tiré au hasard **avec des graines fixes** : relancer les scripts redonne exactement les mêmes fichiers.

## Limites, honnêtement

- Les extraits sont pris dans une image de 1536 px : leur taille native est petite (une tache du concept fait 40 à 60 px). Le @2x est un agrandissement propre, mais il n'ajoute pas de détail.
- Les bords des feuillages extraits sont coupés là où une feuille passait derrière un panneau ou sortait du cadre.
- Les SVG utilisent des filtres (grain, bords mangés) : un navigateur les rend comme sur les PNG, mais Figma, Illustrator ou Inkscape peuvent les ignorer ou les rendre autrement. La forme, les couleurs et les passages internes restent dans le dessin, seul le grain fin dépend du filtre. En cas de doute, utiliser les PNG.
- Les feuilles vectorielles sont plus simples que les feuilles peintes du concept : pour coller au concept, préférer les extraits de `extraits-concept/botanique/`.
- Le pack n'est pas branché dans l'app : il sert de bibliothèque.

## Régénérer

Depuis `design/nature-anthracite/` (Python 3 avec Pillow, NumPy, SciPy ; Node avec Playwright) :

```
python3 tools/extract.py     # découpes du concept → extraits-concept/
python3 tools/generate.py    # dessins vectoriels → svg/ + tokens/
node tools/render.mjs        # SVG → PNG (Chromium)
python3 tools/textures.py    # textures → png/textures/
python3 tools/planche.py && node tools/capture.mjs   # apercu/planche.png
```

Polices : Figtree (interface) et Caveat (annotations), licence SIL OFL, dans `fonts/`.
