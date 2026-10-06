// What lives (and doesn't) in the far lands' old places (round 68: see
// world/fardeep.js), each with a way of its own:
//   legion shades, the old empire's dead legionaries, Velmarch: their
//     shields lock with the shade beside them (two together turn most of
//     a blow);
//   terracotta soldiers, Ostria's clay army: blades bite poorly on fired
//     clay, and they crumble when they fall; and their crossbowmen;
//   jade corpses, Ostria's restless dead: stiff-armed, they come at you
//     in hops, and drink the life out of you with a touch;
//   bone whalers, Corrow's drowned hunters: a harpoon thrown on a line,
//     and you hauled in to them;
//   salt wights, Saltmere's dead, white with salt: their touch parches
//     you (your breath short), and they burst in a cloud of salt;
//   tunnelers, the blind diggers of Hollowmark's deep warrens: down into
//     the earth, and up again under your feet;
//   fey knights of the Wyrd Isle: here, then behind you, in a shimmer;
//     their blows glamour you a moment where you stand;
//   wreckers of the Skerries, with their false lanterns: the lantern's
//     swung, and burns;
//   and what's angrier underground than above: grave ravens, cave moths.
import { BRAINS, MONSTER_SPECIES, addHazard, lineTiles } from './monsters.js';
import { burn, stun } from '../game/gems.js';
import { beginAttack, styleOf } from '../game/combat.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const sees = (game, a, b) => !game.sim || !game.sim.lineOfSight || game.sim.lineOfSight(a.x, a.z, b.x, b.z, a.y + 1);
const CLAY = ['#b8643a', '#8a4a2a', '#d8946a'];
const SALT = ['#ffffff', '#f0e8f0', '#e0d8e8'];
const JADE = ['#60c890', '#a0f0c0', '#2a8a5a'];
const FEY = ['#c8a0ff', '#80ffd0', '#ffffff'];
const EARTH = ['#7a5a3a', '#a8885a', '#5a4430'];

// A free pace to stand on beside `t`, away from `from`.
function besideOf(game, t, from) {
  const sx = Math.sign(t.x - from.x) || 1;
  const sz = Math.sign(t.z - from.z);
  for (const [dx, dz] of [[sx, sz], [sx, 0], [0, sz || 1], [-sz, sx], [sz, -sx], [-sx, 0], [0, -(sz || 1)]]) {
    const x = t.x + dx;
    const z = t.z + dz;
    if (!game.world.regionAt(x, z)) continue;
    const y = game.world.findStandY(x, z, t.y);
    if (y < 0 || Math.abs(y - t.y) > 1 || game.entityAt(x, y, z) || game.world.isWaterAt(x, y, z)) continue;
    return { x, y, z };
  }
  return null;
}

export const FAR_DEEP_SPECIES = {
  legion_shade: {
    name: 'Legion Shade', hp: 20, dmg: 4, step: 0.36, mode: 'hostile', aggro: 10, humanoid: true, look: 'legion_shade', arms: 'spear', shield: 'iron_shield', shieldBlock: 0.25,
    under: true, undead: true, light: 2, isle: 'velmarch', drops: [['old_coin', 1, 3, 0.6], ['bone', 1, 2, 0.4]],
    // Shields locked with the shade beside it: most of a blow turned.
    ward(game, c, src, amt) {
      const mate = game.creatures.some((o) => o !== c && !o.dead && o.species === 'legion_shade' && dist(o, c) <= 1);
      if (!mate || c.stunT > 0) return amt;
      if (!(c.wallNote > 0)) {
        c.wallNote = 1.2;
        game.renderer.floatText(c.x, c.y + 2.4, c.z, 'shield wall!', '#ffe0a0');
      }
      game.audio?.play('armor_hit', c);
      return Math.max(1, Math.round(amt * 0.45));
    },
  },
  terracotta_soldier: {
    name: 'Terracotta Soldier', hp: 26, dmg: 4, step: 0.44, mode: 'hostile', aggro: 9, humanoid: true, look: 'terracotta', arms: 'spear', under: true, construct: true, armoured: true,
    isle: 'ostria', drops: [['clay', 1, 3, 0.7], ['old_coin', 1, 2, 0.3]],
    onDeath(game, c) {
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 26, color: CLAY, up: 40, speed: 50, gravity: 200, life: 0.8 });
      game.renderer.floatText(c.x, c.y + 2.2, c.z, 'crumbles', '#d8946a');
      game.audio?.play('crumble', c);
    },
  },
  terracotta_archer: {
    ...MONSTER_SPECIES.holdout_archer, name: 'Terracotta Crossbowman', look: 'terracotta_archer', arms: 'crossbow', hp: 18, construct: true, armoured: true, bandit: false, isle: 'ostria',
    drops: [['clay', 1, 2, 0.6], ['arrow', 2, 5, 0.6]],
    onDeath(game, c) {
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 20, color: CLAY, up: 40, speed: 50, gravity: 200, life: 0.8 });
      game.audio?.play('crumble', c);
    },
  },
  jade_corpse: {
    name: 'Jade Corpse', hp: 22, dmg: 4, step: 0.6, mode: 'hostile', aggro: 9, humanoid: true, look: 'jade_corpse', under: true, undead: true, isle: 'ostria', brain: 'hopper', style: 'grab',
    drops: [['old_coin', 1, 3, 0.5], ['gem', 1, 1, 0.05]],
    // Its touch drinks your life.
    onHit(game, a, v) {
      const k = Math.min(a.maxHp - a.hp, 3);
      if (k > 0) a.hp += k;
      game.renderer.emit(v.x, v.y + 1.2, v.z, { n: 8, color: JADE, up: 10, speed: 20, life: 0.6, glow: true });
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'life drained', '#80e0a8');
    },
  },
  bone_whaler: {
    name: 'Bone Whaler', hp: 20, dmg: 4, step: 0.36, mode: 'hostile', aggro: 10, humanoid: true, look: 'bone_whaler', arms: 'harpoon', under: true, undead: true, isle: 'corrow', brain: 'harpooner',
    drops: [['bone', 1, 3, 0.8], ['old_coin', 1, 2, 0.3], ['harpoon', 1, 1, 0.04]],
  },
  salt_wight: {
    name: 'Salt Wight', hp: 22, dmg: 4, step: 0.38, mode: 'hostile', aggro: 9, humanoid: true, look: 'salt_wight', under: true, undead: true, light: 2, isle: 'saltmere',
    drops: [['salt', 1, 3, 0.8], ['old_coin', 1, 2, 0.3]],
    // Its touch parches you: short of breath.
    onHit(game, a, v) {
      if (v.kind === 'player') v.stamina = Math.max(0, (v.stamina || 0) - 2);
      v.slowT = Math.max(v.slowT || 0, 1.2);
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'parched', '#f0e8f0');
    },
    // And bursts in a cloud of salt.
    onDeath(game, c) {
      const tiles = [];
      for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) if (dx || dz) tiles.push({ x: c.x + dx, z: c.z + dz });
      addHazard(game, { by: c, keep: true, tiles, y: c.y, dur: 0.5, dmg: 2, stun: 0.5, kind: 'cold', color: [240, 236, 244] });
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 30, color: SALT, up: 30, speed: 50, life: 1, shape: 'puff', gravity: -4 });
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'a burst of salt!', '#ffffff');
    },
  },
  tunneler: {
    name: 'Tunneler', hp: 18, dmg: 4, step: 0.38, mode: 'hostile', aggro: 11, under: true, isle: 'hollowmark', brain: 'tunneler', style: 'bite',
    drops: [['leather', 1, 2, 0.6], ['gold_ore', 1, 1, 0.12]],
  },
  fey_knight: {
    name: 'Fey Knight', hp: 22, dmg: 4, step: 0.3, mode: 'hostile', aggro: 12, humanoid: true, look: 'fey_knight', arms: 'sabre', under: true, light: 3, isle: 'wyrd', brain: 'feyKnight',
    drops: [['gem', 1, 1, 0.08], ['old_coin', 1, 3, 0.5]],
    // Its blow glamours you a moment.
    onHit(game, a, v) {
      if (Math.random() > 0.35) return;
      stun(v, 0.5);
      game.renderer.emit(v.x, v.y + 1.4, v.z, { n: 10, color: FEY, up: 14, speed: 16, life: 0.8, glow: true });
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'glamoured!', '#d8c0ff');
    },
  },
  wrecker: {
    ...MONSTER_SPECIES.cutthroat, name: 'Wrecker', look: 'wrecker', arms: 'sabre', offhand: null, hp: 17, isle: 'skerries', light: 4,
    drops: [['coin', 1, 5, 0.8], ['lantern', 1, 1, 0.06]],
    // Its lantern swung at you: burning oil.
    onHit(game, a, v) {
      if (Math.random() < 0.3) burn(game, v, a, 1.5);
    },
  },
  grave_raven: {
    name: 'Grave Raven', hp: 6, dmg: 2, step: 0.22, mode: 'hostile', aggro: 12, under: true, floats: true, packs: true, isle: 'wyrd', brain: 'moth', style: 'snap', drops: [['feather', 1, 2, 0.8]],
  },
  cave_moth: {
    ...MONSTER_SPECIES.moth, name: 'Lantern Moth', hp: 5, light: 5, noHalo: true, isle: 'hollowmark', drops: [['lantern_pod', 1, 1, 0.3], ['moth_dust', 1, 1, 0.5]],
  },
};

export const FAR_MOB_BRAINS = {
  // Hops, stiff-armed: a pace or two at a time, then still a moment.
  hopper(c, dt) {
    const game = c.game;
    const t = c.target;
    c.hopT = (c.hopT ?? 0.6) - dt;
    if (!t || t.dead || c.windup) return false;
    if (dist(c, t) <= 1) return false;
    if (c.hopT > 0) return true;
    c.hopT = 0.75 + Math.random() * 0.3;
    const sx = Math.sign(t.x - c.x);
    const sz = Math.sign(t.z - c.z);
    for (const n of [2, 1]) {
      const x = c.x + sx * Math.min(n, Math.abs(t.x - c.x));
      const z = c.z + sz * Math.min(n, Math.abs(t.z - c.z));
      if (x === c.x && z === c.z) continue;
      const y = game.world.findStandY(x, z, c.y);
      if (y < 0 || Math.abs(y - c.y) > 1 || game.entityAt(x, y, z) || (game.occupiedAny && game.occupiedAny(x, y, z))) continue;
      c.teleport(x, y, z);
      c.rise = 0;
      c.face(t.x, t.z);
      game.renderer.emit(x, y + 0.1, z, { n: 5, color: JADE, up: 6, speed: 10, life: 0.5, shape: 'puff' });
      game.audio?.play('thud', c);
      return true;
    }
    return false;
  },
  // A harpoon on a line: thrown, and you hauled in.
  harpooner(c, dt) {
    const game = c.game;
    const t = c.target;
    c.lineCd = (c.lineCd ?? 2 + Math.random() * 2) - dt;
    if (!t || t.dead || c.windup || c.lineCd > 0) return false;
    const d = dist(c, t);
    if (d < 3 || d > 7 || (t.x !== c.x && t.z !== c.z && Math.abs(t.x - c.x) !== Math.abs(t.z - c.z)) || !sees(game, c, t)) return false;
    c.lineCd = 7 + Math.random() * 3;
    const tiles = lineTiles(game, c, t, d + 1);
    c.face(t.x, t.z);
    c.say?.('Haul away!', 1, '#e8e0cc');
    addHazard(game, { by: c, tiles, y: c.y, dur: 0.8, dmg: Math.round(3 * (c.dmgMult || 1)), kind: 'dart', from: { x: c.x, z: c.z }, to: { x: t.x, z: t.z }, onFire: (g, h, hit) => {
      for (const e of hit) {
        const to = besideOf(g, c, e);
        if (!to || e.dead) continue;
        e.teleport(to.x, to.y, to.z);
        if (e.kind === 'player') e.grabbedT = Math.max(e.grabbedT || 0, 0.4);
        g.renderer.floatText(e.x, e.y + 2.4, e.z, 'harpooned! hauled in', '#e8e0cc');
      }
    } });
    return true;
  },
  // Down into the earth, and up under you.
  tunneler(c, dt) {
    const game = c.game;
    const t = c.target;
    if (c.burrowT !== undefined) {
      c.burrowT -= dt;
      if (Math.random() < dt * 8) game.renderer.emit(c.digAt.x, c.y + 0.1, c.digAt.z, { n: 1, color: EARTH, up: 6, speed: 4, life: 0.5 });
      if (c.burrowT > 0) return true;
      c.burrowT = undefined;
      c.burrowed = false;
      c.fade = 1;
      const to = (t && !t.dead && besideOf(game, t, c)) || { x: c.x, y: c.y, z: c.z };
      c.teleport(to.x, to.y, to.z);
      game.renderer.emit(to.x, to.y + 0.3, to.z, { n: 16, color: EARTH, up: 40, speed: 40, gravity: 160, life: 0.7 });
      game.audio?.play('crumble', c);
      if (t && !t.dead) {
        c.face(t.x, t.z);
        c.attackCd = 0;
        beginAttack(game, c, t, styleOf(c));
      }
      return true;
    }
    c.digCd = (c.digCd ?? 2 + Math.random() * 3) - dt;
    if (!t || t.dead || c.windup || c.digCd > 0) return false;
    const d = dist(c, t);
    if (d < 3 || d > 10) return false;
    c.digCd = 8 + Math.random() * 3;
    c.burrowed = true;
    c.fade = 0.15;
    c.burrowT = 1.3;
    c.digAt = { x: t.x, z: t.z };
    game.renderer.emit(c.x, c.y + 0.3, c.z, { n: 14, color: EARTH, up: 30, speed: 30, gravity: 160, life: 0.6 });
    game.renderer.floatText(t.x, t.y + 2.4, t.z, 'the ground trembles...', '#d8b890');
    game.audio?.play('rumble', c);
    return true;
  },
  // Here, then behind you, in a shimmer.
  feyKnight(c, dt) {
    const game = c.game;
    const t = c.target;
    c.blinkCd = (c.blinkCd ?? 2 + Math.random() * 2) - dt;
    if (!t || t.dead || c.windup || c.blinkCd > 0) return false;
    const d = dist(c, t);
    if (d < 2 || d > 8 || !sees(game, c, t)) return false;
    const to = besideOf(game, t, c);
    if (!to) {
      c.blinkCd = 1;
      return false;
    }
    c.blinkCd = 6 + Math.random() * 2;
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 16, color: FEY, up: 20, speed: 24, life: 0.8, glow: true });
    c.teleport(to.x, to.y, to.z);
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 16, color: FEY, up: 20, speed: 24, life: 0.8, glow: true });
    c.face(t.x, t.z);
    c.attackCd = 0;
    game.audio?.play('chime', c);
    beginAttack(game, c, t, styleOf(c));
    return true;
  },
};
Object.assign(BRAINS, FAR_MOB_BRAINS);
