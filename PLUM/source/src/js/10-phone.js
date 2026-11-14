/* ================= iPhone (0.3.24) =================
   The same app on a phone gets its own interface, drawn here, on the same data (S, persist, Sync):
   - four tabs at the bottom: Notes, Tâches, Espaces, Recherche; the round button above them creates what the tab shows;
   - a note, a space or a list opens as a screen pushed from the right (back button or a swipe from the left edge);
   - a task, a choice of space, the settings open as sheets from the bottom.
   No boards on the phone (they stay on the PC and the iPad), and only the main theme (Minimal), light or dark.
   The note editor is the app's own (Note.mount, { bare } so a project's Quick Note opens as a plain note). */
const Phone = (() => {
  const TABS = [['notes', 'notes', 'Notes'], ['tasks', 'tasks', 'Tâches'], ['spaces', 'folder', 'Espaces'], ['search', 'search', 'Recherche']];
  let root, main, tabbar, fab, tab = 'notes', stack = [], sheetEl = null;
  const scrollOf = {};
  const P = () => S.prefs.ph || (S.prefs.ph = { nf: '', tf: '', tdone: false });
  const notes = () => liveDocs().filter(d => d.type === 'note' && !d.page);
  const spName = id => { const s = spaceById(id); return s ? s.name : DEF_NAME; };
  const dot = id => { const s = spaceById(id); return `<i class="ph-dot${!s || s.id === DEF_SPACE ? ' none' : ''}" style="${s && s.id !== DEF_SPACE ? `background:${s.color}` : ''}"></i>`; };
  const plain = s => String(s || '').replace(/\s+/g, ' ').trim();
  const haptic = () => { try { navigator.vibrate && navigator.vibrate(8); } catch (e) {} };

  /* ---------- shell ---------- */
  async function boot() {
    applyTheme();
    root = document.createElement('div'); root.id = 'ph';
    root.innerHTML = `<main class="ph-main"></main>
      <button class="ph-fab" aria-label="Créer">${icon('plus')}</button>
      <nav class="ph-tabbar" aria-label="Sections">${TABS.map(([k, ic, l]) => `<button data-tab="${k}" aria-label="${l}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>`;
    document.body.append(root);
    main = $('.ph-main', root); tabbar = $('.ph-tabbar', root); fab = $('.ph-fab', root);
    tabbar.onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; if (b.dataset.tab === tab && !stack.length) { const sc = $('.ph-scroll', main); if (sc) sc.scrollTo({ top: 0, behavior: 'smooth' }); return; } popAll(); setTab(b.dataset.tab); };
    fab.onclick = () => { haptic(); create(); };
    root.addEventListener('click', onClick);
    bindSwipes(root); bindEdgeBack(); bindKeyboard();
    mqDark.addEventListener('change', () => { applyTheme(); statusBar(); });
    const flush = () => { try { window.__flushSave(); } catch (e) {} };
    addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); else if (!stack.length) render(); });
    window.__nh = { S: () => S, Sync, Assets, Phone: api, save, applyTheme, newTask, createSpace };
    tab = TABS.some(t => t[0] === P().tab) ? P().tab : 'notes';
    setTab(tab); statusBar();
    try { await Promise.race([document.fonts.ready, new Promise(r => setTimeout(r, 1200))]); } catch (e) {}
  }
  /* the status bar of the shell follows light / dark */
  function statusBar() { try { window.webkit.messageHandlers.hubUI.postMessage({ bar: isDarkTheme() ? 'light' : 'dark', bg: getComputedStyle(document.body).backgroundColor }); } catch (e) {} }
  function setTab(k) {
    const sc = $('.ph-scroll', main); if (sc) scrollOf[tab] = sc.scrollTop;
    tab = k; P().tab = k; save();
    for (const b of $$('[data-tab]', tabbar)) b.setAttribute('aria-current', b.dataset.tab === k ? 'page' : 'false');
    render(true);
  }
  function render(fresh) {
    const sc = $('.ph-scroll', main), keep = !fresh && sc ? sc.scrollTop : (scrollOf[tab] || 0);
    main.innerHTML = tab === 'notes' ? notesTab() : tab === 'tasks' ? tasksTab() : tab === 'spaces' ? spacesTab() : searchTab();
    fab.hidden = tab === 'search';
    fab.setAttribute('aria-label', tab === 'tasks' ? 'Nouvelle tâche' : tab === 'spaces' ? 'Nouvel espace' : 'Nouvelle note');
    const sc2 = $('.ph-scroll', main); bindLargeTitle(sc2); sc2.scrollTop = keep;
    if (tab === 'search') bindSearch();
  }
  /* the large title shrinks into the bar once the list scrolls under it */
  function bindLargeTitle(sc) {
    const bar = sc.parentNode.querySelector('.ph-bar'); if (!bar) return;
    const upd = () => bar.classList.toggle('small', sc.scrollTop > 38);
    sc.addEventListener('scroll', upd, { passive: true }); upd();
  }
  const head = (title, o = {}) => `<header class="ph-bar${o.back ? ' sub' : ''}">
      ${o.back ? `<button class="ph-back" data-back>${icon('chev', 'flip')}<span>${esc(o.back)}</span></button>` : '<span class="ph-bar-l"></span>'}
      <b class="ph-bar-t">${esc(title)}</b>
      <span class="ph-bar-r">${o.right || `<button class="ph-ib" data-act="settings" aria-label="Réglages">${icon('gear')}</button>`}</span></header>`;
  const large = (title, sub = '') => `<div class="ph-large"><h1>${esc(title)}</h1>${sub ? `<p>${sub}</p>` : ''}</div>`;

  /* ---------- Notes ---------- */
  function noteRow(d, o = {}) {
    const txt = plain(docText(d)), th = noteThumb(d);
    return `<div class="ph-sw" data-swipe="note:${d.id}"><div class="ph-sw-acts"><button data-act="fav" data-id="${d.id}" class="fav">${icon('star')}<span>${d.fav ? 'Retirer' : 'Favori'}</span></button><button data-act="trash" data-id="${d.id}" class="del">${icon('trash')}<span>Supprimer</span></button></div>
      <button class="ph-note" data-open="note:${d.id}">
        <span class="ph-note-tx"><b>${d.fav ? `<span class="ph-favmark">${icon('star', 'sm')}</span>` : ''}${esc(d.title || 'Sans titre')}</b>
          <span class="ph-note-p">${txt ? esc(txt.slice(0, 180)) : '<i>Note vide</i>'}</span>
          <small>${nlDate(d.updated)}${o.sp !== false ? `<span class="ph-sep"></span>${dot(d.sp)}${esc(spName(d.sp))}` : ''}</small></span>
        ${th ? `<span class="ph-note-th">${th}</span>` : ''}</button></div>`;
  }
  function noteFilterChips() {
    const f = P().nf, chip = (k, label, extra = '') => `<button class="ph-chip" data-nf="${k}" aria-pressed="${f === k}">${extra}${esc(label)}</button>`;
    return `<div class="ph-chips">${chip('', 'Toutes')}${chip('fav', 'Favoris', icon('star', 'sm'))}${userSpaces().map(s => chip(s.id, s.name, `<i class="ph-dot" style="background:${s.color}"></i>`)).join('')}${chip(DEF_SPACE, DEF_NAME, '<i class="ph-dot none"></i>')}</div>`;
  }
  function notesTab() {
    const f = P().nf; if (f && f !== 'fav' && !spaceById(f)) P().nf = '';
    const list = notes().filter(d => !P().nf || (P().nf === 'fav' ? d.fav : d.sp === P().nf)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const n = notes().length;
    return `${head('Notes')}<div class="ph-scroll">${large('Notes', n ? plural(n, 'note') : '')}
      ${n ? noteFilterChips() : ''}
      <div class="ph-list">${list.map(d => noteRow(d)).join('') || (n ? `<div class="ph-empty"><p>Rien ici pour ce filtre.</p></div>` : emptyNotes())}</div><div class="ph-pad"></div></div>`;
  }
  const emptyNotes = () => `<div class="ph-empty big"><span class="ph-plume"></span><h2>Une page blanche</h2><p>Écris ta première note avec le bouton +. Elle se range où tu veux, ou nulle part.</p></div>`;

  /* ---------- Tâches ---------- */
  function taskGroups(list) {
    const t0 = today(), G = [['late', 'En retard'], ['today', "Aujourd'hui"], ['tom', 'Demain'], ['week', 'Cette semaine'], ['later', 'Plus tard'], ['none', 'Sans date']];
    const at = t => { if (!t.due) return 'none'; const d = dayDiff(t0, t.due); return d < 0 ? 'late' : d === 0 ? 'today' : d === 1 ? 'tom' : d < 7 ? 'week' : 'later'; };
    const by = {}; for (const t of list) (by[at(t)] = by[at(t)] || []).push(t);
    return G.filter(([k]) => by[k]).map(([k, l]) => ({ k, l, list: by[k].sort((a, b) => (a.due || '').localeCompare(b.due || '') || (b.star - a.star) || taskSort(a, b)) }));
  }
  function taskRowP(t, o = {}) {
    const di = dueInfo(t.due), sc = subCount(t);
    const meta = [di ? `<span class="due ${di.cls}">${icon('cal', 'sm')}${esc(di.cls === 'soon' || di.cls === 'today' || di.cls === 'tomorrow' ? di.label : fmtShort(t.due))}${t.time ? ' ' + esc(t.time) : ''}</span>` : '',
      sc ? `<span>${icon('chk', 'sm')}${sc}</span>` : '', t.note ? `<span>${icon('note', 'sm')}</span>` : '', o.sp !== false ? `<span>${dot(t.sp)}${esc(spName(t.sp))}</span>` : ''].filter(Boolean).join('');
    return `<div class="ph-sw" data-swipe="task:${t.id}"><div class="ph-sw-acts"><button data-act="tomorrow" data-id="${t.id}" class="later">${icon('cal')}<span>Demain</span></button><button data-act="deltask" data-id="${t.id}" class="del">${icon('trash')}<span>Supprimer</span></button></div>
      <div class="ph-task${t.done ? ' done' : ''}" data-task="${t.id}">
        <button class="ph-ck" data-act="check" data-id="${t.id}" role="checkbox" aria-checked="${t.done}" aria-label="Terminer">${icon('check')}</button>
        <button class="ph-task-b" data-open="task:${t.id}"><b>${esc(t.t)}</b>${meta ? `<small>${meta}</small>` : ''}</button>
        ${t.star ? `<span class="ph-star" aria-label="Importante">${icon('star', 'sm')}</span>` : ''}</div></div>`;
  }
  function tasksTab() {
    const f = P().tf; if (f && !spaceById(f)) P().tf = '';
    const all = S.tasks.filter(t => !P().tf || t.sp === P().tf), open = all.filter(t => !t.done), done = all.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
    const now = new Date(), sub = `${cap1(WD[now.getDay()])} ${now.getDate()} ${MO[now.getMonth()]}`;
    const chip = (k, label, extra = '') => `<button class="ph-chip" data-tf="${k}" aria-pressed="${P().tf === k}">${extra}${esc(label)}</button>`;
    const chips = S.tasks.length ? `<div class="ph-chips">${chip('', 'Tout')}${userSpaces().map(s => chip(s.id, s.name, `<i class="ph-dot" style="background:${s.color}"></i>`)).join('')}${chip(DEF_SPACE, DEF_NAME, '<i class="ph-dot none"></i>')}</div>` : '';
    const groups = taskGroups(open).map(g => `<section class="ph-grp g-${g.k}"><h3>${g.l}<span>${g.list.length}</span></h3><div class="ph-list">${g.list.map(t => taskRowP(t)).join('')}</div></section>`).join('');
    return `${head('Tâches')}<div class="ph-scroll">${large('Tâches', sub)}${chips}
      ${groups || (S.tasks.length ? `<div class="ph-empty"><p>Tout est fait.</p></div>` : `<div class="ph-empty big"><span class="ph-plume"></span><h2>Rien à faire</h2><p>Ajoute une tâche avec le bouton +, avec une date si elle en a une.</p></div>`)}
      ${done.length ? `<section class="ph-grp g-done"><button class="ph-donebtn" data-act="tdone" aria-expanded="${!!P().tdone}">${icon('chev')}Terminées<span>${done.length}</span></button>${P().tdone ? `<div class="ph-list">${done.slice(0, 60).map(t => taskRowP(t)).join('')}</div>` : ''}</section>` : ''}
      <div class="ph-pad"></div></div>`;
  }

  /* ---------- Espaces ---------- */
  function spaceCover(s) { const u = s.cover && Assets.url(s.cover); return u ? `<img src="${u}" alt="">` : `<span>${esc((s.name || '?').trim().slice(0, 1).toUpperCase())}</span>`; }
  function spaceCount(s) {
    const nN = notes().filter(d => d.sp === s.id).length, nT = S.tasks.filter(t => t.sp === s.id && !t.done).length;
    return [nN ? plural(nN, 'note') : '', nT ? `${nT} tâche${nT > 1 ? 's' : ''} à faire` : ''].filter(Boolean).join(', ') || 'Vide';
  }
  function spacesTab() {
    const us = userSpaces(), def = spaceById(DEF_SPACE);
    return `${head('Espaces')}<div class="ph-scroll">${large('Espaces', us.length ? plural(us.length, 'projet') : '')}
      <div class="ph-spaces">${us.map(s => `<button class="ph-space" data-open="space:${s.id}" style="--sc:${s.color}"><span class="ph-space-cv">${spaceCover(s)}</span><span class="ph-space-tx"><b>${esc(s.name)}</b><small>${spaceCount(s)}</small></span>${icon('chev', 'ph-go')}</button>`).join('')}</div>
      ${us.length ? '' : `<div class="ph-empty"><p>Un espace réunit les notes et les tâches d’un même projet. Crée le premier avec le bouton +.</p></div>`}
      <div class="ph-spaces small"><button class="ph-space" data-open="space:${DEF_SPACE}" style="--sc:var(--ink-3)"><span class="ph-space-cv">${icon('inbox')}</span><span class="ph-space-tx"><b>${DEF_NAME}</b><small>${spaceCount(def)}</small></span>${icon('chev', 'ph-go')}</button>
      <button class="ph-space" data-open="favs" style="--sc:var(--warn)"><span class="ph-space-cv">${icon('star')}</span><span class="ph-space-tx"><b>Favoris</b><small>${plural(notes().filter(d => d.fav).length, 'note')}</small></span>${icon('chev', 'ph-go')}</button>
      <button class="ph-space" data-open="trash" style="--sc:var(--ink-3)"><span class="ph-space-cv">${icon('trash')}</span><span class="ph-space-tx"><b>Corbeille</b><small>${plural(S.docs.filter(d => d.trash && d.type === 'note').length, 'note')}</small></span>${icon('chev', 'ph-go')}</button></div>
      <div class="ph-pad"></div></div>`;
  }
  function spaceScreen(id) {
    const s = spaceById(id); if (!s) return null;
    const isDef = s.id === DEF_SPACE, pg = isDef ? null : pageOf(s);
    const nl = notes().filter(d => d.sp === s.id).sort((a, b) => (b.updated || 0) - (a.updated || 0));
    const open = S.tasks.filter(t => t.sp === s.id && !t.done).sort(taskSort), nDone = S.tasks.filter(t => t.sp === s.id && t.done).length;
    const boxes = boxesOf(s), loose = open.filter(t => !t.box || !tboxOf(s, t.box));
    const qn = pg ? plain(docText(pg)) : '';
    const cov = s.cover && Assets.url(s.cover);
    return `${head(s.name, { back: 'Espaces', right: isDef ? '<span></span>' : `<button class="ph-ib" data-act="spmenu" data-id="${s.id}" aria-label="Options de l’espace">${icon('dots')}</button>` })}
      <div class="ph-scroll"><div class="ph-hero${cov ? ' cov' : ''}" style="--sc:${isDef ? 'var(--ink-3)' : s.color}">${cov ? `<img src="${cov}" alt="">` : ''}<div class="ph-hero-tx"><h1>${esc(s.name)}</h1><p>${spaceCount(s)}</p></div></div>
      ${pg ? `<button class="ph-qn" data-open="note:${pg.id}"><small>Quick Note</small><span>${qn ? esc(qn.slice(0, 260)) : '<i>Les idées du projet, en vrac. Touche pour écrire.</i>'}</span></button>` : ''}
      <section class="ph-sec"><h2>Tâches${open.length ? `<span>${open.length}</span>` : ''}</h2>
        <form class="ph-add" data-addtask="${s.id}"><span class="ph-ck ghost">${icon('plus')}</span><input placeholder="Ajouter une tâche" enterkeyhint="done" autocomplete="off"></form>
        <div class="ph-list">${loose.map(t => taskRowP(t, { sp: false })).join('')}</div>
        ${boxes.map(b => { const bl = open.filter(t => t.box === b.id); return bl.length ? `<h4 class="ph-box">${esc(b.t || 'Liste')}</h4><div class="ph-list">${bl.map(t => taskRowP(t, { sp: false })).join('')}</div>` : ''; }).join('')}
        ${nDone ? `<p class="ph-note-done">${plural(nDone, 'tâche')} terminée${nDone > 1 ? 's' : ''}</p>` : ''}</section>
      <section class="ph-sec"><h2>Notes${nl.length ? `<span>${nl.length}</span>` : ''}<button class="ph-link" data-act="newnote" data-id="${s.id}">${icon('plus', 'sm')}Note</button></h2>
        <div class="ph-list">${nl.map(d => noteRow(d, { sp: false })).join('') || '<p class="ph-muted">Pas encore de note ici.</p>'}</div></section>
      <div class="ph-pad"></div></div>`;
  }
  function listScreen(kind) {
    if (kind === 'favs') { const l = notes().filter(d => d.fav).sort((a, b) => b.updated - a.updated); return `${head('Favoris', { back: 'Espaces' })}<div class="ph-scroll">${large('Favoris')}<div class="ph-list">${l.map(d => noteRow(d)).join('') || '<div class="ph-empty"><p>Glisse une note vers la gauche puis touche Favori pour la retrouver ici.</p></div>'}</div><div class="ph-pad"></div></div>`; }
    const l = S.docs.filter(d => d.trash && d.type === 'note').sort((a, b) => b.updated - a.updated);
    return `${head('Corbeille', { back: 'Espaces' })}<div class="ph-scroll">${large('Corbeille')}<div class="ph-list">${l.map(d => `<div class="ph-trashrow"><span><b>${esc(d.title || 'Sans titre')}</b><small>${nlDate(d.updated)}</small></span><button class="ph-pill" data-act="restore" data-id="${d.id}">Restaurer</button></div>`).join('') || '<div class="ph-empty"><p>La corbeille est vide.</p></div>'}</div><div class="ph-pad"></div></div>`;
  }

  /* ---------- Recherche ---------- */
  function searchTab() {
    return `<div class="ph-scroll"><div class="ph-large"><h1>Recherche</h1></div>
      <div class="ph-search">${icon('search')}<input type="search" id="phQ" placeholder="Notes, tâches, espaces" autocomplete="off" enterkeyhint="search" value="${esc(P().q || '')}"></div>
      <div id="phRes"></div><div class="ph-pad"></div></div>`;
  }
  function bindSearch() {
    const q = $('#phQ'), out = $('#phRes');
    const run = () => {
      P().q = q.value; const r = searchAll(q.value).filter(x => x.kind !== 'board' && !(x.kind === 'note' && isPage(docById(x.id))));
      if (!q.value.trim()) { const rec = notes().sort((a, b) => b.updated - a.updated).slice(0, 6); out.innerHTML = rec.length ? `<h3 class="ph-h3">Récentes</h3><div class="ph-list">${rec.map(d => noteRow(d)).join('')}</div>` : ''; return; }
      const grp = (k, l) => { const x = r.filter(i => i.kind === k); return x.length ? `<h3 class="ph-h3">${l}</h3><div class="ph-list">${x.map(i => k === 'note' ? noteRow(docById(i.id)) : k === 'task' ? taskRowP(taskById(i.id)) : `<button class="ph-space" data-open="space:${i.id}" style="--sc:${spaceColor(i.id)}"><span class="ph-space-cv">${spaceCover(spaceById(i.id))}</span><span class="ph-space-tx"><b>${esc(i.title)}</b><small>${spaceCount(spaceById(i.id))}</small></span>${icon('chev', 'ph-go')}</button>`).join('')}</div>` : ''; };
      out.innerHTML = (grp('space', 'Espaces') + grp('note', 'Notes') + grp('task', 'Tâches')) || `<div class="ph-empty"><p>Aucun résultat pour « ${esc(q.value)} ».</p></div>`;
    };
    q.oninput = debounce(run, 120); run();
  }

  /* ---------- pushed screens ---------- */
  function push(kind, id) {
    const el = document.createElement('section'); el.className = 'ph-scr in'; el.dataset.kind = kind; if (id) el.dataset.id = id;
    const fr = { kind, id, el, from: stack.length ? stack[stack.length - 1] : null };
    if (kind === 'note' && !drawNote(fr)) return;
    if (kind === 'space') { const h = spaceScreen(id); if (!h) return; el.innerHTML = h; }
    if (kind === 'favs' || kind === 'trash') el.innerHTML = listScreen(kind);
    if (fr.from) fr.from.el.classList.add('under'); else main.classList.add('under');
    root.append(el); stack.push(fr);
    if (kind !== 'note') { bindLargeTitle($('.ph-scroll', el)); }
    root.classList.add('pushed'); requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('in')));
  }
  function pop(instant) {
    const fr = stack.pop(); if (!fr) return;
    if (fr.kind === 'note') closeNote(fr);
    const below = stack.length ? stack[stack.length - 1].el : main;
    below.classList.remove('under');
    if (!stack.length) root.classList.remove('pushed');
    if (instant) fr.el.remove(); else { fr.el.classList.add('in'); setTimeout(() => fr.el.remove(), 320); }
    refreshBelow();
  }
  function popAll() { while (stack.length) pop(true); }
  /* what is under the popped screen is drawn again (a note's title or a task may have changed) */
  function refreshBelow() {
    const top = stack[stack.length - 1];
    if (!top) { render(); return; }
    redrawFrame(top);
  }
  function redrawFrame(fr) {
    const sc = $('.ph-scroll', fr.el), y = sc ? sc.scrollTop : 0;
    if (fr.kind === 'space') { const h = spaceScreen(fr.id); if (!h) { pop(true); return; } fr.el.innerHTML = h; }
    else if (fr.kind === 'favs' || fr.kind === 'trash') fr.el.innerHTML = listScreen(fr.kind);
    else return;
    const sc2 = $('.ph-scroll', fr.el); if (sc2) { bindLargeTitle(sc2); sc2.scrollTop = y; }
  }

  /* ---------- a note ---------- */
  const FMT = [['h2', '<span class="ph-tt">Titre</span>', 'Titre'], ['bold', icon('bold'), 'Gras'], ['italic', icon('ital'), 'Italique'], ['ul', icon('list'), 'Liste'], ['ol', icon('olist'), 'Liste numérotée'], ['chk', icon('chk'), 'Cases à cocher'], ['image', icon('image'), 'Photo ou fichier']];
  function drawNote(fr) {
    const d = docById(fr.id); if (!d || d.trash) return false;
    if (Note.mounted) { const o = stack.find(f => f.kind === 'note'); if (o) closeNote(o); else Note.unmount(); }
    const back = fr.from ? (fr.from.kind === 'space' ? spName(fr.from.id) : fr.from.kind === 'favs' ? 'Favoris' : 'Retour') : (tab === 'tasks' ? 'Tâches' : tab === 'spaces' ? 'Espaces' : tab === 'search' ? 'Recherche' : 'Notes');
    fr.el.innerHTML = `<header class="ph-bar sub small note"><button class="ph-back" data-back>${icon('chev', 'flip')}<span>${esc(back)}</span></button><b class="ph-bar-t"></b>
      <span class="ph-bar-r">${d.page ? '' : `<button class="ph-ib${d.fav ? ' on' : ''}" data-act="nfav" aria-label="Favori" aria-pressed="${!!d.fav}">${icon('star')}</button>`}<button class="ph-ib" data-act="nmenu" aria-label="Options de la note">${icon('dots')}</button><button class="ph-done" data-act="kbd">OK</button></span></header>
      <div class="ph-scroll ph-nsc">${d.page ? '' : `<button class="ph-file" data-act="file">${dot(d.sp)}<span>${esc(spName(d.sp))}</span>${icon('chevd', 'sm')}</button>`}<div class="ph-nhost"></div><div class="ph-pad"></div></div>
      <div class="ph-fmt" role="toolbar" aria-label="Mise en forme">${FMT.map(([c, ic, l]) => `<button data-fmt="${c}" aria-label="${l}">${ic}</button>`).join('')}</div>`;
    const sc = $('.ph-nsc', fr.el), host = $('.ph-nhost', fr.el);
    Note.mount(host, d, { scroller: sc, bare: true, onChange: () => {} });
    R = { name: 'doc', id: d.id }; unmountView = () => Note.unmount();
    const fmt = $('.ph-fmt', fr.el);
    fmt.addEventListener('pointerdown', e => { if (e.target.closest('[data-fmt]')) e.preventDefault(); });
    fmt.addEventListener('click', e => { const b = e.target.closest('[data-fmt]'); if (!b) return; haptic(); Note.cmd(b.dataset.fmt); });
    // a new note opens with the keyboard on its text
    if (fr.fresh) setTimeout(() => { const t = $('.ntitle', host); if (t) { t.focus(); t.select(); } }, 340);
    return true;
  }
  function closeNote(fr) {
    if (Note.mounted) { Note.flush(); Note.unmount(); }
    unmountView = null; R = { name: 'ph' };
    const d = docById(fr.id);
    // an untouched new note goes away by itself
    if (d && !d.page && !d.trash && fr.fresh && !plain(docText(d)) && (!d.title || d.title === 'Sans titre') && !(d.ink || []).length) { S.docs.splice(S.docs.indexOf(d), 1); persist(); }
    else persist();
  }
  function newNote(spId) {
    const sp = spId || (P().nf && spaceById(P().nf) ? P().nf : DEF_SPACE);
    const d = newDoc('note', { sp }); if (P().nf === 'fav') d.fav = true;
    pushFresh(d.id);
  }
  function pushFresh(id) {
    const el = document.createElement('section'); el.className = 'ph-scr in'; el.dataset.kind = 'note';
    const fr = { kind: 'note', id, el, from: stack.length ? stack[stack.length - 1] : null, fresh: true };
    if (!drawNote(fr)) return;
    if (fr.from) fr.from.el.classList.add('under'); else main.classList.add('under');
    root.append(el); stack.push(fr); root.classList.add('pushed');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('in')));
  }
  function noteMenu(d) {
    sheet({ title: d.title || 'Sans titre', items: [
      ...(d.page ? [] : [{ label: 'Ranger dans…', icon: 'folder', run: () => fileSheet(d) }]),
      ...(d.page ? [] : [{ label: d.fav ? 'Retirer des favoris' : 'Ajouter aux favoris', icon: 'star', run: () => { d.fav = !d.fav; touch(d); syncNoteBar(); } }]),
      { label: 'Partager le texte', icon: 'send', run: () => shareNote(d) },
      ...(d.page ? [] : [{ label: 'Supprimer la note', icon: 'trash', danger: true, run: () => { trashP(d); pop(); } }])] });
  }
  function syncNoteBar() {
    const fr = stack.find(f => f.kind === 'note'); if (!fr) return; const d = docById(fr.id); if (!d) return;
    const st = $('[data-act="nfav"]', fr.el); if (st) { st.classList.toggle('on', !!d.fav); st.setAttribute('aria-pressed', !!d.fav); }
    const f = $('.ph-file', fr.el); if (f) f.innerHTML = `${dot(d.sp)}<span>${esc(spName(d.sp))}</span>${icon('chevd', 'sm')}`;
  }
  async function shareNote(d) {
    const text = `${d.title || ''}\n\n${Note.mounted ? Note.text() : docText(d)}`.trim();
    try { if (navigator.share) { await navigator.share({ title: d.title, text }); return; } } catch (e) { return; }
    try { await navigator.clipboard.writeText(text); toast('Texte copié'); } catch (e) { toast('Partage indisponible ici'); }
  }
  function fileSheet(d) {
    const item = s => ({ label: s.name, dot: s.id === DEF_SPACE ? '' : s.color, icon: s.id === DEF_SPACE ? 'inbox' : '', on: s.id === d.sp, run: () => { if (d.sp === s.id) return; d.sp = s.id; touch(d); syncNoteBar(); toast(s.id === DEF_SPACE ? 'Retirée des espaces' : `Rangée dans ${s.name}`); if (!stack.some(f => f.kind === 'note')) refreshAll(); } });
    sheet({ title: 'Ranger dans', items: [...userSpaces().map(item), item(spaceById(DEF_SPACE)), { label: 'Nouvel espace…', icon: 'plus', run: () => askName('Nouvel espace', '', n => { const sp = createSpace(n, { stay: true }); item(sp).run(); }) }] });
  }
  function trashP(d) {
    d.trash = true; touch(d);
    toast('Mise à la corbeille', { label: 'Annuler', run: () => { d.trash = false; touch(d); refreshAll(); } });
  }

  /* ---------- a task (sheet) ---------- */
  function taskSheet(t, o = {}) {
    const isNew = !t;
    const draft = t ? null : { t: '', sp: o.sp || (P().tf && spaceById(P().tf) ? P().tf : DEF_SPACE), due: o.due || '', star: false, note: '', sub: [] };
    const T = t || draft;
    const dates = [['', 'Sans date'], [today(), "Aujourd'hui"], [addDays(today(), 1), 'Demain'], [nextMonday(), 'Lundi']];
    const body = () => `<div class="ph-tk">
      <div class="ph-tk-h">${isNew ? '' : `<button class="ph-ck${T.done ? ' on' : ''}" data-tk="done" role="checkbox" aria-checked="${!!T.done}" aria-label="Terminée">${icon('check')}</button>`}
        <textarea class="ph-tk-t" rows="1" placeholder="Que faut-il faire ?" enterkeyhint="done">${esc(T.t === 'Nouvelle tâche' && isNew ? '' : T.t)}</textarea>
        <button class="ph-ib${T.star ? ' on' : ''}" data-tk="star" aria-pressed="${!!T.star}" aria-label="Importante">${icon('star')}</button></div>
      <div class="ph-tk-row"><span class="ph-tk-l">${icon('cal')}</span><div class="ph-seg">${dates.map(([v, l]) => `<button data-tk="due" data-v="${v}" aria-pressed="${(T.due || '') === v}">${l}</button>`).join('')}<label class="ph-seg-date${T.due && !dates.some(x => x[0] === T.due) ? ' on' : ''}"><span>${T.due && !dates.some(x => x[0] === T.due) ? fmtShort(T.due) : 'Date…'}</span><input type="date" data-tk="date" value="${esc(T.due || '')}"></label></div></div>
      <div class="ph-tk-row"><span class="ph-tk-l">${icon('folder')}</span><div class="ph-seg sp">${[...userSpaces(), spaceById(DEF_SPACE)].map(s => `<button data-tk="sp" data-v="${s.id}" aria-pressed="${T.sp === s.id}">${s.id === DEF_SPACE ? '' : `<i class="ph-dot" style="background:${s.color}"></i>`}${esc(s.name)}</button>`).join('')}</div></div>
      <div class="ph-tk-subs">${subsOf(T).map((x, i) => `<div class="ph-sub${x[1] ? ' done' : ''}"><button class="ph-ck sm${x[1] ? ' on' : ''}" data-tk="subck" data-i="${i}" aria-label="Cocher">${icon('check')}</button><input value="${esc(x[0])}" data-tk="subtx" data-i="${i}" enterkeyhint="done"><button class="ph-x" data-tk="subdel" data-i="${i}" aria-label="Retirer">${icon('x', 'sm')}</button></div>`).join('')}
        <form class="ph-sub add" data-tk="subadd"><span class="ph-ck sm ghost">${icon('plus')}</span><input placeholder="Sous-tâche" enterkeyhint="done"></form></div>
      <textarea class="ph-tk-n" rows="3" placeholder="Détails">${esc(T.note || '')}</textarea>
      ${(T.res || []).length ? `<div class="ph-tk-img">${T.res.filter(id => Assets.url(id)).map(id => `<img src="${Assets.url(id)}" alt="" data-tk="img" data-v="${id}">`).join('')}</div>` : ''}
      <div class="ph-tk-foot">${isNew ? `<button class="ph-btn pri" data-tk="add">Ajouter la tâche</button>` : `<button class="ph-btn danger" data-tk="del">${icon('trash', 'sm')}Supprimer</button>`}</div></div>`;
    const commit = () => { if (!isNew) { save(); } };
    const sh = sheet({ html: body(), cls: 'tall', onClose: () => { if (!isNew) { if (!T.t.trim()) T.t = 'Nouvelle tâche'; save(); refreshAll(); } } });
    const el = sh.el;
    const grow = ta => { ta.style.height = 'auto'; ta.style.height = ta.scrollHeight + 'px'; };
    const rebind = () => {
      const ta = $('.ph-tk-t', el); grow(ta);
      ta.oninput = () => { T.t = ta.value.replace(/\n/g, ' '); if (ta.value !== T.t) ta.value = T.t; grow(ta); commit(); };
      ta.onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); if (isNew) add(); else ta.blur(); } };
      $('.ph-tk-n', el).oninput = e => { T.note = e.target.value; commit(); };
      $('[data-tk="subadd"]', el).onsubmit = e => { e.preventDefault(); const i = $('input', e.target), v = i.value.trim(); if (!v) return; subsOf(T).push([v, false]); commit(); redraw(); setTimeout(() => { const n = $('[data-tk="subadd"] input', el); if (n) n.focus(); }, 0); };
      for (const i of $$('[data-tk="subtx"]', el)) i.oninput = () => { subsOf(T)[+i.dataset.i][0] = i.value; commit(); };
      const dt = $('[data-tk="date"]', el); dt.onchange = () => { T.due = dt.value || ''; commit(); redraw(); };
      if (isNew) setTimeout(() => ta.focus(), 60);
    };
    const redraw = () => { const y = el.querySelector('.ph-sheet-b').scrollTop; el.querySelector('.ph-sheet-b').innerHTML = body(); rebind(); el.querySelector('.ph-sheet-b').scrollTop = y; };
    const add = () => { if (!T.t.trim()) { $('.ph-tk-t', el).focus(); return; } const nt = newTask({ t: T.t, sp: T.sp, due: T.due, star: T.star, note: T.note, sub: subsOf(T) }); haptic(); closeSheet(); refreshAll(); toast('Tâche ajoutée'); return nt; };
    el.addEventListener('click', e => {
      const b = e.target.closest('[data-tk]'); if (!b) return; const k = b.dataset.tk;
      if (k === 'star') { T.star = !T.star; commit(); redraw(); }
      else if (k === 'due') { T.due = b.dataset.v; commit(); redraw(); }
      else if (k === 'sp') { T.sp = b.dataset.v; commit(); redraw(); }
      else if (k === 'done') { setDone(T, !T.done); redraw(); }
      else if (k === 'subck') { const x = subsOf(T)[+b.dataset.i]; x[1] = !x[1]; commit(); redraw(); }
      else if (k === 'subdel') { subsOf(T).splice(+b.dataset.i, 1); commit(); redraw(); }
      else if (k === 'add') add();
      else if (k === 'img') showImage(b.dataset.v);
      else if (k === 'del') { const i = S.tasks.indexOf(T); if (i >= 0) { S.tasks.splice(i, 1); save(); } closeSheet(true); refreshAll(); toast('Tâche supprimée', { label: 'Annuler', run: () => { S.tasks.splice(Math.min(i, S.tasks.length), 0, T); save(); refreshAll(); } }); }
    });
    rebind();
  }
  const nextMonday = () => { const d = new Date(); const n = ((8 - d.getDay()) % 7) || 7; d.setDate(d.getDate() + n); return isoOf(d); };
  function setDone(t, v) { t.done = v; t.doneAt = v ? Date.now() : 0; save(); }

  /* ---------- sheets ---------- */
  function sheet(o) {
    closeSheet(true);
    const el = document.createElement('div'); el.className = 'ph-sheet-l in';
    const items = (o.items || []).map((it, i) => `<button class="ph-si${it.danger ? ' danger' : ''}${it.on ? ' on' : ''}" data-si="${i}">${it.dot ? `<i class="ph-dot" style="background:${it.dot}"></i>` : it.icon ? icon(it.icon) : '<i class="ph-dot none"></i>'}<span>${esc(it.label)}</span>${it.on ? icon('check', 'ph-on') : ''}</button>`).join('');
    el.innerHTML = `<div class="ph-scrim"></div><div class="ph-sheet ${o.cls || ''}" role="dialog" aria-modal="true"><div class="ph-grab"></div>${o.title ? `<h3>${esc(o.title)}</h3>` : ''}<div class="ph-sheet-b">${o.html || `<div class="ph-sis">${items}</div>`}</div></div>`;
    root.append(el); sheetEl = { el, o };
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('in')));
    $('.ph-scrim', el).onclick = () => closeSheet();
    el.addEventListener('click', e => { const b = e.target.closest('[data-si]'); if (!b) return; const it = o.items[+b.dataset.si]; closeSheet(); setTimeout(() => it.run(), 10); });
    dragToClose($('.ph-sheet', el));
    return sheetEl;
  }
  function closeSheet(silent) {
    if (!sheetEl) return; const { el, o } = sheetEl; sheetEl = null;
    if (document.activeElement && el.contains(document.activeElement)) document.activeElement.blur();
    if (!silent && o.onClose) o.onClose(); else if (silent === true && o.onClose && o.cls === 'tall') { /* deleted: nothing to save */ }
    el.classList.add('in'); setTimeout(() => el.remove(), 300);
  }
  function dragToClose(sh) {
    let y0 = null, dy = 0;
    sh.addEventListener('touchstart', e => { const b = $('.ph-sheet-b', sh); if (e.target.closest('input,textarea') || (b && b.scrollTop > 0 && !e.target.closest('.ph-grab,h3'))) { y0 = null; return; } y0 = e.touches[0].clientY; dy = 0; sh.style.transition = 'none'; }, { passive: true });
    sh.addEventListener('touchmove', e => { if (y0 === null) return; dy = Math.max(0, e.touches[0].clientY - y0); sh.style.transform = `translateY(${dy}px)`; }, { passive: true });
    sh.addEventListener('touchend', () => { if (y0 === null) return; sh.style.transition = ''; sh.style.transform = ''; if (dy > 90) closeSheet(); y0 = null; });
  }
  function askName(title, val, done) {
    const sh = sheet({ title, html: `<form class="ph-ask"><input value="${esc(val)}" maxlength="60" placeholder="Nom" enterkeyhint="done" autocomplete="off"><button class="ph-btn pri">${val ? 'Renommer' : 'Créer'}</button></form>` });
    const f = $('form', sh.el), i = $('input', f); setTimeout(() => { i.focus(); i.select(); }, 60);
    f.onsubmit = e => { e.preventDefault(); const v = i.value.trim(); if (!v) { i.focus(); return; } closeSheet(); done(v); };
  }

  /* ---------- create (the round button) ---------- */
  function create() {
    const top = stack[stack.length - 1];
    if (top && top.kind === 'space') {
      sheet({ title: spName(top.id), items: [{ label: 'Nouvelle note', icon: 'note', run: () => newNote(top.id) }, { label: 'Nouvelle tâche', icon: 'tasks', run: () => taskSheet(null, { sp: top.id }) }] });
      return;
    }
    if (tab === 'tasks') taskSheet(null);
    else if (tab === 'spaces') askName('Nouvel espace', '', n => { const sp = createSpace(n, { stay: true }); render(); push('space', sp.id); });
    else newNote();
  }

  /* ---------- settings ---------- */
  function settings() {
    const th = THEMES.minimal, look = themeLook('minimal', S.prefs), mode = S.prefs.theme || 'auto';
    const acc = (th.accents || []), curA = look.accent || (acc[0] && acc[0].value);
    const sh = sheet({ title: 'Réglages', cls: 'tall', html: `<div class="ph-set">
      <h4>Apparence</h4><div class="ph-seg full">${[['auto', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button data-mode="${k}" aria-pressed="${mode === k}">${l}</button>`).join('')}</div>
      <h4>Couleur d’accent</h4><div class="ph-accs">${acc.map(a => `<button data-acc="${a.value}" style="--c:${a.value}" aria-label="${esc(a.name)}" aria-pressed="${String(curA).toLowerCase() === a.value.toLowerCase()}"></button>`).join('')}</div>
      <div id="stSync" class="ph-sync">${syncPane()}</div>
      <p class="ph-ver">PLUM ${esc(APP_VERSION)} · iPhone<br>Les boards s’ouvrent sur le PC et l’iPad.</p></div>` });
    bindSyncPane(sh.el);
    sh.el.addEventListener('click', e => {
      const m = e.target.closest('[data-mode]'); if (m) { S.prefs.theme = m.dataset.mode; save(); applyTheme(); statusBar(); for (const b of $$('[data-mode]', sh.el)) b.setAttribute('aria-pressed', b === m); }
      const a = e.target.closest('[data-acc]'); if (a) { setLook({ accent: a.dataset.acc }); for (const b of $$('[data-acc]', sh.el)) b.setAttribute('aria-pressed', b === a); }
    });
  }

  /* ---------- clicks ---------- */
  function onClick(e) {
    const t = e.target;
    if (t.closest('.ph-sw.open') && !t.closest('.ph-sw-acts')) { e.preventDefault(); closeSwipes(); return; }
    const back = t.closest('[data-back]'); if (back) { pop(); return; }
    const nf = t.closest('[data-nf]'); if (nf) { P().nf = nf.dataset.nf; save(); render(); return; }
    const tf = t.closest('[data-tf]'); if (tf) { P().tf = tf.dataset.tf; save(); render(); return; }
    const a = t.closest('[data-act]');
    if (a) {
      const k = a.dataset.act, id = a.dataset.id;
      if (k === 'settings') settings();
      else if (k === 'check') checkTask(a, taskById(id));
      else if (k === 'tdone') { P().tdone = !P().tdone; save(); render(); }
      else if (k === 'fav') { const d = docById(id); d.fav = !d.fav; touch(d); closeSwipes(); refreshAll(); }
      else if (k === 'trash') { const d = docById(id); closeSwipes(); trashP(d); refreshAll(); }
      else if (k === 'restore') { const d = docById(id); d.trash = false; if (!spaceById(d.sp)) d.sp = DEF_SPACE; touch(d); refreshAll(); toast('Note restaurée'); }
      else if (k === 'tomorrow') { const x = taskById(id); x.due = addDays(today(), 1); save(); closeSwipes(); refreshAll(); toast('Pour demain'); }
      else if (k === 'deltask') { const x = taskById(id), i = S.tasks.indexOf(x); closeSwipes(); S.tasks.splice(i, 1); save(); refreshAll(); toast('Tâche supprimée', { label: 'Annuler', run: () => { S.tasks.splice(Math.min(i, S.tasks.length), 0, x); save(); refreshAll(); } }); }
      else if (k === 'newnote') newNote(id);
      else if (k === 'spmenu') spaceMenuP(spaceById(id));
      else if (k === 'nfav') { const fr = stack.find(f => f.kind === 'note'), d = fr && docById(fr.id); if (d) { d.fav = !d.fav; touch(d); haptic(); syncNoteBar(); } }
      else if (k === 'nmenu') { const fr = stack.find(f => f.kind === 'note'), d = fr && docById(fr.id); if (d) noteMenu(d); }
      else if (k === 'file') { const fr = stack.find(f => f.kind === 'note'), d = fr && docById(fr.id); if (d) fileSheet(d); }
      else if (k === 'kbd') { if (document.activeElement) document.activeElement.blur(); }
      return;
    }
    const o = t.closest('[data-open]');
    if (o) {
      const [kind, id] = o.dataset.open.split(':');
      if (kind === 'task') { const x = taskById(id); if (x) taskSheet(x); return; }
      push(kind, id);
    }
  }
  /* the « Ajouter une tâche » line of a space */
  {
    document.addEventListener('submit', e => {
      const f = e.target.closest && e.target.closest('[data-addtask]'); if (!f || !root || !root.contains(f)) return;
      e.preventDefault(); const i = $('input', f), v = i.value.trim(); if (!v) return;
      newTask({ t: v, sp: f.dataset.addtask }); i.value = ''; haptic();
      const top = stack[stack.length - 1]; if (top) { redrawFrame(top); const n = $(`[data-addtask] input`, top.el); if (n) n.focus(); }
    });
  }
  /* ticking a task: the circle fills, the row fades, then the list is drawn again */
  function checkTask(btn, t) {
    if (!t) return; haptic();
    const v = !t.done; setDone(t, v);
    const row = btn.closest('.ph-task'); btn.setAttribute('aria-checked', v); row.classList.toggle('done', v); row.classList.add('ticking');
    clearTimeout(checkTask.t); checkTask.t = setTimeout(refreshAll, v ? 650 : 200);
  }
  function spaceMenuP(s) {
    if (!s) return;
    sheet({ title: s.name, items: [
      { label: 'Renommer', icon: 'text', run: () => askName('Renommer l’espace', s.name, n => { s.name = n; const pg = pageOf(s); if (pg) pg.title = n; save(); refreshAll(); }) },
      { label: 'Couleur', icon: 'palette', run: () => sheet({ title: 'Couleur', items: themeColors('space', SPACE_COLORS).map((c, i) => ({ label: ['Bleu', 'Jaune', 'Rose', 'Rouge', 'Orange', 'Vert', 'Violet', 'Turquoise', 'Brun', 'Gris'][i] || c, dot: c, on: s.color === c, run: () => { s.color = c; save(); refreshAll(); } })) }) },
      { label: 'Supprimer l’espace', icon: 'trash', danger: true, run: () => sheet({ title: `Supprimer « ${s.name} » ?`, items: [{ label: 'Supprimer : notes à la corbeille, tâches effacées', icon: 'trash', danger: true, run: () => {
        S.docs.forEach(d => { if (d.sp === s.id) { d.trash = true; d.sp = DEF_SPACE; if (d.page) { d.page = 0; d.title = 'PAGE · ' + s.name; } d.updated = Date.now(); } });
        S.tasks = S.tasks.filter(t => t.sp !== s.id); S.spaces = S.spaces.filter(x => x !== s); if (S.prefs.cur === s.id) S.prefs.cur = DEF_SPACE; save(); popAll(); setTab('spaces'); toast('Espace supprimé'); } }, { label: 'Annuler', icon: 'x', run: () => {} }] }) }] });
  }
  function refreshAll() { for (const fr of stack) redrawFrame(fr); render(); }

  /* ---------- swipe a row to the left for its actions ---------- */
  function closeSwipes(except) { for (const r of $$('.ph-sw.open', root)) if (r !== except) { r.classList.remove('open'); $('.ph-sw-acts + *', r).style.transform = ''; } }
  function bindSwipes(el) {
    let row = null, x0 = 0, y0 = 0, dx = 0, mode = '', base = 0;
    el.addEventListener('touchstart', e => {
      const r = e.target.closest('.ph-sw'); if (!r || e.target.closest('.ph-sw-acts')) { if (!r) closeSwipes(); row = null; return; }
      row = r; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; dx = 0; mode = ''; base = r.classList.contains('open') ? -$('.ph-sw-acts', r).offsetWidth : 0;
      closeSwipes(r);
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!row) return; const x = e.touches[0].clientX - x0, y = e.touches[0].clientY - y0;
      if (!mode) { if (Math.abs(x) > 8 && Math.abs(x) > Math.abs(y) * 1.3) mode = 'h'; else if (Math.abs(y) > 8) { mode = 'v'; } }
      if (mode !== 'h') return;
      const w = $('.ph-sw-acts', row).offsetWidth; dx = Math.min(0, Math.max(-w - 30, base + x));
      const c = $('.ph-sw-acts + *', row); c.style.transition = 'none'; c.style.transform = `translateX(${dx}px)`;
    }, { passive: true });
    el.addEventListener('touchend', () => {
      if (!row || mode !== 'h') { row = null; return; }
      const c = $('.ph-sw-acts + *', row), w = $('.ph-sw-acts', row).offsetWidth; c.style.transition = '';
      const open = dx < -w * .4; row.classList.toggle('open', open); c.style.transform = open ? `translateX(${-w}px)` : '';
      // the click that ends a swipe does not open the row
      const r = row; r.dataset.swiped = '1'; setTimeout(() => delete r.dataset.swiped, 80);
      row = null;
    });
    el.addEventListener('click', e => { const r = e.target.closest('.ph-sw[data-swiped]'); if (r) { e.stopPropagation(); e.preventDefault(); } }, true);
  }
  /* ---------- swipe from the left edge to go back ---------- */
  function bindEdgeBack() {
    let fr = null, x0 = 0, dx = 0;
    root.addEventListener('touchstart', e => { if (!stack.length || sheetEl) return; const x = e.touches[0].clientX; if (x > 22) return; fr = stack[stack.length - 1]; x0 = x; dx = 0; fr.el.style.transition = 'none'; }, { passive: true });
    root.addEventListener('touchmove', e => { if (!fr) return; dx = Math.max(0, e.touches[0].clientX - x0); fr.el.style.transform = `translateX(${dx}px)`; }, { passive: true });
    root.addEventListener('touchend', () => { if (!fr) return; const f = fr; fr = null; f.el.style.transition = ''; f.el.style.transform = ''; if (dx > innerWidth * .3) { if (document.activeElement) document.activeElement.blur(); pop(); } });
  }
  /* ---------- the keyboard: the format bar rides on it, the tab bar hides ---------- */
  function bindKeyboard() {
    const vv = window.visualViewport; if (!vv) return;
    const upd = () => {
      const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
      root.style.setProperty('--kb', kb + 'px'); root.classList.toggle('kb', kb > 80);
    };
    vv.addEventListener('resize', upd); vv.addEventListener('scroll', upd);
    document.addEventListener('focusin', e => { if (e.target.closest && e.target.closest('.nbody,.ntitle')) root.classList.add('editing'); });
    document.addEventListener('focusout', () => setTimeout(() => { const a = document.activeElement; if (!(a && a.closest && a.closest('.nbody,.ntitle'))) root.classList.remove('editing'); }, 30));
    upd();
  }

  /* ---------- a change from another device ---------- */
  function remote(touchOpen) {
    const nf = stack.find(f => f.kind === 'note');
    if (nf) {
      const d = docById(nf.id);
      if (!d || d.trash) { while (stack.length && stack.includes(nf)) pop(true); toast('Cette note a été supprimée sur un autre appareil'); return; }
      if (touchOpen || !Note.mounted) { const sc = $('.ph-nsc', nf.el), y = sc ? sc.scrollTop : 0; drawNote(nf); const s2 = $('.ph-nsc', nf.el); if (s2) s2.scrollTop = y; }
      for (const fr of stack) if (fr !== nf) redrawFrame(fr);
      render(); return;
    }
    if (sheetEl || (document.activeElement && root.contains(document.activeElement) && /INPUT|TEXTAREA/.test(document.activeElement.tagName))) return;
    refreshAll();
  }

  const api = { boot, remote, push, pop, setTab, render, newNote, taskSheet, settings, get tab() { return tab; }, get depth() { return stack.length; } };
  return api;
})();
