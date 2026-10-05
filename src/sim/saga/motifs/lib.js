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

// (Round 54) Of someone: a trait they have; a side of their nature (0 to
// 1, `d` if it's not known).
export const has = (r, t) => !!(r && r.traits && r.traits.includes(t));
export const nat = (r, k, d = 0.5) => (r && r.personality && typeof r.personality[k] === 'number' ? r.personality[k] : d);

// Single (no partner, or theirs is gone).
export function single(L, r) {
  return r.partner === null || r.partner === undefined || !L.npcs[r.partner] || !alive(L.npcs[r.partner]);
}

// Kin by blood (a parent or child, or brother or sister).
export function blood(a, b) {
  if ((a.parents || []).includes(b.idx) || (b.parents || []).includes(a.idx)) return true;
  return (a.parents || []).some((p) => (b.parents || []).includes(p));
}

// Talking someone round, as the one playing just now: the better you're
// liked by them and the more winning your way, the likelier; `against`
// how set they are.
export function persuade(S, npc, rng, base = 0.3, against = 0) {
  const g = S.game;
  const cha = (g.hero && g.hero.stats ? g.hero.stats.cha : 2) || 2;
  const op = npc && npc.rec && S.sim.opinion ? S.sim.opinion(npc) : 0;
  return rng.chance(Math.max(0.05, Math.min(0.95, base + cha * 0.07 + op / 220 - against)));
}

// A townsperson's standing with someone playing, changed (spawned or not).
export function repWith(S, L, r, n) {
  if (!r || !L) return;
  S.sim.changeRep(r.ent && !r.ent.dead ? r.ent : { rec: r, settlement: L.settlement, layout: L }, n);
}

// Is this the townsperson `ref` points at?
export function isRec(npc, ref) {
  return !!(npc && npc.rec && ref && ref.t === 'rec' && !npc.rec.visitor && (npc.rec.sid ?? npc.settlement?.id) === ref.sid && npc.rec.idx === ref.idx);
}

// One of the town's own, for a story's walk-on part: someone grown, not
// the mayor, and (if `not`) none of those.
export function someone(L, rng, filter = null, not = []) {
  const ids = new Set(not.filter(Boolean).map((r) => r.idx));
  const ppl = adults(L).filter((r) => r.job !== 'mayor' && !ids.has(r.idx) && (!filter || filter(r)));
  return ppl.length ? pick(rng, ppl) : null;
}

// (Round 54) A word for the colour of someone's hair (as you'd see it).
export function hairWord(r) {
  const hex = r && r.look && typeof r.look.hair === 'string' ? r.look.hair : null;
  const m = hex && /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return 'dark';
  const n = parseInt(m[1], 16);
  const rr = ((n >> 16) & 255) / 255;
  const gg = ((n >> 8) & 255) / 255;
  const bb = (n & 255) / 255;
  const mx = Math.max(rr, gg, bb);
  const mn = Math.min(rr, gg, bb);
  const l = (mx + mn) / 2;
  const sat = mx === mn ? 0 : (mx - mn) / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (mx !== mn) {
    if (mx === rr) h = ((gg - bb) / (mx - mn)) % 6;
    else if (mx === gg) h = (bb - rr) / (mx - mn) + 2;
    else h = (rr - gg) / (mx - mn) + 4;
    h = (h * 60 + 360) % 360;
  }
  if (l > 0.82) return 'white';
  if (sat < 0.15) return l < 0.22 ? 'black' : l > 0.6 ? 'silver' : 'grey';
  if (l < 0.16) return 'black';
  if (h >= 75 && h < 200) return 'green-dyed';
  if (h >= 200 && h < 290) return 'blue-dyed';
  if (h >= 290 || h < 12) return sat > 0.45 && l > 0.3 ? 'red' : 'dark brown';
  if (h < 30) return l > 0.45 ? (sat > 0.5 ? 'red' : 'light brown') : l > 0.28 ? 'auburn' : 'dark brown';
  if (h < 75) return l > 0.55 ? 'fair' : l > 0.35 ? 'brown' : 'dark brown';
  return 'brown';
}
