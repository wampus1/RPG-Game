// (Round 73) Front doors that lock. In some peoples' towns (see
// lockingCulture), a household keeps its front door locked: shut behind
// them as they go out, and barred at night. Anyone else at it can knock
// (whoever's in may come and open it: more likely awake than asleep), pick
// the lock (with a lockpick: the lock window), or break it down with an
// axe (loud: see Game.checkVandalism). Worked out from who's home, not
// kept: a lock picked, or a door opened to a knock, stays open a while.
import { hash4 } from '../util/rng.js';
import { buildingAt } from '../sim/sim.js';

const OPEN_FOR = 90; // world minutes a door stays unlocked once opened
const keyOf = (x, y, z) => `${x},${y},${z}`;

// Does this people lock their doors? (About two peoples in five; a city's
// folk are warier than a village's.)
export function lockingCulture(s) {
  if (!s || s.condition === 'abandoned' || s.deserted) return false;
  const k = String(s.style || (s.civ && s.civ.name) || '');
  let h = 7;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  const r = hash4(h, 0x10c7) % 100;
  return r < (s.type === 'city' ? 55 : s.type === 'town' ? 40 : 28);
}

// (Round 83) And most of the rest, though they leave the door on the
// latch by day, out or in, bar it at night: all but a few trusting
// peoples (and fewer of those in a city).
export function nightLocking(s) {
  if (lockingCulture(s)) return true;
  if (!s || s.condition === 'abandoned' || s.deserted) return false;
  const k = String(s.style || (s.civ && s.civ.name) || '');
  let h = 11;
  for (let i = 0; i < k.length; i++) h = (h * 31 + k.charCodeAt(i)) | 0;
  return hash4(h, 0x10c8) % 100 < (s.type === 'city' ? 90 : s.type === 'town' ? 80 : 65);
}

// The house a door's the front door of (and its town), or null. (`full`:
// its people keep it locked when they're out, not only at night.)
export function houseOfDoor(game, x, z) {
  const s = game.world.ow.settlementAt(x, z);
  if (!s || !nightLocking(s)) return null;
  const L = game.world.getLayout ? game.world.getLayout(s) : null;
  if (!L) return null;
  const b = buildingAt(L, x, z);
  if (!b || !b.residential || b.playerHome || !b.door || b.door.x !== x || b.door.z !== z) return null;
  return { s, L, b, full: lockingCulture(s) };
}

// Who of the household is in, and awake.
function inside(game, H) {
  const out = { awake: [], asleep: [] };
  for (const n of game.npcs) {
    if (n.dead || !n.rec || n.rec.home !== H.b.id || n.layout !== H.L) continue;
    if (n.x < H.b.x0 || n.x > H.b.x1 || n.z < H.b.z0 || n.z > H.b.z1) continue;
    (n.sleeping ? out.asleep : out.awake).push(n);
  }
  return out;
}

// (Round 76) One of the house: who lives there, or of its family, from
// the same town; their own door's never locked to them.
export function ofHouse(n, H) {
  const r = n.rec;
  if (!r) return false;
  if (r.home !== null && r.home !== undefined && String(r.home) === String(H.b.id) && (!n.layout || n.layout === H.L)) return true;
  const last = r.name && r.name.last;
  return !!(last && H.b.family && last === H.b.family && (!n.layout || n.layout === H.L));
}

// Locked to `who` (the player, or someone not of the house)?
export function doorLocked(game, x, y, z, who = game.player) {
  const H = houseOfDoor(game, x, z);
  if (!H) return false;
  if (who && who.rec && ofHouse(who, H)) return false;
  // (The watch has keys; and nobody's stopped by a lock running for their life.)
  if (who && who.rec && (who.rec.job === 'guard' || who.state === 'flee' || who.state === 'fight')) return false;
  if (who && who.kind === 'player' && game.sim.isGuest && game.sim.isGuest(H.s.id, H.b.id)) return false;
  const t = (game.doorOpenUntil || new Map()).get(keyOf(x, y, z));
  if (t !== undefined && game.sim.abs < t) return false;
  // Out, or abed: locked. In and up: it's on the latch in the day. (Most
  // peoples only bar it at night: see nightLocking.)
  const night = game.minute < 330 || game.minute >= 1260;
  if (night) return true;
  return !!H.full && inside(game, H).awake.length === 0;
}

// Opened (picked, or to a knock): unlocked a while.
export function unlockFor(game, x, y, z, mins = OPEN_FOR) {
  (game.doorOpenUntil ||= new Map()).set(keyOf(x, y, z), game.sim.abs + mins);
}

// A knock: whoever's in may come to the door.
export function knock(game, x, y, z, by = game.player) {
  const H = houseOfDoor(game, x, z);
  game.audio?.play('knock', { x, z });
  game.renderer.floatText(x, y + 2.2, z, 'knock knock', '#e8d8a0');
  if (!H) return false;
  const inn = inside(game, H);
  const who = inn.awake.length && Math.random() < 0.75 ? inn.awake[0] : inn.asleep.length && Math.random() < 0.25 ? inn.asleep[0] : null;
  if (!who) return false;
  (game.knocks ||= []).push({ x, y, z, n: who, t: 1.6 + Math.random() * 1.4, by, b: H.b });
  return true;
}

// (Round 87) Where to stand to open a door from inside: the cell beside it
// within the house, that can be stood in; null if none.
function insideOf(game, k) {
  const b = k.b;
  const w = game.world;
  for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) {
    const x = k.x + dx;
    const z = k.z + dz;
    if (b && (x < b.x0 || x > b.x1 || z < b.z0 || z > b.z1)) continue;
    if (w.canStand(x, k.y, z)) return { x, y: k.y, z };
  }
  return null;
}

// The door opened (by whoever came to it).
function openUp(game, n, a) {
  unlockFor(game, a.door.x, a.door.y, a.door.z);
  game.setDoor(a.door.x, a.door.y, a.door.z, true);
  n.face?.(a.door.x, a.door.z);
  n.say?.(n.rng.pick(a.woke ? ['Well? What is it?', 'This had better be good.'] : ['Yes? Who is it?', 'Oh! Hello there.', 'Can I help you?', 'Yes?']), 3);
}

// (Round 87) Someone going to answer the door, each frame (from their own
// update): across the house to the door, then it opened, and a moment
// there in it. True while they're about it (nothing else to do).
export function answerTick(n, dt) {
  const a = n.answer;
  if (!a) return false;
  const game = n.game;
  if (n.dead || n.down || (n.state !== 'routine' && n.state !== 'home')) {
    n.answer = null;
    return false;
  }
  a.t -= dt;
  if (a.opened) {
    a.hold -= dt;
    if (a.hold <= 0) {
      n.answer = null;
      // (Back to whatever they were about: its way worked out afresh.)
      n.path = null;
    }
    else if (a.by && !a.by.dead) n.face?.(a.by.x, a.by.z);
    return !!n.answer;
  }
  if (n.sitting) n.sitting = false;
  const there = Math.max(Math.abs(n.x - a.spot.x), Math.abs(n.z - a.spot.z)) <= 0 || n.followPath(a.spot, 0);
  // (Taking too long about it (the way's blocked): it's opened all the
  // same, whoever's nearest calling through it.)
  if (there || a.t <= 0) {
    a.opened = true;
    a.hold = 6;
    openUp(game, n, a);
  }
  return true;
}

// Each frame: whoever's coming to a knock, opening up.
export function updateKnocks(game, dt) {
  const L = game.knocks;
  if (!L || !L.length) return;
  for (const k of L) {
    k.t -= dt;
    if (k.t > 0 || k.done) continue;
    k.done = true;
    const n = k.n;
    if (!n || n.dead) continue;
    const woke = !!n.sleeping;
    if (n.sleeping) {
      if (n.wake) n.wake();
      else n.sleeping = false;
      n.say?.(n.rng.pick(['*grumbles* Who\'s there, at this hour?', 'Mmh? Coming, coming...']), 3);
    } else n.say?.(n.rng.pick(['Coming!', 'Hold on, I\'m coming.', 'Who\'s knocking?', 'Just a moment!']), 3);
    // (Round 87) Over to the door to open it, not opened from wherever
    // they were (see answerTick).
    const a = { door: { x: k.x, y: k.y, z: k.z }, spot: insideOf(game, k), t: 25, by: k.by, woke };
    if (a.spot && n.followPath) {
      n.answer = a;
      n.path = null;
    } else {
      a.opened = true;
      openUp(game, n, a);
    }
  }
  game.knocks = L.filter((k) => !k.done);
}
