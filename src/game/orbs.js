// A witch-light: a slow ball of grave-fire let go across a master's hall
// (the Mound Witch's, whole or worn: see bosses.moundWitch). It drifts
// at you and keeps going, glancing off the walls (and its hall's edge)
// wherever it meets them, for seven seconds, and then it's gone. Touch it
// and it burns; but swing a blow through it, or hold your guard up into
// it, and it's knocked back the way it came, faster, at whoever let it go
// (and it's yours then: it can't hurt you). Drawn by render/orbfx.js.
import { BLOCKS } from '../world/blocks.js';
import { facing, parryWindow } from './combat.js';

export const ORB_LIFE = 7;
// Paces a second: slower than you walk; and knocked back.
export const ORB_SPEED = 2.6;
export const ORB_BACK = 5.5;
// A moment gathering in her hand before it goes.
export const ORB_RISE = 0.45;
// How near counts as touching it; and how far a blow reaches for it.
const TOUCH = 0.6;
const SWAT = 1.75;
const DIRS = [[0, 1], [-1, 0], [0, -1], [1, 0]];

// One let go by `by` at `at`.
export function launchOrb(game, by, at, opts = {}) {
  const ang = Math.atan2(at.z - by.z, at.x - by.x) + (opts.spread || 0);
  const ux = Math.cos(ang);
  const uz = Math.sin(ang);
  const o = {
    by, y: by.y, x: by.x + ux * 0.55, z: by.z + uz * 0.55,
    vx: ux * (opts.speed || ORB_SPEED), vz: uz * (opts.speed || ORB_SPEED),
    t: 0, life: opts.life || ORB_LIFE, dmg: opts.dmg || 4,
    color: opts.color || [160, 255, 112], back: false, trail: [],
  };
  (game.orbs ||= []).push(o);
  game.audio?.play('orb', by);
  return o;
}

// Each frame.
export function updateOrbs(game, dt) {
  const list = game.orbs;
  if (!list || !list.length) return;
  for (const o of list) {
    if (o.done) continue;
    o.t += dt;
    // (Gone when its time's up, or with whoever let it go.)
    if (o.t >= o.life || !o.by || o.by.dead) {
      fizzle(game, o);
      continue;
    }
    if (o.t < ORB_RISE) {
      touch(game, o);
      continue;
    }
    // A few short steps a frame, so it never slips through a corner.
    const n = Math.max(1, Math.ceil((Math.hypot(o.vx, o.vz) * dt) / 0.2));
    for (let i = 0; i < n && !o.done; i++) {
      step(game, o, dt / n);
      touch(game, o);
    }
    o.trail.push({ x: o.x, z: o.z });
    if (o.trail.length > 7) o.trail.shift();
  }
  game.orbs = list.filter((o) => !o.done);
}

// Is (x, z) a wall to it: solid there (or at head height), or past the
// edge of its hall?
function wall(game, o, x, z) {
  const tx = Math.round(x);
  const tz = Math.round(z);
  const L = o.by && o.by.leash;
  if (L && (tx < L.x0 || tx > L.x1 || tz < L.z0 || tz > L.z1)) return true;
  const w = game.world;
  if (w.regionAt && !w.regionAt(tx, tz)) return true;
  return !!(BLOCKS[w.getBlock(tx, o.y, tz)]?.solid || BLOCKS[w.getBlock(tx, o.y + 1, tz)]?.solid);
}

// On a little: glancing off whatever wall it meets (one way at a time, so
// it comes off a corner as it should).
function step(game, o, dt) {
  const R = 0.3;
  let hit = false;
  const nx = o.x + o.vx * dt;
  if (wall(game, o, nx + Math.sign(o.vx) * R, o.z)) {
    o.vx = -o.vx;
    hit = true;
  } else o.x = nx;
  const nz = o.z + o.vz * dt;
  if (wall(game, o, o.x, nz + Math.sign(o.vz) * R)) {
    o.vz = -o.vz;
    hit = true;
  } else o.z = nz;
  if (!hit) return;
  o.bounces = (o.bounces || 0) + 1;
  const [r, g, b] = o.back ? [255, 224, 112] : o.color;
  game.renderer.emit(o.x, o.y + 0.8, o.z, { n: 5, color: [`rgb(${r},${g},${b})`, '#ffffff'], up: 14, speed: 34, life: 0.3, glow: true });
  game.audio?.play('orbBounce', o);
}

// Whoever it's touching (the first of you it finds).
function touch(game, o) {
  if (o.back) return touchFoe(game, o);
  for (const p of game.everyone()) {
    if (!p || p.dead || p.down || Math.abs(p.y - o.y) > 1) continue;
    const at = p.renderPos ? p.renderPos() : p;
    if (Math.hypot(at.x - o.x, at.z - o.z) > TOUCH) continue;
    // (Rolled through it.)
    if (p.rollT > 0) {
      if (!o.rolled) game.renderer.floatText(p.x, p.y + 2, p.z, 'dodged', '#c8e8ff');
      o.rolled = true;
      continue;
    }
    // Guard up, toward it: knocked back (a parry if it was only just up).
    if (p.blocking && facing(p, o)) {
      p.shieldJolt = 0.18;
      const quick = game.asPlayer ? game.asPlayer(p, () => p.blockT !== undefined && p.blockT < parryWindow(game)) : p.blockT < parryWindow(game);
      knockBack(game, o, p, quick ? 'parry' : 'block');
      return;
    }
    if (o.t < ORB_RISE) continue;
    game.damage(p, o.dmg, o.by);
    burst(game, o);
    return;
  }
}

// Knocked back: whoever's against you that it runs into (its maker most
// of all).
function touchFoe(game, o) {
  for (const c of game.creatures) {
    if (c.dead || c.burrowed || Math.abs(c.y - o.y) > 1) continue;
    if (c !== o.by && !(c.S && (c.S.mode === 'hostile' || c.hostileNow))) continue;
    const at = c.renderPos ? c.renderPos() : c;
    // (A master's bulk counts: see footprint.)
    const r = TOUCH + (c.foot || 0) + (c.isBoss && c.S?.humanoid ? (c.S.pad || 0.85) - 0.45 : 0);
    if (Math.max(Math.abs(at.x - o.x), Math.abs(at.z - o.z)) > r) continue;
    game.damage(c, o.backDmg, o.backBy || game.player);
    if (c === o.by && !c.dead) {
      c.stunT = Math.max(c.stunT || 0, 0.8);
      game.renderer.floatText(c.x, c.y + 2.8, c.z, 'her own light!', '#ffe070');
    }
    burst(game, o);
    return;
  }
}

// Knocked back at whoever let it go (straight back the way it came, if
// they're gone), by `how`: 'swing', 'block' or 'parry'.
export function knockBack(game, o, p, how) {
  const src = o.by && !o.by.dead ? o.by : null;
  const to = src ? (src.renderPos ? src.renderPos() : src) : null;
  const ang = to ? Math.atan2(to.z - o.z, to.x - o.x) : Math.atan2(-o.vz, -o.vx);
  const sp = ORB_BACK * (how === 'parry' ? 1.25 : 1);
  o.vx = Math.cos(ang) * sp;
  o.vz = Math.sin(ang) * sp;
  o.back = true;
  o.backBy = p;
  o.backDmg = Math.max(6, o.dmg * (how === 'parry' ? 3 : 2));
  o.t = Math.max(o.t, ORB_RISE);
  // (Out of your reach first, so it isn't on you the same moment.)
  o.x += Math.cos(ang) * 0.25;
  o.z += Math.sin(ang) * 0.25;
  const r = game.renderer;
  r.emit(o.x, o.y + 0.8, o.z, { n: 14, color: ['#ffffff', '#ffe070', '#a0ff70'], up: 30, speed: 70, life: 0.35, glow: true });
  r.effect?.({ type: 'ring', wx: o.x, wy: o.y, wz: o.z, r0: 2, r1: 14, color: '#ffe070', life: 0.3, oy: -10, flat: 0.55, thick: 1 });
  r.floatText(p.x, p.y + 2.5, p.z, how === 'parry' ? 'PARRIED BACK!' : 'deflected!', '#ffe070');
  game.audio?.play(how === 'parry' ? 'parry' : 'reflect', p);
  game.hitStop = Math.max(game.hitStop || 0, how === 'parry' ? 0.1 : 0.05);
  game.shake = Math.min(1.2, (game.shake || 0) + (how === 'parry' ? 0.35 : 0.15));
}

// A blow swung (by you) toward (dx, dz) (the way you face, if not given):
// any witch-light in its reach that way is knocked back. True if one was.
export function swatOrbs(game, p, dx, dz, reach = 1) {
  if (!game.orbs || !game.orbs.length) return false;
  if (dx === undefined || (!dx && !dz)) {
    const ang = game.aimAngle ? game.aimAngle() : null;
    if (ang !== null) [dx, dz] = [Math.cos(ang), Math.sin(ang)];
    else [dx, dz] = DIRS[p.dir] || [0, 1];
  }
  const len = Math.hypot(dx, dz) || 1;
  const at = p.renderPos ? p.renderPos() : p;
  const far = SWAT + Math.max(0, reach - 1);
  let any = false;
  for (const o of game.orbs) {
    if (o.done || o.back || Math.abs(o.y - p.y) > 1) continue;
    const vx = o.x - at.x;
    const vz = o.z - at.z;
    const d = Math.hypot(vx, vz);
    if (d > far) continue;
    // (Right on you, any blow finds it; further off, only one swung its way.)
    if (d > 0.7 && (vx * dx + vz * dz) / (len * d) < 0.35) continue;
    knockBack(game, o, p, 'swing');
    any = true;
  }
  return any;
}

// It bursts on whoever it touched.
function burst(game, o) {
  o.done = true;
  const [r, g, b] = o.back ? [255, 224, 112] : o.color;
  const col = `rgb(${r},${g},${b})`;
  game.renderer.emit(o.x, o.y + 0.8, o.z, { n: 18, color: [col, '#ffffff'], up: 34, speed: 60, life: 0.45, glow: true });
  game.renderer.effect?.({ type: 'ring', wx: o.x, wy: o.y, wz: o.z, r0: 2, r1: 18, color: [col, '#ffffff'], life: 0.35, oy: 2, flat: 0.5, thick: 2 });
  game.audio?.play('void', o);
}

// Its time up: it gutters out.
function fizzle(game, o) {
  o.done = true;
  const [r, g, b] = o.back ? [255, 224, 112] : o.color;
  game.renderer.emit(o.x, o.y + 0.8, o.z, { n: 8, color: [`rgb(${r},${g},${b})`, '#d0e0d8'], up: 16, speed: 14, gravity: -16, life: 0.6, glow: true });
}

// All of them gone at once (a floor left, a fight over).
export function clearOrbs(game) {
  game.orbs = [];
}
