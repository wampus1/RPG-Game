// (Round 112) What's in the Sundered Reach beside its stalkers, motes and
// echoes (laid out by world/deeps/rift.js, drawn in
// render/art/rift_mobs.js; the threads snapping, the shardbacks turning
// and going up, the watchers remembering are in game/riftwork.js), each
// made to work with the others:
//   the rift weaver: a long-legged thing of the void the size of a dog,
//     its body a lantern of black glass. It keeps off, and strings threads
//     across the floor at you, that stick where you step in them; and the
//     stalkers come for whoever's stuck. A shard mote going up snaps the
//     threads near it.
//   the shardback: a slow grazer of the crystal-caverns, a beetle as big
//     as a pony with the void's crystals grown out of its back. It lets you
//     be, if you let it: but a blow, or a burst near it, and it turns on
//     whoever's nearest, and killed, its crystals go up in a burst that
//     cuts whatever's by it, yours or not.
//   the sky-watcher: the echo of one of the Watchers, at their chores, or
//     knelt, living over and over their last evening. They never fight; come
//     near and they remember at you. Kill one and what was in it comes back
//     wrong.
import { BRAINS, lineTiles } from './monsters.js';
import { ANCIENT_SPECIES } from './ancientmobs.js';
import { spin } from '../game/riftwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const D = (o) => ({ mode: 'hostile', under: true, ancient: true, isle: 'ostria', ...o });

export const RIFT_SPECIES = {
  rift_weaver: D({
    name: 'Rift Weaver', hp: 12, dmg: 2, step: 0.32, aggro: 11, light: 3, brain: 'riftWeaver', style: 'bite',
    drops: [['frost_crystal', 1, 1, 0.3], ['string', 1, 3, 0.6]],
  }),
  shardback: {
    name: 'Shardback', hp: 26, dmg: 4, step: 0.6, mode: 'neutral', aggro: 0, under: true, ancient: true, isle: 'ostria', light: 4, calm: 'shardback', style: 'bite',
    drops: [['frost_crystal', 1, 2, 0.7], ['gem', 1, 1, 0.15]],
  },
  sky_watcher: {
    name: 'Sky-Watcher\'s Echo', hp: 8, dmg: 0, step: 0.6, mode: 'passive', aggro: 0, under: true, ancient: true, calm: 'skyWatcher', isle: 'ostria', light: 2, undead: true,
    drops: [['old_coin', 1, 2, 0.4]],
  },
};

export const RIFT_BRAINS = {
  // Keeps off; strings a thread across the floor toward you now and then.
  riftWeaver(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    if (c.moving) return true;
    const d = dist(c, t);
    c.spinCd = (c.spinCd ?? 1.5 + Math.random() * 1.5) - dt;
    if (c.spinCd <= 0 && d >= 2 && d <= 7 && Math.abs(t.y - c.y) <= 1) {
      c.spinCd = 5 + Math.random() * 2;
      c.face(t.x, t.z);
      // (Past where you stand, a pace or two.)
      const tiles = lineTiles(game, c, t, d + 2, c.y);
      if (spin(game, c, t, tiles)) {
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 8, color: ['#c8a0ff', '#ffffff'], up: 8, speed: 20, life: 0.5, glow: true });
        game.audio?.play('skitter', c);
        c.stunT = 0.5;
        return true;
      }
    }
    // (Back off when close; edge in when far.)
    if (d <= 2) {
      const sx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
      const sz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
      if (c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step)) return true;
      return false;
    }
    return d <= 7;
  },

  // Grazing, let be. (Angry, at whoever's nearest: see riftwork.burstAt.)
  shardback(c, dt) {
    if (c.moving) return true;
    c.grazeT = (c.grazeT ?? 2 + Math.random() * 4) - dt;
    if (c.grazeT <= 0) {
      c.grazeT = 3 + Math.random() * 5;
      const h = c.home || (c.home = { x: c.x, z: c.z });
      const nx = c.x + Math.round(Math.random() * 2 - 1);
      const nz = c.z + Math.round(Math.random() * 2 - 1);
      if (dist({ x: nx, z: nz }, h) <= 3) c.tryStep(nx, nz, c.S.step);
      if (Math.random() < 0.4) c.game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 2, color: ['#d8c0ff', '#8a60e0'], up: 6, speed: 4, life: 0.8, glow: true });
    }
    return true;
  },

  // At their chores, or knelt; flickering. (Remembering at you: see
  // riftwork.js.)
  skyWatcher(c, dt) {
    if (c.fleeT > 0) return false;
    c.flickT = (c.flickT ?? 1 + Math.random() * 3) - dt;
    if (c.flickT <= 0) {
      c.flickT = 2 + Math.random() * 4;
      c.game.renderer.emit(c.x, c.y + 1.2, c.z, { n: 3, color: ['#ffd8a0', '#c8a0ff', '#ffffff'], up: 6, speed: 8, life: 0.5, glow: true });
    }
    // (A pace about, now and then, never far.)
    if (!c.moving && Math.random() < dt * 0.15) {
      const h = c.home || (c.home = { x: c.x, z: c.z });
      const nx = c.x + Math.round(Math.random() * 2 - 1);
      const nz = c.z + Math.round(Math.random() * 2 - 1);
      if (dist({ x: nx, z: nz }, h) <= 2) c.tryStep(nx, nz, c.S.step);
    }
    return true;
  },
};
Object.assign(BRAINS, RIFT_BRAINS);
// (Of the ancient places' own, as the old ones are: see ancientmobs.js.)
for (const k of ['rift_weaver', 'shardback', 'sky_watcher']) ANCIENT_SPECIES[k] = RIFT_SPECIES[k];
