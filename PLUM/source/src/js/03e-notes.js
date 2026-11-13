/* ================= Notes and Boards (0.3.5) =================
   Notes, after Evernote: the list on the left (space · date, the title in bold, two lines of text, a thumbnail: the
   first picture of the note or a file tile, a star when it is a favourite), the selected note open on the right in the
   same editor as a full page. « Notes » of the sidebar (route all: every space, filtered by space in S.prefs.allF.sp)
   and the Notes of a space (route notes) share it. A project's PAGE is not in the list: the page is the space itself.
   Boards have their own gallery (route allboards, filtered by space in S.prefs.allBF.sp). */
const NL_SORT = [['upd', 'Date de modification'], ['new', 'Date de création'], ['az', 'Titre (A → Z)']];
const NL = { v: null, sp: '', sel: null };
function nlDate(ts) {
  const d = new Date(ts || 0), t = new Date(), day = x => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const n = Math.round((day(t) - day(d)) / 864e5);
  if (n <= 0) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (n === 1) return 'Hier';
  if (n < 7) return cap1(WD[d.getDay()]);
  return fmtShort(isoOf(d)) + (d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : '');
}
/* the first picture of the note (a link card's picture counts), else a tile for its first file */
function noteThumb(d) {
  const h = noteHTML(d);
  for (const m of h.matchAll(/data-asset="([^"]+)"/g)) {
    const b = Assets.blobs && Assets.blobs.get(m[1]);
    if (b && /^image\//.test(b.type)) { const u = Assets.url(m[1]); if (u) return `<img src="${u}" alt="" draggable="false">`; }
  }
  const f = /class="nfile"[^>]*>[\s\S]*?<b>([^<]*)<\/b>/.exec(h);
  if (f) { const ext = (/\.([a-z0-9]{1,5})$/i.exec(f[1]) || [, ''])[1].toUpperCase(); return `<span class="nli-file">${icon('file')}<b>${ext || 'FICHIER'}</b></span>`; }
  return '';
}
function nlItem(d, o = {}) {
  const sp = spaceById(d.sp), txt = docText(d).trim(), th = noteThumb(d);
  const where = o.sp ? `<i class="nli-dot" style="background:${sp && sp.id !== DEF_SPACE ? sp.color : 'var(--ink-3)'}"></i><span class="nli-sp">${esc(sp ? sp.name : DEF_NAME)}</span><span>·</span>` : '';
  return `<button class="nli${o.on ? ' on' : ''}${th ? ' th' : ''}${d.fav ? ' fv' : ''}" data-nl="${d.id}" data-doc="${d.id}" draggable="true" role="option" aria-selected="${!!o.on}">
    <span class="nli-tx"><small class="nli-k">${where}<span>${nlDate(d.updated)}</span></small><b class="nli-t">${esc(d.title || 'Sans titre')}</b><span class="nli-p">${txt ? esc(txt.slice(0, 240)) : '<i>Note vide</i>'}</span></span>
    ${th ? `<span class="nli-th">${th}</span>` : ''}${d.fav ? `<span class="nli-fav" title="Favori">${icon('star', 'sm')}</span>` : ''}</button>`;
}
const notesOf = spId => { const f = allFilter(); return liveDocs().filter(d => d.type === 'note' && !isPage(d) && (spId ? d.sp === spId : !f.sp || d.sp === f.sp)); };
function nlSorted(list) {
  const k = S.prefs.nlSort || 'upd';
  return list.sort(k === 'az' ? (a, b) => (a.title || '').localeCompare(b.title || '', 'fr', { sensitivity: 'base', numeric: true })
    : k === 'new' ? (a, b) => (b.created || 0) - (a.created || 0) : (a, b) => (b.updated || 0) - (a.updated || 0));
}
const nlItems = (list, sel, glob) => list.map(d => nlItem(d, { on: !!sel && d.id === sel.id, sp: glob })).join('')
  || `<div class="nl-empty">${glob && allFilter().sp ? 'Aucune note dans cet espace.' : 'Aucune note pour l’instant.'}<button class="btn sm" data-nlnew>${icon('plus', 'sm')}Nouvelle note</button></div>`;
const nlReadHTML = () => `<div class="nl-bar"><button class="nl-ib" data-nlfold title="Replier la liste" aria-label="Replier la liste">${icon('dblchev')}</button><button class="nl-ib" data-nlopen title="Ouvrir en pleine page" aria-label="Ouvrir en pleine page">${icon('expand')}</button><span class="nl-path"></span></div><div class="nl-doc"></div>`;
const nlNarrow = () => innerWidth <= 760;
function renderNotes(v, spId) {
  const glob = !spId, f = allFilter(), list = nlSorted(notesOf(spId)), narrow = nlNarrow();
  const sel = narrow ? null : list.find(d => d.id === S.prefs.nlSel) || list[0] || null;
  const fsp = glob && f.sp ? spaceById(f.sp) : null;
  $('#view').className = 'fixed';
  NL.v = v; NL.sp = spId || ''; NL.sel = sel ? sel.id : null;
  v.innerHTML = `<div class="nlv${S.prefs.nlFold && !narrow ? ' fold' : ''}">
    <aside class="nl-list" aria-label="Notes">
      <div class="nl-hd"><h1>Notes</h1><span class="nl-n">${list.length}</span><span class="nl-acts">
        <button class="nl-ib" data-nlnew title="Nouvelle note (Ctrl N)" aria-label="Nouvelle note">${icon('plus')}</button>
        <button class="nl-ib" data-nlsort title="Trier" aria-label="Trier">${icon('sort')}</button>
        ${glob ? `<button class="nl-ib${fsp ? ' on' : ''}" data-nlfilt title="Filtrer par espace" aria-label="Filtrer par espace">${icon('filter')}</button>` : ''}</span></div>
      ${fsp ? `<div class="nl-chips"><button class="nl-chip" data-nlclr title="Retirer le filtre">${fsp.id === DEF_SPACE ? icon('inbox', 'sm') : `<i style="background:${fsp.color}"></i>`}<span>${esc(fsp.name)}</span>${icon('x', 'sm')}</button></div>` : ''}
      <div class="nl-items" role="listbox" aria-label="Liste des notes">${nlItems(list, sel, glob)}</div>
    </aside>
    <section class="nl-read">${sel ? nlReadHTML() : `<div class="nl-bar"><button class="nl-ib" data-nlfold title="Replier la liste" aria-label="Replier la liste">${icon('dblchev')}</button></div><div class="nl-none">${icon('notes', 'lg')}<p>Choisissez une note dans la liste, ou écrivez-en une nouvelle.</p><button class="btn pri" data-nlnew>${icon('plus', 'sm')}Nouvelle note</button></div>`}</section>
  </div>`;
  v.addEventListener('click', e => {
    const it = e.target.closest('[data-nl]'); if (it) { nlSelect(it.dataset.nl); return; }
    if (e.target.closest('[data-nlnew]')) { nlNew(); return; }
    const so = e.target.closest('[data-nlsort]');
    if (so) { const cur = S.prefs.nlSort || 'upd'; openPop(so, [{ head: 'Trier par' }, ...NL_SORT.map(([k, l]) => ({ label: l, icon: k === cur ? 'check' : '', run: () => { S.prefs.nlSort = k; save(); nlRefresh(); } }))], { align: 'right' }); return; }
    const setF = id => { f.sp = id; save(); go('all', { keepFocus: true }); };
    const fi = e.target.closest('[data-nlfilt]');
    if (fi) { const n = id => liveDocs().filter(d => d.type === 'note' && !isPage(d) && d.sp === id).length;
      openPop(fi, [{ head: 'Espace' }, { label: 'Tous les espaces', icon: f.sp ? '' : 'check', run: () => setF('') }, '-',
        ...userSpaces().map(s => ({ label: s.name, dot: s.color, small: String(n(s.id) || ''), run: () => setF(s.id) })),
        { label: DEF_NAME, icon: 'inbox', small: String(n(DEF_SPACE) || ''), run: () => setF(DEF_SPACE) }], { align: 'right' }); return; }
    if (e.target.closest('[data-nlclr]')) { setF(''); return; }
    if (e.target.closest('[data-nlfold]')) { S.prefs.nlFold = !S.prefs.nlFold; save(); $('.nlv', v).classList.toggle('fold', !!S.prefs.nlFold); const b = $('[data-nlfold]', v); if (b) b.title = S.prefs.nlFold ? 'Montrer la liste' : 'Replier la liste'; return; }
    if (e.target.closest('[data-nlopen]')) { if (NL.sel) go('doc:' + NL.sel); return; }
  });
  // the arrows walk the list (the note follows)
  $('.nl-items', v).addEventListener('keydown', e => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const cur = e.target.closest('[data-nl]'); if (!cur) return;
    const nx = e.key === 'ArrowDown' ? cur.nextElementSibling : cur.previousElementSibling;
    e.preventDefault(); if (!nx || !nx.dataset.nl) return;
    nx.focus(); nx.scrollIntoView({ block: 'nearest' }); nlSelect(nx.dataset.nl);
  });
  CardMM.bind(v);
  unmountView = () => { Note.unmount(); NL.v = null; NL.sel = null; };
  if (sel) nlMount(sel);
  { const on = $('.nli.on', v); if (on) on.scrollIntoView({ block: 'nearest' }); }
}
function nlMount(d) {
  const v = NL.v; if (!v) return;
  const rd = $('.nl-read', v); if (!$('.nl-doc', rd)) rd.innerHTML = nlReadHTML();
  const doc = $('.nl-doc', rd); doc.scrollTop = 0;
  nlPath(d);
  Note.mount(doc, d, { scroller: doc, onChange: nlSync });
  $('#focusTtl').textContent = d.title;
}
function nlSelect(id) {
  const d = docById(id); if (!d || !NL.v) return;
  if (nlNarrow()) { go('doc:' + id); return; }
  if (NL.sel === id && Note.mounted) return;
  Note.unmount(); NL.sel = id; S.prefs.nlSel = id; save();
  for (const x of $$('.nli', NL.v)) { const on = x.dataset.nl === id; x.classList.toggle('on', on); x.setAttribute('aria-selected', on); }
  nlMount(d);
}
function nlNew() {
  const d = newDoc('note', { sp: NL.sp || allFilter().sp || DEF_SPACE });
  if (nlNarrow()) { go('doc:' + d.id); setTimeout(() => Note.focusTitle(), 40); return; }
  S.prefs.nlSel = d.id; save(); go(R, { keepFocus: true }); setTimeout(() => Note.focusTitle(), 40);
}
function nlPath(d) {
  const p = NL.v && $('.nl-path', NL.v); if (!p || !d) return;
  const sp = spaceById(d.sp) || spaceById(DEF_SPACE);
  p.innerHTML = `<button class="nl-psp" data-go="space:${sp.id}" title="Ouvrir ${esc(sp.name)}">${sp.id === DEF_SPACE ? icon('inbox', 'sm') : `<i style="background:${sp.color}"></i>`}<span>${esc(sp.name)}</span></button><span class="nl-sep">›</span><b>${esc(d.title || 'Sans titre')}</b>`;
}
/* the open note changed (text saved or title typed): its line in the list and the path follow */
function nlSync(d) {
  if (!NL.v || !d) return;
  const it = $(`.nli[data-nl="${d.id}"]`, NL.v);
  if (it) { const t = document.createElement('div'); t.innerHTML = nlItem(d, { on: true, sp: !NL.sp }); const n = t.firstElementChild; if (n.innerHTML !== it.innerHTML) it.replaceWith(n); }
  nlPath(d); $('#focusTtl').textContent = d.title;
}
/* the list again (new sort, or a change from another device), the open note stays as it is */
function nlRefresh() {
  if (!NL.v) return;
  const list = nlSorted(notesOf(NL.sp)), box = $('.nl-items', NL.v); if (!box) return;
  const sel = list.find(d => d.id === NL.sel);
  if (NL.sel && !sel) { go(R, { keepFocus: true }); return; }
  const st = box.scrollTop; box.innerHTML = nlItems(list, sel, !NL.sp); box.scrollTop = st;
  const n = $('.nl-n', NL.v); if (n) n.textContent = list.length;
}

/* ---------- Boards: every board, whatever its space ---------- */
const boardFilter = () => { const f = S.prefs.allBF || (S.prefs.allBF = { sp: '' }); if (f.sp && !spaceById(f.sp)) f.sp = ''; return f; };
function renderBoards(v) {
  const f = boardFilter(), ld = liveDocs().filter(d => d.type === 'board');
  const list = ld.filter(d => !f.sp || d.sp === f.sp).sort((a, b) => b.updated - a.updated);
  const nIn = id => ld.filter(d => d.sp === id).length;
  const chip = (val, label, extra = '') => `<button class="chip fchip" data-fsp="${val}" aria-pressed="${f.sp === val}">${extra}${label}</button>`;
  const spChips = [chip('', 'Tous les espaces'), ...userSpaces().map(s => chip(s.id, `${esc(s.name)} <small>${nIn(s.id) || ''}</small>`, `<span class="sdot" style="background:${s.color}"></span>`)),
    chip(DEF_SPACE, `${DEF_NAME} <small>${nIn(DEF_SPACE) || ''}</small>`, icon('inbox', 'sm'))].join('');
  const where = f.sp ? spaceById(f.sp).name : '';
  v.innerHTML = `<div class="page allpage bdpage"><div class="ph"><div><h1>Boards</h1><div class="sub">${list.length ? `${list.length} board${list.length > 1 ? 's' : ''}` : 'Aucun board pour l’instant'}${where ? ` dans ${esc(where)}` : ', tous espaces confondus'}. Glissez une carte sur un espace de la barre latérale pour la ranger.</div></div><div class="acts">
      <button class="btn pri" data-new="board">${icon('board')}Nouveau board</button></div></div>
    <div class="fbar"><div class="fsps">${spChips}</div></div>
    <div class="docs"><button class="newcard" data-new="board">${icon('plus', 'lg')}Nouveau board</button>${list.map(d => docCard(d, { where: true })).join('')}</div>
  </div><button class="fab" id="fab" aria-label="Créer">${icon('plus')}</button>`;
  bindDocCards(v); bindCreate(v);
  $('.fbar', v).onclick = e => { const sp = e.target.closest('[data-fsp]'); if (!sp) return; f.sp = sp.dataset.fsp; save(); go('allboards'); };
}
