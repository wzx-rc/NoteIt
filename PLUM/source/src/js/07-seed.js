
/* ================= procedural illustrations for the example content =================
   Painted once on a canvas the first time the app opens, then stored like a dropped image. */
const ART = {
  farm: { sky: ['#F9D9A7', '#F6B48A'], sun: '#FFF1C9', hills: ['#B7C98A', '#8FB06A', '#6E9152'], ground: '#7FA45C' },
  village: { sky: ['#BFE0F2', '#F8E3C4'], sun: '#FFF6DA', hills: ['#A9C9A4', '#86B07F', '#6A9A67'], ground: '#7BA86F' },
  forest: { sky: ['#CFE6E1', '#EEF4E8'], sun: '#FFFFFF', hills: ['#9CC3B5', '#5F9585', '#3E7366'], ground: '#4C8070' },
  mines: { sky: ['#544A7A', '#E79E86'], sun: '#FFD9B0', hills: ['#7B6F98', '#5C5077', '#40385A'], ground: '#4A3F62' },
  solar: { sky: ['#8EC9F0', '#DDF1FB'], sun: '#FFFBE6', hills: ['#BDDC8E', '#94C46B', '#77AA55'], ground: '#86B860' },
  meadow: { sky: ['#F7C9C9', '#FBE7CF'], sun: '#FFF4E0', hills: ['#C9DDA0', '#A6CC7A', '#86B35E'], ground: '#97C06B' }
};
function paintArt(kind, W = 640, H = 440, seed = .5) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d'), r = rng(seed), P = ART[kind] || ART.farm, u = W / 640;
  let g = x.createLinearGradient(0, 0, 0, H * .75); g.addColorStop(0, P.sky[0]); g.addColorStop(1, P.sky[1]); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const sx = W * (.2 + r() * .6), sy = H * (.16 + r() * .14);
  g = x.createRadialGradient(sx, sy, 0, sx, sy, 140 * u); g.addColorStop(0, P.sun); g.addColorStop(.25, P.sun + 'CC'); g.addColorStop(1, P.sun + '00'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  x.fillStyle = P.sun; x.beginPath(); x.arc(sx, sy, 30 * u, 0, 7); x.fill();
  x.fillStyle = 'rgba(255,255,255,.75)';
  for (let i = 0; i < 4; i++) { const cx = r() * W, cy = H * (.08 + r() * .25), s = (30 + r() * 30) * u; for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(cx + (j - 1.5) * s * .7, cy + (j % 2 ? -s * .25 : 0), s * .6, s * .38, 0, 0, 7); x.fill(); } }
  if (kind === 'mines') { x.fillStyle = '#6C5F8C'; x.beginPath(); x.moveTo(0, H * .7); x.lineTo(W * .28, H * .22); x.lineTo(W * .42, H * .4); x.lineTo(W * .62, H * .14); x.lineTo(W, H * .62); x.lineTo(W, H); x.lineTo(0, H); x.fill(); x.fillStyle = '#F4F0FF'; x.beginPath(); x.moveTo(W * .62, H * .14); x.lineTo(W * .58, H * .22); x.lineTo(W * .64, H * .2); x.lineTo(W * .67, H * .24); x.closePath(); x.fill(); }
  const hill = (base, amp, col, f1) => { x.fillStyle = col; x.beginPath(); x.moveTo(0, H); for (let i = 0; i <= 40; i++) { const t = i / 40; x.lineTo(t * W, base + Math.sin(t * f1 + seed * 9) * amp + Math.sin(t * f1 * 2.3 + seed * 3) * amp * .4); } x.lineTo(W, H); x.fill(); };
  hill(H * .5, 22 * u, P.hills[0], 5); hill(H * .6, 18 * u, P.hills[1], 7);
  const pine = (X, Y, s, col) => { x.fillStyle = '#5A4632'; x.fillRect(X - 2 * s, Y - 6 * s, 4 * s, 10 * s); x.fillStyle = col; for (let i = 0; i < 3; i++) { x.beginPath(); x.moveTo(X, Y - (34 - i * 8) * s - 12 * s); x.lineTo(X + (14 - i * 3) * s, Y - (i * 9) * s - 4 * s); x.lineTo(X - (14 - i * 3) * s, Y - (i * 9) * s - 4 * s); x.fill(); } };
  const tree = (X, Y, s, col) => { x.fillStyle = '#6B4F35'; x.fillRect(X - 2.5 * s, Y - 16 * s, 5 * s, 16 * s); x.fillStyle = col; [[0, -30, 15], [-10, -22, 11], [10, -22, 11], [0, -40, 10]].forEach(([dx, dy, rr]) => { x.beginPath(); x.arc(X + dx * s, Y + dy * s, rr * s, 0, 7); x.fill(); }); };
  const house = (X, Y, s, wall, roof, o = {}) => {
    const w = 70 * s, h = 46 * s; x.fillStyle = 'rgba(0,0,0,.12)'; x.beginPath(); x.ellipse(X, Y + 2 * s, w * .7, 7 * s, 0, 0, 7); x.fill();
    x.fillStyle = wall; x.fillRect(X - w / 2, Y - h, w, h);
    x.fillStyle = roof; x.beginPath(); x.moveTo(X - w / 2 - 8 * s, Y - h + 2 * s); x.lineTo(X, Y - h - 34 * s); x.lineTo(X + w / 2 + 8 * s, Y - h + 2 * s); x.fill();
    if (o.solar) { x.fillStyle = '#2C4A7A'; x.beginPath(); x.moveTo(X + 4 * s, Y - h - 28 * s); x.lineTo(X + w / 2 + 2 * s, Y - h - 4 * s); x.lineTo(X + w / 2 - 8 * s, Y - h - 2 * s); x.lineTo(X - 2 * s, Y - h - 24 * s); x.fill(); x.strokeStyle = '#9CC3F0'; x.lineWidth = 1 * s; x.stroke(); }
    x.fillStyle = '#5B3E2B'; x.fillRect(X - 7 * s, Y - 22 * s, 14 * s, 22 * s);
    x.fillStyle = '#FFE7A6'; x.fillRect(X - w / 2 + 9 * s, Y - h + 12 * s, 13 * s, 12 * s); x.fillRect(X + w / 2 - 22 * s, Y - h + 12 * s, 13 * s, 12 * s);
    if (o.chimney) { x.fillStyle = roof; x.fillRect(X + 14 * s, Y - h - 30 * s, 8 * s, 18 * s); x.fillStyle = 'rgba(255,255,255,.55)'; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(X + 18 * s + i * 6 * s, Y - h - 38 * s - i * 9 * s, (5 + i * 2) * s, 0, 7); x.fill(); } }
  };
  const turbine = (X, Y, s) => { x.strokeStyle = '#F6F7F9'; x.lineWidth = 3 * s; x.lineCap = 'round'; x.beginPath(); x.moveTo(X, Y); x.lineTo(X, Y - 110 * s); x.stroke(); const a0 = r() * 7; x.lineWidth = 3.5 * s; for (let i = 0; i < 3; i++) { const a = a0 + i * 2.094; x.beginPath(); x.moveTo(X, Y - 110 * s); x.lineTo(X + Math.cos(a) * 46 * s, Y - 110 * s + Math.sin(a) * 46 * s); x.stroke(); } x.fillStyle = '#E2E6EC'; x.beginPath(); x.arc(X, Y - 110 * s, 4 * s, 0, 7); x.fill(); };
  const windmill = (X, Y, s) => { x.fillStyle = '#E9DCC4'; x.beginPath(); x.moveTo(X - 16 * s, Y); x.lineTo(X - 9 * s, Y - 70 * s); x.lineTo(X + 9 * s, Y - 70 * s); x.lineTo(X + 16 * s, Y); x.fill(); x.fillStyle = '#9B5B3C'; x.beginPath(); x.moveTo(X - 12 * s, Y - 68 * s); x.lineTo(X, Y - 84 * s); x.lineTo(X + 12 * s, Y - 68 * s); x.fill();
    x.strokeStyle = '#7A5638'; x.lineWidth = 2.5 * s; const a0 = .5 + r(); for (let i = 0; i < 4; i++) { const a = a0 + i * Math.PI / 2; x.beginPath(); x.moveTo(X, Y - 70 * s); x.lineTo(X + Math.cos(a) * 44 * s, Y - 70 * s + Math.sin(a) * 44 * s); x.stroke(); x.save(); x.translate(X, Y - 70 * s); x.rotate(a); x.fillStyle = 'rgba(250,245,235,.9)'; x.fillRect(14 * s, 0, 30 * s, 9 * s); x.restore(); } };
  hill(H * .7, 12 * u, P.ground, 4);
  /* fields */
  if (kind === 'farm' || kind === 'meadow' || kind === 'village') { x.save(); x.beginPath(); x.rect(0, H * .76, W, H * .24); x.clip(); for (let i = 0; i < 9; i++) { x.fillStyle = i % 2 ? '#C9A35E' : '#9DBB5F'; if (kind === 'meadow') x.fillStyle = i % 2 ? '#E7A5B9' : '#A8CF7C'; x.beginPath(); const y0 = H * .8 + i * 14 * u; x.moveTo(-20, y0); x.lineTo(W * .7, y0 - 40 * u); x.lineTo(W * .7, y0 - 33 * u); x.lineTo(-20, y0 + 8 * u); x.fill(); } x.restore(); }
  const s = u * (0.9 + r() * .3);
  switch (kind) {
    case 'farm': tree(W * .14, H * .74, s * 1.2, '#6FA35A'); house(W * .5, H * .74, s * 1.4, '#F3E2C3', '#C4573A', { chimney: true }); windmill(W * .8, H * .72, s * 1.1); tree(W * .92, H * .78, s, '#7CB062'); break;
    case 'village': [[.18, '#F1D9B5', '#B4553C'], [.38, '#EBDCC8', '#3F6EA8'], [.6, '#F4E6CB', '#C7703F'], [.82, '#E8D4BC', '#8A4E3B']].forEach(([px, w, rf], i) => house(W * px, H * (.76 + (i % 2) * .05), s * (1 - (i % 2) * .15), w, rf, { chimney: i === 1 })); turbine(W * .7, H * .62, s * .8); tree(W * .05, H * .82, s, '#6FA35A'); break;
    case 'forest': for (let i = 0; i < 26; i++) { const px = r() * W, py = H * (.62 + r() * .35); pine(px, py, s * (0.7 + (py / H - .6) * 2.2), [P.hills[1], P.hills[2], '#2F5E52'][i % 3]); } x.fillStyle = 'rgba(255,255,255,.18)'; x.fillRect(0, H * .55, W, H * .1); break;
    case 'mines': { x.fillStyle = '#231C33'; x.beginPath(); x.arc(W * .45, H * .7, 40 * s, Math.PI, 0); x.lineTo(W * .45 + 40 * s, H * .7); x.fill(); x.strokeStyle = '#8A6A4A'; x.lineWidth = 7 * s; x.beginPath(); x.arc(W * .45, H * .7, 40 * s, Math.PI, 0); x.stroke();
      x.strokeStyle = '#B8A890'; x.lineWidth = 2 * s; x.beginPath(); x.moveTo(W * .45 - 18 * s, H * .7); x.lineTo(W * .3, H); x.moveTo(W * .45 + 18 * s, H * .7); x.lineTo(W * .6, H); x.stroke(); for (let i = 0; i < 6; i++) { const t = i / 6, y = H * .72 + t * H * .28; x.beginPath(); x.moveTo(W * .45 - 18 * s - t * W * .15, y); x.lineTo(W * .45 + 18 * s + t * W * .15, y); x.stroke(); }
      x.fillStyle = '#FFC46B'; x.beginPath(); x.arc(W * .45 - 50 * s, H * .66, 5 * s, 0, 7); x.fill(); for (let i = 0; i < 8; i++) pine(r() * W * .3, H * (.72 + r() * .2), s * .8, '#2C2440'); break; }
    case 'solar': house(W * .42, H * .76, s * 1.6, '#F7F4EE', '#5A6575', { solar: true }); turbine(W * .75, H * .7, s * 1.1); turbine(W * .88, H * .66, s * .8); tree(W * .14, H * .78, s * 1.1, '#77AA55');
      x.fillStyle = '#2C4A7A'; for (let i = 0; i < 4; i++) { x.save(); x.translate(W * (.1 + i * .06), H * .9); x.transform(1, 0, -.5, 1, 0, 0); x.fillRect(0, 0, 26 * s, 14 * s); x.restore(); } break;
    case 'meadow': for (let i = 0; i < 5; i++) tree(W * (.1 + r() * .8), H * (.7 + r() * .06), s * (.7 + r() * .5), ['#8FBF6A', '#6FA35A', '#A2C978'][i % 3]); house(W * .66, H * .76, s, '#F6E7D0', '#D16B5A'); break;
  }
  /* soft light and paper grain */
  g = x.createRadialGradient(W / 2, H / 2, H * .3, W / 2, H / 2, W * .75); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(40,20,0,.22)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
  const img = x.getImageData(0, 0, W, H), dd = img.data; for (let i = 0; i < dd.length; i += 4) { const n = (r() - .5) * 14; dd[i] += n; dd[i + 1] += n; dd[i + 2] += n; } x.putImageData(img, 0, 0);
  return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', .86));
}

/* a stroke from a list of points, with a little pressure and jitter so it reads as hand drawn */
function handStroke(pts, o = {}) {
  const r = rng(o.seed || hashStr(JSON.stringify(pts[0]))), p = [];
  const dense = []; for (let i = 0; i < pts.length - 1; i++) { const [ax, ay] = pts[i], [bx, by] = pts[i + 1], n = Math.max(2, Math.ceil(Math.hypot(bx - ax, by - ay) / 6)); for (let j = 0; j < n; j++) { const t = j / n; dense.push([ax + (bx - ax) * t, ay + (by - ay) * t]); } } dense.push(pts[pts.length - 1]);
  dense.forEach(([x, y], i) => { const t = i / (dense.length - 1); p.push(Math.round((x + (r() - .5) * (o.j ?? 1.2)) * 100) / 100, Math.round((y + (r() - .5) * (o.j ?? 1.2)) * 100) / 100, Math.round((.35 + Math.sin(t * Math.PI) * .55) * 100) / 100); });
  return { t: o.t || 'pen', c: o.c || '#1E1D1B', s: o.s || 3, o: 1, p };
}
const circlePts = (cx, cy, r, a0 = 0, a1 = Math.PI * 2.1, n = 28) => Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
function sunDoodle(cx, cy, r, c = '#F2A33A') {
  const out = [handStroke(circlePts(cx, cy, r), { c, s: 3 })];
  for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + .2; out.push(handStroke([[cx + Math.cos(a) * r * 1.4, cy + Math.sin(a) * r * 1.4], [cx + Math.cos(a) * r * 1.9, cy + Math.sin(a) * r * 1.9]], { c, s: 3, seed: i / 9 + .01 })); }
  return out;
}
function houseDoodle(x, y, s = 1) {
  const P = (a) => a.map(([px, py]) => [x + px * s, y + py * s]);
  return [handStroke(P([[0, 60], [0, 0], [80, 0], [80, 60], [0, 60]])), handStroke(P([[-10, 4], [40, -42], [90, 4]])), handStroke(P([[30, 60], [30, 30], [50, 30], [50, 60]])), handStroke(P([[8, 12], [22, 12], [22, 24], [8, 24], [8, 12]]), { s: 2 }), handStroke(P([[-30, 62], [120, 62]]), { s: 2.4 })];
}
function turbineDoodle(x, y, s = 1) {
  const P = (a) => a.map(([px, py]) => [x + px * s, y + py * s]);
  return [handStroke(P([[0, 120], [2, 0]]), { s: 2.6 }), handStroke(P([[2, 0], [-30, -38]]), { s: 2.4 }), handStroke(P([[2, 0], [46, -6]]), { s: 2.4 }), handStroke(P([[2, 0], [-12, 44]]), { s: 2.4 })];
}
function waveLine(x0, x1, y, amp = 3, c = '#F2A33A', s = 3.5) { const pts = []; for (let x = x0; x <= x1; x += 12) pts.push([x, y + Math.sin(x / 18) * amp]); return handStroke(pts, { c, s, j: .4 }); }

/* ================= example workspace (from the concept boards) ================= */
async function seedWorkspace() {
  const T = today();
  const sp = [['Game Concept', '#5B7CFA'], ['BRASSART', '#F2B33D'], ['Perso', '#EC6A9C'], ['WZXStore', '#E5484D'], ['3D / CG', '#8B76FF'], ['Recherche', '#F5A524']].map(([name, color]) => ({ id: uid('s'), name, color }));
  const [GC, BR, PE, WZ, CG] = sp.map(s => s.id);
  const art = {};
  for (const [k, kind, w, h, seed] of [['farm', 'farm', 640, 440, .21], ['village', 'village', 640, 440, .47], ['solar', 'solar', 640, 440, .63], ['forest', 'forest', 640, 520, .33], ['mines', 'mines', 640, 440, .71], ['meadow', 'meadow', 520, 640, .12], ['farm2', 'farm', 520, 640, .88], ['village2', 'village', 640, 480, .09]]) {
    try { const b = await paintArt(kind, w, h, seed); if (b) art[k] = { id: await Assets.put(b), w, h }; } catch (e) { console.warn('[seed art]', e); }
  }
  const A = k => (art[k] || {}).id || '';
  const t0 = Date.now(), docs = [], tasks = [];
  const doc = (o, ago) => { const d = Object.assign({ id: uid('d'), fav: false, trash: false, created: t0 - ago - 864e5 * 3, updated: t0 - ago }, o); docs.push(d); return d; };
  const task = (t, s, due, time, o = {}) => { const k = Object.assign({ id: uid('t'), t, sp: s, due: due || '', time: time || '', done: false, star: false, note: '', created: t0 - 864e5 * 2 + tasks.length * 1000 }, o); tasks.push(k); return k; };
  const wd = n => { const w = new Date(T + 'T12:00').getDay(); return addDays(T, ((n - w + 7) % 7) || 7); };

  /* --- board: Roots to Watts --- */
  {
    const hc = mkNote(120, 120, '# High Concept\n- Autonome\n- Gestion / Simulation\n- Aventure\n- Progression par âges', NOTE_COLORS[0], { w: 320, h: 320, fs: 30 });
    const ref = mkShape(690, 70, 270, 84, 'ellipse', { txt: 'Références', sc: '#3D7BD9', fs: 34 });
    const r1 = mkImage(600, 190, 230, 160, A('village')), r2 = mkImage(850, 190, 230, 160, A('farm'));
    const gp = mkShape(1290, 80, 250, 84, 'ellipse', { txt: 'Gameplay', sc: '#D9467E', fs: 34 });
    const gpl = mkText(1270, 200, '[x] RTS / Aventure hybride\n[x] Sélection personnage\n[x] Tâches / Routine\n[x] Exploration / Quêtes', { fs: 30 });
    const fi = mkImage(1820, 110, 300, 210, A('farm'), { frm: 'polaroid', cap: 'Ferme' });
    const fn = mkNote(2150, 110, '# Ferme\n- Potager\n- Poulailler\n- Composteur\n- Puits\n- Four à pain\n- Éolienne', '#FFFFFF', { w: 230, h: 300, fs: 26 });
    const hero = mkImage(820, 420, 600, 380, A('solar'), { frm: 'shadow' });
    const ti = mkText(800, 830, 'Roots to Watts', { fs: 104, bold: true }), st = mkText(880, 960, 'Craft · High-Tech · Adventure', { fs: 42 });
    const bc = mkShape(110, 600, 300, 90, 'ellipse', { txt: 'Boucles clés', sc: '#6E56F0', fs: 34 });
    const bcl = mkText(150, 720, '[x] Cultiver\n[x] Élever\n[x] Cuisiner\n[x] Construire\n[x] Échanger', { fs: 32 });
    const id = mkNote(1820, 520, '# Idées\n- Saisons / météo\n- Enfants\n- Village vivant\n- Troc / monnaie\n- Découverte reliques', NOTE_COLORS[4], { w: 330, h: 330, fs: 30 });
    const pr = mkShape(560, 1090, 270, 84, 'ellipse', { txt: 'Progression', sc: '#E5484D', fs: 34 });
    const prl = mkText(580, 1200, '- Manuel\n- Mécanique\n- Confort moderne\n- Technologies vertes', { fs: 30 });
    const p1 = mkImage(980, 1110, 240, 165, A('farm'), { frm: 'none' }), p2 = mkImage(1300, 1110, 240, 165, A('village'), { frm: 'none' }), p3 = mkImage(1620, 1110, 240, 165, A('solar'), { frm: 'none' });
    const zi = mkImage(1960, 960, 380, 260, A('mines'), { frm: 'polaroid', cap: 'Zone inconnue' });
    const tdTasks = [['Finaliser le game design', true], ['Moodboard visuel', false], ['Prototype UI / Gameplay', false], ['Lister les ressources de la ferme', false]].map(([t, done]) => { const k = task(t, GC, '', '', { done, doneAt: done ? t0 - 7200e3 : 0 }); return k.id; });
    const td = mkTodo(120, 1090, 'À faire · prototype', tdTasks, { w: 320, h: 200, c: '#FFFFFF' });
    const items = [hc, ref, r1, r2, gp, gpl, fi, fn, hero, ti, st, bc, bcl, id, pr, prl, p1, p2, p3, zi, td,
      mkConn({ id: hc.id }, { id: ref.id }, { h0: 'arrow', sc: '#5E5B54' }), mkConn({ id: ref.id }, { id: gp.id }, { sc: '#D9467E', dash: 'dash', pts: [[1130, 60]] }), mkConn({ id: bc.id }, { id: td.id }, { sc: '#6E56F0', route: 'straight', h1: 'dot' }),
      mkConn({ id: gp.id }, { id: fi.id }, { sc: '#5E5B54' }), mkConn({ id: hero.id }, { id: id.id }, { sc: '#3D7BD9' }), mkConn({ id: bc.id }, { id: hero.id }, { sc: '#6E56F0', h0: 'arrow' }),
      mkConn({ id: p1.id }, { id: p2.id }, { route: 'straight', sc: '#1E1D1B', sw: 3 }), mkConn({ id: p2.id }, { id: p3.id }, { route: 'straight', sc: '#1E1D1B', sw: 3 }), mkConn({ id: pr.id }, { id: p1.id }, { sc: '#E5484D' }),
      ...sunDoodle(1490, 610, 26).map(mkInk), mkInk(waveLine(810, 1420, 920, 4, '#F2A33A', 4))];
    doc({ type: 'board', title: 'Roots to Watts', sp: GC, bg: 'dots', items, view: null, fav: true }, 6e4 * 4);
  }
  /* --- note: Roots to Watts --- */
  doc({ type: 'note', title: 'Roots to Watts', sp: GC, paper: 'plain', fav: true,
    html: `<p class="hand-p">Craft · High-Tech · Adventure</p><ul class="chk hand-p"><li data-done="">Ferme</li><li data-done="">Village</li><li data-done="">Forêt</li><li data-done="">Mines</li><li data-done="">Zone inconnue</li></ul>`
      + (A('village2') ? `<figure contenteditable="false"><img data-asset="${A('village2')}" alt=""></figure>` : '')
      + `<p class="hand-p">Évoluer vers une autonomie positive.</p><h2>Prochaines étapes</h2><ul class="chk"><li>Finaliser le game design</li><li>Moodboard visuel</li><li>Prototype UI / Gameplay</li></ul><blockquote>Le quotidien autonome doit être satisfaisant à lui seul. :)</blockquote>`,
    ink: sunDoodle(660, 92, 22) }, 6e4 * 18);
  /* --- note: direction artistique --- */
  doc({ type: 'note', title: 'Game Concept – Direction artistique', sp: GC, paper: 'dots',
    html: (A('farm') ? `<figure contenteditable="false"><img data-asset="${A('farm')}" alt=""></figure>` : '') + `<ul class="hand-p"><li>Style chibi / stylisé</li><li>Couleurs douces</li><li>Ambiance positive</li><li>Inspi : Hay Day / Zelda / Layton</li></ul><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p><p><br></p>`,
    ink: [...houseDoodle(110, 960, 1.3), ...turbineDoodle(380, 900, 1.1), handStroke(circlePts(560, 960, 34, 0, 6.5), { s: 2.6 }), handStroke([[560, 994], [560, 1030]], { s: 2.6 }), handStroke([[540, 1032], [580, 1032]], { s: 2.2 })] }, 3600e3 * 5);
  /* --- board: moodboard --- */
  {
    const fV = mkFrame(0, 0, 1180, 900, 'Visuels'), fP = mkFrame(1240, 0, 560, 900, 'Palette et ton');
    const im = (k, x, y, w) => { const a = art[k] || { w: 4, h: 3 }; return mkImage(x, y, w, Math.round(w * a.h / a.w), A(k)); };
    const items = [fV, fP, im('village', 40, 70, 420), im('farm2', 480, 70, 300), im('forest', 800, 70, 340), im('farm', 40, 380, 420), im('meadow', 480, 470, 300), im('mines', 800, 480, 340),
      mkNote(40, 690, 'Style chibi / stylisé\n+ lisible', NOTE_COLORS[0], { w: 200, h: 180, fs: 30 }), mkNote(260, 690, 'Couleurs douces, lumière de fin de journée', NOTE_COLORS[2], { w: 200, h: 180, fs: 26 }),
      ...['#6FA35A', '#C4573A', '#F3E2C3', '#3F6EA8', '#F2A33A', '#2C4A7A'].map((c, i) => mkShape(1290 + (i % 3) * 160, 80 + Math.floor(i / 3) * 160, 120, 120, 'ellipse', { fc: c, sc: c, sty: 'clean', sw: 1 })),
      mkText(1290, 420, 'Ambiance', { fs: 40, bold: true }), mkText(1290, 490, '- Chaleureuse et positive\n- Village vivant\n- Tech verte, jamais froide', { fs: 30 }),
      mkNote(1290, 680, 'UI : grosses icônes, coins ronds, police manuscrite pour les titres', NOTE_COLORS[4], { w: 460, h: 170, fs: 26 })];
    doc({ type: 'board', title: 'Roots to Watts – Moodboard', sp: GC, bg: 'dots', items, view: null }, 3600e3 * 2);
  }
  /* --- board: plan WZXStore --- */
  {
    const out = [], cols = [['À faire', NOTE_COLORS[0], ['Photos produits', 'Fiches SEO', 'Page « À propos »']], ['En cours', NOTE_COLORS[4], ["Refonte de la page d'accueil", 'Paiement en ligne']], ['Fait', NOTE_COLORS[5], ['Logo v2', 'Nom de domaine']]];
    cols.forEach(([t], i) => out.push(mkFrame(i * 330, 0, 300, 840, t)));
    cols.forEach(([, c, list], i) => list.forEach((s, j) => out.push(mkNote(i * 330 + 40, 60 + j * 250, s, c, { fs: 30 }))));
    const tk = task('Mettre en ligne la boutique', WZ, addDays(T, 10), '', { star: true });
    out.push({ id: uid('t'), k: 'task', x: 1010, y: 60, w: 300, h: 56, task: tk.id }, mkText(1010, -90, 'Plan de projet WZXStore', { fs: 56, bold: true }));
    doc({ type: 'board', title: 'Plan de projet WZXStore', sp: WZ, bg: 'grid', items: out, view: null }, 864e5 * 1.2);
  }
  /* --- note: cours --- */
  doc({ type: 'note', title: 'Cours 3D4 – DemoReel', sp: BR, paper: 'lines',
    html: `<h2>Objectif</h2><p>Chaque étudiant repart avec une demoreel de 60 secondes, montée et exportée.</p><h2>Déroulé (3 h)</h2><ol><li>Revoir les plans retenus (20 min)</li><li>Éclairage et rendu final (1 h)</li><li>Montage et musique (1 h)</li><li>Export et retours (40 min)</li></ol><h2>À préparer</h2><ul class="chk"><li data-done="">Salle avec licences à jour</li><li>Exemples de demoreels</li><li>Grille d'évaluation</li></ul>`, ink: [] }, 864e5 * 1.5);

  { const by = t => tasks.find(k => k.t === t); const a = by('Finaliser le game design'); if (a) { a.due = T; a.time = '10:00'; a.star = true; } const b = by('Moodboard visuel'); if (b) b.due = addDays(T, 1); const c = by('Prototype UI / Gameplay'); if (c) c.due = wd(5); }
  task('Préparer cours 3D4 – DemoReel', BR, T, '14:00');
  task('Rdv planning BRASSART', BR, T, '16:00');
  task('Pack brosses', BR, addDays(T, 3));
  task('Recherche Tamagotchi iOS', PE, addDays(T, 4));
  task('Lecture psychologie', PE, '');
  task('Photos produits', WZ, addDays(T, 2));
  task('Rendu de la scène ferme', CG, addDays(T, 5));
  task('Envoyer le planning du semestre', BR, T, '', { done: true, doneAt: t0 - 3600e3 });

  sp[0].media = [['forest', 'Forêt – référence'], ['meadow', 'Prairie – référence'], ['village2', 'Village – ambiance']].filter(([k]) => art[k]).map(([k, name]) => ({ type: 'image', asset: art[k].id, name, w: art[k].w, h: art[k].h, added: t0 - 3600e3 }));
  return { v: 2, spaces: sp, docs, tasks, prefs: JSON.parse(JSON.stringify(DEFAULT_PREFS)) };
}
