/* ================= planning (iCal) =================
   A board block that rebuilds a timetable (PRONOTE or any iCal feed) as a horizontal timeline: days side by side,
   hours going down, one coloured block per lesson, holidays and days off as bands. It can be darkened (dim) and locked,
   so the board's pen, notes and arrows annotate on top of it.
   plan {title, src, ev:[[start, end, summary, room, flags, desc]], d0, d1, h0, h1, we:[weekdays shown], ck, cols{key:colour},
         dim 0..0.85, fs, v, at}
   start / end are local 'YYYY-MM-DDTHH:MM'; flags 1 = cancelled, 2 = all day. */

const PLAN_COLORS = ['#B83A8C', '#B5793F', '#7FB596', '#3E7A5E', '#5B7DB1', '#C25450', '#7A5BB0', '#2F8F8F', '#A68A2E', '#6B7A8F', '#D06A9A', '#4F9D69', '#C98A3D', '#3F5FA8'];
const ymd = d => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
const ymdhm = d => `${ymd(d)}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const dOf = s => { const [y, m, d] = s.slice(0, 10).split('-').map(Number); return new Date(y, m - 1, d); };
const minOf = s => s.length > 10 ? +s.slice(11, 13) * 60 + +s.slice(14, 16) : 0;
const dAdd = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/* ---------- iCal reading ---------- */
const icsText = v => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&').trim();
/* the labelled lines of a PRONOTE / HYPERPLANNING description: Matière, Promotion (or the class inside a TD's <...>), Salle, Type */
function icsMeta(desc) {
  const f = k => { const m = new RegExp('^' + k + '\\s*:\\s*(.+)$', 'mi').exec(desc); return m ? m[1].trim() : ''; };
  const td = f('TD'), p = f('Promotion') || f('Classe') || f('Groupe') || (/<([^>]+)>/.exec(td) || [])[1] || td, m = f('Mati[èe]re');
  if (!p && !m) return null;
  const o = { p, m, r: f('Salle'), y: f('Type') }; for (const k in o) if (!o[k]) delete o[k]; return o;
}
/* 'BRATLS 3D2' -> '3D2': the short code a teacher uses */
const planShort = p => { const t = String(p || '').trim().split(/\s+/); return t.length > 1 && t[t.length - 1].length <= 6 ? t[t.length - 1] : String(p || ''); };
/* the offset (ms) of a time zone at a given instant, through Intl; 0 if the zone is unknown */
function tzOffset(tz, t) {
  try {
    const p = {}; for (const x of new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).formatToParts(new Date(t))) p[x.type] = x.value;
    return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second) - t;
  } catch (e) { return null; }
}
/* an iCal date-time (20261103T080000Z, ...T080000 with or without TZID, or 20261103) as a local Date + all-day flag */
function icsDate(val, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?/.exec(val || ''); if (!m) return null;
  const [, Y, Mo, D, h, mi, se, z] = m, allDay = !h || /VALUE=DATE(?!-)/i.test(params || '');
  if (allDay) return { d: new Date(+Y, +Mo - 1, +D), allDay: true };
  const wall = Date.UTC(+Y, +Mo - 1, +D, +h, +mi, +(se || 0));
  if (z) return { d: new Date(wall) };
  const tz = /TZID="?([^;:"]+)/i.exec(params || '');
  if (tz) { const o1 = tzOffset(tz[1], wall); if (o1 != null) { const o2 = tzOffset(tz[1], wall - o1); return { d: new Date(wall - (o2 != null ? o2 : o1)) }; } }
  return { d: new Date(+Y, +Mo - 1, +D, +h, +mi, +(se || 0)) };   // floating time: the computer's own
}
const ICS_DAYS = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
/* the start dates of a repeating event (DAILY / WEEKLY with INTERVAL, COUNT, UNTIL, BYDAY; EXDATE removed) */
function icsRepeat(start, rule, ex) {
  const R = {}; for (const kv of rule.split(';')) { const [k, v] = kv.split('='); R[k] = v; }
  const iv = Math.max(1, +R.INTERVAL || 1), count = +R.COUNT || 0, until = R.UNTIL ? (icsDate(R.UNTIL) || {}).d : null;
  const cap = until || new Date(start.getFullYear() + 2, start.getMonth(), start.getDate()), out = [];
  const exs = new Set(ex.map(d => +d));
  const take = d => { if (d < start) return true; if (d > cap || (count && out.length >= count) || out.length > 3000) return false; if (!exs.has(+d)) out.push(d); return true; };
  const at = (base, n) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + n, start.getHours(), start.getMinutes());
  if (R.FREQ === 'DAILY') { for (let i = 0; take(at(start, i * iv)); i++); }
  else if (R.FREQ === 'WEEKLY') {
    const days = R.BYDAY ? R.BYDAY.split(',').map(s => ICS_DAYS[s.slice(-2)]).filter(n => n != null).sort() : [start.getDay()];
    const mon = at(start, -((start.getDay() + 6) % 7));
    for (let w = 0, go = true; go; w += iv) for (const wd of days.map(x => (x + 6) % 7).sort((a, b) => a - b)) { if (!take(at(mon, w * 7 + wd))) { go = false; break; } }
  } else return [start];
  return out;
}
function icsParse(text) {
  const lines = String(text || '').replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  if (!lines.some(l => /^BEGIN:VCALENDAR/i.test(l))) return null;
  const raw = []; let cur = null, name = '';
  for (const ln of lines) {
    if (/^BEGIN:VEVENT/i.test(ln)) { cur = { ex: [] }; continue; }
    if (/^END:VEVENT/i.test(ln)) { if (cur) raw.push(cur); cur = null; continue; }
    const m = /^([A-Za-z0-9-]+)((?:;[^:]*)?):(.*)$/.exec(ln); if (!m) continue;
    const k = m[1].toUpperCase();
    if (!cur) { if (k === 'X-WR-CALNAME') name = icsText(m[3]); continue; }
    if (k === 'EXDATE') { for (const v of m[3].split(',')) { const d = icsDate(v, m[2]); if (d) cur.ex.push(d.d); } continue; }
    if (k === 'RECURRENCE-ID') { cur.rid = icsDate(m[3], m[2]); continue; }
    cur[k] = { v: m[3], p: m[2] };
  }
  const ev = [], moved = new Set();
  for (const r of raw) if (r.rid && r.UID) moved.add(r.UID.v + '@' + +r.rid.d);
  for (const r of raw) {
    const s = r.DTSTART && icsDate(r.DTSTART.v, r.DTSTART.p); if (!s) continue;
    let e = r.DTEND && icsDate(r.DTEND.v, r.DTEND.p);
    const len = e ? e.d - s.d : s.allDay ? 864e5 : 36e5;
    const sum = icsText((r.SUMMARY || { v: '' }).v), room = icsText((r.LOCATION || { v: '' }).v), desc = icsText((r.DESCRIPTION || { v: '' }).v).slice(0, 400);
    const cancelled = /CANCELLED/i.test((r.STATUS || {}).v || '') || /\b(annul[ée]e?|cours annul)/i.test(sum) ? 1 : 0;
    const starts = r.RRULE && !r.rid ? icsRepeat(s.d, r.RRULE.v, r.ex) : [s.d];
    for (const st of starts) {
      if (r.RRULE && !r.rid && r.UID && moved.has(r.UID.v + '@' + +st)) continue;
      const en = new Date(+st + len);
      const meta = s.allDay ? null : icsMeta(desc), row = [s.allDay ? ymd(st) : ymdhm(st), s.allDay ? ymd(dAdd(en, -1)) : ymdhm(en), sum, (meta && meta.r) || room, cancelled | (s.allDay ? 2 : 0), desc];
      if (meta) row.push(meta);
      ev.push(row);
    }
  }
  ev.sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  return { name, ev };
}

/* ---------- French public holidays ---------- */
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, mo - 1, da);
}
const ferieCache = new Map();
function feries(y) {
  if (ferieCache.has(y)) return ferieCache.get(y);
  const E = easter(y), m = new Map([[`${y}-01-01`, 'Jour de l’an'], [`${y}-05-01`, 'Fête du travail'], [`${y}-05-08`, 'Victoire 1945'], [`${y}-07-14`, 'Fête nationale'], [`${y}-08-15`, 'Assomption'], [`${y}-11-01`, 'Toussaint'], [`${y}-11-11`, 'Armistice'], [`${y}-12-25`, 'Noël']]);
  m.set(ymd(dAdd(E, 1)), 'Lundi de Pâques'); m.set(ymd(dAdd(E, 39)), 'Ascension'); m.set(ymd(dAdd(E, 50)), 'Lundi de Pentecôte');
  ferieCache.set(y, m); return m;
}
const ferieOf = s => feries(+s.slice(0, 4)).get(s.slice(0, 10)) || '';

/* ---------- what the block shows ---------- */
const planParts = t => String(t || '').split(/\s+[-–]\s+/).map(s => s.trim()).filter(Boolean);
/* colour key of a lesson: with labelled descriptions ck is 'p' (class), 'm' (subject) or 'y' (type); otherwise a part of the title */
const planKey = (it, e) => { const M = e[6]; if (M && typeof it.ck === 'string') return (M[it.ck] || M.m || M.p || e[2] || '').toUpperCase(); const p = planParts(e[2]); return (p[Math.min(+it.ck || 0, p.length - 1)] || e[2] || '').toUpperCase(); };
const planColor = (it, key) => (it.cols && it.cols[key]) || PLAN_COLORS[Math.floor(hashStr(key) * PLAN_COLORS.length)];
/* the colour keys of a feed, most frequent first */
function planKeys(it) { const n = new Map(); for (const e of it.ev || []) if (!(e[4] & 2)) { const k = planKey(it, e); n.set(k, (n.get(k) || 0) + 1); } return [...n].sort((a, b) => b[1] - a[1]); }
/* each key without a colour gets the first colour of the palette not used yet (most frequent keys first), so no two match */
function planAssign(it) {
  const cols = Object.assign({}, it.cols), used = new Set(Object.values(cols));
  for (const [k] of planKeys(it)) if (!cols[k]) { const c = PLAN_COLORS.find(x => !used.has(x)) || PLAN_COLORS[Math.floor(hashStr(k + '#') * PLAN_COLORS.length)]; cols[k] = c; used.add(c); }
  return cols;
}
/* period, hours and weekdays read from the lessons themselves */
function planAuto(ev) {
  const lessons = ev.filter(e => !(e[4] & 2));
  if (!lessons.length) { const t = new Date(), m = dAdd(t, -((t.getDay() + 6) % 7)); return { d0: ymd(m), d1: ymd(dAdd(m, 4)), h0: 8, h1: 18, we: [1, 2, 3, 4, 5] }; }
  let a = 24 * 60, b = 0; const wd = new Set([1, 2, 3, 4, 5]);
  for (const e of lessons) { a = Math.min(a, minOf(e[0])); b = Math.max(b, e[1].slice(0, 10) > e[0].slice(0, 10) ? 24 * 60 : minOf(e[1])); wd.add(dOf(e[0]).getDay()); }
  const first = dOf(lessons[0][0]), lastK = ev.reduce((m, e) => { const k = (e[4] & 2 ? e[1] : e[0]).slice(0, 10); return k > m ? k : m; }, ''), last = dOf(lastK);
  return { d0: ymd(dAdd(first, -((first.getDay() + 6) % 7))), d1: ymd(last), h0: Math.max(0, Math.floor(a / 60)), h1: Math.min(24, Math.max(Math.floor(a / 60) + 1, Math.ceil(b / 60))), we: [...wd].sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)) };
}
function planDays(it) {
  const out = [], we = new Set(it.we || [1, 2, 3, 4, 5]); let d = dOf(it.d0); const end = dOf(it.d1 < it.d0 ? it.d0 : it.d1);
  for (let i = 0; d <= end && i < 1500; i++, d = dAdd(d, 1)) if (we.has(d.getDay())) out.push(d);
  return out.length ? out : [dOf(it.d0)];
}
function planGeom(it) {
  const fs = it.fs || 14, days = planDays(it), nh = Math.max(1, (it.h1 ?? 18) - (it.h0 ?? 8));
  const A = Math.round(fs * 2.6), bh = Math.round(fs * 1.15), wh = Math.round(fs * 1.35), dh = Math.round(fs * 1.35), H = bh + wh + dh;   // a compact header (0.2.29)
  return { fs, days, nh, A, bh, wh, dh, H, dw: Math.max(4, (it.w - A) / days.length), hh: Math.max(4, (it.h - H) / nh) };
}
const PLAN_DW = 9, PLAN_HH = 4.2;   // default day width and hour height, in units of the text size
function mkPlan(x, y, o) {
  const it = Object.assign({ id: uid('p'), k: 'plan', x, y, w: 0, h: 0, title: 'Planning', src: '', ev: [], ck: 0, cols: {}, dim: 0, fs: 14, v: 1 }, o);
  if (!it.d0) Object.assign(it, planAuto(it.ev));
  const g = planGeom(Object.assign({}, it, { w: 1, h: 1 }));
  it.w = Math.round(g.A + g.days.length * it.fs * PLAN_DW); it.h = Math.round(g.H + g.nh * it.fs * PLAN_HH);
  return it;
}
/* keeps the day width and hour height when the period or the hours change */
function planRefit(old, nx) {
  const g0 = planGeom(old), g1 = planGeom(Object.assign({}, nx, { w: 1, h: 1 }));
  return Object.assign(nx, { w: Math.round(g1.A + g1.days.length * g0.dw), h: Math.round(g1.H + g1.nh * g0.hh) });
}
/* weekdays with no lesson between lessons: holidays, drawn as one band per run of at least 3 shown days */
function planOff(it, days, byDay) {
  const out = [], first = (it.ev.find(e => !(e[4] & 2)) || [''])[0].slice(0, 10), last = ([...it.ev].reverse().find(e => !(e[4] & 2)) || [''])[0].slice(0, 10);
  let run = null;
  days.forEach((d, i) => { const k = ymd(d), empty = !(byDay.get(k) || []).some(e => !(e[4] & 1)) && k > first && k < last;
    if (empty) { if (run) run.b = i; else run = { a: i, b: i }; } else { if (run && run.b - run.a >= 2) out.push(run); run = null; } });
  if (run && run.b - run.a >= 2) out.push(run);
  return out;
}
const MONTHS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];
const WDAYS = ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'];
function isoWeek(d) { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y0 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return Math.ceil(((t - y0) / 864e5 + 1) / 7); }
const hm = s => s.length > 10 ? s.slice(11, 16).replace(':', 'h') : '';
function planHTML(it) {
  const g = planGeom(it), { fs, days, A, bh, wh, dh, H, dw, hh } = g, h0 = it.h0 ?? 8, h1 = it.h1 ?? 18, f = v => v.toFixed(1);
  const idx = new Map(days.map((d, i) => [ymd(d), i])), byDay = new Map();
  for (const e of it.ev || []) { if (e[4] & 2) continue; const k = e[0].slice(0, 10); if (!idx.has(k)) continue; (byDay.get(k) || byDay.set(k, []).get(k)).push(e); }
  const today = ymd(new Date()), out = [];
  const X = i => A + i * dw;
  const feedFer = new Map(), vac = [];   // the feed's own all-day days off: 'Férié' (school bridges too) and 'Vacances'
  for (const e of it.ev || []) if (e[4] & 2) { if (/f[ée]ri[ée]|pont/i.test(e[2])) for (let d = dOf(e[0]); ymd(d) <= e[1]; d = dAdd(d, 1)) feedFer.set(ymd(d), e[2]); else if (/vacances|cong[ée]s/i.test(e[2])) vac.push([e[0], e[1]]); }
  /* header: weeks (number + first day), days; bands for holidays and all-day events */
  let wk = null;
  const weekCell = (a, b, d) => out.push(`<div class="pl-wk" style="left:${f(X(a))}px;top:${bh}px;width:${f((b - a + 1) * dw)}px;height:${wh}px"><span>S${isoWeek(d)} · ${d.getDate()} ${MONTHS[d.getMonth()]}${a === 0 || d.getDate() <= 7 ? ` ${d.getFullYear()}` : ''}</span></div>`);
  days.forEach((d, i) => {
    const mon = ymd(dAdd(d, -((d.getDay() + 6) % 7)));
    if (!wk || wk.k !== mon) { if (wk) weekCell(wk.a, i - 1, wk.d); wk = { k: mon, a: i, d }; }
    const k = ymd(d), fer = ferieOf(k) || feedFer.get(k) || '', cls = (fer ? ' fer' : '') + (k === today ? ' now' : '') + (wk.a === i ? ' w0' : '');
    out.push(`<div class="pl-day${cls}" style="left:${f(X(i))}px;width:${f(dw)}px"${fer ? ` title="${esc(fer)}"` : ''}>${fer ? `<i class="pl-fer" style="font-size:${f(Math.min(dw / 4.2, fs * 1.3))}px"><b>Férié</b><b>Férié</b><b>Férié</b></i>` : ''}</div>`);
    out.push(`<div class="pl-dh${cls}" style="left:${f(X(i))}px;top:${bh + wh}px;width:${f(dw)}px;height:${dh}px"><span>${WDAYS[d.getDay()]} ${d.getDate()}</span></div>`);
  });
  if (wk) weekCell(wk.a, days.length - 1, wk.d);
  for (const r of planOff(it, days, byDay)) if (!vac.some(v => ymd(days[r.b]) >= v[0] && ymd(days[r.a]) <= v[1])) out.push(`<div class="pl-off" style="left:${f(X(r.a))}px;width:${f((r.b - r.a + 1) * dw)}px;top:${f(bh * .12)}px;height:${f(bh * .76)}px"><span>OFF · vacances</span></div><div class="pl-offc" style="left:${f(X(r.a))}px;width:${f((r.b - r.a + 1) * dw)}px;top:${H}px"></div>`);
  for (const e of it.ev || []) if (e[4] & 2 && !/f[ée]ri[ée]|pont/i.test(e[2])) {   // all-day events from the feed (holidays, trips...): a band in the top row
    let a = -1, b = -1; days.forEach((d, i) => { const k = ymd(d); if (k >= e[0].slice(0, 10) && k <= e[1].slice(0, 10)) { if (a < 0) a = i; b = i; } });
    const off = /vacances|cong[ée]s/i.test(e[2]);
    if (a >= 0) out.push(`<div class="pl-off${off ? '' : ' ev'}" style="left:${f(X(a))}px;width:${f((b - a + 1) * dw)}px;top:${f(bh * .12)}px;height:${f(bh * .76)}px" title="${esc(e[2])}"><span>${off ? 'OFF · ' : ''}${esc(e[2])}</span></div>` + (off ? `<div class="pl-offc" style="left:${f(X(a))}px;width:${f((b - a + 1) * dw)}px;top:${H}px"></div>` : ''));
  }
  /* hours on the left */
  for (let h = h0; h <= h1; h++) out.push(`<div class="pl-hr" style="top:${f(H + (h - h0) * hh)}px;width:${A}px"><span>${h}h</span></div>`);
  /* lessons: overlapping ones share the column */
  const efs = Math.max(7, Math.min(fs * 1.45, dw / 4.4, hh / 1.75));
  for (const [k, list] of byDay) {
    const i = idx.get(k); list.sort((a, b) => a[0] < b[0] ? -1 : 1);
    let group = [], end = '';
    const flush = () => { const lanes = []; for (const e of group) { let l = lanes.findIndex(x => x <= e[0]); if (l < 0) { l = lanes.length; lanes.push(''); } lanes[l] = e[1]; e._l = l; } for (const e of group) e._n = lanes.length; };
    for (const e of list) { if (group.length && e[0] >= end) { flush(); group = []; end = ''; } group.push(e); if (e[1] > end) end = e[1]; }
    flush();
    for (const e of list) {
      const m0 = Math.max(h0 * 60, minOf(e[0])), m1 = Math.min(h1 * 60, e[1].slice(0, 10) > k ? 24 * 60 : minOf(e[1])); if (m1 <= m0) continue;
      const pw = dw - 3, lw = pw / e._n, x = X(i) + 1.5 + e._l * lw, y = H + (m0 / 60 - h0) * hh + 1, h = (m1 - m0) / 60 * hh - 2;
      const key = planKey(it, e), col = planColor(it, key), M = e[6], parts = planParts(e[2]);
      let main, rest;
      if (M && typeof it.ck === 'string') { main = M.p ? planShort(M.p) : M.m || e[2]; rest = M.p ? M.m || '' : ''; if (M.y && !/^cours$/i.test(M.y)) rest += (rest ? ' · ' : '') + M.y; }
      else { main = parts[Math.min(+it.ck || 0, parts.length - 1)] || e[2] || 'Cours'; rest = parts.filter(p => p !== main).join(' · '); }
      const tip = `${e[2]}\n${WDAYS[dOf(k).getDay()]} ${dOf(k).getDate()} ${MONTHS[dOf(k).getMonth()]} · ${hm(e[0])} – ${hm(e[1])}${e[3] ? '\nSalle : ' + e[3] : ''}${e[4] & 1 ? '\nAnnulé' : ''}${e[5] ? '\n\n' + e[5] : ''}`;
      out.push(`<div class="pl-ev${e[4] & 1 ? ' x' : ''}" style="left:${f(x)}px;top:${f(y)}px;width:${f(Math.max(2, lw - 2))}px;height:${f(Math.max(2, h))}px;--pc:${col};font-size:${f(efs)}px" title="${esc(tip)}"><b>${esc(main)}</b>${rest ? `<span>${esc(rest)}</span>` : ''}<small>${hm(e[0])}${e[3] ? ' · ' + esc(e[3]) : ''}</small></div>`);
    }
  }
  const nowD = idx.get(today);
  if (nowD != null) { const n = new Date(), m = n.getHours() * 60 + n.getMinutes(); if (m >= h0 * 60 && m <= h1 * 60) out.push(`<div class="pl-now" style="left:${f(X(nowD))}px;width:${f(dw)}px;top:${f(H + (m / 60 - h0) * hh)}px"></div>`); }
  return `<div class="pl-in" style="--pfs:${fs}px;--phh:${f(hh)}px;--pH:${H}px;--pA:${A}px"><div class="pl-ttl" style="width:${A}px;height:${H}px"><b>${esc(it.title || 'Planning')}</b></div>${out.join('')}</div>${it.dim ? `<div class="pl-dim" style="opacity:${it.dim}"></div>` : ''}`;
}
/* a small made-up timetable (ten weeks around today, one week off) to try the block without a link */
function planSample() {
  const t = new Date(), mon = dAdd(t, -((t.getDay() + 6) % 7) - 21), C = ['3D4 - Modélisation 3D', '3D3 - Sculpt', '3D2 - LookDev', '3D1 - Anatomie', 'Labo R&D - Atelier IA'], R = ['B12', 'B14', 'Labo', 'A03'];
  const dt = (d, h, m) => `${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}T${pad2(h)}${pad2(m)}00`;
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//PLUM//exemple//FR', 'X-WR-CALNAME:Planning (exemple)'];
  let n = 0;
  for (let w = 0; w < 10; w++) {
    if (w === 4) continue;   // the holidays
    for (let wd = 0; wd < 5; wd++) {
      const d = dAdd(mon, w * 7 + wd), seed = hashStr(ymd(d));
      if (seed < .15) continue;
      const slots = [[8, 30, 10, 30], [10, 45, 12, 45], [14, 0, 16, 0], [16, 15, 17, 45]].filter((s, i) => hashStr(ymd(d) + i) > .35);
      for (const s of slots) { const c = C[Math.floor(hashStr(ymd(d) + s[0]) * C.length)];
        L.push('BEGIN:VEVENT', `UID:ex${n++}@plum`, `DTSTART;TZID=Europe/Paris:${dt(d, s[0], s[1])}`, `DTEND;TZID=Europe/Paris:${dt(d, s[2], s[3])}`, `SUMMARY:${c}`, `LOCATION:${R[n % R.length]}`, ...(hashStr(c + n) < .04 ? ['STATUS:CANCELLED'] : []), 'END:VEVENT'); }
    }
  }
  L.push('END:VCALENDAR');
  return L.join('\r\n');
}
