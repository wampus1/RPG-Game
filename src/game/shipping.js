// The trade ships you can see (see sim/ships.js): tied up at her pier,
// the merchants called down to go aboard before she sails, putting out
// with them on deck and sailing off out of sight, and coming home again
// to tie up while they walk off along the pier. A ship is a prop (an
// Engine of type 'ship', see engines.js): drawn big, in nobody's way.
import { Engine } from './engines.js';
import { SURFACE, GROUND } from '../config.js';
import { setOverride } from '../sim/econ.js';

// Every frame: under way, a tile at a time.
export function sailShips(game, dt) {
  if (!game.shipProps) return;
  for (const e of game.shipProps.values()) {
    if (e.moving || !e.path || e.i >= e.path.length) continue;
    const t = e.path[e.i++];
    e.moveTo(t.x, GROUND, t.z, e.pace || 0.42);
  }
}

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
    if (!P || P.state === 'planned' || P.state === 'building') continue;
    const site = P.site;
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
    if (e.phase === 'in' && !e.moving && e.i >= e.path.length) {
      // Tied up: everyone off along the pier.
      e.phase = 'moored';
      e.path = null;
      e.sail = false;
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
      const path = waterPath(game, site.moor, site);
      e.riders = v.crew.map((idx) => L.npcs[idx]).filter((r) => r && r.look).map((r) => r.look).slice(0, 5);
      e.phase = 'out';
      e.sail = true;
      e.path = path;
      e.i = 1;
      game.audio?.play('horn', e);
      if (game.inSight(e.x, e.z, 6)) game.ui.msg(`The ${P.name} casts off for ${v.destName}.`, '#a0d8ff');
    }
    // Out of sight at sea: gone (till she's home). (Still in view when
    // she's due back: she turns about, and comes in again.)
    if (e.phase === 'out' && !game.inSight(e.x, e.z, 3)) drop(game, sid, e);
    else if (e.phase === 'out' && !atSea && !e.moving) {
      const back = waterPath(game, { x: e.x, z: e.z }, site, site.moor);
      e.phase = 'in';
      e.path = back;
      e.i = 1;
    }
  }
}

function make(game, P, sid, x, z) {
  const civ = game.world.ow.settlements[sid]?.civ;
  const e = new Engine(game, 'ship', x, GROUND, z, { banner: civ ? civ.color.hex : null, hp: 999 });
  e.name = P.name;
  e.sid = sid;
  e.riders = [];
  e.sail = false;
  e.phase = 'moored';
  e.dir = P.site.side.x ? (P.site.side.x > 0 ? 3 : 1) : 1;
  game.engines.push(e);
  game.shipProps.set(sid, e);
  return e;
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
  const L = game.sim.layoutOf(sid);
  e.riders = (P.aboard || []).map((idx) => L && L.npcs[idx]).filter((r) => r && r.look).map((r) => r.look).slice(0, 5);
  e.phase = 'in';
  e.sail = true;
  e.path = path;
  e.i = 1;
  return e;
}

function drop(game, sid, e) {
  game.shipProps.delete(sid);
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
