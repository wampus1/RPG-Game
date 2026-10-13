// (Round 100) What lives in the Wildwood Hollow beside its thornlings,
// wolves and moths (laid out by world/deeps/grove.js, drawn in
// render/art/grove_mobs.js; the pollen, the hornets, the ring and the rest
// they work by are in game/grovework.js), each made to work with the
// others:
//   the woodwose: one of the Kept, woken: a hunched man-shape of bark and
//     moss, twig antlers, a light of fungus in its chest. Slow and heavy.
//     Standing on moss it mends; hurt badly, it roots (feet planted, bark
//     thick: blows a third as hard) and briars burst up round it. Some
//     step out of the walls as you pass.
//   the drowsebloom: a great drooping flower, rooted, that opens to puff a
//     cloud of drowsy pollen round it (slow in it, your feet and your
//     swing). Thornlings and woodwose don't mind it.
//   the glimmer: a mote of gold with a tail. It never fights: it rides
//     whichever of the wood's own is hurt worst, mending it and making it
//     quick. Struck, it blinks to another. Two blows and it's out.
//   the delver: blind, part mole and part root; it goes under the floor (a
//     heave of earth the only sign) and bursts up under you, throwing you
//     aside (into the briars, the pollen, a snare). Up, it's slow and soft;
//     it goes back under before long.
//   the hob: the Hollow's little housekeeper, in a cap of bark. It never
//     fights. Leave food at its stone and it shows you what the roots keep;
//     strike it, and the whole wood turns on you.
import { BRAINS, addHazard } from './monsters.js';
import { ringTiles } from './bosskit.js';
import { knock } from '../game/combat.js';
import { FY } from '../world/dungeongen.js';
import { B } from '../world/blocks.js';
import { groveCloud, groveWoodTurns } from '../game/grovework.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runOf = (c) => c.game.runAt?.(c.x) || c.game.dungeon || null;
const WOOD = new Set(['thornling', 'woodwose', 'drowsebloom', 'delver', 'wolf', 'moth', 'wisp']);
const kin = (game, c, r) => game.creatures.filter((o) => o !== c && !o.dead && !o.peaceful && WOOD.has(o.species) && dist(o, c) <= r);

// The woodwose rooted: a third as hard to hurt.
function woodwoseWard(game, c, src, amount) {
  return c.rootedT > 0 ? Math.max(1, Math.round(amount * 0.35)) : amount;
}
// The drowsebloom shut after its puff: half as hard to hurt.
function bloomWard(game, c, src, amount) {
  return c.shutT > 0 ? Math.max(1, Math.round(amount * 0.5)) : amount;
}
// A glimmer struck: away to another of the wood's own (if it lives).
function glimmerWard(game, c, src, amount) {
  if (amount < c.hp) {
    const to = kin(game, c, 9).filter((o) => o !== c.riding)[0];
    if (to) {
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 10, color: ['#fff4a0', '#ffd860', '#ffffff'], up: 20, speed: 40, life: 0.4, glow: true });
      c.riding = to;
      c.teleport?.(to.x, to.y, to.z);
      game.renderer.floatText(c.x, c.y + 2, c.z, 'it blinks away', '#fff0a0');
    }
  }
  return amount;
}
// The hob struck: the wood turns on you.
function hobStruck(game, c, src, amount) {
  if (src && src !== c && (src.kind === 'player' || src.kind === 'npc') && !c.wronged) {
    c.wronged = true;
    c.fleeT = 9;
    c.fleeFrom = src;
    c.say?.('You\'ll be sorry. The wood remembers.', 2.2, '#c8e890');
    const run = runOf(c);
    if (run) groveWoodTurns(run, src);
  }
  return amount;
}

export const GROVE_SPECIES = {
  woodwose: { name: 'Woodwose', hp: 26, dmg: 4, step: 0.6, mode: 'hostile', aggro: 9, under: true, brain: 'woodwose', style: 'bash', ward: woodwoseWard, isle: 'thessa', drops: [['stick', 1, 3, 0.8], ['herb', 1, 2, 0.4], ['old_coin', 1, 3, 0.3]] },
  drowsebloom: { name: 'Drowsebloom', hp: 16, dmg: 0, step: 9, mode: 'hostile', aggro: 8, under: true, anchored: true, brain: 'drowsebloom', ward: bloomWard, isle: 'thessa', light: 2, drops: [['herb', 1, 2, 0.7], ['flower_yellow', 1, 2, 0.5]] },
  glimmer: { name: 'Glimmer', hp: 4, dmg: 0, step: 0.28, mode: 'hostile', aggro: 12, under: true, floats: true, brain: 'glimmer', ward: glimmerWard, isle: 'thessa', light: 6, noHalo: true, drops: [['glowberries', 1, 1, 0.5]] },
  delver: { name: 'Delver', hp: 16, dmg: 4, step: 0.5, mode: 'hostile', aggro: 10, under: true, brain: 'delver', style: 'snap', isle: 'thessa', drops: [['leather', 1, 1, 0.4], ['mushroom', 1, 2, 0.4]] },
  hob: { name: 'Hob', hp: 10, dmg: 0, step: 0.45, mode: 'passive', under: true, ward: hobStruck, isle: 'thessa', drops: [['honeycomb', 1, 1, 0.5]] },
};

// A step toward a spot, one tile at a time (true if it moved).
function stepTo(c, t) {
  if (c.moving) return true;
  const sx = Math.sign(t.x - c.x);
  const sz = Math.sign(t.z - c.z);
  return !!((sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step)));
}

export const GROVE_BRAINS = {
  // Steps out of the bark the first time it's about; mends on the moss;
  // roots, hurt badly, with briars round it.
  woodwose(c, dt) {
    const game = c.game;
    const w = game.world;
    if (!c.stepped) {
      c.stepped = true;
      // (One of the Kept stood beside it, the bark split now and empty.)
      for (let dz = -1; dz <= 1; dz++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (w.getBlock(c.x + dx, FY, c.z + dz) !== B.gr_keptroot || w.getState?.(c.x + dx, FY, c.z + dz)) continue;
          w.setState(c.x + dx, FY, c.z + dz, true);
          game.renderer.emit(c.x + dx, FY + 1.2, c.z + dz, { n: 16, color: ['#6a4b2c', '#93703f', '#35561e'], up: 30, speed: 40, life: 0.7 });
          game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it steps out of the bark', '#c8b888');
          game.audio?.play('creak', c);
          dz = 2;
          break;
        }
      }
    }
    c.rootCd = (c.rootCd ?? 4) - dt;
    if (c.rootedT > 0) {
      c.rootedT -= dt;
      if (Math.random() < dt * 6) game.renderer.emit(c.x, FY + 0.3, c.z, { n: 1, color: ['#55822c', '#84b446'], up: 8, speed: 10, life: 0.6 });
      if (c.target) c.face(c.target.x, c.target.z);
      // (Rooted, it mends.)
      c.mendT = (c.mendT || 0) + dt;
      if (c.mendT >= 1) {
        c.mendT = 0;
        if (c.hp < c.maxHp) c.hp = Math.min(c.maxHp, c.hp + 1);
      }
      return true;
    }
    // Hurt badly: roots, and the briars come up round it.
    if (c.hp < c.maxHp * 0.5 && c.rootCd <= 0) {
      c.rootCd = 12;
      c.rootedT = 4;
      c.doAction?.(0.6);
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it roots', '#a0d070');
      game.audio?.play('creak', c);
      const tiles = ringTiles(c.x, c.z, 2);
      if (tiles.length) addHazard(game, { by: c, tiles, dur: 0.7, dmg: Math.round(3 * (c.dmgMult || 1)), kind: 'erupt', center: { x: c.x, z: c.z }, color: [110, 170, 70], snag: true });
      return true;
    }
    // On moss, out of the fight a moment: it mends.
    const under = w.getBlock(c.x, FY - 1, c.z);
    if ((under === B.gr_moss || under === B.gr_litter) && !(c.hurtT > 0)) {
      c.mossT = (c.mossT || 0) + dt;
      if (c.mossT >= 2 && c.hp < c.maxHp) {
        c.mossT = 0;
        c.hp = Math.min(c.maxHp, c.hp + 1);
        game.renderer.emit(c.x, c.y + 0.8, c.z, { n: 3, color: ['#84b446', '#c8f080'], up: 14, speed: 8, life: 0.6, glow: true });
      }
    }
    return false;
  },

  // Rooted: when you come within its reach, it opens and puffs; then shuts
  // a while (hard to hurt).
  drowsebloom(c, dt) {
    const game = c.game;
    const t = c.target;
    if (c.shutT > 0) c.shutT -= dt;
    c.puffCd = (c.puffCd ?? 1.5) - dt;
    if (!t || t.dead) return true;
    c.face(t.x, t.z);
    if (c.puffCd <= 0 && dist(c, t) <= 4) {
      c.puffCd = 5.5;
      c.shutT = 2;
      c.doAction?.(0.7);
      const run = runOf(c);
      if (run) groveCloud(run, c.x, c.z, 2.6, 4.5, c);
      game.audio?.play('hiss', c);
    }
    return true;
  },

  // Rides whichever of the wood's own is hurt worst: mends it, makes it
  // quick.
  glimmer(c, dt) {
    const game = c.game;
    const pick = () => {
      const k = kin(game, c, 10).filter((o) => o.species !== 'glimmer');
      if (!k.length) return null;
      return k.sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp)[0];
    };
    if (!c.riding || c.riding.dead || dist(c, c.riding) > 12) c.riding = pick();
    // (Now and then, to whoever's worse off.)
    c.lookT = (c.lookT || 0) - dt;
    if (c.lookT <= 0) {
      c.lookT = 2;
      const p = pick();
      if (p && c.riding && p.hp / p.maxHp < c.riding.hp / c.riding.maxHp - 0.25) c.riding = p;
    }
    const r = c.riding;
    if (!r) return !!c.target ? false : true;
    if (dist(c, r) > 1) {
      stepTo(c, r);
      return true;
    }
    c.face(r.x, r.z);
    r.hasteT = Math.max(r.hasteT || 0, 1.2);
    r.glimmered = 1.2;
    c.mendT = (c.mendT || 0) + dt;
    if (c.mendT >= 1.2) {
      c.mendT = 0;
      if (r.hp < r.maxHp) {
        r.hp = Math.min(r.maxHp, r.hp + 1);
        game.renderer.emit(r.x, r.y + 1.2, r.z, { n: 4, color: ['#fff4a0', '#ffd860'], up: 16, speed: 12, life: 0.6, glow: true });
      }
    }
    return true;
  },

  // Under the floor to you, up under you, a while up, then under again.
  delver(c, dt) {
    const game = c.game;
    const t = c.target;
    c.diveCd = (c.diveCd ?? 1) - dt;
    if (c.upT > 0) {
      c.upT -= dt;
      if (c.upT <= 0) {
        c.burrowed = true;
        c.diveCd = 1.5;
        game.renderer.emit(c.x, FY + 0.2, c.z, { n: 12, color: ['#2a1c11', '#47301c', '#6a4b2c'], up: 30, speed: 40, life: 0.6 });
        game.audio?.play('dig', c);
      }
      return false;
    }
    if (!t || t.dead) return !c.burrowed ? false : true;
    if (!c.burrowed && c.diveCd <= 0) {
      c.burrowed = true;
      game.renderer.emit(c.x, FY + 0.2, c.z, { n: 12, color: ['#2a1c11', '#47301c', '#6a4b2c'], up: 30, speed: 40, life: 0.6 });
      game.audio?.play('dig', c);
      return true;
    }
    if (!c.burrowed) return false;
    // Under: the earth heaving as it goes.
    if (Math.random() < dt * 8) game.renderer.emit(c.x, FY + 0.1, c.z, { n: 2, color: ['#2a1c11', '#47301c'], up: 10, speed: 14, life: 0.5 });
    if (dist(c, t) > 0) {
      if (!c.moving) {
        const sx = Math.sign(t.x - c.x);
        const sz = Math.sign(t.z - c.z);
        const pace = c.S.step * 0.7;
        ((sx && c.tryStep(c.x + sx, c.z, pace)) || (sz && c.tryStep(c.x, c.z + sz, pace)));
      }
      if (dist(c, t) > 1) return true;
    }
    // Up, under you: thrown aside.
    c.burrowed = false;
    c.upT = 4;
    c.doAction?.(0.5);
    game.renderer.emit(c.x, FY + 0.3, c.z, { n: 20, color: ['#2a1c11', '#47301c', '#6a4b2c', '#35561e'], up: 60, speed: 60, gravity: 140, life: 0.8 });
    game.audio?.play('dig', c);
    if (dist(c, t) <= 1 && Math.abs(t.y - c.y) < 1.5) {
      game.damage(t, Math.round(4 * (c.dmgMult || 1)), c);
      const run = runOf(c);
      // (Thrown aside: two paces, away from where it came up.)
      let dx = Math.sign(t.x - c.x);
      let dz = Math.sign(t.z - c.z);
      if (!dx && !dz) [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(Math.random() * 4)];
      knock(game, { x: t.x - dx, z: t.z - dz }, t, 2);
      t.stunT = Math.max(t.stunT || 0, 0.5);
      game.renderer.floatText(t.x, t.y + 2.4, t.z, 'thrown!', '#c8b888');
      // (Up through a snare: it catches whoever it threw.)
      if (run && game.world.getBlock(t.x, FY, t.z) === B.gr_snare) t.grabbedT = Math.max(t.grabbedT || 0, 1.4);
    }
    return true;
  },
};

Object.assign(BRAINS, GROVE_BRAINS);
