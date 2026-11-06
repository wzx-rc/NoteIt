/* ================= HUB, 0.2.32 =================
   The home page: one Project Card per space (cover image, main colour with two shades derived from it, pinned note,
   last board, tasks) and modules (Calendrier, Météo, Note du HUB, Tâches en cours, Nouveau projet).
   Personnaliser = Custom mode: drag a module, it snaps to a 20 px grid and never lands on another one;
   S / M / L size, − to take it away, + to bring one back.
   S.hub is synced (meta:hub): { mods: [{ id, t, sp?, sz, x, y, o }], off: [space ids taken away], note, city, ics }.
   On a phone the modules stack in their order (o) and an L card shows as M. */
const HUB_GRID = 20;
const HUB_SIZES = {
  proj: { S: [240, 340], M: [540, 340], L: [780, 440] },
  cal: { S: [240, 200], M: [380, 220], L: [540, 340] },
  wx: { S: [200, 200], M: [380, 200], L: [540, 300] },
  note: { S: [300, 220], M: [420, 340], L: [560, 440] },
  tasks: { S: [240, 200], M: [420, 340], L: [560, 440] },
  new: { S: [240, 200], M: [340, 220], L: [340, 220] }
};
const HUB_MODS = [['cal', 'cal', 'Calendrier', 'Ton planning du jour (PRONOTE ou iCal)'], ['wx', 'sun', 'Météo', 'La météo de ta ville'], ['note', 'pencil', 'Note du HUB', 'Un brouillon, sans choisir d’espace'], ['tasks', 'tasks', 'Tâches en cours', 'Les tâches de tous tes projets'], ['new', 'plus', 'Nouveau projet', 'Un raccourci pour créer un espace']];
const hubPhone = () => innerWidth < 700;
let hubEdit = false;

/* ---------- colours: the space's main colour and two shades made from it ---------- */
function hexHsl(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || ''); if (!m) return [0, 0, .5];
  const n = parseInt(m[1], 16), r = (n >> 16 & 255) / 255, g = (n >> 8 & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (!d) return [0, 0, l];
  const s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn);
  const h = mx === r ? ((g - b) / d + (g < b ? 6 : 0)) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}
function hslHex(h, s, l) {
  const k = n => (n + h / 30) % 12, a = s * Math.min(l, 1 - l);
  const f = n => Math.round(255 * (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))))).toString(16).padStart(2, '0');
  return '#' + f(0) + f(8) + f(4);
}
/* c1 = the colour itself (frame, ticks), c2 = deep shade (cover), c3 = light shade (name plate, pinned note on dark) */
function projPal(hex) {
  const [h, s, l] = hexHsl(hex), sat = Math.max(s, .35);
  return { c1: hex, c2: hslHex(h, Math.min(.9, sat), Math.max(.16, Math.min(.32, l * .55))), c3: hslHex(h, Math.min(1, sat + .1), Math.min(.82, Math.max(.66, l + .22))), ink: hslHex(h, Math.min(.9, sat), .14) };
}

/* ---------- layout ---------- */
function hubState() {
  const H = S.hub || (S.hub = {});
  if (!Array.isArray(H.mods)) H.mods = [];
  if (!Array.isArray(H.off)) H.off = [];
  if (typeof H.note !== 'string') H.note = '';
  return H;
}
const hubSize = m => { const sz = (HUB_SIZES[m.t] || HUB_SIZES.cal)[m.sz] || (HUB_SIZES[m.t] || HUB_SIZES.cal).M; return { w: sz[0], h: sz[1] }; };
const hubBox = m => { const s = hubSize(m); return { x: m.x, y: m.y, w: s.w, h: s.h }; };
const hubHit = (a, b, gap = HUB_GRID) => a.x < b.x + b.w + gap && b.x < a.x + a.w + gap && a.y < b.y + b.h + gap && b.y < a.y + a.h + gap;
/* first free place at or below (x, y), left to right inside the width */
function hubFit(m, others, W, x0 = 0, y0 = 0) {
  const s = hubSize(m), snap = v => Math.round(v / HUB_GRID) * HUB_GRID;
  const maxX = Math.max(0, W - s.w);
  for (let y = snap(y0); y < 20000; y += HUB_GRID) {
    const xs = [snap(Math.min(x0, maxX))]; for (let x = 0; x <= maxX; x += HUB_GRID) xs.push(x);
    for (const x of xs) { const b = { x, y, w: s.w, h: s.h }; if (!others.some(o => hubHit(b, hubBox(o)))) return { x, y }; }
  }
  return { x: 0, y: y0 };
}
/* the free place closest to where a module is dropped (drag, size change) */
function hubNear(m, others, W, x0, y0) {
  const s = hubSize(m), maxX = Math.max(0, W - s.w);
  let maxY = 0; for (const o of others) { const b = hubBox(o); maxY = Math.max(maxY, b.y + b.h + HUB_GRID); }
  let best = null, bd = Infinity;
  for (let y = 0; y <= Math.max(maxY, y0); y += HUB_GRID) for (let x = 0; x <= maxX; x += HUB_GRID) {
    const d = (x - x0) ** 2 + (y - y0) ** 2; if (d >= bd) continue;
    const b = { x, y, w: s.w, h: s.h }; if (!others.some(o => hubHit(b, hubBox(o)))) { best = { x, y }; bd = d; }
  }
  return best || hubFit(m, others, W, x0, y0);
}
const projRecent = sp => Math.max(sp.created || 0, ...S.docs.filter(d => d.sp === sp.id && !d.trash).map(d => d.updated || 0), ...S.tasks.filter(t => t.sp === sp.id).map(t => t.created || 0));
/* every space has its card unless it was taken away; modules that point to a deleted space go */
function hubSync(W) {
  const H = hubState(), ids = new Set(S.spaces.map(s => s.id));
  H.mods = H.mods.filter(m => m.t !== 'proj' || ids.has(m.sp));
  const first = !H.mods.length;
  const missing = userSpaces().filter(s => !H.off.includes(s.id) && !H.mods.some(m => m.t === 'proj' && m.sp === s.id)).sort((a, b) => projRecent(b) - projRecent(a));
  let add = missing.map((s, i) => ({ id: uid('h'), t: 'proj', sp: s.id, sz: first ? (i === 0 ? 'L' : 'M') : 'M' }));
  if (first) add = [...add.slice(0, 1), { id: uid('h'), t: 'cal', sz: 'M' }, { id: uid('h'), t: 'wx', sz: 'S' }, ...add.slice(1), { id: uid('h'), t: 'note', sz: 'M' }, { id: uid('h'), t: 'tasks', sz: 'M' }, { id: uid('h'), t: 'new', sz: 'M' }];
  for (const m of add) { const p = hubFit(m, H.mods, W); m.x = p.x; m.y = p.y; m.o = H.mods.length; H.mods.push(m); }
  if (add.length) save();
  return H;
}

/* ---------- module bodies ---------- */
const stripHtml = h => { const t = document.createElement('div'); t.innerHTML = h || ''; return (t.textContent || '').replace(/\s+/g, ' ').trim(); };
function projCard(m, sp) {
  const pal = projPal(sp.color), sz = hubPhone() && m.sz === 'L' ? 'M' : m.sz;
  const docs = liveDocs().filter(d => d.sp === sp.id).sort((a, b) => b.updated - a.updated);
  const note = docById(sp.pin) && !docById(sp.pin).trash ? docById(sp.pin) : docs.find(d => d.type === 'note');
  const board = docById(sp.pinB) && !docById(sp.pinB).trash ? docById(sp.pinB) : docs.find(d => d.type === 'board');
  const open = S.tasks.filter(t => t.sp === sp.id && !t.done).sort(taskSort), all = S.tasks.filter(t => t.sp === sp.id), nDone = all.length - open.length;
  const nb = docs.filter(d => d.type === 'board').length, nn = docs.length - nb, pl = (n, w) => `${n} ${w}${n > 1 ? 's' : ''}`;
  const cov = sp.cover && Assets.url(sp.cover);
  const plate = `<div class="pc-plate"><b>${esc(sp.name)}</b><small>${[nn ? pl(nn, 'note') : '', nb ? pl(nb, 'board') : '', all.length ? `${nDone} / ${all.length} tâches` : ''].filter(Boolean).join(' · ') || 'Projet vide'}</small></div>`;
  const cover = `<button class="pc-cover${cov ? ' img' : ''}" data-hgo="space:${sp.id}" aria-label="Ouvrir ${esc(sp.name)}">${cov ? `<img src="${cov}" alt="">` : `<span class="pc-ini" aria-hidden="true">${esc((sp.name || '?').trim()[0] || '?').toUpperCase()}</span>`}${plate}${all.length ? `<span class="pc-bar"><i style="width:${Math.round(nDone / all.length * 100)}%"></i></span>` : ''}</button>`;
  const tk = n => open.slice(0, n).map(t => `<button class="pc-tk" data-hdone="${t.id}"><i class="pc-bx"></i><span>${esc(t.t)}</span></button>`).join('') || `<span class="pc-none">Rien à faire ici.</span>`;
  const noteHtml = note ? `<button class="pc-note" data-hgo="doc:${note.id}"><span class="lab">${sp.pin ? 'Note épinglée' : 'Dernière note'}</span><p>${esc(stripHtml(noteHTML(note, ' ')).slice(0, 220) || note.title)}</p><small>${esc(note.title)} · ${ago(note.updated)}</small></button>` : `<button class="pc-note empty" data-hnew="note" data-sp="${sp.id}"><span class="lab">Note</span><p>Écrire une première note…</p></button>`;
  const boardHtml = board ? `<button class="pc-board" data-hgo="doc:${board.id}"><span class="pc-th">${Thumbs.svg(board)}</span><span class="pc-go">${esc(board.title)}${icon('chev', 'sm')}</span></button>` : `<button class="pc-board empty" data-hnew="board" data-sp="${sp.id}"><span class="pc-go">Créer un board${icon('plus', 'sm')}</span></button>`;
  const tasks = `<div class="pc-tasks"><div class="pc-th2"><span class="lab">Tâches</span><small>${open.length ? `${open.length} à faire` : ''}</small></div><div class="pc-tl">${tk(sz === 'L' ? 6 : 4)}</div></div>`;
  const body = sz === 'S' ? `${cover}${open[0] ? `<button class="pc-tk one" data-hdone="${open[0].id}"><i class="pc-bx"></i><span>${esc(open[0].t)}</span></button>` : ''}`
    : sz === 'M' ? `${cover}<div class="pc-side">${tasks}${board ? `<button class="pc-open" data-hgo="doc:${board.id}">Ouvrir le board${icon('chev', 'sm')}</button>` : `<button class="pc-open" data-hnew="board" data-sp="${sp.id}">Créer un board${icon('plus', 'sm')}</button>`}</div>`
    : `${cover}${noteHtml}${boardHtml}${tasks}`;
  return `<div class="pcard pc-${sz}" style="--pc1:${pal.c1};--pc2:${pal.c2};--pc3:${pal.c3};--pci:${pal.ink}">${body}<button class="pc-menu" data-hmenu="${m.id}" aria-label="Options de ${esc(sp.name)}">${icon('dots', 'sm')}</button></div>`;
}
/* events of the day: the HUB's own iCal link, else the planning blocks of the boards */
let hubCalBusy = false;
function hubEvents() {
  const day = ymd(new Date()), C = S.prefs.hubCal;
  let ev = C && C.ev ? C.ev : [];
  if (!ev.length) for (const d of liveDocs()) for (const it of d.items || []) if (it.k === 'plan' && it.ev) ev = ev.concat(it.ev);
  const seen = new Set();
  return ev.filter(e => !(e[4] & 1) && String(e[0]).slice(0, 10) === day && !seen.has(e[0] + e[2]) && seen.add(e[0] + e[2])).sort((a, b) => a[0] < b[0] ? -1 : 1);
}
async function hubCalRefresh(force) {
  const H = hubState(), C = S.prefs.hubCal;
  if (!H.ics || hubCalBusy || (!force && C && C.src === H.ics && Date.now() - C.at < 3600e3)) return;
  hubCalBusy = true;
  try {
    const r = await Net.ics(H.ics); const p = r && r.ok ? icsParse(r.text) : null;
    if (p) { const from = ymd(new Date()), to = ymd(dAdd(new Date(), 8)); S.prefs.hubCal = { src: H.ics, at: Date.now(), ev: p.ev.filter(e => String(e[0]).slice(0, 10) >= from && String(e[0]).slice(0, 10) <= to).map(e => e.slice(0, 5)) }; save(); if (R.name === 'hub') renderHubMods(); }
    else if (force) toast(DESKTOP ? 'Ce lien ne donne pas de calendrier.' : 'Ce lien ne se lit que dans l’app Windows ou iPad.');
  } finally { hubCalBusy = false; }
}
function calMod(m) {
  const ev = hubEvents(), now = ymdhm(new Date()), next = ev.find(e => e[1] > now) || null;
  const d = new Date(), wd = d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '').toUpperCase();
  const lab = e => (e[2] || '').split(/\s+[-–]\s+/)[0];
  const row = e => `<div class="hc-ev${e[1] <= now ? ' past' : ''}"><span class="t">${e[4] & 2 ? 'Jour' : e[0].slice(11, 16)}</span><i style="background:${PLAN_COLORS[Math.floor(hashStr(lab(e).toUpperCase()) * PLAN_COLORS.length)]}"></i><b>${esc(lab(e))}</b><span class="r">${esc(e[3] || '')}</span></div>`;
  const empty = !ev.length ? `<div class="hc-empty">${hubState().ics ? 'Rien aujourd’hui.' : 'Ajoute ton lien iCal (PRONOTE) dans les options pour voir ta journée.'}</div>` : '';
  if (m.sz === 'S') return `<div class="hm-h"><span class="lab">Prochain</span></div>${next ? `<b class="hc-big">${esc(lab(next))}</b><small class="hc-sub">${next[0].slice(11, 16)}${next[3] ? ' · ' + esc(next[3]) : ''}</small>` : `<b class="hc-big">${d.getDate()} ${d.toLocaleDateString('fr-FR', { month: 'short' })}</b><small class="hc-sub">${ev.length ? 'Journée finie' : 'Journée libre'}</small>`}`;
  return `<div class="hm-h"><span class="lab">Aujourd’hui</span><b class="hc-day">${wd} ${d.getDate()}</b></div><div class="hc-list">${ev.slice(0, m.sz === 'L' ? 8 : 4).map(row).join('')}${empty}</div>`;
}
/* weather from Open-Meteo (no key), cached 30 min in this device's prefs */
const WX = { 0: ['Grand soleil', 'sun'], 1: ['Plutôt beau', 'sun'], 2: ['Éclaircies', 'sun'], 3: ['Couvert', 'drop'], 45: ['Brouillard', 'drop'], 48: ['Brouillard', 'drop'], 51: ['Bruine', 'drop'], 53: ['Bruine', 'drop'], 55: ['Bruine', 'drop'], 61: ['Pluie', 'drop'], 63: ['Pluie', 'drop'], 65: ['Forte pluie', 'drop'], 71: ['Neige', 'drop'], 73: ['Neige', 'drop'], 75: ['Neige', 'drop'], 80: ['Averses', 'drop'], 81: ['Averses', 'drop'], 82: ['Averses', 'drop'], 95: ['Orage', 'drop'], 96: ['Orage', 'drop'], 99: ['Orage', 'drop'] };
const wxOf = c => WX[c] || WX[Math.floor(c / 10) * 10] || ['—', 'drop'];
let wxBusy = false;
async function hubWxRefresh(force) {
  const c = hubState().city, W = S.prefs.hubWx;
  if (!c || wxBusy || (!force && W && W.k === c.lat + ',' + c.lon && Date.now() - W.at < 1800e3)) return;
  wxBusy = true;
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}&current=temperature_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6`);
    if (r.ok) { const j = await r.json(); S.prefs.hubWx = { k: c.lat + ',' + c.lon, at: Date.now(), t: j.current.temperature_2m, c: j.current.weather_code, d: j.daily.time.map((t, i) => [t, j.daily.weather_code[i], j.daily.temperature_2m_min[i], j.daily.temperature_2m_max[i], j.daily.precipitation_probability_max[i]]) }; save(); if (R.name === 'hub') renderHubMods(); }
  } catch (e) {} finally { wxBusy = false; }
}
async function hubSetCity(name) {
  try {
    const r = await fetch(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=fr&name=${encodeURIComponent(name)}`);
    const g = r.ok ? (await r.json()).results : null;
    if (!g || !g[0]) { toast(`Ville « ${name} » introuvable`); return; }
    hubState().city = { name: g[0].name, lat: +g[0].latitude.toFixed(3), lon: +g[0].longitude.toFixed(3) }; save(); hubWxRefresh(true); renderHubMods();
  } catch (e) { toast('Météo injoignable pour l’instant'); }
}
function wxMod(m) {
  const c = hubState().city, W = S.prefs.hubWx;
  if (!c) return `<div class="hw-set"><span class="lab">Météo</span><form data-hcity><input placeholder="Ta ville" aria-label="Ta ville" autocomplete="off"><button class="btn sm" type="submit">OK</button></form></div>`;
  if (!W || !W.d) return `<div class="hw-now"><span class="hw-t">…</span><small>${esc(c.name)}</small></div>`;
  const [lab, ic] = wxOf(W.c), t = Math.round(W.t), d0 = W.d[0] || [];
  const day = r => `<div class="hw-d"><small>${new Date(r[0] + 'T12:00').toLocaleDateString('fr-FR', { weekday: 'short' })}</small>${icon(wxOf(r[1])[1], 'sm')}<b>${Math.round(r[3])}°</b><small>${Math.round(r[2])}°</small></div>`;
  if (m.sz === 'S') return `<div class="hw-now">${icon(ic)}<span class="hw-t">${t}°</span><small>${esc(c.name)}</small></div>`;
  return `<div class="hm-h"><span class="lab">Météo · ${esc(c.name)}</span></div><div class="hw-row"><span class="hw-t">${t}°</span><div class="hw-l"><b>${lab}</b><small>min ${Math.round(d0[2])}° · max ${Math.round(d0[3])}°${d0[4] != null ? ` · pluie ${d0[4]} %` : ''}</small></div></div>${m.sz === 'L' ? `<div class="hw-days">${W.d.slice(1, 6).map(day).join('')}</div>` : `<div class="hw-days sm">${W.d.slice(1, 4).map(day).join('')}</div>`}`;
}
function noteMod(m) {
  return `<div class="hm-h"><span class="lab">Note du HUB</span><small>${hubState().note.trim() ? 'brouillon' : ''}</small></div><textarea class="hn-ta" data-hnote placeholder="Écris ici, sans choisir d’espace…" aria-label="Note du HUB">${esc(hubState().note)}</textarea>${m.sz === 'S' ? '' : `<div class="hn-acts"><button class="btn sm" data-hfile>Ranger dans un projet</button><button class="btn sm pri" data-hmk>En faire une note</button></div>`}`;
}
function tasksMod(m) {
  const open = S.tasks.filter(t => !t.done).sort((a, b) => projRecent(spaceById(b.sp) || {}) - projRecent(spaceById(a.sp) || {}) || taskSort(a, b));
  if (m.sz === 'S') return `<div class="hm-h"><span class="lab">Tâches</span></div><b class="ht-n">${open.length}</b><small class="hc-sub">à faire${open.length ? ` dans ${new Set(open.map(t => t.sp)).size} projet${new Set(open.map(t => t.sp)).size > 1 ? 's' : ''}` : ''}</small>`;
  const tag = t => { const sp = spaceById(t.sp); if (!sp || sp.id === DEF_SPACE) return ''; const p = projPal(sp.color); return `<b class="ht-tag" style="--pc1:${p.c1};--pc2:${p.c2};--pc3:${p.c3}">${esc(sp.name)}</b>`; };
  const col = t => { const sp = spaceById(t.sp); return sp && sp.id !== DEF_SPACE ? sp.color : 'var(--ink-3)'; };
  return `<div class="hm-h"><span class="lab">Tâches en cours</span><small>${open.length} à faire</small></div><div class="ht-list">${open.slice(0, m.sz === 'L' ? 9 : 5).map(t => `<button class="pc-tk" data-hdone="${t.id}" style="--pc1:${col(t)}"><i class="pc-bx"></i><span>${esc(t.t)}</span>${tag(t)}</button>`).join('') || '<span class="pc-none">Tout est fait.</span>'}</div><form class="ht-add" data-hadd><input placeholder="Ajouter une tâche…" aria-label="Ajouter une tâche" autocomplete="off"></form>`;
}
const newMod = () => `<button class="hn-new" data-hnewsp>${icon('plus', 'lg')}<b>Nouveau projet</b><small>Une carte de plus sur ta table</small></button>`;
function modHTML(m) {
  let inner = '', cls = 'hmod hm-' + m.t + ' hs-' + (hubPhone() && m.sz === 'L' && m.t === 'proj' ? 'M' : m.sz);
  if (m.t === 'proj') { const sp = spaceById(m.sp); if (!sp) return ''; inner = projCard(m, sp); }
  else if (m.t === 'cal') inner = calMod(m); else if (m.t === 'wx') inner = wxMod(m); else if (m.t === 'note') inner = noteMod(m); else if (m.t === 'tasks') inner = tasksMod(m); else if (m.t === 'new') inner = newMod();
  const s = hubSize(m);
  const edit = `<div class="hm-edit"><button class="hm-rm" data-hrm="${m.id}" aria-label="Retirer">${icon('x', 'sm')}</button>${m.t === 'new' ? '' : `<div class="hm-sz">${['S', 'M', 'L'].map(z => `<button data-hsz="${z}" aria-pressed="${m.sz === z}">${z}</button>`).join('')}</div>`}</div>`;
  return `<section class="${cls}" data-hmod="${m.id}" style="left:${m.x}px;top:${m.y}px;width:${s.w}px;height:${s.h}px;order:${m.o ?? 0}">${inner}${edit}</section>`;
}

/* ---------- the page ---------- */
function hubWidth() { const v = $('#view'); return Math.max(560, (v ? v.clientWidth : innerWidth) - 72); }
function renderHub(v) {
  const H = hubSync(hubWidth());
  const d = new Date(), date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const n = userSpaces().length;
  v.innerHTML = `<div class="page hubpage"><div class="ph"><div><h1>HUB</h1><div class="sub">${date.charAt(0).toUpperCase() + date.slice(1)}${n ? ` · ${n} projet${n > 1 ? 's' : ''}` : ''}</div></div>
    <div class="acts"><button class="btn" id="hubAdd"${hubEdit ? '' : ' hidden'}>${icon('plus')}Ajouter un module</button><button class="btn${hubEdit ? ' pri' : ''}" id="hubCustom">${icon(hubEdit ? 'check' : 'sliders')}${hubEdit ? 'Terminé' : 'Personnaliser'}</button></div></div>
    <div class="hubtable" id="hubTable"></div></div>`;
  document.documentElement.toggleAttribute('data-hubedit', hubEdit);
  renderHubMods();
  bindHub(v);
  hubCalRefresh(); hubWxRefresh();
  if (!H.mods.length) $('#hubTable').innerHTML = '<div class="empty">Rien sur la table. Personnaliser > Ajouter un module.</div>';
}
function renderHubMods() {
  const t = $('#hubTable'); if (!t) return;
  const H = hubState(), ta = document.activeElement && document.activeElement.matches && document.activeElement.matches('[data-hnote]');
  if (ta) { // keep typing in the note: refresh the others only
    for (const m of H.mods) if (m.t !== 'note') { const el = t.querySelector(`[data-hmod="${m.id}"]`); if (el) el.outerHTML = modHTML(m); }
    return;
  }
  t.innerHTML = H.mods.map(modHTML).join('');
  hubFrame();
}
function hubFrame() {
  const t = $('#hubTable'); if (!t) return;
  if (hubPhone()) { t.style.height = ''; t.style.width = ''; return; }
  let w = 0, h = 0; for (const m of hubState().mods) { const b = hubBox(m); w = Math.max(w, b.x + b.w); h = Math.max(h, b.y + b.h); }
  t.style.height = (h + (hubEdit ? 260 : 40)) + 'px'; t.style.width = Math.max(w, 10) + 'px';
}
function hubMod(id) { return hubState().mods.find(m => m.id === id); }
/* changing a size may make it overlap: it goes to the first free place from where it was */
function hubPlace(m, x, y) { const others = hubState().mods.filter(o => o !== m); const p = hubNear(m, others, Math.max(hubWidth(), x + hubSize(m).w), x, y); m.x = p.x; m.y = p.y; }
function hubAddMenu(anchor) {
  const H = hubState(), items = [];
  const has = t => H.mods.some(m => m.t === t);
  const off = userSpaces().filter(s => !H.mods.some(m => m.t === 'proj' && m.sp === s.id));
  if (off.length) { items.push({ head: 'Projets' }); for (const s of off) items.push({ label: s.name, dot: s.color, run: () => { H.off = H.off.filter(x => x !== s.id); hubAddMod({ t: 'proj', sp: s.id, sz: 'M' }); } }); }
  const mods = HUB_MODS.filter(([t]) => !has(t));
  if (mods.length) { items.push({ head: 'Modules' }); for (const [t, ic, l, sm] of mods) items.push({ label: l, icon: ic, small: sm, run: () => hubAddMod({ t, sz: t === 'wx' ? 'S' : 'M' }) }); }
  if (!items.length) items.push({ head: 'Tout est déjà sur la table' });
  openPop(anchor, items, { align: 'right' });
}
function hubAddMod(o) {
  const H = hubState(), m = Object.assign({ id: uid('h'), o: H.mods.length }, o);
  const p = hubFit(m, H.mods, hubWidth()); m.x = p.x; m.y = p.y; H.mods.push(m); save(); renderHubMods();
  const el = $(`[data-hmod="${m.id}"]`); if (el) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
function projMenu(anchor, m) {
  const sp = spaceById(m.sp); if (!sp) return;
  const imgs = spaceMedia(sp.id).filter(x => x.asset && (x.type === 'image' || /^image\//.test(x.mime || '')) && Assets.has(x.asset)).slice(0, 8);
  const pickFile = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const im = await importImage(f, 1600); sp.cover = im.id; save(); renderHubMods(); } catch (e) { toast('Image illisible'); } }; i.click(); };
  const items = [
    { label: 'Ouvrir le projet', icon: 'folder', run: () => go('space:' + sp.id) },
    { label: 'Couverture : choisir une image…', icon: 'image', run: pickFile },
    ...imgs.map(x => ({ label: 'Couverture du moodboard', icon: 'image', small: x.name || '', run: () => { sp.cover = x.asset; save(); renderHubMods(); } })),
    ...(sp.cover ? [{ label: 'Retirer la couverture', icon: 'x', run: () => { delete sp.cover; save(); renderHubMods(); } }] : []),
    { label: 'Couleur principale…', icon: 'palette', run: () => projColor(anchor, sp) },
    '-',
    ...['S', 'M', 'L'].map(z => ({ label: `Taille ${z}`, small: m.sz === z ? 'actuelle' : '', run: () => { m.sz = z; hubPlace(m, m.x, m.y); save(); renderHubMods(); } })),
    { label: 'Retirer du HUB', icon: 'x', danger: true, run: () => hubRemove(m) }
  ];
  openPop(anchor, items, { align: 'right' });
}
function projColor(anchor, sp) {
  const cols = themeColors('space', SPACE_COLORS);
  const p = openPop(anchor, `<div class="pc-cols">${cols.map(c => `<button data-c="${c}" style="--c:${c}" aria-label="${c}"${c === sp.color ? ' aria-pressed="true"' : ''}></button>`).join('')}<label class="pc-any" title="Autre couleur"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(sp.color) ? sp.color : '#888888'}" aria-label="Autre couleur"></label></div><small class="pc-colhint">La 2e et la 3e couleur du projet en sont tirées.</small>`, { align: 'right' });
  const set = c => { sp.color = c; save(); renderHubMods(); renderSide(); };
  p.onclick = e => { const b = e.target.closest('[data-c]'); if (b) { set(b.dataset.c); closePop(); } };
  $('input', p).oninput = e => set(e.target.value);
}
function hubRemove(m) {
  const H = hubState(), i = H.mods.indexOf(m); if (i < 0) return;
  H.mods.splice(i, 1); if (m.t === 'proj' && !H.off.includes(m.sp)) H.off.push(m.sp); save(); renderHubMods();
  toast('Retiré du HUB', { label: 'Annuler', run: () => { H.mods.splice(i, 0, m); if (m.t === 'proj') H.off = H.off.filter(x => x !== m.sp); save(); renderHubMods(); } });
}
function hubNoteOut(spId) {
  const H = hubState(), txt = H.note.trim(); if (!txt) { toast('La note du HUB est vide'); return; }
  const lines = txt.split('\n'), title = lines[0].slice(0, 80), body = lines.slice(1).join('\n').trim();
  const d = newDoc('note', { title, html: (body || '').split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join(''), sp: spId || DEF_SPACE });
  H.note = ''; save(); renderHubMods();
  toast(spId && spId !== DEF_SPACE ? `Note rangée dans ${spaceById(spId).name}` : 'Note créée', { label: 'Ouvrir', run: () => go('doc:' + d.id) });
}
function hubOptions(anchor) {
  const H = hubState();
  const p = openPop(anchor, `<div class="hub-opts"><label><span>Ville pour la météo</span><input id="hoCity" value="${esc((H.city || {}).name || '')}" placeholder="Ta ville" autocomplete="off"></label>
    <label><span>Lien iCal du calendrier (PRONOTE…)</span><input id="hoIcs" value="${esc(H.ics || '')}" placeholder="https://… .ics" autocomplete="off" spellcheck="false"></label>
    <div style="display:flex;justify-content:flex-end"><button class="btn sm pri" id="hoOk">Enregistrer</button></div></div>`, { align: 'right' });
  $('#hoOk', p).onclick = () => {
    const c = $('#hoCity', p).value.trim(), i = $('#hoIcs', p).value.trim(); closePop();
    if (i !== (H.ics || '')) { H.ics = i; delete S.prefs.hubCal; save(); hubCalRefresh(true); }
    if (c && c !== (H.city || {}).name) hubSetCity(c); else if (!c && H.city) { delete H.city; save(); }
    renderHubMods();
  };
}

/* ---------- events ---------- */
function bindHub(v) {
  $('#hubCustom', v).onclick = () => { hubEdit = !hubEdit; go('hub', { keepFocus: true }); };
  $('#hubAdd', v).onclick = e => hubAddMenu(e.currentTarget);
  const t = $('#hubTable', v);
  t.addEventListener('click', e => {
    const g = e.target.closest('[data-hgo]'); if (g && !hubEdit) { go(g.dataset.hgo); return; }
    const dn = e.target.closest('[data-hdone]'); if (dn && !hubEdit) { const tk = taskById(dn.dataset.hdone); if (!tk) return; dn.classList.add('ticked'); setTimeout(() => { setTaskDone(tk, true); renderHubMods(); toast('Tâche terminée', { label: 'Annuler', run: () => { setTaskDone(tk, false); renderHubMods(); } }); }, 280); return; }
    const nw = e.target.closest('[data-hnew]'); if (nw && !hubEdit) { const d = newDoc(nw.dataset.hnew, { sp: nw.dataset.sp }); go('doc:' + d.id); return; }
    const ns = e.target.closest('[data-hnewsp]'); if (ns && !hubEdit) { askSpaceName(name => { createSpace(name, { stay: true }); go('hub'); }); return; }
    const mn = e.target.closest('[data-hmenu]'); if (mn) { projMenu(mn, hubMod(mn.dataset.hmenu)); return; }
    const rm = e.target.closest('[data-hrm]'); if (rm) { hubRemove(hubMod(rm.dataset.hrm)); return; }
    const sz = e.target.closest('[data-hsz]'); if (sz) { const m = hubMod(sz.closest('[data-hmod]').dataset.hmod); m.sz = sz.dataset.hsz; hubPlace(m, m.x, m.y); save(); renderHubMods(); return; }
    if (e.target.closest('[data-hmk]')) { hubNoteOut(); return; }
    const fl = e.target.closest('[data-hfile]'); if (fl) { openPop(fl, userSpaces().map(s => ({ label: s.name, dot: s.color, run: () => hubNoteOut(s.id) })).concat([{ label: DEF_NAME, icon: 'inbox', run: () => hubNoteOut(DEF_SPACE) }])); return; }
    const md = e.target.closest('.hm-cal, .hm-wx'); if (md && !e.target.closest('form, input')) hubOptions(md);
  });
  t.addEventListener('input', e => { if (e.target.matches('[data-hnote]')) { hubState().note = e.target.value; save(); } });
  t.addEventListener('submit', e => {
    e.preventDefault();
    const i = e.target.querySelector('input'), val = i && i.value.trim(); if (!val) return;
    if (e.target.matches('[data-hcity]')) hubSetCity(val);
    if (e.target.matches('[data-hadd]')) { newTask({ t: val, sp: DEF_SPACE }); renderHubMods(); renderSide(); const n = $('[data-hadd] input'); if (n) n.focus(); }
  });
  /* Custom mode: drag a module, it snaps to the grid; a free place is searched from where it is dropped */
  t.addEventListener('pointerdown', e => {
    if (!hubEdit || e.button > 0) return;
    const el = e.target.closest('[data-hmod]'); if (!el || e.target.closest('button, input, textarea, form')) return;
    const m = hubMod(el.dataset.hmod); if (!m) return;
    e.preventDefault(); el.setPointerCapture(e.pointerId);
    const phone = hubPhone(), r0 = el.getBoundingClientRect(), sx = e.clientX, sy = e.clientY, s = hubSize(m);
    const ghost = document.createElement('div'); ghost.className = 'hm-ghost';
    if (!phone) { ghost.style.cssText = `left:${m.x}px;top:${m.y}px;width:${s.w}px;height:${s.h}px`; t.append(ghost); }
    el.classList.add('dragging');
    let nx = m.x, ny = m.y, moved = false;
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy; if (!moved && Math.hypot(dx, dy) < 4) return; moved = true;
      el.style.transform = `translate(${dx}px,${dy}px)`;
      if (!phone) {
        const others = hubState().mods.filter(o => o !== m);
        const p = hubNear(m, others, Math.max(hubWidth(), m.x + dx + s.w), Math.max(0, m.x + dx), Math.max(0, m.y + dy));
        nx = p.x; ny = p.y; ghost.style.left = nx + 'px'; ghost.style.top = ny + 'px';
      }
    };
    const up = ev => {
      el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      ghost.remove(); el.classList.remove('dragging'); el.style.transform = '';
      if (!moved) return;
      if (phone) { // stacked: the order changes
        const list = hubState().mods.slice().sort((a, b) => (a.o ?? 0) - (b.o ?? 0)), y = ev.clientY;
        const rest = list.filter(o => o !== m); let at = rest.length;
        for (let i = 0; i < rest.length; i++) { const r = t.querySelector(`[data-hmod="${rest[i].id}"]`).getBoundingClientRect(); if (y < r.top + r.height / 2) { at = i; break; } }
        rest.splice(at, 0, m); rest.forEach((o, i) => o.o = i);
      } else { m.x = nx; m.y = ny; }
      save(); renderHubMods();
    };
    el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
  });
}
addEventListener('resize', debounce(() => { if (typeof R !== 'undefined' && R.name === 'hub') renderHubMods(); }, 200));
