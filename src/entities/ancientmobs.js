// (Round 73) What lives in each of the ancient places, its own and nowhere
// else (no more slimes and skeletons borrowed from the old barrows):
//
//   the Athanor, the alchemists' furnace-hall:
//     quicksilver homunculi, that come apart into running beads when
//       they're struck down, and slick you where they touch;
//     alembic golems, glass and copper, that lob burning flasks;
//     sulphur imps, small and quick, whose claws set you alight;
//   the Hall of the Last Champion:
//     oathbound squires, sword and shield, who stand firm once when
//       they should fall;
//     trial sentinels, empty armour with a halberd, that sweep the
//       ground all round them;
//     banner wraiths, that hang back and rally the dead about them;
//   the Sundered Reach:
//     void stalkers, here and then behind you;
//     shard motes, floating splinters of the rift, that burst at you;
//     echo shades, that leave an echo of themselves when hurt and slip
//       away;
//   the Gullet of the World:
//     gut leeches, that drink your blood back into themselves;
//     acid spitters, that keep their distance and spit;
//     maw larvae, quick and many, that burst in acid when they die.
import { BRAINS, addHazard, summon, detonate } from './monsters.js';
import { burn } from '../game/gems.js';
import { beginAttack, styleOf } from '../game/combat.js';
import { ISLE_LOOKS } from '../render/islebossart.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const ACID = [150, 220, 70];
const VOID = ['#c8a0ff', '#5ad8f0', '#ffffff'];
const ring = (x, z, r = 1) => {
  const out = [];
  for (let dz = -r; dz <= r; dz++) for (let dx = -r; dx <= r; dx++) if (dx || dz) out.push({ x: x + dx, z: z + dz });
  return out;
};
const square = (x, z, r = 1) => [{ x, z }, ...ring(x, z, r)];

// Keep at a distance: back off when close, edge in when far.
function keepAway(c, t, near, far, dt) {
  if (c.moving) return true;
  const d = dist(c, t);
  if (d <= near) {
    const sx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
    const sz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
    if (c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step)) return true;
  } else if (d > far) return false;
  else if (Math.random() < dt * 1.2) c.tryStep(c.x + Math.round(Math.random() * 2 - 1), c.z + Math.round(Math.random() * 2 - 1), c.S.step);
  return true;
}

// A free spot behind `t` (from `c`'s side of it).
function behind(game, c, t) {
  const dx = Math.sign(t.x - c.x);
  const dz = Math.sign(t.z - c.z);
  for (const [ox, oz] of [[dx, dz], [dx, 0], [0, dz], [dz, -dx], [-dz, dx]]) {
    if (!ox && !oz) continue;
    const x = t.x + ox;
    const z = t.z + oz;
    if (!game.world.regionAt(x, z)) continue;
    const y = game.world.findStandY(x, z, t.y);
    if (y < 0 || Math.abs(y - t.y) > 1 || game.entityAt(x, y, z) || game.world.isWaterAt(x, y, z)) continue;
    return { x, y, z };
  }
  return null;
}

Object.assign(BRAINS, {
  // Lobs a burning flask at you every few seconds, where you stand (and a
  // pace round it), then wades in.
  alembic(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    c.flaskCd = (c.flaskCd ?? 2 + Math.random() * 2) - dt;
    const d = dist(c, t);
    if (c.flaskCd <= 0 && d >= 2 && d <= 7 && !c.windup) {
      c.flaskCd = 4.5 + Math.random() * 1.5;
      c.face(t.x, t.z);
      addHazard(game, { by: c, tiles: square(t.x, t.z, 1), y: t.y, dur: 1.1, dmg: Math.round(3 * (c.dmgMult || 1)), kind: 'fire', center: { x: t.x, z: t.z }, color: [255, 150, 60], burn: 2 });
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'flask!', '#ffb060');
      game.audio?.play('swing', c);
      c.stunT = 0.7;
      return true;
    }
    return false;
  },
  // Holds a halberd level, and now and then sweeps it round: every pace
  // about it.
  sentinel(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    c.sweepCd = (c.sweepCd ?? 3) - dt;
    if (c.sweepCd <= 0 && dist(c, t) <= 2 && !c.windup) {
      c.sweepCd = 5 + Math.random() * 2;
      addHazard(game, { by: c, tiles: ring(c.x, c.z, 2).filter((q) => dist(q, c) <= 2), y: c.y, dur: 0.9, dmg: Math.round(4 * (c.dmgMult || 1)), kind: 'burst', center: { x: c.x, z: c.z }, color: [220, 200, 140] });
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'sweep!', '#e8d8a0');
      c.stunT = 1.0;
      return true;
    }
    return false;
  },
  // Hangs back, banner high; now and then rallies the dead about it (they
  // mend a little, and fight harder a while).
  banner(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    c.rallyCd = (c.rallyCd ?? 3) - dt;
    if (c.rallyCd <= 0) {
      c.rallyCd = 7 + Math.random() * 2;
      let n = 0;
      for (const o of game.creatures) {
        if (o === c || o.dead || dist(o, c) > 5 || !o.S || !o.S.under) continue;
        o.hp = Math.min(o.maxHp, o.hp + 4);
        o.rallyT = 6;
        o.dmgMult = Math.max(o.dmgMult || 1, 1.25);
        game.renderer.emit(o.x, o.y + 1.2, o.z, { n: 6, color: ['#ffe8a0', '#ffffff'], up: 14, speed: 10, life: 0.6, glow: true });
        n++;
      }
      if (n) game.renderer.floatText(c.x, c.y + 2.8, c.z, 'rally!', '#ffe8a0');
    }
    return keepAway(c, t, 2, 7, dt);
  },
  // Here, and then behind you, mid-swing.
  stalker(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    c.blinkCd = (c.blinkCd ?? 2 + Math.random() * 2) - dt;
    const d = dist(c, t);
    if (c.blinkCd <= 0 && d >= 2 && d <= 7 && !c.windup && !c.moving) {
      const at = behind(game, c, t);
      if (at) {
        c.blinkCd = 4 + Math.random() * 2;
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 12, color: VOID, up: 10, speed: 30, life: 0.5, glow: true });
        c.teleport(at.x, at.y, at.z);
        game.renderer.emit(at.x, at.y + 1, at.z, { n: 12, color: VOID, up: 10, speed: 30, life: 0.5, glow: true });
        game.audio?.play('whoosh', c);
        beginAttack(game, c, t, { ...styleOf(c), windup: 0.45 });
        return true;
      }
    }
    return false;
  },
  // A splinter of the rift: straight at you, and it bursts.
  shard(c) {
    const game = c.game;
    const t = c.target;
    if (c.armed) return true;
    if (t && dist(c, t) <= 1) {
      detonate(game, c, 0.7);
      return true;
    }
    return false;
  },
  // Keeps its distance and spits acid where you stand.
  spitter(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead) return false;
    c.spitCd = (c.spitCd ?? 1.5 + Math.random() * 1.5) - dt;
    const d = dist(c, t);
    if (c.spitCd <= 0 && d >= 2 && d <= 7 && !c.windup) {
      c.spitCd = 3.2 + Math.random();
      c.face(t.x, t.z);
      addHazard(game, { by: c, tiles: [{ x: t.x, z: t.z }, { x: t.x + 1, z: t.z }, { x: t.x - 1, z: t.z }, { x: t.x, z: t.z + 1 }, { x: t.x, z: t.z - 1 }], y: t.y, dur: 0.9, dmg: Math.round(3 * (c.dmgMult || 1)), kind: 'burst', center: { x: t.x, z: t.z }, color: ACID });
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 8, color: ['#a0e050', '#d8f080'], up: 20, speed: 30, life: 0.5 });
      game.audio?.play('splash', c);
      c.stunT = 0.6;
      return true;
    }
    return keepAway(c, t, 1, 7, dt);
  },
});

const D = (o) => ({ mode: 'hostile', under: true, ancient: true, ...o });
export const ANCIENT_SPECIES = {
  // --- the Athanor
  quicksilver_homunculus: D({
    name: 'Quicksilver Homunculus', hp: 18, dmg: 3, step: 0.34, aggro: 10, light: 2, isle: 'velmarch', construct: true, style: 'rake',
    drops: [['frost_crystal', 1, 1, 0.15], ['old_coin', 1, 2, 0.4]],
    onHit(game, a, v) {
      v.slowT = Math.max(v.slowT || 0, 1.5);
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'slicked', '#d0d8e8');
    },
    // Struck down: it runs apart into beads that keep coming.
    onDeath(game, c) {
      for (let i = 0; i < 2; i++) summon(game, 'quicksilver_bead', c, 1, { color: ['#e0e8f0', '#a8b0c0'] });
      game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 16, color: ['#e0e8f0', '#a8b0c0', '#ffffff'], up: 20, speed: 40, gravity: 120, life: 0.6 });
    },
  }),
  quicksilver_bead: D({ name: 'Quicksilver Bead', hp: 4, dmg: 1, step: 0.22, aggro: 10, isle: 'velmarch', construct: true, drops: [] }),
  alembic_golem: D({
    name: 'Alembic Golem', hp: 34, dmg: 5, step: 0.5, aggro: 9, light: 3, isle: 'velmarch', construct: true, armoured: true, brain: 'alembic', style: 'slam',
    drops: [['glass', 1, 3, 0.6], ['iron_ingot', 1, 1, 0.3], ['old_coin', 1, 3, 0.4]],
    onDeath(game, c) {
      addHazard(game, { by: c, keep: true, tiles: ring(c.x, c.z, 1), y: c.y, dur: 0.4, dmg: 2, kind: 'burst', center: { x: c.x, z: c.z }, color: [200, 240, 255] });
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'shatters', '#c8f0ff');
      game.audio?.play('glass', c);
    },
  }),
  sulphur_imp: D({
    name: 'Sulphur Imp', hp: 10, dmg: 2, step: 0.24, aggro: 11, light: 4, isle: 'velmarch', style: 'bite',
    drops: [['sulfur', 1, 2, 0.6], ['coal', 1, 2, 0.4]],
    onHit(game, a, v) {
      burn(game, v, a, 2);
    },
  }),
  // --- the Hall of the Last Champion
  oathbound_squire: D({
    name: 'Oathbound Squire', hp: 24, dmg: 4, step: 0.36, aggro: 10, humanoid: true, look: 'oathbound_squire', arms: 'short_sword', shield: 'iron_shield', shieldBlock: 0.3, undead: true, isle: 'velmarch',
    drops: [['old_coin', 1, 3, 0.6], ['iron_ingot', 1, 1, 0.2]],
    // Once, when it should fall, it stands firm.
    ward(game, c, src, amt) {
      if (!c.firm && c.hp - amt <= 0) {
        c.firm = true;
        c.hp = Math.round(c.maxHp * 0.35);
        game.renderer.floatText(c.x, c.y + 2.6, c.z, 'stands firm!', '#ffe8a0');
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 10, color: ['#ffe8a0', '#ffffff'], up: 20, speed: 20, life: 0.6, glow: true });
        return 0;
      }
      return amt;
    },
  }),
  trial_sentinel: D({
    name: 'Trial Sentinel', hp: 32, dmg: 5, step: 0.48, aggro: 9, humanoid: true, look: 'trial_sentinel', arms: 'halberd', construct: true, armoured: true, isle: 'velmarch', brain: 'sentinel',
    drops: [['iron_ingot', 1, 2, 0.5], ['old_coin', 1, 3, 0.4]],
  }),
  banner_wraith: D({
    name: 'Banner Wraith', hp: 16, dmg: 2, step: 0.4, aggro: 11, floats: true, light: 4, undead: true, isle: 'velmarch', brain: 'banner',
    drops: [['cloth', 1, 2, 0.6], ['old_coin', 1, 2, 0.4]],
  }),
  // --- the Sundered Reach
  void_stalker: D({
    name: 'Void Stalker', hp: 20, dmg: 4, step: 0.3, aggro: 12, light: 2, isle: 'ostria', brain: 'stalker', style: 'pounce',
    drops: [['gem', 1, 1, 0.08], ['old_coin', 1, 2, 0.4]],
  }),
  shard_mote: D({
    name: 'Shard Mote', hp: 6, dmg: 4, step: 0.28, aggro: 12, floats: true, light: 5, isle: 'ostria', brain: 'shard', construct: true,
    drops: [['frost_crystal', 1, 1, 0.25]],
  }),
  echo_shade: D({
    name: 'Echo Shade', hp: 18, dmg: 3, step: 0.34, aggro: 11, humanoid: true, look: 'echo_shade', light: 2, undead: true, isle: 'ostria',
    drops: [['old_coin', 1, 2, 0.4]],
    // Hurt (badly, the first time): it leaves an echo of itself standing
    // and slips away.
    ward(game, c, src, amt) {
      if (!c.echo && !c.echoed && c.hp - amt < c.maxHp * 0.5 && c.hp - amt > 0) {
        c.echoed = true;
        const e = summon(game, 'echo_shade', c, 1, { color: VOID });
        if (e) {
          e.echo = true;
          e.hp = e.maxHp = 6;
        }
        const away = behind(game, src || c, c);
        if (away) c.teleport(away.x, away.y, away.z);
        game.renderer.floatText(c.x, c.y + 2.6, c.z, 'echo', '#c8a0ff');
      }
      return amt;
    },
  }),
  // --- the Gullet of the World
  gut_leech: D({
    name: 'Gut Leech', hp: 16, dmg: 3, step: 0.5, aggro: 9, isle: 'ostria', style: 'bite',
    drops: [['raw_meat', 1, 1, 0.3], ['slime_gel', 1, 2, 0.4]],
    onHit(game, a, v) {
      const k = Math.min(a.maxHp - a.hp, 2);
      if (k > 0) a.hp += k;
      game.renderer.emit(v.x, v.y + 1.2, v.z, { n: 6, color: ['#c02030', '#ff6060'], up: 10, speed: 20, life: 0.5 });
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'bled', '#ff6060');
    },
  }),
  acid_spitter: D({
    name: 'Acid Spitter', hp: 14, dmg: 2, step: 0.4, aggro: 11, isle: 'ostria', brain: 'spitter', style: 'bite',
    drops: [['bone', 1, 2, 0.5], ['slime_gel', 1, 1, 0.3]],
  }),
  maw_larva: D({
    name: 'Maw Larva', hp: 6, dmg: 2, step: 0.22, aggro: 12, isle: 'ostria', style: 'bite',
    drops: [['raw_meat', 1, 1, 0.2]],
    onDeath(game, c) {
      addHazard(game, { by: c, keep: true, tiles: square(c.x, c.z, 1), y: c.y, dur: 0.35, dmg: 1, kind: 'burst', center: { x: c.x, z: c.z }, color: ACID });
      game.renderer.emit(c.x, c.y + 0.5, c.z, { n: 12, color: ['#a0e050', '#d8f080'], up: 20, speed: 30, life: 0.5 });
    },
  }),
};
export const ANCIENT_MOBS = Object.keys(ANCIENT_SPECIES);

// How the ones that walk as people do are dressed.
Object.assign(ISLE_LOOKS, {
  oathbound_squire: { skin: '#9aa0a8', hair: '#c8c8c8', hairStyle: 'bald', shirt: '#6a2a2a', pants: '#4a3a30', shoes: '#3a2a20', outfit: 'tunic', accent: '#e0c060', hat: 'helmet', hatColor: '#8a8a90', eyes: '#ffe8a0', visor: true, gear: { body: 'chain:#7a7a80', legs: 'plate:#6a6a70' } },
  trial_sentinel: { skin: '#3a3a40', hair: '#3a3a40', hairStyle: 'bald', shirt: '#7a7a84', pants: '#6a6a74', shoes: '#5a5a64', outfit: 'plain', accent: '#ffd060', hat: 'helmet', hatColor: '#9a9aa4', eyes: '#ffd060', visor: true, gear: { body: 'plate:#9a9aa4', legs: 'plate:#8a8a94', feet: 'plate:#7a7a84' } },
  echo_shade: { skin: '#3a2a5a', hair: '#1a1030', hairStyle: 'long', shirt: '#2a1a4a', pants: '#1e1238', shoes: '#140c28', outfit: 'robe_mist', accent: '#c8a0ff', hat: 'hood', hatColor: '#2a1a4a', eyes: '#c8a0ff', stoop: true },
});
