// What the stories have in common: finding people and places, sizing up a
// fight, and putting words together (from lines written out by hand: no
// guessing at sentences).
import { R, nameOf, NameOf, resolve, isAlive, whereOf, townMid, directions, pidOf, playerOf, playerName } from '../refs.js';
import { alive, DAY } from '../../econ.js';
import { GROUND, REGION_W, REGION_D } from '../../../config.js';
import { BIOMES } from '../../../world/biomes.js';
import { RNG, hash4 } from '../../../util/rng.js';

export { R, nameOf, NameOf, resolve, isAlive, whereOf, townMid, directions, pidOf, playerOf, playerName, DAY };

export const pick = (rng, a) => a[Math.floor(rng.next() * a.length)];
export const cap = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

// "{who} saw {what}" with { who, what }.
export function fill(t, v = {}) {
  return String(t).replace(/\{(\w+)\}/g, (m, k) => (v[k] !== undefined && v[k] !== null ? String(v[k]) : m));
}
export function say(rng, list, v = {}) {
  return fill(pick(rng, list), v);
}

export function layoutOf(S, sid) {
  if (sid === null || sid === undefined) return null;
  const L = S.game.world.layouts.get(sid);
  return L && L.econ ? L : null;
}

export function town(S, sid) {
  return S.game.world.ow.settlements[sid] || null;
}

export function townName(S, sid) {
  const s = town(S, sid);
  return s ? s.name : 'a town';
}

// Towns lived in, nearest (x, z) first (`max`: in map squares).
export function townsNear(S, x, z, max = 10) {
  const cx = x / REGION_W;
  const cz = z / REGION_D;
  return S.game.world.ow.settlements
    .filter((s) => !s.deserted && s.condition !== 'abandoned' && Math.hypot(s.cx + 0.5 - cx, s.cz + 0.5 - cz) <= max)
    .sort((a, b) => Math.hypot(a.cx - cx, a.cz - cz) - Math.hypot(b.cx - cx, b.cz - cz));
}

// The towns that have been laid out (and so have people with names).
export function laidTowns(S) {
  return [...S.game.world.layouts.values()].filter((L) => L.econ && L.settlement && !L.settlement.deserted);
}

// A town's own people, about and grown.
export function living(L) {
  return L.npcs.filter((r) => alive(r) && !r.away && !r.migrated && !r.visitor && r.ruler === undefined && r.soldier === undefined && r.captive === undefined);
}
export function adults(L) {
  return living(L).filter((r) => r.age !== 'child');
}

export function recOf(S, ref) {
  return ref && ref.t === 'rec' ? resolve(S, ref) : null;
}

export function fullName(r) {
  return r ? `${r.name.first} ${r.name.last}` : 'someone';
}

// Those who'd mourn `rec` (and take it up after them): partner, children
// grown, parents, friends.
export function kinOf(L, rec) {
  const ids = [rec.partner, ...(rec.children || []), ...(rec.parents || []), ...(rec.friends || [])].filter((i) => i !== null && i !== undefined && i !== rec.idx);
  return [...new Set(ids)].map((i) => L.npcs[i]).filter((o) => o && alive(o) && !o.away && !o.migrated && o.age !== 'child');
}

export function relWord(rec, other) {
  if (rec.partner === other.idx) return 'partner';
  if ((rec.children || []).includes(other.idx)) return other.age === 'child' ? 'little one' : 'child';
  if ((rec.parents || []).includes(other.idx)) return 'parent';
  if (rec.household !== undefined && rec.household === other.household) return 'kin';
  if ((rec.friends || []).includes(other.idx)) return 'friend';
  return 'neighbour';
}

// Is (x, z) open, dry, level ground clear of every town (room for a camp,
// a den, a meeting)?
export function openGround(S, x, z, clear = 16) {
  const w = S.game.world;
  const ow = w.ow;
  if (ow.settlements.some((o) => x >= o.bounds.x0 - clear && x <= o.bounds.x1 + clear && z >= o.bounds.z0 - clear && z <= o.bounds.z1 + clear)) return false;
  const t = w.terrain;
  if (!t) return true;
  try {
    const c = t.column(x, z, t.context(x, z, x, z), {});
    return c.water < 0 && c.h === GROUND - 1;
  } catch {
    return false;
  }
}

export function biomeAt(S, x, z) {
  const t = S.game.world.terrain;
  try {
    return t.column(x, z, t.context(x, z, x, z), {}).biome;
  } catch {
    return null;
  }
}

// Somewhere open out from (x, z): `r0` to `r1` paces off.
export function spotNear(S, x, z, r0, r1, rng, { woods = false, clear = 16, flat = 1 } = {}) {
  const t = S.game.world.terrain;
  for (let i = 0; i < 50; i++) {
    const a = rng.float(0, Math.PI * 2);
    const r = rng.float(r0, r1);
    const sx = Math.round(x + Math.cos(a) * r);
    const sz = Math.round(z + Math.sin(a) * r);
    if (!openGround(S, sx, sz, clear)) continue;
    let ok = true;
    for (let dx = -flat; dx <= flat && ok; dx++) for (let dz = -flat; dz <= flat && ok; dz++) if ((dx || dz) && !openGround(S, sx + dx, sz + dz, clear)) ok = false;
    if (!ok) continue;
    if (woods && t && i < 30) {
      const b = BIOMES[biomeAt(S, sx, sz)];
      if (!b || (b.treeChance || 0) < 0.05) continue;
    }
    return { x: sx, z: sz };
  }
  return null;
}

export function dist(a, b) {
  return a && b ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity;
}

// Bands camped within `max` map squares of a town.
export function bandsNear(S, sid, max = 12) {
  const s = town(S, sid);
  if (!s) return [];
  return S.sim.bandits.live().filter((b) => b.camp && Math.hypot(s.cx - b.camp.x / REGION_W, s.cz - b.camp.z / REGION_D) < max);
}

// One side against another, as the plain telling settles it: the chance
// `a` wins (each a strength: see Saga.strengthOf).
export function odds(a, b) {
  return a <= 0 ? 0 : b <= 0 ? 1 : a / (a + b * 1.15);
}

// The players near (x, z) (pids).
export function playersNear(S, x, z, r) {
  return S.players().filter(({ p }) => Math.max(Math.abs(p.x - x), Math.abs(p.z - z)) <= r).map((q) => q.pid);
}

// Is someone playing out in the open (not in a town, not down an old
// place, not in a scene)? Where killers and messengers can find them.
export function outInTheOpen(S, pid) {
  const p = playerOf(S.game, pid);
  if (!p || p.dead || p.limbo || p.sagaHeld) return false;
  const g = S.game;
  if (g.world.inInstance && g.world.inInstance(p.x)) return false;
  if (g.world.ow.settlementAt(p.x, p.z)) return false;
  return true;
}

export function inTown(S, pid) {
  const p = playerOf(S.game, pid);
  return p ? S.game.world.ow.settlementAt(p.x, p.z) : null;
}

// Coins in a player's purse.
export function purse(S, pid) {
  const p = playerOf(S.game, pid);
  if (!p) return 0;
  return p.inv.reduce((n, q) => n + (q && q.item === 'coin' ? q.count : 0), 0);
}

// The town someone playing calls home (citizen of), if any.
export function homeOf(S, pid) {
  let sid = null;
  S.asPid(pid, () => {
    const c = S.sim.citizen;
    sid = c ? c.sid : null;
  });
  return sid;
}

// Their renown in a town.
export function renownIn(S, pid, sid) {
  let v = 0;
  S.asPid(pid, () => {
    v = S.sim.renown.get(sid) || 0;
  });
  return v;
}

export function rngFor(S, ...k) {
  return new RNG(hash4(S.game.seed | 0, ...k));
}

export function hours(n) {
  return n * 60;
}
export function days(n) {
  return n * DAY;
}

// A short word for how long ago.
export function ago(S, at) {
  const d = Math.floor((S.now - at) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
}

// The thread's own town, as a ref.
export function townRef(th) {
  return th.sid !== null && th.sid !== undefined ? R.town(th.sid) : null;
}
