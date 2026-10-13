// (Round 105) What lives in the Leviathan's Gut beside the bone crabs, the
// bone whalers and the slimes (laid out by world/deeps/gut.js, drawn in
// render/art/gut_mobs.js; the heartbeat, the valves, the ridged floor and
// the bile are in game/gutwork.js), each made to work with the others:
//   the gutworm: a pale parasite living in a hole in the gut wall, its
//     mouth a ring of teeth. Pass its hole and it lunges and latches on:
//     you're held fast, and it drinks from you, till you strike it off (or
//     it's had its fill). In its hole it's hard to hurt; latched on, it's
//     out and open. (A whaler's line, the ridged floor: held, you go where
//     they take you.)
//   the bile blister: a swollen sac grown on the gut floor, yellow-green
//     and veined. Come by it (anything does) or strike it, and it bursts:
//     bile over everyone near, and a puddle of it that burns a while. The
//     bone crabs' shells don't mind bile.
//   the ambergris hermit: a hermit crab that wears a lump of ambergris for
//     its shell. It sits among the ambergris looking like another lump;
//     come near and it runs. Catch it, and the ambergris is yours.
import { BRAINS } from './monsters.js';
import { runOf, burst } from '../game/gutwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);

// The gutworm in its hole: blows glance off the flesh round it; latched
// on, it's out and open, and a hard enough blow strikes it off.
function wormWard(game, c, src, amount) {
  if (c.latched) {
    if (amount >= 3 && c.latched) {
      const v = c.latched;
      c.latched = null;
      c.cool = 4;
      v.rootT = 0;
      game.renderer.floatText(c.x, c.y + 2, c.z, 'struck off!', '#f0c0b0');
    }
    return amount;
  }
  if (!(c.wardNote > 0)) {
    c.wardNote = 1;
    game.renderer.floatText(c.x, c.y + 2, c.z, 'it shrinks into its hole', '#f0c0b0');
  }
  return Math.max(0, Math.round(amount * 0.3));
}
// The hermit struck: off it goes.
function hermitStruck(game, c, src, amount) {
  c.lying = false;
  if (src && src !== c) {
    c.fleeFrom = src;
    c.fleeT = 8;
  }
  return amount;
}

export const GUT_SPECIES = {
  gutworm: {
    name: 'Gutworm', hp: 14, dmg: 2, step: 9, mode: 'hostile', aggro: 3, under: true, anchored: true, brain: 'gutworm', style: 'bite', ward: wormWard, isle: 'corrow',
    drops: [['old_coin', 1, 2, 0.2], ['bone', 1, 1, 0.3]],
  },
  bile_blister: {
    name: 'Bile Blister', hp: 6, dmg: 0, step: 9, mode: 'hostile', aggro: 2, under: true, anchored: true, brain: 'bileBlister', isle: 'corrow',
    drops: [],
    // (Broken, it bursts: see gutwork.burst.)
    onDeath(game, c) {
      const run = runAt(c);
      if (run) burst(run, c);
    },
  },
  ambergris_hermit: {
    name: 'Ambergris Hermit', hp: 10, dmg: 1, step: 0.3, mode: 'passive', aggro: 0, under: true, brain: 'hermit', calm: 'hermit', ward: hermitStruck, isle: 'corrow',
    drops: [['ambergris', 1, 2, 1], ['crab_meat', 1, 1, 0.5]],
  },
};

export const GUT_BRAINS = {
  // In its hole, watching the tile before it: whoever comes by, it lunges
  // and latches on; latched, it holds them and drinks, till it's struck
  // off or has had its fill.
  gutworm(c, dt) {
    const game = c.game;
    const out = c.holeOut || { x: 0, z: 1 };
    if (c.cool > 0) c.cool -= dt;
    if (c.wardNote > 0) c.wardNote -= dt;
    if (c.latched) {
      const v = c.latched;
      c.latchT -= dt;
      if (v.dead || dist(v, c) > 1 || c.latchT <= 0) {
        c.latched = null;
        c.cool = 4;
        return true;
      }
      v.rootT = Math.max(v.rootT || 0, 0.25);
      c.face(v.x, v.z);
      c.sipT = (c.sipT ?? 0.8) - dt;
      if (c.sipT <= 0) {
        c.sipT = 0.8;
        game.damage(v, 1, c);
        c.hp = Math.min(c.maxHp, c.hp + 1);
        game.renderer.emit(v.x, v.y + 1, v.z, { n: 4, color: ['#a01828', '#e03848'], up: 8, speed: 10, life: 0.4 });
      }
      return true;
    }
    c.face(c.x + out.x, c.z + out.z);
    if (c.cool > 0) return true;
    const v = game.everyone().find((p) => p && !p.dead && dist(p, c) <= 1 && Math.abs(p.y - c.y) <= 1);
    if (!v) return true;
    c.latched = v;
    c.latchT = 4;
    c.sipT = 0.8;
    v.rootT = Math.max(v.rootT || 0, 0.25);
    game.damage(v, 2, c);
    c.doAction?.(0.4);
    game.renderer.floatText(v.x, v.y + 2.4, v.z, 'a gutworm latches on! (strike it off)', '#f0c0b0');
    game.renderer.emit(v.x, v.y + 1, v.z, { n: 10, color: ['#e8c8c0', '#a01828'], up: 12, speed: 18, life: 0.5 });
    game.audio?.play('bite', c);
    return true;
  },

  // Swelling; come by it (anything but a crab), and it bursts.
  bileBlister(c) {
    const game = c.game;
    if (c.dead) return true;
    const by = [...game.everyone(), ...game.creatures].find((e) => e && e !== c && !e.dead && e.species !== 'bone_crab' && e.species !== 'bile_blister' && dist(e, c) <= 1 && Math.abs(e.y - c.y) <= 1);
    if (by) game.damage(c, 99, c);
    return true;
  },

  // Still among the ambergris, a lump of it (till you come near: then it
  // runs).
  hermit(c) {
    const game = c.game;
    if (c.fleeT > 0) {
      c.lying = false;
      return false;
    }
    const t = game.nearestThreatTo?.(c, 3);
    if (t) {
      c.lying = false;
      c.fleeFrom = t;
      c.fleeT = 6;
      if (!(c.toldRun > 0)) {
        c.toldRun = 1;
        game.renderer.floatText(c.x, c.y + 1.8, c.z, 'the lump of ambergris gets up and runs!', '#d8d0b8');
      }
      return false;
    }
    c.lying = true;
    c.target = null;
    return true;
  },
};

Object.assign(BRAINS, GUT_BRAINS);
