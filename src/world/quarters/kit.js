// (Round 146) The kit the places known for something are built with (see
// world/specialties.js and index.js): where one goes (open ground of its
// size beside a street), its ground claimed, and the makings of it: paving,
// halls with their walls, windows, doors and roofs, rings of seats stepping
// up round a pit or a stage, columns, lamps, braziers, banners, the great
// thing at its heart on its plinth. And what it is to the town's people:
// the places to stand and sit (spots, with what they're for), the places
// its own people work (by trade: see JOBS in entities/npcgen.js), the seats
// for those who come to watch, and the things in it to use.
//
// Everything put here goes through the town's layout (Layout.put), so a
// quarter laid out with its town is in the town's blocks; one built since
// (in an older world) is collected and set into the world as it stands
// (see index.js).
import { GROUND, SURFACE } from '../../config.js';
import { B, BLOCKS, META_STATE, CANOPY_SHIFT, CANOPY_STYLE_SHIFT, CANOPY_STYLES } from '../blocks.js';
import { M } from '../settlement.js';
import { familyOf } from '../specialties.js';
import { MinHeap } from '../../util/heap.js';

export const Y0 = GROUND;
const LIT = META_STATE;
const DX = [0, -1, 0, 1];
const DZ = [1, 0, -1, 0];

// The tag a quarter's own people work by (`job` at quarter `i`).
export const roleTag = (i, job) => `q${i}:${job}`;
// And the quarter and trade a work tag names (or null).
export function roleOf(tag) {
  const m = /^q(\d+):(\w+)$/.exec(tag || '');
  return m ? { i: +m[1], job: m[2] } : null;
}

// ------------------------------------------------------------ the ground
let BAD = null;
// Open ground of one of `sizes` ([across, deep]) beside a street, toward
// the middle (`prefer` 'mid'), the edge ('edge'), or the water ('water':
// one side on it, for a shipyard).
export function findLot(L, sizes, rng, prefer = 'mid') {
  const b = L.bounds;
  const Wd = L.W;
  const Dd = L.D;
  const sat = (fn) => {
    const t = new Int32Array((Wd + 1) * (Dd + 1));
    for (let z = 0; z < Dd; z++) {
      for (let x = 0; x < Wd; x++) {
        const v = fn(b.x0 + x, b.z0 + z) ? 1 : 0;
        t[(z + 1) * (Wd + 1) + x + 1] = v + t[z * (Wd + 1) + x + 1] + t[(z + 1) * (Wd + 1) + x] - t[z * (Wd + 1) + x];
      }
    }
    return (x0, z0, x1, z1) => {
      const a = Math.max(0, x0 - b.x0);
      const c = Math.max(0, z0 - b.z0);
      const e = Math.min(Wd, x1 - b.x0 + 1);
      const f = Math.min(Dd, z1 - b.z0 + 1);
      if (e <= a || f <= c) return 0;
      return t[f * (Wd + 1) + e] - t[c * (Wd + 1) + e] - t[f * (Wd + 1) + a] + t[c * (Wd + 1) + a];
    };
  };
  const free = sat((x, z) => {
    const m = L.maskAt(x, z);
    return m === M.FREE || m === M.YARD;
  });
  BAD ||= new Set([M.BUILD, M.WALL, M.FIELD, M.PLAZA, M.DECOR, M.BRIDGE]);
  const bad = sat((x, z) => BAD.has(L.maskAt(x, z)));
  const wet = sat((x, z) => L.maskAt(x, z) === M.WATER);
  const road = sat((x, z) => L.maskAt(x, z) === M.ROAD);
  // (Not over the ways out of town.)
  const exits = L.exits ? L.exits() : [];
  const p = L.plaza;
  const cx0 = p ? p.cx : (b.x0 + b.x1) / 2;
  const cz0 = p ? p.cz : (b.z0 + b.z1) / 2;
  for (const [W, D] of sizes) {
    let best = null;
    for (let z = b.z0 + 1; z + D <= b.z1; z++) {
      for (let x = b.x0 + 1; x + W <= b.x1; x++) {
        if (free(x, z, x + W - 1, z + D - 1) !== W * D) continue;
        if (bad(x - 1, z - 1, x + W, z + D) > 0) continue;
        if (!road(x - 2, z - 2, x + W + 1, z + D + 1)) continue;
        const shore = wet(x - 2, z - 2, x + W + 1, z + D + 1);
        if (prefer === 'water' ? shore < Math.min(W, D) / 2 : shore > 0) continue;
        if (exits.some((e) => e.x >= x - 2 && e.x <= x + W + 1 && e.z >= z - 2 && e.z <= z + D + 1)) continue;
        const d = Math.hypot(x + W / 2 - cx0, z + D / 2 - cz0);
        const score = (prefer === 'edge' || prefer === 'water' ? -d : d) + rng.float(0, 10);
        if (!best || score < best.score) best = { x, z, W, D, score };
      }
    }
    if (best) return { x: best.x, z: best.z, W: best.W, D: best.D };
  }
  return null;
}

export function claimLot(L, lot) {
  for (let dz = 0; dz < lot.D; dz++) for (let dx = 0; dx < lot.W; dx++) L.setMask(lot.x + dx, lot.z + dz, M.DECOR);
}

// The street sides of a lot (where its ways in go), the side facing the
// town's square first.
export function gatesOf(L, lot) {
  const out = [];
  const { x, z, W, D } = lot;
  const mx = x + Math.floor(W / 2);
  const mz = z + Math.floor(D / 2);
  // (Ground out past the town's edge: its way in on the road it's by. See
  // quarters/index.js findAnnex.)
  if (lot.face) {
    const at = { n: [mx, z, 0, -1], s: [mx, z + D - 1, 0, 1], w: [x, mz, -1, 0], e: [x + W - 1, mz, 1, 0] }[lot.face];
    return [{ side: lot.face, x: at[0], z: at[1], out: { x: at[0] + at[2], z: at[1] + at[3] } }];
  }
  const roadAt = (px, pz) => {
    const m = L.maskAt(px, pz);
    return m === M.ROAD || m === M.PLAZA || m === M.BRIDGE;
  };
  const along = (fx, fz, n, ox, oz) => {
    for (let k = 0; k <= n; k++) for (const s of k ? [1, -1] : [1]) if (roadAt(fx + ox * s * k, fz + oz * s * k)) return k * s;
    return null;
  };
  const sides = [
    ['n', mx, z, 0, -1, 1, 0], ['s', mx, z + D - 1, 0, 1, 1, 0], ['w', x, mz, -1, 0, 0, 1], ['e', x + W - 1, mz, 1, 0, 0, 1],
  ];
  for (const [side, gx, gz, nx, nz, ox, oz] of sides) {
    let k = along(gx + nx, gz + nz, Math.floor((ox ? W : D) / 2) - 2, ox, oz);
    if (k === null) k = along(gx + nx * 2, gz + nz * 2, Math.floor((ox ? W : D) / 2) - 2, ox, oz);
    if (k === null) continue;
    // (Round 147) The way in at the middle of the side, where every
    // quarter's built to be come into (a street near it on that side).
    void k;
    out.push({ side, x: gx, z: gz, out: { x: gx + nx, z: gz + nz } });
  }
  if (!out.length) out.push({ side: 's', x: mx, z: z + D - 1, out: { x: mx, z: z + D } });
  const p = L.plaza;
  if (p) out.sort((a, b) => Math.hypot(a.x - p.cx, a.z - p.cz) - Math.hypot(b.x - p.cx, b.z - p.cz));
  return out;
}

// ------------------------------------------------------------ materials
// Each family's way with the grand things (see specialties.FAMILY): its
// paving, columns, the steps its seats are made of, its cloth.
const FAM = {
  classic: { pave: 'travertine', column: 'marble_column', stairs: 'marble_stairs', trim: 'marble', cloth: 0, lamp: 'brazier' },
  vale: { pave: 'flagstone', column: 'stone_bricks', stairs: 'stone_bricks_stairs', trim: 'stone_bricks', cloth: 1, lamp: 'lantern' },
  north: { pave: 'planks_dark', column: 'log_pine', stairs: 'planks_dark_stairs', trim: 'log_wall', cloth: 2, lamp: 'brazier' },
  sun: { pave: 'sandstone', column: 'sandstone', stairs: 'travertine_stairs', trim: 'adobe', cloth: 3, lamp: 'brazier' },
  wild: { pave: 'gravel', column: 'log_jungle', stairs: 'planks_birch_stairs', trim: 'planks_birch', cloth: 0, lamp: 'lantern' },
  high: { pave: 'stone_bricks', column: 'stone_bricks', stairs: 'stone_bricks_stairs', trim: 'cobblestone', cloth: 1, lamp: 'brazier' },
  ember: { pave: 'basalt_bricks', column: 'basalt_bricks', stairs: 'stone_bricks_stairs', trim: 'kiln_brick', cloth: 3, lamp: 'ash_brazier' },
  mist: { pave: 'planks_bog', column: 'mushroom_stem', stairs: 'planks_bog_stairs', trim: 'planks_bog', cloth: 2, lamp: 'fog_lantern' },
  tide: { pave: 'planks_drift', column: 'log_mangrove', stairs: 'planks_drift_stairs', trim: 'planks_drift', cloth: 1, lamp: 'lantern' },
  jade: { pave: 'flagstone', column: 'planks_lacquer', stairs: 'planks_lacquer_stairs', trim: 'planks_lacquer', cloth: 0, lamp: 'lantern' },
};
const pick = (name, fb) => (B[name] !== undefined ? B[name] : fb);

export function matsFor(L, fam, rng, grand = true) {
  const F = FAM[fam] || FAM.vale;
  const m = L.buildingMats(grand ? 'temple' : 'house_m', rng);
  return {
    wall: m.wall, corner: m.corner || m.wall, floor: m.floor, roof: m.roof, flat: !!m.flat, style: m.style,
    pave: pick(F.pave, B.flagstone), column: pick(F.column, B.stone_bricks), stairs: pick(F.stairs, B.stone_bricks_stairs),
    trim: pick(F.trim, B.stone_bricks), cloth: F.cloth, lamp: pick(F.lamp, B.lantern),
  };
}

// ------------------------------------------------------------ the builder
// The roofs, whose turn says which way they slope (1 their ridge).
const ROOFS = new Set(['thatch', 'roof_red', 'roof_slate', 'roof_wood', 'roof_green', 'roof_snow', 'roof_mushroom', 'roof_moss', 'roof_reed', 'roof_terracotta', 'roof_turf', 'roof_jade', 'copper_roof', 'kiln_tile', 'sail_roof']);
let TURNS = null;
// How a block's turn is kept: 1 a facing in the low bits, 2 a roof's slope.
function turnsOf(id) {
  if (!TURNS) {
    TURNS = new Uint8Array(BLOCKS.length);
    for (const b of BLOCKS) if (b) TURNS[b.id] = ROOFS.has(b.name) ? 2 : b.rotatable || b.stair || b.render === 'door' ? 1 : 0;
  }
  return TURNS[id] || 0;
}

// One quarter being made: its lot and ways in, its people's look, what's
// been put in it for the town's people and for its own.
//   Each is drawn up as if its front were to the south (its way in from
// the street on its south side, z1), and turned as it's put down to face
// whichever street the lot opens on: every place, spot and turn given to
// the kit is in that frame (x0..x1, z0..z1 as it's drawn up), and what it
// records in out (where the pit is, the stage, the track...) is put back
// into the world's frame with pt() and area().
export class Q {
  constructor(L, lot, spec, i, rng) {
    this.L = L;
    this.s = L.settlement;
    this.spec = spec;
    this.i = i;
    this.rng = rng;
    this.lot = lot;
    // (Its ways in as they were when it was first laid out, if they're
    // kept: a quarter's built the same way each time.)
    const OUT = { n: [0, -1], s: [0, 1], w: [-1, 0], e: [1, 0] };
    const wg = lot.gates && lot.gates.length ? lot.gates.map((g) => ({ ...g, out: { x: g.x + OUT[g.side][0], z: g.z + OUT[g.side][1] } })) : gatesOf(L, lot);
    // Which way the front's turned: south, west, north, east.
    this.rot = { s: 0, w: 1, n: 2, e: 3 }[wg[0].side];
    this.x0 = lot.x;
    this.z0 = lot.z;
    this.W = this.rot % 2 ? lot.D : lot.W;
    this.D = this.rot % 2 ? lot.W : lot.D;
    this.x1 = this.x0 + this.W - 1;
    this.z1 = this.z0 + this.D - 1;
    this.cx = this.x0 + Math.floor(this.W / 2);
    this.cz = this.z0 + Math.floor(this.D / 2);
    this.fam = familyOf(this.s.style);
    this.f = new Set(spec.f || []);
    this.size = spec.size;
    // The ways in, in the drawn-up frame (the main one to the south).
    const SIDE = ['s', 'w', 'n', 'e'];
    this.gates = wg.map((g) => {
      const c = this.local(g.x, g.z);
      const k = SIDE.indexOf(g.side);
      return { side: SIDE[(k - this.rot + 4) & 3], x: c.x, z: c.z };
    });
    this.m = matsFor(L, this.fam, rng);
    this.poor = this.s.condition === 'poor';
    const at = this.pt(this.cx, this.cz);
    this.out = {
      i, k: spec.k, form: spec.form, name: spec.name, fam: this.fam, size: spec.size, rot: this.rot, f: [...(spec.f || [])], v: spec.v,
      x0: lot.x, z0: lot.z, x1: lot.x + lot.W - 1, z1: lot.z + lot.D - 1, at,
      gates: wg.map((g) => ({ side: g.side, x: g.x, z: g.z })),
      fx: [], seats: [], roles: {}, halls: [], stage: null, pit: null, track: null, stalls: [],
    };
  }

  // The drawn-up frame to the world's, and back.
  pt(x, z) {
    const u = x - this.x0;
    const v = z - this.z0;
    const { x: X, z: Z, W, D } = this.lot;
    switch (this.rot) {
      case 1: return { x: X + (W - 1 - v), z: Z + u };
      case 2: return { x: X + (W - 1 - u), z: Z + (D - 1 - v) };
      case 3: return { x: X + v, z: Z + (D - 1 - u) };
      default: return { x: X + u, z: Z + v };
    }
  }
  local(x, z) {
    const { x: X, z: Z, W, D } = this.lot;
    const a = x - X;
    const b = z - Z;
    switch (this.rot) {
      case 1: return { x: this.x0 + b, z: this.z0 + (W - 1 - a) };
      case 2: return { x: this.x0 + (W - 1 - a), z: this.z0 + (D - 1 - b) };
      case 3: return { x: this.x0 + (D - 1 - b), z: this.z0 + a };
      default: return { x: this.x0 + a, z: this.z0 + b };
    }
  }
  // A facing (0 south, 1 west, 2 north, 3 east) in the world's frame.
  dir(d) {
    return (d + this.rot) & 3;
  }
  // A rectangle in the world's frame (and anything else on it kept).
  area(r) {
    const a = this.pt(r.x0, r.z0);
    const b = this.pt(r.x1, r.z1);
    return { ...r, x0: Math.min(a.x, b.x), z0: Math.min(a.z, b.z), x1: Math.max(a.x, b.x), z1: Math.max(a.z, b.z) };
  }

  has(feat) {
    return this.f.has(feat);
  }
  inLot(x, z) {
    return x >= this.x0 && x <= this.x1 && z >= this.z0 && z <= this.z1;
  }
  onEdge(x, z) {
    return x === this.x0 || x === this.x1 || z === this.z0 || z === this.z1;
  }
  // The mouth of a way in: its gate and the pace inside it (as drawn up);
  // and the paces either side of every door (see hall).
  mouth(x, z) {
    if (this.doorways && this.doorways.has(x * 65536 + z)) return true;
    for (const g of this.gates) {
      if (g.x === x && g.z === z) return true;
      const ix = g.side === 'w' ? 1 : g.side === 'e' ? -1 : 0;
      const iz = g.side === 'n' ? 1 : g.side === 's' ? -1 : 0;
      if (g.x + ix === x && g.z + iz === z) return true;
    }
    return false;
  }
  // Is (x, z) in the way in at a gate (`wide` either side of it, `deep`
  // in from the edge)?
  atGate(x, z, wide = 1, deep = 1) {
    return this.gates.some((g) => {
      if (g.side === 'n') return Math.abs(x - g.x) <= wide && z >= this.z0 && z < this.z0 + deep;
      if (g.side === 's') return Math.abs(x - g.x) <= wide && z <= this.z1 && z > this.z1 - deep;
      if (g.side === 'w') return Math.abs(z - g.z) <= wide && x >= this.x0 && x < this.x0 + deep;
      return Math.abs(z - g.z) <= wide && x <= this.x1 && x > this.x1 - deep;
    });
  }
  // The direction (0..3, as doors face) from (x, z) toward the middle.
  faceIn(x, z, cx = this.cx, cz = this.cz) {
    const dx = cx - x;
    const dz = cz - z;
    if (Math.abs(dx) >= Math.abs(dz)) return dx > 0 ? 3 : 1;
    return dz > 0 ? 0 : 2;
  }

  put(x, y, z, id, meta = 0) {
    if (id === undefined) return;
    // (Round 147) Nothing that stands in the way set in the mouth of a way
    // in (its gate and the pace inside it), at head height or below.
    if (y >= Y0 && y <= Y0 + 1 && this.mouth(x, z)) {
      const b = BLOCKS[id];
      if (b && b.solid && b.interact !== 'door' && b.interact !== 'gate' && !b.stair) return;
    }
    const p = this.pt(x, z);
    const t = this.rot ? turnsOf(id) : 0;
    if (t === 1) meta = (meta & ~3) | (((meta & 3) + this.rot) & 3);
    else if (t === 2 && (meta & 3) !== 1) meta = (meta & ~3) | (((meta & 3) + this.rot) & 3);
    this.L.put(p.x, y, p.z, id, meta);
  }
  // What's been put at (x, y, z) so far (undefined: nothing yet).
  at(x, y, z) {
    const p = this.pt(x, z);
    return this.L.at(p.x, y, p.z);
  }
  ground(x, z, id) {
    this.put(x, SURFACE, z, id);
  }
  fill(x0, z0, x1, z1, id) {
    for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) this.ground(x, z, id);
  }
  stack(x, z, y0, y1, id, meta = 0) {
    for (let y = y0; y <= y1; y++) this.put(x, y, z, id, meta);
  }

  // A place to stand or sit, and what it's for (see Layout.addSpot).
  spot(x, z, face, tags, extra = {}) {
    const p = this.pt(x, z);
    return this.L.addSpot(p.x, p.z, this.dir(face), tags, { q: this.i, ...extra });
  }
  // Where one of its own people works: `job` (see JOBS), and what else
  // they're doing there (`more`: 'train', 'read', 'pray'...).
  role(job, x, z, face, more = [], extra = {}) {
    const sp = this.spot(x, z, face, [roleTag(this.i, job), ...more], extra);
    (this.out.roles[job] ||= []).push(this.L.spots.length - 1);
    return sp;
  }
  // A seat for someone come to watch (a show, a race, a bout, a service),
  // a place for the town's people to sit about the rest of the time.
  // (A seat kept for some, `extra` saying who: { box: true } for the
  // great and the good.)
  seatOnly(x, y, z, face, extra = {}) {
    const p = this.pt(x, z);
    this.out.seats.push({ x: p.x, y, z: p.z, face: this.dir(face), ...extra });
  }
  seat(x, z, face, y = Y0, tags = ['social', 'gossip', 'rest']) {
    const p = this.pt(x, z);
    this.out.seats.push({ x: p.x, y, z: p.z, face: this.dir(face) });
    this.spot(x, z, face, tags, { y });
  }
  // Something in it to use (the block at x, y, z: see game/cityplay.js).
  fx(x, y, z, kind, id, meta = 0) {
    if (id !== undefined) this.put(x, y, z, id, meta);
    const p = this.pt(x, z);
    this.out.fx.push({ x: p.x, y, z: p.z, kind });
  }

  // ------------------------------------------------------------ things
  lamp(x, z, post = 1) {
    const L = this.m.lamp;
    if (L === B.lantern || L === B.fog_lantern) {
      for (let k = 0; k < post; k++) this.put(x, Y0 + k, z, B.fence);
      this.put(x, Y0 + post, z, L, LIT);
    } else this.put(x, Y0, z, L, LIT);
  }
  brazier(x, z, y = Y0) {
    this.put(x, y, z, this.fam === 'ember' ? B.ash_brazier : B.brazier, LIT);
  }
  column(x, z, h, top = null) {
    this.stack(x, z, Y0, Y0 + h - 1, this.m.column);
    if (top) this.put(x, Y0 + h, z, top, top === B.lantern || top === B.brazier ? LIT : 0);
  }
  canopy(x, z, y, rot, colour) {
    const style = (CANOPY_STYLES[this.s.style] ?? 6) << CANOPY_STYLE_SHIFT;
    this.put(x, y, z, B.canopy, (rot & 3) | ((colour & 3) << CANOPY_SHIFT) | style);
  }
  tent(x, z, rot, colour) {
    this.put(x, Y0, z, B.tent, (rot & 3) | ((colour & 3) << CANOPY_SHIFT));
  }
  // A great thing (see render/citypieces.js) at (x, z), on its plinth.
  piece(x, z, id, kind) {
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      this.ground(x + dx, z + dz, this.m.pave);
      if (dx || dz) this.put(x + dx, Y0, z + dz, B.plinth);
    }
    this.fx(x, Y0, z, kind, id);
  }
  // A pen of beasts (see Game.activate: stocked as an empire's are).
  pen(x0, z0, x1, z1, kinds, n) {
    const r = this.area({ x0, z0, x1, z1 });
    (this.L.pens ||= []).push({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, kinds, n });
  }
  // Smoke from a stack (see Layout.chimneys), a place to draw water.
  smoke(x, y, z) {
    const p = this.pt(x, z);
    this.L.chimneys.push({ x: p.x, y, z: p.z });
  }
  well(x, z) {
    this.L.wells?.push(this.pt(x, z));
  }
  // A square tower `w` across, `h` high, a brazier (or what's given) on top.
  tower(x0, z0, w, h, id, top = null) {
    for (let z = z0; z < z0 + w; z++) for (let x = x0; x < x0 + w; x++) this.stack(x, z, Y0, Y0 + h - 1, id);
    if (top === 'brazier') this.brazier(x0 + (w >> 1), z0 + (w >> 1), Y0 + h);
    else if (top) this.put(x0 + (w >> 1), Y0 + h, z0 + (w >> 1), top, LIT);
  }
  // A sign at the way in, saying whose it is (see sim.signText).
  sign(x, z, rot = 0) {
    // (Beside the way in, not in it: along the edge to the first free pace.)
    if (this.mouth(x, z) || (this.at(x, Y0, z) !== undefined && this.at(x, Y0, z) !== B.air)) {
      const alongX = z === this.z0 || z === this.z1;
      for (const d of [1, -1, 2, -2, 3, -3, 4, -4]) {
        const nx = alongX ? x + d : x;
        const nz = alongX ? z : z + d;
        if (!this.inLot(nx, nz) || this.mouth(nx, nz)) continue;
        const v = this.at(nx, Y0, nz);
        if (v !== undefined && v !== B.air) continue;
        x = nx;
        z = nz;
        break;
      }
      if (this.mouth(x, z)) return;
    }
    this.put(x, Y0, z, B.sign, rot);
    const p = this.pt(x, z);
    this.L.signs.push({ x: p.x, y: Y0, z: p.z, kind: 'quarter', q: this.i });
  }
  // A low wall of the lot's own stone round it, its ways in left open
  // (`except(x, z)`: left out too).
  enclose(id, h = 1, except = null, gap = 1) {
    for (let x = this.x0; x <= this.x1; x++) for (let z = this.z0; z <= this.z1; z++) {
      if (!this.onEdge(x, z) || this.atGate(x, z, gap) || (except && except(x, z))) continue;
      this.stack(x, z, Y0, Y0 + h - 1, id);
    }
  }

  // A hall with walls, windows, a door (or doors) and a roof: `r` its
  // rectangle; `o.doors` [{ x, z, rot }] (rot as a door faces: 0 south,
  // 1 west, 2 north, 3 east); `o.h` its height; `o.win` 'glass',
  // 'stained' or 'none'; `o.flat` a flat roof; the walls, corners, roof,
  // floor its own or the quarter's. The inside it leaves (and is
  // furnished by the caller), its record kept in out.halls.
  hall(r, o = {}) {
    const m = this.m;
    const wall = o.wall ?? m.wall;
    const corner = o.corner ?? m.corner;
    const roof = o.roof ?? m.roof;
    const floor = o.floor ?? m.floor;
    const h = o.h ?? 3;
    const top = Y0 + h - 1;
    const flat = o.flat ?? m.flat;
    const doors = o.doors || [];
    const isDoor = (x, z) => doors.some((d) => d.x === x && d.z === z);
    const byDoor = (x, z) => doors.some((d) => Math.abs(d.x - x) + Math.abs(d.z - z) === 1);
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) this.ground(x, z, floor);
    for (let z = r.z0; z <= r.z1; z++) {
      for (let x = r.x0; x <= r.x1; x++) {
        const edge = x === r.x0 || x === r.x1 || z === r.z0 || z === r.z1;
        if (!edge) {
          // (Clear inside, up to the roof: older ground may have had
          // something standing there.)
          if (o.clear) for (let y = Y0; y <= top; y++) this.put(x, y, z, B.air);
          continue;
        }
        const cornerT = (x === r.x0 || x === r.x1) && (z === r.z0 || z === r.z1);
        const k = z === r.z0 || z === r.z1 ? x - r.x0 : z - r.z0;
        for (let y = Y0; y <= top; y++) {
          let id = cornerT ? corner : wall;
          const winRow = y === Y0 + 1 || (h >= 4 && y === Y0 + 2);
          if (!cornerT && winRow && k % 2 === 0 && !isDoor(x, z) && !byDoor(x, z) && o.win !== 'none') id = o.win === 'stained' ? B.stained_glass : B.glass;
          if (isDoor(x, z) && y <= Y0 + 1) continue;
          this.put(x, y, z, id);
        }
      }
    }
    // (Round 147) Kept clear either side of each door: what's set about
    // there already taken away, nothing put there after.
    this.doorways ||= new Set();
    for (const d of doors) {
      for (const t of [this.outside(d), this.inside(d)]) {
        for (const y of [Y0, Y0 + 1]) {
          const v = this.at(t.x, y, t.z);
          if (v !== undefined && v !== B.air && softId(v)) this.put(t.x, y, t.z, B.air);
        }
        this.doorways.add(t.x * 65536 + t.z);
      }
    }
    for (const d of doors) {
      if (o.open) {
        this.put(d.x, Y0, d.z, B.air);
        this.put(d.x, Y0 + 1, d.z, B.air);
      } else {
        this.put(d.x, Y0, d.z, B.door, d.rot);
        this.put(d.x, Y0 + 1, d.z, B.door_top, d.rot);
      }
    }
    const roofBase = top + 1;
    if (flat) {
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) {
        this.put(x, roofBase, z, roof);
        const edge = x === r.x0 || x === r.x1 || z === r.z0 || z === r.z1;
        if (edge && (x + z) % 2 === 0) this.put(x, roofBase + 1, z, o.parapet ?? wall);
      }
    } else {
      const depth = r.z1 - r.z0 + 1;
      const layers = Math.min(Math.ceil(depth / 2), o.maxPitch ?? 5);
      for (let k = 0; k < layers; k++) {
        const y = roofBase + k;
        const zs = r.z0 + k;
        const ze = r.z1 - k;
        const last = k === layers - 1 && ze - zs > 1;
        for (let x = r.x0; x <= r.x1; x++) {
          if (last) {
            for (let z = zs; z <= ze; z++) this.put(x, y, z, roof, z === zs ? 2 : z === ze ? 0 : 1);
            continue;
          }
          for (const z of zs === ze ? [zs] : [zs, ze]) this.put(x, y, z, roof, zs === ze ? 1 : z === zs ? 2 : 0);
        }
        for (const x of [r.x0, r.x1]) for (let z = zs + 1; z <= ze - 1; z++) if (!last) this.put(x, y, z, wall);
      }
    }
    const rec = { x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1, ix0: r.x0 + 1, iz0: r.z0 + 1, ix1: r.x1 - 1, iz1: r.z1 - 1, doors, roofBase, use: o.use || null };
    this.out.halls.push({ ...this.area({ x0: r.x0, z0: r.z0, x1: r.x1, z1: r.z1 }), roofBase, use: o.use || null, doors: doors.map((d) => ({ ...this.pt(d.x, d.z), rot: this.dir(d.rot) })) });
    return rec;
  }
  // The tile inside a door (and the one beyond it).
  inside(d, k = 1) {
    return { x: d.x - DX[d.rot] * k, z: d.z - DZ[d.rot] * k };
  }
  outside(d, k = 1) {
    return { x: d.x + DX[d.rot] * k, z: d.z + DZ[d.rot] * k };
  }

  // ------------------------------------------------------------ rings
  // Which band of an oval (or a rounded box, `box`) the tile's in: 0 the
  // outermost, counting in, -1 outside it.
  ringOf(x, z, cx, cz, rx, rz, box = false) {
    const inside = (a, b) => {
      if (a <= 0 || b <= 0) return false;
      if (box) return Math.abs(x - cx) <= a && Math.abs(z - cz) <= b;
      return ((x - cx) / a) ** 2 + ((z - cz) / b) ** 2 <= 1.0001;
    };
    if (!inside(rx + 0.45, rz + 0.45)) return -1;
    let k = 0;
    while (inside(rx - k - 0.55, rz - k - 0.55) && k < 40) k++;
    return k;
  }
  // Seats stepping up and away from the middle (`cx`, `cz`): band `j` of
  // `T` (1 the lowest, by the pit) at (x, z): solid underneath, a step
  // on top, facing in; and a seat on it for the crowd.
  tier(x, z, j, cx, cz, solid, stairs, seat = true) {
    for (let y = Y0; y < Y0 + j - 1; y++) this.put(x, y, z, solid);
    const face = this.faceIn(x, z, cx, cz);
    // (A step rises away from whoever's facing it: toward the back.)
    this.put(x, Y0 + j - 1, z, stairs, (face + 2) & 3);
    if (seat) this.seat(x, z, face, Y0 + j);
  }
}

// ------------------------------------------------------------ ways about
// (Round 147) Can people get about a quarter as it's planned? From each of
// its ways in, over what's been put on its lot (Layout.at: ground at the
// surface where nothing's been put, air above it), taking the steps a
// person takes (see World.stepTarget: along, up one, down one or two;
// through doors). What's to be got to: every seat and place to stand of
// its own (a cell's excepted: the condemned are put there), and beside
// every thing in it to use. `fix`: where something can't be got to, a way
// opened to it through what's only set about (a rail, a crate, a row of
// vines: never a wall, a stair or a thing to use), the shortest there is.
const SOFT_RENDER = new Set(['sprite', 'plant', 'fence', 'flat']);
let SOFTS = null;
function softId(id) {
  if (!SOFTS) {
    SOFTS = new Uint8Array(BLOCKS.length);
    for (const b of BLOCKS) if (b && SOFT_RENDER.has(b.render) && !b.interact && !b.liquid) SOFTS[b.id] = 1;
    for (const n of ['hay_bale', 'stone_blocks', 'crate', 'barrel', 'rubble']) if (B[n] !== undefined) SOFTS[B[n]] = 1;
    for (const n of ['sign', 'canopy', 'stage_curtain']) if (B[n] !== undefined) SOFTS[B[n]] = 0;
  }
  return !!SOFTS[id];
}

export function waysAbout(L, qo, fix = false) {
  const lot = { x0: qo.x0, z0: qo.z0, x1: qo.x1, z1: qo.z1 };
  const inLot = (x, z) => x >= lot.x0 && x <= lot.x1 && z >= lot.z0 && z <= lot.z1;
  const id = (x, y, z) => {
    const v = L.at(x, y, z);
    if (v !== undefined) return v;
    return y >= Y0 ? B.air : y === SURFACE ? B.dirt : B.stone;
  };
  const blk = (x, y, z) => BLOCKS[id(x, y, z)] || BLOCKS[B.air];
  const canStand = (x, y, z) => {
    const feet = blk(x, y, z);
    if (feet.solid && feet.interact !== 'door' && feet.interact !== 'gate') return false;
    const below = blk(x, y - 1, z);
    const head = blk(x, y + 1, z);
    if ((head.solid && !below.stair) || head.liquid) return false;
    return !!below.standable || !!feet.ladder;
  };
  const step = (fx, fy, fz, x, z) => {
    if (canStand(x, fy, z)) return fy;
    if (blk(fx, fy - 1, fz).stair && blk(x, fy - 2, z).stair && canStand(x, fy - 1, z)) return fy - 1;
    const stairs = blk(x, fy, z).stair || blk(fx, fy - 1, fz).stair;
    if (canStand(x, fy + 1, z) && (stairs || !blk(fx, fy + 2, fz).solid)) return fy + 1;
    if (canStand(x, fy - 1, z)) return fy - 1;
    if (canStand(x, fy - 2, z) && !blk(x, fy - 1, z).solid && !blk(x, fy, z).solid) return fy - 2;
    return -1;
  };
  const key = (x, y, z) => (x - lot.x0 + 1) * 4194304 + (z - lot.z0 + 1) * 64 + (y & 63);
  const cols = new Map();
  const reached = new Set();
  const walk = (starts) => {
    const queue = [...starts];
    for (const [x, y, z] of starts) mark(x, y, z);
    while (queue.length) {
      const [x, y, z] = queue.pop();
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const nz = z + DZ[d];
        if (!inLot(nx, nz)) continue;
        const ny = step(x, y, z, nx, nz);
        if (ny < 0 || reached.has(key(nx, ny, nz))) continue;
        mark(nx, ny, nz);
        queue.push([nx, ny, nz]);
      }
    }
  };
  function mark(x, y, z) {
    reached.add(key(x, y, z));
    const c = x * 65536 + z;
    const a = cols.get(c);
    if (a) a.push(y);
    else cols.set(c, [y]);
  }
  const starts = [];
  for (const g of qo.gates || []) {
    for (let y = Y0 - 1; y <= Y0 + 2; y++) if (canStand(g.x, y, g.z)) {
      starts.push([g.x, y, g.z]);
      break;
    }
  }
  walk(starts);
  const at = (x, y, z, tol) => (cols.get(x * 65536 + z) || []).some((yy) => Math.abs(yy - y) <= tol);
  const beside = (x, y, z, tol) => at(x, y, z, tol) || at(x + 1, y, z, tol) || at(x - 1, y, z, tol) || at(x, y, z + 1, tol) || at(x, y, z - 1, tol);
  // What's to be got to.
  const goals = [];
  for (const st of qo.seats || []) goals.push({ x: st.x, y: st.y, z: st.z, near: 0, what: 'seat' });
  for (const p of L.spots) if (p.q === qo.i && !p.tags.includes('cell')) goals.push({ x: p.x, y: p.y ?? Y0, z: p.z, near: p.seat ? 1 : 0, what: p.tags[0], spot: p });
  for (const f of qo.fx || []) goals.push({ x: f.x, y: f.y, z: f.z, near: 1, what: f.kind, big: f.kind === 'carousel' || f.kind === 'colossus' || f.kind === 'champion' || f.kind === 'lighthouse' || f.kind === 'bell' });
  const ok = (g) => (g.big ? [-2, -1, 0, 1, 2].some((dx) => [-2, -1, 0, 1, 2].some((dz) => at(g.x + dx, Y0, g.z + dz, 12))) : g.near ? beside(g.x, g.y, g.z, 2) : at(g.x, g.y, g.z, 1) || (g.what === 'seat' && beside(g.x, g.y, g.z, 1)));
  let missing = goals.filter((g) => !ok(g));
  let moved = 0;
  let cut = 0;
  // A place to stand that's been set where nobody can stand (on a table,
  // in a wall's footing): moved to the nearest that can be got to.
  if (fix) {
    for (const g of missing) {
      if (!g.spot || g.near) continue;
      let best = null;
      for (let r = 1; r <= 2 && !best; r++) {
        for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const ys = cols.get((g.x + dx) * 65536 + g.z + dz);
          const y = ys && ys.find((yy) => Math.abs(yy - g.y) <= 1);
          if (y !== undefined && (!best || Math.abs(dx) + Math.abs(dz) < best.d)) best = { x: g.x + dx, z: g.z + dz, y, d: Math.abs(dx) + Math.abs(dz) };
        }
      }
      if (!best) continue;
      moved++;
      g.spot.x = g.x = best.x;
      g.spot.z = g.z = best.z;
      if (g.spot.y !== undefined || best.y !== Y0) g.spot.y = g.y = best.y;
    }
    missing = goals.filter((g) => !ok(g));
  }
  if (fix && missing.length) {
    // Things that are there to be used, sat on or stood at: never cleared.
    const keep = new Set();
    for (const g of goals) keep.add(g.x * 65536 + g.z);
    for (const sg of L.signs || []) if (inLot(sg.x, sg.z)) keep.add(sg.x * 65536 + sg.z);
    const clearable = (x, y, z) => {
      if (keep.has(x * 65536 + z)) return false;
      for (const yy of [y, y + 1]) {
        const v = id(x, yy, z);
        if (v !== B.air && !softId(v)) return false;
      }
      return true;
    };
    for (let round = 0; round < 24 && missing.length; round++) {
      const g = missing[0];
      // The cheapest way to it from anywhere already got to: through open
      // ground at a pace each, through what's set about at ten.
      const dist = new Map();
      const from = new Map();
      const heap = new MinHeap();
      for (const k of reached) {
        dist.set(k, 0);
        heap.push([Math.floor(k / 4194304) + lot.x0 - 1, k % 64, Math.floor((k % 4194304) / 64) + lot.z0 - 1], 0);
      }
      const reach = g.big ? 2 : g.near ? 1 : 0;
      const tol = g.big ? 12 : 2;
      let end = null;
      for (let guard = 0; heap.size && guard < 30000; guard++) {
        const d0 = heap.prio[0];
        const [x, y, z] = heap.pop();
        const k0 = key(x, y, z);
        if (dist.get(k0) < d0) continue;
        if (Math.abs(x - g.x) + Math.abs(z - g.z) <= reach && Math.abs(y - g.y) <= tol) {
          end = [x, y, z];
          break;
        }
        for (let k = 0; k < 4; k++) {
          const nx = x + DX[k];
          const nz = z + DZ[k];
          if (!inLot(nx, nz)) continue;
          let ny = step(x, y, z, nx, nz);
          let cost = 1;
          let cut = false;
          if (ny < 0 && clearable(nx, y, nz) && blk(nx, y - 1, nz).standable && !blk(nx, y + 2, nz).solid) {
            ny = y;
            cost = 10;
            cut = true;
          }
          if (ny < 0) continue;
          const nk = key(nx, ny, nz);
          const nd = d0 + cost;
          if (dist.has(nk) && dist.get(nk) <= nd) continue;
          dist.set(nk, nd);
          from.set(nk, [x, y, z, cut]);
          heap.push([nx, ny, nz], nd);
        }
      }
      if (!end) {
        missing.shift();
        continue;
      }
      // Open the way: clear what's set about on it.
      for (let cur = end, n = 0; cur && n < 400; n++) {
        const prev = from.get(key(cur[0], cur[1], cur[2]));
        if (!prev) break;
        if (prev[3]) {
          cut++;
          for (const yy of [cur[1], cur[1] + 1]) if (id(cur[0], yy, cur[2]) !== B.air) L.put(cur[0], yy, cur[2], B.air);
        }
        cur = prev;
      }
      walk([end]);
      missing = goals.filter((q) => !ok(q));
    }
  }
  // (Seats nobody can get to aren't offered to a crowd.)
  if (fix && missing.some((g) => g.what === 'seat')) {
    const bad = new Set(missing.filter((g) => g.what === 'seat').map((g) => `${g.x},${g.y},${g.z}`));
    qo.seats = qo.seats.filter((st) => !bad.has(`${st.x},${st.y},${st.z}`));
    missing = missing.filter((g) => g.what !== 'seat');
  }
  return { reached, missing, goals: goals.length, walkable: cols.size, moved, cut };
}

export { DX, DZ, LIT };
