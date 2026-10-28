/* ================= workspace state ================= */
const SPACE_COLORS = ['#5B7CFA', '#F2B33D', '#EC6A9C', '#E5484D', '#F5A524', '#2E9E6A', '#8B76FF', '#22A6B3', '#8B5E3C', '#5E6B78'];
const DEFAULT_PREFS = { theme: 'auto', skin: 'minimal', name: '', autoPen: true, wheel: 'zoom', pressure: 'pen', source: 'auto', sens: .5, last: 'home', cur: 'default', welcomed: false,
  pens: Object.fromEntries(PEN_ORDER.map(k => [k, { s: PENS[k].size }])),
  bd: { sc: '@1', fc: null, sw: 2, sty: 'sketch', dash: '', fill: 'solid', font: 'hand', route: 'curve' }, recent: [], props: null,
  ai: { provider: 'auto', tier: 'quick', model: '' }, aiOn: false, taskOrder: [] };
let S = null;
let saveT = 0, saving = null;
/* 0.2 starts from a blank workspace under its own key: what was saved before (kv "state") stays untouched,
   and Réglages > Autres can bring it back (LEGACY) */
const STATE_KEY = 'plum-0.2';
let LEGACY = null;
function save() { clearTimeout(saveT); saveT = setTimeout(persist, 450); }
async function persist() { clearTimeout(saveT); try { saving = DB.put('kv', STATE_KEY, S); await saving; } catch (e) { console.warn(e); } }
window.__flushSave = () => { if (typeof Note !== 'undefined') Note.flush(); return persist(); };

const docById = id => S.docs.find(d => d.id === id);
const spaceById = id => S.spaces.find(s => s.id === id);
const taskById = id => S.tasks.find(t => t.id === id);
const spaceColor = id => (spaceById(id) || {}).color || '#8F8B83';
const liveDocs = () => S.docs.filter(d => !d.trash);
/* the spaces: « Non classées » (id default) is always there for what is filed nowhere, the current one is S.prefs.cur.
   0.2.14: spaces are optional, like Evernote notebooks: a note can be written from anywhere and filed later */
const DEF_SPACE = 'default', DEF_NAME = 'Non classées';
function ensureDefaultSpace(st) {
  st.spaces = st.spaces || [];
  const d = st.spaces.find(s => s.id === DEF_SPACE);
  if (!d) st.spaces.unshift({ id: DEF_SPACE, name: DEF_NAME, color: '#8F8B83', def: true, media: [] });
  else if (d.name === 'Par défaut') d.name = DEF_NAME;
  return st;
}
/* the pages that cover every space: there, what is created goes to « Non classées » (or to the space picked in the filter) */
const GLOBAL_ROUTES = ['all', 'todo', 'favs', 'trash', 'search'];
const isGlobal = () => GLOBAL_ROUTES.includes(R.name);
const curSpace = () => spaceById(S.prefs.cur) || spaceById(DEF_SPACE) || S.spaces[0];
const userSpaces = () => S.spaces.filter(s => s.id !== DEF_SPACE);
function setCurSpace(id) { if (spaceById(id) && S.prefs.cur !== id) { S.prefs.cur = id; save(); } }
function touch(doc) { if (doc) doc.updated = Date.now(); save(); }
function newDoc(type, o = {}) {
  const d = { id: uid('d'), type, title: o.title || (type === 'note' ? 'Sans titre' : 'Nouveau board'), sp: o.sp || ctxSpace(), fav: false, trash: false, created: Date.now(), updated: Date.now() };
  if (type === 'note') { d.html = o.html || ''; d.ink = o.ink || []; d.paper = o.paper || 'plain'; }
  else { d.items = o.items || []; d.view = o.view || null; d.bg = o.bg || 'dots'; }
  S.docs.push(d); save(); return d;
}
function newTask(o) {
  const t = { id: uid('t'), t: String(o.t || '').trim() || 'Nouvelle tâche', sp: o.sp || ctxSpace(), due: o.due || '', time: o.time || '', done: false, star: !!o.star, note: o.note || '', sub: (o.sub || []).map(x => Array.isArray(x) ? [String(x[0]), !!x[1]] : [String(x), false]).filter(x => x[0].trim()), created: Date.now() };
  S.tasks.push(t); save(); return t;
}
/* sub-tasks, images and manual order (from NoteIt): t.sub = [[text, done], …], t.open = sub-tasks shown under the row,
   t.res = image asset ids, t.ord = position chosen by dragging inside its space */
const subsOf = t => Array.isArray(t.sub) ? t.sub : (t.sub = []);
const resOf = t => Array.isArray(t.res) ? t.res : (t.res = []);
const subCount = t => { const s = subsOf(t); return s.length ? `${s.filter(x => x[1]).length}/${s.length}` : ''; };
function dupTask(t) {
  const c = JSON.parse(JSON.stringify(t)); c.id = uid('t'); c.t += ' (copie)'; c.done = false; c.doneAt = 0; c.created = Date.now();
  if (typeof c.ord === 'number') c.ord += .5;
  S.tasks.splice(S.tasks.indexOf(t) + 1, 0, c); save(); return c;
}
async function addTaskImages(t, files) {
  const imgs = [...(files || [])].filter(f => f && f.type && f.type.startsWith('image/'));
  for (const f of imgs) { try { const im = await importImage(f, 1800); resOf(t).push(im.id); } catch (e) { toast(`« ${f.name || 'Image'} » n'a pas pu être lue`); } }
  if (imgs.length) save(); return imgs.length;
}
function showImage(id) { const u = Assets.url(id); if (!u) return; const l = document.createElement('div'); l.className = 'lightbox'; l.innerHTML = `<img src="${u}" alt="">`; l.onclick = () => l.remove(); document.body.append(l); }
function setTaskDone(t, v) { t.done = v; t.doneAt = v ? Date.now() : 0; save(); refreshTaskViews(); }
function ctxSpace() {
  if (R.name === 'doc') { const d = docById(R.id); if (d && spaceById(d.sp)) return d.sp; }
  if (R.name === 'all') { const f = allFilter(); return spaceById(f.sp) ? f.sp : DEF_SPACE; }
  if (isGlobal()) return DEF_SPACE;
  return curSpace().id;
}
/* file a note or a board in a space (or back to « Non classées ») */
function fileDoc(d, spId) {
  const sp = spaceById(spId); if (!d || !sp || d.sp === spId) return;
  const was = d.sp; d.sp = spId; touch(d); renderSide(); if (R.name === 'doc' && R.id === d.id) { setCurSpace(spId); renderTop(); }
  toast(spId === DEF_SPACE ? 'Retirée des espaces' : `Rangée dans ${sp.name}`, { label: 'Annuler', run: () => { d.sp = was; touch(d); if (R.name === 'doc' && R.id === d.id) setCurSpace(was); go(R, { keepFocus: true }); } });
}
function fileMenu(anchor, d, o = {}) {
  const item = s => ({ label: s.name, dot: s.id === DEF_SPACE ? '' : s.color, icon: s.id === DEF_SPACE ? 'inbox' : '', small: s.id === d.sp ? 'actuel' : '', run: () => { fileDoc(d, s.id); if (o.after) o.after(); } });
  openPop(anchor, [
    { head: 'Ranger dans' },
    ...userSpaces().map(item),
    ...(userSpaces().length ? ['-'] : []),
    item(spaceById(DEF_SPACE)),
    '-',
    { label: 'Nouvel espace…', icon: 'plus', run: () => askSpaceName(n => { const sp = createSpace(n, { stay: true }); fileDoc(d, sp.id); if (o.after) o.after(); }) }
  ], { align: o.align || 'left' });
}
function askSpaceName(done) {
  openModal(`<div class="mhd"><h2>Nouvel espace</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
    <input id="nsName" class="mw-name" placeholder="Nom de l’espace" maxlength="60" autocomplete="off" aria-label="Nom de l’espace">
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" id="nsOk">Créer</button></div>`,
    m => { const i = $('#nsName', m), ok = () => { if (i.value.trim()) { closeModal(); done(i.value.trim()); } else i.focus(); }; i.focus(); i.onkeydown = e => { if (e.key === 'Enter') ok(); }; $('#nsOk', m).onclick = ok; });
}
/* the moodboard of a space: what was dropped into it, plus every image, file and link of its notes and boards */
function spaceMedia(spId) {
  const sp = spaceById(spId), out = [], seen = new Set();
  const push = m => { const key = m.asset || m.url || m.doc || m.id; if (!key || seen.has(key)) return; seen.add(key); out.push(m); };
  for (const m of (sp && sp.media) || []) push(m);
  for (const d of liveDocs().filter(d => d.sp === spId).sort((a, b) => b.updated - a.updated)) {
    if (d.type === 'board') for (const it of d.items || []) {
      if (it.k === 'image' && it.asset && Assets.has(it.asset)) push({ type: 'image', asset: it.asset, name: it.cap || '', from: d.id });
      else if (it.k === 'file' && it.asset && Assets.has(it.asset)) push({ type: 'file', asset: it.asset, name: it.name, size: it.size, mime: it.mime, from: d.id });
      else if (it.k === 'link' && it.url) push({ type: 'link', url: it.url, title: it.title, from: d.id });
    } else {
      for (const m of noteHTML(d).matchAll(/data-asset="([^"]+)"/g)) { const b = Assets.blobs.get(m[1]); if (b) push(/^image\//.test(b.type) ? { type: 'image', asset: m[1], name: '', from: d.id } : { type: 'file', asset: m[1], name: 'Fichier', size: b.size, mime: b.type, from: d.id }); }
    }
  }
  for (const d of liveDocs().filter(d => d.sp === spId).sort((a, b) => b.updated - a.updated)) push({ type: 'doc', doc: d.id, title: d.title, kind: d.type });
  return out;
}
/* links and bits of text dropped or pasted into a moodboard: { type: 'link', url, title } or { type: 'text', txt } */
function addMediaItems(spId, list, folder) {
  const sp = spaceById(spId); if (!sp) return 0;
  sp.media = sp.media || []; let n = 0;
  for (const m of list) {
    if (m.type === 'link' && m.url && !sp.media.some(x => x.url === m.url)) { sp.media.unshift({ id: uid('m'), type: 'link', url: m.url, title: m.title || '', added: Date.now(), ...(folder ? { folder } : {}) }); n++; }
    else if (m.type === 'text' && String(m.txt || '').trim()) { sp.media.unshift({ id: uid('m'), type: 'text', txt: String(m.txt).trim().slice(0, 4000), added: Date.now(), ...(folder ? { folder } : {}) }); n++; }
  }
  if (n) save(); return n;
}
/* what a drop or a paste carries besides files: URLs become links, other text a text card */
function mediaFromData(dt) {
  const uri = (dt.getData('text/uri-list') || '').split(/\r?\n/).map(x => x.trim()).filter(x => x && !x.startsWith('#') && /^https?:/i.test(x));
  if (uri.length) return uri.map(url => ({ type: 'link', url }));
  const txt = (dt.getData('text/plain') || '').trim(); if (!txt) return [];
  const urls = txt.split(/\s+/).filter(x => /^https?:\/\/\S+$/i.test(x));
  if (urls.length && urls.join(' ').length >= txt.replace(/\s+/g, ' ').length - 2) return urls.map(url => ({ type: 'link', url }));
  return [{ type: 'text', txt }];
}
async function addMedia(spId, files, folder) {
  const sp = spaceById(spId); if (!sp) { toast('Ce board n’a pas d’espace'); return []; }
  sp.media = sp.media || []; const added = [];
  for (const f of files) {
    try {
      if (/^image\//.test(f.type)) { const im = await importImage(f); sp.media.unshift({ id: uid('m'), type: 'image', asset: im.id, name: f.name.replace(/\.[a-z0-9]{2,4}$/i, ''), w: im.w, h: im.h, added: Date.now(), ...(folder ? { folder } : {}) }); }
      else { if (f.size > 80e6) { toast(`« ${f.name} » dépasse 80 Mo`); continue; } const id = await Assets.put(f); sp.media.unshift({ id: uid('m'), type: 'file', asset: id, name: f.name, size: f.size, mime: f.type, added: Date.now(), ...(folder ? { folder } : {}) }); }
      added.push(f.name);
    } catch (e) { toast(`« ${f.name} » n'a pas pu être lu`); }
  }
  save(); return added;
}

/* ================= router ================= */
let R = { name: 'home' }, unmountView = null;
function parseRoute(s) { const [name, ...rest] = String(s || 'home').split(':'); return { name, id: rest.join(':') }; }
const routeStr = r => r.id ? `${r.name}:${r.id}` : r.name;
function go(route, opts = {}) {
  closePop();
  if (unmountView) { try { unmountView(); } catch (e) { console.error(e); } unmountView = null; }
  R = typeof route === 'string' ? parseRoute(route) : route;
  /* everything lives in a space: the space's home replaces the old home page, opening a page of another space switches to it */
  if (R.name === 'doc') { const d = docById(R.id); if (!d) R = { name: 'space' }; else if (d.trash) R = { name: 'trash' }; else setCurSpace(d.sp); }
  if (R.name === 'home') R = { name: 'all' };
  if (R.name === 'space') { if (spaceById(R.id)) setCurSpace(R.id); R = { name: 'space', id: curSpace().id }; }
  if (!S.prefs.welcomed) R = { name: 'welcome' };
  else if (R.name === 'welcome') R = { name: 'all' };
  S.prefs.last = routeStr(R); save();
  document.documentElement.removeAttribute('data-nav');
  document.documentElement.toggleAttribute('data-welcome', R.name === 'welcome');
  /* each page gets a fresh root so its delegated listeners go away with it */
  const view = $('#view'); view.className = ''; view.innerHTML = ''; view.scrollTop = 0;
  const v = document.createElement('div'); v.className = 'vroot'; view.append(v);
  renderSide(); renderTop();
  switch (R.name) {
    case 'welcome': renderWelcome(v); break;
    case 'notes': case 'boards': case 'favs': case 'trash': renderDocList(v, R.name); break;
    case 'tasks': renderTasks(v); break;
    case 'all': renderAll(v); break;
    case 'todo': renderAllTasks(v); break;
    case 'mood': renderMood(v); break;
    case 'search': renderSearch(v); break;
    case 'doc': openDoc(v, docById(R.id)); break;
    default: renderSpace(v);
  }
  Mood.sync();
  if (!opts.keepFocus) { if (R.name !== 'doc' && document.documentElement.hasAttribute('data-focus')) setFocus(false); }
  AI.context();
}
function openDoc(v, d) {
  $('#view').className = d.type === 'board' ? 'fixed' : '';
  if (d.type === 'board') { Board.mount(v, d); unmountView = () => Board.unmount(); }
  else { Note.mount(v, d); unmountView = () => Note.unmount(); }
  $('#focusTtl').textContent = d.title;
}

/* ================= sidebar =================
   0.2.14, Evernote-like: a « Nouvelle note » button on top, the pages that cover everything (Toutes les notes, Tâches,
   Non classées, Favoris), then the spaces like notebooks: the open one shows its sections and its pages. */
const NAV = [['all', 'notes', 'Toutes les notes'], ['todo', 'tasks', 'Tâches'], ['space:' + 'default', 'inbox', 'Non classées'], ['favs', 'star', 'Favoris']];
const SP_NAV = [['tasks', 'tasks', 'Tâches'], ['notes', 'note', 'Notes'], ['boards', 'board', 'Boards'], ['mood', 'image', 'Moodboard']];
const NAV2 = [['trash', 'trash', 'Corbeille']];
function renderSide() {
  const sp = curSpace(), ld = liveDocs(), mine = ld.filter(d => d.sp === sp.id);
  const cd = R.name === 'doc' ? docById(R.id) : null, cur = cd ? '' : R.name === 'space' ? 'space:' + R.id : R.name;
  const inSp = !isGlobal() && R.name !== 'welcome', open = inSp ? sp : null;
  const count = { all: ld.length, todo: S.tasks.filter(t => !t.done).length, ['space:' + DEF_SPACE]: ld.filter(d => d.sp === DEF_SPACE).length + S.tasks.filter(t => t.sp === DEF_SPACE && !t.done).length,
    tasks: S.tasks.filter(t => t.sp === sp.id && !t.done).length, notes: mine.filter(d => d.type === 'note').length, boards: mine.filter(d => d.type === 'board').length, mood: (sp.media || []).length, favs: ld.filter(d => d.fav).length, trash: S.docs.filter(d => d.trash).length };
  // « Non classées » shows no sections in the sidebar: its home has everything, its row stays lit on its pages
  const row = ([k, ic, l]) => `<button class="nv" data-go="${k}"${cur === k || (k === 'space:' + DEF_SPACE && open && open.id === DEF_SPACE) ? ' aria-current="page"' : ''}${k === 'space:' + DEF_SPACE ? ` data-spdrop="${DEF_SPACE}"` : ''}>${icon(ic)}<span>${l}</span><span class="ct">${count[k] || ''}</span></button>`;
  $('#nav').innerHTML = NAV.map(row).join('');
  $('#nav2').innerHTML = NAV2.map(row).join('');
  const n = s => ld.filter(d => d.sp === s.id).length + S.tasks.filter(t => t.sp === s.id && !t.done).length;
  const spRow = s => {
    const on = open && open.id === s.id;
    let h = `<div class="spi${on ? ' open' : ''}" data-spi="${s.id}"><button class="nv sprow" data-go="space:${s.id}" data-spdrop="${s.id}"${R.name === 'space' && R.id === s.id ? ' aria-current="page"' : ''}${on ? ' aria-expanded="true"' : ''}><span class="dot" style="background:${s.color}"></span><span class="spt">${esc(s.name)}</span><span class="ct">${n(s) || ''}</span></button><button class="spm-more spx" data-spmore="${s.id}" aria-label="Options de ${esc(s.name)}" title="Options">${icon('dots', 'sm')}</button></div>`;
    if (on) {
      const sub = SP_NAV.map(([k, ic, l]) => `<button class="nv sub" data-go="${k}"${cur === k ? ' aria-current="page"' : ''}>${icon(ic, 'sm')}<span>${l}</span><span class="ct">${count[k] || ''}</span></button>`).join('');
      const pages = mine.slice().sort((a, b) => a.created - b.created);
      h += `<div class="spsub">${sub}<div class="nav" id="pages">${pages.map(d => `<button class="nv pg" data-go="doc:${d.id}"${cd && cd.id === d.id ? ' aria-current="page"' : ''}>${icon(d.type === 'board' ? 'board' : 'note', 'sm')}<span class="pt">${esc(d.title)}</span></button>`).join('')}</div></div>`;
    }
    return h;
  };
  $('#spaces').innerHTML = userSpaces().map(spRow).join('') || '<div class="pempty">Aucun espace. Un espace réunit les notes, tâches, boards et le moodboard d’un projet.</div>';
  $('#meName').textContent = S.prefs.name || 'Moi'; $('#meAv').textContent = (S.prefs.name || 'M')[0].toUpperCase();
  $('#themeBtn').innerHTML = icon(isDarkTheme() ? 'sun' : 'moon');
}
function createSpace(name, o = {}) {
  const cols = themeColors('space', SPACE_COLORS);
  const sp = { id: uid('s'), name: String(name).trim().slice(0, 60) || 'Nouvel espace', color: cols[userSpaces().length % cols.length], media: [], created: Date.now() };
  S.spaces.push(sp); S.prefs.welcomed = true;
  if (o.stay) { save(); renderSide(); return sp; }
  S.prefs.cur = sp.id; save();
  go('space:' + sp.id); toast(`Espace « ${sp.name} » créé`);
  return sp;
}
function spaceMenu(anchor, sp) {
  if (!sp) return;
  openPop(anchor, [
    { label: 'Ouvrir', icon: 'folder', run: () => go('space:' + sp.id) },
    ...(sp.id === DEF_SPACE ? [] : [
      { label: 'Renommer', icon: 'text', run: () => renameSpace(sp) },
      { label: 'Couleur', icon: 'sun', run: () => openPop(anchor, themeColors('space', SPACE_COLORS).map(c => ({ label: c === sp.color ? 'Couleur actuelle' : 'Choisir', dot: c, run: () => { sp.color = c; save(); renderSide(); if (R.name === 'space') go(R); } }))) },
      '-',
      { label: "Supprimer l'espace", icon: 'trash', danger: true, run: () => deleteSpace(sp) }])
  ]);
}
/* the name is edited in the title of the space's home */
function renameSpace(sp) {
  if (R.name !== 'space' || R.id !== sp.id) go('space:' + sp.id);
  const i = $('#spTitle'); if (i) { i.focus(); i.select(); }
}
function deleteSpace(sp) {
  if (!sp || sp.id === DEF_SPACE) return;
  const n = S.docs.filter(d => d.sp === sp.id && !d.trash).length, nt = S.tasks.filter(t => t.sp === sp.id).length;
  openModal(`<div class="mhd"><h2>Supprimer « ${esc(sp.name)} » ?</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
    <p style="margin:0 0 14px;color:var(--ink-2)">${n ? `Ses ${n} note(s) et board(s) iront dans la corbeille. ` : ''}${nt ? `Ses ${nt} tâche(s) seront supprimées.` : ''}${!n && !nt ? "L'espace est vide." : ''}</p>
    <div style="display:flex;gap:8px;justify-content:flex-end"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" id="spDel" style="background:var(--err);border-color:var(--err)">Supprimer</button></div>`,
    m => { $('#spDel', m).onclick = () => { S.docs.forEach(d => { if (d.sp === sp.id) { d.trash = true; d.sp = DEF_SPACE; } }); S.tasks = S.tasks.filter(t => t.sp !== sp.id); S.spaces = S.spaces.filter(s => s !== sp); if (S.prefs.cur === sp.id) S.prefs.cur = DEF_SPACE; save(); closeModal(); go('space:' + DEF_SPACE); toast('Espace supprimé'); }; });
}

/* ================= top bar ================= */
function renderTop() {
  const t = $('#top'), d = R.name === 'doc' ? docById(R.id) : null;
  const menu = `<button class="tb menu-btn" id="navBtn" aria-label="Menu">${icon('menu')}</button>`;
  const aiBtn = !S.prefs.aiOn ? '' : `<button class="tb ai" id="aiBtn" aria-pressed="${!$('#ai').hidden}" title="Assistant IA (Ctrl J)">${icon('spark')}<span class="lbl">Assistant</span></button>`;
  let crumbs = '', acts = '';
  const titles = { notes: 'Notes', boards: 'Boards', tasks: 'Tâches', mood: 'Moodboard', favs: 'Favoris', trash: 'Corbeille', search: 'Recherche', all: 'Toutes les notes', todo: 'Toutes les tâches' };
  // the moodboard of the space opens as a drawer from every page (Ctrl M)
  const moodBtn = R.name === 'mood' || R.name === 'welcome' || isGlobal() ? '' : `<button class="tb" id="moodBtn" aria-pressed="${Mood.isOpen()}" title="Moodboard de l’espace (Ctrl M)">${icon('image')}<span class="lbl">Moodboard</span></button>`;
  const spCrumb = sp => `<button class="sp" data-go="space:${sp.id}"><span class="sdot" style="background:${sp.color}"></span>${esc(sp.name)}</button><span>/</span>`;
  if (d) {
    // the space of the page, as a button to file it elsewhere (or nowhere)
    const sp = spaceById(d.sp) || spaceById(DEF_SPACE), def = sp.id === DEF_SPACE;
    crumbs = `<button class="sp spfile${def ? ' none' : ''}" id="docSp" aria-haspopup="menu" title="${def ? 'Ranger dans un espace' : 'Changer d’espace'}">${def ? icon('inbox', 'sm') : `<span class="sdot" style="background:${sp.color}"></span>`}<span>${def ? 'Ranger…' : esc(sp.name)}</span>${icon('chevd', 'sm')}</button><span>/</span><input class="cur" id="docTitle" value="${esc(d.title)}" aria-label="Titre">`;
    acts = `<button class="tb" id="favBtn" aria-pressed="${d.fav}" title="Favori">${icon('star')}</button>${moodBtn}
      <button class="tb" id="focusBtn" title="Mode focus (Ctrl .)">${icon('focus')}<span class="lbl">Focus</span></button>${aiBtn}
      <button class="tb" id="docMore" aria-label="Plus d'actions">${icon('dots')}</button>`;
  } else if (R.name === 'space') {
    const sp = spaceById(R.id);
    crumbs = `<span class="sp">${sp.id === DEF_SPACE ? icon('inbox', 'sm') : `<span class="sdot" style="background:${sp.color}"></span>`}</span><span class="cur">${esc(sp.name)}</span>`;
    acts = `${moodBtn}${sp.id === DEF_SPACE ? '' : `<button class="tb" id="spMore" aria-label="Options de l'espace">${icon('dots')}</button>`}${aiBtn}`;
  } else if (R.name === 'welcome') {
    crumbs = ''; acts = '';
  } else {
    const scoped = ['notes', 'boards', 'tasks', 'mood'].includes(R.name);
    crumbs = `${scoped ? spCrumb(curSpace()) : ''}<span class="cur">${titles[R.name] || ''}</span>`;
    acts = moodBtn + aiBtn;
  }
  t.innerHTML = `${menu}<div class="crumbs">${crumbs}</div>${acts}`;
  if (d) {
    const ti = $('#docTitle');
    ti.oninput = () => { d.title = ti.value; touch(d); $('#focusTtl').textContent = d.title; if (R.name === 'doc' && d.type === 'note') Note.syncTitle(); };
    ti.onkeydown = e => { if (e.key === 'Enter') ti.blur(); };
    ti.onblur = () => { if (!ti.value.trim()) { d.title = 'Sans titre'; ti.value = d.title; touch(d); } };
    $('#favBtn').onclick = () => { d.fav = !d.fav; touch(d); $('#favBtn').setAttribute('aria-pressed', d.fav); renderSide(); toast(d.fav ? 'Ajouté aux favoris' : 'Retiré des favoris'); };
    $('#focusBtn').onclick = () => setFocus(true);
    $('#docMore').onclick = e => docMenu(e.currentTarget, d);
    $('#docSp').onclick = e => fileMenu(e.currentTarget, d);
  }
  const sm = $('#spMore'); if (sm) sm.onclick = e => spaceMenu(e.currentTarget, spaceById(R.id));
  const mb = $('#moodBtn'); if (mb) mb.onclick = () => Mood.toggle();
  const ab = $('#aiBtn'); if (ab) ab.onclick = () => AI.toggle();
  $('#navBtn').onclick = () => document.documentElement.toggleAttribute('data-nav');
}
function docMenu(anchor, d) {
  openPop(anchor, [
    { label: 'Ranger dans…', icon: 'folder', run: () => fileMenu($('#docSp') || anchor, d) },
    { label: 'Dupliquer', icon: 'dup', run: () => { const c = JSON.parse(JSON.stringify(d)); c.id = uid('d'); c.title = d.title + ' (copie)'; c.created = c.updated = Date.now(); c.fav = false; S.docs.push(c); save(); go('doc:' + c.id); toast('Copie créée'); } },
    { label: 'Exporter en fichier', icon: 'download', run: () => exportJSON({ docs: [d] }, `${d.title || 'document'}.json`) },
    { label: 'Mettre à la corbeille', icon: 'trash', danger: true, run: () => { d.trash = true; touch(d); go(d.sp === DEF_SPACE ? 'all' : d.type === 'board' ? 'boards' : 'notes'); toast('Mis à la corbeille', { label: 'Annuler', run: () => { d.trash = false; touch(d); go('doc:' + d.id); } }); } }
  ], { align: 'right' });
}

/* ================= shared bits =================
   0.2: tasks are kept simple, a title in its space with sub-tasks, images and a note; dates, times, stars and
   colours stay in the data but are not shown */
function taskRow(t, o = {}) {
  const sc = subCount(t), subs = subsOf(t), nimg = resOf(t).filter(id => Assets.has(id)).length;
  const open = sc && t.open && !t.done ? `<div class="tsubs">${subs.map((x, k) => `<button class="tsub${x[1] ? ' on' : ''}" data-subck="${k}" role="checkbox" aria-checked="${x[1]}" style="--i:${k}"><span class="cb sm">${icon('check')}</span><span class="st">${esc(x[0])}</span></button>`).join('')}</div>` : '';
  return `<div class="tw" data-tw="${t.id}"${o.drag ? ' data-drag="1"' : ''}${o.space ? ' data-showsp="1"' : ''}><div class="trow${t.done ? ' done' : ''}" data-task="${t.id}">
    <button class="cb" role="checkbox" aria-checked="${t.done}" aria-label="Terminer" data-done="${t.id}">${icon('check')}</button>
    <button class="tt" data-edit="${t.id}">${esc(t.t)}</button>
    ${sc ? `<button class="chip subc${t.open ? ' on' : ''}" data-subs="${t.id}" aria-expanded="${!!t.open}" title="Sous-tâches">${icon('chk')}${sc}</button>` : ''}
    ${nimg ? `<button class="chip imgc" data-edit="${t.id}" title="Images">${icon('image')}${nimg}</button>` : ''}
    ${t.note && t.note.trim() ? `<span class="tnote" title="${esc(t.note.slice(0, 200))}">${icon('note', 'sm')}</span>` : ''}
    ${t.done ? '' : `<button class="tb addsub" data-addsub="${t.id}" aria-label="Ajouter une sous-tâche" title="Ajouter une sous-tâche">${icon('plus', 'sm')}</button>`}
    <button class="tb" data-edit="${t.id}" aria-label="Modifier" style="height:28px;min-width:28px;padding:0">${icon('chev', 'sm')}</button>
  </div>${open}</div>`;
}
function bindTaskList(root, rerender) {
  const re = () => smoothTasks(rerender);
  root.addEventListener('click', e => {
    const dn = e.target.closest('[data-done]'); if (dn) {
      const t = taskById(dn.dataset.done); if (!t) return;
      const undo = () => smoothTasks(() => setTaskDone(t, false));
      // a ticked task fades out before the list closes up
      const tw = dn.closest('.tw');
      if (!t.done && tw && !reduceMotion()) { dn.setAttribute('aria-checked', 'true'); tw.classList.add('completing'); setTimeout(() => { smoothTasks(() => setTaskDone(t, true)); toast('Tâche terminée', { label: 'Annuler', run: undo }); }, 300); return; }
      smoothTasks(() => setTaskDone(t, !t.done)); if (t.done) toast('Tâche terminée', { label: 'Annuler', run: undo }); return;
    }
    const as = e.target.closest('[data-addsub]'); if (as) { quickSub(as.closest('.tw'), taskById(as.dataset.addsub)); return; }
    const sb = e.target.closest('[data-subs]'); if (sb) { const t = taskById(sb.dataset.subs); if (t) { t.open = !t.open; save(); re(); if (t.open) $$(`.tw[data-tw="${t.id}"] .tsubs`).forEach(x => x.classList.add('enter')); } return; }
    const ck = e.target.closest('[data-subck]'); if (ck) { const t = taskById(ck.closest('.tw').dataset.tw), k = +ck.dataset.subck, x = t && subsOf(t)[k]; if (x) { x[1] = !x[1]; save(); refreshTask(t, k); } return; }
    const ed = e.target.closest('[data-edit]'); if (ed) toggleTaskEdit(ed.closest('.tw'), taskById(ed.dataset.edit), re);
  });
  // drag the rows to reorder them, or into another space's block; drag the open sub-tasks to reorder them
  if (root.querySelector('.tw[data-drag]')) sortable(root, { item: '.tw[data-drag]', lists: '.tlist, [data-tlist]', skip: '.cb, .chip, .tb, .tsubs, .tedit, input, textarea, select, a', prune: '.tedit', listAt: el => { const g = el.closest('.tgroup'); return g && g.querySelector('.tlist'); }, onDrop: dropTask });
  // a sub-task can also go to another task: over its row, a list opens to receive it
  const subsAt = el => { const tw = el.closest('.tw'); if (!tw || !root.contains(tw) || tw.querySelector(':scope > .trow.done')) return null; let l = tw.querySelector(':scope > .tsubs'); if (!l) { l = document.createElement('div'); l.className = 'tsubs tmp'; tw.querySelector(':scope > .trow').after(l); } return l; };
  sortable(root, { item: '.tsub', lists: '.tsubs', listAt: subsAt, onDrop: (el, list, home) => {
    $$('.tsubs.tmp', root).forEach(l => { if (!l.contains(el)) l.remove(); });
    const from = taskById(home.closest('.tw').dataset.tw), to = taskById(list.closest('.tw').dataset.tw);
    if (from && to && from !== to) moveSub(from, +el.dataset.subck, to, [...list.children].filter(c => c.matches('.tsub')).indexOf(el));
    else reorderSubs(from, list, '.tsub', 'subck');
  } });
}
/* the + of a task: a field under it to type sub-tasks one after the other (Enter adds and keeps the field) */
function quickSub(tw, t) {
  if (!tw || !t) return;
  let box = tw.querySelector(':scope > .tsubs');
  if (!box) { box = document.createElement('div'); box.className = 'tsubs'; tw.querySelector(':scope > .trow').after(box); }
  let row = box.querySelector('.tsub-add');
  if (!row) { row = document.createElement('label'); row.className = 'tsub-add'; row.innerHTML = `<span class="cb sm" aria-hidden="true">${icon('plus')}</span><input placeholder="Nouvelle sous-tâche, puis Entrée" aria-label="Nouvelle sous-tâche" autocomplete="off">`; box.append(row); }
  const i = row.querySelector('input'); i.focus();
  i.onkeydown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); i.blur(); return; }
    if (e.key !== 'Enter' || !i.value.trim()) return;
    e.preventDefault(); subsOf(t).push([i.value.trim(), false]); t.open = true; save(); refreshTask(t);
    const nw = $(`.tw[data-tw="${t.id}"]`); if (nw) { const l = $$('.tsubs .tsub', nw).pop(); if (l) l.classList.add('pop-in'); quickSub(nw, t); }
  };
  i.onblur = () => setTimeout(() => { if (row.contains(document.activeElement)) return; row.remove(); if (!box.querySelector('.tsub')) box.remove(); }, 150);
}
function dropTask(el, list) {
  const t = taskById(el.dataset.tw); if (!t) return;
  const blk = list.closest('[data-sp]'), sp = blk && spaceById(blk.dataset.sp) ? blk.dataset.sp : t.sp, moved = sp !== t.sp;
  t.sp = sp;
  // the new position among every open task of the space, the hidden ones (other filter) keep theirs
  const vis = [...list.children].filter(c => c.matches('.tw')).map(c => c.dataset.tw), i = vis.indexOf(t.id);
  const all = S.tasks.filter(x => x.sp === t.sp && !x.done && x !== t).sort(taskSort);
  const next = vis.slice(i + 1).map(taskById).find(x => all.includes(x)), prev = vis.slice(0, i).reverse().map(taskById).find(x => all.includes(x));
  all.splice(next ? all.indexOf(next) : prev ? all.indexOf(prev) + 1 : all.length, 0, t);
  all.forEach((x, k) => { x.ord = k; });
  save(); smoothTasks(refreshTaskViews);
  if (moved) toast(`Déplacée dans ${spaceById(sp).name}`);
}
function moveSub(from, k, to, at) {
  const x = subsOf(from)[k]; if (!x) return;
  subsOf(from).splice(k, 1); subsOf(to).splice(Math.max(0, at), 0, x); to.open = true; save();
  smoothTasks(refreshTaskViews);
  toast(`« ${x[0]} » déplacée dans « ${to.t} »`, { label: 'Annuler', run: () => { const i = subsOf(to).indexOf(x); if (i >= 0) subsOf(to).splice(i, 1); subsOf(from).splice(k, 0, x); save(); smoothTasks(refreshTaskViews); } });
}
function reorderSubs(t, list, sel, key) {
  if (!t) return;
  const order = [...list.children].filter(c => c.matches(sel)).map(c => +c.dataset[key]), subs = subsOf(t);
  if (order.length === subs.length && order.every(k => subs[k])) t.sub = order.map(k => subs[k]);
  save(); refreshTask(t);
}
/* redraw a task's rows in place (an open editor stays open); pop = index of the sub-task just ticked */
function refreshTask(t, pop) {
  for (const tw of $$(`.tw[data-tw="${t.id}"]`)) {
    const ed = tw.querySelector('.tedit'), tmp = document.createElement('div');
    tmp.innerHTML = taskRow(t, { space: !!tw.dataset.showsp, drag: !!tw.dataset.drag });
    const nw = tmp.firstElementChild; if (ed) nw.append(ed);
    tw.replaceWith(nw);
    if (pop !== undefined) { const b = nw.querySelector(`.tsubs [data-subck="${pop}"] .cb`); if (b) b.classList.add('pop'); }
  }
  const ed = $(`.tedit[data-for="${t.id}"]`); if (ed) { renderSubEditor(ed, t, pop); renderTaskImages(ed, t); }
  renderSide();
}
function renderSubEditor(ed, t, pop) {
  const box = $('.tchk', ed), subs = subsOf(t), done = subs.filter(x => x[1]).length, pct = subs.length ? Math.round(done / subs.length * 100) : 0;
  const was = $('.pbar i', box), w0 = was ? was.style.width : '0%';
  box.innerHTML = `<div class="tchk-h">Sous-tâches${subs.length ? `<span>${done}/${subs.length}</span>` : ''}</div>
    ${subs.length ? `<div class="pbar"><i style="width:${w0}"></i></div>` : ''}
    ${subs.map((x, k) => `<div class="tchk-r${x[1] ? ' on' : ''}" data-k="${k}"><button class="cb sm${k === pop ? ' pop' : ''}" role="checkbox" aria-checked="${x[1]}" aria-label="Cocher" data-sk="${k}">${icon('check')}</button><input type="text" value="${esc(x[0])}" data-sn="${k}" aria-label="Sous-tâche"><button class="tb sm" data-sx="${k}" aria-label="Supprimer la sous-tâche" title="Supprimer">${icon('x', 'sm')}</button></div>`).join('')}
    <label class="tchk-add">${icon('plus', 'sm')}<input type="text" data-sadd placeholder="Ajouter une sous-tâche" aria-label="Ajouter une sous-tâche" autocomplete="off"></label>`;
  // the bar grows from where it was
  const bar = $('.pbar i', box); if (bar) { void bar.offsetWidth; bar.style.width = pct + '%'; }
}
function renderTaskImages(ed, t) {
  const ids = resOf(t).filter(id => Assets.has(id));
  $('.timgs', ed).innerHTML = `<div class="tchk-h">Images${ids.length ? `<span>${ids.length}</span>` : ''}</div>
    <div class="tthumbs">${ids.map(id => `<div class="tthumb" data-img="${id}"><img src="${Assets.url(id)}" alt="" draggable="false"><button class="x" data-imgx="${id}" aria-label="Retirer l'image" title="Retirer">${icon('x', 'sm')}</button></div>`).join('')}
      <button class="tthumb add" data-imgadd title="Ajouter des images. Vous pouvez aussi les glisser ou les coller ici." aria-label="Ajouter une image">${icon('plus')}</button></div>`;
}
function toggleTaskEdit(tw, t, rerender) {
  tw = tw && (tw.closest('.tw') || tw); if (!t || !tw) return;
  const cur = tw.querySelector('.tedit'); if (cur) { cur.remove(); return; }
  $$('.tedit').forEach(x => x.remove());
  const ed = document.createElement('div'); ed.className = 'tedit'; ed.dataset.for = t.id;
  ed.innerHTML = `<div class="row"><input type="text" id="te-t" value="${esc(t.t)}" aria-label="Titre"></div>
    <div class="tchk"></div>
    <div class="timgs"></div>
    <textarea id="te-n" placeholder="Note…" aria-label="Note">${esc(t.note)}</textarea>
    <div class="row tacts"><label class="tsp">${icon('folder', 'sm')}<select id="te-s" aria-label="Espace">${S.spaces.map(s => `<option value="${s.id}"${s.id === t.sp ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</select></label>
      <span class="sp-gap"></span>
      <button class="btn sm ghost del" id="te-dup" title="Dupliquer la tâche">${icon('dup', 'sm')}Dupliquer</button>
      <button class="btn sm ghost danger" id="te-del">${icon('trash', 'sm')}Supprimer</button></div>`;
  renderSubEditor(ed, t); renderTaskImages(ed, t);
  tw.append(ed);
  const upd = () => { t.t = $('#te-t', ed).value.trim() || t.t; t.note = $('#te-n', ed).value; save(); };
  ed.addEventListener('change', e => {
    if (e.target.closest('.tchk')) return;
    if (e.target.id === 'te-s') { const to = spaceById(e.target.value); if (to && to.id !== t.sp) { t.sp = to.id; delete t.ord; save(); smoothTasks(refreshTaskViews); toast(`Déplacée dans ${to.name}`); } return; }
    upd(); rerender();
  });
  // sub-tasks: tick, rename, remove, add (Enter keeps the field ready for the next one), drag up or down to reorder
  const chk = $('.tchk', ed);
  chk.addEventListener('click', e => {
    const k = e.target.closest('[data-sk]'), x = e.target.closest('[data-sx]');
    if (k) { const i = +k.dataset.sk, s = subsOf(t)[i]; s[1] = !s[1]; save(); refreshTask(t, i); }
    else if (x) { const i = +x.dataset.sx, old = subsOf(t)[i]; subsOf(t).splice(i, 1); save(); refreshTask(t); toast('Sous-tâche supprimée', { label: 'Annuler', run: () => { subsOf(t).splice(i, 0, old); save(); refreshTask(t); } }); }
  });
  chk.addEventListener('change', e => { const n = e.target.closest('[data-sn]'); if (n) { const v = n.value.trim(); if (v) subsOf(t)[+n.dataset.sn][0] = v; save(); refreshTask(t); } });
  chk.addEventListener('keydown', e => {
    if (e.key !== 'Enter') return;
    const a = e.target.closest('[data-sadd]'), n = e.target.closest('[data-sn]');
    if (n) { e.preventDefault(); n.blur(); return; }
    if (!a || !a.value.trim()) return;
    e.preventDefault(); subsOf(t).push([a.value.trim(), false]); t.open = true; save(); refreshTask(t);
    const box = $(`.tedit[data-for="${t.id}"] .tchk`); if (!box) return;
    const rows = $$('.tchk-r', box); if (rows.length) rows[rows.length - 1].classList.add('in');
    $('[data-sadd]', box).focus();
  });
  sortable(chk, { item: '.tchk-r', lists: '.tchk', sameList: true, skip: 'button', soft: 'input', onDrop: (el, list) => reorderSubs(t, list, '.tchk-r', 'k') });
  // images: add with the button, by dropping files on the editor or by pasting
  const addImgs = async files => { const n = await addTaskImages(t, files); if (n) { refreshTask(t); toast(`${n} image${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}`); } return n; };
  $('.timgs', ed).addEventListener('click', e => {
    const x = e.target.closest('[data-imgx]'); if (x) { const i = resOf(t).indexOf(x.dataset.imgx); if (i < 0) return; const id = resOf(t).splice(i, 1)[0]; save(); refreshTask(t); toast('Image retirée', { label: 'Annuler', run: () => { resOf(t).splice(i, 0, id); save(); refreshTask(t); } }); return; }
    const im = e.target.closest('[data-img]'); if (im) { showImage(im.dataset.img); return; }
    if (e.target.closest('[data-imgadd]')) { const i = $('#fileIn'); i.accept = 'image/*'; i.onchange = () => { const f = [...i.files]; i.value = ''; i.accept = ''; addImgs(f); }; i.click(); }
  });
  ed.addEventListener('dragover', e => { if ([...(e.dataTransfer.types || [])].includes('Files')) { e.preventDefault(); e.stopPropagation(); ed.classList.add('over'); } });
  ed.addEventListener('dragleave', e => { if (!ed.contains(e.relatedTarget)) ed.classList.remove('over'); });
  ed.addEventListener('drop', e => { const f = [...(e.dataTransfer.files || [])]; ed.classList.remove('over'); if (!f.length) return; e.preventDefault(); e.stopPropagation(); addImgs(f); });
  ed.addEventListener('paste', e => { const f = [...((e.clipboardData && e.clipboardData.files) || [])].filter(x => x.type.startsWith('image/')); if (f.length) { e.preventDefault(); addImgs(f); } });
  $('#te-t', ed).onkeydown = e => { if (e.key === 'Enter') { upd(); rerender(); } };
  $('#te-n', ed).oninput = () => { t.note = $('#te-n', ed).value; save(); };
  $('#te-dup', ed).onclick = () => { const c = dupTask(t); rerender(); toast('Tâche dupliquée', { label: 'Annuler', run: () => { S.tasks = S.tasks.filter(x => x !== c); save(); smoothTasks(refreshTaskViews); } }); };
  $('#te-del', ed).onclick = () => { const i = S.tasks.indexOf(t); S.tasks.splice(i, 1); save(); rerender(); toast('Tâche supprimée', { label: 'Annuler', run: () => { S.tasks.splice(i, 0, t); save(); smoothTasks(refreshTaskViews); } }); };
  $('#te-t', ed).focus();
}

/* ---------- motion: rows slide to their new place after a change, and drag to reorder ---------- */
const reduceMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const EASE = 'cubic-bezier(.2,.8,.2,1)';
/* FLIP: note where the elements are, change the page, then let each one glide from its old place to the new one */
function glide(els, before, ms = 240) {
  const moves = els.map(el => { const y0 = before(el); return y0 === undefined ? null : [el, y0 - el.getBoundingClientRect().top]; }).filter(m => m && Math.abs(m[1]) > .5 && Math.abs(m[1]) < innerHeight * 1.5);
  for (const [el, dy] of moves) { el.style.transition = 'none'; el.style.transform = `translateY(${dy}px)`; }
  if (!moves.length) return;
  void document.body.offsetHeight;
  for (const [el] of moves) { el.style.transition = `transform ${ms}ms ${EASE}`; el.style.transform = ''; el.addEventListener('transitionend', () => { el.style.transition = ''; }, { once: true }); }
}
function smoothTasks(fn) {
  if (reduceMotion()) return fn();
  const before = new Map($$('.tw[data-tw]').map(el => [el.dataset.tw, el.getBoundingClientRect().top]));
  fn();
  if (!before.size) return;
  const els = $$('.tw[data-tw]');
  els.forEach(el => { if (!before.has(el.dataset.tw)) el.classList.add('tw-in'); });
  glide(els, el => before.get(el.dataset.tw));
}
/* drag to reorder (from NoteIt): the mouse drags after a few pixels, a finger or the pen after a short hold (so the page
   still scrolls). The others make room as you go and the item glides into its slot on release. */
function sortable(root, o) {
  let st = null, noClick = 0;
  root.addEventListener('click', e => { if (Date.now() < noClick) { e.stopPropagation(); e.preventDefault(); } }, true);
  root.addEventListener('touchmove', e => { if (st && st.active) e.preventDefault(); }, { passive: false });
  root.addEventListener('contextmenu', e => { if (st) { e.preventDefault(); e.stopPropagation(); } }, true);
  root.addEventListener('pointerdown', e => {
    if (st || e.button > 0) return;
    const it = e.target.closest(o.item); if (!it || !root.contains(it) || !it.parentElement.matches(o.lists)) return;
    const grip = o.grip && e.target.closest(o.grip), soft = !!(o.soft && e.target.closest(o.soft));
    if (!grip && o.skip && e.target.closest(o.skip)) return;
    st = { it, home: it.parentElement, list: it.parentElement, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, pid: e.pointerId, touch: e.pointerType !== 'mouse', soft, active: false };
    addEventListener('pointermove', move, { passive: false }); addEventListener('pointerup', end); addEventListener('pointercancel', end);
    if (grip) { e.preventDefault(); begin(); } else if (st.touch) st.timer = setTimeout(begin, 280);
  });
  function begin() {
    const s = st; if (!s || s.active) return;
    s.active = true; clearTimeout(s.timer);
    if (s.soft && document.activeElement && s.it.contains(document.activeElement)) document.activeElement.blur();
    try { getSelection().removeAllRanges(); } catch (e) {}
    if (o.prune) s.it.querySelectorAll(o.prune).forEach(x => x.remove());
    const r = s.it.getBoundingClientRect(); s.r0 = r;
    const g = s.it.cloneNode(true); g.className += ' sort-ghost' + (o.ghost ? ' ' + o.ghost : ''); g.querySelectorAll('[id]').forEach(n => n.removeAttribute('id'));
    Object.assign(g.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px' });
    document.body.append(g); s.g = g; requestAnimationFrame(() => g.classList.add('lift'));
    s.it.classList.add('sort-ph'); document.body.classList.add('sorting');
    try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
    place(); loop();
  }
  function move(e) {
    const s = st; if (!s || e.pointerId !== s.pid) return;
    s.x = e.clientX; s.y = e.clientY;
    if (!s.active) {
      const dx = Math.abs(s.x - s.sx), dy = Math.abs(s.y - s.sy), d = Math.hypot(dx, dy);
      if (s.touch) { if (d > 8) stop(); }
      else if (s.soft) { if (dy > 7 && dy > dx * 1.5) begin(); else if (dx > 7) stop(); }   // sideways in a text field = selecting text
      else if (d > 5) begin();
      return;
    }
    e.preventDefault(); place();
  }
  function place() {
    const s = st; s.g.style.transform = `translate(${s.x - s.sx}px, ${s.y - s.sy}px)`;
    let list = s.list;
    if (!o.sameList) { const u = document.elementFromPoint(s.x, s.y), l = u && (u.closest(o.lists) || (o.listAt && o.listAt(u))); if (l && root.contains(l) && l.matches(o.lists)) list = l; }
    const items = [...list.children].filter(c => c.matches(o.item) && c !== s.it);
    let before = items.find(c => { const r = c.getBoundingClientRect(); return s.y < r.top + r.height / 2; }) || null;
    if (!before && items.length) before = items[items.length - 1].nextElementSibling;
    if (s.it.parentElement === list && (before === s.it || s.it.nextElementSibling === before)) return;
    const moving = [s.it, ...items, ...(list !== s.list ? [...s.list.children].filter(c => c.matches(o.item)) : [])];
    const tops = new Map(moving.map(el => [el, el.getBoundingClientRect().top]));
    list.insertBefore(s.it, before); s.list = list;
    if (!reduceMotion()) glide(moving, el => tops.get(el), 180);
  }
  function loop() {
    const s = st; if (!s || !s.active) return;
    const sc = o.scroll === false ? null : $('#view');
    if (sc) { const r = sc.getBoundingClientRect(), E = 56; const v = s.y < r.top + E ? -(r.top + E - s.y) / 4 : s.y > r.bottom - E ? (s.y - r.bottom + E) / 4 : 0; if (v) { sc.scrollTop += Math.max(-18, Math.min(18, v)); place(); } }
    s.raf = requestAnimationFrame(loop);
  }
  function stop() { const s = st; if (!s) return null; removeEventListener('pointermove', move); removeEventListener('pointerup', end); removeEventListener('pointercancel', end); clearTimeout(s.timer); cancelAnimationFrame(s.raf); st = null; return s; }
  function end(e) {
    if (!st || (e && e.pointerId !== st.pid)) return;
    const s = stop(); if (!s.active) return;
    noClick = Date.now() + 350;
    // a finger held still then lifted is a long press, not a move
    const still = s.touch && Math.hypot(s.x - s.sx, s.y - s.sy) < 8 && s.it.parentElement === s.home;
    const done = () => { s.g.remove(); s.it.classList.remove('sort-ph'); document.body.classList.remove('sorting'); if (still && o.onHold) o.onHold(s.it); else o.onDrop(s.it, s.it.parentElement, s.home); };
    if (reduceMotion()) { done(); return; }
    const r = s.it.getBoundingClientRect();
    s.g.style.transition = `transform .2s ${EASE}, scale .2s ${EASE}, box-shadow .2s`; s.g.classList.remove('lift');
    s.g.style.transform = `translate(${r.left - s.r0.left}px, ${r.top - s.r0.top}px)`;
    setTimeout(done, 200);
  }
}
function refreshTaskViews() {
  renderSide();
  if (R.name === 'tasks' || R.name === 'space' || R.name === 'todo') { const v = $('#view'), st = v.scrollTop; go(R, { keepFocus: true }); v.scrollTop = st; }
  else if (R.name === 'doc' && typeof Board !== 'undefined') Board.refreshRefs();
}

/* quick add: the text as it is, in the space of the page */
function quickAddBox(id, ph, spDefault) {
  return `<label class="qadd">${icon('plus')}<input id="${id}" placeholder="${esc(ph)}" autocomplete="off" data-sp="${spDefault || ''}"></label>`;
}
function bindQuickAdd(input, after) {
  input.onkeydown = e => {
    if (e.key !== 'Enter' || !input.value.trim()) return;
    const t = newTask({ t: input.value, sp: input.dataset.sp || undefined });
    input.value = ''; after && after(t);
    setTimeout(() => { const i = input.id && $('#' + input.id); if (i) i.focus({ preventScroll: true }); }, 0);
  };
}

function bindCreate(v) {
  v.addEventListener('click', e => {
    const n = e.target.closest('[data-new]'); if (n) { createFrom(n.dataset.new); return; }
  });
  const fab = $('#fab', v); if (fab) fab.onclick = e => openPop(e.currentTarget, [
    { label: 'Nouvelle note', icon: 'note', run: () => createFrom('note') },
    { label: 'Nouveau board', icon: 'board', run: () => createFrom('board') },
    { label: 'Nouvelle tâche', icon: 'tasks', run: () => { go(isGlobal() ? 'todo' : 'tasks'); setTimeout(() => $('#tAdd') && $('#tAdd').focus(), 30); } }
  ], { above: true, align: 'right' });
}
function createFrom(kind) {
  if (kind === 'note') { const d = newDoc('note'); go('doc:' + d.id); setTimeout(() => Note.focusTitle(), 40); return; }
  const d = newDoc('board', { title: 'Nouveau board' });
  go('doc:' + d.id);
}

/* ================= doc lists ================= */
function docCard(d, o = {}) {
  const sp = spaceById(d.sp);
  // on the pages that cover every space, the card says where the page is filed (drag it onto a space of the sidebar to file it)
  const where = o.where && sp ? `<button class="dsp${sp.id === DEF_SPACE ? ' none' : ''}" data-file="${d.id}" title="Ranger dans…">${sp.id === DEF_SPACE ? 'Non classée' : esc(sp.name)}</button>` : '';
  return `<div class="dcard" data-doc="${d.id}"${d.trash ? '' : ' draggable="true"'}${theme().docAttrs ? ' ' + theme().docAttrs(d, sp) : ''}><button class="th" data-open="${d.id}" aria-label="Ouvrir ${esc(d.title)}">${Thumbs.svg(d)}<span class="kind">${icon(d.type === 'board' ? 'board' : 'note', 'sm')}${d.type === 'board' ? 'Board' : 'Note'}</span></button>
    ${d.trash ? '' : `<button class="fav" data-fav="${d.id}" aria-pressed="${d.fav}" aria-label="Favori">${icon('star', 'sm')}</button>`}
    <div class="meta${where ? ' where' : ''}">${sp ? `<span class="sdot" style="background:${sp.color}"></span>` : ''}<b>${esc(d.title)}</b><small>${where}${ago(d.updated)}</small></div>
    ${d.trash ? `<div class="trashacts"><button class="btn sm" data-restore="${d.id}">${icon('restore', 'sm')}Restaurer</button><button class="btn sm ghost danger" data-purge="${d.id}">Supprimer</button></div>` : ''}</div>`;
}
function bindDocCards(v) {
  v.addEventListener('click', e => {
    const o = e.target.closest('[data-open]'); if (o) { const d = docById(o.dataset.open); if (d && d.trash) return; go('doc:' + o.dataset.open); return; }
    const f = e.target.closest('[data-fav]'); if (f) { const d = docById(f.dataset.fav); d.fav = !d.fav; touch(d); f.setAttribute('aria-pressed', d.fav); renderSide(); if (R.name === 'favs') go('favs'); return; }
    const r = e.target.closest('[data-restore]'); if (r) { const d = docById(r.dataset.restore); d.trash = false; touch(d); go('trash'); toast('Restauré'); return; }
    const p = e.target.closest('[data-purge]'); if (p) { purgeDocs([docById(p.dataset.purge)]); return; }
    const fl = e.target.closest('[data-file]'); if (fl) { fileMenu(fl, docById(fl.dataset.file), { after: () => go(R, { keepFocus: true }) }); return; }
  });
}
function purgeDocs(list) {
  const box = $('#purgeBox') || document.createElement('div');
  box.id = 'purgeBox'; box.className = 'confirm';
  box.innerHTML = `<span>${list.length > 1 ? `Supprimer définitivement ${list.length} éléments ?` : `Supprimer définitivement « ${esc(list[0].title)} » ?`} Ce n'est pas réversible.</span><button class="btn sm" id="pgNo">Garder</button><button class="btn sm pri" id="pgYes" style="background:var(--err);border-color:var(--err)">Supprimer</button>`;
  $('.page').prepend(box);
  $('#pgNo').onclick = () => box.remove();
  $('#pgYes').onclick = () => { const ids = new Set(list.map(d => d.id)); S.docs = S.docs.filter(d => !ids.has(d.id)); save(); gcAssets(); go('trash'); toast('Supprimé'); };
}
function renderDocList(v, kind) {
  const sp = curSpace(), inSp = d => d.sp === sp.id && !d.trash;
  const conf = { notes: ['Notes', d => d.type === 'note' && inSp(d), `Les notes de ${sp.name} : texte, croquis et images.`], boards: ['Boards', d => d.type === 'board' && inSp(d), `Les boards de ${sp.name}, sur une toile infinie.`], favs: ['Favoris', d => d.fav && !d.trash, 'Ce que vous avez marqué d’une étoile, dans tous les espaces.'], trash: ['Corbeille', d => d.trash, 'Restaurez ou supprimez pour de bon.'] }[kind];
  const list = S.docs.filter(conf[1]).sort((a, b) => b.updated - a.updated);
  v.innerHTML = `<div class="page"><div class="ph"><div><h1>${conf[0]}</h1><div class="sub">${conf[2]}</div></div><div class="acts">
      ${kind === 'trash' ? (list.length ? `<button class="btn ghost danger" id="emptyTrash">${icon('trash')}Vider la corbeille</button>` : '') : `<button class="btn" data-new="note">${icon('note')}Nouvelle note</button><button class="btn pri" data-new="board">${icon('board')}Nouveau board</button>`}</div></div>
    <div class="docs">${kind === 'notes' ? `<button class="newcard" data-new="note">${icon('plus', 'lg')}Nouvelle note</button>` : ''}${kind === 'boards' ? `<button class="newcard" data-new="board">${icon('plus', 'lg')}Nouveau board</button>` : ''}${list.map(docCard).join('')}</div>
    ${!list.length && (kind === 'favs' || kind === 'trash') ? `<div class="empty">${kind === 'favs' ? "Aucun favori. Touchez l'étoile d'une note ou d'un board pour le retrouver ici." : 'La corbeille est vide.'}</div>` : ''}
  </div>${kind === 'trash' ? '' : `<button class="fab" id="fab" aria-label="Créer">${icon('plus')}</button>`}`;
  bindDocCards(v); bindCreate(v);
  const et = $('#emptyTrash'); if (et) et.onclick = () => purgeDocs(list);
}
/* every note and board, whatever its space (Evernote's « Notes »): filters by kind and by space, kept in S.prefs.allF */
const allFilter = () => { const f = S.prefs.allF || (S.prefs.allF = { k: 'all', sp: '' }); if (f.sp && !spaceById(f.sp)) f.sp = ''; return f; };
function renderAll(v) {
  const f = allFilter(), ld = liveDocs();
  const list = ld.filter(d => (f.k === 'all' || d.type === f.k) && (!f.sp || d.sp === f.sp)).sort((a, b) => b.updated - a.updated);
  const nIn = id => ld.filter(d => d.sp === id).length;
  const chip = (attr, val, cur, label, extra = '') => `<button class="chip fchip" ${attr}="${val}" aria-pressed="${cur === val}">${extra}${label}</button>`;
  const spChips = [chip('data-fsp', '', f.sp, 'Tous les espaces'), chip('data-fsp', DEF_SPACE, f.sp, `${DEF_NAME} <small>${nIn(DEF_SPACE) || ''}</small>`, icon('inbox', 'sm')),
    ...userSpaces().map(s => chip('data-fsp', s.id, f.sp, `${esc(s.name)} <small>${nIn(s.id) || ''}</small>`, `<span class="sdot" style="background:${s.color}"></span>`))].join('');
  const where = f.sp ? spaceById(f.sp).name : '';
  v.innerHTML = `<div class="page allpage"><div class="ph"><div><h1>Toutes les notes</h1><div class="sub">${list.length ? `${list.length} page${list.length > 1 ? 's' : ''}` : 'Rien pour l’instant'}${where ? ` dans ${esc(where)}` : ', tous espaces confondus'}. Glissez une carte sur un espace de la barre latérale pour la ranger.</div></div><div class="acts">
      <button class="btn" data-new="board">${icon('board')}Nouveau board</button><button class="btn pri" data-new="note">${icon('note')}Nouvelle note</button></div></div>
    <div class="fbar"><div class="seg fkind">${[['all', 'Tout'], ['note', 'Notes'], ['board', 'Boards']].map(([k, l]) => `<button data-fk="${k}" aria-pressed="${f.k === k}">${l}</button>`).join('')}</div><div class="fsps">${spChips}</div></div>
    <div class="docs"><button class="newcard" data-new="note">${icon('plus', 'lg')}Nouvelle note</button>${list.map(d => docCard(d, { where: true })).join('')}</div>
    ${!list.length && (f.sp || f.k !== 'all') ? '<div class="empty">Aucune page avec ces filtres.</div>' : ''}
  </div><button class="fab" id="fab" aria-label="Créer">${icon('plus')}</button>`;
  bindDocCards(v); bindCreate(v);
  $('.fbar', v).onclick = e => {
    const k = e.target.closest('[data-fk]'), sp = e.target.closest('[data-fsp]');
    if (k) f.k = k.dataset.fk; else if (sp) f.sp = sp.dataset.fsp; else return;
    save(); go('all');
  };
}
/* every open task, one block per space (« Non classées » first); drag a task into another block to move it */
function renderAllTasks(v) {
  const open = S.tasks.filter(t => !t.done), done = S.tasks.filter(t => t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const sps = [spaceById(DEF_SPACE), ...userSpaces()].filter(Boolean);
  const grp = sp => { const l = open.filter(t => t.sp === sp.id).sort(taskSort); if (!l.length && sp.id !== DEF_SPACE) return '';
    return `<section class="tgroup" data-sp="${sp.id}"><h3><button class="tg-h" data-go="space:${sp.id}">${sp.id === DEF_SPACE ? icon('inbox', 'sm') : `<span class="sdot" style="background:${sp.color}"></span>`}${esc(sp.name)}</button><small>${l.length || ''}</small></h3>
      <div class="tlist tl-light">${l.map(t => taskRow(t, { drag: true })).join('') || '<div class="tempty">Rien ici. Les tâches écrites ci-dessus arrivent dans ce bloc.</div>'}</div></section>`; };
  v.innerHTML = `<div class="page tpage" style="max-width:760px"><div class="ph"><div><h1>Tâches</h1><div class="sub">${open.length} à faire dans tous les espaces${done.length ? ` · ${done.length} terminée${done.length > 1 ? 's' : ''}` : ''}</div></div></div>
    ${quickAddBox('tAdd', 'Ajouter une tâche… (elle ira dans Non classées)', DEF_SPACE)}
    <div id="tGroups" class="tgroups">${sps.map(grp).join('')}</div>
    ${done.length ? `<details class="donegrp"><summary>${icon('chev', 'sm')}Terminées (${done.length})</summary><div class="tlist">${done.slice(0, 80).map(t => taskRow(t, { space: true })).join('')}</div></details>` : ''}
  </div>`;
  bindTaskList(v, () => go('todo'));
  bindQuickAdd($('#tAdd'), () => go('todo'));
  setTimeout(() => { const i = $('#tAdd'); if (i && innerWidth > 760) i.focus({ preventScroll: true }); }, 0);
}
/* the home of a space: its tasks, its moodboard, its boards and notes */
function renderSpace(v) {
  const sp = spaceById(R.id), docs = liveDocs().filter(d => d.sp === sp.id).sort((a, b) => b.updated - a.updated);
  const open = S.tasks.filter(t => t.sp === sp.id && !t.done).sort(taskSort), done = S.tasks.filter(t => t.sp === sp.id && t.done);
  const nb = docs.filter(d => d.type === 'board').length, nn = docs.length - nb, nm = (sp.media || []).length;
  const pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const isDef = sp.id === DEF_SPACE;
  v.innerHTML = `<div class="page sphome">
    <div class="ph sp-ph"><div class="sp-hd"><div class="sp-kick">${isDef ? `${icon('inbox', 'sm')}Hors espace` : `<span class="sdot" style="background:${sp.color}"></span>Espace`}</div>
      <input class="sp-title" id="spTitle" value="${esc(sp.name)}" aria-label="Nom de l'espace" spellcheck="false"${isDef ? ' readonly tabindex="-1"' : ''}>
      <div class="sub">${isDef ? 'Les notes et les tâches rangées dans aucun espace. Rangez-les quand vous voulez, ou laissez-les ici. ' : ''}${[pl(open.length, 'tâche') + ' à faire', nb ? pl(nb, 'board') : '', nn ? pl(nn, 'note') : '', nm ? pl(nm, 'élément') + ' au moodboard' : ''].filter(Boolean).join(' · ')}</div></div>
      <div class="acts"><button class="btn" data-new="note">${icon('note')}Note</button><button class="btn pri" data-new="board">${icon('board')}Board</button></div></div>
    <div class="sp-grid">
      <section class="card sp-tasks"><h2>${icon('tasks')}Tâches <span class="ct">${open.length || ''}</span><button class="more" data-go="tasks">Tout voir</button></h2>${quickAddBox('sAdd', 'Ajouter une tâche…', sp.id)}
        <div id="sTasks" class="tl-light" data-tlist data-sp="${sp.id}">${open.map(t => taskRow(t, { drag: true })).join('') || '<div class="empty sm">Rien à faire ici pour le moment.</div>'}</div>
        ${done.length ? `<details class="donegrp"><summary>${icon('chev', 'sm')}Terminées (${done.length})</summary><div id="sDone">${done.map(t => taskRow(t)).join('')}</div></details>` : ''}</section>
      <section class="card sp-mood" id="spMood"><h2>${icon('image')}Moodboard <span class="ct">${nm || ''}</span><button class="more" data-go="mood">Ouvrir</button></h2>${Mood.preview(sp)}</section>
    </div>
    <section class="sp-docs"><h2 class="sp-h">Boards et notes</h2>
      <div class="docs"><button class="newcard" data-new="board">${icon('plus', 'lg')}Nouveau board</button><button class="newcard" data-new="note">${icon('plus', 'lg')}Nouvelle note</button>${docs.map(docCard).join('')}</div></section>
  </div><button class="fab" id="fab" aria-label="Créer">${icon('plus')}</button>`;
  bindDocCards(v); bindCreate(v); bindTaskList($('.sp-tasks', v), () => go(R));
  bindQuickAdd($('#sAdd'), () => go(R));
  Mood.bindPreview($('#spMood', v), sp);
  const ti = $('#spTitle', v);
  if (ti && !isDef) {
    ti.onkeydown = e => { if (e.key === 'Enter') ti.blur(); if (e.key === 'Escape') { ti.value = sp.name; ti.blur(); } };
    ti.oninput = () => { const n = ti.value.trim(); if (n) { sp.name = n.slice(0, 60); save(); renderSide(); const c = $('#top .crumbs .cur'); if (c) c.textContent = sp.name; } };
    ti.onblur = () => { if (!ti.value.trim()) ti.value = sp.name; };
  }
}

/* ================= tasks ================= */
const ordOf = t => typeof t.ord === 'number' ? t.ord : 1e9;
const taskSort = (a, b) => ordOf(a) - ordOf(b) || a.created - b.created;
function renderTasks(v) {
  const sp = curSpace(), open = S.tasks.filter(t => t.sp === sp.id && !t.done).sort(taskSort), done = S.tasks.filter(t => t.sp === sp.id && t.done).sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  v.innerHTML = `<div class="page tpage" style="max-width:760px"><div class="ph"><div><h1>Tâches</h1><div class="sub">${esc(sp.name)} · ${open.length} à faire${done.length ? ` · ${done.length} terminée${done.length > 1 ? 's' : ''}` : ''}</div></div></div>
    ${quickAddBox('tAdd', 'Ajouter une tâche…', sp.id)}
    <div class="tlist tl-light" data-tlist data-sp="${sp.id}">${open.map(t => taskRow(t, { drag: true })).join('') || '<div class="tempty">Aucune tâche. Écrivez-en une ci-dessus puis Entrée.</div>'}</div>
    ${done.length ? `<details class="donegrp"><summary>${icon('chev', 'sm')}Terminées (${done.length})</summary><div class="tlist">${done.slice(0, 80).map(t => taskRow(t)).join('')}</div></details>` : ''}
  </div>`;
  bindTaskList(v, () => go('tasks'));
  bindQuickAdd($('#tAdd'), () => go('tasks'));
  setTimeout(() => { const i = $('#tAdd'); if (i && innerWidth > 760) i.focus({ preventScroll: true }); }, 0);
}

/* ================= search ================= */
function docText(d) {
  if (d.type === 'note') { const t = document.createElement('div'); t.innerHTML = noteHTML(d, '<p></p>'); return (t.textContent || '').replace(/\s+/g, ' '); }
  return (d.items || []).map(i => i.txt || i.title || i.name || '').filter(Boolean).join(' · ');
}
function searchAll(q) {
  const n = norm(q); if (!n) return [];
  const out = [];
  for (const d of liveDocs()) { const ti = norm(d.title).includes(n), tx = !ti && norm(docText(d)).includes(n); if (ti || tx) out.push({ kind: d.type, id: d.id, title: d.title, score: ti ? 2 : 1, sp: d.sp }); }
  for (const t of S.tasks) if (norm(t.t).includes(n) || norm(t.note).includes(n) || subsOf(t).some(x => norm(x[0]).includes(n))) out.push({ kind: 'task', id: t.id, title: t.t, score: 1.5, sp: t.sp, done: t.done });
  for (const s of S.spaces) if (norm(s.name).includes(n)) out.push({ kind: 'space', id: s.id, title: s.name, score: 3 });
  return out.sort((a, b) => b.score - a.score).slice(0, 30);
}
const KIND_FR = { note: 'Note', board: 'Board', task: 'Tâche', space: 'Espace' };
function openResult(r) {
  if (r.kind === 'task') { const t = taskById(r.id); if (t) setCurSpace(t.sp); go('tasks'); setTimeout(() => { const row = $(`[data-task="${r.id}"]`); if (row) { row.scrollIntoView({ block: 'center' }); toggleTaskEdit(row, taskById(r.id), () => go('tasks')); } }, 30); }
  else if (r.kind === 'space') go('space:' + r.id);
  else go('doc:' + r.id);
}
function bindSearch() {
  const q = $('#q');
  const show = () => {
    const res = searchAll(q.value);
    if (!q.value.trim()) { closePop(); return; }
    const html = res.length ? res.slice(0, 9).map((r, i) => `<button class="mi" data-i="${i}">${icon(r.kind === 'task' ? 'tasks' : r.kind === 'space' ? 'folder' : r.kind)}<span class="t">${esc(r.title)}</span><span class="k">${KIND_FR[r.kind]}</span></button>`).join('') + (res.length > 9 ? `<div class="msep"></div><button class="mi" data-all="1">${icon('search')}<span>Voir les ${res.length} résultats</span></button>` : '') : `<div class="empty" style="padding:10px">Rien pour « ${esc(q.value)} ».</div>`;
    const p = openPop(q.closest('.sbox'), html, { cls: '', focus: false }); p.id = 'sres';
    p.onclick = e => { const b = e.target.closest('[data-i]'); if (b) { openResult(res[+b.dataset.i]); q.value = ''; closePop(); } if (e.target.closest('[data-all]')) { go('search:' + q.value); closePop(); } };
  };
  q.oninput = show;
  q.onkeydown = e => {
    if (e.key === 'Enter') { const res = searchAll(q.value); if (res[0]) { openResult(res[0]); q.value = ''; closePop(); q.blur(); } }
    if (e.key === 'Escape') { q.value = ''; closePop(); q.blur(); }
    if (e.key === 'ArrowDown') { const f = $('#sres .mi'); if (f) { e.preventDefault(); f.focus(); } }
  };
}
function renderSearch(v) {
  const res = searchAll(R.id);
  v.innerHTML = `<div class="page" style="max-width:820px"><div class="ph"><div><h1>« ${esc(R.id)} »</h1><div class="sub">${res.length} résultat${res.length > 1 ? 's' : ''}</div></div></div>
    <div class="card">${res.map((r, i) => `<button class="mi" data-i="${i}">${icon(r.kind === 'task' ? 'tasks' : r.kind === 'space' ? 'folder' : r.kind)}<span>${esc(r.title)}</span><small>${KIND_FR[r.kind]}</small></button>`).join('') || '<div class="empty">Aucun résultat.</div>'}</div></div>`;
  v.onclick = e => { const b = e.target.closest('[data-i]'); if (b) openResult(res[+b.dataset.i]); };
}

/* ================= theme, focus, settings ================= */
const mqDark = matchMedia('(prefers-color-scheme: dark)');
/* the theme (S.prefs.skin, see themes in 00-util.js) sets <html data-skin>; its manifest says whether light/dark is
   the user's choice, swaps the icons it redraws and adds its decoration layers */
let themeOn = null;
const ICON_BASE = {};
function swapIcons(th) {
  const names = new Set(Object.values(THEMES).flatMap(t => Object.keys(t.icons || {})));
  for (const n of names) {
    const sym = document.getElementById('i-' + n); if (!sym) continue;
    if (!(n in ICON_BASE)) ICON_BASE[n] = [sym.getAttribute('viewBox'), sym.innerHTML];
    const o = th.icons[n], [vb, svg] = o ? typeof o === 'string' ? ['0 0 24 24', o] : [o.vb || '0 0 24 24', o.svg] : ICON_BASE[n];
    if (sym.innerHTML !== svg) { sym.setAttribute('viewBox', vb); sym.innerHTML = svg; }
  }
}
function placeDecor(th) {
  $$('.th-decor').forEach(d => d.remove());
  for (const d of th.decor || []) $$(d.at).forEach(host => { const el = document.createElement('div'); el.className = 'th-decor ' + (d.cls || ''); el.setAttribute('aria-hidden', 'true'); host.appendChild(el); });
}
/* the size of the whole interface (Réglages > UI): the desktop app zooms its page like the browser zoom, so the
   pointer and the pen still land where they should; a browser gets CSS zoom */
const UI_SCALES = ['50', '75', '100', '125'];
function applyUiScale() {
  const v = UI_SCALES.includes(String(S.prefs.uiScale)) ? +S.prefs.uiScale : 100;
  if (window.notely && window.notely.setZoom) window.notely.setZoom(v / 100);
  else document.documentElement.style.zoom = v === 100 ? '' : v / 100;
  if (typeof Board !== 'undefined' && Board.mounted) Board.layoutChanged();
}
function applyTheme() {
  const sk = S && THEMES[S.prefs.skin] ? S.prefs.skin : 'minimal', th = THEMES[sk] || THEME_BASE, r = document.documentElement;
  const t = th.mode === 'user' ? (S ? S.prefs.theme : 'auto') : th.mode;
  const prev = themeOn; themeOn = th;
  if (prev && prev !== th && prev.apply) prev.apply(false);
  r.dataset.skin = sk;
  if (t === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', t);
  r.dataset.resolved = t === 'auto' ? (mqDark.matches ? 'dark' : 'light') : t;
  if (prev !== th) { swapIcons(th); placeDecor(th); if (th.apply) th.apply(true); }
  applyLook(th, r);
  syncTitleBar(t);
  const tb = $('#themeBtn'); if (tb) tb.hidden = th.mode !== 'user';
  const tc = $('meta[name="theme-color"]'); if (tc) tc.content = th.meta || '';
  /* the boards follow the theme's colour scheme (S.prefs.schemeTh = the theme their colours are in) */
  let from = null;
  if (S && S.prefs.schemeTh !== sk) { if (THEMES[S.prefs.schemeTh]) { from = schemeOf(THEMES[S.prefs.schemeTh]); remapScheme(from, schemeOf(th)); } S.prefs.schemeTh = sk; save(); }
  if (S) { renderSide(); if (R.name === 'doc' && typeof Board !== 'undefined') { Board.retheme(from); Note.retheme(); } }
}
/* the theme's colour and accent chosen in Réglages (themes with tints / accents): the theme's CSS reads them */
function applyLook(th, r) {
  const lk0 = themeLook(th.id, S && S.prefs), lk = lk0.def ? {} : lk0, st = r.style;   // def: the theme's own colours, whatever was chosen
  const tint = th.tints && (lk.tint === 'custom' && /^#[0-9a-f]{6}$/i.test(lk.tintHex || '') ? tintOf(lk.tintHex) : th.tints.find(x => x.id === lk.tint) || th.tints[0]);
  if (tint) { st.setProperty('--th-h', tint.h); st.setProperty('--th-c', tint.c); r.dataset.tint = tint.id; }
  else { st.removeProperty('--th-h'); st.removeProperty('--th-c'); delete r.dataset.tint; }
  // a colour picked by hand also sets how light the surfaces are, but only in the mode it fits: a dark colour lifts the dark look
  // (from about .23), a pale one lowers the light look a little (from about .97). A dark colour no longer greys the light mode.
  st.removeProperty('--th-ld'); st.removeProperty('--th-ll');
  if (tint && tint.l != null) { if (r.dataset.resolved === 'light') { if (tint.l > .82) st.setProperty('--th-ll', clamp(tint.l - .97, -.06, 0).toFixed(3)); } else if (tint.l < .55) st.setProperty('--th-ld', clamp(tint.l - .23, -.1, .22).toFixed(3)); }
  const a = th.accents && /^#[0-9a-f]{6}$/i.test(lk.accent || '') && lk.accent.toLowerCase() !== th.accents[0].value.toLowerCase() ? lk.accent : null;
  if (a) { st.setProperty('--accent-c', a); st.setProperty('--on-accent-c', onAccent(a)); r.dataset.accent = 'custom'; }
  else { st.removeProperty('--accent-c'); st.removeProperty('--on-accent-c'); delete r.dataset.accent; }
}
/* live = while the colour picker is dragged: only the colours change, nothing is saved or redrawn */
function setLook(patch, live) {
  const th = theme(), look = S.prefs.look || (S.prefs.look = {});
  look[th.id] = Object.assign({}, look[th.id], patch);
  if (live) applyLook(th, document.documentElement); else { save(); applyTheme(); }
}
/* changing theme from Réglages: the old look fades into the new one */
function switchTheme(id) {
  if (!THEMES[id] || S.prefs.skin === id) return;
  const run = () => { S.prefs.skin = id; save(); applyTheme(); };
  if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) document.startViewTransition(run); else run();
}
mqDark.addEventListener && mqDark.addEventListener('change', applyTheme);
/* Windows app: the title bar is drawn here in the skin's colours (sidebar colour on the left, page colour on the right),
   window buttons included, so each skin can dress them (the base ones copy Windows 11, in --tb-sym on --tb-r) */
function syncTitleBar(t) {
  if (!DESKTOP || !window.notely.setTheme) return;
  let bar = $('#tbar');
  if (!bar) {
    document.documentElement.classList.add('tbar');
    bar = document.createElement('div'); bar.id = 'tbar';
    bar.innerHTML = `<span class="tb-l"><i class="pm" aria-hidden="true"></i>PLUM <small>${APP_VERSION}</small></span>`;
    // focus mode: a small exit button (and the assistant) next to the window buttons, instead of the floating pill
    bar.insertAdjacentHTML('beforeend', `<span class="tb-f"><button data-f="exit" title="Quitter le focus (Échap)" aria-label="Quitter le focus"><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.5 1.5v3h-3M7.5 1.5v3h3M4.5 10.5v-3h-3M7.5 10.5v-3h3"/></svg><span>Quitter le focus</span></button></span>`);
    const ai = $('#focusAi'); if (ai) $('.tb-f', bar).prepend(ai);
    const mo = $('#focusMood'); if (mo) $('.tb-f', bar).prepend(mo);
    bar.addEventListener('click', e => { if (e.target.closest('[data-f="exit"]')) setFocus(false); });
    if (window.notely.win) {
      const g = { min: '<path d="M2 6h8"/>', max: '<rect x="2" y="2" width="8" height="8" rx="1"/>', restore: '<rect x="2" y="4" width="6" height="6" rx="1"/><path d="M4 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1H8"/>', close: '<path d="m2.5 2.5 7 7m0-7-7 7"/>' };
      const b = (k, t) => `<button class="tb-w-${k}" data-w="${k}" title="${t}" aria-label="${t}"><svg viewBox="0 0 12 12" aria-hidden="true">${g[k === 'max' ? 'max' : k]}</svg></button>`;
      bar.insertAdjacentHTML('beforeend', `<span class="tb-w">${b('min', 'Réduire')}${b('max', 'Agrandir')}${b('close', 'Fermer')}</span>`);
      bar.addEventListener('click', e => { const w = e.target.closest('[data-w]'); if (w) window.notely.win(w.dataset.w); });
      const mx = $('.tb-w-max', bar);
      if (window.notely.onWinState) window.notely.onWinState(st => {
        document.documentElement.classList.toggle('win-max', !!st.max);
        const t = st.max || st.full ? 'Restaurer' : 'Agrandir';
        mx.title = t; mx.setAttribute('aria-label', t); $('svg', mx).innerHTML = st.max || st.full ? g.restore : g.max;
      });
    }
    document.body.prepend(bar);
  }
  const cs = getComputedStyle(bar), v = k => cs.getPropertyValue(k).trim();
  window.notely.setTheme({ mode: t === 'auto' ? 'system' : t, color: v('--tb-r'), symbol: v('--tb-sym') });
}

/* the assistant stays out of sight until it is switched on in Réglages */
function applyAi() {
  const on = !!S.prefs.aiOn;
  $('#focusAi').hidden = !on;
  if (!on && !$('#ai').hidden) AI.toggle(false);
  renderTop();
}
function setFocus(on) {
  const r = document.documentElement;
  if (on && R.name !== 'doc') return;
  r.toggleAttribute('data-focus', on);
  if (typeof Board !== 'undefined') Board.layoutChanged();
  Mood.layout();
}

/* Réglages > UI: the theme's colour (tint of the neutrals) and accent colour, for themes that offer them */
function lookRows(th) {
  const lk = themeLook(th.id, S.prefs), out = [];
  const custom = Object.keys(lk).some(k => lk[k] != null);
  if (th.tints || th.accents) out.push(`<div class="srow"><div class="l"><b>Couleurs par défaut du thème</b><small>${custom ? 'Remet la teinte et l’accent d’origine du thème.' : 'Le thème a ses couleurs d’origine.'}</small></div><button class="btn sm" data-lkreset${custom ? '' : ' disabled'}>Rétablir</button></div>`);
  if (th.tints) {
    const own = lk.tint === 'custom' && /^#[0-9a-f]{6}$/i.test(lk.tintHex || '') ? tintOf(lk.tintHex) : null, cur = own ? 'custom' : (th.tints.find(x => x.id === lk.tint) || th.tints[0]).id;
    out.push(`<div class="srow"><div class="l"><b>Couleur du thème</b><small>La teinte des fonds et des panneaux${own ? ', couleur choisie' : ''}.</small></div><div class="looks">${th.tints.map((x, i) => `<button class="lk-tint" data-tint="${x.id}" style="--h:${x.h};--cc:${x.c}" aria-pressed="${x.id === cur}" title="${esc(x.name)}${i ? '' : ' (par défaut)'}" aria-label="${esc(x.name)}"></button>`).join('')}<label class="lk-tint any" style="${own ? `--h:${own.h};--cc:${own.c}` : ''}" aria-pressed="${!!own}" title="Autre couleur…"><input type="color" data-k="tint" value="${own ? lk.tintHex : '#808080'}" aria-label="Autre couleur du thème"></label></div></div>`);
  }
  if (th.accents) {
    const own = th.accents[0].value.toLowerCase(), cur = (lk.accent || own).toLowerCase(), named = th.accents.find(a => a.value.toLowerCase() === cur);
    out.push(`<div class="srow"><div class="l"><b>Couleur d’accent</b><small>${named ? esc(named.name) : 'Couleur choisie'}${cur === own ? ', la couleur du thème' : ''}.</small></div><div class="looks">${th.accents.map(a => `<button class="lk-acc" data-acc="${a.value}" style="--c:${a.value}" aria-pressed="${a.value.toLowerCase() === cur}" title="${esc(a.name)}" aria-label="${esc(a.name)}"></button>`).join('')}<label class="lk-acc any" style="${named ? '' : `--c:${cur}`}" aria-pressed="${!named}" title="Autre couleur…"><input type="color" value="${cur}" aria-label="Autre couleur"></label></div></div>`);
  }
  return out.join('');
}

/* Réglages in four tabs; the last one used opens again */
const SET_TABS = [['ui', 'UI'], ['account', 'Compte'], ['board', 'Board'], ['other', 'Autres']];
let settingsTab = 'ui';
function openSettings(section) {
  const p = S.prefs;
  if (section === 'pen') settingsTab = 'board';
  const tab = settingsTab;
  const seg = (id, val, opts) => `<div class="seg" id="${id}">${opts.map(([v, l]) => `<button data-v="${v}" aria-pressed="${val === v}">${l}</button>`).join('')}</div>`;
  openModal(`<div class="mhd"><h2>Réglages</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
    <div class="stabs" role="tablist">${SET_TABS.map(([k, l]) => `<button role="tab" data-tab="${k}" aria-selected="${k === tab}">${l}</button>`).join('')}</div>
    <div class="spane" data-pane="account"${tab === 'account' ? '' : ' hidden'}>
    <div class="srow"><div class="l"><b>Prénom</b><small>Pour l'accueil.</small></div><input type="text" id="stName" value="${esc(p.name)}" aria-label="Prénom"></div>
    <div class="srow"><div class="l"><b>ChatGPT (clé personnelle)</b><small>${AI.keyInfo()}</small></div><button class="btn sm" id="stKey">${icon('key', 'sm')}Configurer</button></div>
    </div>
    <div class="spane" data-pane="ui"${tab === 'ui' ? '' : ' hidden'}>
    <div class="srow skinrow"><div class="l"><b>Thème</b><small>Couleurs, icônes et habillage de l’interface. Tes données ne changent pas.</small></div>
      <div class="skins" id="stSkin">${themeList().map(t => `<button class="skin-c sk-${t.id}" data-v="${t.id}" aria-pressed="${theme().id === t.id}"><span class="skin-pv" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>${esc(t.label)}</b><small>${esc(t.desc || '')}</small></button>`).join('')}</div></div>
    <div class="srow" id="stThemeRow"${theme().mode !== 'user' ? ' hidden' : ''}><div class="l"><b>Clair ou sombre</b></div>${seg('stTheme', p.theme, [['auto', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']])}</div>
    <div class="srow"><div class="l"><b>Taille de l’interface</b><small>Agrandit ou réduit tout PLUM : textes, boutons et panneaux.</small></div>${seg('stScale', UI_SCALES.includes(String(p.uiScale)) ? String(p.uiScale) : '100', UI_SCALES.map(v => [v, v + ' %']))}</div>
    <div id="stLook">${lookRows(theme())}</div>
    </div>
    <div class="spane" data-pane="board"${tab === 'board' ? '' : ' hidden'}>
    <h5 id="stPenSec" style="margin-top:4px">Stylet et dessin</h5>
    <div class="diag" id="stDiag"><span class="dot"></span><span id="stDiagTxt">${penDiagLine()}</span></div>
    ${DESKTOP ? `<div class="pp-hint" id="stWt">${penInfoLine()}</div>` : ''}
    <div class="padtest" id="stPad" aria-label="Zone de test du stylet"><svg viewBox="0 0 10 10" preserveAspectRatio="none"></svg><canvas></canvas><span class="padhint">Dessinez ici pour tester la pression : le trait doit grossir quand vous appuyez.</span></div>
    <div class="srow"><div class="l"><b>Pression</b><small>Stylet : lit la pression du stylet. Vitesse : le trait s'affine quand on va vite (souris). Fixe : toujours la même épaisseur.</small></div>${seg('stPress', p.pressure, [['pen', 'Stylet'], ['speed', 'Vitesse'], ['fixed', 'Fixe']])}</div>
    <div class="srow"><div class="l"><b>Sensibilité <b id="stSensV">${Math.round((p.sens ?? .5) * 100)} %</b></b><small>Plus haut : un appui léger donne déjà un trait plein.</small></div><input type="range" id="stSens" min="0" max="1" step=".05" value="${p.sens ?? .5}" style="width:160px;accent-color:var(--accent)" aria-label="Sensibilité"></div>
    ${DESKTOP ? `<div class="srow"><div class="l"><b>Source de pression</b><small>Auto : Windows Ink pour le stylet, Wintab quand la tablette ne passe pas par Windows Ink.</small></div>${seg('stSrc', p.source, [['auto', 'Auto'], ['ink', 'Windows Ink'], ['wintab', 'Wintab']])}</div>` : ''}
    <div class="srow"><div class="l"><b>Le stylet écrit toujours</b><small>Dans une note, le stylet dessine sans passer en mode Dessin ; le doigt fait défiler.</small></div><label class="tg"><input type="checkbox" id="stPen"${p.autoPen ? ' checked' : ''}><span></span></label></div>
    <div class="srow"><div class="l"><b>Molette de la souris sur un board</b></div>${seg('stWheel', p.wheel, [['zoom', 'Zoomer'], ['pan', 'Défiler']])}</div>
    <div class="srow"><div class="l"><b>Atelier de dessin</b><small>Simple : le pinceau dans le panneau Style et la barre d'outils. Complet : la roue peinte, les palettes, harmonies et variations sur le board.</small></div>${seg('stAtl', p.atelier === 'complet' ? 'complet' : 'simple', [['simple', 'Simple'], ['complet', 'Complet']])}</div>
    </div>
    <div class="spane" data-pane="other"${tab === 'other' ? '' : ' hidden'}>
    <h5 style="margin-top:4px">Assistant IA</h5>
    <div class="srow"><div class="l"><b>Afficher l'assistant</b><small>Bouton Assistant en haut à droite et raccourci Ctrl J.</small></div><label class="tg"><input type="checkbox" id="stAi"${p.aiOn ? ' checked' : ''}><span></span></label></div>
    <h5>Données</h5>
    <div class="srow"><div class="l"><b>Sauvegarde</b><small>${DB.ok() ? 'Enregistré dans ce navigateur, sur cet appareil.' : "Ce navigateur refuse l'enregistrement : exportez avant de fermer."}</small></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" id="stExp">${icon('download', 'sm')}Exporter</button><button class="btn sm" id="stImp">${icon('upload', 'sm')}Importer</button></div></div>
    ${LEGACY ? `<div class="srow"><div class="l"><b>Données d’avant la 0.2</b><small>${esc(legacyInfo())}. Mises de côté au passage à la 0.2, rien n’a été effacé.</small></div><button class="btn sm" id="stLegacy">${icon('restore', 'sm')}Récupérer</button></div>` : ''}
    <div class="srow"><div class="l"><b>Mes réglages</b><small>Couleurs du thème, styles des éléments du board, stylets et atelier, dans un fichier (sans tes notes ni tes tâches).</small></div><button class="btn sm" id="stPrefs">${icon('download', 'sm')}Exporter mes réglages</button></div>
    <div class="srow"><div class="l"><b>Repartir de zéro</b><small>Efface les espaces, notes, boards et tâches de la 0.2 sur cet appareil, puis rouvre l’accueil.</small></div><button class="btn sm ghost danger" id="stReset">Tout effacer</button></div>
    <div id="stConfirm"></div>
    </div>`, m => {
    $('.stabs', m).onclick = e => { const b = e.target.closest('[data-tab]'); if (!b) return; settingsTab = b.dataset.tab; $$('[data-tab]', m).forEach(x => x.setAttribute('aria-selected', x === b)); $$('.spane', m).forEach(x => x.hidden = x.dataset.pane !== settingsTab); };
    $('#stName', m).oninput = e => { p.name = e.target.value.trim(); save(); renderSide(); };
    const segBind = (id, key, after) => { const el = $('#' + id, m); if (!el) return; el.onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; p[key] = b.dataset.v; save(); $$('button', el).forEach(x => x.setAttribute('aria-pressed', x === b)); after && after(); }; };
    segBind('stTheme', 'theme', applyTheme);
    segBind('stScale', 'uiScale', applyUiScale);
    $('#stSkin', m).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; switchTheme(b.dataset.v); $$('[data-v]', $('#stSkin', m)).forEach(x => x.setAttribute('aria-pressed', x === b)); $('#stThemeRow', m).hidden = THEMES[b.dataset.v].mode !== 'user'; $('#stLook', m).innerHTML = lookRows(THEMES[b.dataset.v]); };
    const lookEl = $('#stLook', m), relook = () => { lookEl.innerHTML = lookRows(theme()); };
    // buttons only: <html> carries data-tint too
    lookEl.onclick = e => { if (e.target.closest('[data-lkreset]')) { S.prefs.look[theme().id] = {}; save(); applyTheme(); relook(); return; } const b = e.target.closest('button[data-tint], button[data-acc]'); if (!b) return; setLook(b.dataset.tint ? { tint: b.dataset.tint } : { accent: b.dataset.acc }); relook(); };
    const lookOf = t => t.dataset.k === 'tint' ? { tint: 'custom', tintHex: t.value } : { accent: t.value };
    lookEl.oninput = e => { if (e.target.matches('input[type="color"]')) setLook(lookOf(e.target), true); };
    lookEl.onchange = e => { if (e.target.matches('input[type="color"]')) { setLook(lookOf(e.target)); relook(); } }; segBind('stPress', 'pressure'); segBind('stSrc', 'source'); segBind('stWheel', 'wheel'); segBind('stAtl', 'atelier', () => { if (R.name === 'doc' && typeof Board !== 'undefined' && Board.mounted) Board.setTool(Board.tool || 'select'); });
    $('#stPen', m).onchange = e => { p.autoPen = e.target.checked; save(); };
    $('#stAi', m).onchange = e => { p.aiOn = e.target.checked; save(); applyAi(); };
    $('#stSens', m).oninput = e => { p.sens = +e.target.value; $('#stSensV', m).textContent = Math.round(p.sens * 100) + ' %'; save(); };
    bindPenTest(m);
    if (section === 'pen') setTimeout(() => $('#stPenSec', m).scrollIntoView({ block: 'start', behavior: 'smooth' }), 30);
    $('#stKey', m).onclick = () => { closeModal(); AI.setup(); };
    $('#stExp', m).onclick = () => exportJSON(S, 'PLUM-espace.json');
    $('#stImp', m).onclick = () => $('#importIn').click();
    $('#stPrefs', m).onclick = () => exportPrefs();
    $('#stReset', m).onclick = () => {
      $('#stConfirm', m).innerHTML = `<div class="confirm" style="margin-top:12px"><span>Effacer toutes les notes, boards et tâches de cet appareil ?</span><button class="btn sm" id="rsNo">Annuler</button><button class="btn sm pri" id="rsYes" style="background:var(--err);border-color:var(--err)">Tout effacer</button></div>`;
      $('#rsNo', m).onclick = () => $('#stConfirm', m).innerHTML = '';
      $('#rsYes', m).onclick = async () => { S.docs = []; S.tasks = []; S.spaces = []; ensureDefaultSpace(S); S.prefs.cur = DEF_SPACE; S.prefs.welcomed = false; save(); await gcAssets(); closeModal(); go('welcome'); toast('Espace de travail vidé'); };
    };
    const lg = $('#stLegacy', m); if (lg) lg.onclick = () => { closeModal(); restoreLegacy(); };
  });
}

/* the stylus test pad in Settings: live diagnostic line and a small sheet to scribble on */
function penInfoLine() {
  const i = Ink.info;
  if (!i) return 'Wintab : recherche de la tablette…';
  if (i.ok) return `Wintab : ${esc(i.device || 'tablette')} détectée${i.pressureLevels ? ` · ${i.pressureLevels} niveaux de pression` : ''}.`;
  return `Wintab indisponible${i.reason ? ` : ${esc(i.reason)}` : ''}. Le stylet passe alors par Windows Ink.`;
}
function bindPenTest(m) {
  const pad = $('#stPad', m); if (!pad) return;
  const cv = pad.querySelector('canvas'), svg = pad.querySelector('svg');
  const rect = () => pad.getBoundingClientRect();
  const cap = new InkCapture(cv, { toLocal: (x, y) => { const r = rect(); return { x: x - r.left, y: y - r.top }; }, xf: () => ({ k: 1, ox: 0, oy: 0 }) });
  const fit = () => { const r = rect(); svg.setAttribute('viewBox', `0 0 ${r.width} ${r.height}`); cap.resize(); };
  fit();
  let strokes = [], id = null;
  const draw = () => { svg.innerHTML = strokes.map(st => inkSVG(st)).join(''); };
  pad.addEventListener('pointerdown', e => { if (e.button > 0 && e.pointerType === 'mouse') return; e.preventDefault(); pad.setPointerCapture(e.pointerId); id = e.pointerId; fit(); cap.begin(e, { t: 'pen', c: S.prefs.pens.pen.c, s: Math.max(4, S.prefs.pens.pen.s * 1.4), o: 1, k: 1 }); tick(); });
  pad.addEventListener('pointermove', e => { if (id === e.pointerId) { cap.feed(e); tick(); } });
  const end = e => { if (id !== e.pointerId) return; id = null; const st = cap.end(); if (st && st.p.length >= 6) { strokes.push(st); if (strokes.length > 30) strokes.shift(); draw(); } };
  pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
  pad.addEventListener('dblclick', () => { strokes = []; draw(); });
  const tick = () => { const t = $('#stDiagTxt', m); if (t) t.textContent = penDiagLine(); const d = $('#stDiag', m); if (d) d.classList.toggle('live', !!(Ink.last && Date.now() - Ink.last.at < 1500)); };
  const iv = setInterval(() => { if (!document.body.contains(m)) { clearInterval(iv); return; } tick(); const w = $('#stWt', m); if (w) w.innerHTML = penInfoLine(); }, 400);
}

/* ================= export / import ================= */
async function blobToDataURL(b) { return new Promise(r => { const f = new FileReader(); f.onload = () => r(f.result); f.onerror = () => r(''); f.readAsDataURL(b); }); }
// every page of a note (the first one is d.html, the others d.pages)
const noteHTML = (d, sep = '') => [d.html || ''].concat((d.pages || []).map(p => p.html || '')).join(sep);
function usedAssets(docs, spaces = S.spaces, tasks = S.tasks) { const ids = new Set(); for (const t of tasks || []) for (const id of t.res || []) ids.add(id); for (const d of docs) { if (d.type === 'board') for (const it of d.items || []) if (it.asset) ids.add(it.asset); if (d.type === 'note') for (const m of noteHTML(d).matchAll(/data-asset="([^"]+)"/g)) ids.add(m[1]); } for (const sp of spaces || []) for (const m of sp.media || []) if (m.asset) ids.add(m.asset); return ids; }
/* the workspace saved before 0.2 (kv "state"): kept as it was, its files are never collected, and it can be merged back */
function legacyInfo() {
  const L = LEGACY, n = (a, w) => `${a} ${w}${a > 1 ? 's' : ''}`;
  return [n((L.spaces || []).length, 'espace'), n((L.docs || []).filter(d => !d.trash).length, 'note ou board'), n((L.tasks || []).length, 'tâche')].join(', ');
}
function restoreLegacy() {
  if (!LEGACY) return;
  const L = migrateState(JSON.parse(JSON.stringify(LEGACY)));
  let n = 0;
  for (const sp of L.spaces || []) if (!spaceById(sp.id)) { S.spaces.push(sp); n++; }
  for (const d of L.docs || []) if (!docById(d.id)) { if (!spaceById(d.sp)) d.sp = DEF_SPACE; S.docs.push(d); }
  for (const t of L.tasks || []) if (!taskById(t.id)) { if (!spaceById(t.sp)) t.sp = DEF_SPACE; S.tasks.push(t); }
  S.prefs.welcomed = true; save(); go('space:' + ((L.spaces || [])[0] || curSpace()).id);
  toast(`${n} espace${n > 1 ? 's' : ''} récupéré${n > 1 ? 's' : ''}`);
}
async function gcAssets() { const keep = usedAssets(S.docs); if (LEGACY) for (const id of usedAssets(LEGACY.docs || [], LEGACY.spaces || [], LEGACY.tasks || [])) keep.add(id); for (const id of [...Assets.blobs.keys()]) if (!keep.has(id)) await Assets.drop(id); }
async function exportJSON(data, filename) {
  const docs = data.docs || [];
  const assets = {};
  const spaces = data.spaces || S.spaces;
  for (const id of usedAssets(docs, data.docs && !data.spaces ? [] : spaces, data.tasks || [])) { const b = Assets.blobs.get(id); if (b) assets[id] = await blobToDataURL(b); }
  const payload = JSON.stringify({ notely: 'hub', v: 2, exported: new Date().toISOString(), spaces, docs, tasks: data.tasks || [], prefs: undefined, assets });
  if (DESKTOP && window.notely.saveFile) { const r = await window.notely.saveFile({ name: filename, kind: 'json', data: new TextEncoder().encode(payload) }); if (r && r.ok) toast('Fichier enregistré'); return; }
  if (IPAD && window.webkit && window.webkit.messageHandlers.hubFile) { const b = await blobToDataURL(new Blob([payload], { type: 'application/json' })); window.webkit.messageHandlers.hubFile.postMessage({ name: filename, data: b.split(',')[1] }); return; }
  try {
    const dl = window.claude ? await window.claude.use('downloads') : null;
    if (dl) { await dl.save({ filename, data: new Blob([payload], { type: 'application/json' }) }); toast('Fichier enregistré'); return; }
  } catch (e) { if (e && e.code === 'declined') return; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' })); a.download = filename; document.body.append(a); a.click(); a.remove(); }
  catch (e) { toast("L'export n'est pas possible ici"); }
}
/* the settings alone (no content), to turn them into the defaults of the app */
async function exportPrefs() {
  const p = JSON.parse(JSON.stringify(S.prefs)); ['last', 'recent', 'cur', 'welcomed', 'name', 'taskOrder'].forEach(k => delete p[k]);
  const payload = JSON.stringify({ plum: 'reglages', v: APP_VERSION, exported: new Date().toISOString(), skin: S.prefs.skin, prefs: p }, null, 1);
  const filename = 'plum-reglages.json';
  if (DESKTOP && window.notely.saveFile) { const r = await window.notely.saveFile({ name: filename, kind: 'json', data: new TextEncoder().encode(payload) }); if (r && r.ok) toast('Réglages enregistrés'); return; }
  try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([payload], { type: 'application/json' })); a.download = filename; document.body.append(a); a.click(); a.remove(); } catch (e) { toast("L'export n'est pas possible ici"); }
}
function dataURLToBlob(u) {
  const m = /^data:([^;,]*)(;base64)?,(.*)$/s.exec(String(u)); if (!m) throw new Error('not a data URL');
  if (!m[2]) return new Blob([decodeURIComponent(m[3])], { type: m[1] });
  const bin = atob(m[3]), a = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
  return new Blob([a], { type: m[1] || 'application/octet-stream' });
}
async function importJSON(text) {
  let j; try { j = JSON.parse(text); } catch (e) { toast("Ce fichier n'est pas une sauvegarde PLUM"); return; }
  if (!j || !Array.isArray(j.docs)) { toast("Ce fichier n'est pas une sauvegarde PLUM"); return; }
  for (const [id, url] of Object.entries(j.assets || {})) { try { await Assets.put(dataURLToBlob(url), id); } catch (e) {} }
  for (const s of j.spaces || []) { const ex = spaceById(s.id); if (!ex) S.spaces.push(s); else if (s.media) { ex.media = ex.media || []; for (const m of s.media) if (!ex.media.some(x => x.asset === m.asset)) ex.media.push(m); } }
  if ((j.v || 1) < 2) migrateState(j);
  let n = 0; for (const d of j.docs) { if (docById(d.id)) d.id = uid('d'); S.docs.push(d); n++; }
  for (const t of j.tasks || []) if (!taskById(t.id)) S.tasks.push(t);
  S.prefs.welcomed = true; save(); closeModal(); go(n === 1 ? 'doc:' + j.docs[0].id : 'home'); toast(`${n} document${n > 1 ? 's' : ''} importé${n > 1 ? 's' : ''}`);
}
