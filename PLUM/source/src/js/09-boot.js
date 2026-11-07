/* ================= boot ================= */
function mergePrefs(p) {
  const d = JSON.parse(JSON.stringify(DEFAULT_PREFS)), out = Object.assign(d, p || {});
  out.pens = {}; for (const k of Object.keys(DEFAULT_PREFS.pens)) out.pens[k] = Object.assign({}, DEFAULT_PREFS.pens[k], (p && p.pens && p.pens[k]) || {});
  out.bd = Object.assign({}, DEFAULT_PREFS.bd, (p && p.bd) || {});
  // 0.2.13: colours never changed by hand follow the theme's scheme (a pen's colour of origin, black outlines)
  for (const k in out.pens) if (out.pens[k].c && out.pens[k].c === PEN_DEFAULT_COLORS[k]) delete out.pens[k].c;
  if (out.bd.sc === '#1E1E1E') out.bd.sc = '@1';
  out.recent = Array.isArray(p && p.recent) ? p.recent.slice(0, 10) : [];
  out.ai = Object.assign({}, DEFAULT_PREFS.ai, (p && p.ai) || {});
  out.studio = Object.assign(JSON.parse(JSON.stringify(STUDIO_DEF)), (p && p.studio) || {});
  if (!out.studio.hist.length && out.recent.length) out.studio.hist = out.recent.slice();
  return out;
}
/* workspaces saved by 0.4: the old "Feutre" pen is now "fine", connector dashes are a style name, prefs moved */
function migrateState(st) {
  if ((st.v || 1) >= 2) return st;
  const strokeT = t => t === 'marker' ? 'fine' : t;
  for (const d of st.docs || []) {
    if (d.type === 'board') d.items = (d.items || []).map(i => i.k === 'ink' ? Object.assign({}, i, { t: strokeT(i.t) }) : i.k === 'conn' ? Object.assign({}, i, { dash: typeof i.dash === 'boolean' ? (i.dash ? 'dash' : '') : (i.dash || ''), pts: i.pts || [] }) : i);
    else if (d.type === 'note') { d.ink = (d.ink || []).map(s => Object.assign({}, s, { t: strokeT(s.t) })); for (const p of d.pages || []) p.ink = (p.ink || []).map(s => Object.assign({}, s, { t: strokeT(s.t) })); }
  }
  const pens = st.prefs && st.prefs.pens;
  if (pens && pens.marker && !pens.fine) { pens.fine = { c: pens.marker.c, s: Math.min(pens.marker.s || 4, 8) }; delete pens.marker; }
  st.v = 2; return st;
}
const editableTarget = t => t && t.closest && t.closest('input,textarea,select,[contenteditable="true"]');
function bindShell() {
  document.addEventListener('click', e => {
    const g = e.target.closest('[data-go]'); if (!g || e.defaultPrevented) return;
    if (g.closest('.pop')) return;
    go(g.dataset.go);
  });
  /* 0.2.14: a note can be written from anywhere, it goes to the space of the page or to « Non classées » */
  $('#quickNote').onclick = () => createFrom('note');
  $('#quickMore').onclick = e => openPop(e.currentTarget, [{ head: 'Créer' }, { label: 'Note', icon: 'note', run: () => createFrom('note') }, { label: 'Board', icon: 'board', run: () => createFrom('board') },
    { label: 'Tâche', icon: 'tasks', run: () => { go(isGlobal() || curSpace().id === DEF_SPACE ? 'todo' : 'tasks'); setTimeout(() => $('#tAdd') && $('#tAdd').focus(), 30); } }, '-',
    { label: 'Espace', icon: 'folder', run: () => askSpaceName(n => createSpace(n)) }]);
  /* 0.2.21: the sidebar folds away (the page takes the whole width; unlike focus mode, the top bar stays) */
  $('#sideFold').onclick = () => setSideFold(!S.prefs.sideFold);
  // 0.2.48: on the folded rail, the search icon opens the panel and its search field
  $('#side .sbox').addEventListener('pointerdown', e => { if (!S.prefs.sideFold || innerWidth <= 760) return; e.preventDefault(); setSideFold(false); setTimeout(() => $('#q').focus(), 30); });
  $('#addSpace').onclick = () => askSpaceName(n => createSpace(n));
  $('#spaces').addEventListener('click', e => { const m = e.target.closest('[data-spmore]'); if (m) { e.stopPropagation(); spaceMenu(m, spaceById(m.dataset.spmore)); } });
  $('#spaces').addEventListener('contextmenu', e => { const r = e.target.closest('[data-spi]'); if (r) { e.preventDefault(); spaceMenu(r, spaceById(r.dataset.spi)); } });
  /* drag a note or board card onto a space of the sidebar (or onto « Non classées ») to file it there */
  const DOC_T = 'application/x-plum-doc', side = $('#side');
  document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('.dcard[draggable="true"]'); if (!c) return; e.dataTransfer.setData(DOC_T, c.dataset.doc); e.dataTransfer.effectAllowed = 'move'; document.documentElement.classList.add('filing'); });
  // the card may be re-rendered before its dragend, so the drop also ends the filing state
  const endFiling = () => { document.documentElement.classList.remove('filing'); $$('.spdrop-on').forEach(x => x.classList.remove('spdrop-on')); };
  document.addEventListener('dragend', endFiling); addEventListener('drop', endFiling); addEventListener('pointerdown', endFiling);
  side.addEventListener('dragover', e => { const t = e.target.closest('[data-spdrop]'); if (!t || ![...e.dataTransfer.types].includes(DOC_T)) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; $$('.spdrop-on').forEach(x => x !== t && x.classList.remove('spdrop-on')); t.classList.add('spdrop-on'); });
  side.addEventListener('dragleave', e => { const t = e.target.closest('[data-spdrop]'); if (t && !t.contains(e.relatedTarget)) t.classList.remove('spdrop-on'); });
  side.addEventListener('drop', e => { const t = e.target.closest('[data-spdrop]'), id = e.dataTransfer.getData(DOC_T); if (!t || !id) return; e.preventDefault(); endFiling(); fileDoc(docById(id), t.dataset.spdrop); if (R.name !== 'doc') go(R, { keepFocus: true }); });
  $('#themeBtn').onclick = () => { S.prefs.theme = isDarkTheme() ? 'light' : 'dark'; save(); applyTheme(); if (R.name !== 'doc') go(R, { keepFocus: true }); };
  $('#setBtn').onclick = openSettings; $('#meBtn').onclick = openSettings;
  bindSearch();
  $('#focusExit').onclick = () => setFocus(false);
  $('#focusAi').onclick = () => AI.toggle();
  $('#focusMood').onclick = () => Mood.toggle();
  $('#importIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importJSON(await f.text()); };

  addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'k') { e.preventDefault(); if (document.documentElement.hasAttribute('data-focus')) setFocus(false); $('#q').focus(); $('#q').select(); return; }
    if (mod && k === 'n' && !e.shiftKey && !e.altKey && R.name !== 'welcome') { e.preventDefault(); createFrom('note'); return; }
    if (mod && (e.key === '\\' || e.code === 'Backslash')) { e.preventDefault(); setSideFold(!S.prefs.sideFold); return; }
    if (mod && k === 'j') { e.preventDefault(); if (S.prefs.aiOn) AI.toggle(); return; }
    if (mod && k === 'm' && !e.shiftKey && !e.altKey) { e.preventDefault(); if (R.name !== 'welcome' && R.name !== 'mood') Mood.toggle(); return; }
    if (mod && (e.key === '.' || e.code === 'Period')) { e.preventDefault(); if (R.name === 'doc') setFocus(!document.documentElement.hasAttribute('data-focus')); return; }
    if (e.key === 'Escape') {
      if (popEl) { closePop(); return; }
      if ($('#modal')) { closeModal(); return; }
      if ($('.lightbox')) { $('.lightbox').remove(); return; }
      if (Mood.isOpen() && !editableTarget(e.target) && !(Board.mounted && Board.busy && Board.busy())) { Mood.toggle(false); return; }
      if (document.documentElement.hasAttribute('data-focus') && !editableTarget(e.target) && !(Board.mounted && Board.busy && Board.busy())) { e.preventDefault(); setFocus(false); return; }
    }
    if (R.name === 'doc') {
      if (Board.mounted && Board.key(e)) return;
      if (Note.mounted && Note.key(e)) return;
    }
    if (e.key === 'Escape' && !editableTarget(e.target) && document.documentElement.hasAttribute('data-focus')) setFocus(false);
  });
  addEventListener('keyup', e => { if (Board.mounted) Board.keyUp(e); });
  addEventListener('paste', e => {
    if (editableTarget(e.target) || $('#modal')) return;
    if (Mood.paste(e)) return;
    if (Board.mounted) Board.paste(e);
  });

  /* files, links or text dropped anywhere outside a board or a note go to the moodboard of the space */
  const view = $('#view'), dropKind = e => [...(e.dataTransfer.types || [])].some(t => t === 'Files' || t === 'text/uri-list' || t === 'text/plain');
  view.addEventListener('dragover', e => { if (R.name === 'doc' || R.name === 'welcome' || Mood.dragging() || !dropKind(e)) return; e.preventDefault(); view.classList.add('dropping'); });
  view.addEventListener('dragleave', e => { if (!view.contains(e.relatedTarget)) view.classList.remove('dropping'); });
  view.addEventListener('drop', async e => {
    view.classList.remove('dropping');
    if (R.name === 'doc' || R.name === 'welcome' || Mood.dragging()) return;
    e.preventDefault(); Mood.drop(e.dataTransfer, spaceById(ctxSpace()) || curSpace());
  });

  window.__nh = { S: () => S, mkUic, uiLayout, UI_TYPES, Sync, Assets, go, save, applyTheme, applyUiScale, openSettings, spaceMedia, Board, Ink, PENS, migrateState, importJSON, exportJSON, newDoc, Mood, createSpace, ink: { inkSVG, stampPicture, tipsLoaded: () => tipGen, BrushLib, sampleStroke, brushPreview, penPref, TEX_ORDER, NIB_ORDER, texTile, nibImage } };
  const flush = () => { try { window.__flushSave(); } catch (e) {} };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('resize', debounce(() => { if (Board.mounted) Board.layoutChanged(); }, 120));
}
async function boot() {
  try { loadTips(); } catch (e) {}   // the brush engine's alpha tips decode while the app starts
  applyTheme();
  const ok = await DB.open();
  await Assets.load();
  /* 0.2 has its own blank workspace (STATE_KEY); the one saved before stays in kv "state" (LEGACY), untouched */
  let st = null, old = null;
  try { st = await DB.get('kv', STATE_KEY); } catch (e) {}
  try { old = await DB.get('kv', 'state'); } catch (e) {}
  if (old && Array.isArray(old.docs) && (old.docs.length || (old.tasks || []).length)) LEGACY = old;
  if (!st || !Array.isArray(st.docs)) { S = { v: 3, spaces: [], docs: [], tasks: [], prefs: mergePrefs({ defSkin: DEFAULT_PREFS.skin }) }; ensureDefaultSpace(S); await persist(); }
  else { S = migrateState(st); S.prefs = mergePrefs(S.prefs); S.tasks = S.tasks || []; ensureDefaultSpace(S); }
  if (S.prefs.defSkin !== DEFAULT_PREFS.skin) { S.prefs.defSkin = DEFAULT_PREFS.skin; S.prefs.skin = DEFAULT_PREFS.skin; save(); }
  try { await Promise.race([Promise.all(['400 14px Figtree', '600 14px Figtree', '700 14px Figtree', '400 24px Caveat', '700 24px Caveat'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  applyTheme(); applyUiScale(); setSideFold(!!S.prefs.sideFold);
  bindShell();
  $('#focusAi').hidden = !S.prefs.aiOn;
  Mood.mount();
  go(S.prefs.last || 'home');
  Sync.start();
  if (!ok) setTimeout(() => toast("Ce navigateur n'enregistre pas vos changements : exportez avant de fermer."), 600);
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:auto 16px 16px;background:#E5484D;color:#fff;padding:12px 14px;border-radius:12px;z-index:999">PLUM n'a pas pu démarrer : ${esc(e.message || e)}</div>`); });
