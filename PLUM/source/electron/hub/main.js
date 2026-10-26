const { app, BrowserWindow, Menu, dialog, ipcMain, screen, shell, net, nativeTheme } = require('electron');
const path = require('path');
const fs = require('fs');
const wintab = require('./wintab');

// Pen pressure and tilt reach the page through Chromium's Pointer Events (Windows Ink),
// and on Windows also natively through Wintab (wintab.js) when Windows Ink is off.
app.commandLine.appendSwitch('touch-events', 'enabled');

// The app was called Notely Hub before PLUM: keep its data folder so notes, boards and settings carry over.
app.setName('PLUM');
app.setPath('userData', path.join(app.getPath('appData'), 'Notely Hub'));

const pens = new WeakMap(); // BrowserWindow -> Wintab session

const stateFile = () => path.join(app.getPath('userData'), 'window.json');
function loadBounds() {
  try {
    const b = JSON.parse(fs.readFileSync(stateFile(), 'utf8'));
    const area = screen.getDisplayMatching(b).workArea;
    if (b.width >= 600 && b.height >= 400 && b.x < area.x + area.width && b.y < area.y + area.height) return b;
  } catch (e) {}
  return null;
}

function createWindow() {
  const saved = loadBounds();
  const win = new BrowserWindow({
    width: 1440, height: 920, minWidth: 720, minHeight: 520, ...(saved || {}),
    backgroundColor: '#17181C', autoHideMenuBar: true, title: 'PLUM', show: false,
    // the page draws the whole title bar in the skin's colours, window buttons included (ipc 'win')
    titleBarStyle: 'hidden',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  if (saved && saved.maximized) win.maximize();
  const sendState = () => { if (!win.isDestroyed()) win.webContents.send('win-state', { max: win.isMaximized(), full: win.isFullScreen() }); };
  for (const ev of ['maximize', 'unmaximize', 'enter-full-screen', 'leave-full-screen']) win.on(ev, sendState);
  win.webContents.on('did-finish-load', sendState);
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.webContents.setVisualZoomLevelLimits(1, 1);
  win.webContents.on('will-navigate', e => e.preventDefault());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^(https:\/\/|mailto:)/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  const pen = wintab.attach(win);
  pens.set(win, pen);
  if (!pen.info().ok && process.platform === 'win32') console.warn('[wintab]', pen.info().reason);

  // Write the drawing to disk before the window goes away.
  let closing = false;
  win.on('close', e => {
    try { fs.writeFileSync(stateFile(), JSON.stringify({ ...win.getNormalBounds(), maximized: win.isMaximized() })); } catch (err) {}
    if (closing) return;
    e.preventDefault(); closing = true;
    const done = () => { pen.close(); if (!win.isDestroyed()) win.destroy(); };
    const t = setTimeout(done, 1500);
    win.webContents.executeJavaScript('window.__flushSave ? window.__flushSave() : null').catch(() => {}).finally(() => { clearTimeout(t); done(); });
  });
}

const MAX_BYTES = 200 * 1024 * 1024;
ipcMain.on('set-theme', (e, t) => {
  const o = typeof t === 'string' ? { mode: t } : (t || {});
  if (o.mode === 'light' || o.mode === 'dark' || o.mode === 'system') nativeTheme.themeSource = o.mode;
});
// the window buttons drawn by the page
ipcMain.on('win', (e, a) => {
  const win = BrowserWindow.fromWebContents(e.sender); if (!win) return;
  if (a === 'min') win.minimize();
  else if (a === 'max') { if (win.isFullScreen()) win.setFullScreen(false); else if (win.isMaximized()) win.unmaximize(); else win.maximize(); }
  else if (a === 'close') win.close();
});

ipcMain.handle('save-file', async (e, req) => {
  const { name, kind, data } = req || {};
  if (!(data instanceof Uint8Array) || data.length > MAX_BYTES) return { ok: false };
  const png = kind === 'png', js = kind === 'json';
  const win = BrowserWindow.fromWebContents(e.sender);
  const base = String(name || (png ? 'PLUM.png' : js ? 'PLUM-espace.json' : 'Dessin.notely')).replace(/[\\/:*?"<>|]/g, '-');
  const r = await dialog.showSaveDialog(win, {
    title: png ? 'Exporter en PNG' : js ? 'Exporter une sauvegarde' : 'Enregistrer le dessin',
    defaultPath: path.join(app.getPath(png ? 'pictures' : 'documents'), base),
    filters: png ? [{ name: 'Image PNG', extensions: ['png'] }] : js ? [{ name: 'Sauvegarde PLUM', extensions: ['json'] }] : [{ name: 'Dessin PLUM', extensions: ['notely'] }]
  });
  if (r.canceled || !r.filePath) return { ok: false };
  await fs.promises.writeFile(r.filePath, Buffer.from(data));
  return { ok: true };
});
ipcMain.handle('open-file', async e => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const r = await dialog.showOpenDialog(win, { title: 'Ouvrir un dessin', properties: ['openFile'], filters: [{ name: 'Dessin PLUM', extensions: ['notely', 'json'] }] });
  if (r.canceled || !r.filePaths[0]) return { ok: false };
  const st = await fs.promises.stat(r.filePaths[0]);
  if (st.size > MAX_BYTES) return { ok: false };
  return { ok: true, text: await fs.promises.readFile(r.filePaths[0], 'utf8') };
});

// The assistant talks to OpenAI from here, so the page never needs network access of its own.
ipcMain.handle('ai-request', async (e, req) => {
  const { method, url, key, body } = req || {};
  if (typeof url !== 'string' || !url.startsWith('https://api.openai.com/v1/')) return { status: 0, error: 'url' };
  if (typeof key !== 'string' || !key) return { status: 0, error: 'nokey' };
  try {
    const doFetch = net && net.fetch ? net.fetch.bind(net) : fetch;
    const r = await doFetch(url, { method: method === 'POST' ? 'POST' : 'GET', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: method === 'POST' ? String(body || '') : undefined });
    return { status: r.status, body: await r.text() };
  } catch (err) { return { status: 0, error: String((err && err.message) || err) }; }
});

// voice dictation: the audio goes to OpenAI's transcription endpoint as multipart
ipcMain.handle('ai-transcribe', async (e, req) => {
  const { key, model, name, type, audio } = req || {};
  if (typeof key !== 'string' || !key) return { status: 0, error: 'nokey' };
  if (!audio || !audio.byteLength || audio.byteLength > 25 * 1024 * 1024) return { status: 0, error: 'audio' };
  try {
    const fd = new FormData();
    fd.append('file', new Blob([audio], { type: String(type || 'audio/webm') }), String(name || 'dictee.webm'));
    fd.append('model', String(model || 'gpt-4o-transcribe'));
    fd.append('response_format', 'json');
    const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
    return { status: r.status, body: await r.text() };
  } catch (err) { return { status: 0, error: String((err && err.message) || err) }; }
});

// Images and link previews dropped on a board: fetched here, where no CORS applies. Only http(s), images only
// for bytes, and only the <head> tags for previews; no cookies are sent, so nothing behind a login is reached.
const PREVIEW_UA = 'PLUM/' + app.getVersion() + ' (link preview)';
const MAX_IMAGE = 30 * 1024 * 1024;
const unEntity = s => String(s).replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
function metaTag(html, names) {
  for (const n of names) {
    const re = new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${n}["'][^>]*>`, 'i'), m = re.exec(html);
    if (!m) continue;
    const c = /content\s*=\s*"([^"]*)"|content\s*=\s*'([^']*)'/i.exec(m[0]);
    if (c && (c[1] || c[2])) return unEntity(c[1] || c[2]).trim();
  }
  return '';
}
ipcMain.handle('fetch-url', async (e, req) => {
  const { url, as } = req || {};
  if (typeof url !== 'string' || url.length > 8192) return { ok: false, error: 'url' };
  // a picture dragged from another app as a local file address (file:///C:/…/image.png): images only
  if (/^file:\/\//i.test(url) && as !== 'meta') {
    try {
      const f = require('url').fileURLToPath(url), ext = path.extname(f).slice(1).toLowerCase();
      const type = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', avif: 'image/avif', bmp: 'image/bmp' }[ext];
      if (!type) return { ok: false, error: 'type' };
      const st = await fs.promises.stat(f); if (!st.isFile() || st.size > MAX_IMAGE) return { ok: false, error: 'size' };
      return { ok: true, type, data: new Uint8Array(await fs.promises.readFile(f)) };
    } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  }
  if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'url' };
  const doFetch = net && net.fetch ? net.fetch.bind(net) : fetch;
  const ctl = new AbortController(), timer = setTimeout(() => ctl.abort(), 20000);
  try {
    if (as === 'meta') {
      const r = await doFetch(url, { signal: ctl.signal, credentials: 'omit', headers: { 'User-Agent': PREVIEW_UA, Accept: 'text/html,application/xhtml+xml,image/*;q=0.8', 'Accept-Language': 'fr,en;q=0.8' } });
      const type = (r.headers.get('content-type') || '').toLowerCase();
      if (r.ok && type.startsWith('image/')) { ctl.abort(); return { ok: true, isImage: true }; }
      if (!r.ok || !/html|xml/.test(type)) return { ok: false, status: r.status };
      let html = Buffer.from(await r.arrayBuffer()).subarray(0, 1.5 * 1024 * 1024).toString('utf8');
      const end = html.search(/<\/head>/i); if (end > 0) html = html.slice(0, end);
      const t = /<title[^>]*>([^<]*)<\/title>/i.exec(html);
      let image = metaTag(html, ['og:image:secure_url', 'og:image', 'og:image:url', 'twitter:image', 'twitter:image:src']);
      try { if (image) image = new URL(image, r.url || url).href; } catch (err) { image = ''; }
      return { ok: true, url: r.url || url, image: /^https?:/i.test(image) ? image : '', title: metaTag(html, ['og:title', 'twitter:title']) || (t ? unEntity(t[1]).trim() : ''), desc: metaTag(html, ['og:description', 'description', 'twitter:description']), site: metaTag(html, ['og:site_name']) };
    }
    const r = await doFetch(url, { signal: ctl.signal, credentials: 'omit', headers: { Accept: 'image/avif,image/webp,image/png,image/*;q=0.9,*/*;q=0.5' } });
    const type = (r.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (!r.ok || !type.startsWith('image/')) return { ok: false, status: r.status, type };
    if (+r.headers.get('content-length') > MAX_IMAGE) return { ok: false, error: 'size' };
    const buf = await r.arrayBuffer();
    if (buf.byteLength > MAX_IMAGE) return { ok: false, error: 'size' };
    return { ok: true, type, data: new Uint8Array(buf) };
  } catch (err) { return { ok: false, error: String((err && err.message) || err) }; }
  finally { clearTimeout(timer); }
});

ipcMain.handle('pen-info', e => {
  const win = BrowserWindow.fromWebContents(e.sender);
  const pen = win && pens.get(win);
  return pen ? pen.info() : { ok: false, reason: 'no window' };
});

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { const w = BrowserWindow.getAllWindows()[0]; if (w) { if (w.isMinimized()) w.restore(); w.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
