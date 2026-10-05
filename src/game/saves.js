// Save slots: five of your own plus an autosave, each kept under its own
// key in browser storage, with a small index (who, where, when) so the
// slot list can be shown without reading every save.
import { GAME_VERSION } from '../version.js';
export const SLOTS = ['auto', '1', '2', '3', '4', '5'];
// Worlds you host for others, kept apart (see multiplayer.js).
export const MP_SLOTS = ['mp1', 'mp2', 'mp3'];
const INDEX_KEY = 'tessera-saves-v2';
const LEGACY_KEY = 'tessera-save-v1';
const slotKey = (id) => `tessera-save-${id}`;

// What the slot list shows for a game.
export function metaOf(game) {
  const s = game.currentSettlement;
  const p = game.player;
  let place = s ? s.name : null;
  if (!place) {
    try {
      place = game.world.ow.biomeAt(p.x, p.z).biome;
    } catch {
      place = 'the wilds';
    }
  }
  return {
    name: game.playerName,
    origin: game.origin || null,
    day: game.day,
    minute: Math.floor(game.minute),
    seed: game.seed,
    place,
    savedAt: Date.now(),
    // (Which version of the game it was saved in: see version.js.)
    gv: GAME_VERSION,
    // (A world played with others: its name, and how many have played in it.)
    ...(game.partyWorld ? { world: game.partyWorld.name, players: new Set([...(game.partyChars ? game.partyChars.keys() : []), ...(game.seats || []).map((q) => q.id)]).size || 1 } : {}),
  };
}

export function timeText(minute) {
  const h = Math.floor(minute / 60) % 24;
  const m = Math.floor(minute % 60);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

// "just now", "5 min ago", "3 h ago", "2 days ago".
export function agoText(t, now = Date.now()) {
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86400);
  return `${d} day${d > 1 ? 's' : ''} ago`;
}

// Where the games themselves go: IndexedDB when the browser has it (its room
// grows with the free space on the device), gzipped where the browser can;
// browser storage (a few megabytes for everything) otherwise. The slot list
// always lives in browser storage.
const DB_NAME = 'tessera';
const DB_STORE = 'saves';

export function openSaveDB(idb = globalThis.indexedDB) {
  if (!idb) return Promise.resolve(null);
  return new Promise((resolve) => {
    let req;
    try {
      req = idb.open(DB_NAME, 1);
    } catch {
      resolve(null);
      return;
    }
    req.onupgradeneeded = () => req.result.createObjectStore(DB_STORE);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
    req.onsuccess = () => {
      const db = req.result;
      const run = (mode, fn) => new Promise((res, rej) => {
        const tx = db.transaction(DB_STORE, mode);
        const r = fn(tx.objectStore(DB_STORE));
        tx.oncomplete = () => res(r.result);
        tx.onerror = () => rej(tx.error || r.error);
        tx.onabort = () => rej(tx.error || r.error || new Error('aborted'));
      });
      resolve({
        get: (k) => run('readonly', (os) => os.get(k)),
        put: (k, v) => run('readwrite', (os) => os.put(v, k)),
        del: (k) => run('readwrite', (os) => os.delete(k)),
      });
    };
  });
}

async function pack(text) {
  const { CompressionStream: Gzip, Blob: B, Response: R } = globalThis;
  if (!Gzip || !B || !R) return { text };
  const blob = await new R(new B([text]).stream().pipeThrough(new Gzip('gzip'))).blob();
  return { gz: blob };
}

async function unpack(v) {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (v.text) return v.text;
  const { DecompressionStream: Gunzip, Response: R } = globalThis;
  if (v.gz) return new R(v.gz.stream().pipeThrough(new Gunzip('gzip'))).text();
  return null;
}

export class SaveStore {
  constructor(storage, db = null) {
    this.st = storage;
    this.db = db;
    this.migrate();
  }

  get(key) {
    try {
      return this.st ? this.st.getItem(key) : null;
    } catch {
      return null;
    }
  }

  index() {
    try {
      return JSON.parse(this.get(INDEX_KEY)) || {};
    } catch {
      return {};
    }
  }

  writeIndex(ix) {
    this.st.setItem(INDEX_KEY, JSON.stringify(ix));
  }

  // A save from before there were slots goes into slot 1.
  migrate() {
    const old = this.get(LEGACY_KEY);
    if (!old) return;
    const ix = this.index();
    try {
      if (!ix['1']) {
        const d = JSON.parse(old);
        this.st.setItem(slotKey('1'), old);
        ix['1'] = { name: d.playerName || d.player?.name || 'Wanderer', day: d.day, minute: Math.floor(d.minute || 0), seed: d.seed, place: '?', savedAt: Date.now() };
        this.writeIndex(ix);
      }
      this.st.removeItem(LEGACY_KEY);
    } catch {
      // Leave it be; it can still be read another time.
    }
  }

  list(slots = SLOTS) {
    const ix = this.index();
    return slots.map((id) => ({ id, meta: ix[id] && (ix[id].db || this.get(slotKey(id))) ? ix[id] : null }));
  }

  // The worlds you host for others: those there are, newest first.
  worlds() {
    return this.list(MP_SLOTS).filter((s) => s.meta).sort((a, b) => b.meta.savedAt - a.meta.savedAt);
  }

  // A slot for a new world to host (null if they're all taken).
  freeWorld() {
    const s = this.list(MP_SLOTS).find((q) => !q.meta);
    return s ? s.id : null;
  }

  has(id) {
    return !!this.list().find((s) => s.id === id)?.meta;
  }

  any() {
    return this.list().some((s) => s.meta);
  }

  // The slot saved to most recently.
  latest() {
    const all = this.list().filter((s) => s.meta);
    all.sort((a, b) => b.meta.savedAt - a.meta.savedAt);
    return all[0] || null;
  }

  // Save a game (a snapshot taken at once; the writing may take a moment).
  // Rejects with the reason if it couldn't be kept.
  async save(id, game) {
    const data = JSON.stringify(game.serialize());
    const meta = metaOf(game);
    meta.size = data.length;
    if (this.db) {
      await this.db.put(slotKey(id), await pack(data));
      meta.db = true;
      // An older copy in browser storage only takes up room now.
      try {
        this.st.removeItem(slotKey(id));
      } catch {
        // Fine.
      }
    } else this.st.setItem(slotKey(id), data);
    const ix = this.index();
    ix[id] = meta;
    this.writeIndex(ix);
    this.onChange?.(id, meta);
    return meta;
  }

  // A save as it was written (its text), or null.
  async rawText(id) {
    const ix = this.index();
    let raw = null;
    if (this.db && ix[id] && ix[id].db) raw = await unpack(await this.db.get(slotKey(id)));
    return raw || this.get(slotKey(id));
  }

  // A save kept elsewhere (see net/machine.js), put in its slot here.
  async putText(id, text, meta) {
    const m = { ...meta };
    delete m.db;
    if (this.db) {
      await this.db.put(slotKey(id), await pack(text));
      m.db = true;
    } else this.st.setItem(slotKey(id), text);
    const ix = this.index();
    ix[id] = m;
    this.writeIndex(ix);
  }

  async load(id) {
    const ix = this.index();
    let raw = null;
    if (this.db && ix[id] && ix[id].db) raw = await unpack(await this.db.get(slotKey(id)));
    if (!raw) raw = this.get(slotKey(id));
    return raw ? JSON.parse(raw) : null;
  }

  remove(id, quiet = false) {
    if (!quiet) this.onChange?.(id, null);
    try {
      this.st.removeItem(slotKey(id));
      if (this.db) this.db.del(slotKey(id)).catch(() => {});
      const ix = this.index();
      delete ix[id];
      this.writeIndex(ix);
    } catch {
      // Nothing to remove.
    }
  }
}
