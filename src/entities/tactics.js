// How the watch fight together (round 50). A guard on their own goes
// straight at whatever they're after; two or more after the same few foes
// work as a body:
//   - against a handful (four or fewer), they spread round them: each to
//     a side of their own, the foes surrounded, nobody standing where
//     another already is (and if one foe has most of them on it, the rest
//     go to whichever has fewest);
//   - against more than that, they keep a line: shoulder to shoulder two
//     paces apart, facing the enemy, taking whoever comes into reach,
//     and edging forward together when nobody does;
//   - and either way, never in a heap: no two of them on the same spot
//     or the next one to it, if there's room.
// Worked out once a frame for each fight (see NPC.fight), not for each
// guard over again.
import { inReach, styleOf } from '../game/combat.js';

const CLUSTER = 6; // paces about a foe that count as its company
const SURROUND_MAX = 4; // foes or fewer: surrounded; more: a line
const SPACING = 2; // paces between guards in a line

const cheb = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));

// Who's fighting alongside `t`: its company, the same side as it.
export function foesWith(game, t) {
  if (!t || t.dead) return [];
  if (t.kind === 'player') return [t];
  if (t.kind === 'creature') return game.creatures.filter((c) => c === t || (!c.dead && c.hostileNow && !c.inst && !c.tie && cheb(c, t) <= CLUSTER));
  // A person: their band (bandits, a raid, a warband).
  const r = t.rec || {};
  return game.npcs.filter((n) => n === t || (!n.dead && !n.down && cheb(n, t) <= CLUSTER && n.state === 'fight' && ((r.bandit && n.rec && n.rec.bandit) || (t.warband && n.warband === t.warband))));
}

// The watch in this fight: guards (not off with a bow, not falling back)
// who are after one of `foes`.
function guardsOn(game, foes) {
  const set = new Set(foes);
  return game.npcs.filter((n) => !n.dead && !n.down && n.state === 'fight' && n.rec && n.rec.job === 'guard' && !n.warband && !n.hired && !n.drawnBow && !n.retreated && set.has(n.threat));
}

// Somewhere to stand near (x, z): free (nobody on it), walkable, and not
// right beside another guard's spot if there's anywhere better (else at
// least not on it). Tries outward from it.
function freeSpot(game, g, x, z, taken) {
  const w = game.world;
  for (const gap of [2, 1]) {
    for (let r = 0; r <= 2; r++) {
      for (let dz = -r; dz <= r; dz++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const qx = Math.round(x + dx);
          const qz = Math.round(z + dz);
          if (taken.some((q) => cheb(q, { x: qx, z: qz }) < gap)) continue;
          const y = w.findStandY ? w.findStandY(qx, qz, g.y) : g.y;
          if (y === null || y === undefined || y < 0 || Math.abs(y - g.y) > 1) continue;
          if (w.isWaterAt && w.isWaterAt(qx, y, qz)) continue;
          if (game.occupiedBySolid && game.occupiedBySolid(qx, y, qz, g)) continue;
          const e = game.entityAt ? game.entityAt(qx, y, qz) : null;
          if (e && e !== g) continue;
          return { x: qx, y, z: qz };
        }
      }
    }
  }
  return null;
}

// The plan for this fight, made once a frame: for each guard in it, a
// foe to go for (if not their own) and where to stand.
function makePlan(game, t) {
  const foes = foesWith(game, t);
  const guards = guardsOn(game, foes);
  const plan = { foes, guards, spot: new Map(), foe: new Map(), mode: null };
  if (guards.length < 2) return plan;
  guards.sort((a, b) => a.id - b.id);
  const taken = [];
  if (foes.length <= SURROUND_MAX) {
    plan.mode = 'surround';
    // Shared out among the foes: nobody left with most of the watch on
    // them while another has none.
    const load = new Map(foes.map((f) => [f, 0]));
    for (const g of guards) if (load.has(g.threat)) load.set(g.threat, load.get(g.threat) + 1);
    const fair = Math.ceil(guards.length / foes.length);
    for (const g of guards) {
      const f = g.threat;
      if (load.get(f) > fair) {
        const other = foes.filter((q) => q !== f).sort((a, b) => load.get(a) - load.get(b) || cheb(a, g) - cheb(b, g))[0];
        if (other && load.get(other) < fair) {
          load.set(f, load.get(f) - 1);
          load.set(other, load.get(other) + 1);
          plan.foe.set(g, other);
        }
      }
    }
    // Round each foe: its guards at even turns about it, from where the
    // first came at it (kept, so the places don't shift about as they
    // move).
    for (const f of foes) {
      const mine = guards.filter((g) => (plan.foe.get(g) || g.threat) === f);
      if (!mine.length) continue;
      if (f._tacBase === undefined) f._tacBase = Math.atan2(mine[0].z - f.z, mine[0].x - f.x);
      const base = f._tacBase;
      mine.forEach((g, i) => {
        const reach = Math.max(1, Math.min(2, styleOf(g, true).reach || 1));
        const a = base + (i / mine.length) * Math.PI * 2;
        const s = freeSpot(game, g, f.x + Math.cos(a) * reach, f.z + Math.sin(a) * reach, taken);
        if (s) {
          taken.push(s);
          plan.spot.set(g, s);
        }
      });
    }
    return plan;
  }
  // A line, facing them (kept facing the way it first did, unless they
  // come round to another side), as wide as their front and a pace each
  // side, and a second rank behind it if there are more of the watch.
  plan.mode = 'line';
  const cx = foes.reduce((n, f) => n + f.x, 0) / foes.length;
  const cz = foes.reduce((n, f) => n + f.z, 0) / foes.length;
  const gx = guards.reduce((n, g) => n + g.x, 0) / guards.length;
  const gz = guards.reduce((n, g) => n + g.z, 0) / guards.length;
  const key = Math.min(...foes.map((f) => f.id));
  const T = (game._tacLines ||= new Map());
  let L = T.get(key);
  let ux = cx - gx;
  let uz = cz - gz;
  const len = Math.hypot(ux, uz) || 1;
  ux /= len;
  uz /= len;
  if (!L || ux * L.ux + uz * L.uz < 0.3) L = { adv: L ? L.adv : 0, t: 0, ux, uz };
  T.set(key, L);
  if (T.size > 32) T.delete(T.keys().next().value);
  ({ ux, uz } = L);
  const vx = -uz;
  const vz = ux;
  // (How deep the enemy stands toward us, and how wide.)
  const front = Math.max(...foes.map((f) => -((f.x - cx) * ux + (f.z - cz) * uz)));
  const sideways = foes.map((f) => (f.x - cx) * vx + (f.z - cz) * vz);
  const width = Math.max(...sideways) - Math.min(...sideways);
  const perRank = Math.max(2, Math.floor((width + 2) / SPACING) + 1);
  // (Nobody's come to them: they edge forward together, a pace at a time.)
  const engaged = guards.some((g) => foes.some((f) => cheb(f, g) <= 2));
  L.t += game.dt || 0;
  if (!engaged && L.t > 2.5) {
    L.t = 0;
    L.adv = Math.min(2, L.adv + 1);
  }
  // (Two paces short of their front to begin with; then a pace short, so
  // the first rank's within reach of the nearest of them, never in among
  // them.)
  const back = front + 3 - L.adv;
  const along = guards.map((g) => ({ g, s: (g.x - cx) * vx + (g.z - cz) * vz })).sort((p, q) => p.s - q.s);
  const ranks = Math.ceil(along.length / perRank);
  along.forEach(({ g }, i) => {
    // (Spread over the ranks evenly: each rank its own share, left to
    // right.)
    const rank = i % ranks;
    const k = Math.floor(i / ranks);
    const inRank = Math.ceil((along.length - rank) / ranks);
    const off = (k - (inRank - 1) / 2) * SPACING;
    const d = back + rank * 2;
    const s = freeSpot(game, g, cx - ux * d + vx * off, cz - uz * d + vz * off, taken);
    if (s) {
      taken.push(s);
      plan.spot.set(g, s);
    }
  });
  return plan;
}

// What guard `g` (after `t`) should do this moment, if they're one of a
// body of the watch: { foe } to go for instead, { spot } to stand on, and
// { hold } (in the line, nobody in reach: face them and wait).
export function guardPlan(game, g, t) {
  if (!t || t.dead) return null;
  const frame = game.frameNo || 0;
  let C = game._tacCache;
  if (!C || C.frame !== frame) C = game._tacCache = { frame, byFoe: new Map() };
  let plan = C.byFoe.get(t);
  if (!plan) {
    plan = makePlan(game, t);
    for (const f of plan.foes) C.byFoe.set(f, plan);
  }
  if (!plan.mode || !plan.guards.includes(g)) return null;
  const foe = plan.foe.get(g) || null;
  const spot = plan.spot.get(g) || null;
  // (Crowded: another of the watch on the same spot, or right beside
  // them while their own place is free elsewhere: they go to it first.)
  const crowded = !!spot && (spot.x !== g.x || spot.z !== g.z) && plan.guards.some((o) => o !== g && cheb(o, g) <= (cheb(spot, g) <= 3 ? 1 : 0));
  if (plan.mode === 'line') {
    // Whoever comes into reach.
    const st = styleOf(g, true);
    const near = plan.foes.filter((f) => !f.dead && inReach(g, f, st)).sort((a, b) => cheb(a, g) - cheb(b, g))[0];
    if (near && !crowded && (!spot || cheb(spot, g) <= 1)) return { foe: near !== t ? near : null, fight: true };
    return { spot, hold: !!spot && g.x === spot.x && g.z === spot.z, crowded, line: true };
  }
  return { foe, spot, crowded };
}

// Another of the watch on the very same spot (people can squeeze past one
// another): somewhere free beside it to step to, or null.
export function stepAside(game, g) {
  const other = game.npcs.some((o) => o !== g && !o.dead && o.state === 'fight' && o.x === g.x && o.z === g.z && o.rec && o.rec.job === 'guard');
  if (!other) return null;
  const opts = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
  for (let i = 0; i < opts.length; i++) {
    const [dx, dz] = opts[(i + g.id) % opts.length];
    const s = freeSpot(game, g, g.x + dx, g.z + dz, []);
    if (s && cheb(s, g) === 1) return s;
  }
  return null;
}
