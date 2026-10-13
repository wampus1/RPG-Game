// (Round 103) What lives in the Imperial Catacomb beside its legion shades
// (laid out by world/deeps/catacomb.js, drawn in render/art/cata_mobs.js;
// the lamps and the graves they live by are in game/catawork.js), each made
// to work with the others:
//   the aquilifer: the legion's skeleton standard-bearer, its eagle held
//     high. While it stands, the shades about it dress their ranks: their
//     shields lock with a comrade two paces off, not just one, and they come
//     on quicker. It keeps behind the line. Bring the eagle down and the
//     shades waver (stunned a moment).
//   the grasping hand: a dead arm out of a broken shelf-grave, or up out
//     of the ossuary's bones. Pass by it and it grabs you: held a moment,
//     for whatever's behind you with a spear.
//   the lemur: a restless shade of the unburied, grey and drifting. It
//     snuffs every lamp it passes, and in the dark it can't be touched:
//     blows go through it. In lamplight it can be hurt. Its touch chills.
//   the fossor: a gravedigger's ghost, lantern and pick, still at his work.
//     Peaceful: he relights the lamps the lemures put out. Rob the graves
//     and he stops to look at you; rob another and he and his fellows come
//     for you with their picks.
import { BRAINS } from './monsters.js';
import { STYLES } from '../game/combat.js';
import { FY } from '../world/dungeongen.js';
import { litNear, lampsOf, provoke, runOf, waver } from '../game/catawork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);
const SHADES = new Set(['legion_shade']);

// A lemur, struck: in the dark its form won't hold a blade.
function lemurWard(game, c, src, amount) {
  const run = runAt(c);
  if (run && litNear(run, c.x, c.z, 4)) return amount;
  if (!(c.wardNote > 0)) {
    c.wardNote = 1.2;
    game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it passes through... (light the lamps)', '#b8c8d8');
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 8, color: ['#a8b8c8', '#d8e0e8'], up: 10, speed: 14, life: 0.6, shape: 'puff' });
  }
  return 0;
}
// A fossor struck: he and his fellows turn on whoever did it.
function fossorStruck(game, c, src, amount) {
  if (src && src !== c && (src.kind === 'player' || src.kind === 'npc')) {
    const run = runAt(c);
    if (run) provoke(run, src, c, 'struck');
    else {
      c.angry = true;
      c.peaceful = false;
      c.target = src;
    }
  }
  return amount;
}

export const CATA_SPECIES = {
  aquilifer: {
    name: 'Aquilifer', hp: 22, dmg: 3, step: 0.42, mode: 'hostile', aggro: 10, under: true, undead: true, brain: 'aquilifer', style: 'bash', isle: 'velmarch',
    drops: [['old_coin', 2, 5, 0.8], ['gold_ingot', 1, 1, 0.12], ['bone', 1, 2, 0.4]],
    // (The eagle down: the shades about it waver.)
    onDeath(game, c) {
      const run = runAt(c);
      if (run) waver(run, c);
    },
  },
  loculus_hand: {
    name: 'Grasping Hand', hp: 10, dmg: 3, step: 9, mode: 'hostile', aggro: 2, under: true, undead: true, anchored: true, brain: 'loculusHand', style: 'grab', isle: 'velmarch',
    drops: [['bone', 1, 1, 0.5], ['old_coin', 1, 2, 0.3]],
  },
  lemur: {
    name: 'Lemur', hp: 12, dmg: 3, step: 0.5, mode: 'hostile', aggro: 9, under: true, undead: true, floats: true, brain: 'lemur', style: 'snap', ward: lemurWard, isle: 'velmarch',
    drops: [['old_coin', 1, 2, 0.3]],
    // (Its touch: a chill, slowing you.)
    onHit(game, a, v) {
      v.slowT = Math.max(v.slowT || 0, 1.2);
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'chilled', '#b8d8f0');
    },
  },
  fossor: {
    name: 'Fossor', hp: 16, dmg: 4, step: 0.55, mode: 'passive', aggro: 9, under: true, undead: true, light: 5, brain: 'fossor', calm: 'fossor', style: 'bash', ward: fossorStruck, isle: 'velmarch',
    drops: [['old_coin', 1, 3, 0.5], ['clay', 1, 1, 0.3]],
  },
};

export const CATA_BRAINS = {
  // Its eagle held high behind the line: the shades about it dress their
  // ranks. Come at it and it fights with the standard's butt.
  aquilifer(c, dt) {
    const game = c.game;
    const t = c.target;
    for (const o of game.creatures) {
      if (o.dead || !SHADES.has(o.species) || dist(o, c) > 5) continue;
      o.rankedT = 0.5;
      o.hasteT = Math.max(o.hasteT || 0, 0.3);
    }
    c.callT = (c.callT ?? 2) - dt;
    if (t && !t.dead && c.callT <= 0 && dist(c, t) <= 9) {
      c.callT = 6;
      game.renderer.floatText(c.x, c.y + 3, c.z, 'DRESS RANKS!', '#ffe080');
      game.audio?.play('horn', c);
    }
    // (Behind the line: it closes only when you're on it.)
    if (!t || t.dead || dist(c, t) <= 2) return false;
    if (dist(c, t) < 4 && !c.moving) {
      const sx = Math.sign(c.x - t.x);
      const sz = Math.sign(c.z - t.z);
      (sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step));
    }
    c.face(t.x, t.z);
    return true;
  },

  // Still till someone comes by, then a grab: held a moment.
  loculusHand(c, dt) {
    const game = c.game;
    if (c.cool > 0) c.cool -= dt;
    if (c.heldT > 0) c.heldT -= dt;
    const prey = game.everyone().find((p) => p && !p.dead && dist(p, c) <= 1 && Math.abs(p.y - c.y) <= 1);
    if (prey) c.face(prey.x, prey.z);
    if (!prey || c.cool > 0) return true;
    c.cool = 3.5;
    c.heldT = 1.4;
    prey.rootT = Math.max(prey.rootT || 0, 1.4);
    game.damage(prey, 2, c);
    game.renderer.floatText(prey.x, prey.y + 2.4, prey.z, 'a dead hand grabs you!', '#d8c8a0');
    game.renderer.emit(prey.x, prey.y + 0.6, prey.z, { n: 8, color: ['#c8bc9c', '#7a6e58'], up: 10, speed: 12, life: 0.5 });
    game.audio?.play('bones', c);
    if (STYLES.grab) c.doAction?.(0.4);
    return true;
  },

  // Drifting through the dark, snuffing the lamps it passes; at you when
  // it sees you.
  lemur(c, dt) {
    const game = c.game;
    const run = runAt(c);
    if (!run) return false;
    c.snuffT = (c.snuffT ?? 0) - dt;
    if (c.snuffT <= 0) {
      c.snuffT = 0.8;
      for (const l of lampsOf(run)) {
        if (dist(l, c) > 1 || !game.world.getState(l.x, l.y || FY, l.z)) continue;
        game.world.setState(l.x, l.y || FY, l.z, false);
        game.lightDirty = true;
        game.renderer.emit(l.x, (l.y || FY) + 1.2, l.z, { n: 10, color: ['#8a8070', '#c8c0b0'], up: 14, speed: 6, life: 1, shape: 'puff', gravity: -6 });
        game.renderer.floatText(l.x, (l.y || FY) + 2.6, l.z, 'the lamp gutters out', '#a8a098');
        game.audio?.play('hiss', l);
        break;
      }
    }
    // (Going for the nearest lamp still lit, if there's nobody to go for.)
    if (!c.target || c.target.dead) {
      const lit = lampsOf(run).filter((l) => game.world.getState(l.x, l.y || FY, l.z) && dist(l, c) <= 8).sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (lit && !c.moving && dist(lit, c) > 1) {
        const sx = Math.sign(lit.x - c.x);
        const sz = Math.sign(lit.z - c.z);
        (sx && c.tryStep(c.x + sx, c.z, c.S.step * 1.4)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step * 1.4));
        return true;
      }
    }
    return false;
  },

  // At the work: going to every lamp gone out near him and lighting it
  // again. Given cause, he fights.
  fossor(c, dt) {
    const game = c.game;
    if (c.angry) {
      c.peaceful = false;
      return false;
    }
    c.target = null;
    const run = runAt(c);
    if (!run) return true;
    if (c.lightT > 0) {
      c.lightT -= dt;
      if (c.lightT <= 0 && c.toLamp) {
        const l = c.toLamp;
        game.world.setState(l.x, l.y || FY, l.z, true);
        game.lightDirty = true;
        game.renderer.emit(l.x, (l.y || FY) + 1.2, l.z, { n: 8, color: ['#ffd46a', '#ff9a2a'], up: 10, speed: 6, life: 0.6, glow: true });
        game.renderer.floatText(c.x, c.y + 2.4, c.z, 'the fossor lights the lamp', '#ffd890');
        c.toLamp = null;
      }
      return true;
    }
    const out = lampsOf(run).filter((l) => !game.world.getState(l.x, l.y || FY, l.z) && dist(l, c) <= 10).sort((a, b) => dist(a, c) - dist(b, c))[0];
    if (!out) {
      // (Pottering, near where he works.)
      c.home ||= { x: c.x, z: c.z };
      c.thinkT = (c.thinkT ?? 0) - dt;
      if (c.thinkT <= 0 && !c.moving) {
        c.thinkT = c.rng.float(2, 5);
        const [dx, dz] = [[1, 0], [-1, 0], [0, 1], [0, -1]][c.rng.int(0, 3)];
        if (dist({ x: c.x + dx, z: c.z + dz }, c.home) <= 4) c.tryStep(c.x + dx, c.z + dz, c.S.step * 1.5);
      }
      return true;
    }
    if (dist(out, c) > 1) {
      if (!c.moving) {
        const sx = Math.sign(out.x - c.x);
        const sz = Math.sign(out.z - c.z);
        (sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step)) || (sx && c.tryStep(c.x + sx, c.z, c.S.step));
      }
      return true;
    }
    c.face(out.x, out.z);
    c.toLamp = out;
    c.lightT = 1.1;
    c.doAction?.(0.5);
    return true;
  },
};

Object.assign(BRAINS, CATA_BRAINS);
