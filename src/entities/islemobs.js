// The other Dagoni Islands' own night things (see game.spawning): not the
// skeletons and ghouls of Thessa, but what the mountain and the mist make.
//   On Kharos:
//     ash wraiths: drifting shapes of ash, all but unseen till they strike
//       (their shadow gives them away); they slip round behind you, and
//       their blow fills your lungs with ash (slowed, short of breath);
//     magma slugs: slow, and leaving the ground burning behind them; cut
//       one down and it comes apart into two smaller ones;
//     glasshide stalkers: great beasts grown over with black glass, that
//       arrows glance off; they charge down a straight line at you, and
//       burst into flying shards when they die (stand clear).
//   On Myrrow:
//     bog lurkers: lying under the water (out of sight) till someone comes
//       by; then a long tongue lashes out and drags them in to be bitten,
//       and hurt, a lurker sinks away again;
//     lantern thieves: little long-armed things drawn to firelight: one
//       snatches the torch or lantern out of your hand and runs off into the
//       dark with it (catch it to get it back);
//     spore puffers: what looks like a mushroom, till you're close; then it
//       swells and bursts in a cloud of spores (poisoned, slowed), and lies
//       limp a while, open to a blow, before it swells again.
// Each has its brain here (run before the plain chase-and-bite: see
// creature.js), and is drawn in render/isleart.js.
import { BRAINS, MONSTER_SPECIES, addHazard, addZone, areaTiles, lineTiles, groundFire } from './monsters.js';
import { burn } from '../game/gems.js';
import { knock, beginAttack, styleOf } from '../game/combat.js';
import { removeItem } from '../game/inventory.js';
import { GROUND } from '../config.js';

const dist = (a, b) => Math.max(Math.abs(a.x - b.x), Math.abs(a.z - b.z));
const sees = (game, a, b) => !game.sim || !game.sim.lineOfSight || game.sim.lineOfSight(a.x, a.z, b.x, b.z, a.y + 1);
const ASH = ['#8a8484', '#5a5454', '#a8a2a0'];
const LIGHTS = new Set(['torch', 'lantern']);

export const ISLE_MOB_SPECIES = {
  ash_wraith: {
    name: 'Ash Wraith', hp: 12, dmg: 3, step: 0.3, mode: 'hostile', aggro: 12, night: true, floats: true, fireproof: true, isle: 'kharos', brain: 'ashWraith', style: 'snap',
    drops: [['sulfur', 1, 2, 0.5], ['coin', 1, 3, 0.5]],
    // (Its blow: a lungful of ash.)
    onHit(game, a, v) {
      v.slowT = Math.max(v.slowT || 0, 2.5);
      if (v.kind === 'player') v.stamina = Math.max(0, (v.stamina || 0) - 1.5);
      game.renderer.emit(v.x, v.y + 1.3, v.z, { n: 12, color: ASH, up: 12, speed: 16, life: 1.1, shape: 'puff', gravity: -6 });
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'choking ash', '#c8c0b8');
    },
  },
  magma_slug: {
    name: 'Magma Slug', hp: 22, dmg: 4, step: 0.62, mode: 'hostile', aggro: 9, night: true, fireproof: true, light: 6, noHalo: true, isle: 'kharos', brain: 'magmaSlug', style: 'bite',
    drops: [['obsidian_shard', 1, 2, 0.6], ['sulfur', 1, 2, 0.5]],
    // (Cut down: two smaller ones, crawling out of it.)
    onDeath(game, c) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]].slice(0, 2 + (Math.random() < 0.3 ? 1 : 0))) {
        const x = c.x + dx;
        const z = c.z + dz;
        const y = game.world.findStandY(x, z, c.y);
        if (y < 0 || game.entityAt(x, y, z)) continue;
        game.spawnIsleMob('slugling', x, y, z);
      }
      game.renderer.emit(c.x, c.y + 0.4, c.z, { n: 18, color: ['#ff6020', '#ffa030', '#3a2a28'], up: 30, speed: 40, gravity: 160, life: 0.7 });
      game.renderer.floatText(c.x, c.y + 1.8, c.z, 'it splits!', '#ff9040');
    },
  },
  slugling: {
    name: 'Magma Slugling', hp: 7, dmg: 2, step: 0.45, mode: 'hostile', aggro: 9, night: true, fireproof: true, light: 3, noHalo: true, isle: 'kharos', brain: 'magmaSlug', style: 'snap',
    drops: [['sulfur', 1, 1, 0.4]],
  },
  glasshide: {
    name: 'Glasshide Stalker', hp: 28, dmg: 5, step: 0.32, mode: 'hostile', aggro: 12, night: true, fireproof: true, big: true, glancing: true, isle: 'kharos', brain: 'glasshide', style: 'bite',
    drops: [['obsidian_shard', 2, 4, 1], ['glass', 1, 1, 0.3]],
    // (Dead: its glass flies apart, all round it.)
    onDeath(game, c) {
      const tiles = areaTiles(c.x, c.z, 2, true).filter((t) => t.x !== c.x || t.z !== c.z);
      addHazard(game, { by: c, keep: true, tiles, y: c.y, dur: 0.55, dmg: 3, kind: 'shards', center: { x: c.x, z: c.z }, onFire: (g) => shardBurst(g, c) });
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'cracking...', '#b8a8e0');
      game.audio?.play('crumble', c);
    },
  },
  bog_lurker: {
    name: 'Bog Lurker', hp: 18, dmg: 4, step: 0.4, mode: 'hostile', aggro: 7, night: true, swims: true, isle: 'myrrow', brain: 'bogLurker', style: 'bite',
    drops: [['raw_meat', 1, 2, 0.8], ['slime_gel', 1, 2, 0.6], ['leather', 1, 1, 0.4]],
  },
  lantern_thief: {
    name: 'Lantern Thief', hp: 6, dmg: 1, step: 0.2, mode: 'hostile', aggro: 14, night: true, isle: 'myrrow', brain: 'lanternThief', style: 'snap',
    drops: [['moth_dust', 1, 1, 0.5], ['coin', 1, 4, 0.6]],
  },
  spore_puffer: {
    name: 'Spore Puffer', hp: 10, dmg: 0, step: 0.9, mode: 'hostile', aggro: 5, night: true, isle: 'myrrow', brain: 'sporePuffer',
    drops: [['mushroom', 1, 3, 1], ['glowcap', 1, 1, 0.4]],
  },
};

// And what lives below ground in each island's own old places (see
// world/isledeep.js): slag crabs and forge hounds (iron dogs with a fire
// in their bellies, whose bite burns) in Kharos's Kiln-Deeps and mines;
// reef crabs in the Tide Grottoes (they swim); thornlings, little walking
// briars that snag you, in Thessa's Wildwood Hollows; shroom brutes in the
// peat cuttings; and the islands' own dead and outlaws: Myrrow's bog
// bodies, kept by the peat; Kharos's ash-raiders; Myrrow's pearl pirates.
export const ISLE_DEEP_SPECIES = {
  slag_crab: { name: 'Slag Crab', hp: 14, dmg: 3, step: 0.4, mode: 'hostile', aggro: 9, under: true, fireproof: true, light: 3, noHalo: true, style: 'snap', isle: 'kharos', drops: [['crab_meat', 1, 1, 0.6], ['obsidian_shard', 1, 1, 0.4]] },
  forge_hound: {
    name: 'Forge Hound', hp: 18, dmg: 4, step: 0.26, mode: 'hostile', aggro: 12, under: true, fireproof: true, light: 4, noHalo: true, packs: true, style: 'bite', isle: 'kharos', drops: [['iron_ingot', 1, 1, 0.35], ['coal', 1, 2, 0.4]],
    onHit(game, a, v) {
      burn(game, v, a, 1.5);
    },
  },
  reef_crab: { name: 'Reef Crab', hp: 12, dmg: 3, step: 0.38, mode: 'hostile', aggro: 9, under: true, swims: true, style: 'snap', isle: 'myrrow', drops: [['crab_meat', 1, 2, 0.8], ['pearl', 1, 1, 0.08]] },
  shroom_brute: { name: 'Shroom Brute', hp: 20, dmg: 4, step: 0.45, mode: 'hostile', aggro: 8, under: true, spores: true, style: 'bite', isle: 'myrrow', drops: [['mushroom', 1, 3, 1], ['glowcap', 1, 1, 0.5]] },
  thornling: {
    name: 'Thornling', hp: 9, dmg: 3, step: 0.36, mode: 'hostile', aggro: 10, under: true, packs: true, style: 'snap', isle: 'thessa', drops: [['stick', 1, 2, 0.6], ['herb', 1, 1, 0.3]],
    // (Its thorns catch in you.)
    onHit(game, a, v) {
      if (v.kind !== 'player' || Math.random() > 0.35) return;
      v.grabbedT = Math.max(v.grabbedT || 0, 0.5);
      game.renderer.floatText(v.x, v.y + 2.4, v.z, 'snagged!', '#a0d070');
    },
  },
  bog_body: { ...MONSTER_SPECIES.drowned, name: 'Bog Body', hp: 20, look: 'bog_body', isle: 'myrrow', drops: [['peat_turf', 1, 1, 0.4], ['old_coin', 1, 2, 0.3]] },
  ash_raider: { ...MONSTER_SPECIES.cutthroat, name: 'Ash Raider', look: 'ash_raider', arms: 'hand_axe', offhand: null, hp: 17, isle: 'kharos', drops: [['coin', 1, 5, 0.8], ['sulfur', 1, 2, 0.4]] },
  ash_archer: { ...MONSTER_SPECIES.holdout_archer, name: 'Ash-Raider Archer', look: 'ash_archer', isle: 'kharos' },
  reef_raider: { ...MONSTER_SPECIES.cutthroat, name: 'Pearl Pirate', look: 'reef_raider', arms: 'sabre', offhand: null, hp: 16, isle: 'myrrow', drops: [['coin', 1, 5, 0.8], ['pearl', 1, 1, 0.15]] },
  reef_archer: { ...MONSTER_SPECIES.holdout_archer, name: 'Pirate Gunner', look: 'reef_archer', isle: 'myrrow' },
};

// Black glass flying out of a stalker that's died.
function shardBurst(game, c) {
  const r = game.renderer;
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    r.emit(c.x + Math.cos(a) * 0.5, c.y + 0.8, c.z + Math.sin(a) * 0.5, { n: 2, color: ['#1e1824', '#6a5a8a', '#c8b8f0'], up: 20, speed: 80, gravity: 120, life: 0.6 });
  }
  r.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 4, r1: 44, color: ['#6a5a8a', '#e0d8ff'], life: 0.4, oy: 2, flat: 0.5, thick: 2 });
  game.shake = Math.min(1.2, (game.shake || 0) + 0.35);
  game.audio?.play('glass', c);
}

// A free tile to stand on beside someone, on the far side from `from`.
function behind(game, t, from) {
  const sx = Math.sign(t.x - from.x) || 1;
  const sz = Math.sign(t.z - from.z);
  for (const [dx, dz] of [[sx, sz], [sx, 0], [0, sz || 1], [-sz, sx], [sz, -sx]]) {
    const x = t.x + dx;
    const z = t.z + dz;
    if (!game.world.regionAt(x, z)) continue;
    const y = game.world.findStandY(x, z, t.y);
    if (y < 0 || Math.abs(y - t.y) > 1 || game.entityAt(x, y, z) || game.world.isWaterAt(x, y, z)) continue;
    return { x, y, z };
  }
  return null;
}

export const ISLE_BRAINS = {
  // Unseen, drifting; round behind you in a swirl of ash, and a blow.
  ashWraith(c, dt) {
    const game = c.game;
    const t = c.target;
    c.showT = (c.showT || 0) - dt;
    const want = c.showT > 0 || c.windup ? 1 : 0.1;
    c.fade = (c.fade ?? 0.1) + (want - (c.fade ?? 0.1)) * Math.min(1, dt * 5);
    if (Math.random() < dt * 4) game.renderer.emit(c.x + (Math.random() - 0.5) * 0.6, c.y + 0.9, c.z, { n: 1, color: ASH, up: 6, speed: 6, life: 1.2, shape: 'puff', gravity: -4 });
    if (!t || t.dead || c.windup) return false;
    c.blinkCd = (c.blinkCd ?? 1.5 + Math.random() * 2) - dt;
    const d = dist(c, t);
    if (c.blinkCd <= 0 && d >= 2 && d <= 9 && sees(game, c, t)) {
      const to = behind(game, t, c);
      if (!to) {
        c.blinkCd = 1;
        return false;
      }
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 14, color: ASH, up: 18, speed: 26, life: 0.9, shape: 'puff', gravity: -6 });
      c.teleport(to.x, to.y, to.z);
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 14, color: ASH, up: 18, speed: 26, life: 0.9, shape: 'puff', gravity: -6 });
      c.face(t.x, t.z);
      c.showT = 2.4;
      c.fade = 0.6;
      c.blinkCd = 5 + Math.random() * 2;
      c.attackCd = 0;
      game.audio?.play('whoosh', c);
      beginAttack(game, c, t, styleOf(c));
      return true;
    }
    // (Hanging back, unseen, till it's ready.)
    if (c.blinkCd > 1 && d <= 3 && !c.moving) {
      const sx = Math.sign(c.x - t.x) || 1;
      const sz = Math.sign(c.z - t.z);
      if (c.tryStep(c.x + sx, c.z + sz, c.S.step) || c.tryStep(c.x + sx, c.z, c.S.step)) return true;
    }
    return false;
  },

  // Crawling, and the ground burning where it's been.
  magmaSlug(c) {
    const game = c.game;
    const k = `${c.x},${c.z}`;
    if (c.trailAt && c.trailAt.k !== k) {
      const q = c.trailAt;
      if (game.world.regionAt(q.x, q.z) && !game.world.isWaterAt(q.x, q.y, q.z)) groundFire(game, q.x, q.z, q.y, c, false, 0);
    }
    c.trailAt = { k, x: c.x, y: c.y, z: c.z };
    return false;
  },

  // A charge down a straight line (the ground it'll cross lit first), and
  // through whoever's there.
  glasshide(c, dt) {
    const game = c.game;
    const t = c.target;
    if (!t || t.dead || c.windup) return false;
    c.chargeCd = (c.chargeCd ?? 0) - dt;
    const d = dist(c, t);
    const lined = Math.abs(t.x - c.x) <= 1 || Math.abs(t.z - c.z) <= 1;
    if (c.chargeCd <= 0 && d >= 3 && d <= 9 && lined && sees(game, c, t)) {
      c.chargeCd = 2.5 + Math.random();
      c.face(t.x, t.z);
      const tiles = lineTiles(game, c, t, 9);
      if (!tiles.length) return false;
      c.stunT = 0.9;
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'lowers its head', '#b8a8e0');
      game.audio?.play('growl', c);
      addHazard(game, {
        by: c, tiles, y: c.y, dur: 0.85, dmg: Math.round(5 * (c.dmgMult || 1)), knock: 2, from: { x: c.x, z: c.z }, kind: 'shards',
        onFire: (g) => {
          if (c.dead) return;
          // (As far down the line as it can get: short of whoever's in it.)
          let end = null;
          let n = 0;
          for (const q of tiles) {
            const y = g.world.findStandY(q.x, q.z, c.y);
            if (y <= 0 || Math.abs(y - c.y) > 1 || g.occupiedBySolid(q.x, y, q.z, c)) break;
            end = { x: q.x, y, z: q.z };
            n++;
          }
          if (end) c.startMove(end.x, end.y, end.z, 0.08 * n);
          for (const q of tiles) g.renderer.emit(q.x, c.y + 0.3, q.z, { n: 2, color: ['#1e1824', '#6a5a8a', '#c8b8f0'], up: 14, speed: 24, gravity: 120, life: 0.45 });
          g.shake = Math.min(1.2, (g.shake || 0) + 0.3);
          g.audio?.play('boom', c);
        },
      });
      return true;
    }
    return false;
  },

  // Under the water till you're near; a tongue that drags you in; a bite;
  // and down again when hurt.
  bogLurker(c, dt) {
    const game = c.game;
    const w = game.world;
    const wet = (x, y, z) => w.isWaterAt(x, y, z) || w.isWaterAt(x, y - 1, z);
    c.lashCd = (c.lashCd ?? 0.8) - dt;
    const t = c.target && !c.target.dead ? c.target : game.findPrey(c, 6);
    if (c.burrowed) {
      c.solid = false;
      if (Math.random() < dt * 0.8) game.renderer.emit(c.x, c.y + 0.2, c.z, { n: 1, color: ['#a8c8d0', '#e0f0f4'], up: 10, speed: 2, life: 0.8, shape: 'puff', gravity: -10 });
      if (c.hp < c.maxHp && c.sunkT > 0) {
        c.sunkT -= dt;
        if (Math.random() < dt) c.hp = Math.min(c.maxHp, c.hp + 1);
        return true;
      }
      if (t && dist(c, t) <= 5 && c.lashCd <= 0) {
        c.burrowed = false;
        c.solid = true;
        c.target = t;
        game.renderer.emit(c.x, c.y + 0.5, c.z, { n: 14, color: ['#80b8d8', '#c8e8f8', '#ffffff'], up: 40, speed: 40, gravity: 160, life: 0.7 });
        game.audio?.play('splash', c);
      }
      return true;
    }
    // Never far from the water: back to it when hurt, or when you're off.
    if (!wet(c.x, c.y, c.z) && !c.moving && !c.windup && (!t || c.hp <= c.maxHp * 0.4 || dist(c, t) > 2)) {
      const q = waterNear(game, c.x, c.z, 5);
      if (q) {
        const sx = Math.sign(q.x - c.x);
        const sz = Math.sign(q.z - c.z);
        if (c.tryStep(c.x + sx, c.z + sz, c.S.step) || (sx && c.tryStep(c.x + sx, c.z, c.S.step)) || (sz && c.tryStep(c.x, c.z + sz, c.S.step))) return true;
      }
    }
    // Hurt: back under, and away.
    if (c.hp <= c.maxHp * 0.4 && wet(c.x, c.y, c.z) && !c.windup) {
      c.burrowed = true;
      c.sunkT = 6;
      c.lashCd = 3;
      c.target = null;
      game.renderer.emit(c.x, c.y + 0.4, c.z, { n: 10, color: ['#80b8d8', '#c8e8f8'], up: 20, speed: 20, gravity: 160, life: 0.6 });
      return true;
    }
    if (!t) {
      if (wet(c.x, c.y, c.z)) c.burrowed = true;
      return true;
    }
    c.target = t;
    const d = dist(c, t);
    if (c.lashCd <= 0 && d >= 2 && d <= 5 && !c.windup && sees(game, c, t)) {
      c.lashCd = 5 + Math.random() * 2;
      c.face(t.x, t.z);
      game.renderer.effect?.({ type: 'beam', wx: c.x, wy: c.y + 0.6, wz: c.z, tx: t.x, ty: t.y + 0.9, tz: t.z, life: 0.3, oy: -6, color: '#e88a9a', halo: '#8a3a4a', width: 2 });
      game.audio?.play('whip', c);
      if (t.kind === 'player' && t.rollT > 0) {
        game.renderer.floatText(t.x, t.y + 2, t.z, 'dodged', '#c8e8ff');
        return true;
      }
      // (Reeled in, to a pace off, and held there a moment.)
      knock(game, { x: 2 * t.x - c.x, z: 2 * t.z - c.z }, t, Math.max(1, d - 1));
      if (t.kind === 'player') {
        t.grabbedT = Math.max(t.grabbedT || 0, 0.7);
        game.renderer.floatText(t.x, t.y + 2.4, t.z, 'dragged in! (roll free)', '#e88a9a');
      }
      c.attackCd = 0.4;
      return true;
    }
    // In the water it waits for you to come to it (and goes under again
    // when you're off).
    if (wet(c.x, c.y, c.z) && d > 1) {
      if (d > 7) {
        c.burrowed = true;
        c.lashCd = Math.max(c.lashCd, 0.6);
      }
      return true;
    }
    return false;
  },

  // Drawn to firelight: it snatches it and runs.
  lanternThief(c, dt) {
    const game = c.game;
    const p = game.player;
    if (c.loot) {
      c.target = null;
      c.carryT = (c.carryT || 0) + dt;
      if (Math.random() < dt * 6) game.renderer.emit(c.x, c.y + 1.2, c.z, { n: 1, color: ['#ffd060', '#ff9030'], up: 8, speed: 4, life: 0.5, glow: true, gravity: -10 });
      // (Gone into the dark with it, if it gets far enough.)
      if (dist(c, p) > 30 || c.carryT > 45) {
        c.dead = true;
        game.ui.msg(`The lantern thief is gone into the mist with your ${c.loot.item === 'lantern' ? 'lantern' : 'torch'}.`, '#a0b0c0');
        return true;
      }
      if (!c.moving) {
        const sx = Math.sign(c.x - p.x) || (Math.random() < 0.5 ? 1 : -1);
        const sz = Math.sign(c.z - p.z) || (Math.random() < 0.5 ? 1 : -1);
        for (const [dx, dz] of Math.random() < 0.5 ? [[sx, 0], [0, sz], [sx, sz]] : [[0, sz], [sx, 0], [sx, sz]]) if (c.tryStep(c.x + dx, c.z + dz, c.S.step * 1.2)) break;
      }
      return true;
    }
    const lit = p.heldLightKind && p.heldLightKind() === 'fire';
    if (!lit || p.dead || dist(c, p) > 14) {
      c.target = null;
      return false;
    }
    c.target = p;
    if (dist(c, p) <= 1 && !(c.attackCd > 0) && Math.abs(p.y - c.y) <= 1) {
      c.attackCd = 2;
      if (p.rollT > 0) return true;
      let item = null;
      if (p.equip && LIGHTS.has(p.equip.shield)) {
        item = p.equip.shield;
        p.equip.shield = null;
      } else {
        const s = p.inv[p.selected];
        if (s && LIGHTS.has(s.item)) {
          item = s.item;
          removeItem(p.inv, s.item, 1);
        }
      }
      if (!item) return true;
      c.loot = { item, n: 1 };
      game.lightDirty = true;
      game.refreshBonus?.();
      game.renderer.emit(p.x, p.y + 1.2, p.z, { n: 10, color: ['#ffd060', '#ff9030', '#ffffff'], up: 20, speed: 30, life: 0.5, glow: true });
      game.ui.msg(`A lantern thief snatches your ${item}, and runs! Catch it!`, '#ffb070');
      game.audio?.play('steal', c);
      return true;
    }
    // Darting in, now straight, now aside.
    if (!c.moving) {
      const sx = Math.sign(p.x - c.x);
      const sz = Math.sign(p.z - c.z);
      const odd = Math.random() < 0.3;
      if (!c.tryStep(c.x + (odd ? sz : sx), c.z + (odd ? -sx : sz), c.S.step)) c.tryStep(c.x + sx, c.z, c.S.step);
    }
    return true;
  },

  // Still as a mushroom; then it swells, and bursts; then limp a while.
  sporePuffer(c, dt) {
    const game = c.game;
    if (c.limpT > 0) {
      c.limpT -= dt;
      c.fade = 0.75;
      return true;
    }
    c.fade = 1;
    if (c.swellT !== undefined) {
      c.swellT -= dt;
      c.rise = Math.round(Math.sin(c.swellT * 30) * 1);
      if (Math.random() < dt * 20) game.renderer.emit(c.x + (Math.random() - 0.5), c.y + 0.6, c.z + (Math.random() - 0.5), { n: 1, color: ['#c8f070', '#8ac040'], up: 6, speed: 4, life: 0.5, shape: 'puff' });
      if (c.swellT <= 0) {
        c.swellT = undefined;
        c.rise = 0;
        c.limpT = 6;
        const tiles = areaTiles(c.x, c.z, 2, true);
        addZone(game, { by: c, kind: 'spores', tiles, y: c.y, life: 5, tick: 0.8, dmg: 1, slow: true, puff: ['#c8f070', '#8ac040', '#e0ffb0'] });
        for (const e of [game.player, ...game.npcs]) {
          if (!e || e.dead || dist(c, e) > 2 || Math.abs(e.y - c.y) > 1) continue;
          if (e.kind === 'player' && e.rollT > 0) continue;
          e.poisonT = Math.max(e.poisonT || 0, 5);
          e.poisonSrc = c;
        }
        game.renderer.emit(c.x, c.y + 0.8, c.z, { n: 30, color: ['#c8f070', '#8ac040', '#e0ffb0'], up: 26, speed: 50, life: 1, shape: 'puff', gravity: -8 });
        game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r0: 4, r1: 40, color: ['#8ac040', '#e0ffb0'], life: 0.5, oy: 2, flat: 0.5, thick: 2 });
        game.audio?.play('void', c);
      }
      return true;
    }
    const t = game.findPrey(c, 3);
    if (t && dist(c, t) <= 2 && Math.abs(t.y - c.y) <= 1) {
      c.swellT = 1;
      game.renderer.floatText(c.x, c.y + 1.8, c.z, 'swells...', '#c8f070');
      addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, 1, true), y: c.y, dur: 1, dmg: 0, kind: 'acid' });
    }
    return true;
  },
};
Object.assign(BRAINS, ISLE_BRAINS);

// What spawns at night on each of the other islands (with a bog lurker
// only where there's water to lie in).
export function isleNightSpecies(game, isle, x, z) {
  const r = Math.random();
  if (isle === 'kharos') return r < 0.3 ? 'cinderling' : r < 0.58 ? 'ash_wraith' : r < 0.85 ? 'magma_slug' : 'glasshide';
  if (isle === 'myrrow') {
    const pick = r < 0.16 ? 'wisp' : r < 0.26 ? 'gloam_moth' : r < 0.5 ? 'lantern_thief' : r < 0.76 ? 'spore_puffer' : 'bog_lurker';
    if (pick !== 'bog_lurker') return pick;
    return waterNear(game, x, z) ? 'bog_lurker' : 'spore_puffer';
  }
  return null;
}

// Water to lie in near here (for a bog lurker), if there is any.
export function waterNear(game, x, z, r = 3) {
  const w = game.world;
  for (let dz = -r; dz <= r; dz++) {
    for (let dx = -r; dx <= r; dx++) {
      if (!w.regionAt(x + dx, z + dz)) continue;
      for (const y of [GROUND - 1, GROUND]) if (w.isWaterAt(x + dx, y, z + dz) && !w.isWaterAt(x + dx, y + 1, z + dz)) return { x: x + dx, y, z: z + dz };
    }
  }
  return null;
}
