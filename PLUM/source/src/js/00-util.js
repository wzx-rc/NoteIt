/* ================= helpers ================= */
const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const now = () => performance.now();
const uid = (p = '') => p + Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 7);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const icon = (n, c = '') => `<svg class="i ${c}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const DESKTOP = !!(window.notely && window.notely.platform === 'desktop');
/* 0.2.57: the PC layout differs a little from the iPad one (HUB); CSS keys on html[data-pc] */
if (DESKTOP) document.documentElement.dataset.pc = '1';
const IN_VIEWER = !!window.claude;
/* the iPad app (WKWebView shell) sets this before the page loads */
const IPAD = !!window.__notelyIPad;
function debounce(fn, ms) { let t = 0; const d = (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; d.flush = (...a) => { clearTimeout(t); fn(...a); }; return d; }
function rng(seed) { let s = (Math.floor((seed % 1) * 4294967296) >>> 0) || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
const hex2rgb = h => { h = String(h).replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = hex => { const [r, g, b] = hex2rgb(hex).map(c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const isDarkTheme = () => document.documentElement.dataset.resolved === 'dark';
/* ================= themes =================
   Every theme lives in src/themes/<id>/ (theme.js = this manifest, *.css = its look, assets/ = its pictures) and
   build.mjs adds them all; see src/themes/LISEZMOI.md. The manifest says what CSS cannot: the light/dark mode, the
   colour sets offered by the colour choosers, icons drawn differently, decoration layers and a few board behaviours.
   Every key is optional except id and label; a missing key falls back to the base look (THEME_BASE). */
const THEMES = {};
const THEME_BASE = {
  mode: 'user',              // 'user' = Système / Clair / Sombre in Réglages; 'dark' or 'light' = always that one
  meta: '',                  // <meta name="theme-color">
  chalk: '#ECEAE5',          // near-black ink drawn on a dark sheet
  hand: '',                  // near-black handwritten text on a dark sheet ('' = chalk)
  scheme: null,              // the 20 colours of the theme, in the roles of SCHEME_NAMES (null = SCHEME_BASE)
  colors: {},                // other swatch sets: space (the dots of the spaces)
  palettes: [],              // extra palettes in the atelier, { id, tab: 'nature' | 'saisons', name, scene, cols }
  icons: {},                 // icon name -> SVG markup drawn in a 24×24 box, or { vb: '0 0 w h', svg }
  decor: [],                 // decoration layers: { at: CSS selector of a lasting element, cls } -> <div class="th-decor cls">
  ring: 'grain',             // atelier hue ring: 'grain' (fine pastel grain), 'patches' (touches laid by hand) or 'clean' (plain ring, flat card in the theme's colours)
  mindTags: false,           // mindmap: level-2 ideas as tags on a centred curve, level-1 blocks with an icon
  wheel: null,               // function (el, o) building the theme's own colour wheel instead of Radial (same o, returns { update, el })
  atlInk: '#E6DCC8',         // colour of the brush previews and brush / texture tiles in the atelier (light on the dark atelier)
  harmony: null,             // function ({ base, mode, modes, hues, cols, bh, bs, bv }) giving the harmony module's own HTML (colours keep data-c, modes data-hm)
  penTabs: null,             // quick tabs at the head of the brush panel: pen id, or [pen id, icon name or markup]
  noteSpread: false,         // open a note's pages two by two on a wide screen
  tasks: null,               // function ({ open, done, filters, filter, today }) giving parts of the task page: { head, tabs, before, after } (HTML; a missing part keeps the default)
  taskIcon: null,            // function (task) giving markup shown before the task's title
  docAttrs: null,            // function (doc, space) giving extra attributes for a document card (e.g. data-tint)
  tints: null,               // "Couleur du thème" in Réglages: [{ id, name, h, c }], the hue and chroma of the neutrals, set on <html> as --th-h / --th-c (the first is the default)
  accents: null,             // "Couleur d'accent" in Réglages: [{ name, value }] (the first is the theme's own); another colour sets <html data-accent="custom"> with --accent-c / --on-accent-c
  apply: null                // function (on) called when the theme is put on (true) or taken off (false)
};
function defineTheme(t) { THEMES[t.id] = Object.assign({}, THEME_BASE, t, { colors: Object.assign({}, t.colors) }); }
const themeList = () => Object.values(THEMES).sort((a, b) => (a.order ?? 99) - (b.order ?? 99));
/* the skin id is kept in S.prefs.skin and on <html data-skin>; 'minimal' is the default theme, 'notely' (Nuit) holds the base colours of style.css */
const skin = () => document.documentElement.dataset.skin || 'minimal';
const theme = () => THEMES[skin()] || THEMES.minimal || THEME_BASE;
/* what the user chose for a theme with tints / accents: S.prefs.look[id] = { tint, accent } */
const themeLook = (id, prefs) => (prefs && prefs.look && prefs.look[id]) || {};
/* text colour on an accent: dark on bright colours (yellow, cyan, green), white otherwise */
/* a freely picked theme colour as a tint: its oklch hue, and its chroma brought down to the range of the tint lists */
const tintOf = hex => {
  const [r, g, b] = hex2rgb(hex).map(c => { c /= 255; return c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4); });
  const l = Math.cbrt(.4122214708 * r + .5363325363 * g + .0514459929 * b), m = Math.cbrt(.2119034982 * r + .6806995451 * g + .1073969566 * b), s = Math.cbrt(.0883024619 * r + .2817188376 * g + .6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + .4505937099 * s, B = .0259040371 * l + .7827717662 * m - .808675766 * s;
  const L = .2104542553 * l + .793617785 * m - .0040720468 * s;   // lightness too: the surfaces follow it (--th-ld / --th-ll)
  return { id: 'custom', h: Math.round((Math.atan2(B, A) * 180 / Math.PI + 360) % 360), c: +Math.min(.035, Math.hypot(A, B) * .15).toFixed(4), l: +L.toFixed(3) };
};
const onAccent = hex => lum(hex) > .36 ? '#0B0D12' : '#FFFFFF';
/* ---------- the colour scheme: 20 colours per theme, always in the same roles ----------
   Colour n°1 is the ink, n°5 the theme's own colour (arrows take it), 6–14 the hues, 15–20 the pastels of
   post-its and fills. A theme gives its own 20 in its manifest (scheme); a colour picked from the scheme is
   remembered by its number (item.cs = { key: n }), so switching themes repaints it in the new theme's n°n. */
const SCHEME_NAMES = ['Encre', 'Graphite', 'Gris', 'Blanc', 'Couleur du thème', 'Rouge', 'Orange', 'Jaune', 'Vert', 'Sarcelle', 'Bleu', 'Violet', 'Rose', 'Terre', 'Jaune pâle', 'Pêche', 'Rose pâle', 'Lavande', 'Ciel', 'Menthe'];
const SCHEME_BASE = ['#1E1E1E', '#5F5E5A', '#A3A29C', '#FFFFFF', '#4A72E8', '#E5564B', '#EE8A2F', '#E9B731', '#2FA96A', '#1FA2A0', '#2B5FA8', '#7C5CE0', '#DB5C9A', '#8B6A4F', '#FCE9A6', '#FAD3B5', '#F7CAD6', '#DCD3F5', '#C9DDF7', '#CDEBD3'];
/* the default number of each kind of colour: ink and outlines n°1, arrows n°5, post-its n°15 */
const SCHEME_DEF = { sc: 1, csc: 5, note: 15, text: 1 };
/* the swatch rows the older choosers still show, as numbers of the scheme */
const SCHEME_SETS = { ink: [1, 6, 7, 9, 11, 12, 13, 14], stroke: [1, 5, 6, 9, 11], fill: [17, 20, 19, 15, 4], note: [15, 16, 17, 18, 19, 20, 4, 3], hl: [8, 20, 19, 17, 16, 18], mind: [12, 11, 9, 7, 13, 10, 6, 14] };
const schemeOf = th => (th && Array.isArray(th.scheme) && th.scheme.length >= 20 ? th.scheme : SCHEME_BASE);
const scheme = () => schemeOf(theme());
const schemeHex = n => scheme()[n - 1] || null;
/* the number of a colour in a scheme (0 = not in it) */
const schemeNo = (hex, sch = scheme()) => { const u = String(hex || '').toUpperCase(); const i = u ? sch.findIndex(c => c.toUpperCase() === u) : -1; return i + 1; };
/* "@5" in a saved default means the scheme's n°5 */
const schemeVal = v => typeof v === 'string' && v[0] === '@' ? schemeHex(+v.slice(1)) : v;
/* a swatch set of the current theme: from its scheme (ink, stroke, fill, note, hl, mind), else its own list, else the base one */
const themeColors = (k, base) => SCHEME_SETS[k] ? SCHEME_SETS[k].map(n => scheme()[n - 1]) : theme().colors[k] || base;
/* near-black ink reads as chalk on a dark sheet */
const inkColor = c => isDarkTheme() && lum(c) < .03 ? theme().chalk : c;
/* handwritten annotations can take their own chalk colour */
const textColor = (c, hand) => hand && theme().hand && isDarkTheme() && lum(c) < .03 ? theme().hand : inkColor(c);

/* dates: everything is local YYYY-MM-DD */
const pad2 = n => String(n).padStart(2, '0');
const isoOf = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const today = () => isoOf(new Date());
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00'); d.setDate(d.getDate() + n); return isoOf(d); };
const dayDiff = (a, b) => Math.round((new Date(b + 'T12:00') - new Date(a + 'T12:00')) / 864e5);
const WD = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MO = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const cap1 = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const fmtLong = iso => { const d = new Date(iso + 'T12:00'); return `${cap1(WD[d.getDay()])} ${d.getDate()} ${MO[d.getMonth()]}`; };
const MO3 = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const fmtShort = iso => { const d = new Date(iso + 'T12:00'); return `${d.getDate()} ${MO3[d.getMonth()]}`; };
function dueInfo(iso) {
  if (!iso) return null;
  const d = dayDiff(today(), iso);
  if (d < 0) return { cls: 'late', label: d === -1 ? 'Hier' : 'En retard' };
  if (d === 0) return { cls: 'today', label: "Aujourd'hui" };
  if (d === 1) return { cls: 'tomorrow', label: 'Demain' };
  if (d < 7) return { cls: 'soon', label: cap1(WD[new Date(iso + 'T12:00').getDay()]) };
  return { cls: '', label: fmtShort(iso) };
}
function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.round(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.round(s / 3600)} h`;
  const d = Math.round(s / 86400);
  return d === 1 ? 'hier' : d < 7 ? `il y a ${d} j` : fmtShort(isoOf(new Date(ts)));
}
const fmtSize = n => n < 1024 ? n + ' o' : n < 1048576 ? Math.round(n / 1024) + ' Ko' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0).replace('.', ',') + ' Mo';

/* toast with an optional action */
let toastT = 0;
function toast(msg, action) {
  const t = $('#toast');
  t.innerHTML = `<span>${esc(msg)}</span>`;
  if (action) { const b = document.createElement('button'); b.textContent = action.label; b.onclick = () => { t.classList.remove('on'); action.run(); }; t.append(b); }
  t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), action ? 5200 : 2600);
}

/* popover menus: items = [{label, icon, run, small, danger} | '-' | {head}] */
let popEl = null, popCloser = null;
function closePop() { if (popEl) { popEl.remove(); popEl = null; } if (popCloser) { document.removeEventListener('pointerdown', popCloser, true); popCloser = null; } }
function openPop(anchor, content, opts = {}) {
  closePop();
  const p = document.createElement('div'); p.className = 'pop ' + (opts.cls || ''); p.setAttribute('role', 'menu');
  if (typeof content === 'string') p.innerHTML = content;
  else if (content instanceof Node) p.append(content);
  else for (const it of content) {
    if (it === '-') { p.insertAdjacentHTML('beforeend', '<div class="msep"></div>'); continue; }
    if (it.head) { p.insertAdjacentHTML('beforeend', `<div class="mh">${esc(it.head)}</div>`); continue; }
    const b = document.createElement('button'); b.className = 'mi' + (it.danger ? ' danger' : ''); b.setAttribute('role', 'menuitem');
    b.innerHTML = (it.icon ? icon(it.icon) : it.dot ? `<span class="sdot" style="background:${it.dot}"></span>` : '') + `<span>${esc(it.label)}</span>` + (it.small ? `<small>${esc(it.small)}</small>` : '');
    b.onclick = e => { e.stopPropagation(); if (!it.keep) closePop(); it.run && it.run(); };
    p.append(b);
  }
  document.body.append(p);
  const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : anchor;
  const pw = p.offsetWidth, ph = p.offsetHeight, vw = innerWidth, vh = innerHeight;
  let x = opts.align === 'right' ? r.right - pw : r.left, y = opts.above ? r.top - ph - 6 : r.bottom + 6;
  if (y + ph > vh - 8) y = Math.max(8, r.top - ph - 6);
  if (y < 8) y = 8;
  p.style.left = clamp(x, 8, vw - pw - 8) + 'px'; p.style.top = y + 'px';
  popEl = p;
  popCloser = e => { if (!p.contains(e.target) && !(anchor.contains && anchor.contains(e.target))) closePop(); };
  setTimeout(() => document.addEventListener('pointerdown', popCloser, true), 0);
  const first = p.querySelector('button,input'); if (first && opts.focus !== false) first.focus({ preventScroll: true });
  return p;
}

/* modal */
function openModal(html, onMount) {
  closeModal();
  const s = document.createElement('div'); s.className = 'scrim'; s.id = 'modal';
  s.innerHTML = `<div class="sheet-m" role="dialog" aria-modal="true">${html}</div>`;
  s.addEventListener('pointerdown', e => { if (e.target === s) closeModal(); });
  document.body.append(s);
  $$('[data-close]', s).forEach(b => b.onclick = closeModal);
  onMount && onMount(s.firstElementChild);
  return s.firstElementChild;
}
function closeModal() { const m = $('#modal'); if (m) m.remove(); }
