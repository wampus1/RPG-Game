// The masters of Myrrow's old places, three to a kind, none of them met
// anywhere else, and every one of them changes its hall as it fights (see
// bosskit.js):
//   a Bog Barrow:
//     the Bog King, who turns his hall's floor to sucking bog under you
//       (it stays bog), sends peat hands up after your ankles, calls up his
//       drowned, and at the last sinks into his bog and comes up under you;
//     the Moth-Mother, whose wings put out every light in her hall (yours
//       too), who sends false lights drifting at you that burst, calls her
//       swarm, and swoops;
//     the Willow Wight, who hangs curtains of moss across her hall and
//       hides in them, lashes you in from afar, and weeps the floor into a
//       shallow flood;
//   a Peat Cutting:
//     the Spore Colossus, giant mushrooms bursting up through the floor
//       round you (they block your way, and burst in spores), rot that
//       turns the floor to poisoned mycelium;
//     the Lamprey Queen, who floods her hall in channels and swims them
//       out of reach, latches on and drinks, and is stranded when the water
//       drains away;
//     the Gas Bloat, whose marsh gas lies about its hall waiting for a
//       flame (your torch; its own will-o'-lights) to set it off;
//   a Mist Crypt:
//     the Lantern-Lord, shielded by the grave-lanterns round his hall (they
//       light it: break them, and the dark comes in), soul-fire, fog;
//     the Hollow King, armour full of fog, who comes apart and comes
//       together again behind you, sends fog creeping across the floor, and
//       raises echoes of himself;
//     the Drowned Choir, three singers and one voice, whose dirge rings
//       out, whose hymn floods the crypt (stand on the plinths), and who at
//       the last sing three beams together;
//   a Pirates' Cove:
//     Makoa Sharktooth, his harpoon (reeled in), nets dropped from the
//       roof, and the sluices opened: currents across his hall;
//     the Pearl-Queen Kailani, pearls that ricochet off the walls, a nacre
//       shell she shuts herself in while her guard fights, and a riptide
//       across the hall;
//     the smugglers' kraken, in a pool of its own, arms up through the
//       floor anywhere, ink, and a grab that throws you across the cove;
//   a Tide Grotto (Myrrow's own):
//     the Tide-Mother, who brings the tide in over her grotto (climb the
//       coral islands she raises) and swims it, whirlpools, and her shell
//       spun across the floor;
//     the Abyssal Clam, open (strike now) and shut (don't bother), pearls
//       fired off the walls, bubbles that hold you, and the undertow
//       dragging you to it as it snaps;
//     the Coral Colossus, a reef grown up across its hall (a maze, then),
//       then burst into shrapnel, and the floor calcified under you.
import { BRAINS, addHazard, addZone, lob, lineTiles, areaTiles, summon, bossSlam, phaseSummons, sporeCloud, COLORS, BOSS_TITLES } from './monsters.js';
import { phaseOf, ready, used } from './tempo.js';
import { knock } from '../game/combat.js';
import { B } from '../world/blocks.js';
import { FY, dist, sees, dmgOf, work, hallTiles, hallOf, inHall, circleTiles, wallTiles, hallLights, setLit, spotIn, blinkTo, backOff, cd, shout, proc, openFloor, drag } from './bosskit.js';

const BOG = ['#5a4a3a', '#7a6a50', '#3a2e22'];
const MIST = ['#a0b8b0', '#d0e0dc', '#ffffff'];
const SEA = ['#80c8e8', '#e0f8ff', '#3a8ab0'];
const mid = (tiles) => tiles[Math.floor(tiles.length / 2)] || tiles[0] || { x: 0, z: 0 };
const hex = (game, c, tiles, dur, dmg, color, o = {}) => tiles.length && addHazard(game, { by: c, tiles, y: c.y, dur, dmg: dmgOf(c, dmg), kind: 'hex', center: mid(tiles), color, quiet: tiles.length > 12, ...o });
const cold = (game, c, tiles, dur, dmg, o = {}) => tiles.length && addHazard(game, { by: c, tiles, y: c.y, dur, dmg: dmgOf(c, dmg), kind: 'cold', color: COLORS.cold, ...o });
const wet = (game, x, z) => game.world.getBlock(x, FY, z) === B.water;

// Flood these tiles (open floor only), for `life` seconds.
function flood(game, c, tiles, life) {
  for (const q of tiles) if (openFloor(game, q.x, q.z)) work(game, q.x, FY, q.z, B.water, life, c);
  game.audio?.play('wave', c);
}

// A line from `c` toward `t` that ricochets off walls (`bounces` times),
// diagonals and all: its runs.
function ricochet(game, c, t, len, bounces) {
  let dx = Math.sign(t.x - c.x);
  let dz = Math.sign(t.z - c.z);
  if (!dx && !dz) dx = 1;
  let x = c.x;
  let z = c.z;
  const out = [];
  let seg = { from: { x, z }, tiles: [] };
  const solid = (qx, qz) => game.world.getBlock(qx, FY, qz) !== B.air && game.world.getBlock(qx, FY, qz) !== B.water;
  for (let n = 0; n < len; n++) {
    if (solid(x + dx, z + dz)) {
      if (bounces-- <= 0) break;
      seg.to = { x, z };
      if (seg.tiles.length) out.push(seg);
      seg = { from: { x, z }, tiles: [] };
      if (dx && solid(x + dx, z)) dx = -dx;
      if (dz && solid(x, z + dz)) dz = -dz;
      if (solid(x + dx, z + dz)) {
        dx = -dx;
        dz = -dz;
      }
      continue;
    }
    x += dx;
    z += dz;
    seg.tiles.push({ x, z });
  }
  seg.to = { x, z };
  if (seg.tiles.length) out.push(seg);
  return out;
}
const pearls = (game, c, t, n, spread) => {
  const base = Math.atan2(t.z - c.z, t.x - c.x);
  for (let k = 0; k < n; k++) {
    const a = base + (k - (n - 1) / 2) * spread;
    const aim = { x: Math.round(c.x + Math.cos(a) * 6), z: Math.round(c.z + Math.sin(a) * 6) };
    ricochet(game, c, aim, 18, 2).forEach((s, i) => addHazard(game, { by: c, tiles: s.tiles, y: c.y, dur: 0.8 + i * 0.25 + k * 0.1, dmg: dmgOf(c, 4), kind: 'beam', from: s.from, to: s.to, beamColor: '#fff8f0', halo: '#c8b8a8', width: 2 }));
  }
  game.audio?.play('reflect', c);
};

// --------------------------------------------------------------- species
const boss = (o) => ({ mode: 'hostile', aggro: 16, under: true, boss: true, isle: 'myrrow', ...o });
export const MYRROW_BOSSES = {
  bog_king: boss({
    name: 'The Bog King', hp: 125, dmg: 6, step: 0.44, humanoid: true, look: 'bog_king', arms: 'mace', undead: true, brain: 'bogKing', tint: ['#8a7a50', '#c8b890'],
    phaseLines: ['', '', 'Up, my drowned! Up!', 'Down. Down into the dark with me.'], drops: [['old_coin', 6, 12, 1], ['peat_turf', 3, 6, 1], ['gem', 1, 1, 0.6]],
  }),
  moth_mother: boss({
    name: 'The Moth-Mother', hp: 120, dmg: 5, step: 0.34, big: true, floats: true, light: 4, brain: 'mothMother', range: 4, tint: ['#c8a0e0', '#f0e0ff'], style: 'snap',
    phaseLines: ['', '', 'Come to the light, little one...', 'DARKNESS. ONLY DARKNESS.'], drops: [['moth_dust', 6, 12, 1], ['glowcap', 2, 4, 1], ['potion_haste', 1, 1, 0.6]],
  }),
  willow_wight: boss({
    name: 'The Willow Wight', hp: 115, dmg: 5, step: 0.4, humanoid: true, look: 'willow_wight', undead: true, brain: 'willowWight', range: 3, tint: ['#8ac080', '#d0f0c0'],
    ward: (game, c, src, n) => {
      if (!c.hidden || Math.random() >= 0.6) return n;
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'lost in the moss', '#a0d090');
      return 0;
    },
    phaseLines: ['', '', 'Weep with me...', 'The water rises. So do I.'], drops: [['old_coin', 6, 12, 1], ['herb', 3, 6, 1], ['potion_breath', 1, 1, 0.7]],
  }),
  spore_colossus: boss({
    name: 'The Spore Colossus', hp: 160, dmg: 7, step: 0.5, big: true, spores: true, brain: 'sporeColossus', tint: ['#c8f070', '#8ac040'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['glowcap', 4, 8, 1], ['spore_tincture', 1, 3, 1], ['mushroom', 4, 8, 1]],
  }),
  lamprey_queen: boss({
    name: 'The Lamprey Queen', hp: 130, dmg: 6, step: 0.28, big: true, swims: true, brain: 'lampreyQueen', tint: ['#a0b8c8', '#ff8090'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['raw_meat', 4, 8, 1], ['pearl', 1, 3, 1], ['gem', 1, 1, 0.6]],
  }),
  gas_bloat: boss({
    name: 'The Gas Bloat', hp: 120, dmg: 5, step: 0.5, big: true, floats: true, brain: 'gasBloat', range: 4, tint: ['#a0d060', '#e0ff90'], style: 'snap',
    phaseLines: ['', '', '', ''], drops: [['slime_gel', 4, 8, 1], ['sulfur', 2, 4, 1], ['spore_tincture', 1, 2, 1]],
  }),
  lantern_lord: boss({
    name: 'The Lantern-Lord Heth', hp: 110, dmg: 5, step: 0.38, humanoid: true, look: 'lantern_lord', undead: true, light: 5, brain: 'lanternLord', range: 5, tint: ['#80e8d0', '#e0fff8'],
    ward: (game, c, src, n) => {
      const lit = game.creatures.filter((o) => !o.dead && o.species === 'grave_lantern').length;
      if (!lit) return n;
      if (!(c.wardNote > 0)) {
        c.wardNote = 0.8;
        game.renderer.floatText(c.x, c.y + 2.6, c.z, `shielded by ${lit} lantern${lit > 1 ? 's' : ''}`, '#80e8d0');
      }
      return Math.max(1, Math.round(n * 0.25));
    },
    phaseLines: ['', '', 'The fog remembers you.', 'Every lantern for every soul!'], drops: [['old_coin', 6, 12, 1], ['lantern', 1, 1, 1], ['spore_tincture', 1, 2, 1]],
  }),
  hollow_king: boss({
    name: 'The Hollow King', hp: 130, dmg: 7, step: 0.4, humanoid: true, look: 'hollow_king', arms: 'greatsword', undead: true, brain: 'hollowKing', tint: ['#a0b8c8', '#ffffff'],
    phaseLines: ['', '', 'My knights. My echoes.', 'There is nothing inside. Nothing!'], drops: [['old_coin', 8, 14, 1], ['iron_breastplate', 1, 1, 0.5], ['gem', 1, 1, 0.6]],
  }),
  drowned_choir: boss({
    name: 'The Drowned Choir', hp: 140, dmg: 5, step: 0.3, big: true, undead: true, anim: true, brain: 'drownedChoir', range: 4, tint: ['#80c8e0', '#e0f8ff'],
    phaseLines: ['', '', 'Sing with us...', 'ONE VOICE. ONE DROWNING.'], drops: [['old_coin', 8, 14, 1], ['pearl_necklace', 1, 1, 1], ['potion_breath', 1, 2, 1]],
  }),
  sharktooth: boss({
    name: 'Makoa Sharktooth', hp: 125, dmg: 6, step: 0.4, humanoid: true, look: 'sharktooth', arms: 'spear', brain: 'sharktooth', range: 3, tint: ['#80c8e8', '#e8e0c8'],
    phaseLines: ['', '', 'Open the sluices, lads!', 'The sea takes everyone in the end!'], drops: [['coin', 12, 24, 1], ['pearl', 2, 4, 1], ['harpoon', 1, 1, 0.5]],
  }),
  pearl_queen: boss({
    name: 'The Pearl-Queen Kailani', hp: 115, dmg: 5, step: 0.36, humanoid: true, look: 'pearl_queen', arms: 'sabre', brain: 'pearlQueen', range: 4, tint: ['#f0e8dc', '#80c8e8'],
    ward: (game, c, src, n) => {
      if (!(c.shellT > 0)) return n;
      if (!(c.wardNote > 0)) {
        c.wardNote = 0.8;
        game.renderer.floatText(c.x, c.y + 2.6, c.z, 'shut in her nacre shell', '#f0e8dc');
      }
      return 0;
    },
    phaseLines: ['', '', 'Guards! To your queen!', 'The tide is mine to command!'], drops: [['pearl', 4, 8, 1], ['pearl_necklace', 1, 2, 1], ['coin', 12, 24, 1]],
  }),
  smugglers_kraken: boss({
    name: 'The Smugglers\' Kraken', hp: 150, dmg: 6, step: 9, big: true, swims: true, anchored: true, anim: true, brain: 'smugglersKraken', tint: ['#c86080', '#ffb0c0'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['raw_meat', 6, 10, 1], ['pearl', 2, 4, 1], ['gem', 1, 2, 0.7]],
  }),
  tide_mother: boss({
    name: 'The Tide-Mother', hp: 160, dmg: 6, step: 0.32, big: true, swims: true, brain: 'tideMother', tint: ['#60c8c0', '#e0fff8'], style: 'bite',
    ward: (game, c, src, n) => (c.spinT > 0 ? Math.max(1, Math.round(n * 0.3)) : n),
    phaseLines: ['', '', '', ''], drops: [['pearl', 4, 8, 1], ['pearl_necklace', 1, 1, 1], ['gem', 1, 2, 0.8]],
  }),
  abyssal_clam: boss({
    name: 'The Abyssal Clam', hp: 150, dmg: 7, step: 9, big: true, anchored: true, brain: 'abyssalClam', tint: ['#f0e8dc', '#8a6ad8'], style: 'bite',
    ward: (game, c, src, n) => {
      if (c.open) return Math.round(n * 1.3);
      if (!(c.wardNote > 0)) {
        c.wardNote = 0.8;
        game.renderer.floatText(c.x, c.y + 2.6, c.z, 'its shell is shut', '#f0e8dc');
      }
      return Math.max(0, Math.round(n * 0.1));
    },
    phaseLines: ['', '', '', ''], drops: [['pearl', 6, 12, 1], ['pearl_necklace', 1, 2, 1], ['gem', 1, 2, 0.8]],
  }),
  coral_colossus: boss({
    name: 'The Coral Colossus', hp: 170, dmg: 8, step: 0.5, big: true, brain: 'coralColossus', tint: ['#ff8a8a', '#ffe0c8'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['coral', 4, 8, 1], ['pearl', 2, 4, 1], ['gem', 1, 2, 0.8]],
  }),
  // (What they bring with them.)
  lure_light: { name: 'False Light', hp: 4, dmg: 0, step: 0.34, mode: 'hostile', aggro: 20, under: true, floats: true, light: 7, isle: 'myrrow', brain: 'lureLight', drops: [] },
  grave_lantern: { name: 'Grave-Lantern', hp: 14, dmg: 0, step: 9, mode: 'hostile', aggro: 0, under: true, anchored: true, undead: true, light: 9, isle: 'myrrow', brain: 'still', drops: [['lantern', 1, 1, 0.2]] },
  fog_knight: { name: 'Echo of the Hollow King', hp: 12, dmg: 4, step: 0.36, mode: 'hostile', aggro: 16, under: true, undead: true, humanoid: true, look: 'fog_knight', arms: 'iron_sword', isle: 'myrrow', drops: [] },
  kraken_arm: { name: 'Kraken Arm', hp: 12, dmg: 5, step: 9, mode: 'hostile', aggro: 3, under: true, anchored: true, isle: 'myrrow', brain: 'krakenArm', style: 'bite', drops: [] },
};

export const MYRROW_TITLES = {
  bog_king: { name: 'The Bog King', title: 'Kept by the Peat for a Thousand Years', taunt: 'You smell of dry land. Not for long.' },
  moth_mother: { name: 'The Moth-Mother', title: 'She Who Eats the Light' },
  willow_wight: { name: 'The Willow Wight', title: 'Who Weeps Over the Barrow' },
  spore_colossus: { name: 'The Spore Colossus', title: 'What Grew in the Old Peat Cuttings' },
  lamprey_queen: { name: 'The Lamprey Queen', title: 'Mouth of the Flooded Cuttings' },
  gas_bloat: { name: 'The Gas Bloat', title: 'Marsh-Breath, Waiting for a Spark' },
  lantern_lord: { name: 'The Lantern-Lord Heth', title: 'Keeper of the Lanterns of the Dead', taunt: 'Another light for my hall.' },
  hollow_king: { name: 'The Hollow King', title: 'Empty Armour, Full of Fog', taunt: '...' },
  drowned_choir: { name: 'The Drowned Choir', title: 'Three Voices Under the Water', taunt: 'Sing... with us...' },
  sharktooth: { name: 'Makoa Sharktooth', title: 'Pirate Chief of the Coves', taunt: 'Another fish for the hook!' },
  pearl_queen: { name: 'The Pearl-Queen Kailani', title: 'Who Took the Pearl Beds for Her Own', taunt: 'Kneel, and I may let you keep your eyes.' },
  smugglers_kraken: { name: 'The Smugglers\' Kraken', title: 'What Guards the Cove\'s Hoard' },
  tide_mother: { name: 'The Tide-Mother', title: 'Who Brings the Sea In' },
  abyssal_clam: { name: 'The Abyssal Clam', title: 'Bed of the Greatest Pearl' },
  coral_colossus: { name: 'The Coral Colossus', title: 'The Reef That Walks' },
};

// --------------------------------------------------------------- brains
export const MYRROW_BRAINS = {
  // ------------------------------------------------ the Bog Barrow
  bogKing(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'bog_body', c, 3, { color: BOG });
    });
    // Sunk into his bog; up under you.
    if (c.sinkT !== undefined) {
      c.sinkT -= dt;
      if (c.sinkT > 0) return true;
      c.sinkT = undefined;
      c.burrowed = false;
      c.solid = true;
      const to = spotIn(c, c.sinkAt, 0, 1) || { x: c.x, y: c.y, z: c.z };
      c.teleport(to.x, to.y, to.z);
      game.moveEntity(c, to.x, to.y, to.z);
      game.renderer.emit(to.x, to.y + 0.4, to.z, { n: 20, color: BOG, up: 40, speed: 40, gravity: 140, life: 0.7 });
      game.audio?.play('splash', c);
      return true;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // The floor round you turned to bog (and it stays bog).
    if (cd(c, 'mireCd', dt, 2) && ready(c) && d <= 10 && !c.windup) {
      c.mireCd = 9;
      used(c, 0.4);
      const tiles = areaTiles(t.x, t.z, 2, true).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z));
      hex(game, c, tiles, 1.1, 2, [110, 90, 60], { onFire: (g) => {
        for (const q of tiles) work(g, q.x, FY - 1, q.z, B.mud, 0, c, { floor: true });
        addZone(g, { by: c, kind: 'mire', tiles, y: c.y, life: 30, slow: true, root: 0.7, color: [90, 74, 50], puff: BOG });
      } });
      game.renderer.floatText(t.x, t.y + 2.4, t.z, 'the ground softens...', '#c8b890');
      game.audio?.play('splash', c);
      return true;
    }
    // Peat hands up out of the ground.
    if (cd(c, 'handsCd', dt, 3) && ready(c) && d <= 10 && !c.windup) {
      c.handsCd = 6;
      used(c);
      const spots = [{ x: t.x, z: t.z }, spotIn(c, t, 1, 2), spotIn(c, t, 1, 3)].filter(Boolean);
      addHazard(game, { by: c, tiles: spots, y: t.y, dur: 1.2, dmg: dmgOf(c, 4), kind: 'erupt', onFire: (g, h, hit) => {
        for (const e of hit) if (e === g.player) {
          e.grabbedT = Math.max(e.grabbedT || 0, 1.2);
          g.renderer.floatText(e.x, e.y + 2.4, e.z, 'grasped by peat hands! (roll free)', '#c8b890');
        }
      } });
      return true;
    }
    // (Desperate) Down into the bog, and up under you.
    const onBog = game.world.getBlock(c.x, FY - 1, c.z) === B.mud;
    if (ph >= 3 && onBog && cd(c, 'sinkCd', dt, 2) && ready(c) && !c.windup) {
      c.sinkCd = 8;
      used(c, 1.4);
      c.burrowed = true;
      c.solid = false;
      game.removeOcc(c);
      c.sinkAt = { x: t.x, y: t.y, z: t.z };
      c.sinkT = 1.4;
      addHazard(game, { by: c, tiles: areaTiles(t.x, t.z, 1), y: t.y, dur: 1.3, dmg: dmgOf(c, 7), kind: 'erupt', keep: true, onFire: (g, h, hit) => {
        for (const e of hit) if (e === g.player) e.grabbedT = Math.max(e.grabbedT || 0, 1);
      } });
      shout(c, 'Down with me!', '#c8b890');
      return true;
    }
    return false;
  },

  mothMother(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 3; i++) summon(game, 'moth', c, 3, { color: ['#c8a0e0', '#f0e0ff'] });
    });
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Her wings: every light in her hall put out (yours too), and dust.
    if (cd(c, 'dustCd', dt, 2.5) && ready(c) && !c.windup) {
      c.dustCd = 10;
      used(c, 0.5);
      for (const q of hallLights(c)) {
        if (q.id === B.candles) work(game, q.x, FY, q.z, B.air, 0, c, { dig: true });
        else if (q.lit) setLit(game, q, false);
      }
      game.player.snuff?.(4);
      addZone(game, { by: c, kind: 'dust', tiles: areaTiles(t.x, t.z, 2), y: c.y, life: 6, slow: true, color: [150, 130, 170], puff: ['#a890c0', '#d0c0e0'] });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'her wings beat: the lights go out', '#c8a0e0');
      game.audio?.play('flap', c);
      return true;
    }
    // False lights, drifting at you; they burst.
    if (cd(c, 'lureCd', dt, 4) && ready(c) && !c.windup) {
      c.lureCd = ph >= 2 ? 7 : 9;
      used(c, 0.3);
      for (let i = 0; i < (ph >= 3 ? 4 : 3); i++) summon(game, 'lure_light', c, 3, { color: ['#fff0a0', '#ffffff'] });
      shout(c, 'Come to the light...', '#f0e0ff');
      return true;
    }
    // (Worn) A swoop across her hall, through you.
    if (ph >= 2 && cd(c, 'diveCd', dt, 3) && ready(c) && d >= 2 && d <= 9 && !c.windup) {
      c.diveCd = 7;
      used(c, 0.6);
      const end = { x: t.x + Math.sign(t.x - c.x) * 3, z: t.z + Math.sign(t.z - c.z) * 3 };
      const tiles = lineTiles(game, c, end, dist(c, end) + 1);
      addHazard(game, { by: c, tiles, y: c.y, dur: 0.9, dmg: dmgOf(c, 6), knock: 2, from: { x: c.x, z: c.z }, kind: 'dart', to: end, onFire: (g) => {
        const last = [...tiles].reverse().find((q) => openFloor(g, q.x, q.z) && !g.entityAt?.(q.x, FY, q.z));
        if (last) blinkTo(c, { x: last.x, y: FY, z: last.z }, ['#c8a0e0', '#f0e0ff']);
      } });
      c.stunT = 1;
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  willowWight(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    c.hidden = game.world.getBlock(c.x, FY, c.z) === B.roots || game.world.getBlock(c.x, FY + 1, c.z) === B.roots;
    c.fade = c.hidden && !c.windup ? 0.3 : 1;
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Curtains of moss hung across her hall: she's all but gone in them.
    if (cd(c, 'curtainCd', dt, 1.5) && ready(c) && !c.windup) {
      c.curtainCd = 12;
      used(c, 0.3);
      for (let k = 0; k < 2; k++) {
        const at = k ? spotIn(c, t, 2, 4) : { x: c.x, z: c.z };
        if (!at) continue;
        for (const q of wallTiles(at, Math.random() < 0.5, 7)) if (inHall(c, q) && openFloor(game, q.x, q.z) && !(q.x === t.x && q.z === t.z)) work(game, q.x, FY, q.z, B.roots, 16, c);
      }
      shout(c, 'Hush...', '#a0d090');
      return true;
    }
    // Her lash: three long whips, and you're drawn in.
    if (cd(c, 'lashCd', dt, 2) && ready(c) && d >= 2 && d <= 7 && !c.windup) {
      c.lashCd = 5;
      used(c);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of [-0.35, 0, 0.35]) {
        const to = { x: c.x + Math.cos(base + s) * 7, z: c.z + Math.sin(base + s) * 7 };
        const line = lineTiles(game, c, to, 7);
        addHazard(game, { by: c, tiles: line, y: c.y, dur: 0.85, dmg: dmgOf(c, 4), kind: 'beam', from: { x: c.x, z: c.z }, to: line[line.length - 1] || to, beamColor: '#a0d090', halo: '#3a5a2a', width: 1, onFire: (g, h, hit) => {
          for (const e of hit) drag(g, e, c, 2);
        } });
      }
      game.audio?.play('whip', c);
      return true;
    }
    // (Worn) She weeps, and the floor floods, shallow, patch by patch.
    if (ph >= 2 && cd(c, 'weepCd', dt, 3) && ready(c) && !c.windup) {
      c.weepCd = 14;
      used(c, 0.6);
      const tiles = hallTiles(c);
      proc(game, c, 0.7, 7, () => {
        const q = tiles[Math.floor(Math.random() * tiles.length)];
        if (q) flood(game, c, areaTiles(q.x, q.z, 1), 16);
        for (let i = 0; i < 6; i++) {
          const r = tiles[Math.floor(Math.random() * tiles.length)];
          if (r) game.renderer.emit(r.x, FY + 2.6, r.z, { n: 1, color: SEA, up: -6, speed: 2, gravity: 160, life: 0.5 });
        }
      });
      shout(c, 'Weep with me...', '#a0d090');
      return true;
    }
    if (d <= 1 && !c.hidden && backOff(c, t)) return true;
    return d > 1;
  },

  // ------------------------------------------------ the Peat Cutting
  sporeColossus(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Giant mushrooms burst up through the floor round you (in your way),
    // and then burst again, in spores.
    if (cd(c, 'fruitCd', dt, 2) && ready(c) && !c.windup) {
      c.fruitCd = ph >= 2 ? 8 : 10;
      used(c, 0.4);
      const spots = [];
      for (let i = 0; i < 5; i++) {
        const at = spotIn(c, t, 1, 3);
        if (at && !spots.some((q) => q.x === at.x && q.z === at.z)) spots.push(at);
      }
      addHazard(game, { by: c, tiles: spots, y: c.y, dur: 1, dmg: dmgOf(c, 5), knock: 1, from: { x: t.x, z: t.z }, kind: 'erupt', onFire: (g) => {
        for (const q of spots) if (work(g, q.x, FY, q.z, B.mushroom_stem, 9, c)) work(g, q.x, FY + 1, q.z, B.glowcap_cap, 9, c);
        proc(g, c, 8.6, 1, () => spots.forEach((q) => sporeCloud(g, q, 1, c)));
      } });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'the floor heaves...', '#c8f070');
      game.audio?.play('rumble', c);
      return true;
    }
    // Spores.
    if (cd(c, 'sporeCd', dt, 3) && ready(c) && d <= 8 && !c.windup) {
      c.sporeCd = 6;
      used(c);
      sporeCloud(game, { x: t.x, z: t.z }, 1, c);
      for (let i = 0; i < 2; i++) {
        const at = spotIn(c, t, 2, 4);
        if (at) lob(game, c, at.x, at.z, { tint: [200, 240, 112], onLand: (g, x, z) => sporeCloud(g, { x, z }, 1, c) });
      }
      game.audio?.play('void', c);
      return true;
    }
    // (Worn) Rot: the floor round it gone to mycelium, poisoned to stand on.
    if (ph >= 2 && cd(c, 'rotCd', dt, 3) && ready(c) && !c.windup) {
      c.rotCd = 12;
      used(c, 0.4);
      const tiles = areaTiles(c.x, c.z, 3, true).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z));
      for (const q of tiles) work(game, q.x, FY - 1, q.z, B.mycelium, 0, c, { floor: true });
      addZone(game, { by: c, kind: 'rot', tiles, y: c.y, life: 20, tick: 1, color: [180, 160, 190], puff: ['#c8bcc8', '#8a6aa0'], onTick: (g, z, inside) => {
        for (const e of inside) if (e === g.player) {
          e.poisonT = Math.max(e.poisonT || 0, 2);
          e.poisonSrc = c;
        }
      } });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'rot spreads under it', '#c8bcc8');
      return true;
    }
    if (bossSlam(c, dt, 2, 1, 7, 5)) return true;
    return false;
  },

  lampreyQueen(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    const inWater = wet(game, c.x, c.z);
    // Under the water she's out of reach; she comes up to bite.
    c.surfaceT = (c.surfaceT || 0) - dt;
    c.submerged = inWater && !(c.surfaceT > 0) && !c.windup;
    // Latched on, drinking.
    if (c.latch) {
      c.latch.t -= dt;
      c.latch.acc += dt;
      if (!t || t.dead || dist(c, t) > 1 || t.rollT > 0 || c.latch.t <= 0 || c.stunT > 0) {
        c.latch = null;
        if (t) game.renderer.floatText(t.x, t.y + 2.4, t.z, 'shaken off', '#c8e8ff');
        return true;
      }
      if (c.latch.acc >= 0.5) {
        c.latch.acc = 0;
        game.dotHit = true;
        game.damage(t, 1, c);
        game.dotHit = false;
        c.hp = Math.min(c.maxHp, c.hp + 2);
        game.renderer.effect?.({ type: 'siphon', wx: t.x, wy: t.y + 1, wz: t.z, tx: c.x, ty: c.y + 1, tz: c.z, life: 0.5, oy: -6, n: 8, amp: 2, color: ['#c83a3a', '#ff8090'] });
      }
      return true;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Her hall flooded in channels.
    if (cd(c, 'chanCd', dt, 0.5) && ready(c) && !c.windup) {
      c.chanCd = 16;
      used(c, 0.6);
      const L = hallOf(c);
      const across = Math.random() < 0.5;
      const lines = [];
      for (let v = across ? L.z0 + 1 : L.x0 + 1; v <= (across ? L.z1 - 1 : L.x1 - 1); v += 3) lines.push(v);
      for (const v of lines) {
        const tiles = [];
        for (let w = across ? L.x0 : L.z0; w <= (across ? L.x1 : L.z1); w++) tiles.push(across ? { x: w, z: v } : { x: v, z: w });
        flood(game, c, tiles, 15);
      }
      // (And she's in one.)
      const near = hallTiles(c, true).filter((q) => wet(game, q.x, q.z)).sort((a, b) => dist(a, c) - dist(b, c))[0];
      if (near) blinkTo(c, { x: near.x, y: FY, z: near.z }, SEA);
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'the water comes in', '#80c8e8');
      return true;
    }
    // Up out of the water at you, and latched on.
    if (cd(c, 'latchCd', dt, 2) && d <= 1 && ready(c) && !c.windup) {
      c.latchCd = 8;
      used(c, 2);
      c.surfaceT = 2.5;
      c.latch = { t: 3, acc: 0 };
      game.renderer.floatText(t.x, t.y + 2.6, t.z, 'LATCHED: roll free!', '#ff8090');
      game.audio?.play('bite', c);
      return true;
    }
    if (d <= 1) c.surfaceT = Math.max(c.surfaceT || 0, 1.2);
    // (Desperate) The water drained away: she's stranded, flopping.
    if (ph >= 3 && cd(c, 'drainCd', dt, 3) && ready(c) && !c.windup) {
      c.drainCd = 18;
      used(c, 1);
      for (const q of game.works || []) if (q.by === c && q.id === B.water) {
        q.life = 0.3;
        q.t = 0;
      }
      c.stunT = 3;
      c.exposedT = 3;
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'STRANDED: strike now!', '#ffe070');
      game.audio?.play('pour', c);
      return true;
    }
    return false;
  },

  gasBloat(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // Gas set off by a flame: yours, or a will-o'-light's.
    for (const z of game.zones || []) {
      if (z.by !== c || z.kind !== 'gas' || z.done) continue;
      const p = game.player;
      const torch = p && p.heldLightKind && p.heldLightKind() === 'fire' && z.tiles.some((q) => Math.abs(q.x - p.x) <= 1 && Math.abs(q.z - p.z) <= 1);
      const wisp = game.creatures.some((o) => !o.dead && o.species === 'wisp' && z.tiles.some((q) => q.x === o.x && q.z === o.z));
      if (torch || wisp) blowGas(game, c, z);
    }
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'wisp', c, 3, { color: ['#c8f070', '#ffffff'] });
    });
    // Swelling up to burst.
    if (c.swellT !== undefined) {
      c.swellT -= dt;
      c.rise = Math.round(Math.sin(c.swellT * 30));
      if (c.swellT > 0) return true;
      c.swellT = undefined;
      c.rise = 0;
      addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, 3, true), y: c.y, dur: 0.05, dmg: dmgOf(c, 9), knock: 2, from: { x: c.x, z: c.z }, kind: 'fire', center: { x: c.x, z: c.z }, burn: 2 });
      for (const z of [...(game.zones || [])]) if (z.by === c && z.kind === 'gas' && !z.done) blowGas(game, c, z);
      game.shake = Math.min(1.6, (game.shake || 0) + 1);
      return true;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Marsh gas let out round its hall.
    if (cd(c, 'gasCd', dt, 2) && ready(c) && !c.windup) {
      c.gasCd = 7;
      used(c, 0.3);
      for (let i = 0; i < 3; i++) {
        const at = spotIn(c, t, 1, 4);
        if (at) addZone(game, { by: c, kind: 'gas', tiles: areaTiles(at.x, at.z, 1).filter((q) => openFloor(game, q.x, q.z)), y: c.y, life: 16, tick: 1, color: [150, 200, 90], puff: ['#a0d060', '#c8f090', '#7a9a40'] });
      }
      if (!game.toldGas) game.ui.msg('Marsh gas, hanging over the floor. A flame near it and it goes up: put your torch away!', '#c8f090', true);
      game.toldGas = true;
      game.audio?.play('hiss', c);
      return true;
    }
    // Gas spat at you.
    if (cd(c, 'spitCd', dt, 3) && ready(c) && d <= 8 && !c.windup) {
      c.spitCd = 5;
      used(c);
      lob(game, c, t.x, t.z, { tint: [160, 210, 90], onLand: (g, x, z) => {
        addHazard(g, { by: c, tiles: areaTiles(x, z, 1), y: c.y, dur: 0.05, dmg: dmgOf(c, 4), kind: 'acid' });
        addZone(g, { by: c, kind: 'gas', tiles: areaTiles(x, z, 1).filter((q) => openFloor(g, q.x, q.z)), y: c.y, life: 12, tick: 1, color: [150, 200, 90], puff: ['#a0d060', '#c8f090'] });
      } });
      return true;
    }
    // (Desperate) It swells, and bursts.
    if (ph >= 3 && cd(c, 'bloatCd', dt, 3) && ready(c) && !c.windup) {
      c.bloatCd = 14;
      used(c, 2);
      c.swellT = 2;
      addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, 3, true), y: c.y, dur: 2, dmg: 0, kind: 'acid' });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'it swells... RUN', '#e0ff90');
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  // ------------------------------------------------ the Mist Crypt
  lanternLord(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    c.wardNote = (c.wardNote || 0) - dt;
    // The grave-lanterns round his hall (lit again as he weakens).
    const lanterns = () => {
      const L = hallOf(c);
      for (const [x, z] of [[L.x0 + 1, L.z0 + 1], [L.x1 - 1, L.z0 + 1], [L.x0 + 1, L.z1 - 1], [L.x1 - 1, L.z1 - 1]]) summon(game, 'grave_lantern', { x, y: c.y, z }, 1, { color: ['#80e8d0', '#e0fff8'] });
    };
    if (!c.lit) {
      c.lit = true;
      lanterns();
      if (!game.toldLanterns) game.ui.msg('Grave-lanterns burn round the hall: while they\'re lit, the Lantern-Lord is shielded. Break them (and the dark comes in).', '#80e8d0', true);
      game.toldLanterns = true;
    }
    phaseSummons(c, [0.5], lanterns);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Soul-fire, thrown in threes.
    if (cd(c, 'soulCd', dt, 2) && ready(c) && d <= 10 && !c.windup) {
      c.soulCd = 4;
      used(c);
      for (let k = 0; k < 3; k++) {
        const at = k ? spotIn(c, t, 1, 2) || t : t;
        lob(game, c, at.x, at.z, { tint: [128, 232, 208], onLand: (g, x, z) => hex(g, c, areaTiles(x, z, 1), 0.4, 4, [128, 232, 208], { chill: 1.5 }) });
      }
      game.audio?.play('void', c);
      return true;
    }
    // (Worn) Fog over half his hall; he steps through it.
    if (ph >= 2 && cd(c, 'fogCd', dt, 3) && ready(c) && !c.windup) {
      c.fogCd = 11;
      used(c, 0.4);
      const L = hallOf(c);
      const tiles = hallTiles(c).filter((q) => (q.x < (L.x0 + L.x1) / 2) === (t.x >= (L.x0 + L.x1) / 2));
      addZone(game, { by: c, kind: 'fog', tiles, y: c.y, life: 9, tick: 1, chill: 1, slow: true, color: [160, 184, 176], puff: MIST });
      const to = tiles[Math.floor(Math.random() * tiles.length)];
      if (to && openFloor(game, to.x, to.z)) blinkTo(c, { x: to.x, y: FY, z: to.z }, MIST);
      shout(c, 'The fog remembers.', '#80e8d0');
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  hollowKing(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'fog_knight', c, 3, { color: MIST });
    });
    // Come apart in fog; together again behind you.
    if (c.fogT !== undefined) {
      c.fogT -= dt;
      if (c.fogT > 0) return true;
      c.fogT = undefined;
      c.burrowed = false;
      c.solid = true;
      if (t && !t.dead) {
        const bx = t.x + Math.sign(t.x - c.fogFrom.x || 1);
        const bz = t.z + Math.sign(t.z - c.fogFrom.z);
        const to = (openFloor(game, bx, bz) && !game.entityAt?.(bx, FY, bz) ? { x: bx, y: FY, z: bz } : null) || spotIn(c, t, 1, 2);
        if (to) blinkTo(c, to, MIST);
        c.face(t.x, t.z);
        c.attackCd = 0;
      }
      return false;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    if (cd(c, 'dispCd', dt, 3) && ready(c) && d <= 9 && !c.windup) {
      c.dispCd = ph >= 3 ? 5 : 8;
      used(c, 1.2);
      addZone(game, { by: c, kind: 'fog', tiles: areaTiles(c.x, c.z, 1), y: c.y, life: 5, tick: 1, chill: 1, color: [160, 184, 176], puff: MIST });
      game.renderer.emit(c.x, c.y + 1, c.z, { n: 24, color: MIST, up: 20, speed: 30, life: 1, shape: 'puff' });
      c.fogFrom = { x: c.x, z: c.z };
      c.burrowed = true;
      c.solid = false;
      game.removeOcc(c);
      c.fogT = 1.3;
      game.audio?.play('whisper', c);
      return true;
    }
    // Fog creeping across the floor at you, from the walls.
    if (cd(c, 'creepCd', dt, 2) && ready(c) && !c.windup) {
      c.creepCd = 9;
      used(c, 0.3);
      const L = hallOf(c);
      const starts = [{ x: L.x0, z: t.z }, { x: L.x1, z: t.z }, { x: t.x, z: L.z0 }, { x: t.x, z: L.z1 }].sort(() => Math.random() - 0.5).slice(0, 3);
      for (const s of starts) {
        const line = lineTiles(game, { x: s.x, y: c.y, z: s.z }, t, dist(s, t) + 2);
        proc(game, c, 0.3, line.length, (k) => {
          const q = line[k];
          if (q) addZone(game, { by: c, kind: 'fog', tiles: [q], y: c.y, life: 6, tick: 0.5, dmg: dmgOf(c, 1), chill: 1.5, color: [160, 184, 176], puff: MIST });
        });
      }
      return true;
    }
    return false;
  },

  drownedChoir(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    const voices = [{ x: c.x - 1, z: c.z }, { x: c.x, z: c.z }, { x: c.x + 1, z: c.z }];
    // The dirge: three rings of it, one from each.
    if (cd(c, 'dirgeCd', dt, 2) && ready(c) && d <= 7 && !c.windup) {
      c.dirgeCd = 5;
      used(c);
      voices.forEach((v, i) => {
        for (let r = 2; r <= 4; r++) cold(game, c, circleTiles(v.x, v.z, r, 0.7).filter((q) => inHall(c, q)), 0.9 + i * 0.45 + (r - 2) * 0.2, 4, { quiet: true });
      });
      game.audio?.play('whisper', c);
      game.renderer.floatText(c.x, c.y + 3.4, c.z, '♪ ♫ ♪', '#80c8e0');
      return true;
    }
    // The hymn: the crypt floods; stand on the plinths.
    if (cd(c, 'hymnCd', dt, 4) && ready(c) && !c.windup) {
      c.hymnCd = 18;
      used(c, 1);
      const tiles = hallTiles(c);
      for (let i = 0; i < 6; i++) {
        const q = spotIn(c, t, 1, 5);
        if (q) work(game, q.x, FY, q.z, B.crypt_floor, 14, c);
      }
      proc(game, c, 1.6, 1, () => {
        flood(game, c, tiles, 10);
        addZone(game, { by: c, kind: 'flood', tiles, y: c.y, life: 10, tick: 1, dmg: dmgOf(c, 1), chill: 1.5, color: [80, 140, 180] });
      });
      shout(c, 'Down... into the water...', '#80c8e0');
      game.ui.msg('The crypt is flooding! Get up on a plinth!', '#80c8e0', true);
      return true;
    }
    // (Desperate) Three voices, one beam each, converging on you.
    if (ph >= 3 && cd(c, 'harmCd', dt, 2) && ready(c) && !c.windup) {
      c.harmCd = 9;
      used(c, 0.8);
      const L = hallOf(c);
      for (const s of [{ x: L.x0, z: L.z0 }, { x: L.x1, z: L.z0 }, { x: Math.round((L.x0 + L.x1) / 2), z: L.z1 }]) {
        const line = lineTiles(game, { x: s.x, y: c.y, z: s.z }, t, dist(s, t) + 3);
        addHazard(game, { by: c, tiles: line, y: c.y, dur: 1.3, dmg: dmgOf(c, 6), kind: 'beam', from: s, to: line[line.length - 1] || t, beamColor: '#e0f8ff', halo: '#3a8ab0', width: 3 });
      }
      shout(c, 'ONE VOICE.', '#e0f8ff');
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  // ------------------------------------------------ the Pirates' Cove
  sharktooth(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // The harpoon: and reeled in.
    if (cd(c, 'harpCd', dt, 2) && ready(c) && d >= 3 && d <= 10 && sees(game, c, t) && !c.windup) {
      c.harpCd = 5;
      used(c);
      c.face(t.x, t.z);
      const line = lineTiles(game, c, t, d + 1);
      addHazard(game, { by: c, tiles: line, y: c.y, dur: 0.75, dmg: dmgOf(c, 4), kind: 'beam', from: { x: c.x, z: c.z }, to: line[line.length - 1] || t, beamColor: '#e8e0c8', halo: '#5a4a3a', width: 1, onFire: (g, h, hit) => {
        for (const e of hit) {
          drag(g, e, c, Math.max(1, dist(c, e) - 1));
          if (e === g.player) {
            e.grabbedT = Math.max(e.grabbedT || 0, 0.6);
            g.renderer.floatText(e.x, e.y + 2.4, e.z, 'harpooned!', '#e8e0c8');
          }
        }
      } });
      shout(c, 'Got one!', '#e8e0c8');
      game.audio?.play('whip', c);
      return true;
    }
    // Nets dropped from the roof.
    if (cd(c, 'netCd', dt, 3) && ready(c) && !c.windup) {
      c.netCd = 9;
      used(c);
      for (let i = 0; i < 3; i++) {
        const at = i ? spotIn(c, t, 1, 3) : { x: t.x, z: t.z };
        if (!at) continue;
        const tiles = areaTiles(at.x, at.z, 1).filter((q) => openFloor(game, q.x, q.z));
        addHazard(game, { by: c, tiles, y: c.y, dur: 1.2, dmg: dmgOf(c, 2), kind: 'rocks', onFire: (g) => addZone(g, { by: c, kind: 'net', tiles, y: c.y, life: 10, root: 1.4, color: [150, 130, 100], puff: ['#8a7a5a'] }) });
      }
      shout(c, 'Drop the nets!', '#e8e0c8');
      return true;
    }
    // (Worn) The sluices opened: water in lanes, a current along them.
    if (ph >= 2 && cd(c, 'sluiceCd', dt, 3) && ready(c) && !c.windup) {
      c.sluiceCd = 14;
      used(c, 0.6);
      const L = hallOf(c);
      const across = Math.random() < 0.5;
      const sink = across ? { x: Math.random() < 0.5 ? L.x0 : L.x1, z: t.z } : { x: t.x, z: Math.random() < 0.5 ? L.z0 : L.z1 };
      for (const off of [-2, 2]) {
        const tiles = [];
        for (let w = across ? L.x0 : L.z0; w <= (across ? L.x1 : L.z1); w++) for (const o of [off, off + 1]) tiles.push(across ? { x: w, z: t.z + o } : { x: t.x + o, z: w });
        const open = tiles.filter((q) => inHall(c, q));
        flood(game, c, open, 12);
        addZone(game, { by: c, kind: 'current', tiles: open, y: c.y, life: 12, tick: 0.4, pull: across ? { x: sink.x, z: t.z + off } : { x: t.x + off, z: sink.z }, color: [90, 160, 200], puff: SEA });
      }
      shout(c, 'Open the sluices!', '#80c8e8');
      return true;
    }
    return false;
  },

  pearlQueen(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    c.wardNote = (c.wardNote || 0) - dt;
    // In her shell: it opens when her guard's down (or in time).
    if (c.shellT > 0) {
      c.shellT -= dt;
      const guard = game.creatures.some((o) => !o.dead && o.pearlGuard === c);
      if (!guard || c.shellT <= 0) {
        c.shellT = 0;
        game.renderer.floatText(c.x, c.y + 3, c.z, 'the shell opens!', '#f0e8dc');
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 20, color: ['#f0e8dc', '#ffffff', '#c8b8a8'], up: 30, speed: 50, life: 0.6 });
        game.audio?.play('glass', c);
      } else {
        if (Math.random() < dt * 4) game.renderer.emit(c.x, c.y + 1, c.z, { n: 1, color: ['#f0e8dc', '#ffffff'], up: 10, speed: 10, life: 0.6, glow: true });
        return true;
      }
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Shut in her nacre, while her guard fights for her.
    if ((c.hp < c.maxHp * 0.8 || ph >= 2) && cd(c, 'shellCd', dt, 1) && ready(c) && !c.windup) {
      c.shellCd = 18;
      used(c, 1);
      c.shellT = 10;
      for (let i = 0; i < 2; i++) {
        const g = summon(game, 'reef_raider', c, 3, { color: ['#f0e8dc', '#80c8e8'] });
        if (g) g.pearlGuard = c;
      }
      shout(c, 'Guards!', '#f0e8dc');
      if (!game.toldShell) game.ui.msg('The Pearl-Queen shuts herself in a shell of nacre: bring down her guard to open it.', '#f0e8dc', true);
      game.toldShell = true;
      return true;
    }
    // Pearls, ricocheting off the walls.
    if (cd(c, 'pearlCd', dt, 2) && ready(c) && d >= 2 && !c.windup) {
      c.pearlCd = 4.5;
      used(c);
      pearls(game, c, t, ph >= 3 ? 4 : 3, 0.45);
      return true;
    }
    // (Worn) A riptide across her hall from one side to the other.
    if (ph >= 2 && cd(c, 'ripCd', dt, 3) && ready(c) && !c.windup) {
      c.ripCd = 11;
      used(c, 0.8);
      const L = hallOf(c);
      const dir = Math.random() < 0.5 ? 1 : -1;
      const cols = [];
      for (let x = dir > 0 ? L.x0 : L.x1; x >= L.x0 && x <= L.x1; x += dir) cols.push(x);
      cols.forEach((x, k) => {
        const tiles = [];
        for (let z = L.z0; z <= L.z1; z++) if (openFloor(game, x, z, true)) tiles.push({ x, z });
        cold(game, c, tiles, 0.8 + k * 0.12, 4, { knock: 2, from: { x: x - dir, z: t.z }, quiet: k % 3 !== 0 });
      });
      shout(c, 'Riptide!', '#80c8e8');
      game.audio?.play('wave', c);
      return true;
    }
    if (d <= 1 && ph < 2 && backOff(c, t)) return true;
    return false;
  },

  smugglersKraken(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // Its own pool, round it.
    if (!c.pooled) {
      c.pooled = true;
      flood(game, c, areaTiles(c.x, c.z, 2, true).filter((q) => Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) > 1), 0);
    }
    if (!t || t.dead) return true;
    const d = dist(c, t);
    // Arms up through the floor anywhere.
    if (cd(c, 'armCd', dt, 1.5) && ready(c) && !c.windup) {
      c.armCd = ph >= 2 ? 5 : 7;
      used(c, 0.3);
      for (let i = 0; i < (ph >= 3 ? 3 : 2); i++) {
        const at = spotIn(c, t, 1, 2);
        if (!at) continue;
        addHazard(game, { by: c, tiles: [at], y: c.y, dur: 0.9, dmg: dmgOf(c, 4), knock: 1, from: { x: at.x, z: at.z + 0.01 }, kind: 'erupt', onFire: (g) => {
          const arm = summon(g, 'kraken_arm', { x: at.x, y: c.y, z: at.z }, 0, { color: ['#c86080', '#ffb0c0'] });
          if (arm) arm.armT = 8;
        } });
      }
      game.audio?.play('splash', c);
      return true;
    }
    // Ink: a black cloud, your light gone in it.
    if (cd(c, 'inkCd', dt, 4) && ready(c) && !c.windup) {
      c.inkCd = 10;
      used(c, 0.3);
      lob(game, c, t.x, t.z, { tint: [20, 16, 24], onLand: (g, x, z) => addZone(g, {
        by: c, kind: 'ink', tiles: areaTiles(x, z, 2, true), y: c.y, life: 8, tick: 0.5, slow: true, color: [16, 12, 20], puff: ['#100c14', '#2a2430'],
        onTick: (gg, zz, inside) => {
          for (const e of inside) if (e === gg.player) e.snuff?.(1);
        },
      }) });
      for (const q of hallLights(c)) if (q.lit && Math.random() < 0.5) setLit(game, q, false);
      game.audio?.play('splash', c);
      return true;
    }
    // (Worn) A grab, and a throw across the cove.
    if (ph >= 2 && cd(c, 'throwCd', dt, 3) && ready(c) && d <= 7 && !c.windup) {
      c.throwCd = 9;
      used(c, 0.6);
      const line = lineTiles(game, c, t, d + 1);
      addHazard(game, { by: c, tiles: line, y: c.y, dur: 1, dmg: dmgOf(c, 5), kind: 'beam', from: { x: c.x, z: c.z }, to: line[line.length - 1] || t, beamColor: '#ffb0c0', halo: '#8a3050', width: 3, onFire: (g, h, hit) => {
        for (const e of hit) {
          knock(g, c, e, 5);
          if (e === g.player) g.renderer.floatText(e.x, e.y + 2.6, e.z, 'THROWN!', '#ffb0c0');
        }
      } });
      return true;
    }
    return true;
  },

  // ------------------------------------------------ the Tide Grotto
  tideMother(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    const inWater = wet(game, c.x, c.z);
    if (inWater) c.hasteT = Math.max(c.hasteT || 0, 0.3);
    // Spun in her shell across the grotto.
    if (c.spinT > 0) {
      c.spinT -= dt;
      return true;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // The tide comes in over the grotto: climb the coral she raises.
    if (cd(c, 'tideCd', dt, 2) && ready(c) && !c.windup) {
      c.tideCd = 18;
      used(c, 1);
      const tiles = hallTiles(c);
      const isles = [];
      for (let i = 0; i < 5; i++) {
        const q = spotIn(c, i ? c : t, i ? 3 : 1, i ? 8 : 3);
        if (q && work(game, q.x, FY, q.z, B.coral_rock, 13, c)) isles.push(q);
      }
      proc(game, c, 2, 1, () => {
        flood(game, c, tiles, 10);
        addZone(game, { by: c, kind: 'tide', tiles, y: c.y, life: 10, tick: 1, slow: true, chill: 1, color: [80, 170, 200] });
      });
      game.ui.msg('The tide is coming in! Up onto the coral!', '#80c8e8', true);
      game.audio?.play('wave', c);
      return true;
    }
    // A whirlpool where you stand.
    if (cd(c, 'whirlCd', dt, 3) && ready(c) && d <= 10 && !c.windup) {
      c.whirlCd = 9;
      used(c);
      const at = { x: t.x, z: t.z };
      addZone(game, { by: c, kind: 'whirlpool', tiles: areaTiles(at.x, at.z, 3, true), y: c.y, life: 5, tick: 0.5, dmg: dmgOf(c, 1), pull: at, color: [60, 150, 200], puff: SEA });
      game.renderer.floatText(at.x, FY + 2.4, at.z, 'a whirlpool!', '#80c8e8');
      return true;
    }
    // (Worn) Into her shell, and spun across the grotto off its walls.
    if (ph >= 2 && cd(c, 'spinCd', dt, 3) && ready(c) && !c.windup) {
      c.spinCd = 10;
      used(c, 1.5);
      const segs = ricochet(game, c, t, 22, 2);
      let delay = 0.6;
      for (const s of segs) {
        addHazard(game, { by: c, tiles: s.tiles, y: c.y, dur: delay, dmg: dmgOf(c, 7), knock: 2, from: s.from, kind: 'slam', center: s.to, radius: 1, color: COLORS.blow, quiet: true });
        delay += s.tiles.length * 0.06;
      }
      const end = segs.length ? segs[segs.length - 1].to : null;
      c.spinT = delay + 0.2;
      proc(game, c, delay, 1, () => {
        if (end && openFloor(game, end.x, end.z, true) && !game.entityAt?.(end.x, FY, end.z)) blinkTo(c, { x: end.x, y: FY, z: end.z }, SEA);
      });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'she draws into her shell...', '#80c8e8');
      return true;
    }
    return false;
  },

  abyssalClam(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    c.wardNote = (c.wardNote || 0) - dt;
    // Open, and shut (and drawn so: see islebossart.js).
    c.variant = c.open ? 1 : 0;
    c.cycle = (c.cycle ?? 3) - dt;
    if (c.cycle <= 0) {
      c.open = !c.open;
      c.cycle = c.open ? 3.5 : 4;
      if (c.open) {
        game.renderer.floatText(c.x, c.y + 3, c.z, 'it opens: strike now!', '#ffe070');
        // (Worn) The undertow as it opens: you're drawn to it.
        if (ph >= 2) addZone(game, { by: c, kind: 'undertow', tiles: hallTiles(c), y: c.y, life: 2.8, tick: 0.45, pull: { x: c.x, z: c.z }, puff: SEA });
      } else {
        // (Snapping shut.)
        addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, 2), y: c.y, dur: 0.05, dmg: dmgOf(c, ph >= 2 ? 10 : 6), knock: 2, from: { x: c.x, z: c.z }, kind: 'slam', center: { x: c.x, z: c.z }, radius: 2, color: COLORS.blow });
        game.audio?.play('clang', c);
      }
    }
    c.fade = 1;
    if (!t || t.dead) return true;
    // Open: pearls off the walls.
    if (c.open && cd(c, 'volleyCd', dt, 0.6)) {
      c.volleyCd = 2.2;
      used(c);
      pearls(game, c, t, 2, 0.6);
      return true;
    }
    // Shut: bubbles that hold you where they burst.
    if (!c.open && cd(c, 'bubbleCd', dt, 2) && ready(c)) {
      c.bubbleCd = 6;
      used(c);
      for (let i = 0; i < 3; i++) {
        const at = i ? spotIn(c, t, 1, 2) || t : t;
        lob(game, c, at.x, at.z, { tint: [200, 240, 255], onLand: (g, x, z) => {
          addZone(g, { by: c, kind: 'bubble', tiles: [{ x, z }], y: c.y, life: 8, root: 1.5, once: true, dmg: dmgOf(c, 2), color: [200, 240, 255], puff: SEA });
        } });
      }
      return true;
    }
    return true;
  },

  coralColossus(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Coral grown up out of the floor round you, in clumps: a reef.
    if (cd(c, 'growCd', dt, 2) && ready(c) && !c.windup) {
      c.growCd = 8;
      used(c, 0.3);
      const spots = [];
      for (let i = 0; i < 3; i++) {
        const at = spotIn(c, t, 2, 4);
        if (at) for (const q of areaTiles(at.x, at.z, 1)) if (Math.random() < 0.45 && inHall(c, q)) spots.push(q);
      }
      addHazard(game, { by: c, tiles: spots, y: c.y, dur: 0.9, dmg: dmgOf(c, 4), kind: 'erupt', onFire: (g) => {
        for (const q of spots) if (work(g, q.x, FY, q.z, B.coral, 0, c, { meta: Math.floor(Math.random() * 4) })) game.renderer.emit(q.x, FY + 0.6, q.z, { n: 4, color: ['#ff8a8a', '#ffe0c8'], up: 20, speed: 20, life: 0.5 });
      } });
      game.audio?.play('crumble', c);
      return true;
    }
    // Its reef burst into shrapnel round you.
    const reef = (game.works || []).filter((q) => q.by === c && q.id === B.coral && dist(q, t) <= 5);
    if (reef.length >= 3 && cd(c, 'shatterCd', dt, 4) && ready(c) && !c.windup) {
      c.shatterCd = 10;
      used(c, 0.4);
      hex(game, c, reef.flatMap((q) => areaTiles(q.x, q.z, 1)), 1.1, 5, [255, 160, 150], { onFire: (g) => reef.forEach((q) => work(g, q.x, FY, q.z, B.air, 0.01, c, { dig: true })) });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'the reef cracks...', '#ff8a8a');
      return true;
    }
    // (Worn) The floor calcified round you: slow going, and wearying.
    if (ph >= 2 && cd(c, 'calcCd', dt, 3) && ready(c) && d <= 9 && !c.windup) {
      c.calcCd = 11;
      used(c);
      addZone(game, { by: c, kind: 'lime', tiles: areaTiles(t.x, t.z, 2, true), y: c.y, life: 9, tick: 0.8, slow: true, color: [230, 220, 200], puff: ['#f0e8dc', '#d8d0c0'], onTick: (g, z, inside) => {
        for (const e of inside) if (e === g.player) e.stamina = Math.max(0, (e.stamina || 0) - 1);
      } });
      return true;
    }
    if (bossSlam(c, dt, 2, 1.1, 8, 5)) return true;
    return false;
  },

  // ------------------------------------------------ what they bring
  // A false light drifting at you; close, it bursts.
  lureLight(c, dt) {
    const game = c.game;
    const t = game.player;
    c.lifeT = (c.lifeT ?? 12) - dt;
    if (!t || t.dead || c.lifeT <= 0 || dist(c, t) <= 1) {
      addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, 1), y: c.y, dur: 0.35, dmg: 5, kind: 'burst', center: { x: c.x, z: c.z }, keep: true });
      c.dead = true;
      return true;
    }
    if (!c.moving) {
      const sx = Math.sign(t.x - c.x);
      const sz = Math.sign(t.z - c.z);
      c.tryStep(c.x + sx, c.z + sz, c.S.step) || c.tryStep(c.x + sx, c.z, c.S.step) || c.tryStep(c.x, c.z + sz, c.S.step);
    }
    return true;
  },
  // A kraken's arm: it lashes whoever's beside it, and sinks back in time.
  krakenArm(c, dt) {
    c.armT = (c.armT ?? 8) - dt;
    if (c.armT <= 0) {
      c.game.renderer.emit(c.x, c.y + 0.4, c.z, { n: 8, color: SEA, up: 20, speed: 20, life: 0.5 });
      c.dead = true;
      return true;
    }
    const t = c.target;
    return !(t && !t.dead && dist(c, t) <= 1);
  },
  still() {
    return true;
  },
};

// Marsh gas going up.
function blowGas(game, c, z) {
  z.done = true;
  addHazard(game, { by: c, tiles: z.tiles, y: z.y, dur: 0.05, dmg: dmgOf(c, 8), burn: 2, knock: 1, from: z.tiles[0], kind: 'fire', center: mid(z.tiles), keep: true });
  game.shake = Math.min(1.4, (game.shake || 0) + 0.5);
}

Object.assign(BRAINS, MYRROW_BRAINS);
Object.assign(BOSS_TITLES, MYRROW_TITLES);
