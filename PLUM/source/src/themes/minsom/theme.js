/* Minimal Sommet (0.2.62): Minimal's look (Instrument Sans / Serif, flat surfaces, fine two-tone icons, the user's tint
   and accent) laid out like Sommet: grey sidebar with "Principal" label and tree, profile card with the Clair / Sombre /
   Système switch, foldable Espaces, painted mountain cover on the HUB (replaceable: "Couverture"), sketches in the empty
   states and the project cards. Uses Sommet's somApply() for the sidebar additions. */
const MSO_D = o => `stroke="none" style="fill:var(--i-d,currentColor);opacity:calc(var(--i-dk,1)*${o})"`;
defineTheme({
  id: 'minsom', order: .3, label: 'Minimal Sommet', desc: 'L’allure de Minimal, l’agencement de Sommet',
  apply: on => somApply(on),
  mode: 'user', meta: '#1A1A19', chalk: '#ECEBE8', ring: 'clean',
  /* the 20 colours of the scheme (SCHEME_NAMES in 00-util.js): n°5 bleu ardoise for arrows */
  scheme: ['#1E1E1E', '#5F5E5A', '#A3A29C', '#FFFFFF', '#4A72E8', '#E5564B', '#EE8A2F', '#E9B731', '#2FA96A', '#1FA2A0',
    '#2B5FA8', '#7C5CE0', '#DB5C9A', '#8B6A4F', '#FCE9A6', '#FAD3B5', '#F7CAD6', '#DCD3F5', '#C9DDF7', '#CDEBD3'],
  tints: [
    { id: 'graphite', name: 'Graphite', h: 80, c: .003 },
    { id: 'pierre', name: 'Pierre', h: 70, c: .011 },
    { id: 'ardoise', name: 'Ardoise', h: 250, c: .014 },
    { id: 'sauge', name: 'Sauge', h: 150, c: .013 },
    { id: 'encre', name: 'Encre', h: 268, c: .028 },
    { id: 'prune', name: 'Prune', h: 330, c: .018 }
  ],
  accents: [
    { name: 'Émeraude', value: '#22A55B' }, { name: 'Encre', value: '#3E7BFA' }, { name: 'Iris', value: '#8C7BFF' },
    { name: 'Ambre', value: '#E9A23B' }, { name: 'Corail', value: '#F0644A' }, { name: 'Rose', value: '#E5579A' }
  ],
  icons: {
    home: `<path ${MSO_D(.16)} d="M5.5 10.8 12 5.6l6.5 5.2V19h-4.5v-3.5a2 2 0 0 0-4 0V19H5.5z"/><path d="M4 10.5 12 4l8 6.5V19a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 19z"/><path d="M10 20.5v-5a2 2 0 0 1 4 0v5"/>`,
    tasks: `<rect ${MSO_D(.14)} x="4" y="4" width="16" height="16" rx="4.5"/><rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="m8.6 12.2 2.4 2.4 4.6-4.9"/>`,
    board: `<rect ${MSO_D(.16)} x="3.5" y="3.5" width="7.5" height="9" rx="2"/><rect ${MSO_D(.16)} x="13" y="11" width="7.5" height="9.5" rx="2"/><rect x="3.5" y="3.5" width="7.5" height="9" rx="2"/><rect x="13" y="3.5" width="7.5" height="5.5" rx="2"/><rect x="13" y="11" width="7.5" height="9.5" rx="2"/><rect x="3.5" y="14.5" width="7.5" height="6" rx="2"/>`,
    star: `<path ${MSO_D(.16)} d="M12 3.8 14.45 8.8l5.5.8-4 3.9.95 5.5L12 16.4 7.1 19l.95-5.5-4-3.9 5.5-.8z"/><path d="M12 3.8 14.45 8.8l5.5.8-4 3.9.95 5.5L12 16.4 7.1 19l.95-5.5-4-3.9 5.5-.8z"/>`,
    trash: `<path ${MSO_D(.14)} d="M6.5 7h11l-.8 11.6a2 2 0 0 1-2 1.9H9.3a2 2 0 0 1-2-1.9z"/><path d="M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 11.6a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7M10.2 11v5.5M13.8 11v5.5"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    x: `<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>`,
    check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
    search: `<circle ${MSO_D(.14)} cx="11" cy="11" r="6.5"/><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>`,
    gear: `<circle ${MSO_D(.22)} cx="12" cy="12" r="3"/><path d="M12.22 2.5h-.44a1.9 1.9 0 0 0-1.9 1.9v.17a1.9 1.9 0 0 1-.95 1.64l-.41.24a1.9 1.9 0 0 1-1.9 0l-.14-.08a1.9 1.9 0 0 0-2.6.7l-.21.36a1.9 1.9 0 0 0 .7 2.6l.14.09a1.9 1.9 0 0 1 .95 1.63v.48a1.9 1.9 0 0 1-.95 1.66l-.14.08a1.9 1.9 0 0 0-.7 2.6l.21.36a1.9 1.9 0 0 0 2.6.7l.14-.08a1.9 1.9 0 0 1 1.9 0l.41.24a1.9 1.9 0 0 1 .95 1.64v.17a1.9 1.9 0 0 0 1.9 1.9h.44a1.9 1.9 0 0 0 1.9-1.9v-.17a1.9 1.9 0 0 1 .95-1.64l.41-.24a1.9 1.9 0 0 1 1.9 0l.14.08a1.9 1.9 0 0 0 2.6-.7l.21-.37a1.9 1.9 0 0 0-.7-2.6l-.14-.07a1.9 1.9 0 0 1-.95-1.66v-.47a1.9 1.9 0 0 1 .95-1.66l.14-.08a1.9 1.9 0 0 0 .7-2.6l-.21-.36a1.9 1.9 0 0 0-2.6-.7l-.14.08a1.9 1.9 0 0 1-1.9 0l-.41-.24a1.9 1.9 0 0 1-.95-1.64V4.4a1.9 1.9 0 0 0-1.9-1.9z"/><circle cx="12" cy="12" r="3"/>`,
    spark: `<path ${MSO_D(.18)} d="M11 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z"/><path d="M11 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5zM18.5 15.5v5M16 18h5"/>`,
    focus: `<circle ${MSO_D(.25)} cx="12" cy="12" r="2.8"/><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/><circle cx="12" cy="12" r="2.8"/>`,
    folder: `<path ${MSO_D(.14)} d="M3.5 10h17v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 10h17"/>`,
    text: `<path d="M6 7V5h12v2M12 5v14M9.5 19h5"/>`,
    pen: `<path ${MSO_D(.14)} d="M15 4.5 19.5 9 10 18.5l-5.5 1 1-5.5z"/><path d="M15 4.5 19.5 9 10 18.5l-5.5 1 1-5.5zM12.8 6.7l4.5 4.5M4.5 19.5l3.6-3.6"/>`,
    pencil: `<path ${MSO_D(.14)} d="M15.5 4.5 19.5 8.5 9 19l-5 1 1-5z"/><path d="M15.5 4.5 19.5 8.5 9 19l-5 1 1-5zM13.5 6.5l4 4"/>`,
    eraser: `<path ${MSO_D(.2)} d="m9.2 10.3 5.5 5.5-3.7 3.7H8.5l-4.1-4.1a1.5 1.5 0 0 1 0-2.1z"/><path d="M8.5 19.5 4.4 15.4a1.5 1.5 0 0 1 0-2.1l8.9-8.9a1.5 1.5 0 0 1 2.1 0l4.2 4.2a1.5 1.5 0 0 1 0 2.1l-8.6 8.8zM9.2 10.3l5.5 5.5M8.5 19.5H20"/>`,
    image: `<path ${MSO_D(.16)} d="m4 17.5 5-5 3.5 3.5 2.5-2.5 5 5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4 17.5 5-5 3.5 3.5 2.5-2.5 5 5"/>`,
    mic: `<rect ${MSO_D(.16)} x="9" y="3.5" width="6" height="11" rx="3"/><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6"/>`,
    grid: `<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" opacity=".55"/>`,
    bold: `<path d="M7.5 5h5.25a3.5 3.5 0 0 1 0 7H7.5zM7.5 12h6.25a3.5 3.5 0 0 1 0 7H7.5z"/>`,
    ital: `<path d="M10.5 5H17M7 19h6.5M14 5l-4 14"/>`,
    list: `<circle cx="5.5" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="5.5" cy="17" r="1.1" fill="currentColor" stroke="none"/><path d="M9.5 7h10M9.5 12h10M9.5 17h7"/>`,
    chk: `<rect ${MSO_D(.2)} x="3.5" y="4.5" width="6" height="6" rx="1.6"/><rect x="3.5" y="4.5" width="6" height="6" rx="1.6"/><path d="m5 7.6 1.3 1.3 2.2-2.4"/><rect x="3.5" y="13.5" width="6" height="6" rx="1.6"/><path d="M13 7.5h7.5M13 16.5h7.5"/>`,
    sticky: `<path ${MSO_D(.3)} d="M19.5 14h-5a1 1 0 0 0-1 1v5z"/><path d="M5.5 4.5h13a1 1 0 0 1 1 1V14l-6 6h-8a1 1 0 0 1-1-1V5.5a1 1 0 0 1 1-1zM19.5 14h-5a1 1 0 0 0-1 1v5"/>`,
    undo: `<path d="M8.5 6.5 4.5 10.5l4 4M4.5 10.5h10a4.75 4.75 0 0 1 0 9.5H12"/>`,
    redo: `<path d="m15.5 6.5 4 4-4 4M19.5 10.5h-10a4.75 4.75 0 0 0 0 9.5H12"/>`,
    cal: `<path ${MSO_D(.16)} d="M3.5 7.5a2.5 2.5 0 0 1 2.5-2.5h12a2.5 2.5 0 0 1 2.5 2.5V10h-17z"/><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r=".9" fill="currentColor" stroke="none"/>`,
    clock: `<circle ${MSO_D(.12)} cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
    dots: `<circle cx="6" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.35" fill="currentColor" stroke="none"/>`,
    sun: `<circle ${MSO_D(.2)} cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><path d="M12 2.8v1.8M12 19.4v1.8M2.8 12h1.8M19.4 12h1.8M5.5 5.5l1.3 1.3M17.2 17.2l1.3 1.3M5.5 18.5l1.3-1.3M17.2 6.8l1.3-1.3"/>`,
    moon: `<path ${MSO_D(.18)} d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>`,
    sliders: `<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle ${MSO_D(.2)} cx="15" cy="7" r="2"/><circle ${MSO_D(.2)} cx="9" cy="17" r="2"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`,
    link: `<path d="M10 14a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 5.34l-1.2 1.2M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1.2-1.2"/>`
  }
});
