// (Round 71) The evolved masters: four things older than the old places,
// each in an ancient place of its own on the two great continents (see
// world/ancient.js), each twice the size of any other master (see
// render/forge_evolved.js), each with a dozen ways of killing you and four
// or five phases to the fight (more of what it has coming out at each),
// and each, the first time it should die, refusing to: it rises again,
// healed, with a last terrible work it held back and no patience left
// (see rise). Their music the darkest there is, climbing with every phase
// (see game/music.js).
//   The Divine Alchemist (evolved_alchemist.js), the Rift Crawler
//   (evolved_rift.js), the Hero (evolved_hero.js), the Alinelidan
//   (evolved_worm.js).
// What they share: their phases and their pace, the way their works are
// chosen (evoFight), grabbing you and throwing you, things that bounce
// about the hall (bouncers), and their rising.
import { addHazard, areaTiles } from './monsters.js';
import { knock } from '../game/combat.js';
import { chill } from '../game/gems.js';
import { evoPhase, ready, used } from './tempo.js';
import { FY, dist, hallOf, openFloor, cd, shout } from './bosskit.js';
import { cue } from './cue.js';

const TAU = Math.PI * 2;
export { evoPhase };
export const isEvolved = (c) => !!(c && c.S && c.S.evolved);
const ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI'];

// How much quicker its works come round: a little each phase, and much
// once it's risen.
export function evoPace(c) {
  const ph = evoPhase(c);
  return (1 - 0.08 * (Math.min(ph, c.S.phases || 4) - 1)) * (c.enraged ? 0.62 : 1);
}

// Its works in order of preference: [key, first, every, fn(c, t, game, o),
// o]. `o.ph` not before this phase; `o.max`/`o.min` how far you may be;
// `o.rest` a breath after it; `o.say` its words; `o.enraged` only once
// it's risen. The first that's ready and does something goes off.
export function evoFight(c, dt, list) {
  const game = c.game;
  const t = c.target;
  if (!t || t.dead || c.windup || c.riseT > 0 || c.act) return false;
  const ph = evoPhase(c);
  const d = dist(c, t);
  const k = evoPace(c);
  for (const [key, first, every, fn, o = {}] of list) {
    if (o.ph && ph < o.ph) continue;
    if (o.enraged && !c.enraged) continue;
    if (o.when && !o.when(c, t)) continue;
    if (!cd(c, key, dt / Math.max(0.3, k), first)) continue;
    if (!ready(c)) continue;
    if (d < (o.min ?? 0) || d > (o.max ?? 30)) continue;
    if (!fn(c, t, game, o)) {
      c[key] = 0.6;
      continue;
    }
    c[key] = every;
    used(c, o.rest || 0);
    if (o.say) shout(c, Array.isArray(o.say) ? o.say[Math.floor(Math.random() * o.say.length)] : o.say, o.sayColor || c.S.sayColor || '#ffe0a0', 2.4);
    if (o.sound) game.audio?.play(o.sound, c);
    return true;
  }
  return false;
}

// ------------------------------------------------------------ phases
// Every moment of the fight: the bar's title (its phase), and the time it
// spends rising (nothing touches it, nothing comes from it).
export function evoTick(c, dt) {
  const game = c.game;
  if (c.riseT > 0) {
    c.riseT -= dt;
    c.windup = null;
    if (Math.random() < dt * 30) game.renderer.emit(c.x + (Math.random() - 0.5) * 4, c.y + Math.random() * 3, c.z + (Math.random() - 0.5) * 4, { n: 2, color: c.S.tint || ['#ffffff'], up: 40, speed: 30, life: 0.8, glow: true, gravity: -40 });
    if (c.riseT <= 0) risen(c);
  }
  const f = game.dungeon && game.dungeon.fight;
  if (f && f.boss && f.boss[0] === c) {
    const ph = evoPhase(c);
    const N = c.S.phases || 4;
    f.baseTitle ??= f.title;
    f.title = `${f.baseTitle ? `${f.baseTitle} · ` : ''}${c.enraged ? 'UNDYING' : `Phase ${ROMAN[ph]} of ${ROMAN[N]}`}`;
    f.evo = c.enraged ? N + 1 : ph;
  }
}

// What it says as it turns (see tempo.phaseUp), and the line it rises
// with.
export function evoLine(c, ph) {
  const L = c.S.phaseLines || [];
  return L[ph] || '';
}

// ------------------------------------------------------------ its rising
// The first time it should die, it doesn't: the blow that would have
// killed it leaves it on one knee (or its eye shut, or coiled up) and
// burning with its own light; everyone near is thrown back; and a breath
// later it rises again, healed by half and more, with the work it held
// back for this and no patience left. True if it rose (the blow's spent).
export function rise(game, c) {
  if (!isEvolved(c) || c.enraged || c.dead) return false;
  c.enraged = true;
  c.hp = Math.round(c.maxHp * (c.S.riseHp ?? 0.6));
  c.riseT = 3.2;
  c.windup = null;
  c.act = null;
  c.gapT = 3.4;
  c.flash = 0.5;
  // (Its works start over, the worst of them first.)
  for (const k of Object.keys(c)) if (k.endsWith('Cd') && typeof c[k] === 'number') c[k] = Math.min(c[k], 2 + Math.random() * 3);
  if (c.S.onRise) c.S.onRise(c, game);
  const r = game.renderer;
  const tint = c.S.tint || ['#ffffff', '#ffffff'];
  cue(c, 'roar');
  r.flashScreen?.('#ffffff', 0.6);
  game.shake = 1.6;
  game.hitStop = Math.max(game.hitStop || 0, 0.25);
  game.audio?.play('roar', c);
  game.audio?.play('boom', c);
  game.audio?.play('sting');
  for (let i = 0; i < 4; i++) r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 6 + i * 6, r1: 160 + i * 40, color: [tint[0], '#ffffff', tint[1] || tint[0]], life: 0.9 + i * 0.3, oy: 4, flat: 0.5, thick: 3 });
  r.emit(c.x, c.y + 1.5, c.z, { n: 80, color: [...tint, '#ffffff'], up: 80, speed: 140, life: 1.2, glow: true, gravity: 30 });
  r.floatText(c.x, c.y + 4.4, c.z, 'IT WILL NOT DIE', '#ff5040');
  shout(c, c.S.riseLine || 'NOT. YET.', '#ff6050', 3.4);
  for (const e of [...game.everyone(), ...game.npcs]) {
    if (!e || e.dead || dist(c, e) > 7 || Math.abs(e.y - c.y) > 1) continue;
    knock(game, c, e, 3);
  }
  // (Everyone down here sees it.)
  const run = game.dungeon;
  const each = run && run.eachHere ? (fn) => run.eachHere(fn) : (fn) => fn();
  each(() => {
    game.ui.msg(`${c.S.name} rises again, burning with its own light! It holds nothing back now!`, '#ff7060', true);
    if (!game.scene) game.scene = riseScene(game, c);
  });
  return true;
}
// Risen: on its feet, the fight quickened, its last work ready.
function risen(c) {
  const game = c.game;
  c.riseT = 0;
  c.gapT = 0.4;
  game.renderer.flashScreen?.('#ff2010', 0.35);
  game.shake = Math.min(1.6, (game.shake || 0) + 1);
  game.audio?.play('roar', c);
  cue(c, 'roar');
}

// The camera on it as it rises (a second and a half, everything slowed).
function riseScene(game, c) {
  const p = game.player;
  const lerp = (a, b, k) => a + (b - a) * k;
  const ease = (k) => k * k * (3 - 2 * k);
  const cl = (k) => (k < 0 ? 0 : k > 1 ? 1 : k);
  return {
    kind: 'evo_rise', t: 0, dur: 2.8, lock: true,
    get mood() {
      const run = game.dungeon;
      return run ? `dungeon_${run.rec.type}_boss:p${(c.S.phases || 4) + 1}` : null;
    },
    timeScale(t) {
      return t < 1.2 ? 0.35 : 1;
    },
    get zoom() {
      return 1 - 0.25 * ease(cl(this.t / 0.6)) * (1 - ease(cl((this.t - 2.1) / 0.7)));
    },
    focus() {
      const k = ease(cl(this.t / 0.5)) * (1 - ease(cl((this.t - 2.1) / 0.7)));
      const lr = c.renderPos ? c.renderPos() : c;
      return { x: lerp(p.x, lr.x, k), y: lerp(p.y, lr.y, k), z: lerp(p.z, lr.z, k) };
    },
    update(g) {
      if (Math.random() < 0.6) g.renderer.emit(c.x + (Math.random() - 0.5) * 3, c.y + 0.5, c.z + (Math.random() - 0.5) * 3, { n: 2, color: c.S.tint || ['#ffffff'], up: 70, speed: 30, life: 1, glow: true, gravity: -60 });
    },
    draw(ctx) {
      const W = ctx.canvas.width;
      const H = ctx.canvas.height;
      const k = Math.min(1, this.t / 0.4) * Math.min(1, (this.dur - this.t) / 0.5);
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, W, Math.round(H * 0.1 * k));
      ctx.fillRect(0, H - Math.round(H * 0.1 * k), W, Math.round(H * 0.1 * k));
    },
  };
}

// ------------------------------------------------------------ hands on you
// Held fast by it (`secs`): no walking, no rolling free.
export function grab(game, c, e, secs = 1.4) {
  if (!e || e.dead) return false;
  if (e.kind === 'player') {
    e.grabbedT = Math.max(e.grabbedT || 0, secs);
    e.swing = null;
    e.blocking = false;
  } else e.stunT = Math.max(e.stunT || 0, secs);
  e.heldBy = c;
  e.heldT = secs;
  game.renderer.floatText(e.x, e.y + 2.4, e.z, 'GRABBED', '#ffb070');
  return true;
}
// Let go (thrown `n` paces from `from`, if given).
export function release(game, c, e, from = null, n = 0) {
  if (!e) return;
  e.grabbedT = 0;
  e.heldBy = null;
  e.heldT = 0;
  if (from && n) knock(game, from, e, n);
}
// Thrown: `n` paces away from `from` (or toward `to`), and if a wall
// stops it short, the wall hurts.
export function fling(game, c, e, toward, n, dmg) {
  if (!e || e.dead) return;
  const sx = Math.sign(toward.x - e.x);
  const sz = Math.sign(toward.z - e.z);
  let x = e.x;
  let z = e.z;
  let y = e.y;
  let flew = 0;
  for (let i = 0; i < n; i++) {
    const nx = x + sx;
    const nz = z + sz;
    const ny = game.world.stepTarget(x, y, z, nx, nz, false);
    if (ny < 0 || game.occupiedBySolid(nx, ny, nz, e)) break;
    x = nx;
    z = nz;
    y = ny;
    flew++;
  }
  e.grabbedT = 0;
  e.heldBy = null;
  if (flew) e.startMove ? e.startMove(x, y, z, 0.06 * flew + 0.1) : null;
  const short = flew < n;
  game.renderer.emit(x, y + 1, z, { n: 10, color: ['#ffffff', '#c8c8c8'], up: 20, speed: 50, life: 0.5 });
  if (short) {
    // (Slammed into the wall.)
    game.shake = Math.min(1.5, (game.shake || 0) + 0.7);
    game.audio?.play('thud', e);
    game.renderer.floatText(x, y + 2.6, z, 'SLAMMED!', '#ff8060');
    if (dmg) game.damage(e, Math.round(dmg * 1.4), c);
  } else if (dmg) game.damage(e, dmg, c);
}

// ------------------------------------------------------------ bouncers
// Things loose in the hall bouncing off its walls (the Rift Crawler's void
// balls, what the Alinelidan spits about inside its coils): each moving in
// a straight line at `v` paces a second, turned back by any wall (or, if
// it has one, by the ring it's kept in), hurting and slowing whoever it
// runs into (and spent by it), and gone in its time.
export function addBouncer(game, b) {
  b.t = 0;
  b.hitT = 0;
  (game.bouncers ||= []).push(b);
  return b;
}
export function updateBouncers(game, dt) {
  const L = game.bouncers;
  if (!L || !L.length) return;
  const blocked = (x, z, b) => {
    const tx = Math.round(x);
    const tz = Math.round(z);
    if (b.ring && Math.hypot(x - b.ring.x, z - b.ring.z) > b.ring.r) return true;
    return !openFloor(game, tx, tz, true);
  };
  for (const b of L) {
    b.t += dt;
    if (b.by && b.by.dead) b.done = true;
    if (b.t > b.life) b.done = true;
    if (b.done) continue;
    const steps = Math.max(1, Math.ceil(b.v * dt * 4));
    for (let s = 0; s < steps; s++) {
      const nx = b.x + (b.vx * b.v * dt) / steps;
      const nz = b.z + (b.vz * b.v * dt) / steps;
      if (blocked(nx, b.z, b)) {
        b.vx = -b.vx;
        b.bounces = (b.bounces || 0) + 1;
        if (b.onBounce) b.onBounce(game, b);
      } else b.x = nx;
      if (blocked(b.x, nz, b)) {
        b.vz = -b.vz;
        b.bounces = (b.bounces || 0) + 1;
        if (b.onBounce) b.onBounce(game, b);
      } else b.z = nz;
    }
    if (b.hitT > 0) {
      b.hitT -= dt;
      continue;
    }
    for (const e of game.everyone()) {
      if (!e || e.dead || Math.abs(e.y - (b.y ?? FY)) > 1.5) continue;
      if (Math.hypot(e.x - b.x, e.z - b.z) > (b.r || 0.7)) continue;
      if (e.rollT > 0) {
        game.renderer.floatText(e.x, e.y + 2, e.z, 'dodged', '#c8e8ff');
        b.hitT = 0.5;
        continue;
      }
      game.damage(e, b.dmg, b.by || null);
      if (b.slow) chill(e, b.slow);
      if (b.onHit) b.onHit(game, b, e);
      game.renderer.emit(b.x, (b.y ?? FY) + 1, b.z, { n: 10, color: b.color || ['#c8a0ff', '#ffffff'], up: 20, speed: 40, life: 0.4, glow: true });
      if (b.spent !== false) b.done = true;
      b.hitT = 0.6;
      break;
    }
  }
  game.bouncers = L.filter((b) => !b.done);
}
// A bouncer set off from `at` toward `t` (or at an angle).
export function bounceAt(game, c, at, toward, o = {}) {
  const a = toward ? Math.atan2(toward.z - at.z, toward.x - at.x) + (o.spread || 0) : (o.ang ?? Math.random() * TAU);
  return addBouncer(game, { by: c, x: at.x, z: at.z, y: c.y, vx: Math.cos(a), vz: Math.sin(a), v: o.v || 5, life: o.life || 7, dmg: o.dmg || 4, slow: o.slow, r: o.r || 0.7, color: o.color, kind: o.kind || 'void', ring: o.ring || null, spent: o.spent, onHit: o.onHit, onBounce: o.onBounce });
}

// ------------------------------------------------------------ the hall
// A free spot in its hall far from `from` (null if none).
export function farSpot(c, from, lo = 6) {
  const L = hallOf(c);
  const game = c.game;
  for (let i = 0; i < 60; i++) {
    const x = L.x0 + 2 + Math.floor(Math.random() * Math.max(1, L.x1 - L.x0 - 3));
    const z = L.z0 + 2 + Math.floor(Math.random() * Math.max(1, L.z1 - L.z0 - 3));
    if (!openFloor(game, x, z)) continue;
    if (Math.max(Math.abs(x - from.x), Math.abs(z - from.z)) < lo) continue;
    return { x, y: FY, z };
  }
  return null;
}
// A ring of hazard tiles round `at` out to `r`, `dur` to come (`o` as
// addHazard's).
export function burstAt(game, c, at, r, o) {
  return addHazard(game, { by: c, tiles: areaTiles(at.x, at.z, r, true), y: c.y, center: { x: at.x, z: at.z }, radius: r, ...o });
}
// Everyone it might go for in its hall (you, the others, anyone with you).
export function preyIn(c) {
  const game = c.game;
  return [...game.everyone(), ...game.npcs].filter((e) => e && !e.dead && dist(c, e) < 24 && Math.abs(e.y - c.y) <= 2);
}
export { TAU };

// ------------------------------------------------------------ rifts
// A pair of rifts in the air (`a`, `b`), each the way into the other:
// whoever steps into one comes out of the other, and can't go back
// through for a moment. `o.life` seconds (Infinity: a place's own: see
// game/ancient.js); `o.by` whoever cut it (the Rift Crawler goes through
// its own; nothing else as big fits).
export function addRift(game, a, b, o = {}) {
  const R = { a: { x: a.x, z: a.z }, b: { x: b.x, z: b.z }, t: 0, life: o.life ?? 10, by: o.by || null, y: o.y ?? FY, run: o.run || null, open: o.open ?? 0, cd: new Map(), hue: o.hue || 'void' };
  (game.rifts ||= []).push(R);
  game.audio?.play('portal', a);
  return R;
}
// Which end of `R` `e` stands in (null if neither).
export function riftEnd(R, e) {
  const r = (e && e.foot) || 0;
  for (const [at, to] of [[R.a, R.b], [R.b, R.a]]) if (Math.abs(e.x - at.x) <= r && Math.abs(e.z - at.z) <= r) return { at, to };
  return null;
}
export function updateRifts(game, dt) {
  const L = game.rifts;
  if (!L || !L.length) return;
  const all = [...game.everyone(), ...game.npcs, ...game.creatures];
  for (const R of L) {
    R.t += dt;
    R.open = Math.min(1, R.open + dt * 2.5);
    if (R.t > R.life || (R.by && R.by.dead && R.life !== Infinity)) R.done = true;
    if (R.done) continue;
    // (Closing, its last half second: nothing more goes through.)
    if (R.life - R.t < 0.5) continue;
    for (const [e, k] of R.cd) if (k - dt <= 0) R.cd.delete(e);
    else R.cd.set(e, k - dt);
    if (R.open < 1) continue;
    for (const e of all) {
      if (!e || e.dead || e.moving || R.cd.has(e) || Math.abs(e.y - R.y) > 1 || e.anchored || e.heldBy) continue;
      if (e.foot && e !== R.by) continue;
      const end = riftEnd(R, e);
      if (end) riftThrough(game, R, e, end.at, end.to);
    }
  }
  game.rifts = L.filter((R) => !R.done);
}
// Through: out of the far end (or as near it as there's room), a beat
// before they can go back.
export function riftThrough(game, R, e, from, to) {
  R.cd.set(e, 1.6);
  const r = game.renderer;
  let spot = { x: to.x, y: game.world.findStandY(to.x, to.z, R.y), z: to.z };
  if (spot.y < 0 || game.occupiedBySolid(spot.x, spot.y, spot.z, e)) spot = game.findFreeSpot(to.x, to.z, R.y);
  if (!spot) return false;
  for (const at of [from, to]) {
    r.emit(at.x, R.y + 1, at.z, { n: 18, color: ['#c8a0ff', '#5ad8f0', '#ffffff', '#3a1a6a'], up: 30, speed: 50, life: 0.6, glow: true });
    r.effect?.({ type: 'ring', wx: at.x, wy: R.y, wz: at.z, r0: 2, r1: 22, color: ['#c8a0ff', '#ffffff'], life: 0.45, oy: 3, flat: 0.5, thick: 2 });
  }
  e.teleport(spot.x, spot.y, spot.z);
  if (e.kind === 'player') {
    if (e === game.player) game.renderer.flashScreen?.('#8a60ff', 0.18);
    if (!R.toldOf) game.asPlayer?.(e, () => game.ui.msg('You step through the rift... and out of the other.', '#c8a0ff'));
    R.toldOf = true;
  }
  game.audio?.play('portal', to);
  if (R.onThrough) R.onThrough(game, R, e, to);
  return true;
}

// ------------------------------------------------------------ each frame
// Everything of theirs loose in the world: bouncers, rifts.
export function updateEvolved(game, dt) {
  updateBouncers(game, dt);
  updateRifts(game, dt);
}

// ------------------------------------------------------------ blows
// A blow on one of them (or by one) as it lands: nothing touches it while
// it rises; the blow that would kill it the first time, it rises from
// instead; and the Hero's mercy (see evolved_hero.js). What's left of the
// blow (0: none of it lands).
export function evoHurt(game, target, source, amount) {
  if (isEvolved(target)) {
    if (target.riseT > 0) return 0;
    if (!target.enraged && !target.dead && target.hp - amount <= 0 && rise(game, target)) return 0;
  }
  if (target.kind === 'player' && source && source.S && source.S.mercy && target.hp - amount <= 0 && source.S.mercy(game, source, target, amount)) return 0;
  return amount;
}
