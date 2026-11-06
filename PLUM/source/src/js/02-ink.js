/* ================= ink =================
   Same stroke model as Notely Sketch 0.3: pressure-shaped radius, Catmull-Rom resampling,
   tapered ends and the smoothing filter. Strokes are stored as [x,y,p,...] and drawn as one
   filled SVG outline, so they stay sharp at every zoom. Each pen shapes the outline differently:
   the marker has a chisel nib, the brush swells with pressure, the pencil is masked by paper grain,
   the watercolour gets a wet ragged edge and the airbrush is blurred. */
const PENS = {
  pencil: { name: 'Crayon', icon: 'pencil', hint: 'Grain du papier, s’affine sous la main légère', size: 3, min: 1, max: 12, thin: .55, gamma: 1.1, o: .95, smooth: .3, grain: true },
  pen: { name: 'Stylo', icon: 'pen', hint: 'Trait fin qui s’élargit avec la pression, pointes effilées', size: 3.5, min: 1, max: 12, thin: .8, gamma: 1, taper: true, o: 1, smooth: .5 },
  fine: { name: 'Feutre', icon: 'fine', hint: 'Trait régulier, bouts ronds', size: 4, min: 1, max: 14, thin: .08, gamma: 1, o: 1, smooth: .45 },
  brush: { name: 'Pinceau', icon: 'brush', hint: 'Pleins et déliés très marqués', size: 14, min: 3, max: 40, thin: .93, gamma: 1.3, taper: true, taperLen: 3.2, o: 1, smooth: .55 },
  marker: { name: 'Marqueur', icon: 'marker', hint: 'Pointe biseautée, encre translucide', size: 22, min: 6, max: 60, thin: .15, gamma: 1, o: .6, multiply: true, chisel: true, smooth: .4 },
  water: { name: 'Aquarelle', icon: 'water', hint: 'Lavis humide, bord chargé', size: 26, min: 6, max: 80, thin: .5, gamma: 1.1, o: .5, multiply: true, wet: true, smooth: .55 },
  air: { name: 'Aérographe', icon: 'air', hint: 'Voile doux et diffus', size: 48, min: 10, max: 120, thin: .35, gamma: 1, o: .35, blur: true, smooth: .6 },
  highlight: { name: 'Surligneur', icon: 'hl', hint: 'Large et plat, pour marquer', size: 22, min: 8, max: 60, thin: 0, gamma: 1, o: .42, multiply: true, flat: true, smooth: .6 },
  /* atelier brushes: stamped along the stroke with a nib, a paper texture, flow and spacing (see the brush engine below) */
  natural: { name: 'Crayon naturel', icon: 'pencil', hint: 'Mine grasse sur papier grainé', size: 42, min: 1, max: 200, thin: .6, gamma: 1.1, o: .85, smooth: .35, stamp: { sh: 'grain', tx: 'grain', fl: .7, sp: .12, dy: { ps: 1, po: 1, rot: 0, sc: 0 } } },
  charcoal: { name: 'Charbon', icon: 'pencil', hint: 'Poudreux, se charge avec la pression', size: 48, min: 1, max: 200, thin: .5, gamma: 1, o: .85, smooth: .4, stamp: { sh: 'grain', tx: 'charcoal', fl: .45, sp: .08, dy: { ps: 1, po: 1, rot: 1, sc: 1 } } },
  chalk: { name: 'Pastel sec', icon: 'marker', hint: 'Bâton plat qui accroche le grain', size: 36, min: 1, max: 200, thin: .3, gamma: 1, o: .9, smooth: .4, stamp: { sh: 'flat', tx: 'powder', fl: .85, sp: .1, dy: { ps: 0, po: 1, rot: 1, sc: 0 } } },
  dry: { name: 'Pinceau sec', icon: 'brush', hint: 'Poils écartés, la toile apparaît', size: 40, min: 1, max: 200, thin: .6, gamma: 1, o: .95, smooth: .5, stamp: { sh: 'feather', tx: 'canvas', fl: .55, sp: .05, dy: { ps: 1, po: 0, rot: 1, sc: 0 } } },
  gouache: { name: 'Gouache', icon: 'brush', hint: 'Pointe souple et couvrante', size: 24, min: 1, max: 200, thin: .8, gamma: 1.2, o: 1, smooth: .55, stamp: { sh: 'taper', tx: 'none', fl: .9, sp: .05, dy: { ps: 1, po: 0, rot: 1, sc: 0 } } },
  spray: { name: 'Éclaboussures', icon: 'air', hint: 'Projections dispersées', size: 60, min: 1, max: 200, thin: .4, gamma: 1, o: .9, smooth: .5, stamp: { sh: 'grain', tx: 'splat', fl: .4, sp: .3, dy: { ps: 1, po: 1, rot: 0, sc: 1 } } },
  inkfine: { name: 'Encre fine', icon: 'pen', hint: 'Plume souple, encre dense et nette', size: 6, min: 1, max: 200, thin: .7, gamma: 1, o: 1, smooth: .5, stamp: { sh: 'taper', tx: 'none', fl: 1, sp: .04, dy: { ps: 1, po: 0, rot: 1, sc: 0 } } },
  /* painting knife: a flat blade dragged across the paper, streaks along the stroke and paint that breaks up */
  knife: { name: 'Couteau', icon: 'knife', hint: 'Lame plate, pâte striée qui accroche', size: 28, min: 4, max: 200, thin: .2, gamma: 1, o: 1, smooth: .6, stamp: { sh: 'knife', tx: 'impasto', fl: .5, sp: .03, dy: { ps: 0, po: 1, rot: 1, sc: 0 } } },
  /* 0.2.36 alpha brushes, after Concepts: every dab is a real scanned mark (src/brushes/tip-*.webp), on a real paper grain.
     fx = how the dab reacts: tl tilt shading, vs/vo speed on size/opacity, tp taper at the start (× size), pm smallest size under
     light pressure, jt/oj size/opacity jitter, rj turn jitter, rd roundness, sa scatter, cnt dabs per step, cj colour jitter,
     wet darker wet edge, td how deep the paper grain cuts */
  graphite: { name: 'Graphite', icon: 'pencil', hint: 'Mine tendre : appuyez pour foncer, inclinez le stylet pour ombrer', size: 5, min: 1, max: 60, thin: .5, gamma: 1, o: .92, smooth: .3, alpha: 1, stamp: { sh: 't_graphite', tx: 'paper', fl: .42, sp: .06, dy: { ps: 1, po: 1, rot: 0, sc: 0 }, fx: { tl: 1, pm: .35, jt: .12, td: .75 } } },
  inkbrush: { name: 'Pinceau encre', icon: 'brush', hint: 'Pointe souple : plein en appuyant, délié en accélérant', size: 12, min: 2, max: 90, thin: .9, gamma: 1.2, o: 1, smooth: .55, alpha: 1, stamp: { sh: 't_ink', tx: 'none', fl: 1, sp: .035, dy: { ps: 1, po: 0, rot: 1, sc: 0 }, fx: { pm: .07, vs: -.55, tp: 2.2, rd: .82 } } },
  fusain: { name: 'Fusain', icon: 'pencil', hint: 'Poudreux et sec, le grain du papier ressort', size: 22, min: 2, max: 140, thin: .5, gamma: 1, o: .95, smooth: .4, alpha: 1, stamp: { sh: 't_charcoal', tx: 'paper', fl: .26, sp: .05, dy: { ps: 1, po: 1, rot: 0, sc: 1 }, fx: { tl: .8, pm: .4, jt: .18, sa: .25, td: .9 } } },
  aqua: { name: 'Aquarelle', icon: 'water', hint: 'Lavis transparent, bords chargés, papier torchon', size: 38, min: 4, max: 200, thin: .5, gamma: 1, o: .62, multiply: true, smooth: .55, alpha: 1, stamp: { sh: 't_water', tx: 'rough', fl: .16, sp: .08, dy: { ps: 1, po: 1, rot: 0, sc: 0 }, fx: { pm: .45, jt: .14, wet: 1, td: .32, cj: .05, vo: -.3 } } },
  crayon: { name: 'Craie grasse', icon: 'marker', hint: 'Cire qui saute sur le grain', size: 16, min: 2, max: 120, thin: .4, gamma: 1, o: 1, smooth: .4, alpha: 1, stamp: { sh: 't_crayon', tx: 'paper', fl: .7, sp: .07, dy: { ps: 1, po: 1, rot: 0, sc: 0 }, fx: { pm: .5, jt: .08, td: .65, tl: .5 } } },
  bristle: { name: 'Brosse', icon: 'brush', hint: 'Poils secs qui suivent le geste, sur toile', size: 30, min: 4, max: 200, thin: .5, gamma: 1, o: 1, smooth: .55, alpha: 1, stamp: { sh: 't_bristle', tx: 'linen', fl: .5, sp: .035, dy: { ps: 1, po: 0, rot: 1, sc: 0 }, fx: { pm: .4, rj: .06, td: .45, tp: 1.2, cj: .04 } } },
  airsoft: { name: 'Aérographe', icon: 'air', hint: 'Voile pulvérisé, se charge en repassant', size: 70, min: 6, max: 300, thin: .3, gamma: 1, o: .9, smooth: .6, alpha: 1, stamp: { sh: 't_spray', tx: 'none', fl: .1, sp: .07, dy: { ps: 0, po: 1, rot: 0, sc: 0 }, fx: { jt: .1 } } },
  sponge: { name: 'Éponge', icon: 'water', hint: 'Tampon poreux, irrégulier', size: 56, min: 8, max: 240, thin: .4, gamma: 1, o: 1, smooth: .5, alpha: 1, stamp: { sh: 't_sponge', tx: 'none', fl: .75, sp: .32, dy: { ps: 1, po: 1, rot: 0, sc: 1 }, fx: { jt: .35, oj: .45, sa: .5, cj: .08 } } },
  alcohol: { name: 'Marqueur à alcool', icon: 'marker', hint: 'Pointe biseau, encre qui fonce en repassant', size: 22, min: 4, max: 90, thin: .1, gamma: 1, o: .7, multiply: true, smooth: .45, alpha: 1, stamp: { sh: 't_marker', tx: 'none', fl: .9, sp: .03, dy: { ps: 0, po: 0, rot: 0, sc: 0 }, fx: { rd: .3, wet: .25 } } }
};
/* the alpha brushes, in the order of the drawing bar */
const ALPHA_PENS = ['graphite', 'inkbrush', 'fusain', 'aqua', 'crayon', 'bristle', 'airsoft', 'sponge', 'alcohol'];
/* 1 to 8 stay the classic pens of 0.5; 9 is the natural pencil */
const PEN_ORDER = ['pencil', 'pen', 'fine', 'brush', 'marker', 'water', 'air', 'highlight', 'natural', 'charcoal', 'chalk', 'dry', 'gouache', 'spray', 'inkfine', 'knife', ...ALPHA_PENS];
const PEN_DEFAULT_COLORS = { pencil: '#3A3F46', pen: '#1B1E22', fine: '#1971C2', brush: '#23496F', marker: '#8EC5D8', water: '#4F86B8', air: '#E58C73', highlight: '#FDE047', natural: '#3B3A36', charcoal: '#2B2826', chalk: '#E8DCC4', dry: '#6E8F5E', gouache: '#C8553D', spray: '#2A6F7F', inkfine: '#24262A' };
const INK_COLORS = ['#1B1E22', '#E03131', '#F08C00', '#2F9E44', '#1971C2', '#6E56F0', '#D9467E', '#8B5E3C'];
const HL_COLORS = ['#FDE047', '#86EFAC', '#93C5FD', '#F9A8D4', '#FDBA74', '#C4B5FD'];
const easeT = t => Math.sin(clamp(t, 0, 1) * Math.PI / 2);
/* the three brushes of the simple drawing module (0.2.25): pen, felt tip, highlighter; the others stay for old strokes
   and for the full atelier (Réglages > Board > Atelier de dessin : complet) */
const FAST_PENS = ['pen', 'fine', 'highlight'];
/* the simple drawing module: the three quick pens, then the alpha brushes (0.2.36); keys 1…9 follow this order */
const LITE_PENS = [...FAST_PENS, ...ALPHA_PENS];
const radiusFor = (def, s, p) => s * .5 * ((1 - def.thin) + def.thin * Math.pow(clamp(p, 0, 1), def.gamma));
const STAMP_DEF = { sh: 'native', tx: 'none', fl: 1, sp: .1, dy: { ps: 1, po: 0, rot: 0, sc: 0 } };
/* a pen not given a colour yet takes this number of the theme's scheme (00-util.js) */
const PEN_DEFAULT_SCHEME = { pencil: 2, pen: 1, fine: 11, brush: 11, marker: 19, water: 11, air: 6, highlight: 8, natural: 1, charcoal: 1, chalk: 14, dry: 9, gouache: 6, spray: 10, inkfine: 1, knife: 11, graphite: 2, inkbrush: 1, fusain: 1, aqua: 11, crayon: 6, bristle: 9, airsoft: 10, sponge: 8, alcohol: 11 };
const penPref = k => { const d = PENS[k] || PENS.pen, p = (S && S.prefs.pens[k]) || {}, b = d.stamp || STAMP_DEF;
  return { c: p.c || schemeHex(PEN_DEFAULT_SCHEME[k]) || PEN_DEFAULT_COLORS[k] || '#1B1E22', s: p.s || d.size, o: p.o ?? d.o, sm: p.sm ?? d.smooth, sh: p.sh || b.sh, tx: p.tx || b.tx, fl: p.fl ?? b.fl, sp: p.sp ?? b.sp, dy: Object.assign({}, b.dy, p.dy || {}), fx: Object.assign({}, b.fx, p.fx || {}) }; };
/* the brush settings a new stroke carries; null keeps the pen's own vector outline */
const brushOf = (pr, k = 1) => { if (pr.sh === 'native' && pr.tx === 'none') return null; const b = { sh: pr.sh, tx: pr.tx, fl: +pr.fl, sp: +pr.sp, dy: Object.assign({}, pr.dy), sd: Math.random(), k: +k.toFixed(3) }; if (pr.fx && Object.keys(pr.fx).length) b.fx = Object.assign({}, pr.fx); return b; };
/* the brush a new stroke of pen k carries: the alpha brushes always, the others only in the full atelier */
const strokeBrush = (k, pr, z = 1) => (PENS[k] && PENS[k].alpha) || (typeof atelierFull === 'function' && atelierFull()) ? brushOf(pr, z) : null;

function densify(a, step) {
  const n = (a.length / 3) | 0, out = [];
  if (n < 2) return a.slice();
  for (let i = 0; i < n - 1; i++) {
    const j0 = i > 0 ? i - 1 : 0, j3 = i + 2 < n ? i + 2 : n - 1;
    const x0 = a[j0 * 3], y0 = a[j0 * 3 + 1], x1 = a[i * 3], y1 = a[i * 3 + 1], x2 = a[i * 3 + 3], y2 = a[i * 3 + 4], x3 = a[j3 * 3], y3 = a[j3 * 3 + 1], p1 = a[i * 3 + 2], p2 = a[i * 3 + 5];
    const m = Math.max(1, Math.ceil(Math.hypot(x2 - x1, y2 - y1) / step));
    for (let j = 0; j < m; j++) {
      const t = j / m, t2 = t * t, t3 = t2 * t;
      out.push(.5 * (2 * x1 + (x2 - x0) * t + (2 * x0 - 5 * x1 + 4 * x2 - x3) * t2 + (3 * x1 - x0 - 3 * x2 + x3) * t3),
        .5 * (2 * y1 + (y2 - y0) * t + (2 * y0 - 5 * y1 + 4 * y2 - y3) * t2 + (3 * y1 - y0 - 3 * y2 + y3) * t3), p1 + (p2 - p1) * t);
    }
  }
  out.push(a[(n - 1) * 3], a[(n - 1) * 3 + 1], a[(n - 1) * 3 + 2]);
  return out;
}

/* Filled outline of a stroke as SVG path data (also fed to Path2D for the live preview). */
function inkOutline(raw, st) {
  const def = PENS[st.t] || PENS.pen, s = st.s;
  const a = densify(raw, clamp(s * .3, .04, 2.5)), n = (a.length / 3) | 0;
  if (!n) return '';
  const q = s < 2 ? 100 : 10, f = v => Math.round(v * q) / q;
  const X = new Float64Array(n), Y = new Float64Array(n), R = new Float64Array(n), C = new Float64Array(n), DX = new Float64Array(n), DY = new Float64Array(n);
  let total = 0, rmax = 0;
  for (let i = 0; i < n; i++) { X[i] = a[i * 3]; Y[i] = a[i * 3 + 1]; if (i) total += Math.hypot(X[i] - X[i - 1], Y[i] - Y[i - 1]); C[i] = total; }
  let any = false;
  for (let i = 0; i < n; i++) { const ia = i > 1 ? i - 2 : 0, ib = i + 2 < n ? i + 2 : n - 1, dx = X[ib] - X[ia], dy = Y[ib] - Y[ia], l = Math.hypot(dx, dy); if (l > 1e-9) { DX[i] = dx / l; DY[i] = dy / l; any = true; } }
  if (any) { for (let i = 1; i < n; i++) if (!DX[i] && !DY[i]) { DX[i] = DX[i - 1]; DY[i] = DY[i - 1]; } for (let i = n - 2; i >= 0; i--) if (!DX[i] && !DY[i]) { DX[i] = DX[i + 1]; DY[i] = DY[i + 1]; } }
  else for (let i = 0; i < n; i++) { DX[i] = 1; DY[i] = 0; }
  const TL = s * (def.taperLen || 2.6), CS = Math.SQRT1_2;
  for (let i = 0; i < n; i++) {
    let r = radiusFor(def, s, a[i * 3 + 2]);
    if (def.taper) { r *= .12 + .88 * easeT(C[i] / TL); r *= .12 + .88 * easeT((total - C[i]) / TL); }
    /* chisel nib held at 45°: full width across the nib, a thin line along it */
    if (def.chisel) r *= .28 + .72 * Math.abs(DY[i] * CS - DX[i] * CS);
    R[i] = Math.max(r, s * .04); if (R[i] > rmax) rmax = R[i];
  }
  if (n < 2 || total < s * .08) { const r = f(rmax), x = X[n - 1], y = Y[n - 1]; return `M${f(x - r)} ${f(y)}a${r} ${r} 0 1 0 ${f(2 * r)} 0a${r} ${r} 0 1 0 ${f(-2 * r)} 0Z`; }
  const Lx = new Float64Array(n), Ly = new Float64Array(n), Rx = new Float64Array(n), Ry = new Float64Array(n);
  for (let i = 0; i < n; i++) { const nx = -DY[i], ny = DX[i]; Lx[i] = X[i] + nx * R[i]; Ly[i] = Y[i] + ny * R[i]; Rx[i] = X[i] - nx * R[i]; Ry[i] = Y[i] - ny * R[i]; }
  const K = .5523, o = [];
  const capStart = () => { if (def.flat) { o.push(`L${f(Lx[0])} ${f(Ly[0])}`); return; } const cx = X[0], cy = Y[0], r = R[0], dx = DX[0], dy = DY[0], nx = -dy, ny = dx, bx = cx - dx * r, by = cy - dy * r;
    o.push(`C${f(Rx[0] - dx * r * K)} ${f(Ry[0] - dy * r * K)} ${f(bx - nx * r * K)} ${f(by - ny * r * K)} ${f(bx)} ${f(by)}`,
      `C${f(bx + nx * r * K)} ${f(by + ny * r * K)} ${f(Lx[0] - dx * r * K)} ${f(Ly[0] - dy * r * K)} ${f(Lx[0])} ${f(Ly[0])}`); };
  const capEnd = () => { const i = n - 1; if (def.flat) { o.push(`L${f(Rx[i])} ${f(Ry[i])}`); return; } const cx = X[i], cy = Y[i], r = R[i], dx = DX[i], dy = DY[i], nx = -dy, ny = dx, fx = cx + dx * r, fy = cy + dy * r;
    o.push(`C${f(Lx[i] + dx * r * K)} ${f(Ly[i] + dy * r * K)} ${f(fx + nx * r * K)} ${f(fy + ny * r * K)} ${f(fx)} ${f(fy)}`,
      `C${f(fx - nx * r * K)} ${f(fy - ny * r * K)} ${f(Rx[i] + dx * r * K)} ${f(Ry[i] + dy * r * K)} ${f(Rx[i])} ${f(Ry[i])}`); };
  o.push(`M${f(Rx[0])} ${f(Ry[0])}`); capStart();
  for (let i = 1; i < n - 1; i++) o.push(`Q${f(Lx[i])} ${f(Ly[i])} ${f((Lx[i] + Lx[i + 1]) / 2)} ${f((Ly[i] + Ly[i + 1]) / 2)}`);
  o.push(`L${f(Lx[n - 1])} ${f(Ly[n - 1])}`); capEnd();
  for (let i = n - 2; i > 0; i--) o.push(`Q${f(Rx[i])} ${f(Ry[i])} ${f((Rx[i] + Rx[i - 1]) / 2)} ${f((Ry[i] + Ry[i - 1]) / 2)}`);
  o.push('Z');
  /* sharp reversals flip the outline; a disc wound the same way keeps the fill solid there */
  let area = 0;
  for (let j = 0, m = 2 * n; j < m; j++) { const k = (j + 1) % m; const xa = j < n ? Lx[j] : Rx[m - 1 - j], ya = j < n ? Ly[j] : Ry[m - 1 - j], xb = k < n ? Lx[k] : Rx[m - 1 - k], yb = k < n ? Ly[k] : Ry[m - 1 - k]; area += xa * yb - xb * ya; }
  const sw = area > 0 ? 1 : 0;
  for (let i = 2; i < n - 2; i++) if (DX[i - 2] * DX[i + 2] + DY[i - 2] * DY[i + 2] < -.2) { const r = f(R[i]); o.push(`M${f(X[i] + R[i])} ${f(Y[i])}A${r} ${r} 0 1 ${sw} ${f(X[i] - R[i])} ${f(Y[i])}A${r} ${r} 0 1 ${sw} ${f(X[i] + R[i])} ${f(Y[i])}Z`); i += 2; }
  return o.join('');
}
const _outline = new WeakMap();
function inkD(st) { let d = _outline.get(st.p); if (d === undefined) { d = inkOutline(st.p, st); _outline.set(st.p, d); } return d; }
/* o.blend=false leaves the blend mode to the container (the board blends whole items) */
function inkSVG(st, extra = '', o = {}) {
  if (st.b) return stampSVG(st, extra, o);
  const def = PENS[st.t] || PENS.pen, col = inkColor(st.c), d = inkD(st), op = st.o ?? def.o;
  const blend = def.multiply && o.blend !== false ? ' style="mix-blend-mode:multiply"' : '';
  const fo = op < 1 ? ` fill-opacity="${+op.toFixed(2)}"` : '';
  if (def.blur) return `<path d="${d}" fill="${col}"${fo} style="filter:blur(${(st.s * .3).toFixed(1)}px)"${extra}/>`;
  if (def.wet) return `<g${extra}${blend ? blend : ''}><path d="${d}" fill="${col}" fill-opacity="${(op * .5).toFixed(2)}" style="filter:blur(${(st.s * .14).toFixed(1)}px)"/><path d="${d}" fill="${col}" fill-opacity="${+op.toFixed(2)}" filter="url(#wet)"/><path d="${d}" fill="none" stroke="${col}" stroke-opacity="${(op * .55).toFixed(2)}" stroke-width="${Math.max(.6, st.s * .05).toFixed(2)}" stroke-linejoin="round" filter="url(#wet)"/></g>`;
  return `<path d="${d}" fill="${col}"${fo}${def.grain ? ' filter="url(#grain)"' : ''}${blend}${extra}/>`;
}
/* ---- brush engine: nibs stamped along the stroke ----
   A stroke with `b` = { sh nib, tx texture, fl flow, sp spacing, dy dynamics, sd seed, k zoom when drawn } is drawn as dabs
   of a nib image every `sp × size`, each at `fl` alpha (the stroke opacity caps the build-up), then the paper texture
   is cut out of it. The same walk feeds the live canvas and the final picture, so the stroke does not change on release.
   The picture is rasterised once per stroke and kept in memory; the stroke itself stays points, like every other one. */
const NIBS = {
  native: { name: 'Natif' },
  grain: { name: 'Grain', jit: 6.28 }, line: { name: 'Fin', jit: 0 }, wedge: { name: 'Biseau', ang: -.6, jit: .15 },
  flat: { name: 'Plat', ang: -.78, jit: .1 }, feather: { name: 'Poils', jit: .12 }, taper: { name: 'Effilé', ang: -.5, jit: .05 },
  knife: { name: 'Couteau', jit: .03 },
  /* real alpha tips (0.2.36) */
  t_graphite: { name: 'Graphite', tip: 'graphite', jit: 6.28 }, t_charcoal: { name: 'Fusain', tip: 'charcoal', jit: 6.28 }, t_ink: { name: 'Encre', tip: 'ink', jit: .2 },
  t_bristle: { name: 'Brosse', tip: 'bristle', jit: .08 }, t_crayon: { name: 'Craie', tip: 'crayon', jit: 6.28 }, t_water: { name: 'Lavis', tip: 'water', jit: 6.28 },
  t_spray: { name: 'Spray', tip: 'spray', jit: 6.28 }, t_sponge: { name: 'Éponge', tip: 'sponge', jit: 6.28 }, t_marker: { name: 'Biseau', tip: 'marker', ang: -.7, jit: .02 }
};
/* 'line' stays for strokes drawn with it, the native outline does the same job in the panel */
const NIB_ORDER = ['native', 'grain', 'wedge', 'flat', 'feather', 'taper', 'knife', 't_graphite', 't_charcoal', 't_ink', 't_bristle', 't_crayon', 't_water', 't_spray', 't_sponge', 't_marker'];
const TEXS = { none: { name: 'Lisse' }, grain: { name: 'Papier' }, powder: { name: 'Poudre' }, charcoal: { name: 'Fusain' }, canvas: { name: 'Toile' }, impasto: { name: 'Empâtement' }, splat: { name: 'Éclats' },
  paper: { name: 'Papier dessin', img: 'paper', k: .42 }, rough: { name: 'Torchon', img: 'rough', k: .75 }, linen: { name: 'Lin', img: 'linen', k: .5 } };
const TEX_ORDER = ['none', 'paper', 'rough', 'linen', 'grain', 'powder', 'charcoal', 'canvas', 'impasto', 'splat'];
/* ---- real alpha tips and paper grains (0.2.36): scans of real marks (Gemini, cut by plum/brush-tips/cut.py), white + alpha ----
   They decode once at start; until then the procedural nibs stand in, and tipGen tells every cache to make its pictures again. */
const TIP_SRC = { graphite: 'brush:tip-graphite.webp', charcoal: 'brush:tip-charcoal.webp', ink: 'brush:tip-ink.webp', bristle: 'brush:tip-bristle.webp', crayon: 'brush:tip-crayon.webp',
  water: 'brush:tip-water.webp', spray: 'brush:tip-spray.webp', sponge: 'brush:tip-sponge.webp', marker: 'brush:tip-marker.webp',
  paper: 'brush:tex-paper.webp', rough: 'brush:tex-rough.webp', linen: 'brush:tex-canvas.webp' };
const _tipImg = new Map(); let tipGen = 0;
function loadTips() {
  let left = Object.keys(TIP_SRC).length;
  for (const [id, url] of Object.entries(TIP_SRC)) {
    const im = new Image();
    im.onload = () => { const c = mkCanvas(im.naturalWidth, im.naturalHeight); c.getContext('2d').drawImage(im, 0, 0); _tipImg.set(id, c); if (--left === 0) tipsReady(); };
    im.onerror = () => { if (--left === 0) tipsReady(); };
    im.src = url;
  }
}
function tipsReady() {
  tipGen++; _nib.clear(); _tint.clear(); _tex.clear(); _bpv.clear(); _pv.clear();
  try { if (typeof Board !== 'undefined' && Board.mounted) Board.retheme(null, true); } catch (e) {}
  try { document.dispatchEvent(new CustomEvent('plum-tips')); } catch (e) {}
}
const DYNS = [['ps', 'dy-size', 'Pression → taille'], ['po', 'dy-op', 'Pression → opacité'], ['rot', 'dy-rot', 'Suit la direction'], ['sc', 'dy-sc', 'Dispersion']];
const mkCanvas = (w, h = w) => { const c = document.createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; };
/* periodic value noise, so textures tile */
function pnoise(seed, period) {
  const g = new Float32Array(period * period), r = rng(seed); for (let i = 0; i < g.length; i++) g[i] = r();
  return (x, y) => { const xi = Math.floor(x), yi = Math.floor(y), fx = x - xi, fy = y - yi, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = (i, j) => g[(((j % period) + period) % period) * period + (((i % period) + period) % period)];
    return (a(xi, yi) * (1 - sx) + a(xi + 1, yi) * sx) * (1 - sy) + (a(xi, yi + 1) * (1 - sx) + a(xi + 1, yi + 1) * sx) * sy; };
}
const _nib = new Map();
function nibImage(sh) {
  let c = _nib.get(sh); if (c) return c;
  const tp = NIBS[sh] && NIBS[sh].tip; if (tp) { c = _tipImg.get(tp); if (!c) return nibImage('grain'); _nib.set(sh, c); return c; }
  const N = 96; c = mkCanvas(N); const x = c.getContext('2d'), im = x.createImageData(N, N), d = im.data, n1 = pnoise(.37 + sh.length * .01, 8), n2 = pnoise(.71, 24), r = rng(.123);
  const ss = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = (i + .5) / N * 2 - 1, v = (j + .5) / N * 2 - 1, R = Math.hypot(u, v), aa = 2.2 / N; let a = 0;
    switch (sh) {
      case 'grain': a = ss(1, .55, R) * clamp(.25 + .95 * n1(u * 4 + 4, v * 4 + 4) * (.55 + .7 * n2(u * 12 + 12, v * 12 + 12)), 0, 1) * (r() > .12 ? 1 : .35); break;
      case 'line': a = clamp((.96 - R) / aa, 0, 1); break;
      case 'wedge': { const e1 = v - .78, e2 = -(v + .9) * .55 - u, e3 = -(v + .9) * .55 + u; a = clamp(-Math.max(e1, e2, e3) / aa, 0, 1) * (.88 + .12 * n2(u * 10 + 10, v * 10 + 10)); break; }
      case 'flat': { const q = Math.hypot(u / .98, v / .26); a = clamp((1 - q) / (aa * 3), 0, 1) * (.75 + .25 * n2(u * 16 + 16, v * 4 + 4)); break; }
      case 'feather': { const q = Math.hypot(u / .98, v / .62), st = Math.pow(n2(u * 1.5 + 30, v * 22 + 22), 1.6); a = ss(1, .35, q) * clamp(st * 1.8 - .1, 0, 1); break; }
      case 'taper': { const w = .44 * Math.pow(Math.max(0, 1 - u * u), .75); a = clamp((w - Math.abs(v)) / (aa * 2.5), 0, 1) * (.9 + .1 * n1(u * 6 + 6, v * 6 + 6)); break; }
      /* the blade across the stroke (u runs along it once turned): hard edges, ridges of paint on both ends, streaks */
      case 'knife': { const inside = clamp((.3 - Math.abs(u)) / aa, 0, 1) * clamp((.94 - Math.abs(v)) / aa, 0, 1), st = n2(3, v * 9 + 9) * .7 + n1(5, v * 3 + 3) * .3;
        a = inside * clamp(.72 + (st - .5) * 2.2, .3, 1) * (Math.abs(v) > .86 ? 1.4 : 1); a = Math.min(a, 1); break; }
      default: a = clamp((.96 - R) / aa, 0, 1);
    }
    const k = (j * N + i) * 4; d[k] = d[k + 1] = d[k + 2] = 255; d[k + 3] = a * 255;
  }
  x.putImageData(im, 0, 0); _nib.set(sh, c); return c;
}
const _tint = new Map();
function nibTinted(sh, col) {
  const key = sh + col; let c = _tint.get(key); if (c) return c;
  const n = nibImage(sh); c = mkCanvas(n.width, n.height);
  if (NIBS[sh] && NIBS[sh].tip && !_tipImg.has(NIBS[sh].tip)) { const x = c.getContext('2d'); x.drawImage(n, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height); return c; } const x = c.getContext('2d');
  x.drawImage(n, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = col; x.fillRect(0, 0, c.width, c.height);
  if (_tint.size > 120) _tint.clear(); _tint.set(key, c); return c;
}
/* texture tiles: alpha says how much paint the paper refuses */
const _tex = new Map();
function texTile(tx) {
  let c = _tex.get(tx); if (c || tx === 'none') return c || null;
  const tim = TEXS[tx] && TEXS[tx].img; if (tim) { c = _tipImg.get(tim); if (!c) return texTile('grain'); _tex.set(tx, c); return c; }
  const N = 128; c = mkCanvas(N); const x = c.getContext('2d'), im = x.createImageData(N, N), d = im.data, r = rng(.5 + tx.length * .03);
  const f8 = pnoise(.11, 8), f16 = pnoise(.29, 16), f32 = pnoise(.47, 32), f64 = pnoise(.83, 64), f4 = pnoise(.61, 4);
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const u = i / N, v = j / N; let a = 0;
    switch (tx) {
      case 'grain': { const n = .5 * f64(u * 64, v * 64) + .3 * f32(u * 32, v * 32) + .2 * f16(u * 16, v * 16); a = clamp((.56 - n) * 3.2, 0, .95); break; }
      case 'splat': { const n = .65 * f8(u * 8, v * 8) + .35 * f32(u * 32, v * 32); a = clamp((.55 - n) * 5, 0, 1); if (r() < .05) a = 0; break; }
      case 'powder': { const n = .6 * f64(u * 64, v * 64) + .4 * r(); a = clamp((.62 - n) * 2.6, 0, 1); break; }
      case 'charcoal': { const n = .55 * f64(u * 64, v * 4 * 4) + .25 * f32(u * 32, v * 8) + .2 * f4(u * 4, v * 4); a = clamp((.58 - n) * 3.4, 0, .95); break; }
      case 'canvas': { const w = Math.sin(u * Math.PI * 2 * 21) * Math.sin(v * Math.PI * 2 * 21); a = clamp(.18 + .45 * w + .3 * (f32(u * 32, v * 32) - .5), 0, .8); break; }
      /* thick paint: mostly covered, with dry skips and a few holes where the knife lifted */
      case 'impasto': { const n = .6 * f16(u * 16, v * 16) + .4 * f64(u * 64, v * 64); a = clamp((.34 - n) * 4.5, 0, 1) + (r() < .015 ? .8 : 0); a = Math.min(a, .95); break; }
    }
    const k = (j * N + i) * 4; d[k] = d[k + 1] = d[k + 2] = 0; d[k + 3] = a * 255;
  }
  x.putImageData(im, 0, 0); _tex.set(tx, c); return c;
}
/* cut the texture out of what is on ctx, in stroke coordinates (ox, oy = where the stroke sits in its sheet) */
function applyTexture(ctx, tx, ox = 0, oy = 0, scale = .5, depth = 1) {
  const t = texTile(tx); if (!t || depth <= 0) return;
  if (TEXS[tx] && TEXS[tx].k) scale *= TEXS[tx].k;
  const pat = ctx.createPattern(t, 'repeat'); if (!pat) return;
  try { pat.setTransform(new DOMMatrix().translate(-ox, -oy).scale(scale)); } catch (e) {}
  ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = pat; ctx.globalAlpha = clamp(depth, 0, 1);
  const m = ctx.getTransform().inverse(), p0 = m.transformPoint({ x: 0, y: 0 }), p1 = m.transformPoint({ x: ctx.canvas.width, y: ctx.canvas.height });
  ctx.fillRect(Math.min(p0.x, p1.x), Math.min(p0.y, p1.y), Math.abs(p1.x - p0.x), Math.abs(p1.y - p0.y)); ctx.restore();
}
/* a colour a little lighter or darker (t -1…1), for the colour jitter of the alpha brushes */
function shadeHex(col, t) { const h = String(col || '#000').replace('#', ''), v = h.length === 3 ? h.split('').map(c => c + c).join('') : h.slice(0, 6); if (!/^[0-9a-f]{6}$/i.test(v)) return col;
  const ch = [0, 2, 4].map(i => parseInt(v.slice(i, i + 2), 16)).map(c => Math.round(t > 0 ? c + (255 - c) * t : c * (1 + t)));
  return '#' + ch.map(c => clamp(c, 0, 255).toString(16).padStart(2, '0')).join(''); }
/* walks the stroke from where `w` stopped and stamps the dabs it passes; returns w for the next call.
   st.d (alpha brushes) carries [speed, tilt] for each point, 0…1, read with the pressure */
function stampWalk(ctx, st, w) {
  const b = st.b, p = st.p, n = p.length, nib = NIBS[b.sh] || NIBS.grain, sh = NIBS[b.sh] ? b.sh : 'grain', col = inkColor(st.c), img = nibTinted(sh, col), dy = b.dy || {};
  const fx = b.fx || null, F = fx || {}, D = st.d && st.d.length >= (n / 3) * 2 - 2 ? st.d : null, pm = F.pm ?? .18;
  const imgs = F.cj ? [-1, -.5, 0, .5, 1].map(t => nibTinted(sh, shadeHex(col, t * F.cj))) : null;
  const sizeAt = pp => st.s * (dy.ps ? pm + (1 - pm) * clamp(pp, 0, 1) : 1), step = pp => Math.max(.12 / (b.k || 1), (b.sp || .1) * sizeAt(pp));
  const sq = img.height / img.width;
  if (!w) w = { i: 3, acc: 1e9, px: p[0], py: p[1], pp: p[2], pv: D ? D[0] : 0, pt: D ? D[1] : 0, ang: n >= 6 ? Math.atan2(p[4] - p[1], p[3] - p[0]) : 0, r: rng(b.sd || .5), len: 0, bb: null };
  const dab = (x, y, pp, ang, vv, tt) => {
    const r1 = w.r(), r2 = w.r(), r3 = w.r(), r4 = w.r();
    let sz = sizeAt(pp), a = (b.fl ?? 1) * (dy.po ? .12 + .88 * clamp(pp, 0, 1) : 1), rot = (dy.rot ? ang : 0) + (nib.ang || 0) + (F.rj ?? nib.jit ?? .3) * (r4 - .5), im = img, cnt = 1, sa = F.sa ?? 1.1;
    if (fx) {
      const r5 = w.r(), r6 = w.r(), r7 = w.r();
      if (F.vs) sz *= Math.max(.12, 1 + F.vs * vv);
      if (F.vo) a *= Math.max(.1, 1 + F.vo * vv);
      if (F.tl) { sz *= 1 + 1.8 * F.tl * tt; a *= 1 - .6 * F.tl * tt; }
      if (F.tp) sz *= .2 + .8 * easeT(w.len / (F.tp * st.s));
      if (F.jt) sz *= 1 + F.jt * (r5 - .5) * 2;
      if (F.oj) a *= 1 - F.oj * r6;
      if (imgs) im = imgs[Math.min(4, (r7 * 5) | 0)];
      cnt = F.cnt || 1;
    }
    for (let c = 0; c < cnt; c++) {
      let X = x, Y = y, s2 = sz, a2 = a;
      if (dy.sc) { const off = (c ? w.r() - .5 : r1 - .5) * s2 * sa; X -= Math.sin(ang) * off; Y += Math.cos(ang) * off; s2 *= .55 + .8 * (c ? w.r() : r2); a2 *= .55 + .45 * r3; }
      ctx.save(); ctx.translate(X, Y); ctx.rotate(rot); if (F.rd) ctx.scale(1, F.rd); ctx.globalAlpha = clamp(a2, 0, 1); ctx.drawImage(im, -s2 / 2, -s2 * sq / 2, s2, s2 * sq); ctx.restore();
      const e = s2 * .75; if (!w.bb) w.bb = [X - e, Y - e, X + e, Y + e]; else { if (X - e < w.bb[0]) w.bb[0] = X - e; if (Y - e < w.bb[1]) w.bb[1] = Y - e; if (X + e > w.bb[2]) w.bb[2] = X + e; if (Y + e > w.bb[3]) w.bb[3] = Y + e; }
    }
  };
  if (w.acc === 1e9) { dab(w.px, w.py, w.pp, w.ang, w.pv, w.pt); w.acc = 0; }
  for (; w.i < n; w.i += 3) {
    const x = p[w.i], y = p[w.i + 1], q = p[w.i + 2], j = (w.i / 3) * 2, qv = D ? D[j] || 0 : 0, qt = D ? D[j + 1] || 0 : 0, dx = x - w.px, dyy = y - w.py, L = Math.hypot(dx, dyy);
    if (L < 1e-6) { w.pp = q; w.pv = qv; w.pt = qt; continue; }
    const ang = Math.atan2(dyy, dx); let da = ang - w.ang; da = Math.atan2(Math.sin(da), Math.cos(da)); w.ang += da * .5;
    let pos = 0, acc = w.acc;
    for (;;) { const f = pos / L, need = step(w.pp + (q - w.pp) * f) - acc; if (pos + need > L) { acc += L - pos; break; } pos += need; acc = 0; const g = pos / L; w.len += need; dab(w.px + dx * g, w.py + dyy * g, w.pp + (q - w.pp) * g, w.ang, w.pv + (qv - w.pv) * g, w.pt + (qt - w.pt) * g); }
    w.len += L - pos;
    w.acc = acc; w.px = x; w.py = y; w.pp = q; w.pv = qv; w.pt = qt;
  }
  return w;
}
/* wet edge: the paint gathers at the rim of a wash. What is on ctx minus a blurred copy of it is the rim; it goes back on top.
   rect = the part of the canvas (pixels) to work on. Needs canvas filters (Chromium, recent Safari); without them, no rim. */
const _wet = [null, null];
const canFilter = (() => { let ok = null; return () => { if (ok === null) { try { const x = mkCanvas(2).getContext('2d'); x.filter = 'blur(1px)'; ok = x.filter === 'blur(1px)'; } catch (e) { ok = false; } } return ok; }; })();
function wetEdges(ctx, amt, blur, rect) {
  if (!amt || !canFilter()) return;
  const cv = ctx.canvas; let [x, y, w, h] = rect || [0, 0, cv.width, cv.height];
  x = Math.max(0, Math.floor(x)); y = Math.max(0, Math.floor(y)); w = Math.min(cv.width - x, Math.ceil(w)); h = Math.min(cv.height - y, Math.ceil(h)); if (w < 2 || h < 2) return;
  for (let i = 0; i < 2; i++) { if (!_wet[i]) _wet[i] = mkCanvas(2); if (_wet[i].width < w || _wet[i].height < h) { _wet[i].width = Math.max(w, _wet[i].width); _wet[i].height = Math.max(h, _wet[i].height); } }
  const [A, B] = _wet, ax = A.getContext('2d'), bx = B.getContext('2d');
  ax.setTransform(1, 0, 0, 1, 0, 0); bx.setTransform(1, 0, 0, 1, 0, 0); ax.clearRect(0, 0, w, h); bx.clearRect(0, 0, w, h);
  ax.globalCompositeOperation = 'source-over'; ax.drawImage(cv, x, y, w, h, 0, 0, w, h);
  bx.filter = `blur(${Math.max(1, blur).toFixed(1)}px)`; bx.drawImage(cv, x, y, w, h, 0, 0, w, h); bx.filter = 'none';
  ax.globalCompositeOperation = 'destination-out'; ax.drawImage(B, 0, 0, w, h, 0, 0, w, h); ax.globalCompositeOperation = 'source-over';
  ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); for (let n = amt * 3; n > 0; n--) { ctx.globalAlpha = clamp(n, 0, 1); ctx.drawImage(A, 0, 0, w, h, x, y, w, h); } ctx.restore();
}
/* whole stroke into ctx (already transformed to stroke coordinates) */
function stampInto(ctx, st) {
  if (st.b.sh === 'native') { ctx.fillStyle = inkColor(st.c); try { ctx.fill(new Path2D(inkOutline(st.p, st))); } catch (e) {} }
  else stampWalk(ctx, st, null);
  const F = st.b.fx || {};
  if (F.wet) { const m = ctx.getTransform(); wetEdges(ctx, F.wet, st.s * .22 * Math.hypot(m.a, m.b), null); }
  applyTexture(ctx, st.b.tx, st.b.ox || 0, st.b.oy || 0, texScale(st), F.td ?? 1);
}
/* textures keep a readable grain on fine strokes too (below .6 they all turned into the same fine noise) */
const texScale = st => clamp(st.s / 18, .6, 1.4);
let _webp = null;
const rasterType = () => { if (_webp === null) { try { _webp = mkCanvas(2).toDataURL('image/webp').startsWith('data:image/webp'); } catch (e) { _webp = false; } } return _webp ? 'image/webp' : 'image/png'; };
const _stamp = new WeakMap();
let inkZoom = 1;   // the board's zoom, for how fine stamped strokes are rasterised
const setInkZoom = k => { inkZoom = k; };
function stampPicture(st) {
  const key = [st.c, st.s, st.o, JSON.stringify(st.b), isDarkTheme(), tipGen, st.d ? st.d.length : 0].join('|'); let v = _stamp.get(st.p);
  /* pixels per board unit: the screen's density at the zoom it was drawn at, or the zoom it is looked at now if closer;
     a picture made for a lower zoom is made again (inkZoom, set by the board once a zoom settles) instead of being enlarged */
  const dpr = clamp(devicePixelRatio || 1, 1, 3), want = clamp(dpr * Math.max(st.b.k || 1, inkZoom), .35, 8);
  if (v && v.key === key && v.res >= want * .85 - 1e-6) return v;
  const [x0, y0, x1, y1] = inkBounds(st.p, inkPad(st)), W = x1 - x0, H = y1 - y0;
  if (v && v.key === key && v.capped) return v;
  let res = want; const cap = Math.min(4096 / Math.max(W, H, 1), Math.sqrt(1.2e7 / Math.max(W * H, 1))), capped = res > cap; res = Math.min(res, cap);
  const c = mkCanvas(W * res, H * res), x = c.getContext('2d');
  x.setTransform(c.width / W, 0, 0, c.height / H, -x0 * c.width / W, -y0 * c.height / H);
  stampInto(x, st);
  v = { key, url: c.toDataURL(rasterType(), .9), x0, y0, W, H, cv: c, res, capped }; _stamp.set(st.p, v); return v;
}
function stampSVG(st, extra, o) {
  const v = stampPicture(st), def = PENS[st.t] || PENS.pen, op = st.o ?? def.o, f = n => Math.round(n * 100) / 100;
  const blend = def.multiply && o.blend !== false ? ' style="mix-blend-mode:multiply"' : '';
  return `<image href="${v.url}" x="${f(v.x0)}" y="${f(v.y0)}" width="${f(v.W)}" height="${f(v.H)}" preserveAspectRatio="none"${op < 1 ? ` opacity="${+op.toFixed(2)}"` : ''}${blend}${extra}/>`;
}
/* a sample stroke for brush previews: an S with a pressure swell */
function sampleStroke(w, h, s) {
  const pts = [], n = 60; for (let i = 0; i <= n; i++) { const t = i / n; pts.push(8 + t * (w - 16), h / 2 + Math.sin(t * Math.PI * 2 - .5) * h * .22, .15 + .85 * Math.sin(t * Math.PI)); }
  return pts;
}
const _bpv = new Map();
/* onDark: the preview sits on a dark panel, so near-black ink is shown as chalk */
function brushPreview(k, pr, w = 260, h = 64, onDark = false) {
  const s = Math.min(pr.s, h * .5), c = onDark && lum(pr.c) < .06 ? '#E6DECF' : pr.c, key = [k, c, s, pr.o, pr.sh, pr.tx, pr.fl, pr.sp, JSON.stringify(pr.dy), JSON.stringify(pr.fx || 0), w, h, isDarkTheme(), tipGen].join('|'); let v = _bpv.get(key); if (v) return v;
  const b = brushOf(pr, 1); if (b) b.sd = .42;
  const st = { t: k, c, s, o: pr.o, p: sampleStroke(w, h, s), b };
  /* a gesture that speeds up in the middle, so speed-driven brushes show their thick and thin */
  if (b && b.fx) { const n = st.p.length / 3, d = []; for (let i = 0; i < n; i++) d.push(+(.15 + .7 * Math.sin(i / (n - 1) * Math.PI)).toFixed(2), 0); st.d = d; }
  v = `<svg viewBox="0 0 ${w} ${h}" class="pvs" aria-hidden="true">${inkSVG(st)}</svg>`;
  if (_bpv.size > 200) _bpv.clear(); _bpv.set(key, v); return v;
}
/* how far past its points a stroke paints: stamped brushes scatter, tilt shading and jitter make dabs bigger */
const inkPad = st => { if (!st.b) return st.s; const F = st.b.fx || {}; return st.s * 1.9 * (1 + 1.8 * (F.tl || 0)) * (1 + (F.jt || 0)) * (st.b.dy && st.b.dy.sc ? 1 + (F.sa || 0) : 1); };
function inkBounds(p, s) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < p.length; i += 3) { if (p[i] < x0) x0 = p[i]; if (p[i] > x1) x1 = p[i]; if (p[i + 1] < y0) y0 = p[i + 1]; if (p[i + 1] > y1) y1 = p[i + 1]; }
  const pad = s * .6 + .5; return [x0 - pad, y0 - pad, x1 + pad, y1 + pad];
}
/* does a stroke pass within r of (x,y)? */
function inkHit(p, s, x, y, r) {
  const rr = (r + s * .5) * (r + s * .5);
  for (let i = 0; i < p.length; i += 3) { const dx = p[i] - x, dy = p[i + 1] - y; if (dx * dx + dy * dy < rr) return true;
    if (i + 3 < p.length) { const ax = p[i], ay = p[i + 1], bx = p[i + 3], by = p[i + 4], vx = bx - ax, vy = by - ay, l = vx * vx + vy * vy; if (l > 0) { const t = clamp(((x - ax) * vx + (y - ay) * vy) / l, 0, 1), qx = ax + vx * t - x, qy = ay + vy * t - y; if (qx * qx + qy * qy < rr) return true; } } }
  return false;
}
/* a sample stroke in the pen's own look, for pickers and previews */
const _pv = new Map();
function penPreview(k, c, s, w = 132, h = 40) {
  const key = [k, c, s, w, h, isDarkTheme()].join('|'); let v = _pv.get(key); if (v) return v;
  const def = PENS[k] || PENS.pen, size = Math.min(s, h * .62), pts = [], n = 36;
  for (let i = 0; i <= n; i++) { const t = i / n; pts.push(6 + t * (w - 12), h / 2 + Math.sin(t * Math.PI * 2 - .4) * h * .24, .12 + .88 * Math.sin(t * Math.PI)); }
  v = `<svg viewBox="0 0 ${w} ${h}" class="pvs" aria-hidden="true">${inkSVG({ t: k, c, s: size, o: def.o, p: pts })}</svg>`;
  if (_pv.size > 400) _pv.clear(); _pv.set(key, v); return v;
}

/* ---- pen input: pressure from the stylus, Wintab on the desktop app, or speed for a mouse ----
   Ink.last says what the last sample was and where it came from, for the Settings diagnostic. */
let wt = null, penSeenGlobal = false;
const Ink = { last: null, info: null, wt: () => wt };
if (DESKTOP && window.notely.onPen) {
  try { window.notely.onPen(rows => { const r = rows && rows[rows.length - 1]; if (!r) return; wt = { p: +r[0] || 0, tilt: +r[1] || 0, er: !!r[3], down: !!r[4], prox: !!r[5], at: now() }; }); } catch (e) {}
  if (window.notely.penInfo) { try { window.notely.penInfo().then(i => { Ink.info = i || { ok: false }; }).catch(() => { Ink.info = { ok: false, reason: 'pas de réponse' }; }); } catch (e) { Ink.info = { ok: false, reason: String(e && e.message || e) }; } }
}
const wintabLive = () => DESKTOP && wt && S.prefs.source !== 'ink' && now() - wt.at < 1000 && wt.prox;
const sensCurve = p => Math.pow(clamp(p, 0, 1), 1.6 - 1.2 * (S.prefs.sens ?? .5));

class InkCapture {
  /* map: { toLocal(clientX, clientY) -> {x,y}, xf() -> {k, ox, oy} local -> canvas css px } */
  constructor(canvas, map) { this.cv = canvas; this.cx = canvas.getContext('2d'); this.map = map; this.cur = null; this.raf = 0; }
  pressure(ev) {
    const P = S.prefs.pressure || 'pen';
    const useWt = wintabLive() && (ev.pointerType === 'mouse' || S.prefs.source === 'wintab');
    if (useWt) Ink.last = { src: 'Wintab', p: wt.p, tilt: Math.round(wt.tilt), type: ev.pointerType, at: Date.now() };
    else if (ev.pointerType === 'pen') Ink.last = { src: IPAD ? 'Apple Pencil' : 'Windows Ink / stylet', p: ev.pressure, tilt: Math.round(Math.hypot(ev.tiltX || 0, ev.tiltY || 0)), type: 'pen', at: Date.now() };
    else Ink.last = { src: ev.pointerType === 'touch' ? 'doigt' : 'souris', p: ev.pressure, tilt: 0, type: ev.pointerType, at: Date.now() };
    if (P === 'fixed') return .6;
    if (P === 'pen') { if (useWt) return sensCurve(wt.p > 0 ? wt.p : .02); if (ev.pointerType === 'pen') return sensCurve(ev.pressure > 0 ? ev.pressure : .01); }
    const t = ev.timeStamp || now(), dt = Math.max(1, t - this.sim.t), v = Math.hypot(ev.clientX - this.sim.x, ev.clientY - this.sim.y) / dt;
    this.sim.t = t; this.sim.x = ev.clientX; this.sim.y = ev.clientY;
    this.sim.p += (clamp(1.08 - v * .32, .28, 1) - this.sim.p) * .16; return this.sim.p;
  }
  begin(ev, st) {
    if (ev.pointerType === 'pen') penSeenGlobal = true;
    this.gen = (this.gen || 0) + 1;
    this.sim = { p: .42, t: ev.timeStamp || now(), x: ev.clientX, y: ev.clientY };
    const w = this.map.toLocal(ev.clientX, ev.clientY), p0 = this.pressure(ev), def = PENS[st.t] || PENS.pen;
    this.cur = { t: st.t, c: st.c, s: st.s, o: st.o ?? def.o, p: [w.x, w.y, p0] }; if (st.b) this.cur.b = st.b;
    /* alpha brushes also keep the speed and the stylus tilt of each point (st.d), for thick and thin and pencil shading */
    this.dyn = st.b && st.b.fx ? { t: ev.timeStamp || now(), x: ev.clientX, y: ev.clientY, v: 0, tl: this.tilt(ev) } : null;
    if (this.dyn) this.cur.d = [0, this.dyn.tl];
    this.walk = null;
    /* the three simple brushes (0.2.25) are drawn live piece by piece: each frame only adds the new bits of the line,
       instead of rebuilding the whole outline of the stroke; the finished stroke gets its exact outline */
    this.fast = !st.b && FAST_PENS.includes(st.t); this.li = 0; this.len = 0;
    this.sm = { x: w.x, y: w.y, p: p0, f: 1 - (st.smooth ?? def.smooth) * .9, k: st.k || 1, last: { x: w.x, y: w.y, p: p0 } };
    this.resize(); if (this.fast) { this.cx.setTransform(1, 0, 0, 1, 0, 0); this.cx.clearRect(0, 0, this.cv.width, this.cv.height); }
    const px = st.s * (st.k || 1);
    this.cv.style.opacity = this.cur.o; this.cv.style.mixBlendMode = def.multiply ? (isDarkTheme() ? 'screen' : 'multiply') : 'normal';
    this.cv.style.filter = st.b ? '' : def.blur ? `blur(${(px * .3).toFixed(1)}px)` : def.wet ? `blur(${(px * .06).toFixed(1)}px)` : def.grain ? 'url(#grain)' : '';
    if (st.b) { if (!this.layer) this.layer = mkCanvas(2); this.layer.width = this.cv.width; this.layer.height = this.cv.height; }
    this.draw();
  }
  /* 0 upright … 1 laid down (shading), from Wintab, Pointer Events tilt, or the Apple Pencil's altitude */
  tilt(e) {
    let deg = 0;
    if (wintabLive() && (e.pointerType === 'mouse' || S.prefs.source === 'wintab')) deg = wt.tilt || 0;
    else if (e.pointerType === 'pen') deg = e.altitudeAngle != null && e.altitudeAngle < Math.PI / 2 - .01 ? 90 - e.altitudeAngle * 180 / Math.PI : Math.min(90, Math.hypot(e.tiltX || 0, e.tiltY || 0));
    return clamp((deg - 28) / 40, 0, 1);
  }
  dynOf(e) {
    const D = this.dyn, t = e.timeStamp || now(), dt = Math.max(1, t - D.t), v = Math.hypot(e.clientX - D.x, e.clientY - D.y) / dt;
    D.t = t; D.x = e.clientX; D.y = e.clientY; D.v += (clamp(v / 2.4, 0, 1) - D.v) * .25; D.tl += (this.tilt(e) - D.tl) * .3;
    return [D.v, D.tl];
  }
  feed(ev) {
    if (!this.cur) return;
    const evs = ev.getCoalescedEvents ? ev.getCoalescedEvents() : null;
    for (const e of (evs && evs.length ? evs : [ev])) {
      const w = this.map.toLocal(e.clientX, e.clientY), p = this.pressure(e), s = this.sm, out = this.cur.p, dd = this.dyn ? this.dynOf(e) : null;
      s.last = { x: w.x, y: w.y, p, dd };
      s.x += (w.x - s.x) * s.f; s.y += (w.y - s.y) * s.f; s.p += (p - s.p) * .5;
      const n = out.length;
      if (n >= 3) { const dx = s.x - out[n - 3], dy = s.y - out[n - 2], m = .5 / s.k; if (dx * dx + dy * dy < m * m) { out[n - 1] = s.p; if (dd) { const d = this.cur.d; d[d.length - 2] = dd[0]; d[d.length - 1] = dd[1]; } continue; } }
      out.push(s.x, s.y, s.p); if (dd) this.cur.d.push(dd[0], dd[1]);
    }
    if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.draw(); });
  }
  end() {
    if (!this.cur) return null;
    const c = this.cur, l = this.sm.last, n = c.p.length;
    if (Math.hypot(l.x - c.p[n - 3], l.y - c.p[n - 2]) > .3 / this.sm.k) { c.p.push(l.x, l.y, l.p); if (c.d) c.d.push(...(l.dd || c.d.slice(-2))); }
    c.p = c.p.map(v => Math.round(v * 100) / 100);
    if (c.d) c.d = c.d.map(v => Math.round(v * 100) / 100);
    /* the live stroke stays on screen until the finished one is painted (two frames), so lifting the pencil never flashes */
    this.cur = null; this.walk = null; cancelAnimationFrame(this.raf); this.raf = 0;
    const gen = this.gen = (this.gen || 0) + 1;
    requestAnimationFrame(() => requestAnimationFrame(() => { if (this.gen === gen && !this.cur) this.cancel(); }));
    return c;
  }
  cancel() { this.cur = null; this.walk = null; cancelAnimationFrame(this.raf); this.raf = 0; this.cx.setTransform(1, 0, 0, 1, 0, 0); this.cx.clearRect(0, 0, this.cv.width, this.cv.height); if (this.layer) { const l = this.layer.getContext('2d'); l.setTransform(1, 0, 0, 1, 0, 0); l.clearRect(0, 0, this.layer.width, this.layer.height); } }
  resize() {
    const pe = this.cv.parentElement, r = { width: pe.clientWidth, height: pe.clientHeight }, dpr = Math.min(2.5, devicePixelRatio || 1);   // its own size, even when the board is turned
    const W = Math.round(r.width * dpr), H = Math.round(r.height * dpr);
    if (this.cv.width !== W || this.cv.height !== H) { this.cv.width = W; this.cv.height = H; this.cv.style.width = r.width + 'px'; this.cv.style.height = r.height + 'px'; this.li = 0; this.len = 0; }
    this.dpr = dpr;
  }
  /* page px of the stroke -> canvas pixels; m.r turns it around (m.W, m.H) when the board is turned (the canvas itself is not) */
  xform(x) {
    const m = this.map.xf(), d = this.dpr;
    x.setTransform(d, 0, 0, d, 0, 0);
    if (m.r) { x.translate(m.W, m.H); x.rotate(m.r * Math.PI / 180); x.translate(-m.W, -m.H); }
    x.translate(m.ox, m.oy); x.scale(m.k, m.k);
  }
  drawFast() {
    const x = this.cx, c = this.cur, a = c.p, n = (a.length / 3) | 0, def = PENS[c.t] || PENS.pen;
    if (!this.li) { x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.cv.width, this.cv.height); }
    this.xform(x); x.fillStyle = x.strokeStyle = inkColor(c.c); x.lineCap = 'round'; x.lineJoin = 'round';
    const TL = c.s * (def.taperLen || 2.6), rad = i => { let r = radiusFor(def, c.s, a[i * 3 + 2]); if (def.taper) r *= .12 + .88 * easeT(this.len / TL); return Math.max(r, c.s * .04); };
    if (!this.li) { const r = rad(0); x.beginPath(); x.arc(a[0], a[1], r, 0, 7); x.fill(); this.li = 1; }
    for (let i = this.li; i < n; i++) {
      const x0 = a[i * 3 - 3], y0 = a[i * 3 - 2], x1 = a[i * 3], y1 = a[i * 3 + 1];
      this.len += Math.hypot(x1 - x0, y1 - y0);
      x.lineWidth = rad(i) * 2; x.beginPath(); x.moveTo(x0, y0); x.lineTo(x1, y1); x.stroke();
    }
    this.li = Math.max(1, n);
  }
  draw() {
    const x = this.cx, c = this.cur; if (!c) return;
    if (this.fast) return this.drawFast();
    x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, this.cv.width, this.cv.height);
    this.xform(x);
    if (c.b) {
      /* stamped brush: new dabs go onto a layer, the texture is cut from the copy on screen */
      const L = this.layer, lx = L.getContext('2d');
      if (L.width !== this.cv.width || L.height !== this.cv.height) { L.width = this.cv.width; L.height = this.cv.height; this.walk = null; }
      if (c.b.sh === 'native') { lx.setTransform(1, 0, 0, 1, 0, 0); lx.clearRect(0, 0, L.width, L.height); this.xform(lx); lx.fillStyle = inkColor(c.c); try { lx.fill(new Path2D(inkOutline(c.p, c))); } catch (e) {} }
      else { this.xform(lx); this.walk = stampWalk(lx, c, this.walk); }
      x.setTransform(1, 0, 0, 1, 0, 0); x.drawImage(L, 0, 0);
      const F = c.b.fx || {};
      if (F.wet && this.walk && this.walk.bb) {
        /* only the stroke's box, in canvas pixels (the board may be turned: take the box around its four corners) */
        this.xform(x); const m = x.getTransform(), [a0, b0, a1, b1] = this.walk.bb, P = [[a0, b0], [a1, b0], [a0, b1], [a1, b1]].map(([u, v]) => [m.a * u + m.c * v + m.e, m.b * u + m.d * v + m.f]);
        const X0 = Math.min(...P.map(q => q[0])), Y0 = Math.min(...P.map(q => q[1])), X1 = Math.max(...P.map(q => q[0])), Y1 = Math.max(...P.map(q => q[1])), bl = c.s * .22 * Math.hypot(m.a, m.b);
        wetEdges(x, F.wet, bl, [X0 - bl * 2, Y0 - bl * 2, X1 - X0 + bl * 4, Y1 - Y0 + bl * 4]);
      }
      this.xform(x); applyTexture(x, c.b.tx, 0, 0, texScale(c), F.td ?? 1);
      return;
    }
    x.fillStyle = inkColor(c.c);
    try { x.fill(new Path2D(inkOutline(c.p, c))); } catch (e) {}
  }
}

function penDiagLine() {
  const l = Ink.last;
  if (!l) return 'Aucun stylet vu pour l’instant.';
  if (Date.now() - l.at > 60000) return `Dernier stylet : ${l.src}.`;
  return `${l.src} · pression ${l.p.toFixed(2)}${l.tilt ? ` · inclinaison ${l.tilt}°` : ''}`;
}
