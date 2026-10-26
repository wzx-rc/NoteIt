/* Pokédex: the colour picker of the "Pokédex chromatique" board, used instead of the round Radial wheel.
   The device itself is the painted picker of the concept (assets/roue.webp, generated from the user's board): a red
   casing, a dark well with fifteen painted petals around a round disc. The petals are swatches: a click (or a drag
   around the ring) takes the colour painted under it (PKW_TAB, sampled every 3° from the painting). The disc is live:
   the current hue, saturation from left to right, brightness from top to bottom. The teal lens holds the current
   colour, the star keeps it in the favourites, a charcoal rail carries the side tools, and a cream screen on the
   right shows the recent and favourite colours.
   Same options and same answer as Radial (o.get, o.set, o.side, o.onSide; returns { update, el }). */
const PKW = { W: 530, H: 404, CX: 217.7, CY: 206.7, RW: 152, RD: 62, R1: 80, R2: 140, RP: 103 };
const PKW_TAB = ['#60AEA0','#62AA9D','#60A99D','#5DA8A0','#5EA9A0','#559998','#498283','#458382','#458085','#447E84','#3D7C85','#3D7883','#3C7B84','#468188','#4E6E71','#345C68','#35596A','#335A6B','#35586B','#375869','#35586B','#35586B','#3C5561','#364E68','#364E69','#374F69','#354F6D','#394D66','#384C68','#374B65','#384A61','#69779E','#6A799D','#6D749D','#6C759B','#6D749D','#707C9C','#6F7598','#6B7699','#6E628B','#716392','#726691','#746792','#736792','#75668F','#756490','#736090','#6F5394','#725794','#745596','#735494','#765990','#765898','#7D5998','#956AA9','#784EB0','#794EB7','#7C4CB5','#7B4EB5','#7B4EB5','#7A50B5','#7C50B1','#7D50B2','#7F4BB0','#A95851','#B45954','#B45B53','#B75A53','#B65D54','#B85E55','#BA6157','#BE665B','#C16959','#853832','#813D35','#823E35','#833F36','#844037','#854039','#814239','#844138','#83443A','#F6562D','#FC592D','#F95B30','#FA5B30','#FE5A2D','#F55B31','#FE582C','#FB592E','#B77336','#FFC351','#FEC552','#FDC652','#FEC552','#FDC655','#FEC854','#FEC655','#FDC854','#EEBC3D','#EDDE76','#ECDE77','#ECDB7A','#E9DC76','#E9DA7A','#E8DA7A','#E0DB7D','#DAD06F','#9BCC5B','#96C75E','#98C75F','#8EC660','#85C063','#85C35F','#82C362','#81C261','#5E8B44','#6BA49A','#61AAA1','#60AEA1'];
const pkwAt = deg => PKW_TAB[Math.round((((deg % 360) + 360) % 360) / 3) % PKW_TAB.length];
/* the petal that best matches a colour, or null for greys */
function pkwAngFor(c) {
  const [h, s, v] = hsv(c); if (s < .12 || v < .3) return null; let best = null, bd = 1e9;
  PKW_TAB.forEach((p, i) => { const [ph] = hsv(p), d = Math.min(Math.abs(ph - h), 360 - Math.abs(ph - h)); if (d < bd) { bd = d; best = i * 3; } });
  return bd < 24 ? best : null;
}
const PKW_IMG = n => `<img src="${n}" alt="" draggable="false">`;
function pkWheel(el, o) {
  const { W, CX, CY, RW, RD, R1, R2, RP } = PKW, side = (o.side || []).slice(0, 4);
  el.classList.add('pkw'); el.style.setProperty('--W', W + 'px');
  el.innerHTML = `<div class="pkw-body">${PKW_IMG('asset:roue.webp')}</div>
    <canvas class="pkw-c" width="${RW * 4}" height="${RW * 4}" style="left:${CX - RW}px;top:${CY - RW}px" tabindex="0" aria-label="Roue des couleurs : une couleur sur les pétales, saturation et luminosité dans le disque"></canvas>
    ${side.length ? `<div class="pkw-rail">${side.map(b => `<button class="pkw-b" data-rb="${b[0]}" title="${b[2]}" aria-label="${b[2]}">${icon(b[1])}</button>`).join('')}<span class="pkw-dots" aria-hidden="true"></span></div>` : ''}
    <button class="pkw-cur" title="Couleur actuelle : cliquez pour le code, glissez-la sur une palette" aria-label="Code couleur" draggable="true"><i></i></button>
    <button class="pkw-star" data-pkstar="1" title="Garder la couleur actuelle dans les favoris" aria-label="Favori">${PKW_IMG('asset:etoile.webp')}</button>
    <div class="pkw-screen"><span class="pkw-lf a">${PKW_IMG('asset:st-myrtille.webp')}</span><span class="pkw-lf b">${PKW_IMG('asset:st-framboise.webp')}</span>
      <div class="pkw-h">Récentes</div><div class="pkw-g pkw-rec"></div>
      <div class="pkw-h">Favoris</div><div class="pkw-g pkw-fav"></div></div>`;
  const cv = $('.pkw-c', el), x = cv.getContext('2d'), recEl = $('.pkw-rec', el), favEl = $('.pkw-fav', el), curEl = $('.pkw-cur', el), starEl = $('.pkw-star', el);
  let [h, s, v] = hsv(o.get()), selAng = pkwAngFor(o.get()), drag = null, discH = null; const disc = mkCanvas(RD * 4);
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
    paintDisc(); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, RW * 2, RW * 2); const C = RW;
    if (selAng != null) { const a = selAng * Math.PI / 180; x.beginPath(); x.arc(C + Math.cos(a) * RP, C + Math.sin(a) * RP, 9, 0, 7); x.lineWidth = 3.4; x.strokeStyle = '#FFFDF6'; x.shadowColor = 'rgba(0,0,0,.45)'; x.shadowBlur = 3; x.stroke(); x.shadowColor = 'transparent'; }
    x.save(); x.beginPath(); x.arc(C, C, RD, 0, 7); x.shadowColor = 'rgba(0,0,0,.35)'; x.shadowBlur = 6; x.fillStyle = '#fff'; x.fill(); x.restore();
    x.drawImage(disc, C - RD, C - RD, RD * 2, RD * 2);
    /* a soft glaze so the disc sits under the glass of the painting */
    const g = x.createRadialGradient(C - RD * .35, C - RD * .45, 2, C, C, RD); g.addColorStop(0, 'rgba(255,255,255,.28)'); g.addColorStop(.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,.12)');
    x.beginPath(); x.arc(C, C, RD, 0, 7); x.fillStyle = g; x.fill();
    const [du, dw] = discPos(), mx = C + du * RD * .96, my = C + dw * RD * .96;
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
  const petal = deg => { selAng = Math.round((((deg % 360) + 360) % 360) / 3) * 3 % 360; [h, s, v] = hsv(pkwAt(selAng)); };
  cv.addEventListener('pointerdown', e => {
    const [px, py] = at(e), d = Math.hypot(px, py);
    if (d <= RD + 4) drag = 'disc'; else if (d >= R1 - 6 && d <= R2 + 8) drag = 'ring'; else return;
    cv.setPointerCapture(e.pointerId); move(e); e.preventDefault(); e.stopPropagation();
  });
  const move = e => {
    if (!drag) return; const [px, py] = at(e);
    if (drag === 'ring') petal(Math.atan2(py, px) * 180 / Math.PI);
    else { let u = px / RD, w = py / RD; const len = Math.hypot(u, w); if (len > 1) { u /= len; w /= len; } const l = Math.min(1, Math.hypot(u, w)), m = Math.max(Math.abs(u), Math.abs(w)); const su = m ? u * l / m : 0, sw = m ? w * l / m : 0; s = clamp((su + 1) / 2, 0, 1); v = clamp((1 - sw) / 2, 0, 1); }
    paint(); emit(false);
  };
  cv.addEventListener('pointermove', move);
  cv.addEventListener('pointerup', () => { if (drag) { drag = null; emit(true); } });
  cv.addEventListener('pointercancel', () => { drag = null; });
  /* keyboard: left / right go from petal to petal, Shift + arrows move saturation and brightness */
  cv.addEventListener('keydown', e => {
    const st = e.altKey ? 10 : 2, k = e.key; if (!k.startsWith('Arrow')) return; e.preventDefault(); e.stopPropagation();
    if (e.shiftKey) { if (k === 'ArrowLeft') s = clamp(s - st / 100, 0, 1); if (k === 'ArrowRight') s = clamp(s + st / 100, 0, 1); if (k === 'ArrowUp') v = clamp(v + st / 100, 0, 1); if (k === 'ArrowDown') v = clamp(v - st / 100, 0, 1); }
    else petal((selAng ?? 270) + (k === 'ArrowRight' || k === 'ArrowDown' ? 24 : -24));
    paint(); emit(false); clearTimeout(cv._k); cv._k = setTimeout(() => emit(true), 400);
  });
  el.addEventListener('pointerdown', e => { if (!e.target.closest('.pkw-c')) e.stopPropagation(); });
  const take = c => { [h, s, v] = hsv(c); selAng = pkwAngFor(c); paint(); emit(true); };
  el.addEventListener('click', e => {
    const b = e.target.closest('[data-c]'); if (b) { take(b.dataset.c); return; }
    if (e.target.closest('[data-radd]') || e.target.closest('[data-pkstar]')) { const c = hexv(h, s, v); if (e.target.closest('[data-radd]') && studioPrefs().favs.some(f => sameC(f, c))) toast('Cette couleur est déjà dans les favoris'); else toggleFav(c); lists(); chip(); Studio.refresh('favs'); return; }
    if (e.target.closest('.pkw-cur')) { hexPop(curEl, hexv(h, s, v), take); return; }
    const rb = e.target.closest('[data-rb]'); if (rb && o.onSide) o.onSide(rb.dataset.rb, rb);
  });
  el.addEventListener('dragstart', dragColor);
  el.addEventListener('contextmenu', e => { const b = e.target.closest('[data-fav]'); if (!b) return; e.preventDefault(); openPop({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, [{ label: 'Retirer des favoris', icon: 'x', run: () => { toggleFav(b.dataset.c); lists(); chip(); Studio.refresh('favs'); } }]); });
  paint(); lists(); chip();
  return { update() { const c = o.get(); if (!sameC(c, hexv(h, s, v))) { [h, s, v] = hsv(c); selAng = pkwAngFor(c); paint(); } chip(); lists(); }, el };
}
