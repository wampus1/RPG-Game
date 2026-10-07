// (Round 71) The Alinelidan, in the Gullet of the World (see world/
// ancient.js): the World-Worm, that ate the first kingdom of Ostria whole.
// Its head as big as a house, a round maw that splits four ways into jaws
// ringed with teeth, tentacles writhing out of it; and behind it, ring
// after ring of it, its body following it over the floor (drawn in the
// world: see render/forge_evolved.js).
//   It fights in five stages, and it learns: whatever you've hurt it with
//   most in one stage, the next it shrugs off (your blows barely mark it:
//   change your arms). It bites; it calls up its leeches; it screams (the
//   hall shakes, and its toxic bombs rain down); it dashes, three times
//   running, straight through where you stand; it spits bolts of toxin; it
//   whips its body round; it dives into the floor and comes up under you,
//   leaving a hole full of acid (the hall the smaller for it, till the
//   holes fill in with dirt); it throws its body round you in a ring and
//   spits toxin in at you, bouncing off the inside of its coils, till its
//   time's up or you've hurt it enough to make it let go; it lashes you
//   with its tentacles and draws you in; it rains acid over the hall.
//   And it infests you: a cough first (choking, slowing), then a single
//   straight shot that, if it finds you, puts a worm in you (its bite each
//   moment; your wounds slower to close; your armour softer; more of them,
//   worse). Once a stage at first, five times in the last.
//   Risen, the World-Swallow: it goes down, the whole floor heaves in
//   waves from the walls in, and it comes up under you with its maw open:
//   swallowed, unless you're quick (strike your way out).
import { BRAINS, addHazard, addZone, lob, lineTiles, areaTiles, summon, BOSS_TITLES } from './monsters.js';
import { stun } from '../game/gems.js';
import { swallow } from '../game/afflict.js';
import { B } from '../world/blocks.js';
import { ITEMS } from '../world/items.js';
import { dist, dmgOf, hallOf, inHall, openFloor, drag, proc, spotIn, work, coneTiles, ringTiles } from './bosskit.js';
import { evoFight, evoTick, evoPhase, grab, release, farSpot, preyIn, bounceAt, TAU } from './evolved.js';
import { fits } from './footprint.js';
import { cue } from './cue.js';

const later = (c, secs, fn) => proc(c.game, c, 1, 1, fn, secs);
const say = (c, line) => c.say?.(line, 2.4, '#c8e070');
const TOX = [150, 210, 60];
const BILE = ['#c8e070', '#a8c040', '#e8ff90'];
const SEG = 16;
const GAP = 1.05;

// ------------------------------------------------------------ its body
// Where its head's been, newest first (floats); its rings stand along it.
function trailTick(c) {
  const p = c.renderPos();
  const T = (c.trail ||= [{ x: p.x, z: p.z }]);
  const d = Math.hypot(p.x - T[0].x, p.z - T[0].z);
  if (d >= 0.3) T.unshift({ x: Math.round(p.x * 100) / 100, z: Math.round(p.z * 100) / 100 });
  if (T.length > SEG * 5) T.length = SEG * 5;
  // (Round 73) Its body solid along the ground behind its head, to its
  // tail: in the way, and there to be struck (see footprint.covers). Not
  // while it's under the floor.
  if (c.burrowed || c.diving) {
    c.bodyTiles = null;
    return;
  }
  const set = new Set();
  for (const q of wormRings(c)) {
    const x = Math.round(q.x);
    const z = Math.round(q.z);
    if (Math.abs(x - c.x) <= (c.foot || 0) && Math.abs(z - c.z) <= (c.foot || 0)) continue;
    set.add(x * 65536 + z);
  }
  c.bodyTiles = set;
}
// Its rings, head to tail: each `GAP` along its trail.
export function wormRings(c) {
  const T = c.trail;
  if (!T || !T.length) return [];
  const out = [];
  let i = 0;
  let acc = 0;
  let prev = T[0];
  for (let s = 1; s <= SEG; s++) {
    const want = s * GAP;
    while (i + 1 < T.length && acc + Math.hypot(T[i + 1].x - T[i].x, T[i + 1].z - T[i].z) < want) {
      acc += Math.hypot(T[i + 1].x - T[i].x, T[i + 1].z - T[i].z);
      i++;
    }
    if (i + 1 >= T.length) {
      out.push({ x: T[T.length - 1].x, z: T[T.length - 1].z, k: s / SEG });
      continue;
    }
    const seg = Math.hypot(T[i + 1].x - T[i].x, T[i + 1].z - T[i].z) || 1;
    const f = (want - acc) / seg;
    prev = { x: T[i].x + (T[i + 1].x - T[i].x) * f, z: T[i].z + (T[i + 1].z - T[i].z) * f };
    out.push({ ...prev, k: s / SEG });
  }
  return out;
}
// A path for its head: straight at `to`, quick, a pace at a time.
function rush(c, to, per, then) {
  c.rushing = { to: { x: to.x, z: to.z }, per, then, t: 0 };
}
function rushTick(c, dt) {
  const R = c.rushing;
  if (!R) return false;
  R.t += dt;
  if (c.moving) return true;
  const game = c.game;
  const sx = Math.sign(R.to.x - c.x);
  const sz = Math.sign(R.to.z - c.z);
  if ((!sx && !sz) || R.t > 4) {
    c.rushing = null;
    if (R.then) R.then();
    return true;
  }
  for (const [ax, az] of [[sx, sz], [sx, 0], [0, sz]]) {
    if (!ax && !az) continue;
    if (fits(game, c, c.x + ax, c.y, c.z + az, true) && inHall(c, { x: c.x + ax, z: c.z + az })) {
      c.face(c.x + ax, c.z + az);
      c.startMove(c.x + ax, c.y, c.z + az, R.per);
      return true;
    }
  }
  c.rushing = null;
  if (R.then) R.then();
  return true;
}

// ------------------------------------------------------------ it learns
// What you're hurting it with (a weapon by its kind, a bare fist, a
// thrown thing): the most used in each stage, it won't feel the next.
const armsKey = (src) => {
  if (!src || src.kind !== 'player') return null;
  const k = src.heldItem ? src.heldItem() : null;
  return k && ITEMS[k] && (ITEMS[k].damage || ITEMS[k].ranged) ? k : 'fists';
};
const armsName = (k) => (k === 'fists' ? 'bare hands' : ITEMS[k] ? ITEMS[k].name.toLowerCase() : k);
function learn(c) {
  const U = c.usedArms || {};
  let best = null;
  for (const [k, n] of Object.entries(U)) if (!best || n > U[best]) best = k;
  c.usedArms = {};
  if (!best) return;
  c.immune = best;
  const game = c.game;
  const run = game.dungeon;
  (run && run.eachHere ? (fn) => run.eachHere(fn) : (fn) => fn())(() => game.ui.msg(`The Alinelidan has learned your ${armsName(best)}: it barely feels them now. Change your arms!`, '#e0ff90', true));
  game.renderer.floatText(c.x, c.y + 4, c.z, `IMMUNE: ${armsName(best).toUpperCase()}`, '#e0ff90');
}

// ------------------------------------------------------------ infested
// A worm in you: its bite each moment, your wounds slower to close, your
// armour softer (see player.js, game.damage, afflict.js).
export function infest(game, c, e) {
  if (!e || e.dead || e.kind !== 'player') return;
  e.worms = Math.min(5, (e.worms || 0) + 1);
  e.wormT = 45;
  game.renderer.floatText(e.x, e.y + 2.6, e.z, `INFESTED ×${e.worms}`, '#e0ff90');
  game.audio?.play('skitter', e);
  if (e === game.player) game.ui.msg('Something wriggles in under your skin! (It bites; your wounds close slower; your armour\'s softer. It works its way out in time.)', '#e0ff90', true);
}

// ------------------------------------------------------------ its works
const WORM = {
  // Its maw split open, and down on you.
  bite(c, t, game) {
    const tiles = coneTiles(c, t, c.foot + 3, 0.9);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.7, dmg: dmgOf(c, 9), kind: 'burst', knock: 1, color: [200, 80, 80] });
    c.jawT = 0.9;
    cue(c, 'strike', t);
    return true;
  },
  // Its leeches, out of its mouth.
  leeches(c, t, game) {
    const n = game.creatures.filter((o) => !o.dead && o.summoner === c).length;
    const want = Math.min(8 - n, 2 + Math.min(4, evoPhase(c)));
    if (want < 2) return false;
    for (let i = 0; i < want; i++) summon(game, 'gullet_leech', c, 3, { color: ['#5a2a2a', '#8a4a3a'], level: c.level });
    for (const o of game.creatures) if (!o.dead && o.summoner === c && !o.leash) o.leash = c.leash;
    c.jawT = 1.2;
    say(c, 'Hhhhkkkk...');
    return true;
  },
  // A scream: the hall shakes, those near reel, and its bombs rain.
  scream(c, t, game) {
    game.audio?.play('scream', c);
    game.audio?.play('rumble', c);
    game.shake = Math.min(1.8, (game.shake || 0) + 1.2);
    c.jawT = 1.6;
    cue(c, 'roar');
    for (const e of preyIn(c)) if (dist(c, e) <= 6) {
      stun(e, 0.5);
      if (e.kind === 'player') e.grabbedT = Math.max(e.grabbedT || 0, 0.4);
    }
    const n = 4 + evoPhase(c);
    for (let i = 0; i < n; i++) later(c, 0.3 + i * 0.15, () => {
      const at = i < 2 && c.target ? { x: c.target.x + Math.round((Math.random() - 0.5) * 2), z: c.target.z + Math.round((Math.random() - 0.5) * 2) } : farSpot(c, c, 2);
      if (!at) return;
      lob(game, c, at.x, at.z, { tint: TOX, onLand: (g, x, z) => {
        const tiles = areaTiles(x, z, 1, true).filter((q) => openFloor(g, q.x, q.z));
        addHazard(g, { by: c, tiles, y: c.y, dur: 0.5, dmg: dmgOf(c, 5), kind: 'acid', center: { x, z }, radius: 1, color: TOX, onFire: (g2) => addZone(g2, { by: c, kind: 'bile', tiles, y: c.y, life: 5, tick: 0.7, dmg: 1, slow: true, color: TOX, puff: BILE }) });
      } });
    });
    return true;
  },
  // Three dashes, straight through where you are.
  dash(c, t, game) {
    let k = 0;
    const go = () => {
      if (c.dead || k >= 3) return;
      k++;
      const tt = c.target && !c.target.dead ? c.target : t;
      const ang = Math.atan2(tt.z - c.z, tt.x - c.x);
      const to = { x: Math.round(tt.x + Math.cos(ang) * 3), z: Math.round(tt.z + Math.sin(ang) * 3) };
      const H = hallOf(c);
      to.x = Math.max(H.x0 + 1, Math.min(H.x1 - 1, to.x));
      to.z = Math.max(H.z0 + 1, Math.min(H.z1 - 1, to.z));
      const line = lineTiles(game, c, to, 16).flatMap((q) => [q, ...areaTiles(q.x, q.z, 1)]);
      const tiles = [...new Map(line.map((q) => [`${q.x},${q.z}`, q])).values()];
      c.face(to.x, to.z);
      addHazard(game, { by: c, tiles, y: c.y, dur: 0.75, dmg: dmgOf(c, 8), kind: 'slam', knock: 2, from: { x: c.x, z: c.z }, color: [200, 90, 80], onFire: () => rush(c, to, 0.045, () => later(c, 0.25, go)) });
      c.jawT = 0.8;
      cue(c, 'charge', to);
    };
    go();
    say(c, 'GRRRAAAAHH!');
    return true;
  },
  // Bolts of toxin, spat in a fan.
  spit(c, t, game) {
    const n = 3 + Math.min(4, evoPhase(c) - 1);
    for (let i = 0; i < n; i++) bounceAt(game, c, { x: c.x, z: c.z }, t, { spread: (i - (n - 1) / 2) * 0.22, v: 8, life: 3, dmg: dmgOf(c, 5), slow: 1, kind: 'toxin', straight: true });
    c.jawT = 0.6;
    cue(c, 'throw', t);
    game.audio?.play('splash', c);
    return true;
  },
  // Its body whipped round: a great arc on one side of it.
  whip(c, t, game) {
    const R = wormRings(c);
    const mid = R[Math.floor(R.length / 3)] || c;
    const at = { x: Math.round(mid.x), z: Math.round(mid.z) };
    const tiles = areaTiles(at.x, at.z, 4, true).filter((q) => openFloor(game, q.x, q.z) && dist(c, q) > 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.9, dmg: dmgOf(c, 7), kind: 'slam', knock: 3, from: at, center: at, radius: 4, color: [190, 120, 110] });
    c.whipT = 0.9;
    cue(c, 'slam');
    return true;
  },
  // Down into the floor (a hole left full of acid), and up under you.
  burrow(c, t, game) {
    if (c.burrowed) return false;
    const hole = { x: c.x, z: c.z };
    c.diving = { t: 0, dur: 0.9 };
    later(c, 0.9, () => {
      if (c.dead) return;
      c.diving = null;
      c.burrowed = true;
      digHole(c, hole);
      const tt = c.target && !c.target.dead ? c.target : t;
      const up = spotIn(c, tt, 0, 1) || { x: tt.x, y: c.y, z: tt.z };
      later(c, 0.4, () => {
        addHazard(game, { by: c, tiles: areaTiles(up.x, up.z, 2, true), y: c.y, dur: 1.3, dmg: dmgOf(c, 11), kind: 'erupt', knock: 3, from: up, center: up, radius: 2, color: [160, 120, 80], onFire: () => emerge(c, up) });
        game.shake = Math.min(1.2, (game.shake || 0) + 0.5);
      });
    });
    game.audio?.play('rumble', c);
    cue(c, 'slam');
    if (!game.toldHoles) {
      game.toldHoles = true;
      game.ui.msg('It dives into the floor, and leaves a pit of acid behind it! (They fill in with dirt in time.)', '#e0ff90', true);
    }
    return true;
  },
  // Its coils thrown round you: toxin spat in at you, bouncing off the
  // inside of them, till its time's up or you've hurt it enough.
  encircle(c, t, game) {
    if (c.ring) return false;
    const at = { x: t.x, z: t.z };
    const r = 4;
    // (Round you, its head going round, its body following.)
    const pts = [];
    for (let i = 0; i <= 20; i++) {
      const a = (i / 20) * TAU;
      const q = { x: Math.round(at.x + Math.cos(a) * r), z: Math.round(at.z + Math.sin(a) * r) };
      if (fits(game, c, q.x, c.y, q.z, true)) pts.push(q);
    }
    if (pts.length < 8) return false;
    c.ring = { at, r: r + 0.4, t: 0, life: 10, hp0: c.hp, pts, k: 0, spat: 0 };
    const step = () => {
      if (!c.ring || c.dead) return;
      const q = c.ring.pts[c.ring.k++ % c.ring.pts.length];
      rush(c, q, 0.06, c.ring.k < c.ring.pts.length * 1.2 ? step : null);
    };
    step();
    say(c, 'Mine. MINE.');
    if (!game.toldRing) {
      game.toldRing = true;
      game.ui.msg('It throws its coils round you! Hurt it enough and it lets go; touch its body and it hurts.', '#e0ff90', true);
    }
    return true;
  },
  // Its tentacles out of its maw, to draw you in.
  lash(c, t, game) {
    const prey = preyIn(c).filter((e) => !e.heldBy && dist(c, e) <= 6);
    const e = prey.includes(t) ? t : prey[0];
    if (!e) return false;
    const tiles = lineTiles(game, c, e, 7).slice(c.foot || 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.8, dmg: dmgOf(c, 3), kind: 'beam', from: tiles[0] || e, to: { x: e.x, z: e.z }, beamColor: '#e8a0a0', halo: '#5a2a2a', width: 1, color: [220, 140, 140], onFire: (g, h, hit) => {
      if (!hit.includes(e)) return;
      grab(g, c, e, 1.2);
      proc(g, c, 0.15, 6, () => drag(g, e, c, 1));
      later(c, 1, () => {
        release(g, c, e);
        if (!e.dead && dist(c, e) <= 1) WORM.bite(c, e, g);
      });
    } });
    c.jawT = 1.2;
    cue(c, 'cast', e);
    return true;
  },
  // Acid rained over the hall.
  rain(c, t, game) {
    const H = hallOf(c);
    proc(game, c, 0.18, 14, () => {
      const at = { x: H.x0 + 1 + Math.floor(Math.random() * (H.x1 - H.x0 - 1)), z: H.z0 + 1 + Math.floor(Math.random() * (H.z1 - H.z0 - 1)) };
      if (Math.random() < 0.3 && c.target) {
        at.x = c.target.x;
        at.z = c.target.z;
      }
      if (!openFloor(game, at.x, at.z)) return;
      game.renderer.emit(at.x, c.y + 3, at.z, { n: 3, color: BILE, up: -30, speed: 4, gravity: 160, life: 0.6, oy: -10 });
      addHazard(game, { by: c, tiles: [at], y: c.y, dur: 0.85, dmg: dmgOf(c, 5), kind: 'acid', color: TOX });
    });
    c.jawT = 1;
    cue(c, 'roar');
    return true;
  },
  // Its cough (choking, slowing), and then the shot that infests.
  infest(c, t, game) {
    const ph = evoPhase(c);
    if ((c.infested || 0) >= Math.min(5, ph)) return false;
    c.infested = (c.infested || 0) + 1;
    const tiles = coneTiles(c, t, 7, 0.7).filter((q) => dist(c, q) > 0);
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.9, dmg: dmgOf(c, 2), kind: 'acid', chill: 2.5, color: [180, 200, 120], onFire: (g, h, hit) => {
      for (const q of tiles) if (Math.random() < 0.3) g.renderer.emit(q.x, c.y + 0.6, q.z, { n: 2, color: ['#c8d890', '#a8b870'], up: 8, speed: 10, life: 1, shape: 'puff' });
      if (hit.length) g.renderer.floatText(c.x, c.y + 4, c.z, 'choking...', '#c8d890');
    } });
    later(c, 1.3, () => {
      if (c.dead) return;
      const tt = c.target && !c.target.dead ? c.target : t;
      bounceAt(game, c, { x: c.x, z: c.z }, tt, { v: 11, life: 2.5, dmg: dmgOf(c, 3), kind: 'acid', straight: true, r: 0.6, onHit: (g, b, e) => infest(g, c, e) });
      game.audio?.play('splash', c);
      cue(c, 'throw', tt);
    });
    c.jawT = 1.6;
    game.audio?.play('growl', c);
    say(c, 'Hkk... HKKK...');
    if (!game.toldInfest) {
      game.toldInfest = true;
      game.ui.msg('It chokes, and coughs... and then it spits one thing, straight at you. Don\'t let it touch you!', '#e0ff90', true);
    }
    return true;
  },
  // Its last: the World-Swallow.
  swallow(c, t, game) {
    if (c.burrowed) return false;
    c.diving = { t: 0, dur: 0.9 };
    const H = hallOf(c);
    later(c, 0.9, () => {
      if (c.dead) return;
      c.diving = null;
      c.burrowed = true;
      digHole(c, { x: c.x, z: c.z });
      // The whole floor heaving, in waves from the walls in.
      const mid = { x: Math.round((H.x0 + H.x1) / 2), z: Math.round((H.z0 + H.z1) / 2) };
      const far = Math.ceil(Math.max(mid.x - H.x0, mid.z - H.z0));
      for (let r = far, k = 0; r >= 3; r -= 3, k++) later(c, k * 0.6, () => {
        const tiles = ringTiles(mid.x, mid.z, r).concat(ringTiles(mid.x, mid.z, r - 1)).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z, true));
        addHazard(game, { by: c, tiles, y: c.y, dur: 0.9, dmg: dmgOf(c, 7), kind: 'erupt', knock: 1, color: [170, 120, 80] });
        game.shake = Math.min(1.4, (game.shake || 0) + 0.4);
      });
      later(c, 3.2, () => {
        const tt = c.target && !c.target.dead ? c.target : t;
        const up = spotIn(c, tt, 0, 1) || { x: tt.x, y: c.y, z: tt.z };
        addHazard(game, { by: c, tiles: areaTiles(up.x, up.z, 2, true), y: c.y, dur: 1.5, dmg: dmgOf(c, 9), kind: 'erupt', color: [220, 80, 80], center: up, radius: 2, onFire: (g, h, hit) => {
          emerge(c, up);
          const p = hit.find((e) => e.kind === 'player');
          if (p) swallow(g, p, c, { need: 8, max: 6, dmg: 2, spit: 8 });
          g.audio?.play('roar', c);
        } });
      });
    });
    game.audio?.play('rumble', c);
    say(c, 'I ATE YOUR KINGS. I WILL EAT YOUR WORLD.');
    cue(c, 'roar');
    return true;
  },
};

// A hole where it went down: acid in it a while, then filled in with
// dirt (the hall the smaller till the fight's done).
function digHole(c, at) {
  const game = c.game;
  const tiles = areaTiles(at.x, at.z, 1).filter((q) => openFloor(game, q.x, q.z));
  for (const q of tiles) work(game, q.x, c.y - 1, q.z, B.acid_pool, 16, c, { floor: true });
  addZone(game, { by: c, kind: 'bile', tiles, y: c.y, life: 16, tick: 0.5, dmg: 2, slow: true, color: TOX, puff: BILE });
  game.renderer.emit(at.x, c.y + 0.4, at.z, { n: 30, color: ['#7a5a3a', '#5a4430', '#a8885a'], up: 50, speed: 60, gravity: 160, life: 0.8 });
  // (Filled in with dirt, after.)
  later(c, 16, () => {
    for (const q of tiles) work(game, q.x, c.y - 1, q.z, B.mud, 0, c, { floor: true });
    game.renderer.emit(at.x, c.y + 0.2, at.z, { n: 14, color: ['#7a5a3a', '#5a4430'], up: 10, speed: 20, life: 0.6, shape: 'puff' });
  });
}
// Up out of the floor at `up`.
function emerge(c, up) {
  const game = c.game;
  c.burrowed = false;
  const to = fits(game, c, up.x, c.y, up.z, true) ? up : spotIn(c, up, 1, 4) || up;
  c.teleport(to.x, c.y, to.z);
  c.trail = [{ x: to.x, z: to.z }];
  digHole(c, to);
  game.shake = Math.min(1.6, (game.shake || 0) + 0.9);
  game.audio?.play('roar', c);
  cue(c, 'emerge');
}

// Coiled round you: its time, how hurt it's been, and its body hurting
// whoever touches it, its toxin bouncing about inside.
function ringTick(c, dt) {
  const R = c.ring;
  if (!R) return;
  const game = c.game;
  R.t += dt;
  const done = R.t > R.life || R.hp0 - c.hp > c.maxHp * 0.06 || c.burrowed;
  if (done) {
    if (R.t <= R.life && !c.burrowed) {
      game.renderer.floatText(c.x, c.y + 4, c.z, 'IT LETS GO!', '#ffe070');
      c.stunT = Math.max(c.stunT || 0, 1.2);
    }
    c.ring = null;
    c.rushing = null;
    for (const b of game.bouncers || []) if (b.by === c && b.ring) b.done = true;
    return;
  }
  // Once it's round you: the toxin, spat in.
  if (R.t > 1.6) {
    R.spat -= dt;
    if (R.spat <= 0) {
      R.spat = 1.6;
      bounceAt(game, c, R.at, null, { ang: Math.random() * TAU, v: 6, life: 6, dmg: dmgOf(c, 4), slow: 1.5, kind: 'toxin', ring: { x: R.at.x, z: R.at.z, r: R.r - 0.6 } });
    }
  }
  // Its body hurts whoever's on it.
  R.hurtT = (R.hurtT || 0) - dt;
  if (R.hurtT > 0) return;
  R.hurtT = 0.5;
  const rings = wormRings(c);
  for (const e of preyIn(c)) {
    if (e.rollT > 0) continue;
    if (rings.some((q) => Math.abs(q.x - e.x) < 0.8 && Math.abs(q.z - e.z) < 0.8)) {
      game.damage(e, dmgOf(c, 3), c);
      if (Math.hypot(e.x - R.at.x, e.z - R.at.z) > 1) drag(game, e, R.at, 1);
    }
  }
}

// ------------------------------------------------------------ the fight
const WORKS = [
  ['swallowCd', 5, 24, WORM.swallow, { enraged: true, rest: 3, fixed: true }],
  ['infestCd', 6, 9, WORM.infest, { max: 9, rest: 1.4 }],
  ['ringCd', 10, 20, WORM.encircle, { ph: 2, max: 10, rest: 1 }],
  ['burrowCd', 8, 13, WORM.burrow, { rest: 1.5 }],
  ['dashCd', 6, 11, WORM.dash, { min: 2, rest: 1.5 }],
  ['screamCd', 9, 16, WORM.scream, { ph: 2, rest: 0.8 }],
  ['rainCd', 10, 17, WORM.rain, { ph: 3 }],
  ['leechCd', 7, 15, WORM.leeches, {}],
  ['lashCd', 5, 8, WORM.lash, { ph: 2, max: 6 }],
  ['whipCd', 4, 7, WORM.whip, { max: 6 }],
  ['spitCd', 2.5, 5, WORM.spit, { min: 2 }],
  ['biteCd', 1.4, 2.8, WORM.bite, { max: 3, rest: 0.5 }],
];

export const WORM_BOSSES = {
  alinelidan: {
    name: 'The Alinelidan', hp: 260, dmg: 7, step: 0.28, mode: 'hostile', aggro: 24, under: true, boss: true, big: true, evolved: true, anim: true,
    light: 4, brain: 'alinelidan', phases: 5, foot: 1, riseHp: 0.6, beamY: 60,
    tint: ['#c8e070', '#c86050'], sayColor: '#c8e070',
    phaseLines: ['', '', 'It shudders, and the earth with it.', 'It has learned you. It is learning still.', 'The Gullet opens wider.', 'IT. IS. HUNGRY.'],
    riseLine: '*the whole of the earth heaves, and it comes up again out of it*',
    tick: (c, dt) => {
      evoTick(c, dt);
      trailTick(c);
      ringTick(c, dt);
      if (c.jawT > 0) c.jawT -= dt;
      if (c.whipT > 0) c.whipT -= dt;
      if (c.diving) c.diving.t += dt;
    },
    onPhase: (c) => {
      learn(c);
      c.infested = 0;
    },
    onRise: (c) => {
      learn(c);
      c.infested = 0;
      c.swallowCd = 4;
    },
    // Whatever it's learned barely marks it; and it keeps count of what
    // you're using.
    ward: (game, c, src, n) => {
      // (Passing through: nothing you do marks it.)
      if (c.passing) {
        if (!(c.wardNote > 0)) {
          c.wardNote = 1.2;
          game.renderer.floatText(c.x, c.y + 3.6, c.z, 'it doesn\'t even notice', '#e0ff90');
        }
        return 0;
      }
      const k = armsKey(src);
      if (!k) return n;
      c.usedArms ||= {};
      c.usedArms[k] = (c.usedArms[k] || 0) + n;
      if (c.immune && k === c.immune) {
        if (!(c.wardNote > 0)) {
          c.wardNote = 0.8;
          game.renderer.floatText(c.x, c.y + 3.6, c.z, `immune to your ${armsName(k)}`, '#e0ff90');
        }
        return Math.max(1, Math.round(n * 0.1));
      }
      return n;
    },
    drops: [['bone', 10, 20, 1], ['gem', 4, 8, 1], ['gold_ore', 6, 12, 1], ['old_coin', 30, 60, 1], ['shard_emerald', 2, 4, 1], ['shard_onyx', 2, 4, 1]],
  },
  // Its leeches: they latch on and drink, and slow you.
  gullet_leech: {
    name: 'Gullet Leech', hp: 7, dmg: 2, step: 0.3, mode: 'hostile', aggro: 16, under: true, brain: 'gulletLeech', drops: [],
    onStrike: (game, c, p) => {
      p.slowT = Math.max(p.slowT || 0, 1.2);
      c.hp = Math.min(c.maxHp, c.hp + 1);
    },
  },
};

export const WORM_TITLES = {
  alinelidan: { name: 'The Alinelidan', title: 'Mother of Leeches, the World-Worm', taunt: '*the ground breathes in*' },
};

// (Round 73) Passing through its own Gullet, above the hall where it
// waits (see ancient.gulletPass): through the rock and out across a room
// and into the rock again, paying you no mind, and nothing you do marks it.
const PASS_STEP = 0.3;
function passTick(c, dt) {
  const P = c.passing;
  const game = c.game;
  P.t = (P.t || 0) - dt;
  if (P.t > 0) return true;
  P.t = PASS_STEP;
  P.i = (P.i || 0) + 1;
  const k = P.i / P.len;
  if (k >= 1) {
    // Gone into the rock for good.
    game.removeOcc(c);
    c.bodyTiles = null;
    c.burrowed = true;
    game.creatures = game.creatures.filter((q) => q !== c);
    return true;
  }
  const x = Math.round(P.from.x + (P.to.x - P.from.x) * k);
  const z = Math.round(P.from.z + (P.to.z - P.from.z) * k);
  const open = game.world.canStand(x, c.y, z);
  if (open && c.burrowed) {
    c.trail = [{ x, z }];
    game.renderer.emit(x, c.y + 0.5, z, { n: 24, color: ['#7a5a3a', '#5a4430', '#a8885a'], up: 40, speed: 50, gravity: 140, life: 0.8 });
    game.shake = Math.min(1, (game.shake || 0) + 0.5);
    game.audio?.play('rumble', c);
  } else if (!open && !c.burrowed) {
    game.renderer.emit(c.x, c.y + 0.5, c.z, { n: 16, color: ['#7a5a3a', '#5a4430'], up: 30, speed: 40, gravity: 140, life: 0.7 });
  }
  c.burrowed = !open;
  c.teleport(x, c.y, z);
  return true;
}

export const WORM_BRAINS = {
  alinelidan(c, dt) {
    if (c.passing) return passTick(c, dt);
    if (c.riseT > 0) return true;
    if (c.diving || c.burrowed) return true;
    if (rushTick(c, dt)) return true;
    if (c.ring) return true;
    if (evoFight(c, dt, WORKS)) return true;
    return false;
  },
  gulletLeech() {
    return false;
  },
};

Object.assign(BRAINS, WORM_BRAINS);
Object.assign(BOSS_TITLES, WORM_TITLES);
