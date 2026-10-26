/* ================= colours =================
   A colour wheel in the spirit of Concepts: a hue ring around a saturation/brightness square,
   the hex underneath, the last colours used and a palette of shades. */
const Colors = (() => {
  const HUES = [0, 22, 42, 62, 100, 150, 190, 215, 250, 285, 325];
  const SHADES = [.92, .78, .62, .46, .3];
  function hsv2rgb(h, s, v) { h = ((h % 360) + 360) % 360 / 60; const i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f)); const [r, g, b] = [[v, t, p], [q, v, p], [p, v, t], [p, q, v], [t, p, v], [v, p, q]][i % 6]; return [r * 255, g * 255, b * 255]; }
  const toHex = ([r, g, b]) => '#' + [r, g, b].map(v => Math.round(clamp(v, 0, 255)).toString(16).padStart(2, '0')).join('').toUpperCase();
  const hsv2hex = (h, s, v) => toHex(hsv2rgb(h, s, v));
  function hex2hsv(hex) { const [r, g, b] = hex2rgb(hex).map(v => v / 255), mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn; let h = 0; if (d) { h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; } return [h, mx ? d / mx : 0, mx]; }
  /* a palette of shades: light to deep for each hue, plus greys */
  const PALETTE = (() => { const rows = [['#FFFFFF', '#E9ECEF', '#ADB5BD', '#495057', '#1E1E1E']]; for (const h of HUES) rows.push(SHADES.map((l, i) => hsv2hex(h, i === 0 ? .22 : .35 + i * .16, l === .92 ? 1 : .95 - i * .12))); return rows; })();
  const recent = () => (S.prefs.recent || []);
  function remember(c) { if (!c) return; c = c.toUpperCase(); const r = recent().filter(x => x !== c); r.unshift(c); S.prefs.recent = r.slice(0, 10); save(); }
  const valid = s => /^#[0-9a-f]{6}$/i.test(s) ? s.toUpperCase() : /^#[0-9a-f]{3}$/i.test(s) ? ('#' + s.slice(1).split('').map(c => c + c).join('')).toUpperCase() : null;

  /* open(anchor, { value, onPick(hex|null), none, above, align }) */
  function open(anchor, o = {}) {
    const R = 86, RI = 64, SQ = Math.floor(RI * 1.36), SZ = R * 2 + 8, C = SZ / 2;
    let [h, s, v] = hex2hsv(valid(o.value) || '#1E1E1E'), cur = valid(o.value) || '#1E1E1E';
    const p = openPop(anchor, `<div class="cw">
      <div class="cw-top"><canvas class="cw-c" width="${SZ * 2}" height="${SZ * 2}" style="width:${SZ}px;height:${SZ}px" aria-label="Roue des couleurs"></canvas>
        <div class="cw-side"><span class="cw-cur" style="background:${cur}"></span><input class="cw-hex" value="${cur}" maxlength="7" spellcheck="false" aria-label="Code couleur">${o.none ? `<button class="btn sm cw-none">Aucune</button>` : ''}<div class="cw-rec">${recent().map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') || '<small>Vos couleurs récentes apparaîtront ici</small>'}</div></div></div>
      <div class="cw-pal">${themeColors('picker', PALETTE).map(r => r.map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-label="${c}"></button>`).join('')).join('')}</div></div>`, { cls: 'cwpop', above: o.above, align: o.align, focus: false });
    const cv = p.querySelector('.cw-c'), x = cv.getContext('2d'), hexIn = p.querySelector('.cw-hex'), curEl = p.querySelector('.cw-cur');
    const ring = document.createElement('canvas'); ring.width = ring.height = SZ * 2;
    { const rx = ring.getContext('2d'); rx.scale(2, 2); for (let a = 0; a < 360; a += 1.5) { rx.beginPath(); rx.arc(C, C, R, (a - 1.2) * Math.PI / 180, (a + 1.2) * Math.PI / 180); rx.strokeStyle = hsv2hex(a, 1, 1); rx.lineWidth = R - RI; rx.lineCap = 'butt'; rx.stroke(); } }
    function paint() {
      x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, SZ, SZ);
      x.save(); x.beginPath(); x.arc(C, C, (R + RI) / 2, 0, 7); x.lineWidth = R - RI; x.strokeStyle = '#000'; x.stroke(); x.restore();
      x.drawImage(ring, 0, 0, SZ, SZ);
      const x0 = C - SQ / 2, y0 = C - SQ / 2;
      let g = x.createLinearGradient(x0, 0, x0 + SQ, 0); g.addColorStop(0, '#fff'); g.addColorStop(1, hsv2hex(h, 1, 1)); x.fillStyle = g; x.fillRect(x0, y0, SQ, SQ);
      g = x.createLinearGradient(0, y0, 0, y0 + SQ); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, '#000'); x.fillStyle = g; x.fillRect(x0, y0, SQ, SQ);
      x.strokeStyle = 'rgba(255,255,255,.9)'; x.lineWidth = 1; x.strokeRect(x0 + .5, y0 + .5, SQ - 1, SQ - 1);
      const a = h * Math.PI / 180, rm = (R + RI) / 2;
      x.beginPath(); x.arc(C + Math.cos(a) * rm, C + Math.sin(a) * rm, 7, 0, 7); x.lineWidth = 3; x.strokeStyle = '#fff'; x.stroke(); x.lineWidth = 1; x.strokeStyle = 'rgba(0,0,0,.5)'; x.stroke();
      x.beginPath(); x.arc(x0 + s * SQ, y0 + (1 - v) * SQ, 6, 0, 7); x.lineWidth = 2.5; x.strokeStyle = v > .55 && s < .6 ? '#222' : '#fff'; x.stroke();
    }
    const emit = (final) => { cur = hsv2hex(h, s, v); curEl.style.background = cur; if (document.activeElement !== hexIn) hexIn.value = cur; o.onPick && o.onPick(cur, final); };
    let drag = null;
    cv.addEventListener('pointerdown', e => {
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, dx = px - C, dy = py - C, d = Math.hypot(dx, dy);
      if (d >= RI - 4 && d <= R + 6) drag = 'ring'; else if (Math.abs(dx) <= SQ / 2 + 4 && Math.abs(dy) <= SQ / 2 + 4) drag = 'sq'; else return;
      cv.setPointerCapture(e.pointerId); move(e); e.preventDefault();
    });
    const move = e => {
      if (!drag) return;
      const r = cv.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top, dx = px - C, dy = py - C;
      if (drag === 'ring') h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360;
      else { s = clamp((dx + SQ / 2) / SQ, 0, 1); v = clamp(1 - (dy + SQ / 2) / SQ, 0, 1); }
      paint(); emit(false);
    };
    cv.addEventListener('pointermove', move);
    cv.addEventListener('pointerup', () => { if (drag) { drag = null; emit(true); remember(cur); } });
    cv.addEventListener('pointercancel', () => { drag = null; });
    hexIn.addEventListener('input', () => { const c = valid(hexIn.value.trim()); if (!c) return; [h, s, v] = hex2hsv(c); paint(); emit(true); });
    hexIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { remember(cur); closePop(); } });
    p.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (b) { [h, s, v] = hex2hsv(b.dataset.c); paint(); emit(true); remember(cur); if (!o.keep) closePop(); return; }
      if (e.target.closest('.cw-none')) { o.onPick && o.onPick(null, true); closePop(); }
    });
    paint();
    return p;
  }
  /* small inline picker: a few swatches, the current colour (opens the wheel) and optionally "none" */
  function row(cols, cur, prop, o = {}) {
    const same = (a, b) => (a || '').toUpperCase() === (b || '').toUpperCase();
    return `<div class="sws" data-prop="${prop}">${o.none ? `<button class="sw fill-none" data-c="" aria-pressed="${!cur}" title="Aucune"></button>` : ''}${cols.map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-pressed="${same(c, cur)}" aria-label="${c}"></button>`).join('')}<button class="sw cur" data-wheel="${prop}" style="background:${cur || 'transparent'}" title="Roue des couleurs" aria-label="Roue des couleurs">${icon('wheel', 'sm')}</button></div>`;
  }
  return { open, row, remember, hsv2hex, hex2hsv, PALETTE, valid };
})();
