/* ================= thumbnails =================
   Small SVG pictures of a note or a board for the cards. Cached per document and version. */
const Thumbs = (() => {
  const cache = new Map();
  const f = v => Math.round(v * 10) / 10;
  function board(d) {
    const its = (d.items || []).filter(i => i.k !== 'conn');
    const by = new Map((d.items || []).map(i => [i.id, i]));
    const bb = unionBox(its);
    if (!bb) return `<svg class="thumb" viewBox="0 0 240 180"><rect width="240" height="180" style="fill:var(--raise)"/><g style="fill:var(--dot)">${Array.from({ length: 48 }, (_, i) => `<circle cx="${15 + (i % 8) * 30}" cy="${15 + Math.floor(i / 8) * 30}" r="1.3"/>`).join('')}</g></svg>`;
    let w = bb[2] - bb[0], h = bb[3] - bb[1];
    const pad = Math.max(w, h) * .07 + 20; let x0 = bb[0] - pad, y0 = bb[1] - pad; w += pad * 2; h += pad * 2;
    if (w / h > 4 / 3) { const nh = w * 3 / 4; y0 -= (nh - h) / 2; h = nh; } else { const nw = h * 4 / 3; x0 -= (nw - w) / 2; w = nw; }
    const out = [`<rect x="${f(x0)}" y="${f(y0)}" width="${f(w)}" height="${f(h)}" style="fill:var(--raise)"/>`];
    const ns = 'vector-effect="non-scaling-stroke"';
    for (const c of d.items || []) {
      if (c.k !== 'conn') continue;
      const p = e => e.id && by.get(e.id) ? [by.get(e.id).x + by.get(e.id).w / 2, by.get(e.id).y + by.get(e.id).h / 2] : [e.x || 0, e.y || 0];
      const a = p(c.a), b = p(c.b); out.push(`<path d="M${f(a[0])} ${f(a[1])}L${f(b[0])} ${f(b[1])}" style="stroke:var(--ink-3);fill:none" stroke-width="1" ${ns}/>`);
    }
    for (const m of its) if (m.k === 'mind' && m.parent && by.get(m.parent)) { const p = by.get(m.parent), sx = m.side > 0 ? p.x + p.w : p.x, ex = m.side > 0 ? m.x : m.x + m.w, sy = p.y + p.h / 2, ey = m.y + m.h / 2, mx = (sx + ex) / 2;
      out.push(`<path d="M${f(sx)} ${f(sy)}C${f(mx)} ${f(sy)} ${f(mx)} ${f(ey)} ${f(ex)} ${f(ey)}" stroke="${m.c}" stroke-width="1.4" fill="none" ${ns}/>`); }
    for (const it of its) {
      const X = f(it.x), Y = f(it.y), W = f(it.w), H = f(it.h);
      switch (it.k) {
        case 'frame': out.push(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="${f(Math.min(24, it.w / 20))}" style="fill:var(--card);stroke:var(--line-2)" stroke-width="1" ${ns}/>`); break;
        case 'note': { out.push(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="3" fill="${it.c}"/>`);
          const n = Math.min(4, String(it.txt || '').split('\n').filter(Boolean).length); for (let i = 0; i < n; i++) out.push(`<rect x="${f(it.x + it.w * .12)}" y="${f(it.y + it.h * (.2 + i * .17))}" width="${f(it.w * (i ? .6 : .7))}" height="${f(it.h * .06)}" rx="${f(it.h * .03)}" fill="#3B3424" fill-opacity=".35"/>`); break; }
        case 'text': { const tw = Math.min(Math.max(it.w, 20), String(it.txt || '').length * it.fs * .45 + 10), th = it.fs * .55;
          out.push(`<rect x="${X}" y="${f(it.y + (it.h - th) / 2)}" width="${f(tw)}" height="${f(th)}" rx="${f(th / 3)}" style="fill:var(--ink-2)" fill-opacity=".55"/>`); break; }
        case 'shape': { const P = shapePoly(it.sh, it.w, it.h, 24).map(p => [p[0] + it.x, p[1] + it.y]); out.push(`<path d="${polyD(P)}" style="${it.fc ? `fill:${it.fc}` : 'fill:none'};stroke:${inkColor(it.sc)}" stroke-width="1.3" ${ns}/>`); break; }
        case 'image': { const u = Assets.url(it.asset);
          out.push(u ? `<image href="${u}" x="${X}" y="${Y}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="4" style="fill:var(--sunk);stroke:var(--line-2)" stroke-dasharray="4 3" stroke-width="1" ${ns}/>`); break; }
        case 'todo': { out.push(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="10" fill="${it.c || '#fff'}" style="stroke:var(--ink-2)" stroke-width="1.2" ${ns}/>`, `<rect x="${f(it.x + 16)}" y="${f(it.y + 16)}" width="${f(it.w * .5)}" height="${f(it.fs * .7)}" rx="4" style="fill:var(--ink)" fill-opacity=".7"/>`);
          it.tasks.slice(0, 6).forEach((id, i) => { const t = taskById(id), y = it.y + 16 + it.fs * 1.3 + i * it.fs * 1.25; out.push(`<rect x="${f(it.x + 16)}" y="${f(y)}" width="${f(it.fs * .7)}" height="${f(it.fs * .7)}" rx="3" style="${t && t.done ? 'fill:var(--accent)' : 'fill:none;stroke:var(--ink-3)'}" stroke-width="1.5" ${ns}/>`, `<rect x="${f(it.x + 16 + it.fs)}" y="${f(y + it.fs * .15)}" width="${f(Math.min(it.w - 40 - it.fs, ((t || {}).t || '').length * it.fs * .4 + 10))}" height="${f(it.fs * .4)}" rx="3" style="fill:var(--ink-2)" fill-opacity="${t && t.done ? .3 : .55}"/>`); });
          break; }
        case 'mind': { const root = !it.parent; out.push(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="${f(it.h / 2)}" style="${root ? 'fill:var(--ink)' : `fill:var(--card);stroke:${it.c}`}" stroke-width="1.2" ${ns}/>`); break; }
        case 'ink': { const sx = it.w / (it.w0 || it.w), sy = it.h / (it.h0 || it.h); out.push(`<g transform="translate(${X} ${Y}) scale(${f(sx * 1000) / 1000} ${f(sy * 1000) / 1000})">${inkSVG(it)}</g>`); break; }
        default: out.push(`<rect x="${X}" y="${Y}" width="${W}" height="${H}" rx="6" style="fill:var(--card);stroke:var(--line-2)" stroke-width="1" ${ns}/>`);
      }
    }
    return `<svg class="thumb" viewBox="${f(x0)} ${f(y0)} ${f(w)} ${f(h)}" preserveAspectRatio="xMidYMid slice">${out.join('')}</svg>`;
  }
  function note(d) {
    const out = [`<rect width="820" height="615" style="fill:var(--card)"/>`];
    if (d.paper === 'lines') for (let y = 182; y < 615; y += 32) out.push(`<rect x="0" y="${y}" width="820" height="1.5" style="fill:var(--info)" fill-opacity=".18"/>`);
    out.push(`<text x="70" y="190" style="fill:var(--ink);font:700 60px var(--font-hand)">${esc(String(d.title || '').slice(0, 26))}</text>`);
    const tmp = document.createElement('div'); tmp.innerHTML = d.html || '';
    let y = 232; const bar = (x, w, h, st = 'fill:var(--ink-3)', o = .45) => out.push(`<rect x="${x}" y="${f(y)}" width="${f(w)}" height="${h}" rx="${h / 2}" style="${st}" fill-opacity="${o}"/>`);
    const walk = n => {
      for (const el of n.children) {
        if (y > 640) return;
        const t = (el.textContent || '').trim(), T = el.tagName;
        if (T === 'FIGURE' || T === 'IMG') { const im = T === 'IMG' ? el : el.querySelector('img'), u = im && Assets.url(im.dataset.asset);
          out.push(u ? `<image href="${u}" x="70" y="${y}" width="320" height="210" preserveAspectRatio="xMidYMid slice"/>` : `<rect x="70" y="${y}" width="320" height="210" rx="10" style="fill:var(--sunk)"/>`); y += 230; continue; }
        if (T === 'UL' || T === 'OL') { for (const li of el.children) { if (y > 640) return; const chk = el.classList.contains('chk'); out.push(chk ? `<rect x="74" y="${y - 4}" width="18" height="18" rx="4" style="fill:none;stroke:var(--ink-3)" stroke-width="2"/>` : `<circle cx="82" cy="${y + 5}" r="4" style="fill:var(--ink-3)"/>`); const L = Math.min(560, (li.textContent || '').length * 9 + 30); const hand = li.closest('.hand-p') || el.classList.contains('hand-p'); bar(104, L, hand ? 14 : 10); y += 34; } y += 6; continue; }
        if (T === 'BLOCKQUOTE') { out.push(`<g transform="rotate(-1.2 ${200} ${y + 50})"><rect x="70" y="${y}" width="300" height="100" rx="3" fill="#FFF2B8"/><rect x="92" y="${y + 30}" width="220" height="12" rx="6" fill="#3B3424" fill-opacity=".3"/><rect x="92" y="${y + 58}" width="160" height="12" rx="6" fill="#3B3424" fill-opacity=".3"/></g>`); y += 124; continue; }
        if (!t) { y += 14; continue; }
        if (T === 'H1') { bar(70, Math.min(600, t.length * 17 + 20), 24, 'fill:var(--ink)', .8); y += 50; continue; }
        if (T === 'H2') { bar(70, Math.min(560, t.length * 14 + 20), 18, 'fill:var(--ink)', .7); y += 42; continue; }
        if (T === 'H3') { bar(70, Math.min(520, t.length * 10 + 20), 13, 'fill:var(--ink-2)', .7); y += 34; continue; }
        const lines = Math.min(6, Math.ceil(t.length / 78)); const hand = el.classList.contains('hand-p');
        for (let i = 0; i < lines; i++) { bar(70, i === lines - 1 ? Math.max(60, (t.length % 78 || 78) * 8.4) : 660, hand ? 14 : 10); y += hand ? 34 : 26; }
        y += 10;
      }
    };
    walk(tmp);
    for (const st of d.ink || []) out.push(inkSVG(st));
    return `<svg class="thumb" viewBox="0 0 820 615" preserveAspectRatio="xMidYMin slice">${out.join('')}</svg>`;
  }
  return {
    svg(d) {
      const key = d.id + '|' + d.updated + '|' + (document.documentElement.dataset.resolved || '') + '|' + Assets.blobs.size;
      const c = cache.get(d.id); if (c && c.key === key) return c.svg;
      let svg = ''; try { svg = d.type === 'board' ? board(d) : note(d); } catch (e) { console.warn('[thumb]', e); svg = '<svg class="thumb" viewBox="0 0 240 180"></svg>'; }
      cache.set(d.id, { key, svg }); return svg;
    }
  };
})();
