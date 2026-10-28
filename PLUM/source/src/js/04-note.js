/* ================= note editor =================
   A sheet of paper: rich text (contenteditable) under a layer of ink.
   Ink is stored in sheet units (the sheet is 820 wide) so it scales with the page on a phone.
   The live stroke is drawn on a canvas the size of the visible area, not of the whole sheet.
   A note can hold several pages (D.pages, after the first one which stays D.html / D.ink): each page is its own sheet
   with its own text and ink. Themes that ask for it (noteSpread) open them two by two on a wide screen, each page at
   its full 820 width scaled down with CSS zoom, so the ink stays where it was drawn. */
const Note = (() => {
  const SW = 820;
  /* the pens shown in the toolbar; the others are one click away in the brush panel */
  const NOTE_PENS = ['natural', 'pencil', 'pen', 'fine', 'brush', 'marker', 'water', 'highlight'];
  let D = null, wrap, tool, sheet, body, inkSvg, pad, liveBox, liveCv, ink, titleIn, sub, ro = null, view = null;
  /* the page views; sheet, body, inkSvg, pad and P (the page's data) follow the page being written or drawn on */
  let PG = [], cur = null, P = null, spr = 0, spreadOn = false, fillH = 0;
  let mode = 'text', pen = 'pen', hist = [], fut = [], mounted = false, penSeen = false, drawing = null, erasing = null;
  /* drawings in the text: strokes of the current drawing session, the pause timer of a stylus in text mode, the picked drawing, a move or resize */
  let fresh = new WeakSet(), autoFin = 0, ndSel = null, ndOp = null;

  const scale = () => sheet.getBoundingClientRect().width / SW;
  // the layout scale, without the zoom of the double page
  const kl = el => (el.offsetWidth || SW) / SW;
  const pageData = i => i ? D.pages[i - 1] : D;
  function toLocal(cx, cy) { const r = sheet.getBoundingClientRect(), s = SW / r.width; return { x: (cx - r.left) * s, y: (cy - r.top) * s }; }
  function xf() { const r = sheet.getBoundingClientRect(), b = liveBox.getBoundingClientRect(); return { k: r.width / SW, ox: r.left - b.left, oy: r.top - b.top }; }
  function placeLive() { const v = $('#view'); liveBox.style.top = v.offsetTop + 'px'; ink.resize(); }

  /* ---------- text ---------- */
  function hydrateInto(body, html, data) {
    body.innerHTML = html || '';
    for (const im of $$('img[data-asset]', body)) { const u = Assets.url(im.dataset.asset); if (u) im.src = u; else im.closest('figure') ? im.closest('figure').classList.add('missing') : im.remove(); }
    for (const f of $$('figure.ndraw', body)) drawFig(f, data);
  }
  function serialize() {
    const c = body.cloneNode(true);
    for (const im of $$('img[data-asset]', c)) im.removeAttribute('src');
    for (const f of $$('figure.ndraw', c)) { f.innerHTML = ''; f.classList.remove('sel', 'dragging'); f.style.transform = ''; }
    return c.innerHTML.replace(/<br>(<\/(p|div|li|h1|h2|h3)>)/g, '$1');
  }
  const saveBody = debounce(() => { if (!mounted) return; P.html = serialize(); touch(D); renderSub(); }, 400);
  function renderSub() {
    const sp = spaceById(D.sp), words = PG.reduce((n, g) => n + (g.body.innerText.match(/[\p{L}\p{N}]+/gu) || []).length, 0), strokes = PG.reduce((n, g) => n + (g.data.ink || []).length, 0), np = PG.length;
    const draws = PG.reduce((n, g) => n + $$('figure.ndraw', g.body).length, 0);
    sub.innerHTML = `${sp ? `<span class="chip"><span class="sdot" style="background:${sp.color}"></span>${esc(sp.name)}</span>` : ''}<span>Modifiée ${ago(D.updated)}</span><span>${words} mot${words > 1 ? 's' : ''}</span>${draws ? `<span>${draws} dessin${draws > 1 ? 's' : ''}</span>` : ''}${strokes ? `<span>${strokes} trait${strokes > 1 ? 's' : ''}</span>` : ''}${np > 1 ? `<span>${np} pages</span>` : ''}`;
  }
  const blockOf = n => { while (n && n !== body) { if (n.nodeType === 1 && /^(P|DIV|H1|H2|H3|LI|BLOCKQUOTE|FIGURE)$/.test(n.tagName)) return n; n = n.parentNode; } return null; };
  const selInBody = () => { const s = getSelection(); return s.rangeCount && body.contains(s.anchorNode) ? s : null; };
  function ensureFocus() { if (!selInBody()) { body.focus(); const r = document.createRange(); r.selectNodeContents(body); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); } }
  function cmd(c) {
    ensureFocus();
    const s = selInBody(), blk = s && blockOf(s.anchorNode);
    switch (c) {
      case 'h1': case 'h2': case 'h3': document.execCommand('formatBlock', false, blk && blk.tagName === c.toUpperCase() ? 'p' : c); break;
      case 'p': document.execCommand('formatBlock', false, 'p'); break;
      case 'bold': case 'italic': case 'underline': case 'strikeThrough': document.execCommand(c); break;
      case 'ul': { const ul = s && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest('ul'); if (ul && ul.classList.contains('chk')) { ul.classList.remove('chk'); break; } document.execCommand('insertUnorderedList'); break; }
      case 'chk': {
        const el = s && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode), ul = el && el.closest('ul');
        if (ul && body.contains(ul)) { ul.classList.toggle('chk'); break; }
        document.execCommand('insertUnorderedList');
        const s2 = selInBody(), el2 = s2 && (s2.anchorNode.nodeType === 1 ? s2.anchorNode : s2.anchorNode.parentNode), ul2 = el2 && el2.closest('ul'); if (ul2) ul2.classList.add('chk'); break;
      }
      case 'quote': document.execCommand('formatBlock', false, blk && blk.tagName === 'BLOCKQUOTE' ? 'p' : 'blockquote'); break;
      case 'hand': { const b = blockOf(selInBody() && selInBody().anchorNode); if (b) b.classList.toggle('hand-p'); break; }
      case 'mark': {
        if (!s || s.isCollapsed) { toast('Sélectionnez le texte à surligner'); return; }
        const el = (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode).closest('mark');
        if (el) { el.replaceWith(...el.childNodes); break; }
        const r = s.getRangeAt(0), m = document.createElement('mark'); m.append(r.extractContents()); r.insertNode(m); s.removeAllRanges(); const r2 = document.createRange(); r2.selectNodeContents(m); s.addRange(r2); break;
      }
      case 'image': pickImages(); return;
    }
    saveBody(); renderTool();
  }
  /* font, size and colour of the selected text (or of what is typed next): <font face|size|color>, styled in style.css */
  const TFONTS = [['pf-ui', 'Par défaut', 'var(--font-ui)'], ['pf-serif', 'Serif', '"Instrument Serif", "Iowan Old Style", Georgia, serif'], ['pf-mono', 'Mono', 'var(--font-mono)'], ['pf-hand', 'Manuscrite', 'var(--font-hand)']];
  const TSIZES = [['2', 'Petit', 13], ['3', 'Normal', 15], ['4', 'Grand', 18], ['5', 'Très grand', 22], ['6', 'Titre', 27]];
  const NOCOLOR = '#010203';
  /* 0.2.17: the colour of the selection in one gesture (the last colour used), list bullets follow the text colour */
  function colorSel(c) {
    if (!selInBody()) ensureFocus();
    try { document.execCommand('styleWithCSS', false, false); } catch (e) {}
    document.execCommand('foreColor', false, c || NOCOLOR);
    if (!c) for (const el of $$('font[color]', body)) if (el.getAttribute('color').toLowerCase() === NOCOLOR) { el.removeAttribute('color'); if (!el.attributes.length) el.replaceWith(...el.childNodes); }
    afterColor(c); saveBody(); renderTool();
  }
  function afterColor(c) { if (c) { S.prefs.noteColor = c; save(); renderToolbar(); } if (bub) bub.innerHTML = ''; syncMarkers(); }
  const lastColor = () => S.prefs.noteColor || schemeHex(6) || '#E5484D';
  /* a bullet (or a check box) takes the colour its text starts with; an empty item the colour of the one above */
  function syncMarkers(root = body) {
    if (!root) return;
    for (const li of $$('li', root)) {
      const f = [...li.querySelectorAll('font[color]')].find(x => x.textContent.trim()), txt = li.textContent.trim();
      let c = f && li.textContent.trim().startsWith(f.textContent.trim()) ? f.getAttribute('color') : '';
      if (!txt) { const prev = li.previousElementSibling; c = (prev && prev.style.color) || ''; const ff = li.querySelector('font[color]'); if (ff) c = ff.getAttribute('color'); }
      if (c) li.style.color = c; else li.style.removeProperty('color');
      if (!li.getAttribute('style')) li.removeAttribute('style');
    }
  }
  function textPop(btn) {
    const s0 = selInBody(), range = s0 && s0.rangeCount ? s0.getRangeAt(0).cloneRange() : null, k = btn.dataset.tx;
    const apply = f => { body.focus(); const sel = getSelection(); if (range) { sel.removeAllRanges(); sel.addRange(range); } else ensureFocus(); try { document.execCommand('styleWithCSS', false, false); } catch (e) {} f(); saveBody(); renderTool(); };
    const color = c => apply(() => {
      document.execCommand('foreColor', false, c || NOCOLOR);
      if (!c) for (const el of $$('font[color]', body)) if (el.getAttribute('color').toLowerCase() === NOCOLOR) { el.removeAttribute('color'); if (!el.attributes.length) el.replaceWith(...el.childNodes); }
      afterColor(c);
    });
    /* 0.2.16: the theme's 20 colours (n°1, the ink, is the default text colour), free colours kept on the « Récentes » line */
    if (k === 'color') { Colors.open(btn, { value: S.prefs.noteColor, none: true, onPick: (c, final) => { if (final) color(c && schemeNo(c) === 1 ? null : c); } }); return; }
    const html = k === 'font' ? TFONTS.map(([v, l, ff]) => `<button class="mi" data-v="${v}"><span style="font-family:${ff};font-size:16px">${l}</span></button>`).join('')
      : k === 'size' ? TSIZES.map(([v, l, px]) => `<button class="mi" data-v="${v}"><span style="font-size:${px}px">${l}</span></button>`).join('')
      : '';
    const pop = openPop(btn, html, { cls: 'tpop', focus: false });
    pop.addEventListener('pointerdown', e => e.preventDefault());
    pop.addEventListener('click', e => {
      const b = e.target.closest('[data-v]'); if (!b) return; const v = b.dataset.v; closePop();
      if (k === 'font') apply(() => document.execCommand('fontName', false, v));
      else if (k === 'size') apply(() => document.execCommand('fontSize', false, v));
      else color(v);
    });
  }
  /* the selection bar: a small toolbar over the selected text, gone as soon as the selection is (like Notion or Miro) */
  let bub = null, bubDown = false, bubRaf = 0;
  const BUB = [['bold', 'B', 'Gras (Ctrl B)'], ['italic', '<i>I</i>', 'Italique (Ctrl I)'], ['underline', '<u>U</u>', 'Souligné (Ctrl U)'], ['strikeThrough', '<s>S</s>', 'Barré'], '|', 'color', '|', ['h2', 'T2', 'Titre'], ['mark', '#hl', 'Surligner'], '|', ['ul', '#list', 'Liste'], ['chk', '#chk', 'Cases à cocher']];
  function bubHTML() {
    return BUB.map(x => x === '|' ? '<span class="vs"></span>' : x === 'color' ? `<button class="nb bc" data-tx="color" title="Couleur du texte" aria-label="Couleur du texte"><i style="--c:${lastColor()}"></i></button>`
      : `<button class="nb" data-bc="${x[0]}" title="${x[2]}" aria-label="${x[2].replace(/ \(.*/, '')}">${x[1][0] === '#' ? icon(x[1].slice(1)) : `<span class="bt">${x[1]}</span>`}</button>`).join('');
  }
  function bubMount() {
    bub = document.createElement('div'); bub.className = 'nbub'; bub.setAttribute('role', 'toolbar'); bub.setAttribute('aria-label', 'Mise en forme de la sélection'); bub.hidden = true;
    $('#main').append(bub);
    bub.addEventListener('pointerdown', e => e.preventDefault());
    bub.addEventListener('click', e => {
      const b = e.target.closest('[data-bc]'); if (b) { cmd(b.dataset.bc); bubPlace(); return; }
      const t = e.target.closest('[data-tx]'); if (t) textPop(t);
    });
    document.addEventListener('selectionchange', bubQueue);
    addEventListener('pointerdown', bubPress, true); addEventListener('pointerup', bubRelease, true);
  }
  function bubUnmount() {
    document.removeEventListener('selectionchange', bubQueue);
    removeEventListener('pointerdown', bubPress, true); removeEventListener('pointerup', bubRelease, true);
    if (bub) bub.remove(); bub = null;
  }
  // while the mouse is selecting, the bar waits for the release
  function bubPress(e) { if (bub && !bub.contains(e.target) && !(e.target.closest && e.target.closest('.pop'))) { bubDown = true; bub.hidden = true; } }
  function bubRelease() { if (bubDown) { bubDown = false; bubQueue(); } }
  function bubQueue() { cancelAnimationFrame(bubRaf); bubRaf = requestAnimationFrame(bubPlace); }
  function bubPlace() {
    if (!bub || !mounted) return;
    const s = getSelection(), g = s.rangeCount && !s.isCollapsed && PG.find(g => g.body.contains(s.anchorNode) && g.body.contains(s.focusNode));
    if (!g || mode !== 'text' || bubDown || !s.toString().trim()) { if (!(popEl && popEl.classList.contains('cppop'))) bub.hidden = true; return; }
    if (g !== cur) use(g);
    const r = s.getRangeAt(0).getBoundingClientRect(), m = $('#main').getBoundingClientRect();
    if (!r.width && !r.height) { bub.hidden = true; return; }
    if (bub.hidden || !bub.childElementCount) bub.innerHTML = bubHTML();
    bub.hidden = false;
    for (const b of $$('[data-bc]', bub)) { let on = false; try { on = ['bold', 'italic', 'underline', 'strikeThrough'].includes(b.dataset.bc) && document.queryCommandState(b.dataset.bc); } catch (e) {} b.setAttribute('aria-pressed', on); }
    const w = bub.offsetWidth, h = bub.offsetHeight;
    let x = r.left + r.width / 2 - w / 2 - m.left, y = r.top - h - 10 - m.top;
    if (y < 52) y = r.bottom + 10 - m.top;
    bub.style.left = clamp(x, 8, m.width - w - 8) + 'px'; bub.style.top = y + 'px';
  }
  /* the marking menu of the selected text (right button): pressed, flick toward an item and let go; a quick right click
     opens a classic list instead (0.2.22). Up is always the last colour. Same look as the board's (.mmenu). */
  const MM_R = 64, MM_DEAD = 16;
  let mm = null;
  // four arms only (0.2.18): up the last colour, right bold, down italic, left underline
  function mmItems() {
    return [{ dir: 0, label: 'Dernière couleur', sw: lastColor(), run: () => colorSel(lastColor()) }, { dir: 2, label: 'Gras', run: () => cmd('bold') },
      { dir: 4, label: 'Italique', run: () => cmd('italic') }, { dir: 6, label: 'Souligné', run: () => cmd('underline') }];
  }
  function openMM(e) {
    closeMM();
    const el = document.createElement('div'); el.className = 'mmenu nmm'; document.body.append(el);
    el.addEventListener('contextmenu', ev => ev.preventDefault());
    el.addEventListener('pointerdown', ev => { ev.preventDefault(); ev.stopPropagation(); if (!mm || !mm.sticky) return; mmTrack(ev); const p = ev.target.closest('.mmp'); if (p) mm.hover = +p.dataset.dir; if (mm.hover >= 0 && ev.button === 0) mmRun(); else closeMM(); });
    mm = { el, x: clamp(e.clientX, 130, innerWidth - 130), y: clamp(e.clientY, MM_R, innerHeight - MM_R), mx: e.clientX, my: e.clientY, hover: -1, sticky: false, moved: false, items: mmItems() };
    if (bub) bub.hidden = true;
    addEventListener('pointermove', mmMove, true); addEventListener('pointerup', mmUp, true); addEventListener('keydown', mmKey, true); addEventListener('contextmenu', mmCtx, true);
    mmShow();
  }
  function closeMM() {
    if (!mm) return; mm.el.remove(); mm = null;
    removeEventListener('pointermove', mmMove, true); removeEventListener('pointerup', mmUp, true); removeEventListener('keydown', mmKey, true);
    setTimeout(() => removeEventListener('contextmenu', mmCtx, true), 250);
    bubQueue();
  }
  const mmCtx = ev => ev.preventDefault();
  function mmShow() {
    const dx = mm.mx - mm.x, dy = mm.my - mm.y;
    mm.el.classList.toggle('sticky', mm.sticky);
    let h = `<svg class="mmg"><circle cx="${mm.x}" cy="${mm.y}" r="${MM_DEAD}" class="ring"/>${mm.hover >= 0 ? `<line x1="${mm.x}" y1="${mm.y}" x2="${mm.x + dx}" y2="${mm.y + dy}"/>` : ''}<circle cx="${mm.x}" cy="${mm.y}" r="5" class="dot"/></svg>`;
    for (const it of mm.items) {
      const a = it.dir * Math.PI / 4, sx = Math.sin(a), px = mm.x + sx * MM_R, py = mm.y - Math.cos(a) * MM_R * .72;
      const tx = sx > .3 ? 'translate(-8px,-50%)' : sx < -.3 ? 'translate(calc(8px - 100%),-50%)' : 'translate(-50%,-50%)';
      h += `<span class="mmp${it.dir === mm.hover ? ' hot' : ''}" data-dir="${it.dir}" style="left:${px}px;top:${py}px;transform:${tx}">${it.sw ? `<i style="background:${it.sw}"></i>` : ''}${esc(it.label)}</span>`;
    }
    mm.el.innerHTML = h;
  }
  function mmTrack(ev) {
    mm.mx = ev.clientX; mm.my = ev.clientY;
    const dx = mm.mx - mm.x, dy = mm.my - mm.y, far = Math.hypot(dx, dy) > MM_DEAD;
    if (far) mm.moved = true;
    const h = far ? ((Math.round(Math.atan2(dx, -dy) / (Math.PI / 2)) + 4) % 4) * 2 : -1;
    if (h !== mm.hover) { mm.hover = h; mmShow(); } else if (h >= 0 && !mm.sticky) mmShow();   // the line follows the pointer while flicking
  }
  function mmMove(ev) { if (mm) mmTrack(ev); }
  function mmUp(ev) {
    if (!mm || mm.sticky) return;
    mmTrack(ev);
    if (mm.hover >= 0) { ev.preventDefault(); mmRun(); return; }
    if (!mm.moved) { const items = mm.items, x = mm.mx, y = mm.my; closeMM(); mmList(items, x, y); return; }   // a quick right click: a classic menu (0.2.22)
    closeMM();
  }
  function mmKey(ev) { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); closeMM(); } }
  function mmList(items, x, y) {
    const sel = getSelection(), rg = sel.rangeCount ? sel.getRangeAt(0).cloneRange() : null;
    if (bub) bub.hidden = true;
    openPop({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }, items.map(it => ({ label: it.label, dot: it.sw,
      run: () => { body.focus({ preventScroll: true }); if (rg) { sel.removeAllRanges(); sel.addRange(rg); } it.run(); } })), { cls: 'mmlist', focus: false });
  }
  function mmRun() { const it = mm.items.find(i => i.dir === mm.hover); closeMM(); if (it) { body.focus({ preventScroll: true }); it.run(); } }
  /* « # », « ## », « - », « [] », « > » and « 1. » at the start of a line */
  function onKey(e) {
    if (ndSel && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); ndAction(cur, ndSel, 'del'); return; }
    if (ndSel && e.key === 'Escape') { ndPick(null); return; }
    if (ndSel) ndPick(null);
    if (e.key === 'Enter' && !e.shiftKey) {
      const s = selInBody(); if (!s || !s.isCollapsed) return;
      const blk = blockOf(s.anchorNode); if (!blk || blk.tagName !== 'BLOCKQUOTE') return;
      const r = s.getRangeAt(0), post = document.createRange(); post.setStart(r.endContainer, r.endOffset); post.setEnd(blk, blk.childNodes.length);
      if (post.toString().trim()) return;
      e.preventDefault(); const p = document.createElement('p'); p.innerHTML = '<br>'; blk.after(p);
      const r2 = document.createRange(); r2.setStart(p, 0); r2.collapse(true); s.removeAllRanges(); s.addRange(r2); saveBody(); return;
    }
    mdShortcut(e);
  }
  function mdShortcut(e) {
    if (e.key !== ' ') return;
    const s = selInBody(); if (!s || !s.isCollapsed) return;
    const blk = blockOf(s.anchorNode); if (!blk || blk.tagName === 'LI' && blk.closest('ul.chk')) return;
    const r = s.getRangeAt(0), pre = document.createRange(); pre.setStart(blk, 0); pre.setEnd(r.startContainer, r.startOffset);
    const t = pre.toString(); const map = { '#': 'h1', '##': 'h2', '###': 'h3', '-': 'ul', '*': 'ul', '[]': 'chk', '[ ]': 'chk', '>': 'quote', '1.': 'ol' };
    const c = map[t]; if (!c) return;
    e.preventDefault(); pre.deleteContents();
    if (!blk.textContent && !blk.querySelector('br,img')) blk.innerHTML = '<br>';
    const rr = document.createRange(); rr.setStart(blk, 0); rr.collapse(true); s.removeAllRanges(); s.addRange(rr);
    if (c === 'ol') document.execCommand('insertOrderedList'); else cmd(c);
  }
  function renderTool() {
    if (!tool) return;
    const s = selInBody(), el = s && s.anchorNode && (s.anchorNode.nodeType === 1 ? s.anchorNode : s.anchorNode.parentNode), blk = s && blockOf(s.anchorNode);
    const st = { h1: blk && blk.tagName === 'H1', h2: blk && blk.tagName === 'H2', quote: blk && blk.tagName === 'BLOCKQUOTE', hand: blk && blk.classList.contains('hand-p'),
      bold: s && document.queryCommandState('bold'), italic: s && document.queryCommandState('italic'), mark: !!(el && el.closest('mark')),
      chk: !!(el && el.closest('ul.chk')), ul: !!(el && el.closest('ul:not(.chk)')) };
    for (const b of $$('[data-cmd]', tool)) if (b.dataset.cmd in st) b.setAttribute('aria-pressed', !!st[b.dataset.cmd]);
  }
  function sanitize(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html'), OK = /^(P|H1|H2|H3|UL|OL|LI|B|STRONG|I|EM|A|BR|BLOCKQUOTE|MARK|DIV)$/;
    const walk = n => { for (const c of [...n.childNodes]) { if (c.nodeType === 3) continue; if (c.nodeType !== 1 || /^(SCRIPT|STYLE|META|LINK|IFRAME|OBJECT|SVG|NOSCRIPT)$/.test(c.tagName)) { c.remove(); continue; }
      walk(c); if (!OK.test(c.tagName)) { c.replaceWith(...c.childNodes); continue; }
      const href = c.tagName === 'A' ? c.getAttribute('href') : null; for (const a of [...c.attributes]) c.removeAttribute(a.name); if (href && /^https?:/i.test(href)) { c.setAttribute('href', href); c.setAttribute('target', '_blank'); c.setAttribute('rel', 'noopener'); } } };
    walk(doc.body); return doc.body.innerHTML;
  }
  /* markdown light, for the assistant and the seed */
  function mdToHTML(md) {
    const out = []; let list = null;
    const inline = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/(^|[^*])\*([^*]+)\*/g, '$1<i>$2</i>').replace(/==(.+?)==/g, '<mark>$1</mark>');
    const close = () => { if (list) { out.push(`</${list.t}>`); list = null; } };
    for (const raw of String(md || '').split('\n')) {
      const l = raw.trimEnd(); let m;
      if ((m = l.match(/^\s*[-*]\s+\[( |x|X)\]\s+(.*)$/))) { if (!list || list.t !== 'ul' || !list.chk) { close(); out.push('<ul class="chk">'); list = { t: 'ul', chk: true }; } out.push(`<li${m[1] !== ' ' ? ' data-done=""' : ''}>${inline(m[2])}</li>`); continue; }
      if ((m = l.match(/^\s*[-*•]\s+(.*)$/))) { if (!list || list.t !== 'ul' || list.chk) { close(); out.push('<ul>'); list = { t: 'ul' }; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      if ((m = l.match(/^\s*\d+[.)]\s+(.*)$/))) { if (!list || list.t !== 'ol') { close(); out.push('<ol>'); list = { t: 'ol' }; } out.push(`<li>${inline(m[1])}</li>`); continue; }
      close();
      if ((m = l.match(/^(#{1,3})\s+(.*)$/))) out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`);
      else if ((m = l.match(/^>\s?(.*)$/))) out.push(`<blockquote>${inline(m[1])}</blockquote>`);
      else if (l.trim()) out.push(`<p>${inline(l)}</p>`);
    }
    close(); return out.join('');
  }

  /* ---------- images and files ---------- */
  function pickImages() { const i = $('#fileIn'); i.accept = ''; i.onchange = async () => { const f = [...i.files]; i.value = ''; await addFiles(f, null); }; i.click(); }
  async function addFiles(files, at) {
    if (!files.length) return;
    let html = '';
    for (const f of files) {
      if (f.type.startsWith('image/')) { try { const im = await importImage(f, 1800); html += `<figure contenteditable="false"><img data-asset="${im.id}" src="${Assets.url(im.id)}" alt=""></figure><p><br></p>`; } catch (e) { toast(`« ${f.name} » n'a pas pu être lue`); } }
      else { const id = await Assets.put(f); html += `<p><span class="nfile" contenteditable="false" data-asset="${id}">${icon('file', 'sm')}<b>${esc(f.name)}</b><small>${fmtSize(f.size)}</small></span></p>`; }
    }
    if (!html) return;
    insertHTMLAt(html, at);
  }
  /* an element of the space's moodboard, as note content */
  function mediaHTML(m) {
    if (m.type === 'image' && Assets.has(m.asset)) return `<figure contenteditable="false"><img data-asset="${m.asset}" src="${Assets.url(m.asset)}" alt=""></figure><p><br></p>`;
    if (m.type === 'file' && Assets.has(m.asset)) return `<p><span class="nfile" contenteditable="false" data-asset="${m.asset}">${icon('file', 'sm')}<b>${esc(m.name || 'Fichier')}</b><small>${fmtSize(m.size || 0)}</small></span></p>`;
    if (m.type === 'link' && m.url) return linkCard(m.url, m.title);
    if (m.type === 'text' && m.txt) return m.txt.split(/\n{2,}/).map(p => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
    return '';
  }
  /* 0.2.20: a web address dropped in a note becomes a small card: the page's picture, its title and its site.
     The preview is fetched afterwards (Windows app: Open Graph through the main process) and kept in the note. */
  let innerDrag = false;
  const URL_RE = /^https?:\/\/\S+$/i;
  function urlOf(dt) {
    const u = (dt.getData('text/uri-list') || '').split(/\r?\n/).map(x => x.trim()).find(x => x && !x.startsWith('#'));
    if (u && URL_RE.test(u)) return u;
    const t = (dt.getData('text/plain') || '').trim(); return URL_RE.test(t) ? t : '';
  }
  function linkCard(url, title) {
    const id = uid('lk');
    queueMicrotask(() => unfurlCard(id, url));
    return `<figure class="nlink" contenteditable="false" data-url="${esc(url)}" data-lk="${id}"><span class="nl-pic"></span><span class="nl-t"><b>${esc(title || hostOf(url))}</b><small>${esc(title ? hostOf(url) : url.replace(/^https?:\/\/(www\.)?/i, ''))}</small></span></figure><p><br></p>`;
  }
  async function unfurlCard(id, url) {
    const m = await Net.meta(url); if (!m) return;
    let asset = '';
    if (m.image) { const b = await Net.blob(m.image); if (b && /^image\//.test(b.type)) { try { asset = (await importImage(b, 480)).id; } catch (e) {} } }
    else if (m.isImage) { const b = await Net.blob(url); if (b && /^image\//.test(b.type)) { try { asset = (await importImage(b, 480)).id; } catch (e) {} } }
    if (!mounted) return;
    const f = PG.map(g => g.body.querySelector(`figure.nlink[data-lk="${id}"]`)).find(Boolean); if (!f) return;
    const t = m.title && cleanTitle(m.title, isInsta(url)); if (t) f.querySelector('.nl-t b').textContent = t;
    f.querySelector('.nl-t small').textContent = m.site || hostOf(url);
    if (asset) f.querySelector('.nl-pic').innerHTML = `<img data-asset="${asset}" src="${Assets.url(asset)}" alt="">`;
    const g = PG.find(g => g.body.contains(f)); if (g) { const was = cur; use(g); saveBody(); saveBody.flush(); if (was && was !== g) use(was); }
  }
  /* 0.2.20: while dragging something in, a thin line shows where it will land, between the paragraphs */
  let dropSlot = null;
  function slotAt(g, y) {
    const kids = [...g.body.children].filter(c => c.offsetParent !== null), r0 = g.el.getBoundingClientRect(), br = g.body.getBoundingClientRect();
    let ref = null, top;
    for (const c of kids) { const r = c.getBoundingClientRect(); if (y < r.top + r.height / 2) { ref = c; break; } }
    if (ref) { const r = ref.getBoundingClientRect(), prev = ref.previousElementSibling, pb = prev ? prev.getBoundingClientRect().bottom : r.top - 8; top = (Math.max(pb, r.top - 16) + r.top) / 2 - r0.top; }
    else { const last = kids[kids.length - 1]; top = (last ? last.getBoundingClientRect().bottom + 4 : br.top + 8) - r0.top; }
    return { g, ref, top, left: br.left - r0.left, width: br.width };
  }
  function showSlot(sl) {
    dropSlot = sl; let ln = sl.g.el.querySelector(':scope > .ndropline');
    if (!ln) { ln = document.createElement('div'); ln.className = 'ndropline'; sl.g.el.append(ln); }
    ln.style.cssText = `top:${sl.top}px;left:${sl.left}px;width:${sl.width}px`;
    for (const x of $$('.ndropline', wrap)) if (x !== ln) x.remove();
  }
  function clearSlot() { dropSlot = null; if (wrap) for (const x of $$('.ndropline', wrap)) x.remove(); }
  function placeHTML(html, sl) {
    const g = sl.g; use(g);
    const tmp = document.createElement('div'); tmp.innerHTML = html;
    const nodes = [...tmp.childNodes], last = nodes[nodes.length - 1];
    if (sl.ref && sl.ref.parentNode === g.body) sl.ref.before(...nodes); else g.body.append(...nodes);
    if (last && last.nodeType === 1) { g.body.focus({ preventScroll: true }); const r = document.createRange(); r.selectNodeContents(last); r.collapse(false); const s = getSelection(); s.removeAllRanges(); s.addRange(r); }
    syncMarkers(g.body); saveBody(); renderTool();
  }
  function insertHTMLAt(html, at) {
    if (!html) return;
    if (at && at.slot) { placeHTML(html, at.slot); return; }
    body.focus();
    const s = getSelection();
    if (at) { s.removeAllRanges(); s.addRange(at); } else if (!selInBody()) ensureFocus();
    document.execCommand('insertHTML', false, html);
    saveBody();
  }
  function onDrop(e) {
    const nj = e.dataTransfer && e.dataTransfer.getData('application/x-notely');
    const files = [...(e.dataTransfer && e.dataTransfer.files || [])], url = !files.length && !nj && !innerDrag && e.dataTransfer ? urlOf(e.dataTransfer) : '';
    if (!files.length && !nj && !url) return;
    e.preventDefault(); sheet.classList.remove('dropping');
    const sl = dropSlot; clearSlot();
    if (sl) {
      if (nj) { try { const j = JSON.parse(nj); placeHTML((Array.isArray(j) ? j : [j]).map(mediaHTML).join(''), sl); } catch (err) {} return; }
      if (url) { placeHTML(linkCard(url), sl); return; }
      addFiles(files, { slot: sl }); return;
    }
    let r = null; if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY); else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
    if (r && !body.contains(r.startContainer)) r = null;
    if (nj) { try { const j = JSON.parse(nj); insertHTMLAt((Array.isArray(j) ? j : [j]).map(mediaHTML).join(''), r); } catch (err) {} return; }
    if (url) { insertHTMLAt(linkCard(url), r); return; }
    addFiles(files, r);
  }
  function onPaste(e) {
    const cd = e.clipboardData; if (!cd) return;
    const files = [...cd.files]; if (files.length) { e.preventDefault(); addFiles(files, null); return; }
    const h = cd.getData('text/html'); if (h) { e.preventDefault(); document.execCommand('insertHTML', false, sanitize(h)); saveBody(); return; }
  }

  /* ---------- drawings in the text ----------
     When the pen is put down (back to Texte, or a pause after writing with a stylus in text mode), the new strokes of each page
     are grouped by distance and each group becomes a <figure class="ndraw"> in the text, at the height it was drawn: a narrow one
     floats against the left or right side and the text goes round it, a wide one sits between the paragraphs. Typing above pushes it down.
     It can then be picked, moved (it lands in the text where it is dropped) and resized; drawing over it adds to it.
     Its strokes live in the page's draws[id], in the figure's own units; the highlighter stays on the ink layer, over the text. */
  function drawFig(f, data) {
    const d = data && data.draws && data.draws[f.dataset.draw];
    if (!d) { f.remove(); return; }
    f.contentEditable = 'false';
    f.innerHTML = `<svg viewBox="0 0 ${d.w} ${d.h}" aria-hidden="true">${d.st.map(st => inkSVG(st)).join('')}</svg>`;
    if (f === ndSel) ndBar(f);
  }
  // an element's box in sheet units
  function rectIn(g, el) { const s = g.el.getBoundingClientRect(), r = el.getBoundingClientRect(), u = SW / s.width; return { x: (r.left - s.left) * u, y: (r.top - s.top) * u, w: r.width * u, h: r.height * u }; }
  const xfStroke = (st, dx, dy, k) => { const p = st.p.slice(); for (let i = 0; i < p.length; i += 3) { p[i] = +(p[i] * k + dx).toFixed(1); p[i + 1] = +(p[i + 1] * k + dy).toFixed(1); } return Object.assign({}, st, { p, s: +(st.s * k).toFixed(2) }); };
  const floatOf = f => f.classList.contains('f-l') ? 'l' : f.classList.contains('f-r') ? 'r' : 'c';
  const snap = p => ({ p, ink: p.ink || [], html: p.html, draws: JSON.parse(JSON.stringify(p.draws || {})) });
  function pushSnap(p) { hist.push(snap(p)); if (hist.length > 80) hist.shift(); fut = []; }
  // text typed straight into the page (no paragraph yet) goes into one, so a drawing can sit between blocks
  function wrapLoose(b) {
    let run = [];
    const close = () => { if (run.some(n => n.nodeType === 1 || n.data.trim())) { const p = document.createElement('p'); run[0].before(p); p.append(...run); } run = []; };
    for (const n of [...b.childNodes]) { if (n.nodeType === 3 || (n.nodeType === 1 && !/^(P|DIV|H1|H2|H3|UL|OL|BLOCKQUOTE|FIGURE)$/.test(n.tagName))) run.push(n); else close(); }
    close();
  }
  /* put a figure in the text: before the first block that starts below y, floating by where it is, at the height asked */
  function placeFig(g, f, x, y, w, fl) {
    if (f.parentNode) f.remove();
    const br = rectIn(g, g.body), bw = br.w; w = Math.min(w, bw);
    if (!fl) fl = w > bw * .62 ? 'c' : x + w / 2 < br.x + bw / 2 ? 'l' : 'r';
    const pc = v => +(v / bw * 100).toFixed(2) + '%';
    f.classList.remove('f-l', 'f-r', 'f-c'); f.classList.add('f-' + fl);
    f.style.width = pc(w); f.style.marginTop = '';
    // a floating drawing sits against its side, one alone on its line keeps where it was drawn
    f.style.marginLeft = fl === 'c' ? pc(clamp(x - br.x, 0, bw - w)) : '';
    f.style.marginRight = '';
    const at = [...g.body.children].find(c => { const r = rectIn(g, c); return r.y + Math.min(r.h, 40) / 2 > y; });
    if (at) g.body.insertBefore(f, at); else g.body.append(f);
    if (!f.nextElementSibling) { const p = document.createElement('p'); p.innerHTML = '<br>'; f.after(p); }
    const top = rectIn(g, f).y; if (y - top > 12) f.style.marginTop = pc(y - top);
  }
  function finalizeDrawing() {
    clearTimeout(autoFin); autoFin = 0;
    if (!mounted) return;
    let any = false;
    for (const g of PG) {
      const all = g.data.ink || [], nw = all.filter(st => fresh.has(st) && st.t !== 'highlight');
      if (!nw.length) continue;
      any = true; use(g); saveBody.flush(); P.html = serialize(); pushSnap(P);
      if (!P.draws) P.draws = {};
      wrapLoose(body);
      const near = (a, b, m) => a[0] - m < b[2] && b[0] - m < a[2] && a[1] - m < b[3] && b[1] - m < a[3];
      const join = (a, b) => ({ b: [Math.min(a.b[0], b.b[0]), Math.min(a.b[1], b.b[1]), Math.max(a.b[2], b.b[2]), Math.max(a.b[3], b.b[3])], st: a.st.concat(b.st), figs: a.figs.concat(b.figs) });
      let groups = nw.map(st => ({ b: inkBounds(st.p, st.s), st: [st], figs: [] }));
      const merge = () => { for (let i = 0; i < groups.length; i++) for (let j = i + 1; j < groups.length; j++) if (near(groups[i].b, groups[j].b, 36)) { groups[i] = join(groups[i], groups[j]); groups.splice(j, 1); return true; } return false; };
      while (merge());
      // strokes drawn over a drawing go into it
      for (const f of $$('figure.ndraw', body)) {
        const d = P.draws[f.dataset.draw]; if (!d) continue;
        const r = rectIn(g, f), fb = [r.x, r.y, r.x + r.w, r.y + r.h], hit = groups.filter(gr => near(gr.b, fb, 4)); if (!hit.length) continue;
        groups = groups.filter(gr => !hit.includes(gr)); groups.push(hit.reduce(join, { b: fb, st: d.st.map(st => xfStroke(st, r.x, r.y, r.w / d.w)), figs: [f] }));
        while (merge());
      }
      for (const gr of groups) for (const f of gr.figs) { delete P.draws[f.dataset.draw]; f.remove(); }
      groups.sort((a, b) => a.b[1] - b.b[1]);
      for (const gr of groups) {
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const st of gr.st) { const b = inkBounds(st.p, st.s); x0 = Math.min(x0, b[0]); y0 = Math.min(y0, b[1]); x1 = Math.max(x1, b[2]); y1 = Math.max(y1, b[3]); }
        const id = uid('w'); P.draws[id] = { w: +(x1 - x0).toFixed(1), h: +(y1 - y0).toFixed(1), st: gr.st.map(st => xfStroke(st, -x0, -y0, 1)) };
        const f = document.createElement('figure'); f.className = 'ndraw'; f.dataset.draw = id; drawFig(f, P);
        placeFig(g, f, x0, y0, x1 - x0, gr.figs[0] && floatOf(gr.figs[0]));
      }
      P.ink = all.filter(st => !nw.includes(st));
      P.html = serialize(); touch(D); renderInk(g);
    }
    if (any) { renderSub(); renderToolbar(); }
  }
  /* picking, moving and resizing a drawing (in text mode) */
  const AL = { l: '<path d="M4 5h16M4 19h16M4 9h7v6H4z"/><path d="M14 11h6M14 13h6"/>', c: '<path d="M4 5h16M4 19h16M8 9h8v6H8z"/>', r: '<path d="M4 5h16M4 19h16M13 9h7v6h-7z"/><path d="M4 11h6M4 13h6"/>' };
  function ndBar(f) {
    if ($('.nd-bar', f)) $('.nd-bar', f).remove(); if ($('.nd-h', f)) $('.nd-h', f).remove();
    const fl = floatOf(f), t = { l: 'À gauche, le texte à droite', c: 'Seul sur sa ligne', r: 'À droite, le texte à gauche' };
    f.insertAdjacentHTML('beforeend', `<div class="nd-bar">${['l', 'c', 'r'].map(k => `<button data-nd="${k}" title="${t[k]}" aria-label="${t[k]}" aria-pressed="${fl === k}"><svg viewBox="0 0 24 24" class="i sm" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${AL[k]}</svg></button>`).join('')}<span class="nd-sep"></span><button data-nd="del" title="Supprimer le dessin (Suppr)" aria-label="Supprimer le dessin">${icon('trash', 'sm')}</button></div><i class="nd-h" data-ndh="1" title="Redimensionner"></i>`);
  }
  function ndPick(f) {
    if (ndSel && ndSel !== f) { ndSel.classList.remove('sel'); for (const x of $$('.nd-bar,.nd-h', ndSel)) x.remove(); }
    ndSel = f || null; if (f) { f.classList.add('sel'); ndBar(f); }
  }
  function ndAction(g, f, k) {
    use(g); saveBody.flush(); P.html = serialize(); pushSnap(P);
    if (k === 'del') { delete (P.draws || {})[f.dataset.draw]; if (ndSel === f) ndSel = null; f.remove(); }
    else { const r = rectIn(g, f), br = rectIn(g, body); placeFig(g, f, k === 'l' ? br.x : k === 'r' ? br.x + br.w - r.w : br.x + (br.w - r.w) / 2, r.y, r.w, k); ndBar(f); }
    P.html = serialize(); touch(D); renderSub(); renderToolbar();
  }
  function ndStart(g, f, e, resize) {
    ndOp = { g, f, resize, id: e.pointerId, x: e.clientX, y: e.clientY, r0: f.getBoundingClientRect(), bw: g.body.getBoundingClientRect().width, moved: false };
  }
  function ndMove(e) {
    const o = ndOp, dx = e.clientX - o.x, dy = e.clientY - o.y;
    if (!o.moved) { if (Math.hypot(dx, dy) < 4) return; o.moved = true; use(o.g); saveBody.flush(); P.html = serialize(); pushSnap(P); if (!o.resize) o.f.classList.add('dragging'); }
    if (o.resize) { const w = clamp(o.r0.width + (floatOf(o.f) === 'r' ? -dx : dx), 24, o.bw); o.f.style.width = (w / o.bw * 100).toFixed(2) + '%'; }
    else o.f.style.transform = `translate(${dx}px, ${dy}px)`;
  }
  function ndEnd(e) {
    const o = ndOp; ndOp = null; if (!o.moved) return;
    const { g, f } = o;
    if (!o.resize) {
      f.classList.remove('dragging'); f.style.transform = '';
      const s = g.el.getBoundingClientRect(), u = SW / s.width;
      placeFig(g, f, (o.r0.left + e.clientX - o.x - s.left) * u, (o.r0.top + e.clientY - o.y - s.top) * u, o.r0.width * u);
      ndBar(f);
    }
    P.html = serialize(); touch(D); renderSub(); renderToolbar();
  }

  /* ---------- ink ---------- */
  function renderInk(g = cur) {
    if (!g) return;
    const k = kl(g.el), H = Math.max(g.el.offsetHeight, 10) / k, st0 = g.data.ink || [];
    g.inkSvg.setAttribute('viewBox', `0 0 ${SW} ${H.toFixed(1)}`);
    g.inkSvg.innerHTML = st0.map((st, i) => inkSVG(st, ` data-i="${i}"`)).join('');
    let maxY = 0; for (const st of st0) for (let i = 1; i < st.p.length; i += 3) if (st.p[i] > maxY) maxY = st.p[i];
    const need = maxY ? Math.max(1060, (maxY + 160) * k) : 0, h = Math.max(need, spreadOn ? fillH : 0);
    g.el.style.minHeight = h ? h + 'px' : '';
  }
  const renderAllInk = () => { for (const g of PG) renderInk(g); };
  function setMode(m) {
    const was = mode; mode = m; for (const g of PG) g.el.classList.toggle('drawmode', m === 'draw');
    if (m === 'draw') { ndPick(null); if (document.activeElement === body) body.blur(); }
    renderToolbar();
    if (was === 'draw' && m !== 'draw') finalizeDrawing();
  }
  /* the history keeps which page each stroke went to */
  function commitInk(next) { hist.push({ p: P, ink: P.ink || [] }); if (hist.length > 80) hist.shift(); fut = []; P.ink = next; touch(D); renderInk(); renderSub(); renderToolbar(); }
  function stepInk(from, to) {
    const h = from.pop(); if (!h) return;
    if (h.html !== undefined) { saveBody.flush(); to.push(snap(h.p)); } else to.push({ p: h.p, ink: h.p.ink || [] });
    h.p.ink = h.ink; touch(D);
    const g = PG.find(g => g.data === h.p);
    if (h.html !== undefined) { h.p.html = h.html; h.p.draws = h.draws; ndSel = null; if (g) hydrateInto(g.body, h.html, h.p); }
    if (g) { renderInk(g); if (spreadOn && !g.el.classList.contains('on')) { spr = g.i >> 1; layout(); } }
    renderSub(); renderToolbar();
  }
  const undoInk = () => stepInk(hist, fut), redoInk = () => stepInk(fut, hist);
  function startStroke(e) {
    if (e.pointerType === 'pen') { penSeen = true; for (const g of PG) g.el.classList.add('penseen'); }
    const erase = pen === 'eraser' || (e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32)));
    try { e.target.setPointerCapture(e.pointerId); } catch (er) {}
    if (erase) { saveBody.flush(); erasing = { id: e.pointerId, base: P.ink || [], cur: (P.ink || []).slice(), snap: snap(P), figs: false }; eraseAt(e); return; }
    clearTimeout(autoFin);
    const pr = penPref(pen);
    placeLive();
    drawing = e.pointerId;
    ink.begin(e, { t: pen, c: pr.c, s: pr.s, o: pr.o, smooth: pr.sm, k: scale(), b: brushOf(pr, scale()) });
  }
  function eraseAt(e) {
    const p = toLocal(e.clientX, e.clientY), r = 10 / scale();
    const keep = erasing.cur.filter(st => !inkHit(st.p, st.s, p.x, p.y, r));
    if (keep.length !== erasing.cur.length) { erasing.cur = keep; P.ink = keep; renderInk(); }
    // and the drawings in the text
    for (const f of $$('figure.ndraw', body)) {
      const d = (P.draws || {})[f.dataset.draw]; if (!d) continue;
      const b = rectIn(cur, f); if (p.x < b.x - r || p.x > b.x + b.w + r || p.y < b.y - r || p.y > b.y + b.h + r) continue;
      const k = b.w / d.w, st = d.st.filter(st => !inkHit(st.p, st.s, (p.x - b.x) / k, (p.y - b.y) / k, r / k));
      if (st.length === d.st.length) continue;
      erasing.figs = true; d.st = st; if (st.length) drawFig(f, P); else { delete P.draws[f.dataset.draw]; f.remove(); }
    }
  }
  function onMove(e) {
    if (e.pointerType === 'mouse' && wrap && wrap.classList.contains('typing') && (Math.abs(e.movementX) + Math.abs(e.movementY) > 2)) wrap.classList.remove('typing');
    if (ndOp && ndOp.id === e.pointerId) { ndMove(e); return; }
    if (drawing === e.pointerId) ink.feed(e);
    else if (erasing && erasing.id === e.pointerId) eraseAt(e);
  }
  function onUp(e) {
    if (ndOp && ndOp.id === e.pointerId) { ndEnd(e); return; }
    if (drawing === e.pointerId) { drawing = null; const st = ink.end(); if (st && st.p.length >= 3) { if (st.p.length === 3) st.p.push(st.p[0] + .4, st.p[1] + .2, st.p[2]); const nst = Object.assign({ t: st.t, c: st.c, s: st.s, o: st.o, p: st.p }, st.b ? { b: st.b } : {}); fresh.add(nst); commitInk((P.ink || []).concat([nst])); useColor(st.c); }
      // a stylus writing in text mode: the drawing settles into the text after a pause
      if (mode === 'text') { clearTimeout(autoFin); autoFin = setTimeout(finalizeDrawing, 1400); } }
    else if (erasing && erasing.id === e.pointerId) { const er = erasing; erasing = null;
      if (er.figs) { hist.push(er.snap); if (hist.length > 80) hist.shift(); fut = []; P.ink = er.cur; P.html = serialize(); touch(D); renderInk(); renderSub(); renderToolbar(); }
      else if (er.cur.length !== er.base.length) { P.ink = er.base; commitInk(er.cur); } }
  }
  function onCancel(e) { if (ndOp && ndOp.id === e.pointerId) { ndEnd(e); return; } if (drawing === e.pointerId) { drawing = null; ink.cancel(); } if (erasing && erasing.id === e.pointerId) { P.ink = erasing.base; erasing = null; renderInk(); } }

  /* ---------- toolbar ---------- */
  function renderToolbar() {
    const pr = penPref(pen === 'eraser' ? 'pen' : pen), cols = pen === 'highlight' ? themeColors('hl', HL_COLORS) : themeColors('ink', INK_COLORS), b = (c, ic, t, extra = '') => `<button class="nb" data-cmd="${c}" title="${t}" aria-label="${t}" ${extra}>${ic}</button>`;
    const textG = `<div class="grp">${b('h1', '<span class="txt">T1</span>', 'Grand titre (#)')}${b('h2', '<span class="txt">T2</span>', 'Sous-titre (##)')}${b('bold', icon('bold'), 'Gras (Ctrl B)')}${b('italic', icon('ital'), 'Italique (Ctrl I)')}${b('mark', icon('hl'), 'Surligner')}</div><span class="vs"></span>
      <div class="grp tfmt"><button class="nb tx" data-tx="font" title="Police" aria-label="Police"><span class="txt" style="font-family:'Instrument Serif',Georgia,serif;font-size:17px">Aa</span>${icon('chevd', 'sm')}</button><button class="nb tx" data-tx="size" title="Taille du texte" aria-label="Taille du texte"><span class="txt tsz">T<small>T</small></span>${icon('chevd', 'sm')}</button><button class="nb tx" data-tx="color" title="Couleur du texte" aria-label="Couleur du texte"><span class="tca">A<i style="background:${S.prefs.noteColor || '#E03131'}"></i></span>${icon('chevd', 'sm')}</button></div><span class="vs"></span>
      <div class="grp">${b('ul', icon('list'), 'Liste (-)')}${b('chk', icon('chk'), 'Cases à cocher ([])')}${b('quote', icon('sticky'), 'Post-it (>)')}${b('hand', '<span class="txt" style="font-family:var(--font-hand);font-size:17px">Aa</span>', 'Écriture manuscrite')}</div>`;
    const drawG = `<div class="grp">${NOTE_PENS.concat(NOTE_PENS.includes(pen) || !PENS[pen] ? [] : [pen]).map(k => `<button class="nb" data-pen="${k}" title="${PENS[k].name}${PEN_ORDER.indexOf(k) < 9 ? ` (${PEN_ORDER.indexOf(k) + 1})` : ''}" aria-label="${PENS[k].name}" aria-pressed="${pen === k}">${icon(PENS[k].icon)}</button>`).join('')}<button class="nb" data-pen="eraser" title="Gomme (E)" aria-label="Gomme" aria-pressed="${pen === 'eraser'}">${icon('eraser')}</button></div><span class="vs"></span>
      ${pen === 'eraser' ? '' : `<button class="pchip" data-pp="1" title="${PENS[pen].name} : pinceau, taille, flux, forme, texture">${brushPreview(pen, Object.assign({}, pr, { s: Math.min(pr.s, 14) }), 96, 26)}<span>${pr.s}</span>${icon('chevd', 'sm')}</button>
      <div class="grp">${cols.slice(0, 6).map(c => `<button class="sw" data-col="${c}" style="background:${c}" aria-label="Couleur ${c}" aria-pressed="${pr.c.toUpperCase() === c.toUpperCase()}"></button>`).join('')}<button class="sw cur" data-wheel="1" style="background:${pr.c}" title="Roue des couleurs" aria-label="Roue des couleurs">${icon('wheel', 'sm')}</button></div><span class="vs"></span>`}
      <div class="grp"><button class="nb" data-a="undo" title="Annuler le dernier trait" aria-label="Annuler" ${hist.length ? '' : 'disabled'}>${icon('undo')}</button><button class="nb" data-a="redo" title="Rétablir" aria-label="Rétablir" ${fut.length ? '' : 'disabled'}>${icon('redo')}</button></div>`;
    // two bars: the main tools (mode, insert, paper) and the options of the chosen mode; most themes show them as one row
    tool.innerHTML = `<div class="nt-main"><div class="grp modes"><button class="nb" data-mode="text" aria-pressed="${mode === 'text'}" title="Écrire au clavier">${icon('text')}<span class="lbl">Texte</span></button><button class="nb" data-mode="draw" aria-pressed="${mode === 'draw'}" title="Dessiner et écrire à la main">${icon('pen')}<span class="lbl">Dessin</span></button></div><span class="vs"></span>
      <span class="vs end"></span><div class="grp end">${b('image', icon('image'), 'Image ou fichier')}${AI.canDictate() ? b('dictate', icon('mic'), 'Dicter (transcription ChatGPT)') : ''}<button class="nb" data-a="paper" title="Papier" aria-label="Papier">${icon('grid')}</button></div></div>
      <div class="nt-opts" role="group" aria-label="${mode === 'text' ? 'Options du texte' : 'Options du dessin'}">${mode === 'text' ? textG : drawG}</div>`;
    renderTool();
  }
  function onToolClick(e) {
    const m = e.target.closest('[data-mode]'); if (m) { setMode(m.dataset.mode); return; }
    const c = e.target.closest('[data-cmd]'); if (c) { if (c.dataset.cmd === 'dictate') dictateHere(c); else cmd(c.dataset.cmd); return; }
    const tx = e.target.closest('[data-tx]'); if (tx) { textPop(tx); return; }
    const p = e.target.closest('[data-pen]'); if (p) { pen = p.dataset.pen; if (mode !== 'draw') setMode('draw'); else renderToolbar(); return; }
    const sw = e.target.closest('[data-col]'); if (sw) { S.prefs.pens[pen].c = sw.dataset.col; save(); renderToolbar(); return; }
    const wh = e.target.closest('[data-wheel]'); if (wh) { radialPop(wh, { get: () => penPref(pen).c, set: (v, final) => { S.prefs.pens[pen].c = v; save(); const cur = $('[data-wheel]', tool); if (cur) cur.style.background = v; } }); return; }
    const pp = e.target.closest('[data-pp]'); if (pp) { const pop = openPop(pp, `<div class="pp-wrap">${PenPanel.html(pen, { note: true })}</div>`, { cls: 'pppop', focus: false }); PenPanel.bind(pop, { pen: () => pen, setPen: k => { pen = k; closePop(); renderToolbar(); }, changed: partial => { if (!partial) renderToolbar(); } }); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'undo') undoInk(); if (a.dataset.a === 'redo') redoInk();
    if (a.dataset.a === 'paper') openPop(a, [['plain', 'Uni'], ['lines', 'Lignes'], ['dots', 'Points']].map(([k, l]) => ({ label: l, small: (D.paper || 'plain') === k ? 'actuel' : '', run: () => { D.paper = k; touch(D); layout(); } })), { align: 'right' });
  }
  /* voice: the text lands where the caret was when the dictation started */
  function dictateHere(btn) {
    ensureFocus(); const s = selInBody(), at = s && s.getRangeAt(0).cloneRange();
    btn.setAttribute('aria-pressed', 'true');
    const dock = document.createElement('div'); dock.className = 'vdock'; $('#main').append(dock);
    const ok = AI.dictate(dock, text => {
      if (!mounted) return; body.focus(); const sel = getSelection();
      if (at && body.contains(at.startContainer)) { sel.removeAllRanges(); sel.addRange(at); }
      const before = at && at.startContainer.nodeType === 3 ? at.startContainer.data.slice(0, at.startOffset) : '';
      document.execCommand('insertText', false, (before && !/\s$/.test(before) ? ' ' : '') + text); saveBody();
    }, () => { dock.remove(); btn.setAttribute('aria-pressed', 'false'); });
    if (!ok) { dock.remove(); btn.setAttribute('aria-pressed', 'false'); }
  }
  const sheetClass = () => `sheet paper-${D.paper || 'plain'}${mode === 'draw' ? ' drawmode' : ''}${penSeen ? ' penseen' : ''}`;

  /* ---------- pages ---------- */
  function use(g) {
    if (!g || g === cur) return;
    if (cur) saveBody.flush();
    cur = g; sheet = g.el; body = g.body; inkSvg = g.inkSvg; pad = g.pad; P = g.data;
  }
  const pageHTML = i => `<article class="${sheetClass()}${i ? ' npg-more' : ''}" data-pg="${i}">${i ? '' : `<input class="ntitle" value="${esc(D.title)}" aria-label="Titre" placeholder="Titre">
      <div class="nsub"></div>`}<div class="nbody" contenteditable="true" spellcheck="true" data-ph="${i ? 'Page vierge. Écrivez ou dessinez ici.' : 'Écrivez ici. Tapez # pour un titre, - pour une liste, [] pour une case à cocher, ou passez en mode Dessin.'}"></div>
      <svg class="nink" preserveAspectRatio="xMinYMin meet" aria-hidden="true"></svg><div class="npad"></div><div class="nfolio">${i ? `<button class="npg-del" data-pga="del" title="Supprimer cette page" aria-label="Supprimer la page ${i + 1}">${icon('trash', 'sm')}</button>` : ''}<span>${i + 1}</span></div></article>`;
  function bindPage(el) {
    const g = { i: +el.dataset.pg, el, body: $('.nbody', el), inkSvg: $('.nink', el), pad: $('.npad', el) };
    g.data = pageData(g.i);
    const b = g.body;
    b.addEventListener('focusin', () => use(g));
    b.addEventListener('input', () => { use(g); syncMarkers(b); saveBody(); wrap.classList.add('typing'); });
    b.addEventListener('keydown', onKey);
    b.addEventListener('keyup', renderTool); b.addEventListener('mouseup', renderTool);
    b.addEventListener('paste', onPaste);
    b.addEventListener('click', e => {
      const li = e.target.closest('ul.chk > li'); if (li && e.offsetX < 26 && e.target === li) { use(g); li.toggleAttribute('data-done'); saveBody(); return; }
      const a = e.target.closest('a[href]'); if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, '_blank', 'noopener');
      const lk = e.target.closest('figure.nlink'); if (lk && lk.dataset.url && /^https?:/i.test(lk.dataset.url)) window.open(lk.dataset.url, '_blank', 'noopener');
      const f = e.target.closest('.nfile'); if (f) { const u = Assets.url(f.dataset.asset); if (u) { const l = document.createElement('a'); l.href = u; l.download = f.querySelector('b').textContent; document.body.append(l); l.click(); l.remove(); } }
    });
    b.addEventListener('dblclick', e => { const im = e.target.closest('figure:not(.nlink) img'); if (im && im.src) { const lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = `<img src="${im.src}" alt="">`; lb.onclick = () => lb.remove(); document.body.append(lb); } });
    b.addEventListener('pointerdown', e => {
      if (mode === 'text' && e.pointerType === 'mouse' && e.button === 2) { const s = getSelection(); if (s.rangeCount && !s.isCollapsed && b.contains(s.anchorNode) && s.toString().trim()) { e.preventDefault(); use(g); openMM(e); } return; }
      if (mode !== 'text' || (e.pointerType === 'mouse' && e.button > 0)) return;
      const f = e.target.closest('figure.ndraw'); if (!f) { if (ndSel) ndPick(null); return; }
      e.preventDefault(); use(g);
      const a = e.target.closest('[data-nd]'); if (a) { ndAction(g, f, a.dataset.nd); return; }
      ndPick(f); ndStart(g, f, e, !!e.target.closest('[data-ndh]'));
    });
    g.pad.addEventListener('pointerdown', e => { if (e.button > 0 && e.pointerType === 'mouse') return; if (e.pointerType === 'touch' && penSeen) return; e.preventDefault(); use(g); startStroke(e); });
    /* a stylus writes even in text mode, unless the setting is off */
    el.addEventListener('pointerdown', e => { if (mode === 'text' && e.pointerType === 'pen' && S.prefs.autoPen && !e.target.closest('input')) { e.preventDefault(); use(g); if (PENS[pen] === undefined && pen !== 'eraser') pen = 'pen'; startStroke(e); } }, true);
    el.addEventListener('dragover', e => { const ty = [...(e.dataTransfer.types || [])]; if (ty.includes('Files') || ty.includes('application/x-notely') || (!innerDrag && ty.includes('text/uri-list'))) { e.preventDefault(); showSlot(slotAt(g, e.clientY)); } });
    b.addEventListener('dragstart', () => { innerDrag = true; }); b.addEventListener('dragend', () => { innerDrag = false; });
    el.addEventListener('dragleave', e => { if (!el.contains(e.relatedTarget)) { el.classList.remove('dropping'); clearSlot(); } });
    el.addEventListener('drop', e => { use(g); onDrop(e); });
    hydrateInto(b, g.data.html, g.data);
    if (ro) ro.observe(el);
    return g;
  }
  function addPage() {
    saveBody.flush();
    if (!Array.isArray(D.pages)) D.pages = [];
    D.pages.push({ html: '', ink: [] }); touch(D);
    const i = D.pages.length;
    $('.naddpg', wrap).insertAdjacentHTML('beforebegin', pageHTML(i));
    const g = bindPage($(`.sheet[data-pg="${i}"]`, wrap)); PG.push(g);
    spr = i >> 1; layout(); renderSub(); use(g); g.body.focus();
    if (!spreadOn) g.el.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function delPage(g) {
    const empty = !g.body.innerText.trim() && !(g.data.ink || []).length && !g.body.querySelector('img,.nfile');
    const go = () => {
      if (cur === g) use(PG[g.i - 1]);
      D.pages.splice(g.i - 1, 1); if (!D.pages.length) delete D.pages; touch(D);
      hist = hist.filter(h => h.p !== g.data); fut = fut.filter(h => h.p !== g.data);
      if (ro) ro.unobserve(g.el); g.el.remove(); PG.splice(g.i, 1);
      PG.forEach((p, i) => { p.i = i; p.el.dataset.pg = i; $('.nfolio span', p.el).textContent = i + 1; });
      spr = Math.min(spr, (PG.length - 1) >> 1); layout(); renderSub(); renderToolbar();
    };
    if (empty) { go(); return; }
    openPop($('.npg-del', g.el), [{ label: `Supprimer la page ${g.i + 1}`, small: 'son texte et ses dessins', danger: true, run: go }], { align: 'right' });
  }
  /* one page under the other, or, for a theme that asks for it on a wide screen, two pages side by side at full height */
  function layout() {
    if (!mounted) return;
    const vw = view.clientWidth, vh = view.clientHeight;
    spreadOn = !!theme().noteSpread && vw >= 1100 && vw > vh * 1.2;
    wrap.classList.toggle('spread', spreadOn);
    wrap.style.setProperty('--np', PG.length);
    const n = PG.length; spr = Math.max(0, Math.min(spr, n >> 1));
    let k = 1;
    if (spreadOn) {
      const cs = getComputedStyle(wrap), gut = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight) + 24;
      k = Math.min(1, (vw - gut) / (2 * SW));
      const top = parseFloat(getComputedStyle(PG[0].el).marginTop) || 0;
      fillH = Math.max(600, (vh - top * k - 14) / k);
      wrap.style.setProperty('--nk', k.toFixed(4));
    } else wrap.style.removeProperty('--nk');
    const first = spr * 2;
    for (const g of PG) {
      const on = !spreadOn || g.i === first || g.i === first + 1;
      g.el.className = `${sheetClass()}${g.i ? ' npg-more' : ''}${on ? ' on' : ' off'}${spreadOn && on ? (g.i === first ? ' side-l' : ' side-r') : ''}`;
      g.el.style.setProperty('--pg', g.i);
    }
    const add = $('.naddpg', wrap), blankR = spreadOn && first + 1 >= n;
    add.classList.toggle('side-r', blankR); add.hidden = spreadOn && !blankR;
    if (spreadOn) add.style.minHeight = fillH + 'px'; else add.style.minHeight = '';
    const pg = $('.npager', wrap); pg.hidden = !spreadOn;
    if (spreadOn) {
      const last = Math.min(first + 2, n);
      $('.npg-at', pg).textContent = last > first + 1 ? `Pages ${first + 1}–${last} sur ${n}` : `Page ${first + 1} sur ${n}`;
      $('[data-pga="prev"]', pg).disabled = spr === 0; $('[data-pga="next"]', pg).disabled = first + 2 >= n;
      if (cur && cur.el.classList.contains('off')) use(PG[first]);
    }
    renderAllInk();
  }
  function turn(d) {
    const n = PG.length, to = spr + d; if (!spreadOn || to < 0 || to * 2 >= n) return;
    spr = to; wrap.classList.remove('turn-l', 'turn-r'); void wrap.offsetWidth; wrap.classList.add(d > 0 ? 'turn-r' : 'turn-l');
    layout(); use(PG[spr * 2]);
  }

  /* ---------- mount ---------- */
  function mount(v, d) {
    D = d; hist = []; fut = []; mode = 'text'; drawing = null; erasing = null; if (!Array.isArray(D.ink)) D.ink = [];
    if (D.pages && !Array.isArray(D.pages)) delete D.pages;
    for (const p of D.pages || []) { if (!Array.isArray(p.ink)) p.ink = []; if (typeof p.html !== 'string') p.html = ''; }
    // drawings no longer in the text (deleted while typing) are dropped when the note opens
    for (const p of [D, ...(D.pages || [])]) if (p.draws) { const used = new Set([...(p.html || '').matchAll(/data-draw="([\w-]+)"/g)].map(m => m[1])); for (const id in p.draws) if (!used.has(id)) delete p.draws[id]; }
    fresh = new WeakSet(); ndSel = null; ndOp = null; clearTimeout(autoFin);
    PG = []; cur = null; P = null; spr = 0; spreadOn = false; view = $('#view');
    const n = 1 + (D.pages || []).length;
    v.innerHTML = `<div class="nwrap"><div class="ntool" role="toolbar" aria-label="Mise en forme"></div>
      ${Array.from({ length: n }, (_, i) => pageHTML(i)).join('')}
      <button class="naddpg" data-pga="add" title="Ajouter une page à cette note">${icon('plus')}<span>Ajouter une page</span></button>
      <nav class="npager" aria-label="Pages" hidden><button class="nb" data-pga="prev" title="Pages précédentes (Page préc.)" aria-label="Pages précédentes">${icon('chev', 'flip')}</button><span class="npg-at"></span><button class="nb" data-pga="next" title="Pages suivantes (Page suiv.)" aria-label="Pages suivantes">${icon('chev')}</button><span class="vs"></span><button class="nb" data-pga="add" title="Ajouter une page">${icon('plus')}<span class="lbl">Page</span></button></nav></div>`;
    wrap = v.firstElementChild; tool = $('.ntool', wrap);
    const first = $('.sheet', wrap); titleIn = $('.ntitle', first); sub = $('.nsub', first);
    liveBox = document.createElement('div'); liveBox.className = 'nlivebox'; liveBox.innerHTML = '<canvas class="nlive"></canvas>'; $('#main').append(liveBox); liveCv = liveBox.firstChild;
    ink = new InkCapture(liveCv, { toLocal, xf });
    mounted = true;
    ro = new ResizeObserver(es => { if (!mounted) return; for (const e of es) { if (e.target === view) layout(); else { const g = PG.find(g => g.el === e.target); if (g) renderInk(g); } } });
    for (const el of $$('.sheet', wrap)) PG.push(bindPage(el));
    use(PG[0]);
    renderSub(); renderToolbar();
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    tool.addEventListener('pointerdown', e => { if (e.target.closest('[data-cmd],[data-tx]')) e.preventDefault(); });
    tool.addEventListener('click', onToolClick);
    bubMount();
    wrap.addEventListener('click', e => {
      const a = e.target.closest('[data-pga]'); if (!a) return;
      const k = a.dataset.pga;
      if (k === 'add') addPage(); else if (k === 'prev') turn(-1); else if (k === 'next') turn(1);
      else if (k === 'del') { const g = PG.find(g => g.el === a.closest('.sheet')); if (g) delPage(g); }
    });

    titleIn.oninput = () => { D.title = titleIn.value; touch(D); const t = $('#docTitle'); if (t) t.value = D.title; $('#focusTtl').textContent = D.title; };
    titleIn.onkeydown = e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); PG[0].body.focus(); } };
    titleIn.onblur = () => { if (!titleIn.value.trim()) { D.title = 'Sans titre'; titleIn.value = D.title; touch(D); const t = $('#docTitle'); if (t) t.value = D.title; } };
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onCancel);
    ro.observe(view);
    view.addEventListener('scroll', onScroll, { passive: true });
    layout();
    // pen strokes from before 0.2.3 lay over the text: they settle into it as drawings the first time the note opens
    let old = false; for (const g of PG) for (const st of g.data.ink || []) if (st.t !== 'highlight') { fresh.add(st); old = true; }
    if (old) { finalizeDrawing(); use(PG[0]); }
  }
  /* themes can mark the toolbar once the note scrolls under it (.scrolled) and dim it while typing (.typing, cleared by a mouse move) */
  function onScroll() { if (mounted) { wrap.classList.toggle('scrolled', view.scrollTop > 4); if (bub && !bub.hidden) bubQueue(); } }
  function flush() { if (!mounted) return; saveBody.flush(); }
  function unmount() {
    if (!mounted) return;
    closeMM(); finalizeDrawing(); flush(); mounted = false; bubUnmount();
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onCancel);
    if (ro) ro.disconnect(); if (liveBox) liveBox.remove(); if (view) view.removeEventListener('scroll', onScroll);
    D = null; PG = []; cur = null; P = null; view = null;
  }

  return {
    mount, unmount, flush,
    get mounted() { return mounted; }, get doc() { return D; },
    syncTitle() { if (mounted && titleIn && document.activeElement !== titleIn) titleIn.value = D.title; },
    focusTitle() { if (!mounted) return; titleIn.focus(); titleIn.select(); },
    retheme() { if (mounted) layout(); },
    key(e) {
      if (!mounted) return false;
      const inText = e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (e.key === 'Escape' && mode === 'draw') { setMode('text'); return true; }
      if (!inText && spreadOn && (e.key === 'PageDown' || e.key === 'PageUp')) { e.preventDefault(); turn(e.key === 'PageDown' ? 1 : -1); return true; }
      if (!inText && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redoInk() : undoInk(); return true; }
      if (!inText && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoInk(); return true; }
      if (!inText && !e.ctrlKey && !e.metaKey && !e.altKey) { const k = e.key.toLowerCase(); if (k === 'p') { pen = PENS[pen] ? pen : 'pen'; setMode('draw'); return true; } if (k === 'e') { pen = 'eraser'; setMode('draw'); return true; } if (k === 't') { setMode('text'); body.focus(); return true; } if (/^[1-9]$/.test(k) && PEN_ORDER[+k - 1]) { pen = PEN_ORDER[+k - 1]; setMode('draw'); return true; } }
      return false;
    },
    text() { return mounted ? PG.map(g => g.body.innerText).join('\n\n') : '' },
    insertMedia(list) { if (!mounted) return; insertHTMLAt((list || []).map(mediaHTML).join('')); toast(list.length > 1 ? `${list.length} éléments insérés` : 'Inséré dans la note'); },
    append(md) { if (!mounted) return; body.insertAdjacentHTML('beforeend', mdToHTML(md)); P.html = serialize(); touch(D); renderSub(); body.lastElementChild && body.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    mdToHTML
  };
})();
