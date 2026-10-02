// The masters of the old places, three to a kind of place (one picked at
// random for each; see world/dungeongen.js), each its own kind of danger:
//   a barrow: the Barrow King (see monsters.js); the Mound Witch, who
//     blinks about her hall, sets hexes burning round you and ties a
//     thread of your life to hers (break it: get away, or out of her
//     sight); the Pale Huntsman, his hounds, his volleys, the snares he
//     sets where you'll step, and the mark that doubles all of it;
//   a mine: the Deep Worm; Foreman Gask, blasting charges thrown fizzing
//     at you, and the roof brought down across the hall (the rock stays);
//     the Brood Mother, webs that hold you, venom that pools, egg sacs
//     that hatch, and the dark above you she drops out of;
//   a crypt: the Drowned Priest; the Ossuary Horror; the Hollow Saint,
//     who splits into images of herself, throws grave-light in threes and
//     consecrates her hall's floor, one square in two;
//   a holdout: the Warlord; the Twins (two at once, sharing one bar: the
//     one left goes berserk), Rook's hammer and charge and Wren's knives,
//     Wren behind you while Rook winds up; and Mother Nettle the poisoner,
//     flasks that leave the floor poisoned, caltrops, and smoke she steps
//     out of behind you.
// Brains get their helpers from monsters.js (see bossBrains).
import { beginAttack, STYLES, styleOf } from '../game/combat.js';
import { B } from '../world/blocks.js';

// --------------------------------------------------------------- species
export const BOSS_SPECIES = {
  mound_witch: { light: 3, name: 'The Mound Witch', hp: 100, dmg: 4, step: 0.42, mode: 'hostile', aggro: 16, humanoid: true, look: 'witch', under: true, undead: true, boss: true, brain: 'moundWitch', drops: [['old_coin', 4, 10, 1], ['potion_vigor', 1, 2, 1]] },
  huntsman: { light: 2, name: 'The Pale Huntsman', hp: 105, dmg: 5, step: 0.36, mode: 'hostile', aggro: 18, humanoid: true, look: 'huntsman', arms: 'longbow', ranged: true, under: true, undead: true, boss: true, brain: 'huntsman', drops: [['old_coin', 4, 10, 1], ['arrow', 8, 16, 1]] },
  barrow_hound: { light: 2, name: 'Barrow Hound', hp: 10, dmg: 3, step: 0.24, mode: 'hostile', aggro: 16, under: true, undead: true, packs: true, style: 'bite', drops: [] },
  foreman: { name: 'Foreman Gask', hp: 125, dmg: 6, step: 0.44, mode: 'hostile', aggro: 16, humanoid: true, look: 'foreman', arms: 'pickaxe', under: true, undead: true, boss: true, brain: 'foreman', drops: [['gold_ore', 3, 6, 1], ['iron_ingot', 2, 4, 1], ['old_coin', 3, 8, 1]] },
  brood_mother: { name: 'The Brood Mother', hp: 130, dmg: 5, step: 0.34, mode: 'hostile', aggro: 16, big: true, under: true, boss: true, brain: 'broodMother', style: 'bite', drops: [['string', 6, 12, 1], ['leather', 2, 4, 1]] },
  egg_sac: { name: 'Egg Sac', hp: 6, dmg: 0, step: 9, mode: 'hostile', aggro: 30, under: true, brain: 'eggSac', drops: [] },
  broodling: { name: 'Broodling', hp: 4, dmg: 2, step: 0.2, mode: 'hostile', aggro: 14, under: true, packs: true, style: 'bite', drops: [['string', 1, 1, 0.3]] },
  hollow_saint: { light: 5, name: 'The Hollow Saint', hp: 110, dmg: 4, step: 0.4, mode: 'hostile', aggro: 16, humanoid: true, look: 'saint', under: true, undead: true, boss: true, brain: 'hollowSaint', drops: [['old_coin', 4, 10, 1], ['gem', 1, 1, 1]] },
  saint_shade: { light: 3, name: 'The Hollow Saint', hp: 1, dmg: 0, step: 0.4, mode: 'hostile', aggro: 16, humanoid: true, look: 'saint', under: true, undead: true, brain: 'saintShade', drops: [] },
  twins: { name: 'Rook', hp: 95, dmg: 6, step: 0.42, mode: 'hostile', aggro: 16, humanoid: true, look: 'rook', arms: 'warhammer', shield: 'iron_shield', shieldBlock: 0.35, under: true, boss: true, brain: 'rook', drops: [['coin', 8, 20, 1], ['gold_ingot', 1, 1, 1]] },
  twin_b: { name: 'Wren', hp: 75, dmg: 4, step: 0.26, mode: 'hostile', aggro: 16, humanoid: true, look: 'wren', arms: 'dagger', offhand: 'dagger', dodge: 0.25, under: true, boss: true, brain: 'wren', drops: [['coin', 6, 16, 1]] },
  poisoner: { name: 'Mother Nettle', hp: 105, dmg: 4, step: 0.3, mode: 'hostile', aggro: 16, humanoid: true, look: 'poisoner', arms: 'dagger', dodge: 0.15, under: true, boss: true, brain: 'poisoner', drops: [['coin', 8, 20, 1], ['potion_haste', 1, 1, 1]] },
};

// What the top of the screen calls each master when its fight begins.
export const BOSS_TITLES = {
  barrow_king: { name: 'The Barrow King', title: 'Lord of the Mound, Who Would Not Lie Down', taunt: 'Kneel. You stand in my hall.' },
  mound_witch: { name: 'The Mound Witch', title: 'Bride of the Seven Dead Kings', taunt: 'Such warm blood... give it here.' },
  huntsman: { name: 'The Pale Huntsman', title: 'Master of the Barrow Hounds', taunt: 'Run, little hare. They like it when you run.' },
  worm: { name: 'The Deep Worm', title: 'That Which the Miners Woke' },
  foreman: { name: 'Foreman Gask', title: 'Still Working the Last Shift', taunt: 'You\'re late for your shift.' },
  brood_mother: { name: 'The Brood Mother', title: 'Weaver in the Old Workings' },
  priest: { name: 'The Drowned Priest', title: 'Shepherd of the Black Water', taunt: 'Come down into the water, child.' },
  horror: { name: 'The Ossuary Horror', title: 'A Thousand Dead, Heaped Together' },
  hollow_saint: { name: 'The Hollow Saint', title: 'Whose Prayers Went Unanswered', taunt: 'Kneel, and be... consecrated.' },
  warlord: { name: 'The Bandit Warlord', title: 'King of the Holdout', taunt: 'You came all this way to die? Fine.' },
  twins: { name: 'Rook & Wren', title: 'The Twin Blades', taunt: 'Two of us. One of you.' },
  poisoner: { name: 'Mother Nettle', title: 'The Holdout\'s Poisoner', taunt: 'A little something for the pain, dear?' },
  overseer: { name: 'The Overseer', title: 'Last Warden of the Kavorent' },
};

// --------------------------------------------------------------- brains
// `h`: monsters.js's helpers (addHazard, addZone, lob, lineTiles, areaTiles,
// summon, bossSlam, phaseSummons, dist, sees, COLORS).
export function bossBrains(h) {
  const { addHazard, addZone, lob, lineTiles, areaTiles, summon, bossSlam, phaseSummons, dist, sees, COLORS } = h;
  const mult = (c) => c.dmgMult || 1;

  // Somewhere free in its hall, `lo` to `hi` paces from `near`.
  const spotNear = (c, near, lo, hi) => {
    const game = c.game;
    const L = c.leash;
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = lo + Math.random() * (hi - lo);
      const x = Math.round(near.x + Math.cos(a) * r);
      const z = Math.round(near.z + Math.sin(a) * r);
      if (L && (x < L.x0 || x > L.x1 || z < L.z0 || z > L.z1)) continue;
      const y = game.world.findStandY(x, z, c.y);
      if (y !== c.y || game.occupiedBySolid(x, y, z, c) || game.entityAt?.(x, y, z)) continue;
      return { x, y, z };
    }
    return null;
  };
  // Gone in a puff, and somewhere else.
  const blink = (c, to, color) => {
    const game = c.game;
    game.renderer.emit(c.x, c.y + 1, c.z, { n: 16, color, up: 30, speed: 40, life: 0.6, glow: true });
    c.teleport(to.x, to.y, to.z);
    game.moveEntity(c, to.x, to.y, to.z);
    c.path = null;
    game.renderer.emit(to.x, to.y + 1, to.z, { n: 16, color, up: 30, speed: 40, life: 0.6, glow: true });
    game.audio?.play('void', c);
  };
  // Back off from `t` a pace (true if it moved).
  const backOff = (c, t) => {
    if (c.moving) return false;
    const sx = Math.sign(c.x - t.x) || (Math.random() < 0.5 ? 1 : -1);
    const sz = Math.sign(c.z - t.z) || (Math.random() < 0.5 ? 1 : -1);
    return c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step);
  };
  // Lines fanned out toward `t`.
  const fan = (c, t, spread, len) => spread.map((s) => {
    const ang = Math.atan2(t.z - c.z, t.x - c.x) + s;
    const to = { x: c.x + Math.cos(ang) * len, z: c.z + Math.sin(ang) * len };
    const tiles = lineTiles(c.game, c, to, len);
    return { tiles, to: tiles[tiles.length - 1] || to };
  });
  // Down out of hiding (the ceiling, smoke): at `at`, dazed a moment if
  // `daze`.
  const emerge = (c, at, daze) => {
    const game = c.game;
    c.burrowed = false;
    c.solid = true;
    const s = spotNear(c, at, 0, 2) || { x: c.x, y: c.y, z: c.z };
    c.teleport(s.x, s.y, s.z);
    game.moveEntity(c, s.x, s.y, s.z);
    if (daze) c.stunT = Math.max(c.stunT || 0, daze);
  };
  const hide = (c) => {
    c.burrowed = true;
    c.solid = false;
    c.game.removeOcc(c);
  };
  const inHall = (c, q) => !c.leash || (q.x >= c.leash.x0 && q.x <= c.leash.x1 && q.z >= c.leash.z0 && q.z <= c.leash.z1);

  return {
    // ------------------------------------------------ barrow
    moundWitch(c, dt) {
      const game = c.game;
      const t = c.target;
      if (!t || t.dead) return false;
      const d = dist(c, t);
      phaseSummons(c, [0.6, 0.3], () => {
        for (let i = 0; i < 2; i++) summon(game, 'wight', c, 3, { color: ['#a0ff70', '#3a5a2a'] });
        c.say?.('Rise, my husbands! Rise!', 3, '#a0ff70');
      });
      // A thread of your life, drawn into hers: break it by getting away
      // (or out of her sight); she stands still to hold it.
      if (c.tether) {
        c.tether.t -= dt;
        if (d > 7 || !sees(game, c, t) || c.tether.t <= 0 || c.stunT > 0 || t.rollT > 0) {
          c.tether = null;
          game.renderer.floatText(t.x, t.y + 2.4, t.z, 'tether broken', '#c8ffb0');
          return false;
        }
        c.tether.acc += dt;
        if (c.tether.acc >= 0.55) {
          c.tether.acc = 0;
          game.dotHit = true;
          game.damage(t, 1, c);
          game.dotHit = false;
          c.hp = Math.min(c.maxHp, c.hp + 3);
          game.renderer.effect?.({ type: 'siphon', wx: t.x, wy: t.y + 1, wz: t.z, tx: c.x, ty: c.y + 1, tz: c.z, life: 0.5, oy: -6, n: 10, amp: 3, color: ['#c83a3a', '#a0ff70', '#ffffff'] });
          game.renderer.floatText(c.x, c.y + 2.6, c.z, '+3', '#a0ff70');
        }
        c.face(t.x, t.z);
        return true;
      }
      c.tetherCd = (c.tetherCd ?? 5) - dt;
      if (c.tetherCd <= 0 && d >= 2 && d <= 6 && sees(game, c, t) && !c.windup) {
        c.tetherCd = 11;
        c.tether = { t: 3.5, acc: 0 };
        c.say?.('Your life... is mine.', 2.5, '#a0ff70');
        game.renderer.floatText(t.x, t.y + 2.6, t.z, 'TETHERED: get away!', '#ff9070');
        game.audio?.play('drain', c);
        return true;
      }
      // Hexes: three circles round you, kindling one after another.
      c.hexCd = (c.hexCd ?? 3) - dt;
      if (c.hexCd <= 0 && d <= 9 && !c.windup) {
        c.hexCd = 7;
        for (let k = 0; k < 3; k++) {
          const at = k === 0 ? { x: t.x, z: t.z } : { x: t.x + Math.round((Math.random() - 0.5) * 5), z: t.z + Math.round((Math.random() - 0.5) * 5) };
          addHazard(game, { by: c, tiles: areaTiles(at.x, at.z, 1), y: t.y, dur: 1.3 + k * 0.55, dmg: Math.round(4 * mult(c)), chill: 2, kind: 'hex', center: at, color: COLORS.void });
        }
        c.doAction?.(0.4);
        game.audio?.play('void', c);
      }
      // Too close: she's gone, and a cold mist where she stood.
      c.blinkCd = (c.blinkCd ?? 2) - dt;
      if (d <= 2 && c.blinkCd <= 0) {
        const to = spotNear(c, c, 5, 10);
        if (to) {
          c.blinkCd = 6;
          addZone(game, { tiles: areaTiles(c.x, c.z, 1), y: c.y, life: 4, kind: 'mist', tick: 0.6, chill: 1.2, color: [140, 170, 160], puff: ['#a0b8a8', '#d0e0d8'] });
          blink(c, to, ['#a0ff70', '#3a5a2a', '#ffffff']);
          return true;
        }
      }
      if (d <= 3 && backOff(c, t)) return true;
      return d > 1;
    },

    huntsman(c, dt) {
      const game = c.game;
      const t = c.target;
      if (!t || t.dead) return false;
      const d = dist(c, t);
      const hounds = () => {
        for (let i = 0; i < 2; i++) summon(game, 'barrow_hound', c, 2, { color: ['#80e8ff', '#e0fbff'] });
        game.audio?.play('howl', c);
      };
      if (!c.houndsOut) {
        c.houndsOut = true;
        hounds();
        c.say?.('Find them!', 2, '#80e8ff');
      }
      phaseSummons(c, [0.5], hounds);
      // The mark: for a while, everything he and his hounds do to you is
      // the worse for it.
      c.markCd = (c.markCd ?? 6) - dt;
      if (c.markCd <= 0 && sees(game, c, t)) {
        c.markCd = 15;
        t.markedT = 5;
        game.renderer.floatText(t.x, t.y + 2.6, t.z, 'MARKED', '#ff5040');
        for (const o of game.creatures) if (!o.dead && o.species === 'barrow_hound') o.hasteT = 5;
        game.audio?.play('horn', c);
      }
      // A volley: three shafts fanned at you.
      c.volleyCd = (c.volleyCd ?? 3) - dt;
      if (c.volleyCd <= 0 && d >= 2 && d <= 10 && sees(game, c, t) && !c.windup) {
        c.volleyCd = 5;
        c.face(t.x, t.z);
        const dmg = Math.round(3 * mult(c) * (t.markedT > 0 ? 2 : 1));
        for (const ln of fan(c, t, [-0.3, 0, 0.3], 11)) addHazard(game, { by: c, tiles: ln.tiles, y: c.y, dur: 0.95, dmg, kind: 'dart', from: { x: c.x, z: c.z }, to: ln.to, color: [200, 225, 255] });
        c.stunT = 0.95;
        game.audio?.play('draw', c);
        return true;
      }
      // Snares, where you'll step.
      c.snareCd = (c.snareCd ?? 7) - dt;
      if (c.snareCd <= 0) {
        c.snareCd = 12;
        for (let i = 0; i < 3; i++) {
          const q = { x: t.x + Math.round((Math.random() - 0.5) * 4), z: t.z + Math.round((Math.random() - 0.5) * 4) };
          if ((q.x === t.x && q.z === t.z) || !inHall(c, q)) continue;
          addZone(game, { tiles: [q], y: t.y, life: 30, kind: 'snare', once: true, root: 1.6, dmg: Math.round(3 * mult(c)), by: c, color: [160, 150, 140] });
        }
        c.say?.('Mind your step.', 2, '#80e8ff');
      }
      if (d <= 3 && backOff(c, t)) return true;
      // (Otherwise he keeps his range and shoots, like any archer.)
      return false;
    },

    // ------------------------------------------------ mine
    foreman(c, dt) {
      const game = c.game;
      const t = c.target;
      phaseSummons(c, [0.66, 0.33], () => {
        for (let i = 0; i < 2; i++) summon(game, 'skeleton', c, 3, { color: ['#c8a040', '#8a7a5a'] });
        c.say?.('Back to work, lads!', 2.5, '#ffb040');
      });
      if (!t || t.dead) return false;
      const d = dist(c, t);
      // Blasting charges, thrown fizzing at you.
      c.chargeCd = (c.chargeCd ?? 4) - dt;
      if (c.chargeCd <= 0 && d >= 2 && d <= 8 && !c.windup) {
        c.chargeCd = 6.5;
        const n = c.hp / c.maxHp < 0.5 ? 3 : 2;
        for (let k = 0; k < n; k++) {
          const at = { x: t.x + (k ? Math.round((Math.random() - 0.5) * 4) : 0), z: t.z + (k ? Math.round((Math.random() - 0.5) * 4) : 0) };
          lob(game, c, at.x, at.z, {
            tint: [255, 150, 60],
            onLand: (g, x, z, y) => {
              g.audio?.play('fuse', { x, z });
              g.renderer.floatText(x, y + 1.6, z, 'fsss...', '#ffb040');
              addHazard(g, { by: c, tiles: areaTiles(x, z, 1), y, dur: 1.5, dmg: Math.round(6 * mult(c)), burn: 2, knock: 1, from: { x, z: z + 0.001 }, center: { x, z }, kind: 'fire', color: COLORS.fire });
            },
          });
        }
        c.say?.('Fire in the hole!', 1.6, '#ffb040');
        c.doAction?.(0.3);
      }
      // The roof brought down across the hall; some of it stays down.
      c.caveCd = (c.caveCd ?? 9) - dt;
      if (c.caveCd <= 0 && !c.windup) {
        c.caveCd = 13;
        const across = Math.random() < 0.5;
        const tiles = [];
        for (let k = -7; k <= 7; k++) {
          const q = across ? { x: t.x + k, z: t.z } : { x: t.x, z: t.z + k };
          if (inHall(c, q)) tiles.push(q);
        }
        const y = c.y;
        addHazard(game, {
          by: c, tiles, y, dur: 1.8, dmg: Math.round(6 * mult(c)), stun: 0.5, kind: 'rocks', color: COLORS.earth,
          onFire: (g) => {
            for (const q of tiles) {
              if (Math.random() > 0.3 || g.world.getBlock(q.x, y, q.z) !== B.air || g.entityAt?.(q.x, y, q.z) || g.occupiedBySolid(q.x, y, q.z, null)) continue;
              g.world.setBlock(q.x, y, q.z, B.gravel);
            }
          },
        });
        game.renderer.floatText(t.x, t.y + 3, t.z, 'the roof!', '#e0c8a0');
        game.audio?.play('rumble', c);
        game.shake = Math.min(1.2, (game.shake || 0) + 0.4);
      }
      return bossSlam(c, dt, 1, 1.0, 6, 7);
    },

    broodMother(c, dt) {
      const game = c.game;
      const t = c.target;
      // Up in the dark above: then down, onto where you stand.
      if (c.ceiling) {
        c.ceiling.t -= dt;
        if (c.ceiling.t <= 0 && !c.ceiling.dropping && t && !t.dead) {
          c.ceiling.dropping = true;
          const at = { x: Math.max(c.leash?.x0 ?? -1e9, Math.min(c.leash?.x1 ?? 1e9, t.x)), z: Math.max(c.leash?.z0 ?? -1e9, Math.min(c.leash?.z1 ?? 1e9, t.z)) };
          addHazard(game, {
            by: c, keep: true, tiles: areaTiles(at.x, at.z, 1), y: t.y, dur: 1.2, dmg: Math.round(8 * mult(c)), stun: 0.6, knock: 1, from: { x: at.x, z: at.z + 0.001 }, center: at, radius: 1, kind: 'slam', color: COLORS.blow,
            onFire: () => {
              emerge(c, at, 1.2);
              c.ceiling = null;
            },
          });
          game.renderer.floatText(t.x, t.y + 2.6, t.z, 'something above you!', '#ff9070');
          game.audio?.play('skitter', t);
        }
        return true;
      }
      phaseSummons(c, [0.75, 0.5, 0.25], () => {
        for (let i = 0; i < 2; i++) summon(game, 'egg_sac', c, 3, { color: ['#e8e0c8', '#a8a088'] });
        game.audio?.play('skitter', c);
      });
      if (!t || t.dead) return false;
      const d = dist(c, t);
      c.climbCd = (c.climbCd ?? 10) - dt;
      if (c.climbCd <= 0 && !c.windup) {
        c.climbCd = 14;
        c.ceiling = { t: 1.4 };
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 14, color: ['#5a4a3a', '#8a7a5a'], up: 40, speed: 30, life: 0.6 });
        hide(c);
        game.audio?.play('skitter', c);
        return true;
      }
      // Webs: a line at you, and where it ends, it clings.
      c.webCd = (c.webCd ?? 3) - dt;
      if (c.webCd <= 0 && d >= 2 && d <= 8 && sees(game, c, t) && !c.windup) {
        c.webCd = 6;
        const tiles = lineTiles(game, c, t, 8);
        const end = { x: t.x, z: t.z };
        const y = t.y;
        addHazard(game, { by: c, tiles, y, dur: 0.75, kind: 'dart', from: { x: c.x, z: c.z }, to: tiles[tiles.length - 1] || t, color: [235, 235, 245], onFire: (g) => {
          addZone(g, { tiles: areaTiles(end.x, end.z, 1).filter(() => Math.random() < 0.7).concat([end]), y, life: 9, kind: 'web', root: 1.0, slow: true, color: [230, 230, 240] });
        } });
        c.stunT = 0.75;
        game.audio?.play('skitter', c);
        return true;
      }
      // Venom, sprayed in front of her: it pools.
      c.venomCd = (c.venomCd ?? 5) - dt;
      if (c.venomCd <= 0 && d <= 3 && !c.windup) {
        c.venomCd = 8;
        const tiles = [];
        const ang = Math.atan2(t.z - c.z, t.x - c.x);
        for (let r = 1; r <= 3; r++) for (const s of [-0.5, 0, 0.5]) tiles.push({ x: Math.round(c.x + Math.cos(ang + s * (r > 1 ? 1 : 0)) * r), z: Math.round(c.z + Math.sin(ang + s * (r > 1 ? 1 : 0)) * r) });
        const y = c.y;
        addHazard(game, { by: c, tiles, y, dur: 0.85, dmg: Math.round(3 * mult(c)), kind: 'acid', center: { x: c.x, z: c.z }, color: COLORS.poison, onFire: (g) => {
          addZone(g, { tiles, y, life: 5, kind: 'poison', tick: 0.7, dmg: 1, by: c, color: COLORS.poison, puff: ['#8ac040', '#c8f070'] });
        } });
        c.stunT = 0.85;
        return true;
      }
      return false;
    },

    // A sac of eggs: it pulses, and hatches (unless it's burst first).
    eggSac(c, dt) {
      const game = c.game;
      c.hatchT = (c.hatchT ?? 6) - dt;
      if (Math.random() < dt * 3) game.renderer.emit(c.x, c.y + 0.6, c.z, { n: 1, color: ['#e8e0c8'], up: 6, life: 0.4 });
      if (c.hatchT <= 0) {
        for (let i = 0; i < 2; i++) summon(game, 'broodling', c, 1, { color: ['#e8e0c8', '#a8a088'] });
        game.audio?.play('skitter', c);
        game.kill(c, null);
      }
      return true;
    },

    // ------------------------------------------------ crypt
    hollowSaint(c, dt) {
      const game = c.game;
      const t = c.target;
      phaseSummons(c, [0.7, 0.4], () => {
        const shades = [];
        for (let i = 0; i < 2; i++) {
          const s = summon(game, 'saint_shade', c, 4, { color: ['#c8a0ff', '#ffffff'] });
          if (s) {
            s.leash = c.leash;
            s.master = c;
            s.target = t;
            shades.push(s);
          }
        }
        // (And she trades places with one of them: which is she?)
        const s = shades[Math.floor(Math.random() * shades.length)];
        if (s) {
          const a = { x: c.x, y: c.y, z: c.z };
          const b = { x: s.x, y: s.y, z: s.z };
          s.teleport(a.x, a.y, a.z);
          c.teleport(b.x, b.y, b.z);
          game.moveEntity(s, a.x, a.y, a.z);
          game.moveEntity(c, b.x, b.y, b.z);
        }
        c.say?.('Which of us is real?', 2.5, '#c8a0ff');
        game.audio?.play('void', c);
      });
      if (!t || t.dead) return false;
      const d = dist(c, t);
      // Grave-light, in threes.
      c.boltCd = (c.boltCd ?? 2.5) - dt;
      if (c.boltCd <= 0 && d <= 10 && !c.bolts) {
        c.boltCd = 4.5;
        c.bolts = 3;
        c.boltT = 0;
      }
      if (c.bolts > 0) {
        c.boltT -= dt;
        if (c.boltT <= 0) {
          c.boltT = 0.35;
          c.bolts--;
          lob(game, c, t.x + Math.round((Math.random() - 0.5) * 2), t.z + Math.round((Math.random() - 0.5) * 2), { dmg: Math.round(3 * mult(c)), tint: [200, 160, 255] });
          c.doAction?.(0.2);
        }
      }
      // Consecrated ground: one square in two, then the others.
      c.gridCd = (c.gridCd ?? 7) - dt;
      if (c.gridCd <= 0 && c.hp / c.maxHp < 0.9 && c.leash) {
        c.gridCd = 12;
        const L = c.leash;
        for (const par of [0, 1]) {
          const tiles = [];
          for (let z = L.z0; z <= L.z1; z++) for (let x = L.x0; x <= L.x1; x++) if ((x + z) % 2 === par && Math.abs(x - t.x) <= 9 && Math.abs(z - t.z) <= 7) tiles.push({ x, z });
          addHazard(game, { by: c, tiles, y: c.y, dur: 1.7 + par * 1.5, dmg: Math.round(4 * mult(c)), kind: 'hex', center: { x: t.x, z: t.z }, color: [190, 150, 255], quiet: true });
        }
        game.renderer.floatText(c.x, c.y + 3, c.z, 'CONSECRATE', '#c8a0ff');
        game.audio?.play('rune', c);
      }
      c.blinkCd = (c.blinkCd ?? 3) - dt;
      if (d <= 2 && c.blinkCd <= 0) {
        const to = spotNear(c, c, 4, 9);
        if (to) {
          c.blinkCd = 7;
          blink(c, to, ['#c8a0ff', '#ffffff']);
          return true;
        }
      }
      if (d <= 3 && backOff(c, t)) return true;
      return d > 1;
    },

    // An image of the Saint: throws harmless light, and breaks at a touch.
    saintShade(c, dt) {
      const game = c.game;
      const t = c.target;
      if (!c.master || c.master.dead) {
        game.kill(c, null);
        return true;
      }
      if (!t || t.dead) return true;
      const d = dist(c, t);
      c.boltCd = (c.boltCd ?? 2 + Math.random() * 2) - dt;
      if (c.boltCd <= 0 && d <= 10) {
        c.boltCd = 3.5;
        lob(game, c, t.x, t.z, { dmg: 0, tint: [200, 160, 255], onLand: (g, x, z, y) => g.renderer.emit(x, y + 0.6, z, { n: 10, color: ['#c8a0ff', '#ffffff'], up: 20, life: 0.5, glow: true }) });
      }
      if (d <= 3 && backOff(c, t)) return true;
      return true;
    },

    // ------------------------------------------------ holdout
    // Rook: the hammer, a charge down a line, and (hurt) a swap with Wren.
    rook(c, dt) {
      const game = c.game;
      const t = c.target;
      if (!t || t.dead) return false;
      const wren = game.creatures.find((o) => o.species === 'twin_b' && !o.dead);
      if (wren && !c.swapped && c.hp / c.maxHp < 0.5) {
        c.swapped = true;
        const a = { x: c.x, y: c.y, z: c.z };
        const b = { x: wren.x, y: wren.y, z: wren.z };
        c.teleport(b.x, b.y, b.z);
        wren.teleport(a.x, a.y, a.z);
        game.moveEntity(c, b.x, b.y, b.z);
        game.moveEntity(wren, a.x, a.y, a.z);
        for (const q of [a, b]) game.renderer.emit(q.x, q.y + 1, q.z, { n: 14, color: ['#8a8078', '#c8c0b8'], up: 20, speed: 40, life: 0.6, shape: 'puff' });
        wren.say?.('Switch!', 1.5, '#ff9070');
        return true;
      }
      const d = dist(c, t);
      c.chargeCd = (c.chargeCd ?? 5) - dt;
      if (c.chargeCd <= 0 && d >= 3 && d <= 6 && (t.x === c.x || t.z === c.z) && !c.windup) {
        c.chargeCd = 8;
        beginAttack(game, c, t, { ...STYLES.gore, reach: 6, mult: 1.3, windup: 0.95 });
        c.say?.('Out of my way!', 1.5, '#ff9070');
        return true;
      }
      return bossSlam(c, dt, 1, 1.0, 7, 7);
    },

    // Wren: knives thrown in pairs, and behind you while Rook winds up.
    wren(c, dt) {
      const game = c.game;
      const t = c.target;
      if (!t || t.dead) return false;
      const d = dist(c, t);
      const rook = game.creatures.find((o) => o.species === 'twins' && !o.dead);
      c.pincerCd = (c.pincerCd ?? 5) - dt;
      if (rook && (rook.windup || rook.stunT > 0.5) && c.pincerCd <= 0) {
        // (Opposite Rook, at your back.)
        const bx = t.x + Math.sign(t.x - rook.x);
        const bz = t.z + Math.sign(t.z - rook.z);
        const to = spotNear(c, { x: bx, z: bz }, 0, 1.5);
        if (to) {
          c.pincerCd = 7;
          blink(c, to, ['#8a8078', '#c8c0b8']);
          c.face(t.x, t.z);
          beginAttack(game, c, t, { ...styleOf(c), windup: 0.5, mult: 1.3 });
          c.say?.('Behind you!', 1.4, '#ff9070');
          return true;
        }
      }
      c.knifeCd = (c.knifeCd ?? 3) - dt;
      if (c.knifeCd <= 0 && d >= 2 && d <= 7 && sees(game, c, t) && !c.windup) {
        c.knifeCd = 4;
        c.face(t.x, t.z);
        for (const ln of fan(c, t, [-0.18, 0.18], 8)) addHazard(game, { by: c, tiles: ln.tiles, y: c.y, dur: 0.7, dmg: Math.round(3 * mult(c)), kind: 'dart', from: { x: c.x, z: c.z }, to: ln.to, color: [220, 220, 230] });
        c.stunT = 0.7;
        return true;
      }
      return false;
    },

    // Mother Nettle: flasks of poison, caltrops, and smoke.
    poisoner(c, dt) {
      const game = c.game;
      const t = c.target;
      if (c.vanished) {
        c.vanished.t -= dt;
        if (c.vanished.t <= 0 && t && !t.dead) {
          // Out of the smoke, behind you, knife first.
          const back = { x: t.x - (t.dir === 1 ? -1 : t.dir === 3 ? 1 : 0), z: t.z - (t.dir === 0 ? 1 : t.dir === 2 ? -1 : 0) };
          emerge(c, inHall(c, back) ? back : t, 0);
          c.vanished = null;
          c.face(t.x, t.z);
          game.renderer.emit(c.x, c.y + 1, c.z, { n: 16, color: ['#6a7a5a', '#a8b898'], up: 20, speed: 40, life: 0.8, shape: 'puff' });
          beginAttack(game, c, t, { ...styleOf(c), windup: 0.55, mult: 1.6 });
          c.say?.('Surprise, dear.', 1.6, '#c8ff60');
        }
        return true;
      }
      if (!t || t.dead) return false;
      const d = dist(c, t);
      c.smokeCd = (c.smokeCd ?? 7) - dt;
      if (c.smokeCd <= 0 && d <= 4 && !c.windup) {
        c.smokeCd = 10;
        addZone(game, { tiles: areaTiles(c.x, c.z, 1), y: c.y, life: 3, kind: 'smoke', color: [120, 130, 110], puff: ['#6a7a5a', '#a8b898', '#c8d0c0'] });
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 24, color: ['#6a7a5a', '#a8b898', '#c8d0c0'], up: 20, speed: 40, life: 1.2, shape: 'puff' });
        c.vanished = { t: 1.6 };
        hide(c);
        game.audio?.play('flap', c);
        return true;
      }
      c.flaskCd = (c.flaskCd ?? 3) - dt;
      if (c.flaskCd <= 0 && d >= 2 && d <= 9 && !c.windup) {
        c.flaskCd = 4.5;
        lob(game, c, t.x, t.z, {
          tint: [150, 220, 80],
          onLand: (g, x, z, y) => {
            addZone(g, { tiles: areaTiles(x, z, 1), y, life: 7, kind: 'poison', tick: 0.6, dmg: 1, by: c, color: COLORS.poison, puff: ['#8ac040', '#c8f070'] });
            g.renderer.emit(x, y + 0.6, z, { n: 14, color: ['#8ac040', '#c8f070', '#ffffff'], up: 20, speed: 30, life: 0.6 });
            g.audio?.play('shatter', { x, z });
          },
        });
        c.doAction?.(0.3);
      }
      c.caltropCd = (c.caltropCd ?? 4) - dt;
      if (c.caltropCd <= 0 && d <= 2) {
        c.caltropCd = 9;
        const tiles = areaTiles(c.x, c.z, 2).filter((q) => Math.random() < 0.45 && !(q.x === c.x && q.z === c.z) && inHall(c, q));
        addZone(game, { tiles, y: c.y, life: 14, kind: 'caltrops', step: Math.round(2 * mult(c)), slow: true, by: c, color: [150, 150, 160] });
        c.say?.('Careful where you tread.', 1.6, '#c8ff60');
        if (backOff(c, t)) return true;
      }
      if (d <= 2 && backOff(c, t)) return true;
      return d > 1;
    },
  };
}
