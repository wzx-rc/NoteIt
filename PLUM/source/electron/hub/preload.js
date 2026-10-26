// Native file dialogs, Wintab pen samples and the assistant's OpenAI requests; nothing else from Node is exposed.
const { contextBridge, ipcRenderer } = require('electron');
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
  // 'light' | 'dark' | 'system': colours the window's title bar
  setTheme: t => ipcRenderer.send('set-theme', t),
  // cb(rows), rows = [[pressure 0..1, tilt deg, azimuth deg, eraser 0|1, down 0|1, inProximity 0|1, pkTime ms], ...]
  // Returns an unsubscribe function.
  onPen: cb => { const h = (e, d) => cb(d); ipcRenderer.on('pen', h); return () => ipcRenderer.removeListener('pen', h); }
});
