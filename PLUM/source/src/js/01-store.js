/* ================= storage =================
   IndexedDB keeps the workspace ("kv"/state) and the dropped files ("assets", as Blobs).
   When the browser refuses storage the app runs from memory and says so. */
const DB = (() => {
  let db = null; const mem = { kv: new Map(), assets: new Map() };
  const ok = () => !!db;
  function open() {
    return new Promise(res => {
      let done = false; const fin = v => { if (!done) { done = true; res(v); } };
      setTimeout(() => fin(false), 2500);
      try {
        const r = indexedDB.open('notely-hub', 1);
        r.onupgradeneeded = () => { const d = r.result; if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv'); if (!d.objectStoreNames.contains('assets')) d.createObjectStore('assets'); };
        r.onsuccess = () => { db = r.result; fin(true); };
        r.onerror = () => fin(false); r.onblocked = () => fin(false);
      } catch (e) { fin(false); }
    });
  }
  function tx(store, mode, fn) {
    return new Promise((res, rej) => {
      try { const t = db.transaction(store, mode), s = t.objectStore(store); const r = fn(s); t.oncomplete = () => res(r && 'result' in r ? r.result : undefined); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }
      catch (e) { rej(e); }
    });
  }
  return {
    open, ok,
    async get(store, key) { if (!db) return mem[store].get(key); try { return await tx(store, 'readonly', s => s.get(key)); } catch (e) { return mem[store].get(key); } },
    async put(store, key, val) { if (!db) { mem[store].set(key, val); return; } try { await tx(store, 'readwrite', s => s.put(val, key)); } catch (e) { mem[store].set(key, val); console.warn('[store]', e); } },
    async del(store, key) { mem[store].delete(key); if (db) try { await tx(store, 'readwrite', s => s.delete(key)); } catch (e) {} },
    async all(store) {
      if (!db) return [...mem[store].entries()];
      try {
        const keys = await tx(store, 'readonly', s => s.getAllKeys()), vals = await tx(store, 'readonly', s => s.getAll());
        return keys.map((k, i) => [k, vals[i]]);
      } catch (e) { return [...mem[store].entries()]; }
    }
  };
})();

/* Files dropped into notes and boards. The page refers to them by id; URLs are object URLs made once. */
const Assets = {
  blobs: new Map(), urls: new Map(),
  async load() { for (const [k, v] of await DB.all('assets')) if (v instanceof Blob) this.blobs.set(k, v); },
  url(id) {
    if (!id) return '';
    let u = this.urls.get(id);
    if (!u) { const b = this.blobs.get(id); if (!b) return ''; u = URL.createObjectURL(b); this.urls.set(id, u); }
    return u;
  },
  has(id) { return this.blobs.has(id); },
  async put(blob, id = uid('a')) { this.blobs.set(id, blob); await DB.put('assets', id, blob); return id; },
  async drop(id) { const u = this.urls.get(id); if (u) URL.revokeObjectURL(u); this.urls.delete(id); this.blobs.delete(id); await DB.del('assets', id); }
};

/* Images are downscaled once on import so a moodboard of phone photos stays light. */
async function importImage(file, max = 2200) {
  if (/svg|gif/.test(file.type)) { const dim = await imgSize(URL.createObjectURL(file)); return { id: await Assets.put(file), w: dim.w || 400, h: dim.h || 300 }; }
  let bmp = null;
  try { bmp = await createImageBitmap(file); } catch (e) { const d = await imgSize(URL.createObjectURL(file)); if (!d.img) throw e; bmp = d.img; }
  const W = bmp.width, H = bmp.height, s = Math.min(1, max / Math.max(W, H));
  if (s === 1 && file.size < 2.5e6) return { id: await Assets.put(file), w: W, h: H };
  const c = document.createElement('canvas'); c.width = Math.round(W * s); c.height = Math.round(H * s);
  const x = c.getContext('2d'); x.drawImage(bmp, 0, 0, c.width, c.height);
  const png = file.type === 'image/png' && hasAlpha(x, c.width, c.height);
  const blob = await new Promise(r => c.toBlob(r, png ? 'image/png' : 'image/jpeg', .88));
  return { id: await Assets.put(blob || file), w: c.width, h: c.height };
}
function hasAlpha(x, w, h) { try { const d = x.getImageData(0, 0, Math.min(w, 64), Math.min(h, 64)).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true; } catch (e) {} return false; }
function imgSize(src) { return new Promise(r => { const i = new Image(); i.onload = () => r({ w: i.naturalWidth, h: i.naturalHeight, img: i }); i.onerror = () => r({ w: 0, h: 0 }); i.src = src; }); }

/* iPad app: every write is mirrored to files in the app's Documents folder (visible in Fichiers),
   and read back from there when the web storage comes back empty (reinstall, storage cleared by iPadOS). */
if (IPAD) {
  const post = m => { try { window.webkit.messageHandlers.hubStore.postMessage(m); } catch (e) {} };
  const base = { get: DB.get, all: DB.all, put: DB.put, del: DB.del };
  const fromNative = async path => { try { const r = await fetch('/__store/' + path, { cache: 'no-store' }); return r.ok ? r : null; } catch (e) { return null; } };
  DB.put = async (store, key, val) => {
    await base.put(store, key, val);
    if (store === 'kv') post({ op: 'put', store, key, json: JSON.stringify(val) });
    else if (val instanceof Blob) { const u = await blobToDataURL(val); post({ op: 'put', store, key, type: val.type || 'application/octet-stream', b64: u.slice(u.indexOf(',') + 1) }); }
  };
  DB.del = async (store, key) => { await base.del(store, key); post({ op: 'del', store, key }); };
  DB.get = async (store, key) => {
    let v = await base.get(store, key);
    if (v === undefined && store === 'kv') { const r = await fromNative('kv/' + encodeURIComponent(key)); if (r) { try { v = await r.json(); await base.put(store, key, v); } catch (e) { v = undefined; } } }
    return v;
  };
  DB.all = async store => {
    const rows = await base.all(store);
    if (!rows.length && store === 'assets') {
      const r = await fromNative('assets/'); const ids = r ? await r.json().catch(() => []) : [];
      for (const id of ids) { const f = await fromNative('assets/' + encodeURIComponent(id)); if (!f) continue; const b = await f.blob(); rows.push([id, b]); await base.put('assets', id, b); }
    }
    return rows;
  };
}

/* remote images and link previews for the board. The Windows app fetches through its main process (no CORS there);
   a plain browser only gets the images whose site allows it, and no previews. */
const Net = {
  native: () => !!(DESKTOP && window.notely.fetchUrl),
  async blob(url) {
    if (/^data:image\//i.test(url)) { try { return dataURLToBlob(url); } catch (e) { return null; } }
    if (!/^https?:\/\//i.test(url) && !(/^file:\/\//i.test(url) && Net.native())) return null;
    try {
      if (Net.native()) { const r = await window.notely.fetchUrl({ url, as: 'bytes' }); return r && r.ok ? new Blob([r.data], { type: r.type || '' }) : null; }
      const r = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); return r.ok ? await r.blob() : null;
    } catch (e) { return null; }
  },
  /* the text of a calendar feed (.ics): the Windows app reads it through its main process, a browser only when the site allows it */
  async ics(url) {
    url = String(url || '').trim().replace(/&amp;/g, '&').replace(/^webcals?:\/\//i, 'https://');
    if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'url' };
    try {
      if (Net.native()) { const r = await window.notely.fetchUrl({ url, as: 'ics' }); return r || { ok: false }; }
      const r = await fetch(url, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' }); return r.ok ? { ok: true, text: await r.text() } : { ok: false, status: r.status };
    } catch (e) { return { ok: false, error: 'blocked' }; }
  },
  /* { title, desc, image, site, isImage } read from the page's Open Graph tags */
  async meta(url) {
    if (!Net.native()) return null;
    try { const r = await window.notely.fetchUrl({ url, as: 'meta' }); return r && r.ok ? r : null; } catch (e) { return null; }
  }
};
