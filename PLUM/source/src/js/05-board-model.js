/* ================= board model =================
   A board is a list of plain items, drawn in list order (frames always under the rest).
   note {txt,c,fs,font,al} · text {txt,fs,font,color,bold,fw} · shape {sh,sc,fc,sw,sty,dash,fill,txt,fs}
   image {asset,frm,cap} · file {asset,name,size,mime} · link {url,title} · ink {p,t,c,s,o,w0,h0}
   mind {txt,root,parent,side,c,ord,lv} · frame {title} · task {task} · doc {doc} · todo {title,tasks[],c,font} · sheet {title,cols,rows,cells{A1:raw},fs,cw?[],rh?[]}
   conn {a:{id|x,y}, b:{id|x,y}, pts:[[x,y]], route, sc, sw, sty, dash, h0, h1, txt}
   Every item may carry op (opacity 0..1) and hid (hidden from the Layers tab).
   Items are never mutated: an edit makes a new object, which keeps undo cheap. */
const NOTE_COLORS = ['#FDE68A', '#FBCFA4', '#F9C4D2', '#D5C8F6', '#BFDBF7', '#C3E8C1', '#FFFFFF', '#E7E3DA'];
const STROKE_COLORS = ['#1E1E1E', '#E03131', '#2F9E44', '#1971C2', '#F08C00'];
const FILL_COLORS = ['#FFC9C9', '#B2F2BB', '#A5D8FF', '#FFEC99', '#FFFFFF'];
const MIND_COLORS = ['#6E56F0', '#3D7BD9', '#2E9E6A', '#F2A33A', '#D9467E', '#22A6B3', '#E5484D', '#8B5E3C'];
const SHAPES = { rect: 'Rectangle', round: 'Arrondi', ellipse: 'Ellipse', diamond: 'Losange', tri: 'Triangle', pill: 'Bulle', hex: 'Hexagone', starsh: 'Étoile', bubble: 'Bulle de BD', cloud: 'Nuage' };
const HEADS = { none: 'Aucune', arrow: 'Flèche', tri: 'Triangle', bar: 'Barre', dot: 'Point', circle: 'Cercle', diamond: 'Losange' };
const HAND = 'hand', SANS = 'sans', MONO = 'mono';
const fontOf = f => f === SANS ? 'var(--font-ui)' : f === MONO ? 'var(--font-mono)' : 'var(--font-hand)';
/* the defaults for new items (S.prefs.bd); colours of the scheme are kept as "@n" and read in the current theme's scheme.
   sc = outlines, ink and text, csc = arrows and lines (n°5 unless one was chosen), fc = fill of shapes */
const BD = () => {
  const b = Object.assign({}, S.prefs.bd);
  for (const k of ['sc', 'csc', 'fc']) if (b[k]) b[k] = schemeVal(b[k]);
  if (!b.sc) b.sc = schemeHex(SCHEME_DEF.sc);
  if (!b.csc) b.csc = schemeHex(SCHEME_DEF.csc);
  return b;
};
/* the colours of the items that can come from the scheme */
const COLOR_KEYS = ['sc', 'fc', 'c', 'color'];
/* switching themes: every colour of the old scheme becomes the colour of the same number in the new one
   (boards, pen colours and the saved defaults); colours picked freely stay as they are */
function schemeMapper(from, to) {
  const map = new Map(); from.forEach((c, i) => { if (to[i]) map.set(c.toUpperCase(), to[i]); });
  const re = v => typeof v === 'string' ? map.get(v.toUpperCase()) : undefined;
  const item = it => { let o = null; for (const k of COLOR_KEYS) { const v = re(it[k]); if (v && v !== it[k]) { o = o || Object.assign({}, it); o[k] = v; } } return o || it; };
  return { re, item, list: arr => { let ch = false; const next = arr.map(it => { const o = item(it); if (o !== it) ch = true; return o; }); return ch ? next : arr; } };
}
function remapScheme(from, to) {
  if (from === to) return;
  const m = schemeMapper(from, to), P = S.prefs;
  for (const d of S.docs) if (d.type === 'board' && Array.isArray(d.items)) d.items = m.list(d.items);
  for (const k in P.pens || {}) { const v = m.re(P.pens[k] && P.pens[k].c); if (v) P.pens[k].c = v; }
  if (P.bd) for (const k of ['sc', 'csc', 'fc']) { const no = schemeNo(P.bd[k], from); if (no) P.bd[k] = '@' + no; }
  P.recent = (P.recent || []).map(c => m.re(c) || c);
}

const mkNote = (x, y, txt, c = schemeHex(SCHEME_DEF.note), o = {}) => ({ id: uid('n'), k: 'note', x, y, w: o.w || 220, h: o.h || 220, txt, c, fs: o.fs || 30, font: o.font || BD().font || HAND, al: o.al || 'left' });
const mkText = (x, y, txt, o = {}) => ({ id: uid('x'), k: 'text', x, y, w: o.w || 10, h: o.h || 10, txt, fs: o.fs || 28, font: o.font || BD().font || HAND, color: o.color || BD().sc || '#1E1E1E', bold: !!o.bold, fw: o.fw || 0, al: o.al || 'left' });
const mkShape = (x, y, w, h, sh = 'rect', o = {}) => ({ id: uid('s'), k: 'shape', x, y, w, h, sh, sc: o.sc || BD().sc || '#1E1E1E', fc: o.fc === undefined ? (BD().fc || null) : o.fc, sw: o.sw || BD().sw || 2, sty: o.sty || BD().sty || 'sketch', dash: o.dash || BD().dash || '', fill: o.fill || BD().fill || 'solid', txt: o.txt || '', fs: o.fs || 26, font: o.font || BD().font || HAND, color: o.color || '', sd: Math.random() });
const mkImage = (x, y, w, h, asset, o = {}) => ({ id: uid('i'), k: 'image', x, y, w, h, asset: asset || '', frm: o.frm || 'shadow', cap: o.cap || '' });
const mkFrame = (x, y, w, h, title) => ({ id: uid('f'), k: 'frame', x, y, w, h, title: title || 'Cadre' });
const mkConn = (a, b, o = {}) => ({ id: uid('c'), k: 'conn', a, b, pts: o.pts || [], route: o.route || BD().route || 'curve', sc: o.sc || BD().csc || '#1E1E1E', sw: o.sw || BD().sw || 2, sty: o.sty || BD().sty || 'sketch', h0: o.h0 || 'none', h1: o.h1 === undefined ? 'arrow' : o.h1, txt: o.txt || '', dash: o.dash === true ? 'dash' : (o.dash || ''), sd: Math.random() });
const mkTodo = (x, y, title, tasks = [], o = {}) => ({ id: uid('o'), k: 'todo', x, y, w: o.w || 290, h: o.h || 160, title: title || 'À faire', tasks: tasks.slice(), c: o.c || '#FFFFFF', font: o.font || HAND, fs: o.fs || 24 });
/* a mind map: the centre idea and its branches (strings, or {t, c:[…]} for sub-ideas), half on each side;
   each first-level branch takes the next colour of the theme's mind palette, its sub-ideas share it */
function mkMind(x, y, title, branches = []) {
  const root = { id: uid('m'), k: 'mind', x, y, w: 160, h: 64, txt: title, parent: null, side: 1, c: schemeHex(1), ord: 0, lv: 0 };
  root.root = root.id;
  const out = [root], cols = themeColors('mind', MIND_COLORS);
  const add = (parent, list, side, color, lv) => list.forEach((b, i) => {
    const node = typeof b === 'string' ? { t: b } : b;
    const s = parent === root ? (node.side || (i < Math.ceil(list.length / 2) ? 1 : -1)) : side;
    const c = parent === root ? cols[i % cols.length] : color;
    const n = { id: uid('m'), k: 'mind', x, y, w: 80, h: 32, txt: node.t, root: root.id, parent: parent.id, side: s, c, ord: i, lv };
    out.push(n); if (node.c) add(n, node.c, s, c, lv + 1);
  });
  add(root, branches, 1, null, 1);
  return out;
}
/* ---------- tableur (sheet): cells A1, B2…, a value or a formula starting with "=" (the essentials of a spreadsheet) ---------- */
const colName = i => { let s = ''; for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + (i - 1) % 26) + s; return s; };
const colIndex = s => { let n = 0; for (const ch of s.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
/* sizes follow the text size: row height, the width of the row numbers, the title band and the add buttons */
/* sizes follow the text size: row height, the width of the row numbers, the title band and the add buttons.
   Columns and rows resized by hand keep their size in cw / rh (in units of the text size, so they scale with it); the others share the width. */
function sheetGeom(it) {
  const fs = it.fs || 14, rh = Math.round(fs * 2.1), hw = Math.round(fs * 2.6), th = Math.round(fs * 2.7), add = Math.round(fs * 2.3);
  const eq = (it.w - hw) / it.cols;
  const cws = Array.from({ length: it.cols }, (_, i) => it.cw ? (it.cw[i] || 7) * fs : eq);
  const rhs = Array.from({ length: it.rows }, (_, i) => it.rh && it.rh[i] ? it.rh[i] * fs : rh);
  return { fs, rh, hw, th, add, cw: eq, cws, rhs, w: hw + cws.reduce((s, v) => s + v, 0), h: th + rh + rhs.reduce((s, v) => s + v, 0) + add };
}
const mkSheet = (x, y, o = {}) => { const it = { id: uid('g'), k: 'sheet', x, y, w: 0, h: 0, title: o.title || 'Tableau', cols: o.cols || 4, rows: o.rows || 6, cells: Object.assign({}, o.cells), fs: o.fs || 14 }; const g = sheetGeom(it); it.w = o.w || g.hw + it.cols * Math.round(it.fs * 7); it.h = sheetGeom(it).h; return it; };
/* "B3" -> [1, 2] (column, row from 0) and back */
const cellRC = ref => { const m = /^([A-Z]+)(\d+)$/.exec(ref || ''); return m ? [colIndex(m[1]), +m[2] - 1] : null; };
const cellRef = (c, r) => colName(c) + (r + 1);
/* rows or columns inserted (n > 0) or removed (n < 0) at index `at`: the cells move and the formulas follow them, as in a spreadsheet;
   a reference to a removed cell becomes #REF!, a range loses the removed part */
function sheetShift(cells, axis, at, n) {
  const out = {}, mv = i => i < at ? i : n < 0 && i < at - n ? null : i + n;
  for (const [k, raw] of Object.entries(cells)) {
    const rc = cellRC(k); if (!rc) continue;
    const c = axis === 'col' ? mv(rc[0]) : rc[0], r = axis === 'row' ? mv(rc[1]) : rc[1];
    if (c == null || r == null) continue;
    out[cellRef(c, r)] = typeof raw === 'string' && raw[0] === '=' ? sheetShiftF(raw, axis, at, n) : raw;
  }
  return out;
}
function sheetShiftF(f, axis, at, n) {
  const idx = (c, r) => axis === 'col' ? colIndex(c) : +r - 1;
  const put = (c, r, i) => axis === 'col' ? [colName(i), r] : [c, String(i + 1)];
  return f.split(/("(?:[^"]|"")*")/).map((part, k) => k % 2 ? part : part.replace(/(?<![A-Za-z0-9_.])(\$?)([A-Za-z]{1,2})(\$?)(\d+)(?::(\$?)([A-Za-z]{1,2})(\$?)(\d+))?(?![A-Za-z0-9_(])/g, (all, d1, c1, d2, r1, d3, c2, d4, r2) => {
    c1 = c1.toUpperCase();
    if (!c2) { const i = idx(c1, r1), j = i < at ? i : n < 0 && i < at - n ? null : i + n; if (j == null) return '#REF!'; const [c, r] = put(c1, r1, j); return d1 + c + d2 + r; }
    c2 = c2.toUpperCase();
    let s = idx(c1, r1), e = idx(c2, r2); if (s > e) [s, e] = [e, s];
    if (n < 0) { const cnt = -n; s = s >= at + cnt ? s - cnt : s >= at ? at : s; e = e >= at + cnt ? e - cnt : e >= at ? at - 1 : e; if (e < s) return '#REF!'; }
    else { if (s >= at) s += n; if (e >= at) e += n; }
    const [a, b] = put(c1, r1, s), [x, y] = put(c2, r2, e);
    return d1 + a + d2 + b + ':' + d3 + x + d4 + y;
  })).join('');
}
/* the functions offered while a formula is typed */
const SHEET_HELP = [
  ['SOMME', 'SOMME(valeur1; [valeur2; …])', 'Additionne des nombres ou une plage'], ['MOYENNE', 'MOYENNE(valeur1; [valeur2; …])', 'Moyenne des nombres'],
  ['MIN', 'MIN(valeur1; [valeur2; …])', 'Plus petite valeur'], ['MAX', 'MAX(valeur1; [valeur2; …])', 'Plus grande valeur'],
  ['NB', 'NB(valeur1; [valeur2; …])', 'Compte les nombres'], ['NBVAL', 'NBVAL(valeur1; [valeur2; …])', 'Compte les cellules non vides'],
  ['PRODUIT', 'PRODUIT(valeur1; [valeur2; …])', 'Multiplie les nombres'], ['ARRONDI', 'ARRONDI(valeur; [chiffres])', 'Arrondit à un nombre de décimales'],
  ['ABS', 'ABS(valeur)', 'Valeur absolue'], ['SI', 'SI(condition; si_vrai; [si_faux])', 'Une valeur ou une autre selon une condition'],
  ['SUM', 'SUM(valeur1; …)', 'SOMME en anglais'], ['AVERAGE', 'AVERAGE(valeur1; …)', 'MOYENNE en anglais'], ['COUNT', 'COUNT(valeur1; …)', 'NB en anglais'],
  ['COUNTA', 'COUNTA(valeur1; …)', 'NBVAL en anglais'], ['PRODUCT', 'PRODUCT(valeur1; …)', 'PRODUIT en anglais'], ['ROUND', 'ROUND(valeur; [chiffres])', 'ARRONDI en anglais'], ['IF', 'IF(condition; si_vrai; [si_faux])', 'SI en anglais']];
/* a number typed in a cell: "12", "3,5", "1 200", "15 %" */
const sheetLit = raw => { const t = String(raw).trim().replace(/[\s  ]/g, ''), m = /^(-?\d+(?:[.,]\d+)?)(%?)$/.exec(t); if (!m) return String(raw); const n = parseFloat(m[1].replace(',', '.')); return m[2] ? n / 100 : n; };
const sheetErr = m => { const e = new Error(m); e.sheet = m; return e; };
const SHEET_FN = (() => {
  const nums = a => a.flat(Infinity).filter(v => typeof v === 'number');
  const num = v => { if (Array.isArray(v)) v = v.flat(Infinity)[0]; if (v == null || v === '') return 0; if (typeof v === 'boolean') return +v; if (typeof v === 'number') return v; const n = sheetLit(v); if (typeof n === 'number') return n; throw sheetErr('#VALEUR!'); };
  const f = {
    SUM: a => nums(a).reduce((s, v) => s + v, 0),
    AVERAGE: a => { const n = nums(a); if (!n.length) throw sheetErr('#DIV/0!'); return n.reduce((s, v) => s + v, 0) / n.length; },
    MIN: a => { const n = nums(a); return n.length ? Math.min(...n) : 0; },
    MAX: a => { const n = nums(a); return n.length ? Math.max(...n) : 0; },
    COUNT: a => nums(a).length,
    COUNTA: a => a.flat(Infinity).filter(v => v != null && v !== '').length,
    PRODUCT: a => nums(a).reduce((s, v) => s * v, 1),
    ROUND: a => { const k = Math.pow(10, a.length > 1 ? num(a[1]) : 0); return Math.round(num(a[0]) * k) / k; },
    ABS: a => Math.abs(num(a[0])),
    IF: a => (Array.isArray(a[0]) ? a[0].flat(Infinity)[0] : a[0]) ? (a.length > 1 ? a[1] : true) : (a.length > 2 ? a[2] : false)
  };
  Object.assign(f, { SOMME: f.SUM, MOYENNE: f.AVERAGE, NB: f.COUNT, NBVAL: f.COUNTA, PRODUIT: f.PRODUCT, ARRONDI: f.ROUND, SI: f.IF });
  f._num = num;
  return f;
})();
/* every cell's value: numbers, text, VRAI/FAUX, or { err } (#CYCLE when a formula points back to itself) */
function sheetEval(cells) {
  const memo = new Map(), busy = new Set(), num = SHEET_FN._num;
  const val = ref => {
    if (memo.has(ref)) return memo.get(ref);
    if (busy.has(ref)) return { err: '#CYCLE' };
    const raw = cells[ref]; let v;
    if (raw == null || raw === '') v = null;
    else if (raw[0] === '=' && raw.includes('#REF!')) v = { err: '#REF!' };
    else if (raw[0] === '=') { busy.add(ref); try { v = formula(raw.slice(1)); if (Array.isArray(v)) v = v.flat(Infinity)[0] ?? null; } catch (e) { v = { err: e.sheet || '#ERREUR' }; } busy.delete(ref); }
    else v = sheetLit(raw);
    memo.set(ref, v); return v;
  };
  const get = ref => { const v = val(ref); if (v && v.err) throw sheetErr(v.err); return v; };
  function formula(src) {
    const dec = src.includes(';') || !/[A-Za-zÀ-ÿ]\s*\(/.test(src);   // "3,5" is a decimal when ";" separates the arguments
    const T = []; let i = 0;
    while (i < src.length) {
      const r = src.slice(i); let m;
      if (/^\s/.test(r)) { i++; continue; }
      if ((m = (dec ? /^\d+(?:[.,]\d+)?/ : /^\d+(?:\.\d+)?/).exec(r))) { T.push({ t: 'v', v: parseFloat(m[0].replace(',', '.')) }); i += m[0].length; continue; }
      if ((m = /^"([^"]*)"/.exec(r))) { T.push({ t: 'v', v: m[1] }); i += m[0].length; continue; }
      if ((m = /^([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9.]*)\s*\(/.exec(r))) { T.push({ t: 'f', v: m[1].toUpperCase().normalize('NFD').replace(/[̀-ͯ]/g, '') }); i += m[0].length; continue; }
      if ((m = /^\$?([A-Za-z]{1,2})\$?(\d+)(?::\$?([A-Za-z]{1,2})\$?(\d+))?/.exec(r))) { T.push(m[3] ? { t: 'g', a: [colIndex(m[1]), +m[2] - 1], b: [colIndex(m[3]), +m[4] - 1] } : { t: 'r', v: m[1].toUpperCase() + m[2] }); i += m[0].length; continue; }
      if ((m = /^(VRAI|TRUE|FAUX|FALSE)\b/i.exec(r))) { T.push({ t: 'v', v: /^(VRAI|TRUE)$/i.test(m[1]) }); i += m[0].length; continue; }
      if ((m = /^(<=|>=|<>|[-+*/^&=<>(),;%])/.exec(r))) { T.push({ t: 'o', v: m[1] }); i += m[1].length; continue; }
      throw sheetErr('#NOM?');
    }
    let p = 0;
    const peek = v => T[p] && T[p].t === 'o' && T[p].v === v, eat = v => { if (!peek(v)) throw sheetErr('#ERREUR'); p++; };
    const cmp = () => { let a = cat(); while (T[p] && T[p].t === 'o' && ['=', '<>', '<', '>', '<=', '>='].includes(T[p].v)) { const o = T[p++].v, b = cat(); const x = typeof a === 'string' || typeof b === 'string' ? [String(a ?? ''), String(b ?? '')] : [num(a), num(b)]; a = o === '=' ? x[0] === x[1] : o === '<>' ? x[0] !== x[1] : o === '<' ? x[0] < x[1] : o === '>' ? x[0] > x[1] : o === '<=' ? x[0] <= x[1] : x[0] >= x[1]; } return a; };
    const cat = () => { let a = add(); while (peek('&')) { p++; const b = add(); a = String(a ?? '') + String(b ?? ''); } return a; };
    const add = () => { let a = mul(); while (peek('+') || peek('-')) { const o = T[p++].v, b = mul(); a = o === '+' ? num(a) + num(b) : num(a) - num(b); } return a; };
    const mul = () => { let a = pow(); while (peek('*') || peek('/')) { const o = T[p++].v, b = pow(); if (o === '/' && num(b) === 0) throw sheetErr('#DIV/0!'); a = o === '*' ? num(a) * num(b) : num(a) / num(b); } return a; };
    const pow = () => { let a = una(); while (peek('^')) { p++; a = Math.pow(num(a), num(una())); } return a; };
    const una = () => { if (peek('-')) { p++; return -num(una()); } if (peek('+')) { p++; return num(una()); } let a = prim(); while (peek('%')) { p++; a = num(a) / 100; } return a; };
    const prim = () => {
      const t = T[p++]; if (!t) throw sheetErr('#ERREUR');
      if (t.t === 'v') return t.v;
      if (t.t === 'r') return get(t.v);
      if (t.t === 'g') { const out = []; for (let r = Math.min(t.a[1], t.b[1]); r <= Math.max(t.a[1], t.b[1]); r++) { const row = []; for (let c = Math.min(t.a[0], t.b[0]); c <= Math.max(t.a[0], t.b[0]); c++) row.push(get(colName(c) + (r + 1))); out.push(row); } return out; }
      if (t.t === 'f') { const fn = SHEET_FN[t.v]; if (!fn || t.v[0] === '_') throw sheetErr('#NOM?'); const args = []; if (!peek(')')) { args.push(cmp()); while (peek(';') || peek(',')) { p++; args.push(cmp()); } } eat(')'); return fn(args); }
      if (t.t === 'o' && t.v === '(') { const v = cmp(); eat(')'); return v; }
      throw sheetErr('#ERREUR');
    };
    const v = cmp(); if (p < T.length) throw sheetErr('#ERREUR');
    return v;
  }
  return val;
}
const sheetShow = v => v == null ? '' : v.err ? v.err : typeof v === 'number' ? (isFinite(v) ? v.toLocaleString('fr-FR', { maximumFractionDigits: 4 }) : '#NUM!') : typeof v === 'boolean' ? (v ? 'VRAI' : 'FAUX') : String(v);
function mkInk(stroke) {
  /* stamped brushes scatter past the line, so their box is wider; b.ox/oy keep the paper texture where it was drawn */
  const [x0, y0, x1, y1] = inkBounds(stroke.p, stroke.b ? stroke.s * 1.9 : stroke.s);
  const p = stroke.p.map((v, i) => Math.round((i % 3 === 0 ? v - x0 : i % 3 === 1 ? v - y0 : v) * 100) / 100);
  const w = Math.max(1, x1 - x0), h = Math.max(1, y1 - y0);
  const it = { id: uid('k'), k: 'ink', x: x0, y: y0, w, h, w0: w, h0: h, t: stroke.t, c: stroke.c, s: stroke.s, o: stroke.o, p };
  if (stroke.b) it.b = Object.assign({}, stroke.b, { ox: Math.round(((stroke.b.ox || 0) + x0) * 100) / 100, oy: Math.round(((stroke.b.oy || 0) + y0) * 100) / 100 });
  return it;
}

/* ---------- geometry ---------- */
const boxOf = it => [it.x, it.y, it.x + it.w, it.y + it.h];
function unionBox(list) { let b = null; for (const it of list) { const q = it.k === 'conn' ? null : boxOf(it); if (!q) continue; if (!b) b = q.slice(); else { b[0] = Math.min(b[0], q[0]); b[1] = Math.min(b[1], q[1]); b[2] = Math.max(b[2], q[2]); b[3] = Math.max(b[3], q[3]); } } return b; }
const boxHit = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
const inBox = (x, y, b) => x >= b[0] && x <= b[2] && y >= b[1] && y <= b[3];

/* outline of a shape as a polygon (relative to its box) */
function shapePoly(sh, w, h, n = 56) {
  const P = [];
  const ell = (cx, cy, rx, ry, a0 = 0, a1 = Math.PI * 2, m = n) => { for (let i = 0; i < m; i++) { const a = a0 + (a1 - a0) * i / m; P.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]); } };
  switch (sh) {
    case 'ellipse': ell(w / 2, h / 2, w / 2, h / 2); break;
    case 'diamond': P.push([w / 2, 0], [w, h / 2], [w / 2, h], [0, h / 2]); break;
    case 'tri': P.push([w / 2, 0], [w, h], [0, h]); break;
    case 'hex': { const d = Math.min(w * .25, h * .5); P.push([d, 0], [w - d, 0], [w, h / 2], [w - d, h], [d, h], [0, h / 2]); break; }
    case 'starsh': for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, r = i % 2 ? .42 : 1; P.push([w / 2 + Math.cos(a) * w / 2 * r, h / 2 + Math.sin(a) * h / 2 * r + h * .04]); } break;
    case 'bubble': { const t = h * .8; P.push([0, 0], [w, 0], [w, t], [w * .42, t], [w * .2, h], [w * .24, t], [0, t]); break; }
    case 'pill': { const r = Math.min(h / 2, w / 2); ell(w - r, h / 2, r, r, -Math.PI / 2, Math.PI / 2, 14); ell(r, h / 2, r, r, Math.PI / 2, Math.PI * 1.5, 14); break; }
    case 'round': { const r = Math.min(18, w / 4, h / 4); ell(w - r, r, r, r, -Math.PI / 2, 0, 6); ell(w - r, h - r, r, r, 0, Math.PI / 2, 6); ell(r, h - r, r, r, Math.PI / 2, Math.PI, 6); ell(r, r, r, r, Math.PI, Math.PI * 1.5, 6); break; }
    case 'cloud': { const m = 72; for (let i = 0; i < m; i++) { const a = i / m * Math.PI * 2, bump = 1 + .09 * Math.abs(Math.sin(a * 4.5)); P.push([w / 2 + Math.cos(a) * w / 2 * .9 * bump, h / 2 + Math.sin(a) * h / 2 * .86 * bump]); } break; }
    default: P.push([0, 0], [w, 0], [w, h], [0, h]);
  }
  return P;
}
const SMOOTH_SHAPES = new Set(['ellipse', 'pill', 'round', 'cloud']);
function polyD(P) { return 'M' + P.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L') + 'Z'; }
/* hand-drawn outline: each edge bows a little, two passes, corners overshoot. lvl 2 is the cartoonist's hand. */
function roughD(P, smooth, seed, sw, lvl = 1) {
  const r = rng(seed || .37), j = (a) => (r() - .5) * 2 * a, out = [];
  const amp = Math.max(1.2, sw * .7) * (lvl === 2 ? 2.2 : 1), bowK = lvl === 2 ? 2.4 : 1;
  for (let pass = 0; pass < 2; pass++) {
    if (smooth) {
      const n = P.length, off = Math.floor(r() * n), ph = r() * 6, over = Math.ceil(n * .08);
      const cx = P.reduce((s, v) => s + v[0], 0) / n, cy = P.reduce((s, v) => s + v[1], 0) / n;
      let d = '';
      for (let i = 0; i <= n + over; i++) {
        const p = P[(i + off) % n], q = P[(i + off + 1) % n], a = (i / n) * Math.PI * 2;
        const wob = Math.sin(a * 2 + ph + pass) * amp * .9 + (lvl === 2 ? Math.sin(a * 5 + ph) * amp * .35 : 0);
        const dx = p[0] - cx, dy = p[1] - cy, l = Math.hypot(dx, dy) || 1;
        const x = p[0] + dx / l * wob, y = p[1] + dy / l * wob;
        if (!i) d += `M${x.toFixed(1)} ${y.toFixed(1)}`;
        else { const mx = (x + (q[0] + dx / l * wob)) / 2, my = (y + (q[1] + dy / l * wob)) / 2; d += `Q${x.toFixed(1)} ${y.toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
      }
      out.push(d);
    } else {
      let d = '';
      for (let i = 0; i < P.length; i++) {
        const a = P[i], b = P[(i + 1) % P.length], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
        const e0 = j(2) - 2 * bowK, e1 = j(2) + 2 * bowK;
        const x0 = a[0] + ux * e0 + j(amp * .6), y0 = a[1] + uy * e0 + j(amp * .6), x1 = b[0] + ux * e1 + j(amp * .6), y1 = b[1] + uy * e1 + j(amp * .6);
        const bow = j(Math.min(len * .02 * bowK, 5 * bowK)), mx = (x0 + x1) / 2 - uy * bow, my = (y0 + y1) / 2 + ux * bow;
        d += `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
      }
      out.push(d);
    }
  }
  return out;
}
/* a hand-drawn open path through points (connectors, polylines) */
function roughLineD(pts, seed, sw, lvl = 1) {
  const r = rng(seed || .41), j = a => (r() - .5) * 2 * a, amp = Math.max(1, sw * .6) * (lvl === 2 ? 2 : 1), out = [];
  for (let pass = 0; pass < 2; pass++) {
    let d = '';
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, ux = (b[0] - a[0]) / len, uy = (b[1] - a[1]) / len;
      const x0 = a[0] + j(amp * .5), y0 = a[1] + j(amp * .5), x1 = b[0] + j(amp * .5), y1 = b[1] + j(amp * .5);
      const bow = j(Math.min(len * .025, 6) * (lvl === 2 ? 2 : 1)), mx = (x0 + x1) / 2 - uy * bow, my = (y0 + y1) / 2 + ux * bow;
      d += `${i ? 'L' : 'M'}${x0.toFixed(1)} ${y0.toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
    }
    out.push(d);
  }
  return out;
}
const dashAttr = (dash, sw) => dash === 'dash' ? ` stroke-dasharray="${(sw * 4).toFixed(1)} ${(sw * 3).toFixed(1)}"` : dash === 'dot' ? ` stroke-dasharray="${(sw * .2).toFixed(1)} ${(sw * 2.4).toFixed(1)}"` : '';
function fillDefs(it, col) {
  if (!it.fc || it.fill === 'solid' || !it.fill) return { defs: '', fill: it.fc ? `fill="${it.fc}"` : 'fill="none"' };
  const id = 'p' + it.id, g = it.sw * 4 + 6;
  const lines = it.fill === 'cross' ? `<path d="M0 0L${g} ${g}M${g} 0L0 ${g}" stroke="${it.fc}" stroke-width="${Math.max(1, it.sw * .7)}"/>` : `<path d="M${-g} 0L${g * 2} ${g * 3}M${-g} ${-g}L${g * 2} ${g * 2}M${-g} ${g}L${g * 2} ${g * 4}" stroke="${it.fc}" stroke-width="${Math.max(1, it.sw * .7)}"/>`;
  return { defs: `<defs><pattern id="${id}" patternUnits="userSpaceOnUse" width="${g}" height="${g}" patternTransform="rotate(${it.fill === 'cross' ? 0 : -8})">${lines}</pattern></defs>`, fill: `fill="url(#${id})"` };
}
function shapeSVG(it) {
  const P = shapePoly(it.sh, it.w, it.h), sc = inkColor(it.sc || '#1E1E1E'), fd = fillDefs(it, sc), dash = dashAttr(it.dash, it.sw);
  if (it.sty === 'clean') {
    const d = it.sh === 'rect' ? `M0 0H${it.w}V${it.h}H0Z` : polyD(P);
    return `<svg class="sh" viewBox="0 0 ${it.w} ${it.h}">${fd.defs}<path d="${d}" ${fd.fill} stroke="${sc}" stroke-width="${it.sw}" stroke-linejoin="round" stroke-linecap="round"${dash} vector-effect="non-scaling-stroke"/></svg>`;
  }
  const rough = roughD(P, SMOOTH_SHAPES.has(it.sh), it.sd, it.sw, it.sty === 'wild' ? 2 : 1);
  return `<svg class="sh" viewBox="0 0 ${it.w} ${it.h}">${fd.defs}${it.fc ? `<path d="${polyD(P)}" ${fd.fill} stroke="none"/>` : ''}${rough.map((d, i) => `<path d="${d}" fill="none" stroke="${sc}" stroke-width="${it.sw * (i ? .7 : 1)}" stroke-linecap="round" stroke-linejoin="round" opacity="${i ? .75 : 1}"${dash}/>`).join('')}</svg>`;
}
/* where the line from an item's centre towards (tx,ty) leaves its outline */
function borderPoint(it, tx, ty, gap = 6) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2, dx = tx - cx, dy = ty - cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
  const P = it.k === 'shape' ? shapePoly(it.sh, it.w, it.h, 40).map(p => [p[0] + it.x, p[1] + it.y]) : it.k === 'mind' && it.parent == null ? shapePoly('pill', it.w, it.h, 24).map(p => [p[0] + it.x, p[1] + it.y]) : [[it.x, it.y], [it.x + it.w, it.y], [it.x + it.w, it.y + it.h], [it.x, it.y + it.h]];
  let best = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], b = P[(i + 1) % P.length], ex = b[0] - a[0], ey = b[1] - a[1], den = ux * ey - uy * ex;
    if (Math.abs(den) < 1e-9) continue;
    const t = ((a[0] - cx) * ey - (a[1] - cy) * ex) / den, s = ((a[0] - cx) * uy - (a[1] - cy) * ux) / den;
    if (t > 0 && s >= -1e-6 && s <= 1 + 1e-6 && t > best) best = t;
  }
  if (!best) best = Math.min(it.w, it.h) / 2;
  return [cx + ux * (best + gap), cy + uy * (best + gap)];
}
function sideAnchor(it, tx, ty, gap = 8) {
  const cx = it.x + it.w / 2, cy = it.y + it.h / 2, dx = (tx - cx) / (it.w || 1), dy = (ty - cy) / (it.h || 1);
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? { x: it.x + it.w + gap, y: cy, nx: 1, ny: 0 } : { x: it.x - gap, y: cy, nx: -1, ny: 0 };
  return dy > 0 ? { x: cx, y: it.y + it.h + gap, nx: 0, ny: 1 } : { x: cx, y: it.y - gap, nx: 0, ny: -1 };
}
/* a smooth open spline through points, as path data; returns {d, ta, tb} */
function splineD(P) {
  const n = P.length; if (n < 2) return { d: '', ta: [1, 0], tb: [1, 0] };
  if (n === 2) return { d: `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}L${P[1][0].toFixed(1)} ${P[1][1].toFixed(1)}`, ta: [P[0][0] - P[1][0], P[0][1] - P[1][1]], tb: [P[1][0] - P[0][0], P[1][1] - P[0][1]] };
  let d = `M${P[0][0].toFixed(1)} ${P[0][1].toFixed(1)}`; let c1 = null, cN = null;
  for (let i = 0; i < n - 1; i++) {
    const p0 = P[i > 0 ? i - 1 : 0], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2 < n ? i + 2 : n - 1];
    const a = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], b = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    if (i === 0) c1 = a; if (i === n - 2) cN = b;
    d += `C${a[0].toFixed(1)} ${a[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
  }
  return { d, ta: [P[0][0] - c1[0], P[0][1] - c1[1]], tb: [P[n - 1][0] - cN[0], P[n - 1][1] - cN[1]] };
}
function polyMid(P) { let L = 0; const seg = []; for (let i = 0; i < P.length - 1; i++) { const l = Math.hypot(P[i + 1][0] - P[i][0], P[i + 1][1] - P[i][1]); seg.push(l); L += l; } let t = L / 2; for (let i = 0; i < seg.length; i++) { if (t <= seg[i]) { const k = seg[i] ? t / seg[i] : 0; return [P[i][0] + (P[i + 1][0] - P[i][0]) * k, P[i][1] + (P[i + 1][1] - P[i][1]) * k]; } t -= seg[i]; } return P[Math.floor(P.length / 2)]; }
/* connector geometry: returns {d, a, b, ta, tb, mid, pts} with end points, end tangents and the points of the polyline.
   An end is free {x,y}, bound to an item {id} (best side), pinned inside an item {id,fx,fy} (fractions of its box,
   Miro-like), or a branch {on,t,x,y} sitting at t (0..1 of the length) along another connector. */
function connGeom(c, byId, depth = 0) {
  const A = c.a.id ? byId.get(c.a.id) : null, B = c.b.id ? byId.get(c.b.id) : null;
  const fa = pinPoint(A, c.a), fb = pinPoint(B, c.b);
  const loose = e => e.on && depth < 4 && byId.get(e.on) && byId.get(e.on).k === 'conn' ? connPointAt(byId.get(e.on), byId, e.t, depth + 1) : [e.x, e.y];
  const ac = fa ? [fa.x, fa.y] : A ? [A.x + A.w / 2, A.y + A.h / 2] : loose(c.a), bc = fb ? [fb.x, fb.y] : B ? [B.x + B.w / 2, B.y + B.h / 2] : loose(c.b);
  const mids = (c.pts || []).map(p => [p[0], p[1]]);
  const aimA = mids.length ? mids[0] : bc, aimB = mids.length ? mids[mids.length - 1] : ac;
  let a, b, d, ta, tb, mid;
  if (c.route === 'straight' || mids.length) {
    a = A && !fa ? borderPoint(A, aimA[0], aimA[1]) : ac; b = B && !fb ? borderPoint(B, aimB[0], aimB[1]) : bc;
    if (A && !fa && !mids.length) a = borderPoint(A, b[0], b[1]);
    const P = [a, ...mids, b];
    if (c.route === 'curve' && mids.length) { const s = splineD(P); d = s.d; ta = s.ta; tb = s.tb; mid = mids.length === 1 ? mids[0] : polyMid(P); }
    else { d = 'M' + P.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L'); ta = [P[0][0] - P[1][0], P[0][1] - P[1][1]]; tb = [b[0] - P[P.length - 2][0], b[1] - P[P.length - 2][1]]; mid = polyMid(P); }
    return { d, a, b, ta, tb, mid, pts: P };
  }
  const sa = fa || (A ? sideAnchor(A, bc[0], bc[1]) : null), sb = fb || (B ? sideAnchor(B, ac[0], ac[1]) : null);
  a = sa ? [sa.x, sa.y] : ac; b = sb ? [sb.x, sb.y] : bc;
  const dist = Math.hypot(b[0] - a[0], b[1] - a[1]), k = clamp(dist * .45, 30, 260);
  const na = sa ? [sa.nx, sa.ny] : norm2(b[0] - a[0], b[1] - a[1]), nb = sb ? [sb.nx, sb.ny] : norm2(a[0] - b[0], a[1] - b[1]);
  if (c.route === 'elbow') {
    const pa = [a[0] + na[0] * 22, a[1] + na[1] * 22], pb = [b[0] + nb[0] * 22, b[1] + nb[1] * 22];
    const pts = [a, pa];
    if (na[0] !== 0) { const mx = (pa[0] + pb[0]) / 2; if (nb[0] !== 0) pts.push([mx, pa[1]], [mx, pb[1]]); else pts.push([pb[0], pa[1]]); }
    else { const my = (pa[1] + pb[1]) / 2; if (nb[1] !== 0) pts.push([pa[0], my], [pb[0], my]); else pts.push([pa[0], pb[1]]); }
    pts.push(pb, b);
    d = 'M' + pts.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join('L');
    ta = [pts[0][0] - pts[1][0], pts[0][1] - pts[1][1]]; tb = [b[0] - pb[0], b[1] - pb[1]];
    const m = Math.floor(pts.length / 2); mid = [(pts[m - 1][0] + pts[m][0]) / 2, (pts[m - 1][1] + pts[m][1]) / 2];
    return { d, a, b, ta, tb, mid, pts };
  }
  const c1 = [a[0] + na[0] * k, a[1] + na[1] * k], c2 = [b[0] + nb[0] * k, b[1] + nb[1] * k];
  d = `M${a[0].toFixed(1)} ${a[1].toFixed(1)}C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${b[0].toFixed(1)} ${b[1].toFixed(1)}`;
  ta = [a[0] - c1[0], a[1] - c1[1]]; tb = [b[0] - c2[0], b[1] - c2[1]];
  mid = [.125 * a[0] + .375 * c1[0] + .375 * c2[0] + .125 * b[0], .125 * a[1] + .375 * c1[1] + .375 * c2[1] + .125 * b[1]];
  return { d, a, b, ta, tb, mid, pts: [a, b], bez: [c1, c2] };
}
/* a pinned end: the point inside the item, leaving through the nearest side */
function pinPoint(it, e) {
  if (!it || e.fx == null) return null;
  const x = it.x + e.fx * it.w, y = it.y + e.fy * it.h, d = [e.fy * it.h, (1 - e.fx) * it.w, (1 - e.fy) * it.h, e.fx * it.w], m = d.indexOf(Math.min(...d));
  return { x, y, nx: [0, 1, 0, -1][m], ny: [-1, 0, 1, 0][m] };
}
/* points along a connector as drawn (curves sampled), for branches that start on it */
function connSamples(c, byId, depth = 0) {
  const g = connGeom(c, byId, depth), out = [], cub = (p0, p1, p2, p3) => { for (let i = out.length ? 1 : 0; i <= 16; i++) { const t = i / 16, u = 1 - t; out.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0], u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]); } };
  if (g.bez) cub(g.a, g.bez[0], g.bez[1], g.b);
  else if (c.route === 'curve' && g.pts.length > 2) { const P = g.pts, n = P.length; for (let i = 0; i < n - 1; i++) { const p0 = P[i > 0 ? i - 1 : 0], p1 = P[i], p2 = P[i + 1], p3 = P[i + 2 < n ? i + 2 : n - 1]; cub(p1, [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6], [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6], p2); } }
  else out.push(...g.pts);
  return out;
}
function connPointAt(c, byId, t, depth = 0) {
  const S = connSamples(c, byId, depth); let L = 0; const seg = [];
  for (let i = 0; i < S.length - 1; i++) { const l = Math.hypot(S[i + 1][0] - S[i][0], S[i + 1][1] - S[i][1]); seg.push(l); L += l; }
  let r = clamp(t, 0, 1) * L;
  for (let i = 0; i < seg.length; i++) { if (r <= seg[i]) { const k = seg[i] ? r / seg[i] : 0; return [S[i][0] + (S[i + 1][0] - S[i][0]) * k, S[i][1] + (S[i + 1][1] - S[i][1]) * k]; } r -= seg[i]; }
  return S[S.length - 1];
}
/* where a point falls along a connector, 0..1 */
function connTOf(c, byId, x, y) {
  const S = connSamples(c, byId); let L = 0, best = Infinity, at = 0;
  for (let i = 0; i < S.length; i++) { if (i) L += Math.hypot(S[i][0] - S[i - 1][0], S[i][1] - S[i - 1][1]); const d = Math.hypot(S[i][0] - x, S[i][1] - y); if (d < best) { best = d; at = L; } }
  return L ? at / L : .5;
}
function norm2(x, y) { const l = Math.hypot(x, y) || 1; return [x / l, y / l]; }
function headD(p, t, kind, sw) {
  if (!kind || kind === 'none') return '';
  const [ux, uy] = norm2(t[0], t[1]), L = 11 + sw * 2.2, a = .46, f = v => v.toFixed(1);
  const lx = p[0] - (ux * Math.cos(a) - uy * Math.sin(a)) * L, ly = p[1] - (uy * Math.cos(a) + ux * Math.sin(a)) * L;
  const rx = p[0] - (ux * Math.cos(-a) - uy * Math.sin(-a)) * L, ry = p[1] - (uy * Math.cos(-a) + ux * Math.sin(-a)) * L;
  const nx = -uy, ny = ux, r = 3 + sw;
  switch (kind) {
    case 'tri': return `<path d="M${f(p[0])} ${f(p[1])}L${f(lx)} ${f(ly)}L${f(rx)} ${f(ry)}Z" class="hf"/>`;
    case 'dot': return `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(r)}" class="hf"/>`;
    case 'circle': return `<circle cx="${f(p[0] - ux * r)}" cy="${f(p[1] - uy * r)}" r="${f(r)}" class="hs" style="fill:var(--paper)"/>`;
    case 'bar': { const B = 6 + sw * 1.6; return `<path d="M${f(p[0] + nx * B)} ${f(p[1] + ny * B)}L${f(p[0] - nx * B)} ${f(p[1] - ny * B)}" class="hs"/>`; }
    case 'diamond': { const L2 = L * .55, W2 = L * .34, bx = p[0] - ux * L2, by = p[1] - uy * L2, cx = p[0] - ux * L2 * 2, cy = p[1] - uy * L2 * 2; return `<path d="M${f(p[0])} ${f(p[1])}L${f(bx + nx * W2)} ${f(by + ny * W2)}L${f(cx)} ${f(cy)}L${f(bx - nx * W2)} ${f(by - ny * W2)}Z" class="hf"/>`; }
    default:
      /* a theme can ask for a solid barbed head instead of the open chevron (manifest headSolid) */
      if (theme().headSolid) { const L3 = L * 1.1, lx2 = p[0] - (ux * Math.cos(a * .9) - uy * Math.sin(a * .9)) * L3, ly2 = p[1] - (uy * Math.cos(a * .9) + ux * Math.sin(a * .9)) * L3, rx2 = p[0] - (ux * Math.cos(-a * .9) - uy * Math.sin(-a * .9)) * L3, ry2 = p[1] - (uy * Math.cos(-a * .9) + ux * Math.sin(-a * .9)) * L3, ix = p[0] - ux * L3 * .62, iy = p[1] - uy * L3 * .62; return `<path d="M${f(p[0])} ${f(p[1])}L${f(lx2)} ${f(ly2)}Q${f(ix)} ${f(iy)} ${f(rx2)} ${f(ry2)}Z" class="hf hs"/>`; }
      return `<path d="M${f(lx)} ${f(ly)}L${f(p[0])} ${f(p[1])}L${f(rx)} ${f(ry)}" class="hs"/>`;
  }
}
function connBox(c, byId) { const g = connGeom(c, byId); const xs = g.pts.map(p => p[0]), ys = g.pts.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; }

/* ---------- text: light markup for notes, shapes and labels ----------
   "# Titre", "- puce", "[ ] à faire", "[x] fait" */
function fmtText(txt) {
  const lines = String(txt ?? '').split('\n');
  return lines.map((l, i) => {
    let m;
    if ((m = l.match(/^\s*\[( |x|X)\]\s?(.*)$/))) return `<div class="ck${m[1] !== ' ' ? ' on' : ''}" data-line="${i}"><i></i><span>${esc(m[2]) || '&nbsp;'}</span></div>`;
    if ((m = l.match(/^\s*[-•*]\s+(.*)$/))) return `<div class="bl">${esc(m[1])}</div>`;
    if ((m = l.match(/^#\s+(.*)$/))) return `<div class="hd">${esc(m[1])}</div>`;
    return `<div>${esc(l) || '<br>'}</div>`;
  }).join('');
}
function toggleLine(txt, i) { const L = String(txt).split('\n'); if (L[i] == null) return txt; L[i] = L[i].replace(/^(\s*)\[( |x|X)\]/, (m, s, v) => `${s}[${v === ' ' ? 'x' : ' '}]`); return L.join('\n'); }
const itemText = it => it.k === 'frame' ? it.title : it.k === 'link' ? (it.title || it.url) : it.k === 'file' ? it.name : it.k === 'task' ? ((taskById(it.task) || {}).t || '') : it.k === 'doc' ? ((docById(it.doc) || {}).title || '') : it.k === 'image' ? it.cap : it.k === 'sheet' ? (() => { const v = sheetEval(it.cells); return [it.title, ...Array.from({ length: it.rows }, (_, r) => Array.from({ length: it.cols }, (_, c) => sheetShow(v(colName(c) + (r + 1)))).join('\t').replace(/\t+$/, '')).filter(Boolean)].join('\n'); })() : it.k === 'todo' ? [it.title, ...it.tasks.map(id => { const t = taskById(id); return t ? `[${t.done ? 'x' : ' '}] ${t.t}` : ''; })].filter(Boolean).join('\n') : (it.txt || '');
const KIND_NAMES = { note: 'Post-it', text: 'Texte', shape: 'Forme', image: 'Image', file: 'Fichier', link: 'Lien', ink: 'Trait', mind: 'Idée', frame: 'Cadre', task: 'Tâche', doc: 'Document', todo: 'Liste', sheet: 'Tableur', conn: 'Flèche' };

/* web links on the board */
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return String(u || ''); } };
const isInsta = u => /(^|\.)(instagram\.com|instagr\.am)$/i.test(hostOf(u));
const isImgUrl = u => /^data:image\//i.test(u) || /^https?:\/\/[^?#]+\.(png|jpe?g|gif|webp|avif|bmp|svg)([?#].*)?$/i.test(u);
const unEntity = s => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x([0-9a-f]+);/gi, (m, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (m, d) => String.fromCodePoint(+d));
function instaTitle(u) { let p = ''; try { p = new URL(u).pathname; } catch (e) {} return /^\/(reel|reels|tv)\//.test(p) ? 'Reel Instagram' : /^\/p\//.test(p) ? 'Publication Instagram' : /^\/stories\//.test(p) ? 'Story Instagram' : (p.split('/').filter(Boolean)[0] ? '@' + p.split('/').filter(Boolean)[0] + ' sur Instagram' : 'Instagram'); }
/* "Nom on Instagram: "légende"" → "Nom : légende" */
function cleanTitle(t, ig) {
  t = unEntity(t).replace(/\s+/g, ' ').trim();
  if (ig) { const m = /^(.*?) (?:on|sur) Instagram\s*:\s*["“«]?(.*?)["”»]?$/i.exec(t); if (m) t = m[2] ? `${m[1]} : ${m[2]}` : m[1]; }
  return t.length > 110 ? t.slice(0, 108) + '…' : t;
}
const IG_GLYPH = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#fff" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="#fff" stroke="none"/></svg>';
