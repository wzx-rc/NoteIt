/* ================= UI Design (0.2.40, button 0.2.46) =================
   A zone of the board (a frame with `ui`) where software interfaces are built the Qt Designer way, from few blocks:
   - box     « Conteneur » : a widget that holds others through a layout (none, horizontal, vertical, grid), with margins and spacing
   - button  « Bouton »    : a very rich style (type, icon, fill, gradient, border, corner radii, shadows, states hover / pressed / disabled)
   - text    « Texte »     : a label
   - spacer  « Espaceur »  : the layout's spring
   Item: { k: 'uic', t, x, y, w, h, p: parent box id, o: order in the parent, lp: layout item props, hw / hh: preferred size (0 = from the content) }
   The geometry of every block inside a layout is computed by uiLayout (Qt's size policies, minimum / maximum sizes, stretch factors). */
const UI_FIDS = [['sketch', 'Croquis'], ['wire', 'Wireframe'], ['theme', 'Visuel']];
const UI_TYPES = { box: 'Conteneur', button: 'Bouton', text: 'Texte', spacer: 'Espaceur' };
const UI_HINTS = { box: 'Contient d’autres blocs, rangés par un layout', button: 'Un bouton au style entièrement réglable', text: 'Un libellé, un titre, un paragraphe', spacer: 'Le ressort du layout : pousse les blocs' };
const UI_INF = 1e6;
const UI_FONTS = ['Figtree', 'Inter', 'Segoe UI', 'Jost', 'Georgia', 'Instrument Serif', 'JetBrains Mono', 'Caveat', 'Arial', 'Verdana', 'Courier New'];
const UI_TXT = { ff: 'Figtree', fs: 13, fw: 400, fi: 0, fg: '#2B2B2BFF', ta: 'left', va: 'center', lh: 1.35, ls: 0, tt: 'none', td: 'none', wr: 'wrap' };
const UI_BOX = { sk: 'panel', title: 'Panneau', lay: 'v', m: [12, 12, 12, 12], sp: 8, sv: 8, cols: 2, cst: '', ca: 'start', bg: '#FFFFFFFF', bc: '#0000001F', bw: 1, r: 8, sh: 0, tb: '#F2F1EEFF', tf: '#2B2B2BFF' };
const UI_SKINS = [['none', 'Nu'], ['panel', 'Panneau'], ['group', 'Groupe'], ['window', 'Fenêtre'], ['dialog', 'Dialogue']];
const UI_LAYS = [['none', 'Aucun', 'Les blocs restent où vous les posez'], ['h', 'Horizontal', 'Les blocs se rangent en ligne'], ['v', 'Vertical', 'Les blocs se rangent en colonne'], ['grid', 'Grille', 'Les blocs se rangent en grille']];
/* Qt's size policies */
const UI_POL = [['fix', 'Fixe', 'Toujours sa taille préférée'], ['min', 'Minimum', 'Au moins sa taille préférée, peut grandir'], ['max', 'Maximum', 'Au plus sa taille préférée, peut rétrécir'], ['pref', 'Préférée', 'Sa taille préférée, peut grandir ou rétrécir'], ['exp', 'Extensible', 'Prend toute la place libre'], ['ign', 'Ignorée', 'Ignore sa taille préférée, prend la place libre']];
const UI_LP = { button: { ph: 'min', pv: 'fix' }, text: { ph: 'pref', pv: 'pref' }, box: { ph: 'pref', pv: 'pref' } };
/* icons: 24 px strokes */
const UI_ICONS = {
  plus: 'M12 5v14M5 12h14', check: 'M5 12.5l4.5 4.5L19 7.5', x: 'M6 6l12 12M18 6L6 18', right: 'M5 12h14M13 6l6 6-6 6', left: 'M19 12H5M11 6l-6 6 6 6',
  down: 'M6 9l6 6 6-6', search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-4-4', play: 'M8 5l11 7-11 7z', pause: 'M8 5v14M16 5v14',
  save: 'M5 4h11l3 3v13H5zM8 4v5h7V4M8 20v-6h8v6', dl: 'M12 4v11M7 10l5 5 5-5M5 20h14', ul: 'M12 20V9M7 14l5-5 5 5M5 4h14',
  gear: 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13', star: 'M12 3l2.8 5.8 6.2.9-4.5 4.4 1 6.2L12 17.4 6.5 20.3l1-6.2L3 9.7l6.2-.9z',
  heart: 'M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z', folder: 'M3 6h6l2 2h10v11H3z', user: 'M12 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM4 21c1-4 4-6 8-6s7 2 8 6',
  home: 'M3 11l9-7 9 7M6 9v11h12V9', edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4', eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  lock: 'M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3', bell: 'M6 16V11a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0', menu: 'M4 6h16M4 12h16M4 18h16',
  dots: 'M5 12h.01M12 12h.01M19 12h.01', link: 'M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1', refresh: 'M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5'
};
const ukIcon = (k, sz, col) => UI_ICONS[k] ? `<svg class="uk-ic" viewBox="0 0 24 24" width="${sz}" height="${sz}" fill="none" stroke="${col || 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="${UI_ICONS[k]}"/></svg>` : '';
const ukClone = o => JSON.parse(JSON.stringify(o));
function mkUic(t, x, y, o = {}) {
  const it = { id: uid('u'), k: 'uic', t, x: Math.round(x / 4) * 4, y: Math.round(y / 4) * 4, w: 120, h: 32 };
  if (t === 'box') { it.c = Object.assign(ukClone(UI_BOX), o.c || {}); it.w = o.w || 360; it.h = o.h || 240; }
  if (t === 'button') { it.txt = 'Valider'; it.b = ukClone(UI_BTN); it.bs = UI_BTN_ST(); }
  if (t === 'text') { it.txt = 'Libellé'; it.f = ukClone(UI_TXT); }
  if (t === 'spacer') { it.w = 40; it.h = 20; }
  return it;
}
/* colours are stored as #RRGGBBAA */
const ukHex = c => { c = String(c || '#000000'); if (/^#[0-9a-f]{3}$/i.test(c)) c = '#' + [...c.slice(1)].map(x => x + x).join(''); if (/^#[0-9a-f]{6}$/i.test(c)) c += 'FF'; return /^#[0-9a-f]{8}$/i.test(c) ? c.toUpperCase() : '#000000FF'; };
const ukRgb = c => ukHex(c).slice(0, 7), ukAlpha = c => parseInt(ukHex(c).slice(7), 16) / 255;
const ukMix = (rgb, a) => ukHex(rgb).slice(0, 7) + Math.round(clamp(a, 0, 1) * 255).toString(16).padStart(2, '0').toUpperCase();
const ukCss = c => { const h = ukHex(c), a = ukAlpha(h); return a >= 1 ? h.slice(0, 7) : `rgba(${parseInt(h.slice(1, 3), 16)},${parseInt(h.slice(3, 5), 16)},${parseInt(h.slice(5, 7), 16)},${+a.toFixed(3)})`; };
const ukFont = f => /\s/.test(f) ? `"${f}"` : f;

/* ---------- the button (0.2.46): Figma-like parameters, no presets ----------
   paint (fills, text, stroke): { t: solid | lin | rad | ang | dia, c, s: [[pos %, colour]...], a: angle, cx, cy: centre %, sz: size %, op: opacity %, on, bm: blend }
   stroke: { on, p: paint, w: [top, right, bottom, left], pos: in | center | out, st: solid | dashed | dotted, da, ga, cap }
   fx: effects, top first: drop, inner, glow, ring, bevel, tshadow, shine, noise, blur, bgblur
   A state (h: survol, p: pressé, d: désactivé) replaces whole top-level keys (fills, stroke, fx, op…). */
const ukN = (v, d) => v == null || v === '' || !isFinite(+v) ? d : +v;
const ukP = (c, o = {}) => Object.assign({ t: 'solid', c: ukHex(c), s: [[0, ukHex(c)], [100, ukMix(ukRgb(c), 0)]], a: 180, cx: 50, cy: 50, sz: 100, op: 100, on: 1, bm: 'normal' }, o);
const ukG = (t, a, s, o = {}) => ukP(s[0][1], Object.assign({ t, a, s: s.map(([p, c]) => [p, ukHex(c)]) }, o));
const UI_FX = { drop: 'Ombre portée', inner: 'Ombre interne', glow: 'Lueur externe', ring: 'Contour lumineux', bevel: 'Biseau', tshadow: 'Ombre du texte', shine: 'Reflet', noise: 'Grain', blur: 'Flou du calque', bgblur: 'Flou d’arrière-plan' };
const UI_FX0 = { drop: { x: 0, y: 4, b: 12, s: 0, c: '#00000040' }, inner: { x: 0, y: 1, b: 0, s: 0, c: '#FFFFFF59' }, glow: { b: 16, s: 0, c: '#E8955C99' }, ring: { s: 1.5, b: 10, c: '#4FF5D2CC' },
  bevel: { d: 2, a: 90, b: 2, c: '#FFFFFF66', c2: '#00000033' }, tshadow: { x: 0, y: 1, b: 2, c: '#00000040' }, shine: { c: '#FFFFFF59', w: 30, a: 110, p: 50, anim: 0 }, noise: { op: 12, f: 80, bm: 'overlay' }, blur: { b: 2 }, bgblur: { b: 12 } };
const ukFx = (t, o = {}) => Object.assign({ t, on: 1 }, ukClone(UI_FX0[t] || {}), o);
const UI_BLEND = [['normal', 'Normal'], ['multiply', 'Produit'], ['screen', 'Superposition'], ['overlay', 'Incrustation'], ['darken', 'Obscurcir'], ['lighten', 'Éclaircir'], ['color-dodge', 'Densité couleur −'], ['color-burn', 'Densité couleur +'],
  ['soft-light', 'Lumière tamisée'], ['hard-light', 'Lumière crue'], ['difference', 'Différence'], ['exclusion', 'Exclusion'], ['hue', 'Teinte'], ['saturation', 'Saturation'], ['color', 'Couleur'], ['luminosity', 'Luminosité']];
const UI_PAINTS = [['solid', 'Uni'], ['lin', 'Linéaire'], ['rad', 'Radial'], ['ang', 'Angulaire'], ['dia', 'Losange']];
const UI_BTN = {
  ff: 'Figtree', fs: 13, fw: 600, fi: 0, lh: 120, ls: 0, tt: 'none', td: 'none', ta: 'center', tabs: 0, lig: 1, smc: 0, trunc: 0,
  tp: ukP('#FFFFFF'), tsw: 0, tsc: '#00000066',
  ic: '', ip: 'l', isz: 16, ig: 8, icc: '#FFFFFF00',
  px: 16, py: 8, r: [8, 8, 8, 8], sm: 0, op: 100, bm: 'normal',
  fills: [ukG('lin', 180, [[0, '#F2A56E'], [100, '#D9773F']])],
  stroke: { on: 1, p: ukP('#FFFFFF29'), w: [1, 1, 1, 1], pos: 'in', st: 'solid', da: 6, ga: 4, cap: 'butt' },
  fx: [ukFx('drop', { y: 4, b: 12, c: '#D9773F59' }), ukFx('inner', { y: 1, c: '#FFFFFF59' })],
  dy: 0, sc: 100, tr: 120
};
const UI_BTN_ST = () => ({
  h: { fills: [ukG('lin', 180, [[0, '#F6B482'], [100, '#E0844C']])], fx: [ukFx('drop', { y: 6, b: 18, c: '#D9773F73' }), ukFx('inner', { y: 1, c: '#FFFFFF66' })] },
  p: { fills: [ukG('lin', 180, [[0, '#D9773F'], [100, '#C4652F']])], fx: [ukFx('inner', { y: 2, b: 4, c: '#00000038' })], dy: 1 },
  d: { op: 50, fx: [] }
});
const ukBtnStyle = (it, st) => Object.assign({}, UI_BTN, it.b || {}, st && st !== 'n' && it.bs ? it.bs[st] || {} : {});
/* the buttons of 0.2.40–0.2.45 had a flat style (ft, c1, c2, bw, sho…): turned into the new one */
function ukFromFlat(o) {
  const L = Object.assign({ ff: 'Figtree', fs: 13, fw: 600, fi: 0, ls: 0, lh: 1.2, tt: 'none', ta: 'center', td: 'none', fg: '#FFFFFFFF', ic: '', ip: 'l', isz: 16, ig: 8, icc: '', px: 16, py: 8, r: [8, 8, 8, 8], ft: 'solid', c1: '#E8955CFF', c2: '#C96A3AFF', ga: 180,
    bw: 0, bst: 'solid', bc: '#00000026', sho: 1, shx: 0, shy: 2, shb: 6, shs: 0, shc: '#0000002E', iso: 0, isx: 0, isy: 1, isb: 0, iss: 0, isc: '#FFFFFF59', tso: 0, tsx: 0, tsy: 1, tsb: 2, tsc: '#00000040', op: 1, bl: 0, dy: 0, sc: 1, tr: 120 }, o);
  const fx = [];
  if (+L.sho) fx.push(ukFx('drop', { x: L.shx, y: L.shy, b: L.shb, s: L.shs, c: L.shc }));
  if (+L.iso) fx.push(ukFx('inner', { x: L.isx, y: L.isy, b: L.isb, s: L.iss, c: L.isc }));
  if (+L.tso) fx.push(ukFx('tshadow', { x: L.tsx, y: L.tsy, b: L.tsb, c: L.tsc }));
  if (+L.bl) fx.push(ukFx('bgblur', { b: L.bl }));
  return { ff: L.ff, fs: L.fs, fw: L.fw, fi: L.fi, lh: Math.round(L.lh * 100), ls: +((L.ls / Math.max(1, L.fs)) * 100).toFixed(1), tt: L.tt, td: L.td, ta: L.ta, tabs: 0, lig: 1, smc: 0, trunc: 0,
    tp: ukP(L.fg), tsw: 0, tsc: '#00000066', ic: L.ic, ip: L.ip, isz: L.isz, ig: L.ig, icc: L.icc || '#FFFFFF00', px: L.px, py: L.py, r: (L.r || [0, 0, 0, 0]).slice(), sm: 0, op: Math.round(L.op * 100), bm: 'normal',
    fills: L.ft === 'none' ? [] : L.ft === 'solid' ? [ukP(L.c1)] : [ukG(L.ft === 'rad' ? 'rad' : 'lin', L.ga, [[0, L.c1], [100, L.c2]])],
    stroke: { on: +L.bw > 0 ? 1 : 0, p: ukP(L.bc), w: [L.bw, L.bw, L.bw, L.bw].map(v => +v || 1), pos: 'in', st: L.bst === 'double' ? 'solid' : L.bst, da: 6, ga: 4, cap: 'butt' },
    fx, dy: L.dy, sc: Math.round(L.sc * 100), tr: L.tr };
}
function ukBtnMig(it) {
  if (it.t !== 'button' || !it.b || Array.isArray(it.b.fills)) return it;
  const b = ukFromFlat(it.b), bs = {};
  for (const st of ['h', 'p', 'd']) { const o = it.bs && it.bs[st]; if (!o || !Object.keys(o).length) continue; const full = ukFromFlat(Object.assign({}, it.b, o)), d = {}; for (const k in full) if (JSON.stringify(full[k]) !== JSON.stringify(b[k])) d[k] = full[k]; bs[st] = d; }
  return Object.assign({}, it, { b, bs });
}
/* a paint as background layers: [{ i: image, z: size, q: position }] */
const ukFade = (c, f) => ukMix(ukRgb(c), ukAlpha(c) * f);
const ukSorted = p => { let s = (p.s && p.s.length ? p.s : [[0, p.c], [100, p.c]]).slice().sort((a, b) => a[0] - b[0]); if (s.length === 1) s = [s[0], [100, s[0][1]]]; return s; };
const ukStops = (p, f, k = 1, o = 0) => ukSorted(p).map(([q, c]) => `${ukCss(ukFade(c, f))} ${+(o + q * k).toFixed(2)}%`).join(', ');
function ukPaintLayers(p) {
  if (!p || !+ukN(p.on, 1)) return [];
  const f = clamp(ukN(p.op, 100), 0, 100) / 100, at = `${ukN(p.cx, 50)}% ${ukN(p.cy, 50)}%`, one = i => [{ i, z: '100% 100%', q: '0 0' }];
  if (p.t === 'lin') return one(`linear-gradient(${ukN(p.a, 180)}deg, ${ukStops(p, f)})`);
  if (p.t === 'rad') { const r = ukN(p.sz, 100) / 2; return one(`radial-gradient(${r}% ${r}% at ${at}, ${ukStops(p, f)})`); }
  if (p.t === 'ang') return one(`conic-gradient(from ${ukN(p.a, 0)}deg at ${at}, ${ukStops(p, f)})`);
  if (p.t === 'dia') return [['top left', 'left top'], ['top right', 'right top'], ['bottom left', 'left bottom'], ['bottom right', 'right bottom']].map(([to, q]) => ({ i: `linear-gradient(to ${to}, ${ukStops(p, f, .5)})`, z: '50% 50%', q }));
  const c = ukCss(ukFade(p.c, f)); return one(`linear-gradient(${c}, ${c})`);
}
/* a list of paints (top first) as background declarations */
function ukBgDecl(list) {
  const L = []; for (const p of list || []) for (const l of ukPaintLayers(p)) L.push(Object.assign({ m: p.bm || 'normal' }, l));
  if (!L.length) return 'background:none;';
  return `background-image:${L.map(l => l.i).join(',')};background-size:${L.map(l => l.z).join(',')};background-position:${L.map(l => l.q).join(',')};background-repeat:no-repeat;background-blend-mode:${L.map(l => l.m).join(',')};background-color:transparent;`;
}
/* the plain colour of a paint (icons, dashes): its colour or its first stop */
const ukPaintColor = p => !p ? '#000000FF' : p.t === 'solid' ? ukFade(p.c, ukN(p.op, 100) / 100) : ukFade(ukSorted(p)[0][1], ukN(p.op, 100) / 100);
/* a rounded rectangle with four radii, as an SVG path */
function ukRR(x, y, w, h, r) {
  const m = Math.max(0, Math.min(w, h) / 2), [a, b, c, d] = r.map(v => +clamp(+v || 0, 0, m).toFixed(2)), n = v => +v.toFixed(2);
  return `M${n(x + a)} ${n(y)}H${n(x + w - b)}${b ? `A${b} ${b} 0 0 1 ${n(x + w)} ${n(y + b)}` : ''}V${n(y + h - c)}${c ? `A${c} ${c} 0 0 1 ${n(x + w - c)} ${n(y + h)}` : ''}H${n(x + d)}${d ? `A${d} ${d} 0 0 1 ${n(x)} ${n(y + h - d)}` : ''}V${n(y + a)}${a ? `A${a} ${a} 0 0 1 ${n(x + a)} ${n(y)}` : ''}Z`;
}
const ukSvgUrl = s => `url("data:image/svg+xml,${encodeURIComponent(s)}")`;
/* the stroke: an overlay painted with the stroke's paint, masked by an SVG ring (solid) or a dashed outline */
function ukStrokeDecl(s, W, H) {
  const k = s.stroke || {}; if (!+k.on || !k.p || !+ukN(k.p.on, 1)) return 'display:none;';
  const w = [0, 1, 2, 3].map(i => Math.max(0, +((k.w || [])[i] ?? (k.w || [1])[0]) || 0)); if (!w.some(v => v > 0)) return 'display:none;';
  const off = w.map(v => k.pos === 'out' ? v : k.pos === 'center' ? v / 2 : 0), r = (s.r || [0, 0, 0, 0]).map(v => +v || 0);
  const R = [r[0] ? r[0] + Math.max(off[0], off[3]) : 0, r[1] ? r[1] + Math.max(off[0], off[1]) : 0, r[2] ? r[2] + Math.max(off[2], off[1]) : 0, r[3] ? r[3] + Math.max(off[2], off[3]) : 0];
  const OW = Math.max(1, W + off[1] + off[3]), OH = Math.max(1, H + off[0] + off[2]), n = v => +v.toFixed(2);
  let body;
  if (k.st === 'dashed' || k.st === 'dotted') {
    const t = w[0] || Math.max(...w), d = k.st === 'dotted' ? `0.01 ${n(Math.max(.5, ukN(k.ga, 4) + t))}` : `${n(Math.max(.5, ukN(k.da, 6)))} ${n(Math.max(.5, ukN(k.ga, 4)))}`;
    body = `<path d="${ukRR(t / 2, t / 2, OW - t, OH - t, R.map(v => Math.max(0, v - t / 2)))}" fill="none" stroke="#000" stroke-width="${n(t)}" stroke-dasharray="${d}" stroke-linecap="${k.st === 'dotted' ? 'round' : k.cap || 'butt'}"/>`;
  } else {
    const ri = [Math.max(0, R[0] - Math.max(w[0], w[3])), Math.max(0, R[1] - Math.max(w[0], w[1])), Math.max(0, R[2] - Math.max(w[2], w[1])), Math.max(0, R[3] - Math.max(w[2], w[3]))];
    body = `<path fill-rule="evenodd" d="${ukRR(0, 0, OW, OH, R)}${ukRR(w[3], w[0], Math.max(0, OW - w[1] - w[3]), Math.max(0, OH - w[0] - w[2]), ri)}"/>`;
  }
  const m = ukSvgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="${n(OW)}" height="${n(OH)}" viewBox="0 0 ${n(OW)} ${n(OH)}" preserveAspectRatio="none">${body}</svg>`);
  return `display:block;top:${n(-off[0])}px;right:${n(-off[1])}px;bottom:${n(-off[2])}px;left:${n(-off[3])}px;${ukBgDecl([Object.assign({}, k.p, { bm: 'normal' })])}-webkit-mask:${m} 0 0/100% 100% no-repeat;mask:${m} 0 0/100% 100% no-repeat;`;
}
const ukNoise = f => ukSvgUrl(`<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><filter id="n"><feTurbulence type="fractalNoise" baseFrequency="${(clamp(ukN(f, 80), 5, 100) / 100).toFixed(2)}" numOctaves="3" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/></filter><rect width="100%" height="100%" filter="url(#n)"/></svg>`);
/* all the declarations of one state: m (the button), l (label), i (icon), bs (stroke), sh (shine), nz (noise) */
function ukBtnCss(s, W, H, mode) {
  const fx = (s.fx || []).filter(e => e && +ukN(e.on, 1)), px = v => `${+(+v || 0).toFixed(2)}px`;
  const box = [], tsh = [], filt = [];
  for (const e of fx) {
    if (e.t === 'drop') box.push(`${px(e.x)} ${px(e.y)} ${px(Math.max(0, e.b))} ${px(e.s)} ${ukCss(e.c)}`);
    else if (e.t === 'inner') box.push(`inset ${px(e.x)} ${px(e.y)} ${px(Math.max(0, e.b))} ${px(e.s)} ${ukCss(e.c)}`);
    else if (e.t === 'glow') box.push(`0 0 ${px(Math.max(0, e.b))} ${px(e.s)} ${ukCss(e.c)}`);
    else if (e.t === 'ring') box.push(`0 0 0 ${px(Math.max(0, e.s))} ${ukCss(e.c)}`, `0 0 ${px(Math.max(0, e.b))} ${px(e.s)} ${ukCss(e.c)}`);
    else if (e.t === 'bevel') { const a = ukN(e.a, 90) * Math.PI / 180, d = ukN(e.d, 2), dx = -Math.cos(a) * d, dy = Math.sin(a) * d; box.push(`inset ${px(dx)} ${px(dy)} ${px(Math.max(0, e.b))} 0 ${ukCss(e.c)}`, `inset ${px(-dx)} ${px(-dy)} ${px(Math.max(0, e.b))} 0 ${ukCss(e.c2)}`); }
    else if (e.t === 'tshadow') tsh.push(e);
    else if (e.t === 'blur') filt.push(`blur(${px(Math.max(0, e.b))})`);
  }
  const bg = fx.find(e => e.t === 'bgblur'), shine = fx.find(e => e.t === 'shine'), noise = fx.find(e => e.t === 'noise');
  const r = (s.r || [0, 0, 0, 0]).map(px).join(' '), dir = { l: 'row', r: 'row-reverse', t: 'column', b: 'column-reverse', o: 'row' }[s.ip] || 'row', jc = { left: 'flex-start', center: 'center', right: 'flex-end' }[s.ta] || 'center';
  const fs = ukN(s.fs, 13), ls = ukN(s.ls, 0) / 100 * fs, sm = ukN(s.sm, 0);
  const m = ukBgDecl(s.fills) + `color:${ukCss(ukPaintColor(s.tp))};font:${+s.fi ? 'italic ' : ''}${s.fw} ${fs}px/${ukN(s.lh, 120) / 100} ${ukFont(s.ff)},var(--font-ui);letter-spacing:${px(ls)};text-transform:${s.tt};`
    + `flex-direction:${dir};justify-content:${jc};gap:${px(s.ig)};padding:${px(s.py)} ${px(s.px)};border-radius:${r};${sm > 0 ? `corner-shape:superellipse(${(1 + sm / 100 * 1.5).toFixed(2)});` : ''}`
    + `box-shadow:${box.join(',') || 'none'};opacity:${clamp(ukN(s.op, 100), 0, 100) / 100};mix-blend-mode:${s.bm || 'normal'};filter:${filt.join(' ') || 'none'};backdrop-filter:${bg ? `blur(${px(Math.max(0, bg.b))})` : 'none'};`
    + `transform:translateY(${px(s.dy)}) scale(${ukN(s.sc, 100) / 100});transition:all ${ukN(s.tr, 120)}ms ease;`;
  const grad = s.tp && s.tp.t !== 'solid' && +ukN(s.tp.on, 1), tsc = tsh.map(e => `${px(e.x)} ${px(e.y)} ${px(Math.max(0, e.b))} ${ukCss(e.c)}`);
  const l = (grad ? ukBgDecl([Object.assign({}, s.tp, { bm: 'normal' })]) + '-webkit-background-clip:text;background-clip:text;color:transparent;' : `background:none;color:${ukCss(ukPaintColor(s.tp))};`)
    + (grad ? `text-shadow:none;filter:${tsh.map(e => `drop-shadow(${px(e.x)} ${px(e.y)} ${px(Math.max(0, e.b))} ${ukCss(e.c)})`).join(' ') || 'none'};` : `text-shadow:${tsc.join(',') || 'none'};filter:none;`)
    + `-webkit-text-stroke:${+s.tsw > 0 ? `${px(s.tsw)} ${ukCss(s.tsc)}` : '0'};paint-order:stroke fill;text-decoration:${s.td || 'none'};`
    + `font-variant-numeric:${+s.tabs ? 'tabular-nums' : 'normal'};font-variant-ligatures:${+ukN(s.lig, 1) ? 'normal' : 'none'};font-variant-caps:${+s.smc ? 'small-caps' : 'normal'};`
    + (+s.trunc ? 'overflow:hidden;text-overflow:ellipsis;min-width:0;' : 'overflow:visible;text-overflow:clip;');
  const i = `color:${ukCss(s.icc && ukAlpha(s.icc) > 0 ? s.icc : ukPaintColor(s.tp))};width:${px(s.isz)};height:${px(s.isz)};`;
  let sh = 'display:none;';
  if (shine && !(+shine.anim && mode !== 'hover' && mode !== 'still')) {
    const c = ukCss(shine.c), w = clamp(ukN(shine.w, 30), 1, 100), a = ukN(shine.a, 110);
    if (+shine.anim && mode === 'hover') sh = `display:block;background:linear-gradient(${a}deg, transparent ${50 - w / 6}%, ${c} 50%, transparent ${50 + w / 6}%) 100% 0/300% 100% no-repeat;animation:uk-shine 900ms ease-out both;`;
    else { const p = ukN(shine.p, 50); sh = `display:block;background:linear-gradient(${a}deg, transparent ${p - w / 2}%, ${c} ${p}%, transparent ${p + w / 2}%);animation:none;`; }
  }
  const nz = noise ? `display:block;background:${ukNoise(noise.f)} 0 0/160px 160px;opacity:${clamp(ukN(noise.op, 12), 0, 100) / 100};mix-blend-mode:${noise.bm || 'overlay'};` : 'display:none;';
  return { m, l, i, bs: ukStrokeDecl(s, W, H), sh, nz };
}
function ukBtnRules(sel, d) { return `${sel}{${d.m}}${sel} .uk-bl{${d.l}}${sel} .uk-ic{${d.i}}${sel}>.uk-bs{${d.bs}}${sel}>.uk-sh{${d.sh}}${sel}>.uk-nz{${d.nz}}`; }


/* ---------- styles ---------- */
const ukTxtStyle = it => Object.assign({}, UI_TXT, it.f || {});
const ukBoxStyle = it => Object.assign({}, UI_BOX, it.c || {});
/* the part of a box above its content: a title bar, a group title */
const ukChrome = c => ({ window: 32, dialog: 38, group: 20 }[c.sk] || 0);

/* ---------- drawing ---------- */
const ukMulti = s => esc(s).replace(/\n/g, '<br>');
function uicHTML(it, dir) {
  if (it.t === 'button') {
    const st = it.dis ? 'd' : it.pv || 'n', s = ukBtnStyle(it, st), id = esc(it.id), W = +it.w || 0, H = +it.h || 0, B = `[data-b="${id}"]`, T = `.uitest ${B}`;
    let css = ukBtnRules(B, ukBtnCss(s, W, H, 'still'));
    if (!it.dis) css += ukBtnRules(T, ukBtnCss(ukBtnStyle(it, 'n'), W, H, 'n')) + ukBtnRules(T + ':hover', ukBtnCss(ukBtnStyle(it, 'h'), W, H, 'hover')) + ukBtnRules(T + ':active', ukBtnCss(ukBtnStyle(it, 'p'), W, H, 'p'));
    const ic = s.ic ? ukIcon(s.ic, s.isz, '') : '', lab = s.ip === 'o' && ic ? '' : `<span class="uk-bl">${ukMulti(it.txt)}</span>`;
    return `<style>${css}</style><div class="uk-b" data-b="${id}"${it.dis ? '' : ' data-ukbtn="1"'}><span class="uk-nz"></span><span class="uk-sh"></span>${ic}${lab}<span class="uk-bs"></span></div>`;
  }
  if (it.t === 'text') {
    const f = ukTxtStyle(it), jc = { top: 'flex-start', center: 'center', bottom: 'flex-end' }[f.va] || 'center';
    const ws = f.wr === 'wrap' ? 'pre-wrap' : 'pre', ell = f.wr === 'elide' ? 'overflow:hidden;text-overflow:ellipsis;' : '';
    return `<div class="uk-t" style="justify-content:${jc};color:${ukCss(f.fg)};font:${+f.fi ? 'italic ' : ''}${f.fw} ${f.fs}px/${f.lh} ${ukFont(f.ff)},var(--font-ui);letter-spacing:${f.ls}px;text-transform:${f.tt};text-decoration:${f.td};text-align:${f.ta}"><span style="white-space:${ws};${ell}">${esc(it.txt)}</span></div>`;
  }
  if (it.t === 'box') {
    const c = ukBoxStyle(it), ch = ukChrome(c), r = +c.r || 0;
    const base = c.sk === 'none' ? `background:${ukCss(c.bg)};border:${c.bw}px solid ${ukCss(c.bc)};border-radius:${r}px` : `background:${ukCss(c.bg)};border:${c.bw}px solid ${ukCss(c.bc)};border-radius:${r}px;box-shadow:${+c.sh || c.sk === 'dialog' ? '0 18px 44px rgba(0,0,0,.22)' : c.sk === 'window' ? '0 8px 26px rgba(0,0,0,.14)' : 'none'}`;
    let chrome = '';
    if (c.sk === 'window') chrome = `<div class="uk-wt" style="height:${ch}px;background:${ukCss(c.tb)};color:${ukCss(c.tf)};border-radius:${r}px ${r}px 0 0"><i class="uk-wl"></i><span>${esc(c.title)}</span><span class="uk-wc"><i></i><i></i><i></i></span></div>`;
    if (c.sk === 'dialog') chrome = `<div class="uk-wt dlg" style="height:${ch}px;background:${ukCss(c.tb)};color:${ukCss(c.tf)};border-radius:${r}px ${r}px 0 0"><span>${esc(c.title)}</span><span class="uk-dx">${ukIcon('x', 14)}</span></div>`;
    if (c.sk === 'group') chrome = `<div class="uk-gt" style="color:${ukCss(c.tf)}">${esc(c.title)}</div>`;
    return `<div class="uk-bx sk-${c.sk}" style="${base}">${chrome}</div>`;
  }
  if (it.t === 'spacer') return `<div class="uk-sp ${dir === 'v' ? 'v' : 'h'}"><svg viewBox="0 0 40 20" preserveAspectRatio="none"><path d="M0 10h4l3-6 5 12 5-12 5 12 5-12 5 12 3-6h5" fill="none" stroke="currentColor" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg></div>`;
  return `<div class="uk-old">Ancien bloc (${esc(it.t)})</div>`;
}
/* the library tile */
function uicThumb(t) {
  if (t === 'box') return `<span class="uk-thumb"><span class="uk-tbx"><i></i><i></i><i></i></span></span>`;
  if (t === 'button') return `<span class="uk-thumb"><span class="uk-tbt">Valider</span></span>`;
  if (t === 'text') return `<span class="uk-thumb"><span class="uk-ttx">Aa<small>Libellé</small></span></span>`;
  return `<span class="uk-thumb"><span class="uk-tsp">${uicHTML({ t: 'spacer' }, 'h')}</span></span>`;
}

/* ---------- sizes from the content (Qt's sizeHint) ---------- */
let ukCtx = null; const ukMeasured = new Map();
function ukMeasure(font, s, ls) {
  const k = font + '|' + ls + '|' + s; let v = ukMeasured.get(k); if (v != null) return v;
  if (!ukCtx) ukCtx = document.createElement('canvas').getContext('2d');
  ukCtx.font = font; v = ukCtx.measureText(s).width + (+ls || 0) * s.length;
  if (ukMeasured.size > 4000) ukMeasured.clear(); ukMeasured.set(k, v); return v;
}
const ukTx = (s, tt) => tt === 'uppercase' ? s.toUpperCase() : tt === 'lowercase' ? s.toLowerCase() : s;
function ukTextBox(txt, f) {
  const font = `${+f.fi ? 'italic ' : ''}${f.fw} ${f.fs}px ${ukFont(f.ff)}, sans-serif`, lines = String(txt ?? '').split('\n');
  const w = Math.max(0, ...lines.map(l => ukMeasure(font, ukTx(l, f.tt), f.ls)));
  const word = Math.max(0, ...lines.join(' ').split(/\s+/).map(x => ukMeasure(font, ukTx(x, f.tt), f.ls)));
  return { w: Math.ceil(w) + 1, word: Math.ceil(word) + 1, h: Math.ceil(lines.length * f.fs * f.lh), lh: f.fs * f.lh, font, lines };
}
/* hint and minimum hint of a leaf block (boxes are computed from their content in uiLayout) */
function ukLeafHint(it, dir) {
  if (it.t === 'button') {
    const s = ukBtnStyle(it, it.dis ? 'd' : 'n'), fs = ukN(s.fs, 13), f = { ff: s.ff, fs, fw: s.fw, fi: s.fi, tt: s.tt, ls: ukN(s.ls, 0) / 100 * fs, lh: ukN(s.lh, 120) / 100 };
    const tb = s.ip === 'o' && s.ic ? { w: 0, h: 0 } : ukTextBox(it.txt, f), I = s.ic ? +s.isz : 0, g = I && tb.w ? +s.ig : 0;
    const vert = s.ip === 't' || s.ip === 'b', cw = vert ? Math.max(tb.w, I) : tb.w + g + I, chh = vert ? tb.h + g + I : Math.max(tb.h, I);
    const w = Math.ceil(cw + 2 * s.px), h = Math.ceil(chh + 2 * s.py);
    return { w, h, mw: +s.trunc ? Math.ceil(Math.min(w, 2 * s.px + I + g + fs * 2)) : w, mh: h };
  }
  if (it.t === 'text') {
    const f = ukTxtStyle(it), tb = ukTextBox(it.txt, f), w = f.wr === 'wrap' ? Math.min(tb.w, 320) : tb.w;
    const lines = f.wr === 'wrap' ? Math.max(tb.lines.length, Math.ceil(tb.w / Math.max(1, w) - .001) + tb.lines.length - 1) : tb.lines.length;
    return { w, h: Math.ceil(lines * tb.lh), mw: f.wr === 'wrap' ? tb.word : f.wr === 'elide' ? Math.min(tb.w, 24) : tb.w, mh: Math.ceil(tb.lh) };
  }
  if (it.t === 'spacer') return dir === 'v' ? { w: 20, h: 40, mw: 0, mh: 0 } : { w: 40, h: 20, mw: 0, mh: 0 };
  return { w: it.w, h: it.h, mw: it.w, mh: it.h };   // an old block: its own size
}
/* the layout item's props: policy, sizes, stretch, alignment, span */
function ukLp(it, dir) {
  const d = it.t === 'spacer' ? (dir === 'v' ? { ph: 'min', pv: 'exp' } : { ph: 'exp', pv: 'min' }) : UI_LP[it.t] || { ph: 'fix', pv: 'fix' };
  return Object.assign({ ph: d.ph, pv: d.pv, mnw: 0, mnh: 0, mxw: 0, mxh: 0, sth: 0, stv: 0, ah: 'auto', av: 'auto', cs: 1, rs: 1 }, it.lp || {});
}
/* one axis of an item, for the layout: { min, hint, max, exp, grow, st } */
function ukAxis(hint, minHint, pol, mn, mx, st, user) {
  let h = user > 0 ? user : hint, min = minHint, max = UI_INF, exp = false, grow = true;
  if (user > 0) min = Math.min(min, h);
  if (pol === 'fix') { min = max = h; grow = false; }
  else if (pol === 'min') min = h;
  else if (pol === 'max') { max = h; grow = false; }
  else if (pol === 'exp') exp = true;
  else if (pol === 'ign') { exp = true; h = min; }
  if (mn > 0) { min = Math.max(min, mn); if (max < min) max = min; }
  if (mx > 0) { max = Math.min(max, mx); if (min > max) min = max; grow = grow && max > h; }
  h = clamp(h, min, max);
  return { min, hint: h, max, exp, grow: grow && max > h, st: +st || 0 };
}
/* Qt's distribution: below the hints everyone shrinks towards its minimum; above, the free space goes to the stretch factors,
   else to the expanding items, else to whoever can grow. Returns the sizes and what is left over. */
function ukDistribute(total, L) {
  const n = L.length; if (!n) return { s: [], left: Math.max(0, total) };
  const sumMin = L.reduce((a, i) => a + i.min, 0), sumHint = L.reduce((a, i) => a + i.hint, 0);
  if (total <= sumMin) return { s: L.map(i => i.min), left: 0 };
  if (total < sumHint) { const room = sumHint - sumMin, f = (sumHint - total) / Math.max(1e-6, room); return { s: L.map(i => i.hint - (i.hint - i.min) * f), left: 0 }; }
  const s = L.map(i => i.hint); let extra = total - sumHint;
  const groups = [L.map((i, k) => i.st > 0 && i.max > i.hint ? k : -1), L.map((i, k) => i.exp && i.max > i.hint ? k : -1), L.map((i, k) => (i.grow || i.exp) && i.max > i.hint ? k : -1)].map(g => g.filter(k => k >= 0));
  for (const g of groups) {
    let open = g.filter(k => s[k] < L[k].max);
    while (extra > .01 && open.length) {
      const wsum = open.reduce((a, k) => a + (L[k].st || 1), 0); let used = 0;
      for (const k of open) { const add = extra * (L[k].st || 1) / wsum, nv = Math.min(L[k].max, s[k] + add); used += nv - s[k]; s[k] = nv; }
      extra -= used; open = open.filter(k => s[k] < L[k].max - .01); if (used < .01) break;
    }
    if (extra <= .01) break;
  }
  return { s, left: Math.max(0, extra) };
}
const ukFit = (ax, cell, al) => { const size = al === 'auto' ? clamp(cell, ax.min, ax.max) : clamp(ax.hint, ax.min, Math.max(ax.min, Math.min(ax.max, cell))); const free = cell - size; return { size, off: al === 'start' ? 0 : al === 'end' ? free : free / 2 }; };
/* grid placement: row-major auto flow with spans */
function ukGridPlace(kids, cols, lp) {
  const occ = new Set(), pos = []; let r = 0, c = 0;
  for (const k of kids) {
    const L = lp(k), cs = clamp(L.cs | 0 || 1, 1, cols), rs = Math.max(1, L.rs | 0 || 1);
    for (;;) { if (c + cs > cols) { c = 0; r++; } let free = true; for (let y = r; y < r + rs && free; y++) for (let x = c; x < c + cs; x++) if (occ.has(y + ',' + x)) { free = false; break; } if (free) break; c++; }
    for (let y = r; y < r + rs; y++) for (let x = c; x < c + cs; x++) occ.add(y + ',' + x);
    pos.push({ r, c, rs, cs }); c += cs;
  }
  return { pos, rows: pos.reduce((a, p) => Math.max(a, p.r + p.rs), 0) };
}
/* ---------- the layout engine ---------- */
let uiFloat = null;   // blocks being dragged: out of their layout while the pointer holds them
function uiLayout(arr) {
  if (!arr.some(i => i.k === 'uic')) return arr;
  if (arr.some(i => i.t === 'button' && i.k === 'uic' && i.b && !Array.isArray(i.b.fills))) arr = arr.map(i => i.k === 'uic' ? ukBtnMig(i) : i);
  const byId = new Map(), kids = new Map();
  for (const i of arr) if (i.k === 'uic') byId.set(i.id, i);
  /* a parent must be an existing box, without cycles */
  const fixP = new Map();
  const pOf = i => { if (fixP.has(i.id)) return fixP.get(i.id); let p = i.p && byId.get(i.p) && byId.get(i.p).t === 'box' ? i.p : null; if (p) { const seen = new Set([i.id]); let q = p; while (q) { if (seen.has(q)) { p = null; break; } seen.add(q); const Q = byId.get(q); q = Q && Q.p && byId.get(Q.p) ? Q.p : null; } } fixP.set(i.id, p); return p; };
  for (const i of byId.values()) { const p = pOf(i); if (p && !(uiFloat && uiFloat.has(i.id))) { if (!kids.has(p)) kids.set(p, []); kids.get(p).push(i); } }
  for (const l of kids.values()) l.sort((a, b) => (a.o ?? 0) - (b.o ?? 0) || arr.indexOf(a) - arr.indexOf(b));
  const lay = b => b.t === 'box' ? ukBoxStyle(b).lay : 'none';
  const dirOf = i => { const p = pOf(i); return p && lay(byId.get(p)) === 'v' ? 'v' : 'h'; };
  const H = new Map();
  /* hint of any block: leaves from their content, boxes from their layout */
  function hint(i) {
    if (H.has(i.id)) return H.get(i.id);
    let r;
    if (i.t !== 'box') r = ukLeafHint(i, dirOf(i));
    else {
      const c = ukBoxStyle(i), m = c.m.map(v => +v || 0), ch = ukChrome(c), K = kids.get(i.id) || [], L = c.lay;
      const padW = m[0] + m[2], padH = m[1] + m[3] + ch;
      if (L === 'none' || !K.length) r = L === 'none' ? { w: i.hw || i.w, h: i.hh || i.h, mw: padW, mh: padH } : { w: Math.max(120, padW + 40), h: Math.max(80, padH + 30), mw: padW, mh: padH };
      else if (L === 'h' || L === 'v') {
        const ax = K.map(k => itemAx(k)), sp = (+c.sp || 0) * (K.length - 1), mainH = L === 'h';
        const sum = (f) => ax.reduce((a, x) => a + f(x), 0), mx = (f) => ax.reduce((a, x) => Math.max(a, f(x)), 0);
        r = mainH ? { w: padW + sp + sum(x => x.h.hint), h: padH + mx(x => x.v.hint), mw: padW + sp + sum(x => x.h.min), mh: padH + mx(x => x.v.min) }
          : { w: padW + mx(x => x.h.hint), h: padH + sp + sum(x => x.v.hint), mw: padW + mx(x => x.h.min), mh: padH + sp + sum(x => x.v.min) };
      } else {
        const g = gridAxes(i, c, K);
        const tot = (A, sp) => A.reduce((a, x) => a + x.hint, 0) + sp * Math.max(0, A.length - 1), totm = (A, sp) => A.reduce((a, x) => a + x.min, 0) + sp * Math.max(0, A.length - 1);
        r = { w: padW + tot(g.cols, +c.sp || 0), h: padH + tot(g.rows, +c.sv || 0), mw: padW + totm(g.cols, +c.sp || 0), mh: padH + totm(g.rows, +c.sv || 0) };
      }
    }
    H.set(i.id, r); return r;
  }
  function itemAx(k) {
    const h = hint(k), L = ukLp(k, dirOf(k));
    return { h: ukAxis(h.w, h.mw, L.ph, L.mnw, L.mxw, L.sth, k.hw), v: ukAxis(h.h, h.mh, L.pv, L.mnh, L.mxh, L.stv, k.hh), L };
  }
  function gridAxes(b, c, K) {
    const cols = Math.max(1, c.cols | 0 || 1), P = ukGridPlace(K, cols, k => ukLp(k, 'h')), ax = K.map(itemAx);
    const cst = String(c.cst || '').split(/[,; ]+/).map(Number);
    const mk = (n, key, span, idx, sp, stOf) => {
      const A = Array.from({ length: n }, (_, j) => ({ min: 0, hint: 0, max: 0, exp: false, grow: false, st: stOf(j) }));
      K.forEach((k, q) => { if (P.pos[q][span] !== 1) return; const a = ax[q][key], C = A[P.pos[q][idx]]; C.min = Math.max(C.min, a.min); C.hint = Math.max(C.hint, a.hint); C.max = Math.max(C.max, a.max); C.exp = C.exp || a.exp; C.grow = C.grow || a.grow; });
      K.forEach((k, q) => { const s = P.pos[q][span]; if (s === 1) return; const a = ax[q][key], j0 = P.pos[q][idx], seg = A.slice(j0, j0 + s), have = seg.reduce((x, y) => x + y.min, 0) + sp * (s - 1), haveH = seg.reduce((x, y) => x + y.hint, 0) + sp * (s - 1), last = seg[seg.length - 1];
        if (a.min > have) last.min += a.min - have; if (a.hint > haveH) last.hint += a.hint - haveH; last.max = Math.max(last.max, last.hint, a.max === UI_INF ? UI_INF : 0); last.exp = last.exp || a.exp; last.grow = last.grow || a.grow; });
      for (const C of A) { C.hint = Math.max(C.hint, C.min); if (C.max < C.hint) C.max = C.hint; if (C.grow || C.exp) C.max = Math.max(C.max, UI_INF); C.grow = C.grow && C.max > C.hint; }
      return A;
    };
    return { P, ax, cols: mk(cols, 'h', 'cs', 'c', +c.sp || 0, j => +cst[j] || 0), rows: mk(P.rows, 'v', 'rs', 'r', +c.sv || 0, () => 0) };
  }
  const out = new Map();
  const put = (i, x, y, w, h) => out.set(i.id, { x, y, w: Math.max(0, w), h: Math.max(0, h) });
  /* place a box's content inside its rectangle */
  function place(b, X, Y, W, Hh) {
    const c = ukBoxStyle(b), K = kids.get(b.id) || [], L = c.lay; if (!K.length) return;
    if (L === 'none') { for (const k of K) if (k.t === 'box') place(k, k.x, k.y, k.w, k.h); return; }
    const m = c.m.map(v => +v || 0), ch = ukChrome(c), x0 = X + m[0], y0 = Y + m[1] + ch, w0 = Math.max(0, W - m[0] - m[2]), h0 = Math.max(0, Hh - m[1] - m[3] - ch);
    if (L === 'h' || L === 'v') {
      const ax = K.map(itemAx), sp = +c.sp || 0, mainH = L === 'h', D = ukDistribute((mainH ? w0 : h0) - sp * (K.length - 1), ax.map(a => mainH ? a.h : a.v));
      const gaps = c.ca === 'between' && K.length > 1 ? D.left / (K.length - 1) : 0;
      let at = (mainH ? x0 : y0) + (c.ca === 'center' ? D.left / 2 : c.ca === 'end' ? D.left : 0);
      K.forEach((k, q) => {
        const s = D.s[q], cr = ukFit(mainH ? ax[q].v : ax[q].h, mainH ? h0 : w0, mainH ? ax[q].L.av : ax[q].L.ah);
        const mal = ukFit(mainH ? ax[q].h : ax[q].v, s, 'auto');
        if (mainH) put(k, at + mal.off, y0 + cr.off, mal.size, cr.size); else put(k, x0 + cr.off, at + mal.off, cr.size, mal.size);
        at += s + sp + gaps;
      });
    } else {
      const g = gridAxes(b, c, K), sp = +c.sp || 0, sv = +c.sv || 0;
      const DW = ukDistribute(w0 - sp * (g.cols.length - 1), g.cols), DH = ukDistribute(h0 - sv * Math.max(0, g.rows.length - 1), g.rows);
      const ox = c.ca === 'center' ? DW.left / 2 : c.ca === 'end' ? DW.left : 0, oy = c.ca === 'center' ? DH.left / 2 : c.ca === 'end' ? DH.left : 0;
      const xs = [x0 + ox], ys = [y0 + oy]; DW.s.forEach((v, j) => xs.push(xs[j] + v + sp)); DH.s.forEach((v, j) => ys.push(ys[j] + v + sv));
      K.forEach((k, q) => { const p = g.P.pos[q], cx = xs[p.c], cy = ys[p.r], cw = xs[p.c + p.cs] - sp - cx, chh = ys[p.r + p.rs] - sv - cy;
        const fx = ukFit(g.ax[q].h, cw, g.ax[q].L.ah), fy = ukFit(g.ax[q].v, chh, g.ax[q].L.av); put(k, cx + fx.off, cy + fy.off, fx.size, fy.size); });
    }
    for (const k of K) if (k.t === 'box') { const r = out.get(k.id); place(k, r.x, r.y, r.w, r.h); }
  }
  /* the roots (free boxes, and boxes being dragged) keep their place; a box never gets smaller than its content allows */
  for (const i of byId.values()) {
    if (i.t !== 'box') continue;
    const p = pOf(i); if (p && !(uiFloat && uiFloat.has(i.id))) continue;
    const parentFree = p && lay(byId.get(p)) === 'none';
    if (parentFree && !(uiFloat && uiFloat.has(i.id))) continue;
    const h = hint(i), w = Math.max(i.w, h.mw), hh = Math.max(i.h, h.mh);
    if (w !== i.w || hh !== i.h) put(i, i.x, i.y, w, hh);
    place(i, i.x, i.y, w, hh);
  }
  /* free children of a free-layout box: they stay, a box among them lays out its own content */
  for (const i of byId.values()) { if (i.t !== 'box' || out.has(i.id)) continue; const p = pOf(i); if (p && lay(byId.get(p)) === 'none' && !(uiFloat && uiFloat.has(i.id))) { const h = hint(i), w = Math.max(i.w, h.mw), hh = Math.max(i.h, h.mh); if (w !== i.w || hh !== i.h) put(i, i.x, i.y, w, hh); place(i, i.x, i.y, w, hh); } }
  const r2 = v => Math.round(v * 100) / 100;
  let res = arr.map(i => {
    if (i.k !== 'uic') return i;
    let n = i; const p = pOf(i);
    if ((i.p || null) !== p) n = Object.assign({}, n, { p: undefined, o: undefined });
    const q = out.get(i.id); if (q) { const g = { x: r2(q.x), y: r2(q.y), w: r2(q.w), h: r2(q.h) }; if (g.x !== n.x || g.y !== n.y || g.w !== n.w || g.h !== n.h) n = Object.assign(n === i ? Object.assign({}, i) : n, g); }
    return n;
  });
  /* children are drawn above their parent */
  const at = new Map(res.map((i, k) => [i.id, k]));
  if (res.some(i => i.k === 'uic' && i.p && at.get(i.p) > at.get(i.id))) {
    const done = new Set(), wait = new Map(), o2 = [];
    const emit = i => { o2.push(i); done.add(i.id); const w = wait.get(i.id); if (w) { wait.delete(i.id); w.forEach(emit); } };
    for (const i of res) { if (i.k === 'uic' && i.p && !done.has(i.p) && at.has(i.p)) { if (!wait.has(i.p)) wait.set(i.p, []); wait.get(i.p).push(i); } else emit(i); }
    for (const w of wait.values()) w.forEach(i => { if (!done.has(i.id)) emit(i); });
    res = o2;
  }
  return res;
}
/* the boxes and blocks inside a box, at any depth */
function uiDesc(arr, id, set = new Set()) { for (const i of arr) if (i.k === 'uic' && i.p === id && !set.has(i.id)) { set.add(i.id); uiDesc(arr, i.id, set); } return set; }
/* the screens of a zone, for the test mode: its free windows and dialogs, by rows then left to right */
function uiScreens(zone, arr) {
  const b = boxOf(zone);
  const s = arr.filter(i => i.k === 'uic' && i.t === 'box' && !i.p && !i.hid && ['window', 'dialog'].includes(ukBoxStyle(i).sk) && inBox(i.x + i.w / 2, i.y + i.h / 2, b));
  return s.sort((p, q) => Math.abs(p.y - q.y) > 120 ? p.y - q.y : p.x - q.x);
}
