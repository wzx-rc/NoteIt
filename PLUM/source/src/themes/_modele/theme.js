/* MODÈLE de thème : copier ce dossier sous le nom du nouveau thème (ex. themes/ocean), puis changer l'id ci-dessous
   pour le même nom. Un dossier qui commence par _ n'est pas inclus dans l'app.
   Seuls id et label sont obligatoires : toute clé absente reprend le style de base (Papier). */
defineTheme({
  id: 'modele', order: 10, label: 'Modèle', desc: 'Une phrase courte sous l’aperçu',

  /* 'user' = l'utilisateur choisit Système / Clair / Sombre ; 'dark' ou 'light' = toujours ce mode */
  mode: 'dark',
  meta: '#1B1D22',                  // couleur de la barre du navigateur / iPad
  chalk: '#EAE4D8',                 // encre presque noire dessinée sur un fond sombre
  hand: '',                         // texte manuscrit presque noir sur fond sombre ('' = chalk)

  /* nuanciers proposés par les sélecteurs de couleur (chaque liste est optionnelle) */
  colors: {
    ink: ['#1B1E22', '#E03131', '#F08C00', '#2F9E44', '#1971C2', '#6E56F0', '#D9467E', '#8B5E3C'], // stylo des notes et des boards
    hl: ['#FDE047', '#86EFAC', '#93C5FD', '#F9A8D4', '#FDBA74', '#C4B5FD'],                         // surligneur
    stroke: ['#1E1E1E', '#E03131', '#2F9E44', '#1971C2', '#F08C00'],                                // contours (formes, flèches, textes)
    fill: ['#FFC9C9', '#B2F2BB', '#A5D8FF', '#FFEC99', '#FFFFFF'],                                  // fonds des formes
    note: ['#FDE68A', '#FBCFA4', '#F9C4D2', '#D5C8F6', '#BFDBF7', '#C3E8C1'],                      // post-it
    space: ['#5B7CFA', '#F2B33D', '#EC6A9C', '#E5484D', '#2E9E6A', '#8B76FF'],                      // couleurs des espaces
    picker: [['#FFFFFF', '#ADB5BD', '#495057', '#1E1E1E'], ['#FFE3E3', '#FF8787', '#E03131', '#A51D1D']] // lignes du nuancier de la roue
  },

  /* palettes en plus dans l'atelier de dessin (onglets 'nature' ou 'saisons') */
  palettes: [{ id: 'modele-1', tab: 'nature', name: 'Palette du modèle', scene: 'forest', cols: ['#D3D9A8', '#9AAE4E', '#5B4636'] }],

  /* icônes redessinées : nom de l'icône (sans le préfixe i-) -> SVG dans une boîte 24×24.
     Les noms sont ceux des <symbol id="i-…"> de src/body.html. Une image peinte marche aussi :
     '<image href="asset:feuille.svg" width="24" height="24"/>' (fichier dans assets/) */
  icons: {
    // home: '<path d="M4 11 12 4l8 7v9H4z"/>'
  },

  /* habillage : un calque <div class="th-decor <cls>"> est ajouté dans chaque élément qui répond au sélecteur
     (choisir un élément qui reste en place : #side, #main, body). Il est dessiné par theme.css. */
  decor: [{ at: '#side', cls: 'mod-feuille' }],

  ring: 'grain',        // roue de l'atelier : 'grain' ou 'patches' (touches posées à la main, comme Nature)
  mindTags: false,      // mindmaps façon Inkspace

  /* pour un effet qui demande du code : appelé quand le thème est mis (true) ou enlevé (false) */
  apply(on) {}
});
