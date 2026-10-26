/* Pokédex: the user's "PokeBoard" and "Pokédex chromatique" concept boards, followed closely.
   The app floats on a painted landscape: a cream sidebar card with the poké ball logo, a white top bar, pages and the
   board on parchment, a white tool dock on the left of the board and a white panel on the right. The drawing studio is
   a set of red devices with cream screens and a charcoal rail; its colour wheel is the theme's own (wheel.js).
   Icons are redrawn: solid glyphs in the sidebar, sturdy rounded strokes on the tools, a yellow palette. Always light. */
const PK_SOLID = s => `<g fill="currentColor" stroke="none" fill-rule="evenodd">${s}</g>`;
const PK_LINE = s => `<g stroke-width="2.1">${s}</g>`;
defineTheme({
  id: 'pokedex', order: 4, label: 'Pokédex', desc: 'PokeBoard : paysage peint, boîtiers rouges',
  mode: 'light', meta: '#F6F0E4', atlInk: '#3A3631', wheel: (el, o) => pkWheel(el, o),
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
    /* sidebar: solid glyphs */
    home: PK_SOLID('<path d="M3.2 10.6 12 3.4l8.8 7.2c.5.4.2 1.2-.4 1.2H19v7.4c0 .9-.7 1.6-1.6 1.6h-3.2v-5.2a.8.8 0 0 0-.8-.8h-2.8a.8.8 0 0 0-.8.8v5.2H6.6c-.9 0-1.6-.7-1.6-1.6v-7.4H3.6c-.6 0-.9-.8-.4-1.2z"/>'),
    note: PK_SOLID('<path d="M6.5 2.8h7.6L19.5 8v11.6c0 .9-.7 1.6-1.6 1.6H6.5c-.9 0-1.6-.7-1.6-1.6V4.4c0-.9.7-1.6 1.6-1.6zM13.4 4v4.2c0 .3.2.5.5.5h4.2zM8 12.2h8v1.6H8zm0 3.4h5.6v1.6H8z"/>'),
    tasks: PK_SOLID('<path d="M6.4 3.2h11.2c1.8 0 3.2 1.4 3.2 3.2v11.2c0 1.8-1.4 3.2-3.2 3.2H6.4c-1.8 0-3.2-1.4-3.2-3.2V6.4c0-1.8 1.4-3.2 3.2-3.2zm9.9 5.5-5.2 5.4-2.6-2.5-1.5 1.5 4.1 4 6.7-6.9z"/>'),
    board: PK_SOLID('<path d="M5.6 3.2h12.8c1.3 0 2.4 1.1 2.4 2.4v12.8c0 1.3-1.1 2.4-2.4 2.4H5.6c-1.3 0-2.4-1.1-2.4-2.4V5.6c0-1.3 1.1-2.4 2.4-2.4zM6.4 6.4v4.4h4.4V6.4zm6.8 0v4.4h4.4V6.4zm-6.8 6.8v4.4h4.4v-4.4zm6.8 0v4.4h4.4v-4.4z"/>'),
    star: PK_SOLID('<path d="m12 2.6 2.9 5.9 6.4.9-4.7 4.5 1.1 6.4L12 17.3l-5.7 3 1.1-6.4-4.7-4.5 6.4-.9z"/>'),
    trash: PK_SOLID('<path d="M9.2 3h5.6l.8 1.8h4.2v2.4H4.2V4.8h4.2zM5.6 8.6h12.8l-.9 11c-.1.9-.8 1.6-1.7 1.6H8.2c-.9 0-1.6-.7-1.7-1.6zm4 2.6v7h1.6v-7zm2.8 0v7H14v-7z"/>'),
    folder: PK_SOLID('<path d="M4.6 4.4h5l2.2 2.2h7.6c.9 0 1.6.7 1.6 1.6v10c0 .9-.7 1.6-1.6 1.6H4.6c-.9 0-1.6-.7-1.6-1.6V6c0-.9.7-1.6 1.6-1.6z"/>'),
    gear: PK_SOLID('<path d="M10.4 2.6h3.2l.5 2.5 1.6.7 2.1-1.4 2.3 2.3-1.4 2.1.7 1.6 2.5.5v3.2l-2.5.5-.7 1.6 1.4 2.1-2.3 2.3-2.1-1.4-1.6.7-.5 2.5h-3.2l-.5-2.5-1.6-.7-2.1 1.4-2.3-2.3 1.4-2.1-.7-1.6-2.5-.5v-3.2l2.5-.5.7-1.6-1.4-2.1 2.3-2.3 2.1 1.4 1.6-.7zM12 8.6a3.4 3.4 0 1 0 0 6.8 3.4 3.4 0 0 0 0-6.8z"/>'),
    search: PK_LINE('<circle cx="10.5" cy="10.5" r="6.3"/><path d="m15.4 15.4 5 5" stroke-width="2.6"/>'),
    plus: '<path d="M12 5v14M5 12h14" stroke-width="2.4"/>',
    /* board tools: sturdy strokes, the select arrow solid as on the concept */
    cursor: '<path d="M6 3.6 18.6 11c.6.4.5 1.3-.2 1.5l-5.2 1.3-2.6 4.8c-.3.6-1.3.6-1.5-.1L5 4.6c-.2-.7.4-1.3 1-1z" fill="currentColor" stroke-width="1.2"/>',
    hand: PK_LINE('<path d="M8 12V6.3a1.5 1.5 0 0 1 3 0V11M11 10.5V4.8a1.5 1.5 0 0 1 3 0v5.7M14 10.5V6.5a1.5 1.5 0 0 1 3 0V14a6.2 6.2 0 0 1-6.2 6.2h-.4a5 5 0 0 1-4.1-2.2L4 14.6a1.5 1.5 0 0 1 2.4-1.8L8 14.5"/>'),
    pen: PK_LINE('<path d="M15.6 4.2a1.9 1.9 0 0 1 2.7 0l1.5 1.5a1.9 1.9 0 0 1 0 2.7L9 19.2 4.2 20l.8-4.8z"/><path d="m13.6 6.2 4.2 4.2"/>'),
    pencil: PK_LINE('<path d="M14.6 5.4 18.6 9.4 8.6 19.4 4.2 20.2 5 15.8z"/><path d="m12.6 7.4 4 4"/>'),
    eraser: PK_LINE('<path d="M8.6 19.6 3.9 14.9a1.6 1.6 0 0 1 0-2.3l8.7-8.7a1.6 1.6 0 0 1 2.3 0l5.2 5.2a1.6 1.6 0 0 1 0 2.3l-8.4 8.2zM20 19.6H8.6"/><path d="M8.6 9.2l6.2 6.2" />'),
    rect: PK_LINE('<rect x="4" y="5" width="16" height="14" rx="2.2"/>'),
    ellipse: PK_LINE('<circle cx="12" cy="12" r="8"/>'),
    text: '<path d="M5.5 7V5h13v2M12 5v14M9 19h6" stroke-width="2.3"/>',
    sticky: PK_LINE('<path d="M5 4h14v10l-5.5 6H5z"/><path d="M13.5 20v-6H19"/>'),
    image: PK_LINE('<rect x="3.5" y="4.5" width="17" height="15" rx="2.6"/><circle cx="9" cy="10" r="1.8" fill="currentColor"/><path d="m20.5 16-5-5-9.5 8.5"/>'),
    frame: PK_LINE('<path d="M7 3.5v17M17 3.5v17M3.5 7h17M3.5 17h17"/>'),
    conn: PK_LINE('<path d="M4.5 19C9 19 9 6 18.5 6"/><path d="m15 3.5 3.5 2.5-2.5 3.5"/>'),
    line: PK_LINE('<path d="M5 19 19 5"/><path d="M13.5 5H19v5.5"/>'),
    todo: PK_LINE('<rect x="3.5" y="3.5" width="17" height="17" rx="3.4"/><path d="m7 8.5 1.5 1.5 3-3M7 15.5l1.5 1.5 3-3M14 8.5h3.5M14 15.5h3.5"/>'),
    undo: PK_LINE('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
    redo: PK_LINE('<path d="m15 14 5-5-5-5"/><path d="M20 9H9.5a5.5 5.5 0 0 0 0 11H13"/>'),
    sliders: PK_LINE('<path d="M4 7h7M15 7h5M4 17h3M11 17h9"/><circle cx="13" cy="7" r="2.2" fill="currentColor"/><circle cx="9" cy="17" r="2.2" fill="currentColor"/>'),
    help: PK_LINE('<circle cx="12" cy="12" r="8.6"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01"/>'),
    fit: PK_LINE('<path d="M8 3.5H5.5a2 2 0 0 0-2 2V8M16 3.5h2.5a2 2 0 0 1 2 2V8M3.5 16v2.5a2 2 0 0 0 2 2H8M20.5 16v2.5a2 2 0 0 1-2 2H16"/>'),
    /* the studio: pipette, yellow palette, brush, history, harmony, variations, planche */
    drop: '<path d="M14.2 4.6a2.3 2.3 0 0 1 3.3 0l1.9 1.9a2.3 2.3 0 0 1 0 3.3l-1.6 1.6-5.2-5.2z" fill="currentColor" stroke-width="1.4"/><path d="m11.2 7.6 5.2 5.2M12.6 9 6 15.6l-1.2 3.6 3.6-1.2L15 11.4" stroke-width="2"/>',
    palette: '<path d="M12 3.4a8.6 8.6 0 0 0 0 17.2c1.4 0 2-1.1 1.4-2.2-.7-1.4.2-2.8 1.7-2.8h2.3a3.2 3.2 0 0 0 3.2-3.2c0-5-3.9-9-8.6-9z" fill="#F2C230" stroke="#3A3631" stroke-width="1.6"/><circle cx="7.8" cy="11" r="1.4" fill="#D7432F" stroke="none"/><circle cx="10.6" cy="7.3" r="1.4" fill="#2C6BEA" stroke="none"/><circle cx="15" cy="7.8" r="1.4" fill="#4E9A5B" stroke="none"/>',
    brush: PK_LINE('<path d="M19.8 4.2c-3 1.4-7 5.8-9 9.4"/><path d="M10.6 13.8a3.1 3.1 0 0 0-4.7 2.6c0 1.5-1 2.5-2.5 3 3 .9 7.6.5 8.6-2.5a3.1 3.1 0 0 0-1.4-3.1z" fill="currentColor"/>'),
    clock: PK_LINE('<circle cx="12" cy="12" r="8.6"/><path d="M12 7.4V12l3.2 2"/>'),
    harmony: PK_LINE('<circle cx="12" cy="12" r="6.8"/><circle cx="12" cy="5.2" r="2.3" fill="currentColor"/><circle cx="17.9" cy="15.4" r="2.3" fill="currentColor"/><circle cx="6.1" cy="15.4" r="2.3" fill="currentColor"/>'),
    variations: PK_LINE('<circle cx="6.5" cy="12" r="3.4" fill="currentColor"/><path d="M10 12c2 0 2-5 4-5h1M10 12c2 0 2 5 4 5h1"/><circle cx="17.6" cy="7" r="2"/><circle cx="17.6" cy="17" r="2"/>'),
    layout: PK_LINE('<rect x="3.5" y="3.5" width="17" height="17" rx="3"/><path d="M3.5 10h17M10 10v10.5"/>'),
    wheel: '<circle cx="12" cy="12" r="9" fill="#FBF7EE" stroke-width="1.6"/><path d="M12 3a9 9 0 0 1 9 9h-9z" fill="#D7432F" stroke="none"/><path d="M21 12a9 9 0 0 1-9 9v-9z" fill="#2C6BEA" stroke="none"/><path d="M12 21a9 9 0 0 1-9-9h9z" fill="#4E9A5B" stroke="none"/><path d="M3 12a9 9 0 0 1 9-9v9z" fill="#F2C230" stroke="none"/><circle cx="12" cy="12" r="3.6" fill="#FBF7EE" stroke-width="1.6"/><circle cx="12" cy="12" r="9" fill="none" stroke-width="1.6"/>'
  },
  decor: [{ at: 'body', cls: 'pk-land' }],
  ring: 'patches'
});
