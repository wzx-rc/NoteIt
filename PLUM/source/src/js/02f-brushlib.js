/* ================= brush library (0.2.36) =================
   The simple drawing module's brushes after Concepts: the three quick pens stay as buttons, the alpha brushes live in a
   library opened from one chip (the last alpha brush used). The library shows each brush as a real stroke, the four
   settings that matter (size, opacity, smoothing, paper grain) and a small pad to try the brush before drawing.
   Shared by the board and the notes. */
const BrushLib = (() => {
  const lastAlpha = () => { const k = S.prefs.lastAlpha; return ALPHA_PENS.includes(k) ? k : ALPHA_PENS[0]; };
  const pref = k => { if (!S.prefs.pens[k]) S.prefs.pens[k] = {}; return S.prefs.pens[k]; };
  const onDark = () => isDarkTheme();
  /* the chip of the drawing bar: the last alpha brush as a small stroke, pressed while one of them is the tool */
  function chip(cur) {
    const k = ALPHA_PENS.includes(cur) ? cur : lastAlpha(), pr = penPref(k), on = ALPHA_PENS.includes(cur);
    return `<button class="qb bl-chip" data-blib="1" aria-pressed="${on}" title="Pinceaux : ${esc(PENS[k].name)} (clic : choisir, réglages et essai)">${brushPreview(k, Object.assign({}, pr, { s: Math.min(pr.s, 9), o: Math.max(.8, pr.o) }), 70, 22, onDark())}<span>${esc(PENS[k].name)}</span><svg class="qchev" viewBox="0 0 8 8"><path d="M1.5 3 4 5.5 6.5 3"/></svg></button>`;
  }
  const card = (k, cur) => { const pr = penPref(k); return `<button class="bl-card" data-bk="${k}" aria-pressed="${k === cur}" title="${esc(PENS[k].hint || PENS[k].name)}">${brushPreview(k, Object.assign({}, pr, { s: Math.min(pr.s, 13), o: Math.max(.75, pr.o) }), 132, 40, onDark())}<span>${esc(PENS[k].name)}</span></button>`; };
  const slider = (id, label, v, txt) => `<label class="bl-sl"><span>${label}</span><input type="range" class="prange" min="0" max="1" step=".01" value="${(+v).toFixed(3)}" data-bs="${id}" aria-label="${label}"><b>${txt}</b></label>`;
  const pct = v => Math.round(v * 100) + ' %';
  function settings(k) {
    const pr = penPref(k), d = PENS[k], tex = pr.tx && pr.tx !== 'none';
    return `<div class="bl-set">
      <div class="bl-hint">${esc(d.hint || '')}</div>
      ${slider('s', 'Taille', sizeT(k, pr.s), sizeText(pr.s))}
      ${slider('o', 'Opacité', pr.o, pct(pr.o))}
      ${slider('sm', 'Lissage', pr.sm, pct(pr.sm))}
      ${tex ? slider('td', 'Grain', pr.fx.td ?? 1, pct(pr.fx.td ?? 1)) : ''}
    </div>`;
  }
  function html(cur) {
    const k = ALPHA_PENS.includes(cur) ? cur : lastAlpha();
    return `<div class="bl">
      <div class="bl-h"><b>Pinceaux</b><small>${esc(PENS[k].name)}</small><button class="bl-x" data-breset="1" title="Remettre ce pinceau par défaut">Réinitialiser</button></div>
      <div class="bl-grid">${ALPHA_PENS.map(x => card(x, cur)).join('')}</div>
      <div class="bl-set-w">${settings(k)}</div>
      <div class="bl-pad"><canvas class="bl-base"></canvas><canvas class="bl-live"></canvas><span class="bl-try">Essayez ici</span><button class="bl-clr" data-bclr="1" title="Effacer l’essai">Effacer</button></div>
    </div>`;
  }
  /* o = { pen() current pen, setPen(k), changed(final) } */
  function open(anchor, o) {
    const pop = openPop(anchor, html(o.pen()), { cls: 'blpop', focus: false });
    const cur = () => { const p = o.pen(); return ALPHA_PENS.includes(p) ? p : lastAlpha(); };
    const redrawCards = () => { const g = $('.bl-grid', pop); if (g) g.innerHTML = ALPHA_PENS.map(x => card(x, o.pen())).join(''); const h = $('.bl-h small', pop); if (h) h.textContent = PENS[cur()].name; };
    const redrawSet = () => { const w = $('.bl-set-w', pop); if (w) w.innerHTML = settings(cur()); };
    pop.addEventListener('click', e => {
      const c = e.target.closest('[data-bk]'); if (c) { S.prefs.lastAlpha = c.dataset.bk; save(); o.setPen(c.dataset.bk); redrawCards(); redrawSet(); return; }
      if (e.target.closest('[data-breset]')) { const k = cur(), col = penPref(k).c; S.prefs.pens[k] = { c: col }; save(); redrawCards(); redrawSet(); o.changed(true); toast(PENS[k].name + ' réinitialisé'); return; }
      if (e.target.closest('[data-bclr]')) { pad.clear(); return; }
    });
    pop.addEventListener('input', e => {
      const r = e.target.closest('[data-bs]'); if (!r) return; const k = cur(), p = pref(k), v = +r.value, b = $('b', r.parentElement);
      if (r.dataset.bs === 's') { p.s = sizeOf(k, v); b.textContent = sizeText(p.s); }
      else if (r.dataset.bs === 'o') { p.o = Math.max(.05, v); b.textContent = pct(p.o); }
      else if (r.dataset.bs === 'sm') { p.sm = v; b.textContent = pct(v); }
      else if (r.dataset.bs === 'td') { p.fx = Object.assign({}, p.fx, { td: v }); b.textContent = pct(v); }
      o.changed(false);
    });
    pop.addEventListener('change', e => { if (!e.target.closest('[data-bs]')) return; save(); redrawCards(); o.changed(true); });
    const pad = tryPad($('.bl-pad', pop), cur);
    return pop;
  }
  /* the try-out pad: draws with the real engine, nothing is saved */
  function tryPad(el, penOf) {
    const base = $('.bl-base', el), live = $('.bl-live', el), dpr = Math.min(2.5, devicePixelRatio || 1);
    const fit = () => { const w = el.clientWidth, h = el.clientHeight; base.width = Math.round(w * dpr); base.height = Math.round(h * dpr); base.style.width = w + 'px'; base.style.height = h + 'px'; };
    fit();
    const cap = new InkCapture(live, { toLocal: (x, y) => { const r = el.getBoundingClientRect(); return { x: x - r.left, y: y - r.top }; }, xf: () => ({ k: 1, ox: 0, oy: 0 }) });
    let id = null;
    el.addEventListener('pointerdown', e => {
      if (e.target.closest('button') || e.button > 0) return;
      e.preventDefault(); id = e.pointerId; try { el.setPointerCapture(id); } catch (x) {}
      el.classList.add('used');
      const k = penOf(), pr = penPref(k);
      cap.begin(e, { t: k, c: pr.c, s: pr.s, o: pr.o, smooth: pr.sm, k: 1, b: strokeBrush(k, pr, 1) });
    });
    el.addEventListener('pointermove', e => { if (e.pointerId === id) cap.feed(e); });
    const up = e => {
      if (e.pointerId !== id) return; id = null; const st = cap.end(); if (!st || st.p.length < 3) return;
      if (st.p.length === 3) st.p.push(st.p[0] + .4, st.p[1] + .2, st.p[2]);
      const x = base.getContext('2d'), def = PENS[st.t] || PENS.pen; x.save(); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.globalAlpha = st.o ?? def.o;
      if (def.multiply) x.globalCompositeOperation = isDarkTheme() ? 'screen' : 'multiply';
      if (st.b) { const v = stampPicture(st); x.drawImage(v.cv, v.x0, v.y0, v.W, v.H); } else { x.fillStyle = inkColor(st.c); try { x.fill(new Path2D(inkOutline(st.p, st))); } catch (er) {} }
      x.restore();
    };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    return { clear() { base.getContext('2d').clearRect(0, 0, base.width, base.height); el.classList.remove('used'); } };
  }
  return { chip, open, lastAlpha };
})();
