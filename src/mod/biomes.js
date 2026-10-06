// Mods' biomes in the game (round 63): new ones added to the game's list
// (BIOMES) for the world being played, changes to the game's own laid over
// them (and taken off again when the world's left), trees built in the
// Builder growing in them, the creatures that come out in them, and where
// in a new world they grow.
//
// A biome, as the Workshop keeps it (all its numbers in the Workshop's
// own units: percents and the like):
//   { name, base (the game's biome it started from: whatever isn't set
//     comes from it), change (a game biome's key: this changes that one
//     rather than being a new one), char, fg, bg (on the world map),
//     surface, sub, patches [{ block, size, amount }], hills (0-3),
//     water ('none' | 'ponds' | 'pools'), liquid ('water' | 'lava' |
//     'ice' | 'mud', round 65), climate, bank, bed, reeds,
//     lilies, rain (percent), snowy, trees [{ tree | structure, w }],
//     treeSpacing, treeChance, clump, wetTrees, plants [{ block, w }],
//     plantDensity, rocks (per thousand), creatures { day, night: [{
//     species, w }], mode 'add' | 'only' }, settle (-100..100), style,
//     music, musicNight (round 66: a theme's key, or the mod's song or
//     sound, '@id'), place { how: 'climate' | 'replace' | 'painted', isles, temp
//     [lo, hi], moist [lo, hi] (percents), replaces, share (percent) } }
import { MODS } from './state.js';
export { CLIMATE_OF, modBiomeFor, climateOf } from './biomerules.js';
import { BIOMES, BIOME_STYLE, BIOME_SETTLE } from '../world/biomes.js';
import { B, BLOCKS } from '../world/blocks.js';
import { TREE_BUILDERS } from '../world/trees.js';
import { SPECIES } from '../entities/creature.js';
import { gameKey } from './format.js';
import { bpDecode, bpAt, blockIdOf } from './build.js';
import { hashString } from '../util/rng.js';

// The game's biomes a mod can change, or start a new one from (the sea,
// the shore and the fire mountain aren't).
export const GAME_BIOMES = Object.keys(BIOMES).filter((k) => !['ocean', 'beach', 'volcano'].includes(k));
export const CLIMATES = ['mild', 'warm', 'cold', 'hot'];
// (Round 65) What a biome's ponds and pools can hold (water: the game's
// own way, nothing to set).
export const LIQUIDS = { water: 0, lava: B.lava, ice: B.ice, mud: B.mud };
const LIQUID_OF = { [B.lava]: 'lava', [B.ice]: 'ice', [B.mud]: 'mud' };
export const STYLES = ['vale', 'north', 'sun', 'wild', 'high', 'ember', 'mist', 'tide'];

const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// A biome's key in the game (a new one's: its mod's and its own; a change:
// the game's biome it changes).
export const biomeKey = (mod, b) => (b.change && BIOMES[b.change] ? b.change : gameKey(mod.id, b.id));

// A reference to a biome in a mod's things ('@id' one of its own, 'm:..'
// another mod's, or the game's own key) as the game's key.
export function biomeRef(mod, ref) {
  if (!ref) return null;
  if (ref[0] === '@') return gameKey(mod.id, ref.slice(1));
  return ref;
}

// The game's biome `k` in the Workshop's terms (to start a new one from,
// or to show a change against).
export function biomeFields(k) {
  const g = BIOMES[k] || BIOMES.plains;
  const nm = (id) => (BLOCKS[id] ? BLOCKS[id].name : 'grass');
  return {
    char: g.char, fg: g.fg, bg: g.bg,
    surface: nm(g.surface), sub: nm(g.sub),
    patches: (g.patches || []).map(([id, size, thr]) => ({ block: nm(id), size, amount: Math.round((1 - thr) * 100) })),
    hills: g.hills ?? 1, water: g.pools ? 'pools' : g.ponds ? 'ponds' : 'none', liquid: LIQUID_OF[g.liquid] || 'water',
    climate: g.climate || 'mild', bank: g.bank !== undefined ? nm(g.bank) : null, bed: g.bed || null,
    reeds: g.reeds !== false, lilies: !!g.lilies, rain: Math.round((g.rain ?? 1) * 100), snowy: !!g.snowy,
    trees: (g.trees || []).map(([t, w]) => ({ tree: t, w })), treeSpacing: g.treeSpacing ?? 7, treeChance: Math.round((g.treeChance ?? 0) * 100), clump: Math.round((g.clump ?? 0) * 100), wetTrees: !!g.wetTrees,
    plants: (g.plants || []).map(([id, w]) => ({ block: nm(id), w })), plantDensity: Math.round((g.plantDensity ?? 0) * 100), rocks: +((g.rocks ?? 0) * 1000).toFixed(1),
    settle: Math.round((BIOME_SETTLE[k] ?? 0) * 100), style: BIOME_STYLE[k] || 'vale', music: k,
  };
}

// A mod's biome as the game keeps one (BIOMES' own shape), from the
// game's biome it starts from.
export function compileBiome(mod, b) {
  const baseKey = BIOMES[b.change] ? b.change : BIOMES[b.base] ? b.base : 'plains';
  const g = BIOMES[baseKey];
  const blk = (ref, d) => {
    const id = ref ? blockIdOf(mod, ref) : null;
    return id === null || id === undefined ? d : id;
  };
  const out = { ...g, patches: (g.patches || []).slice(), trees: g.trees.slice(), plants: g.plants.slice() };
  // (Its name in the game: a new one's own; a change keeps the game's
  // unless it's given one.)
  const title = b.title || (b.change ? null : b.name);
  if (title) out.name = String(title).slice(0, 32);
  if (b.char && [...String(b.char)].length === 1) out.char = b.char;
  if (/^#[0-9a-f]{6}$/i.test(b.fg || '')) out.fg = b.fg;
  if (/^#[0-9a-f]{6}$/i.test(b.bg || '')) out.bg = b.bg;
  out.surface = blk(b.surface, g.surface);
  out.sub = blk(b.sub, g.sub);
  if (Array.isArray(b.patches)) out.patches = b.patches.map((p) => [blk(p.block, null), clamp(num(p.size, 8), 2, 40), clamp(1 - num(p.amount, 30) / 100, 0, 0.999)]).filter((p) => p[0] !== null).slice(0, 8);
  if (b.hills !== undefined) out.hills = clamp(Math.round(num(b.hills, 1)), 0, 3);
  if (b.water) {
    out.ponds = b.water === 'ponds';
    out.pools = b.water === 'pools';
  }
  // (Round 65) What's in its ponds and pools.
  if (b.liquid !== undefined) {
    const id = LIQUIDS[b.liquid];
    if (id) out.liquid = id;
    else delete out.liquid;
  }
  if (CLIMATES.includes(b.climate)) out.climate = b.climate;
  if (b.bank !== undefined) {
    const id = b.bank ? blk(b.bank, null) : null;
    if (id === null) delete out.bank;
    else out.bank = id;
  }
  if (b.bed !== undefined) out.bed = b.bed === 'mud' ? 'mud' : undefined;
  if (b.reeds !== undefined) out.reeds = b.reeds !== false;
  if (b.lilies !== undefined) out.lilies = !!b.lilies;
  if (b.rain !== undefined) out.rain = clamp(num(b.rain, 100), 0, 300) / 100;
  if (b.snowy !== undefined) out.snowy = !!b.snowy;
  if (Array.isArray(b.trees)) {
    out.trees = [];
    for (const t of b.trees.slice(0, 12)) {
      const w = clamp(num(t.w, 1), 0, 100);
      if (!w) continue;
      if (t.structure) {
        const key = treeOfStructure(mod, t.structure);
        if (key) out.trees.push([key, w]);
      } else if (TREE_BUILDERS[t.tree]) out.trees.push([t.tree, w]);
    }
  }
  if (b.treeSpacing !== undefined) out.treeSpacing = clamp(Math.round(num(b.treeSpacing, 7)), 3, 16);
  if (b.treeChance !== undefined) out.treeChance = clamp(num(b.treeChance, 10), 0, 100) / 100;
  if (b.clump !== undefined) out.clump = clamp(num(b.clump, 30), 0, 100) / 100;
  if (b.wetTrees !== undefined) out.wetTrees = !!b.wetTrees;
  if (Array.isArray(b.plants)) out.plants = b.plants.map((p) => [blk(p.block, null), clamp(num(p.w, 1), 0, 100)]).filter((p) => p[0] !== null && p[1] > 0).slice(0, 16);
  if (b.plantDensity !== undefined) out.plantDensity = clamp(num(b.plantDensity, 20), 0, 100) / 100;
  if (b.rocks !== undefined) out.rocks = clamp(num(b.rocks, 3), 0, 100) / 1000;
  // (Round 66) Its music: one of the game's themes (by key), or one of the
  // mod's songs or sounds ('@id'); and its nights' own, if it has any.
  const tune = (v) => (typeof v !== 'string' || !v ? null : v[0] === '@' ? { song: gameKey(mod.id, v.slice(1)) } : /^[a-z_]+$/.test(v) ? { music: v } : null);
  // (One or the other: a change made over another mod's change keeps none
  // of that one's music where it gives its own.)
  const day = tune(b.music);
  if (day) {
    delete out.song;
    delete out.music;
    if (day.song) out.song = day.song;
    else out.music = day.music;
  }
  const night = tune(b.musicNight);
  if (night) {
    delete out.songNight;
    delete out.musicNight;
    if (night.song) out.songNight = night.song;
    else out.musicNight = night.music;
  }
  // (Its plants grow on its own ground, whatever that is.)
  out.grows = new Set([out.surface, ...(out.patches || []).map((p) => p[0])]);
  out.mod = mod.id;
  out.modBiome = b.id;
  // (What the game's own code takes it for where it asks by name: the
  // biome it started from.)
  out.like = BIOMES[baseKey].like || baseKey;
  delete out.isle;
  return out;
}

// A structure made in the Builder as a kind of tree: its blocks round its
// footprint's middle, its ground layer under the ground (turned any of
// four ways, at random, as it's grown). Its key in TREE_BUILDERS.
const treeKeys = new Set();
function treeOfStructure(mod, id) {
  const st = mod.structures && mod.structures[id];
  if (!st) return null;
  const key = gameKey(mod.id, `tree_${id}`);
  if (TREE_BUILDERS[key]) return key;
  const { idx, meta } = bpDecode(st);
  const ids = (st.pal || []).map((r) => blockIdOf(mod, r));
  const g = st.ground ?? 1;
  const cx = Math.floor(st.w / 2);
  const cz = Math.floor(st.d / 2);
  const cells = [];
  for (let y = g + 1; y < st.h; y++) for (let z = 0; z < st.d; z++) for (let x = 0; x < st.w; x++) {
    const i = bpAt(st, x, y, z);
    const v = idx[i];
    const b = v ? ids[v] : null;
    if (b === null || b === undefined || b === B.air) continue;
    // (Within reach of its trunk: see trees.TREE_MARGIN.)
    if (Math.abs(x - cx) > 4 || Math.abs(z - cz) > 4) continue;
    cells.push([x - cx, y - g - 1, z - cz, b, meta[i]]);
  }
  if (!cells.length) return null;
  TREE_BUILDERS[key] = (rand) => {
    const r = Math.floor(rand() * 4);
    return cells.map(([dx, dy, dz, b]) => {
      const [tx, tz] = r === 1 ? [-dz, dx] : r === 2 ? [-dx, -dz] : r === 3 ? [dz, -dx] : [dx, dz];
      return [tx, dy, tz, b];
    });
  };
  treeKeys.add(key);
  return key;
}

// ------------------------------------------------------------ in and out
const saved = new Map(); // game biome key -> { def, style, settle } as it was
const addedKeys = [];

function install() {
  MODS.biomeRules = [];
  MODS.biomeSpawns = new Map();
  for (const m of MODS.active) {
    for (const b of Object.values(m.biomes || {})) {
      const key = biomeKey(m, b);
      const isChange = !!(b.change && BIOMES[b.change]);
      if (isChange && !saved.has(key)) saved.set(key, { def: BIOMES[key], style: BIOME_STYLE[key], settle: BIOME_SETTLE[key] });
      const def = compileBiome(m, b);
      if (isChange) {
        // (A change keeps the game's own name for it unless it's given one.)
        def.mod = undefined;
        def.grows = undefined;
      }
      BIOMES[key] = def;
      if (!isChange) addedKeys.push(key);
      if (STYLES.includes(b.style)) BIOME_STYLE[key] = b.style;
      else if (!isChange) BIOME_STYLE[key] = BIOME_STYLE[b.base] || 'vale';
      if (b.settle !== undefined) BIOME_SETTLE[key] = clamp(num(b.settle, 0), -100, 100) / 100;
      else if (!isChange) BIOME_SETTLE[key] = BIOME_SETTLE[b.base] ?? 0;
      // Who comes out in it.
      const C = b.creatures;
      if (C && ((C.day || []).length || (C.night || []).length || C.mode === 'only')) {
        const list = (arr) => (arr || []).map((q) => [q.species && q.species[0] === '@' ? gameKey(m.id, q.species.slice(1)) : q.species, clamp(num(q.w, 1), 0, 100)]).filter((q) => q[0] && q[1] > 0);
        MODS.biomeSpawns.set(key, { day: list(C.day), night: list(C.night), only: C.mode === 'only' });
      }
      // Where it grows in a new world.
      const P = b.place;
      if (!isChange && P && (P.how === 'climate' || P.how === 'replace')) {
        MODS.biomeRules.push({
          key, how: P.how, isles: Array.isArray(P.isles) ? P.isles.slice() : [],
          temp: [clamp(num(P.temp?.[0], 0), 0, 100) / 100, clamp(num(P.temp?.[1], 100), 0, 100) / 100],
          moist: [clamp(num(P.moist?.[0], 0), 0, 100) / 100, clamp(num(P.moist?.[1], 100), 0, 100) / 100],
          replaces: P.replaces || null, share: clamp(num(P.share, 30), 0, 100) / 100, salt: hashString(key) & 0xffff,
        });
      }
    }
  }
}

function uninstall() {
  for (const k of addedKeys) {
    delete BIOMES[k];
    delete BIOME_STYLE[k];
    delete BIOME_SETTLE[k];
  }
  addedKeys.length = 0;
  for (const [k, s] of saved) {
    BIOMES[k] = s.def;
    if (s.style === undefined) delete BIOME_STYLE[k];
    else BIOME_STYLE[k] = s.style;
    if (s.settle === undefined) delete BIOME_SETTLE[k];
    else BIOME_SETTLE[k] = s.settle;
  }
  saved.clear();
  for (const k of treeKeys) delete TREE_BUILDERS[k];
  treeKeys.clear();
  MODS.biomeRules = [];
  MODS.biomeSpawns = new Map();
}

// Where one mod's new biomes grow (its rules, as MODS.biomeRules has them).
export function biomeRulesOf(mod) {
  const out = [];
  for (const b of Object.values(mod.biomes || {})) {
    const P = b.place;
    if (b.change || !P || (P.how !== 'climate' && P.how !== 'replace')) continue;
    const key = gameKey(mod.id, b.id);
    out.push({
      key, how: P.how, isles: Array.isArray(P.isles) ? P.isles.slice() : [],
      temp: [clamp(num(P.temp?.[0], 0), 0, 100) / 100, clamp(num(P.temp?.[1], 100), 0, 100) / 100],
      moist: [clamp(num(P.moist?.[0], 0), 0, 100) / 100, clamp(num(P.moist?.[1], 100), 0, 100) / 100],
      replaces: P.replaces || null, share: clamp(num(P.share, 30), 0, 100) / 100, salt: hashString(key) & 0xffff,
    });
  }
  return out;
}

// `fn()` with one mod's biomes (and its changes to the game's) in the
// game's list for as long as it takes: for the Workshop's map of a world
// made with it, outside any game. (Nothing's done if mods are in play.)
export function withBiomes(mod, fn) {
  if (MODS.active.length) return fn();
  const put = [];
  try {
    for (const b of Object.values(mod.biomes || {})) {
      const key = biomeKey(mod, b);
      put.push([key, BIOMES[key]]);
      const def = compileBiome(mod, b);
      BIOMES[key] = def;
    }
    return fn();
  } finally {
    for (const [k, was] of put.reverse()) {
      if (was) BIOMES[k] = was;
      else delete BIOMES[k];
    }
  }
}

MODS.hooks.install.unshift(() => install());
MODS.hooks.uninstall.push(() => uninstall());
MODS.biomeRules = [];
MODS.biomeSpawns = new Map();

// ------------------------------------------------------------ in play
// What comes out in a biome a mod has said so for: a species; null (the
// game's own, then); or false (nothing: its list alone, and that empty).
// Its list alone ('only'), or its list among the game's (as common as its
// weights say, against the game's ten).
export function biomeSpawn(biome, night) {
  const S = MODS.biomeSpawns && MODS.biomeSpawns.get(biome);
  if (!S) return null;
  const list = (night ? S.night : S.day).filter(([k]) => SPECIES[k]);
  if (!list.length) return S.only ? false : null;
  const total = list.reduce((s, [, w]) => s + w, 0);
  if (!S.only && Math.random() * (total + 10) >= total) return null;
  let r = Math.random() * total;
  for (const [k, w] of list) if ((r -= w) <= 0) return k;
  return list[list.length - 1][0];
}

