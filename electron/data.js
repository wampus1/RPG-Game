// (Round 81) The desktop app's own data folder: everything the game keeps,
// kept as files here rather than in the browser's storage (where it'd be
// tied to the address the game's opened at) or the game's server.
//
//   saves/index.json      the list of saved worlds (who, where, when)
//   saves/<slot>.json.gz  each saved world
//   mods/index.json       the mods on this computer, and their packs
//   mods/<id>.json.gz     each mod's working copy (packs/ each version)
//   storage.json          the rest: your account, settings, keys,
//                         achievements, the Workshop's own
//
// What the game keeps in "browser storage" (small, read at once, a key
// and its text) is all read when the game starts, and each change
// written as it's made (the slot list at once; storage.json a moment
// later, a few at a time); what it keeps in its "database" (worlds,
// mods: big, read when wanted) is a gzipped file each. Every file's
// written whole to one beside it, then put in its place, so a crash
// part-way through leaves the old one, not half of each; and the small
// ones keep the one before as .bak.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { promisify } from 'node:util';
import { setTimeout, clearTimeout } from 'node:timers';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

// Keys kept in files of their own (beside what they list), not in
// storage.json.
const OWN_FILES = {
  'tessera-saves-v2': 'saves/index.json',
  'tessera-mods-v1': 'mods/index.json',
  'tessera-modpacks-v1': 'mods/packs.json',
};
const REST = 'storage.json';
// (How long storage.json waits for more changes before it's written.)
const SETTLE_MS = 250;

// A name for a file: letters, digits and . _ ~ - as they are, anything
// else as %XX; never one of the names Windows keeps for itself.
export function safeName(s) {
  let out = '';
  for (const ch of String(s)) out += /[A-Za-z0-9._~-]/.test(ch) ? ch : [...Buffer.from(ch)].map((b) => `%${b.toString(16).toUpperCase().padStart(2, '0')}`).join('');
  if (!out || /^\.+$/.test(out) || /^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(out)) out = `_${out}`;
  return out;
}

// Where a big thing (by the game's key for it) is kept.
export function blobPath(key) {
  const k = String(key);
  let m;
  if ((m = /^tessera-save-(.+)$/.exec(k))) return path.join('saves', `${safeName(m[1])}.json.gz`);
  if ((m = /^modpack:(.+)$/.exec(k))) return path.join('mods', 'packs', `${safeName(m[1])}.json.gz`);
  if ((m = /^mod:(.+)$/.exec(k))) return path.join('mods', `${safeName(m[1])}.json.gz`);
  return path.join('other', `${safeName(k)}.json.gz`);
}

// Written whole beside it, then put in its place (the one before kept as
// .bak). (A few tries: on Windows a file being looked at by something
// else, a virus checker, can't be replaced for a moment.)
function writeWhole(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, data);
  for (let i = 0; ; i++) {
    try {
      if (fs.existsSync(file)) fs.copyFileSync(file, `${file}.bak`);
      fs.renameSync(tmp, file);
      return;
    } catch (e) {
      if (i >= 4) {
        try {
          fs.unlinkSync(tmp);
        } catch {
          // Gone.
        }
        throw e;
      }
      const until = Date.now() + 40 * (i + 1);
      while (Date.now() < until);
    }
  }
}

async function writeWholeAsync(file, data) {
  await fs.promises.mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await fs.promises.writeFile(tmp, data);
  for (let i = 0; ; i++) {
    try {
      await fs.promises.rename(tmp, file);
      return;
    } catch (e) {
      if (i >= 4) {
        await fs.promises.unlink(tmp).catch(() => {});
        throw e;
      }
      await new Promise((r) => setTimeout(r, 60 * (i + 1)));
    }
  }
}

// A file's text, or (if it's gone wrong) its .bak's; null if neither.
function readText(file) {
  for (const f of [file, `${file}.bak`]) {
    try {
      return fs.readFileSync(f, 'utf8');
    } catch {
      // Not there.
    }
  }
  return null;
}

export class DataFolder {
  constructor(dir) {
    this.dir = dir;
    this.kv = new Map();
    this.dirty = false;
    this.timer = null;
    // (Each big thing's writes one after another: the last one asked for
    // is the one that stays.)
    this.queues = new Map();
    fs.mkdirSync(dir, { recursive: true });
    this.load();
  }

  file(rel) {
    return path.join(this.dir, rel);
  }

  get savesDir() {
    return this.file('saves');
  }

  load() {
    const rest = readText(this.file(REST));
    let obj = {};
    if (rest !== null) {
      try {
        obj = JSON.parse(rest) || {};
      } catch {
        // (Spoilt: put aside, and the .bak tried.)
        try {
          fs.copyFileSync(this.file(REST), this.file(`${REST}.spoilt-${Date.now()}`));
          obj = JSON.parse(fs.readFileSync(this.file(`${REST}.bak`), 'utf8')) || {};
        } catch {
          obj = {};
        }
      }
    }
    for (const [k, v] of Object.entries(obj)) if (typeof v === 'string' && !OWN_FILES[k]) this.kv.set(k, v);
    for (const [k, rel] of Object.entries(OWN_FILES)) {
      const t = readText(this.file(rel));
      if (t === null) continue;
      try {
        JSON.parse(t);
        this.kv.set(k, t);
      } catch {
        const b = readText(this.file(`${rel}.bak`));
        if (b !== null) this.kv.set(k, b);
      }
    }
  }

  // ------------------------------------------------------------ the small
  all() {
    return Object.fromEntries(this.kv);
  }

  get(key) {
    return this.kv.has(key) ? this.kv.get(key) : null;
  }

  set(key, value) {
    const k = String(key);
    const v = String(value);
    if (this.kv.get(k) === v) return;
    this.kv.set(k, v);
    this.wrote(k);
  }

  del(key) {
    const k = String(key);
    if (!this.kv.has(k)) return;
    this.kv.delete(k);
    this.wrote(k);
  }

  wrote(k) {
    if (OWN_FILES[k]) {
      // (The slot list: at once, so it never says less than the saves
      // beside it hold.)
      const f = this.file(OWN_FILES[k]);
      if (this.kv.has(k)) writeWhole(f, this.kv.get(k));
      else {
        try {
          fs.unlinkSync(f);
        } catch {
          // Not there.
        }
      }
      return;
    }
    this.dirty = true;
    if (!this.timer) this.timer = setTimeout(() => this.flush(), SETTLE_MS);
  }

  // Everything not yet written, written now (as the app closes, too).
  flush() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    if (!this.dirty) return;
    this.dirty = false;
    const obj = {};
    for (const [k, v] of this.kv) if (!OWN_FILES[k]) obj[k] = v;
    writeWhole(this.file(REST), JSON.stringify(obj));
  }

  // ------------------------------------------------------------ the big
  queue(key, fn) {
    const prev = this.queues.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(fn);
    this.queues.set(key, next);
    next.finally(() => {
      if (this.queues.get(key) === next) this.queues.delete(key);
    }).catch(() => {});
    return next;
  }

  // Its text, or null.
  async getBlob(key) {
    await (this.queues.get(String(key)) || Promise.resolve()).catch(() => {});
    let buf;
    try {
      buf = await fs.promises.readFile(this.file(blobPath(key)));
    } catch {
      return null;
    }
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = await gunzip(buf);
    return buf.toString('utf8');
  }

  putBlob(key, text) {
    return this.queue(String(key), async () => writeWholeAsync(this.file(blobPath(key)), await gzip(Buffer.from(String(text), 'utf8'))));
  }

  delBlob(key) {
    return this.queue(String(key), () => fs.promises.unlink(this.file(blobPath(key))).catch(() => {}));
  }

  // Every write asked for, done.
  async settle() {
    await Promise.all([...this.queues.values()].map((p) => p.catch(() => {})));
    this.flush();
  }
}
