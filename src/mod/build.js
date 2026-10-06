// Mods' structures in the world (round 62): what the Builder makes,
// placed when a world's made, built into its ground as it's explored, with
// their chests full of their loot, their people and beasts about, their
// triggers waiting; layouts of several (a hamlet, a camp) laid out
// together; and dungeons of a mod's own, floor upon floor below a way in
// of its own, each floor as built, its master at the bottom.
//
// A structure (a blueprint): { w, d, h (its size, across, deep, high),
// ground (which of its layers sits at ground level), pal (the blocks it
// uses: pal[0] is "leave as it is", 'air' clears), cells (each cell's
// index into pal, packed: see format.encodeCel; x fastest, then z, then
// y), metas (each cell's turn, packed the same), marks ([{ id, type, x, y,
// z, ... }]: chests and their loot, triggers, spawners, people, a boss, the
// way in, the ways up and down), place ({ where, biomes, isle, count,
// clear }) }.
import { MODS } from './state.js';
import { decodeCel, encodeCel, gameKey } from './format.js';
import { B, BLOCKS, META_ROT, META_STATE } from '../world/blocks.js';
import { REGION_W, REGION_D, WORLD_Y, MAP_W, MAP_H, INST_RX } from '../config.js';
import { RNG, hash4, hashString } from '../util/rng.js';
import { Region } from '../world/region.js';
import { FY, DTYPES } from '../world/dungeongen.js';

// ------------------------------------------------------------ the blueprint
export function bpSize(st) {
  return Math.max(1, st.w | 0) * Math.max(1, st.d | 0) * Math.max(1, st.h | 0);
}
export function bpDecode(st) {
  const n = bpSize(st);
  return { idx: decodeCel(st.cells, n), meta: decodeCel(st.metas, n) };
}
export function bpEncode(st, idx, meta) {
  st.cells = encodeCel(idx);
  st.metas = encodeCel(meta);
}
export const bpAt = (st, x, y, z) => (y * st.d + z) * st.w + x;

// A block reference ('stone', '@myblock', 'm:mod:block') as the game's id.
export function blockIdOf(mod, ref) {
  if (!ref || ref === 'keep') return null;
  if (ref === 'air') return B.air;
  const k = ref[0] === '@' ? gameKey(mod.id, ref.slice(1)) : ref;
  const id = B[k];
  return id === undefined ? null : id;
}

// Every block a structure puts down: [x, y, z, id, meta] in its own
// coordinates (none of "leave as it is").
const cellCache = new Map();
export function bpCells(mod, st) {
  const k = `${mod.id}:${st.id}:${hashString(st.cells || '')}:${hashString(st.metas || '')}:${(st.pal || []).join(',')}:${MODS.serial}`;
  if (cellCache.has(k)) return cellCache.get(k);
  const { idx, meta } = bpDecode(st);
  const ids = (st.pal || []).map((r) => blockIdOf(mod, r));
  const out = [];
  for (let y = 0; y < st.h; y++) for (let z = 0; z < st.d; z++) for (let x = 0; x < st.w; x++) {
    const i = bpAt(st, x, y, z);
    const v = idx[i];
    if (!v) continue;
    const id = ids[v];
    if (id === null || id === undefined) continue;
    out.push([x, y, z, id, meta[i]]);
  }
  if (cellCache.size > 64) cellCache.clear();
  cellCache.set(k, out);
  return out;
}

// A cell turned a quarter `rot` times about a footprint w x d (clockwise
// seen from above): its new place, and its block's own turn with it.
function turn(x, z, w, d, rot) {
  switch (rot & 3) {
    case 1: return [d - 1 - z, x];
    case 2: return [w - 1 - x, d - 1 - z];
    case 3: return [z, w - 1 - x];
    default: return [x, z];
  }
}
const turnMeta = (id, meta, rot) => (BLOCKS[id] && BLOCKS[id].rotatable ? (meta & ~META_ROT) | (((meta & META_ROT) + rot) & 3) : meta);

// ------------------------------------------------------------ choosing where
const near = (a, b) => Math.hypot(a.cx - b.cx, (a.cz - b.cz) * 1.4);
// Map squares to put a mod's things on (deterministic for the world's seed
// and the thing: the same world always gets them in the same places).
function chooseCells(ow, sites, rng, P, n) {
  const sett = ow.settlements;
  const want = (c) => {
    if (c.biome === 'ocean' || c.biome === 'beach' || c.biome === 'volcano' || c.lake || c.settlement !== null) return false;
    if (c.cx <= 1 || c.cz <= 1 || c.cx >= MAP_W - 2 || c.cz >= MAP_H - 2) return false;
    if (P.isle && P.isle !== 'any' && c.island !== P.isle) return false;
    if (P.biomes && P.biomes.length && !P.biomes.includes(c.biome)) return false;
    if (c.mountainness > 0.55) return false;
    const town = Math.min(99, ...sett.map((s) => Math.hypot(s.cx + (s.cw - 1) / 2 - c.cx, (s.cz + (s.cd - 1) / 2 - c.cz) * 1.4)));
    if (P.where === 'near towns') return town >= 1.6 && town <= 4.5;
    if (P.where === 'far from towns') return town >= 6;
    if (P.where === 'by the sea') {
      if (town < 2.2) return false;
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (ow.cell(c.cx + dx, c.cz + dz)?.biome === 'ocean') return true;
      return false;
    }
    return town >= 2.4;
  };
  const cands = rng.shuffle(ow.liveCells.filter(want));
  const out = [];
  for (const c of cands) {
    if (out.length >= n) break;
    if (sites.some((s) => near(s, c) < 3.2) || out.some((q) => near(q, c) < 3.2)) continue;
    out.push(c);
  }
  return out;
}

// A flat, dry spot for a footprint of w x d near the middle of a square:
// its centre and its height, and the height of every column under it.
function settle(world, s) {
  const t = world.terrain;
  const rng = new RNG(s.seed);
  const cx = Math.floor((s.cx + 0.5) * REGION_W);
  const cz = Math.floor((s.cz + 0.5) * REGION_D);
  const hw = Math.ceil(s.w / 2);
  const hd = Math.ceil(s.d / 2);
  let best = null;
  for (let i = 0; i < 40; i++) {
    const x = cx + rng.int(-14, 14);
    const z = cz + rng.int(-8, 8);
    const ctx = t.context(x - hw - 1, z - hd - 1, x + hw + 1, z + hd + 1);
    const col = t.column(x, z, ctx, {});
    if (col.water >= 0) continue;
    let bad = 0;
    const step = Math.max(1, Math.floor(Math.max(s.w, s.d) / 10));
    for (let dz = -hd; dz <= hd && bad < 9999; dz += step) for (let dx = -hw; dx <= hw; dx += step) {
      const q = t.column(x + dx, z + dz, ctx, {});
      if (q.water >= 0 || q.sett) bad += 500;
      else bad += Math.abs(q.h - col.h);
    }
    if (!best || bad < best.bad) best = { x, z, h: col.h, bad };
    if (bad < 4) break;
  }
  s.x = best ? best.x : cx;
  s.z = best ? best.z : cz;
  s.h = best ? best.h : 5;
}

// ------------------------------------------------------------ the sites
// A mod's places, put with the world's own (its dungeons first, so the
// world's list of old places keeps in step: see sim/dungeons.js).
export function addModSites(world) {
  if (!MODS.active.length) return;
  const ow = world.ow;
  const sites = world.sites;
  const add = (kind, mod, thing, P) => {
    const n = Math.max(0, Math.min(12, Math.round(P.count ?? 1)));
    if (!n) return;
    const rng = new RNG(hash4(ow.seed, hashString(mod.id), hashString(thing.id), 0x5173));
    for (const c of chooseCells(ow, sites, rng, P, n)) {
      const s = { id: sites.length, type: gameKey(mod.id, thing.id), mod: mod.id, thing: thing.id, kind, cx: c.cx, cz: c.cz, island: c.island || null, seed: hash4(ow.seed, c.cx, c.cz, hashString(thing.id)), state: {} };
      const fp = footprint(mod, kind, thing);
      if (!fp) continue;
      s.w = fp.w;
      s.d = fp.d;
      s.reach = Math.ceil(Math.max(fp.w, fp.d) / 2) + 3;
      settle(world, s);
      // (A dungeon's site is at its way in.)
      s.ox = -Math.floor(fp.w / 2);
      s.oz = -Math.floor(fp.d / 2);
      if (kind === 'dungeon' && fp.entry) {
        s.ex = s.x;
        s.ez = s.z;
        s.ox = -fp.entry.x;
        s.oz = -fp.entry.z;
      }
      s.place = { clear: P.clear !== false };
      sites.push(s);
    }
  };
  for (const m of MODS.active) for (const d of Object.values(m.dungeons || {})) if (d.entrance && (d.floors || []).length) add('dungeon', m, d, d.place || {});
  for (const m of MODS.active) for (const st of Object.values(m.structures || {})) if (st.place && st.place.where !== 'nowhere' && (st.place.count ?? 0) > 0 && !usedAsPart(m, st.id)) add('structure', m, st, st.place);
  for (const m of MODS.active) for (const L of Object.values(m.layouts || {})) if ((L.pieces || []).length && L.place && (L.place.count ?? 0) > 0) add('layout', m, L, L.place);
  // What's at each: chests with their loot, signs, people and beasts to
  // come, triggers.
  world.modChests = new Map();
  world.modSigns = new Map();
  world.modMarks = [];
  for (const s of sites) if (s.mod && s.kind !== 'dungeon') collectMarks(world, s);
  for (const s of sites) if (s.mod && s.kind === 'dungeon') collectMarks(world, s);
}

// (A structure that's a dungeon's floor or way in, or part of a layout, is
// placed as that, not on its own as well.)
function usedAsPart(m, id) {
  for (const d of Object.values(m.dungeons || {})) if (d.entrance === id || (d.floors || []).includes(id)) return true;
  return false;
}

// How much ground a thing takes, and (a dungeon) where its way in is.
function footprint(mod, kind, thing) {
  if (kind === 'structure') return { w: thing.w, d: thing.d };
  if (kind === 'layout') {
    const S = Math.max(16, Math.min(96, thing.size || 48));
    return { w: S, d: S };
  }
  const st = mod.structures[thing.entrance];
  if (!st) return null;
  const e = (st.marks || []).find((q) => q.type === 'entry');
  return { w: st.w, d: st.d, entry: e ? { x: e.x, z: e.z } : { x: Math.floor(st.w / 2), z: Math.floor(st.d / 2) } };
}

// The pieces of a site: [{ st, x0, z0, rot }] (a layout's several; a
// structure's one; a dungeon's way in).
function piecesOf(s) {
  const m = MODS.byId.get(s.mod);
  if (!m) return [];
  if (s.kind === 'structure') {
    const st = m.structures[s.thing];
    return st ? [{ m, st, x0: s.x + s.ox, z0: s.z + s.oz, rot: 0 }] : [];
  }
  if (s.kind === 'dungeon') {
    const D = m.dungeons[s.thing];
    const st = D && m.structures[D.entrance];
    return st ? [{ m, st, x0: s.x + s.ox, z0: s.z + s.oz, rot: 0 }] : [];
  }
  const L = m.layouts[s.thing];
  if (!L) return [];
  return (L.pieces || []).map((p) => ({ m, st: m.structures[p.structure], x0: s.x + s.ox + (p.x | 0), z0: s.z + s.oz + (p.z | 0), rot: p.rot | 0 })).filter((q) => q.st);
}

// Where a piece's own cell (x, z) is in the world.
function worldXZ(pc, x, z) {
  const [tx, tz] = turn(x, z, pc.st.w, pc.st.d, pc.rot);
  return [pc.x0 + tx, pc.z0 + tz];
}

function collectMarks(world, s) {
  for (const pc of piecesOf(s)) {
    const st = pc.st;
    for (const mk of st.marks || []) {
      const [x, z] = worldXZ(pc, mk.x, mk.z);
      const y = s.h + (mk.y - (st.ground ?? 1));
      const key = `${s.id}:${pc.st.id}:${mk.id}`;
      if (mk.type === 'chest' && mk.loot) world.modChests.set(`${x},${y},${z}`, { mod: pc.m, loot: mk.loot, key });
      else if (mk.type === 'sign') world.modSigns.set(`${x},${y},${z}`, { title: mk.title || 'SIGN', lines: String(mk.text || '').split('\n') });
      else if (['spawn', 'npc', 'trigger', 'boss'].includes(mk.type)) world.modMarks.push({ ...mk, key, x, y, z, mod: pc.m, site: s.id });
    }
  }
}

// ------------------------------------------------------------ building it
// The blocks of a mod's site, as the game's sites give theirs: [dx, y,
// dz, id, meta] from its spot (y as it is). The ground under it levelled
// (built up, or cut down), what was over it cleared, then its blocks.
export function modSiteBlocks(s, state = {}) {
  const k = `${MODS.serial}:${state.cleared ? 1 : 0}`;
  if (s._bk === k && s._blocks) return s._blocks;
  const pieces = piecesOf(s);
  const h = s.h;
  const fill = new Map();
  const put = (x, y, z, id, meta = 0) => {
    if (y < 1 || y >= WORLD_Y) return;
    fill.set(`${x},${y},${z}`, [x - s.x, y, z - s.z, id, meta]);
  };
  // The ground under every piece made level, and the air over it clear.
  for (const pc of pieces) {
    const st = pc.st;
    const top = Math.min(WORLD_Y - 1, h + Math.max(4, st.h - (st.ground ?? 1) + 3));
    for (let z = 0; z < st.d; z++) for (let x = 0; x < st.w; x++) {
      const [wx, wz] = worldXZ(pc, x, z);
      if (s.place && s.place.clear !== false) for (let y = h + 1; y <= top; y++) put(wx, y, wz, B.air);
      for (let y = h - 3; y < h; y++) put(wx, y, wz, B.dirt);
      put(wx, h, wz, B.grass);
    }
  }
  // A layout's paths.
  if (s.kind === 'layout') {
    const m = MODS.byId.get(s.mod);
    const L = m && m.layouts[s.thing];
    for (const p of (L && L.paths) || []) {
      const id = blockIdOf(m, p.block || 'path') ?? B.path;
      for (const [x, z] of p.cells || []) put(s.x + s.ox + x, h, s.z + s.oz + z, id);
    }
  }
  for (const pc of pieces) {
    const st = pc.st;
    const g = st.ground ?? 1;
    for (const [x, y, z, id, meta] of bpCells(pc.m, st)) {
      const [wx, wz] = worldXZ(pc, x, z);
      put(wx, h + (y - g), wz, id, turnMeta(id, meta, pc.rot));
    }
    // (A dungeon beaten: its way in fallen in.)
    if (s.kind === 'dungeon') {
      const e = (st.marks || []).find((q) => q.type === 'entry');
      if (e) {
        const [wx, wz] = worldXZ(pc, e.x, e.z);
        const y = h + (e.y - g);
        put(wx, y, wz, state.cleared ? B.rubble_seal : B.sinkhole);
        if (!state.cleared) put(wx, y + 1, wz, B.air);
      }
    }
  }
  s._blocks = [...fill.values()];
  s._bk = k;
  return s._blocks;
}

// ------------------------------------------------------------ in play
// A chest of a mod's structure, the first time it's opened: its loot.
export function modContainer(world, x, y, z, b) {
  const c = world.modChests && world.modChests.get(`${x},${y},${z}`);
  if (!c || !b || b.interact !== 'container') return null;
  const t = MODS.loot.get(`${c.mod.id}:${c.loot}`);
  if (!t) return null;
  const size = b.mod ? b.modSlots || 9 : { chest: 18, barrel: 9, crate: 9 }[b.name] || 9;
  const rng = new RNG(hash4(world.seed, x, y * 977 + z, 0x10c7));
  return MODS.lootSlots ? MODS.lootSlots({ ...t, mod: c.mod }, size, () => rng.next()) : null;
}

// Each half second: the people and beasts at a structure brought out when
// someone's near (and taken away again by the game when nobody is), and
// its triggers set off.
export function triggerTick(game) {
  const marks = game.world.modMarks;
  if (!marks || !marks.length) return;
  const st = MODS.state(game);
  const players = game.everyone().filter((p) => !p.dead);
  const alive = new Set(game.creatures.filter((c) => !c.dead && c.modMark).map((c) => c.modMark));
  for (const mk of marks) {
    const near = players.filter((p) => Math.abs(p.x - mk.x) <= 30 && Math.abs(p.z - mk.z) <= 22 && !game.world.inInstance(p.x));
    if (!near.length) continue;
    if (mk.type === 'spawn' || mk.type === 'npc' || mk.type === 'boss') {
      if (alive.has(mk.key)) continue;
      const gone = st.killed && st.killed[mk.key];
      if (gone && (mk.type === 'npc' || mk.type === 'boss' || !mk.respawn)) continue;
      if (gone && mk.respawn && (game.sim ? game.sim.abs : game.modClock) - gone < (mk.respawnMins || 300)) continue;
      if (gone) delete st.killed[mk.key];
      const sp = mk.creature ? (mk.creature[0] === '@' ? gameKey(mk.mod.id, mk.creature.slice(1)) : mk.creature) : null;
      if (!sp || !game.sim || !MODS.species(sp)) continue;
      const n = mk.type === 'spawn' ? Math.max(1, Math.min(8, mk.count || 1)) : 1;
      for (let i = 0; i < n; i++) {
        const s = game.findFreeSpot(mk.x + (i ? (i % 3) - 1 : 0), mk.z + (i ? Math.floor(i / 3) : 0), mk.y);
        const c = game.spawnMonster(sp, s.x, s.y, s.z);
        if (!c) continue;
        c.modMark = mk.key;
        c.home = { x: mk.x, z: mk.z };
        if (mk.type === 'boss') {
          c.isBoss = true;
          c.modField = true;
        }
      }
      continue;
    }
    if (mk.type === 'trigger') {
      const r = Math.max(1, mk.r || 3);
      const who = near.find((p) => Math.hypot(p.x - mk.x, p.z - mk.z) <= r + 0.01 && Math.abs(p.y - mk.y) <= 3);
      const k = `trig:${mk.key}`;
      st.trig ||= {};
      if (!who) {
        if (st.trig[k] === 1 && !mk.once) st.trig[k] = 0;
        continue;
      }
      if (st.trig[k]) continue;
      st.trig[k] = 1;
      MODS.fireTrigger?.(game, mk, who);
    }
  }
}

// ------------------------------------------------------------ dungeons
// The record the world keeps of a mod's dungeon (as sim/dungeons.js keeps
// the game's own).
export function dungeonRec(s, game) {
  const m = MODS.byId.get(s.mod);
  const D = m && m.dungeons[s.thing];
  if (!D) return null;
  const depth = Math.max(1, (D.floors || []).filter((f) => m.structures[f]).length);
  const town = game.world.ow.settlements.reduce((b, q) => (!b || near(q, s) < near(b, s) ? q : b), null);
  const tn = town && near(town, s) < 11 ? town.name : null;
  return {
    id: s.id, type: s.type, mod: m.id, thing: D.id, x: s.x, z: s.z, h: s.h, cx: s.cx, cz: s.cz, seed: s.seed, isle: s.island || null, depth, level: Math.max(1, Math.min(4, D.level || 2)),
    known: false, seen: false, entered: false, cleared: false, clearedBy: null, clearedDay: null, floors: {}, weakened: 0, looted: 0, delves: 0, fallen: [], spire: null, vaultFloor: -1,
    name: D.name || 'a forgotten place', origin: { y: null, text: D.lore || `${D.name}: nobody remembers who dug it, or why.`, short: D.lore || `${D.name} lies ${tn ? `out from ${tn}` : 'in the wilds'}.` },
    town: town && tn ? town.id : null, modRumour: D.rumour || null, noDelve: true,
  };
}

// One of a mod dungeon's floors, made from its blueprint (as dungeongen's
// buildFloor makes the game's own): rock all about, its blueprint carved
// out at the floor's level, its stairs, its people, its master.
export function buildModFloor(rec, n, rx0 = INST_RX) {
  const m = MODS.byId.get(rec.mod);
  const D = m && m.dungeons[rec.thing];
  const floors = D ? (D.floors || []).filter((f) => m.structures[f]) : [];
  const st = floors[Math.min(n, floors.length - 1)] ? m.structures[floors[Math.min(n, floors.length - 1)]] : null;
  const W = Math.max(8, Math.min(REGION_W * 2 - 4, st ? st.w + 4 : 24));
  const Dd = Math.max(8, Math.min(REGION_D * 2 - 4, st ? st.d + 4 : 24));
  const rw = Math.ceil(W / REGION_W);
  const rd = Math.ceil(Dd / REGION_D);
  const regions = new Map();
  for (let j = 0; j < rd; j++) for (let i = 0; i < rw; i++) regions.set((rx0 + i) * 4096 + j, new Region(rx0 + i, j));
  const x0 = rx0 * REGION_W;
  const reg = (x, z) => regions.get((rx0 + Math.floor(x / REGION_W)) * 4096 + Math.floor(z / REGION_D));
  const set = (x, y, z, id, meta = 0) => {
    if (x < 0 || z < 0 || x >= rw * REGION_W || z >= rd * REGION_D || y < 0 || y >= WORLD_Y) return;
    reg(x, z).set(x % REGION_W, y, z % REGION_D, id, meta);
  };
  const rock = blockIdOf(m, D && D.rock) ?? B.cave_rock;
  const floor = blockIdOf(m, D && D.floor) ?? B.stone_bricks;
  for (let z = 0; z < rd * REGION_D; z++) for (let x = 0; x < rw * REGION_W; x++) {
    set(x, 0, z, B.bedrock);
    for (let y = 1; y < FY + 3; y++) set(x, y, z, rock);
  }
  const out = {
    W, D: Dd, x0, z0: 0, rooms: [], spawns: [], levers: [], plates: [], cracks: [], braziers: [], drains: [], nodes: [], consoles: [], fields: [], emitters: [], seals: [], weak: [], coffins: [], ambush: [], relicAt: null, notes: [],
    gongs: [], kegs: [], mimics: [], spikes: [], blighted: [], arcs: [], kind: null, bossGate: null, bossRoom: null, regions, depth: rec.depth, mod: true,
  };
  const ox = 2;
  const oz = 2;
  const open = new Uint8Array(W * Dd);
  const room = new Int8Array(W * Dd).fill(-1);
  if (st) {
    const g = st.ground ?? 1;
    const { idx, meta } = bpDecode(st);
    const ids = (st.pal || []).map((r) => blockIdOf(m, r));
    for (let z = 0; z < st.d; z++) for (let x = 0; x < st.w; x++) {
      const lx = ox + x;
      const lz = oz + z;
      // (Inside the blueprint: open, on a floor, unless it's built up.)
      for (let y = FY; y < FY + 3; y++) set(lx, y, lz, B.air);
      set(lx, FY - 1, lz, floor);
      for (let y = 0; y < st.h; y++) {
        const i = bpAt(st, x, y, z);
        const v = idx[i];
        if (!v) continue;
        const id = ids[v];
        if (id === null || id === undefined) continue;
        set(lx, FY - 1 + (y - g), lz, id, meta[i]);
      }
      const solid = BLOCKS[reg(lx, lz).get(lx % REGION_W, FY, lz % REGION_D)];
      if (!solid || !solid.solid) {
        open[lz * W + lx] = 1;
        room[lz * W + lx] = 0;
      }
    }
    out.rooms.push({ id: 0, kit: 'hall', x0: ox, z0: oz, x1: ox + st.w - 1, z1: oz + st.d - 1, cx: ox + (st.w >> 1), cz: oz + (st.d >> 1) });
    const at = (mk) => ({ x: x0 + ox + mk.x, z: oz + mk.z, y: FY + (mk.y - g) });
    for (const mk of st.marks || []) {
      const p = at(mk);
      if (mk.type === 'up') {
        set(p.x - x0, FY, p.z, B.stairs_up, mk.rot | 0);
        out.up = { x: p.x, z: p.z };
        out.upAt = { x: p.x + [0, -1, 0, 1][mk.rot & 3], z: p.z + [1, 0, -1, 0][mk.rot & 3] };
      } else if (mk.type === 'down' && n < rec.depth - 1) {
        set(p.x - x0, FY - 1, p.z, B.stairs_down);
        out.down = { x: p.x, z: p.z };
        out.downAt = { x: p.x + 1, z: p.z };
      } else if (mk.type === 'spawn' && mk.creature) {
        const sp = mk.creature[0] === '@' ? gameKey(m.id, mk.creature.slice(1)) : mk.creature;
        for (let i = 0; i < Math.max(1, Math.min(8, mk.count || 1)); i++) out.spawns.push({ id: out.spawns.length, species: sp, x: p.x + (i % 3) - (i ? 1 : 0), z: p.z + Math.floor(i / 3), room: 0 });
      } else if (mk.type === 'boss' && n === rec.depth - 1) {
        const sp = mk.creature ? (mk.creature[0] === '@' ? gameKey(m.id, mk.creature.slice(1)) : mk.creature) : D.boss ? (D.boss[0] === '@' ? gameKey(m.id, D.boss.slice(1)) : D.boss) : null;
        if (sp) {
          out.spawns.push({ id: out.spawns.length, species: sp, x: p.x, z: p.z, room: 0, boss: true });
          const r = Math.max(4, mk.r || 7);
          out.bossRoom = { x0: Math.max(x0 + ox, p.x - r), x1: Math.min(x0 + ox + st.w - 1, p.x + r), z0: Math.max(oz, p.z - r), z1: Math.min(oz + st.d - 1, p.z + r) };
        }
      } else if (mk.type === 'chest' && mk.loot) {
        out.modChests ||= [];
        out.modChests.push({ x: p.x, y: p.y, z: p.z, loot: mk.loot });
      }
    }
  }
  // (No way up marked: by the middle of the floor's first open row.)
  if (!out.up) {
    let at = null;
    for (let z = 0; z < Dd && !at; z++) for (let x = 0; x < W && !at; x++) if (open[z * W + x]) at = { x: x0 + x, z };
    at ||= { x: x0 + 4, z: 4 };
    set(at.x - x0, FY, at.z, B.stairs_up, 2);
    out.up = { x: at.x, z: at.z };
    out.upAt = { x: at.x, z: at.z + 1 };
  }
  out.entry = out.upAt;
  out.upRoom = out.rooms[0] ? { x0: x0 + out.rooms[0].x0, x1: x0 + out.rooms[0].x1, z0: out.rooms[0].z0, z1: out.rooms[0].z1 } : null;
  out.downRoom = out.upRoom;
  // (A floor that isn't the last, with no way down marked: one far from
  // the way up.)
  if (!out.down && n < rec.depth - 1) {
    let best = null;
    for (let z = 0; z < Dd; z++) for (let x = 0; x < W; x++) if (open[z * W + x]) {
      const d = Math.hypot(x0 + x - out.up.x, z - out.up.z);
      if (!best || d > best.d) best = { x: x0 + x, z, d };
    }
    if (best) {
      set(best.x - x0, FY - 1, best.z, B.stairs_down);
      out.down = { x: best.x, z: best.z };
      out.downAt = { x: best.x, z: best.z };
    }
  }
  // (The last floor, its master chosen but no place marked for it: as far
  // from the way up as can be.)
  if (n === rec.depth - 1 && D && D.boss && !out.spawns.some((q) => q.boss)) {
    let best = null;
    for (let z = 0; z < Dd; z++) for (let x = 0; x < W; x++) if (open[z * W + x]) {
      const d = Math.hypot(x0 + x - out.up.x, z - out.up.z);
      if (!best || d > best.d) best = { x: x0 + x, z, d };
    }
    if (best) {
      out.spawns.push({ id: out.spawns.length, species: D.boss[0] === '@' ? gameKey(m.id, D.boss.slice(1)) : D.boss, x: best.x, z: best.z, room: 0, boss: true });
      out.bossRoom = { x0: Math.max(x0 + ox, best.x - 7), x1: Math.min(x0 + ox + (st ? st.w : W) - 1, best.x + 7), z0: Math.max(oz, best.z - 7), z1: Math.min(oz + (st ? st.d : Dd) - 1, best.z + 7) };
    }
  }
  // Its chests, filled.
  for (const c of out.modChests || []) {
    const r = reg(c.x - x0, c.z);
    const b = BLOCKS[r.get((c.x - x0) % REGION_W, c.y, c.z % REGION_D)];
    if (!b || b.interact !== 'container') continue;
    const t = MODS.loot.get(`${m.id}:${c.loot}`);
    if (!t || !MODS.lootSlots) continue;
    const rng = new RNG(hash4(rec.seed, n, c.x, c.z));
    r.containers.set(Region.idx((c.x - x0) % REGION_W, c.y, c.z % REGION_D), MODS.lootSlots({ ...t, mod: m }, 18, () => rng.next()));
  }
  out.plan = { W, D: Dd, open, room, corr: new Uint8Array(W * Dd) };
  for (const r of regions.values()) r.recomputeTops();
  return out;
}

// A mod dungeon's kind (as DTYPES has the game's own): its look below.
export function modDtype(m, D) {
  return {
    name: D.name || 'Dungeon', wall: blockIdOf(m, D.rock) ?? B.cave_rock, floor: blockIdOf(m, D.floor) ?? B.stone_bricks, alt: blockIdOf(m, D.floor) ?? B.stone, beam: null, regions: [2, 2], floors: [1, 1],
    kits: [], mobs: [], bosses: [], torches: 0.3, shapes: { rect: 1 }, wiggle: 0, decor: [], dark: D.dark || [0.08, 0.075, 0.09], motes: [m.color || '#8a8a8a', '#c8c8c8'], ambient: ['drip', 'wind_low', 'whisper'], mod: true,
  };
}

// Put in (and taken out) with the mods.
MODS.hooks.install.push(() => {
  for (const m of MODS.active) for (const D of Object.values(m.dungeons || {})) DTYPES[gameKey(m.id, D.id)] = modDtype(m, D);
});
MODS.hooks.uninstall.push(() => {
  for (const k of Object.keys(DTYPES)) if (k.startsWith('m:')) delete DTYPES[k];
});
MODS.siteBlocks = modSiteBlocks;
MODS.addSites = addModSites;
MODS.dungeonRec = dungeonRec;
MODS.buildFloor = buildModFloor;
MODS.container = modContainer;
MODS.triggerTick = triggerTick;
MODS.structureSpots = (game, modId, id) => (game.world.sites || []).filter((s) => s.mod === modId && (s.thing === id || (s.kind === 'layout' && (MODS.byId.get(modId)?.layouts[s.thing]?.pieces || []).some((p) => p.structure === id)))).map((s) => ({ x: s.x, y: s.h + 1, z: s.z }));
// (Placed whole, by a graph's Place structure, or in front of you when
// playtesting it: the ground under it levelled and the air over it
// cleared if `o.level`, its markers at work if `o.marks`.)
MODS.placeStructure = (game, mod, id, at, o = {}) => {
  const st = mod.structures[id];
  if (!st) return null;
  const world = game.world;
  const g = st.ground ?? 1;
  const x0 = at.x - Math.floor(st.w / 2);
  const z0 = at.z - Math.floor(st.d / 2);
  const base = at.y - 1;
  if (o.level) for (let z = 0; z < st.d; z++) for (let x = 0; x < st.w; x++) {
    for (let y = base + 1; y <= Math.min(WORLD_Y - 1, base + st.h - g + 3); y++) world.setBlock(x0 + x, y, z0 + z, B.air);
    for (let y = Math.max(1, base - 2); y < base; y++) if (!BLOCKS[world.getBlock(x0 + x, y, z0 + z)]?.solid) world.setBlock(x0 + x, y, z0 + z, B.dirt);
    world.setBlock(x0 + x, base, z0 + z, B.grass);
  }
  for (const [x, y, z, bid, meta] of bpCells(mod, st)) world.setBlock(x0 + x, base + (y - g), z0 + z, bid, meta);
  if (o.marks) {
    world.modChests ||= new Map();
    world.modSigns ||= new Map();
    world.modMarks ||= [];
    const tag = `p${(world.modPlaced = (world.modPlaced || 0) + 1)}`;
    for (const mk of st.marks || []) {
      const x = x0 + mk.x;
      const z = z0 + mk.z;
      const y = base + (mk.y - g);
      const key = `${tag}:${st.id}:${mk.id}`;
      // (Its chests fill from their loot the first time they're opened.)
      if (mk.type === 'chest' && mk.loot) world.modChests.set(`${x},${y},${z}`, { mod, loot: mk.loot, key });
      else if (mk.type === 'sign') world.modSigns.set(`${x},${y},${z}`, { title: mk.title || 'SIGN', lines: String(mk.text || '').split('\n') });
      else if (['spawn', 'npc', 'trigger', 'boss'].includes(mk.type)) world.modMarks.push({ ...mk, key, x, y, z, mod, site: -1 });
    }
  }
  game.lightDirty = true;
  return { x0, z0, base, w: st.w, d: st.d };
};
export { META_STATE };
