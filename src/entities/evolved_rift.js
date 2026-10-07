// (Round 71) The Rift Crawler, in the Sundered Reach (see world/
// ancient.js): a thing that climbed down out of a split in the sky. Four
// long legs, each foot planted where it falls; a body of black chitin
// cracked through to the void; a long stalk of a neck, a head crowned with
// eyes, and out of the head two long jointed arms ending in blades (drawn:
// see render/forge_evolved.js).
//   It cuts the air: rifts, in pairs, each the way into the other, that
//   you can use as well as it (see evolved.js, addRift). It steps through
//   its own to come at you from where you aren't looking. It reaches out
//   with a head-arm and takes you, opens a rift beside it and another by a
//   wall, and throws you through the one into the other. It strikes in
//   combinations, blade after blade, the last the heaviest; it lunges with
//   its head; it scissors its arms about it; it drives spikes of the void
//   up out of the floor in lines and rings; it looses balls of the void
//   that bounce about the hall and slow whoever they touch; and it blinks
//   behind you.
//   It remembers: what it was three seconds ago, it can go back to, its
//   hurts with it (it gathers itself to do it, a breath: hurt it hard
//   enough then and the thread snaps). Worn, it opens rifts all over its
//   hall, the void pouring out of them, and fractures time itself (where
//   you stood comes apart a moment later). Risen, its Unmaking: the hall
//   torn open at its four corners, everything drawn to them, and then the
//   void through all of it but what's beside them.
import { BRAINS, addHazard, lineTiles, areaTiles, summon, BOSS_TITLES } from './monsters.js';
import { dist, dmgOf, hallOf, inHall, openFloor, drag, proc, spotIn, blinkTo, coneTiles, ringTiles } from './bosskit.js';
import { evoFight, evoTick, evoPhase, grab, release, fling, farSpot, preyIn, addRift, riftThrough, bounceAt, TAU } from './evolved.js';
import { fits } from './footprint.js';
import { cue } from './cue.js';

const VOIDC = [170, 110, 255];
const VOID = ['#c8a0ff', '#5ad8f0', '#3a1a6a', '#ffffff'];
const later = (c, secs, fn) => proc(c.game, c, 1, 1, fn, secs);
const say = (c, line) => c.say?.(line, 2.2, '#c8a0ff');
// Its own rifts.
const riftsOf = (c) => (c.game.rifts || []).filter((R) => R.by === c && !R.done);
// A spot by a wall of its hall (where you'll hit it, thrown through).
function byWall(c, from) {
  const H = hallOf(c);
  const game = c.game;
  const cands = [];
  for (let i = 0; i < 40; i++) {
    const side = Math.floor(Math.random() * 4);
    const x = side < 2 ? (side ? H.x1 - 1 : H.x0 + 1) : H.x0 + 1 + Math.floor(Math.random() * (H.x1 - H.x0 - 1));
    const z = side >= 2 ? (side === 3 ? H.z1 - 1 : H.z0 + 1) : H.z0 + 1 + Math.floor(Math.random() * (H.z1 - H.z0 - 1));
    if (!openFloor(game, x, z) || Math.hypot(x - from.x, z - from.z) < 6) continue;
    cands.push({ x, z, side });
    if (cands.length > 3) break;
  }
  return cands[0] || null;
}
// A rift's near end: a free tile beside it, toward `t`.
function besideIt(c, t) {
  const ang = Math.atan2(t.z - c.z, t.x - c.x);
  for (const d of [0, 0.6, -0.6, 1.2, -1.2]) {
    const x = Math.round(c.x + Math.cos(ang + d) * (c.foot + 2));
    const z = Math.round(c.z + Math.sin(ang + d) * (c.foot + 2));
    if (openFloor(c.game, x, z) && inHall(c, { x, z })) return { x, z };
  }
  return null;
}

// ------------------------------------------------------------ its memory
// Where it was, and how whole, every quarter second, the last four.
function remember(c, dt) {
  c.memT = (c.memT || 0) + dt;
  if (c.memT < 0.25) return;
  c.memT = 0;
  (c.mem ||= []).push({ x: c.x, z: c.z, hp: c.hp, t: c.fightClock || 0 });
  if (c.mem.length > 16) c.mem.shift();
}

// ------------------------------------------------------------ its arm
// A head-arm out into the world (drawn: see render/forge_evolved.js),
// reaching to (x, z) over `secs`, then `then`.
function reachOut(c, side, x, z, secs, then) {
  c.reach = { side, x0: c.x, z0: c.z, x, z, t: 0, dur: secs, then, h: 1.2, back: 0 };
}
function reachTick(c, dt) {
  const R = c.reach;
  if (!R) return;
  R.t += dt;
  if (R.back) {
    R.back += dt;
    if (R.back > 0.35) c.reach = null;
    return;
  }
  if (R.t >= R.dur && R.then) {
    const f = R.then;
    R.then = null;
    f();
  }
  // (Whoever it holds, held where its blade is.)
  if (R.held && !R.held.dead) {
    const e = R.held;
    if (e.kind === 'player' && !(e.grabbedT > 0)) {
      release(c.game, c, e);
      R.held = null;
      R.back = 0.01;
    }
  }
}
function retract(c) {
  if (c.reach) c.reach.back = 0.01;
}

// ------------------------------------------------------------ its works
const RIFT = {
  // A rift cut: one end by it, one by you (or across the hall).
  slice(c, t, game) {
    if (riftsOf(c).length >= (evoPhase(c) >= 3 ? 3 : 2)) return false;
    const a = besideIt(c, t);
    const near = spotIn(c, t, 2, 4);
    const b = Math.random() < 0.6 && near ? near : farSpot(c, c, 7);
    if (!a || !b) return false;
    addRift(game, a, b, { by: c, life: evoPhase(c) >= 3 ? 16 : 12 });
    // (The cut itself, along its line: a slash of the void.)
    const tiles = lineTiles(game, c, t, 6).slice(c.foot || 0);
    if (tiles.length) addHazard(game, { by: c, tiles, y: c.y, dur: 0.7, dmg: dmgOf(c, 5), kind: 'beam', from: tiles[0], to: tiles[tiles.length - 1], beamColor: '#ffffff', halo: '#8a40ff', width: 1, color: VOIDC });
    cue(c, 'strike', t);
    if (!game.toldRifts) {
      game.toldRifts = true;
      game.ui.msg('It cuts the air open: a rift, and another where it leads. You can go through them too.', '#c8a0ff', true);
    }
    return true;
  },
  // Through its own rift: out of the other end, at you.
  step(c, t, game) {
    const R = riftsOf(c).find((q) => q.open >= 1);
    if (!R) return false;
    // (The end nearer it in, the other out.)
    const da = Math.hypot(R.a.x - c.x, R.a.z - c.z);
    const db = Math.hypot(R.b.x - c.x, R.b.z - c.z);
    const [from, to] = da < db ? [R.a, R.b] : [R.b, R.a];
    if (Math.min(da, db) > 7 || !fits(game, c, to.x, c.y, to.z, true)) return false;
    riftThrough(game, R, c, from, to);
    c.gapT = 0.3;
    // (And straight into a blow, from where it came out.)
    later(c, 0.35, () => RIFT.combo(c, c.target || t, game, 2));
    return true;
  },
  // A head-arm out to take you: a rift beside it, another by a wall, and
  // you thrown through the one into the other.
  seize(c, t, game) {
    const prey = preyIn(c).filter((e) => !e.heldBy && dist(c, e) <= 8);
    const e = prey.includes(t) ? t : prey[0];
    if (!e) return false;
    const at = { x: e.x, z: e.z };
    const side = Math.random() < 0.5 ? 0 : 1;
    reachOut(c, side, at.x, at.z, 0.9, null);
    addHazard(game, {
      by: c, tiles: [at], y: c.y, dur: 0.9, dmg: 0, kind: 'burst', center: at, radius: 0.6, color: VOIDC, quiet: true,
      onFire: (g) => {
        const caught = !e.dead && Math.max(Math.abs(e.x - at.x), Math.abs(e.z - at.z)) <= 1 && !(e.rollT > 0) && Math.abs(e.y - c.y) <= 1;
        if (!caught || !c.reach) {
          retract(c);
          return;
        }
        grab(g, c, e, 3.5);
        c.reach.held = e;
        g.audio?.play('chain', e);
        // (Drawn in to it, as the rifts open.)
        c.reach.x = c.x + Math.sign(e.x - c.x) * (c.foot + 1);
        c.reach.z = c.z + Math.sign(e.z - c.z) * (c.foot + 1);
        const inAt = besideIt(c, e) || { x: c.x + c.foot + 1, z: c.z };
        const out = byWall(c, inAt);
        if (!out) {
          later(c, 0.6, () => {
            if (!c.reach || c.reach.held !== e) return;
            c.reach.held = null;
            retract(c);
            fling(g, c, e, { x: e.x + (e.x - c.x) * 3, z: e.z + (e.z - c.z) * 3 }, 6, dmgOf(c, 7));
          });
          return;
        }
        const R = addRift(g, inAt, out, { by: c, life: 3, open: 0.4 });
        // (Where you'll come out: by the wall, and spikes waiting for you.)
        addHazard(g, { by: c, tiles: areaTiles(out.x, out.z, 1, true), y: c.y, dur: 1.9, dmg: dmgOf(c, 6), kind: 'erupt', color: VOIDC, center: out, radius: 1 });
        later(c, 0.8, () => {
          if (!c.reach || c.reach.held !== e || e.dead) return;
          c.reach.held = null;
          retract(c);
          release(g, c, e);
          riftThrough(g, R, e, inAt, out);
          // (Out of it, at speed, into the wall.)
          const H = hallOf(c);
          const wall = { x: out.side === 0 ? H.x0 - 3 : out.side === 1 ? H.x1 + 3 : out.x, z: out.side === 2 ? H.z0 - 3 : out.side === 3 ? H.z1 + 3 : out.z };
          fling(g, c, e, wall, 4, dmgOf(c, 7));
          if (e === g.player && !g.toldThrown) {
            g.toldThrown = true;
            g.ui.msg('It throws you through the rift, into the wall on the far side! (Roll free when it takes you.)', '#c8a0ff', true);
          }
        });
      },
    });
    cue(c, 'cast', at);
    return true;
  },
  // Blade after blade (`n` of them), each a little way round, the last
  // the heaviest.
  combo(c, t, game, n = 0) {
    const N = n || (evoPhase(c) >= 3 ? 4 : 3) + (c.enraged ? 1 : 0);
    for (let i = 0; i < N; i++) {
      later(c, i * 0.42, () => {
        if (c.dead) return;
        const tt = c.target && !c.target.dead ? c.target : t;
        const last = i === N - 1;
        const tiles = last ? areaTiles(c.x, c.z, c.foot + 2) : coneTiles(c, tt, c.foot + 3, 0.7 + (i % 2) * 0.3);
        addHazard(game, { by: c, tiles, y: c.y, dur: last ? 0.75 : 0.5, dmg: dmgOf(c, last ? 8 : 5), kind: last ? 'slam' : 'burst', knock: last ? 2 : 0, stun: last ? 0.4 : 0, from: { x: c.x, z: c.z }, center: last ? { x: c.x, z: c.z } : undefined, radius: last ? c.foot + 2 : undefined, color: VOIDC });
        cue(c, last ? 'smash' : 'strike', tt);
        c.face(tt.x, tt.z);
      });
    }
    return true;
  },
  // Its head lunged out along a line.
  lunge(c, t, game) {
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    const to = { x: Math.round(c.x + Math.cos(ang) * 10), z: Math.round(c.z + Math.sin(ang) * 10) };
    const tiles = lineTiles(game, c, to, 10).slice(c.foot || 0);
    if (!tiles.length) return false;
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.8, dmg: dmgOf(c, 8), kind: 'beam', from: tiles[0], to: tiles[tiles.length - 1], beamColor: '#e0c8ff', halo: '#3a1a6a', width: 2, knock: 1, color: VOIDC });
    cue(c, 'breath', t);
    return true;
  },
  // Its arms scissored about it: an X across the ground round it.
  scissor(c, t, game) {
    const R = c.foot + 5;
    const tiles = [];
    for (let k = -R; k <= R; k++) for (const [sx, sz] of [[1, 1], [1, -1]]) {
      const q = { x: c.x + k, z: c.z + k * sz * sx };
      if (Math.abs(k) > c.foot && openFloor(game, q.x, q.z)) tiles.push(q);
    }
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.85, dmg: dmgOf(c, 7), kind: 'burst', color: VOIDC });
    later(c, 0.6, () => {
      const plus = [];
      for (let k = -R; k <= R; k++) for (const q of [{ x: c.x + k, z: c.z }, { x: c.x, z: c.z + k }]) if (Math.abs(k) > c.foot && openFloor(game, q.x, q.z)) plus.push(q);
      addHazard(game, { by: c, tiles: plus, y: c.y, dur: 0.75, dmg: dmgOf(c, 7), kind: 'burst', color: VOIDC });
    });
    cue(c, 'smash');
    return true;
  },
  // Spikes of the void, out along the floor at you.
  spikes(c, t, game) {
    const lines = evoPhase(c) >= 2 ? 3 : 1;
    const ang0 = Math.atan2(t.z - c.z, t.x - c.x);
    for (let l = 0; l < lines; l++) {
      const ang = ang0 + (l - (lines - 1) / 2) * 0.5;
      const to = { x: Math.round(c.x + Math.cos(ang) * 14), z: Math.round(c.z + Math.sin(ang) * 14) };
      const tiles = lineTiles(game, c, to, 14).slice(c.foot || 0);
      proc(game, c, 0.06, tiles.length, (k) => {
        const q = tiles[k];
        addHazard(game, { by: c, tiles: [q], y: c.y, dur: 0.6, dmg: dmgOf(c, 6), kind: 'erupt', color: VOIDC, onFire: (g) => g.renderer.emit(q.x, c.y + 0.6, q.z, { n: 3, color: VOID, up: 40, speed: 10, life: 0.5, glow: true }) });
      }, 0.3);
    }
    cue(c, 'slam');
    return true;
  },
  // A ring of spikes round you, closing in.
  ring(c, t, game) {
    const at = { x: t.x, z: t.z };
    for (let r = 4; r >= 1; r--) {
      later(c, (4 - r) * 0.3, () => {
        const tiles = ringTiles(at.x, at.z, r).filter((q) => openFloor(game, q.x, q.z));
        addHazard(game, { by: c, tiles, y: c.y, dur: 0.7, dmg: dmgOf(c, 6), kind: 'erupt', color: VOIDC });
      });
    }
    cue(c, 'cast', at);
    return true;
  },
  // Balls of the void loosed about the hall, bouncing off its walls.
  balls(c, t, game) {
    const n = (evoPhase(c) >= 3 ? 4 : 3) + (c.enraged ? 2 : 0);
    for (let i = 0; i < n; i++) bounceAt(game, c, { x: c.x, z: c.z }, t, { spread: (i - (n - 1) / 2) * 0.45, v: 5 + Math.random() * 2, life: 8, dmg: dmgOf(c, 4), slow: 2.5, kind: 'void' });
    game.audio?.play('void', c);
    cue(c, 'throw', t);
    if (!game.toldBalls) {
      game.toldBalls = true;
      game.ui.msg('Balls of the void, bouncing off the walls: they slow whatever they touch.', '#c8a0ff', true);
    }
    return true;
  },
  // Gone, and behind you.
  blink(c, t, game) {
    const ang = Math.atan2(c.z - t.z, c.x - t.x) + Math.PI;
    let to = null;
    for (const d of [0, 0.7, -0.7, 1.4, -1.4]) {
      const x = Math.round(t.x + Math.cos(ang + d) * (c.foot + 2));
      const z = Math.round(t.z + Math.sin(ang + d) * (c.foot + 2));
      if (inHall(c, { x, z }) && fits(game, c, x, c.y, z)) {
        to = { x, y: c.y, z };
        break;
      }
    }
    if (!to) return false;
    blinkTo(c, to, VOID);
    later(c, 0.25, () => RIFT.combo(c, c.target || t, game, 2));
    return true;
  },
  // Back to what it was, three seconds since (if it isn't hurt hard while
  // it gathers itself).
  rewind(c, t, game) {
    const now = c.fightClock || 0;
    const back = (c.mem || []).find((m) => now - m.t >= 2.75 && now - m.t < 3.6);
    if (!back || back.hp <= c.hp + c.maxHp * 0.02) return false;
    c.rewinding = { t: 0, dur: 1.4, back, hp0: c.hp };
    game.audio?.play('riser', c);
    say(c, '...again.');
    game.renderer.floatText(c.x, c.y + 4.6, c.z, 'TIME UNWINDS', '#c8a0ff');
    if (!game.toldRewind) {
      game.toldRewind = true;
      game.ui.msg('It gathers itself to go back to what it was a moment ago! Hurt it hard, now, and the thread snaps!', '#c8a0ff', true);
    }
    cue(c, 'cast');
    return true;
  },
  // Rifts torn open all over the hall, the void pouring out of them.
  storm(c, t, game) {
    let n = 0;
    for (let i = 0; i < 3; i++) {
      const a = farSpot(c, c, 4);
      const b = farSpot(c, a || c, 6);
      if (!a || !b) continue;
      const R = addRift(game, a, b, { by: c, life: 9 });
      n++;
      later(c, 1.2 + i * 0.5, () => {
        if (R.done) return;
        for (const end of [R.a, R.b]) bounceAt(game, c, end, null, { ang: Math.random() * TAU, v: 5, life: 6, dmg: dmgOf(c, 4), slow: 2, kind: 'void' });
      });
    }
    if (!n) return false;
    game.renderer.flashScreen?.('#3a1a6a', 0.35);
    cue(c, 'summon');
    say(c, 'Everywhere is here.');
    return true;
  },
  // Time fractured: where each of you stands now comes apart in a breath,
  // and again where you stand then.
  fracture(c, t, game) {
    const prey = preyIn(c);
    if (!prey.length) return false;
    for (let k = 0; k < 3; k++) {
      later(c, k * 0.9, () => {
        for (const e of preyIn(c)) {
          const at = { x: e.x, z: e.z };
          game.renderer.emit(at.x, c.y + 1, at.z, { n: 10, color: ['#1a1030', '#3a2a6a', '#c8a0ff'], up: 10, speed: 8, life: 1, shape: 'puff' });
          addHazard(game, { by: c, tiles: areaTiles(at.x, at.z, 1), y: c.y, dur: 1.1, dmg: dmgOf(c, 6), kind: 'burst', center: at, radius: 1, chill: 1.5, color: VOIDC });
        }
      });
    }
    game.audio?.play('whisper', c);
    cue(c, 'cast');
    say(c, 'You are where you were.');
    return true;
  },
  // Its Unmaking: the hall torn open at its corners, everything drawn to
  // them; then the void through all of it but beside them.
  unmaking(c, t, game) {
    const H = hallOf(c);
    const corners = [[H.x0 + 2, H.z0 + 2], [H.x1 - 2, H.z0 + 2], [H.x0 + 2, H.z1 - 2], [H.x1 - 2, H.z1 - 2]].map(([x, z]) => ({ x, z })).filter((q) => openFloor(game, q.x, q.z));
    if (corners.length < 2) return false;
    const mid = { x: Math.round((H.x0 + H.x1) / 2), z: Math.round((H.z0 + H.z1) / 2) };
    for (const q of corners) addRift(game, q, spotIn(c, mid, 1, 3) || mid, { by: c, life: 7 });
    proc(game, c, 0.6, 9, () => {
      for (const e of preyIn(c)) {
        let best = corners[0];
        for (const q of corners) if (Math.hypot(q.x - e.x, q.z - e.z) < Math.hypot(best.x - e.x, best.z - e.z)) best = q;
        drag(game, e, best, 1);
      }
    });
    const safe = new Set();
    for (const q of corners) for (const s of areaTiles(q.x, q.z, 1)) if (!(s.x === q.x && s.z === q.z)) safe.add(`${s.x},${s.z}`);
    const tiles = [];
    for (let z = H.z0; z <= H.z1; z++) for (let x = H.x0; x <= H.x1; x++) if (!safe.has(`${x},${z}`) && openFloor(game, x, z, true)) tiles.push({ x, z });
    addHazard(game, { by: c, tiles, y: c.y, dur: 5.6, dmg: dmgOf(c, 14), kind: 'hex', chill: 2, color: [60, 20, 120] });
    game.renderer.flashScreen?.('#000000', 0.5);
    say(c, 'UNMADE. ALL OF IT. UNMADE.');
    cue(c, 'summon');
    if (!game.toldUnmaking) {
      game.toldUnmaking = true;
      game.ui.msg('The hall tears open at its four corners! Get beside one of the rifts before the void comes through!', '#ff8060', true);
    }
    return true;
  },
  // Its brood of mites, out of the cracks.
  brood(c, t, game) {
    const n = game.creatures.filter((o) => !o.dead && o.summoner === c).length;
    if (n >= 4) return false;
    for (let i = 0; i < 3; i++) summon(game, 'mite', c, 4, { color: VOID, level: c.level });
    for (const o of game.creatures) if (!o.dead && o.summoner === c && !o.leash) o.leash = c.leash;
    return true;
  },
};

// Going back: a breath gathering, then there, and whole as it was then.
function rewindTick(c, dt) {
  const W = c.rewinding;
  if (!W) return false;
  const game = c.game;
  W.t += dt;
  if (Math.random() < dt * 30) game.renderer.emit(c.x + (Math.random() - 0.5) * 5, c.y + Math.random() * 4, c.z + (Math.random() - 0.5) * 5, { n: 1, color: VOID, up: -20, speed: 20, life: 0.6, glow: true, gravity: -30 });
  // (Hurt hard as it gathers: the thread snaps.)
  if (W.hp0 - c.hp >= c.maxHp * 0.05) {
    c.rewinding = null;
    c.stunT = 1.5;
    game.renderer.floatText(c.x, c.y + 4.6, c.z, 'THE THREAD SNAPS!', '#ffe070');
    game.audio?.play('shatter', c);
    game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 4, r1: 60, color: ['#ffffff', '#c8a0ff'], life: 0.5, oy: 4, flat: 0.5, thick: 2 });
    return true;
  }
  if (W.t < W.dur) return true;
  c.rewinding = null;
  const b = W.back;
  const healed = Math.max(0, Math.round((b.hp - c.hp) * 0.75));
  c.hp = Math.min(c.maxHp, c.hp + healed);
  if (fits(game, c, b.x, c.y, b.z, true) && !(c.x === b.x && c.z === b.z)) blinkTo(c, { x: b.x, y: c.y, z: b.z }, VOID);
  game.renderer.floatText(c.x, c.y + 4, c.z, `+${healed}`, '#c8a0ff');
  game.renderer.flashScreen?.('#c8a0ff', 0.3);
  for (let i = 0; i < 3; i++) game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 70 - i * 15, r1: 6, color: ['#c8a0ff', '#5ad8f0'], life: 0.5 + i * 0.1, oy: 3, flat: 0.5, thick: 2 });
  game.audio?.play('rebirth', c);
  return true;
}

// ------------------------------------------------------------ the fight
const WORKS = [
  ['unmakeCd', 4, 20, RIFT.unmaking, { enraged: true, rest: 3, fixed: true }],
  ['rewindCd', 12, 18, RIFT.rewind, { ph: 2, rest: 1.5, fixed: true }],
  ['seizeCd', 6, 10, RIFT.seize, { max: 8, rest: 1.4 }],
  ['stormCd', 10, 20, RIFT.storm, { ph: 3, rest: 0.8 }],
  ['fractureCd', 9, 16, RIFT.fracture, { ph: 4, rest: 1 }],
  ['stepCd', 4, 7, RIFT.step, {}],
  ['sliceCd', 2, 8, RIFT.slice, {}],
  ['ballsCd', 5, 12, RIFT.balls, { min: 3 }],
  ['blinkCd', 8, 11, RIFT.blink, { ph: 2, min: 4 }],
  ['ringCd', 7, 12, RIFT.ring, { ph: 2 }],
  ['spikesCd', 3, 8, RIFT.spikes, { min: 2 }],
  ['scissorCd', 6, 9, RIFT.scissor, { max: 4 }],
  ['lungeCd', 4, 7, RIFT.lunge, { min: 2, max: 9 }],
  ['broodCd', 14, 26, RIFT.brood, { ph: 3 }],
  ['comboCd', 1.5, 3.2, RIFT.combo, { max: 3, rest: 0.6 }],
];

export const RIFT_BOSSES = {
  rift_crawler: {
    name: 'The Rift Crawler', hp: 230, dmg: 7, step: 0.4, mode: 'hostile', aggro: 22, under: true, boss: true, big: true, evolved: true, anim: true,
    light: 8, brain: 'riftCrawler', phases: 4, foot: 2, riseHp: 0.6, beamY: 92,
    tint: ['#a060ff', '#5ad8f0'], sayColor: '#c8a0ff',
    phaseLines: ['', '', 'You are not where you think you are.', 'I have been here before. I will be here again.', 'THE SEAMS OF YOUR WORLD ARE MINE.'],
    riseLine: 'I was dead. I went back to before.',
    tick: (c, dt) => {
      evoTick(c, dt);
      remember(c, dt);
      reachTick(c, dt);
      // Specks of the void falling up off it.
      if (Math.random() < dt * 10) c.game.renderer.emit(c.x + (Math.random() - 0.5) * 4, c.y + 2 + Math.random() * 3, c.z + (Math.random() - 0.5) * 3, { n: 1, color: VOID, up: 14, speed: 6, gravity: -14, life: 1, glow: true });
    },
    onPhase: (c) => {
      c.stepCd = Math.min(c.stepCd ?? 0, 1);
      c.ballsCd = Math.min(c.ballsCd ?? 0, 2);
    },
    onRise: (c) => {
      c.unmakeCd = 3.5;
      c.rewindCd = 6;
    },
    drops: [['gem', 6, 10, 1], ['frost_crystal', 3, 6, 1], ['gold_ingot', 3, 6, 1], ['old_coin', 30, 60, 1], ['shard_amethyst', 2, 4, 1], ['shard_moonstone', 2, 4, 1]],
  },
};

export const RIFT_TITLES = {
  rift_crawler: { name: 'The Rift Crawler', title: 'The Thing Between', taunt: 'I have watched you come in through that door four hundred times.' },
};

export const RIFT_BRAINS = {
  riftCrawler(c, dt) {
    if (c.riseT > 0) return true;
    if (rewindTick(c, dt)) return true;
    if (c.reach && c.reach.held) return true;
    if (evoFight(c, dt, WORKS)) return true;
    return false;
  },
};

Object.assign(BRAINS, RIFT_BRAINS);
Object.assign(BOSS_TITLES, RIFT_TITLES);
