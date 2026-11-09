/* ================= HUB (0.2.34, Creative Cloud layout) =================
   Top: Quick Start icons. Then « Projets en cours »: full Project Cards in a row you scroll by click-drag,
   or, folded with the arrow next to the title, small capsules. Then Récents. On the right: today's planning
   and the Moodboard Général (a tray for anything dropped, filed into a project later).
   Project Card: cover image, main colour with two shades derived from it, pinned note, two tasks, a small « Board ↗ ».
   S.hub (synced as meta:hub): { fold, sideFold (right panel reduced to a thin rail, 0.2.35), off: [space ids hidden from the HUB], note, city, ics }. */
const hubPhone = () => innerWidth < 700;
function hubState() {
  const H = S.hub || (S.hub = {});
  if (!Array.isArray(H.off)) H.off = [];
  if (typeof H.note !== 'string') H.note = '';
  return H;
}
const projRecent = sp => Math.max(sp.created || 0, ...S.docs.filter(d => d.sp === sp.id && !d.trash).map(d => d.updated || 0), ...S.tasks.filter(t => t.sp === sp.id).map(t => t.created || 0));
const hubProjects = () => userSpaces().filter(s => !hubState().off.includes(s.id)).sort((a, b) => projRecent(b) - projRecent(a));
const stripHtml = h => { const t = document.createElement('div'); t.innerHTML = h || ''; return (t.textContent || '').replace(/\s+/g, ' ').trim(); };

//COLOURS
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


//CAL
/* events of the day: the HUB's own iCal link, else the planning blocks of the boards */
let hubCalBusy = false;
function hubEvents() {
  const day = ymd(new Date()), C = S.prefs.hubCal;
  let ev = C && C.ev ? C.ev : [];
  if (!ev.length) for (const d of liveDocs()) for (const it of d.items || []) if (it.k === 'plan' && it.ev) ev = ev.concat(it.ev);
  const seen = new Set();
  return ev.filter(e => !(e[4] & 1) && String(e[0]).slice(0, 10) === day && !seen.has(e[0] + e[2]) && seen.add(e[0] + e[2])).sort((a, b) => a[0] < b[0] ? -1 : 1);
}
const calSrcs = H => [H.ics, H.gcal, H.gapps].filter(Boolean);
async function hubCalRefresh(force) {
  const H = hubState(), C = S.prefs.hubCal, key = calSrcs(H).join(' ');
  if (!key || hubCalBusy || (!force && C && C.src === key && Date.now() - C.at < 3600e3)) return;
  hubCalBusy = true;
  try {
    const mon = weekStart(new Date()), from = ymd(dAdd(mon, -1)), to = ymd(dAdd(mon, 15));
    let ev = [], okN = 0;
    let cals = null, gwhy = '';
    if (H.gapps) {   // the whole Google account, through the user's own Apps Script (see gappsSetup)
      const r = await Net.ics(gappsUrl(H)); const g = r && r.ok ? gappsParse(r.text, from, to) : null;
      if (g) { okN++; cals = g.cals; ev = ev.concat(g.ev); }
      else if (force) gwhy = gappsWhy(r);
    }
    for (const [k, u] of [['p', H.ics], ['g', H.gcal]]) {
      if (!u) continue;
      const r = await Net.ics(u); const pr = r && r.ok ? icsParse(r.text) : null; if (!pr) continue;
      okN++; ev = ev.concat(pr.ev.filter(e => String(e[0]).slice(0, 10) >= from && String(e[0]).slice(0, 10) <= to).map(e => e.slice(0, 5).concat(k)));
    }
    if (okN) { S.prefs.hubCal = { src: key, at: Date.now(), ev, cals }; save(); if (R.name === 'hub') renderHubMods(); }
    if (gwhy) toast(gwhy, 10000);
    else if (force && !okN) toast(DESKTOP ? 'Ce lien ne donne pas de calendrier.' : 'Ce lien ne se lit que dans l’app Windows ou iPad.');
  } finally { hubCalBusy = false; }
}
const weekStart = d => dAdd(d, -((d.getDay() + 6) % 7));
/* the week strip above the project cards (0.2.54): Monday to Sunday, today stands out; Google Agenda + PRONOTE */
function weekEvents() {
  const C = S.prefs.hubCal; let ev = C && C.ev ? C.ev : [];
  if (!ev.length) for (const d of liveDocs()) for (const it of d.items || []) if (it.k === 'plan' && it.ev) ev = ev.concat(it.ev);
  const seen = new Set();
  const off = hubState().gcalOff || [];
  return ev.filter(e => !(e[4] & 1) && !(e[6] && off.includes(e[6])) && !seen.has(e[0] + e[2] + (e[6] || '')) && seen.add(e[0] + e[2] + (e[6] || ''))).sort((a, b) => a[0] < b[0] ? -1 : 1);
}
const gcalColor = id => { const C = S.prefs.hubCal, c = C && C.cals && C.cals.find(x => x.id === id); return c && c.c || '#4285F4'; };
/* ---------- the whole Google Agenda (0.2.58): every calendar of the account through a small Apps Script the user
   deploys once from their own Google account (no Google Cloud project, works on PC and iPad). It answers a text
   that starts like a calendar (so the app's calendar fetch accepts it) with one JSON line per calendar and event. ---------- */
function gappsKey(H) { if (!H.gkey) { H.gkey = Array.from(crypto.getRandomValues(new Uint8Array(12)), b => b.toString(16).padStart(2, '0')).join(''); save(); } return H.gkey; }
const gappsUrl = H => H.gapps + (H.gapps.includes('?') ? '&' : '?') + 'k=' + gappsKey(H);
const gappsScript = key => `// PLUM · tout Google Agenda dans le HUB
// Colle ce code dans script.google.com, puis Déployer > Nouveau déploiement > Application Web
// (Exécuter en tant que : moi · Accès : tout le monde). Copie l'URL /exec dans PLUM.
var KEY = '${key}';
function doGet(e) {
  if (!e || !e.parameter || e.parameter.k !== KEY) return ContentService.createTextOutput('BEGIN:VCALENDAR\\nEND:VCALENDAR');
  var now = new Date(), from = new Date(now.getTime() - 10 * 864e5), to = new Date(now.getTime() + 30 * 864e5);
  var out = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PLUM//Google Agenda//FR'];
  CalendarApp.getAllCalendars().forEach(function (c) {
    try {
      out.push('X-PLUM-CAL:' + JSON.stringify({ id: c.getId(), n: c.getName(), c: c.getColor(), h: c.isHidden() }));
      c.getEvents(from, to).forEach(function (ev) {
        out.push('X-PLUM-EV:' + JSON.stringify({ c: c.getId(), s: ev.getStartTime().getTime(), e: ev.getEndTime().getTime(), t: ev.getTitle(), a: ev.isAllDayEvent() ? 1 : 0, l: ev.getLocation() || '' }));
      });
    } catch (err) { out.push('X-PLUM-ERR:' + JSON.stringify({ c: String(c.getId ? c.getId() : ''), m: String(err) })); }
  });
  out.push('END:VCALENDAR');
  return ContentService.createTextOutput(out.join('\\n')).setMimeType(ContentService.MimeType.TEXT);
}`;
function gappsParse(text, from, to) {
  if (!/X-PLUM-/.test(text)) return null;
  const cals = [], ev = [], loc = ms => ymdhm(new Date(ms));
  for (const ln of text.split(/\r?\n/)) {
    try {
      if (ln.startsWith('X-PLUM-CAL:')) { const c = JSON.parse(ln.slice(11)); cals.push({ id: c.id, n: c.n, c: c.c, h: !!c.h }); }
      else if (ln.startsWith('X-PLUM-EV:')) { const x = JSON.parse(ln.slice(10)), s0 = loc(x.s); if (s0.slice(0, 10) < from || s0.slice(0, 10) > to) continue; ev.push([x.a ? s0.slice(0, 10) + 'T00:00' : s0, x.a ? s0.slice(0, 10) + 'T23:59' : loc(x.e), x.t || '(sans titre)', x.l || '', x.a ? 2 : 0, 'g', x.c]); }
    } catch (e) {}
  }
  return { cals, ev };
}
/* why the script gave nothing, in words the user can act on (the Windows app sends back the page it got) */
function gappsWhy(r) {
  const h = String((r && r.head) || ''), host = String((r && r.host) || '');
  if (!r) return 'Google Agenda : pas de réponse.';
  if (r.ok) return 'Google Agenda : le script répond, mais pas avec le code PLUM. Recopie le code puis fais une nouvelle version du déploiement.';
  if (/abort/i.test(r.error || '')) return 'Google Agenda : le script a mis plus d’une minute à répondre. Réessaie dans un instant.';
  if (r.status === 401 || r.status === 403) return 'Google Agenda : le script refuse l’accès (erreur ' + r.status + '). Dans Apps Script : Déployer › Gérer les déploiements › crayon › « Accès » = Tout le monde (pas « Tout utilisateur avec un compte Google »), Version = Nouvelle version, puis Déployer.';
  if (r.status) return `Google Agenda : le script répond « erreur ${r.status} ». Vérifie que l’URL finit bien par /exec.`;
  if (/accounts\.google/.test(host) || /connexion|sign in|se connecter|login/i.test(h)) return 'Google Agenda : Google demande une connexion. Dans Déployer › Gérer les déploiements, mets « Accès : Tout le monde » (pas « tout utilisateur disposant d’un compte Google »), puis Déployer.';
  if (/autoris|authoriz/i.test(h)) return 'Google Agenda : le script n’a pas encore l’autorisation Agenda. Dans Apps Script, clique Exécuter une fois et accepte, puis réessaie.';
  if (/erreur|error|exception/i.test(h)) return 'Google Agenda : le script a une erreur (' + h.trim().slice(0, 140) + '). Recopie le code de PLUM, puis Gérer les déploiements › Modifier › Nouvelle version.';
  return 'Google Agenda : la réponse n’est pas un agenda. ' + (h ? '(« ' + h.trim().slice(0, 100) + ' »)' : '');
}
function gappsSetup() {
  const H = hubState(), code = gappsScript(gappsKey(H));
  openModal(`<div class="mhd"><h2>Tout Google Agenda dans le HUB</h2><button class="tb" data-close aria-label="Fermer">${icon('x')}</button></div>
    <ol class="ga-steps"><li>Ouvre <b>script.google.com</b> avec ton compte Google, puis <b>Nouveau projet</b>.</li>
      <li>Remplace tout le code par celui-ci : <button class="btn sm" id="gaCopy">${icon('dup', 'sm')}Copier le code</button></li>
      <li><b>Déployer › Nouveau déploiement › Application Web</b>. Exécuter en tant que : <b>moi</b>. Accès : <b>tout le monde</b>. Accepte l’autorisation Agenda.</li>
      <li>Colle ici l’URL qui finit par <b>/exec</b> :</li></ol>
    <input id="gaUrl" class="mw-name" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(H.gapps || '')}" autocomplete="off" spellcheck="false">
    <p class="ga-note">Tous tes agendas arrivent d’un coup ; tu choisis ensuite ceux à afficher dans le réglage de la semaine. Le code contient une clé à toi : sans elle, le lien ne renvoie rien.</p>
    <div style="display:flex;gap:8px;justify-content:flex-end;margin-top:12px">${H.gapps ? '<button class="btn ghost danger" id="gaOff">Déconnecter</button><span style="flex:1"></span>' : ''}<button class="btn ghost" data-close>Annuler</button><button class="btn pri" id="gaOk">Connecter</button></div>`,
    m => {
      $('#gaCopy', m).onclick = () => { try { navigator.clipboard.writeText(code).then(() => toast('Code copié'), () => toast('Copie impossible')); } catch (e) { toast('Copie impossible'); } };
      const off = $('#gaOff', m); if (off) off.onclick = () => { delete H.gapps; delete S.prefs.hubCal; save(); closeModal(); hubCalRefresh(true); renderHubMods(); };
      $('#gaOk', m).onclick = () => { const u = $('#gaUrl', m).value.trim(); if (!/^https:\/\/script\.google(usercontent)?\.com\//.test(u)) { toast('Colle l’URL /exec de ton script'); return; } H.gapps = u.replace(/\?.*$/, ''); delete S.prefs.hubCal; save(); closeModal(); toast('Google Agenda connecté, chargement…'); hubCalRefresh(true); };
    });
}
function weekSettings(anchor) {
  const H = hubState(), cals = (S.prefs.hubCal && S.prefs.hubCal.cals) || [], off = H.gcalOff || [];
  const p = openPop(anchor, `<div class="wks"><div class="mh">Affichage</div>
    <div class="wks-seg"><button data-wkm="0" aria-pressed="${!H.wkBox}">${icon('list', 'sm')}Lignes</button><button data-wkm="1" aria-pressed="${!!H.wkBox}">${icon('rect', 'sm')}Blocs</button></div>
    ${cals.length ? `<div class="mh">Agendas Google</div><div class="wks-cals">${cals.map(c => `<label class="wks-cal"><input type="checkbox" data-gcal="${esc(c.id)}"${off.includes(c.id) ? '' : ' checked'}><i style="background:${esc(c.c || '#4285F4')}"></i><span>${esc(c.n)}</span></label>`).join('')}</div>` : ''}
    <div class="msep"></div><button class="mi" data-gapps>${icon('cal')}<span>${H.gapps ? 'Compte Google Agenda…' : 'Connecter tout Google Agenda…'}</span></button></div>`, { align: 'right', cls: 'wksw' });
  p.addEventListener('click', e => {
    const m = e.target.closest('[data-wkm]'); if (m) { H.wkBox = m.dataset.wkm === '1'; save(); $$('[data-wkm]', p).forEach(b => b.setAttribute('aria-pressed', b === m)); renderHubMods(); return; }
    if (e.target.closest('[data-gapps]')) { closePop(); gappsSetup(); }
  });
  p.addEventListener('change', e => { const c = e.target.closest('[data-gcal]'); if (!c) return; const id = c.dataset.gcal; H.gcalOff = (H.gcalOff || []).filter(x => x !== id); if (!c.checked) H.gcalOff.push(id); save(); renderHubMods(); });
}
const WK_MAX = DESKTOP ? 5 : 3;
function weekMod() {
  const H = hubState(), mon = weekStart(new Date()), today = ymd(new Date()), now = ymdhm(new Date()), ev = weekEvents();
  const lab = e => (e[2] || '').split(/\s+[-–]\s+/)[0];
  const col = e => e[6] ? gcalColor(e[6]) : e[5] === 'g' ? '#4285F4' : PLAN_COLORS[Math.floor(hashStr(lab(e).toUpperCase()) * PLAN_COLORS.length)];
  const days = Array.from({ length: 7 }, (_, i) => dAdd(mon, i)).map(d => {
    const k = ymd(d), list = ev.filter(e => String(e[0]).slice(0, 10) === k), past = k < today;
    return `<div class="wk-d${k === today ? ' today' : ''}${past ? ' past' : ''}"><div class="wk-h"><span>${d.toLocaleDateString('fr-FR', { weekday: 'short' }).replace('.', '')}</span><b>${d.getDate()}</b>${list.length > WK_MAX ? `<small class="wk-more">+${list.length - WK_MAX}</small>` : ''}</div>
      <div class="wk-l">${list.slice(0, WK_MAX).map(e => `<div class="wk-e${e[1] <= now ? ' done' : ''}" style="--c:${col(e)}" title="${esc(lab(e))}${e[3] ? ' · ' + esc(e[3]) : ''}"><i></i><span>${e[4] & 2 ? '' : `<em>${e[0].slice(11, 16)}</em>`}${esc(lab(e))}</span></div>`).join('')}</div></div>`;
  }).join('');
  const mon2 = mon.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long' });
  return `<div class="wk-top"><span class="lab">Semaine du ${mon2}</span>${calSrcs(H).length ? '' : `<button class="wk-link" data-gapps>${icon('cal', 'sm')}Connecter Google Agenda</button>`}<button class="wk-set" data-wkset title="Affichage de la semaine" aria-label="Affichage de la semaine">${icon('sliders', 'sm')}</button></div><div class="wk-g${H.wkBox ? ' box' : ''}">${days}</div>`;
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

//WX
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

//MOOD
/* ---------- Moodboard Général: the moodboard of « Non classées », a tray for anything dropped; ⇢ files it into a project ---------- */
const moodHost = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
const moodExt = n => (/\.([a-z0-9]{1,5})$/i.exec(n || '') || [, 'fichier'])[1].slice(0, 4).toUpperCase();
const moodList = () => ((spaceById(DEF_SPACE) || {}).media || []).filter(m => m.type === 'link' || m.type === 'text' || Assets.has(m.asset));
function moodTile(m) {
  const mv = `<button class="hmd-mv" data-hmv="${m.id}" title="Ranger dans un projet" aria-label="Ranger dans un projet">${icon('folder', 'sm')}</button>`;
  const a = `class="hmd-it hmd-${m.type}" data-hmi="${m.id}" draggable="true"`;
  if (m.type === 'image') return `<figure ${a}><img src="${Assets.url(m.asset)}" alt="${esc(m.name || '')}" loading="lazy" draggable="false"${m.w && m.h ? ` style="aspect-ratio:${m.w}/${m.h}"` : ''}>${mv}</figure>`;
  if (m.type === 'link') { const h = moodHost(m.url), pic = m.pic && Assets.has(m.pic) ? Assets.url(m.pic) : '';
    return `<figure ${a} title="${esc(m.url)}">${pic ? `<img src="${pic}" alt="" loading="lazy" draggable="false">` : `<span class="hmd-ini" style="--c:${SPACE_COLORS[Math.floor(hashStr(h) * SPACE_COLORS.length)]}">${esc((h[0] || '?').toUpperCase())}</span>`}<figcaption><b>${esc(m.title || h)}</b><small>${icon('link', 'sm')}${esc(m.site || h)}</small></figcaption>${mv}</figure>`; }
  if (m.type === 'file') { const e = moodExt(m.name); return `<figure ${a}><div class="hmd-fh"><span class="hmd-ext">${esc(e)}</span><b>${esc(m.name || 'Fichier')}</b></div>${m.snip ? `<pre>${esc(m.snip)}</pre>` : `<small>${m.size ? fmtSize(m.size) : ''}</small>`}${mv}</figure>`; }
  if (m.type === 'text') return `<figure ${a}><p>${esc(m.txt).replace(/\n/g, '<br>')}</p>${mv}</figure>`;
  return '';
}
function moodMod(m) {
  const list = moodList(), n = m.sz === 'S' ? 6 : m.sz === 'M' ? 14 : 30;
  return `<div class="hm-h"><span class="lab">Moodboard · Général</span><small>${list.length || ''}</small><button class="hmd-add" data-hmadd title="Ajouter des fichiers" aria-label="Ajouter des fichiers">${icon('plus', 'sm')}</button></div>
    <div class="hmd-wall">${list.slice(0, n).map(moodTile).join('') || `<div class="hmd-empty">${icon('upload')}<b>Dépose ici</b><small>Un lien depuis Chrome (ArtStation…), une image, un .txt, n’importe quel fichier. Tu le rangeras dans un projet ensuite.</small></div>`}</div>
    ${list.length > n ? `<button class="hmd-more" data-hgo="space:${DEF_SPACE}">Voir les ${list.length} éléments</button>` : ''}
    <div class="hmd-over">${icon('upload')}Déposer dans le Moodboard Général</div>`;
}
/* move one element from the Général tray to a project's moodboard */
function moodFile(id, spId) {
  const from = spaceById(DEF_SPACE), to = spaceById(spId); if (!from || !to || spId === DEF_SPACE) return;
  const k = (from.media || []).findIndex(x => x.id === id); if (k < 0) return;
  const [m] = from.media.splice(k, 1); (to.media = to.media || []).unshift(m); save(); renderHubMods(); renderSide();
  toast(`Rangé dans le moodboard de ${to.name}`, { label: 'Annuler', run: () => { const j = to.media.indexOf(m); if (j >= 0) to.media.splice(j, 1); from.media.splice(k, 0, m); save(); renderHubMods(); renderSide(); } });
}
/* right-click (or long press on touch, through contextmenu) on a Général tile: file it, copy the link, delete with undo */
function moodItemMenu(tile, id) {
  const sp = spaceById(DEF_SPACE), m = sp && (sp.media || []).find(x => x.id === id); if (!m) return;
  const del = () => { const k = sp.media.indexOf(m); if (k < 0) return; sp.media.splice(k, 1); save(); renderHubMods(); renderSide();
    toast('Supprimé du moodboard', { label: 'Annuler', run: () => { sp.media.splice(Math.min(k, sp.media.length), 0, m); save(); renderHubMods(); renderSide(); } }); };
  openPop(tile, [
    { label: 'Ranger dans un projet…', icon: 'folder', run: () => setTimeout(() => moodFileMenu(tile, id), 0) },
    ...(m.url ? [{ label: 'Copier le lien', icon: 'link', run: () => { try { navigator.clipboard.writeText(m.url); toast('Lien copié'); } catch (e) {} } }] : []),
    '-',
    { label: 'Supprimer', icon: 'trash', danger: true, run: del }
  ], { align: 'right' });
}
function moodFileMenu(anchor, id) {
  const sps = userSpaces();
  if (!sps.length) { toast('Crée d’abord un projet'); return; }
  openPop(anchor, [{ head: 'Ranger dans' }, ...sps.map(s => ({ label: s.name, dot: s.color, run: () => moodFile(id, s.id) }))], { align: 'right' });
}
/* previews: a link gets its page's title and picture, a text file its first lines (once, saved in the element) */
let moodBusy = false;
async function moodUnfurl() {
  if (moodBusy) return; moodBusy = true;
  try {
    for (const m of moodList()) {
      if (m.pv) continue;
      if (m.type === 'link') {
        const r = await Net.meta(m.url);
        if (r) {
          if (r.title && !m.title) m.title = String(r.title).trim().slice(0, 140);
          if (r.site) m.site = String(r.site).slice(0, 60);
          const src = r.isImage ? m.url : r.image;
          if (src) { const b = await Net.blob(src); if (b && /^image\//.test(b.type) && b.size > 120) { try { const t = await importImage(b, 720); m.pic = t.id; } catch (e) {} } }
        }
      } else if (m.type === 'file' && (/^text\//.test(m.mime || '') || /\.(txt|md|csv|json|js|py|log)$/i.test(m.name || ''))) {
        const b = Assets.blobs.get(m.asset); if (b && b.size < 2e6) { try { m.snip = (await b.text()).slice(0, 400); } catch (e) {} }
      }
      m.pv = 1; save(); if (R.name === 'hub') renderHubMods();
    }
  } finally { moodBusy = false; }
}

/* weather icon next to « Bonjour » (0.2.54): real weather when a city is set, else a placeholder that changes each day */
const WX_SVG = {
  sun: '<circle cx="12" cy="12" r="4.6" fill="#FFC53D"/><g stroke="#FFC53D" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></g>',
  part: '<circle cx="9" cy="9" r="4" fill="#FFC53D"/><g stroke="#FFC53D" stroke-width="1.8" stroke-linecap="round"><path d="M9 1.8v1.8M1.8 9h1.8M3.9 3.9l1.3 1.3M14.1 3.9l-1.3 1.3"/></g><path d="M8 20h10.5a3.5 3.5 0 0 0 .3-7 5 5 0 0 0-9.6 1.1A3 3 0 0 0 8 20z" fill="#D9DEE6"/>',
  cloud: '<path d="M6.5 19h11a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.3A3.4 3.4 0 0 0 6.5 19z" fill="#C3CAD5"/>',
  rain: '<path d="M6.5 15h11a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.3A3.4 3.4 0 0 0 6.5 15z" fill="#C3CAD5"/><g stroke="#5AA9FF" stroke-width="2" stroke-linecap="round"><path d="M8 18l-1 3M12.5 18l-1 3M17 18l-1 3"/></g>',
  snow: '<path d="M6.5 15h11a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.3A3.4 3.4 0 0 0 6.5 15z" fill="#C3CAD5"/><g fill="#E8F1FF"><circle cx="8" cy="19.5" r="1.3"/><circle cx="12.5" cy="20.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/></g>',
  storm: '<path d="M6.5 14h11a4 4 0 0 0 .4-8 5.6 5.6 0 0 0-10.8 1.3A3.4 3.4 0 0 0 6.5 14z" fill="#9AA3B2"/><path d="M12.5 14l-3 5h3l-1.5 4 4.5-6h-3l1.5-3z" fill="#FFC53D"/>'
};
const WX_LAB = { sun: 'Ensoleillé', part: 'Éclaircies', cloud: 'Nuageux', rain: 'Pluie', snow: 'Neige', storm: 'Orage' };
function wxKind(c) { if (c <= 1) return 'sun'; if (c === 2) return 'part'; if (c === 3 || c === 45 || c === 48) return 'cloud'; if (c >= 95) return 'storm'; if ((c >= 71 && c <= 77) || c === 85 || c === 86) return 'snow'; return 'rain'; }
function hubWxIcon() {
  const W = S.prefs.hubWx, real = hubState().city && W && W.d;
  const kinds = Object.keys(WX_SVG), k = real ? wxKind(W.c) : kinds[Math.floor(hashStr(ymd(new Date())) * kinds.length)];
  const t = real ? `${Math.round(W.t)}°` : '';
  return `<button class="hub-wx" data-hopts title="${WX_LAB[k]}${real ? ' à ' + esc(hubState().city.name) : ' (météo à connecter : choisis ta ville dans Personnaliser)'}"><svg viewBox="0 0 24 24" aria-hidden="true">${WX_SVG[k]}</svg>${t ? `<b>${t}</b>` : ''}</button>`;
}

//COLOR
function projColor(anchor, sp) {
  const cols = themeColors('space', SPACE_COLORS);
  const p = openPop(anchor, `<div class="pc-cols">${cols.map(c => `<button data-c="${c}" style="--c:${c}" aria-label="${c}"${c === sp.color ? ' aria-pressed="true"' : ''}></button>`).join('')}<label class="pc-any" title="Autre couleur"><input type="color" value="${/^#[0-9a-f]{6}$/i.test(sp.color) ? sp.color : '#888888'}" aria-label="Autre couleur"></label></div><small class="pc-colhint">La 2e et la 3e couleur du projet en sont tirées.</small>`, { align: 'right' });
  const set = c => { sp.color = c; save(); renderHubMods(); renderSide(); };
  p.onclick = e => { const b = e.target.closest('[data-c]'); if (b) { set(b.dataset.c); closePop(); } };
  $('input', p).oninput = e => set(e.target.value);
}

//NOTEOUT
function hubNoteOut(spId) {
  const H = hubState(), txt = H.note.trim(); if (!txt) { toast('La note du HUB est vide'); return; }
  const lines = txt.split('\n'), title = lines[0].slice(0, 80), body = lines.slice(1).join('\n').trim();
  const d = newDoc('note', { title, html: (body || '').split('\n').map(l => `<p>${esc(l) || '<br>'}</p>`).join(''), sp: spId || DEF_SPACE });
  H.note = ''; save(); renderHubMods();
  toast(spId && spId !== DEF_SPACE ? `Note rangée dans ${spaceById(spId).name}` : 'Note créée', { label: 'Ouvrir', run: () => go('doc:' + d.id) });
}

/* ---------- Project Card (0.2.53, HUB v2) ----------
   cover + letter tile + name, then the PAGE's Synthèse (fixed 5 lines) and its main tasks (fixed 5 rows), so every card
   has the same height. Bottom: + note, + board, + tâche (typed right in the card), progress, ↗ opens the PAGE. */
const PC_ROWS = 5;
function projCard(sp, o = {}) {
  const pal = projPal(sp.color), pg = pageOf(sp), st = projStats(sp), cov = sp.cover && Assets.url(sp.cover);
  const when = Math.max(projRecent(sp), pg ? pg.updated || 0 : 0);
  const meta = [plural(st.nN, 'note'), plural(st.nB, 'board'), plural(st.nT, 'tâche')].join(' · ');
  const ini = esc(((sp.name || '?').trim()[0] || '?').toUpperCase());
  const syn = (pg && pg.synth || '').trim();
  const tks = mainTasks(sp, o.adding ? PC_ROWS - 1 : PC_ROWS);
  const row = t => `<button class="pc2-tk${t.done ? ' done' : ''}" data-htk="${t.id}" role="checkbox" aria-checked="${t.done}"><i class="pc2-bx">${icon('check', 'sm')}</i><span>${esc(t.t)}</span></button>`;
  const btn = (k, ic, l) => `<button class="pc2-b" data-hnew="${k}" data-sp="${sp.id}" title="${l}" aria-label="${l}">${icon(ic)}<i>+</i></button>`;
  return `<article class="pc2" data-hproj="${sp.id}" style="--pc1:${pal.c1};--pc2:${pal.c2};--pc3:${pal.c3}">
    <div class="pc2-cov${cov ? ' img' : ''}" data-hgo="doc:${pg ? pg.id : ''}">${cov ? `<img src="${cov}" alt="" draggable="false">` : ''}
      <button class="pc2-menu" data-hmenu="${sp.id}" aria-label="Options de ${esc(sp.name)}">${icon('dots', 'sm')}</button>
      <div class="pc2-id"><span class="pc2-tile">${ini}</span><div><b>${esc(sp.name)}</b><small>${meta} · ${ago(when)}</small></div></div></div>
    <div class="pc2-body">
      <button class="pc2-syn${syn ? '' : ' empty'}" data-hsyn="${sp.id}" title="Ouvrir la PAGE du projet"><p>${syn ? esc(syn) : 'Écrire la synthèse du projet…'}</p></button>
      <div class="pc2-tks">${o.adding ? taskAddHTML({ cls: 'pc2-add', ph: 'Nouvelle tâche' }) : ''}${tks.map(row).join('')}${!tks.length && !o.adding ? `<button class="pc2-tkempty" data-hnew="task" data-sp="${sp.id}">${icon('plus', 'sm')}Ajouter une tâche principale</button>` : ''}</div>
    </div>
    <div class="pc2-foot">${btn('note', 'note', 'Nouvelle note dans ce projet')}${btn('board', 'board', 'Nouveau board dans ce projet')}${btn('task', 'tasks', 'Nouvelle tâche dans ce projet')}
      <div class="pc2-prog" title="${st.nD} tâche${st.nD > 1 ? 's' : ''} faite${st.nD > 1 ? 's' : ''} sur ${st.nT}"><span><i style="width:${st.pct}%"></i></span><small>${st.nD} / ${st.nT}</small></div>
      <button class="pc2-open" data-hgo="doc:${pg ? pg.id : ''}" title="Ouvrir la PAGE du projet" aria-label="Ouvrir la PAGE du projet">${icon('ext', 'sm')}</button></div>
  </article>`;
}
/* + tâche on a card: a line opens at the top of its task box; Enter adds (starred, so it shows on the card) */
function cardTaskAdd(spId) {
  const el = $(`.pc2[data-hproj="${spId}"]`), sp = spaceById(spId); if (!el || !sp) return;
  const tpl = document.createElement('div'); tpl.innerHTML = projCard(sp, { adding: true }); const nx = tpl.firstElementChild; el.replaceWith(nx);
  const close = () => { const c = $(`.pc2[data-hproj="${spId}"]`); if (c) { const t2 = document.createElement('div'); t2.innerHTML = projCard(sp); c.replaceWith(t2.firstElementChild); } };
  const box = $('.pc2-add', nx), inp = $('[data-tkin]', box);
  bindTaskAdd(box, spId, { close, added: () => { renderSide(); cardTaskAdd(spId); } });
  inp.addEventListener('blur', () => setTimeout(() => { const c = $(`.pc2[data-hproj="${spId}"] .pc2-add`); if (c && !c.contains(document.activeElement) && !$('[data-tkin]', c).value.trim()) close(); }, 150));
  inp.focus();
}
function projCap(sp) {
  const pal = projPal(sp.color), n = S.tasks.filter(t => t.sp === sp.id && !t.done).length, cov = sp.cover && Assets.url(sp.cover);
  const ini = esc(((sp.name || '?').trim().slice(0, 2) || '?').replace(/^./, c => c.toUpperCase()));
  return `<button class="hcap" data-hgo="space:${sp.id}" data-hproj="${sp.id}" style="--pc1:${pal.c1};--pc2:${pal.c2};--pc3:${pal.c3}"><span class="hcap-i">${cov ? `<img src="${cov}" alt="" draggable="false">` : ini}</span><b>${esc(sp.name)}</b><small>${n ? `${n} tâche${n > 1 ? 's' : ''}` : 'à jour'}</small></button>`;
}
function recentTile(d) {
  const sp = spaceById(d.sp), board = d.type === 'board';
  return `<button class="hrec" data-hgo="doc:${d.id}"><span class="hrec-th">${Thumbs.svg(d)}<i class="hrec-tag${board ? ' b' : ''}">${board ? 'Board' : 'Note'}</i></span><b>${esc(d.title)}</b><small><i style="background:${sp && sp.id !== DEF_SPACE ? sp.color : 'var(--ink-3)'}"></i>${esc(sp ? sp.name : DEF_NAME)} · ${ago(d.updated)}</small></button>`;
}

/* ---------- Créer (0.2.53): Note, Board, Tâche, Moodboard « dans » the last project used (S.prefs.hubDest) ---------- */
const QS = [['note', 'note', 'Note'], ['board', 'board', 'Board'], ['task', 'tasks', 'Tâche'], ['mood', 'image', 'Moodboard']];
const QS_MORE = [['plan', 'cal', 'Planning'], ['draw', 'pencil', 'Dessin'], ['hnote', 'pin', 'Note du HUB'], ['proj', 'plus', 'Nouveau projet']];
function hubDest() {
  let id = S.prefs.hubDest;
  if (!spaceById(id)) { const l = hubProjects(); id = l.length ? l[0].id : DEF_SPACE; }
  return spaceById(id);
}
function destMenu(anchor) {
  const cur = hubDest(), list = userSpaces();
  const row = s => { const cov = s.cover && Assets.url(s.cover); return `<button class="dm-it${s.id === cur.id ? ' on' : ''}" data-dest="${s.id}"><span class="dm-th" style="--pc1:${s.color}">${cov ? `<img src="${cov}" alt="">` : esc(((s.name || '?').trim()[0] || '?').toUpperCase())}</span><span>${esc(s.name)}</span>${s.id === cur.id ? icon('check', 'sm') : ''}</button>`; };
  const p = openPop(anchor, `<div class="dm"><div class="mh">Ranger dans</div>${list.map(row).join('')}<div class="msep"></div><button class="dm-it${cur.id === DEF_SPACE ? ' on' : ''}" data-dest="${DEF_SPACE}"><span class="dm-th none">${icon('inbox', 'sm')}</span><span>${DEF_NAME}</span>${cur.id === DEF_SPACE ? icon('check', 'sm') : ''}</button><button class="dm-it" data-dnew><span class="dm-th none">${icon('plus', 'sm')}</span><span>Nouveau projet…</span></button></div>`, { align: 'right', cls: 'dmw' });
  p.onclick = e => {
    const b = e.target.closest('[data-dest]'); if (b) { S.prefs.hubDest = b.dataset.dest; save(); closePop(); renderCreate(); return; }
    if (e.target.closest('[data-dnew]')) { closePop(); askSpaceName(name => { const sp = createSpace(name, { stay: true }); S.prefs.hubDest = sp.id; save(); go('hub'); }); }
  };
}
function createHTML() {
  const d = hubDest(), def = d.id === DEF_SPACE;
  return `<span class="hc-l">Créer</span>${QS.map(([k, ic, l]) => `<button class="hc-b" data-qs="${k}">${icon(ic)}<span>${l}</span></button>`).join('')}<button class="hc-b more" data-qmore aria-label="Autres créations" title="Planning, dessin, note du HUB, projet">${icon('dots')}</button><span class="hc-sep"></span><button class="hc-dest" data-hdest title="Où ranger ce que tu crées">${def ? icon('inbox', 'sm') : `<i style="background:${d.color}"></i>`}<span>dans ${esc(d.name)}</span>${icon('chevd', 'sm')}</button>`;
}
function renderCreate() { const c = $('#hubCreate'); if (c) c.innerHTML = createHTML(); }
function quickStart(k, btn) {
  const dest = hubDest().id;
  if (k === 'note' || k === 'board' || k === 'mood') createIn(k, dest);
  else if (k === 'task') quickTaskPop(btn, dest);
  else if (k === 'plan') { const H = hubState(); const d = newDoc('board', { title: 'Planning', sp: dest, items: [mkPlan(0, 0, H.ics ? { src: H.ics } : {})] }); go('doc:' + d.id); if (!H.ics) toast('Ajoute ton lien iCal (PRONOTE) dans le bloc Planning'); }
  else if (k === 'draw') { const d = newDoc('board', { title: 'Dessin', sp: dest }); go('doc:' + d.id); setTimeout(() => { try { Board.setTool('pen'); } catch (e) {} }, 120); }
  else if (k === 'hnote') hubNotePop(btn);
  else if (k === 'proj') askSpaceName(name => { const sp = createSpace(name, { stay: true }); S.prefs.hubDest = sp.id; save(); go('hub'); });
}
function hubNotePop(anchor) {
  const H = hubState();
  const p = openPop(anchor, `<div class="hn-pop"><div class="hm-h"><span class="lab">Note du HUB</span><small>un brouillon, sans choisir de projet</small></div><textarea class="hn-ta" data-hnote placeholder="Écris ici…" aria-label="Note du HUB">${esc(H.note)}</textarea><div class="hn-acts"><button class="btn sm" data-hfile>Ranger dans un projet</button><button class="btn sm pri" data-hmk>En faire une note</button></div></div>`, { cls: 'hn-popw' });
  const ta = $('textarea', p); ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length);
  ta.oninput = () => { H.note = ta.value; save(); };
  $('[data-hmk]', p).onclick = () => { closePop(); hubNoteOut(); };
  $('[data-hfile]', p).onclick = e => openPop(e.currentTarget, userSpaces().map(s => ({ label: s.name, dot: s.color, run: () => hubNoteOut(s.id) })).concat([{ label: DEF_NAME, icon: 'inbox', run: () => hubNoteOut(DEF_SPACE) }]));
}

/* ---------- the page ---------- */
let hubScroll = 0;
function renderHub(v) {
  const H = hubState(), d = new Date(), date = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const W = S.prefs.hubWx, wxs = H.city && W && W.d ? ` · ${Math.round(W.t)}° à ${esc(H.city.name)}` : '';
  const nEv = hubEvents().length, name = (S.prefs.name || '').trim();
  ensurePages();
  v.innerHTML = `<div class="hubpage cc hub2">
    <div class="hub2-top${hubCovOn() ? ' own' : ''}"${hubCovOn() ? ` style="--hub-cov:url('${Assets.url(hubState().cov)}')"` : ''}><button class="hub-covbtn" data-hcov title="Changer la couverture" aria-label="Changer la couverture">${icon('image', 'sm')}<span>Couverture</span></button><div class="hub-hello"><span>${date.charAt(0).toUpperCase() + date.slice(1)}${wxs}${nEv ? ` · ${nEv} évènement${nEv > 1 ? 's' : ''} aujourd’hui` : ''}</span><div class="hub-hi">${DESKTOP ? `<span id="hubWx">${hubWxIcon()}</span>` : ''}<h1>${name ? `Bonjour ${esc(name)}` : 'Bonjour'}</h1>${DESKTOP ? '' : `<span id="hubWx">${hubWxIcon()}</span>`}</div></div>
      <div class="hub2-create" id="hubCreate" role="toolbar" aria-label="Créer">${createHTML()}</div></div>
    <div class="hub-main${H.sideFold ? ' side-off' : ''}">
      <div class="hub-col">
        <section class="hub-week" id="hubWeek"></section>
        <section class="hub-sec" id="hubProj"></section>
      </div>
      <aside class="hub-side"><button class="hub-sfold" data-hsfold aria-expanded="${!H.sideFold}" aria-label="${H.sideFold ? 'Ouvrir le panneau' : 'Réduire le panneau'}" title="${H.sideFold ? 'Ouvrir Aujourd’hui et le Moodboard' : 'Réduire le panneau'}">${icon('chev', 'sm')}</button><button class="hub-srail" data-hsfold aria-hidden="true" tabindex="-1"><span>Moodboard</span></button><section class="hmod hm-cal" id="hubCal"></section><section class="hmod hm-mood" id="hubMood"></section></aside>
    </div></div>`;
  renderHubMods();
  bindHub(v);
  hubCalRefresh(); hubWxRefresh();
}
function renderHubMods() {
  const pj = $('#hubProj'); if (!pj) return;
  const H = hubState(), list = hubProjects(), fold = !!H.fold;
  pj.innerHTML = `<div class="h2">Projets en cours<button class="hub-fold" data-hfold aria-expanded="${!fold}" aria-label="${fold ? 'Déplier les cartes' : 'Replier en capsules'}" title="${fold ? 'Déplier' : 'Replier'}">${icon('chev', 'sm')}</button><small>${list.length ? `${list.length} projet${list.length > 1 ? 's' : ''} · la carte montre la synthèse de la PAGE` : ''}</small><button class="more" data-hopts>Personnaliser</button></div>
    ${!list.length ? `<button class="hub-empty" data-qs="proj">${icon('plus')}Crée ton premier projet</button>`
      : fold ? `<div class="hub-caps">${list.map(projCap).join('')}<button class="hcap add" data-qs="proj"><span class="hcap-i">${icon('plus')}</span><b>Nouveau projet</b></button></div>`
      : `<div class="hub-rowwrap hub2-wrap"><div class="hub-row hub2-row">${list.map(p => projCard(p)).join('')}<button class="pc2 add" data-qs="proj"><span class="pc2-addi">${icon('plus', 'lg')}</span><b>Nouveau projet</b><small>Un nom, une couleur, une image. Sa PAGE est créée avec lui.</small></button></div></div>`}`;
  const r2 = $('.hub2-row', pj); if (r2) { r2.scrollLeft = hubScroll; hubRowEdges(r2); }
  renderCreate();
  const wk = $('#hubWeek'); if (wk) wk.innerHTML = weekMod();
  const wx = $('#hubWx'); if (wx) wx.innerHTML = hubWxIcon();
  $('#hubCal').innerHTML = calMod({ sz: 'M' });
  const mo = $('#hubMood'), ta = document.activeElement;
  if (!(ta && mo.contains(ta) && ta.matches('input'))) mo.innerHTML = moodMod({ sz: 'M' });
  if (moodList().some(x => !x.pv)) moodUnfurl();
}
/* the fade at an edge shows there is more to scroll */
function hubRowEdges(r) { const w = r.parentElement; w.classList.toggle('more-r', r.scrollLeft + r.clientWidth < r.scrollWidth - 4); w.classList.toggle('more-l', r.scrollLeft > 4); }
function projMenu(anchor, sp) {
  if (!sp) return;
  const imgs = spaceMedia(sp.id).filter(x => x.asset && (x.type === 'image' || /^image\//.test(x.mime || '')) && Assets.has(x.asset)).slice(0, 8);
  const pickFile = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const im = await importImage(f, 1600); sp.cover = im.id; save(); renderHubMods(); } catch (e) { toast('Image illisible'); } }; i.click(); };
  openPop(anchor, [
    { label: 'Ouvrir le projet', icon: 'folder', run: () => go('space:' + sp.id) },
    { label: 'Couverture : choisir une image…', icon: 'image', run: pickFile },
    ...imgs.map(x => ({ label: 'Couverture du moodboard', icon: 'image', small: x.name || '', run: () => { sp.cover = x.asset; save(); renderHubMods(); } })),
    ...(sp.cover ? [{ label: 'Retirer la couverture', icon: 'x', run: () => { delete sp.cover; save(); renderHubMods(); } }] : []),
    { label: 'Couleur principale…', icon: 'palette', run: () => projColor(anchor, sp) },
    '-',
    { label: 'Masquer du HUB', icon: 'x', danger: true, run: () => { const H = hubState(); H.off.push(sp.id); save(); renderHubMods(); toast(`${sp.name} masqué du HUB`, { label: 'Annuler', run: () => { H.off = H.off.filter(x => x !== sp.id); save(); renderHubMods(); } }); } }
  ], { align: 'right' });
}
/* the HUB head's cover (themes that paint one, Sommet and Minimal Sommet): the theme's picture by default, or the
   user's own (hubState().cov = an asset id, synced with the HUB) */
const hubCovOn = () => { const c = hubState().cov; return !!(c && Assets.has(c)); };
function hubCovMenu(anchor) {
  const H = hubState(), set = id => { if (id) H.cov = id; else delete H.cov; save(); if (R.name === 'hub') go('hub', { keepFocus: true }); };
  const imgs = (S.media || []).concat(...userSpaces().map(sp => spaceMedia(sp.id))).filter(x => x && x.asset && (x.type === 'image' || /^image\//.test(x.mime || '')) && Assets.has(x.asset)).slice(0, 6);
  const pick = () => { const i = document.createElement('input'); i.type = 'file'; i.accept = 'image/*'; i.onchange = async () => { const f = i.files[0]; if (!f) return; try { const im = await importImage(f, 2000); set(im.id); } catch (e) { toast('Image illisible'); } }; i.click(); };
  openPop(anchor, [
    { head: 'Couverture du HUB' },
    { label: 'Choisir une image…', icon: 'image', run: pick },
    ...imgs.map(x => ({ label: 'Image du moodboard', icon: 'image', small: x.name || '', run: () => set(x.asset) })),
    ...(H.cov ? ['-', { label: 'Remettre l’image du thème', icon: 'restore', run: () => set(null) }] : [])
  ], { align: 'right' });
}
function hubOptions(anchor) {
  const H = hubState(), hidden = userSpaces().filter(s => H.off.includes(s.id));
  const p = openPop(anchor, `<div class="hub-opts"><label><span>Ville pour la météo</span><input id="hoCity" value="${esc((H.city || {}).name || '')}" placeholder="Ta ville" autocomplete="off"></label>
    <div class="ho-ga"><span>Google Agenda</span><button class="btn sm" data-gapps type="button">${icon('cal', 'sm')}${H.gapps ? 'Compte connecté · gérer' : 'Connecter tout le compte'}</button></div>
    <label><span>Lien iCal du planning (PRONOTE…)</span><input id="hoIcs" value="${esc(H.ics || '')}" placeholder="https://… .ics" autocomplete="off" spellcheck="false"></label>
    ${hidden.length ? `<div class="ho-hid"><span>Projets masqués</span>${hidden.map(s => `<button class="btn sm" data-show="${s.id}"><i class="sdot" style="background:${s.color}"></i>${esc(s.name)}</button>`).join('')}</div>` : ''}
    <div style="display:flex;justify-content:flex-end"><button class="btn sm pri" id="hoOk">Enregistrer</button></div></div>`, { align: 'right' });
  p.addEventListener('click', e => { if (e.target.closest('[data-gapps]')) { closePop(); gappsSetup(); return; } const b = e.target.closest('[data-show]'); if (b) { H.off = H.off.filter(x => x !== b.dataset.show); save(); b.remove(); renderHubMods(); } });
  $('#hoOk', p).onclick = () => {
    const c = $('#hoCity', p).value.trim(), i = $('#hoIcs', p).value.trim(); closePop();
    if (i !== (H.ics || '')) { H.ics = i; delete S.prefs.hubCal; save(); hubCalRefresh(true); }
    if (c && c !== (H.city || {}).name) hubSetCity(c); else if (!c && H.city) { delete H.city; save(); }
    go('hub', { keepFocus: true });
  };
}

/* ---------- events ---------- */
function bindHub(v) {
  const root = $('.hubpage', v);
  let dragged = 0;
  root.addEventListener('click', e => {
    if (Date.now() - dragged < 250) { e.preventDefault(); e.stopPropagation(); return; }
    const qs = e.target.closest('[data-qs]'); if (qs) { quickStart(qs.dataset.qs, qs); return; }
    if (e.target.closest('[data-hsfold]')) { const H = hubState(); H.sideFold = !H.sideFold; save(); const m = $('.hub-main', root), b = $('.hub-sfold', root); m.classList.toggle('side-off', H.sideFold); b.setAttribute('aria-expanded', !H.sideFold); b.title = H.sideFold ? 'Ouvrir Aujourd’hui et le Moodboard' : 'Réduire le panneau'; b.setAttribute('aria-label', H.sideFold ? 'Ouvrir le panneau' : 'Réduire le panneau'); return; }
    if (e.target.closest('[data-hfold]')) { const H = hubState(); H.fold = !H.fold; save(); renderHubMods(); return; }
    if (e.target.closest('[data-hopts]')) { hubOptions(e.target.closest('[data-hopts]')); return; }
    const mv = e.target.closest('[data-hmv]'); if (mv) { moodFileMenu(mv, mv.dataset.hmv); return; }
    if (e.target.closest('[data-hmadd]')) { const i = $('#fileIn'); i.accept = ''; i.onchange = async () => { const f = [...i.files]; i.value = ''; if (f.length && (await addMedia(DEF_SPACE, f)).length) { renderHubMods(); renderSide(); } }; i.click(); return; }
    const mi = e.target.closest('[data-hmi]'); if (mi) { const it = moodList().find(x => x.id === mi.dataset.hmi); if (it) Mood.view(it); return; }
    const mn = e.target.closest('[data-hmenu]'); if (mn) { projMenu(mn, spaceById(mn.dataset.hmenu)); return; }
    const dn = e.target.closest('[data-hdone]'); if (dn) { const tk = taskById(dn.dataset.hdone); if (!tk) return; dn.classList.add('ticked'); setTimeout(() => { setTaskDone(tk, true); renderHubMods(); renderSide(); toast('Tâche terminée', { label: 'Annuler', run: () => { setTaskDone(tk, false); renderHubMods(); renderSide(); } }); }, 280); return; }
    const ws = e.target.closest('[data-wkset]'); if (ws) { weekSettings(ws); return; }
    const hc = e.target.closest('[data-hcov]'); if (hc) { hubCovMenu(hc); return; }
    if (e.target.closest('[data-gapps]')) { gappsSetup(); return; }
    if (e.target.closest('[data-hdest]')) { destMenu(e.target.closest('[data-hdest]')); return; }
    if (e.target.closest('[data-qmore]')) { const b = e.target.closest('[data-qmore]'); openPop(b, QS_MORE.map(([k, ic, l]) => ({ label: l, icon: ic, run: () => quickStart(k, b) })), { align: 'right' }); return; }
    if (e.target.closest('.pc2-add')) return;
    const nw = e.target.closest('[data-hnew]'); if (nw) { const sp = nw.dataset.sp; S.prefs.hubDest = sp; save(); if (nw.dataset.hnew === 'task') cardTaskAdd(sp); else createIn(nw.dataset.hnew, sp); return; }
    const tk = e.target.closest('[data-htk]'); if (tk) { const t = taskById(tk.dataset.htk); if (!t) return; const v = !t.done; tk.classList.toggle('done', v); tk.setAttribute('aria-checked', v); setTimeout(() => { setTaskDone(t, v); if (v) toast('Tâche terminée', { label: 'Annuler', run: () => setTaskDone(t, false) }); }, 220); return; }
    const sy = e.target.closest('[data-hsyn]'); if (sy) { const pg = pageOf(spaceById(sy.dataset.hsyn)); if (pg) { go('doc:' + pg.id); setTimeout(() => { const ta = $('#ppage [data-psyn]'); if (ta && !pg.synth) ta.focus(); }, 80); } return; }
    const g = e.target.closest('[data-hgo]'); if (g) { go(g.dataset.hgo); return; }
    if (e.target.closest('#hubCal')) hubOptions(e.target.closest('#hubCal'));
  }, true);
  /* a row of cards: click and drag to scroll it (mouse); fingers and trackpads scroll it natively */
  root.addEventListener('pointerdown', e => {
    const row = e.target.closest('.hub-row'); if (!row || e.pointerType !== 'mouse' || e.button !== 0 || row.scrollWidth <= row.clientWidth) return;
    const x0 = e.clientX, s0 = row.scrollLeft; let moved = false;
    const mv = ev => { const dx = ev.clientX - x0; if (!moved && Math.abs(dx) < 6) return; if (!moved) { moved = true; row.classList.add('grabbing'); try { row.setPointerCapture(e.pointerId); } catch (er) {} } row.scrollLeft = s0 - dx; };
    const up = () => { row.removeEventListener('pointermove', mv); row.removeEventListener('pointerup', up); row.removeEventListener('pointercancel', up); row.classList.remove('grabbing'); if (moved) dragged = Date.now(); };
    row.addEventListener('pointermove', mv); row.addEventListener('pointerup', up); row.addEventListener('pointercancel', up);
  });
  root.addEventListener('scroll', e => { if (e.target.classList && e.target.classList.contains('hub-row')) { hubRowEdges(e.target); if (e.target.closest('#hubProj')) hubScroll = e.target.scrollLeft; } }, true);
  root.addEventListener('dragstart', e => { if (e.target.closest && e.target.closest('.hub-row') && !e.target.closest('[data-hmi]')) e.preventDefault(); });
  /* the Moodboard Général: tiles dragged onto a project (card or capsule) are filed there; links or files dropped on a project go to it */
  const MT = 'application/x-plum-mood';
  root.addEventListener('contextmenu', e => { const it = e.target.closest && e.target.closest('[data-hmi]'); if (!it) return; e.preventDefault(); moodItemMenu(it, it.dataset.hmi); });
  root.addEventListener('dragstart', e => { const it = e.target.closest && e.target.closest('[data-hmi]'); if (!it) return; e.dataTransfer.setData(MT, it.dataset.hmi); const m = moodList().find(x => x.id === it.dataset.hmi); if (m && m.url) e.dataTransfer.setData('text/uri-list', m.url); e.dataTransfer.effectAllowed = 'copyMove'; it.classList.add('dragging'); root.classList.add('hmd-dragging'); });
  root.addEventListener('dragend', () => { root.classList.remove('hmd-dragging'); $$('.dragging, .hdrop', root).forEach(x => x.classList.remove('dragging', 'hdrop')); });
  const projAt = e => e.target.closest && e.target.closest('[data-hproj]');
  root.addEventListener('dragover', e => {
    const ty = [...(e.dataTransfer.types || [])], pj = projAt(e), md = e.target.closest && e.target.closest('#hubMood');
    $$('.hdrop', root).forEach(x => { if (x !== pj && x !== md) x.classList.remove('hdrop'); });
    if (pj && (ty.includes(MT) || ty.some(x => x === 'Files' || x === 'text/uri-list' || x === 'text/plain'))) { e.preventDefault(); e.stopPropagation(); e.dataTransfer.dropEffect = ty.includes(MT) ? 'move' : 'copy'; pj.classList.add('hdrop'); }
    else if (md && !ty.includes(MT)) md.classList.add('hdrop');
  });
  root.addEventListener('dragleave', e => { const c = e.target.closest && e.target.closest('.hdrop'); if (c && !c.contains(e.relatedTarget)) c.classList.remove('hdrop'); });
  root.addEventListener('drop', async e => {
    $$('.hdrop', root).forEach(x => x.classList.remove('hdrop'));
    const pj = projAt(e); if (!pj) return;
    e.preventDefault(); e.stopPropagation();
    const id = e.dataTransfer.getData(MT); if (id) { moodFile(id, pj.dataset.hproj); return; }
    const sp = spaceById(pj.dataset.hproj); if (sp) { await Mood.drop(e.dataTransfer, sp); renderHubMods(); }
  });
}
