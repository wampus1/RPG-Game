// A master's tier (round 61): how hard the turn of time has made it. Every
// master of every old place stands at tier 1 when the world's made; a
// place turned back with a time crystal (see game/timecrystal.js) comes
// back at a higher one, its master with it:
//   tier 2: more of it to get through, harder blows, quicker works, a
//     shorter moment to parry it in, now and then one attack straight
//     into the next, and one work of the turned time's own;
//   tier 3: three times the health it had, half again as hard and as
//     quick, the parry tighter still, its attacks run together, a fourth
//     phase at the very last (unbound: see tempo.js), and both of the
//     turned time's works: rings of it spreading out from it, and your own
//     steps coming back at you.
// The works take the master's own colour and its own kind of harm: fire
// for the hot ones, frost for the cold, a blow for the rest.
import { addHazard, areaTiles } from './monsters.js';
import { ringTiles, inHall, openFloor, dmgOf, proc, shout, cd } from './bosskit.js';
import { ready, used, phaseOf } from './tempo.js';
import { bossTint } from '../render/bossart.js';

export const TIER_MAX = 3;
export const TIERS = {
  1: { hp: 1, dmg: 1, speed: 1, parry: 1, extra: 0, combo: 0, phase4: false },
  2: { hp: 1.75, dmg: 1.2, speed: 1.2, parry: 0.85, extra: 1, combo: 0.15, phase4: false },
  3: { hp: 3, dmg: 1.5, speed: 1.5, parry: 0.7, extra: 2, combo: 0.4, phase4: true },
};
// Its fourth phase (tier 3): this share of its health left.
export const PHASE4 = 0.15;

export const tierOf = (n) => TIERS[Math.max(1, Math.min(TIER_MAX, n || 1))];
export const roman = (n) => ['', 'I', 'II', 'III', 'IV'][n] || String(n);

// Made what its tier makes it (on top of what its place and island do).
export function applyTier(c, tier) {
  const t = Math.max(1, Math.min(TIER_MAX, tier || 1));
  const T = TIERS[t];
  c.tier = t;
  if (t === 1) return c;
  c.maxHp = c.hp = Math.round(c.maxHp * T.hp);
  c.dmgMult = (c.dmgMult || 1) * T.dmg;
  c.tempo = (c.tempo || 1) * T.speed;
  c.parryK = T.parry;
  return c;
}

// What kind of harm its works do: as hot, as cold, or a blow.
const COLD = /barrow|crypt|frost|ice|wraith|saint|shade|drown|hollow|condenser|clam|lamprey/;
function element(c) {
  if (c.S.fireproof || /cinder|slag|ember|forge|crucible|drake|bellows|lava|magma/.test(c.species)) return 'fire';
  if (COLD.test(c.species)) return 'cold';
  return 'force';
}
function hexRgb(h) {
  const s = String(h || '#ffe070').replace('#', '');
  return [parseInt(s.slice(0, 2), 16) || 255, parseInt(s.slice(2, 4), 16) || 224, parseInt(s.slice(4, 6), 16) || 112];
}
function harm(c, n) {
  const el = element(c);
  const o = { dmg: dmgOf(c, n), color: hexRgb(bossTint(c)[0]) };
  if (el === 'fire') o.burn = 2;
  else if (el === 'cold') o.chill = 2;
  else o.knock = 1;
  return o;
}
const foesOf = (c) => c.game.everyone().filter((p) => p && !p.dead && !p.down && inHall(c, p) && Math.abs(p.y - c.y) <= 2);

// Rings of the turned time spreading out from it, one after another, each
// with a gap in it to step into (never the same side twice running).
export function chronoRings(c) {
  const game = c.game;
  const t = c.target;
  if (!t) return false;
  const ph = phaseOf(c);
  const base = (c.foot || 0) + 2;
  const rings = ph >= 4 ? 4 : 3;
  const tint = bossTint(c);
  game.renderer.floatText(c.x, c.y + 3.4, c.z, 'TIME RIPPLES', tint[0]);
  shout(c, c.S.construct ? 'TEMPORAL DISCHARGE.' : 'Feel the years turn!', tint[0]);
  game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 4, r1: 40, color: [tint[0], '#ffffff'], life: 0.6, oy: 4, flat: 0.5, thick: 2 });
  game.audio?.play('pulse', c);
  let gapA = Math.atan2(t.z - c.z, t.x - c.x) + Math.PI * (0.5 + Math.random());
  proc(game, c, 0.55, rings, (k) => {
    const r = base + k * 2;
    gapA += Math.PI * (0.6 + Math.random() * 0.8);
    const tiles = ringTiles(c.x, c.z, r).filter((q) => {
      if (!inHall(c, q) || !openFloor(game, q.x, q.z, true)) return false;
      // (The gap: a few paces of the ring left clear.)
      let d = Math.atan2(q.z - c.z, q.x - c.x) - gapA;
      d = Math.atan2(Math.sin(d), Math.cos(d));
      return Math.abs(d) * r > 1.6;
    });
    if (!tiles.length) return;
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.85, kind: 'burst', center: { x: c.x, z: c.z }, from: { x: c.x, z: c.z + 0.001 }, quiet: k > 0, ...harm(c, 5) });
  });
  return true;
}

// Your own steps coming back at you: where you've been these last moments,
// each spot bursting in turn, as you went.
export function echoSteps(c) {
  const game = c.game;
  const t = c.target;
  if (!t) return false;
  const ph = phaseOf(c);
  const R = ph >= 4 ? 1 : 0;
  const tint = bossTint(c);
  game.renderer.floatText(t.x, t.y + 2.8, t.z, 'your past catches up!', tint[0]);
  shout(c, c.S.construct ? 'REPLAYING YOUR PATH.' : 'Every step you took... comes back!', tint[0]);
  game.audio?.play('whisper', c);
  // (Marked as you go: six, half a second apart; then each goes off, in
  // the order you made them.)
  const marks = [];
  proc(game, c, 0.45, 6, () => {
    for (const p of foesOf(c)) {
      const at = { x: p.x, z: p.z };
      marks.push(at);
      game.renderer.emit(at.x, c.y + 0.2, at.z, { n: 6, color: [tint[0], '#ffffff'], up: 12, speed: 6, life: 0.9, glow: true, gravity: -6 });
      addHazard(game, { by: c, tiles: areaTiles(at.x, at.z, R).filter((q) => inHall(c, q)), y: c.y, dur: 1.4, kind: 'burst', center: at, quiet: true, ...harm(c, 4) });
    }
  });
  return true;
}

// Each update of a master above tier 1 (before its own way of fighting):
// the turned time's works, when they come round. True if it did one.
export function tierTick(c, dt) {
  const T = tierOf(c.tier);
  if (!T.extra || !c.target || c.target.dead || c.windup || !ready(c)) return false;
  const ph = phaseOf(c);
  const quick = ph >= 4 ? 0.6 : 1;
  if (cd(c, 'ringsCd', dt, 6) && T.extra >= 1) {
    c.ringsCd = (ph >= 3 ? 9 : 12) * quick;
    if (chronoRings(c)) {
      used(c, 0.8);
      return true;
    }
    c.ringsCd = 2;
  }
  if (T.extra >= 2 && cd(c, 'echoCd', dt, 9)) {
    c.echoCd = (ph >= 3 ? 10 : 13) * quick;
    if (echoSteps(c)) {
      used(c, 0.6);
      return true;
    }
    c.echoCd = 2;
  }
  return false;
}

// What it cries going into its fourth phase.
export const UNBOUND_LINES = ['No more turning back!', 'Time is MINE!', 'I have died before. Not again!', 'Again, and again, and AGAIN!'];
export const UNBOUND_CONSTRUCT = ['TEMPORAL LIMITERS: REMOVED.', 'LOOP DETECTED. BREAKING LOOP.', 'ALL CYCLES. ALL AT ONCE.'];

// The colour of each tier's time crystal (see world/items.js).
export const CRYSTAL_COLORS = ['', '#9ad8ff', '#c8a0ff', '#ffd070'];
