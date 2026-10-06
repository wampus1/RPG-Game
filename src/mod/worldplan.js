// A mod's world map in the game (round 63): the lie of the land (the
// game's landmasses moved, reshaped, renamed, their numbers of realms and
// towns changed, which biomes they take, and new ones), land and sea
// painted on the map, biomes painted on it, where towns may and mayn't be
// founded, places set down where they're wanted, realms founded where
// they're wanted, and people set in the world or in a realm.
//
// A world map, as the Workshop keeps it:
//   { name, base ('game': the game's world to change; 'sea': open sea but
//     for the three islands), lands [{ key, name, kind ('dagoni' lived
//     in, 'continent', 'isle'), cx, cz, rx, rz (map squares), rough,
//     blob (false: only what's painted), climate, allow [biomes], civs,
//     towns, villages, rivers, lakes, dungeons, spires }], paint { land
//     (1 land, 2 sea), biome (an index into legend), legend [biomes],
//     town (1 towns here, 2 no towns) } (each a map's worth of squares,
//     packed as format.encodeCel packs a cel), places [{ id, kind
//     ('structures' | 'layouts' | 'dungeons'), ref, cx, cz }], people [{
//     id, ent ('@npc'), cx, cz, realm (a realm's id: they live in its
//     capital), home ('capital' | 'any') }], realms [{ id, name, style,
//     color, values, cx, cz }], spawn ({ cx, cz }: where new characters
//     begin, or null) }
import { MODS } from './state.js';
import { decodeCel, encodeCel, gameKey } from './format.js';
import { MAP_W, MAP_H } from '../config.js';
import { LANDMASSES, DAGONI_KEYS } from '../world/geography.js';

export const WN = MAP_W * MAP_H;
export const ROLES = ['dagoni', 'continent', 'isle'];
export const CLIMATES = { '': 'As the game has it', n2s: 'Cold north, hot south', s2n: 'Hot north, cold south', cold: 'Cold all over', mild: 'Mild all over', warm: 'Warm all over' };
export const VALUES = ['martial', 'mercantile', 'pious', 'scholarly', 'agrarian', 'seafaring', 'artisan'];
const KEEP = ['thessa', 'kharos', 'myrrow'];

const num = (v, d, a, b) => Math.max(a, Math.min(b, typeof v === 'number' && Number.isFinite(v) ? v : d));

// The game's landmasses as a world map keeps them (to change).
export function gameLands(base = 'game') {
  return LANDMASSES.filter((L) => base !== 'sea' || KEEP.includes(L.key)).map((L) => ({ ...L }));
}

// A world map's grids, unpacked (missing ones empty).
export function grids(w) {
  const P = w.paint || {};
  return { land: decodeCel(P.land, WN), biome: decodeCel(P.biome, WN), town: decodeCel(P.town, WN), legend: (P.legend || []).slice(0, 250) };
}
export function packGrid(g) {
  return g.some((v) => v) ? encodeCel(g) : '';
}

// A biome named in a world map ('@id' the mod's own) as the game's key.
const biomeKey = (mod, r) => (typeof r === 'string' && r[0] === '@' ? gameKey(mod.id, r.slice(1)) : r);

// The world map as the game uses it (see worldgen.Overworld): checked,
// filled out, its grids unpacked, its biomes the game's keys.
export function compilePlan(mod, w) {
  const g = grids(w);
  const lands = [];
  const seen = new Set();
  for (const L of Array.isArray(w.lands) && w.lands.length ? w.lands : gameLands(w.base)) {
    if (!L || typeof L.key !== 'string' || seen.has(L.key) || L.key === 'wilds') continue;
    seen.add(L.key);
    const game = LANDMASSES.find((q) => q.key === L.key);
    const kind = KEEP.includes(L.key) ? 'dagoni' : ROLES.includes(L.kind) ? L.kind : 'isle';
    const o = {
      key: L.key, name: String(L.name || (game && game.name) || 'An island').slice(0, 32), kind,
      cx: num(L.cx, 50, 1, MAP_W - 2), cz: num(L.cz, 50, 1, MAP_H - 2), rx: num(L.rx, 6, 0.5, 140), rz: num(L.rz, 4, 0.5, 100), rough: num(L.rough, 0.3, 0, 0.9),
      about: String(L.about || (game && game.about) || 'an island of a mod\'s').slice(0, 120), blob: L.blob !== false,
    };
    if (L.climate && CLIMATES[L.climate]) o.climate = L.climate;
    if (Array.isArray(L.allow) && L.allow.length) o.allow = L.allow.map((r) => biomeKey(mod, r));
    if (kind === 'dagoni') {
      for (const [k, d, hi] of [['civs', 1, 8], ['towns', 2, 12], ['villages', 5, 24], ['rivers', 3, 16], ['lakes', 2, 12], ['dungeons', 5, 24], ['spires', 0, 2]]) o[k] = Math.round(num(L[k], game ? game[k] ?? d : d, 0, hi));
      if (L.key === 'kharos') o.volcano = true;
    }
    lands.push(o);
  }
  // (The three islands are always there: the game's own, if they're gone.)
  for (const k of KEEP) if (!seen.has(k)) lands.push({ ...LANDMASSES.find((q) => q.key === k) });
  // (Thessa first: the player's island.)
  lands.sort((a, b) => (KEEP.includes(a.key) ? KEEP.indexOf(a.key) : 9) - (KEEP.includes(b.key) ? KEEP.indexOf(b.key) : 9));
  const ref = (k) => (k[0] === '@' ? gameKey(mod.id, k.slice(1)) : k);
  const places = (w.places || []).filter((p) => p && ['structures', 'layouts', 'dungeons'].includes(p.kind) && p.ref && mod[p.kind] && mod[p.kind][p.ref]).map((p) => ({ id: String(p.id), kind: p.kind, ref: p.ref, cx: Math.round(num(p.cx, 0, 0, MAP_W - 1)), cz: Math.round(num(p.cz, 0, 0, MAP_H - 1)) }));
  const realms = (w.realms || []).filter((r) => r && r.id).map((r) => ({ id: String(r.id), name: String(r.name || 'A Realm').slice(0, 40), style: r.style || null, color: Math.round(num(r.color, 0, 0, 6)), values: (r.values || []).filter((v) => VALUES.includes(v)).slice(0, 2), cx: Math.round(num(r.cx, 0, 0, MAP_W - 1)), cz: Math.round(num(r.cz, 0, 0, MAP_H - 1)) }));
  const people = (w.people || []).filter((p) => p && p.ent).map((p) => ({ id: String(p.id), ent: ref(p.ent), cx: Math.round(num(p.cx, 0, 0, MAP_W - 1)), cz: Math.round(num(p.cz, 0, 0, MAP_H - 1)), realm: p.realm || null, home: p.home === 'any' ? 'any' : 'capital' }));
  const spawn = w.spawn && Number.isFinite(w.spawn.cx) ? { cx: Math.round(num(w.spawn.cx, 0, 0, MAP_W - 1)), cz: Math.round(num(w.spawn.cz, 0, 0, MAP_H - 1)) } : null;
  // Which lands have towns only where they're painted.
  return { modId: mod.id, name: w.name, lands, land: g.land, biome: g.biome, legend: g.legend.map((r) => biomeKey(mod, r)), town: g.town, places, realms, people, spawn };
}

// ------------------------------------------------------------ in and out
const addedKeys = [];
function install(M, report) {
  M.world = null;
  const withMaps = M.active.filter((m) => Object.keys(m.worlds || {}).length);
  if (!withMaps.length) return;
  const m = withMaps[0];
  const w = Object.values(m.worlds).sort((a, b) => (a.use === b.use ? 0 : a.use ? -1 : 1))[0];
  M.world = compilePlan(m, w);
  if (withMaps.length > 1 || Object.keys(m.worlds).length > 1) report.push({ level: 'warn', text: `More than one world map among the mods: "${w.name}" (of "${m.name}") is used.` });
  // (New lived-in islands: lived in, as the three are.)
  for (const L of M.world.lands) if (L.kind === 'dagoni' && !DAGONI_KEYS.has(L.key)) {
    DAGONI_KEYS.add(L.key);
    addedKeys.push(L.key);
  }
}
function uninstall(M) {
  for (const k of addedKeys) DAGONI_KEYS.delete(k);
  addedKeys.length = 0;
  M.world = null;
}
MODS.hooks.install.unshift((M, report) => install(M, report));
MODS.hooks.uninstall.push((M) => uninstall(M));
MODS.world = null;

// ------------------------------------------------------------ the paint
// Whose painted land each square is (see Overworld.paintOwners): the
// landmass it touches or runs on from, by the lands' own shapes (`value(L,
// x, z)`); land painted far from any, its own wild land (the last land).
export function paintOwners(plan, lands, value, REGION_W, REGION_D) {
  const owner = new Uint8Array(WN);
  const land = plan.land;
  const queue = [];
  for (let i = 0; i < WN; i++) {
    if (land[i] !== 1) continue;
    const cx = i % MAP_W;
    const cz = (i - cx) / MAP_W;
    const x = (cx + 0.5) * REGION_W;
    const z = (cz + 0.5) * REGION_D;
    let best = -1;
    let bv = -0.35;
    lands.forEach((L, j) => {
      const v = value(L, x, z);
      if (v > bv) {
        bv = v;
        best = j;
      }
    });
    if (best >= 0) {
      owner[i] = best + 1;
      queue.push(i);
    }
  }
  // (On from those, over the land painted next to them.)
  for (let q = 0; q < queue.length; q++) {
    const i = queue[q];
    const cx = i % MAP_W;
    for (const j of [i - 1, i + 1, i - MAP_W, i + MAP_W]) {
      if (j < 0 || j >= WN || land[j] !== 1 || owner[j]) continue;
      if ((j === i - 1 && cx === 0) || (j === i + 1 && cx === MAP_W - 1)) continue;
      owner[j] = owner[i];
      queue.push(j);
    }
  }
  let wild = 0;
  for (let i = 0; i < WN; i++) if (land[i] === 1 && !owner[i]) wild++;
  return { owner, wild };
}
