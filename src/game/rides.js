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
import { coachStand, arrivalSpot, wayTime, harbourWay } from '../sim/coaches.js';
import { seaOff, seaRoute } from './shipfleets.js';
import { countItem, removeItem, addItem } from './inventory.js';
import { shippable, FERRY_CARRIES } from './stalls.js';
import { notePlaced } from './invtools.js';
import { BLOCKS, B } from '../world/blocks.js';

// How much quicker it all goes, hurried on (see Game.timeRate).
export const RIDE_FAST = 12;

const centre = (s) => ({ x: Math.round((s.cx + s.cw / 2) * REGION_W), z: Math.round((s.cz + s.cd / 2) * REGION_D) });
const inside = (s, x, z, m = 2) => !!s.bounds && x >= s.bounds.x0 - m && x <= s.bounds.x1 + m && z >= s.bounds.z0 - m && z <= s.bounds.z1 + m;
const abs = (game) => game.day * 1440 + game.minute;

// ------------------------------------------------------------ the way
// The coach's way: from its stand out of town, down the road (or across
// country), to the far town's stand.
function coachWay(game, from, to) {
  const D = game.sim.diplomacy;
  const LA = game.world.layouts.get(from.id);
  const a = (LA && coachStand(LA)) || null;
  // (Worked out now if it isn't yet: a moment, once, as the coach sets off.)
  const ms = D.wayMs;
  D.wayMs = game.instantWork ? Infinity : 120;
  let w;
  try {
    w = D.way(from, to);
  } finally {
    D.wayMs = ms;
  }
  const mid = w.pts.filter((q) => !inside(from, q.x, q.z) && !inside(to, q.x, q.z));
  const pts = [];
  if (a) pts.push({ x: a.x, z: a.z });
  else pts.push(centre(from));
  pts.push(...mid);
  pts.push(endOf(game, to));
  return pts;
}

// Where the coach pulls up at `s`.
function endOf(game, s) {
  const L = game.world.layouts.get(s.id);
  const st = L && coachStand(L);
  if (st) return { x: st.x, z: st.z };
  const at = arrivalSpot(game, s, 'coach');
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
  const R = { kind: link.kind, from: from.id, to: link.s.id, name: link.s.name, fast: false, leg: 1, key: `ride:${p.id}` };
  const pts = link.kind === 'ferry' ? ferryWay(game, from, link.s, R) : coachWay(game, from, link.s);
  if (!pts || pts.length < 2) return false;
  removeItem(p.inv, 'coin', link.fare);
  const at = measure(pts);
  const len = at[at.length - 1] || 1;
  const mins = Math.max(10, link.mins);
  Object.assign(R, { mins, pts, at, len, t0: abs(game), pace: len / mins });
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
  makeProp(game, p, R);
  game.audio?.play(link.kind === 'ferry' ? 'ship_bell' : 'horn');
  game.ui.msg(link.kind === 'ferry'
    ? `You pay ¤${link.fare} and go aboard the ferry for ${link.s.name}: ${wayTime(mins)} at sea.${game.isParty() ? '' : ' (T to hurry the hours on.)'}`
    : `You pay ¤${link.fare} and climb into the coach for ${link.s.name}: ${wayTime(mins)} on the road.${game.isParty() ? '' : ' (T to hurry the hours on; F to get down.)'}`, '#e8e0a0');
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
  const s = game.world.ow.settlements[R.from];
  const civ = s && s.civ;
  const prop = {
    kind: 'prop', type: R.kind === 'ferry' ? 'ship' : 'wagon', id: 90000 + (game.propN = (game.propN || 0) + 1), dead: false,
    x: R.pts[0].x, y: GROUND, z: R.pts[0].z, face: 1, hood: true, sail: true, moving: true, ride: true,
    horse: R.kind === 'ferry' ? null : { coat: (R.from + R.to) % 4, saddle: false },
    banner: civ ? civ.color.hex : null, riders: [p.look], bench: null, rideOwner: p,
    driver: R.kind === 'ferry' ? null : DRIVER,
    renderPos() {
      return { x: this.x, y: this.y, z: this.z };
    },
  };
  prop.bench = prop.driver;
  game.props.set(R.key, prop);
  R.prop = prop;
  p.mount = null;
  p.sitting = null;
  p.inWagon = prop;
  p.wagonSeat = 'back';
  return prop;
}

// (Whoever drives the coach: an old hand in a hat.)
const DRIVER = { skin: '#d8a880', hair: '#8a8a8a', hairStyle: 'short', shirt: '#5a4a3a', pants: '#3a3028', shoes: '#2a1a10', outfit: 'plain', accent: '#7a5a30', beard: true, hat: 'wide', hatColor: '#4a3a28' };

// ------------------------------------------------------------ on the way
// Each frame, for the one riding: along the way as the time goes by.
export function tick(game, p, dt) {
  const R = p._ride;
  if (!R) return;
  if (p.dead) return endRide(game, p, 'dead');
  // (The coach or ferry gone from the world, a load say: put back.)
  if (!R.prop || !game.props.has(R.key)) makeProp(game, p, R);
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
    const sy = w.findStandY(tx, tz, prop.y || GROUND);
    if (sy > 0) y = sy;
  }
  prop.x = at.x;
  prop.z = at.z;
  prop.y = y;
  if (Math.abs(at.dx) > 0.01 || Math.abs(at.dz) > 0.01) prop.face = Math.abs(at.dx) >= Math.abs(at.dz) * 0.3 ? (at.dx > 0 ? 3 : 1) : prop.face;
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
  if (!info || info.left !== leftMin || info.fast !== !!waiting) p.rideInfo = { kind: R.kind, name: R.name, left: leftMin, fast: !!waiting };
  // Now and then, the sounds of it.
  R.sndT = (R.sndT ?? 2) - dt;
  if (R.sndT <= 0) {
    R.sndT = 3 + Math.random() * 4;
    game.audio?.play(R.kind === 'ferry' ? 'ship_creak' : 'step_wood', prop);
  }
  if (d >= R.len) endRide(game, p, 'there');
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

// F, riding: down off the coach, where it is (no fare back); not off the
// ferry, out at sea.
export function getOff(game, p) {
  const R = p._ride;
  if (!R) return false;
  if (R.kind === 'ferry') {
    game.ui.msg('Not out here: there\'s nothing but sea till the ferry ties up.', '#c8c8c8', true);
    return true;
  }
  endRide(game, p, 'off');
  return true;
}

// Set down: at the far end, or where you got off.
export function endRide(game, p, how) {
  const R = p._ride;
  if (!R) return;
  p._ride = null;
  p.rideInfo = null;
  game.props.delete(R.key);
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
    } else at = arrivalSpot(game, s, 'coach');
  }
  game.loadAround(at.x, at.z, true);
  const spot = game.findFreeSpot(at.x, at.z, R.kind === 'ferry' ? GROUND : p.y);
  if (game.asPlayer && game.player !== p) game.asPlayer(p, () => game.teleportPlayer(spot.x, spot.y, spot.z));
  else game.teleportPlayer(spot.x, spot.y, spot.z);
  game.world.ow.markExplored(spot.x, spot.z, 2);
  game.updateSettlements(true);
  if (how === 'off') game.ui.msg('You climb down from the coach. It rattles on without you.', '#c8c8c8');
  else game.ui.msg(R.kind === 'ferry' ? (R.ashore ? `After ${wayTime(R.mins)} at sea, the ferry drops anchor off ${R.name}, and a boat rows you ashore.` : `After ${wayTime(R.mins)} at sea, the ferry ties up at ${R.name}. You step off onto the pier.`) : `After ${wayTime(R.mins)} on the road, the coach sets you down at ${R.name}.`, '#ffe8a0');
  game.audio?.play(R.kind === 'ferry' ? 'ship_bell' : 'horn');
  unloadExtras(game, p, R);
}

// ------------------------------------------------------------ kept
export function rideSave(p) {
  const R = p && p._ride;
  if (!R) return null;
  return { kind: R.kind, from: R.from, to: R.to, name: R.name, mins: R.mins, pts: R.pts, t0: R.t0, pace: R.pace, ashore: !!R.ashore, fast: false, horses: R.horses || [], wagons: R.wagons || [], hold: R.hold || null };
}

export function rideLoad(game, p, d) {
  if (!d || !d.pts || d.pts.length < 2) return;
  const at = measure(d.pts);
  const R = { ...d, at, len: at[at.length - 1] || 1, leg: 1, key: `ride:${p.id}` };
  p._ride = R;
  makeProp(game, p, R);
}

// Who's riding, for the one shown (yours, or a guest's): see ui.js.
export function rideLine(p) {
  const i = p && p.rideInfo;
  if (!i) return null;
  const when = ` · ${wayTime(i.left)}`;
  const head = `${i.kind === 'ferry' ? 'FERRY' : 'COACH'}: `;
  return { text: `${head}${i.name.toUpperCase().slice(0, Math.max(4, 24 - head.length - when.length))}${when}`, fast: i.fast };
}
