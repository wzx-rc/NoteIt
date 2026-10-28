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

  /* la gamme de couleurs du thème : 20 couleurs, toujours dans le même rôle (n°1 encre, 2 graphite, 3 gris, 4 blanc,
     5 couleur du thème = flèches et lignes, 6 rouge, 7 orange, 8 jaune, 9 vert, 10 sarcelle, 11 bleu, 12 violet, 13 rose,
     14 terre, 15–20 pastels : jaune pâle (post-it par défaut), pêche, rose pâle, lavande, ciel, menthe).
     Une couleur prise dans la gamme garde son numéro : en changeant de thème, elle prend la couleur du même numéro.
     Le n°1 reste presque noir (il devient chalk sur fond sombre). 20 couleurs toutes différentes. */
  scheme: ['#1E1E1E', '#5F5E5A', '#A3A29C', '#FFFFFF', '#4A72E8', '#E5564B', '#EE8A2F', '#E9B731', '#2FA96A', '#1FA2A0',
    '#2B5FA8', '#7C5CE0', '#DB5C9A', '#8B6A4F', '#FCE9A6', '#FAD3B5', '#F7CAD6', '#DCD3F5', '#C9DDF7', '#CDEBD3'],
  colors: {
    space: ['#5B7CFA', '#F2B33D', '#EC6A9C', '#E5484D', '#2E9E6A', '#8B76FF']                       // couleurs des espaces
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

  ring: 'grain',        // roue de l'atelier : 'grain', 'patches' (touches posées à la main, comme Nature) ou 'clean' (anneau lisse, carte aux couleurs du thème)
  mindTags: false,      // mindmaps façon Inkspace

  /* pour un effet qui demande du code : appelé quand le thème est mis (true) ou enlevé (false) */
  apply(on) {}
});
