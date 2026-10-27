/* Keyboard: the user's "Keyboard of Knob", "UI Design Kit, modern keycap style" and sampler pad boards.
   The app is a piece of hardware: a bead-blasted aluminium plate, black wells, sculpted keycaps in three colours
   (light grey, graphite, signal orange), small LEDs and a fader. Everything is drawn in CSS so it stays crisp at any
   size; theme.css holds the keycap recipe. Type: Orbitron for the legends, Inter for reading. Always light. */
defineTheme({
  id: 'keyboard', order: 5, label: 'Keyboard', desc: 'Touches de clavier, aluminium et orange signal',
  mode: 'light', meta: '#C8C8C5', chalk: '#ECECE9', atlInk: '#E4E4E1',
  colors: {
    ink: ['#262626', '#F2591E', '#E8A33A', '#4C9A6A', '#3C78C8', '#7A62C4', '#D85B86', '#7C5A44'],
    hl: ['#FFB27A', '#FFE08A', '#B8E3C4', '#B9D4F2', '#F4C0D2', '#D8CFF2'],
    stroke: ['#262626', '#F2591E', '#4C9A6A', '#3C78C8', '#8A8A87'],
    fill: ['#FFD2BC', '#E4E4E1', '#C9DCEF', '#D2E8D6', '#FFFFFF'],
    note: ['#F7F7F4', '#FFD9C4', '#FFE7A6', '#D6E9DA', '#D4E2F2', '#E3DCF2', '#D9D9D6', '#4A4A48'],
    space: ['#F2591E', '#2E2E2D', '#8A8A87', '#E8A33A', '#4C9A6A', '#3C78C8', '#7A62C4', '#D85B86', '#C93A12', '#BDBDBA'],
    picker: [['#FFFFFF', '#D9D9D6', '#8A8A87', '#262626'], ['#FFE1D2', '#FF9A66', '#F2591E', '#B83C0E']]
  },
  palettes: [
    { id: 'kb-alu', tab: 'nature', name: 'Aluminium', scene: 'mountain', cols: ['#ECECE9', '#C8C8C5', '#8A8A87', '#4A4A48', '#1E1E1E'] },
    { id: 'kb-signal', tab: 'nature', name: 'Signal', scene: 'field', cols: ['#FFB27A', '#FF7A3D', '#F2591E', '#C93A12', '#2E2E2D'] },
    { id: 'kb-studio', tab: 'saisons', name: 'Studio', scene: 'forest', cols: ['#F7F7F4', '#F2591E', '#3C78C8', '#E8A33A', '#262626'] }
  ],
  ring: 'grain'
});
