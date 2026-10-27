/* Nuit (id "notely", kept for existing data): the "Nuit" look of WZX Web. Net and dense, blue-grey neutrals, Inter,
   a blue accent. Light or dark is the user's choice, and so are the tint of the neutrals and the accent colour. */
defineTheme({
  id: 'notely', order: 1, label: 'Nuit', desc: 'Net et dense, gris bleutés, accent bleu',
  mode: 'user', meta: '#12171D', chalk: '#E8ECF1',
  tints: [
    { id: 'ardoise', name: 'Ardoise', h: 250, c: .015 },
    { id: 'graphite', name: 'Graphite', h: 250, c: .002 },
    { id: 'marine', name: 'Marine', h: 262, c: .034 },
    { id: 'prune', name: 'Prune', h: 318, c: .026 },
    { id: 'sapin', name: 'Sapin', h: 172, c: .022 },
    { id: 'moka', name: 'Moka', h: 58, c: .02 }
  ],
  accents: [
    { name: 'Bleu', value: '#4B8DF8' }, { name: 'Iris', value: '#8C7BFF' }, { name: 'Cyan', value: '#22C3E6' }, { name: 'Vert', value: '#2FBF71' },
    { name: 'Ambre', value: '#F5A524' }, { name: 'Corail', value: '#FF6B4A' }, { name: 'Rose', value: '#F0549B' }
  ]
});
