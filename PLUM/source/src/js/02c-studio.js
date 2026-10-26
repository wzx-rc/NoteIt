/* ================= atelier: the drawing studio =================
   Everything around the brush when drawing, after the user's "dark organic" concept: a radial colour picker with
   recent and favourite colours, palettes (Perso / Nature / Saisons / Projet, palettes taken from images),
   the brush panel (presets, size, opacity, flow, spacing, nib, texture, dynamics), colour harmonies, the colour
   history, variations of a colour, the eyedropper loupe, a vertical tool bar and a rail of favourite colours.
   The board mounts it in drawing mode; notes use the brush panel and the radial picker in popovers.
   Art direction from the user's Nature Anthracite kit: anthracite panels with paper grain, dry-pastel dabs, discreet
   drawn leaves, cream and bronze selection. Two layouts: 'compact' (cards on the right of the board) and 'planche'
   (every module at once, in the composition of the concept board). */
const STUDIO_DEF = { favs: ['#E9C46A', '#2A6F7F', '#3E5C9A', '#D8A7A0', '#6F8F72'], hist: [], pals: null, palFav: [], tab: 'perso', harm: 'analog', varAmt: .35, cards: ['brush', 'palettes'], shut: [], radial: true, leaves: true, presets: [], pick: null };
const HIST_MAX = 25;
const studioPrefs = () => { if (!S.prefs.studio) S.prefs.studio = JSON.parse(JSON.stringify(STUDIO_DEF)); return S.prefs.studio; };

/* ---------- colour helpers ---------- */
const hsv = c => Colors.hex2hsv(c), hexv = (h, s, v) => Colors.hsv2hex(((h % 360) + 360) % 360, clamp(s, 0, 1), clamp(v, 0, 1));
const sameC = (a, b) => (a || '').toUpperCase() === (b || '').toUpperCase();
/* warm light, cool shadow: hue drifts toward yellow when lighter and toward blue when darker */
function shiftTemp(h, t) { const target = t > 0 ? 50 : 230; let d = target - h; d = ((d + 540) % 360) - 180; return h + d * Math.min(1, Math.abs(t)) * .35; }

/* ---------- painterly bits: blob swatches and leaves ---------- */
const blob = (c, i = 0, attrs = '', st = '') => { ensureDabs(); return `<button class="blb b${i % 5}" style="--c:${c};${st}" data-c="${c}" title="${c}" aria-label="${c}" draggable="true" ${attrs}></button>`; };
/* dry-pastel dabs: five irregular masks drawn once on a canvas (ragged edge, bristle marks, grain showing through) */
let _dabs = false;
function ensureDabs() {
  if (_dabs || typeof document === 'undefined') return; _dabs = true;
  let css = '';
  for (let i = 0; i < 5; i++) {
    const N = 96, c = mkCanvas(N), x = c.getContext('2d'), r = rng(.17 + i * .131), nz = pnoise(.3 + i * .07, 8);
    const C = N / 2, R = N * .41, n = [2.6, 3.3, 2.3, 3.8, 2.9][i], rot = r() * Math.PI, sy = .86 + r() * .1;
    x.fillStyle = '#fff'; x.beginPath();
    for (let k = 0; k <= 160; k++) {
      const a = k / 160 * Math.PI * 2, ca = Math.cos(a - rot), sa = Math.sin(a - rot), se = Math.pow(Math.pow(Math.abs(ca), n) + Math.pow(Math.abs(sa), n), -1 / n);
      const rr = R * Math.min(se, 1.18) * (.84 + .26 * nz(k / 160 * 8, i * 2)) * (1 + (r() - .5) * .08);
      const px = C + Math.cos(a) * rr, py = C + Math.sin(a) * rr * sy; k ? x.lineTo(px, py) : x.moveTo(px, py);
    }
    x.fill();
    /* bristles past the edge */
    x.strokeStyle = '#fff'; x.lineCap = 'round';
    for (let k = 0; k < 150; k++) { const a = r() * Math.PI * 2, r0 = R * (.72 + r() * .2), r1 = R * (.96 + r() * .16), t = a + (r() - .5) * .25; x.globalAlpha = .2 + r() * .5; x.lineWidth = .5 + r() * 1.3; x.beginPath(); x.moveTo(C + Math.cos(a) * r0, C + Math.sin(a) * r0 * sy); x.lineTo(C + Math.cos(t) * r1, C + Math.sin(t) * r1 * sy); x.stroke(); }
    /* the paper shows through: grain holes and a few dry streaks along the stroke */
    x.globalCompositeOperation = 'destination-out';
    for (let k = 0; k < 520; k++) { x.globalAlpha = .12 + r() * .5; const s = .5 + r() * 1.4; x.fillRect(r() * N, r() * N, s, s * (.6 + r())); }
    const da = rot + Math.PI / 2;
    for (let k = 0; k < 16; k++) { const ox = C + (r() - .5) * R * 1.5, oy = C + (r() - .5) * R * 1.4, L = 8 + r() * 22; x.globalAlpha = .1 + r() * .22; x.lineWidth = .7 + r() * 1.4; x.beginPath(); x.moveTo(ox, oy); x.lineTo(ox + Math.cos(da) * L, oy + Math.sin(da) * L); x.stroke(); }
    css += `.blb.b${i}{--m:url(${c.toDataURL()})}`;
  }
  const st = document.createElement('style'); st.id = 'atl-dabs'; st.textContent = css; document.head.append(st);
}
function leafPath(L, W) { return `M0 0C${L * .28} ${-W} ${L * .72} ${-W * .85} ${L} 0C${L * .7} ${W * .8} ${L * .3} ${W} 0 0Z`; }
/* a sprig: a curved twig with leaves on both sides, in the dark greens of the concept */
function sprig(seed, len = 120, bend = .25, n = 7, sc = 1, o = {}) {
  const r = rng(seed), pts = [];
  const cx = len * .5, cy = -len * bend;
  const at = t => ({ x: 2 * (1 - t) * t * cx + t * t * len, y: 2 * (1 - t) * t * cy, a: Math.atan2(2 * (1 - t) * cy - 2 * t * cy, 2 * (1 - t) * cx + 2 * t * (len - cx)) });
  const LEAF = ['#5C6955', '#505D49', '#728063', '#3B5142', '#66704F', '#47563F', '#829072'];
  let out = `<path d="M0 0Q${cx} ${cy} ${len} 0" fill="none" stroke="${o.twig || '#5A4A38'}" stroke-width="${2.8 * sc}" stroke-linecap="round"/><path d="M${len * .1} 2Q${cx} ${cy + 3} ${len * .8} 1" fill="none" stroke="#3E3428" stroke-width="${1.4 * sc}" stroke-linecap="round" opacity=".8"/>`;
  for (let i = 0; i < n; i++) {
    const t = .12 + .86 * (i / Math.max(1, n - 1)), p = at(t), side = i % 2 ? 1 : -1, L = (17 + r() * 15) * sc * (1 - t * .3), W = L * (.3 + r() * .1);
    const ang = p.a * 180 / Math.PI + side * (38 + r() * 26), f = LEAF[Math.floor(r() * LEAF.length)];
    out += `<g transform="translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(1)})"><path d="${leafPath(L, W)}" fill="${f}" stroke="#C2BE92" stroke-opacity=".22" stroke-width=".8"/><path d="M${L * .06} 0L${L * .9} 0M${L * .35} 0L${L * .55} ${-W * .5}M${L * .5} 0L${L * .7} ${W * .45}" stroke="#C0C4A0" stroke-width=".7" opacity=".45" fill="none"/></g>`;
  }
  const tip = at(1); out += `<g transform="translate(${tip.x} ${tip.y}) rotate(${(tip.a * 180 / Math.PI).toFixed(0)})"><path d="${leafPath(22 * sc, 7 * sc)}" fill="#728063" stroke="#C2BE92" stroke-opacity=".22" stroke-width=".8"/></g>`;
  return out;
}
const _leaf = new Map();
function leafDecor(kind) {
  let v = _leaf.get(kind); if (v) return v;
  if (kind !== 'wreath') v = `<i class="lf lf-${kind}" aria-hidden="true"></i>`;
  else {
    /* twigs hugging the wheel on the left and along the bottom, as in the concept */
    const { W, C } = RAD, RW = RAD.RB + 34; let g = '';
    const arc = (a0, a1, R, seed, n, len = 84) => { const r = rng(seed); for (let i = 0; i < n; i++) { const a = (a0 + (a1 - a0) * (i + .5) / n) * Math.PI / 180, x = C + Math.cos(a) * R, y = C + Math.sin(a) * R, rot = (a * 180 / Math.PI) + 90 + (r() - .5) * 16; g += `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) rotate(${rot.toFixed(1)})">${sprig(seed + i * .013, len + r() * 30, (r() - .5) * .5, 5, 1.2)}</g>`; } };
    const twig = (a0, a1, R, w, col, dash = '') => { const p = a => [C + Math.cos(a * Math.PI / 180) * R, C + Math.sin(a * Math.PI / 180) * R]; const [x0, y0] = p(a0), [x1, y1] = p(a1); return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${R} ${R} 0 ${Math.abs(a1 - a0) > 180 ? 1 : 0} 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" ${dash}/>`; };
    const vines = twig(55, 268, RW - 4, 4.6, '#5A4A38') + twig(70, 252, RW + 7, 2.6, '#3E3428', 'stroke-dasharray="90 30 140 26"') + twig(150, 235, RW - 12, 2, '#6B5843') + twig(-62, -18, RW, 3, '#4B3F31');
    arc(145, 255, RW, .21, 4, 74); arc(45, 125, RW + 4, .63, 3, 70); arc(-62, -20, RW, .44, 1, 56);
    v = `<svg class="lf lf-wreath" viewBox="0 0 ${W} ${W}" aria-hidden="true">${vines}${g}</svg>`;
  }
  _leaf.set(kind, v); return v;
}
const leavesOn = () => studioPrefs().leaves !== false;

/* ---------- colour history and favourites ---------- */
function useColor(c) {
  c = Colors.valid(c); if (!c) return; const p = studioPrefs();
  p.hist = [c].concat((p.hist || []).filter(x => !sameC(x, c))).slice(0, HIST_MAX); Colors.remember(c); save();
}
function toggleFav(c) { const p = studioPrefs(); c = Colors.valid(c); if (!c) return; p.favs = p.favs.some(x => sameC(x, c)) ? p.favs.filter(x => !sameC(x, c)) : p.favs.concat(c).slice(-12); save(); }

/* ---------- palettes ---------- */
const PAL_BUILTIN = [
  { id: 'n-forest', tab: 'nature', name: 'Sous-bois', scene: 'forest', cols: ['#C9D4B0', '#8FA06A', '#5E7A4C', '#3B4F35', '#7A5E48', '#2A2F26'] },
  { id: 'n-ocean', tab: 'nature', name: 'Océan', scene: 'ocean', cols: ['#DCE8E4', '#9CC5C9', '#4E8FA3', '#2A5F7A', '#1D3B52', '#C9B78F'] },
  { id: 'n-moss', tab: 'nature', name: 'Mousse et pierre', scene: 'mountain', cols: ['#D8D5C9', '#A9A58E', '#7B8461', '#56603F', '#6E6A63', '#3A3A35'] },
  { id: 'n-lav', tab: 'nature', name: 'Lavande', scene: 'field', cols: ['#E8DDF0', '#B8A2D6', '#8A73B8', '#5E4C8C', '#9DAE6A', '#E9C46A'] },
  { id: 'n-desert', tab: 'nature', name: 'Désert', scene: 'earth', cols: ['#F2E3C6', '#E0BB86', '#C98E55', '#A0603A', '#6E3F2A', '#8FA7B5'] },
  { id: 's-spring', tab: 'saisons', name: 'Printemps', scene: 'field', cols: ['#F4F1DE', '#F6C6D0', '#E58FA6', '#A8CC8C', '#6FA868', '#8EC5D8'] },
  { id: 's-summer', tab: 'saisons', name: 'Été', scene: 'ocean', cols: ['#FFF3C4', '#F9C74F', '#F3722C', '#43AA8B', '#277DA1', '#F94144'] },
  { id: 's-autumn', tab: 'saisons', name: 'Automne', scene: 'autumn', cols: ['#F1D3A1', '#E09F3E', '#C8553D', '#9E2A2B', '#5C3D2E', '#6F7D4E'] },
  { id: 's-winter', tab: 'saisons', name: 'Hiver', scene: 'snow', cols: ['#F4F7F8', '#CFDDE3', '#9BB3C2', '#5E7C93', '#34495E', '#1E2A36'] }
];
const PAL_SEED = [
  { id: 'p-dawn', tab: 'perso', name: 'Forest Dawn', scene: 'forest', cols: ['#D3D9A8', '#9AAE4E', '#6E9447', '#5B4636', '#C5577F', '#2D2620'], fav: true },
  { id: 'p-autumn', tab: 'perso', name: 'Autumn', scene: 'autumn', cols: ['#D9BE8F', '#5F7F55', '#2F6D86', '#6B76C8', '#7C5AA6', '#C77A3A', '#E3B35A', '#8C3B2F', '#3F2A22', '#A9A06F', '#D46A4C', '#2B3A2E'] },
  { id: 'p-mountain', tab: 'perso', name: 'Mountain', scene: 'mountain', cols: ['#C8C2BA', '#D9B4A2', '#7E3445', '#B66E6E', '#2F5560', '#3E302A'] },
  { id: 'p-earth', tab: 'perso', name: 'Earth', scene: 'earth', cols: ['#EDE4D3', '#C69C72', '#8E6A4E', '#6B3B2F', '#C7552F', '#4A3A2C', '#B8A07E', '#E2C9A4', '#7B5B3E', '#3B2A20'] }
];
/* the current theme can bring its own palettes */
const palBuiltin = () => PAL_BUILTIN.concat(theme().palettes || []);
const PAL_TABS = [['perso', 'Perso'], ['nature', 'Nature'], ['saisons', 'Saisons'], ['projet', 'Projet']];
function userPals() { const p = studioPrefs(); if (!Array.isArray(p.pals)) { p.pals = JSON.parse(JSON.stringify(PAL_SEED)); } return p.pals; }
const palById = id => userPals().find(p => p.id === id) || palBuiltin().find(p => p.id === id) || projectPals().find(p => p.id === id);
const palFaved = pal => pal.fav || (studioPrefs().palFav || []).includes(pal.id);
/* palettes of the current space: saved ones, and one per moodboard image, read from the picture itself */
let studioSpace = null;
const _imgPal = new Map();
function projectPals() {
  const sp = studioSpace, out = userPals().filter(p => p.tab === 'projet' && (!p.sp || p.sp === sp));
  if (!sp || typeof spaceMedia !== 'function') return out;
  for (const m of spaceMedia(sp).filter(m => m.type === 'image').slice(0, 8)) {
    const got = _imgPal.get(m.asset);
    if (got && got.cols) out.push({ id: 'img-' + m.asset, tab: 'projet', name: m.name || 'Image du moodboard', asset: m.asset, cols: got.cols, auto: true });
    else if (!got) { _imgPal.set(m.asset, {}); const img = new Image(); img.onload = () => { _imgPal.set(m.asset, { cols: extractPalette(img, 6) }); Studio.refresh('palettes'); }; img.src = Assets.url(m.asset); }
  }
  return out;
}
/* k-means on a 56 px copy of the picture; colours come back light to dark */
function extractPalette(img, k = 6) {
  const N = 56, c = mkCanvas(N), x = c.getContext('2d'); x.drawImage(img, 0, 0, N, N);
  let d; try { d = x.getImageData(0, 0, N, N).data; } catch (e) { return []; }
  const px = []; for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) px.push([d[i], d[i + 1], d[i + 2]]);
  if (!px.length) return [];
  const r = rng(.37), cent = [px[Math.floor(r() * px.length)]];
  while (cent.length < k) { let best = null, bd = -1; for (let t = 0; t < 40; t++) { const p = px[Math.floor(r() * px.length)]; const dd = Math.min(...cent.map(q => (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2)); if (dd > bd) { bd = dd; best = p; } } cent.push(best.slice()); }
  for (let it = 0; it < 10; it++) {
    const sum = cent.map(() => [0, 0, 0, 0]);
    for (const p of px) { let bi = 0, bd = Infinity; cent.forEach((q, i) => { const dd = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2; if (dd < bd) { bd = dd; bi = i; } }); const s = sum[bi]; s[0] += p[0]; s[1] += p[1]; s[2] += p[2]; s[3]++; }
    sum.forEach((s, i) => { if (s[3]) cent[i] = [s[0] / s[3], s[1] / s[3], s[2] / s[3]]; });
  }
  const hexs = cent.map(c => '#' + c.map(v => Math.round(v).toString(16).padStart(2, '0')).join('').toUpperCase());
  return [...new Set(hexs)].sort((a, b) => lum(b) - lum(a));
}
/* small painted landscapes in a palette's own colours, for the palette cards */
const _scene = new Map();
function paintScene(kind, cols, w = 104, h = 76) {
  const key = kind + cols.join(''); let v = _scene.get(key); if (v) return v;
  const c = mkCanvas(w * 2, h * 2), x = c.getContext('2d'); x.scale(2, 2);
  const byL = cols.slice().sort((a, b) => lum(b) - lum(a)), L = i => byL[clamp(Math.round(i * (byL.length - 1)), 0, byL.length - 1)];
  const r = rng(hashStr(key)), nz = pnoise(hashStr(key) + .1, 16);
  const ridge = (y0, amp, fr, col, sharp = 0, seed = 0) => { x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= w; i += 2) { let n = nz(i * fr + seed, seed * 3); if (sharp) n = 1 - Math.abs(n * 2 - 1); x.lineTo(i, y0 - n * amp); } x.lineTo(w, h); x.closePath(); x.fillStyle = col; x.fill(); };
  let g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, L(0)); g.addColorStop(1, L(.3)); x.fillStyle = g; x.fillRect(0, 0, w, h);
  switch (kind) {
    case 'mountain': ridge(h * .55, h * .45, .06, L(.35), 1, 2); x.globalAlpha = .55; ridge(h * .5, h * .3, .09, L(0), 1, 2.3); x.globalAlpha = 1; ridge(h * .78, h * .25, .05, L(.6), 0, 5); ridge(h * .95, h * .15, .08, L(.9), 0, 7); break;
    case 'earth': ridge(h * .6, h * .3, .03, L(.45), 0, 1); for (let i = 0; i < 3; i++) { x.fillStyle = L(.55 + i * .1); const bx = r() * w, bw = 20 + r() * 30, bh = 20 + r() * 25; x.fillRect(bx, h * .62 - bh, bw, bh + 40); } ridge(h * .85, h * .12, .07, L(.75), 0, 3); ridge(h, h * .1, .1, L(1), 0, 9); break;
    case 'ocean': ridge(h * .55, 3, .2, L(.5), 0, 1); for (let i = 0; i < 5; i++) { x.globalAlpha = .7; ridge(h * (.62 + i * .08), 4, .25, L(.55 + i * .09), 0, i * 2); } x.globalAlpha = 1; break;
    case 'snow': ridge(h * .6, h * .2, .04, L(.15), 0, 1); for (let i = 0; i < 9; i++) { const tx = r() * w, ty = h * (.55 + r() * .3), s = 8 + r() * 12; x.fillStyle = L(.85); x.beginPath(); x.moveTo(tx, ty - s * 1.6); x.lineTo(tx + s * .5, ty); x.lineTo(tx - s * .5, ty); x.fill(); } ridge(h * .95, h * .1, .06, L(.05), 0, 4); break;
    case 'field': ridge(h * .62, h * .12, .04, L(.45), 0, 1); ridge(h * .78, h * .1, .05, L(.6), 0, 3); for (let i = 0; i < 70; i++) { x.fillStyle = cols[Math.floor(r() * cols.length)]; x.globalAlpha = .8; x.beginPath(); x.arc(r() * w, h * (.72 + r() * .28), .8 + r() * 1.6, 0, 7); x.fill(); } x.globalAlpha = 1; break;
    case 'autumn': case 'forest': default: {
      const autumn = kind === 'autumn';
      ridge(h * .7, h * .1, .05, L(.4), 0, 1);
      for (let i = 0; i < 14; i++) { const tx = (i + r() * .6) * w / 13, top = h * (.15 + r() * .3); x.fillStyle = L(.85 + r() * .15); x.globalAlpha = .55 + r() * .4; x.fillRect(tx, top, 1.5 + r() * 2.5, h - top); }
      x.globalAlpha = 1;
      for (let i = 0; i < 26; i++) { x.fillStyle = autumn ? cols[Math.floor(r() * Math.min(4, cols.length))] : L(.35 + r() * .5); x.globalAlpha = .7; x.beginPath(); x.ellipse(r() * w, h * (.1 + r() * .45), 5 + r() * 9, 4 + r() * 7, r() * 3, 0, 7); x.fill(); }
      x.globalAlpha = .9; x.fillStyle = L(.3); x.beginPath(); x.moveTo(w * .42, h); x.quadraticCurveTo(w * .5, h * .78, w * .52, h * .7); x.lineTo(w * .56, h * .7); x.quadraticCurveTo(w * .6, h * .8, w * .7, h); x.fill(); x.globalAlpha = 1;
    }
  }
  /* paper grain over everything */
  const im = x.getImageData(0, 0, c.width, c.height), d = im.data; for (let i = 0; i < d.length; i += 4) { const n = (r() - .5) * 22; d[i] += n; d[i + 1] += n; d[i + 2] += n; } x.putImageData(im, 0, 0);
  v = c.toDataURL('image/jpeg', .85); _scene.set(key, v); return v;
}
const SEED_THUMB = { 'p-dawn': 'forest', 'p-autumn': 'autumn', 'p-mountain': 'mountain', 'p-earth': 'earth' };
const palThumb = pal => pal.img || (pal.asset ? Assets.url(pal.asset) : '') || (typeof ATL_THUMBS !== 'undefined' && ATL_THUMBS[SEED_THUMB[pal.id]]) || paintScene(pal.scene || 'forest', pal.cols.length ? pal.cols : ['#888888']);
async function paletteFromFile(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const cols = extractPalette(img, 6);
    const t = mkCanvas(160, 120), x = t.getContext('2d'), s = Math.max(160 / img.width, 120 / img.height); x.drawImage(img, (160 - img.width * s) / 2, (120 - img.height * s) / 2, img.width * s, img.height * s);
    return { cols, img: t.toDataURL('image/jpeg', .82), name: (file.name || 'Image').replace(/\.[^.]+$/, '').slice(0, 28) };
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- harmonies and variations ---------- */
const HARMS = [['comp', 'Complémentaire', [0, 180]], ['analog', 'Analogique', [-30, 0, 30]], ['triad', 'Triade', [0, 120, 240]], ['tetra', 'Tétradique', [0, 90, 180, 270]], ['mono', 'Monochrome', [0]]];
function harmony(c, mode) {
  const [h, s, v] = hsv(c), def = HARMS.find(x => x[0] === mode) || HARMS[1], hues = def[2].map(d => h + d);
  if (mode === 'mono') return { hues, cols: [[.15, .97], [.3, .9], [.5, .8], [.7, .68], [.85, .55], [.9, .42], [.8, .3], [.6, .2]].map(([ss, vv]) => hexv(h, Math.max(.06, s) * ss / .7, vv)) };
  const vars = [[1, 1], [.55, 1.1], [1, .62], [.3, .97]], cols = [];
  for (const [ks, kv] of vars) for (const hu of hues) if (cols.length < 8) cols.push(hexv(hu, Math.max(.25, s) * ks, Math.max(.35, v) * kv));
  return { hues, cols };
}
const mixHex = (a, b, t) => { const A = hex2rgb(a), B = hex2rgb(b); return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * clamp(t, 0, 1)).toString(16).padStart(2, '0')).join('').toUpperCase(); };
/* tints (towards a warm white), shades (towards a warm black) and six broken tones, desaturated from light to dark;
   amt is the difference slider */
function variations(c, amt) {
  const [h, s, v] = hsv(c), a = clamp(amt, .08, .7);
  const tint = i => mixHex(c, '#F6EFE0', a * i * .42), shade = i => mixHex(c, '#14120E', a * i * .42);
  const row = [0, 1, 2, 3, 4, 5].map(i => { const t = i / 5; return hexv(shiftTemp(h, (.5 - t) * a), s * clamp(1 - a * 1.25, .04, 1), clamp(v + a * 1.1 * (.62 - t * 1.25), .08, .98)); });
  return { up: [1, 2, 3].map(tint), down: [1, 2, 3].map(shade), row };
}

/* ---------- the radial colour picker ----------
   A painted hue ring around a triangle (hue, white, black), recent colours on the upper arc, favourites on the lower
   arc, tool buttons on the left, a size slider on the right. o: { get(), set(hex, final), size(), setSize(v), side: [...] } */
const RAD = { W: 420, C: 210, R: 132, RI: 92, RB: 172 };
/* a painter's wheel, as in the concept: red on the right, yellow on top, green on the left, blue at the bottom.
   angToHue: angle on the wheel (degrees, counterclockwise from the right) → hue; hueToAng the other way */
const WHEEL = [[0, 0], [45, 28], [90, 58], [180, 125], [270, 225], [360, 360]];
const lerpKnots = (k, a, b, v) => { v = ((v % 360) + 360) % 360; for (let i = 1; i < k.length; i++) if (v <= k[i][a]) { const p = k[i - 1], q = k[i], t = (v - p[a]) / ((q[a] - p[a]) || 1); return p[b] + (q[b] - p[b]) * t; } return v; };
const angToHue = a => lerpKnots(WHEEL, 0, 1, a) % 360, hueToAng = h => lerpKnots(WHEEL, 1, 0, h);
let _ring = null, _ringSkin = '';
/* the hue ring, painted like dry pastel: chalky colour, flecks of light and dark, ragged edges */
function ringCanvas() {
  if (_ring && _ringSkin === skin()) return _ring;
  _ringSkin = skin();
  const { W, C, R, RI } = RAD, c = mkCanvas(W * 2), x = c.getContext('2d'), r = rng(.913); x.scale(2, 2);
  /* hues turn the other way round on screen, as in the concept: red on the right, yellow on top, blue at the bottom */
  const jit = Array.from({ length: 24 }, () => (r() - .5) * .07), col = (a, ds = 0, dv = 0) => { const hu = angToHue(360 - a), g = Math.exp(-(((hu - 135) / 50) ** 2)); return Colors.hsv2hex(hu, clamp(.6 - g * .14 + ds, 0, 1), clamp(.9 - g * .14 + dv + jit[Math.floor(((a % 360) + 360) % 360 / 15)], 0, 1)); };
  for (let a = 0; a < 360; a += 1) { x.beginPath(); x.arc(C, C, (R + RI) / 2, (a - .8) * Math.PI / 180, (a + .8) * Math.PI / 180); x.strokeStyle = col(a); x.lineWidth = R - RI - 2; x.stroke(); }
  /* Nature style: the ring of the design pack, 16 touches of pastel laid by hand in a shuffled order, each a little off
     in hue and value, with a ragged inner edge and strokes of the stick inside */
  if (theme().ring === 'patches') {
    const n = 16, span = 360 / n, order = Array.from({ length: n }, (_, i) => i).sort(() => r() - .5);
    for (const k of order) {
      const mid = k * span + (r() - .5) * 5, w = span * (1.05 + r() * .25), a0 = mid - w / 2, a1 = mid + w / 2, ph = r() * 6, pts = [];
      const P = (deg, rad) => [C + Math.cos(deg * Math.PI / 180) * rad, C + Math.sin(deg * Math.PI / 180) * rad];
      for (let i = 0; i <= 14; i++) pts.push(P(a0 + (a1 - a0) * i / 14, R + .5 + Math.sin(i * .9 + ph) * .7 + (r() - .7) * 1.2));
      for (let i = 1; i < 5; i++) pts.push(P(a1 + (r() - .5) * 1.2, R + (RI - R) * i / 5));
      for (let i = 14; i >= 0; i--) pts.push(P(a0 + (a1 - a0) * i / 14, RI - 1 - (1 + Math.sin(i * 1.3 + ph)) * 1.4 - (r() < .18 ? r() * 4 : 0)));
      for (let i = 4; i > 0; i--) pts.push(P(a0 + (r() - .5) * 1.2, R + (RI - R) * i / 5));
      const base = col(mid + (r() - .5) * 8, (r() - .6) * .12, (r() - .5) * .08);
      x.save(); x.beginPath(); pts.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py)); x.closePath();
      x.fillStyle = base; x.fill(); x.clip();
      for (let i = 0; i < 70; i++) {
        const a = a0 + r() * (a1 - a0), rr = RI + r() * (R - RI), ar = a * Math.PI / 180, L = 6 + r() * 14, t = ar + Math.PI / 2 + (r() - .5) * .7;
        const px = C + Math.cos(ar) * rr, py = C + Math.sin(ar) * rr;
        x.globalAlpha = .14 + r() * .32; x.strokeStyle = col(mid + (r() - .5) * 6, (r() - .5) * .2, r() < .6 ? .06 + r() * .08 : -.08 - r() * .1);
        x.lineWidth = 1.2 + r() * 2.6; x.lineCap = 'round';
        x.beginPath(); x.moveTo(px - Math.cos(t) * L / 2, py - Math.sin(t) * L / 2); x.lineTo(px + Math.cos(t) * L / 2, py + Math.sin(t) * L / 2); x.stroke();
      }
      x.restore(); x.globalAlpha = 1;
    }
  }
  /* short strokes of pastel across the ring */
  for (let i = 0; i < (theme().ring === 'patches' ? 900 : 4200); i++) {
    const a = r() * 360, rr = RI + 2 + r() * (R - RI - 4), ar = a * Math.PI / 180, L = 2 + r() * 6, t = ar + Math.PI / 2 + (r() - .5) * 1.2;
    const px = C + Math.cos(ar) * rr, py = C + Math.sin(ar) * rr;
    x.globalAlpha = .16 + r() * .3; x.strokeStyle = col(a + (r() - .5) * 10, (r() - .5) * .3, (r() - .55) * .2); x.lineWidth = 1 + r() * 2.2; x.lineCap = 'round';
    x.beginPath(); x.moveTo(px - Math.cos(t) * L / 2, py - Math.sin(t) * L / 2); x.lineTo(px + Math.cos(t) * L / 2, py + Math.sin(t) * L / 2); x.stroke();
  }
  for (let i = 0, nf = theme().ring === 'patches' ? 500 : 1600; i < nf; i++) { const a = r() * Math.PI * 2, rr = RI + 1 + r() * (R - RI - 2); x.globalAlpha = .05 + r() * .16; x.fillStyle = r() < .65 ? '#FFF8EA' : '#1A1712'; x.fillRect(C + Math.cos(a) * rr, C + Math.sin(a) * rr, .6 + r() * 1.3, .6 + r() * 1.3); }
  x.globalAlpha = 1;
  x.globalCompositeOperation = 'destination-out';
  for (let i = 0, nc = theme().ring === 'patches' ? 260 : 1100; i < nc; i++) { const a = r() * Math.PI * 2, out = r() < .5, rr = out ? R - 2 + r() * 4 : RI - 2 + r() * 4; x.globalAlpha = .5 + r() * .5; x.beginPath(); x.arc(C + Math.cos(a) * rr, C + Math.sin(a) * rr, .6 + r() * 1.8, 0, 7); x.fill(); }
  x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
  _ring = c; return c;
}
/* the dark body of the wheel: a plate, the bezel around the ring, the well of the triangle and the two bands that
   hold the recent colours (top) and the favourites (bottom) */
function radialFrame() {
  const { W, C, R, RI, RB } = RAD, P = (deg, rad) => { const a = deg * Math.PI / 180; return [(C + Math.cos(a) * rad).toFixed(1), (C + Math.sin(a) * rad).toFixed(1)]; };
  const band = (a0, a1) => { const [x0, y0] = P(a0, RB), [x1, y1] = P(a1, RB); return `<path d="M${x0} ${y0}A${RB} ${RB} 0 0 1 ${x1} ${y1}" class="rf-band"/><path d="M${x0} ${y0}A${RB} ${RB} 0 0 1 ${x1} ${y1}" class="rf-band-hi"/>`; };
  return `<svg class="rad-frame" viewBox="0 0 ${W} ${W}" aria-hidden="true"><defs>
    <radialGradient id="rfPlate" cx="50%" cy="46%" r="52%"><stop offset="0" stop-color="#262723"/><stop offset=".72" stop-color="#1D1E1B"/><stop offset="1" stop-color="#171816"/></radialGradient>
    <linearGradient id="rfBezel" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#34352F"/><stop offset=".5" stop-color="#1E1F1C"/><stop offset="1" stop-color="#121311"/></linearGradient>
    <radialGradient id="rfWell" cx="50%" cy="42%" r="60%"><stop offset="0" stop-color="#2A2B27"/><stop offset="1" stop-color="#121311"/></radialGradient></defs>
    <circle class="rf-plate" cx="${C}" cy="${C}" r="${RB + 26}" fill="url(#rfPlate)" opacity=".94"/>
    ${band(244, 350)}${band(64, 140)}
    <circle cx="${C}" cy="${C}" r="${R + 13}" fill="url(#rfBezel)" stroke="#4E4C44" stroke-width="1"/>
    <circle cx="${C}" cy="${C}" r="${R + 3}" fill="#121311" stroke="rgba(0,0,0,.6)" stroke-width="2"/>
    <circle cx="${C}" cy="${C}" r="${RI - 3}" fill="url(#rfWell)" stroke="#45443C" stroke-width="1.2"/>
    <circle cx="${C}" cy="${C}" r="${RI - 10}" fill="none" stroke="rgba(0,0,0,.45)" stroke-width="3"/></svg>`;
}
function Radial(el, o) {
  if (theme().wheel) return theme().wheel(el, o);
  const { W, C, R, RI, RB } = RAD, TR = RI - 16;
  const pos = (deg, rad) => { const a = deg * Math.PI / 180; return `left:${(C + Math.cos(a) * rad).toFixed(1)}px;top:${(C + Math.sin(a) * rad).toFixed(1)}px`; };
  el.classList.add('rad'); el.style.setProperty('--W', W + 'px');
  const SIDE = [221, 199, 174, 151];
  el.innerHTML = `${o.leaves && leavesOn() ? leafDecor('wreath') : ''}${radialFrame()}<canvas class="rad-c" width="${W * 2}" height="${W * 2}" aria-label="Roue des couleurs : teinte sur l’anneau, saturation et luminosité dans le triangle" tabindex="0"></canvas>
    <div class="rad-rec"></div><div class="rad-fav"></div>
    ${(o.side || []).map((b, i) => `<button class="rad-b" data-rb="${b[0]}" style="${pos(SIDE[i] ?? 151 - (i - 3) * 23, RB + 4)}" title="${b[2]}" aria-label="${b[2]}">${icon(b[1])}</button>`).join('')}
    ${o.size ? `<div class="rad-sl" style="left:${C + R + 80}px;top:${C - 60}px"><span>${icon('brush', 'sm')}</span><input type="range" min="0" max="1" step=".005" aria-label="Taille du pinceau" orient="vertical"><b></b></div>` : ''}
    <button class="rad-cur" style="${pos(41, RB + 22)}" title="Couleur actuelle : cliquez pour le code, glissez-la sur une palette" aria-label="Code couleur" draggable="true"><i></i><u></u></button>`;
  const cv = $('.rad-c', el), x = cv.getContext('2d'), recEl = $('.rad-rec', el), favEl = $('.rad-fav', el), curEl = $('.rad-cur', el);
  let [h, s, v] = hsv(o.get()), prev = o.get(), drag = null;
  const tri = () => { const a = -hueToAng(h) * Math.PI / 180; return [0, 120, 240].map(d => { const b = a + d * Math.PI / 180; return [C + Math.cos(b) * TR, C + Math.sin(b) * TR]; }); };
  function paint() {
    x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, W, W);
    x.drawImage(ringCanvas(), 0, 0, W, W);
    /* triangle: hue, white, black */
    const [A, B, Cc] = tri(), x0 = Math.floor(Math.min(A[0], B[0], Cc[0])), x1 = Math.ceil(Math.max(A[0], B[0], Cc[0])), y0 = Math.floor(Math.min(A[1], B[1], Cc[1])), y1 = Math.ceil(Math.max(A[1], B[1], Cc[1]));
    const sc = 2, iw = (x1 - x0) * sc, ih = (y1 - y0) * sc, im = x.createImageData(iw, ih), d = im.data, hc = Colors.hsv2hex(h, 1, 1), [hr, hg, hb] = hex2rgb(hc);
    const den = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]);
    for (let j = 0; j < ih; j++) for (let i = 0; i < iw; i++) {
      const px = x0 + (i + .5) / sc, py = y0 + (j + .5) / sc;
      const wa = ((B[1] - Cc[1]) * (px - Cc[0]) + (Cc[0] - B[0]) * (py - Cc[1])) / den, wb = ((Cc[1] - A[1]) * (px - Cc[0]) + (A[0] - Cc[0]) * (py - Cc[1])) / den, wc = 1 - wa - wb;
      const m = Math.min(wa, wb, wc); if (m < -.02) continue;
      const k = (j * iw + i) * 4; d[k] = hr * wa + 255 * wb; d[k + 1] = hg * wa + 255 * wb; d[k + 2] = hb * wa + 255 * wb; d[k + 3] = 255 * clamp(1 + m * 60, 0, 1);
    }
    x.setTransform(1, 0, 0, 1, 0, 0); const t = mkCanvas(iw, ih); t.getContext('2d').putImageData(im, 0, 0); x.drawImage(t, x0 * 2, y0 * 2, iw * 2 / sc, ih * 2 / sc); x.setTransform(2, 0, 0, 2, 0, 0);
    /* hue handle and the line to the colour, as in the concept */
    const ha = -hueToAng(h) * Math.PI / 180, hx = C + Math.cos(ha) * (R + RI) / 2, hy = C + Math.sin(ha) * (R + RI) / 2;
    const wa = s * v, wb = v - s * v, wc = 1 - v, px = A[0] * wa + B[0] * wb + Cc[0] * wc, py = A[1] * wa + B[1] * wb + Cc[1] * wc;
    x.strokeStyle = 'rgba(240,228,204,.9)'; x.lineWidth = 1.4; x.beginPath(); x.moveTo(px, py); x.lineTo(A[0], A[1]); x.stroke();
    x.beginPath(); x.arc(hx, hy, 9, 0, 7); x.lineWidth = 3; x.strokeStyle = '#EFE3C8'; x.stroke(); x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,.5)'; x.stroke();
    x.beginPath(); x.arc(A[0], A[1], 5.5, 0, 7); x.fillStyle = '#E8D6B0'; x.fill(); x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,.35)'; x.stroke();
    x.beginPath(); x.arc(px, py, 6, 0, 7); x.fillStyle = '#E8D6B0'; x.fill(); x.lineWidth = 1.2; x.strokeStyle = 'rgba(0,0,0,.45)'; x.stroke();
  }
  function arcs() {
    const rec = (S.prefs.recent || []).slice(0, 7), favs = studioPrefs().favs.slice(0, 5);
    recEl.innerHTML = rec.map((c, i) => blob(c, i, '', pos(251 + i * 15.5, RB))).join('');
    favEl.innerHTML = favs.map((c, i) => blob(c, i + 2, 'data-fav="1"', pos(132 - i * 13.5, RB))).join('') + `<button class="rad-add" data-radd="1" style="${pos(132 - favs.length * 13.5, RB)}" title="Ajouter la couleur actuelle aux favoris" aria-label="Ajouter aux favoris">${icon('plus')}</button>`;
  }
  function chip() { const c = hexv(h, s, v); curEl.querySelector('i').style.background = c; curEl.querySelector('u').style.background = prev; curEl.dataset.drag = c; }
  function syncSize() { const sl = $('.rad-sl input', el); if (!sl || !o.size) return; const z = o.size(); sl.value = z.t; $('.rad-sl b', el).textContent = z.label; }
  const emit = final => { const c = hexv(h, s, v); chip(); o.set(c, final); };
  cv.addEventListener('pointerdown', e => {
    const r = cv.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, d = Math.hypot(px - C, py - C);
    if (d >= RI - 6 && d <= R + 8) drag = 'ring'; else if (d < RI - 6) drag = 'tri'; else return;
    prev = hexv(h, s, v); cv.setPointerCapture(e.pointerId); move(e); e.preventDefault(); e.stopPropagation();
  });
  const move = e => {
    if (!drag) return; const r = cv.getBoundingClientRect(), k = W / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
    if (drag === 'ring') h = angToHue((720 - Math.atan2(py - C, px - C) * 180 / Math.PI) % 360);
    else {
      const [A, B, Cc] = tri(), den = (B[1] - Cc[1]) * (A[0] - Cc[0]) + (Cc[0] - B[0]) * (A[1] - Cc[1]);
      let wa = ((B[1] - Cc[1]) * (px - Cc[0]) + (Cc[0] - B[0]) * (py - Cc[1])) / den, wb = ((Cc[1] - A[1]) * (px - Cc[0]) + (A[0] - Cc[0]) * (py - Cc[1])) / den;
      wa = Math.max(0, wa); wb = Math.max(0, wb); let wc = Math.max(0, 1 - wa - wb); const t = wa + wb + wc; wa /= t; wb /= t; wc /= t;
      v = clamp(wa + wb, 0, 1); s = v > 1e-4 ? clamp(wa / v, 0, 1) : s;
    }
    paint(); emit(false);
  };
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', () => { if (drag) { drag = null; emit(true); } });
  cv.addEventListener('pointercancel', () => { drag = null; });
  /* keyboard: arrows turn the hue, Shift + arrows move saturation (left/right) and value (up/down) */
  cv.addEventListener('keydown', e => {
    const st = e.altKey ? 10 : 2, k = e.key; if (!k.startsWith('Arrow')) return; e.preventDefault(); e.stopPropagation();
    if (e.shiftKey) { if (k === 'ArrowLeft') s = clamp(s - st / 100, 0, 1); if (k === 'ArrowRight') s = clamp(s + st / 100, 0, 1); if (k === 'ArrowUp') v = clamp(v + st / 100, 0, 1); if (k === 'ArrowDown') v = clamp(v - st / 100, 0, 1); }
    else h = angToHue(hueToAng(h) + (k === 'ArrowRight' || k === 'ArrowUp' ? st : -st));
    paint(); emit(false); clearTimeout(cv._k); cv._k = setTimeout(() => emit(true), 400);
  });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (b) { prev = hexv(h, s, v); [h, s, v] = hsv(b.dataset.c); paint(); emit(true); return; }
    if (e.target.closest('[data-radd]')) { toggleFav(hexv(h, s, v)); arcs(); Studio.refresh('favs'); return; }
    if (e.target.closest('.rad-cur')) { hexPop(curEl, hexv(h, s, v), c => { prev = hexv(h, s, v); [h, s, v] = hsv(c); paint(); emit(true); }); return; }
    const rb = e.target.closest('[data-rb]'); if (rb && o.onSide) o.onSide(rb.dataset.rb, rb);
  });
  el.addEventListener('dragstart', dragColor);
  el.addEventListener('contextmenu', e => { const b = e.target.closest('[data-fav]'); if (!b) return; e.preventDefault(); openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Retirer des favoris', icon: 'x', run: () => { toggleFav(b.dataset.c); arcs(); Studio.refresh('favs'); } }]); });
  const sl = $('.rad-sl input', el); if (sl) { sl.addEventListener('input', () => { o.setSize(+sl.value); syncSize(); }); sl.addEventListener('pointerdown', e => e.stopPropagation()); }
  paint(); arcs(); chip(); syncSize();
  return { update() { const c = o.get(); if (!sameC(c, hexv(h, s, v))) { prev = hexv(h, s, v); [h, s, v] = hsv(c); paint(); } chip(); arcs(); syncSize(); }, el };
}
/* colours can be dragged from anywhere in the atelier onto a palette */
const DRAG_T = 'application/x-notely-color';
function dragColor(e) {
  const b = e.target.closest && e.target.closest('[data-c],[data-drag]'); if (!b || !e.dataTransfer) return;
  const c = b.dataset.c || b.dataset.drag, pal = b.closest('[data-pal]');
  e.dataTransfer.setData(DRAG_T, JSON.stringify({ c, pal: pal ? pal.dataset.pal : null, i: pal ? [...pal.querySelectorAll('.pal-sw [data-c]')].indexOf(b) : -1 }));
  e.dataTransfer.setData('text/plain', c); e.dataTransfer.effectAllowed = 'copyMove'; e.stopPropagation();
}
function hexPop(anchor, cur, onPick) {
  const p = openPop(anchor, `<div class="hexpop"><span class="sw" style="background:${cur}"></span><input value="${cur}" maxlength="7" spellcheck="false" aria-label="Code couleur"><button class="btn sm" data-copy="1">${icon('dup', 'sm')}Copier</button></div>`, { cls: 'atl-pop', focus: false });
  const i = $('input', p); i.focus(); i.select();
  i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { const c = Colors.valid(i.value.trim()); if (c) { onPick(c); closePop(); } } });
  i.addEventListener('input', () => { const c = Colors.valid(i.value.trim()); if (c) $('.sw', p).style.background = c; });
  $('[data-copy]', p).onclick = () => copyHex(i.value.trim());
}
function copyHex(c) { try { navigator.clipboard.writeText(c); toast('Code ' + c + ' copié'); } catch (e) { toast(c); } }
/* the screen eyedropper of Chromium / Electron, for notes and anywhere outside the board */
const hasEyeDropper = () => typeof window.EyeDropper === 'function';
async function screenPick() { if (!hasEyeDropper()) { toast('La pipette d’écran n’est pas disponible dans ce navigateur'); return null; } try { const r = await new window.EyeDropper().open(); return Colors.valid(r.sRGBHex) || null; } catch (e) { return null; } }

/* ---------- brush panel (board card, note popover, Style tab) ---------- */
/* the atelier is dark unless the theme draws its previews in a dark ink (atlInk) */
const atlOnDark = () => lum(theme().atlInk) > .3;
const _nibThumb = new Map();
function nibThumb(sh) {
  const ink = theme().atlInk, key = sh + ink; let v = _nibThumb.get(key); if (v) return v;
  const c = mkCanvas(80), x = c.getContext('2d');
  if (sh === 'native') { v = ''; _nibThumb.set(key, v); return v; }
  x.translate(40, 40); x.rotate((NIBS[sh].ang || 0)); x.globalAlpha = .95; x.drawImage(nibTinted(sh, ink), -34, -34, 68, 68);
  v = c.toDataURL(); _nibThumb.set(key, v); return v;
}
const _texThumb = new Map();
function texThumb(tx) {
  const ink = theme().atlInk, key = tx + ink; let v = _texThumb.get(key); if (v) return v;
  const c = mkCanvas(80), x = c.getContext('2d'); x.fillStyle = ink; x.beginPath(); x.ellipse(40, 40, 33, 27, -.5, 0, 7); x.fill();
  if (tx === 'none') { x.globalCompositeOperation = 'destination-out'; x.beginPath(); x.ellipse(40, 40, 20, 14, -.5, 0, 7); x.fill(); }
  else applyTexture(x, tx, 0, 0, .55);
  v = c.toDataURL(); _texThumb.set(key, v); return v;
}
const SLIDERS = [['s', 'Taille', 'sz-size'], ['o', 'Opacité', 'sz-op'], ['fl', 'Flux', 'sz-flow'], ['sp', 'Espacement', 'sz-space']];
/* size: the slider runs on a square curve so that small sizes stay precise up to 200 */
const sizeT = (k, sz) => { const d = PENS[k] || PENS.pen; return Math.sqrt(clamp((sz - d.min) / (d.max - d.min), 0, 1)); };
const sizeOf = (k, t) => { const d = PENS[k] || PENS.pen, v = d.min + (d.max - d.min) * t * t; return v < 10 ? Math.round(v * 2) / 2 : Math.round(v); };
const sizeText = v => String(+(+v).toFixed(v < 10 ? 1 : 0));
const sliderText = (k, v) => k === 's' ? sizeText(v) : Math.round(v * 100) + ' %';
/* the order of the brush menu: the four presets of the concept first */
const ATL_PENS = ['natural', 'chalk', 'charcoal', 'inkfine', 'dry', 'gouache', 'spray'];
const PRESET_KEYS = ['s', 'o', 'sm', 'sh', 'tx', 'fl', 'sp', 'dy'];
function namePop(anchor, title, value, done) {
  const p = openPop(anchor, `<div class="namepop"><small>${esc(title)}</small><div><input value="${esc(value)}" maxlength="40" spellcheck="false" aria-label="${esc(title)}"><button class="btn sm pri" data-ok="1">OK</button></div></div>`, { cls: 'atl-pop', focus: false, align: 'right' });
  const i = $('input', p); i.focus(); i.select();
  const ok = () => { const v = i.value.trim(); if (v) { closePop(); done(v); } };
  i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') ok(); if (e.key === 'Escape') closePop(); });
  $('[data-ok]', p).onclick = ok;
}
const PenPanel = {
  html(pen, o = {}) {
    const isE = pen === 'eraser';
    if (isE) return `<div class="bp"><div class="bp-sel" data-bsel="1"><span>${icon('eraser')}Gomme</span>${icon('chevd', 'sm')}</div>${PenPanel.list(pen)}<div class="pp-hint">${o.note ? 'La gomme efface les traits entiers.' : 'La gomme efface un trait entier ; sélectionnez-le pour le déplacer ou le redimensionner.'}</div></div>`;
    const def = PENS[pen] || PENS.pen, pr = penPref(pen), nat = pr.sh === 'native';
    const rng = (k, lab, ic) => { const isS = k === 's', min = isS ? 0 : .01, max = 1, step = isS ? .002 : .01, val = isS ? sizeT(pen, pr.s) : pr[k], off = nat && (k === 'fl' || k === 'sp');
      return `<label class="bp-row${off ? ' off' : ''}" title="${off ? 'Choisissez une forme de pinceau pour régler le flux et l’espacement' : lab + (isS ? ' (' + def.min + ' à ' + def.max + ')' : ' (1 à 100 %)')}"><span class="bp-ic">${icon(ic, 'sm')}</span><span class="bp-l">${lab}</span><input type="range" data-k="${k}" min="${min}" max="${max}" step="${step}" value="${val}" aria-label="${lab}"${off ? ' disabled' : ''}><b data-v="${k}">${sliderText(k, pr[k])}</b></label>`; };
    return `<div class="bp">
      <div class="bp-pv">${PenPanel.preview(pen)}</div>
      <div class="bp-sel" data-bsel="1" role="button" tabindex="0" aria-label="Choisir un pinceau"><span>${def.name}</span>${icon('chevd', 'sm')}</div>${PenPanel.list(pen)}
      <div class="bp-rows">${SLIDERS.map(([k, l, ic]) => rng(k, l, ic)).join('')}</div>
      <div class="bp-h">Forme</div><div class="bp-tiles">${NIB_ORDER.map(k => `<button class="bp-t${k === 'native' ? ' nat' : ''}" data-sh="${k}" aria-pressed="${pr.sh === k}" title="${NIBS[k].name}${k === 'native' ? ' : le tracé vectoriel du pinceau' : ''}">${k === 'native' ? icon(def.icon) : `<img src="${nibThumb(k)}" alt="">`}</button>`).join('')}</div>
      <div class="bp-h">Texture</div><div class="bp-tiles">${TEX_ORDER.map(k => `<button class="bp-t" data-tx="${k}" aria-pressed="${pr.tx === k}" title="${TEXS[k].name}"><img src="${texThumb(k)}" alt=""></button>`).join('')}</div>
      <div class="bp-h">Dynamique</div><div class="bp-dyn">${DYNS.map(([k, ic, l]) => `<button class="bp-d" data-dy="${k}" aria-pressed="${!!pr.dy[k]}" title="${l}" aria-label="${l}">${icon(ic)}</button>`).join('')}<button class="btn sm bp-reset" data-breset="1" title="Revenir aux réglages d’origine de ce pinceau">Réinitialiser</button></div>
      <details class="bp-more"${o.note ? '' : ''}><summary>Lissage et pression</summary>
        <label class="bp-row"><span class="bp-ic">${icon('wand', 'sm')}</span><span class="bp-l">Lissage</span><input type="range" data-k="sm" min="0" max="1" step=".05" value="${pr.sm}" aria-label="Lissage"><b data-v="sm">${Math.round(pr.sm * 100)} %</b></label>
        <div class="seg sm" data-seg="pressure">${[['pen', 'Stylet'], ['speed', 'Vitesse'], ['fixed', 'Fixe']].map(([v, l]) => `<button data-pv="${v}" aria-pressed="${(S.prefs.pressure || 'pen') === v}">${l}</button>`).join('')}</div>
        <div class="pp-hint"><span id="ppDiag">${penDiagLine()}</span> <button class="lnk" data-diag="1">Tester</button></div>
      </details>
    </div>`;
  },
  /* the preview of the concept: the stroke in ivory chalk, whatever the colour (the wheel shows the colour) */
  preview(pen, w = 260, h = 64) { const pr = penPref(pen); return brushPreview(pen, Object.assign({}, pr, { c: theme().atlInk, o: Math.max(.75, pr.o) }), w, h, atlOnDark()); },
  list(pen) {
    const row = k => { const p = penPref(k); return `<button class="bp-li" data-pen="${k}" aria-pressed="${k === pen}">${brushPreview(k, Object.assign({}, p, { c: theme().atlInk, s: Math.min(p.s, 14) }), 120, 28, atlOnDark())}<span>${PENS[k].name}</span></button>`; };
    const mine = studioPrefs().presets || [];
    return `<div class="bp-list" hidden><div class="bp-lh">Atelier</div>${ATL_PENS.filter(k => PENS[k]).map(row).join('')}
      ${mine.length ? `<div class="bp-lh">Mes préréglages</div>${mine.map(m => `<div class="bp-li my"><button data-preset="${m.id}">${brushPreview(m.pen, Object.assign({}, penPref(m.pen), m.cfg, { c: theme().atlInk, s: Math.min(m.cfg.s || 8, 14) }), 120, 28, atlOnDark())}<span>${esc(m.name)}</span></button><button class="bp-x" data-predel="${m.id}" title="Supprimer ce préréglage" aria-label="Supprimer">${icon('x', 'sm')}</button></div>`).join('')}` : ''}
      ${PENS[pen] ? `<button class="bp-li sv" data-presave="1">${icon('plus')}<span>Enregistrer ces réglages comme préréglage…</span></button>` : ''}
      <div class="bp-lh">Classiques</div>${PEN_ORDER.filter(k => !PENS[k].stamp).map(row).join('')}<button class="bp-li er" data-pen="eraser" aria-pressed="${pen === 'eraser'}">${icon('eraser')}<span>Gomme</span></button></div>`;
  },
  /* h: { pen(), setPen(k), changed(partial) } — partial = true when only a slider moved */
  bind(root, h) {
    const pref = () => { const k = h.pen(); if (!S.prefs.pens[k]) S.prefs.pens[k] = {}; return S.prefs.pens[k]; };
    root.addEventListener('click', e => {
      if (e.target.closest('[data-bsel]')) { const l = $('.bp-list', root); if (l) l.hidden = !l.hidden; return; }
      const p = e.target.closest('[data-pen]'); if (p) { h.setPen(p.dataset.pen); return; }
      const ps = e.target.closest('[data-preset]'); if (ps) { const m = (studioPrefs().presets || []).find(x => x.id === ps.dataset.preset); if (!m || !PENS[m.pen]) return; S.prefs.pens[m.pen] = Object.assign({ c: penPref(m.pen).c }, JSON.parse(JSON.stringify(m.cfg))); save(); if (h.pen() === m.pen) h.changed(false); else h.setPen(m.pen); toast('Préréglage « ' + m.name + ' »'); return; }
      const pd = e.target.closest('[data-predel]'); if (pd) { const P = studioPrefs(); P.presets = (P.presets || []).filter(x => x.id !== pd.dataset.predel); save(); h.changed(false); return; }
      const pen = h.pen(); if (!PENS[pen]) return;
      const sv = e.target.closest('[data-presave]'); if (sv) { namePop(sv, 'Nom du préréglage', PENS[pen].name + ' ' + ((studioPrefs().presets || []).length + 1), name => { const pr = penPref(pen), cfg = {}; for (const k of PRESET_KEYS) cfg[k] = JSON.parse(JSON.stringify(pr[k])); const P = studioPrefs(); P.presets = (P.presets || []).concat({ id: uid('bp'), name, pen, cfg }); save(); h.changed(false); toast('Préréglage « ' + name + ' » enregistré'); }); return; }
      const sh = e.target.closest('[data-sh]'); if (sh) { pref().sh = sh.dataset.sh; save(); h.changed(false); return; }
      const tx = e.target.closest('[data-tx]'); if (tx) { pref().tx = tx.dataset.tx; save(); h.changed(false); return; }
      const dy = e.target.closest('[data-dy]'); if (dy) { const cur = penPref(pen).dy; pref().dy = Object.assign({}, cur, { [dy.dataset.dy]: cur[dy.dataset.dy] ? 0 : 1 }); save(); h.changed(false); return; }
      if (e.target.closest('[data-breset]')) { const c = penPref(pen).c; S.prefs.pens[pen] = { c, s: PENS[pen].size }; save(); h.changed(false); toast('Pinceau ' + PENS[pen].name + ' réinitialisé'); return; }
      const s = e.target.closest('[data-pv]'); if (s) { S.prefs.pressure = s.dataset.pv; save(); h.changed(false); return; }
      if (e.target.closest('[data-diag]')) { closePop(); openSettings('pen'); }
    });
    root.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('[data-bsel]')) { e.preventDefault(); e.target.click(); } });
    root.addEventListener('input', e => {
      const r = e.target; if (r.type !== 'range' || !r.dataset.k) return; const pen = h.pen(); if (!PENS[pen]) return;
      const k = r.dataset.k, val = k === 's' ? sizeOf(pen, +r.value) : +r.value; pref()[k] = val; save();
      const lab = root.querySelector(`[data-v="${k}"]`); if (lab) lab.textContent = sliderText(k, val);
      const pv = root.querySelector('.bp-pv'); if (pv) pv.innerHTML = PenPanel.preview(pen);
      h.changed(true);
    });
    root.addEventListener('change', e => { if (e.target.type === 'range') h.changed(false); });
  }
};

/* ---------- the studio on the board ---------- */
const CARDS = { brush: ['Pinceau', 'sliders'], palettes: ['Palettes', 'palette'], harmony: ['Harmonie', 'harmony'], history: ['Historique', 'clock'], variations: ['Variations', 'variations'], pipette: ['Pipette', 'drop'] };
/* the planche: every module at once, placed as on the concept board (1536 × 1024, scaled to the window) */
const PLANCHE = ['palettes', 'brush', 'harmony', 'history', 'pipette', 'variations'];
const CARD_LEAVES = { palettes: ['vine'], brush: ['branch'], harmony: ['cluster', 'branchbl'], pipette: ['cluster'] };
async function saveJSON(name, txt, done) {
  if (typeof DESKTOP !== 'undefined' && DESKTOP && window.notely && window.notely.saveFile) { const r = await window.notely.saveFile({ name, kind: 'json', data: new TextEncoder().encode(txt) }); if (r && r.ok) toast(done); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(done);
}
const Studio = (() => {
  let api = null, root = null, wrapEl = null, plateEl, rad = null, on = false, planche = false, harmBase = null, varBase = null, lock = 0, pickImg = '', rightEl, stackEl, dockEl, favEl, chipEl, loupeEl;
  const P = () => studioPrefs();
  const color = () => api ? api.color() : '#1E1E1E';
  const shown = () => planche ? PLANCHE : P().cards;

  function mount(wrap, a) {
    api = a; wrapEl = wrap; planche = false; studioSpace = a.space && a.space();
    root = document.createElement('div'); root.className = 'atl'; root.hidden = true;
    root.innerHTML = `<div class="atl-plate"><div class="atl-right"><nav class="atl-bar" aria-label="Outils de dessin"></nav><div class="atl-favs" aria-label="Couleurs favorites"></div></div>
      <div class="atl-stack"></div><div class="atl-dock"></div></div>
      <div class="atl-loupe" hidden>${leavesOn() ? leafDecor('cluster') : ''}<div class="lp-ring"><canvas width="300" height="300"></canvas><i></i></div><div class="lp-chip"><span></span><b></b></div></div><div class="atl-chip" hidden></div>`;
    wrap.append(root);
    plateEl = $('.atl-plate', root); rightEl = $('.atl-right', root); stackEl = $('.atl-stack', root); dockEl = $('.atl-dock', root); favEl = $('.atl-favs', root); loupeEl = $('.atl-loupe', root); chipEl = $('.atl-chip', root);
    for (const el of [rightEl, stackEl, dockEl, chipEl]) {
      el.addEventListener('pointerdown', e => e.stopPropagation()); el.addEventListener('keydown', e => { if (e.target.matches('input')) e.stopPropagation(); }); el.addEventListener('wheel', e => e.stopPropagation(), { passive: true });
      el.addEventListener('dragstart', dragColor); el.addEventListener('dragover', e => e.stopPropagation()); el.addEventListener('drop', e => e.stopPropagation());
    }
    rightEl.addEventListener('click', onRight);
    favEl.addEventListener('contextmenu', e => { const b = e.target.closest('[data-c]'); if (!b) return; e.preventDefault(); openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Retirer des favoris', icon: 'x', run: () => { toggleFav(b.dataset.c); refresh('favs'); } }]); });
    stackEl.addEventListener('click', onStack); stackEl.addEventListener('input', onStackInput); stackEl.addEventListener('change', onStackChange); stackEl.addEventListener('contextmenu', onStackContext);
    stackEl.addEventListener('dragover', onDragOver); stackEl.addEventListener('dragleave', e => { const pal = e.target.closest('[data-pal]'); if (pal && !pal.contains(e.relatedTarget)) pal.classList.remove('drop'); }); stackEl.addEventListener('drop', onDrop);
    dockEl.addEventListener('click', e => { if (e.target.closest('[data-a="dock"]')) { P().radial = !P().radial; save(); renderDock(); } });
    chipEl.addEventListener('click', e => { if (e.target.closest('[data-copy]')) copyHex(chipEl.dataset.c); });
    addEventListener('resize', fit);
  }
  function unmount() { removeEventListener('resize', fit); document.removeEventListener('keydown', onPlancheKey, true); if (root) root.remove(); root = null; rad = null; api = null; on = false; planche = false; }
  /* called by the board whenever the tool, the pen or its colour changed */
  function sync() {
    if (!root || !api) return;
    const was = on; on = api.drawing(); root.hidden = !on;
    if (!on) { hideLoupe(); if (planche) setPlanche(false, true); return; }
    renderBar(); renderFavs();
    if (!was || !dockEl.firstChild) renderDock(); else if (rad) rad.update();
    if (!was) renderStack(); else refresh('color');
  }
  /* parts that depend on the colour follow it; harmony and variations keep their base while you pick inside them */
  function refresh(what) {
    if (!root || !on) return;
    if (what === 'favs') { renderFavs(); if (rad) rad.update(); return; }
    if (what === 'palettes') { renderCard('palettes'); return; }
    if (rad) rad.update(); renderFavs(); renderBar();
    for (const id of shown()) if (id !== 'palettes' || what !== 'color') renderCard(id);
  }

  /* ----- the planche ----- */
  function setPlanche(v, quiet) {
    if (!root || planche === v) return; planche = v;
    root.classList.toggle('planche', v); (v ? document.body : wrapEl).append(root);
    if (v) document.addEventListener('keydown', onPlancheKey, true); else document.removeEventListener('keydown', onPlancheKey, true);
    hideLoupe(); fit(); if (quiet) return;
    renderBar(); renderFavs(); renderDock(); renderStack();
  }
  function onPlancheKey(e) { if (e.key === 'Escape' && !$('.pop')) { e.preventDefault(); e.stopPropagation(); setPlanche(false); } }
  function fit() { if (!plateEl) return; if (planche) plateEl.style.setProperty('--k', Math.min(innerWidth / 1536, innerHeight / 1024).toFixed(4)); else plateEl.style.removeProperty('--k'); }

  /* ----- vertical tool bar and favourites rail ----- */
  function renderBar() {
    const t = api.tool(), pk = api.pen(), cards = P().cards;
    const b = (id, ic, title, on, extra = '') => `<button class="tl" data-st="${id}" title="${title}" aria-label="${title}" aria-pressed="${on}" ${extra}>${icon(ic)}</button>`;
    $('.atl-bar', root).innerHTML = b('select', 'cursor', 'Sélection (V)', false) + b('pen', PENS[pk].icon, PENS[pk].name + ' (B ou P)', !!PENS[t]) + b('eraser', 'eraser', 'Gomme (E)', t === 'eraser') + b('pick', 'drop', 'Pipette sur le board (K, ou Alt + clic)', t === 'pick') + b('hand', 'hand', 'Main : déplacer le board (H, ou Espace)', false)
      + '<span class="hs"></span>' + (planche ? '' : Object.entries(CARDS).map(([id, [l, ic]]) => b('card:' + id, ic, l, cards.includes(id))).join('')) + b('planche', 'layout', planche ? 'Revenir au board (Échap)' : 'Vue planche : tous les modules de l’atelier', planche);
  }
  function renderFavs() {
    const favs = P().favs, cur = color(), has = favs.some(c => sameC(c, cur));
    favEl.innerHTML = `<button class="fv-star" data-fstar="1" aria-pressed="${has}" title="${has ? 'Retirer la couleur actuelle des favoris' : 'Mettre la couleur actuelle en favori'}" aria-label="Favori">${icon('star')}</button>${favs.slice(0, 10).map((c, i) => blob(c, i, `aria-pressed="${sameC(c, cur)}"`)).join('')}<button class="fv-add" data-fadd="1" title="Ajouter la couleur actuelle aux favoris" aria-label="Ajouter la couleur actuelle">${icon('plus')}</button>`;
  }
  function onRight(e) {
    const c = e.target.closest('[data-c]'); if (c) { pick(c.dataset.c); return; }
    if (e.target.closest('[data-fstar]')) { toggleFav(color()); refresh('favs'); return; }
    if (e.target.closest('[data-fadd]')) { const v = color(); if (P().favs.some(x => sameC(x, v))) toast('Cette couleur est déjà dans les favoris'); else { P().favs = P().favs.concat(v).slice(-12); save(); } refresh('favs'); return; }
    const b = e.target.closest('[data-st]'); if (!b) return; const id = b.dataset.st;
    if (id === 'planche') { setPlanche(!planche); return; }
    if (id.startsWith('card:')) { toggleCard(id.slice(5)); return; }
    if (id === 'pen') { if (PENS[api.tool()]) { if (!planche) toggleCard('brush', true); } else api.setTool(api.pen()); return; }
    if (planche && id !== 'eraser') setPlanche(false);
    api.setTool(id);
  }

  /* ----- radial dock ----- */
  function renderDock() {
    const open = planche || P().radial !== false;
    dockEl.className = 'atl-dock' + (open ? '' : ' min');
    if (!open) { rad = null; dockEl.innerHTML = `<button class="dock-puck" data-a="dock" title="Afficher la roue des couleurs" aria-label="Roue des couleurs" style="--c:${color()}">${icon('wheel')}</button>`; return; }
    dockEl.innerHTML = `<div class="rad-host"></div>${planche ? '' : `<button class="dock-min" data-a="dock" title="Réduire la roue" aria-label="Réduire">${icon('x', 'sm')}</button>`}`;
    rad = Radial($('.rad-host', dockEl), {
      leaves: true,
      get: color, set: (c, final) => { api.setColor(c, final); if (final) { useColor(c); refreshLater(); } else { renderFavs(); const pk = $('.dock-puck', dockEl); if (pk) pk.style.setProperty('--c', c); } },
      size: () => { const pr = penPref(api.pen()); return { t: sizeT(api.pen(), pr.s), label: sizeText(pr.s) }; },
      setSize: t => { const k = api.pen(); if (!S.prefs.pens[k]) S.prefs.pens[k] = {}; S.prefs.pens[k].s = sizeOf(k, t); save(); api.changed(true); renderCard('brush'); },
      side: [['pick', 'drop', 'Pipette sur le board'], ['harmony', 'harmony', 'Harmonie'], ['variations', 'variations', 'Variations'], ['history', 'clock', 'Historique']],
      onSide: id => { if (id === 'pick') { if (planche) setPlanche(false); api.setTool('pick'); } else if (planche) { const el = $(`[data-card="${id}"]`, stackEl); if (el) { el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); } } else toggleCard(id, true); }
    });
  }
  const refreshLater = debounce(() => refresh('color'), 60);

  /* ----- cards ----- */
  function toggleCard(id, show) {
    if (planche) return;
    const p = P(); let cards = p.cards.slice();
    if (cards.includes(id)) { if (show) { p.shut = (p.shut || []).filter(x => x !== id); save(); renderStack(); const el = $(`[data-card="${id}"]`, stackEl); if (el) el.scrollIntoView({ block: 'nearest' }); return; } cards = cards.filter(x => x !== id); }
    else cards.unshift(id);
    p.cards = cards; save(); renderStack(); renderBar();
  }
  function renderStack() {
    const p = P();
    stackEl.innerHTML = shown().map(id => { const [t] = CARDS[id] || []; if (!t) return ''; const shut = !planche && (p.shut || []).includes(id);
      const lv = leavesOn() ? (CARD_LEAVES[id] || []).map(leafDecor).join('') : '';
      return `<section class="atl-card c-${id}${shut ? ' shut' : ''}" data-card="${id}">${lv}<header><button class="ch-t" data-cshut="${id}" aria-expanded="${!shut}"${planche ? ' tabindex="-1"' : ''}>${t}</button>${id === 'harmony' || id === 'history' || id === 'palettes' ? `<button class="ch-b" data-cmenu="${id}" title="Plus" aria-label="Plus">${icon('dots', 'sm')}</button>` : ''}${planche ? '' : `<button class="ch-b" data-cclose="${id}" title="Fermer" aria-label="Fermer">${icon('x', 'sm')}</button>`}</header><div class="ac-body"></div></section>`; }).join('');
    for (const id of shown()) renderCard(id);
  }
  function renderCard(id) {
    if (!stackEl) return;
    const sec = $(`[data-card="${id}"]`, stackEl); if (!sec || sec.classList.contains('shut')) return; const body = $('.ac-body', sec);
    if (id === 'brush') { const k = PENS[api.tool()] ? api.pen() : api.tool() === 'eraser' ? 'eraser' : api.pen(); if (body._sig === brushSig(k) && body.firstChild) return; body._sig = brushSig(k); body.innerHTML = PenPanel.html(k); if (!body._bound) { body._bound = true; PenPanel.bind(body, { pen: () => PENS[api.tool()] ? api.pen() : api.tool() === 'eraser' ? 'eraser' : api.pen(), setPen: k2 => api.setTool(k2), changed: partial => { api.changed(partial); if (!partial) { body._sig = ''; renderCard('brush'); } else if (rad) rad.update(); } }); } return; }
    if (id === 'palettes') body.innerHTML = palettesHTML();
    if (id === 'history') body.innerHTML = historyHTML();
    if (id === 'harmony') { if (!lock || !harmBase) harmBase = color(); body.innerHTML = harmonyHTML(harmBase); }
    if (id === 'variations') { if (!lock || !varBase) varBase = color(); body.innerHTML = variationsHTML(varBase); }
    if (id === 'pipette') body.innerHTML = pipetteHTML();
  }
  const brushSig = k => [k, JSON.stringify(S.prefs.pens[k] || {}), S.prefs.pressure, (P().presets || []).length].join('|');

  function palettesHTML() {
    const p = P(), tab = p.tab || 'perso';
    let list = tab === 'perso' ? userPals().filter(x => x.tab === 'perso') : tab === 'projet' ? projectPals() : palBuiltin().filter(x => x.tab === tab);
    list = list.slice().sort((a, b) => (palFaved(b) ? 1 : 0) - (palFaved(a) ? 1 : 0));
    const cur = color();
    const card = pal => { const mine = userPals().includes(pal); return `<div class="pal${mine ? ' mine' : ''}" data-pal="${pal.id}"><div class="pal-img" style="background-image:url('${palThumb(pal)}')"></div><div class="pal-m"><div class="pal-h"><b>${esc(pal.name)}</b><small>${pal.cols.length}</small><button class="pal-fav" data-pfav="${pal.id}" aria-pressed="${palFaved(pal)}" title="Palette favorite" aria-label="Favorite">${icon('heart', 'sm')}</button></div>
      <div class="pal-sw">${pal.cols.slice(0, 6).map((c, i) => blob(c, i, `aria-pressed="${sameC(c, cur)}"`)).join('')}${pal.cols.length > 6 ? `<span class="pal-more">+${pal.cols.length - 6}</span>` : ''}</div></div><button class="pal-menu" data-pmenu="${pal.id}" title="Options de la palette${mine ? ' (glissez une couleur ici pour l’ajouter)' : ''}" aria-label="Options">${icon('move', 'sm')}</button></div>`; };
    const empty = tab === 'projet' ? `<div class="atl-empty">Les images du moodboard de cet espace donnent ici leurs palettes. Vous pouvez aussi en créer une depuis une image.</div>` : '<div class="atl-empty">Aucune palette ici pour l’instant.</div>';
    return `<div class="pal-tabs" role="tablist">${PAL_TABS.map(([k, l]) => `<button role="tab" data-ptab="${k}" aria-selected="${tab === k}">${l}</button>`).join('')}<button class="pal-plus" data-pnew="1" title="Nouvelle palette" aria-label="Nouvelle palette">${icon('plus', 'sm')}</button></div>
      <div class="pal-list">${list.map(card).join('') || empty}</div><button class="btn pal-new" data-pnew="1">${icon('plus', 'sm')}Nouvelle palette</button>`;
  }
  function historyHTML() {
    const h = P().hist || [], cur = color();
    return `<div class="hist"><button class="hist-back" data-hback="1" title="Revenir à la couleur précédente" aria-label="Couleur précédente">${icon('clock')}</button>${h.slice(0, HIST_MAX - 1).map((c, i) => blob(c, i, `aria-pressed="${sameC(c, cur)}"`)).join('')}</div>${h.length ? '' : '<div class="atl-empty">Les couleurs que vous utilisez s’ajoutent ici, à chaque trait terminé.</div>'}`;
  }
  function harmonyHTML(base) {
    const mode = P().harm || 'analog', { hues, cols } = harmony(base, mode), [bh, bs, bv] = hsv(base);
    const C = 80, RD = 46, RO = 70, nodes = hues.map((hu, i) => { const a = -hu * Math.PI / 180, c = cols[i] || base, ix = (C + Math.cos(a) * RD * Math.max(.35, bs)).toFixed(1), iy = (C + Math.sin(a) * RD * Math.max(.35, bs)).toFixed(1); return `<line x1="${C}" y1="${C}" x2="${ix}" y2="${iy}" stroke="#F1E6CF" stroke-width="1.2"/><circle cx="${ix}" cy="${iy}" r="3.4" fill="#F1E6CF"/><circle class="hn" data-c="${c}" cx="${(C + Math.cos(a) * RO).toFixed(1)}" cy="${(C + Math.sin(a) * RO).toFixed(1)}" r="12" fill="${c}" stroke="#1A1B18" stroke-width="2.4"><title>${c}</title></circle>`; }).join('');
    const extra = [0, 1, 2, 3, 4, 5].filter(i => i >= hues.length).map(i => { const a = -(bh + 200 + i * 47) * Math.PI / 180, c = cols[(i + 2) % cols.length]; return `<circle class="hn ghost" data-c="${c}" cx="${(C + Math.cos(a) * RO).toFixed(1)}" cy="${(C + Math.sin(a) * RO).toFixed(1)}" r="10" fill="${c}" stroke="#1A1B18" stroke-width="2"><title>${c}</title></circle>`; }).join('');
    return `<div class="harm"><svg class="harm-w" viewBox="0 0 160 160"><circle cx="${C}" cy="${C}" r="${RO}" fill="none" stroke="#5A574C" stroke-width="1.2"/><foreignObject x="${C - RD}" y="${C - RD}" width="${RD * 2}" height="${RD * 2}"><div class="harm-disc" style="--v:${bv.toFixed(2)}"></div></foreignObject>${extra}${nodes}</svg>
      <div class="harm-modes">${HARMS.map(([k, l]) => `<button data-hm="${k}" aria-pressed="${mode === k}">${icon('hm-' + k)}<span>${l}</span></button>`).join('')}</div></div>
      <div class="harm-row">${cols.map((c, i) => blob(c, i)).join('')}</div>`;
  }
  function variationsHTML(base) {
    const amt = P().varAmt ?? .35, v = variations(base, amt);
    const node = (c, x, y, r, t) => `<circle class="hn" data-c="${c}" cx="${x}" cy="${y}" r="${r}" fill="${c}" stroke="#D6C5A0" stroke-width="1.4"><title>${t} ${c}</title></circle>`;
    const br = (cols, y, t) => `<path d="M76 52 C 92 52, 96 ${y}, 112 ${y} L 206 ${y}" fill="none" stroke="#D2C3A5" stroke-opacity=".7" stroke-width="1.2"/>` + cols.map((c, i) => node(c, 122 + i * 40, y, 15 - i * 3.2, t)).join('');
    return `<svg class="var-tree" viewBox="0 0 230 104">${br(v.up, 22, 'Teinte')}${br(v.down, 82, 'Ombre')}<circle class="hn big" data-c="${base}" cx="44" cy="52" r="36" fill="${base}" stroke="#E4D6B6" stroke-width="2"><title>${base}</title></circle></svg>
      <div class="var-row" title="Tons rompus, du clair au foncé">${v.row.map((c, i) => blob(c, i)).join('')}</div>
      <label class="var-sl" title="Écart des variations"><input type="range" min=".08" max=".7" step=".01" value="${amt}" data-var="1" aria-label="Écart des variations"></label>`;
  }
  function pipetteHTML() {
    const pk = P().pick, c = (pk && pk.c) || color();
    return `<div class="pip"><button class="pip-loupe" data-pstart="1" title="Prendre une couleur sur le board (K, ou Alt + clic)" aria-label="Pipette sur le board"><span class="pip-img" style="${pickImg ? `background-image:url(${pickImg})` : `background-color:${c}`}"></span><i></i></button>
      <div class="pip-chip"><span class="sw" data-c="${c}" style="background:${c}" title="Utiliser ${c}"></span><input value="${c}" maxlength="7" spellcheck="false" aria-label="Code HEX" data-hex="1"><button data-pcopy="1" title="Copier le code" aria-label="Copier">${icon('dup', 'sm')}</button></div></div>`;
  }
  /* ----- card events ----- */
  function pick(c, keepBase) {
    if (keepBase) lock++;
    api.setColor(c, true); useColor(c); refresh('color');
    if (keepBase) lock--;
  }
  function onStack(e) {
    const t = e.target;
    const cl = t.closest('[data-cclose]'); if (cl) { toggleCard(cl.dataset.cclose); return; }
    const sh = t.closest('[data-cshut]'); if (sh) { if (planche) return; const p = P(), id = sh.dataset.cshut; p.shut = (p.shut || []).includes(id) ? p.shut.filter(x => x !== id) : (p.shut || []).concat(id); save(); renderStack(); return; }
    const mn = t.closest('[data-cmenu]'); if (mn) { cardMenu(mn.dataset.cmenu, mn); return; }
    if (t.closest('[data-pstart]')) { if (planche) setPlanche(false); api.setTool('pick'); return; }
    if (t.closest('[data-pcopy]')) { const i = $('[data-hex]', stackEl); copyHex((i && Colors.valid(i.value.trim())) || color()); return; }
    if (t.closest('[data-hex]')) return;
    const inCard = t.closest('[data-card]'), card = inCard && inCard.dataset.card;
    const c = t.closest('[data-c]'); if (c) { pick(c.dataset.c, card === 'harmony' || card === 'variations'); return; }
    if (t.closest('[data-hback]')) { const h = P().hist || []; const prev = h.find(x => !sameC(x, color())); if (prev) pick(prev); return; }
    const hm = t.closest('[data-hm]'); if (hm) { P().harm = hm.dataset.hm; save(); renderCard('harmony'); return; }
    const tb = t.closest('[data-ptab]'); if (tb) { P().tab = tb.dataset.ptab; save(); renderCard('palettes'); return; }
    const pf = t.closest('[data-pfav]'); if (pf) { const pal = palById(pf.dataset.pfav); if (!pal) return; if (userPals().includes(pal)) pal.fav = !pal.fav; else { const f = new Set(P().palFav || []); f.has(pal.id) ? f.delete(pal.id) : f.add(pal.id); P().palFav = [...f]; } save(); renderCard('palettes'); return; }
    const pm = t.closest('[data-pmenu]'); if (pm) { palMenu(pm.dataset.pmenu, pm); return; }
    const pn = t.closest('[data-pnew]'); if (pn) { newPalMenu(pn); return; }
  }
  function onStackInput(e) { if (e.target.dataset.var) { P().varAmt = +e.target.value; save(); const sec = $('[data-card="variations"] .ac-body', stackEl); if (sec) { const keep = varBase; sec.innerHTML = variationsHTML(keep || color()); const r = $('[data-var]', sec); if (r) r.focus(); } } }
  /* the HEX field of the pipette card: a colour typed by hand */
  function onStackChange(e) { if (!e.target.dataset.hex) return; const c = Colors.valid(e.target.value.trim()); if (!c) { toast('Code couleur invalide'); e.target.value = color(); return; } P().pick = { c }; pickImg = ''; pick(c); }
  function onStackContext(e) {
    const c = e.target.closest('.pal [data-c]'); if (!c) return; const pal = palById(c.closest('[data-pal]').dataset.pal); if (!pal || !userPals().includes(pal)) return;
    e.preventDefault(); openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Retirer de la palette', icon: 'x', run: () => { const i = pal.cols.findIndex(x => sameC(x, c.dataset.c)); if (i >= 0) pal.cols.splice(i, 1); save(); renderCard('palettes'); } }, { label: 'Ajouter aux favoris', icon: 'star', run: () => { if (!P().favs.some(x => sameC(x, c.dataset.c))) P().favs.push(c.dataset.c); save(); refresh('favs'); } }]);
  }
  /* drag a colour onto one of your palettes to add it; drag a swatch inside its palette to reorder it */
  const dropPal = e => { const el = e.target.closest && e.target.closest('[data-pal]'), pal = el && palById(el.dataset.pal); return pal && userPals().includes(pal) ? [el, pal] : null; };
  function onDragOver(e) { if (!e.dataTransfer || ![...e.dataTransfer.types].includes(DRAG_T)) return; const d = dropPal(e); if (!d) return; e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; $$('.pal.drop', stackEl).forEach(x => x !== d[0] && x.classList.remove('drop')); d[0].classList.add('drop'); }
  function onDrop(e) {
    $$('.pal.drop', stackEl).forEach(x => x.classList.remove('drop'));
    const d = dropPal(e); if (!d) return; let g; try { g = JSON.parse(e.dataTransfer.getData(DRAG_T)); } catch (x) { return; } if (!g || !Colors.valid(g.c)) return; e.preventDefault();
    const [el, pal] = d, sw = e.target.closest('.pal-sw [data-c]'), at = sw ? [...el.querySelectorAll('.pal-sw [data-c]')].indexOf(sw) : pal.cols.length;
    if (g.pal === pal.id && g.i >= 0) { const [c] = pal.cols.splice(g.i, 1); pal.cols.splice(Math.min(at, pal.cols.length), 0, c); }
    else if (pal.cols.some(x => sameC(x, g.c))) { toast('Cette couleur est déjà dans « ' + pal.name + ' »'); return; }
    else { pal.cols.splice(Math.min(at, pal.cols.length), 0, Colors.valid(g.c)); toast('Couleur ajoutée à « ' + pal.name + ' »'); }
    save(); renderCard('palettes');
  }
  function addPalette(pal) { const p = P(), tab = p.tab === 'projet' ? 'projet' : 'perso'; const np = Object.assign({ id: uid('pal'), tab, sp: tab === 'projet' ? studioSpace : undefined }, pal); userPals().unshift(np); p.tab = tab; save(); renderCard('palettes'); return np; }
  function newPalMenu(btn) {
    openPop(btn, [{ head: 'Nouvelle palette' },
      { label: 'Depuis une image…', icon: 'image', run: () => { const i = $('#fileIn'); i.accept = 'image/*'; i.onchange = async () => { const f = i.files[0]; i.value = ''; i.accept = ''; if (!f) return; try { const r = await paletteFromFile(f); if (!r.cols.length) throw 0; addPalette({ name: r.name, cols: r.cols, img: r.img }); toast('Palette « ' + r.name + ' » créée depuis l’image'); } catch (e) { toast('Impossible de lire cette image'); } }; i.click(); } },
      { label: 'Depuis l’historique', icon: 'clock', run: () => { const h = (P().hist || []).slice(0, 8); if (!h.length) return toast('L’historique est vide'); addPalette({ name: 'Historique ' + new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), cols: h, scene: 'field' }); } },
      { label: 'Depuis l’harmonie', icon: 'harmony', run: () => { const m = P().harm || 'analog'; addPalette({ name: (HARMS.find(x => x[0] === m) || HARMS[1])[1] + ' ' + (harmBase || color()), cols: harmony(harmBase || color(), m).cols, scene: 'mountain' }); } },
      { label: 'Palette vide', icon: 'plus', run: () => addPalette({ name: 'Nouvelle palette', cols: [color()], scene: 'forest' }) },
      '-', { label: 'Importer des palettes (JSON)…', icon: 'upload', run: importPals }], { align: 'right' });
  }
  function palMenu(id, btn) {
    const pal = palById(id); if (!pal) return; const mine = userPals().includes(pal);
    const dup = () => { const i = userPals().indexOf(pal), np = { id: uid('pal'), tab: mine ? pal.tab : 'perso', name: pal.name + (mine ? ' (copie)' : ''), cols: pal.cols.slice(), scene: pal.scene, img: pal.img, asset: pal.asset, sp: pal.sp }; if (!pal.img && !pal.asset && SEED_THUMB[pal.id]) np.img = palThumb(pal); if (mine) userPals().splice(i + 1, 0, np); else { userPals().unshift(np); P().tab = 'perso'; } save(); renderCard('palettes'); };
    openPop(btn, [{ head: pal.name },
      ...(mine ? [{ label: 'Ajouter la couleur actuelle', icon: 'plus', run: () => { if (!pal.cols.some(x => sameC(x, color()))) pal.cols.push(color()); save(); renderCard('palettes'); } }, { label: 'Renommer', icon: 'text', run: () => renamePal(pal) }, { label: 'Dupliquer', icon: 'dup', run: dup }] : [{ label: 'Copier dans Perso', icon: 'dup', run: dup }]),
      { label: 'Mettre en favoris (rail)', icon: 'star', run: () => { P().favs = pal.cols.slice(0, 8); save(); refresh('favs'); toast('Les couleurs de « ' + pal.name + ' » sont dans vos favoris'); } },
      ...(mine ? ['-', { label: 'Supprimer la palette', icon: 'trash', danger: true, run: () => { P().pals = userPals().filter(x => x !== pal); save(); renderCard('palettes'); } }] : [])], { align: 'right' });
  }
  function renamePal(pal) {
    const el = $(`[data-pal="${pal.id}"] .pal-h b`, stackEl); if (!el) return;
    const i = document.createElement('input'); i.value = pal.name; i.className = 'pal-ren'; el.replaceWith(i); i.focus(); i.select();
    const done = () => { pal.name = i.value.trim() || pal.name; save(); renderCard('palettes'); };
    i.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') i.blur(); if (e.key === 'Escape') { i.value = pal.name; i.blur(); } }); i.addEventListener('blur', done);
  }
  function exportPals() { const pals = userPals().map(({ tab, name, cols, scene, fav }) => ({ name, tab, cols, scene, fav: !!fav })); saveJSON('palettes-notely.json', JSON.stringify({ notelyPalettes: 1, palettes: pals }, null, 2), pals.length + ' palette(s) exportée(s)'); }
  function importPals() {
    const i = $('#fileIn'); i.accept = '.json,application/json';
    i.onchange = async () => { const f = i.files[0]; i.value = ''; i.accept = ''; if (!f) return;
      try { const d = JSON.parse(await f.text()), list = Array.isArray(d) ? d : d.palettes; if (!Array.isArray(list)) throw 0; let n = 0;
        for (const pl of list) { const cols = (pl.cols || pl.colors || []).map(c => Colors.valid(String(c))).filter(Boolean); if (!cols.length) continue; userPals().push({ id: uid('pal'), tab: pl.tab === 'projet' ? 'projet' : 'perso', name: String(pl.name || 'Palette importée').slice(0, 40), cols, scene: pl.scene || 'field', sp: pl.tab === 'projet' ? studioSpace : undefined }); n++; }
        save(); renderCard('palettes'); toast(n ? n + ' palette(s) importée(s)' : 'Aucune palette dans ce fichier'); } catch (e) { toast('Ce fichier n’est pas un export de palettes'); } };
    i.click();
  }
  function cardMenu(id, btn) {
    if (id === 'history') openPop(btn, [{ label: 'Enregistrer comme palette', icon: 'palette', run: () => { const h = (P().hist || []).slice(0, 10); if (h.length) addPalette({ name: 'Historique', cols: h, scene: 'field' }); toggleCard('palettes', true); } }, { label: 'Effacer l’historique', icon: 'trash', danger: true, run: () => { P().hist = []; save(); renderCard('history'); } }], { align: 'right' });
    if (id === 'harmony') openPop(btn, [{ label: 'Enregistrer comme palette', icon: 'palette', run: () => { const m = P().harm || 'analog'; addPalette({ name: (HARMS.find(x => x[0] === m) || HARMS[1])[1], cols: harmony(harmBase || color(), m).cols, scene: 'mountain' }); toggleCard('palettes', true); } }, { label: 'Partir de la couleur actuelle', icon: 'wheel', run: () => { harmBase = color(); renderCard('harmony'); } }], { align: 'right' });
    if (id === 'palettes') openPop(btn, [{ label: 'Exporter mes palettes (JSON)', icon: 'download', run: exportPals }, { label: 'Importer des palettes (JSON)…', icon: 'upload', run: importPals }, '-', { label: leavesOn() ? 'Masquer le décor de feuilles' : 'Afficher le décor de feuilles', icon: 'leaf', run: () => { P().leaves = !leavesOn(); save(); renderStack(); renderDock(); } }, { label: 'Remettre les palettes d’exemple', icon: 'restore', run: () => { const mine = userPals().filter(p => !PAL_SEED.some(s => s.id === p.id)); P().pals = mine.concat(JSON.parse(JSON.stringify(PAL_SEED))); save(); renderCard('palettes'); } }], { align: 'right' });
  }

  /* ----- eyedropper loupe (the board gives a snapshot canvas of what is on screen) ----- */
  function showLoupe(cx, cy, snap) {
    if (!root || !snap) return; const r = root.getBoundingClientRect(), x = cx - snap.left, y = cy - snap.top;
    loupeEl.hidden = false; loupeEl.style.left = (cx - r.left) + 'px'; loupeEl.style.top = (cy - r.top) + 'px';
    const c = $('canvas', loupeEl), g = c.getContext('2d'), Z = 7, src = 300 / Z;
    g.imageSmoothingEnabled = true; g.fillStyle = '#121314'; g.fillRect(0, 0, 300, 300);
    g.drawImage(snap.cv, (x - src / 2) * snap.dpr, (y - src / 2) * snap.dpr, src * snap.dpr, src * snap.dpr, 0, 0, 300, 300);
    const col = snap.at(x, y); $('.lp-chip span', loupeEl).style.background = col; $('.lp-chip b', loupeEl).textContent = col; loupeEl.dataset.c = col;
    return col;
  }
  function hideLoupe() { if (loupeEl) loupeEl.hidden = true; }
  function picked(c, cx, cy) {
    if (!root) return;
    if (!loupeEl.hidden) { try { pickImg = $('canvas', loupeEl).toDataURL('image/jpeg', .85); } catch (e) { pickImg = ''; } } else pickImg = '';
    P().pick = { c }; pick(c);
    const r = root.getBoundingClientRect();
    chipEl.hidden = false; chipEl.dataset.c = c; chipEl.style.left = clamp(cx - r.left, 90, r.width - 90) + 'px'; chipEl.style.top = clamp(cy - r.top + 34, 10, r.height - 60) + 'px';
    chipEl.innerHTML = `<span class="sw" style="background:${c}"></span><b>${c}</b><button data-copy="1" title="Copier le code" aria-label="Copier">${icon('dup', 'sm')}</button>`;
    clearTimeout(chipEl._t); chipEl._t = setTimeout(() => { chipEl.hidden = true; }, 4500);
  }

  /* another theme: the wheel and the cards are built again in its look */
  function retheme() { if (!root || !on) return; renderBar(); renderFavs(); renderDock(); renderStack(); }

  return { mount, unmount, sync, refresh, retheme, showLoupe, hideLoupe, picked, toggleCard, planche: v => { if (on) setPlanche(v === undefined ? !planche : v); }, get on() { return on; }, get isPlanche() { return planche; } };
})();

/* the radial picker in a popover, for notes */
function radialPop(anchor, o) {
  const p = openPop(anchor, `<div class="atl-solo"><div class="rad-host"></div><div class="solo-pal"></div></div>`, { cls: 'atl-pop radpop', focus: false, above: o.above, align: 'right' });
  const side = hasEyeDropper() ? [['screen', 'drop', 'Pipette (prendre une couleur à l’écran)']] : [];
  const r = Radial($('.rad-host', p), { leaves: false, get: o.get, set: (c, final) => { o.set(c, final); if (final) { useColor(c); hist(); } }, side, onSide: async id => { if (id === 'screen') { const c = await screenPick(); if (c) { o.set(c, true); useColor(c); r.update(); hist(); } } } });
  const hist = () => { $('.solo-pal', p).innerHTML = `<small>Historique</small><div>${(studioPrefs().hist || []).slice(0, 14).map((c, i) => blob(c, i)).join('') || '<em>Vide pour l’instant</em>'}</div>`; };
  $('.solo-pal', p).addEventListener('click', e => { const b = e.target.closest('[data-c]'); if (b) { o.set(b.dataset.c, true); useColor(b.dataset.c); r.update(); } });
  hist(); return p;
}
