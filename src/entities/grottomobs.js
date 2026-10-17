// (Round 102) What lives in the Tide Grotto beside its reef crabs and bog
// lurkers (laid out by world/deeps/grotto.js, drawn in render/art/
// grotto_mobs.js; the tide and the rest they live by are in game/
// grottowork.js), each made to work with the others:
//   the drowned diver: one of the stilt folk's pearl divers, drowned in the
//     grotto and diving still. At low water it lies face down in the sand
//     like the dead thing it is; the tide coming in raises it (or a blow).
//     In the water it's quick, and its grab holds you under a moment.
//   the moray: lives in a hole in the wall. Pass in front of it, in its
//     line, and it lunges out, bites, and drags you a step toward the wall
//     (onto the urchins, into the channel). In its hole it's hard to hurt;
//     out, lunging, it's open.
//   the lantern jelly: drifts in the water, and stings (a jolt: stunned a
//     moment). The tide carries it out over the flats; when the tide goes,
//     it's stranded wherever it is, flat on the sand, stinging whoever
//     steps by. Burst, it leaves its stinging threads.
//   the shrimpkin: little cleaner shrimp, peaceful. They mend whatever's
//     most hurt near them: the drowned you're fighting, or you. Struck, they
//     scatter.
import { BRAINS, addZone } from './monsters.js';
import { BLOCKS } from '../world/blocks.js';
import { knock, strikeAnim, STYLES } from '../game/combat.js';
import { FY } from '../world/dungeongen.js';
import { wetAt, tideHigh, runOf } from '../game/grottowork.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const runAt = (c) => runOf(c.game, c.x);

// A drowned diver struck as it lies: it rises.
export function riseDiver(c, why = 'struck') {
  if (!c.lying) return;
  c.lying = false;
  const game = c.game;
  const run = runAt(c);
  if (c.dormant) run?.wake?.(c);
  c.stunT = Math.max(c.stunT || 0, 0.5);
  game.renderer.emit(c.x, c.y + 0.5, c.z, { n: 12, color: ['#80b8d8', '#c8e8f8', '#8a8070'], up: 30, speed: 30, gravity: 120, life: 0.7 });
  if (why === 'tide') game.renderer.floatText(c.x, c.y + 2.4, c.z, 'it rises with the tide', '#80c8e8');
}
function diverWard(game, c, src, amount) {
  if (c.lying) riseDiver(c, 'struck');
  return amount;
}
// The moray in its hole: blows turned by the rock; out, lunging, it's open.
function morayWard(game, c, src, amount) {
  if (c.outT > 0) return amount;
  if (!(c.wardNote > 0)) {
    c.wardNote = 1;
    game.renderer.floatText(c.x, c.y + 2, c.z, 'it ducks into its hole', '#c8d0a0');
  }
  return Math.max(0, Math.round(amount * 0.25));
}

export const GROTTO_SPECIES = {
  drowned_diver: {
    name: 'Drowned Diver', hp: 16, dmg: 3, step: 0.44, mode: 'hostile', aggro: 8, under: true, undead: true, swims: true, brain: 'drownedDiver', style: 'grab', ward: diverWard, isle: 'myrrow',
    drops: [['pearl', 1, 1, 0.25], ['old_coin', 1, 2, 0.3], ['kelp', 1, 1, 0.3]],
    // (Its grab, in the water: held under a moment.)
    onHit(game, a, v) {
      if (v.kind === 'player' && wetAt(game, v.x, v.y, v.z)) {
        v.rootT = Math.max(v.rootT || 0, 1.2);
        game.renderer.floatText(v.x, v.y + 2.4, v.z, 'held under!', '#80c8e8');
      }
    },
  },
  moray: { name: 'Moray', hp: 14, dmg: 4, step: 9, mode: 'hostile', aggro: 4, under: true, anchored: true, swims: true, brain: 'moray', ward: morayWard, isle: 'myrrow', drops: [['fish', 1, 2, 0.6], ['old_coin', 1, 3, 0.2]] },
  lantern_jelly: {
    name: 'Lantern Jelly', hp: 6, dmg: 2, step: 0.6, mode: 'hostile', aggro: 6, under: true, swims: true, light: 6, brain: 'lanternJelly', style: 'snap', isle: 'myrrow', drops: [['kelp', 1, 1, 0.3]],
    // (Its sting: a jolt, stunned a moment.)
    onHit(game, a, v) {
      v.stunT = Math.max(v.stunT || 0, 0.7);
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'stung!', '#a0ffff');
    },
  },
  shrimpkin: { name: 'Shrimpkin', hp: 4, dmg: 0, step: 0.3, mode: 'passive', aggro: 0, under: true, swims: true, calm: 'shrimpkin', isle: 'myrrow', drops: [['crab_meat', 1, 1, 0.3]] },
};

export const GROTTO_BRAINS = {
  // Lying in the sand till the tide (or a blow) raises it; in the water,
  // quick.
  drownedDiver(c) {
    const game = c.game;
    if (c.lying) {
      if (tideHigh(runAt(c))) riseDiver(c, 'tide');
      else return true;
    }
    if (wetAt(game, c.x, c.y, c.z)) c.hasteT = Math.max(c.hasteT || 0, 0.3);
    return false;
  },

  // In its hole, watching its line: whoever comes into it, it lunges at.
  moray(c, dt) {
    const game = c.game;
    const out = c.holeOut || { x: 0, z: 1 };
    if (c.outT > 0) c.outT -= dt;
    if (c.tellT > 0) c.tellT -= dt;
    if (c.wardNote > 0) c.wardNote -= dt;
    c.face(c.x + out.x, c.z + out.z);
    // (Round 116) What it can reach: not only straight out of its hole but
    // the fan before it, three deep and three wide (it only ever struck at
    // whoever stood dead in line, so mostly it just hid); open ground only.
    const side = { x: out.z, z: out.x };
    const line = [];
    for (let k = 1; k <= 3; k++) {
      for (let w = -1; w <= 1; w++) {
        const x = c.x + out.x * k + side.x * w;
        const z = c.z + out.z * k + side.z * w;
        const b = BLOCKS[game.world.getBlock(x, c.y, z)];
        if (b && b.solid) continue;
        line.push({ x, z });
      }
    }
    const inLine = (e) => line.some((q) => q.x === e.x && q.z === e.z) && Math.abs(e.y - c.y) <= 1;
    // Drawing back to lunge (the ground it'll strike reddening under you).
    if (c.lungeT > 0) {
      c.lungeT -= dt;
      if (Math.random() < dt * 20) game.renderer.emit(c.x + out.x * 0.5, c.y + 0.6, c.z + out.z * 0.5, { n: 1, color: ['#e8e0a0', '#a0a878'], up: 6, speed: 8, life: 0.3 });
      if (c.lungeT > 0) return true;
      strikeAnim(c, STYLES.bite || null);
      c.outT = 1.8;
      game.audio?.play('snap', c);
      for (const e of [...game.everyone(), ...game.creatures]) {
        if (!e || e === c || e.dead || !inLine(e) || (e.species && e.species === 'moray')) continue;
        if (e.kind !== 'player' && !e.angry && !(e.S && e.S.mode === 'hostile' && e.petOf)) continue;
        game.damage(e, c.S.dmg, c);
        // (Dragged a step toward its hole.)
        knock(game, { x: e.x + out.x, z: e.z + out.z }, e, 1);
        game.renderer.floatText(e.x, e.y + 2.4, e.z, 'dragged!', '#c8d0a0');
      }
      return true;
    }
    if (!(c.cool > 0)) {
      const prey = game.everyone().find((p) => p && !p.dead && inLine(p));
      if (prey) {
        c.lungeT = 0.6;
        c.cool = 2.2;
        c.tellT = 0.6;
        addZone(game, { by: c, kind: 'mark', tiles: line, y: c.y, life: 0.6, color: [230, 96, 60] });
        game.audio?.play('hiss', c);
        return true;
      }
    } else c.cool -= dt;
    return true;
  },

  // Drifting in the water; stranded on the sand when the tide's out, and
  // stinging whoever steps by.
  // (Round 116) Its sting is seen coming: whoever's beside it, it gathers
  // its light (brighter and brighter, crackling, the paces round it lit
  // up) for most of a second, then lets go at everyone still beside it.
  // Step away, and it stings nothing.
  lanternJelly(c, dt) {
    const game = c.game;
    const wet = wetAt(game, c.x, c.y, c.z);
    c.lying = !wet;
    // (Never the ordinary bite: only its sting, seen coming.)
    c.attackCd = Math.max(c.attackCd || 0, 1);
    const beside = (q) => q && !q.dead && dist(q, c) <= 1 && Math.abs(q.y - c.y) <= 1;
    if (c.tellT > 0) {
      c.tellT -= dt;
      if (Math.random() < dt * 30) game.renderer.emit(c.x + (Math.random() - 0.5) * 1.6, c.y + 0.4 + Math.random(), c.z + (Math.random() - 0.5) * 1.6, { n: 1, color: ['#a0ffff', '#ffffff', '#5ad8f0'], up: 10, speed: 14, life: 0.3, glow: true });
      if (c.tellT > 0) return true;
      c.stingCd = wet ? 1.4 : 1.6;
      game.audio?.play('zap', c);
      game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 18, color: ['#a0ffff', '#ffffff', '#5ad8f0'], up: 20, speed: 50, life: 0.4, glow: true });
      for (const p of [...game.everyone(), ...(game.npcs || [])]) {
        if (!beside(p)) continue;
        if (p.kind === 'player' && p.rollT > 0) continue;
        game.damage(p, wet ? c.S.dmg : 1, c);
        p.stunT = Math.max(p.stunT || 0, wet ? 0.7 : 0.6);
        game.renderer.floatText(p.x, p.y + 2.4, p.z, 'stung!', '#a0ffff');
      }
      return true;
    }
    if (c.stingCd > 0) c.stingCd -= dt;
    else if (game.everyone().some(beside)) {
      c.tellT = 0.75;
      const tiles = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) tiles.push({ x: c.x + dx, z: c.z + dz });
      addZone(game, { by: c, kind: 'mark', tiles, y: c.y, life: 0.75, color: [110, 230, 255] });
      game.audio?.play('hum', c);
      return true;
    }
    if (!wet) {
      c.target = null;
      return true;
    }
    c.hasteT = Math.max(c.hasteT || 0, 0.3);
    return false;
  },

  // Picking at whatever's most hurt near it (anything, anyone), mending
  // it; struck, it scatters with the rest (see the passive flee).
  shrimpkin(c, dt) {
    const game = c.game;
    if (c.hp < c.maxHp || c.angry) return false;
    c.target = null;
    c.mendT = (c.mendT ?? 1) - dt;
    let best = null;
    let worst = 1;
    for (const e of [...game.everyone(), ...game.creatures]) {
      if (!e || e === c || e.dead || e.species === 'shrimpkin' || !(e.maxHp > 0) || dist(e, c) > 5 || Math.abs(e.y - c.y) > 1) continue;
      if (e.isBoss) continue;
      const r = e.hp / e.maxHp;
      if (r < worst) {
        worst = r;
        best = e;
      }
    }
    if (!best) return true;
    if (dist(best, c) > 1) {
      if (!c.moving) {
        const sx = Math.sign(best.x - c.x);
        const sz = Math.sign(best.z - c.z);
        (sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step));
      }
      return true;
    }
    c.face(best.x, best.z);
    if (c.mendT <= 0) {
      c.mendT = 1.5;
      best.hp = Math.min(best.maxHp, best.hp + 1);
      c.doAction?.(0.3);
      game.renderer.emit(best.x, best.y + 1, best.z, { n: 5, color: ['#a0ffe0', '#ffffff', '#ff9a80'], up: 14, speed: 10, life: 0.6 });
      if (!(best.cleanNote > 0)) {
        best.cleanNote = 3;
        game.renderer.floatText(best.x, best.y + 2.4, best.z, best.kind === 'player' ? 'the shrimp clean your wounds' : 'cleaned by the shrimp', '#a0ffe0');
      }
    }
    if (best.cleanNote > 0) best.cleanNote -= dt;
    return true;
  },
};

// (A moray's bite, by its own name: see combat.STYLES.)
STYLES.bite ||= STYLES.snap;

Object.assign(BRAINS, GROTTO_BRAINS);
export { FY };
