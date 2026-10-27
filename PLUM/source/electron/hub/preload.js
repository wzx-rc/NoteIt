// Native file dialogs, Wintab pen samples, the assistant's OpenAI requests and the page zoom; nothing else from Node is exposed.
const { contextBridge, ipcRenderer, webFrame } = require('electron');
contextBridge.exposeInMainWorld('notely', {
  platform: 'desktop',
  saveFile: req => ipcRenderer.invoke('save-file', req),
  openFile: () => ipcRenderer.invoke('open-file'),
  // { ok, reason?, device?, pressureLevels?, tilt?, mode? }
  penInfo: () => ipcRenderer.invoke('pen-info'),
  // { method, url (https://api.openai.com/v1/...), key, body } -> { status, body?, error? }
  aiRequest: req => ipcRenderer.invoke('ai-request', req),
  aiTranscribe: req => ipcRenderer.invoke('ai-transcribe', req),
  // board imports: { url, as: 'bytes' } -> { ok, type, data } (images only), { url, as: 'meta' } -> { ok, title, desc, image, site, isImage }
  fetchUrl: req => ipcRenderer.invoke('fetch-url', req),
  // { mode: 'light' | 'dark' | 'system' }: native theme
  setTheme: t => ipcRenderer.send('set-theme', t),
  // the size of the interface (Réglages > UI): 0.5 to 1.25, like the browser zoom
  setZoom: f => webFrame.setZoomFactor(Math.min(2, Math.max(.25, +f || 1))),
  // window buttons: 'min' | 'max' (maximise or restore) | 'close'; onWinState(cb({ max, full })) returns an unsubscribe function
  win: a => ipcRenderer.send('win', a),
  onWinState: cb => { const h = (e, d) => cb(d); ipcRenderer.on('win-state', h); return () => ipcRenderer.removeListener('win-state', h); },
  // cb(rows), rows = [[pressure 0..1, tilt deg, azimuth deg, eraser 0|1, down 0|1, inProximity 0|1, pkTime ms], ...]
  // Returns an unsubscribe function.
  onPen: cb => { const h = (e, d) => cb(d); ipcRenderer.on('pen', h); return () => ipcRenderer.removeListener('pen', h); }
});
