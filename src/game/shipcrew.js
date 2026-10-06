// A great ship's people (round 68: see ships3d.js): her crew walking her
// deck and working her (her captain or mate at the wheel, hands at the
// sheets and the masts, gunners at the guns, someone forward keeping a
// lookout), going below now and then and coming up again, at the pumps
// when she's taking water, mending what's broken; and fighting for her.
// They're there while any of you are near; away from you, they're only
// her crew list.
//   And the ships no player's sailing: her helmsman sails her where she's
// bound (see shipfleets.js), wind or no wind, clear of the land, and
// fights her when she has to: running her guns out and laying her
// broadside on.
import { NPC_STEP_TIME } from '../config.js';
import { B } from '../world/blocks.js';
import { stepOn, standOn, isInside, onPlan } from '../world/shipmodels.js';
import { Sailor } from '../entities/sailor.js';
import { findPath } from '../entities/pathfind.js';
import { makeTraveller } from '../entities/npcgen.js';
import { RNG } from '../util/rng.js';
import { putAboard, deckSpotNear, deckStep, sailable, fireGun, shipsOf, shipById, windOf, pointOfSail, mendVoxel } from './ships3d.js';
import { holdOf, holdPos, holdLocal } from './shiphold.js';

const TAU = Math.PI * 2;
const NEAR = 70;
const FAR = 110;

// A crew for a ship of `type`, of the people `style`.
export function makeCrew(seed, type, style, n, civ = null) {
  const rng = new RNG(seed >>> 0);
  const out = [];
  for (let i = 0; i < n; i++) {
    const role = i === 0 ? 'captain' : i === 1 ? 'mate' : i % 4 === 2 ? 'gunner' : i % 6 === 5 ? 'marine' : 'sailor';
    const t = makeTraveller(rng, style || 'vale', role === 'marine' ? 'guard' : 'driver');
    const look = { ...t.look };
    look.outfit = role === 'captain' ? 'noble' : role === 'marine' ? 'guard' : rng.pick(['plain', 'vest', 'plain']);
    look.hat = role === 'captain' ? 'feather' : role === 'marine' ? 'helmet' : rng.pick([null, 'cap', 'bandana', null, 'straw']);
    out.push({ name: t.name, look, role, civ, style });
  }
  return out;
}

// Each frame, for ship S: her crew there or not (as you come and go), and
// each of them about their work; her helmsman sailing her.
export function crewTick(game, S, dt) {
  if (game.remote) return;
  const near = playersNear(game, S, S.crewHere ? FAR : NEAR);
  if (near && !S.crewHere && S.crewRecs.length && !S.sinking) spawnCrew(game, S);
  else if (!near && S.crewHere) despawnCrew(game, S);
  const crew = crewOf(game, S);
  if (S.crewHere) for (const c of crew) {
    c.update(dt);
    if (c.dead) continue;
    if (c.deck) deckBrain(game, S, c, dt);
    else if (S.hold && S.hold.has(c)) holdBrain(game, S, c, dt);
  }
  // Her helmsman, if she's not a player's to steer.
  if (!S.owner || S.autoHelm) helmsman(game, S, dt);
  // Run her guns in again a while after the last shot.
  if (S.runOutT > 0) {
    S.runOutT -= dt;
    if (S.runOutT <= 0) S.runOut = false;
  }
  // Mending her, slowly, plank by plank (her carpenter's stores).
  if (crew.length && !S.fight) {
    S.mendT = (S.mendT || 0) - dt;
    if (S.mendT <= 0) {
      S.mendT = 3.5;
      const vi = firstHole(S);
      if (vi >= 0 && (S.stores === undefined || S.stores > 0)) {
        mendVoxel(game, S, vi);
        if (S.stores !== undefined) S.stores--;
      }
    }
  }
}

function firstHole(S) {
  const m = S.m;
  // (Under the waterline first.)
  let best = -1;
  let by = Infinity;
  for (const L of S.leaks || []) if (L.y < by) {
    by = L.y;
    best = L.i;
  }
  if (best >= 0) return best;
  for (let i = 0; i < m.N; i++) if (m.struct[i] && !S.vox[i] && m.vox[i]) return i;
  return -1;
}

function playersNear(game, S, r) {
  for (const q of game.everyone ? game.everyone() : [game.player]) {
    if (!q || q.limbo) continue;
    if (Math.hypot(q.x - S.x, q.z - S.z) < r) return true;
    if (S.hold && S.hold.has(q)) return true;
  }
  return false;
}

export function crewOf(game, S) {
  return (game.sailors || []).filter((c) => c.shipId === S.id && !c.dead);
}

function spawnCrew(game, S) {
  S.crewHere = true;
  game.sailors ||= [];
  const m = S.m;
  S.crewRecs.forEach((rec, i) => {
    if (rec.dead) return;
    const c = new Sailor(game, { ...rec, ship: S.id });
    c.recRef = rec;
    // Where each of them is to start: the captain by the wheel, gunners by
    // the guns, the rest about the deck.
    let at = null;
    if (rec.role === 'captain') at = { x: m.helm.stand.x, z: m.helm.stand.z };
    else if (rec.role === 'gunner') {
      const g = m.guns.filter((q) => q.deck)[i % Math.max(1, m.guns.filter((q) => q.deck).length)];
      if (g) at = { x: g.x - g.side, z: g.z };
    }
    if (!at) at = { x: 1 + ((i * 3) % (m.W - 2)), z: Math.round(m.L * (0.3 + ((i * 0.13) % 0.5))) };
    const spot = deckSpotNear(S, at.x + 0.5, at.z + 0.5, 5, null);
    if (!spot) return;
    game.sailors.push(c);
    putAboard(game, S, c, spot.cx, spot.y, spot.cz);
    c.thinkT = Math.random() * 3;
  });
}

function despawnCrew(game, S) {
  S.crewHere = false;
  const keep = [];
  for (const c of game.sailors || []) {
    if (c.shipId !== S.id) {
      keep.push(c);
      continue;
    }
    if (c.recRef) {
      c.recRef.hp = c.hp;
      if (c.dead) c.recRef.dead = true;
    }
    game.removeOcc?.(c);
  }
  game.sailors = keep;
}

// Cells of hers a step from (x, y, z), walking her deck.
function deckPath(S, from, to, maxN = 1500) {
  const m = S.m;
  const key = (x, y, z) => (y * m.L + z) * m.W + x;
  const prev = new Map([[key(from.x, from.y, from.z), null]]);
  const q = [[from.x, from.y, from.z]];
  for (let i = 0; i < q.length && i < maxN; i++) {
    const [x, y, z] = q[i];
    if (x === to.x && z === to.z && Math.abs(y - to.y) <= 1) {
      const path = [];
      let k = key(x, y, z);
      let cur = [x, y, z];
      while (cur) {
        path.push(cur);
        cur = prev.get(k);
        if (cur) k = key(cur[0], cur[1], cur[2]);
      }
      path.reverse();
      path.shift();
      return path;
    }
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx;
      const nz = z + dz;
      if (!onPlan(m, nx, nz)) continue;
      const ny = stepOn(m, S.vox, x, y, z, nx, nz);
      if (ny < 0) continue;
      // (Not down a hatch unless that's where they're going.)
      if (isInside(m, nx, ny, nz) && !(nx === to.x && nz === to.z)) continue;
      const k = key(nx, ny, nz);
      if (prev.has(k)) continue;
      prev.set(k, [x, y, z]);
      q.push([nx, ny, nz]);
    }
  }
  return null;
}

const LINES = {
  idle: ['Fair wind today.', 'Mind the boom!', 'Haul away!', 'Another day, another league.', 'Smells like weather.', 'Who\'s on the next watch?', 'Coil that line, lad.', 'Land ho? No... just cloud.'],
  storm: ['Hold fast!', 'She\'ll hold! She\'ll hold!', 'Lash it down!', 'Pump, you dogs, pump!'],
  fight: ['Run out the guns!', 'Fire as she bears!', 'Load! Load!', 'Steady... steady...', 'Repel boarders!'],
  hurt: ['We\'re holed!', 'Water in the hold!', 'Man the pumps!'],
};

function deckBrain(game, S, c, dt) {
  const d = c.deck;
  if (d.mv) return;
  // Walking somewhere.
  const t = c.task;
  if (t && t.path && t.path.length) {
    const [nx, , nz] = t.path[0];
    const ok = deckStep(game, S, c, Math.sign(nx - d.cx), Math.sign(nz - d.cz), NPC_STEP_TIME * 0.85);
    if (ok) t.path.shift();
    else t.path = null;
    if (!c.deck) return;
    return;
  }
  // At the wheel: stays there.
  if (t && t.kind === 'helm' && S.helmBy === c.id) {
    c.dir = facingTo(S, 0, -1);
    return;
  }
  if (t && t.kind === 'haul') {
    t.t -= dt;
    if (Math.random() < dt * 2) c.actionTimer = 0.25;
    if (t.t > 0) return;
  }
  if (t && t.kind === 'gun') {
    // Laying their gun on the foe, and firing as she bears.
    const g = S.m.guns[t.gi];
    if (S.fight && g) {
      const st = S.guns[t.gi];
      if (st.cd <= 0 && bears(game, S, t.gi)) fireGun(game, S, t.gi, c);
      if (Math.random() < dt * 0.3) c.say(pick(LINES.fight), 1.6, '#ffd080');
      return;
    }
  }
  c.thinkT = (c.thinkT || 0) - dt;
  if (c.thinkT > 0) return;
  c.thinkT = 2 + Math.random() * 5;
  const m = S.m;
  const R = Math.random();
  const here = { x: d.cx, y: d.y, z: d.cz };
  // The captain (or mate) takes the wheel of a ship no player sails.
  if ((c.role === 'captain' || c.role === 'mate') && (!S.owner || S.autoHelm) && !S.helmBy) {
    const hs = m.helm.stand;
    const to = standOn(m, S.vox, hs.x, hs.y, hs.z) ? { cx: hs.x, y: hs.y, cz: hs.z } : deckSpotNear(S, hs.x + 0.5, hs.z + 0.5, 1, hs.y);
    if (to) {
      if (to.cx === d.cx && to.cz === d.cz) {
        S.helmBy = c.id;
        c.task = { kind: 'helm' };
        d.role = 'helmsman';
        return;
      }
      const path = deckPath(S, here, { x: to.cx, y: to.y, z: to.cz });
      if (path) c.task = { kind: 'go', path };
      return;
    }
  }
  // A fight: the gunners to their guns.
  if (S.fight && (c.role === 'gunner' || c.role === 'sailor')) {
    const taken = new Set(crewOf(game, S).filter((o) => o.task && o.task.kind === 'gun').map((o) => o.task.gi));
    const gi = S.m.guns.findIndex((g, i) => g.deck && !taken.has(i) && S.vox[(g.y * m.L + g.z) * m.W + g.x] === B.ship_cannon && (S.fight.side === 0 || g.side === S.fight.side));
    if (gi >= 0) {
      const g = S.m.guns[gi];
      const to = deckSpotNear(S, g.x - g.side + 0.5, g.z + 0.5, 1, g.y);
      if (to && to.cx === d.cx && to.cz === d.cz) c.task = { kind: 'gun', gi };
      else if (to) {
        const path = deckPath(S, here, { x: to.cx, y: to.y, z: to.cz });
        if (path) c.task = { kind: 'go', path, then: { kind: 'gun', gi } };
      }
      return;
    }
  }
  // Taking water: below to the pumps.
  if (S.flood > 0.06 && c.role !== 'captain' && R < 0.5) {
    if (goBelow(game, S, c, 'pump')) return;
  }
  if (c.task && c.task.then) {
    c.task = c.task.then;
    return;
  }
  // Otherwise about the deck: hauling at a mast, a look over the rail, a
  // turn below, a word.
  if (R < 0.3 && m.masts.length) {
    const mm = m.masts[Math.floor(Math.random() * m.masts.length)];
    const to = deckSpotNear(S, mm.x + (Math.random() < 0.5 ? -0.5 : 1.5), mm.z + 0.5, 2, mm.base);
    if (to) {
      const path = deckPath(S, here, { x: to.cx, y: to.y, z: to.cz });
      c.task = path ? { kind: 'go', path, then: { kind: 'haul', t: 3 + Math.random() * 4 } } : { kind: 'haul', t: 3 };
    }
  } else if (R < 0.42 && c.role !== 'captain') {
    goBelow(game, S, c, 'visit');
  } else if (R < 0.85) {
    for (let k = 0; k < 6; k++) {
      const x = 1 + Math.floor(Math.random() * (m.W - 2));
      const z = 1 + Math.floor(Math.random() * (m.L - 2));
      const to = deckSpotNear(S, x + 0.5, z + 0.5, 1, null);
      if (!to) continue;
      const path = deckPath(S, here, { x: to.cx, y: to.y, z: to.cz }, 900);
      if (path && path.length) {
        c.task = { kind: 'go', path };
        break;
      }
    }
  } else {
    const storm = game.world.ow && game.world.ow.stormAt && game.world.ow.stormAt(S.x, S.z) > 0.1;
    c.say(pick(storm ? LINES.storm : S.flood > 0.1 ? LINES.hurt : LINES.idle), 2.4);
  }
}

// Down the nearest hatch (to the pumps, or for a while).
function goBelow(game, S, c, why) {
  const m = S.m;
  const top = m.hatches.find((h) => h.top);
  if (!top) return false;
  const d = c.deck;
  // The deck cell at the head of the stairs, then down them.
  const to = { x: top.x, y: m.deck + 1, z: top.z + top.n };
  const path = deckPath(S, { x: d.cx, y: d.y, z: d.cz }, to);
  if (!path) return false;
  // (On down the steps.)
  path.push([top.x, top.D + top.n, top.z + top.n - 1]);
  c.task = { kind: 'go', path };
  c.below = { why, t: why === 'pump' ? 60 : 12 + Math.random() * 20 };
  holdOf(game, S);
  return true;
}

// Below decks: to the pump, or about; and back up.
function holdBrain(game, S, c, dt) {
  if (c.moving) return;
  const b = c.below || (c.below = { why: 'visit', t: 10 });
  const m = S.m;
  if (c.hpath && c.hpath.length) {
    const [x, y, z] = c.hpath.shift();
    if (Math.abs(x - c.x) + Math.abs(z - c.z) <= 2 && game.world.canStand(x, y, z, true)) {
      c.face(x, z);
      c.startMove(x, y, z, NPC_STEP_TIME);
    } else c.hpath = null;
    return;
  }
  b.t -= dt;
  if (b.why === 'pump') {
    const [px, py, pz] = holdPos(S, m.pump.x, m.pump.y, m.pump.z);
    if (Math.abs(c.x - px) + Math.abs(c.z - pz) <= 1) {
      S.pumpers = (S.pumpers || 0) + 1;
      if (Math.random() < dt * 3) c.actionTimer = 0.25;
      if (S.flood > 0.01 && b.t > 0) return;
    } else if (!c.hpathTried) {
      c.hpathTried = true;
      c.hpath = findPath(game.world, c.x, c.y, c.z, px, py, pz, { near: 1, maxNodes: 2500 }) || [];
      return;
    }
  }
  if (b.t > 0 && b.why !== 'pump') {
    if (!c.hpath && Math.random() < dt * 0.5) {
      const x = c.x + Math.round((Math.random() - 0.5) * 8);
      const z = c.z + Math.round((Math.random() - 0.5) * 8);
      const y = game.world.findStandY(x, z, c.y);
      if (y >= 0) c.hpath = findPath(game.world, c.x, c.y, c.z, x, y, z, { maxNodes: 800 }) || null;
    }
    return;
  }
  // Back up on deck, up the stairs.
  const top = m.hatches.find((h) => h.top);
  if (!top) return;
  const [tx, ty, tz] = holdPos(S, top.x, m.deck + 1, top.z + top.n);
  if (!c.upTried || (c.upTried && Math.random() < dt * 0.2)) {
    c.upTried = true;
    c.hpath = findPath(game.world, c.x, c.y, c.z, tx, ty, tz, { maxNodes: 3000 }) || null;
    c.hpathTried = false;
    if (!c.hpath) {
      // (Can't find the way up: straight up the nearest stairs.)
      const [lx, , lz] = holdLocal(S, c.x, c.y, c.z);
      const spot = deckSpotNear(S, lx + 0.5, lz + 0.5, 8, null);
      if (spot) {
        c.below = null;
        putAboard(game, S, c, spot.cx, spot.y, spot.cz);
      }
    }
  }
}

// Does gun gi of hers bear on her foe?
function bears(game, S, gi) {
  const f = S.fight;
  if (!f) return false;
  const foe = f.ship ? shipById(game, f.ship) : null;
  const tx = foe ? foe.x : f.x;
  const tz = foe ? foe.z : f.z;
  if (tx === undefined) return false;
  const g = S.m.guns[gi];
  const [wx, wz] = S.toWorld(g.x + 0.5, g.z + 0.5);
  const [ldx, ldz] = S.dirLocal(tx - wx, tz - wz);
  const d = Math.hypot(ldx, ldz);
  if (d > 55 || d < 3) return false;
  const aim = Math.atan2(-ldz * g.side, ldx * g.side);
  if (Math.abs(aim) > 0.55) return false;
  const st = S.guns[gi];
  st.aim = aim;
  // (Elevation for the range.)
  st.elev = Math.max(0, Math.min(0.5, (d - 8) / 80));
  return true;
}

function facingTo(S, lx, lz) {
  const [wdx, wdz] = S.dirWorld(lx, lz);
  return Math.abs(wdx) > Math.abs(wdz) ? (wdx < 0 ? 1 : 3) : wdz < 0 ? 2 : 0;
}

function pick(a) {
  return a[Math.floor(Math.random() * a.length)];
}

// ------------------------------------------------------------ her helmsman
// Sailing her where she's bound (`S.route`: points in the world, in turn;
// `S.goal`, the last), clear of the land: setting and trimming her sail
// to the wind, putting her helm over to come round to her course, feeling
// ahead for shoal water and bearing away from it. In a fight, laying her
// broadside on the foe.
export function helmsman(game, S, dt) {
  if (S.sinking) return;
  const helm = S.helmBy !== null && S.helmBy !== undefined;
  if (!helm && S.crewHere) return;
  const m = S.m;
  let tx;
  let tz;
  const f = S.fight;
  // (Out for a player: their ship, if they're aboard one, else them.)
  if (f && f.player) {
    let best = null;
    for (const q of game.everyone ? game.everyone() : [game.player]) if (!q.dead && (!best || Math.hypot(q.x - S.x, q.z - S.z) < Math.hypot(best.x - S.x, best.z - S.z))) best = q;
    if (best) {
      f.ship = best.deck ? best.deck.s : null;
      f.x = best.x;
      f.z = best.z;
    }
  }
  const foe = f && f.ship ? shipById(game, f.ship) : null;
  if ((foe && !foe.sinking) || (f && f.x !== undefined)) {
    // Broadside on: steer to bring her side to bear at a good range.
    const dx = (foe ? foe.x : f.x) - S.x;
    const dz = (foe ? foe.z : f.z) - S.z;
    const d = Math.hypot(dx, dz);
    const bearing = Math.atan2(dx, dz);
    const side = f.side || (angleDiff(bearing, S.yaw) > 0 ? 1 : -1);
    f.side = side;
    // (Course: the bearing less a right angle toward her chosen side; in
    // close, open the range.)
    const off = d < 12 ? 2.1 : d > 35 ? 0.6 : Math.PI / 2;
    const course = bearing - side * off;
    tx = S.x + Math.sin(course) * 20;
    tz = S.z + Math.cos(course) * 20;
    S.runOut = true;
    S.runOutT = 15;
    S.sailGoal = d > 40 ? 1 : 0.7;
    // (Her gun deck fires with no one seen at it.)
    if (!S.crewHere || S.m.guns.some((g) => !g.deck)) {
      S.guns.forEach((st, i) => {
        const g = S.m.guns[i];
        if (S.crewHere && g.deck) return;
        if (st.cd <= 0 && bears(game, S, i) && Math.random() < dt * 2) fireGun(game, S, i, null);
      });
    }
  } else {
    if (f) S.fight = null;
    const r = S.route;
    if (!r || !r.length) {
      S.sailGoal = 0;
      S.rudder *= 0.9;
      if (Math.abs(S.v) < 0.5 && S.mission && S.mission.moor) S.anchor = true;
      return;
    }
    const w = r[0];
    const d = Math.hypot(w.x - S.x, w.z - S.z);
    if (d < Math.max(6, m.L * 0.6)) {
      r.shift();
      if (!r.length) S.onArrive?.(S);
      return;
    }
    tx = w.x;
    tz = w.z;
    S.anchor = false;
    // (Coming in to her mooring: easing off.)
    S.sailGoal = r.length === 1 && d < 40 ? Math.max(0.25, d / 60) : 1;
  }
  // Feeling ahead for the land.
  const want = Math.atan2(tx - S.x, tz - S.z);
  let course = want;
  const look = Math.max(10, Math.abs(S.v) * 2.5);
  if (!clearAhead(game, S, course, look)) {
    let best = null;
    for (const off of [0.35, -0.35, 0.7, -0.7, 1.1, -1.1, 1.6, -1.6, 2.4, -2.4]) {
      if (clearAhead(game, S, want + off, look)) {
        best = want + off;
        break;
      }
    }
    if (best !== null) course = best;
    else {
      S.sailGoal = 0.2;
      course = S.yaw + Math.PI * 0.5;
    }
  }
  const diff = angleDiff(course, S.yaw);
  S.rudder = Math.max(-1, Math.min(1, diff * 2.2));
  S.helmHeld = true;
  // (No sailing straight into the wind: fall off to a close reach.)
  const W = windOf(game);
  const P = pointOfSail(S, W);
  if (P.deg > 140 && Math.abs(diff) < 0.4) S.rudder = S.rudder >= 0 ? 0.8 : -0.8;
  if (!S.crewHere) S.sheet += (P.ideal - S.sheet) * Math.min(1, dt * 0.5);
}

function clearAhead(game, S, course, look) {
  const m = S.m;
  for (let k = 0.3; k <= 1; k += 0.25) {
    const d = m.L * 0.5 + look * k;
    for (const off of [-m.W * 0.5, 0, m.W * 0.5]) {
      const x = S.x + Math.sin(course) * d + Math.cos(course) * off;
      const z = S.z + Math.cos(course) * d - Math.sin(course) * off;
      if (!sailable(game, Math.round(x), Math.round(z))) return false;
    }
  }
  for (const o of shipsOf(game)) {
    if (o === S) continue;
    const d = Math.hypot(o.x - S.x, o.z - S.z);
    if (d > look + m.L) continue;
    const b = Math.atan2(o.x - S.x, o.z - S.z);
    if (Math.abs(angleDiff(b, course)) < 0.35 && d < look + (m.L + o.m.L) / 2) return false;
  }
  return true;
}

export function angleDiff(a, b) {
  let d = (a - b) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}

// A hand from her crew hurt (or killed) in a fight: and her crew turned
// on whoever did it.
export function crewHurt(game, c, by) {
  if (!by) return;
  const S = shipById(game, c.shipId);
  if (!S) return;
  for (const o of crewOf(game, S)) {
    o.angry = true;
    o.foe = by.id;
  }
}

// Her crew fighting whoever's attacked them, hand to hand on her deck.
export function crewFight(game, S, dt) {
  for (const c of crewOf(game, S)) {
    if (!c.angry || c.dead) continue;
    const foe = (game.everyone ? game.everyone() : []).find((q) => q.id === c.foe);
    if (!foe || foe.dead) {
      c.angry = false;
      continue;
    }
    if (Math.max(Math.abs(foe.x - c.x), Math.abs(foe.z - c.z)) <= 1 && Math.abs(foe.y - c.y) <= 1) {
      if (c.attackCd <= 0) {
        c.attackCd = 1.1;
        c.actionTimer = 0.25;
        c.face(foe.x, foe.z);
        game.damage(foe, c.dmg, c);
      }
    } else if (c.deck && foe.deck && foe.deck.s === S.id && !c.deck.mv) {
      const path = deckPath(S, { x: c.deck.cx, y: c.deck.y, z: c.deck.cz }, { x: foe.deck.cx, y: foe.deck.y, z: foe.deck.cz });
      if (path && path.length > 1) c.task = { kind: 'go', path: path.slice(0, -1) };
    }
  }
}

