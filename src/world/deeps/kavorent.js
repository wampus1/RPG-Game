// (Round 99) The Kavorent, made over: the deep a precise and vanished
// people built to leave their bodies in. Not a ruin, mostly: still running.
// Polished alloy seamed with cold light, inlaid floors, a hum under
// everything; halls far bigger than they need be, sentinels twice your
// height, and constructs keeping it all exactly as it was until the long
// count ends. Large and many-roomed, with little up and down: daises two
// steps up, galleries along a hall's side, channels sunk in the floor.
//
// A floor of it, beside the old rooms (the pillared halls, labs, archives,
// hangars, the reactor's node ring, the console and its plates, the
// sequence of plates, the emitters' gallery, the fallen rooms, the foundry
// and its Prime, the vaults), and what its own rooms are:
//   the cradle: the sleepers' hall, rows of pods on a dais along its back
//     wall (most sealed, some open and empty, one broken from inside), the
//     wall behind them the wall of their names, a runner of inlay up to the
//     steps; a conductor and its drones keep the choir;
//   the concourse: a long hall, a gallery a step up along its back wall
//     behind a rail (what's up there shoots down at you), a sentinel at its
//     end;
//   the orrery: the great model of the rings round the spire, turning, a
//     ring of inlay round it, consoles about it;
//   the repair bay: construct cradles along the wall, a construct dormant
//     in front of each (they wake when you come close), crates of parts, a
//     tank, the work log, a reclaimer at its scrap;
//   the conduit spine: a channel sunk down the hall's length full of live
//     cables, grates across it, viewports onto the works; conductors;
//   the memory well: a shaft of light out of the floor, three glyph
//     pillars before it to turn to the glyphs its console shows (lit by the
//     archivist when it comes by, or by its passing); set right, the well
//     gives back what it keeps; set wrong, it wakes what's near.
// About the floor: sentinel lenses by the doors (walk in their sight and
// they call what's near), and its papers (see deeps/kavlore.js) made from
// the ruin's own history and what the towns above make of it.
import { B, BLOCKS } from '../blocks.js';
import { hash4 } from '../../util/rng.js';
import { kavLore } from './kavlore.js';
import { kavKind } from '../dungeongen.js';
import { key, raise, sink, put, isUp, free, near, mainDoor, groupOf, lore, place } from './common.js';

// The rooms a Kavorent floor's made of (beyond the way in and the way
// on): the sleepers' hall on every floor that isn't its master's, the old
// puzzles kept, and more of what the floor was for (see KAV_KINDS).
const POOL = [['hall', 2], ['lab', 2], ['hangar', 2], ['gallery_k', 1], ['plates', 1], ['archive', 1], ['collapse_k', 1], ['concourse', 2], ['repair', 2], ['spine', 1], ['orrery', 1], ['well', 1]];
const BY_KIND = {
  works: ['spine', 'lab', 'repair'],
  archive: ['orrery', 'well', 'archive'],
  dynamo: ['spine', 'concourse', 'hangar'],
  fallen: ['collapse_k', 'repair', 'hangar'],
  garrison: ['concourse', 'hall', 'repair'],
  blighted: ['lab', 'collapse_k', 'well'],
};
// One of each to a floor, at most.
const ONCE = new Set(['cradle', 'orrery', 'well', 'spine', 'field', 'reactor', 'plates', 'archive', 'gallery_k']);
export const KAV_OWN = new Set(['cradle', 'concourse', 'orrery', 'repair', 'spine', 'well']);

function kits(rng, rec, n, last, count) {
  const kind = kavKind(rec, n);
  const out = [];
  // (The master's floor: something to stand in the master's place at the
  // head of the list, which is made the master's hall.)
  if (last) out.push('hall');
  out.push(...(BY_KIND[kind] || ['concourse', 'orrery']));
  out.push('field', 'reactor');
  if (!last) out.push('cradle');
  let guard = 0;
  while (out.length < count && guard++ < 300) {
    const k = rng.weighted(POOL);
    if (ONCE.has(k) && out.includes(k)) continue;
    if (out.filter((q) => q === k).length >= 2) continue;
    out.push(k);
  }
  // (The sleepers kept at the end of the list, clear of the first.)
  const head = last ? [out[0]] : [];
  const rest = rng.shuffle(out.slice(head.length).filter((k) => k !== 'cradle'));
  const keep = out.includes('cradle') ? ['cradle'] : [];
  return [...head, ...rest].slice(0, count - keep.length).concat(keep);
}

// (Made larger again by the Kavorent's own hand: see roomSize.)
const SIZES = {
  cradle: [[10, 13], [7, 8]], concourse: [[12, 14], [6, 7]], orrery: [[8, 9], [8, 9]], repair: [[9, 11], [6, 7]], spine: [[11, 13], [6, 7]], well: [[7, 8], [7, 8]],
};
const SHAPES = { cradle: ['rect'], concourse: ['rect'], orrery: ['octagon', 'hex'], repair: ['rect'], spine: ['rect'], well: ['octagon', 'hex'] };

// The master waiting at the bottom: chosen from the ruin's own seed, so
// every floor's papers can speak of it.
const bossOf = (rec, T) => {
  const list = (T.bosses || []).filter(Boolean);
  return list.length ? list[hash4(rec.seed >>> 0, 0, 0x9b4) % list.length] : null;
};
const Lof = (ctx) => ctx.kavLore || (ctx.kavLore = kavLore(ctx.rec, ctx.n, bossOf(ctx.rec, ctx.T)));

// --------------------------------------------------------------- helpers
const floorAt = (ctx, x, z, id) => ctx.b.set(x, ctx.FY - 1, z, id);
const lifted = (ctx, x, z) => (ctx.lifted ||= new Set()).add(key(ctx, x, z));
// A free tile near another, where it'll be seen.
const spotShown = (ctx, H, r, x, z, rad = 2) => near(ctx, H, r, x, z, rad, (qx, qz) => ctx.plan.at(qx, qz + 1));
// A group of them set out about a spot, waking as one when you come near.
function band(ctx, H, r, list, at, k, o = {}) {
  const g = groupOf(ctx, r, k);
  const out = [];
  for (const species of list) {
    const s0 = near(ctx, H, r, at.x + ctx.rng.int(-1, 1), at.z + ctx.rng.int(-1, 1), 3);
    if (!s0) continue;
    const s = put(ctx, species, s0.x, s0.z, r, { dormant: 5, group: g, ...o });
    if (s) out.push(s);
  }
  return out;
}
// A sentinel lens by the room's main way in, against the wall: it sees
// whoever comes in.
function lens(ctx, H, r) {
  const door = mainDoor(ctx, H, r);
  if (!door) return null;
  for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [2, 0], [-2, 0], [1, 1], [-1, 1]]) {
    const x = door.x + ox;
    const z = door.z + oz;
    if (!free(ctx, H, r, x, z) || !H.byWall(ctx.plan, x, z)) continue;
    ctx.b.set(x, ctx.FY, z, B.kav_lens);
    (ctx.out.lenses ||= []).push({ x: ctx.b.x0 + x, z, room: r.id });
    return { x, z };
  }
  return null;
}
// A runner of inlay down the middle of the room, along its long way.
function runner(ctx, H, r, from = 0, to = 0) {
  const longX = r.x1 - r.x0 >= r.z1 - r.z0;
  if (longX) {
    const z = Math.round((r.z0 + r.z1) / 2);
    for (let x = r.x0 + 1 + from; x <= r.x1 - 1 - to; x++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z)) floorAt(ctx, x, z, B.kav_inlay);
  } else {
    const x = Math.round((r.x0 + r.x1) / 2);
    for (let z = r.z0 + 1 + from; z <= r.z1 - 1 - to; z++) if (H.own(ctx.plan, r, x, z) && !isUp(ctx, x, z)) floorAt(ctx, x, z, B.kav_inlay);
  }
}
// The tiles of the rows along the back (north) wall to leave at floor
// level: a lane from any way in that opens there down to the room's floor.
function lanes(ctx, H, r, rows) {
  const keep = new Set();
  for (const d of H.doorways(ctx.plan, r)) {
    if (!H.own(ctx.plan, r, d.x, d.z) || d.z > r.z0 + rows - 1) continue;
    for (let z = d.z; z <= r.z0 + rows - 1; z++) for (const dx of [0, d.ox ? 0 : 1]) keep.add(key(ctx, d.x + dx, z));
    // (And the floor in front of it kept clear, so nothing stood there
    // shuts the lane.)
    for (let z = r.z0 + rows; z <= r.z0 + rows + 1; z++) if (H.own(ctx.plan, r, d.x, z)) ctx.reserved.add(key(ctx, d.x, z));
  }
  return keep;
}
// A dais (or gallery) two rows deep along the back wall, from x0 to x1,
// leaving a lane down from any way in that opens onto it.
function dais(ctx, H, r, x0, x1) {
  const keep = lanes(ctx, H, r, 2);
  for (const z of [r.z0, r.z0 + 1]) for (let x = x0; x <= x1; x++) if (free(ctx, H, r, x, z) && !keep.has(key(ctx, x, z))) raise(ctx, H, x, z, B.kav_dais);
}
// The north wall's tiles (their faces are the ones you see), from the
// room's west end to its east.
function northWall(ctx, r) {
  const out = [];
  for (let x = r.x0; x <= r.x1; x++) {
    let z = r.z0;
    while (z <= r.z1 && ctx.plan.room[z * ctx.W + x] !== r.id) z++;
    if (z > r.z1 || ctx.plan.at(x, z - 1)) continue;
    out.push({ x, z: z - 1 });
  }
  return out;
}

// --------------------------------------------------------------- the rooms
// The sleepers' hall.
function cradle(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const z0 = r.z0;
  // The dais, two rows deep along the back (north) wall, and its steps.
  dais(ctx, H, r, r.x0 + 1, r.x1 - 1);
  const steps = [r.cx];
  if (r.x1 - r.x0 >= 12) steps.push(r.x0 + 2, r.x1 - 2);
  for (const x of steps) {
    if (!isUp(ctx, x, z0 + 1) || !free(ctx, H, r, x, z0 + 2)) continue;
    b.set(x, FY, z0 + 2, B.kav_steps, 2);
    lifted(ctx, x, z0 + 2);
  }
  // The pods along the back row, a pace apart: most of them sealed, some
  // open and empty, one broken (from inside).
  const pods = [];
  for (let x = r.x0 + 1; x <= r.x1 - 1; x += 2) if (isUp(ctx, x, z0) && b.get(x, FY + 1, z0) === B.air) pods.push(x);
  const broke = pods.length ? rng.pick(pods) : null;
  for (const x of pods) {
    const id = x === broke && (L.fault === 'woke' || rng.chance(0.6)) ? B.kav_pod_broken : rng.chance(0.2) ? B.kav_pod_open : B.kav_pod;
    b.set(x, FY + 1, z0, id);
    if (id === B.kav_pod) lore(ctx, x, z0, L.plate());
    else if (id === B.kav_pod_broken) lore(ctx, x, z0, L.woke());
  }
  // The wall behind them: their names.
  const names = L.names();
  for (const w of northWall(ctx, r)) {
    if (w.x < r.x0 + 1 || w.x > r.x1 - 1) continue;
    for (const y of [FY, FY + 1]) b.set(w.x, y, w.z, B.kav_mural);
    lore(ctx, w.x, w.z, names);
  }
  // The way up to them, and lamps at the foot of the dais.
  for (let z = z0 + 3; z <= r.z1 - 1; z++) if (H.own(ctx.plan, r, r.cx, z) && !isUp(ctx, r.cx, z)) floorAt(ctx, r.cx, z, B.kav_inlay);
  for (const x of [r.x0 + 1, r.x1 - 1]) {
    const at = spotShown(ctx, H, r, x, z0 + 3, 1);
    if (at) b.set(at.x, FY, at.z, B.kav_lamp);
  }
  // (Where the blight's in the conduits, its crystal grows by the pods.)
  if (L.fault === 'blight' || ctx.kind === 'blighted') for (let i = 0; i < 2; i++) place(ctx, H, r, B.kav_shards);
  // The choir's keepers.
  band(ctx, H, r, ['conductor', 'drone', 'drone'], { x: r.cx, z: z0 + 3 }, 'choir');
  if (rng.chance(0.5)) H.chestIn(ctx, r, 1, B.kav_cache);
}

// A long hall, a gallery along its back.
function concourse(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const z0 = r.z0;
  dais(ctx, H, r, r.x0 + 1, r.x1 - 1);
  // Steps up at either end; the rail along its front edge between.
  const steps = [];
  for (const x of [r.x0 + 2, r.x1 - 2]) {
    if (!isUp(ctx, x, z0 + 1) || !free(ctx, H, r, x, z0 + 2)) continue;
    b.set(x, FY, z0 + 2, B.kav_steps, 2);
    lifted(ctx, x, z0 + 2);
    steps.push(x);
  }
  for (let x = r.x0; x <= r.x1; x++) {
    if (!isUp(ctx, x, z0 + 1) || steps.some((s) => Math.abs(s - x) <= 1)) continue;
    if (x % 4 === 0 || rng.chance(0.85)) b.set(x, FY + 1, z0 + 1, B.kav_rail);
  }
  runner(ctx, H, { ...r, z0: z0 + 2 }, 1, 1);
  // A sentinel at the far end, lamps along the open side.
  const end = mainDoor(ctx, H, r);
  const ex = end && end.x <= r.cx ? r.x1 - 1 : r.x0 + 1;
  const st = spotShown(ctx, H, r, ex, Math.round((z0 + 2 + r.z1) / 2), 1);
  if (st) b.set(st.x, FY, st.z, B.kav_statue);
  for (let x = r.x0 + 2; x <= r.x1 - 2; x += 6) {
    const at = spotShown(ctx, H, r, x, r.z1 - 1, 1);
    if (at) b.set(at.x, FY, at.z, B.kav_lamp);
  }
  lens(ctx, H, r);
  // The relay: a prism up on the gallery, drones beside it; or else the
  // line at the far end: wardens, a conductor between them.
  const up = [];
  for (let x = r.x0; x <= r.x1; x++) if (isUp(ctx, x, z0) && b.get(x, FY + 1, z0) === B.air) up.push(x);
  if (up.length >= 3 && rng.chance(0.6)) {
    const g = groupOf(ctx, r, 'relay');
    const mid = up[Math.floor(up.length / 2)];
    put(ctx, 'prism', mid, z0, r, { dormant: 7, group: g });
    for (const x of [up[1], up[up.length - 2]]) if (x !== mid) put(ctx, 'drone', x, z0, r, { dormant: 7, group: g });
  } else band(ctx, H, r, ['warden', 'conductor', 'warden'], { x: ex, z: r.z1 - 1 }, 'line');
}

// The great model of the rings.
function orrery(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const o = near(ctx, H, r, r.cx, r.cz, 1);
  if (!o) return;
  b.set(o.x, FY, o.z, B.kav_orrery);
  lore(ctx, o.x, o.z, L.orrery());
  // A ring of inlay round it.
  for (let z = o.z - 3; z <= o.z + 3; z++) {
    for (let x = o.x - 3; x <= o.x + 3; x++) {
      const d = Math.hypot(x - o.x, z - o.z);
      if (d >= 1.6 && d < 2.6 && H.own(ctx.plan, r, x, z)) floorAt(ctx, x, z, B.kav_inlay);
    }
  }
  // Consoles about it, and the light-screens they throw.
  const cons = [];
  for (const [dx, dz] of [[-3, 0], [3, 0], [0, -3]]) {
    const at = near(ctx, H, r, o.x + dx, o.z + dz, 1);
    if (!at) continue;
    b.set(at.x, FY, at.z, B.kav_console);
    cons.push(at);
  }
  for (const [dx, dz] of [[-3, -3], [3, -3]]) {
    const at = spotShown(ctx, H, r, o.x + dx, o.z + dz, 1);
    if (at) b.set(at.x, FY, at.z, B.kav_lamp);
  }
  band(ctx, H, r, rng.chance(0.5) ? ['prism', 'drone'] : ['drone', 'drone'], { x: o.x, z: o.z + 2 }, 'rings');
}

// The repair bay.
function repair(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const g = groupOf(ctx, r, 'wake');
  // Cradles along the back wall, each with its construct stood dormant
  // before it (they wake as one).
  let made = 0;
  for (let x = r.x0 + 1; x <= r.x1 - 1; x += 3) {
    if (!free(ctx, H, r, x, r.z0) || !free(ctx, H, r, x, r.z0 + 1)) continue;
    b.set(x, FY, r.z0, B.kav_cradle);
    if (made < 3) put(ctx, made === 1 && ctx.n >= 1 ? 'golem' : 'warden', x, r.z0 + 1, r, { dormant: 3, group: g });
    made++;
  }
  // Crates of parts, a tank, its work log, its scrap.
  for (let i = 0; i < rng.int(2, 3); i++) place(ctx, H, r, B.kav_crate, 0, true);
  place(ctx, H, r, B.kav_tank, 0, true);
  const con = place(ctx, H, r, B.kav_console, 0, true);
  if (con) lore(ctx, con.x, con.z, L.worklog());
  for (let i = 0; i < 2; i++) place(ctx, H, r, B.kav_husk, rng.int(0, 3), true);
  // A mender at its work, and the reclaimer at the scrap.
  const at = near(ctx, H, r, r.cx, r.z1 - 1, 3);
  if (at) put(ctx, 'mender', at.x, at.z, r, { dormant: 4, group: g });
  const at2 = near(ctx, H, r, r.x1 - 2, r.z1 - 1, 3);
  if (at2) put(ctx, 'reclaimer', at2.x, at2.z, r, { dormant: 4, group: g });
  lens(ctx, H, r);
}

// The conduit spine: a channel of live cables down its length.
function spine(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const z = Math.round((r.z0 + r.z1) / 2);
  const cross = rng.int(3, 4);
  const sunk = [];
  for (let x = r.x0 + 2; x <= r.x1 - 2; x++) {
    for (const zz of [z, z + 1]) {
      if (!free(ctx, H, r, x, zz)) continue;
      // (Grates across it, every few paces: the ways over.)
      if ((x - r.x0) % (cross + 1) === 0) {
        floorAt(ctx, x, zz, B.kav_grate);
        continue;
      }
      sink(ctx, H, x, zz, B.kav_cables);
      sunk.push({ x: b.x0 + x, z: zz });
    }
  }
  if (sunk.length) (ctx.out.cables ||= []).push(...sunk);
  // Viewports onto the works along the back wall.
  for (const w of northWall(ctx, r)) if ((w.x + r.z0) % 3 === 0) for (const y of [FY, FY + 1]) b.set(w.x, y, w.z, B.kav_viewport);
  for (let i = 0; i < 3; i++) place(ctx, H, r, B.kav_conduit, 0, true);
  band(ctx, H, r, ctx.n >= 1 ? ['conductor', 'conductor', 'mite'] : ['conductor', 'mite', 'mite'], { x: r.cx, z: r.z1 - 1 }, 'spine');
}

// The memory well, and its three glyph pillars.
function well(ctx, H, r) {
  const { b, rng } = ctx;
  const FY = H.FY;
  const L = Lof(ctx);
  const w = near(ctx, H, r, r.cx, r.cz - 1, 1);
  if (!w) return;
  b.set(w.x, FY, w.z, B.kav_well);
  // The pillars, in a row before it, left to right.
  let row = null;
  for (const dz of [2, 3, -2]) {
    const xs = [w.x - 2, w.x, w.x + 2];
    if (xs.every((x) => free(ctx, H, r, x, w.z + dz))) {
      row = xs.map((x) => ({ x, z: w.z + dz }));
      break;
    }
  }
  if (!row) return;
  const want = row.map(() => rng.int(0, 3));
  const pillars = row.map((p, i) => {
    const start = (want[i] + rng.int(1, 3)) % 4;
    b.set(p.x, FY, p.z, B.kav_glyph, start);
    return { x: b.x0 + p.x, z: p.z, want: want[i] };
  });
  // Where it gives back what it keeps (kept clear).
  const cache = [[0, -1], [1, 0], [-1, 0], [0, 1]].map(([dx, dz]) => ({ x: w.x + dx, z: w.z + dz })).find((q) => free(ctx, H, r, q.x, q.z) && !row.some((p) => p.x === q.x && p.z === q.z));
  if (cache) ctx.reserved.add(key(ctx, cache.x, cache.z));
  // Its console, against the wall (dark till the archivist comes by).
  const con = place(ctx, H, r, B.kav_console, 0, true);
  (ctx.out.wells ||= []).push({
    x: b.x0 + w.x,
    z: w.z,
    pillars,
    cache: cache ? { x: b.x0 + cache.x, z: cache.z } : null,
    console: con ? { x: b.x0 + con.x, z: con.z } : null,
    text: L.well(want),
  });
  for (let i = 0; i < 2; i++) {
    const s = near(ctx, H, r, w.x + rng.pick([-2, 2]), w.z + rng.int(-1, 1), 2);
    if (s) b.set(s.x, FY, s.z, B.kav_shards);
  }
  // The archivist, who keeps it (walking from console to console).
  const a = near(ctx, H, r, w.x + 1, w.z + 1, 3);
  if (a) put(ctx, 'archivist', a.x, a.z, r, { peaceful: true, role: 'archivist' });
}

function dress(ctx, r, H) {
  ctx.FY = H.FY;
  switch (r.kit) {
    case 'cradle':
      return cradle(ctx, H, r);
    case 'concourse':
      return concourse(ctx, H, r);
    case 'orrery':
      return orrery(ctx, H, r);
    case 'repair':
      return repair(ctx, H, r);
    case 'spine':
      return spine(ctx, H, r);
    case 'well':
      return well(ctx, H, r);
  }
}

// The old rooms, dressed as they were (see dungeongen.dressBase), and a
// little more of the ruin's own about them.
function extra(ctx, r, H) {
  const { b, rng } = ctx;
  ctx.FY = H.FY;
  const L = Lof(ctx);
  switch (r.kit) {
    case 'entry': {
      // Someone from above got this far once.
      if (ctx.n === 0) {
        const at = place(ctx, H, r, B.kav_crate, 0, true);
        if (at) lore(ctx, at.x, at.z, L.visitor());
      }
      const lp = place(ctx, H, r, B.kav_lamp, 0, true);
      if (lp && rng.chance(0.5)) place(ctx, H, r, B.kav_lamp, 0, true);
      break;
    }
    case 'hall':
      runner(ctx, H, r, 1, 1);
      lens(ctx, H, r);
      break;
    case 'lab': {
      // (A tank and a crate, where there's room for them.)
      if (crowd(ctx, H, r) < 0.12) place(ctx, H, r, B.kav_tank, 0, true);
      if (crowd(ctx, H, r) < 0.12) place(ctx, H, r, B.kav_crate, 0, true);
      // A warning on one of its consoles.
      for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && b.get(x, ctx.FY, z) === B.kav_console && !(ctx.out.lore || []).some((q) => q.x === b.x0 + x && q.z === z)) return lore(ctx, x, z, L.warning());
      break;
    }
    case 'hangar': {
      let n = 0;
      for (const w of northWall(ctx, r)) {
        const x = w.x;
        const z = w.z + 1;
        if (n >= 2 || x % 3 || !free(ctx, H, r, x, z)) continue;
        b.set(x, ctx.FY, z, B.kav_cradle);
        n++;
      }
      place(ctx, H, r, B.kav_crate, 0, true);
      // (The salvage: a reclaimer among the hangar's own, turning your
      // kills into mites.)
      if (rng.chance(0.6)) band(ctx, H, r, ['reclaimer'], { x: r.cx, z: r.cz }, 'salvage');
      break;
    }
    case 'collapse_k':
      for (const w of northWall(ctx, r)) if (rng.chance(0.5)) for (const y of [ctx.FY, ctx.FY + 1]) b.set(w.x, y, w.z, B.kav_failed);
      if (rng.chance(0.5)) place(ctx, H, r, B.kav_shards);
      if (rng.chance(0.5)) band(ctx, H, r, ['reclaimer'], { x: r.cx, z: r.cz }, 'scrap');
      break;
    case 'field':
    case 'reactor':
      if (rng.chance(0.5)) lens(ctx, H, r);
      break;
    case 'boss': {
      // What's written at its master's door.
      const at = near(ctx, H, r, r.cx, r.z1 - 1, 3);
      if (at) {
        b.set(at.x, ctx.FY, at.z, B.kav_crate);
        lore(ctx, at.x, at.z, L.last());
      }
      break;
    }
  }
}

// Each room set about with a few of the ruin's things, by what it was for,
// spaced out, the tall ones against the walls.
const DECOR = {
  hall: [['kav_statue', 3], ['kav_monolith', 1], ['kav_lamp', 2]],
  lab: [['kav_holo', 2], ['kav_conduit', 1], ['kav_vent', 1]],
  archive: [['kav_holo', 2], ['kav_monolith', 1]],
  hangar: [['kav_husk', 3], ['kav_vent', 2], ['kav_crate', 1]],
  reactor: [['kav_conduit', 2], ['kav_vent', 2]],
  field: [['kav_lamp', 1], ['kav_vent', 1]],
  plates: [['kav_lamp', 1], ['kav_holo', 1]],
  gallery_k: [['kav_conduit', 2], ['kav_vent', 1]],
  collapse_k: [['kav_husk', 3], ['kav_shards', 1]],
  entry: [['kav_holo', 1], ['kav_conduit', 1]],
  exit: [['kav_lamp', 1], ['kav_conduit', 1], ['kav_vent', 1]],
  concourse: [['kav_vent', 1], ['kav_holo', 1]],
  orrery: [['kav_vent', 1]],
  repair: [['kav_vent', 1]],
  spine: [['kav_vent', 1]],
  cradle: [['kav_vent', 1]],
  well: [['kav_vent', 1]],
};
// How much of a room's floor is taken up by something solid already (a
// dais, a gallery, what's set out on them).
function crowd(ctx, H, r) {
  let n = 0;
  let solid = 0;
  for (let z = r.z0; z <= r.z1; z++) {
    for (let x = r.x0; x <= r.x1; x++) {
      if (!H.own(ctx.plan, r, x, z)) continue;
      n++;
      if (BLOCKS[ctx.b.get(x, H.FY, z)].solid) solid++;
    }
  }
  return n ? solid / n : 1;
}
const TALL = new Set(['kav_statue', 'kav_monolith', 'kav_holo', 'kav_conduit', 'kav_husk', 'kav_crate', 'kav_lamp', 'kav_tank']);
function decorate(ctx, r, H) {
  const { rng, plan, b } = ctx;
  const list = DECOR[r.kit];
  if (!list || r.sealed) return;
  let area = 0;
  for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(plan, r, x, z)) area++;
  const n = Math.max(1, Math.round((area / 28) * rng.float(0.7, 1.2)));
  const set = [];
  for (let i = 0; i < n; i++) {
    // (Never so crowded there's no getting about it: see dungeongen.thinKav.)
    if (crowd(ctx, H, r) > 0.2) break;
    const k = rng.weighted(list);
    for (let t = 0; t < 12; t++) {
      const at = place(ctx, H, r, B[k], k === 'kav_husk' ? rng.int(0, 3) : 0, TALL.has(k));
      if (!at) break;
      // (Spaced out: never two of them within a couple of paces.)
      if (set.some((q) => Math.max(Math.abs(q.x - at.x), Math.abs(q.z - at.z)) < 3)) {
        b.set(at.x, H.FY, at.z, B.air);
        continue;
      }
      set.push(at);
      break;
    }
  }
}

// Its architect's last word: the archivist's walk.
function after(ctx, H) {
  const { out, b } = ctx;
  // (The archivist walks from console to console on its floor, the well's
  // last; whichever it stands by, it lights.)
  const cons = [];
  for (const r of out.rooms) {
    for (let z = r.z0; z <= r.z1; z++) for (let x = r.x0; x <= r.x1; x++) if (H.own(ctx.plan, r, x, z) && b.get(x, H.FY, z) === B.kav_console) cons.push({ x: b.x0 + x, z });
  }
  const wl = (out.wells || [])[0];
  for (const s of out.spawns) {
    if (s.species !== 'archivist') continue;
    const mine = cons.filter((c) => !wl || !wl.console || c.x !== wl.console.x || c.z !== wl.console.z);
    const pick = ctx.rng.shuffle(mine).slice(0, 3).sort((a, c) => Math.hypot(a.x - s.x, a.z - s.z) - Math.hypot(c.x - s.x, c.z - s.z));
    s.route = [...pick, ...(wl && wl.console ? [wl.console] : [])];
  }
}

export const KAV_ARCH = {
  own: KAV_OWN,
  kits,
  // (The sleepers' hall is never lost to the way down.)
  keep: new Set(['cradle']),
  spare: (rng, n, have = []) => {
    const pool = [['hall', 2], ['lab', 2], ['hangar', 1]].filter(([k]) => have.filter((q) => q === k).length < 2);
    return pool.length ? rng.weighted(pool) : 'lab';
  },
  sizes: SIZES,
  shapes: SHAPES,
  dress,
  extra,
  decorate,
  after,
  boss: (ctx) => bossOf(ctx.rec, ctx.T),
};
// (What a Kavorent hall's own things are, for those who count them.)
export const KAV_THINGS = ['kav_pod', 'kav_pod_open', 'kav_pod_broken', 'kav_cradle', 'kav_orrery', 'kav_rail', 'kav_tank', 'kav_lens', 'kav_crate', 'kav_shards', 'kav_well', 'kav_glyph'].filter((k) => BLOCKS[B[k]]);
