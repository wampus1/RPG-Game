// What a mod is (round 62): everything a player made in the Workshop, kept
// together as one thing that can be saved, sent to someone else, and
// turned on in a world.
//
// A mod is plain data (JSON), in collections by kind:
//   assets      pixel art (see newAsset): sizes, palette, layers, frames
//   vfx         effects (see mod/vfx.js): emitters and animated sprites
//   rigs        characters cut into parts on bones (see mod/rig.js)
//   structures  buildings and the like (see mod/build.js): blocks, chests
//               and their loot, triggers, spawners, where they're put
//   layouts     several structures together (a hamlet, a camp)
//   dungeons    places apart, floor upon floor, a master at the bottom
//   loot        loot tables
//   stories     new stories, as graphs (see mod/story.js)
//   patches     changes to the game's own stories
//   entities    blocks, items, creatures, effects, events (see mod/graph.js)
//   biomes      new biomes, and changes to the game's own (see mod/biomes.js)
//   worlds      the world's map: its lands, where biomes and towns go, set
//               places, realms and people (see mod/worldplan.js)
//   chargen     the character screen's tabs: new ones, and changes to the
//               game's own (see mod/chargen.js)
//
// Each thing in a mod has an id of its own, unique in the mod; the mod has
// an id that stays the same from one version of it to the next, and a hash
// of its content (exactly this version: what a world, or someone else's
// copy, is matched by).
import { hashString } from '../util/rng.js';
import { GAME_VERSION } from '../version.js';

export const MOD_FORMAT = 'tessera-mod';
export const MOD_FV = 1;
export const COLLECTIONS = ['assets', 'vfx', 'rigs', 'structures', 'layouts', 'dungeons', 'loot', 'stories', 'patches', 'entities', 'biomes', 'worlds', 'chargen'];
// (Collections a mod made before round 63 hasn't got: left out of its hash
// while empty, so its hash stays as it was.)
const LATER = ['biomes', 'worlds', 'chargen'];
// What each collection holds, said plainly (for lists and messages).
export const KIND_NAMES = {
  assets: ['art', 'art'], vfx: ['effect', 'effects'], rigs: ['rig', 'rigs'], structures: ['structure', 'structures'], layouts: ['layout', 'layouts'],
  dungeons: ['dungeon', 'dungeons'], loot: ['loot table', 'loot tables'], stories: ['story', 'stories'], patches: ['story change', 'story changes'], entities: ['entity', 'entities'],
  biomes: ['biome', 'biomes'], worlds: ['world map', 'world maps'], chargen: ['character tab', 'character tabs'],
};
// Limits that keep a mod (and a world using it) workable.
export const LIMITS = { assetSide: 256, frames: 64, layers: 16, palette: 255, blueprintSide: 96, blueprintH: 16 };

const ID_CHARS = 'abcdefghijklmnopqrstuvwxyz0123456789';
// A fresh id: `n` characters, letters and digits (the first a letter).
export function rid(n = 8) {
  const bytes = new Uint8Array(n);
  const c = globalThis.crypto;
  if (c && c.getRandomValues) c.getRandomValues(bytes);
  else for (let i = 0; i < n; i++) bytes[i] = Math.floor(Math.random() * 256);
  let s = '';
  for (let i = 0; i < n; i++) s += ID_CHARS[i === 0 ? bytes[i] % 26 : bytes[i] % 36];
  return s;
}

// A name made safe to show (and short enough to fit).
export function cleanName(s, max = 40, fallback = 'Untitled') {
  const t = String(s ?? '').replace(/[\u0000-\u001f]/g, '').trim().slice(0, max);
  return t || fallback;
}

// The key a mod's thing goes by in the game's own lists (blocks, items,
// creatures, stories): its mod's id and its own. Stable for as long as the
// mod keeps that thing, so a world that has one keeps it.
export const gameKey = (modId, thingId) => `m:${modId}:${thingId}`;
export const isModKey = (k) => typeof k === 'string' && k.startsWith('m:');
export function splitKey(k) {
  if (!isModKey(k)) return null;
  const [, mod, id] = k.split(':');
  return mod && id ? { mod, id } : null;
}

// ------------------------------------------------------------ a mod
export function newMod(o = {}) {
  const now = Date.now();
  const m = {
    format: MOD_FORMAT, fv: MOD_FV, id: o.id || rid(8),
    name: cleanName(o.name, 40, 'My Mod'), author: cleanName(o.author, 24, 'Someone'), version: o.version || '1.0.0',
    description: String(o.description || '').slice(0, 2000), color: o.color || '#ffe070', icon: o.icon || null,
    created: now, updated: now, gv: GAME_VERSION, tags: [],
  };
  for (const k of COLLECTIONS) m[k] = {};
  return m;
}

// A mod read from somewhere (a file, storage, another player): whatever's
// missing filled in, whatever's not a mod's turned away. Returns the mod
// (changed in place), or throws with why it isn't one.
export function normalizeMod(m) {
  if (!m || typeof m !== 'object') throw new Error('That isn\'t a mod.');
  if (m.format !== MOD_FORMAT) throw new Error('That isn\'t a Tessera mod (it has no mod header).');
  if (!(m.fv >= 1)) throw new Error('That mod is from a format this game can\'t read.');
  if (m.fv > MOD_FV) throw new Error('That mod was made by a newer version of the game: update the game to use it.');
  if (typeof m.id !== 'string' || !/^[a-z][a-z0-9]{3,31}$/.test(m.id)) throw new Error('That mod\'s id is damaged.');
  m.name = cleanName(m.name, 40, 'A Mod');
  m.author = cleanName(m.author, 24, 'Someone');
  m.version = cleanName(m.version, 16, '1.0.0');
  m.description = String(m.description || '').slice(0, 2000);
  m.color = /^#[0-9a-f]{6}$/i.test(m.color || '') ? m.color : '#ffe070';
  m.tags = Array.isArray(m.tags) ? m.tags.map((t) => cleanName(t, 16, '')).filter(Boolean).slice(0, 8) : [];
  for (const k of COLLECTIONS) {
    if (!m[k] || typeof m[k] !== 'object' || Array.isArray(m[k])) m[k] = {};
    for (const [id, v] of Object.entries(m[k])) {
      if (!v || typeof v !== 'object' || !/^[a-z0-9_]{1,32}$/.test(id)) delete m[k][id];
      else {
        v.id = id;
        v.name = cleanName(v.name, 48, id);
      }
    }
  }
  m.created ||= Date.now();
  m.updated ||= m.created;
  return m;
}

// Everything in a mod, as [collection, id, thing].
export function* things(m) {
  for (const k of COLLECTIONS) for (const [id, v] of Object.entries(m[k] || {})) yield [k, id, v];
}

export function countThings(m) {
  let n = 0;
  for (const k of COLLECTIONS) n += Object.keys(m[k] || {}).length;
  return n;
}

// A new id for something in collection `k` of the mod (short, and not
// taken).
export function freeId(m, k, stem = '') {
  const base = String(stem || '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 20);
  const taken = (id) => COLLECTIONS.some((c) => m[c] && m[c][id]);
  if (base && !taken(base)) return base;
  for (let i = 2; i < 999; i++) if (base && !taken(`${base}_${i}`)) return `${base}_${i}`;
  for (;;) {
    const id = rid(6);
    if (!taken(id)) return id;
  }
}

// ------------------------------------------------------------ hashing
// The same JSON for the same content, whatever order its keys were set in.
export function canonical(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null);
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  const keys = Object.keys(v).filter((k) => v[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
}

// What a mod is, exactly (sixteen hex digits). Not when it was last saved:
// what's in it.
export function modHash(m) {
  const rest = { ...m };
  delete rest.updated;
  delete rest.created;
  delete rest.hash;
  for (const k of LATER) if (rest[k] && typeof rest[k] === 'object' && !Object.keys(rest[k]).length) delete rest[k];
  const s = canonical(rest);
  const a = hashString(s) >>> 0;
  const b = hashString(`${s.length}|${s.slice(0, 4096)}|${s.slice(-4096)}`) ^ (a * 2654435761);
  return a.toString(16).padStart(8, '0') + (b >>> 0).toString(16).padStart(8, '0');
}

// A mod's summary, as a world (or a list of worlds) keeps it.
export function modRef(m) {
  return { id: m.id, hash: m.hash || modHash(m), name: m.name, version: m.version, author: m.author, color: m.color };
}

// ------------------------------------------------------------ files
// A mod as a file to keep or send (JSON, one line).
export function exportMod(m) {
  normalizeMod(m);
  const out = { ...m, gv: GAME_VERSION };
  out.hash = modHash(out);
  return JSON.stringify(out);
}

// A mod from a file's text. Throws with why not.
export function importMod(text) {
  let m;
  try {
    m = JSON.parse(text);
  } catch {
    throw new Error('That file isn\'t a mod (it couldn\'t be read).');
  }
  normalizeMod(m);
  m.hash = modHash(m);
  return m;
}

// ------------------------------------------------------------ pixel data
// A layer of a frame of pixel art (a cel) is kept as palette indices (0
// clear, 1.. the palette's colours), run-length packed and then written as
// base64: [run, index] byte pairs, a run of up to 255.
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function toBase64(bytes) {
  let s = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    s += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  const left = bytes.length - i;
  if (left === 1) {
    const n = bytes[i] << 16;
    s += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}==`;
  } else if (left === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    s += `${B64[(n >> 18) & 63]}${B64[(n >> 12) & 63]}${B64[(n >> 6) & 63]}=`;
  }
  return s;
}
const B64_IDX = new Int16Array(128).fill(-1);
for (let i = 0; i < 64; i++) B64_IDX[B64.charCodeAt(i)] = i;
export function fromBase64(s) {
  const clean = String(s || '').replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = B64_IDX[clean.charCodeAt(i)];
    const b = B64_IDX[clean.charCodeAt(i + 1)];
    const c = i + 2 < clean.length ? B64_IDX[clean.charCodeAt(i + 2)] : 0;
    const d = i + 3 < clean.length ? B64_IDX[clean.charCodeAt(i + 3)] : 0;
    const n = (a << 18) | (b << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    if (o < out.length) out[o++] = (n >> 16) & 255;
    if (o < out.length && i + 2 < clean.length) out[o++] = (n >> 8) & 255;
    if (o < out.length && i + 3 < clean.length) out[o++] = n & 255;
  }
  return out.subarray(0, o);
}

// Indices (a Uint8Array of w*h) to text, and back.
export function encodeCel(idx) {
  const out = [];
  let i = 0;
  while (i < idx.length) {
    const v = idx[i];
    let run = 1;
    while (i + run < idx.length && run < 255 && idx[i + run] === v) run++;
    out.push(run, v);
    i += run;
  }
  return toBase64(out);
}
export function decodeCel(text, n) {
  const out = new Uint8Array(n);
  if (!text) return out;
  const b = fromBase64(text);
  let o = 0;
  for (let i = 0; i + 1 < b.length && o < n; i += 2) {
    const run = Math.min(b[i], n - o);
    out.fill(b[i + 1], o, o + run);
    o += run;
  }
  return out;
}

// ------------------------------------------------------------ pixel art
// A palette worth starting with: warm and cool ramps that sit well with
// the game's own colours (and its outline, first).
export const DEFAULT_PALETTE = [
  '#1c1622', '#3a3044', '#5e5470', '#8a8496', '#c0bccb', '#f4ecd8',
  '#4a2a1e', '#7a4a2e', '#a8744a', '#d8a868', '#f0d8a0',
  '#3a1a1e', '#7a2a2e', '#c0403a', '#ff7a50', '#ffb878',
  '#4a3a10', '#8a6a1a', '#d8a828', '#ffe070', '#fff4c0',
  '#14301e', '#2e5e2e', '#4a9a3a', '#8ccc58', '#c8f090',
  '#10243e', '#1e4a7a', '#2f7ac0', '#60b0f0', '#a8e0ff',
  '#2a1a3e', '#5a2a7a', '#9050c0', '#c890ff', '#f0c8ff',
];

export const hexToRgba = (h) => {
  const s = String(h || '#000').replace('#', '');
  const v = s.length === 3 ? s.split('').map((c) => c + c).join('') : s;
  return [parseInt(v.slice(0, 2), 16) || 0, parseInt(v.slice(2, 4), 16) || 0, parseInt(v.slice(4, 6), 16) || 0, v.length >= 8 ? parseInt(v.slice(6, 8), 16) : 255];
};
export const rgbaToHex = (r, g, b, a = 255) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}${a < 255 ? Math.round(a).toString(16).padStart(2, '0') : ''}`;

// A fresh piece of pixel art: `w` x `h`, one layer, one frame.
export function newAsset(o = {}) {
  const w = Math.max(1, Math.min(LIMITS.assetSide, o.w | 0 || 16));
  const h = Math.max(1, Math.min(LIMITS.assetSide, o.h | 0 || 16));
  const layer = { id: 'l1', name: 'Layer 1', visible: true, opacity: 1, blend: 'normal' };
  return {
    id: o.id || rid(6), name: cleanName(o.name, 48, 'Sprite'), w, h, use: o.use || 'sprite', fps: 8,
    palette: (o.palette || DEFAULT_PALETTE).slice(0, LIMITS.palette),
    layers: [layer], frames: [{ dur: 125, cels: { l1: encodeCel(new Uint8Array(w * h)) } }],
    tags: [], pivot: { x: Math.floor(w / 2), y: h - 1 },
  };
}

// The colours of one frame, all its layers laid one on another (what shows
// of it): RGBA, w*h*4. `o.layers`: only these (ids); `o.cels`: the cels
// already unpacked, by layer id (an editor's working copy).
export function composite(asset, frame = 0, o = {}) {
  const { w, h } = asset;
  const out = new Uint8ClampedArray(w * h * 4);
  const fr = asset.frames[Math.max(0, Math.min(asset.frames.length - 1, frame))];
  if (!fr) return out;
  const pal = asset.palette.map(hexToRgba);
  for (const L of asset.layers) {
    if (!L.visible && !(o.layers && o.layers.includes(L.id))) continue;
    if (o.layers && !o.layers.includes(L.id)) continue;
    const cel = o.cels && o.cels[L.id] ? o.cels[L.id] : decodeCel(fr.cels && fr.cels[L.id], w * h);
    const op = L.opacity ?? 1;
    const add = L.blend === 'add';
    const mul = L.blend === 'multiply';
    for (let i = 0; i < w * h; i++) {
      const ci = cel[i];
      if (!ci) continue;
      const c = pal[ci - 1];
      if (!c) continue;
      const a = (c[3] / 255) * op;
      if (a <= 0) continue;
      const j = i * 4;
      const da = out[j + 3] / 255;
      if (add) {
        out[j] += c[0] * a;
        out[j + 1] += c[1] * a;
        out[j + 2] += c[2] * a;
        out[j + 3] = Math.max(out[j + 3], a * 255);
      } else if (mul && da > 0) {
        out[j] = out[j] * (1 - a) + ((out[j] * c[0]) / 255) * a;
        out[j + 1] = out[j + 1] * (1 - a) + ((out[j + 1] * c[1]) / 255) * a;
        out[j + 2] = out[j + 2] * (1 - a) + ((out[j + 2] * c[2]) / 255) * a;
      } else {
        const na = a + da * (1 - a);
        out[j] = (c[0] * a + out[j] * da * (1 - a)) / na;
        out[j + 1] = (c[1] * a + out[j + 1] * da * (1 - a)) / na;
        out[j + 2] = (c[2] * a + out[j + 2] * da * (1 - a)) / na;
        out[j + 3] = na * 255;
      }
    }
  }
  return out;
}

// RGBA pixels made `w` x `h` (nearest pixel: pixel art stays crisp).
// `fit`: 'stretch', or 'contain' (kept in proportion, centred, and set on
// the bottom when `bottom`).
export function resample(src, sw, sh, w, h, fit = 'stretch', bottom = false) {
  const out = new Uint8ClampedArray(w * h * 4);
  if (sw === w && sh === h) {
    out.set(src);
    return out;
  }
  let sx = sw / w;
  let sy = sh / h;
  let ox = 0;
  let oy = 0;
  let dw = w;
  let dh = h;
  if (fit === 'contain' || fit === 'native') {
    // (Native, round 65: as drawn, pixel for pixel, made smaller only if
    // it must be.)
    const k = fit === 'native' ? Math.max(1, sw / w, sh / h) : Math.max(sw / w, sh / h);
    sx = sy = k;
    dw = Math.round(sw / k);
    dh = Math.round(sh / k);
    ox = Math.floor((w - dw) / 2);
    oy = bottom ? h - dh : Math.floor((h - dh) / 2);
  }
  for (let y = 0; y < dh; y++) {
    for (let x = 0; x < dw; x++) {
      const px = Math.min(sw - 1, Math.floor((x + 0.5) * sx));
      const py = Math.min(sh - 1, Math.floor((y + 0.5) * sy));
      const i = (py * sw + px) * 4;
      const j = ((y + oy) * w + x + ox) * 4;
      out[j] = src[i];
      out[j + 1] = src[i + 1];
      out[j + 2] = src[i + 2];
      out[j + 3] = src[i + 3];
    }
  }
  return out;
}

// The art of one of a mod's things, as RGBA at a size (a frame of it):
// { w, h, d, src }.
export function assetPixels(mod, assetId, frame = 0, w = null, h = null, fit = 'contain', bottom = false) {
  const a = mod && mod.assets && mod.assets[assetId];
  if (!a) return null;
  const rgba = composite(a, frame);
  const W = w || a.w;
  const H = h || a.h;
  return { w: W, h: H, d: resample(rgba, a.w, a.h, W, H, fit, bottom), src: a };
}

// The frames of an animation tag (or all of them): [first, last].
export function tagRange(asset, tag) {
  const t = tag && (asset.tags || []).find((q) => q.name === tag);
  return t ? [t.from, t.to] : [0, asset.frames.length - 1];
}

// ------------------------------------------------------------ problems
// What's wrong with a mod, as [{ level: 'error'|'warn', where: [kind, id],
// text }]: things pointing at what isn't there, art missing where it's
// wanted. (The editors show it; nothing here stops a mod being used.)
export function problems(m, extra = []) {
  const out = [];
  const has = (k, id) => !!(m[k] && m[k][id]);
  const ref = (where, k, id, what) => {
    if (id && !has(k, id)) out.push({ level: 'error', where, text: `${what} points at ${KIND_NAMES[k][0]} "${id}", which isn't in this mod any more.` });
  };
  // (What a choice on the character screen gives: what it points at.)
  const gives = (where, what, o) => {
    const e = o.effects || {};
    if (o.art) ref(where, 'assets', o.art, what);
    for (const [it] of Array.isArray(e.items) ? e.items : []) if (typeof it === 'string' && it[0] === '@') ref(where, 'entities', it.slice(1), what);
    if (typeof e.companion === 'string' && e.companion[0] === '@') ref(where, 'entities', e.companion.slice(1), what);
    if (typeof e.effect === 'string') ref(where, 'entities', e.effect.replace(/^@/, ''), what);
    if (e.story) ref(where, 'stories', String(e.story).replace(/^@/, ''), what);
    if (e.start && e.start !== 'spawn' && !Object.values(m.worlds || {}).some((w) => (w.places || []).some((p) => p.id === e.start))) out.push({ level: 'warn', where, text: `${what} begins characters by a world map place that's gone.` });
    if (e.start === 'spawn' && !Object.values(m.worlds || {}).some((w) => w.spawn)) out.push({ level: 'warn', where, text: `${what} begins characters where the world map says, and no world map says.` });
  };
  for (const [k, id, v] of things(m)) {
    const where = [k, id];
    if (k === 'assets') {
      if (!Array.isArray(v.frames) || !v.frames.length) out.push({ level: 'error', where, text: `"${v.name}" has no frames.` });
    } else if (k === 'rigs') ref(where, 'assets', v.asset, `Rig "${v.name}"`);
    else if (k === 'dungeons') {
      ref(where, 'structures', v.entrance, `Dungeon "${v.name}"'s entrance`);
      (v.floors || []).forEach((f, i) => ref(where, 'structures', f, `Dungeon "${v.name}" floor ${i + 1}`));
      if (!(v.floors || []).length) out.push({ level: 'warn', where, text: `Dungeon "${v.name}" has no floors yet.` });
    } else if (k === 'layouts') {
      for (const p of v.pieces || []) ref(where, 'structures', p.structure, `Layout "${v.name}"`);
    } else if (k === 'structures') {
      for (const c of v.containers || []) if (c.loot) ref(where, 'loot', c.loot, `A chest in "${v.name}"`);
    } else if (k === 'biomes') {
      for (const t of v.trees || []) if (t.structure) ref(where, 'structures', t.structure, `Biome "${v.name}"'s tree`);
      if (!v.change && v.place && v.place.how === 'painted' && !Object.keys(m.worlds || {}).length) out.push({ level: 'warn', where, text: `Biome "${v.name}" only grows where it's painted on a world map, and this mod has no world map.` });
    } else if (k === 'worlds') {
      for (const p of v.places || []) ref(where, p.kind, p.ref, `World map "${v.name}"'s place`);
      for (const p of v.people || []) if (typeof p.ent === 'string' && p.ent[0] === '@') ref(where, 'entities', p.ent.slice(1), `Someone on world map "${v.name}"`);
    } else if (k === 'chargen') {
      const what = `Character tab "${v.name}"`;
      for (const r of v.rows || []) {
        if ((r.kind === 'pick' || r.kind === 'many' || !r.kind) && !(r.options || []).length) out.push({ level: 'warn', where, text: `${what}: its row "${r.label || r.id}" has nothing to choose.` });
        if (r.kind === 'points' && !(r.entries || []).length) out.push({ level: 'warn', where, text: `${what}: its row "${r.label || r.id}" has nothing to spend points on.` });
        for (const o of [...(r.options || []), ...(r.entries || [])]) gives(where, `${what}, "${o.name || o.id}"`, o);
      }
      for (const L of Object.values(v.add || {})) for (const o of L || []) gives(where, `${what}, "${o.name || o.id}"`, o);
    }
  }
  // (Two rows of the character screen by one id: graphs and characters
  // would take one for the other.)
  const rowIds = new Map();
  for (const [id, v] of Object.entries(m.chargen || {})) for (const r of v.rows || []) {
    if (rowIds.has(r.id)) out.push({ level: 'warn', where: ['chargen', id], text: `Character tab "${v.name}" has a row "${r.label || r.id}" whose id ("${r.id}") another row has too (a copied tab?): delete one of them, and add it again.` });
    else rowIds.set(r.id, id);
  }
  return [...out, ...extra];
}
