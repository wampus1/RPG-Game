// (Round 81) What the desktop app gives the game's page (as
// `window.tesseraApp`; see src/util/appstore.js): its data folder, a way
// to bring in worlds from the browser version, and its window's closing.
// Only these few things; the page can't reach anything else of this
// computer.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tesseraApp', {
  desktop: true,
  // { version, dataDir, savesDir, port, platform }
  info: () => ipcRenderer.sendSync('tessera:info'),
  // What the game keeps small: every key and its text, at once; each
  // change sent to be written.
  kvAll: () => ipcRenderer.sendSync('tessera:kv-all'),
  kvSet: (k, v) => ipcRenderer.send('tessera:kv-set', String(k), String(v)),
  kvDel: (k) => ipcRenderer.send('tessera:kv-del', String(k)),
  // What it keeps big (worlds, mods): text by key, read and written as
  // wanted.
  dbGet: (k) => ipcRenderer.invoke('tessera:db-get', String(k)),
  dbPut: (k, text) => ipcRenderer.invoke('tessera:db-put', String(k), String(text)),
  dbDel: (k) => ipcRenderer.invoke('tessera:db-del', String(k)),
  // The saves folder (or the whole data folder) opened on the desktop.
  openFolder: (which) => ipcRenderer.invoke('tessera:open-folder', String(which || 'saves')),
  // Worlds from the browser version: where they were found on this
  // computer; one place's read; or a folder or file picked.
  carryFind: () => ipcRenderer.invoke('tessera:carry-find'),
  carryRead: (dir) => ipcRenderer.invoke('tessera:carry-read', String(dir)),
  carryPick: (kind) => ipcRenderer.invoke('tessera:carry-pick', kind === 'file' ? 'file' : 'folder'),
  // The window's close: asked of the game (with play not yet saved, it
  // asks you), answered at once (`closeAck`), then let go (`closeNow`).
  onCloseAsked: (fn) => {
    ipcRenderer.on('tessera:close-asked', () => fn());
  },
  closeAck: () => ipcRenderer.send('tessera:close-ack'),
  closeNow: () => ipcRenderer.send('tessera:close-now'),
});
