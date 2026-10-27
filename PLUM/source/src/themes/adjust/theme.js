/* Minimal Adjust: the whole app in the look of the drawing studio's tool rail (style.css, "Nature Anthracite").
   Anthracite-olive panels lit from the top with a fine paper grain, warm olive-grey edges, ivory text in Trebuchet,
   the pressed tool as a raised taupe tile, cream for what matters, dry-pastel dabs for the spaces. Always dark,
   like the studio. Icons are Minimal's (two-tone fine line), borrowed when the theme is applied. */
defineTheme({
  id: 'adjust', order: .5, label: 'Minimal Adjust', desc: 'Anthracite et crème, l’atelier partout',
  mode: 'dark', meta: '#202220', chalk: '#E9DECA',
  tints: [
    { id: 'anthracite', name: 'Anthracite', h: 118, c: .007 },
    { id: 'graphite', name: 'Graphite', h: 100, c: .002 },
    { id: 'ardoise', name: 'Ardoise', h: 235, c: .009 },
    { id: 'terre', name: 'Terre', h: 62, c: .011 },
    { id: 'mousse', name: 'Mousse', h: 140, c: .013 },
    { id: 'prune', name: 'Prune', h: 330, c: .009 }
  ],
  accents: [
    { name: 'Crème', value: '#D8C6A1' }, { name: 'Ocre', value: '#E9C46A' }, { name: 'Rose', value: '#D8A7A0' },
    { name: 'Sauge', value: '#8FAE8F' }, { name: 'Sarcelle', value: '#5AA3B0' }, { name: 'Bleu', value: '#8199D2' },
    { name: 'Bronze', value: '#B8925C' }
  ],
  colors: {
    space: ['#E9C46A', '#5AA3B0', '#8199D2', '#D8A7A0', '#8FAE8F', '#B8925C'],
    note: ['#E9D8A6', '#E8C2B4', '#D9C6DE', '#BFD3D6', '#C9D6B5', '#E3D3BC']
  },
  /* the spaces' dots take the studio's pastel dabs: the five masks are drawn by ensureDabs (02c-studio.js) */
  apply(on) {
    const r = document.documentElement.style;
    if (!on) { for (let i = 0; i < 5; i++) r.removeProperty('--dab' + i); return; }
    if (typeof ensureDabs === 'function') ensureDabs();
    const st = document.getElementById('atl-dabs'), m = st ? [...st.textContent.matchAll(/\.blb\.b(\d)\{--m:(url\([^)]*\))\}/g)] : [];
    for (const [, i, u] of m) r.setProperty('--dab' + i, u);
  }
});
/* Minimal's icons, read when the theme is applied (minimal/theme.js is loaded after this file) */
Object.defineProperty(THEMES.adjust, 'icons', { get: () => (THEMES.minimal && THEMES.minimal.icons) || {} });
