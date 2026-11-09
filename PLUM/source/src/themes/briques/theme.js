/* Briques (0.2.66): a toy construction-brick world. Sommet's layout (grey baseplate sidebar, profile card with the
   Clair / Sombre / Système switch, foldable Espaces, painted cover on the HUB, illustrations in the empty states and the
   project cards) dressed in glossy plastic: bricks with studs for what is active and for the main buttons (studs.css),
   Fredoka and Rubik, brick red accent. Icons: chunky lines with a second tone in a primary brick colour (BRQ_D),
   the main ones redrawn as bricks and plates. Uses Sommet's somApply() for the sidebar additions. */
const BRQ_D = (o, c = 'currentColor') => `stroke="none" style="fill:var(--i-d,${c});opacity:calc(var(--i-dk,1)*${o})"`;
/* the primary bricks: red, yellow, blue, green */
const BRQ_C = { r: '#D7261E', y: '#F6C700', b: '#1E5AA8', g: '#00852B', o: '#F57D20' };
const BRQ_DX = o => BRQ_D(Math.min(.5, o * 2.4));
const BRQ_STUDS = (x, y, n, gap = 4) => Array.from({ length: n }, (_, k) => `<rect x="${x + k * gap}" y="${y}" width="3" height="2.6" rx=".8"/>`).join('');
defineTheme({
  id: 'briques', order: .9, label: 'Briques', desc: 'Briques de construction, tenons et couleurs vives',
  apply: on => somApply(on),
  mode: 'user', meta: '#D7261E', chalk: '#E9ECF1', ring: 'clean',
  /* the 20 colours of the scheme (SCHEME_NAMES in 00-util.js): the brick colours; n°5 blue for arrows */
  scheme: ['#1B1D21', '#5B6270', '#A0A5A9', '#FFFFFF', '#1E5AA8', '#D7261E', '#F57D20', '#F6C700', '#00852B', '#069D9F',
    '#0055BF', '#7A4DB2', '#E4569A', '#7C503A', '#FDEA8F', '#F9BA8E', '#F6B6CF', '#C9C2EA', '#9FC3E9', '#A5D9A0'],
  tints: [
    { id: 'plaque', name: 'Plaque grise', h: 255, c: .012 },
    { id: 'blanc', name: 'Blanc', h: 255, c: .003 },
    { id: 'sable', name: 'Sable', h: 85, c: .02 },
    { id: 'ciel', name: 'Ciel', h: 240, c: .03 },
    { id: 'herbe', name: 'Herbe', h: 145, c: .028 }
  ],
  accents: [
    { name: 'Rouge brique', value: '#D7261E' }, { name: 'Bleu', value: '#1E5AA8' }, { name: 'Vert', value: '#00852B' },
    { name: 'Jaune', value: '#F6C700' }, { name: 'Orange', value: '#F57D20' }, { name: 'Violet', value: '#7A4DB2' }
  ],
  icons: {
    /* redrawn as bricks and plates */
    home: `<path ${BRQ_D(.5, BRQ_C.r)} d="M3.5 11.2 12 4.5l8.5 6.7z"/><path d="M3.5 11.2 12 4.5l8.5 6.7z"/><rect x="5.5" y="11.2" width="13" height="9.3" rx="1.4"/><path d="M10.2 20.5v-4.3a1.8 1.8 0 0 1 3.6 0v4.3"/><rect x="15" y="4" width="2.6" height="3.6" rx=".7"/>`,
    note: `<rect ${BRQ_D(.45, BRQ_C.y)} x="5" y="5" width="14" height="15.5" rx="2"/>${BRQ_STUDS(7.3, 2.4, 3, 3.6)}<rect x="5" y="5" width="14" height="15.5" rx="2"/><path d="M8.5 11h7M8.5 14.5h5"/>`,
    tasks: `<rect ${BRQ_D(.45, BRQ_C.g)} x="3.5" y="8.5" width="17" height="11.5" rx="2"/>${BRQ_STUDS(6, 5.6, 2, 9)}<rect x="3.5" y="8.5" width="17" height="11.5" rx="2"/><path d="m8.4 14.3 2.4 2.4 4.8-4.8"/>`,
    board: `<rect ${BRQ_D(.42, BRQ_C.b)} x="3" y="5" width="18" height="14" rx="2.2"/><rect x="3" y="5" width="18" height="14" rx="2.2"/><circle cx="7.5" cy="9.5" r="1.6"/><circle cx="12" cy="9.5" r="1.6"/><circle cx="16.5" cy="9.5" r="1.6"/><circle cx="7.5" cy="14.5" r="1.6"/><circle cx="12" cy="14.5" r="1.6"/><circle cx="16.5" cy="14.5" r="1.6"/>`,
    star: `<path ${BRQ_D(.6, BRQ_C.y)} d="M12 3.6 14.5 8.7l5.6.8-4 4 .9 5.6L12 16.5l-5 2.6.9-5.6-4-4 5.6-.8z"/><path stroke-linejoin="round" d="M12 3.6 14.5 8.7l5.6.8-4 4 .9 5.6L12 16.5l-5 2.6.9-5.6-4-4 5.6-.8z"/>`,
    folder: `<path ${BRQ_D(.45, BRQ_C.o)} d="M3.5 10h17v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 8a2 2 0 0 1 2-2h3.6l2 2h7.4a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 10.5h17"/>`,
    sticky: `<path ${BRQ_D(.5, BRQ_C.y)} d="M5 6.5h14v8l-5.5 5.5H5z"/>${BRQ_STUDS(7.3, 3.8, 3, 3.6)}<path d="M5 6.5h14v8l-5.5 5.5H5zM19 14.5h-4.5a1 1 0 0 0-1 1V20"/>`,
    inbox: `<path ${BRQ_D(.4, BRQ_C.b)} d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/><path d="M3.5 13.5 6 6.5a1.5 1.5 0 0 1 1.4-1h9.2a1.5 1.5 0 0 1 1.4 1l2.5 7V18a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2zM3.5 13.5h5l1.5 2.5h4l1.5-2.5h5"/>`,
    spark: `<path ${BRQ_D(.55, BRQ_C.y)} d="M11 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5z"/><path d="M11 3.5c.6 4.3 2.2 5.9 6.5 6.5-4.3.6-5.9 2.2-6.5 6.5-.6-4.3-2.2-5.9-6.5-6.5 4.3-.6 5.9-2.2 6.5-6.5zM18.5 15.5v5M16 18h5"/>`,
    /* Minimal's drawings with a stronger second tone */
    trash: `<path ${BRQ_DX(.14)} d="M6.5 7h11l-.8 11.6a2 2 0 0 1-2 1.9H9.3a2 2 0 0 1-2-1.9z"/><path d="M4.5 7h15M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7M6.5 7l.8 11.6a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9L17.5 7M10.2 11v5.5M13.8 11v5.5"/>`,
    plus: `<path d="M12 5v14M5 12h14"/>`,
    x: `<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>`,
    check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
    search: `<circle ${BRQ_DX(.14)} cx="11" cy="11" r="6.5"/><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/>`,
    gear: `<circle ${BRQ_DX(.22)} cx="12" cy="12" r="3"/><path d="M12.22 2.5h-.44a1.9 1.9 0 0 0-1.9 1.9v.17a1.9 1.9 0 0 1-.95 1.64l-.41.24a1.9 1.9 0 0 1-1.9 0l-.14-.08a1.9 1.9 0 0 0-2.6.7l-.21.36a1.9 1.9 0 0 0 .7 2.6l.14.09a1.9 1.9 0 0 1 .95 1.63v.48a1.9 1.9 0 0 1-.95 1.66l-.14.08a1.9 1.9 0 0 0-.7 2.6l.21.36a1.9 1.9 0 0 0 2.6.7l.14-.08a1.9 1.9 0 0 1 1.9 0l.41.24a1.9 1.9 0 0 1 .95 1.64v.17a1.9 1.9 0 0 0 1.9 1.9h.44a1.9 1.9 0 0 0 1.9-1.9v-.17a1.9 1.9 0 0 1 .95-1.64l.41-.24a1.9 1.9 0 0 1 1.9 0l.14.08a1.9 1.9 0 0 0 2.6-.7l.21-.37a1.9 1.9 0 0 0-.7-2.6l-.14-.07a1.9 1.9 0 0 1-.95-1.66v-.47a1.9 1.9 0 0 1 .95-1.66l.14-.08a1.9 1.9 0 0 0 .7-2.6l-.21-.36a1.9 1.9 0 0 0-2.6-.7l-.14.08a1.9 1.9 0 0 1-1.9 0l-.41-.24a1.9 1.9 0 0 1-.95-1.64V4.4a1.9 1.9 0 0 0-1.9-1.9z"/><circle cx="12" cy="12" r="3"/>`,
    focus: `<circle ${BRQ_DX(.25)} cx="12" cy="12" r="2.8"/><path d="M4 8.5V6a2 2 0 0 1 2-2h2.5M15.5 4H18a2 2 0 0 1 2 2v2.5M20 15.5V18a2 2 0 0 1-2 2h-2.5M8.5 20H6a2 2 0 0 1-2-2v-2.5"/><circle cx="12" cy="12" r="2.8"/>`,
    text: `<path d="M6 7V5h12v2M12 5v14M9.5 19h5"/>`,
    pen: `<path ${BRQ_DX(.14)} d="M15 4.5 19.5 9 10 18.5l-5.5 1 1-5.5z"/><path d="M15 4.5 19.5 9 10 18.5l-5.5 1 1-5.5zM12.8 6.7l4.5 4.5M4.5 19.5l3.6-3.6"/>`,
    pencil: `<path ${BRQ_DX(.14)} d="M15.5 4.5 19.5 8.5 9 19l-5 1 1-5z"/><path d="M15.5 4.5 19.5 8.5 9 19l-5 1 1-5zM13.5 6.5l4 4"/>`,
    eraser: `<path ${BRQ_DX(.2)} d="m9.2 10.3 5.5 5.5-3.7 3.7H8.5l-4.1-4.1a1.5 1.5 0 0 1 0-2.1z"/><path d="M8.5 19.5 4.4 15.4a1.5 1.5 0 0 1 0-2.1l8.9-8.9a1.5 1.5 0 0 1 2.1 0l4.2 4.2a1.5 1.5 0 0 1 0 2.1l-8.6 8.8zM9.2 10.3l5.5 5.5M8.5 19.5H20"/>`,
    image: `<path ${BRQ_DX(.16)} d="m4 17.5 5-5 3.5 3.5 2.5-2.5 5 5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18z"/><rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><circle cx="9" cy="9.5" r="1.6"/><path d="m4 17.5 5-5 3.5 3.5 2.5-2.5 5 5"/>`,
    mic: `<rect ${BRQ_DX(.16)} x="9" y="3.5" width="6" height="11" rx="3"/><rect x="9" y="3.5" width="6" height="11" rx="3"/><path d="M6 11a6 6 0 0 0 12 0M12 17v3.5M9 20.5h6"/>`,
    grid: `<rect x="4" y="4" width="16" height="16" rx="2.5"/><path d="M4 9.5h16M4 14.5h16M9.5 4v16M14.5 4v16" opacity=".55"/>`,
    bold: `<path d="M7.5 5h5.25a3.5 3.5 0 0 1 0 7H7.5zM7.5 12h6.25a3.5 3.5 0 0 1 0 7H7.5z"/>`,
    ital: `<path d="M10.5 5H17M7 19h6.5M14 5l-4 14"/>`,
    list: `<circle cx="5.5" cy="7" r="1.1" fill="currentColor" stroke="none"/><circle cx="5.5" cy="12" r="1.1" fill="currentColor" stroke="none"/><circle cx="5.5" cy="17" r="1.1" fill="currentColor" stroke="none"/><path d="M9.5 7h10M9.5 12h10M9.5 17h7"/>`,
    chk: `<rect ${BRQ_DX(.2)} x="3.5" y="4.5" width="6" height="6" rx="1.6"/><rect x="3.5" y="4.5" width="6" height="6" rx="1.6"/><path d="m5 7.6 1.3 1.3 2.2-2.4"/><rect x="3.5" y="13.5" width="6" height="6" rx="1.6"/><path d="M13 7.5h7.5M13 16.5h7.5"/>`,
    undo: `<path d="M8.5 6.5 4.5 10.5l4 4M4.5 10.5h10a4.75 4.75 0 0 1 0 9.5H12"/>`,
    redo: `<path d="m15.5 6.5 4 4-4 4M19.5 10.5h-10a4.75 4.75 0 0 0 0 9.5H12"/>`,
    cal: `<path ${BRQ_DX(.16)} d="M3.5 7.5a2.5 2.5 0 0 1 2.5-2.5h12a2.5 2.5 0 0 1 2.5 2.5V10h-17z"/><rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/><circle cx="12" cy="15" r=".9" fill="currentColor" stroke="none"/>`,
    clock: `<circle ${BRQ_DX(.12)} cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
    dots: `<circle cx="6" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.35" fill="currentColor" stroke="none"/><circle cx="18" cy="12" r="1.35" fill="currentColor" stroke="none"/>`,
    sun: `<circle ${BRQ_DX(.2)} cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="4"/><path d="M12 2.8v1.8M12 19.4v1.8M2.8 12h1.8M19.4 12h1.8M5.5 5.5l1.3 1.3M17.2 17.2l1.3 1.3M5.5 18.5l1.3-1.3M17.2 6.8l1.3-1.3"/>`,
    moon: `<path ${BRQ_DX(.18)} d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/><path d="M19.5 14.5A7.5 7.5 0 0 1 9.5 4.5a7.5 7.5 0 1 0 10 10z"/>`,
    sliders: `<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle ${BRQ_DX(.2)} cx="15" cy="7" r="2"/><circle ${BRQ_DX(.2)} cx="9" cy="17" r="2"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>`,
    link: `<path d="M10 14a4 4 0 0 0 5.66 0l3-3A4 4 0 0 0 13 5.34l-1.2 1.2M14 10a4 4 0 0 0-5.66 0l-3 3A4 4 0 0 0 11 18.66l1.2-1.2"/>`
  }
});
