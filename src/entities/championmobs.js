// (Round 111) What's in the Hall of the Last Champion beside his squires,
// sentinels and banner-wraiths (laid out by world/deeps/champion.js, drawn
// in render/art/champion_mobs.js; the oath, the wards, the memorials, the
// fallen getting up again and the mourners' wail are in
// game/championwork.js), each made to work with the others:
//   the huntress's shade: the ghost of his huntress, or one like her, a
//     bow and a quiver and a hood, keeping to the high ground (the
//     gallery along the hall) and shooting down; her arrows pin you where
//     you stand a moment, while the squires below close in.
//   the curseling: a thing of the curse that's leaked out of him, small,
//     many-eyed, scuttling. It bites; but it would rather find the fallen
//     (a squire, a sentinel, a shade struck down in the last little while)
//     and crawl into them, and they get up again with the curse in them,
//     harder than before. Kill the curselings first.
//   the mourner: a grey-veiled woman come down from the town to the dead,
//     kneeling, weeping. She never fights. But a fight near her, or a grave
//     broken open, and she wails, and everything asleep near her wakes.
import { BRAINS } from './monsters.js';
import { ANCIENT_SPECIES } from './ancientmobs.js';
import { FY } from '../world/dungeongen.js';
import { findPath } from './pathfind.js';
import { runOf, chT, corpseNear, raiseCursed } from '../game/championwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);
const D = (o) => ({ mode: 'hostile', under: true, ancient: true, isle: 'velmarch', ...o });

// Her arrow: you're pinned where you stand a moment.
function pin(game, t) {
  if (t.rollT > 0) return;
  t.slowT = Math.max(t.slowT || 0, 2);
  t.grabbedT = Math.max(t.grabbedT || 0, 0.6);
  game.renderer.floatText(t.x, t.y + 2.4, t.z, 'pinned!', '#c8d8e8');
  const run = runOf(game, t.x);
  if (run && run.rec?.type === 'champion' && !chT(run).told.pin) {
    chT(run).told.pin = true;
    game.ui.msg('A grey arrow takes you through the cloak and pins you where you stand a moment. (The huntress\'s shade, up on the gallery: get up to her, or out of her sight.)', '#c8d8e8', true);
  }
}

export const CHAMPION_SPECIES = {
  shade_archer: D({
    name: 'Huntress\'s Shade', hp: 14, dmg: 3, step: 0.36, aggro: 12, undead: true, light: 4, brain: 'shadeArcher',
    drops: [['arrow', 2, 6, 0.7], ['old_coin', 1, 3, 0.5], ['feather', 1, 2, 0.4]],
  }),
  curseling: D({
    name: 'Curseling', hp: 6, dmg: 2, step: 0.22, aggro: 12, light: 2, brain: 'curseling', style: 'bite',
    drops: [['old_coin', 1, 1, 0.2]],
  }),
  mourner: {
    name: 'Mourner', hp: 10, dmg: 0, step: 0.5, mode: 'passive', aggro: 0, under: true, ancient: true, calm: 'mourner', isle: 'velmarch',
    drops: [['flower_red', 1, 2, 0.8], ['coin', 1, 4, 0.5]],
  },
};

// A step toward (or along a path to) a spot.
function walkTo(c, goal) {
  if (c.moving) return true;
  const game = c.game;
  if (!c.wpath || c.wi >= c.wpath.length || c.wgoal !== goal) {
    c.wpath = findPath(game.world, c.x, c.y, c.z, goal.x, FY, goal.z, { maxNodes: 1500, near: 0, partial: true, blocked: (x, z) => game.occupiedBySolid(x, c.y, z, c) });
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

export const CHAMPION_BRAINS = {
  // Up on the high ground, shooting down; never off it of herself.
  shadeArcher(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    const d = dist(c, t);
    if (c.aimAt) {
      c.aimAt.t -= dt;
      c.face(t.x, t.z);
      if (Math.random() < dt * 12) game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 1, color: ['#c8d8e8', '#ffffff'], up: 4, speed: 3, life: 0.4, glow: true });
      if (c.aimAt.t > 0) return true;
      c.aimAt = null;
      c.loosedT = 2.4 + Math.random() * 1.2;
      if (d <= 11 && Math.abs(t.y - c.y) <= 3) {
        game.shoot(c, t, Math.max(1, Math.round(c.S.dmg * (c.dmgMult || 1))), 'arrow');
        const a = game.projectiles[game.projectiles.length - 1];
        if (a) a.onHit = pin;
      }
      return true;
    }
    if (c.moving) return true;
    c.loosedT = (c.loosedT ?? 0.8) - dt;
    // (Come up to her: she fights you with the bow-stave.)
    if (d <= 1) return false;
    if (d <= 11 && c.loosedT <= 0 && Math.abs(t.y - c.y) <= 3) {
      c.aimAt = { t: 0.75 };
      return true;
    }
    // (On the high ground, she keeps it.)
    if (c.y > FY) return true;
    return d <= 11;
  },

  // To the fallen, if there are any near; otherwise at you.
  curseling(c) {
    if (c.moving) return true;
    const run = runAt(c);
    if (!run) return false;
    const q = corpseNear(run, c, 8);
    if (!q) return false;
    if (dist(c, q) <= 1) {
      raiseCursed(run, q, c);
      return true;
    }
    // (No way to it: at you, then.)
    return walkTo(c, q);
  },

  // Knelt, weeping; never shy of you, nor wandering off. (Her wail: see
  // championwork.js.)
  mourner(c, dt) {
    if (c.fleeT > 0) return false;
    c.sobT = (c.sobT ?? 2 + Math.random() * 3) - dt;
    if (c.sobT <= 0) {
      c.sobT = 3 + Math.random() * 4;
      c.game.renderer.emit(c.x, c.y + 1.5, c.z, { n: 2, color: ['#a8c8e8', '#e0f0ff'], up: -2, speed: 2, gravity: 20, life: 0.6 });
    }
    return true;
  },
};
Object.assign(BRAINS, CHAMPION_BRAINS);
// (Of the ancient places' own, as the old ones are: see ancientmobs.js.)
for (const k of ['shade_archer', 'curseling', 'mourner']) ANCIENT_SPECIES[k] = CHAMPION_SPECIES[k];
