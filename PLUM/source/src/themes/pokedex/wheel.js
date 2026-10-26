/* Pokédex: the colour picker of the "Pokédex chromatique" board, used instead of the round Radial wheel.
   A red device: a charcoal rail on the left (poké ball cap, then the side tools), a dark well in the middle with
   sixteen pastel petals around a round colour disc, a lens on the top edge that holds the current colour, a star to
   keep it, and a cream screen on the right with the recent and the favourite colours.
   Petals: drag around the ring to turn the hue. Disc: saturation from left to right, brightness from top to bottom.
   Same options and same answer as Radial (o.get, o.set, o.side, o.onSide; returns { update, el }). */
const PKW = { W: 548, XR: 404, H: 356, CX: 214, CY: 178, RW: 156, R1: 78, R2: 144, RD: 64, N: 16, A0: -104 };
/* petal i sits at screen angle A0 + i·22.5° (clockwise from the right, in degrees); hues follow the painter's wheel */
const pkwAngOf = h => PKW.A0 + hueToAng(h) / 360 * 360;
const pkwHueAt = deg => angToHue((((deg - PKW.A0) % 360) + 360) % 360);
let _pkwPetals = null;
function pkwPetals() {
  if (_pkwPetals) return _pkwPetals;
  const { RW, R1, R2, N } = PKW, S2 = RW * 2, c = mkCanvas(S2 * 2), x = c.getContext('2d'); x.scale(2, 2);
  let seed = 11; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (let i = 0; i < N; i++) {
    const deg = PKW.A0 + i * 360 / N, a = deg * Math.PI / 180, hue = angToHue(i * 360 / N), mid = (R1 + R2) / 2 + 2;
    const base = Colors.hsv2hex(hue, .46 + .08 * Math.sin(i), .86 + .06 * Math.cos(i * 1.7));
    x.save(); x.translate(RW + Math.cos(a) * mid, RW + Math.sin(a) * mid); x.rotate(a);
    /* a soft petal: longer than wide, a ragged rim like a pastel dab */
    const L = (R2 - R1) / 2 + 1, Wd = Math.PI * mid / N * .9, pts = [];
    for (let k = 0; k < 12; k++) { const t = k / 12 * Math.PI * 2, j = .94 + r() * .1; pts.push([Math.cos(t) * L * j * (Math.cos(t) > 0 ? 1.06 : .94), Math.sin(t) * Wd * j * (Math.cos(t) > 0 ? 1.05 : .9)]); }
    /* a smooth closed curve through the midpoints */
    const md = k => { const a = pts[k % 12], b = pts[(k + 1) % 12]; return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; };
    x.beginPath(); x.moveTo(...md(0)); for (let k = 1; k <= 12; k++) x.quadraticCurveTo(...pts[k % 12], ...md(k)); x.closePath();
    x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 5; x.shadowOffsetY = 2; x.fillStyle = base; x.fill(); x.shadowColor = 'transparent';
    x.save(); x.clip();
    for (let k = 0; k < 40; k++) { x.globalAlpha = .06 + r() * .12; x.fillStyle = r() < .7 ? '#FFF6E4' : '#3A2A1C'; x.beginPath(); x.ellipse((r() - .5) * L * 2, (r() - .5) * Wd * 2, 1 + r() * 5, .6 + r() * 2, r() * 3, 0, 7); x.fill(); }
    x.globalAlpha = .28; x.fillStyle = '#FFF8EC'; x.beginPath(); x.ellipse(L * .3, -Wd * .35, L * .45, Wd * .28, .2, 0, 7); x.fill();
    x.restore(); x.restore();
  }
  _pkwPetals = c; return c;
}
const PKW_LEAF = n => `<img src="${n}" alt="">`;
function pkWheel(el, o) {
  const { W, H, XR, CX, CY, RW, R1, R2, RD } = PKW, side = (o.side || []).slice(0, 4);
  el.classList.add('pkw'); el.style.setProperty('--W', W + 'px');
  el.innerHTML = `<svg class="pkw-shell" viewBox="0 0 ${W} ${H}" aria-hidden="true"><defs>
      <linearGradient id="pkwRed" x1="0" y1="0" x2=".3" y2="1"><stop offset="0" stop-color="#DB5038"/><stop offset=".55" stop-color="#C63F2C"/><stop offset="1" stop-color="#A93424"/></linearGradient>
      <radialGradient id="pkwWell" cx="50%" cy="45%" r="55%"><stop offset="0" stop-color="#3A3A33"/><stop offset=".75" stop-color="#25251F"/><stop offset="1" stop-color="#171712"/></radialGradient></defs>
    <path class="pkw-case" d="M44 10H270c10 0 14-8 26-8h22c12 0 16 8 26 8H${XR - 34}c22 0 34 12 34 34v268c0 22-12 34-34 34H44C22 346 10 334 10 312V44C10 22 22 10 44 10z" fill="url(#pkwRed)"/>
    <path d="M46 22H${XR - 46}c14 0 22 8 22 22v266c0 14-8 22-22 22H46c-14 0-22-8-22-22V44c0-14 8-22 22-22z" fill="none" stroke="rgba(60,14,8,.35)" stroke-width="2"/>
    <path d="M44 13H270M${XR - 34} 13c18 0 30 10 30 30" fill="none" stroke="rgba(255,226,200,.4)" stroke-width="2.4" stroke-linecap="round"/>
    <circle cx="${CX}" cy="${CY}" r="${RW}" fill="#3B2A22"/><circle cx="${CX}" cy="${CY}" r="${RW - 5}" fill="url(#pkwWell)" stroke="#57534A" stroke-width="1.4"/>
    <circle cx="${CX}" cy="${CY}" r="${R2 + 6}" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="2"/>
    <g fill="#7A2418" opacity=".55"><circle cx="30" cy="330" r="1.6"/><circle cx="${XR - 16}" cy="40" r="1.4"/><circle cx="${XR - 30}" cy="330" r="1.8"/></g></svg>
    <canvas class="pkw-c" width="${RW * 4}" height="${RW * 4}" style="left:${CX - RW}px;top:${CY - RW}px" tabindex="0" aria-label="Roue des couleurs : teinte sur les pétales, saturation et luminosité dans le disque"></canvas>
    <div class="pkw-rail"><span class="pkw-ball" aria-hidden="true"></span>${side.map(b => `<button class="pkw-b" data-rb="${b[0]}" title="${b[2]}" aria-label="${b[2]}">${icon(b[1])}</button>`).join('')}</div>
    <button class="pkw-cur" title="Couleur actuelle : cliquez pour le code, glissez-la sur une palette" aria-label="Code couleur" draggable="true"><i></i></button>
    <button class="pkw-star" data-pkstar="1" title="Garder la couleur actuelle dans les favoris" aria-label="Favori"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 2.8 2.8 5.8 6.3.9-4.6 4.4 1.1 6.3-5.6-3-5.6 3 1.1-6.3-4.6-4.4 6.3-.9z"/></svg></button>
    <div class="pkw-screen"><span class="pkw-lf a">${PKW_LEAF('asset:feuille-a.webp')}</span><span class="pkw-lf b">${PKW_LEAF('asset:feuille-b.webp')}</span>
      <div class="pkw-h">Récentes</div><div class="pkw-g pkw-rec"></div>
      <div class="pkw-h">Favoris</div><div class="pkw-g pkw-fav"></div></div>`;
  const cv = $('.pkw-c', el), x = cv.getContext('2d'), recEl = $('.pkw-rec', el), favEl = $('.pkw-fav', el), curEl = $('.pkw-cur', el), starEl = $('.pkw-star', el);
  let [h, s, v] = hsv(o.get()), drag = null, discH = null; const disc = mkCanvas(RD * 4);
  /* the disc: the current hue, saturation across, brightness down; the square is stretched onto the round */
  function paintDisc() {
    if (discH === h) return; discH = h; const n = RD * 4, d = disc.getContext('2d'), im = d.createImageData(n, n), px = im.data;
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
      const u = (i + .5) / n * 2 - 1, w = (j + .5) / n * 2 - 1, len = Math.hypot(u, w); if (len > 1.01) continue;
      const m = Math.max(Math.abs(u), Math.abs(w)) || 1, su = u * len / m, sw = w * len / m;
      const [cr, cg, cb] = hex2rgb(Colors.hsv2hex(h, (su + 1) / 2, (1 - sw) / 2)), k = (j * n + i) * 4;
      px[k] = cr; px[k + 1] = cg; px[k + 2] = cb; px[k + 3] = 255 * clamp((1.01 - len) * n / 2, 0, 1);
    }
    d.putImageData(im, 0, 0);
  }
  const discPos = () => { const u = s * 2 - 1, w = 1 - v * 2, len = Math.hypot(u, w); if (len < 1e-4) return [0, 0]; const m = Math.max(Math.abs(u), Math.abs(w)); return [u * m / len, w * m / len]; };
  function paint() {
    paintDisc(); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, RW * 2, RW * 2);
    x.drawImage(pkwPetals(), 0, 0, RW * 2, RW * 2);
    const C = RW, sel = s > .12 ? Math.round(hueToAng(h) / (360 / PKW.N)) % PKW.N : -1;
    if (sel >= 0) { const a = (PKW.A0 + sel * 360 / PKW.N) * Math.PI / 180, m = (R1 + R2) / 2 + 2; x.beginPath(); x.arc(C + Math.cos(a) * m, C + Math.sin(a) * m, 8.5, 0, 7); x.lineWidth = 3.2; x.strokeStyle = '#FFFDF6'; x.stroke(); x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,.35)'; x.stroke(); }
    /* the knob on the rim gives the exact hue */
    const ha = pkwAngOf(h) * Math.PI / 180; x.beginPath(); x.arc(C + Math.cos(ha) * (R2 + 7), C + Math.sin(ha) * (R2 + 7), 4.5, 0, 7); x.fillStyle = '#F4E9D2'; x.fill(); x.strokeStyle = 'rgba(0,0,0,.5)'; x.lineWidth = 1; x.stroke();
    /* the disc in its white ring */
    x.beginPath(); x.arc(C, C, RD + 7, 0, 7); x.fillStyle = '#FBF7EE'; x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowBlur = 10; x.fill(); x.shadowColor = 'transparent';
    x.beginPath(); x.arc(C, C, RD + 7, 0, 7); x.strokeStyle = 'rgba(80,60,40,.35)'; x.lineWidth = 1; x.stroke();
    x.drawImage(disc, C - RD, C - RD, RD * 2, RD * 2);
    x.beginPath(); x.arc(C, C, RD, 0, 7); x.strokeStyle = 'rgba(0,0,0,.18)'; x.lineWidth = 1.2; x.stroke();
    const [du, dw] = discPos(), mx = C + du * RD, my = C + dw * RD;
    x.beginPath(); x.arc(mx, my, 7, 0, 7); x.lineWidth = 3; x.strokeStyle = '#FFFDF6'; x.stroke(); x.lineWidth = 1.2; x.strokeStyle = 'rgba(0,0,0,.55)'; x.stroke();
  }
  function lists() {
    const rec = (S.prefs.recent || []).slice(0, 8), favs = studioPrefs().favs.slice(0, 7);
    recEl.innerHTML = rec.map((c, i) => blob(c, i)).join('') || '<em>Vide</em>';
    favEl.innerHTML = favs.map((c, i) => blob(c, i + 2, 'data-fav="1"')).join('') + `<button class="pkw-add" data-radd="1" title="Ajouter la couleur actuelle aux favoris" aria-label="Ajouter aux favoris">${icon('plus')}</button>`;
  }
  function chip() { const c = hexv(h, s, v); curEl.querySelector('i').style.background = c; curEl.dataset.drag = c; starEl.setAttribute('aria-pressed', studioPrefs().favs.some(f => sameC(f, c))); }
  const emit = final => { chip(); o.set(hexv(h, s, v), final); };
  const at = e => { const r = cv.getBoundingClientRect(), k = RW * 2 / r.width; return [(e.clientX - r.left) * k - RW, (e.clientY - r.top) * k - RW]; };
  cv.addEventListener('pointerdown', e => {
    const [px, py] = at(e), d = Math.hypot(px, py);
    if (d <= RD + 6) drag = 'disc'; else if (d >= R1 - 4 && d <= RW) drag = 'ring'; else return;
    /* a grey or a near-black has no hue to turn: the petal then gives its own pastel */
    if (drag === 'ring' && (s < .25 || v < .35)) { s = .5; v = .86; }
    cv.setPointerCapture(e.pointerId); move(e); e.preventDefault(); e.stopPropagation();
  });
  const move = e => {
    if (!drag) return; const [px, py] = at(e);
    if (drag === 'ring') h = pkwHueAt(Math.atan2(py, px) * 180 / Math.PI);
    else { let u = px / RD, w = py / RD; const len = Math.hypot(u, w); if (len > 1) { u /= len; w /= len; } const l = Math.min(1, Math.hypot(u, w)), m = Math.max(Math.abs(u), Math.abs(w)); const su = m ? u * l / m : 0, sw = m ? w * l / m : 0; s = clamp((su + 1) / 2, 0, 1); v = clamp((1 - sw) / 2, 0, 1); }
    paint(); emit(false);
  };
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', () => { if (drag) { drag = null; emit(true); } });
  cv.addEventListener('pointercancel', () => { drag = null; });
  cv.addEventListener('keydown', e => {
    const st = e.altKey ? 10 : 2, k = e.key; if (!k.startsWith('Arrow')) return; e.preventDefault(); e.stopPropagation();
    if (e.shiftKey) { if (k === 'ArrowLeft') s = clamp(s - st / 100, 0, 1); if (k === 'ArrowRight') s = clamp(s + st / 100, 0, 1); if (k === 'ArrowUp') v = clamp(v + st / 100, 0, 1); if (k === 'ArrowDown') v = clamp(v - st / 100, 0, 1); }
    else h = angToHue(hueToAng(h) + (k === 'ArrowRight' || k === 'ArrowDown' ? st : -st));
    paint(); emit(false); clearTimeout(cv._k); cv._k = setTimeout(() => emit(true), 400);
  });
  el.addEventListener('pointerdown', e => { if (!e.target.closest('.pkw-c')) e.stopPropagation(); });
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (b) { [h, s, v] = hsv(b.dataset.c); paint(); emit(true); return; }
    if (e.target.closest('[data-radd]') || e.target.closest('[data-pkstar]')) { const c = hexv(h, s, v); if (e.target.closest('[data-radd]') && studioPrefs().favs.some(f => sameC(f, c))) toast('Cette couleur est déjà dans les favoris'); else toggleFav(c); lists(); chip(); Studio.refresh('favs'); return; }
    if (e.target.closest('.pkw-cur')) { hexPop(curEl, hexv(h, s, v), c => { [h, s, v] = hsv(c); paint(); emit(true); }); return; }
    const rb = e.target.closest('[data-rb]'); if (rb && o.onSide) o.onSide(rb.dataset.rb, rb);
  });
  el.addEventListener('dragstart', dragColor);
  el.addEventListener('contextmenu', e => { const b = e.target.closest('[data-fav]'); if (!b) return; e.preventDefault(); openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Retirer des favoris', icon: 'x', run: () => { toggleFav(b.dataset.c); lists(); chip(); Studio.refresh('favs'); } }]); });
  paint(); lists(); chip();
  return { update() { const c = o.get(); if (!sameC(c, hexv(h, s, v))) { [h, s, v] = hsv(c); paint(); } chip(); lists(); }, el };
}
