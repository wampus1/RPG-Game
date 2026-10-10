// (Round 81) Where the game keeps what it keeps. In the desktop app, its
// own data folder (see electron/data.js), reached through what the app
// gives the page (electron/preload.cjs: `tesseraApp`); in a browser, the
// browser's storage, as ever.
//
// appStorage(): browser storage's way of keeping (getItem, setItem,
// removeItem, key, length): in the app, every key and its text read once
// when the game starts and kept here; each change sent on to be written.
// appDb(): in the app, the "database" the saves and mods are kept in
// (see game/saves.js openSaveDB): a gzipped file each.

// The app, if this is it.
export function desktopApp() {
  const a = globalThis.tesseraApp;
  return a && a.desktop ? a : null;
}

export class FolderStorage {
  constructor(app) {
    this.app = app;
    let all = {};
    try {
      all = app.kvAll() || {};
    } catch {
      all = {};
    }
    this.map = new Map(Object.entries(all));
  }

  getItem(key) {
    const k = String(key);
    return this.map.has(k) ? this.map.get(k) : null;
  }

  setItem(key, value) {
    const k = String(key);
    const v = String(value);
    if (this.map.get(k) === v) return;
    this.map.set(k, v);
    this.app.kvSet(k, v);
  }

  removeItem(key) {
    const k = String(key);
    if (!this.map.has(k)) return;
    this.map.delete(k);
    this.app.kvDel(k);
  }

  key(i) {
    return [...this.map.keys()][i] ?? null;
  }

  get length() {
    return this.map.size;
  }

  clear() {
    for (const k of [...this.map.keys()]) this.removeItem(k);
  }
}

let kept;
export function appStorage() {
  if (kept !== undefined) return kept;
  const app = desktopApp();
  if (app) return (kept = new FolderStorage(app));
  try {
    kept = globalThis.window ? globalThis.window.localStorage : null;
  } catch {
    kept = null;
  }
  return kept || null;
}

// The saves' and mods' keeping in the app's folder: raw text, gzipped
// there (`raw`: given text, not packed: see game/saves.js pack).
export function appDb(app = desktopApp()) {
  if (!app) return null;
  return {
    raw: true,
    get: async (k) => {
      const t = await app.dbGet(String(k));
      return t === null || t === undefined ? null : { text: t };
    },
    put: (k, v) => app.dbPut(String(k), typeof v === 'string' ? v : v && v.text !== undefined ? v.text : ''),
    del: (k) => app.dbDel(String(k)),
  };
}
