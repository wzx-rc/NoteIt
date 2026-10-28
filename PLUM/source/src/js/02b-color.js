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
  /* small inline picker: a few swatches, the current colour (opens the wheel) and optionally "none" */
  function row(cols, cur, prop, o = {}) {
    const same = (a, b) => (a || '').toUpperCase() === (b || '').toUpperCase();
    return `<div class="sws" data-prop="${prop}">${o.none ? `<button class="sw fill-none" data-c="" aria-pressed="${!cur}" title="Aucune"></button>` : ''}${cols.map(c => `<button class="sw" data-c="${c}" style="background:${c}" aria-pressed="${same(c, cur)}" aria-label="${c}"></button>`).join('')}<button class="sw cur" data-wheel="${prop}" style="background:${cur || 'transparent'}" title="Roue des couleurs" aria-label="Roue des couleurs">${icon('wheel', 'sm')}</button></div>`;
  }
  return { open, row, remember, hsv2hex, hex2hsv, PALETTE, valid };
})();
