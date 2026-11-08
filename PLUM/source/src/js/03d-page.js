/* ================= PAGE du projet (0.2.53, HUB v2) =================
   Every project (user space) owns one PAGE: a note that cannot be deleted nor moved, with the id 'pg_' + space id
   (the same on every device, so sync never makes two). On top of its free notes it holds:
   - the Synthèse (d.synth), the text shown on the project card of the HUB;
   - the Tâches principales = the project's starred tasks (t.star), shown on the card (open ones first).
   The card's ↗ and its synthesis open the PAGE. */
const pageId = sp => 'pg_' + sp.id;
const isPage = d => !!(d && d.page);
function ensurePage(sp) {
  if (!sp || sp.id === DEF_SPACE) return null;
  let d = docById(pageId(sp));
  if (!d) {
    d = { id: pageId(sp), type: 'note', page: 1, title: sp.name, sp: sp.id, synth: '', html: '', ink: [], paper: 'plain', fav: false, trash: false, created: sp.created || 1, updated: Date.now() };
    S.docs.push(d); save();
  } else if (d.trash || d.sp !== sp.id || !d.page) { d.trash = false; d.sp = sp.id; d.page = 1; save(); }
  return d;
}
function ensurePages() { for (const sp of userSpaces()) ensurePage(sp); }
const pageOf = sp => sp && sp.id !== DEF_SPACE ? docById(pageId(sp)) || ensurePage(sp) : null;
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

/* ---------- the PAGE's head, above its free notes (mounted by Note when the doc is a PAGE) ---------- */
function pageHeadHTML(d) {
  const sp = spaceById(d.sp); if (!sp) return '';
  const pal = projPal(sp.color), cov = sp.cover && Assets.url(sp.cover), st = projStats(sp);
  const star = S.tasks.filter(t => t.sp === sp.id && t.star), open = star.filter(t => !t.done).sort(taskSort), done = star.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const others = S.tasks.filter(t => t.sp === sp.id && !t.star && !t.done).sort(taskSort);
  const row = t => `<div class="pp-tr${t.done ? ' done' : ''}"><button class="pp-ck" data-pdone="${t.id}" role="checkbox" aria-checked="${t.done}" aria-label="Terminer">${icon('check', 'sm')}</button><span class="pp-tt">${esc(t.t)}</span><button class="pp-st on" data-pstar="${t.id}" title="Retirer des tâches principales" aria-label="Retirer des tâches principales">${icon('star', 'sm')}</button></div>`;
  const docs = st.docs.slice().sort((a, b) => b.updated - a.updated);
  const imgs = spaceMedia(sp.id).filter(x => x.asset && (x.type === 'image' || /^image\//.test(x.mime || '')) && Assets.has(x.asset)).slice(0, 5);
  const ini = esc(((sp.name || '?').trim()[0] || '?').toUpperCase());
  return `<div class="pp-hero${cov ? ' img' : ''}">${cov ? `<img src="${cov}" alt="" draggable="false">` : ''}
      <button class="pp-back" data-go="hub">${icon('chev', 'sm flip')}HUB</button>
      <div class="pp-id"><span class="pp-tile">${ini}</span><div><span class="pp-lab">${icon('lock', 'sm')}PAGE du projet</span><h1>${esc(sp.name)}</h1></div></div>
      <div class="pp-acts"><button data-pnew="note" title="Nouvelle note dans ${esc(sp.name)}">${icon('note', 'sm')}<span>+ Note</span></button><button data-pnew="board" title="Nouveau board dans ${esc(sp.name)}">${icon('board', 'sm')}<span>+ Board</span></button><button class="pri" data-pnew="task">${icon('tasks', 'sm')}<span>+ Tâche</span></button></div>
    </div>
    <div class="pp-grid">
      <div class="pp-main">
        <section class="pp-box pp-syn"><div class="pp-h">Synthèse<span class="pp-pill">${icon('eye', 'sm')}Affichée sur la carte</span></div>
          <textarea data-psyn rows="2" placeholder="En quelques lignes : de quoi parle le projet, où il en est, la prochaine étape…" aria-label="Synthèse du projet">${esc(d.synth || '')}</textarea></section>
        <section class="pp-box pp-tk"><div class="pp-h">${icon('star', 'sm')}Tâches principales<small>${star.length ? `${done.length} / ${star.length} faites` : 'les premières vont sur la carte'}</small></div>
          <div class="pp-list">${open.concat(done).map(row).join('')}</div>
          ${taskAddHTML({ cls: 'pp-add', ph: 'Ajouter une tâche principale…' })}
          ${others.length ? `<details class="pp-oth"><summary>Autres tâches du projet (${others.length})</summary>${others.map(t => `<div class="pp-tr"><span class="pp-tt">${esc(t.t)}</span><button class="pp-st" data-pstar="${t.id}" title="Mettre dans les tâches principales" aria-label="Mettre dans les tâches principales">${icon('star', 'sm')}</button></div>`).join('')}</details>` : ''}
        </section>
        <div class="pp-free">Notes libres</div>
      </div>
      <aside class="pp-side">
        <div class="pp-h">Dans ce projet</div>
        <div class="pp-stats"><button data-go="space:${sp.id}"><b>${st.nN}</b><span>note${st.nN > 1 ? 's' : ''}</span></button><button data-go="space:${sp.id}"><b>${st.nB}</b><span>board${st.nB > 1 ? 's' : ''}</span></button><button data-go="tasks" data-pcur><b>${st.nT}</b><span>tâche${st.nT > 1 ? 's' : ''}</span></button></div>
        ${docs.length ? `<div class="pp-docs">${docs.slice(0, 5).map(x => `<button data-go="doc:${x.id}">${icon(x.type === 'board' ? 'board' : 'note', 'sm')}<span>${esc(x.title)}</span><small>${x.type === 'board' ? 'board' : 'note'}</small></button>`).join('')}${docs.length > 5 ? `<button class="all" data-go="space:${sp.id}">Tout voir (${docs.length})</button>` : ''}</div>` : ''}
        <div class="pp-h">Moodboard</div>
        <div class="pp-mood">${imgs.map(x => `<button data-pmood><img src="${Assets.url(x.asset)}" alt="" draggable="false"></button>`).join('')}<button class="add" data-pmood>${icon('plus', 'sm')}${imgs.length ? 'Ouvrir' : 'Déposer'}</button></div>
      </aside>
    </div>`;
}
function pageHead(el, d) {
  if (!el || !d) return;
  const sp = spaceById(d.sp); if (!sp) { el.innerHTML = ''; return; }
  const pal = projPal(sp.color);
  el.style.cssText = `--pc1:${pal.c1};--pc2:${pal.c2};--pc3:${pal.c3}`;
  const ta0 = $('[data-psyn]', el), keepSyn = ta0 && document.activeElement === ta0, ad0 = $('.pp-add [data-tkin]', el), keepAdd = ad0 && document.activeElement === ad0;
  el.innerHTML = pageHeadHTML(d);
  const ta = $('[data-psyn]', el), grow = () => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
  ta.oninput = () => { d.synth = ta.value; touch(d); grow(); };
  requestAnimationFrame(grow);
  if (keepSyn) { ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); }
  bindTaskAdd($('.pp-add', el), sp.id, { added: () => { refreshTaskViews(); pageHead(el, d); const i = $('.pp-add [data-tkin]', el); if (i) i.focus(); } });
  if (keepAdd) $('.pp-add [data-tkin]', el).focus();
  el.onclick = e => {
    const nw = e.target.closest('[data-pnew]'); if (nw) { if (nw.dataset.pnew === 'task') { const i = $('.pp-add [data-tkin]', el); i.scrollIntoView({ block: 'center', behavior: 'smooth' }); i.focus(); } else createIn(nw.dataset.pnew, sp.id); return; }
    const dn = e.target.closest('[data-pdone]'); if (dn) { const t = taskById(dn.dataset.pdone); if (t) { setTaskDone(t, !t.done); pageHead(el, d); } return; }
    const sr = e.target.closest('[data-pstar]'); if (sr) { const t = taskById(sr.dataset.pstar); if (t) { t.star = !t.star; save(); refreshTaskViews(); pageHead(el, d); } return; }
    if (e.target.closest('[data-pmood]')) { setCurSpace(sp.id); Mood.toggle(); return; }
    const g = e.target.closest('[data-go]'); if (g) { if (g.hasAttribute('data-pcur')) setCurSpace(sp.id); go(g.dataset.go); }
  };
}
/* refresh the PAGE head when tasks change elsewhere */
function refreshPageHead() { const el = $('#ppage'); if (el && Note.mounted && isPage(Note.doc)) pageHead(el, Note.doc); }
