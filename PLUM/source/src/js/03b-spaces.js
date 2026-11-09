/* ================= spaces: first launch and moodboard =================
   0.2 puts everything in spaces. The first launch shows a welcome page (choose a theme, then the HUB);
   each space has its moodboard, a sandbox of images, links, files and bits of text, as a page (route "mood") and as
   a drawer that opens over any page, notes, boards and drawing included (Ctrl M). Its elements drag into a board or
   a note, or go there with a click from the drawer. */

/* ---------- welcome ----------
   0.2.35: a quieter first launch. The logo, one line, the theme (four small cards, light/dark when the theme has both)
   and one button: Commencer opens the HUB. No more asking for a first project here: the HUB has its own « Nouveau projet ». */
const WELCOME_THEMES = ['minimal', 'adjust', 'plum', 'farmer'];
function renderWelcome(v) {
  const ths = WELCOME_THEMES.map(id => THEMES[id]).filter(Boolean), cur = theme().id, p = S.prefs;
  v.innerHTML = `<div class="welcome wl2"><div class="wl-in">
    <div class="wl-mark"></div>
    <h1 class="wl-h">Bienvenue dans PLUM</h1>
    <p class="wl-sub">Notes, tâches, boards et dessin, au même endroit.</p>
    <div class="wl-pick">
      <div class="wl-themes" aria-label="Thème">${ths.map(t => `<button class="skin-c wl-th sk-${t.id}" data-th="${t.id}" aria-pressed="${t.id === cur}"><span class="skin-pv" aria-hidden="true"><i></i><i></i><i></i><i></i></span><b>${esc(t.label)}</b></button>`).join('')}</div>
      <div class="wl-mode"${theme().mode === 'user' ? '' : ' hidden'}><div class="seg" id="wlMode">${[['auto', 'Système'], ['light', 'Clair'], ['dark', 'Sombre']].map(([k, l]) => `<button data-v="${k}" aria-pressed="${p.theme === k}">${l}</button>`).join('')}</div></div>
    </div>
    <button class="btn pri wl-go" id="wlGo">Commencer</button>
    <small class="wl-foot">Le thème se change à tout moment dans Réglages.<button class="wl-sync" id="wlSync">Déjà PLUM sur un autre appareil ? Se connecter</button></small>
  </div></div>`;
  $('#wlSync', v).onclick = () => openSettings('sync');
  $('#wlGo', v).onclick = () => { S.prefs.welcomed = true; S.prefs.cur = DEF_SPACE; save(); go('hub'); };
  $('.wl-themes', v).onclick = e => {
    const b = e.target.closest('[data-th]'); if (!b) return;
    switchTheme(b.dataset.th);
    $$('[data-th]', v).forEach(x => x.setAttribute('aria-pressed', x === b));
    $('.wl-mode', v).hidden = THEMES[b.dataset.th].mode !== 'user';
  };
  $('#wlMode', v).onclick = e => { const b = e.target.closest('[data-v]'); if (!b) return; p.theme = b.dataset.v; save(); applyTheme(); $$('#wlMode button', v).forEach(x => x.setAttribute('aria-pressed', x === b)); };
}

/* ---------- moodboard ---------- */
const Mood = (() => {
  let drawer = null, open = false, dragging = 0, dragItem = null, drawerFolder = '';
  const FILE_C = { PDF: '#E5484D', DOC: '#3D7BD9', DOCX: '#3D7BD9', XLS: '#2E9E6A', XLSX: '#2E9E6A', CSV: '#2E9E6A', PPT: '#F2A33A', PPTX: '#F2A33A', ZIP: '#8B5E3C', PSD: '#22A6B3', AI: '#F2A33A', BLEN: '#F5A524', FBX: '#6E56F0', OBJ: '#6E56F0', GLB: '#6E56F0', MP3: '#22A6B3', WAV: '#22A6B3', MP4: '#8B76FF', MOV: '#8B76FF' };
  const domain = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return u || ''; } };
  const extOf = n => (/\.([a-z0-9]{1,5})$/i.exec(n || '') || [, 'fichier'])[1].slice(0, 4).toUpperCase();
  const alive = m => m.type === 'image' || m.type === 'file' ? Assets.has(m.asset) : true;
  const own = sp => ((sp && sp.media) || []).filter(alive);
  /* what the notes and boards of the space hold, shown apart */
  const found = sp => sp ? spaceMedia(sp.id).filter(m => m.type !== 'doc' && m.type !== 'text' && !(sp.media || []).includes(m)) : [];
  const docOpen = () => R.name === 'doc' && docById(R.id);
  /* simple folders: sp.folders = [{ id, name }], an element's m.folder; no folder (or a removed one) = the root */
  const folders = sp => (sp && sp.folders) || [];
  const folderOf = (sp, m) => m.folder && folders(sp).some(f => f.id === m.folder) ? m.folder : '';
  const inFolder = (sp, fid) => own(sp).filter(m => folderOf(sp, m) === (fid || ''));
  const plural = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  function moveTo(sp, m, fid) {
    if (!m || folderOf(sp, m) === (fid || '')) return;
    const was = m.folder; if (fid) m.folder = fid; else delete m.folder; save();
    const f = folders(sp).find(x => x.id === fid);
    toast(f ? `Rangé dans « ${f.name} »` : 'Sorti du dossier', { label: 'Annuler', run: () => { if (was) m.folder = was; else delete m.folder; save(); refresh(); } });
    refresh();
  }
  function askName(title, value, done) {
    openModal(`<div class="mhd"><h2>${esc(title)}</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
      <input id="mwName" class="mw-name" value="${esc(value || '')}" placeholder="Nom du dossier" maxlength="60" autocomplete="off" aria-label="Nom du dossier">
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" id="mwNameOk">OK</button></div>`,
      md => { const i = $('#mwName', md), ok = () => { if (i.value.trim()) { closeModal(); done(i.value.trim().slice(0, 60)); } else i.focus(); }; i.focus(); i.select(); i.onkeydown = e => { if (e.key === 'Enter') ok(); }; $('#mwNameOk', md).onclick = ok; });
  }
  function newFolder(sp, after) {
    askName('Nouveau dossier', '', name => { const f = { id: uid('f'), name }; (sp.folders = sp.folders || []).push(f); save(); after ? after(f) : refresh(); });
  }
  function folderMenu(anchor, sp, f) {
    openPop(anchor, [
      { label: 'Ouvrir', icon: 'folder', run: () => go('mood:' + f.id) },
      { label: 'Renommer', icon: 'text', run: () => askName('Renommer le dossier', f.name, n => { f.name = n; save(); refresh(); }) },
      '-',
      { label: 'Supprimer le dossier', icon: 'trash', danger: true, run: () => {
        const k = sp.folders.indexOf(f), moved = own(sp).filter(m => m.folder === f.id);
        sp.folders.splice(k, 1); moved.forEach(m => delete m.folder); save();
        if (R.name === 'mood' && R.id === f.id) go('mood'); else refresh();
        toast(moved.length ? `Dossier supprimé, ${plural(moved.length, 'élément')} remis à la racine` : 'Dossier supprimé', { label: 'Annuler', run: () => { sp.folders.splice(k, 0, f); moved.forEach(m => { m.folder = f.id; }); save(); refresh(); } });
      } }
    ], { align: 'right' });
  }
  function folderCard(sp, f) {
    const items = inFolder(sp, f.id), imgs = items.filter(m => m.type === 'image').slice(0, 3);
    return `<div class="mw-fold" data-fold="${f.id}" data-fdrop="${f.id}" tabindex="0" role="button" aria-label="Dossier ${esc(f.name)}">
      <span class="mw-fthumbs">${imgs.map(m => `<img src="${Assets.url(m.asset)}" alt="" draggable="false">`).join('') || `<span class="mw-fi">${icon('folder')}</span>`}</span>
      <span class="mw-ft"><b>${esc(f.name)}</b><small>${items.length ? plural(items.length, 'élément') : 'Vide'}</small></span>
      <button class="mw-more" data-fm="${f.id}" aria-label="Options du dossier" title="Options">${icon('dots', 'sm')}</button></div>`;
  }

  /* 0.2.76: drawn icons for folders and web links (no letter square any more) */
  const FOLDER_SVG = '<svg class="mw-dir" viewBox="0 0 48 40" aria-hidden="true"><path d="M3 8.5A4.5 4.5 0 0 1 7.5 4h10.2c1.3 0 2.5.6 3.3 1.6L23.6 9H40.5A4.5 4.5 0 0 1 45 13.5V33.5A4.5 4.5 0 0 1 40.5 38h-33A4.5 4.5 0 0 1 3 33.5z" fill="#E8A93A"/><path d="M3 15.5A4.5 4.5 0 0 1 7.5 11h33a4.5 4.5 0 0 1 4.5 4.5v18a4.5 4.5 0 0 1-4.5 4.5h-33A4.5 4.5 0 0 1 3 33.5z" fill="#F7C65A"/><path d="M3 15.5A4.5 4.5 0 0 1 7.5 11h33a4.5 4.5 0 0 1 4.5 4.5v1.2H3z" fill="#FFF" opacity=".28"/></svg>';
  const GLOBE_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8.6" fill="none" stroke="#fff" stroke-width="1.6"/><path d="M3.6 12h16.8M12 3.4c2.4 2.4 3.6 5.3 3.6 8.6s-1.2 6.2-3.6 8.6c-2.4-2.4-3.6-5.3-3.6-8.6s1.2-6.2 3.6-8.6z" fill="none" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const LINK_SVG = '<svg class="mw-lk" viewBox="0 0 24 24" aria-hidden="true"><path d="M10 14a4.5 4.5 0 0 0 6.4 0l3.2-3.2a4.5 4.5 0 0 0-6.4-6.4l-1 1M14 10a4.5 4.5 0 0 0-6.4 0l-3.2 3.2a4.5 4.5 0 0 0 6.4 6.4l1-1" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';
  const folderWhere = p => { const parts = String(p || '').split(/[\\/]/).filter(Boolean); return parts.length > 1 ? parts.slice(-3, -1).join(' › ') : 'Dossier'; };
  function openFolder(m) {
    if (!(window.notely && notely.openFolder)) { toast('Ouvrir un dossier marche dans l’app PLUM sur PC'); return; }
    notely.openFolder(m.path).then(r => { if (!r || !r.ok) toast(`Dossier introuvable : ${m.path}`); });
  }
  function tile(m, i) {
    const a = `data-mi="${i}" draggable="true" tabindex="0"`;
    if (m.type === 'image') return `<figure class="mw mw-img" ${a}><img src="${Assets.url(m.asset)}" alt="${esc(m.name || '')}" loading="lazy" draggable="false"${m.w && m.h ? ` width="${m.w}" height="${m.h}"` : ''}>${m.name ? `<figcaption>${esc(m.name)}</figcaption>` : ''}<button class="mw-more" data-mm="${i}" aria-label="Options" title="Options">${icon('dots', 'sm')}</button></figure>`;
    if (m.type === 'folder') return `<div class="mw mw-folder" ${a} title="Ouvrir dans l’Explorateur : ${esc(m.path)}">${FOLDER_SVG}<span class="mw-t"><b>${esc(m.name || 'Dossier')}</b><small>${esc(folderWhere(m.path))}</small></span><button class="mw-more" data-mm="${i}" aria-label="Options" title="Options">${icon('dots', 'sm')}</button></div>`;
    if (m.type === 'link' && m.pic && Assets.has(m.pic)) { const d = domain(m.url); return `<div class="mw mw-link haspic" ${a} title="${esc(m.url)}"><img class="mw-lpic" src="${Assets.url(m.pic)}" alt="" loading="lazy" draggable="false"><span class="mw-t"><b>${esc(m.title || d)}</b><small>${LINK_SVG}${esc(m.site || d)}</small></span><button class="mw-more" data-mm="${i}" aria-label="Options" title="Options">${icon('dots', 'sm')}</button></div>`; }
    if (m.type === 'link') { const d = domain(m.url); return `<div class="mw mw-link" ${a} title="${esc(m.url)}"><span class="mw-web" style="--c:${SPACE_COLORS[Math.floor(hashStr(d) * SPACE_COLORS.length)]}">${GLOBE_SVG}<i>${esc((d[0] || '?').toUpperCase())}</i></span><span class="mw-t"><b>${esc(m.title || d)}</b><small>${esc(m.title ? d : m.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 80))}</small></span><button class="mw-more" data-mm="${i}" aria-label="Options" title="Options">${icon('dots', 'sm')}</button></div>`; }
    if (m.type === 'file') { const e = extOf(m.name); return `<div class="mw mw-file" ${a}><span class="mw-ext" style="--c:${FILE_C[e] || '#5E6B78'}">${esc(e)}</span><span class="mw-t"><b>${esc(m.name || 'Fichier')}</b><small>${m.size ? fmtSize(m.size) : 'Fichier'}</small></span><button class="mw-more" data-mm="${i}" aria-label="Options" title="Options">${icon('dots', 'sm')}</button></div>`; }
    if (m.type === 'text') return `<div class="mw mw-text" ${a}><p>${esc(m.txt).replace(/\n/g, '<br>')}</p><button class="mw-more" data-mm="${i}" aria-label="Options" title="Options">${icon('dots', 'sm')}</button></div>`;
    return '';
  }
  const addBar = (id, ph = 'Coller un lien ou noter une idée, puis Entrée') => `<div class="mw-bar"><label class="mw-in">${icon('link', 'sm')}<input id="${id}" placeholder="${ph}" autocomplete="off" aria-label="Ajouter un lien ou un texte"></label><button class="btn" data-madd>${icon('upload', 'sm')}Fichiers</button></div>`;

  /* ---- actions ---- */
  function refresh() {
    renderSide();
    if (R.name === 'hub' && typeof renderHubMods === 'function') renderHubMods();
    if (R.name === 'mood' || R.name === 'space') { const vw = $('#view'), st = vw.scrollTop; go(R, { keepFocus: true }); vw.scrollTop = st; }
    if (open) renderDrawer();
    if (R.name === 'doc' && Board.mounted && Board.refreshProps) Board.refreshProps();
    if (R.name === 'doc' && Note.mounted && typeof isPage === 'function' && isPage(Note.doc)) refreshPageHead();
  }
  async function drop(dt, sp, fid) {
    if (!sp || dragging) return 0;
    let files = [...(dt.files || [])];
    if (!files.length && dt.items) files = [...dt.items].filter(i => i.kind === 'file').map(i => i.getAsFile()).filter(Boolean);
    let n = 0;
    if (files.length) n = (await addMedia(sp.id, files, fid)).length;
    else if (!dt.getData('application/x-notely')) n = addMediaItems(sp.id, mediaFromData(dt), fid);
    if (n) { toast(`${n} élément${n > 1 ? 's' : ''} ajouté${n > 1 ? "s" : ""} au ${sp.id === DEF_SPACE ? "Moodboard Général" : "moodboard de " + sp.name}`); refresh(); }
    return n;
  }
  function addFromField(inp, sp, fid) {
    const v = inp.value.trim(); if (!v) return;
    const list = /^(https?:\/\/|www\.)\S+$/i.test(v) ? [{ type: 'link', url: /^www\./i.test(v) ? 'https://' + v : v }] : [{ type: 'text', txt: v }];
    const n = addMediaItems(sp.id, list, fid); inp.value = '';
    if (n) { refresh(); const again = $('#' + inp.id); if (again) again.focus(); } else toast('Ce lien est déjà dans le moodboard');
  }
  function pickFiles(sp, fid) { const i = $('#fileIn'); i.accept = ''; i.onchange = async () => { const f = [...i.files]; i.value = ''; if (!f.length) return; const n = await addMedia(sp.id, f, fid); if (n.length) { toast(`${n.length} élément${n.length > 1 ? 's' : ''} ajouté${n.length > 1 ? 's' : ''}`); refresh(); } }; i.click(); }
  function view(m) {
    if (m.type === 'image') { showImage(m.asset); return; }
    if (m.type === 'folder') { openFolder(m); return; }
    if (m.type === 'link') { const a = document.createElement('a'); a.href = m.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; document.body.append(a); a.click(); a.remove(); return; }
    if (m.type === 'file') { const u = Assets.url(m.asset); if (!u) return; const a = document.createElement('a'); a.href = u; a.download = m.name || 'fichier'; document.body.append(a); a.click(); a.remove(); return; }
    if (m.type === 'text') editText(m);
  }
  function editText(m) {
    openModal(`<div class="mhd"><h2>Texte du moodboard</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
      <textarea id="mwTxt" class="mw-edit" rows="7" aria-label="Texte">${esc(m.txt)}</textarea>
      <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px"><button class="btn ghost" data-close>Annuler</button><button class="btn pri" id="mwOk">Enregistrer</button></div>`,
      md => { const t = $('#mwTxt', md); t.focus(); $('#mwOk', md).onclick = () => { if (t.value.trim()) { m.txt = t.value.trim(); save(); } closeModal(); refresh(); }; });
  }
  /* into the open page: a board places it in view, a note at the caret */
  function place(m) {
    const d = docOpen(); if (!d) return false;
    if (d.type === 'board' && Board.mounted) { Board.placeMedia([m]); return true; }
    if (d.type === 'note' && Note.mounted) { Note.insertMedia([m]); return true; }
    return false;
  }
  function toBoard(m, sp, b) {
    const d = b || newDoc('board', { title: 'Moodboard', sp: sp.id });
    go('doc:' + d.id); setTimeout(() => Board.placeMedia([m]), 80);
  }
  function menu(anchor, m, sp) {
    const d = docOpen(), mine = (sp.media || []).includes(m);
    const boards = liveDocs().filter(x => x.sp === sp.id && x.type === 'board' && (!d || x.id !== d.id)).sort((a, b) => b.updated - a.updated).slice(0, 8);
    const label = { image: 'Voir en grand', link: 'Ouvrir le lien', file: 'Ouvrir le fichier', text: 'Modifier le texte', folder: 'Ouvrir dans l’Explorateur' }[m.type];
    openPop(anchor, [
      ...(d ? [{ label: `Placer dans « ${d.title} »`, icon: d.type === 'board' ? 'board' : 'note', run: () => place(m) }, '-'] : []),
      { label, icon: m.type === 'folder' ? 'folder' : m.type === 'text' ? 'text' : m.type === 'link' ? 'ext' : m.type === 'file' ? 'download' : 'focus', run: () => view(m) },
      ...(m.type === 'folder' ? [{ label: 'Copier le chemin', icon: 'link', run: () => { try { navigator.clipboard.writeText(m.path); toast('Chemin copié'); } catch (e) {} } }] : []),
      ...(m.type === 'link' ? [{ label: 'Copier le lien', icon: 'link', run: () => { try { navigator.clipboard.writeText(m.url); toast('Lien copié'); } catch (e) {} } }] : []),
      ...(mine && folders(sp).length ? [{ head: 'Ranger dans' }, ...(folderOf(sp, m) ? [{ label: 'Racine du moodboard', icon: 'image', run: () => moveTo(sp, m, '') }] : []), ...folders(sp).filter(f => f.id !== folderOf(sp, m)).map(f => ({ label: f.name, icon: 'folder', run: () => moveTo(sp, m, f.id) }))] : []),
      ...(mine ? [{ label: 'Nouveau dossier…', icon: 'plus', run: () => newFolder(sp, f => moveTo(sp, m, f.id)) }] : []),
      { head: 'Placer sur un board' },
      ...boards.map(b => ({ label: b.title, icon: 'board', run: () => toBoard(m, sp, b) })),
      { label: 'Nouveau board', icon: 'plus', run: () => toBoard(m, sp) },
      ...(mine ? ['-', { label: 'Retirer du moodboard', icon: 'trash', danger: true, run: () => { const k = sp.media.indexOf(m); sp.media.splice(k, 1); save(); refresh(); toast('Retiré du moodboard', { label: 'Annuler', run: () => { sp.media.splice(k, 0, m); save(); refresh(); } }); } }] : [])
    ], { align: 'right' });
  }
  /* clicks, the ⋯ menu, dragging out and dropping in, all delegated on root; list and sp can be functions
     (the drawer is bound once and redrawn) */
  function bindList(root, list0, sp0, o = {}) {
    const L = () => typeof list0 === 'function' ? list0() : list0;
    let list = L(), sp = typeof sp0 === 'function' ? sp0() : sp0;
    const fresh = () => { list = L(); sp = typeof sp0 === 'function' ? sp0() : sp0; };
    const fid = () => typeof o.folder === 'function' ? o.folder() : o.folder || '';
    root.addEventListener('pointerdown', fresh, true);
    root.addEventListener('dragenter', fresh, true);
    root.addEventListener('click', e => {
      if (e.target.closest('[data-madd]')) { pickFiles(sp, fid()); return; }
      if (e.target.closest('[data-fadd]')) { newFolder(sp); return; }
      const fm = e.target.closest('[data-fm]'); if (fm) { e.stopPropagation(); const f = folders(sp).find(x => x.id === fm.dataset.fm); if (f) folderMenu(fm, sp, f); return; }
      const fo = e.target.closest('[data-fold]'); if (fo) { go('mood:' + fo.dataset.fold); return; }
      const df = e.target.closest('[data-dfold]'); if (df) { drawerFolder = df.dataset.dfold; renderDrawer(); return; }
      const mm = e.target.closest('[data-mm]'); if (mm) { e.stopPropagation(); const m = list[+mm.dataset.mm]; if (m) menu(mm, m, sp); return; }
      const t = e.target.closest('[data-mi]'); if (!t) return;
      const m = list[+t.dataset.mi]; if (!m) return;
      if (o.drawer && place(m)) return;
      view(m);
    });
    root.addEventListener('keydown', e => {
      if (e.target.matches && e.target.matches('.mw-in input')) { if (e.key === 'Enter') { e.preventDefault(); fresh(); addFromField(e.target, sp, fid()); } return; }
      const t = e.target.closest && e.target.closest('[data-mi], [data-fold]'); if (t && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); t.click(); }
    });
    root.addEventListener('contextmenu', e => {
      fresh(); const fo = e.target.closest('[data-fold]');
      if (fo) { const f = folders(sp).find(x => x.id === fo.dataset.fold); if (f) { e.preventDefault(); folderMenu({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, sp, f); } return; }
      const t = e.target.closest('[data-mi]'); if (!t) return; const m = list[+t.dataset.mi]; if (!m) return; e.preventDefault(); menu({ left: e.clientX, right: e.clientX, top: e.clientY, bottom: e.clientY }, m, sp); });
    root.addEventListener('dragstart', e => {
      const t = e.target.closest('[data-mi]'); if (!t) return; const m = list[+t.dataset.mi]; if (!m) return;
      dragging = Date.now(); dragItem = m;
      e.dataTransfer.setData('application/x-notely', JSON.stringify(m));
      if (m.type === 'link') e.dataTransfer.setData('text/uri-list', m.url);
      e.dataTransfer.setData('text/plain', m.type === 'text' ? m.txt : m.url || m.name || '');
      e.dataTransfer.effectAllowed = 'copyMove';
      t.classList.add('dragging');
    });
    root.addEventListener('dragend', e => { dragging = 0; dragItem = null; $$('[data-fdrop].over', root).forEach(x => x.classList.remove('over')); const t = e.target.closest && e.target.closest('[data-mi]'); if (t) t.classList.remove('dragging'); });
    const zone = o.zone || root, types = e => [...(e.dataTransfer.types || [])];
    const can = e => !dragging && types(e).some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/plain');
    /* a folder (card, chip or the « Moodboard » crumb) takes an element dragged from the moodboard, or new files */
    const fdropAt = e => e.target.closest && e.target.closest('[data-fdrop]');
    root.addEventListener('dragover', e => {
      const f = fdropAt(e); $$('[data-fdrop].over', root).forEach(x => { if (x !== f) x.classList.remove('over'); });
      if (!f || !(dragItem || can(e))) return;
      e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = dragItem ? 'move' : 'copy'; f.classList.add('over'); zone.classList.remove('over');
    });
    root.addEventListener('drop', e => {
      const f = fdropAt(e); if (!f) return;
      e.preventDefault(); e.stopPropagation(); f.classList.remove('over'); zone.classList.remove('over'); fresh();
      if (dragItem) { const m = dragItem; dragItem = null; dragging = 0; moveTo(sp, m, f.dataset.fdrop); } else if (can(e)) drop(e.dataTransfer, sp, f.dataset.fdrop);
    });
    zone.addEventListener('dragover', e => { if (!can(e)) return; e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = 'copy'; zone.classList.add('over'); });
    zone.addEventListener('dragleave', e => { if (!zone.contains(e.relatedTarget)) zone.classList.remove('over'); });
    zone.addEventListener('drop', e => { zone.classList.remove('over'); if (!can(e)) return; e.preventDefault(); e.stopPropagation(); fresh(); drop(e.dataTransfer, sp, fid()); });
  }

  /* ---- the page: the folders, then what is at the root (or in the open folder) ---- */
  function renderPage(v) {
    const sp = curSpace(), fs = folders(sp), cur = fs.find(f => f.id === R.id) || null, fid = cur ? cur.id : '';
    const mine = inFolder(sp, fid), other = cur ? [] : found(sp), list = mine.concat(other);
    const counts = ['image', 'link', 'file', 'text'].map(k => [k, mine.filter(m => m.type === k).length]).filter(x => x[1]);
    const names = { image: ['image', 'images'], link: ['lien', 'liens'], file: ['fichier', 'fichiers'], text: ['texte', 'textes'] };
    const sub = `${esc(sp.name)}${counts.length ? ' · ' + counts.map(([k, n]) => `${n} ${names[k][n > 1 ? 1 : 0]}`).join(' · ') : ''}`;
    const head = cur
      ? `<div class="ph mw-ph"><div><div class="mw-crumbs"><button class="mw-cr" data-go="mood" data-fdrop="" title="Déposez ici pour sortir un élément du dossier">${icon('image', 'sm')}Moodboard</button>${icon('chev', 'sm')}</div><h1>${icon('folder')}${esc(cur.name)}</h1><div class="sub">${sub}</div></div>
          <div class="acts"><button class="btn" data-fm="${cur.id}">${icon('dots', 'sm')}Dossier</button></div></div>`
      : `<div class="ph mw-ph"><div><h1>Moodboard</h1><div class="sub">${sub}</div></div><div class="acts"><button class="btn" data-fadd>${icon('folder', 'sm')}Nouveau dossier</button></div></div>`;
    const empty = cur
      ? `<div class="mw-empty sm" data-madd role="button" tabindex="0"><span class="mw-empty-i">${icon('folder')}</span><b>Dossier vide</b><small>Glissez ici des éléments du moodboard (sur « Moodboard » pour les ressortir), ou déposez des fichiers.</small></div>`
      : `<button class="mw-empty" data-madd><span class="mw-empty-i">${icon('image')}</span><b>Le bac à sable de ${esc(sp.name)}</b><small>Glissez ici des images, des liens, des fichiers ou du texte, ou collez-les (Ctrl V).<br>Ils vous suivent dans les boards, les notes et le dessin de cet espace.</small></button>`;
    v.innerHTML = `<div class="page moodpage">${head}
      ${addBar('mwAdd')}
      ${!cur && fs.length ? `<div class="mw-folders">${fs.map(f => folderCard(sp, f)).join('')}</div>` : ''}
      ${mine.length ? `<div class="mwall">${mine.map((m, i) => tile(m, i)).join('')}</div>` : (!cur && fs.length ? '' : empty)}
      ${other.length ? `<details class="mw-found" open><summary>${icon('chev', 'sm')}Dans vos pages <span>${other.length}</span></summary><div class="mwall sm">${other.map((m, i) => tile(m, mine.length + i)).join('')}</div></details>` : ''}
      <div class="mw-over" aria-hidden="true"><div>${icon('upload')}Déposez pour ajouter ${cur ? `au dossier « ${esc(cur.name)} »` : `au moodboard de ${esc(sp.name)}`}</div></div>
    </div>`;
    const pg = $('.moodpage', v);
    bindList(pg, list, sp, { zone: pg, folder: fid });
    setTimeout(() => { const i = $('#mwAdd'); if (i && innerWidth > 760 && !mine.length && !fs.length) i.focus({ preventScroll: true }); }, 0);
  }
  /* the card on the space's home: the latest elements and a drop zone */
  function preview(sp) {
    const mine = own(sp), shown = mine.slice(0, 9);
    if (!mine.length) return `<div class="mdrop big mw-pdrop" data-madd>${icon('upload')}<div>Déposez ici images, liens et fichiers de ${esc(sp.name)}, ou <u>choisissez des fichiers</u>.</div></div>`;
    return `<div class="mwall pv">${shown.map((m, i) => tile(m, i)).join('')}</div>${mine.length > shown.length ? `<button class="more mw-all" data-go="mood">Voir les ${mine.length} éléments</button>` : ''}`;
  }
  function bindPreview(card, sp) { if (card) bindList(card, own(sp).slice(0, 9), sp, { zone: card }); }

  /* ---- the drawer ---- */
  function mount() {
    if (drawer) return;
    drawer = document.createElement('aside'); drawer.id = 'moodDrawer'; drawer.className = 'mdr'; drawer.hidden = true; drawer.setAttribute('aria-label', 'Moodboard');
    $('#main').append(drawer);
    bindList(drawer, () => drawerList(curSpace()), curSpace, { drawer: true, zone: drawer, folder: () => drawerFolder });
    /* 0.2.21: not pinned, the drawer folds away once the mouse leaves it (not while an element is being dragged out of it) */
    drawer.addEventListener('mouseenter', () => clearTimeout(hideT));
    drawer.addEventListener('mouseleave', autoHide);
    drawer.addEventListener('dragend', () => setTimeout(() => { if (open && !drawer.matches(':hover')) autoHide(); }, 50));
  }
  let hideT = 0;
  const pinned = () => S.prefs.moodPin === true;
  function autoHide() { clearTimeout(hideT); if (pinned() || !open) return; hideT = setTimeout(() => { if (open && !pinned() && !dragging && !drawer.matches(':hover') && !drawer.contains(document.activeElement)) toggle(false); }, 450); }
  /* the drawer shows everything, or one folder */
  function drawerList(sp) { if (drawerFolder && !folders(sp).some(f => f.id === drawerFolder)) drawerFolder = ''; return drawerFolder ? inFolder(sp, drawerFolder) : own(sp); }
  function renderDrawer() {
    if (!drawer) return;
    const sp = curSpace(), mine = drawerList(sp), d = docOpen(), fs = folders(sp);
    drawer.innerHTML = `<div class="mdr-hd"><div class="mdr-t">${icon('image')}<span><b>Moodboard</b><small><span class="sdot" style="background:${sp.color}"></span>${esc(sp.name)}</small></span></div>
        <button class="tb mdr-pin" data-mpin aria-pressed="${pinned()}" title="${pinned() ? 'Épinglé : reste ouvert' : 'Épingler (sinon il se replie quand la souris sort)'}" aria-label="Épingler le moodboard">${icon('pin')}</button><button class="tb" data-go="mood" title="Ouvrir en grand" aria-label="Ouvrir en grand">${icon('ext')}</button><button class="tb" data-mclose title="Fermer (Échap)" aria-label="Fermer">${icon('x')}</button></div>
      ${addBar('mdrAdd', 'Lien ou idée, puis Entrée')}
      ${fs.length ? `<div class="mdr-folds"><button class="mdr-fc" data-dfold="" data-fdrop="" aria-pressed="${!drawerFolder}">Tout</button>${fs.map(f => `<button class="mdr-fc" data-dfold="${f.id}" data-fdrop="${f.id}" aria-pressed="${drawerFolder === f.id}">${icon('folder', 'sm')}${esc(f.name)}<small>${inFolder(sp, f.id).length || ''}</small></button>`).join('')}</div>` : ''}
      <div class="mdr-body">${mine.length ? `<div class="mwall dr">${mine.map((m, i) => tile(m, i)).join('')}</div>` : `<div class="mdr-empty">${icon('upload')}<div>Glissez ici des images, des liens ou des fichiers. Ils restent dans le moodboard de ${esc(sp.name)}.</div></div>`}</div>
      <div class="mdr-ft">${d ? `Cliquez pour placer dans « ${esc(d.title)} », ou glissez où vous voulez.` : 'Glissez un élément sur un board ou dans une note.'}</div>`;
  }
  function toggle(on = !open) {
    if (!drawer) mount();
    open = !!on; clearTimeout(hideT);
    if (open) renderDrawer();
    drawer.hidden = !open; document.documentElement.toggleAttribute('data-mood', open); layout();
    const b = $('#moodBtn'); if (b) b.setAttribute('aria-pressed', open);
    const f = $('#focusMood'); if (f) f.setAttribute('aria-pressed', open);
    if (Board.mounted) Board.layoutChanged();
  }
  /* under the top bar, or from the top in focus mode */
  function layout() { if (!drawer || !open) return; const t = $('#top'); drawer.style.top = ((t && t.offsetParent ? t.offsetHeight : 0) + 10) + 'px'; }
  drawerClicks();
  function drawerClicks() { document.addEventListener('click', e => {
    if (!drawer || !e.target.closest) return;
    if (e.target.closest('#moodDrawer [data-mclose]')) toggle(false);
    const pn = e.target.closest('#moodDrawer [data-mpin]'); if (pn) { S.prefs.moodPin = !pinned(); save(); renderDrawer(); toast(pinned() ? 'Moodboard épinglé' : 'Le moodboard se repliera quand la souris en sort'); }
  }); }
  return {
    mount, toggle, preview, bindPreview, drop, renderPage, layout, view, FOLDER_SVG, GLOBE_SVG, LINK_SVG, folderWhere, openFolder,
    isOpen: () => open,
    dragging: () => !!dragging && Date.now() - dragging < 60000,
    /* after a page change: the drawer follows the space, and has no place on the moodboard page or the welcome */
    sync() { if (!open) return; if (R.name === 'mood' || R.name === 'welcome') toggle(false); else renderDrawer(); },
    /* Ctrl V on the moodboard page adds what the clipboard holds */
    paste(e) {
      if ((R.name !== 'mood' && R.name !== 'hub') || !e.clipboardData) return false;
      e.preventDefault(); const cd = e.clipboardData, sp = R.name === 'hub' ? spaceById(DEF_SPACE) : curSpace();
      const files = [...(cd.files || [])];
      if (files.length) { addMedia(sp.id, files).then(n => { if (n.length) { toast(`${n.length} élément${n.length > 1 ? 's' : ''} collé${n.length > 1 ? 's' : ''}`); refresh(); } }); return true; }
      const n = addMediaItems(sp.id, mediaFromData(cd)); if (n) { toast('Ajouté au moodboard'); refresh(); }
      return true;
    }
  };
})();
function renderMood(v) { Mood.renderPage(v); }
