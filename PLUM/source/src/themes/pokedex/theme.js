/* Pokédex: the user's "PokeBoard" and "Pokédex chromatique" concept boards, followed closely.
   The app floats on a painted landscape: a cream sidebar card with the poké ball logo, a white top bar, pages and the
   board on parchment, a white tool dock on the left of the board and a white panel on the right. The drawing studio is
   a set of red devices with cream screens and a charcoal rail; its colour wheel is the theme's own (wheel.js).
   Icons are redrawn: solid glyphs in the sidebar, sturdy rounded strokes on the tools, a yellow palette. Always light. */
const PK_SOLID = s => `<g fill="currentColor" stroke="none" fill-rule="evenodd">${s}</g>`;
/* painted icons from the kit: a sticker drawn in its 24×24 box, whatever the colour around it */
const PK_IMG = s => ({ vb: '0 0 24 24', svg: s });
const PK_LINE = s => `<g stroke-width="2.1">${s}</g>`;
defineTheme({
  id: 'pokedex', order: 4, label: 'Pokédex', desc: 'PokeBoard : paysage peint, boîtiers rouges',
  mode: 'light', meta: '#F6F0E4', atlInk: '#3A3631', wheel: (el, o) => pkWheel(el, o), harmony: o => pkHarmony(o),
  tasks: o => pkTasks(o), taskIcon: t => pkTaskIcon(t), docAttrs: (d, sp) => pkDocAttrs(d, sp),
  /* the dark column of the brush device: four painted nibs */
  penTabs: [['inkfine', '<img src="asset:ic-plume.webp" alt="">'], ['natural', '<img src="asset:ic-crayon.webp" alt="">'], ['gouache', '<img src="asset:ic-pinceau-rond.webp" alt="">'], ['charcoal', '<img src="asset:ic-fusain.webp" alt="">']],
  noteSpread: true,
  colors: {
    ink: ['#2D2B29', '#D7432F', '#F2A93B', '#4E9A5B', '#2C6BEA', '#7A5BC7', '#E07A9B', '#8A5A3C'],
    stroke: ['#2D2B29', '#D7432F', '#4E9A5B', '#2C6BEA', '#F2A93B'],
    fill: ['#F8C9BE', '#CFE6C3', '#C6DAF7', '#FBE4A3', '#FFFDF8'],
    note: ['#FBE58D', '#F9C6B8', '#CDE8BF', '#C5DBF8', '#E3D6F3', '#F6D7B8', '#FFFDF8', '#EAE2D3'],
    space: ['#D7432F', '#F2A93B', '#F2C230', '#4E9A5B', '#2FA39A', '#2C6BEA', '#7A5BC7', '#E07A9B', '#8A5A3C', '#6B6358']
  },
  palettes: [
    { id: 'pk-forest', tab: 'nature', name: 'Forêt', scene: 'forest', cols: ['#7FA165', '#3F6B4A', '#5E7F78', '#B8C98A', '#2F4A3A'] },
    { id: 'pk-desert', tab: 'nature', name: 'Désert', scene: 'field', cols: ['#E9C9A0', '#D9A877', '#C98A5F', '#F3E1C4', '#9C6B4A'] },
    { id: 'pk-ocean', tab: 'nature', name: 'Océan', scene: 'mountain', cols: ['#9CC3E4', '#5C8FC4', '#3C5F95', '#CFE3F2', '#264066'] },
    { id: 'pk-sunset', tab: 'saisons', name: 'Couchant', scene: 'field', cols: ['#F2A07B', '#E0645A', '#C94C55', '#F6C99B', '#8E3A4E'] },
    { id: 'pk-character', tab: 'saisons', name: 'Personnage', scene: 'forest', cols: ['#E8C2A0', '#D0855C', '#8E4F3C', '#4A3A3A', '#F3DCC6'] },
    { id: 'pk-starters', tab: 'nature', name: 'Starters', scene: 'forest', cols: ['#E8763A', '#F2C230', '#5B9BD5', '#2C6BEA', '#7FB069', '#3E7D4F'] }
  ],
  icons: {
    /* harmony modes: the node drawings of the concept */
    'hm-comp': PK_IMG('<image href="asset:ic-complementaire.webp" width="24" height="24"/>'),
    'hm-analog': PK_IMG('<image href="asset:ic-analogue.webp" width="24" height="24"/>'),
    'hm-triad': PK_IMG('<image href="asset:ic-triade.webp" width="24" height="24"/>'),
    'hm-tetra': PK_IMG('<image href="asset:ic-tetradique.webp" width="24" height="24"/>'),
    'hm-mono': PK_IMG('<image href="asset:ic-monochrome.webp" width="24" height="24"/>'),
    /* sidebar: solid glyphs */
    home: PK_IMG('<image href="asset:ic-maison.webp" width="24" height="24"/>'),
    note: PK_IMG('<image href="asset:ic-note.webp" width="24" height="24"/>'),
    tasks: PK_IMG('<image href="asset:ic-liste-a-cocher.webp" width="24" height="24"/>'),
    board: PK_IMG('<image href="asset:ic-board.webp" width="24" height="24"/>'),
    star: PK_SOLID('<path d="m12 2.6 2.9 5.9 6.4.9-4.7 4.5 1.1 6.4L12 17.3l-5.7 3 1.1-6.4-4.7-4.5 6.4-.9z"/>'),
    trash: PK_IMG('<image href="asset:ic-corbeille.webp" width="24" height="24"/>'),
    folder: PK_IMG('<image href="asset:ic-briefcase.webp" width="24" height="24"/>'),
    gear: PK_IMG('<image href="asset:ic-engrenage.webp" width="24" height="24"/>'),
    search: PK_IMG('<image href="asset:ic-loupe.webp" width="24" height="24"/>'),
    plus: '<path d="M12 5v14M5 12h14" stroke-width="2.4"/>',
    /* board tools: sturdy strokes, the select arrow solid as on the concept */
    cursor: PK_IMG('<image href="asset:ic-cursor.webp" width="24" height="24"/>'),
    hand: PK_IMG('<image href="asset:ic-hand.webp" width="24" height="24"/>'),
    pen: PK_IMG('<image href="asset:ic-pencil.webp" width="24" height="24"/>'),
    pencil: PK_IMG('<image href="asset:ic-pencil.webp" width="24" height="24"/>'),
    eraser: PK_IMG('<image href="asset:ic-gomme.webp" width="24" height="24"/>'),
    rect: PK_IMG('<image href="asset:ic-rect.webp" width="24" height="24"/>'),
    ellipse: PK_IMG('<image href="asset:ic-ellipse.webp" width="24" height="24"/>'),
    text: PK_IMG('<image href="asset:ic-text.webp" width="24" height="24"/>'),
    sticky: PK_IMG('<image href="asset:ic-sticky.webp" width="24" height="24"/>'),
    image: PK_IMG('<image href="asset:ic-image.webp" width="24" height="24"/>'),
    frame: PK_IMG('<image href="asset:ic-cadre.webp" width="24" height="24"/>'),
    conn: PK_IMG('<image href="asset:ic-connecteur.webp" width="24" height="24"/>'),
    line: PK_IMG('<image href="asset:ic-fleche.webp" width="24" height="24"/>'),
    todo: PK_IMG('<image href="asset:ic-liste-a-cocher.webp" width="24" height="24"/>'),
    undo: PK_IMG('<image href="asset:ic-annuler.webp" width="24" height="24"/>'),
    redo: PK_IMG('<image href="asset:ic-retablir.webp" width="24" height="24"/>'),
    sliders: PK_LINE('<path d="M4 7h7M15 7h5M4 17h3M11 17h9"/><circle cx="13" cy="7" r="2.2" fill="currentColor"/><circle cx="9" cy="17" r="2.2" fill="currentColor"/>'),
    help: PK_IMG('<image href="asset:ic-aide.webp" width="24" height="24"/>'),
    fit: PK_LINE('<path d="M8 3.5H5.5a2 2 0 0 0-2 2V8M16 3.5h2.5a2 2 0 0 1 2 2V8M3.5 16v2.5a2 2 0 0 0 2 2H8M20.5 16v2.5a2 2 0 0 1-2 2H16"/>'),
    /* the studio: pipette, yellow palette, brush, history, harmony, variations, planche */
    drop: PK_IMG('<image href="asset:ic-pipette.webp" width="24" height="24"/>'),
    palette: PK_IMG('<image href="asset:ic-palette.webp" width="24" height="24"/>'),
    brush: PK_IMG('<image href="asset:ic-pinceau.webp" width="24" height="24"/>'),
    clock: PK_IMG('<image href="asset:ic-horloge.webp" width="24" height="24"/>'),
    harmony: PK_LINE('<circle cx="12" cy="12" r="6.8"/><circle cx="12" cy="5.2" r="2.3" fill="currentColor"/><circle cx="17.9" cy="15.4" r="2.3" fill="currentColor"/><circle cx="6.1" cy="15.4" r="2.3" fill="currentColor"/>'),
    variations: PK_LINE('<circle cx="6.5" cy="12" r="3.4" fill="currentColor"/><path d="M10 12c2 0 2-5 4-5h1M10 12c2 0 2 5 4 5h1"/><circle cx="17.6" cy="7" r="2"/><circle cx="17.6" cy="17" r="2"/>'),
    layout: PK_LINE('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 10h17M10 10v10.5"/>'),
    wheel: '<circle cx="12" cy="12" r="9" fill="#FBF7EE" stroke-width="1.6"/><path d="M12 3a9 9 0 0 1 9 9h-9z" fill="#D7432F" stroke="none"/><path d="M21 12a9 9 0 0 1-9 9v-9z" fill="#2C6BEA" stroke="none"/><path d="M12 21a9 9 0 0 1-9-9h9z" fill="#4E9A5B" stroke="none"/><path d="M3 12a9 9 0 0 1 9-9v9z" fill="#F2C230" stroke="none"/><circle cx="12" cy="12" r="3.6" fill="#FBF7EE" stroke-width="1.6"/><circle cx="12" cy="12" r="9" fill="none" stroke-width="1.6"/>'
  },
  decor: [{ at: 'body', cls: 'pk-land' }],
  /* the brush filter of earlier versions is gone: board items stay crisp vectors; drop its leftover defs */
  apply() { const old = document.getElementById('pk-defs'); if (old) old.remove(); },
  ring: 'patches'
});
