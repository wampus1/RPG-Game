// (Round 142) The map of a town (the world map's Civilization tab): its
// ground plan (streets, the square, water, fields, walls, its buildings and
// landmarks), shown only where you've been: the parts of it you've walked
// near, and the places in it you've passed close by. Kept for each town,
// and in the save.
//
// A town's plan is the host's (its layout is laid out there): someone in
// another's world asks for it (see net/host.js, net/guest.js), and gets it
// in a compact form.
import { M } from '../world/settlement.js';
import { B } from '../world/blocks.js';
import { SURFACE } from '../config.js';

// How near counts as having seen a place, and how far round you the ground
// is seen (in tiles); the ground's kept in squares of CELL tiles.
export const NEAR = 7;
export const REVEAL = 9;
export const CELL = 4;

// ------------------------------------------------------------ the plan
// A town's plan from its layout (kept while the layout doesn't change).
// (Round 143) With what's seen from above on each tile: the topmost thing
// the town put there (a roof, a tree, a crop, a lantern, the paving), or
// else the ground; and how high it stands (`top`, `ht`).
export function planOf(L) {
  if (!L || !L.mask || !L.bounds) return null;
  let placed = 0;
  for (const arr of L.placements ? L.placements.values() : []) placed += arr.length;
  const v = `${L.maskV || 0}:${L.buildings.length}:${(L.landmarks || []).length}:${placed}`;
  if (L.planCache && L.planCache.v === v) return L.planCache;
  const { top, ht } = topsOf(L);
  const p = {
    sid: L.settlement.id, v, x0: L.bounds.x0, z0: L.bounds.z0, W: L.W, D: L.D,
    mask: L.mask, top, ht,
    b: L.buildings.filter((b) => b && b.x0 !== undefined).map((b) => ({ id: b.id, type: b.type, name: b.name || b.type, x0: b.x0, z0: b.z0, x1: b.x1, z1: b.z1, up: !!b.underConstruction, door: b.door ? { x: b.door.x, z: b.door.z, rot: b.door.rot | 0 } : null })),
    lm: (L.landmarks || []).map((q, i) => ({ id: i, kind: q.kind, name: q.name, x0: q.x0, z0: q.z0, x1: q.x1, z1: q.z1 })),
    plaza: L.plaza ? { x0: L.plaza.x0, z0: L.plaza.z0, x1: L.plaza.x1, z1: L.plaza.z1 } : null,
  };
  Object.defineProperty(L, 'planCache', { value: p, writable: true, configurable: true, enumerable: false });
  return p;
}

// What's seen from above on each tile of the town (see planOf).
function topsOf(L) {
  const { W, D } = L;
  const x0 = L.bounds.x0;
  const z0 = L.bounds.z0;
  const top = new Uint16Array(W * D);
  const ht = new Uint8Array(W * D);
  const hy = new Int16Array(W * D).fill(-1);
  for (const arr of L.placements ? L.placements.values() : []) {
    for (let i = 0; i < arr.length; i += 5) {
      const id = arr[i + 3];
      if (!id) continue;
      const lx = arr[i] - x0;
      const lz = arr[i + 2] - z0;
      if (lx < 0 || lz < 0 || lx >= W || lz >= D) continue;
      const k = lz * W + lx;
      const y = arr[i + 1];
      if (y >= hy[k]) {
        hy[k] = y;
        top[k] = id;
      }
    }
  }
  for (let lz = 0; lz < D; lz++) {
    for (let lx = 0; lx < W; lx++) {
      const k = lz * W + lx;
      if (hy[k] >= 0) {
        ht[k] = Math.max(0, Math.min(15, hy[k] - SURFACE));
        continue;
      }
      // (Nothing put there: the ground, or the water.)
      const c = L.col ? L.col(x0 + lx, z0 + lz) : null;
      top[k] = c && c.water >= 0 ? B.water : (c && c.surf) || B.grass;
    }
  }
  return { top, ht };
}

// Run-length coded, for the wire ("value*count,...").
function rle(a) {
  const runs = [];
  let cur = a[0];
  let n = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] === cur) n++;
    else {
      runs.push(`${cur}*${n}`);
      cur = a[i];
      n = 1;
    }
  }
  runs.push(`${cur}*${n}`);
  return runs.join(',');
}
function unrle(str, out) {
  let i = 0;
  for (const r of String(str || '').split(',')) {
    const [v, n] = r.split('*').map(Number);
    for (let k = 0; k < n && i < out.length; k++) out[i++] = v || 0;
  }
  return out;
}

// For the wire: the ground, and what's seen from above, run-length coded.
export function planWire(L) {
  const p = planOf(L);
  if (!p) return null;
  return { ...p, mask: rle(p.mask), top: rle(p.top), ht: rle(p.ht) };
}

export function planFromWire(w) {
  if (!w || typeof w.mask !== 'string') return null;
  const n = w.W * w.D;
  const out = { ...w, mask: unrle(w.mask, new Uint8Array(n)) };
  // (A plan from a host before Round 143: the ground plan alone.)
  out.top = typeof w.top === 'string' ? unrle(w.top, new Uint16Array(n)) : null;
  out.ht = typeof w.ht === 'string' ? unrle(w.ht, new Uint8Array(n)) : null;
  return out;
}

// The plan of a town, if it can be had here: from its layout, or (in
// another's world) as the host sent it, asked for if it hasn't been.
export function planFor(game, sid) {
  if (sid === null || sid === undefined) return null;
  const L = game.world.layouts ? game.world.layouts.get(sid) : null;
  if (L) return planOf(L);
  const got = game.townPlans && game.townPlans[sid];
  if (game.remote && game.remote.askPlan && (!got || Date.now() - (got.at || 0) > 60000)) game.remote.askPlan(sid);
  return got || null;
}

// ------------------------------------------------------------ what you've seen
export function seenOf(game, sid, plan = null) {
  const all = (game.townSeen ||= {});
  let S = all[sid];
  if (!S && plan) {
    const cw = Math.ceil(plan.W / CELL);
    const ch = Math.ceil(plan.D / CELL);
    S = all[sid] = { cw, ch, bits: new Uint8Array(Math.ceil((cw * ch) / 8)), b: {}, lm: {}, v: 0 };
  }
  return S || null;
}

// Whether a square of the town's ground has been seen.
export function cellSeen(S, cx, cz) {
  if (!S || cx < 0 || cz < 0 || cx >= S.cw || cz >= S.ch) return false;
  const i = cz * S.cw + cx;
  return !!(S.bits[i >> 3] & (1 << (i & 7)));
}

// What's near you now, in the town you're in, noted as seen.
export function noteNear(game) {
  const s = game.currentSettlement;
  const p = game.player;
  if (!s || !p || game.dungeon) return false;
  const plan = planFor(game, s.id);
  if (!plan) return false;
  const S = seenOf(game, s.id, plan);
  if (!S || S.cw !== Math.ceil(plan.W / CELL)) return false;
  let fresh = false;
  // The ground round you.
  const lx = p.x - plan.x0;
  const lz = p.z - plan.z0;
  const r = Math.ceil(REVEAL / CELL) + 1;
  const pcx = Math.floor(lx / CELL);
  const pcz = Math.floor(lz / CELL);
  for (let cz = pcz - r; cz <= pcz + r; cz++) {
    for (let cx = pcx - r; cx <= pcx + r; cx++) {
      if (cx < 0 || cz < 0 || cx >= S.cw || cz >= S.ch) continue;
      const mx = cx * CELL + CELL / 2;
      const mz = cz * CELL + CELL / 2;
      if (Math.hypot(mx - lx, mz - lz) > REVEAL + CELL * 0.7) continue;
      const i = cz * S.cw + cx;
      if (S.bits[i >> 3] & (1 << (i & 7))) continue;
      S.bits[i >> 3] |= 1 << (i & 7);
      fresh = true;
    }
  }
  // The places you've passed close by.
  const near = (q) => Math.hypot(Math.max(q.x0 - p.x, 0, p.x - q.x1), Math.max(q.z0 - p.z, 0, p.z - q.z1)) <= NEAR;
  for (const b of plan.b) {
    if (S.b[b.id] || !near(b)) continue;
    S.b[b.id] = 1;
    fresh = true;
  }
  for (const q of plan.lm) {
    if (S.lm[q.id] || !near(q)) continue;
    S.lm[q.id] = 1;
    fresh = true;
  }
  if (fresh) S.v++;
  return fresh;
}

// The places of a town you've been near (its buildings and landmarks).
export function knownPlaces(game, sid) {
  const plan = planFor(game, sid);
  const S = seenOf(game, sid);
  if (!plan || !S) return [];
  return [
    ...plan.lm.filter((q) => S.lm[q.id]).map((q) => ({ ...q, landmark: true })),
    ...plan.b.filter((b) => S.b[b.id]),
  ];
}

// ------------------------------------------------------------ the save
export function saveSeen(all) {
  const out = {};
  for (const [sid, S] of Object.entries(all || {})) {
    let hex = '';
    for (const x of S.bits) hex += x.toString(16).padStart(2, '0');
    out[sid] = { cw: S.cw, ch: S.ch, hex, b: Object.keys(S.b).map(Number), lm: Object.keys(S.lm).map(Number) };
  }
  return out;
}

export function loadSeen(data) {
  const out = {};
  for (const [sid, d] of Object.entries(data || {})) {
    if (!d || !(d.cw > 0) || !(d.ch > 0)) continue;
    const bits = new Uint8Array(Math.ceil((d.cw * d.ch) / 8));
    for (let i = 0; i < bits.length && i * 2 < (d.hex || '').length; i++) bits[i] = parseInt(d.hex.slice(i * 2, i * 2 + 2), 16) || 0;
    out[sid] = { cw: d.cw, ch: d.ch, bits, b: Object.fromEntries((d.b || []).map((k) => [k, 1])), lm: Object.fromEntries((d.lm || []).map((k) => [k, 1])), v: 1 };
  }
  return out;
}

// ------------------------------------------------------------ colours
// The ground, by what it is.
export const GROUND_COLOR = {
  [M.FREE]: '#26341f', [M.ROAD]: '#8a7858', [M.BUILD]: '#4a4440', [M.WATER]: '#2c5080', [M.FIELD]: '#5c6a2c',
  [M.PLAZA]: '#b8a882', [M.YARD]: '#34442a', [M.WALL]: '#77706a', [M.BRIDGE]: '#8a6a40', [M.DECOR]: '#3e5434',
};
// A building, by what it's for (and a sign on it, for the ones you look for).
const KIND = {
  home: { c: '#a87a58' },
  trade: { c: '#c89a48', g: '¤' },
  food: { c: '#d07a58', g: '♪' },
  civic: { c: '#a8a8e0', g: '★' },
  faith: { c: '#e8e0ff', g: '✦' },
  craft: { c: '#b88a68', g: '♦' },
  learn: { c: '#80c0d8', g: '•' },
  guard: { c: '#d06060', g: '▲' },
};
export function kindOf(type) {
  if (/^house|^hut|home|cottage|longhouse|shack|tent/.test(type)) return 'home';
  if (/townhall|hall$|court|palace/.test(type)) return 'civic';
  if (/temple|shrine|chapel/.test(type)) return 'faith';
  if (/tavern|inn|bakery|kitchen|butcher|brew|rum/.test(type)) return 'food';
  if (/smith|forge|mill|kiln|works|tannery|carpent|mason|weav|glass|cellar|pearl/.test(type)) return 'craft';
  if (/library|college|academy|school|scholar|observ/.test(type)) return 'learn';
  if (/barracks|jail|guard|watch|gate|tower/.test(type)) return 'guard';
  return 'trade';
}
export function buildingLook(type) {
  return KIND[kindOf(type)] || KIND.trade;
}
