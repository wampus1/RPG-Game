// (Round 109) What lives in the Drowned Broch beside the drowned, the
// wreckers, the crawlers and the grey seals (laid out by
// world/deeps/broch.js, drawn in render/art/broch_mobs.js; the gusts, the
// lamps, the beacon, the false lights, the strongroom and the cells are in
// game/brochwork.js), each made to work with the others:
//   the trowie: a little grey trow up out of the wall-cells, all knees and
//     nose and long fingers. It hates the light: it won't come within two
//     paces of a lit lamp, nor go for you while you stand by one; when the
//     gale blows the lamps out, they come. It bites, and its fingers are
//     in your purse as it does: off it goes with your coin to its cell and
//     into the wall, and the coin's in its hoard.
//   the lantern-bearer: a wrecker's boy with the false light on a pole. He
//     won't fight; he keeps out of your reach and holds the light up, and
//     the drowned near it are quickened by it, and more of them rise up
//     out of the water to it. Kill him and the light falls and goes out.
//   the fulmar: a grey sea-bird nesting on the ledges, harmless till you
//     come near its nest: then it spits stinking oil at you. Oiled, you're
//     slow; and oiled, the first fire you come near (a wrecker's lantern, a
//     false light, a lamp) sets you alight.
import { BRAINS } from './monsters.js';
import { FY } from '../world/dungeongen.js';
import { countItem, removeItem } from '../game/inventory.js';
import { findPath } from './pathfind.js';
import { runOf, bcT, litNear, intoCell } from '../game/brochwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);
const OIL = ['#b08428', '#e0b850', '#7a5418'];

// A trowie's bite: its fingers in your purse as it bites.
function trowieBite(game, a, v) {
  if (v.kind !== 'player' || a.stolen >= 6) return;
  const have = countItem(v.inv || [], 'coin');
  if (have <= 0) return;
  const n = Math.min(have, 1 + Math.floor(Math.random() * 3));
  removeItem(v.inv, 'coin', n);
  a.stolen = (a.stolen || 0) + n;
  a.home = null;
  game.renderer.floatText(v.x, v.y + 2.4, v.z, `${n} coin${n > 1 ? 's' : ''} snatched!`, '#ffd070');
  a.say?.(['Mine!', 'Shiny!', 'Hee!'][Math.floor(Math.random() * 3)], 1.4, '#c8d0d8');
}
// The bearer struck down: the light falls, and goes out.
function bearerDies(game, c) {
  game.renderer.emit(c.x, c.y + 1.5, c.z, { n: 18, color: ['#ffd070', '#ff9030', '#5a5040'], up: 14, speed: 20, life: 0.8 });
  game.renderer.floatText(c.x, c.y + 2.2, c.z, 'the false light falls, and goes out', '#ffd070');
}

export const BROCH_SPECIES = {
  trowie: {
    name: 'Trowie', hp: 9, dmg: 2, step: 0.24, mode: 'hostile', aggro: 9, under: true, brain: 'trowie', style: 'bite', onHit: trowieBite, isle: 'skerries',
    drops: [['old_coin', 1, 3, 0.6], ['feather', 1, 1, 0.2]],
  },
  lantern_bearer: {
    name: 'Lantern-Bearer', hp: 11, dmg: 1, step: 0.3, mode: 'hostile', aggro: 10, under: true, brain: 'lanternBearer', light: 9, onDeath: bearerDies, isle: 'skerries',
    drops: [['coin', 1, 4, 0.7], ['fish_oil', 1, 1, 0.5], ['lantern', 1, 1, 0.1]],
  },
  fulmar: {
    name: 'Fulmar', hp: 5, dmg: 0, step: 0.3, mode: 'passive', aggro: 0, under: true, calm: 'fulmar', isle: 'skerries',
    drops: [['feather', 1, 3, 0.9], ['raw_meat', 1, 1, 0.4]],
  },
};

// A step toward (or along a path to) a spot.
function walkTo(c, goal) {
  if (c.moving) return true;
  const game = c.game;
  if (!c.wpath || c.wi >= c.wpath.length || c.wgoal !== goal) {
    c.wpath = findPath(game.world, c.x, c.y, c.z, goal.x, FY, goal.z, { maxNodes: 2000, near: 1, partial: true, blocked: (x, z) => game.occupiedBySolid(x, c.y, z, c) });
    c.wi = 0;
    c.wgoal = goal;
    if (!c.wpath || !c.wpath.length) return false;
  }
  const [nx, , nz] = c.wpath[c.wi];
  if (c.tryStep(nx, nz, c.S.step)) {
    c.wi++;
    return true;
  }
  c.wpath = null;
  return false;
}

export const BROCH_BRAINS = {
  // Off with what it took to its cell, and into the wall; otherwise, at
  // you only out of the light.
  trowie(c, dt) {
    const game = c.game;
    const run = runAt(c);
    if (!run || c.moving) return !!c.moving;
    if (c.stolen > 0) {
      if (!c.home) {
        let best = null;
        let bd = 99;
        for (const q of run.data.cells || []) {
          const d = dist(q, c);
          if (d < bd) {
            bd = d;
            best = q;
          }
        }
        c.home = best || { none: true };
      }
      if (c.home.none) return false;
      const front = { x: c.home.x, z: c.home.z + 1 };
      if (dist(c, front) <= 1) {
        intoCell(run, c, c.home);
        return true;
      }
      if (!walkTo(c, front)) c.home = { none: true };
      return true;
    }
    const t = c.target;
    if (!t || t.dead) return false;
    // (By a lit lamp, you're out of its reach: it hangs back, muttering.)
    if (litNear(run, t, 2)) {
      c.mutterT = (c.mutterT ?? 0) - dt;
      if (c.mutterT <= 0) {
        c.mutterT = 3 + Math.random() * 2;
        game.renderer.floatText(c.x, c.y + 1.6, c.z, 'it shrinks from the light', '#c8d0d8');
        const T = bcT(run);
        if (!T.told.trowLight) {
          T.told.trowLight = true;
          game.ui.msg('The trowie won\'t come near the lamp. It crouches at the edge of the light, and waits for it to go out.', '#c8d0d8', true);
        }
      }
      if (dist(c, t) <= 3) {
        const dx = Math.sign(c.x - t.x) || 1;
        const dz = Math.sign(c.z - t.z) || 1;
        for (const [ox, oz] of [[dx, 0], [0, dz], [dx, dz]]) if (!litNear(run, { x: c.x + ox, z: c.z + oz }, 2) && c.tryStep(c.x + ox, c.z + oz, c.S.step)) return true;
      }
      return true;
    }
    // (Never a step into the light itself.)
    if (litNear(run, c, 2)) {
      for (const [ox, oz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!litNear(run, { x: c.x + ox, z: c.z + oz }, 2) && c.tryStep(c.x + ox, c.z + oz, c.S.step)) return true;
    }
    return false;
  },

  // Keeping out of reach with the light held up; quickening the drowned
  // about it (and calling more up out of the water: see brochwork.tick).
  lanternBearer(c, dt) {
    const game = c.game;
    const run = runAt(c);
    const t = c.target;
    c.quickT = (c.quickT ?? 0) - dt;
    if (c.quickT <= 0 && run) {
      c.quickT = 1;
      for (const o of run.creatures()) {
        if (o.dead || o.species !== 'drowned' || o.dormant || dist(o, c) > 6) continue;
        o.hasteT = Math.max(o.hasteT || 0, 1.5);
      }
    }
    if (!t || t.dead || c.moving) return !!c.moving;
    const d = dist(c, t);
    c.face(t.x, t.z);
    if (d <= 3) {
      const dx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
      const dz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
      for (const [ox, oz] of [[dx, 0], [0, dz], [dx, dz], [dz, dx], [-dz, -dx]]) if (c.tryStep(c.x + ox, c.z + oz, c.S.step)) return true;
      // (Cornered: he swings the pole at you.)
      return false;
    }
    if (d > 8) return false;
    // (Holding it up: the light swinging.)
    c.swingT = (c.swingT ?? 0) - dt;
    if (c.swingT <= 0) {
      c.swingT = 2.5;
      game.renderer.emit(c.x, c.y + 2.4, c.z, { n: 4, color: ['#ffd070', '#ff9030'], up: 6, speed: 6, life: 0.7, glow: true });
    }
    return true;
  },

  // On its nest: come near and it spits.
  fulmar(c, dt) {
    const game = c.game;
    c.spitCd = (c.spitCd ?? 0) - dt;
    if (c.fleeT > 0) return false;
    for (const p of game.everyone()) {
      if (!p || p.dead || dist(p, c) > 2 || Math.abs(p.y - c.y) > 3) continue;
      c.face(p.x, p.z);
      if (c.spitCd > 0) return true;
      c.spitCd = 2.6;
      c.doAction?.(0.4);
      // The oil: a gout of it from its beak to you.
      for (let k = 0; k <= 4; k++) {
        const f = k / 4;
        game.renderer.emit(c.x + (p.x - c.x) * f, c.y + 1 + (p.y - c.y) * f, c.z + (p.z - c.z) * f, { n: 2, color: OIL, up: 4, speed: 6, gravity: 20, life: 0.5 });
      }
      if (p.rollT > 0) return true;
      p.oiledT = Math.max(p.oiledT || 0, 10);
      p.slowT = Math.max(p.slowT || 0, 1.5);
      game.renderer.floatText(p.x, p.y + 2.4, p.z, 'oiled!', '#e0b850');
      game.audio?.play('splash', p);
      const run = runAt(c);
      const T = run && bcT(run);
      if (T && !T.told.oil) {
        T.told.oil = true;
        game.ui.msg('The fulmar spits a gout of stinking oil all over you. (Oiled, you\'re slow; and keep away from fire till it wears off: a wrecker\'s lantern, a false light, a lamp.)', '#e0b850', true);
      }
      return true;
    }
    // (Else it sits its nest, turning its head.)
    c.thinkT = (c.thinkT ?? 0) - dt;
    if (c.thinkT <= 0) {
      c.thinkT = 2 + Math.random() * 3;
      c.face(c.x + (Math.random() < 0.5 ? 1 : -1), c.z);
    }
    return true;
  },
};
Object.assign(BRAINS, BROCH_BRAINS);
