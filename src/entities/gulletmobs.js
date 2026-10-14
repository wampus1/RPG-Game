// (Round 113) What's in the Gullet of the World beside its leeches,
// spitters and larvae (laid out by world/deeps/gullet.js, drawn in
// render/art/gullet_mobs.js; the tremors, the clutches, the Swallowed
// leading you are in game/gulletwork.js), each made to work with the
// others:
//   the borer: a ringed, eyeless worm the length of a man, the worm's own
//     young, that goes through the earth as you'd go through water. Under
//     the floor you see only the earth humping up where it goes; it comes
//     up under you (the ground cracks first: step off it) and throws you
//     off your feet, for the leeches and the spitters to have; and coming
//     up under a clutch, the eggs all hatch at once.
//   the clutch-mother: a great pale grub, bloated with eggs, slow, that
//     squats and lays one every little while (they hatch in a few breaths,
//     or as you come near); hurt badly, she screams, and every egg near her
//     hatches together.
//   the Swallowed: the children's children's children of the people the
//     worm ate, grown pale and big-eyed in the dark, still keeping the
//     lamps lit and the rites. They never fight. Come near one and it
//     leads you somewhere its people have always known; hurt one and
//     they're gone, all of them.
import { BRAINS, addHazard } from './monsters.js';
import { ANCIENT_SPECIES } from './ancientmobs.js';
import { FY } from '../world/dungeongen.js';
import { BLOCKS } from '../world/blocks.js';
import { runOf, upheave, lay } from '../game/gulletwork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const D = (o) => ({ mode: 'hostile', under: true, ancient: true, isle: 'ostria', ...o });
const EARTH = ['#8a6e4c', '#5c4430', '#a4885e'];

export const GULLET_SPECIES = {
  borer: D({
    name: 'Borer', hp: 18, dmg: 4, step: 0.34, aggro: 11, brain: 'borer', style: 'bite',
    drops: [['raw_meat', 1, 1, 0.3], ['leather', 1, 1, 0.3], ['old_coin', 1, 2, 0.3]],
  }),
  clutch_mother: D({
    name: 'Clutch-Mother', hp: 40, dmg: 3, step: 0.7, aggro: 9, brain: 'clutchMother', style: 'bite', light: 2,
    drops: [['raw_meat', 1, 3, 0.6], ['slime_gel', 1, 3, 0.6], ['gem', 1, 1, 0.15]],
  }),
  swallowed_one: {
    name: 'One of the Swallowed', hp: 8, dmg: 0, step: 0.55, mode: 'passive', aggro: 0, under: true, ancient: true, calm: 'swallowedOne', isle: 'ostria', light: 6,
    drops: [['old_coin', 1, 3, 0.6], ['bread', 1, 1, 0.3]],
  },
};

// Somewhere open to go through, a pace toward `t`: floor under it, no wall.
function digStep(c, t) {
  const w = c.game.world;
  const sx = Math.sign(t.x - c.x);
  const sz = Math.sign(t.z - c.z);
  for (const [dx, dz] of [[sx, sz], [sx, 0], [0, sz], [sz, -sx], [-sz, sx]]) {
    if (!dx && !dz) continue;
    const x = c.x + dx;
    const z = c.z + dz;
    if (!w.regionAt(x, z) || BLOCKS[w.getBlock(x, FY, z)].solid || !BLOCKS[w.getBlock(x, FY - 1, z)].solid) continue;
    if (c.leash && (x < c.leash.x0 || x > c.leash.x1 || z < c.leash.z0 || z > c.leash.z1)) continue;
    return { x, z };
  }
  return null;
}
function down(c) {
  const game = c.game;
  c.burrowed = true;
  c.solid = false;
  game.removeOcc?.(c);
  game.renderer.emit(c.x, FY + 0.3, c.z, { n: 12, color: EARTH, up: 20, speed: 20, life: 0.7, shape: 'puff' });
  game.audio?.play('crumble', c);
}
function up(c, at) {
  const game = c.game;
  c.burrowed = false;
  c.solid = true;
  c.teleport(at.x, FY, at.z);
  game.moveEntity(c, at.x, FY, at.z);
  c.stunT = Math.max(c.stunT || 0, 0.3);
  const run = runOf(game, c.x);
  if (run && run.rec?.type === 'gullet') upheave(run, at, 2);
}

export const GULLET_BRAINS = {
  // Under the floor, toward you; up under you; a while up, then down again.
  borer(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) {
      if (c.burrowed && !c.rise) up(c, { x: c.x, z: c.z });
      return false;
    }
    const d = dist(c, t);
    // Coming up: the ground cracking where you stood.
    if (c.rise) {
      c.rise.t -= dt;
      if (Math.random() < dt * 20) game.renderer.emit(c.rise.x, FY + 0.1, c.rise.z, { n: 1, color: EARTH, up: 14, speed: 10, life: 0.5, shape: 'puff' });
      if (c.rise.t > 0) return true;
      const at = { x: c.rise.x, z: c.rise.z };
      c.rise = null;
      const free = !game.occupiedBySolid?.(at.x, FY, at.z, c) || dist(t, at) === 0;
      up(c, free ? at : { x: c.x, z: c.z });
      c.upT = 4 + Math.random() * 2;
      return true;
    }
    if (c.burrowed) {
      // (Churned earth humping up where it goes.)
      if (Math.random() < dt * 8) game.renderer.emit(c.x, FY + 0.05, c.z, { n: 1, color: EARTH, up: 6, speed: 4, life: 0.6, shape: 'puff' });
      c.digT = (c.digT ?? 0) - dt;
      if (c.digT > 0) return true;
      c.digT = 0.32;
      if (d <= 1 || (c.underT = (c.underT || 0) + 0.32) > 6) {
        c.underT = 0;
        // (Telegraphed: the ground cracks under you a breath first.)
        c.rise = { x: t.x, z: t.z, t: 0.75 };
        addHazard(game, { by: c, keep: true, tiles: [{ x: t.x, z: t.z }], y: FY, dur: 0.75, dmg: Math.round(c.S.dmg * (c.dmgMult || 1)), stun: 0.7, kind: 'erupt', color: [138, 110, 76] });
        game.audio?.play('rumble', t);
        const run = runOf(game, c.x);
        if (run && t.kind === 'player') {
          const T = run.gulletT;
          if (T && !T.told.borer) {
            T.told.borer = true;
            game.ui.msg('The floor humps up and runs toward you, under the earth, and the ground cracks under your feet... (Step off the crack! The borers come up under you.)', '#c8a878', true);
          }
        }
        return true;
      }
      const s = digStep(c, t);
      if (s) {
        c.face(s.x, s.z);
        c.teleport(s.x, FY, s.z);
      }
      return true;
    }
    // Up: fight a while, then down again (if you've got away from it, sooner).
    c.upT = (c.upT ?? 3) - dt;
    if (c.upT <= 0 || (d >= 4 && c.upT < 2.5)) {
      if (c.moving || c.windup) return true;
      c.upT = 4;
      down(c);
      return true;
    }
    return false;
  },

  // Laying, every little while; screaming, hurt badly.
  clutchMother(c, dt) {
    const game = c.game;
    const run = runOf(game, c.x);
    c.layT = (c.layT ?? 4 + Math.random() * 3) - dt;
    if (c.layT <= 0 && run && run.rec?.type === 'gullet') {
      c.layT = 9 + Math.random() * 3;
      if (lay(run, c)) {
        c.stunT = 0.8;
        return true;
      }
    }
    if (!c.screamed && c.hp < c.maxHp * 0.5 && run && run.rec?.type === 'gullet') {
      c.screamed = true;
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'SCREAMS', '#e0f088');
      game.renderer.emit(c.x, c.y + 1.2, c.z, { n: 20, color: ['#e0f088', '#c8e060', '#ffffff'], up: 20, speed: 30, life: 0.8 });
      game.audio?.play('growl', c);
      upheave(run, c, 6);
      c.stunT = 1;
      return true;
    }
    return false;
  },

  // Keeping its lamp lit, a pace about now and then, never far. (Leading
  // you: see gulletwork.js.)
  swallowedOne(c, dt) {
    if (c.guiding) return true;
    c.lampT = (c.lampT ?? 1 + Math.random() * 2) - dt;
    if (c.lampT <= 0) {
      c.lampT = 1.5 + Math.random() * 2;
      c.game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 2, color: ['#ffd060', '#ff902a'], up: 6, speed: 3, life: 0.6, glow: true });
    }
    if (!c.moving && Math.random() < dt * 0.12) {
      const h = c.home || (c.home = { x: c.x, z: c.z });
      const nx = c.x + Math.round(Math.random() * 2 - 1);
      const nz = c.z + Math.round(Math.random() * 2 - 1);
      if (dist({ x: nx, z: nz }, h) <= 2) c.tryStep(nx, nz, c.S.step);
    }
    return true;
  },
};
Object.assign(BRAINS, GULLET_BRAINS);
// (Of the ancient places' own, as the old ones are: see ancientmobs.js.)
for (const k of ['borer', 'clutch_mother', 'swallowed_one']) ANCIENT_SPECIES[k] = GULLET_SPECIES[k];
