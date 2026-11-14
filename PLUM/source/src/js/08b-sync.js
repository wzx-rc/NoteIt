/* ================= synchronisation between devices (Supabase), 0.2.31 =================
   For one person and their devices (PC, iPad, iPhone). Local first: IndexedDB stays the copy each device works on,
   the cloud only carries changes. One row per thing in table plum_items (kind + id + a JSON document), so the
   workspace format can keep changing without a database migration:
     space:<id>  doc:<id> (without its per-device board view)  task:<id>
     meta:order  order of spaces, docs and tasks + taskOrder
     asset:<id>  a dropped file; the bytes are in the private Storage bucket "plum" under <user id>/<asset id>
   Last write wins per row: each device remembers what it last sent or received (a hash per row, localStorage),
   so it knows what changed here; the server keeps the row with the newest updated_at (trigger in supabase.sql).
   Changes arrive by Realtime (one websocket), with a pull every minute and on focus as a fallback.
   Everything goes through plain fetch (no supabase-js): auth, PostgREST and Storage REST. */
const Sync = (() => {
  const CFG = 'plum.sync', SNAP = 'plum.sync.snap', DIRTY = 'plum.sync.dirty', TABLE = 'plum_items', BUCKET = 'plum', TOPIC = 'realtime:plum-sync';
  const MAX_ASSET = 45e6, PAGE = 80, CHUNK = 1.5e6;
  const ls = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };
  let cfg = ls.get(CFG, null);          // { url, key, email, sess: { at, rt, exp, uid }, cursor, done }
  let snap = ls.get(SNAP, {});          // 'kind:id' -> { h, t, del? }: what the cloud and this device last agreed on
  let dirty = ls.get(DIRTY, {});        // 'kind:id' -> when this device first changed it since
  let state = 'off', lastOk = 0, lastErr = '', busy = false, again = false, timer = 0, firstWait = 0, applying = false;
  const deferred = new Map(), badAsset = new Set();
  const listeners = new Set();
  const active = () => !!(cfg && cfg.url && cfg.key && cfg.sess && cfg.sess.rt);
  const saveCfg = () => ls.set(CFG, cfg);
  const saveMeta = () => { ls.set(SNAP, snap); ls.set(DIRTY, dirty); saveCfg(); };
  const setState = s => { state = s; listeners.forEach(f => { try { f(); } catch (e) {} }); };

  /* stable JSON (sorted keys): the database gives keys back in its own order */
  function canon(v) {
    if (v === null || v === undefined || typeof v === 'function') return 'null';
    if (typeof v !== 'object') return JSON.stringify(v) ?? 'null';
    if (typeof v.toJSON === 'function') return canon(v.toJSON());
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).filter(k => v[k] !== undefined && typeof v[k] !== 'function').sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  function hash(s) {
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36) + '.' + s.length.toString(36);
  }
  const devId = () => { let v = ''; try { v = localStorage.getItem('plum.devid') || ''; if (!v) { v = uid('dv'); localStorage.setItem('plum.devid', v); } } catch (e) { v = 'dv-mem'; } return v; };
  const split = k => { const i = k.indexOf(':'); return [k.slice(0, i), k.slice(i + 1)]; };
  const payload = (kind, o) => { if (kind !== 'doc' || !('view' in o)) return o; const { view, ...rest } = o; return rest; };
  function entities() {
    const m = new Map();
    for (const s of S.spaces) m.set('space:' + s.id, payload('space', s));
    for (const d of S.docs) m.set('doc:' + d.id, payload('doc', d));
    for (const t of S.tasks) m.set('task:' + t.id, t);
    m.set('meta:order', { spaces: S.spaces.map(s => s.id), docs: S.docs.map(d => d.id), tasks: S.tasks.map(t => t.id), taskOrder: S.prefs.taskOrder || [] });
    if (S.hub) m.set('meta:hub', S.hub);
    /* 0.3.24: the colours of the PC (light / dark, tint, accent) reach the iPhone. Each PC writes its own row (meta:look.<device>);
       the rows of the other devices are kept as received, so this device never deletes nor rewrites them */
    for (const [id, x] of Object.entries(S.prefs.looksIn || {})) if (id !== devId()) m.set('meta:look.' + id, x.data);
    if (DESKTOP) { const sk = S.prefs.skin; m.set('meta:look.' + devId(), { theme: S.prefs.theme || 'auto', skin: sk, look: (S.prefs.look && S.prefs.look[sk]) || {} }); }
    return m;
  }
  /* what changed on this device since the last agreement with the cloud */
  function scan(now = Date.now()) {
    const cur = new Map();
    for (const [k, data] of entities()) {
      const h = hash(canon(data)); cur.set(k, { h, data });
      if (snap[k] && !snap[k].del && snap[k].h === h) delete dirty[k];
      else if (!dirty[k]) dirty[k] = now;
    }
    for (const k in snap) if (!k.startsWith('asset:') && !cur.has(k)) { if (snap[k].del) delete dirty[k]; else if (!dirty[k]) dirty[k] = now; }
    for (const k in dirty) if (!k.startsWith('asset:') && !cur.has(k) && !snap[k]) delete dirty[k];
    return cur;
  }

  /* ---------- auth and requests ---------- */
  const sessOf = j => ({ at: j.access_token, rt: j.refresh_token, exp: Date.now() + (j.expires_in || 3600) * 1000, uid: j.user && j.user.id });
  const errOf = (j, r) => j.error_description || j.msg || j.message || j.error || ('HTTP ' + r.status);
  let refreshing = null;
  async function refresh() {
    if (refreshing) return refreshing;
    refreshing = (async () => {
      const r = await fetch(cfg.url + '/auth/v1/token?grant_type=refresh_token', { method: 'POST', headers: { apikey: cfg.key, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh_token: cfg.sess.rt }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status >= 400 && r.status < 500) { cfg.sess.rt = ''; saveCfg(); rtClose(); setState('auth'); }
        throw new Error(r.status >= 400 && r.status < 500 ? 'Session expirée : reconnecte-toi dans Réglages > Compte.' : errOf(j, r));
      }
      const uid = cfg.sess.uid; cfg.sess = sessOf(j); cfg.sess.uid = cfg.sess.uid || uid; saveCfg();
      if (rtSend) rtSend(TOPIC, 'access_token', { access_token: cfg.sess.at });
    })().finally(() => { refreshing = null; });
    return refreshing;
  }
  async function token() { if (!cfg.sess.at || Date.now() > cfg.sess.exp - 90e3) await refresh(); return cfg.sess.at; }
  async function api(path, opt = {}, retry = true) {
    const headers = Object.assign({ apikey: cfg.key, Authorization: 'Bearer ' + await token() }, opt.headers || {});
    const r = await fetch(cfg.url + path, Object.assign({}, opt, { headers }));
    if (r.status === 401 && retry) { await refresh(); return api(path, opt, false); }
    if (!r.ok) { let j = {}; try { j = await r.clone().json(); } catch (e) {} const e = new Error(errOf(j, r)); e.status = r.status; e.code = j.code; throw e; }
    return r;
  }
  const rest = (q, opt) => api('/rest/v1/' + q, opt);

  /* ---------- pull: rows changed on the server since the cursor ---------- */
  const isoMs = s => Date.parse(String(s).replace(/(\.\d{3})\d+/, '$1'));
  const openDocId = () => (R && R.name === 'doc') ? R.id : (Note.mounted && Note.doc ? Note.doc.id : null);
  function editingNow() {
    const a = document.activeElement;
    return !!(a && a !== document.body && (($('#view') && $('#view').contains(a)) || ($('#ph') && $('#ph').contains(a))) && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)));
  }
  async function pull() {
    const first = !cfg.done; let cursor = cfg.cursor || '', rows = [], overlap = !!cursor;
    for (let n = 0; n < 500; n++) {
      const since = !cursor ? '1970-01-01T00:00:00Z' : overlap ? new Date(isoMs(cursor) - 5000).toISOString() : cursor;
      const r = await rest(`${TABLE}?select=kind,id,data,deleted,updated_at,srv_at&srv_at=gt.${encodeURIComponent(since)}&order=srv_at.asc&limit=${PAGE}`);
      const page = await r.json();
      rows.push(...page);
      if (page.length) cursor = page[page.length - 1].srv_at;
      overlap = false;
      if (page.length < PAGE) break;
    }
    for (const [k, r] of deferred) if (!rows.some(x => x.kind + ':' + x.id === k)) rows.push(r);
    deferred.clear();
    const got = apply(rows, first);
    cfg.cursor = cursor; cfg.done = true; saveMeta();
    return got;
  }
  /* decides row by row (newest write wins), then applies with the open page unmounted when it is touched */
  function apply(rows, first) {
    const todo = [], assets = [], openId = openDocId();
    for (const r of rows) {
      const k = r.kind + ':' + r.id;
      if (r.kind === 'asset') { if (!r.deleted && !Assets.has(r.id) && !badAsset.has(r.id)) assets.push(r.id); snap[k] = { h: 'a', t: r.updated_at }; continue; }
      const rh = r.deleted ? '' : hash(canon(r.data)), s = snap[k];
      if (s && !!s.del === !!r.deleted && s.h === rh) continue;
      if (dirty[k] && !first && dirty[k] >= Number(r.updated_at)) continue;     // changed here later: this device's version goes up
      if (r.kind === 'doc' && r.id === openId && editingNow()) { deferred.set(k, r); continue; }
      todo.push([k, r, rh]);
    }
    if (todo.length) {
      const touchOpen = todo.some(([k]) => k === 'doc:' + openId);
      if (touchOpen && unmountView) { try { unmountView(); } catch (e) { console.error(e); } unmountView = null; }
      applying = true;
      const later = [];
      for (const it of todo) { if (it[1].kind === 'meta') later.push(it); else put(it); }
      later.forEach(put);
      applying = false;
      if (!S.prefs.welcomed && (S.docs.length || S.tasks.length || S.spaces.length > 1)) S.prefs.welcomed = true;
      if (!spaceById(S.prefs.cur)) S.prefs.cur = DEF_SPACE;
      ensureDefaultSpace(S);
      persist();
      rerender(touchOpen);
    }
    return { n: todo.length, assets };
  }
  function put([k, r, rh]) {
    const [kind, id] = split(k);
    snap[k] = r.deleted ? { h: '', t: r.updated_at, del: true } : { h: rh, t: r.updated_at };
    delete dirty[k];
    if (kind === 'meta' && id.startsWith('look.')) {
      const dev = id.slice(5); if (dev === devId()) return;
      const L = S.prefs.looksIn || (S.prefs.looksIn = {});
      if (r.deleted || !r.data) delete L[dev]; else L[dev] = { data: r.data, t: Number(r.updated_at) || Date.now() };
      if (PHONE) Phone.pcLook();
      return;
    }
    if (kind === 'meta') { if (id === 'order' && r.data && !r.deleted) order(r.data); if (id === 'hub' && r.data && !r.deleted) { S.hub = r.data; if (R.name === 'hub') renderHubMods(); } return; }
    const arr = kind === 'space' ? S.spaces : kind === 'doc' ? S.docs : kind === 'task' ? S.tasks : null;
    if (!arr) return;
    const i = arr.findIndex(o => o.id === id);
    if (r.deleted) { if (i >= 0 && !(kind === 'space' && id === DEF_SPACE)) arr.splice(i, 1); return; }
    const data = JSON.parse(JSON.stringify(r.data || {})); data.id = id;
    if (i < 0) { arr.push(data); return; }
    // in place, so every reference to it stays good; a board keeps this device's view
    const o = arr[i], view = kind === 'doc' ? o.view : undefined;
    for (const key of Object.keys(o)) delete o[key];
    Object.assign(o, data);
    if (view !== undefined) o.view = view;
  }
  function order(o) {
    const sortBy = (arr, ids) => { if (!Array.isArray(ids)) return; const at = new Map(ids.map((id, i) => [id, i])); const tail = ids.length; arr.forEach((x, i) => x.__o = at.has(x.id) ? at.get(x.id) : tail + i); arr.sort((a, b) => a.__o - b.__o); arr.forEach(x => delete x.__o); };
    sortBy(S.spaces, o.spaces); sortBy(S.docs, o.docs); sortBy(S.tasks, o.tasks);
    if (Array.isArray(o.taskOrder)) S.prefs.taskOrder = o.taskOrder;
  }
  let renderLater = false;
  function rerender(touchOpen) {
    if (PHONE) { Phone.remote(touchOpen); return; }   // the iPhone draws its own screens
    if (!S.prefs.welcomed) return;
    if (R.name === 'welcome') { go('all'); return; }
    if (R.name === 'doc') {
      const d = docById(R.id);
      if (!d || d.trash) { go('all'); toast('Cette page a été supprimée sur un autre appareil'); return; }
      if (touchOpen || !unmountView) { go(routeStr(R), { keepFocus: true }); return; }
      renderSide(); return;
    }
    // the Notes list with a note open beside it: only the list is drawn again (the note was not touched)
    if (!touchOpen && Note.mounted && NL.v && unmountView) { renderSide(); nlRefresh(); return; }
    if (editingNow() || $('#modal')) { renderSide(); renderLater = true; return; }
    go(routeStr(R), { keepFocus: true });
  }
  document.addEventListener('focusout', () => setTimeout(() => { if (renderLater && !editingNow() && !$('#modal') && R.name !== 'doc') { renderLater = false; go(routeStr(R), { keepFocus: true }); } }, 60));

  /* ---------- push: rows changed here; the server keeps the newest ---------- */
  async function push(cur) {
    const keys = Object.keys(dirty).filter(k => !k.startsWith('asset:'));
    if (!keys.length) return 0;
    const rows = keys.map(k => { const [kind, id] = split(k), c = cur.get(k), t = dirty[k]; return { row: { user_id: cfg.sess.uid, kind, id, data: c ? c.data : null, deleted: !c, updated_at: t }, k, h: c ? c.h : '', t }; });
    let sent = 0, lost = [];
    for (let i = 0; i < rows.length;) {
      const part = []; let size = 0;
      while (i < rows.length && (!part.length || size < CHUNK)) { const b = JSON.stringify(rows[i].row); size += b.length; part.push(rows[i]); i++; }
      const r = await rest(`${TABLE}?on_conflict=user_id,kind,id&select=kind,id`, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' }, body: JSON.stringify(part.map(x => x.row)) });
      const back = new Set((await r.json().catch(() => [])).map(x => x.kind + ':' + x.id));
      for (const x of part) {
        if (back.has(x.k)) { snap[x.k] = x.h ? { h: x.h, t: x.t } : { h: '', t: x.t, del: true }; if (dirty[x.k] === x.t) delete dirty[x.k]; sent++; }
        else lost.push(x.k);   // a newer version is already up there
      }
    }
    if (lost.length) await fetchKeys(lost);
    saveMeta();
    return sent;
  }
  async function fetchKeys(keys) {
    const rows = [];
    for (const k of keys) { const [kind, id] = split(k); const r = await rest(`${TABLE}?select=kind,id,data,deleted,updated_at,srv_at&kind=eq.${encodeURIComponent(kind)}&id=eq.${encodeURIComponent(id)}`); rows.push(...await r.json()); }
    for (const r of rows) delete dirty[r.kind + ':' + r.id];
    apply(rows, true);
  }

  /* ---------- files ---------- */
  const objPath = id => `${encodeURIComponent(cfg.sess.uid)}/${encodeURIComponent(id)}`;
  async function pushAssets() {
    let n = 0;
    for (const [id, blob] of Assets.blobs) {
      const k = 'asset:' + id;
      if (snap[k] || !(blob instanceof Blob) || blob.size > MAX_ASSET) continue;
      await api(`/storage/v1/object/${BUCKET}/${objPath(id)}`, { method: 'POST', headers: { 'Content-Type': blob.type || 'application/octet-stream', 'x-upsert': 'true', 'cache-control': '31536000' }, body: blob });
      const t = Date.now();
      await rest(`${TABLE}?on_conflict=user_id,kind,id`, { method: 'POST', headers: { 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify([{ user_id: cfg.sess.uid, kind: 'asset', id, data: { type: blob.type || '', size: blob.size }, deleted: false, updated_at: t }]) });
      snap[k] = { h: 'a', t }; n++;
      if (n % 5 === 0) saveMeta();
    }
    return n;
  }
  async function pullAssets(ids) {
    let n = 0;
    for (const id of ids) {
      if (Assets.has(id)) continue;
      try { const r = await api(`/storage/v1/object/authenticated/${BUCKET}/${objPath(id)}`); await Assets.put(await r.blob(), id); n++; }
      catch (e) { if (e.status === 400 || e.status === 404) badAsset.add(id); else throw e; }
    }
    if (n && S.prefs.welcomed) rerender(R.name === 'doc');
    return n;
  }
  /* files the cloud lists that this device lacks (a first sync, or a download that failed before) */
  async function missingAssets() {
    const r = await rest(`${TABLE}?select=id&kind=eq.asset&deleted=eq.false`);
    return (await r.json()).map(x => x.id).filter(id => !Assets.has(id) && !badAsset.has(id));
  }

  /* ---------- one round: pull, then push ---------- */
  let report = null;
  async function cycle() {
    clearTimeout(timer); timer = 0; firstWait = 0;
    if (!active()) return;
    if (busy) { again = true; return; }
    busy = true; setState('busy');
    try {
      scanSoon.flush();
      const first = !cfg.done, got = await pull();
      const cur = scan();
      const up = await push(cur);
      const files = await pushAssets();
      let down = await pullAssets(got.assets);
      if (first || !cfg.assetsChecked) { down += await pullAssets(await missingAssets()); cfg.assetsChecked = true; }
      lastOk = Date.now(); lastErr = ''; saveMeta();
      setState('ok');
      if (report) { const f = report; report = null; f({ got: got.n, up, files, down }); }
      if (!rt) rtConnect();
    } catch (e) {
      console.warn('[sync]', e);
      lastErr = e.message || String(e); saveMeta();
      setState(state === 'auth' ? 'auth' : navigator.onLine === false || e instanceof TypeError ? 'offline' : 'err');
      if (report) { const f = report; report = null; f(null, lastErr); }
    } finally {
      busy = false;
      if (again) { again = false; schedule(1200); }
    }
  }
  function schedule(ms = 2500) {
    if (!active()) return;
    const now = Date.now();
    if (!firstWait) firstWait = now;
    clearTimeout(timer);
    timer = setTimeout(cycle, now - firstWait > 15000 ? 0 : ms);   // a long typing session still goes up every 15 s
  }

  /* ---------- Realtime: a ping when a row changes on the server ---------- */
  let rt = null, rtSend = null, rtTry = 0, rtHb = 0;
  function rtClose() { if (rt) { const s = rt; rt = null; rtSend = null; clearInterval(rtHb); try { s.onclose = null; s.close(); } catch (e) {} } }
  function rtConnect() {
    if (!active() || rt || typeof WebSocket === 'undefined') return;
    let s;
    try { s = new WebSocket(cfg.url.replace(/^http/, 'ws') + '/realtime/v1/websocket?apikey=' + encodeURIComponent(cfg.key) + '&vsn=1.0.0'); } catch (e) { return; }
    rt = s; let ref = 0;
    const send = (topic, event, pl) => { if (s.readyState === 1) s.send(JSON.stringify({ topic, event, payload: pl, ref: String(++ref), join_ref: topic === TOPIC ? '1' : undefined })); };
    s.onopen = async () => {
      let at = null; try { at = await token(); } catch (e) {}
      send(TOPIC, 'phx_join', { config: { broadcast: { self: false }, presence: { key: '' }, postgres_changes: [{ event: '*', schema: 'public', table: TABLE, filter: 'user_id=eq.' + cfg.sess.uid }] }, access_token: at });
      rtSend = send; rtTry = 0;
      clearInterval(rtHb); rtHb = setInterval(() => send('phoenix', 'heartbeat', {}), 25000);
    };
    s.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } if (m.event === 'postgres_changes') schedule(500); };
    s.onclose = () => { clearInterval(rtHb); if (rt === s) { rt = null; rtSend = null; } if (active() && state !== 'auth') setTimeout(rtConnect, Math.min(60000, 2000 * 2 ** rtTry++)); };
    s.onerror = () => {};
  }

  /* ---------- public ---------- */
  async function login(url, key, email, password) {
    url = String(url || '').trim().replace(/\/+$/, '').replace(/\/rest\/v1$/, '');
    if (!/^https?:\/\/[^/]+$/.test(url)) throw new Error('L’adresse doit ressembler à https://xxxx.supabase.co');
    key = String(key || '').trim();
    const r = await fetch(url + '/auth/v1/token?grant_type=password', { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: String(email).trim(), password }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(/invalid login/i.test(errOf(j, r)) ? 'E-mail ou mot de passe incorrect.' : /api key/i.test(errOf(j, r)) ? 'Clé publique refusée par Supabase.' : errOf(j, r));
    const same = cfg && cfg.url === url && cfg.sess && cfg.sess.uid === (j.user && j.user.id);
    cfg = { url, key, email: String(email).trim(), sess: sessOf(j), cursor: same ? cfg.cursor : '', done: same ? cfg.done : false, assetsChecked: false };
    if (!same) { snap = {}; dirty = {}; }
    saveMeta(); rtClose();
    return new Promise(res => { report = (r, err) => res(err ? { err } : r); cycle(); });
  }
  function logout(forget) {
    rtClose(); clearTimeout(timer);
    if (cfg) { if (cfg.sess) cfg.sess = { uid: cfg.sess.uid }; if (forget) { cfg.cursor = ''; cfg.done = false; snap = {}; dirty = {}; } }
    saveMeta(); setState('off');
  }
  function now() { return new Promise(res => { report = (r, err) => res(err ? { err } : r); cycle(); }); }
  /* called after every local save: notes when it changed (for newest-wins), then plans a round */
  let touchAt = 0;
  const scanSoon = debounce(() => { const t = touchAt || Date.now(); touchAt = 0; if (active()) { scan(t); ls.set(DIRTY, dirty); } }, 350);
  function touched() { if (!active() || applying) return; if (!touchAt) touchAt = Date.now(); scanSoon(); schedule(); }
  function start() {
    if (!active()) return;
    setState('idle');
    cycle();
    addEventListener('online', () => schedule(300));
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedule(300); else if (Object.keys(dirty).length) cycle(); });
    addEventListener('focus', () => schedule(800));
    // fallback when Realtime is down; with it, a slow check every 5 minutes
    setInterval(() => { if (document.visibilityState === 'visible' && !busy && (!rtSend || Date.now() - lastOk > 300e3)) schedule(300); }, 60000);
  }
  function info() {
    const pending = Object.keys(dirty).length;
    return { state, on: active(), email: cfg && cfg.email, url: cfg && cfg.url, key: cfg && cfg.key, lastOk, lastErr, pending, live: !!rtSend };
  }
  return { start, login, logout, now, touched, info, onChange: f => { listeners.add(f); return () => listeners.delete(f); }, _dbg: () => ({ cfg, snap, dirty }) };
})();

/* Réglages > Compte: the sync block */
function syncLine(i) {
  const at = i.lastOk ? new Date(i.lastOk).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  switch (i.state) {
    case 'busy': return 'Synchronisation en cours…';
    case 'offline': return `Hors ligne${i.pending ? ` : ${i.pending} changement${i.pending > 1 ? 's' : ''} en attente` : ''}. Ça repartira tout seul.`;
    case 'err': return 'Erreur : ' + i.lastErr;
    case 'auth': return 'Session expirée : reconnecte-toi.';
    default: return at ? `À jour (${at})${i.live ? ', en direct' : ''}.` : 'Connecté.';
  }
}
function syncPane() {
  const i = Sync.info();
  if (i.on) return `<h5 style="margin-top:14px">Synchronisation</h5>
    <div class="srow"><div class="l"><b>${esc(i.email || '')}</b><small id="syLine" data-st="${i.state}">${esc(syncLine(i))}</small></div>
      <div style="display:flex;gap:6px;flex-wrap:wrap"><button class="btn sm" id="syNow">${icon('restore', 'sm')}Synchroniser</button><button class="btn sm ghost" id="syOut">Se déconnecter</button></div></div>`;
  return `<h5 style="margin-top:14px">Synchronisation</h5>
    <div class="srow syncf"><div class="l"><b>Mes données sur tous mes appareils</b><small>${i.state === 'auth' ? 'Session expirée : reconnecte-toi. ' : ''}Ton projet Supabase (Settings > API) et le compte créé dans Authentication > Users.</small></div></div>
    <form class="syncform" id="syForm">
      <label><span>Adresse du projet</span><input type="url" id="syUrl" placeholder="https://xxxx.supabase.co" value="${esc(i.url || '')}" autocomplete="off" spellcheck="false"></label>
      <label><span>Clé publique (anon)</span><input type="text" id="syKey" placeholder="eyJ… ou sb_publishable_…" value="${esc(i.key || '')}" autocomplete="off" spellcheck="false"></label>
      <label><span>E-mail</span><input type="email" id="syMail" value="${esc(i.email || '')}" autocomplete="username"></label>
      <label><span>Mot de passe</span><input type="password" id="syPass" autocomplete="current-password"></label>
      <div class="syact"><small id="syMsg"></small><button class="btn sm pri" type="submit" id="syGo">Se connecter</button></div>
    </form>`;
}
function bindSyncPane(m) {
  const box = $('#stSync', m); if (!box) return;
  const redraw = () => { box.innerHTML = syncPane(); bindSyncPane(m); };
  const line = $('#syLine', box);
  if (line) {
    const off = Sync.onChange(() => { if (!document.body.contains(line)) { off(); return; } const i = Sync.info(); if (!i.on) { off(); redraw(); return; } line.textContent = syncLine(i); line.dataset.st = i.state; });
    $('#syNow', box).onclick = async () => { const r = await Sync.now(); toast(r.err ? 'Synchro : ' + r.err : syncReport(r)); };
    $('#syOut', box).onclick = () => { Sync.logout(); redraw(); toast('Synchro coupée sur cet appareil. Tes données restent ici et dans le cloud.'); };
    return;
  }
  const form = $('#syForm', box), msg = $('#syMsg', box), go_ = $('#syGo', box);
  form.onsubmit = async e => {
    e.preventDefault();
    go_.disabled = true; msg.textContent = 'Connexion…';
    try {
      const r = await Sync.login($('#syUrl', box).value, $('#syKey', box).value, $('#syMail', box).value, $('#syPass', box).value);
      if (r.err) { msg.textContent = r.err; go_.disabled = false; redraw(); toast('Connecté, mais la synchro a échoué : ' + r.err); return; }
      redraw(); toast(syncReport(r));
    } catch (err) { msg.textContent = err.message || String(err); go_.disabled = false; }
  };
}
function syncReport(r) {
  const p = [];
  if (r.got) p.push(`${r.got} reçu${r.got > 1 ? 's' : ''}`);
  if (r.up) p.push(`${r.up} envoyé${r.up > 1 ? 's' : ''}`);
  if (r.files || r.down) p.push(`${(r.files || 0) + (r.down || 0)} fichier${(r.files || 0) + (r.down || 0) > 1 ? 's' : ''}`);
  return p.length ? 'Synchronisé : ' + p.join(', ') : 'Tout est à jour';
}
