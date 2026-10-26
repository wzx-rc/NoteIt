/* Pokédex: the user's "PokeBoard" and "Pokédex chromatique" concept boards. Cream paper pages, a cream sidebar,
   the tools and the drawing studio built like a red Pokédex shell (cream screens, charcoal rail, blue lens for the
   current choice), hand-written titles, sketched mountains under the pages. Always light. */
defineTheme({
  id: 'pokedex', order: 4, label: 'Pokédex', desc: 'Boîtier rouge, papier crème, croquis',
  mode: 'light', meta: '#CF3B2B',
  colors: {
    ink: ['#2D2B29', '#D7432F', '#F2A93B', '#4E9A5B', '#2C6BEA', '#7A5BC7', '#E07A9B', '#8A5A3C'],
    stroke: ['#2D2B29', '#D7432F', '#4E9A5B', '#2C6BEA', '#F2A93B'],
    fill: ['#F8C9BE', '#CFE6C3', '#C6DAF7', '#FBE4A3', '#FFFDF8'],
    note: ['#FBE4A3', '#F8C9BE', '#CFE6C3', '#C6DAF7', '#E3D6F3', '#F6D7B8', '#FFFDF8', '#EAE2D3'],
    space: ['#D7432F', '#F2A93B', '#F2C230', '#4E9A5B', '#2FA39A', '#2C6BEA', '#7A5BC7', '#E07A9B', '#8A5A3C', '#6B6358']
  },
  palettes: [
    { id: 'pk-kanto', tab: 'nature', name: 'Kanto', scene: 'field', cols: ['#F4EEE3', '#CFE6C3', '#7FB069', '#3E7D4F', '#F2C230', '#D7432F'] },
    { id: 'pk-starters', tab: 'nature', name: 'Starters', scene: 'forest', cols: ['#E8763A', '#F2A93B', '#5B9BD5', '#2C6BEA', '#7FB069', '#3E7D4F'] }
  ],
  icons: {
    home: '<circle cx="12" cy="12" r="8.2"/><path d="M3.8 12h5.4M14.8 12h5.4"/><circle cx="12" cy="12" r="2.6"/>'
  },
  decor: [{ at: '#main', cls: 'pk-monts' }, { at: '#side', cls: 'pk-ball' }],
  ring: 'patches'
});
