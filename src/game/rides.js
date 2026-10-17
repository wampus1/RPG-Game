// (Round 78) Riding the coach or the ferry the whole way. Climb in at the
// stand (or go aboard off the pier) and you're carried there: the coach
// along the road (or across country, the way the caravans go), the ferry
// out of the harbour, across the open sea and in to the far pier, the
// world going by. It takes the hours it says (see sim/coaches.js); on
// your own, T hurries it on (time racing, as when you wait), T again to
// ease off; with others in the world, nobody's time can be hurried, and
// you sit it out. A coach can be got down from on the way (F); a ferry
// can't, out at sea.
//   The ride's kept on the one riding (`_ride`, not sent over the wire:
// its way is long; `rideInfo` is, for the line on the screen), and its
// coach or ferry is a prop in game.props, so everyone sees it go by.
import { GROUND, REGION_W, REGION_D, WORLD_Y } from '../config.js';
import { coachStand, coachBay, arrivalSpot, wayTime, harbourWay, sendCoach, COACHMAN } from '../sim/coaches.js';
import { seaOff, seaRoute } from './shipfleets.js';
import { countItem, removeItem, addItem } from './inventory.js';
import { shippable, FERRY_CARRIES } from './stalls.js';
import { notePlaced } from './invtools.js';
import { BLOCKS, B, LOGS, LEAVES } from '../world/blocks.js';
import { M } from '../world/settlement.js';
import { MinHeap } from '../util/heap.js';

// How much quicker it all goes, hurried on (see Game.timeRate).
export const RIDE_FAST = 12;
// (Round 116) Got down from the coach this soon after climbing in (seconds),
// your fare's given back, and it turns about for its stand.
export const REFUND_SECS = 10;
// How long a coach waits where it's set you down, and the longest it takes
// on the way home (game minutes).
const DWELL = 20;
const HOME_MAX = 6 * 60;

const centre = (s) => ({ x: Math.round((s.cx + s.cw / 2) * REGION_W), z: Math.round((s.cz + s.cd / 2) * REGION_D) });
const abs = (game) => game.day * 1440 + game.minute;

// ------------------------------------------------------------ the way
// The coach's way (Round 82): down its own town's streets from the stand
// and out (through the gate, in a walled town), along the road if one's
// finished (or across country the way the caravans go, round the water
// and the other towns), and in by the far town's streets to its stand:
// never over the houses, or straight across a lake. Worked out a little
// at a time (`ms` of it a frame), the coach waiting at its stand till
// it's ready: null till then.
function coachWay(game, from, to, ms) {
  const D = game.sim.diplomacy;
  const world = game.world;
  const LA = world.layouts.get(from.id) || null;
  // (The far town laid out first, if it isn't yet: in the background.)
  const LB = world.layouts.get(to.id) || (world.remote ? null : world.layOut(to, game.instantWork ? Infinity : ms));
  if (!LB && !world.remote) return null;
  const was = D.wayMs;
  D.wayMs = game.instantWork ? Infinity : ms;
  let w;
  try {
    w = D.way(from, to);
  } finally {
    D.wayMs = was;
  }
  if (!w || w.rough) return null;
  const a = (LA && coachStand(LA)) || centre(from);
  const b = endOf(game, to, from);
  const pts = w.pts;
  const n = pts.length;
  // Where the way leaves the one town, and comes into the other.
  const out = leaving(pts, from.bounds);
  const inn = leaving(pts.slice().reverse(), to.bounds);
  // (Towns cheek by jowl: from stand to stand.)
  if (!out || !inn) return tidy([a, b]);
  const mid = pts.slice(out.i, n - inn.i).map((q) => ({ x: q.x, z: q.z }));
  return tidy([...streets(LA, a, out.p), ...mid, ...streets(LB, b, inn.p).reverse()]);
}

// (The margin round a town the coach goes by: just outside its edge.)
const RING = 3;

// The first point along `pts` where it's left the town's bounds (and the
// margin round them), and the first corner after: { p, i }; null if it
// never does.
function leaving(pts, bd) {
  if (!bd) return null;
  const inR = (x, z) => x >= bd.x0 - RING && x <= bd.x1 + RING && z >= bd.z0 - RING && z <= bd.z1 + RING;
  for (let k = 1; k < pts.length; k++) {
    const p0 = pts[k - 1];
    const p1 = pts[k];
    const steps = Math.max(1, Math.ceil(Math.hypot(p1.x - p0.x, p1.z - p0.z)));
    let last = { x: Math.round(p0.x), z: Math.round(p0.z) };
    for (let j = 1; j <= steps; j++) {
      const x = Math.round(p0.x + ((p1.x - p0.x) * j) / steps);
      const z = Math.round(p0.z + ((p1.z - p0.z) * j) / steps);
      if (!inR(x, z)) return { p: inR(last.x, last.z) ? last : { x, z }, i: k };
      last = { x, z };
    }
  }
  return null;
}

// The way through a town from (the stand) `s` to `goal` (just outside
// its edge): along its streets, squares and bridges where it can, over
// open ground if it must, never through a house, a yard, a wall or the
// water; round the outside of it in the margin. A search over its plan,
// straight runs liked better than turns. The corners of it, from `s` to
// `goal`; just the two, if there's no plan (or no way).
function streets(L, s, goal) {
  const g = { x: Math.round(goal.x), z: Math.round(goal.z) };
  const st = { x: Math.round(s.x), z: Math.round(s.z) };
  if (!L || !L.mask || !L.bounds) return [st, g];
  const bd = L.bounds;
  const x0 = bd.x0 - RING;
  const z0 = bd.z0 - RING;
  const W = bd.x1 - bd.x0 + 1 + RING * 2;
  const H = bd.z1 - bd.z0 + 1 + RING * 2;
  const okIn = (x, z) => x >= x0 && z >= z0 && x < x0 + W && z < z0 + H;
  if (!okIn(st.x, st.z) || !okIn(g.x, g.z)) return [st, g];
  const cost = (x, z) => {
    if (!L.inside(x, z)) return 2;
    switch (L.maskAt(x, z)) {
      case M.ROAD:
      case M.PLAZA:
      case M.BRIDGE:
        return 1;
      case M.FREE:
      case M.FIELD:
        return 6;
      case M.WATER:
      case M.WALL:
        return 0;
      // (Through a yard or round a house's corner only if there's no
      // other way at all.)
      default:
        return 60;
    }
  };
  const N = W * H;
  const best = new Float32Array(N * 5).fill(Infinity);
  const prev = new Int32Array(N * 5).fill(-1);
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const cell = (x, z) => (z - z0) * W + (x - x0);
  const heap = new MinHeap();
  const k0 = cell(st.x, st.z) * 5 + 4;
  best[k0] = 0;
  heap.push(k0, Math.abs(g.x - st.x) + Math.abs(g.z - st.z));
  const gc = cell(g.x, g.z);
  let end = -1;
  let n = 0;
  while (heap.size && n++ < 200000) {
    const k = heap.pop();
    const c = (k / 5) | 0;
    const d = k % 5;
    if (c === gc) {
      end = k;
      break;
    }
    const x = (c % W) + x0;
    const z = ((c / W) | 0) + z0;
    const gk = best[k];
    for (let q = 0; q < 4; q++) {
      const nx = x + DIRS[q][0];
      const nz = z + DIRS[q][1];
      if (!okIn(nx, nz)) continue;
      const cc = nx === g.x && nz === g.z ? 1 : cost(nx, nz);
      if (!cc) continue;
      const nk = cell(nx, nz) * 5 + q;
      const ng = gk + cc + (d !== 4 && d !== q ? 0.6 : 0);
      if (ng < best[nk]) {
        best[nk] = ng;
        prev[nk] = k;
        heap.push(nk, ng + Math.abs(g.x - nx) + Math.abs(g.z - nz));
      }
    }
  }
  if (end < 0) return [st, g];
  const cells = [];
  for (let k = end; k >= 0; k = prev[k]) {
    const c = (k / 5) | 0;
    cells.push({ x: (c % W) + x0, z: ((c / W) | 0) + z0 });
  }
  cells.reverse();
  // (Only the corners kept.)
  const outp = [cells[0]];
  for (let i = 1; i < cells.length - 1; i++) {
    const p0 = cells[i - 1];
    const p1 = cells[i];
    const p2 = cells[i + 1];
    if (p1.x - p0.x !== p2.x - p1.x || p1.z - p0.z !== p2.z - p1.z) outp.push(p1);
  }
  if (cells.length > 1) outp.push(cells[cells.length - 1]);
  return outp;
}

// (No point twice running, nor three in a line.)
function tidy(pts) {
  const out = [];
  for (const q of pts) {
    const l = out[out.length - 1];
    if (l && l.x === q.x && l.z === q.z) continue;
    out.push({ x: q.x, z: q.z });
  }
  return out.length >= 2 ? out : null;
}

// Where the coach pulls up at `s` (Round 116: in from `from`, at the way in
// on that side, or beside the coach standing there: see coachBay).
function endOf(game, s, from = null) {
  const L = game.world.layouts.get(s.id);
  const bay = L && coachBay(L, from);
  if (bay) return { x: bay.x, z: bay.z };
  const st = L && coachStand(L);
  if (st) return { x: st.x, z: st.z };
  const at = arrivalSpot(game, s, 'coach', from);
  return { x: at.x, z: at.z };
}

// Is (x, z) open sea (not land, however low)?
function sea(ow, x, z) {
  return ow.continentAt(x, z) < 0;
}

function seaLine(wet, a, b) {
  const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 2));
  for (let i = 1; i < n; i++) if (!wet(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n)) return false;
  return true;
}

// A way by water from a to b (both on it) a few paces at a step, round any
// land between: points, or null. (`wet`: what's water; the open sea's by
// default.)
export function seaPath(ow, a, b, step = 3, margin = 48, wet = (x, z) => sea(ow, x, z)) {
  if (seaLine(wet, a, b)) return [a, b];
  const x0 = Math.min(a.x, b.x) - margin;
  const z0 = Math.min(a.z, b.z) - margin;
  const W = Math.ceil((Math.max(a.x, b.x) + margin - x0) / step) + 1;
  const H = Math.ceil((Math.max(a.z, b.z) + margin - z0) / step) + 1;
  if (W * H > 200000) return null;
  const gx = (x) => Math.max(0, Math.min(W - 1, Math.round((x - x0) / step)));
  const gz = (z) => Math.max(0, Math.min(H - 1, Math.round((z - z0) / step)));
  const open = new Int8Array(W * H).fill(-1);
  const ok = (i) => {
    if (open[i] < 0) open[i] = wet(x0 + (i % W) * step, z0 + Math.floor(i / W) * step) ? 1 : 0;
    return open[i] === 1;
  };
  const s = gz(a.z) * W + gx(a.x);
  const t = gz(b.z) * W + gx(b.x);
  const prev = new Int32Array(W * H).fill(-2);
  prev[s] = -1;
  const q = [s];
  let found = false;
  for (let qi = 0; qi < q.length; qi++) {
    const i = q[qi];
    if (i === t) {
      found = true;
      break;
    }
    const x = i % W;
    const z = Math.floor(i / W);
    for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
      if (!dx && !dz) continue;
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nz < 0 || nx >= W || nz >= H) continue;
      const j = nz * W + nx;
      if (prev[j] !== -2 || (j !== t && !ok(j))) continue;
      prev[j] = i;
      q.push(j);
    }
  }
  if (!found) return null;
  const cells = [];
  for (let i = t; i >= 0; i = prev[i]) cells.push({ x: x0 + (i % W) * step, z: z0 + Math.floor(i / W) * step });
  cells.reverse();
  cells[0] = a;
  cells[cells.length - 1] = b;
  // (Straightened: from each point, on to the furthest one in plain sight.)
  const out = [cells[0]];
  let i = 0;
  while (i < cells.length - 1) {
    let j = cells.length - 1;
    while (j > i + 1 && !seaLine(wet, cells[i], cells[j])) j--;
    out.push(cells[j]);
    i = j;
  }
  return out;
}

// The open sea nearest a town on the coast with no pier yet (where the
// ferry drops anchor and a boat rows you in).
function offshore(ow, s) {
  const c = { x: (s.bounds.x0 + s.bounds.x1) / 2, z: (s.bounds.z0 + s.bounds.z1) / 2 };
  let best = null;
  for (let a = 0; a < 16; a++) {
    const dx = Math.cos((a / 16) * Math.PI * 2);
    const dz = Math.sin((a / 16) * Math.PI * 2);
    for (let r = 8; r < 360; r += 4) {
      const x = Math.round(c.x + dx * r);
      const z = Math.round(c.z + dz * r);
      if (ow.continentAt(x, z) < -0.03) {
        if (!best || r < best.r) best = { x, z, r };
        break;
      }
    }
  }
  return best ? { x: best.x, z: best.z } : null;
}

// The ferry's way: out of the harbour by the water that's there (a bay, a
// river: see harbourWay), across the open sea (the way the fleets go), and
// in to the far pier the same way; or, the far town with no pier yet, to
// an anchorage off its shore.
function ferryWay(game, from, to, R) {
  const ow = game.world.ow;
  const a = seaOff(ow, from);
  const b = seaOff(ow, to);
  if (!a || !b) return null;
  const route = seaRoute(game, a, b, Infinity);
  if (!route || route.length < 1) return null;
  const out0 = harbourWay(game, from);
  if (!out0) return null;
  const P1 = game.sim.ships && game.sim.ships.ports[to.id];
  const in1 = P1 && P1.site ? harbourWay(game, to) : null;
  let tail = in1 ? in1.slice().reverse() : null;
  if (!tail) {
    const off = offshore(ow, to);
    if (!off) return null;
    tail = [off];
    R.ashore = true;
  }
  const out = [...out0];
  const via = [...route, ...tail];
  for (let i = 0; i < via.length; i++) {
    const a0 = out[out.length - 1];
    // (Between the harbours' own ways, the open sea round any land.)
    if (i < route.length + 1) {
      const leg = seaPath(ow, a0, via[i]);
      if (leg) out.push(...leg.slice(1));
      else out.push(via[i]);
    } else out.push(via[i]);
  }
  return out;
}

// The way set for the ride, from `t0` (now, as it sets off).
function setWay(R, pts, t0) {
  const at = measure(pts);
  const len = at[at.length - 1] || 1;
  Object.assign(R, { pts, at, len, t0, pace: len / R.mins, leg: 1 });
}

function measure(pts) {
  const at = [0];
  for (let i = 1; i < pts.length; i++) at.push(at[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
  return at;
}

function pointAt(R, d) {
  const { pts, at } = R;
  d = Math.max(0, Math.min(R.len, d));
  let i = R.leg || 1;
  if (at[i - 1] > d) i = 1;
  while (i < pts.length - 1 && at[i] < d) i++;
  R.leg = i;
  const seg = at[i] - at[i - 1] || 1;
  const f = Math.max(0, Math.min(1, (d - at[i - 1]) / seg));
  return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * f, z: pts[i - 1].z + (pts[i].z - pts[i - 1].z) * f, dx: pts[i].x - pts[i - 1].x, dz: pts[i].z - pts[i - 1].z };
}

// ------------------------------------------------------------ setting off
// Climb in (or go aboard), the fare paid: true if you're off.
export function startRide(game, link) {
  const p = game.player;
  if (p._ride || p.dead || countItem(p.inv, 'coin') < link.fare) return false;
  const from = link.from || game.world.ow.settlementAt(p.x, p.z) || game.currentSettlement;
  if (!from) return false;
  const R = { kind: link.kind, from: from.id, to: link.s.id, name: link.s.name, fast: false, leg: 1, key: `ride:${p.id}`, fare: link.fare, realT: 0 };
  const mins = Math.max(10, link.mins);
  R.mins = mins;
  let pts;
  if (link.kind === 'ferry') pts = ferryWay(game, from, link.s, R);
  else {
    // (Round 82) The way worked out as you climb in (a moment of it now;
    // if it's a long one, the rest while the coach waits at the stand).
    pts = coachWay(game, from, link.s, 120);
    if (!pts) {
      const LA = game.world.layouts.get(from.id);
      const st = (LA && coachStand(LA)) || centre(from);
      pts = [{ x: st.x, z: st.z }, { x: st.x, z: st.z }];
      R.pending = true;
    }
  }
  if (!pts || pts.length < 2) return false;
  removeItem(p.inv, 'coin', link.fare);
  setWay(R, pts, abs(game));
  // (Ridden or driven up: the horse, or the wagon, left where you got in.)
  const m = p.mount;
  if (m && game.riding) {
    const h = m.horseId !== undefined && m.horseId !== null ? game.riding.horse(m.horseId) : null;
    const wg = m.kind === 'wagon' ? game.riding.wagon(m.wagonId) : null;
    if (wg) Object.assign(wg, { x: p.x, y: p.y, z: p.z });
    else if (h) Object.assign(h, { x: p.x, y: p.y, z: p.z });
  }
  if (link.kind === 'ferry' && link.extras) shipExtras(game, p, R, link.extras);
  p._ride = R;
  // (Round 114) The coach at the stand is the one you've climbed into: it
  // leaves (none left standing behind it), its coachman driving, and it's
  // gone till it's been there and back.
  // (Round 116: there, a while there, and home again, seen the whole way:
  // see sendHome.)
  if (link.kind !== 'ferry') {
    sendCoach(game, from.id, mins + DWELL + Math.min(mins, HOME_MAX));
    game.props.delete(`coach:${from.id}`);
  }
  makeProp(game, p, R);
  game.audio?.play(link.kind === 'ferry' ? 'ship_bell' : 'horn');
  game.ui.msg(link.kind === 'ferry'
    ? `You pay ¤${link.fare} and go aboard the ferry for ${link.s.name}: ${wayTime(mins)} at sea.${game.isParty() ? '' : ' (T to hurry the hours on.)'}`
    : `You pay ¤${link.fare} and climb into the coach for ${link.s.name}: ${wayTime(mins)} on the road.${game.isParty() ? ' (Space to get down.)' : ' (T to hurry the hours on; Space to get down.)'}`, '#e8e0a0');
  tick(game, p, 0);
  return true;
}

// (Round 78) Shipped across with you, paid for at the pier (see
// ui/travel.js): your horses, your wagon (and the horse in its shafts),
// and the ferry's hold with your goods in it.
function shipExtras(game, p, R, ex) {
  const can = shippable(game, p);
  R.horses = [];
  R.wagons = [];
  if (ex.wagon) {
    for (const w of can.wagons.slice(0, FERRY_CARRIES.wagons)) {
      w.ferried = true;
      R.wagons.push(w.id);
      const h = w.horse !== null && w.horse !== undefined && game.riding.horse(w.horse);
      if (h) h.ferried = true;
    }
  }
  if (ex.horse) {
    const room = FERRY_CARRIES.horses - R.wagons.length;
    for (const h of can.horses.slice(0, Math.max(0, room))) {
      h.ferried = true;
      R.horses.push(h.id);
    }
  }
  if (ex.hold && p._ferryHold && p._ferryHold.some(Boolean)) {
    R.hold = p._ferryHold;
    p._ferryHold = null;
  }
}

// At the far end: what was shipped, set down beside you; the hold's goods
// in a chest on the pier (or the beach), yours.
function unloadExtras(game, p, R) {
  const RR = game.riding;
  const said = [];
  if (RR) {
    let k = 0;
    const put = (q) => {
      const spot = game.findFreeSpot(p.x + 1 + (k++ % 3), p.z + 1, p.y) || { x: p.x, y: p.y, z: p.z };
      q.ferried = false;
      Object.assign(q, { x: spot.x, y: spot.y, z: spot.z });
    };
    for (const id of R.wagons || []) {
      const w = RR.wagon(id);
      if (!w) continue;
      put(w);
      const h = w.horse !== null && w.horse !== undefined && RR.horse(w.horse);
      if (h) h.ferried = false;
      said.push('your wagon');
    }
    const hs = (R.horses || []).map((id) => RR.horse(id)).filter(Boolean);
    hs.forEach(put);
    if (hs.length) said.push(hs.length > 1 ? `your ${hs.length} horses` : 'your horse');
  }
  if (R.hold && R.hold.some(Boolean)) {
    const spot = holdSpot(game, p);
    if (spot) {
      const w = game.world;
      w.setBlock(spot.x, spot.y, spot.z, B.chest, 0);
      const r = w.regionAt(spot.x, spot.z);
      if (r) {
        const idx = ((spot.z - r.z0) * REGION_W + (spot.x - r.x0)) * WORLD_Y + spot.y;
        r.containers.set(idx, R.hold);
      }
      notePlaced(game, spot.x, spot.y, spot.z, true);
      said.push('the chest from her hold');
    } else {
      // (Nowhere to set it: the goods into your pack, or at your feet.)
      for (const s of R.hold) {
        if (!s) continue;
        const left = addItem(p.inv, s.item, s.count);
        if (left) game.spawnDrop(s.item, left, p.x, p.y, p.z, true);
      }
      said.push('your goods');
    }
  }
  R.hold = null;
  if (said.length) game.ui.msg(`Unloaded beside you: ${said.join(', ').replace(/, ([^,]*)$/, ' and $1')}.`, '#c8e0ff');
}

// A free spot on dry footing near you, for the hold's chest.
function holdSpot(game, p) {
  const w = game.world;
  for (let r = 1; r <= 4; r++) {
    for (let dz = -r; dz <= r; dz++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = p.x + dx;
        const z = p.z + dz;
        for (const y of [p.y, p.y + 1, p.y - 1]) {
          const here = BLOCKS[w.getBlock(x, y, z)];
          const below = BLOCKS[w.getBlock(x, y - 1, z)];
          if (here && here.name === 'air' && below && below.solid && !below.liquid) return { x, y, z };
        }
      }
    }
  }
  return null;
}

// The coach (with its driver up on the bench) or the ferry, carrying you.
function makeProp(game, p, R) {
  const prop = rideProp(game, R, p);
  game.props.set(R.key, prop);
  R.prop = prop;
  p.mount = null;
  p.sitting = null;
  p.inWagon = prop;
  p.wagonSeat = 'back';
  return prop;
}

// The coach or the ferry, as seen: `p` riding in it (or nobody).
function rideProp(game, R, p) {
  const s = game.world.ow.settlements[R.from];
  const civ = s && s.civ;
  const prop = {
    kind: 'prop', type: R.kind === 'ferry' ? 'ship' : 'wagon', id: 90000 + (game.propN = (game.propN || 0) + 1), dead: false,
    x: R.pts[0].x, y: GROUND, z: R.pts[0].z, face: 1, hood: true, sail: true, moving: true, ride: true,
    horse: R.kind === 'ferry' ? null : { coat: (R.from + R.to) % 4, saddle: false },
    banner: civ ? civ.color.hex : null, riders: p ? [p.look] : [], bench: null, rideOwner: p || null,
    driver: R.kind === 'ferry' ? null : DRIVER,
    renderPos() {
      return { x: this.x, y: this.y, z: this.z };
    },
  };
  prop.bench = prop.driver;
  return prop;
}

// (Whoever drives the coach: an old hand in a hat, the coachman from the
// stand.)
const DRIVER = COACHMAN;

// ------------------------------------------------------------ going home
// (Round 116) A coach on the road with nobody in it: having set you down
// (or you having got down), on to wherever it's going and then home to
// its own town's stand, seen the whole way; once it's back, it stands
// there to be had again (see coaches.coachAway). Its way's points each
// with the time it's there by: `game.coachRuns`.
// A way's points, each with the time (game minutes) it's reached by, the
// whole of it taking `mins` from `t0`.
function timed(pts, t0, mins) {
  const at = measure(pts);
  const len = at[at.length - 1] || 1;
  return pts.map((q, i) => ({ x: q.x, z: q.z, t: t0 + (at[i] / len) * Math.max(0.01, mins) }));
}

// Sent off home: the coach of ride `R`, at `prop` (kept, if given, so it
// doesn't flicker), along `way` (timed points).
function sendHome(game, R, way, prop = null) {
  if (!way.length) return;
  const run = { sid: R.from, to: R.to, key: `coachrun:${R.from}:${(game.runN = (game.runN || 0) + 1)}`, way, i: 1 };
  run.prop = prop || rideProp(game, R, null);
  Object.assign(run.prop, { riders: [], rideOwner: null, moving: false });
  game.props.set(run.key, run.prop);
  (game.coachRuns ||= []).push(run);
  // (Away till it's home.)
  (game.coachAway ||= new Map()).set(R.from, Math.max(abs(game), way[way.length - 1].t));
  game.props.delete(`coach:${R.from}`);
}

// Each frame: every coach on its way home, along it.
export function runsTick(game) {
  const runs = game.coachRuns;
  if (!runs || !runs.length) return;
  const now = abs(game);
  const w = game.world;
  for (const run of runs) {
    const way = run.way;
    const last = way[way.length - 1];
    if (now >= last.t) {
      run.done = true;
      game.props.delete(run.key);
      if (game.coachAway && game.coachAway.get(run.sid) <= last.t + 0.01) game.coachAway.delete(run.sid);
      // (Back at its stand at once, not a moment later.)
      game.standT = 0;
      continue;
    }
    let i = Math.max(1, Math.min(run.i || 1, way.length - 1));
    if (way[i - 1].t > now) i = 1;
    while (i < way.length - 1 && way[i].t <= now) i++;
    run.i = i;
    const a = way[i - 1];
    const b = way[i];
    const f = b.t > a.t ? Math.max(0, Math.min(1, (now - a.t) / (b.t - a.t))) : 1;
    const prop = run.prop;
    const x = a.x + (b.x - a.x) * f;
    const z = a.z + (b.z - a.z) * f;
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    prop.moving = Math.abs(dx) + Math.abs(dz) > 0.01;
    if (prop.moving) {
      prop.face = Math.abs(dx) >= Math.abs(dz) ? (dx > 0 ? 3 : 1) : dz > 0 ? 0 : 2;
      prop.ang = Math.atan2(dx, dz);
    }
    prop.x = x;
    prop.z = z;
    const tx = Math.round(x);
    const tz = Math.round(z);
    if (w.regionAt && w.regionAt(tx, tz)) {
      const sy = coachY(w, tx, tz, prop.y || GROUND);
      if (sy > 0) prop.y = sy;
    }
    if (!game.props.has(run.key)) game.props.set(run.key, prop);
  }
  game.coachRuns = runs.filter((r) => !r.done);
}

// The way the coach of ride `R` has come so far, back to where it set off
// (`d`: how far it's come).
function cameBack(R, d) {
  const here = pointAt(R, d);
  const back = [{ x: here.x, z: here.z }];
  for (let i = Math.min(R.leg || 1, R.pts.length - 1) - 1; i >= 0; i--) back.push({ x: R.pts[i].x, z: R.pts[i].z });
  return back.length >= 2 ? back : [back[0], back[0]];
}

// ------------------------------------------------------------ on the way
// Each frame, for the one riding: along the way as the time goes by.
export function tick(game, p, dt) {
  const R = p._ride;
  if (!R) return;
  if (p.dead) return endRide(game, p, 'dead');
  R.realT = (R.realT || 0) + dt;
  // (The coach or ferry gone from the world, a load say: put back.)
  if (!R.prop || !game.props.has(R.key)) makeProp(game, p, R);
  // (Round 82) Still at the stand, the driver making sure of the way: a
  // few milliseconds more of it a frame, then off.
  if (R.pending) {
    const ow = game.world.ow;
    const got = coachWay(game, ow.settlements[R.from], ow.settlements[R.to], 6);
    if (!got) {
      R.prop.moving = false;
      const info = p.rideInfo;
      if (!info || !info.wait) p.rideInfo = { kind: R.kind, name: R.name, left: R.mins, fast: false, wait: true };
      return;
    }
    R.pending = false;
    setWay(R, got, abs(game));
  }
  const now = abs(game);
  const d = Math.min(R.len, (now - R.t0) * R.pace);
  const at = pointAt(R, d);
  const prop = R.prop;
  const w = game.world;
  const tx = Math.round(at.x);
  const tz = Math.round(at.z);
  // How high it goes: on the water, or on the ground under the wheels.
  let y = prop.y;
  if (R.kind === 'ferry') y = GROUND;
  else if (w.regionAt && w.regionAt(tx, tz)) {
    // (Round 87: on the ground under the trees, never up on them.)
    const sy = coachY(w, tx, tz, prop.y || GROUND);
    if (sy > 0) y = sy;
  }
  prop.x = at.x;
  prop.z = at.z;
  prop.y = y;
  if (Math.abs(at.dx) > 0.01 || Math.abs(at.dz) > 0.01) {
    if (R.kind === 'ferry') prop.face = Math.abs(at.dx) >= Math.abs(at.dz) * 0.3 ? (at.dx > 0 ? 3 : 1) : prop.face;
    else prop.face = Math.abs(at.dx) >= Math.abs(at.dz) ? (at.dx > 0 ? 3 : 1) : at.dz > 0 ? 0 : 2;
    // (Round 82: the heading it turns toward, round the corners, as the
    // horse leans into them: see Renderer.steedAngle.)
    prop.ang = Math.atan2(at.dx, at.dz);
  }
  prop.moving = d < R.len;
  prop.riders = [p.look];
  // You, carried with it (a pace at a time, smoothly).
  const speed = Math.max(0.5, R.pace * game.timeRate());
  if (tx !== p.x || tz !== p.z || y !== p.y) {
    if (Math.abs(tx - p.x) + Math.abs(tz - p.z) > 3 || dt === 0) p.teleport(tx, y, tz);
    else p.startMove(tx, y, tz, Math.min(1, 1 / speed));
    p.dir = at.dx > 0 && Math.abs(at.dx) >= Math.abs(at.dz) ? 3 : at.dx < 0 && Math.abs(at.dx) >= Math.abs(at.dz) ? 1 : at.dz < 0 ? 2 : 0;
  }
  // The land ahead got ready before it's reached.
  R.loadT = (R.loadT || 0) - dt;
  if (R.loadT <= 0) {
    R.loadT = 0.5;
    const ahead = pointAt({ ...R }, d + Math.min(160, 40 + speed * 3));
    game.loadAround(Math.round(ahead.x), Math.round(ahead.z), false);
  }
  // (Round 79) Waiting the hours away (T: the wait window, as anywhere),
  // on your own only: no faster than the land ahead can be got ready, and
  // eased off as you come in.
  const waiting = !game.isParty() && game.waiting && game.waiting.anywhere === 'ride';
  if (waiting) game.sleepFast = Math.max(1, Math.min(game.sleepFast || 1, RIDE_FAST, (R.len - d) / R.pace / 4));
  // The line on the screen: whither, and how long yet.
  const leftMin = Math.max(0, Math.ceil((R.len - d) / R.pace));
  const info = p.rideInfo;
  if (!info || info.wait || info.left !== leftMin || info.fast !== !!waiting) p.rideInfo = { kind: R.kind, name: R.name, left: leftMin, fast: !!waiting };
  // Now and then, the sounds of it.
  R.sndT = (R.sndT ?? 2) - dt;
  if (R.sndT <= 0) {
    R.sndT = 3 + Math.random() * 4;
    game.audio?.play(R.kind === 'ferry' ? 'ship_creak' : 'step_wood', prop);
  }
  if (d >= R.len) endRide(game, p, 'there');
}

// (Round 87) The height of the ground under the coach's wheels at (x, z),
// near `near`: a tree in the way (its trunk, its leaves) is ridden through
// as if it weren't there, never up onto, as the old way (any place to
// stand, up to three up) did; -1 if there's nowhere.
const treeId = (id) => LOGS.has(id) || LEAVES.has(id);
export function coachY(w, x, z, near) {
  const clear = (y) => {
    const id = w.getBlock(x, y, z);
    const b = BLOCKS[id];
    return !b || !b.solid || b.replaceable || treeId(id);
  };
  const ground = (y) => {
    const id = w.getBlock(x, y - 1, z);
    const b = BLOCKS[id];
    return !!b && b.standable && !b.liquid && !treeId(id);
  };
  for (const d of [0, -1, 1, -2, 2, -3, 3]) {
    const y = near + d;
    if (y >= 1 && y < WORLD_Y - 2 && ground(y) && clear(y) && clear(y + 1)) return y;
  }
  return -1;
}

// T, riding (Round 79): the wait window, as when sat down anywhere, with
// "till we're there" in it too. (Waiting, any key stops it.)
export function hurry(game, p) {
  const R = p._ride;
  if (!R) return false;
  if (game.isParty()) {
    game.ui.msg('With others in the world, nobody\'s hours can be hurried: you sit back and watch it go by.', '#c8c8c8', true);
    return true;
  }
  if (!game.waiting) game.ui.openWait?.({ ride: rideLeft(p), kind: R.kind });
  return true;
}

// Minutes yet till the coach or ferry's in.
export function rideLeft(p) {
  const i = p && p.rideInfo;
  return i ? i.left : 0;
}

// Space (or F), riding: down off the coach, where it is; not off the
// ferry, out at sea. (Round 116) Got down from it in the first moments
// (REFUND_SECS), your fare back, and it turns about for its stand.
export function getOff(game, p) {
  const R = p._ride;
  if (!R) return false;
  if (R.kind === 'ferry') {
    game.ui.msg('Not out here: there\'s nothing but sea till the ferry ties up.', '#c8c8c8', true);
    return true;
  }
  endRide(game, p, (R.realT || 0) <= REFUND_SECS ? 'back' : 'off');
  return true;
}

// Set down: at the far end, or where you got off.
export function endRide(game, p, how) {
  const R = p._ride;
  if (!R) return;
  p._ride = null;
  p.rideInfo = null;
  const prop = game.props.get(R.key) || R.prop;
  game.props.delete(R.key);
  if (R.kind !== 'ferry' && R.pts && !game.remote) coachOn(game, R, how, prop);
  if (p.inWagon === R.prop) {
    p.inWagon = null;
    p.wagonSeat = null;
  }
  if (!game.isParty()) game.sleepFast = 0;
  if (how === 'dead') {
    // (Whatever was shipped is set down where the ferry got to.)
    unloadExtras(game, p, R);
    return;
  }
  const s = game.world.ow.settlements[R.to];
  let at = { x: p.x, z: p.z };
  if (how === 'there' && s) {
    if (R.kind === 'ferry') {
      const P = game.sim.ships && game.sim.ships.ports[s.id];
      at = P && P.site && !R.ashore ? { x: P.site.end.x, z: P.site.end.z } : arrivalSpot(game, s, 'coach');
    } else at = arrivalSpot(game, s, 'coach', game.world.ow.settlements[R.from]);
  }
  game.loadAround(at.x, at.z, true);
  const spot = game.findFreeSpot(at.x, at.z, R.kind === 'ferry' ? GROUND : p.y);
  if (game.asPlayer && game.player !== p) game.asPlayer(p, () => game.teleportPlayer(spot.x, spot.y, spot.z));
  else game.teleportPlayer(spot.x, spot.y, spot.z);
  game.world.ow.markExplored(spot.x, spot.z, 2);
  game.updateSettlements(true);
  if (how === 'back') {
    // (Your fare back: you'd hardly set off.)
    if (R.fare) {
      const left = addItem(p.inv, 'coin', R.fare);
      if (left) game.spawnDrop('coin', left, p.x, p.y, p.z, true);
    }
    game.ui.msg(`You climb down before it's well under way, and the coachman gives you back your ¤${R.fare || 0}. He turns the coach about for the stand.`, '#e8e0a0');
  } else if (how === 'off') game.ui.msg('You climb down from the coach. It rattles on without you.', '#c8c8c8');
  else game.ui.msg(R.kind === 'ferry' ? (R.ashore ? `After ${wayTime(R.mins)} at sea, the ferry drops anchor off ${R.name}, and a boat rows you ashore.` : `After ${wayTime(R.mins)} at sea, the ferry ties up at ${R.name}. You step off onto the pier.`) : `After ${wayTime(R.mins)} on the road, the coach sets you down at ${R.name}.`, '#ffe8a0');
  game.audio?.play(R.kind === 'ferry' ? 'ship_bell' : 'horn');
  unloadExtras(game, p, R);
}

// (Round 116) The coach, once you're out of it: from where it's set you
// down (a while there first), or from wherever you got down (on to where
// it was going, unless it had hardly set off), home to its stand.
function coachOn(game, R, how, prop) {
  const now = abs(game);
  const d = R.pending ? 0 : Math.max(0, Math.min(R.len, (now - R.t0) * R.pace));
  const home = Math.min(R.mins, HOME_MAX);
  let way;
  if (how === 'back') {
    const back = cameBack(R, d);
    way = timed(back, now, Math.max(1, d / (R.pace || 1)));
  } else if (how === 'there' || d >= R.len - 0.5) {
    const end = R.pts[R.pts.length - 1];
    way = [{ x: end.x, z: end.z, t: now }, ...timed(R.pts.slice().reverse(), now + DWELL, home)];
  } else {
    // (On to where it was going, then home.)
    const here = pointAt(R, d);
    const ahead = [{ x: here.x, z: here.z }, ...R.pts.slice(Math.min(R.leg || 1, R.pts.length - 1))];
    const on = timed(ahead, now, Math.max(1, (R.len - d) / (R.pace || 1)));
    const t1 = on[on.length - 1].t;
    way = [...on, ...timed(R.pts.slice().reverse(), t1 + DWELL, home)];
  }
  sendHome(game, R, way, prop);
}

// ------------------------------------------------------------ kept
export function rideSave(p) {
  const R = p && p._ride;
  if (!R) return null;
  return { kind: R.kind, from: R.from, to: R.to, name: R.name, mins: R.mins, pts: R.pts, t0: R.t0, pace: R.pace, ashore: !!R.ashore, fast: false, horses: R.horses || [], wagons: R.wagons || [], hold: R.hold || null, pending: !!R.pending, fare: R.fare || 0 };
}

export function rideLoad(game, p, d) {
  if (!d || !d.pts || d.pts.length < 2) return;
  const at = measure(d.pts);
  // (Picked up again later: well under way, no fare back.)
  const R = { ...d, at, len: at[at.length - 1] || 1, leg: 1, key: `ride:${p.id}`, realT: REFUND_SECS + 1 };
  p._ride = R;
  makeProp(game, p, R);
}

// Who's riding, for the one shown (yours, or a guest's): see ui.js.
export function rideLine(p) {
  const i = p && p.rideInfo;
  if (!i) return null;
  const when = i.wait ? ' · SETTING OFF' : ` · ${wayTime(i.left)}`;
  const head = `${i.kind === 'ferry' ? 'FERRY' : 'COACH'}: `;
  return { text: `${head}${i.name.toUpperCase().slice(0, Math.max(4, 24 - head.length - when.length))}${when}`, fast: i.fast };
}
