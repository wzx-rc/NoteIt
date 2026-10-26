/* ================= note editor =================
   A sheet of paper: rich text (contenteditable) under a layer of ink.
   Ink is stored in sheet units (the sheet is 820 wide) so it scales with the page on a phone.
   The live stroke is drawn on a canvas the size of the visible area, not of the whole sheet. */
const Note = (() => {
  const SW = 820;
  /* the pens shown in the toolbar; the others are one click away in the brush panel */
  const NOTE_PENS = ['natural', 'pencil', 'pen', 'fine', 'brush', 'marker', 'water', 'highlight'];
  let D = null, wrap, tool, sheet, body, inkSvg, pad, liveBox, liveCv, ink, titleIn, sub, ro = null;
  let mode = 'text', pen = 'pen', hist = [], fut = [], mounted = false, penSeen = false, drawing = null, erasing = null;

  const scale = () => sheet.getBoundingClientRect().width / SW;
  function toLocal(cx, cy) { const r = sheet.getBoundingClientRect(), s = SW / r.width; return { x: (cx - r.left) * s, y: (cy - r.top) * s }; }
  function xf() { const r = sheet.getBoundingClientRect(), b = liveBox.getBoundingClientRect(); return { k: r.width / SW, ox: r.left - b.left, oy: r.top - b.top }; }
  function placeLive() { const v = $('#view'); liveBox.style.top = v.offsetTop + 'px'; ink.resize(); }

  /* ---------- text ---------- */
  function hydrate(html) {
    body.innerHTML = html || '';
    for (const im of $$('img[data-asset]', body)) { const u = Assets.url(im.dataset.asset); if (u) im.src = u; else im.closest('figure') ? im.closest('figure').classList.add('missing') : im.remove(); }
  }
  function serialize() {
    const c = body.cloneNode(true);
    for (const im of $$('img[data-asset]', c)) im.removeAttribute('src');
    return c.innerHTML.replace(/<br>(<\/(p|div|li|h1|h2|h3)>)/g, '$1');
  }
  const saveBody = debounce(() => { if (!mounted) return; D.html = serialize(); touch(D); renderSub(); }, 400);
  function renderSub() {
    const sp = spaceById(D.sp), words = (body.innerText.match(/[\p{L}\p{N}]+/gu) || []).length;
    sub.innerHTML = `${sp ? `<span class="chip"><span class="sdot" style="background:${sp.color}"></span>${esc(sp.name)}</span>` : ''}<span>Modifiée ${ago(D.updated)}</span><span>${words} mot${words > 1 ? 's' : ''}</span>${(D.ink || []).length ? `<span>${D.ink.length} trait${D.ink.length > 1 ? 's' : ''}</span>` : ''}`;
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
      case 'bold': case 'italic': document.execCommand(c); break;
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
  /* « # », « ## », « - », « [] », « > » and « 1. » at the start of a line */
  function onKey(e) {
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
    body.focus();
    const s = getSelection();
    if (at) { s.removeAllRanges(); s.addRange(at); } else if (!selInBody()) ensureFocus();
    document.execCommand('insertHTML', false, html);
    saveBody();
  }
  function onDrop(e) {
    const files = [...(e.dataTransfer && e.dataTransfer.files || [])]; if (!files.length) return;
    e.preventDefault(); sheet.classList.remove('dropping');
    let r = null; if (document.caretRangeFromPoint) r = document.caretRangeFromPoint(e.clientX, e.clientY); else if (document.caretPositionFromPoint) { const p = document.caretPositionFromPoint(e.clientX, e.clientY); if (p) { r = document.createRange(); r.setStart(p.offsetNode, p.offset); } }
    if (r && !body.contains(r.startContainer)) r = null;
    addFiles(files, r);
  }
  function onPaste(e) {
    const cd = e.clipboardData; if (!cd) return;
    const files = [...cd.files]; if (files.length) { e.preventDefault(); addFiles(files, null); return; }
    const h = cd.getData('text/html'); if (h) { e.preventDefault(); document.execCommand('insertHTML', false, sanitize(h)); saveBody(); return; }
  }

  /* ---------- ink ---------- */
  function renderInk() {
    const k = scale(), H = Math.max(sheet.offsetHeight, 10) / k;
    inkSvg.setAttribute('viewBox', `0 0 ${SW} ${H.toFixed(1)}`);
    inkSvg.innerHTML = (D.ink || []).map((st, i) => inkSVG(st, ` data-i="${i}"`)).join('');
    let maxY = 0; for (const st of D.ink || []) for (let i = 1; i < st.p.length; i += 3) if (st.p[i] > maxY) maxY = st.p[i];
    sheet.style.minHeight = maxY ? Math.max(1060, (maxY + 160) * k) + 'px' : '';
  }
  function setMode(m) {
    mode = m; sheet.classList.toggle('drawmode', m === 'draw');
    if (m === 'draw') { if (document.activeElement === body) body.blur(); }
    renderToolbar();
  }
  function commitInk(next) { hist.push(D.ink || []); if (hist.length > 80) hist.shift(); fut = []; D.ink = next; touch(D); renderInk(); renderSub(); renderToolbar(); }
  function undoInk() { const p = hist.pop(); if (!p) return; fut.push(D.ink); D.ink = p; touch(D); renderInk(); renderToolbar(); }
  function redoInk() { const n = fut.pop(); if (!n) return; hist.push(D.ink); D.ink = n; touch(D); renderInk(); renderToolbar(); }
  function startStroke(e) {
    if (e.pointerType === 'pen') { penSeen = true; sheet.classList.add('penseen'); }
    const erase = pen === 'eraser' || (e.pointerType === 'pen' && (e.button === 5 || (e.buttons & 32)));
    try { e.target.setPointerCapture(e.pointerId); } catch (er) {}
    if (erase) { erasing = { id: e.pointerId, base: D.ink || [], cur: (D.ink || []).slice() }; eraseAt(e); return; }
    const pr = penPref(pen);
    placeLive();
    drawing = e.pointerId;
    ink.begin(e, { t: pen, c: pr.c, s: pr.s, o: pr.o, smooth: pr.sm, k: scale(), b: brushOf(pr, scale()) });
  }
  function eraseAt(e) {
    const p = toLocal(e.clientX, e.clientY), r = 10 / scale();
    const keep = erasing.cur.filter(st => !inkHit(st.p, st.s, p.x, p.y, r));
    if (keep.length !== erasing.cur.length) { erasing.cur = keep; D.ink = keep; renderInk(); }
  }
  function onMove(e) {
    if (drawing === e.pointerId) ink.feed(e);
    else if (erasing && erasing.id === e.pointerId) eraseAt(e);
  }
  function onUp(e) {
    if (drawing === e.pointerId) { drawing = null; const st = ink.end(); if (st && st.p.length >= 3) { if (st.p.length === 3) st.p.push(st.p[0] + .4, st.p[1] + .2, st.p[2]); commitInk((D.ink || []).concat([Object.assign({ t: st.t, c: st.c, s: st.s, o: st.o, p: st.p }, st.b ? { b: st.b } : {})])); useColor(st.c); } }
    else if (erasing && erasing.id === e.pointerId) { const er = erasing; erasing = null; if (er.cur.length !== er.base.length) { D.ink = er.base; commitInk(er.cur); } }
  }
  function onCancel(e) { if (drawing === e.pointerId) { drawing = null; ink.cancel(); } if (erasing && erasing.id === e.pointerId) { D.ink = erasing.base; erasing = null; renderInk(); } }

  /* ---------- toolbar ---------- */
  function renderToolbar() {
    const pr = penPref(pen === 'eraser' ? 'pen' : pen), cols = pen === 'highlight' ? themeColors('hl', HL_COLORS) : themeColors('ink', INK_COLORS), b = (c, ic, t, extra = '') => `<button class="nb" data-cmd="${c}" title="${t}" aria-label="${t}" ${extra}>${ic}</button>`;
    const textG = `<div class="grp">${b('h1', '<span class="txt">T1</span>', 'Grand titre (#)')}${b('h2', '<span class="txt">T2</span>', 'Sous-titre (##)')}${b('bold', icon('bold'), 'Gras (Ctrl B)')}${b('italic', icon('ital'), 'Italique (Ctrl I)')}${b('mark', icon('hl'), 'Surligner')}</div><span class="vs"></span>
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
    const p = e.target.closest('[data-pen]'); if (p) { pen = p.dataset.pen; if (mode !== 'draw') setMode('draw'); else renderToolbar(); return; }
    const sw = e.target.closest('[data-col]'); if (sw) { S.prefs.pens[pen].c = sw.dataset.col; save(); renderToolbar(); return; }
    const wh = e.target.closest('[data-wheel]'); if (wh) { radialPop(wh, { get: () => penPref(pen).c, set: (v, final) => { S.prefs.pens[pen].c = v; save(); const cur = $('[data-wheel]', tool); if (cur) cur.style.background = v; } }); return; }
    const pp = e.target.closest('[data-pp]'); if (pp) { const pop = openPop(pp, `<div class="pp-wrap">${PenPanel.html(pen, { note: true })}</div>`, { cls: 'pppop', focus: false }); PenPanel.bind(pop, { pen: () => pen, setPen: k => { pen = k; closePop(); renderToolbar(); }, changed: partial => { if (!partial) renderToolbar(); } }); return; }
    const a = e.target.closest('[data-a]'); if (!a) return;
    if (a.dataset.a === 'undo') undoInk(); if (a.dataset.a === 'redo') redoInk();
    if (a.dataset.a === 'paper') openPop(a, [['plain', 'Uni'], ['lines', 'Lignes'], ['dots', 'Points']].map(([k, l]) => ({ label: l, small: (D.paper || 'plain') === k ? 'actuel' : '', run: () => { D.paper = k; touch(D); sheet.className = sheetClass(); } })), { align: 'right' });
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

  /* ---------- mount ---------- */
  function mount(v, d) {
    D = d; hist = []; fut = []; mode = 'text'; drawing = null; erasing = null; if (!Array.isArray(D.ink)) D.ink = [];
    v.innerHTML = `<div class="nwrap"><div class="ntool" role="toolbar" aria-label="Mise en forme"></div>
      <article class="sheet"><input class="ntitle" value="${esc(d.title)}" aria-label="Titre" placeholder="Titre">
      <div class="nsub"></div><div class="nbody" contenteditable="true" spellcheck="true" data-ph="Écrivez ici. Tapez # pour un titre, - pour une liste, [] pour une case à cocher, ou passez en mode Dessin."></div>
      <svg class="nink" preserveAspectRatio="xMinYMin meet" aria-hidden="true"></svg><div class="npad"></div></article></div>`;
    wrap = v.firstElementChild; tool = $('.ntool', wrap); sheet = $('.sheet', wrap); body = $('.nbody', sheet); inkSvg = $('.nink', sheet); pad = $('.npad', sheet); titleIn = $('.ntitle', sheet); sub = $('.nsub', sheet);
    sheet.className = sheetClass();
    liveBox = document.createElement('div'); liveBox.className = 'nlivebox'; liveBox.innerHTML = '<canvas class="nlive"></canvas>'; $('#main').append(liveBox); liveCv = liveBox.firstChild;
    ink = new InkCapture(liveCv, { toLocal, xf });
    mounted = true;
    hydrate(d.html); renderSub(); renderToolbar();
    body.addEventListener('input', () => { saveBody(); });
    body.addEventListener('keydown', onKey);
    try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {}
    body.addEventListener('keyup', renderTool); body.addEventListener('mouseup', renderTool);
    body.addEventListener('paste', onPaste);
    body.addEventListener('click', e => {
      const li = e.target.closest('ul.chk > li'); if (li && e.offsetX < 26 && e.target === li) { li.toggleAttribute('data-done'); saveBody(); return; }
      const a = e.target.closest('a[href]'); if (a && (e.ctrlKey || e.metaKey)) window.open(a.href, '_blank', 'noopener');
      const f = e.target.closest('.nfile'); if (f) { const u = Assets.url(f.dataset.asset); if (u) { const l = document.createElement('a'); l.href = u; l.download = f.querySelector('b').textContent; document.body.append(l); l.click(); l.remove(); } }
    });
    body.addEventListener('dblclick', e => { const im = e.target.closest('figure img'); if (im && im.src) { const lb = document.createElement('div'); lb.className = 'lightbox'; lb.innerHTML = `<img src="${im.src}" alt="">`; lb.onclick = () => lb.remove(); document.body.append(lb); } });
    tool.addEventListener('pointerdown', e => { if (e.target.closest('[data-cmd]')) e.preventDefault(); });
    tool.addEventListener('click', onToolClick);

    titleIn.oninput = () => { D.title = titleIn.value; touch(D); const t = $('#docTitle'); if (t) t.value = D.title; $('#focusTtl').textContent = D.title; };
    titleIn.onkeydown = e => { if (e.key === 'Enter' || e.key === 'ArrowDown') { e.preventDefault(); body.focus(); } };
    titleIn.onblur = () => { if (!titleIn.value.trim()) { D.title = 'Sans titre'; titleIn.value = D.title; touch(D); const t = $('#docTitle'); if (t) t.value = D.title; } };
    pad.addEventListener('pointerdown', e => { if (e.button > 0 && e.pointerType === 'mouse') return; if (e.pointerType === 'touch' && penSeen) return; e.preventDefault(); startStroke(e); });
    /* a stylus writes even in text mode, unless the setting is off */
    sheet.addEventListener('pointerdown', e => { if (mode === 'text' && e.pointerType === 'pen' && S.prefs.autoPen && !e.target.closest('input')) { e.preventDefault(); if (PENS[pen] === undefined && pen !== 'eraser') pen = 'pen'; startStroke(e); } }, true);
    addEventListener('pointermove', onMove); addEventListener('pointerup', onUp); addEventListener('pointercancel', onCancel);
    sheet.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); sheet.classList.add('dropping'); } });
    sheet.addEventListener('dragleave', e => { if (!sheet.contains(e.relatedTarget)) sheet.classList.remove('dropping'); });
    sheet.addEventListener('drop', onDrop);
    ro = new ResizeObserver(() => { if (mounted) renderInk(); }); ro.observe(sheet);
    renderInk();
  }
  function flush() { if (!mounted) return; saveBody.flush(); }
  function unmount() {
    if (!mounted) return;
    flush(); mounted = false;
    removeEventListener('pointermove', onMove); removeEventListener('pointerup', onUp); removeEventListener('pointercancel', onCancel);
    if (ro) ro.disconnect(); if (liveBox) liveBox.remove();
    D = null;
  }

  return {
    mount, unmount, flush,
    get mounted() { return mounted; }, get doc() { return D; },
    syncTitle() { if (mounted && titleIn && document.activeElement !== titleIn) titleIn.value = D.title; },
    focusTitle() { if (!mounted) return; titleIn.focus(); titleIn.select(); },
    retheme() { if (mounted) renderInk(); },
    key(e) {
      if (!mounted) return false;
      const inText = e.target.isContentEditable || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName);
      if (e.key === 'Escape' && mode === 'draw') { setMode('text'); return true; }
      if (!inText && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redoInk() : undoInk(); return true; }
      if (!inText && (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redoInk(); return true; }
      if (!inText && !e.ctrlKey && !e.metaKey && !e.altKey) { const k = e.key.toLowerCase(); if (k === 'p') { pen = PENS[pen] ? pen : 'pen'; setMode('draw'); return true; } if (k === 'e') { pen = 'eraser'; setMode('draw'); return true; } if (k === 't') { setMode('text'); body.focus(); return true; } if (/^[1-9]$/.test(k) && PEN_ORDER[+k - 1]) { pen = PEN_ORDER[+k - 1]; setMode('draw'); return true; } }
      return false;
    },
    text() { return mounted ? body.innerText : '' },
    append(md) { if (!mounted) return; body.insertAdjacentHTML('beforeend', mdToHTML(md)); D.html = serialize(); touch(D); renderSub(); body.lastElementChild && body.lastElementChild.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); },
    mdToHTML
  };
})();
