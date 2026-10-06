// The mods on this computer (round 62): the ones you're making in the
// Workshop, the ones you've been sent, and the ones fetched from someone
// hosting a world that uses them.
//
// Each mod's working copy is kept by its id (what the Workshop edits); and
// each version a world was made with is kept as it was, by its hash, so a
// world always has the very mod it was made with (and can be offered the
// newer one: see ModLibrary.resolve). Kept in the browser's database where
// it has one (gzipped), in browser storage otherwise, and in memory when
// there's neither (the tests).
import { exportMod, importMod, modHash, modRef, normalizeMod, countThings, rid } from './format.js';
import { pack, unpack } from '../game/saves.js';

const INDEX_KEY = 'tessera-mods-v1';
const PACKS_KEY = 'tessera-modpacks-v1';
const modKey = (id) => `mod:${id}`;
const packKey = (hash) => `modpack:${hash}`;

export class ModLibrary {
  constructor(storage = null, db = null) {
    this.st = storage;
    this.db = db;
    this.mem = new Map();
    this.cache = new Map();
    this.listeners = new Set();
  }

  // ------------------------------------------------------------ the index
  readJson(key) {
    try {
      const t = this.st ? this.st.getItem(key) : this.mem.get(key);
      return t ? JSON.parse(t) : {};
    } catch {
      return {};
    }
  }

  writeJson(key, v) {
    const t = JSON.stringify(v);
    try {
      if (this.st) this.st.setItem(key, t);
      else this.mem.set(key, t);
    } catch {
      this.mem.set(key, t);
    }
  }

  index() {
    return this.readJson(INDEX_KEY);
  }

  packs() {
    return this.readJson(PACKS_KEY);
  }

  // Every mod here, newest change first: [{ id, name, author, version,
  // hash, color, updated, size, things, mine }].
  list() {
    return Object.values(this.index()).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  }

  has(id) {
    return !!this.index()[id];
  }

  onChange(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  changed(id) {
    for (const fn of this.listeners) {
      try {
        fn(id);
      } catch {
        // A listener's own trouble.
      }
    }
  }

  // ------------------------------------------------------------ raw
  async putRaw(key, text) {
    if (this.db) {
      await this.db.put(key, await pack(text));
      return;
    }
    try {
      if (this.st) this.st.setItem(`tessera-${key}`, text);
      else this.mem.set(key, text);
    } catch (e) {
      const full = e && (e.name === 'QuotaExceededError' || /quota/i.test(e.message || ''));
      if (full) throw new Error('Not enough room to keep the mod: delete an old mod or save first.');
      throw e;
    }
  }

  async getRaw(key) {
    if (this.db) {
      const t = await unpack(await this.db.get(key));
      if (t) return t;
    }
    try {
      return this.st ? this.st.getItem(`tessera-${key}`) : this.mem.get(key) || null;
    } catch {
      return null;
    }
  }

  async delRaw(key) {
    if (this.db) await this.db.del(key).catch(() => {});
    try {
      if (this.st) this.st.removeItem(`tessera-${key}`);
      this.mem.delete(key);
    } catch {
      // Gone already.
    }
  }

  // ------------------------------------------------------------ mods
  // A mod's working copy (a fresh object each time: change it and put it
  // back). Null if there's no such mod.
  async get(id) {
    const t = await this.getRaw(modKey(id));
    if (!t) return null;
    try {
      return importMod(t);
    } catch {
      return null;
    }
  }

  // Keep a mod (its working copy). Resolves to its index entry.
  async put(mod, o = {}) {
    normalizeMod(mod);
    if (!o.keepTime) mod.updated = Date.now();
    const text = exportMod(mod);
    const hash = modHash(mod);
    mod.hash = hash;
    await this.putRaw(modKey(mod.id), text);
    const ix = this.index();
    ix[mod.id] = { ...modRef(mod), hash, updated: mod.updated, size: text.length, things: countThings(mod), mine: o.mine ?? ix[mod.id]?.mine ?? true, from: o.from || ix[mod.id]?.from || null };
    this.writeJson(INDEX_KEY, ix);
    this.changed(mod.id);
    return ix[mod.id];
  }

  async remove(id) {
    await this.delRaw(modKey(id));
    const ix = this.index();
    delete ix[id];
    this.writeJson(INDEX_KEY, ix);
    this.changed(id);
  }

  // A mod from a file (or another player): kept here. Its id already
  // here: `replace` it, or keep both (the one coming in under a new id).
  async add(text, o = {}) {
    const mod = importMod(text);
    if (this.has(mod.id) && !o.replace) {
      const mine = await this.get(mod.id);
      if (mine && modHash(mine) === mod.hash) return { mod, entry: this.index()[mod.id], same: true };
      if (o.copy) {
        mod.id = rid(8);
        mod.name = `${mod.name} (copy)`.slice(0, 40);
      }
    }
    const entry = await this.put(mod, { keepTime: true, mine: o.mine ?? false, from: o.from || null });
    await this.putPack(mod);
    return { mod, entry, same: false };
  }

  // ------------------------------------------------------------ versions kept
  // This exact version of a mod, kept for the worlds made with it.
  async putPack(mod) {
    const hash = mod.hash || modHash(mod);
    const packs = this.packs();
    if (packs[hash]) return hash;
    const text = exportMod(mod);
    await this.putRaw(packKey(hash), text);
    packs[hash] = { id: mod.id, name: mod.name, version: mod.version, size: text.length, at: Date.now() };
    this.writeJson(PACKS_KEY, packs);
    return hash;
  }

  hasPack(hash) {
    return !!this.packs()[hash] || Object.values(this.index()).some((e) => e.hash === hash);
  }

  // The text of an exact version (for sending to another player).
  async packText(hash) {
    if (this.packs()[hash]) return this.getRaw(packKey(hash));
    const e = Object.values(this.index()).find((q) => q.hash === hash);
    return e ? this.getRaw(modKey(e.id)) : null;
  }

  async getPack(hash) {
    if (this.cache.has(hash)) return this.cache.get(hash);
    const t = await this.packText(hash);
    if (!t) return null;
    try {
      const m = importMod(t);
      this.cache.set(hash, m);
      return m;
    } catch {
      return null;
    }
  }

  // What a world's list of mods (refs) comes to here: for each, the exact
  // version it was made with (`mod`), the newer working copy if there is
  // one (`newer`), or nothing at all (`missing`).
  async resolve(refs = []) {
    const out = [];
    for (const r of refs) {
      const exact = await this.getPack(r.hash);
      const ix = this.index()[r.id];
      const newer = ix && ix.hash !== r.hash ? await this.get(r.id) : null;
      out.push({ ref: r, mod: exact, newer, missing: !exact && !newer });
    }
    return out;
  }
}
