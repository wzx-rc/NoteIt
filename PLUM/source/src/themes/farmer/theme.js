/* Farmer: the user's two cosy-farm concept boards (eco-farm board and farm board), followed closely.
   Cream parchment pages with a faint grid, a dark walnut sidebar like the concept's tool rail, a wooden sign for the
   logo, wooden tabs on the panel titles, sticky notes in yellow / green / blue / peach, the forest green of the
   "Share" button as the accent, vines and leaves around the edges, and the painted isometric farm on the welcome.
   Icons are the kit's painted ones (Gemini extractions of the boards, in assets/): game-asset pictures for the
   sidebar (barn, notebook, clipboard, cork board, sunflower, bucket…), cream glyphs for the board tools on the wood.
   Kalam (felt pen) for titles and handwriting, Nunito for the interface. Always light. */
const FM_IMG = f => ({ vb: '0 0 24 24', svg: `<image href="${f}" width="24" height="24"/>` });
defineTheme({
  id: 'farmer', order: .8, label: 'Farmer', desc: 'Ferme peinte : bois, papier crème, post-it',
  mode: 'light', meta: '#F3EAD7', chalk: '#3B2A1C', hand: '#3B2A1C', atlInk: '#3B2A1C',
  accents: [
    { name: 'Vert prairie', value: '#5B8A3C' }, { name: 'Grange', value: '#B5452F' }, { name: 'Blé', value: '#D9A441' },
    { name: 'Étang', value: '#4F8FB8' }, { name: 'Noyer', value: '#7A4E2D' }, { name: 'Lavande', value: '#8A74B8' }
  ],
  colors: {
    ink: ['#3B2A1C', '#5B8A3C', '#B5452F', '#D9A441', '#4F8FB8', '#7A4E2D', '#E08A4F', '#8A74B8'],
    stroke: ['#3B2A1C', '#5B8A3C', '#B5452F', '#4F8FB8', '#D9A441'],
    fill: ['#F8E7A8', '#D9E8B6', '#C4DFF0', '#F7C7A6', '#FBF5E8'],
    note: ['#F8E7A8', '#D9E8B6', '#C4DFF0', '#F7C7A6', '#E6DAF0', '#FBF5E8', '#EAD9BF'],
    space: ['#5B8A3C', '#B5452F', '#D9A441', '#E08A4F', '#4F8FB8', '#7A4E2D', '#8A74B8', '#6E9E8A', '#C9704F', '#8C7B62']
  },
  palettes: [
    { id: 'fm-pre', tab: 'nature', name: 'Prairie', scene: 'field', cols: ['#7FA55A', '#5B8A3C', '#3F6B2C', '#C9D98C', '#E8D7A0'] },
    { id: 'fm-grange', tab: 'nature', name: 'Grange', scene: 'field', cols: ['#B5452F', '#8E3324', '#6B4A33', '#D9C2A0', '#3B2A1C'] },
    { id: 'fm-recolte', tab: 'saisons', name: 'Récolte', scene: 'forest', cols: ['#D9A441', '#E08A4F', '#C9704F', '#F3D58A', '#7A4E2D'] }
  ],
  icons: {
    /* sidebar and pages: painted game-asset pictures */
    home: FM_IMG('asset:ic-home.webp'),
    note: FM_IMG('asset:ic-note.webp'),
    tasks: FM_IMG('asset:ic-tasks.webp'),
    board: FM_IMG('asset:ic-board.webp'),
    star: FM_IMG('asset:ic-star.webp'),
    trash: FM_IMG('asset:ic-trash.webp'),
    gear: FM_IMG('asset:ic-gear.webp'),
    search: FM_IMG('asset:ic-search.webp'),
    folder: FM_IMG('asset:ic-folder.webp'),
    image: FM_IMG('asset:ic-mood.webp'),
    spark: FM_IMG('asset:ic-spark.webp'),
    cal: FM_IMG('asset:ic-cal.webp'),
    clock: FM_IMG('asset:ic-clock.webp'),
    /* board tools: the cream glyphs of the wooden rail */
    cursor: FM_IMG('asset:ic-cursor.webp'),
    pen: FM_IMG('asset:ic-pencil.webp'),
    pencil: FM_IMG('asset:ic-pencil.webp'),
    text: FM_IMG('asset:ic-text.webp'),
    rect: FM_IMG('asset:ic-shape.webp'),
    sticky: FM_IMG('asset:ic-sticky.webp'),
    conn: FM_IMG('asset:ic-conn.webp'),
    dots: FM_IMG('asset:ic-dots.webp'),
    plus: '<path d="M12 5v14M5 12h14" stroke-width="2.3"/>'
  },
  /* a vine hanging over the top right corner, a sprig at the bottom left of the page */
  decor: [{ at: '#main', cls: 'fm-vine' }, { at: '#main', cls: 'fm-leaf' }]
});
