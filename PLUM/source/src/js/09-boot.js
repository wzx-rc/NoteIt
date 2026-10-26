/* ================= boot ================= */
function mergePrefs(p) {
  const d = JSON.parse(JSON.stringify(DEFAULT_PREFS)), out = Object.assign(d, p || {});
  out.pens = {}; for (const k of Object.keys(DEFAULT_PREFS.pens)) out.pens[k] = Object.assign({}, DEFAULT_PREFS.pens[k], (p && p.pens && p.pens[k]) || {});
  out.bd = Object.assign({}, DEFAULT_PREFS.bd, (p && p.bd) || {});
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
    else if (d.type === 'note') d.ink = (d.ink || []).map(s => Object.assign({}, s, { t: strokeT(s.t) }));
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
  $('#spaces').addEventListener('contextmenu', e => { const b = e.target.closest('[data-sp]'); if (!b) return; e.preventDefault(); spaceMenu(b, spaceById(b.dataset.sp)); });
  $('#addSpace').onclick = addSpaceInline;
  $('#addPage').onclick = e => openPop(e.currentTarget, [{ head: 'Nouvelle page' }, { label: 'Note', icon: 'note', run: () => createFrom('note') }, { label: 'Board', icon: 'board', run: () => createFrom('board') }]);
  $('#themeBtn').onclick = () => { S.prefs.theme = isDarkTheme() ? 'light' : 'dark'; save(); applyTheme(); if (R.name !== 'doc') go(R, { keepFocus: true }); };
  $('#setBtn').onclick = openSettings; $('#meBtn').onclick = openSettings;
  bindSearch();
  $('#focusExit').onclick = () => setFocus(false);
  $('#focusAi').onclick = () => AI.toggle();
  $('#importIn').onchange = async e => { const f = e.target.files[0]; e.target.value = ''; if (f) importJSON(await f.text()); };

  addEventListener('keydown', e => {
    const mod = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
    if (mod && k === 'k') { e.preventDefault(); if (document.documentElement.hasAttribute('data-focus')) setFocus(false); $('#q').focus(); $('#q').select(); return; }
    if (mod && k === 'j') { e.preventDefault(); if (S.prefs.aiOn) AI.toggle(); return; }
    if (mod && (e.key === '.' || e.code === 'Period')) { e.preventDefault(); if (R.name === 'doc') setFocus(!document.documentElement.hasAttribute('data-focus')); return; }
    if (e.key === 'Escape') {
      if (popEl) { closePop(); return; }
      if ($('#modal')) { closeModal(); return; }
      if ($('.lightbox')) { $('.lightbox').remove(); return; }
    }
    if (R.name === 'doc') {
      if (Board.mounted && Board.key(e)) return;
      if (Note.mounted && Note.key(e)) return;
    }
    if (e.key === 'Escape' && !editableTarget(e.target) && document.documentElement.hasAttribute('data-focus')) setFocus(false);
  });
  addEventListener('keyup', e => { if (Board.mounted) Board.keyUp(e); });
  addEventListener('paste', e => { if (Board.mounted && !editableTarget(e.target) && !$('#modal')) Board.paste(e); });

  /* files dropped anywhere outside a board or a note start a new board with them */
  const view = $('#view');
  view.addEventListener('dragover', e => { if (R.name === 'doc') return; if (![...(e.dataTransfer.types || [])].includes('Files')) return; e.preventDefault(); view.classList.add('dropping'); });
  view.addEventListener('dragleave', e => { if (!view.contains(e.relatedTarget)) view.classList.remove('dropping'); });
  view.addEventListener('drop', async e => {
    if (R.name === 'doc') return; view.classList.remove('dropping');
    const files = [...(e.dataTransfer.files || [])]; if (!files.length) return; e.preventDefault();
    const d = newDoc('board', { title: `Dépôt du ${fmtShort(today())}`, sp: ctxSpace() || undefined }); go('doc:' + d.id);
    await Board.ingestFiles(files);
    Board.fitAll();
  });

  window.__nh = { S: () => S, go, save, applyTheme, openSettings, spaceMedia, Board, Ink, PENS, migrateState, importJSON, exportJSON, newDoc };
  const flush = () => { try { window.__flushSave(); } catch (e) {} };
  addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
  addEventListener('resize', debounce(() => { if (Board.mounted) Board.layoutChanged(); }, 120));
}
async function boot() {
  applyTheme();
  const ok = await DB.open();
  await Assets.load();
  let st = null; try { st = await DB.get('kv', 'state'); } catch (e) {}
  if (!st || !Array.isArray(st.docs)) { S = { spaces: [], docs: [], tasks: [], prefs: mergePrefs() }; S = await seedWorkspace(); S.prefs = mergePrefs(S.prefs); await persist(); }
  else { S = migrateState(st); S.prefs = mergePrefs(S.prefs); S.spaces = S.spaces || []; S.tasks = S.tasks || []; }
  try { await Promise.race([Promise.all(['400 14px Figtree', '600 14px Figtree', '700 14px Figtree', '400 24px Caveat', '700 24px Caveat'].map(f => document.fonts.load(f))), new Promise(r => setTimeout(r, 1500))]); } catch (e) {}
  applyTheme();
  bindShell();
  $('#focusAi').hidden = !S.prefs.aiOn;
  go(S.prefs.last || 'home');
  if (!ok) setTimeout(() => toast("Ce navigateur n'enregistre pas vos changements : exportez avant de fermer."), 600);
}
boot().catch(e => { console.error(e); document.body.insertAdjacentHTML('beforeend', `<div style="position:fixed;inset:auto 16px 16px;background:#E5484D;color:#fff;padding:12px 14px;border-radius:12px;z-index:999">PLUM n'a pas pu démarrer : ${esc(e.message || e)}</div>`); });
