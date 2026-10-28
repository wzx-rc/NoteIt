/* ================= colours =================
   The colour popover: the theme's scheme of 20 numbered colours, the free colours used lately, and a free colour
   (saturation / brightness square, hue bar, code, screen eyedropper) folded under "Couleur libre". */
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

  /* open(anchor, { value, onPick(hex|null, final), none, above, align, keep })
     The theme's 20 colours first (numbered, in the roles of SCHEME_NAMES), the last free colours used, and under
     "Couleur libre" a saturation / brightness square, a hue bar and the code. Picking a swatch closes it. */
  function open(anchor, o = {}) {
    let cur = valid(o.value) || null, [h, s, v] = hex2hsv(cur || schemeHex(5) || '#4A72E8');
    const sch = scheme(), same = c => !!cur && c.toUpperCase() === cur;
    const sw = (c, no) => `<button class="sw" data-c="${c}" style="--c:${c}" aria-pressed="${same(c)}" title="${no ? no + ' · ' + SCHEME_NAMES[no - 1] : c}" aria-label="${no ? 'Couleur ' + no + ', ' + SCHEME_NAMES[no - 1] : c}">${no ? `<i>${no}</i>` : ''}</button>`;
    const rec = recent().filter(c => !schemeNo(c)).slice(0, 10);
    const free = !!S.prefs.cpFree;
    const p = openPop(anchor, `<div class="cp">
      <div class="cp-h"><span>Couleurs du thème</span><small>${esc(theme().label || '')}</small></div>
      <div class="cp-sch">${sch.slice(0, 20).map((c, i) => sw(c, i + 1)).join('')}</div>
      ${rec.length ? `<div class="cp-h"><span>Récentes</span></div><div class="cp-rec">${rec.map(c => sw(c)).join('')}</div>` : ''}
      <button class="cp-more" data-free aria-expanded="${free}">${icon('wheel', 'sm')}<span>Couleur libre</span>${icon('chevd', 'sm')}</button>
      <div class="cp-free"${free ? '' : ' hidden'}>
        <div class="cp-sv" role="slider" aria-label="Saturation et luminosité"><i></i></div>
        <div class="cp-hue" role="slider" aria-label="Teinte"><i></i></div>
        <div class="cp-row"><span class="cp-cur"></span><input class="cp-hex" maxlength="7" spellcheck="false" aria-label="Code couleur">${typeof hasEyeDropper === 'function' && hasEyeDropper() ? `<button class="cp-ic" data-drop title="Pipette : prendre une couleur à l’écran" aria-label="Pipette">${icon('drop', 'sm')}</button>` : ''}</div>
      </div>
      ${o.none ? `<button class="cp-none" data-none aria-pressed="${!cur}"><span class="sw fill-none"></span>Aucune couleur</button>` : ''}
    </div>`, { cls: 'cppop', above: o.above, align: o.align, focus: false });
    const svEl = p.querySelector('.cp-sv'), hueEl = p.querySelector('.cp-hue'), hexIn = p.querySelector('.cp-hex'), curEl = p.querySelector('.cp-cur');
    function paint() {
      svEl.style.setProperty('--h', hsv2hex(h, 1, 1));
      svEl.firstElementChild.style.cssText = `left:${s * 100}%;top:${(1 - v) * 100}%`;
      hueEl.firstElementChild.style.left = (h / 360 * 100) + '%';
      const c = cur || hsv2hex(h, s, v); curEl.style.background = c; if (document.activeElement !== hexIn) hexIn.value = cur || '';
      p.querySelectorAll('.cp-sch .sw, .cp-rec .sw').forEach(b => b.setAttribute('aria-pressed', same(b.dataset.c)));
    }
    const emit = final => { cur = hsv2hex(h, s, v); paint(); o.onPick && o.onPick(cur, final); };
    const drag = (el, fn) => el.addEventListener('pointerdown', e => {
      const r = el.getBoundingClientRect(), mv = ev => { fn(clamp((ev.clientX - r.left) / r.width, 0, 1), clamp((ev.clientY - r.top) / r.height, 0, 1)); emit(false); };
      el.setPointerCapture(e.pointerId); mv(e); e.preventDefault();
      el.onpointermove = mv; el.onpointerup = el.onpointercancel = () => { el.onpointermove = el.onpointerup = el.onpointercancel = null; emit(true); remember(cur); };
    });
    drag(svEl, (x, y) => { s = x; v = 1 - y; });
    drag(hueEl, x => { h = x * 359.9; });
    hexIn.addEventListener('input', () => { const c = valid(hexIn.value.trim()); if (!c) return; [h, s, v] = hex2hsv(c); emit(true); });
    hexIn.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { if (cur) remember(cur); closePop(); } });
    p.addEventListener('click', async e => {
      const b = e.target.closest('[data-c]'); if (b) { [h, s, v] = hex2hsv(b.dataset.c); cur = b.dataset.c.toUpperCase(); paint(); o.onPick && o.onPick(cur, true); if (!schemeNo(cur)) remember(cur); if (!o.keep) closePop(); return; }
      if (e.target.closest('[data-free]')) { const f = p.querySelector('.cp-free'); f.hidden = !f.hidden; S.prefs.cpFree = !f.hidden; save(); e.target.closest('[data-free]').setAttribute('aria-expanded', !f.hidden); return; }
      if (e.target.closest('[data-drop]')) { try { const r = await new EyeDropper().open(); const c = valid(r.sRGBHex); if (c) { [h, s, v] = hex2hsv(c); emit(true); remember(c); } } catch (err) {} return; }
      if (e.target.closest('[data-none]')) { o.onPick && o.onPick(null, true); closePop(); }
    });
    paint();
    return p;
  }
  /* the drawing wheel (board in Dessin): a hue ring around a saturation / brightness square, the current and the
     previous colour, the theme's 20 colours, the free colours used lately and the brush size. It folds into one line.
     o = { get(), set(hex, final), size() -> { t, label } | null, setSize(t, final) } */
  function wheel(host, o) {
    const W = 176, R = 88, RI = 70, SQ = Math.round(RI * Math.SQRT2) - 10;
    let [h, s, v] = hex2hsv(valid(o.get()) || '#1E1E1E'), prev = valid(o.get()) || '#1E1E1E', drag = null, ringFor = '';
    host.innerHTML = `<div class="lw${S.prefs.lwFold ? ' fold' : ''}">
      <div class="lw-hd"><button class="lw-cur" data-lwprev title="Couleur précédente : cliquer pour y revenir" aria-label="Revenir à la couleur précédente"><i></i><u></u></button><b class="lw-hex"></b><button class="lw-fold" data-lwfold title="Replier la roue" aria-label="Replier la roue">${icon('chevd', 'sm')}</button></div>
      <div class="lw-body">
        <div class="lw-wheel" style="width:${W}px;height:${W}px"><canvas width="${W * 2}" height="${W * 2}"></canvas><div class="lw-sv" style="width:${SQ}px;height:${SQ}px"><i></i></div><i class="lw-ht"></i></div>
        <div class="lw-sch"></div><div class="lw-rec"></div>
        ${o.size ? `<label class="lw-size"><span>Taille</span><input type="range" min="0" max="1" step=".002" aria-label="Taille du pinceau"><b></b></label>` : ''}
      </div></div>`;
    const el = host.firstElementChild, cv = $('canvas', el), sv = $('.lw-sv', el), ht = $('.lw-ht', el), sl = $('.lw-size input', el);
    function ring() {
      const key = skin() + isDarkTheme(); if (key === ringFor) return; ringFor = key;
      const x = cv.getContext('2d'); x.setTransform(2, 0, 0, 2, 0, 0); x.clearRect(0, 0, W, W);
      const g = x.createConicGradient(-Math.PI / 2, W / 2, W / 2); for (let a = 0; a <= 360; a += 30) g.addColorStop(a / 360, hsv2hex(a, .85, .95));
      x.beginPath(); x.arc(W / 2, W / 2, (R + RI) / 2, 0, 7); x.lineWidth = R - RI - 2; x.strokeStyle = g; x.stroke();
    }
    function swatches() {
      const cur = hsv2hex(h, s, v), sw = (c, no) => `<button class="sw" data-c="${c}" style="--c:${c}" aria-pressed="${c.toUpperCase() === cur}" title="${no ? no + ' · ' + SCHEME_NAMES[no - 1] : c}"></button>`;
      $('.lw-sch', el).innerHTML = scheme().map((c, i) => sw(c, i + 1)).join('');
      const rec = recent().filter(c => !schemeNo(c)).slice(0, 10);
      $('.lw-rec', el).innerHTML = rec.length ? rec.map(c => sw(c)).join('') : '';
      $('.lw-rec', el).hidden = !rec.length;
    }
    function paint() {
      ring();
      const cur = hsv2hex(h, s, v), a = h * Math.PI / 180, rm = (R + RI) / 2;
      sv.style.setProperty('--h', hsv2hex(h, 1, 1)); sv.firstElementChild.style.cssText = `left:${s * 100}%;top:${(1 - v) * 100}%`;
      ht.style.cssText = `left:${W / 2 + Math.sin(a) * rm}px;top:${W / 2 - Math.cos(a) * rm}px`;
      $('.lw-cur i', el).style.background = cur; $('.lw-cur u', el).style.background = prev; $('.lw-hex', el).textContent = cur;
      $$('.lw-sch .sw, .lw-rec .sw', el).forEach(b => b.setAttribute('aria-pressed', b.dataset.c.toUpperCase() === cur));
      if (sl && o.size) { const z = o.size(); if (z && document.activeElement !== sl) { sl.value = z.t; $('.lw-size b', el).textContent = z.label; } }
    }
    const emit = final => { const c = hsv2hex(h, s, v); paint(); o.set(c, final); if (final && !schemeNo(c)) { remember(c); swatches(); paint(); } };
    const wh = $('.lw-wheel', el);
    wh.addEventListener('pointerdown', e => {
      const r = wh.getBoundingClientRect(), dx = e.clientX - r.left - W / 2, dy = e.clientY - r.top - W / 2, d = Math.hypot(dx, dy);
      if (d >= RI - 4 && d <= R + 4) drag = 'ring'; else if (Math.abs(dx) <= SQ / 2 + 4 && Math.abs(dy) <= SQ / 2 + 4) drag = 'sq'; else return;
      prev = hsv2hex(h, s, v); wh.setPointerCapture(e.pointerId); mv(e); e.preventDefault(); e.stopPropagation();
    });
    const mv = e => {
      if (!drag) return; const r = wh.getBoundingClientRect(), dx = e.clientX - r.left - W / 2, dy = e.clientY - r.top - W / 2;
      if (drag === 'ring') h = (Math.atan2(dx, -dy) * 180 / Math.PI + 360) % 360;
      else { s = clamp((dx + SQ / 2) / SQ, 0, 1); v = clamp(1 - (dy + SQ / 2) / SQ, 0, 1); }
      emit(false);
    };
    wh.addEventListener('pointermove', mv);
    wh.addEventListener('pointerup', () => { if (drag) { drag = null; emit(true); } });
    wh.addEventListener('pointercancel', () => { drag = null; });
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-c]'); if (b) { prev = hsv2hex(h, s, v); [h, s, v] = hex2hsv(b.dataset.c); emit(true); return; }
      if (e.target.closest('[data-lwprev]')) { const p = prev; prev = hsv2hex(h, s, v); [h, s, v] = hex2hsv(p); emit(true); return; }
      if (e.target.closest('[data-lwfold]')) { S.prefs.lwFold = !S.prefs.lwFold; save(); el.classList.toggle('fold', S.prefs.lwFold); }
    });
    if (sl) { sl.addEventListener('input', () => { o.setSize(+sl.value, false); const z = o.size(); if (z) $('.lw-size b', el).textContent = z.label; }); sl.addEventListener('change', () => o.setSize(+sl.value, true)); }
    swatches(); paint();
    return { el, update() { const c = valid(o.get()); if (c && c !== hsv2hex(h, s, v)) { [h, s, v] = hex2hsv(c); } ringFor = ''; swatches(); paint(); } };
  }
  /* small inline picker: a few swatches, the current colour (opens the wheel) and optionally "none" */
  function row(cols, cur, prop, o = {}) {
    const same = (a, b) => (a || '').toUpperCase() === (b || '').toUpperCase();
    return `<div class="sws" data-prop="${prop}">${o.none ? `<button class="sw fill-none" data-c="" aria-pressed="${!cur}" title="Aucune"></button>` : ''}${cols.map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-pressed="${same(c, cur)}" aria-label="${c}"></button>`).join('')}<button class="sw cur" data-wheel="${prop}" style="background:${cur || 'transparent'}" title="Roue des couleurs" aria-label="Roue des couleurs">${icon('wheel', 'sm')}</button></div>`;
  }
  return { open, wheel, row, remember, hsv2hex, hex2hsv, PALETTE, valid };
})();
