/* ================= PAGE du projet (0.2.53, HUB v2) =================
   Every project (user space) owns one PAGE: a note that cannot be deleted nor moved, with the id 'pg_' + space id
   (the same on every device, so sync never makes two). On top of its free notes it holds:
   - the Synthèse (d.synth), the text shown on the project card of the HUB;
   - the Tâches principales = the project's starred tasks (t.star), shown on the card (open ones first).
   The card's ↗ opens the PAGE. 0.2.70: the Synthèse is the PAGE's own text (the Quick Note). */
const pageId = sp => 'pg_' + sp.id;
const isPage = d => !!(d && d.page);
function ensurePage(sp) {
  if (!sp || sp.id === DEF_SPACE) return null;
  let d = docById(pageId(sp));
  if (!d) {
    d = { id: pageId(sp), type: 'note', page: 1, title: sp.name, sp: sp.id, synth: '', html: '', ink: [], paper: 'plain', fav: false, trash: false, created: sp.created || 1, updated: Date.now() };
    S.docs.push(d); save();
  } else if (d.trash || d.sp !== sp.id || !d.page) { d.trash = false; d.sp = sp.id; d.page = 1; save(); }
  pageMigrateSynth(d);
  return d;
}
function ensurePages() { for (const sp of userSpaces()) ensurePage(sp); }
const pageOf = sp => sp && sp.id !== DEF_SPACE ? ensurePage(sp) : null;
/* the tasks a card or a PAGE shows: the starred ones of the project (open first), else the open ones */
function mainTasks(sp, max = 99) {
  const all = S.tasks.filter(t => t.sp === sp.id), star = all.filter(t => t.star);
  const pick = star.length ? star : all.filter(t => !t.done);
  const open = pick.filter(t => !t.done).sort(taskSort), done = pick.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  return open.concat(done).slice(0, max);
}
function projStats(sp) {
  const docs = liveDocs().filter(d => d.sp === sp.id && !d.page), all = S.tasks.filter(t => t.sp === sp.id);
  const nN = docs.filter(d => d.type === 'note').length, nB = docs.length - nN, nT = all.length, nD = all.filter(t => t.done).length;
  return { docs, nN, nB, nT, nD, pct: nT ? Math.round(nD / nT * 100) : 0 };
}
const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
/* create a note / board / task straight in a project (from a card, the Créer bar or the PAGE) */
function createIn(kind, spId) {
  const sp = spaceById(spId) || spaceById(DEF_SPACE);
  if (kind === 'note' || kind === 'board') { const d = newDoc(kind, { sp: sp.id }); setCurSpace(sp.id); go('doc:' + d.id); return d; }
  if (kind === 'mood') { setCurSpace(sp.id); go('mood'); }
}
/* the little task line used by the cards, the Créer bar and the PAGE: Enter adds, the star makes it a main task */
function taskAddHTML(o = {}) {
  return `<label class="tkadd${o.cls ? ' ' + o.cls : ''}"><i class="tkadd-o" aria-hidden="true"></i><input data-tkin placeholder="${esc(o.ph || 'Nouvelle tâche')}" aria-label="Nouvelle tâche" autocomplete="off"><button type="button" class="tkadd-st" data-tkstar aria-pressed="${o.star !== false}" title="Tâche principale : visible sur la carte du projet" aria-label="Tâche principale">${icon('star', 'sm')}</button></label>`;
}
function bindTaskAdd(box, spId, o = {}) {
  const inp = $('[data-tkin]', box), st = $('[data-tkstar]', box); if (!inp) return;
  st.onclick = e => { e.preventDefault(); st.setAttribute('aria-pressed', st.getAttribute('aria-pressed') !== 'true'); inp.focus(); };
  inp.onkeydown = e => {
    if (e.key === 'Escape') { e.preventDefault(); if (o.close) o.close(); return; }
    if (e.key !== 'Enter') return;
    e.preventDefault(); const v = inp.value.trim(); if (!v) { if (o.close) o.close(); return; }
    const t = newTask({ t: v, sp: spId, star: st.getAttribute('aria-pressed') === 'true' });
    inp.value = ''; if (o.added) o.added(t);
  };
}
function quickTaskPop(anchor, spId) {
  const sp = spaceById(spId) || spaceById(DEF_SPACE);
  const p = openPop(anchor, `<div class="tkpop"><div class="mh">Nouvelle tâche · ${esc(sp.name)}</div>${taskAddHTML({ star: sp.id !== DEF_SPACE })}<small>Entrée : ajouter · Échap : fermer</small></div>`, { cls: 'tkpopw', align: 'right' });
  bindTaskAdd(p, sp.id, { close: closePop, added: t => { refreshTaskViews(); toast(`Tâche ajoutée dans ${sp.name}`); } });
  $('[data-tkin]', p).focus();
}

/* ---------- the project page (0.2.70: the PAGE and the space home are one page, after the user's mockup) ----------
   Head (Espace, name, counts, + Note / + Board / + Tâche, cover on the right), then a grid: the Quick Note (the PAGE's
   own text, whose first lines are the card's synthesis) and the Tâches module on the left, the Moodboard on the right,
   then Boards et notes. The note editor itself is mounted by Note inside .pp2-qn; this fills the other slots. */
const PP_OPEN = '<section class="ppage" id="ppage"></section><div class="pp2-grid"><section class="pp2-mod pp2-qn"><div class="pp2-h">Quick Note</div>';
const PP_CLOSE = '</section><section class="pp2-mod pp2-tk" id="pptk"></section><aside class="pp2-mod pp2-mood" id="ppmood"></aside></div><section class="pp2-docs sp-docs" id="ppdocs"></section>';
/* the Quick Note as plain text (the card shows it and can edit it while the note is plain paragraphs) */
const pageText = d => { const t = document.createElement('div'); t.innerHTML = (d && d.html || '').replace(/<\/(p|div|h\d|li)>|<br\s*\/?>/gi, '\n'); return (t.textContent || '').replace(/ /g, ' ').replace(/\n{3,}/g, '\n\n').trim(); };
const pagePlain = d => !/<(?!\/?(p|br|div|span)\b)[a-z]/i.test(d && d.html || '');
const textHtml = t => t.split('\n').map(l => `<p>${l.trim() ? esc(l) : '<br>'}</p>`).join('');
/* the old Synthèse field moves into the Quick Note once */
function pageMigrateSynth(d) { if (d && d.synth && d.synth.trim()) { d.html = textHtml(d.synth.trim()) + (d.html || ''); d.synth = ''; touch(d); } }
function pageHeadHTML(d) {
  const sp = spaceById(d.sp); if (!sp) return '';
  const cov = sp.cover && Assets.url(sp.cover), st = projStats(sp), open = S.tasks.filter(t => t.sp === sp.id && !t.done).length, nm = (sp.media || []).length;
  const meta = [plural(open, 'tâche') + ' à faire', st.nB ? plural(st.nB, 'board') : '', st.nN ? plural(st.nN, 'note') : '', nm ? plural(nm, 'élément') + ' au moodboard' : ''].filter(Boolean).join(' · ');
  return `<div class="pp-hero pp2-hero${cov ? ' img' : ''}">${cov ? `<img src="${cov}" alt="" draggable="false">` : ''}
      <div class="pp2-id"><div class="sp-kick"><span class="sdot" style="background:${sp.color}"></span>Espace</div>
        <input class="sp-title" id="ppTitle" value="${esc(sp.name)}" aria-label="Nom du projet" spellcheck="false">
        <div class="pp2-sub"><span>${meta}</span><span class="pp-acts"><button data-pnew="note" title="Nouvelle note dans ${esc(sp.name)}">${icon('note', 'sm')}<span>+ Note</span></button><button data-pnew="board" title="Nouveau board dans ${esc(sp.name)}">${icon('board', 'sm')}<span>+ Board</span></button><button class="pri" data-pnew="task">${icon('tasks', 'sm')}<span>+ Tâche</span></button></span></div></div>
    </div>`;
}
function pageHead(el, d) {
  if (!el || !d) return;
  const sp = spaceById(d.sp); if (!sp) { el.innerHTML = ''; return; }
  const pal = projPal(sp.color), wrap = el.parentNode;
  wrap.style.cssText = `--pc1:${pal.c1};--pc2:${pal.c2};--pc3:${pal.c3}`;
  const keepT = document.activeElement && document.activeElement.id === 'ppTitle', keepAdd = document.activeElement && document.activeElement.id === 'pAdd';
  el.innerHTML = pageHeadHTML(d);
  const ti = $('#ppTitle', el);
  ti.onkeydown = e => { if (e.key === 'Enter') ti.blur(); if (e.key === 'Escape') { ti.value = sp.name; ti.blur(); } };
  ti.oninput = () => { const n = ti.value.trim(); if (n) { sp.name = n.slice(0, 60); d.title = sp.name; save(); renderSide(); } };
  ti.onblur = () => { if (!ti.value.trim()) ti.value = sp.name; };
  if (keepT) ti.focus();
  el.onclick = e => {
    const nw = e.target.closest('[data-pnew]'); if (nw) { if (nw.dataset.pnew === 'task') { const i = $('#pAdd'); if (i) { i.scrollIntoView({ block: 'center', behavior: 'smooth' }); i.focus({ preventScroll: true }); } } else createIn(nw.dataset.pnew, sp.id); return; }
  };
  /* the other slots are rebuilt as new elements so their listeners are bound once */
  const slot = (id, html, bind) => { const old = $('#' + id, wrap); if (!old) return; const n = old.cloneNode(false); n.innerHTML = html; old.replaceWith(n); if (bind) bind(n); };
  const tasks = S.tasks.filter(t => t.sp === sp.id), open = tasks.filter(t => !t.done).sort(taskSort), done = tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  slot('pptk', `<div class="pp2-h">Tâches <span class="ct">${open.length || ''}</span><button class="more" data-go="tasks" data-pcur>Tout voir</button></div>${quickAddBox('pAdd', 'Ajouter une tâche…', sp.id)}
      <div id="pTasks" class="tl-light" data-tlist data-sp="${sp.id}">${open.map(t => taskRow(t, { drag: true })).join('') || '<div class="empty sm">Rien à faire ici pour le moment.</div>'}</div>
      ${done.length ? `<details class="donegrp"><summary>${icon('chev', 'sm')}Terminées (${done.length})</summary><div>${done.map(t => taskRow(t)).join('')}</div></details>` : ''}`,
    n => { bindTaskList(n, refreshPageHead); bindQuickAdd($('#pAdd', n), () => { refreshTaskViews(); refreshPageHead(); }); n.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) { setCurSpace(sp.id); go(g.dataset.go); } }); });
  if (keepAdd) { const i = $('#pAdd', wrap); if (i) i.focus({ preventScroll: true }); }
  slot('ppmood', `<div class="pp2-h">Moodboard <span class="ct">${(sp.media || []).length || ''}</span><button class="more" data-pmood>Ouvrir</button></div>${Mood.preview(sp)}`,
    n => { Mood.bindPreview(n, sp); n.addEventListener('click', e => { if (e.target.closest('[data-pmood]')) { setCurSpace(sp.id); Mood.toggle(); } }); });
  const docs = liveDocs().filter(x => x.sp === sp.id && !x.page).sort((a, b) => b.updated - a.updated);
  slot('ppdocs', `<h2 class="sp-h">Boards et notes</h2><div class="docs"><button class="newcard" data-pnew="board">${icon('plus', 'lg')}Nouveau board</button><button class="newcard" data-pnew="note">${icon('plus', 'lg')}Nouvelle note</button>${docs.map(x => docCard(x)).join('')}</div>`,
    n => { bindDocCards(n); n.addEventListener('click', e => { const nw = e.target.closest('[data-pnew]'); if (nw) createIn(nw.dataset.pnew, sp.id); }); });
}
/* refresh the PAGE head when tasks change elsewhere */
function refreshPageHead() { const el = $('#ppage'); if (el && Note.mounted && isPage(Note.doc)) pageHead(el, Note.doc); }
