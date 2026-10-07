// The trade ships you can see (see sim/ships.js): her hull rising from the
// keel up beside the new pier while the town builds her harbour; tied up
// at her pier, the merchants called down to go aboard before she sails,
// putting out with them on her deck and sailing off out of sight, and
// coming home again to tie up while they walk off along the pier.
//   (Round 68) She's one of the great ships now (see ships3d.js): a sloop
// for a village, a brigantine for a town, a galleon for a city or an
// empire's capital; her crew aboard her, working her. Where there's no
// room for her beside the pier, she's drawn the old way, a prop (an
// Engine of type 'ship', see engines.js), in nobody's way.
import { Engine } from './engines.js';
import { SURFACE, GROUND } from '../config.js';
import { setOverride } from '../sim/econ.js';
import { Ship, addShip, shipsOf, roomFor, waterSpot } from './ships3d.js';
import { makeCrew } from './shipcrew.js';
import { shipModel } from '../world/shipmodels.js';

const is3d = (e) => e instanceof Ship;

// Every frame: under way, a tile at a time (the old kind; the great ships
// sail themselves, see ships3d.js).
export function sailShips(game, dt) {
  if (!game.shipProps) return;
  for (const e of game.shipProps.values()) {
    if (is3d(e)) continue;
    if (e.moving || !e.path || e.i >= e.path.length) continue;
    const t = e.path[e.i++];
    e.moveTo(t.x, GROUND, t.z, e.pace || 0.42);
  }
}

const movingOf = (e) => (is3d(e) ? !!(e.route && e.route.length) : e.moving);
const doneOf = (e) => (is3d(e) ? !(e.route && e.route.length) && Math.abs(e.v) < 0.6 : !e.moving && e.i >= e.path.length);

// Twice a second: which ships should be where.
export function updateShips(game, dt) {
  game.shipT = (game.shipT || 0) - dt;
  if (game.shipT > 0 || game.skipping) return;
  game.shipT = 0.5;
  const S = game.sim.ships;
  if (!S) return;
  game.shipProps ||= new Map();
  const now = game.sim.abs;
  for (const [sid, e] of game.shipProps) {
    if (!game.active.has(sid) && !game.inSight(e.x, e.z, 4)) drop(game, sid, e);
  }
  for (const [sid, a] of game.active) {
    const P = S.port(sid);
    let e = game.shipProps.get(sid);
    // (Round 73: a dock with no great ship, in a realm that can't build one.)
    if (!P || P.state === 'planned' || P.ship === false) continue;
    const site = P.site;
    // Her hull going up beside the pier as it's built.
    if (P.state === 'building') {
      const p = P.project != null ? game.sim.works.projects.find((q) => q.id === P.project) : null;
      const k = p ? game.sim.works.frameProgress(p) : P.hullFrom !== undefined ? Math.min(1, (now - P.hullFrom) / (3 * 1440)) : 0;
      if (!e && game.world.regionAt(site.moor.x, site.moor.z)) e = make(game, P, sid, site.moor.x, site.moor.z, true);
      if (e && is3d(e)) setBuild(e, 0.15 + k * 0.85);
      continue;
    }
    if (e && is3d(e) && e.build < 1) setBuild(e, 1);
    const v = P.voyage;
    const L = a.layout;
    const fresh = a.since === undefined || now - a.since <= 2;
    // Called down to the pier, a while before she sails.
    if (v && now >= v.depart - 90 && now < v.back && !v.called) {
      v.called = true;
      for (const idx of v.crew) {
        const rec = L.npcs[idx];
        if (!rec || !rec.ent || rec.ent.dead) continue;
        // (Off to sea instead: they'll miss the wedding, or the feast.)
        for (const ev of game.sim.events.upcoming(L)) for (const g of ev.guests || []) if (g.idx === idx) g.set = false;
        setOverride(rec, now, now + 240, 'travel', { place: 'dock', target: site.end });
        rec.ent.activity = null;
        rec.ent.goal = null;
        rec.leaving = true;
      }
    }
    const atSea = v && now >= v.depart && now < v.back;
    if (!e) {
      if (atSea) continue;
      // Home from a voyage while you're here: in from out of sight.
      if (P.home && now - P.home < 20) {
        e = sailIn(game, P, sid);
        if (e) continue;
      }
      // Tied up at the pier: there when the town comes into view (or once
      // you can't see the pier).
      if (fresh || !game.inSight(site.moor.x, site.moor.z, 4)) e = moor(game, P, sid);
      continue;
    }
    if (e.phase === 'in' && doneOf(e)) {
      // Tied up: everyone off along the pier.
      e.phase = 'moored';
      e.path = null;
      e.sail = false;
      if (is3d(e)) {
        e.anchor = true;
        e.sailGoal = 0;
        e.crewRecs = e.crewRecs.filter((r) => r.role !== 'merchant');
        dropCrew(game, e, (c) => c.role === 'merchant');
      }
      game.sim.landing ||= new Map();
      for (const idx of P.aboard || []) game.sim.landing.set(`h${sid}:${idx}`, { x: site.end.x, y: GROUND, z: site.end.z, t: now });
      e.riders = [];
      game.audio?.play('horn', e);
    }
    // Casting off: once the crew's aboard (or she can't wait any longer).
    if (atSea && e.phase === 'moored') {
      const walking = v.crew.map((idx) => L.npcs[idx]).filter((r) => r && r.ent && !r.ent.dead);
      if (walking.length && now < v.depart + 60) continue;
      for (const r of walking) if (!game.inSight(r.ent.x, r.ent.z, 2)) game.despawnNpc(r.ent);
      const path = waterPath(game, is3d(e) ? { x: Math.round(e.x), z: Math.round(e.z) } : site.moor, site);
      const riders = v.crew.map((idx) => L.npcs[idx]).filter((r) => r && r.look);
      e.riders = riders.map((r) => r.look).slice(0, 5);
      e.phase = 'out';
      e.sail = true;
      e.path = path;
      e.i = 1;
      if (is3d(e)) {
        // (The merchants aboard her, with her crew.)
        e.crewRecs = [...e.crewRecs.filter((r) => r.role !== 'merchant'), ...riders.slice(0, 5).map((r) => ({ name: r.name, look: r.look, role: 'merchant' }))];
        if (e.crewHere) {
          e.crewHere = false;
          dropCrew(game, e, () => true);
        }
        e.route = waypoints(path);
        e.anchor = false;
        e.sailGoal = 1;
      }
      game.audio?.play('horn', e);
      if (game.inSight(e.x, e.z, 6)) game.ui.msg(`The ${P.name} casts off for ${v.destName}.`, '#a0d8ff');
    }
    // Out of sight at sea: gone (till she's home). (Still in view when
    // she's due back: she turns about, and comes in again.)
    if (e.phase === 'out' && !game.inSight(e.x, e.z, 3)) drop(game, sid, e);
    else if (e.phase === 'out' && !atSea && !movingOf(e)) {
      const back = waterPath(game, { x: Math.round(e.x), z: Math.round(e.z) }, site, site.moor);
      e.phase = 'in';
      e.path = back;
      e.i = 1;
      if (is3d(e)) {
        e.route = waypoints(back);
        e.anchor = false;
        e.sailGoal = 1;
      }
    }
  }
}

// The way, as a ship's helmsman takes it: a point every few paces.
function waypoints(path) {
  const out = [];
  for (let k = 4; k < path.length; k += 5) out.push({ x: path[k].x, z: path[k].z });
  if (path.length) out.push({ x: path[path.length - 1].x, z: path[path.length - 1].z });
  return out;
}

// What kind of ship a town sails: a sloop for a village, a galleon for a
// city or an empire's capital, else a brigantine.
export function townShipKind(s) {
  if (!s) return 'brigantine';
  if (s.empire || s.type === 'city') return 'galleon';
  if (s.type === 'village') return 'sloop';
  return 'brigantine';
}

function make(game, P, sid, x, z, building = false) {
  const s = game.world.ow.settlements[sid];
  const civ = s?.civ;
  // A great ship, if there's room for her by the pier.
  const site = P.site;
  const yaw = Math.atan2(site.side.x, site.side.z);
  for (const type of [townShipKind(s), 'brigantine', 'sloop']) {
    let at = roomFor(game, type, x, z, yaw) ? { x, z, yaw } : null;
    if (!at) {
      const w = waterSpot(game, type, x, z, 0, 16, false);
      if (w && Math.hypot(w.x - x, w.z - z) < 12) at = w;
    }
    if (!at) continue;
    const col = civ ? civ.color.hex : '#a02020';
    const S = addShip(game, {
      type, x: at.x, z: at.z, yaw: at.yaw, name: P.name, civ: civ ? civ.id : null, paint: col, paint2: '#1e1a18', flag: col, emblem: civ && civ.empire ? 'cross' : 'stripe', anchor: true,
      crew: makeCrew(sid * 7919 + 13, type, s?.style || 'vale', Math.max(2, Math.round(shipModel(type).T.crew * 0.5)), civ ? civ.id : null),
    });
    S.transient = true;
    S.portSid = sid;
    S.phase = 'moored';
    S.riders = [];
    S.sail = false;
    S.stores = 999;
    if (building) setBuild(S, 0.15);
    game.shipProps.set(sid, S);
    return S;
  }
  const e = new Engine(game, 'ship', x, GROUND, z, { banner: civ ? civ.color.hex : null, hp: 999 });
  e.name = P.name;
  e.sid = sid;
  e.riders = [];
  e.sail = false;
  e.phase = 'moored';
  e.dir = P.site.side.x ? (P.site.side.x > 0 ? 3 : 1) : 1;
  if (building) return null;
  game.engines.push(e);
  game.shipProps.set(sid, e);
  return e;
}

// Built so far (0 her keel, 1 complete): her planks from the keel up, her
// masts and canvas last; nobody aboard till she's launched.
function setBuild(S, k) {
  k = Math.max(0, Math.min(1, k));
  if (S.build !== undefined && Math.abs(S.build - k) < 0.04 && k < 1) return;
  S.build = k;
  const m = S.m;
  const top = m.H * k * 1.08;
  for (let i = 0; i < m.N; i++) {
    const y = Math.floor(i / (m.W * m.L));
    const z = Math.floor(i / m.W) % m.L;
    const show = k >= 1 || y + (z / m.L) * 1.5 <= top;
    S.vox[i] = show ? m.vox[i] : 0;
  }
  S.ver++;
  S.recount();
  S.noRig = k < 0.95;
  S.crewRecs = k < 1 ? [] : S.crewRecs.length ? S.crewRecs : makeCrew(S.id * 31, S.type, 'vale', 3);
}

function dropCrew(game, S, which) {
  game.sailors = (game.sailors || []).filter((c) => {
    if (c.shipId !== S.id || !which(c)) return true;
    game.removeOcc?.(c);
    return false;
  });
}

function moor(game, P, sid) {
  const m = P.site.moor;
  if (!game.world.regionAt(m.x, m.z)) return null;
  return make(game, P, sid, m.x, m.z);
}

// Coming home: on the water out of your sight, sailing in to the pier.
function sailIn(game, P, sid) {
  const site = P.site;
  if (!game.world.regionAt(site.moor.x, site.moor.z)) return null;
  const out = waterPath(game, site.moor, site);
  if (out.length < 2) return null;
  // (Starting from the furthest stretch of it you can't see.)
  let k = out.length - 1;
  while (k > 0 && game.inSight(out[k].x, out[k].z, 3)) k--;
  if (k <= 0) return null;
  const path = out.slice(0, k + 1).reverse();
  const e = make(game, P, sid, path[0].x, path[0].z);
  if (!e) return null;
  const L = game.sim.layoutOf(sid);
  const riders = (P.aboard || []).map((idx) => L && L.npcs[idx]).filter((r) => r && r.look);
  e.riders = riders.map((r) => r.look).slice(0, 5);
  e.phase = 'in';
  e.sail = true;
  e.path = path;
  e.i = 1;
  if (is3d(e)) {
    e.crewRecs = [...e.crewRecs, ...riders.slice(0, 5).map((r) => ({ name: r.name, look: r.look, role: 'merchant' }))];
    e.route = waypoints(path);
    e.anchor = false;
    e.sailGoal = 1;
  }
  return e;
}

function drop(game, sid, e) {
  game.shipProps.delete(sid);
  if (is3d(e)) {
    dropCrew(game, e, () => true);
    // (Anyone aboard her as she goes out of sight: still aboard, she's
    // kept.)
    if ((game.everyone ? game.everyone() : [game.player]).some((q) => q.deck && q.deck.s === e.id)) {
      e.transient = false;
      return;
    }
    const list = shipsOf(game);
    const i = list.indexOf(e);
    if (i >= 0) list.splice(i, 1);
    return;
  }
  game.engines = game.engines.filter((q) => q !== e);
}

// The way out from her mooring: over open water, as far from the town as
// the water (and the world about you) goes; or, given `to`, the way there.
export function waterPath(game, from, site, to = null) {
  const w = game.world;
  const wet = (x, z) => w.regionAt(x, z) && w.isWaterAt(x, SURFACE, z) && !site.tiles.some((t) => t[0] === x && t[1] === z);
  const key = (x, z) => x * 65536 + z;
  const prev = new Map([[key(from.x, from.z), null]]);
  const q = [{ x: from.x, z: from.z, d: 0 }];
  const ox = site.root.x;
  const oz = site.root.z;
  let best = q[0];
  let bestScore = -Infinity;
  for (let i = 0; i < q.length && q.length < 4000; i++) {
    const c = q[i];
    const score = to ? -Math.hypot(c.x - to.x, c.z - to.z) : Math.hypot(c.x - ox, c.z - oz);
    if (score > bestScore) {
      best = c;
      bestScore = score;
    }
    if (to && c.x === to.x && c.z === to.z) break;
    if (c.d >= 70) continue;
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = c.x + dx;
      const nz = c.z + dz;
      const k = key(nx, nz);
      if (prev.has(k) || !wet(nx, nz)) continue;
      prev.set(k, c);
      q.push({ x: nx, z: nz, d: c.d + 1 });
    }
  }
  const path = [];
  for (let c = best; c; c = prev.get(key(c.x, c.z))) path.push({ x: c.x, z: c.z });
  return path.reverse();
}
