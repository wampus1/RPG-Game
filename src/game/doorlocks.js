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

// The house a door's the front door of (and its town), or null.
export function houseOfDoor(game, x, z) {
  const s = game.world.ow.settlementAt(x, z);
  if (!s || !lockingCulture(s)) return null;
  const L = game.world.getLayout ? game.world.getLayout(s) : null;
  if (!L) return null;
  const b = buildingAt(L, x, z);
  if (!b || !b.residential || b.playerHome || !b.door || b.door.x !== x || b.door.z !== z) return null;
  return { s, L, b };
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

// Locked to `who` (the player, or someone not of the house)?
export function doorLocked(game, x, y, z, who = game.player) {
  const H = houseOfDoor(game, x, z);
  if (!H) return false;
  if (who && who.rec && who.rec.home === H.b.id) return false;
  // (The watch has keys; and nobody's stopped by a lock running for their life.)
  if (who && who.rec && (who.rec.job === 'guard' || who.state === 'flee' || who.state === 'fight')) return false;
  if (who && who.kind === 'player' && game.sim.isGuest && game.sim.isGuest(H.s.id, H.b.id)) return false;
  const t = (game.doorOpenUntil || new Map()).get(keyOf(x, y, z));
  if (t !== undefined && game.sim.abs < t) return false;
  // Out, or abed: locked. In and up: it's on the latch in the day.
  const inn = inside(game, H);
  const night = game.minute < 330 || game.minute >= 1260;
  return night || inn.awake.length === 0;
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
  (game.knocks ||= []).push({ x, y, z, n: who, t: 1.6 + Math.random() * 1.4, by });
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
    if (n.sleeping) {
      n.sleeping = false;
      n.say?.(n.rng.pick(['*grumbles* Who\'s there, at this hour?', 'Mmh? Coming, coming...']), 3);
    } else n.say?.(n.rng.pick(['Yes? Who is it?', 'Coming!', 'Hold on, I\'m coming.', 'Who\'s knocking?']), 3);
    unlockFor(game, k.x, k.y, k.z);
    game.setDoor(k.x, k.y, k.z, true);
    n.face?.(k.x, k.z);
  }
  game.knocks = L.filter((k) => !k.done);
}
