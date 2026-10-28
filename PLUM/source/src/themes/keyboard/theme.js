/* Keyboard: the user's "Keyboard of Knob", "UI Design Kit, modern keycap style" and sampler pad boards.
   The app is a piece of hardware: a bead-blasted aluminium plate, black wells, sculpted keycaps in three colours
   (light grey, graphite, signal orange), small LEDs and a fader. Everything is drawn in CSS so it stays crisp at any
   size; theme.css holds the keycap recipe. Type: Orbitron for the legends, Inter for reading. Light (aluminium) or
   dark (anodised black) is the user's choice, and so is the colour of the lit key (the accent). */
defineTheme({
  id: 'keyboard', order: 5, label: 'Keyboard', desc: 'Touches de clavier, aluminium et orange signal',
  mode: 'user', meta: '#C8C8C5', chalk: '#ECECE9', atlInk: '#E4E4E1',
  /* the 20 colours of the scheme (SCHEME_NAMES in 00-util.js): n°5 orange signal for arrows */
  scheme: ['#262626', '#4A4A48', '#8A8A87', '#F7F7F4', '#F2591E', '#D93A2B', '#FF9A66', '#E8C53A', '#4C9A6A', '#3A9E9A',
    '#3C78C8', '#7A62C4', '#D85B86', '#7C5A44', '#FFE7A6', '#FFD9C4', '#F4C0D2', '#E3DCF2', '#D4E2F2', '#D6E9DA'],
  colors: {
    space: ['#F2591E', '#2E2E2D', '#8A8A87', '#E8A33A', '#4C9A6A', '#3C78C8', '#7A62C4', '#D85B86', '#C93A12', '#BDBDBA'],
  },
  palettes: [
    { id: 'kb-alu', tab: 'nature', name: 'Aluminium', scene: 'mountain', cols: ['#ECECE9', '#C8C8C5', '#8A8A87', '#4A4A48', '#1E1E1E'] },
    { id: 'kb-signal', tab: 'nature', name: 'Signal', scene: 'field', cols: ['#FFB27A', '#FF7A3D', '#F2591E', '#C93A12', '#2E2E2D'] },
    { id: 'kb-studio', tab: 'saisons', name: 'Studio', scene: 'forest', cols: ['#F7F7F4', '#F2591E', '#3C78C8', '#E8A33A', '#262626'] }
  ],
  accents: [
    { name: 'Orange signal', value: '#F2591E' }, { name: 'Ambre', value: '#F5A524' }, { name: 'Rouge', value: '#E5341A' }, { name: 'Rose', value: '#F0549B' },
    { name: 'Violet', value: '#8C7BFF' }, { name: 'Bleu', value: '#3C78F0' }, { name: 'Cyan', value: '#22C3E6' }, { name: 'Vert', value: '#2FBF71' }
  ],
  ring: 'grain'
});
