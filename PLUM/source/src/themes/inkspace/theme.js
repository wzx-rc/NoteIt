/* Éclipse (id "inkspace", kept for existing data): the "Éclipse" look of WZX Web. Deep black with grain and two halos
   of light, glass islands with hairline edges, small capitals in mono, titles in Sora, gradients from the accent to a
   second colour turned 75° on the wheel. Light (pearl and white glass) or dark is the user's choice, and so are the
   tint of the backdrop and the accent colour. */
defineTheme({
  id: 'inkspace', order: 2, label: 'Éclipse', desc: 'Verre dépoli, halos de lumière, dégradés',
  mode: 'user', meta: '#07080B', chalk: '#E9EAF0',
  tints: [
    { id: 'vide', name: 'Vide', h: 275, c: .01 },
    { id: 'neutre', name: 'Neutre', h: 275, c: .001 },
    { id: 'abysse', name: 'Abysse', h: 240, c: .03 },
    { id: 'amethyste', name: 'Améthyste', h: 302, c: .032 },
    { id: 'jade', name: 'Jade', h: 168, c: .026 },
    { id: 'braise', name: 'Braise', h: 28, c: .028 }
  ],
  accents: [
    { name: 'Iris', value: '#8C7BFF' }, { name: 'Bleu', value: '#4B8DF8' }, { name: 'Cyan', value: '#22C3E6' }, { name: 'Vert', value: '#2FBF71' },
    { name: 'Ambre', value: '#F5A524' }, { name: 'Corail', value: '#FF6B4A' }, { name: 'Rose', value: '#F0549B' }
  ]
});
