// (Round 95) The barrow's own (laid out by world/deeps/barrow.js, drawn in
// render/art/barrow_mobs.js), each made to fight alongside the others:
//   the hearthguard: the chief's sworn guard, shield and spear. Its shield
//     turns most blows from the front; two of them shoulder to shoulder
//     make a shield-wall that turns nearly all (go round them, or at them
//     from the side). Set across a doorway, they hold it and thrust over
//     their shields; cut one down and the other's grief drives it at you.
//   the bone thrall: one of the thralls laid in the mound to serve; weak,
//     and slow, but a corpse-light near by quickens them, and gets them up
//     again when they fall.
//   the corpse-light: the cold flame over the dead. It keeps out of reach,
//     raises a thrall from every heap of bones near it, and quickens the
//     dead about it; burn too close to it and it flares (a cold that slows).
//     Put it out and everything it raised falls down again.
//   the tomb rat: alone, it skulks off; three or more, they swarm (and any
//     of them goes for someone already bleeding).
//   the old hound: the chief's hound, a ghost; no blow touches it. It
//     trots ahead of whoever comes near, to the chief's things (see
//     game/deeps.js), and waits for them to follow.
import { BRAINS } from './monsters.js';
import { beginAttack, inReach, styleOf, STYLES } from '../game/combat.js';
import { B } from '../world/blocks.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const FRONT = [[0, 1], [-1, 0], [0, -1], [1, 0]];
// Its own kind (or any of the dead) near it, still standing.
function near(c, r, ok) {
  const out = [];
  for (const o of c.game.creatures) if (o !== c && !o.dead && !o.dormant && Math.abs(o.y - c.y) <= 1 && dist(o, c) <= r && ok(o)) out.push(o);
  return out;
}
const mates = (c) => near(c, 1, (o) => o.species === 'hearthguard');

// A hearthguard's shield: blows from in front of it mostly turned; from
// two together, nearly all.
function shieldWall(game, c, src, amount) {
  if (c.stunT > 0 || !src || src === c) return amount;
  const [fx, fz] = FRONT[c.dir] || FRONT[0];
  if (fx * Math.sign(src.x - c.x) + fz * Math.sign(src.z - c.z) <= 0) return amount;
  const wall = mates(c).length > 0;
  if (Math.random() >= (wall ? 0.8 : 0.5)) return amount;
  c.guardT = 0.7;
  c.shieldJolt = 0.18;
  game.renderer.floatText(c.x, c.y + 2.2, c.z, wall ? 'shield-wall' : 'blocked', wall ? '#ffd890' : '#a0c8ff');
  game.renderer.emit(c.x, c.y + 1.1, c.z, { n: 6, color: ['#ffffff', '#ffe8a0', '#c8a040'], up: 30, speed: 60, life: 0.25, glow: true });
  game.audio?.play('armor_hit', c);
  if (src.kind === 'player' && wall && !game.toldWall) {
    game.toldWall = true;
    game.ui.msg('Their shields lock together. Get round them, or at them from the side.', '#ffd890', true);
  }
  return Math.round(amount * (wall ? 0.1 : 0.25));
}

// A ghost: nothing touches it.
function ghost(game, c) {
  if (!(c.passNote > 0)) {
    c.passNote = 1;
    game.renderer.floatText(c.x, c.y + 1.6, c.z, 'passes through', '#a8cce4');
  }
  return 0;
}

// A thrall falling with a corpse-light near: it'll be up again (see
// game/deeps.js, rises).
function thrallDown(game, c) {
  if (c.risen || !c.inst) return;
  const light = near(c, 7, (o) => o.species === 'corpse_light')[0];
  const run = game.runAt?.(c.x) || game.dungeon;
  if (!light || !run) return;
  (run.rises ||= []).push({ x: c.x, y: c.y, z: c.z, t: 4, light });
}

export const BARROW_SPECIES = {
  hearthguard: {
    name: 'Hearthguard', hp: 30, dmg: 4, step: 0.5, mode: 'hostile', aggro: 9, under: true, undead: true, brain: 'hearthguard', style: 'spear', ward: shieldWall,
    drops: [['bone', 1, 2, 0.8], ['old_coin', 1, 3, 0.5], ['arm_ring', 1, 1, 0.08]],
  },
  bone_thrall: { name: 'Bone Thrall', hp: 11, dmg: 2, step: 0.46, mode: 'hostile', aggro: 8, under: true, undead: true, style: 'bone', onDeath: thrallDown, drops: [['bone', 1, 2, 0.7]] },
  corpse_light: {
    name: 'Corpse-Light', hp: 9, dmg: 2, step: 0.34, mode: 'hostile', aggro: 11, under: true, undead: true, floats: true, light: 8, coldLight: true, brain: 'corpseLight', style: 'sting',
    drops: [['old_coin', 1, 2, 0.4]],
  },
  tomb_rat: { name: 'Tomb Rat', hp: 4, dmg: 1, step: 0.22, mode: 'hostile', aggro: 8, under: true, packs: true, brain: 'tombRat', style: 'snap', drops: [['raw_meat', 1, 1, 0.3]] },
  old_hound: { name: 'Old Hound', hp: 20, dmg: 0, step: 0.34, mode: 'passive', under: true, undead: true, ward: ghost, drops: [] },
};

export const BARROW_BRAINS = {
  // Holding the line (a pair set across a doorway: see deeps/barrow.js),
  // or, once the other's down, coming on in grief.
  hearthguard(c, dt) {
    const t = c.target;
    if (!t || t.dead) return false;
    const game = c.game;
    const wall = mates(c).length > 0;
    if (wall) c.hadMate = true;
    else if (c.hadMate && !c.grief) {
      c.grief = true;
      c.role = null;
      c.hasteT = 10;
      c.dmgMult = (c.dmgMult || 1) * 1.25;
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'grief!', '#ff8a6a');
      game.audio?.play('scream', c);
    }
    if (c.role === 'wall' && wall && dist(c, c.home) <= 1 && dist(c, t) <= 6) {
      c.face(t.x, t.z);
      const st = styleOf(c);
      if (c.attackCd <= 0 && inReach(c, t, st)) beginAttack(game, c, t, st);
      return true;
    }
    return false;
  },
  // Keeps out of reach, raising and quickening the dead.
  corpseLight(c, dt) {
    const game = c.game;
    c.raiseCd = (c.raiseCd ?? 2.5) - dt;
    c.quickCd = (c.quickCd ?? 0) - dt;
    if (c.quickCd <= 0) {
      c.quickCd = 1.2;
      for (const o of near(c, 5, (q) => q.S.undead && q.species !== 'corpse_light' && !q.isBoss)) {
        o.hasteT = Math.max(o.hasteT || 0, 1.6);
        o.quickened = 1.6;
      }
    }
    if (c.raiseCd <= 0) {
      c.raiseCd = 6 + Math.random() * 3;
      const raised = game.creatures.filter((o) => !o.dead && o.raisedBy === c).length;
      const bones = raised < 3 ? bonesNear(game, c, 5) : null;
      if (bones) {
        game.world.setBlock(bones.x, bones.y, bones.z, B.air);
        const th = game.spawnMonster('bone_thrall', bones.x, bones.y, bones.z);
        if (th) {
          th.raisedBy = c;
          th.summoner = c;
          th.risen = true;
          game.renderer.emit(bones.x, bones.y + 0.5, bones.z, { n: 14, color: ['#86eeff', '#c8fcff', '#d8d0b8'], up: 40, speed: 30, life: 0.8, glow: true });
          game.renderer.floatText(c.x, c.y + 2.6, c.z, 'the bones rise', '#86eeff');
          game.audio?.play('whisper', c);
          c.strike = { t: 0, dur: 0.6, st: STYLES.sting };
        }
      }
    }
    const t = c.target;
    if (!t || t.dead) return true;
    const d = dist(c, t);
    // (Right up close: a cold flare, and away.)
    if (d <= 1 && c.attackCd <= 0) {
      c.attackCd = 2.6;
      game.damage(t, Math.max(1, Math.round(2 * (c.dmgMult || 1))), c);
      t.slowT = Math.max(t.slowT || 0, 2.5);
      c.strike = { t: 0, dur: 0.4, st: STYLES.sting };
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 16, color: ['#86eeff', '#ffffff'], up: 20, speed: 70, life: 0.4, glow: true });
      game.audio?.play('freeze', c);
    }
    if (d <= 3 && !c.moving) {
      const dx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
      const dz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
      for (const [ox, oz] of [[dx, dz], [dx, 0], [0, dz], [dz, dx], [-dz, -dx]]) if (c.tryStep(c.x + ox, c.z + oz, c.S.step)) break;
    }
    if (!c.moving) c.face(t.x, t.z);
    return true;
  },
  // Skulking alone; swarming with its pack.
  tombRat(c, dt) {
    const t = c.target;
    if (!t || t.dead) return false;
    const pack = near(c, 5, (o) => o.species === 'tomb_rat').length + 1;
    const bleeding = t.hp !== undefined && t.maxHp && t.hp < t.maxHp * 0.5;
    if (pack >= 3 || bleeding) return false;
    if (dist(c, t) <= 3 && !c.moving) {
      const dx = Math.sign(c.x - t.x) || 1;
      const dz = Math.sign(c.z - t.z) || 1;
      for (const [ox, oz] of [[dx, 0], [0, dz], [dx, dz]]) if (c.tryStep(c.x + ox, c.z + oz, c.S.step * 1.2)) break;
    }
    return true;
  },
};

// A heap of bones near it, on the floor it floats over.
function bonesNear(game, c, r) {
  const w = game.world;
  let best = null;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [0, -1]) {
        const x = c.x + dx;
        const z = c.z + dz;
        const y = c.y + dy;
        if (w.getBlock(x, y, z) !== B.bones || game.entityAt(x, y, z)) continue;
        const d = Math.abs(dx) + Math.abs(dz);
        if (!best || d < best.d) best = { x, y, z, d };
      }
    }
  }
  return best;
}

Object.assign(BRAINS, BARROW_BRAINS);
