// (Round 71) The Divine Alchemist, in the Athanor (see world/ancient.js):
// the eye of the great work, a vortex of gold and violet in a cage of
// gilded rings, hanging in the air of its hall, and round it its twelve
// arms, each of an element (fire, frost, acid, lightning, earth, water,
// wind, light, shadow, quicksilver, salt and aether), long and jointed
// and banded in gold, a hand at the end of each (drawn in the world: see
// render/forge_evolved.js).
//   Four of its arms are out to begin with; six in its second phase, nine
//   in its third, all twelve in its fourth. Each does what its element
//   does (a lash of fire burns, of frost chills, of earth knocks you
//   flat...), and two together do more: fire and frost a cone of
//   scalding steam; earth and fire a rift of magma running at you;
//   lightning and water a flood and then the storm into it; acid and wind
//   a gale of acid sweeping the hall (find the gap); light and shadow the
//   floor in squares, the dark ones and then the light; quicksilver and
//   salt a cage of salt grown up round you, quicksilver underfoot, aether
//   poured into it; aether and light a lattice of beams.
//   Its arms reach: they grab you (hit the hand that holds you and it lets
//   go) and swing you about and slam you down, or throw you into a wall;
//   they grab the folk who came with you; they take hold of the far side
//   of the hall and haul it across. Its eye looks on you, and burns where
//   it looks; it draws everything in to it, and lets it go in a burst; its
//   hands come down in turn where you stand; it calls up homunculi; worn,
//   it wraps itself in its arms and throws them open.
//   Its arms can be struck (a blow on a hand goes a little into it: the
//   eye takes your blows whole), and struck enough they're cut off, in a
//   burst of their element, leaving it reeling; it grows them again with
//   each phase. Risen (see evolved.js), all twelve again, and its Magnum
//   Opus: the whole floor of the hall made over, ring by ring from the
//   walls inward, element by element (find each ring's gap), and then
//   drawn into it.
import { BRAINS, addHazard, addZone, lob, lineTiles, areaTiles, summon, groundFire, BOSS_TITLES } from './monsters.js';
import { stun } from '../game/gems.js';
import { startLaser } from '../game/laser.js';
import { B } from '../world/blocks.js';
import { dist, dmgOf, hallOf, inHall, openFloor, drag, proc, work, coneTiles, circleTiles } from './bosskit.js';
import { evoFight, evoTick, evoPhase, grab, release, fling, farSpot, preyIn, TAU } from './evolved.js';
import { fits } from './footprint.js';
import { cue } from './cue.js';

// ------------------------------------------------------------ elements
// Each: its name, its colours (dark, mid, light), its glow, the kind of
// hazard it makes, and what it does to whoever it catches.
export const ELEMS = [
  { k: 'fire', name: 'Fire', pal: ['#8a2010', '#e05a20', '#ffc060'], glow: '#ff8030', kind: 'fire', burn: 2.5 },
  { k: 'frost', name: 'Frost', pal: ['#2a5a8a', '#6ab0e8', '#e0f8ff'], glow: '#a0e0ff', kind: 'cold', chill: 3 },
  { k: 'acid', name: 'Acid', pal: ['#3a5a10', '#8ac030', '#e8ff90'], glow: '#c8ff40', kind: 'acid', acid: true },
  { k: 'storm', name: 'Lightning', pal: ['#2a2a7a', '#7a7aff', '#fffbe0'], glow: '#fff8a0', kind: 'burst', stun: 0.5 },
  { k: 'stone', name: 'Earth', pal: ['#4a3a2a', '#8a7050', '#d0b890'], glow: '#e0a060', kind: 'rocks', knock: 2 },
  { k: 'tide', name: 'Water', pal: ['#103a6a', '#2a7ac0', '#a0e0ff'], glow: '#60c0ff', kind: 'cold', knock: 1, chill: 1 },
  { k: 'gale', name: 'Wind', pal: ['#4a6a6a', '#a8d0c8', '#ffffff'], glow: '#e0fff8', kind: 'burst', knock: 3 },
  { k: 'light', name: 'Light', pal: ['#a07a20', '#ffe070', '#ffffff'], glow: '#fff0a0', kind: 'burst', blind: true },
  { k: 'shadow', name: 'Shadow', pal: ['#120a20', '#3a2a5a', '#8a70c0'], glow: '#8a40ff', kind: 'hex', drain: true },
  { k: 'mercury', name: 'Quicksilver', pal: ['#3a3a4a', '#a8a8b8', '#ffffff'], glow: '#e0e0f0', kind: 'cold', chill: 2.5 },
  { k: 'salt', name: 'Salt', pal: ['#7a6a6a', '#e8dcd8', '#ffffff'], glow: '#fff0f8', kind: 'cold', root: 1.2 },
  { k: 'aether', name: 'Aether', pal: ['#3a1a6a', '#a060e0', '#ffd0ff'], glow: '#e0a0ff', kind: 'hex', burn: 1, chill: 1 },
];
const EL = Object.fromEntries(ELEMS.map((e, i) => [e.k, i]));
// The angle of an element's socket round the eye (as it's painted: see
// render/forge_evolved.js).
export const sockAng = (el) => (((el * 7) % 12) / 12) * TAU - Math.PI / 2 + TAU / 24;
// The order its arms come out in, and how many by phase.
const ORDER = ['fire', 'frost', 'storm', 'stone', 'tide', 'acid', 'gale', 'light', 'shadow', 'mercury', 'salt', 'aether'].map((k) => EL[k]);
const OUT = [0, 4, 6, 9, 12, 12];
const rgb = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const GOLD = ['#ffe070', '#ffb020', '#ffffff'];

// What an element's touch does to whoever it caught (past the hurt).
function touch(game, c, E, hit) {
  for (const e of hit) {
    if (e.dead) continue;
    if (E.acid) addZone(game, { by: c, kind: 'mist', tiles: [{ x: e.x, z: e.z }], y: e.y, life: 3, tick: 0.6, dmg: 1, slow: true, color: rgb(E.glow), puff: [E.pal[1], E.pal[2]] });
    if (E.root && e.kind === 'player' && !(e.rollT > 0)) {
      e.grabbedT = Math.max(e.grabbedT || 0, E.root);
      game.renderer.floatText(e.x, e.y + 2.4, e.z, 'crystallised! (roll free)', '#ffffff');
    }
    if (E.blind && e === game.player) game.renderer.flashScreen?.('#fff8e0', 0.5);
    if (E.drain && !c.dead) c.hp = Math.min(c.maxHp, c.hp + 4);
  }
}
// A hazard of element `E` on `tiles` in `dur`.
function elHaz(game, c, E, tiles, dur, n, o = {}) {
  return addHazard(game, {
    by: c, tiles, y: c.y, dur, dmg: dmgOf(c, n), kind: E.kind, burn: E.burn, chill: E.chill, stun: E.stun, knock: E.knock, from: o.from || { x: c.x, z: c.z }, center: o.center, radius: o.radius, color: rgb(E.glow), ...o,
    onFire: (g, h, hit) => {
      touch(g, c, E, hit);
      for (const q of h.tiles) if (Math.random() < 0.3) g.renderer.emit(q.x, c.y + 0.4, q.z, { n: 2, color: [E.pal[1], E.pal[2], E.glow], up: 26, speed: 18, life: 0.6, glow: true });
      if (o.then) o.then(g, h, hit);
    },
  });
}

// ------------------------------------------------------------ arms
// Its arms (made as soon as it's seen: the hands, the things you can hit,
// once it's fighting). Each: its element, its place round the eye (`a`),
// whether it's out yet and still on, its hand's place in the world (x, z,
// and how high, h), where it's reaching (tx, tz, th) and how fast, what
// it's doing (`mode`), what it holds.
export function armsOf(c) {
  if (c.arms) return c.arms;
  c.arms = ORDER.map((el, i) => {
    const a = (i / 12) * TAU + 0.26;
    return { i, el, a, on: i < OUT[1], alive: true, x: c.x + Math.cos(a) * 3.6, z: c.z + Math.sin(a) * 2.8, h: 1.4, tx: null, tz: null, th: 1.4, v: 8, mode: 'rest', t: 0, then: null, held: null, hand: null, cut: null };
  });
  return c.arms;
}
const live = (c) => armsOf(c).filter((a) => a.on && a.alive && !a.cut);
const freeArms = (c) => live(c).filter((a) => a.mode === 'rest');
const armOf = (c, k) => live(c).find((a) => a.el === EL[k] && a.mode === 'rest') || null;
// Its hand sent to (x, z) (at height h), `secs` to get there, then `then`.
function reach(a, x, z, h, secs, then = null, mode = 'reach') {
  const d = Math.hypot(x - a.x, z - a.z) + Math.abs(h - a.h) * 0.5;
  a.tx = x;
  a.tz = z;
  a.th = h;
  a.v = Math.max(3, d / Math.max(0.08, secs));
  a.mode = mode;
  a.then = then;
  a.t = 0;
}
function rest(a) {
  a.mode = 'rest';
  a.tx = null;
  a.then = null;
  a.held = null;
  a.v = 7;
}
// The arm nearest the way to `t`, free.
function nearestArm(c, t, pick = null) {
  const L = (pick || freeArms(c)).slice();
  L.sort((p, q) => Math.hypot(p.x - t.x, p.z - t.z) - Math.hypot(q.x - t.x, q.z - t.z));
  return L[0] || null;
}

// The hands: things you can hit (a blow on one goes a little into it).
function handHp(c) {
  return Math.max(12, Math.round(c.maxHp * 0.07));
}
function makeHand(c, a) {
  const game = c.game;
  const h = game.spawnMonster ? game.spawnMonster('alchemist_hand', Math.round(a.x), c.y, Math.round(a.z), {}) : null;
  if (!h) return null;
  h.solid = false;
  game.removeOcc?.(h);
  h.summoner = c;
  h.master = c;
  h.arm = a;
  h.inst = c.inst;
  h.level = c.level;
  h.maxHp = h.hp = handHp(c);
  h.dormant = 0;
  h.leash = null;
  a.hand = h;
  return h;
}
// Cut off: a burst of its element, and the master reels.
function sever(c, a) {
  const game = c.game;
  const E = ELEMS[a.el];
  a.alive = false;
  a.cut = { t: 0, x: a.x, z: a.z, h: a.h };
  if (a.held) release(game, c, a.held);
  a.held = null;
  a.mode = 'rest';
  const at = { x: Math.round(a.x), z: Math.round(a.z) };
  game.renderer.emit(a.x, c.y + a.h, a.z, { n: 30, color: [E.pal[1], E.pal[2], E.glow, '#ffffff'], up: 60, speed: 80, life: 0.9, glow: true });
  game.renderer.floatText(a.x, c.y + a.h + 1.6, a.z, `${E.name.toUpperCase()} ARM SEVERED!`, E.glow);
  game.audio?.play('shatter', at);
  game.audio?.play('roar', c);
  elHaz(game, c, E, areaTiles(at.x, at.z, 1, true), 0.6, 4, { center: at, radius: 1, trap: true });
  c.stunT = Math.max(c.stunT || 0, 1.1);
  c.windup = null;
  game.shake = Math.min(1.4, (game.shake || 0) + 0.6);
  cue(c, 'flinch');
  if (!game.toldSever) {
    game.toldSever = true;
    game.ui.msg('An arm comes away in a burst of its element, and the eye reels! (It grows them back as it changes.)', '#ffe070', true);
  }
}
// As it turns (or rises): the arms of its phase out, the cut ones grown
// again.
function unfurl(c, n) {
  const game = c.game;
  for (const a of armsOf(c)) {
    const was = a.on && a.alive;
    if (a.i < n) a.on = true;
    if (a.on && (!a.alive || a.cut)) {
      a.alive = true;
      a.cut = null;
    }
    if (a.on && !was) {
      const E = ELEMS[a.el];
      a.x = c.x;
      a.z = c.z;
      a.h = 2.5;
      rest(a);
      game.renderer.emit(c.x, c.y + 3, c.z, { n: 14, color: [E.pal[1], E.pal[2], E.glow], up: 40, speed: 60, life: 0.8, glow: true });
    }
    if (a.on && a.alive && a.hand && !a.hand.dead) a.hand.hp = a.hand.maxHp;
  }
}

// Each moment: its arms move to where they're going, the held carried
// with them, its hands kept where its arms are.
function tickArms(c, dt) {
  const game = c.game;
  const A = armsOf(c);
  const fighting = !c.waiting && !c.dormant;
  const t = c.fightClock || 0;
  for (const a of A) {
    if (a.cut) {
      a.cut.t += dt;
      if (a.cut.t > 1.4) a.cut.done = true;
    }
    if (!a.on || !a.alive || a.cut) {
      if (a.hand && !a.hand.dead) {
        a.hand.dead = true;
        game.removeOcc?.(a.hand);
      }
      a.hand = null;
      continue;
    }
    if (a.mode === 'rest') {
      // Held up about the eye in a halo, each out from its own socket
      // (the upper ones high and behind it, the lower ones low and before
      // it), a slow swirl to them.
      const sw = Math.sin(t * 0.9 + a.i * 1.3);
      const wrap = c.cocoonT > 0;
      const sa = sockAng(a.el) + Math.sin(t * 0.35 + a.i) * 0.12;
      const rr = wrap ? 1.1 : 3.5 + sw * 0.35;
      a.tx = c.x + Math.cos(sa) * rr;
      a.tz = c.z + Math.sin(sa) * (wrap ? 0.6 : 1.3);
      a.th = wrap ? 4.2 - Math.sin(sa) * 1.2 : 3.6 - Math.sin(sa) * 2.6 + Math.sin(t * 1.7 + a.i) * 0.4;
      a.v = wrap ? 14 : 7;
    }
    if (a.tx !== null) {
      const dx = a.tx - a.x;
      const dz = a.tz - a.z;
      const dh = a.th - a.h;
      const d = Math.hypot(dx, dz, dh * 0.5);
      const s = a.v * dt;
      if (d <= s || d < 0.05) {
        a.x = a.tx;
        a.z = a.tz;
        a.h = a.th;
        if (a.mode !== 'rest' && a.then) {
          const f = a.then;
          a.then = null;
          f(a);
        }
      } else {
        a.x += (dx / d) * s;
        a.z += (dz / d) * s;
        a.h += ((dh * 0.5) / d) * s * 2;
      }
    }
    // Whoever it holds, carried along (and let go if they've rolled free,
    // or its hand's been struck hard enough).
    if (a.held) {
      const e = a.held;
      if (e.dead || (e.kind === 'player' && !(e.grabbedT > 0))) {
        release(game, c, e);
        a.held = null;
        if (a.mode === 'hold') rest(a);
      } else {
        const x = Math.round(a.x);
        const z = Math.round(a.z);
        if ((x !== e.x || z !== e.z) && openFloor(game, x, z)) {
          const y = game.world.findStandY(x, z, e.y);
          if (y > 0) e.teleport(x, y, z);
        }
        if (e.kind === 'player') e.grabbedT = Math.max(e.grabbedT, 0.3);
      }
    }
    // Its hand, where it is (the thing you hit).
    if (fighting) {
      if (!a.hand || a.hand.dead) {
        if (a.hand && a.hand.dead) {
          a.hand = null;
          sever(c, a);
          continue;
        }
        makeHand(c, a);
      }
      const h = a.hand;
      if (h) {
        const x = Math.round(a.x);
        const z = Math.round(a.z);
        if (x !== h.x || z !== h.z) h.teleport(x, c.y, z);
        h.armH = a.h;
      }
    }
  }
}

// ------------------------------------------------------------ its works
const ALCH = {
  // A lash of an arm along the floor at you.
  lash(c, t, game) {
    const a = nearestArm(c, t);
    if (!a) return false;
    const E = ELEMS[a.el];
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    const len = 8;
    const to = { x: Math.round(c.x + Math.cos(ang) * (len + 2)), z: Math.round(c.z + Math.sin(ang) * (len + 2)) };
    const tiles = lineTiles(game, c, to, len + 2).filter((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) > (c.foot || 0));
    if (!tiles.length) return false;
    const end = tiles[tiles.length - 1];
    const dur = 0.85;
    // (Raised, then down along the line, out to its end.)
    reach(a, c.x + Math.cos(ang) * 2.5, c.z + Math.sin(ang) * 2.5, 3.6, dur * 0.7, (q) => reach(q, end.x, end.z, 0.3, dur * 0.3 + 0.05, (k) => {
      k.t = 0;
      setTimeout0(c, 0.35, () => rest(k));
    }));
    elHaz(game, c, E, tiles, dur, 6, { center: tiles[Math.floor(tiles.length / 2)] });
    cue(c, 'strike', t);
    return true;
  },
  // Its hand down on you: grabbed, then swung and slammed, or thrown.
  grasp(c, t, game) {
    const prey = preyIn(c).filter((e) => !e.heldBy && dist(c, e) <= 10);
    const e = prey.includes(t) && Math.random() < 0.7 ? t : prey[Math.floor(Math.random() * prey.length)];
    if (!e) return false;
    const a = nearestArm(c, e);
    if (!a) return false;
    const at = { x: e.x, z: e.z };
    const dur = 0.95;
    reach(a, at.x, at.z, 2.6, dur * 0.75, (q) => reach(q, at.x, at.z, 0.5, dur * 0.25 + 0.02, () => {}, 'reach'), 'reach');
    addHazard(game, {
      by: c, tiles: [at], y: c.y, dur, dmg: 0, kind: 'burst', center: at, radius: 0.6, color: rgb(ELEMS[a.el].glow), quiet: true,
      onFire: (g) => {
        if (!a.alive || a.cut) return;
        const caught = !e.dead && Math.max(Math.abs(e.x - at.x), Math.abs(e.z - at.z)) <= 1 && !(e.rollT > 0) && Math.abs(e.y - c.y) <= 1;
        if (!caught) {
          g.renderer.floatText(at.x, c.y + 2, at.z, 'missed', '#c8e8ff');
          rest(a);
          return;
        }
        grab(g, c, e, 4);
        a.held = e;
        a.mode = 'hold';
        a.grabHp = a.hand ? a.hand.hp : 0;
        g.audio?.play('chain', e);
        if (e === g.player && !g.toldHand) {
          g.toldHand = true;
          g.ui.msg('Its hand closes round you! (Roll free, or strike the hand hard enough and it lets go.)', '#ffd070', true);
        }
        setTimeout0(c, 0.7, () => {
          if (a.held !== e || e.dead) return;
          if (Math.random() < 0.5) swingSlam(c, a, e);
          else throwFrom(c, a, e);
        });
      },
    });
    cue(c, 'cast', at);
    return true;
  },
  // Its arms take hold of the far side of its hall and haul it over.
  haul(c, t, game) {
    const to = farSpot(c, c, 6);
    if (!to || !fits(game, c, to.x, to.y, to.z, true)) return false;
    const L = freeArms(c);
    if (L.length < 2) return false;
    const ang = Math.atan2(to.z - c.z, to.x - c.x);
    const H = hallOf(c);
    const ax = Math.max(H.x0, Math.min(H.x1, Math.round(to.x + Math.cos(ang) * 3)));
    const az = Math.max(H.z0, Math.min(H.z1, Math.round(to.z + Math.sin(ang) * 3)));
    const pair = L.sort((p, q) => Math.abs(Math.atan2(Math.sin(p.a - ang), Math.cos(p.a - ang))) - Math.abs(Math.atan2(Math.sin(q.a - ang), Math.cos(q.a - ang)))).slice(0, 2);
    let n = 0;
    const go = () => {
      if (++n < pair.length) return;
      c.haul = { to, t: 0, step: 0 };
      game.audio?.play('chain', c);
    };
    pair.forEach((a, k) => reach(a, ax + (k ? 1 : -1) * Math.round(Math.sin(ang) * 1.5), az + (k ? -1 : 1) * Math.round(Math.cos(ang) * 1.5), 0.4, 0.55, go, 'hold'));
    c.haulArms = pair;
    // Where it'll land: the ground round it.
    const R = (c.foot || 0) + 1;
    addHazard(game, { by: c, tiles: areaTiles(to.x, to.z, R), y: c.y, dur: 1.6, dmg: dmgOf(c, 6), kind: 'slam', knock: 2, from: to, center: to, radius: R, color: [255, 220, 120] });
    cue(c, 'cast', to);
    return true;
  },
  // A volley: each free arm lobs a ball of its element.
  volley(c, t, game) {
    const L = freeArms(c).slice(0, 6);
    if (L.length < 2) return false;
    L.forEach((a, k) => {
      const E = ELEMS[a.el];
      reach(a, c.x + Math.cos(a.a) * 2.4, c.z + Math.sin(a.a) * 2, 4.2, 0.35, (q) => setTimeout0(c, 0.2 + k * 0.18, () => {
        rest(q);
        if (c.dead) return;
        const tx = t.x + Math.round((Math.random() - 0.5) * (k ? 4 : 0));
        const tz = t.z + Math.round((Math.random() - 0.5) * (k ? 4 : 0));
        lob(game, { x: Math.round(q.x), z: Math.round(q.z), y: c.y + 2, isBoss: true, S: c.S, id: c.id, summoner: c, dead: false }, tx, tz, {
          tint: rgb(E.glow),
          onLand: (g, x, z) => elHaz(g, c, E, areaTiles(x, z, 1, true), 0.5, 5, { center: { x, z }, radius: 1 }),
        });
      }), 'reach');
    });
    cue(c, 'throw', t);
    return true;
  },
  // Fire and frost: steam, in a cone.
  steam(c, t, game) {
    const f = armOf(c, 'fire');
    const i = armOf(c, 'frost');
    if (!f || !i) return false;
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    for (const a of [f, i]) reach(a, c.x + Math.cos(ang) * 3, c.z + Math.sin(ang) * 3, 2.2, 0.6, (q) => setTimeout0(c, 0.9, () => rest(q)), 'hold');
    const tiles = coneTiles(c, t, 8, 0.6).filter((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) > (c.foot || 0));
    addHazard(game, {
      by: c, tiles, y: c.y, dur: 1.1, dmg: dmgOf(c, 7), kind: 'fire', burn: 1.5, chill: 2, color: [230, 230, 240],
      onFire: (g) => {
        addZone(g, { by: c, kind: 'mist', tiles, y: c.y, life: 3, tick: 0.6, dmg: 1, slow: true, color: [220, 220, 230], puff: ['#ffffff', '#e0e8f0', '#c8d0d8'] });
        for (const q of tiles) if (Math.random() < 0.3) g.renderer.emit(q.x, c.y + 0.4, q.z, { n: 3, color: ['#ffffff', '#e0e8f0'], up: 30, speed: 20, life: 0.9, shape: 'puff' });
        g.audio?.play('hiss', c);
      },
    });
    shoutC(c, 'Solve et coagula!');
    cue(c, 'breath', t);
    return true;
  },
  // Earth and fire: a rift of magma running out at you.
  magma(c, t, game) {
    const s = armOf(c, 'stone');
    const f = armOf(c, 'fire');
    if (!s || !f) return false;
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    for (const a of [s, f]) reach(a, c.x + Math.cos(ang) * 3.2 + (a === s ? 0.8 : -0.8), c.z + Math.sin(ang) * 3.2, 0.2, 0.7, (q) => setTimeout0(c, 1.5, () => rest(q)), 'hold');
    const to = { x: Math.round(c.x + Math.cos(ang) * 14), z: Math.round(c.z + Math.sin(ang) * 14) };
    const tiles = lineTiles(game, c, to, 14).filter((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) > (c.foot || 0));
    proc(game, c, 0.07, tiles.length, (k) => {
      const q = tiles[k];
      const side = [q, { x: q.x + Math.round(-Math.sin(ang)), z: q.z + Math.round(Math.cos(ang)) }, { x: q.x - Math.round(-Math.sin(ang)), z: q.z - Math.round(Math.cos(ang)) }];
      addHazard(game, { by: c, tiles: side, y: c.y, dur: 0.75, dmg: dmgOf(c, 7), kind: 'erupt', burn: 2, color: [255, 110, 30], onFire: (g) => {
        if (Math.random() < 0.6) groundFire(g, q.x, q.z, c.y, c, false, 0);
      } });
    }, 0.7);
    game.shake = Math.min(1.2, (game.shake || 0) + 0.5);
    cue(c, 'slam');
    shoutC(c, 'Calcinatio!');
    return true;
  },
  // Lightning and water: a flood round you, and the storm into it.
  storm(c, t, game) {
    const w = armOf(c, 'tide');
    const s = armOf(c, 'storm');
    if (!w || !s) return false;
    const at = { x: t.x, z: t.z };
    const wet = areaTiles(at.x, at.z, 2, true).filter((q) => openFloor(game, q.x, q.z, true));
    reach(w, at.x, at.z, 2.4, 0.6, (q) => setTimeout0(c, 0.4, () => rest(q)), 'hold');
    addHazard(game, { by: c, tiles: wet, y: c.y, dur: 0.9, dmg: dmgOf(c, 3), kind: 'cold', knock: 1, from: at, center: at, radius: 2, color: [80, 160, 230], onFire: (g) => {
      addZone(g, { by: c, kind: 'mist', tiles: wet, y: c.y, life: 3.2, color: [80, 160, 230], puff: ['#60c0ff', '#a0e0ff'] });
      g.audio?.play('splash', at);
      reach(s, at.x, at.z, 4.5, 0.4, (q) => setTimeout0(c, 0.9, () => rest(q)), 'hold');
      addHazard(g, { by: c, tiles: wet, y: c.y, dur: 1.2, dmg: dmgOf(c, 9), kind: 'burst', stun: 0.7, center: at, radius: 2, color: [255, 250, 160], onFire: (g2) => {
        for (const q of wet) if (Math.random() < 0.35) g2.renderer.effect?.({ type: 'bolt', from: 'sky', wx: q.x, wy: c.y, wz: q.z, tx: q.x, ty: c.y, tz: q.z, life: 0.4, oy: -4 });
        g2.flash = Math.max(g2.flash || 0, 0.3);
        g2.audio?.play('thunder', at);
      } });
    } });
    cue(c, 'cast', at);
    shoutC(c, 'Let the waters conduct the heavens!');
    return true;
  },
  // Acid and wind: a gale of acid across the hall, with a gap in it.
  gale(c, t, game) {
    const a = armOf(c, 'acid');
    const g = armOf(c, 'gale');
    if (!a || !g) return false;
    const H = hallOf(c);
    const across = Math.random() < 0.5;
    const from = Math.random() < 0.5;
    const n = across ? H.z1 - H.z0 + 1 : H.x1 - H.x0 + 1;
    const span = across ? [H.x0, H.x1] : [H.z0, H.z1];
    for (const q of [a, g]) reach(q, across ? (H.x0 + H.x1) / 2 : from ? H.x0 + 1 : H.x1 - 1, across ? (from ? H.z0 + 1 : H.z1 - 1) : (H.z0 + H.z1) / 2, 3.5, 0.6, (k) => setTimeout0(c, n * 0.3, () => rest(k)), 'hold');
    let gap = span[0] + 2 + Math.floor(Math.random() * Math.max(1, span[1] - span[0] - 4));
    proc(game, c, 0.3, n, (k) => {
      const row = across ? (from ? H.z0 + k : H.z1 - k) : from ? H.x0 + k : H.x1 - k;
      gap = Math.max(span[0] + 1, Math.min(span[1] - 1, gap + Math.round((Math.random() - 0.5) * 2)));
      const tiles = [];
      for (let s = span[0]; s <= span[1]; s++) {
        if (Math.abs(s - gap) <= 1) continue;
        const q = across ? { x: s, z: row } : { x: row, z: s };
        if (openFloor(game, q.x, q.z, true)) tiles.push(q);
      }
      if (tiles.length) addHazard(game, { by: c, tiles, y: c.y, dur: 0.8, dmg: dmgOf(c, 5), kind: 'acid', knock: 1, from: across ? { x: tiles[0].x, z: row - (from ? 1 : -1) } : { x: row - (from ? 1 : -1), z: tiles[0].z }, color: [170, 230, 70] });
    }, 0.4);
    game.audio?.play('wind', c);
    cue(c, 'cast');
    shoutC(c, 'Dissolve!');
    return true;
  },
  // Light and shadow: the floor in squares, the dark ones, then the
  // light.
  eclipse(c, t, game) {
    const l = armOf(c, 'light');
    const s = armOf(c, 'shadow');
    if (!l || !s) return false;
    reach(l, c.x - 2, c.z - 1, 5, 0.5, (q) => setTimeout0(c, 2.2, () => rest(q)), 'hold');
    reach(s, c.x + 2, c.z - 1, 5, 0.5, (q) => setTimeout0(c, 2.2, () => rest(q)), 'hold');
    const R = 8;
    const dark = [];
    const lit = [];
    for (let dz = -R; dz <= R; dz++) for (let dx = -R; dx <= R; dx++) {
      const q = { x: c.x + dx, z: c.z + dz };
      if (Math.max(Math.abs(dx), Math.abs(dz)) <= (c.foot || 0) || !inHall(c, q) || !openFloor(game, q.x, q.z, true)) continue;
      ((Math.floor((q.x + 100) / 2) + Math.floor((q.z + 100) / 2)) % 2 ? dark : lit).push(q);
    }
    addHazard(game, { by: c, tiles: dark, y: c.y, dur: 1.2, dmg: dmgOf(c, 7), kind: 'hex', color: [90, 50, 160], onFire: (g, h, hit) => touch(g, c, ELEMS[EL.shadow], hit) });
    addHazard(game, { by: c, tiles: lit, y: c.y, dur: 2.3, dmg: dmgOf(c, 7), kind: 'burst', color: [255, 240, 160], onFire: (g, h, hit) => touch(g, c, ELEMS[EL.light], hit) });
    game.renderer.flashScreen?.('#000000', 0.4);
    cue(c, 'cast');
    shoutC(c, 'Nigredo... and ALBEDO!');
    return true;
  },
  // Quicksilver and salt: a cage of salt grown up round you, quicksilver
  // underfoot; aether poured in.
  cage(c, t, game) {
    const m = armOf(c, 'mercury');
    const s = armOf(c, 'salt');
    if (!m || !s) return false;
    const at = { x: t.x, z: t.z };
    const ring = circleTiles(at.x, at.z, 2, 0.8).filter((q) => openFloor(game, q.x, q.z));
    // (Never closed all the way round: a pace left to slip out by.)
    const gapAt = ring[Math.floor(Math.random() * ring.length)];
    const wall = ring.filter((q) => !gapAt || Math.max(Math.abs(q.x - gapAt.x), Math.abs(q.z - gapAt.z)) > 0);
    const inside = areaTiles(at.x, at.z, 1).filter((q) => openFloor(game, q.x, q.z));
    reach(s, at.x + 2, at.z, 1.4, 0.6, (q) => setTimeout0(c, 1, () => rest(q)), 'hold');
    reach(m, at.x - 2, at.z, 1.4, 0.6, (q) => setTimeout0(c, 1, () => rest(q)), 'hold');
    addHazard(game, { by: c, tiles: wall, y: c.y, dur: 1.1, dmg: dmgOf(c, 4), kind: 'cold', color: [240, 230, 235], onFire: (g) => {
      for (const q of wall) work(g, q.x, c.y, q.z, B.salt_crystal, 5, c);
      addZone(g, { by: c, kind: 'mist', tiles: inside, y: c.y, life: 4.5, slow: true, tick: 0.8, dmg: 1, color: [200, 200, 215], puff: ['#e8e8f0', '#a8a8b8'] });
      g.audio?.play('salt_song', at);
      const ae = armOf(c, 'aether');
      if (ae) {
        reach(ae, at.x, at.z, 4, 0.5, (q) => setTimeout0(c, 1, () => rest(q)), 'hold');
        addHazard(g, { by: c, tiles: inside, y: c.y, dur: 1.4, dmg: dmgOf(c, 8), kind: 'hex', burn: 1, chill: 1, center: at, radius: 1, color: [200, 140, 255] });
      }
    } });
    cue(c, 'cast', at);
    shoutC(c, 'Coagula.');
    return true;
  },
  // Aether and light: a lattice of beams, the rows and then the columns.
  lattice(c, t, game) {
    const ae = armOf(c, 'aether');
    const l = armOf(c, 'light');
    if (!ae || !l) return false;
    const H = hallOf(c);
    for (const q of [ae, l]) reach(q, c.x + (q === ae ? -1.5 : 1.5), c.z, 6, 0.5, (k) => setTimeout0(c, 2.6, () => rest(k)), 'hold');
    const off = Math.floor(Math.random() * 3);
    const rows = [];
    const cols = [];
    for (let z = H.z0; z <= H.z1; z++) if ((z + off) % 3 === 0) for (let x = H.x0; x <= H.x1; x++) if (openFloor(game, x, z, true)) rows.push({ x, z });
    for (let x = H.x0; x <= H.x1; x++) if ((x + off + 1) % 3 === 0) for (let z = H.z0; z <= H.z1; z++) if (openFloor(game, x, z, true)) cols.push({ x, z });
    addHazard(game, { by: c, tiles: rows, y: c.y, dur: 1.2, dmg: dmgOf(c, 6), kind: 'burst', color: [230, 170, 255] });
    addHazard(game, { by: c, tiles: cols, y: c.y, dur: 2.2, dmg: dmgOf(c, 6), kind: 'burst', color: [255, 240, 170] });
    cue(c, 'beam');
    shoutC(c, 'Behold the lattice of the world.');
    return true;
  },
  // Its eye's gaze: a beam turned slowly after you.
  gaze(c, t, game) {
    if ((game.lasers || []).some((L) => L.by === c)) return false;
    const ang = Math.atan2(t.z - c.z, t.x - c.x);
    startLaser(game, { by: c, ang: ang + (Math.random() < 0.5 ? 0.7 : -0.7), aim: () => (c.target && !c.target.dead ? Math.atan2(c.target.z - c.z, c.target.x - c.x) : null), turn: 0.55, len: 15, charge: 1.1, dur: evoPhase(c) >= 4 ? 4 : 3, dmg: dmgOf(c, 3), tick: 0.3, width: 1, fire: false, hue: 'gold' });
    shoutC(c, 'LOOK UPON THE WORK.');
    return true;
  },
  // Everything drawn in to it, and let go in a burst.
  well(c, t, game) {
    const R = (c.foot || 0) + 2;
    const prey = () => preyIn(c);
    game.audio?.play('void', c);
    proc(game, c, 0.45, 7, () => {
      for (const e of prey()) if (dist(c, e) > 0 && dist(c, e) <= 10) drag(game, e, c, 1);
      game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 90, r1: 10, color: ['#c8a0ff', '#ffe070'], life: 0.45, oy: 3, flat: 0.5, thick: 2 });
    });
    addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, R), y: c.y, dur: 3.3, dmg: dmgOf(c, 9), kind: 'blast', knock: 3, from: c, center: { x: c.x, z: c.z }, radius: R, color: [220, 180, 255] });
    cue(c, 'summon');
    shoutC(c, 'Come. Be refined.');
    return true;
  },
  // Its hands down in turn where you stand.
  hammer(c, t, game) {
    const L = freeArms(c).slice(0, evoPhase(c) >= 3 ? 4 : 3);
    if (L.length < 2) return false;
    L.forEach((a, k) => setTimeout0(c, k * 0.4, () => {
      if (!a.alive || a.cut || a.mode !== 'rest' || c.dead) return;
      const tt = c.target && !c.target.dead ? c.target : t;
      const at = { x: tt.x + (k ? Math.round((Math.random() - 0.5) * 2) : 0), z: tt.z + (k ? Math.round((Math.random() - 0.5) * 2) : 0) };
      const E = ELEMS[a.el];
      reach(a, at.x, at.z, 3.2, 0.55, (q) => reach(q, at.x, at.z, 0.2, 0.3, (k2) => setTimeout0(c, 0.3, () => rest(k2))), 'reach');
      elHaz(game, c, E, areaTiles(at.x, at.z, 1), 0.9, 6, { center: at, radius: 1, knock: E.knock ?? 1 });
    }));
    cue(c, 'slam');
    return true;
  },
  // Homunculi, out of the floor.
  homunculi(c, t, game) {
    const n = game.creatures.filter((o) => !o.dead && o.summoner === c && o.species !== 'alchemist_hand').length;
    if (n >= 4) return false;
    for (let i = 0; i < 2; i++) summon(game, Math.random() < 0.5 ? 'wisp' : 'slime', c, 4, { color: GOLD, level: c.level });
    for (const o of game.creatures) if (!o.dead && o.summoner === c && !o.leash && o.species !== 'alchemist_hand') o.leash = c.leash;
    shoutC(c, 'Rise, little ones. Rise and be made.');
    return true;
  },
  // Wrapped in its arms a moment (your blows mostly on them), then thrown
  // open.
  cocoon(c, t, game) {
    if (live(c).length < 3) return false;
    c.cocoonT = 2.4;
    for (const a of live(c)) if (a.held) release(game, c, a.held);
    for (const a of live(c)) rest(a);
    const R = (c.foot || 0) + 3;
    addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, R, true), y: c.y, dur: 2.4, dmg: dmgOf(c, 8), kind: 'blast', knock: 3, from: c, center: { x: c.x, z: c.z }, radius: R, color: [255, 220, 140] });
    game.audio?.play('chain', c);
    cue(c, 'flex');
    return true;
  },
  // Its last work: the whole floor made over, ring by ring, from the walls
  // in, element by element (each ring with its gap), and then drawn in.
  opus(c, t, game) {
    const H = hallOf(c);
    const far = Math.ceil(Math.max(c.x - H.x0, H.x1 - c.x, c.z - H.z0, H.z1 - c.z));
    const rings = [];
    for (let r = far; r >= (c.foot || 0) + 2; r -= 2) rings.push(r);
    for (const a of live(c)) reach(a, c.x + Math.cos(a.a) * 2, c.z + Math.sin(a.a) * 1.6, 6, 0.6, (q) => setTimeout0(c, rings.length * 0.55 + 1, () => rest(q)), 'hold');
    proc(game, c, 0.55, rings.length, (k) => {
      const r = rings[k];
      const E = ELEMS[(k * 5) % 12];
      const gapA = Math.random() * TAU;
      const tiles = circleTiles(c.x, c.z, r, 1.6).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z, true)).filter((q) => {
        const a = Math.atan2(q.z - c.z, q.x - c.x);
        return Math.abs(Math.atan2(Math.sin(a - gapA), Math.cos(a - gapA))) > 0.42;
      });
      elHaz(game, c, E, tiles, 1.0, 7, {});
    }, 0.4);
    setTimeout0(c, rings.length * 0.55 + 0.6, () => ALCH.well(c, t, game));
    game.renderer.flashScreen?.('#ffe070', 0.4);
    shoutC(c, 'MAGNUM OPUS! THE GREAT WORK IS COMPLETE!');
    cue(c, 'summon');
    return true;
  },
};

// Thrown about in its hand: swung round over its head and brought down
// somewhere else, hard.
function swingSlam(c, a, e) {
  const game = c.game;
  const to = farSpot(c, e, 4) || { x: c.x + 4, z: c.z };
  reach(a, (c.x + to.x) / 2, (c.z + to.z) / 2, 5, 0.45, (q) => reach(q, to.x, to.z, 0.3, 0.3, (k) => {
    if (k.held === e) {
      release(game, c, e);
      k.held = null;
      game.damage(e, dmgOf(c, 9), c);
      stun(e, 0.6);
      game.shake = Math.min(1.5, (game.shake || 0) + 0.8);
      game.audio?.play('thud', e);
      game.renderer.emit(e.x, e.y + 0.3, e.z, { n: 18, color: ['#e0d0b0', '#a08860'], up: 30, speed: 60, life: 0.6, shape: 'puff' });
      game.renderer.floatText(e.x, e.y + 2.6, e.z, 'SLAMMED!', '#ff8060');
    }
    setTimeout0(c, 0.3, () => rest(k));
  }), 'hold');
}
// Thrown: hurled at the nearest wall.
function throwFrom(c, a, e) {
  const game = c.game;
  const ang = Math.atan2(e.z - c.z, e.x - c.x);
  reach(a, e.x - Math.cos(ang), e.z - Math.sin(ang), 3, 0.3, (q) => {
    if (q.held === e) {
      q.held = null;
      fling(game, c, e, { x: e.x + Math.cos(ang) * 10, z: e.z + Math.sin(ang) * 10 }, 9, dmgOf(c, 6));
    }
    setTimeout0(c, 0.2, () => rest(q));
  }, 'hold');
}

// A thing to do in `secs` (unless it's fallen by then).
function setTimeout0(c, secs, fn) {
  proc(c.game, c, 1, 1, fn, secs);
}
function shoutC(c, line) {
  c.say?.(line, 2.4, '#ffe070');
}

// Gliding over to where its arms have hold: a pace at a time, quick.
function haulTick(c, dt) {
  const H = c.haul;
  if (!H) return false;
  const game = c.game;
  H.t += dt;
  if (c.moving) return true;
  const dx = Math.sign(H.to.x - c.x);
  const dz = Math.sign(H.to.z - c.z);
  const done = (!dx && !dz) || H.t > 3;
  if (!done) {
    let moved = false;
    for (const [sx, sz] of [[dx, dz], [dx, 0], [0, dz]]) {
      if (!sx && !sz) continue;
      const nx = c.x + sx;
      const nz = c.z + sz;
      if (!fits(game, c, nx, c.y, nz, true)) continue;
      c.startMove(nx, c.y, nz, 0.07);
      moved = true;
      break;
    }
    if (moved) return true;
  }
  c.haul = null;
  for (const a of c.haulArms || []) rest(a);
  c.haulArms = null;
  game.shake = Math.min(1.4, (game.shake || 0) + 0.6);
  game.audio?.play('boom', c);
  return true;
}

// ------------------------------------------------------------ the fight
const WORKS = [
  ['opusCd', 4, 20, ALCH.opus, { enraged: true, rest: 3, fixed: true }],
  ['cocoonCd', 18, 20, ALCH.cocoon, { ph: 2, when: (c) => (c.meleeT || 0) > 4, rest: 1 }],
  ['graspCd', 6, 9, ALCH.grasp, { max: 10, rest: 1.2 }],
  ['steamCd', 5, 13, ALCH.steam, { max: 9 }],
  ['magmaCd', 9, 14, ALCH.magma, {}],
  ['stormCd', 7, 14, ALCH.storm, { ph: 2 }],
  ['galeCd', 9, 18, ALCH.gale, { ph: 3, rest: 1 }],
  ['eclipseCd', 8, 17, ALCH.eclipse, { ph: 3, rest: 0.8 }],
  ['cageCd', 8, 16, ALCH.cage, { ph: 4 }],
  ['latticeCd', 10, 17, ALCH.lattice, { ph: 4, rest: 0.6 }],
  ['gazeCd', 10, 15, ALCH.gaze, { ph: 2, min: 3, rest: 1 }],
  ['wellCd', 14, 19, ALCH.well, { ph: 2, rest: 1 }],
  ['haulCd', 7, 11, ALCH.haul, { rest: 0.6 }],
  ['hammerCd', 4, 7, ALCH.hammer, {}],
  ['volleyCd', 3, 7, ALCH.volley, { min: 3 }],
  ['homCd', 12, 24, ALCH.homunculi, { ph: 2 }],
  ['lashCd', 1.5, 2.6, ALCH.lash, { max: 9 }],
];

export const ALCHEMIST_BOSSES = {
  divine_alchemist: {
    name: 'The Divine Alchemist', hp: 240, dmg: 7, step: 0.5, mode: 'hostile', aggro: 22, under: true, boss: true, big: true, evolved: true, floats: true, anim: true,
    light: 12, brain: 'divineAlchemist', range: 5, phases: 4, foot: 2, riseHp: 0.6, beamY: 66,
    tint: ['#ffd060', '#c8a0ff'], sayColor: '#ffe070',
    phaseLines: ['', '', 'The second operation: DISSOLUTION.', 'The third operation: SEPARATION. Your parts from your whole.', 'The fourth operation: CONJUNCTION! All twelve as one!'],
    riseLine: 'You cannot kill the Work. The Work only... CHANGES.',
    tick: (c, dt) => {
      evoTick(c, dt);
      tickArms(c, dt);
      if (c.cocoonT > 0) c.cocoonT -= dt;
      // (How long you've stood at its eye, hitting it.)
      const near = preyIn(c).some((e) => e.kind === 'player' && dist(c, e) <= 1);
      c.meleeT = near ? (c.meleeT || 0) + dt : Math.max(0, (c.meleeT || 0) - dt * 2);
      // Its eye throws off its light.
      if (Math.random() < dt * 8) c.game.renderer.emit(c.x + (Math.random() - 0.5) * 3, c.y + 3.6, c.z + (Math.random() - 0.5) * 2, { n: 1, color: GOLD, up: 10, speed: 8, gravity: -10, life: 1, glow: true });
    },
    onPhase: (c, ph) => {
      unfurl(c, OUT[Math.min(ph, 5)]);
      c.cocoonCd = Math.min(c.cocoonCd ?? 0, 4);
    },
    onRise: (c) => {
      unfurl(c, 12);
      c.opusCd = 3.5;
    },
    // A blow on it while it's wrapped in its arms: mostly on them.
    ward: (game, c, src, n) => {
      if (!(c.cocoonT > 0)) return n;
      if (!(c.wardNote > 0)) {
        c.wardNote = 0.7;
        game.renderer.floatText(c.x, c.y + 4, c.z, 'wrapped in its arms', '#ffe070');
      }
      return Math.max(1, Math.round(n * 0.25));
    },
    drops: [['gold_ingot', 6, 12, 1], ['gem', 4, 8, 1], ['frost_crystal', 3, 6, 1], ['old_coin', 30, 60, 1], ['shard_topaz', 2, 4, 1], ['shard_sapphire', 2, 4, 1]],
  },
  // One of its hands: what you strike when you strike its arms (see
  // makeHand). Drawn with its arm (render/forge_evolved.js), never alone.
  alchemist_hand: {
    name: 'Elemental Hand', hp: 20, dmg: 0, step: 9, mode: 'hostile', aggro: 0, under: true, anchored: true, floats: true, unseen: true, light: 5, brain: 'alchemistHand', drops: [],
    // (A blow on a hand: part of it goes into the eye; struck hard while
    // it holds someone, it lets them go.)
    ward: (game, h, src, n) => {
      const c = h.master;
      if (c && !c.dead && !(c.riseT > 0)) {
        game.dotHit = true;
        // (No more of it than the hand had left to give.)
        const k = Math.max(1, Math.round(Math.min(n, Math.max(0, h.hp)) * 0.4));
        game.damage(c, k, src);
        game.dotHit = false;
      }
      const a = h.arm;
      if (a && a.held && a.grabHp && a.grabHp - (h.hp - n) >= h.maxHp * 0.12) {
        const e = a.held;
        release(game, c, e);
        a.held = null;
        rest(a);
        game.renderer.floatText(h.x, h.y + 2.4, h.z, 'it lets go!', '#c8ffc8');
      }
      return n;
    },
  },
};

export const ALCHEMIST_TITLES = {
  divine_alchemist: { name: 'The Divine Alchemist', title: 'Eye of the Great Work', taunt: 'Lead. Ash. Salt. And you, little philosopher? What will you become?' },
};

export const ALCHEMIST_BRAINS = {
  divineAlchemist(c, dt) {
    if (c.riseT > 0) return true;
    if (haulTick(c, dt)) return true;
    if (c.cocoonT > 0) return true;
    if (evoFight(c, dt, WORKS)) return true;
    // (Its hands busy, it hangs where it is, turning to keep you in its eye.)
    const t = c.target;
    if (t && live(c).some((a) => a.mode !== 'rest')) {
      c.face(t.x, t.z);
      return true;
    }
    return false;
  },
  alchemistHand(h) {
    // (Moved by its arm: see tickArms. Gone with its master.)
    if (!h.master || h.master.dead) h.dead = true;
    return true;
  },
};

Object.assign(BRAINS, ALCHEMIST_BRAINS);
Object.assign(BOSS_TITLES, ALCHEMIST_TITLES);
export { live as alchemistArms };
