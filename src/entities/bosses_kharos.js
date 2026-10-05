// The masters of Kharos's old places, three to a kind, none of them met
// anywhere else. A few of them change their halls as they fight (see
// bosskit.js for the works they make); the rest each have a way of their
// own with you (see game/afflict.js for what they leave you in):
//   an Ash Barrow:
//     the Cinder King, who lays decrees on you: KNEEL (not a step, not a
//       blow) or BEGONE (keep moving). Obey and he's satisfied, and off
//       his guard; defy him and burn. His crown flares in rings, his
//       sceptre runs fire at you (or brands the floor by you in a cross),
//       worn, he sets a crown of fire round you that closes ring by ring;
//       his ashen court rises;
//     the Urn-Mother, who pours her ashes over the floor and breathes in
//       the hall's air: be at her lip when she's done and she swallows you
//       (strike and strike to burst out of her); she spits shards of
//       herself, and glows white-hot when you're close;
//     the Smoke Herald, all but gone in his smoke, whose horn sends rings
//       of force across the hall blast on blast (no outrunning them: roll
//       through each as it comes); he steps out of his smoke at your back,
//       and worn, sets the smoke round you alight;
//   a Glass Mine:
//     the Glass Wyrm, under the floor, hunting you by your footsteps (stand
//       stock still and it loses you, and comes up dazed), spraying glass,
//       shaking it down from the roof;
//     the Magma Tender, who lets the mountain in: lava welling out across
//       the floor from vents and spreading, gobbets of magma that pool,
//       worn, a tide of it rolled across the hall at you; her brood, and a
//       crust that turns your blows till it cracks;
//     the Bellows Golem, its heat climbing with everything it does (and
//       every blow you strike while it's hot) till it must vent: steam out
//       of its front, its back open to you;
//   a Glass Crypt:
//     the Obsidian Abbess, who raises walls of glass that her bolts glance
//       off at angles, seals you in a glass cell (find the gap), and at the
//       last brings every pane down in shards;
//     the Kiln-Priest, whose kiln-wave and pours of white-hot glaze coat
//       you (three coats and you're fired solid; a hard blow to him cracks
//       one off), and who rises up raining embers;
//     the Vitrified Horror, fused glass and bone that leaves shards where
//       it steps, sends glass spines up through the floor at you, shakes
//       glass down from the roof, burns a prism beam across its hall, and
//       shatters at each mark (break its pieces before they crawl back and
//       mend it);
//   an Ash-Raider Den:
//     Kharn the Ash-Reaver, oil thrown across the floor and then fire to
//       it, and his fury, up with every blow he lands, till he goes
//       berserk (parry him to cool it);
//     Pyrrha the Bombard-Queen, who lobs shells, lays powder lines, and
//       rolls lit kegs at you (strike one and it rolls back to her);
//     Scorch, the raiders' chained drake, that can't come further than
//       its chain (till it snaps), sweeps its fire across its hall, spits
//       gobs of it, sweeps its tail round, lashes its chain round, and
//       beats ash and embers down from the roof;
//   a Kiln-Deep (Kharos's own):
//     the Kiln-King, who pours molten metal down channels across his hall
//       (it sets into walls of black glass, and the hall's another shape),
//       strikes his anvil (the floor splits in a cross; sparks shower
//       down), hauls you in with his tongs, and quenches it all in steam;
//     the Slag Titan, whose heart's a lodestone: glowing blue, it tears
//       iron out of your hand (and drags you in by iron armour); thrown
//       slag, fissures of it racing out at you, its slam, and worn, iron
//       shot out all round and called back;
//     the Molten Heart, held in the air by four chains (break their
//       anchors, or your blows hardly touch it), the floor erupting under
//       you square by square, and at the last fire in from the walls.
import { BRAINS, addHazard, addZone, lob, lineTiles, areaTiles, summon, bossSlam, phaseSummons, groundFire, COLORS, BOSS_TITLES } from './monsters.js';
import { phaseOf, ready, used } from './tempo.js';
import { startLaser } from '../game/laser.js';
import { B } from '../world/blocks.js';
import { FY, dist, sees, dmgOf, work, hallTiles, hallOf, inHall, ringTiles, coneTiles, wallTiles, spotIn, blinkTo, backOff, cd, shout, proc, openFloor, drag } from './bosskit.js';
import { swallow, glaze, chipGlaze, lodestone } from '../game/afflict.js';

const FIRE = ['#ff8030', '#ffd060', '#ff4020'];
const ASHC = ['#8a8484', '#5a5454', '#a8a2a0'];
const GLASS = ['#1e1824', '#6a5a8a', '#c8b8f0'];
const mid = (tiles) => tiles[Math.floor(tiles.length / 2)] || tiles[0] || { x: 0, z: 0 };
const fire = (game, c, tiles, dur, dmg, o = {}) => tiles.length && addHazard(game, { by: c, tiles, y: c.y, dur, dmg: dmgOf(c, dmg), kind: 'fire', center: mid(tiles), color: COLORS.fire, burn: 2, ...o });
const shards = (game, c, tiles, dur, dmg, o = {}) => tiles.length && addHazard(game, { by: c, tiles, y: c.y, dur, dmg: dmgOf(c, dmg), kind: 'hex', center: mid(tiles), color: [200, 184, 240], quiet: tiles.length > 12, ...o });

// --------------------------------------------------------------- species
const boss = (o) => ({ mode: 'hostile', aggro: 16, under: true, boss: true, isle: 'kharos', ...o });
export const KHAROS_BOSSES = {
  cinder_king: boss({
    name: 'The Cinder King', hp: 120, dmg: 6, step: 0.42, humanoid: true, look: 'cinder_king', arms: 'greatsword', fireproof: true, light: 6, brain: 'cinderKing', tint: ['#ff7030', '#ffd080'],
    phaseLines: ['', '', 'Rise, my court! Burn for your king!', 'I AM THE PYRE!'], drops: [['old_coin', 6, 12, 1], ['ember_pod', 2, 4, 1], ['obsidian_blade', 1, 1, 0.5]],
  }),
  urn_mother: boss({
    name: 'The Urn-Mother', hp: 140, dmg: 5, step: 0.62, big: true, fireproof: true, brain: 'urnMother', range: 4, tint: ['#c8b8a0', '#ff8040'], style: 'bite',
    phaseLines: ['', '', 'Come... into the urn...', 'ALL TO ASH.'], drops: [['old_coin', 6, 12, 1], ['sulfur', 3, 6, 1], ['gem', 1, 1, 0.6]],
  }),
  smoke_herald: boss({
    name: 'The Smoke Herald', hp: 105, dmg: 5, step: 0.36, humanoid: true, look: 'smoke_herald', floats: true, fireproof: true, brain: 'smokeHerald', range: 5, tint: ['#a8a0a0', '#ff6030'],
    ward: (game, c, src, n) => {
      if (!c.inSmoke || Math.random() >= 0.5) return n;
      game.renderer.floatText(c.x, c.y + 2.4, c.z, 'lost in the smoke', '#c8c0c0');
      return 0;
    },
    phaseLines: ['', '', 'Hear the horn of the mountain!', 'The ground itself answers me!'], drops: [['old_coin', 6, 12, 1], ['sulfur', 2, 4, 1], ['potion_haste', 1, 1, 0.6]],
  }),
  glass_wyrm: boss({
    name: 'The Glass Wyrm', hp: 135, dmg: 6, step: 0.3, big: true, fireproof: true, brain: 'glassWyrm', tint: ['#b8a8f0', '#ff6040'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['obsidian_shard', 6, 12, 1], ['gem', 1, 2, 1], ['gold_ore', 2, 4, 1]],
  }),
  magma_tender: boss({
    name: 'The Magma Tender', hp: 150, dmg: 5, step: 0.7, big: true, fireproof: true, light: 8, brain: 'magmaTender', tint: ['#ff6020', '#ffd060'], style: 'bite',
    ward: (game, c, src, n) => {
      if (!(c.crustT > 0)) return n;
      game.renderer.floatText(c.x, c.y + 2.6, c.z, 'crusted', '#a8a0a0');
      return Math.max(1, Math.round(n * 0.2));
    },
    phaseLines: ['', '', '', ''], drops: [['sulfur', 4, 8, 1], ['obsidian_shard', 3, 6, 1], ['gold_ingot', 1, 2, 0.7]],
  }),
  bellows_golem: boss({
    name: 'The Bellows Golem', hp: 145, dmg: 6, step: 0.45, big: true, fireproof: true, light: 5, brain: 'bellowsGolem', tint: ['#ffa040', '#c8c0b8'], style: 'bite',
    // (Struck while it's hot, it only gets hotter.)
    ward: (game, c, src, n) => {
      if (c.heat >= 60 && !(c.ventT > 0) && src === game.player) c.heat = Math.min(100, c.heat + 5);
      return n;
    },
    tick: (c, dt) => heatTick(c, dt),
    phaseLines: ['', '', 'PRESSURE RISING.', 'VENT. VENT. VENT.'], drops: [['iron_ingot', 4, 8, 1], ['gold_ingot', 1, 2, 0.7], ['coal', 4, 8, 1]],
  }),
  obsidian_abbess: boss({
    name: 'The Obsidian Abbess', hp: 115, dmg: 5, step: 0.4, humanoid: true, look: 'obsidian_abbess', fireproof: true, light: 4, brain: 'obsidianAbbess', range: 5, tint: ['#c8b8f0', '#1e1824'],
    phaseLines: ['', '', 'Be still, and be kept.', 'Let every pane sing!'], drops: [['obsidian_shard', 4, 8, 1], ['glass', 4, 8, 1], ['obsidian_blade', 1, 1, 0.6]],
  }),
  kiln_priest: boss({
    name: 'The Kiln-Priest', hp: 110, dmg: 5, step: 0.38, humanoid: true, look: 'kiln_priest', fireproof: true, light: 6, brain: 'kilnPriest', range: 4, tint: ['#ffb040', '#ffffff'],
    // (A hard blow to him cracks a coat of glaze off you.)
    ward: (game, c, src, n) => {
      if (src === game.player && n >= 6) chipGlaze(game, src);
      return n;
    },
    phaseLines: ['', '', 'The kiln is hungry.', 'I rise in the fire!'], drops: [['old_coin', 6, 12, 1], ['fire_lily', 1, 3, 1], ['potion_vigor', 1, 2, 1]],
  }),
  vitrified_horror: boss({
    name: 'The Vitrified Horror', hp: 140, dmg: 6, step: 0.4, big: true, fireproof: true, brain: 'vitrifiedHorror', tint: ['#a0c8ff', '#e8e0c8'], style: 'bite', glancing: true,
    phaseLines: ['', '', '', ''], drops: [['glass', 6, 10, 1], ['bone', 4, 8, 1], ['gem', 1, 2, 0.8]],
  }),
  ash_reaver: boss({
    name: 'Kharn the Ash-Reaver', hp: 125, dmg: 6, step: 0.4, humanoid: true, look: 'ash_reaver', arms: 'flail', fireproof: true, brain: 'ashReaver', tint: ['#ff6030', '#c8c0b8'],
    // (His fury: up with every blow he lands, down when he's parried.)
    onStrike: (game, c) => {
      if (!(c.berserkT > 0)) c.fury = Math.min(100, (c.fury || 0) + 15);
    },
    onParried: (game, c) => {
      if (c.berserkT > 0) c.berserkT = Math.max(0.01, c.berserkT - 2);
      else c.fury = Math.max(0, (c.fury || 0) - 35);
      game.renderer.floatText(c.x, c.y + 3.2, c.z, 'his fury cools', '#a0d8ff');
    },
    tick: (c, dt) => furyTick(c, dt),
    phaseLines: ['', '', 'Barricades! Pen it in!', 'Everything burns!'], drops: [['coin', 12, 24, 1], ['sulfur', 2, 4, 1], ['flail', 1, 1, 0.5]],
  }),
  bombard_queen: boss({
    name: 'Pyrrha the Bombard-Queen', hp: 115, dmg: 5, step: 0.36, humanoid: true, look: 'bombard_queen', arms: 'crossbow', ranged: true, brain: 'bombardQueen', range: 6, tint: ['#ffb040', '#ff5030'],
    phaseLines: ['', '', 'Roll out the kegs!', 'Light every fuse you\'ve got!'], drops: [['coin', 12, 24, 1], ['dynamite', 3, 6, 1], ['crossbow', 1, 1, 0.5]],
  }),
  chained_drake: boss({
    name: 'Scorch, the Chained Drake', hp: 150, dmg: 7, step: 0.3, big: true, fireproof: true, light: 6, brain: 'chainedDrake', tint: ['#ff5020', '#ffd060'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['leather', 4, 8, 1], ['ember_pod', 2, 5, 1], ['gem', 1, 2, 0.8]],
  }),
  kiln_king: boss({
    name: 'The Kiln-King', hp: 150, dmg: 7, step: 0.45, humanoid: true, look: 'kiln_king', arms: 'warhammer', fireproof: true, light: 6, brain: 'kilnKing', tint: ['#ff8030', '#ffe0a0'],
    phaseLines: ['', '', 'The metal is ready. So are you.', 'Quench it! QUENCH IT ALL!'], drops: [['gold_ingot', 2, 4, 1], ['iron_ingot', 4, 8, 1], ['warhammer', 1, 1, 0.5]],
  }),
  slag_titan: boss({
    name: 'The Slag Titan', hp: 170, dmg: 8, step: 0.5, big: true, fireproof: true, light: 5, brain: 'slagTitan', tint: ['#ff7030', '#8a7a70'], style: 'bite',
    phaseLines: ['', '', '', ''], drops: [['iron_ingot', 4, 8, 1], ['obsidian_shard', 4, 8, 1], ['gold_ingot', 1, 2, 0.7]],
  }),
  molten_heart: boss({
    name: 'The Molten Heart', hp: 160, dmg: 6, step: 9, big: true, floats: true, anchored: true, fireproof: true, light: 10, brain: 'moltenHeart', tint: ['#ff4010', '#ffe070'],
    ward: (game, c, src, n) => {
      const held = game.creatures.some((o) => !o.dead && o.species === 'heart_anchor');
      if (!held) return n;
      if (!(c.wardNote > 0)) {
        c.wardNote = 0.8;
        game.renderer.floatText(c.x, c.y + 3, c.z, 'held by its chains', '#ffb070');
      }
      return Math.max(1, Math.round(n * 0.2));
    },
    phaseLines: ['', '', '', ''], drops: [['gold_ingot', 2, 4, 1], ['gem', 1, 3, 1], ['obsidian_shard', 4, 8, 1]],
  }),
  // (What they bring with them.)
  glass_shard: { name: 'Glass Shard', hp: 8, dmg: 3, step: 0.22, mode: 'hostile', aggro: 16, under: true, fireproof: true, style: 'snap', glancing: true, isle: 'kharos', drops: [['glass', 1, 1, 0.5]] },
  // A keg of Pyrrha's, its fuse lit, rolling (see rollKeg).
  rolling_keg: {
    name: 'Lit Keg', hp: 99, dmg: 0, step: 0.32, mode: 'hostile', aggro: 0, under: true, construct: true, fireproof: true, isle: 'kharos', brain: 'rollingKeg', drops: [],
    // (Struck: it rolls back the way it came, to her.)
    ward: (game, c, src) => {
      if (src && src.kind === 'player' && !c.back) {
        c.back = true;
        c.stopped = false;
        c.fuseT = Math.max(c.fuseT, 2.5);
        game.renderer.floatText(c.x, c.y + 1.8, c.z, 'sent back!', '#ffe070');
        game.audio?.play('thud', c);
      }
      return 0;
    },
  },
  heart_anchor: { name: 'Chain Anchor', hp: 30, dmg: 0, step: 9, mode: 'hostile', aggro: 0, under: true, anchored: true, construct: true, fireproof: true, isle: 'kharos', brain: 'heartAnchor', drops: [['iron_ingot', 1, 1, 0.5]] },
};

export const KHAROS_TITLES = {
  cinder_king: { name: 'The Cinder King', title: 'Lord of the Ash Barrows', taunt: 'Kneel in the ashes of my court.' },
  urn_mother: { name: 'The Urn-Mother', title: 'Who Holds the Ashes of Kings' },
  smoke_herald: { name: 'The Smoke Herald', title: 'Voice of the Burning Mountain', taunt: 'The mountain sends its regards.' },
  glass_wyrm: { name: 'The Glass Wyrm', title: 'That Which Bores Through Black Glass' },
  magma_tender: { name: 'The Magma Tender', title: 'Mother of the Slugs, Keeper of the Vents' },
  bellows_golem: { name: 'The Bellows Golem', title: 'Last Engine of the Old Mines' },
  obsidian_abbess: { name: 'The Obsidian Abbess', title: 'Keeper of the Glass Crypt', taunt: 'Every soul here is kept behind glass.' },
  kiln_priest: { name: 'The Kiln-Priest', title: 'Who Fires the Dead', taunt: 'The kiln takes all, in the end.' },
  vitrified_horror: { name: 'The Vitrified Horror', title: 'The Dead the Mountain Melted Together' },
  ash_reaver: { name: 'Kharn the Ash-Reaver', title: 'Chief of the Ash-Raiders', taunt: 'Fresh oil for the fires!' },
  bombard_queen: { name: 'Pyrrha the Bombard-Queen', title: 'Mistress of Powder and Flame', taunt: 'Stand still, would you? Hard to aim.' },
  chained_drake: { name: 'Scorch', title: 'The Raiders\' Chained Drake' },
  kiln_king: { name: 'The Kiln-King', title: 'Master of the Deep Forge', taunt: 'Another ingot for the mould.' },
  slag_titan: { name: 'The Slag Titan', title: 'Poured from the Last Great Melt' },
  molten_heart: { name: 'The Molten Heart', title: 'Chained Fire of the Mountain' },
};

// --------------------------------------------------------------- brains
export const KHAROS_BRAINS = {
  // ------------------------------------------------ the Ash Barrow
  cinderKing(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'ash_wraith', c, 3, { color: ASHC });
      shout(c, 'Rise, my court!', '#ffb060');
    });
    // (At the last he burns as he walks.)
    if (ph >= 3) {
      const k = `${c.x},${c.z}`;
      if (c.trail && c.trail.k !== k) groundFire(game, c.trail.x, c.trail.z, c.y, c, false, 0);
      c.trail = { k, x: c.x, z: c.z };
    }
    // A decree he's laid on you, waiting to be judged.
    if (c.decree) return judgeDecree(c, dt);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // His decree: KNEEL (not a step, not a blow, till he's done) or BEGONE
    // (keep moving, the whole while). Obey, and he's satisfied, and off his
    // guard a moment; defy him, and the fire falls on you. (He doesn't bid
    // you kneel while his court's about you.)
    if (cd(c, 'decreeCd', dt, 4) && ready(c) && !c.windup && !t.swallowed) {
      c.decreeCd = ph >= 3 ? 8 : 10;
      used(c, 3);
      const court = game.creatures.some((o) => !o.dead && o.species === 'ash_wraith' && dist(o, t) <= 4);
      const kneel = !court && (c.lastDecree === 'kneel' ? Math.random() < 0.3 : Math.random() < 0.65);
      c.lastDecree = kneel ? 'kneel' : 'begone';
      c.decree = { kneel, t: 0, grace: 1, judge: 3, broke: false, still: 0 };
      c.face(t.x, t.z);
      game.renderer.floatText(t.x, t.y + 3.2, t.z, kneel ? 'KNEEL!' : 'BEGONE!', '#ffd060');
      shout(c, kneel ? 'KNEEL before your king!' : 'BEGONE from my sight!', '#ffb060', 3);
      if (!game.toldDecree) game.ui.msg('The Cinder King lays a decree on you. KNEEL: not a step, not a blow, till it\'s done. BEGONE: keep moving. Obey and he lowers his guard; defy him and burn.', '#ffd060', true);
      game.toldDecree = true;
      game.audio?.play('horn', c);
      return true;
    }
    // His crown flares: rings of fire going out from him.
    if (cd(c, 'crownCd', dt, 4) && ready(c) && d <= 4 && !c.windup) {
      c.crownCd = ph >= 3 ? 6 : 8;
      used(c, 0.3);
      for (let r = 1; r <= 4; r++) fire(game, c, ringTiles(c.x, c.z, r), 0.8 + r * 0.35, 5, { quiet: r > 1 });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'the crown flares!', '#ffb060');
      c.stunT = 0.8;
      return true;
    }
    // (Worn) A crown of fire set round you, closing in ring by ring: step
    // out through each as it burns down.
    if (ph >= 2 && cd(c, 'circletCd', dt, 3) && ready(c) && d <= 10 && !c.windup) {
      c.circletCd = 11;
      used(c, 0.6);
      const at = { x: t.x, z: t.z };
      for (let r = 3; r >= 0; r--) fire(game, c, ringTiles(at.x, at.z, r).filter((q) => inHall(c, q)), 0.9 + (3 - r) * 0.5, 5, { quiet: r < 3 });
      game.renderer.floatText(t.x, t.y + 3, t.z, 'a crown of fire for you!', '#ffd060');
      shout(c, 'Wear it well!', '#ffb060');
      return true;
    }
    // His sceptre brought down beside you: fire runs out from where it
    // strikes, in a cross.
    if (d <= 3 && cd(c, 'brandCd', dt, 3) && ready(c) && !c.windup) {
      c.brandCd = 6;
      used(c, 0.3);
      c.face(t.x, t.z);
      const at = { x: t.x, z: t.z };
      fire(game, c, [at], 0.8, 6, { burn: 3 });
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const arm = [];
        for (let k = 1; k <= 3; k++) {
          const q = { x: at.x + dx * k, z: at.z + dz * k };
          if (inHall(c, q) && openFloor(game, q.x, q.z)) arm.push(q);
        }
        fire(game, c, arm, 1.0, 5, { quiet: true });
      }
      game.renderer.floatText(t.x, t.y + 2.8, t.z, 'branded!', '#ffb060');
      game.audio?.play('clang', c);
      return true;
    }
    // His sceptre: a line of fire along the floor at you.
    if (cd(c, 'sceptreCd', dt, 2) && ready(c) && d >= 2 && d <= 9 && sees(game, c, t) && !c.windup) {
      c.sceptreCd = ph >= 2 ? 4 : 5;
      used(c);
      c.face(t.x, t.z);
      fire(game, c, lineTiles(game, c, t, d + 2), 0.8, 5, { burn: 2 });
      game.audio?.play('fire', c);
      return true;
    }
    return false;
  },

  urnMother(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      // (She cracks, and what she held gets out.)
      for (let i = 0; i < 2; i++) summon(game, 'ash_wraith', c, 3, { color: ASHC });
      shards(game, c, ringTiles(c.x, c.z, 2), 0.9, 4);
      game.renderer.floatText(c.x, c.y + 3, c.z, 'CRACK', '#e8dcc8');
      game.audio?.play('glass', c);
    });
    // You, inside her: she sits, glowing, ash smoking from her mouth.
    const p = game.everyone().find((q) => q.swallowed && q.swallowed.by === c) || null;
    if (p && p.swallowed && p.swallowed.by === c) {
      if (Math.random() < dt * 10) game.renderer.emit(c.x, c.y + 2.6, c.z, { n: 1, color: ['#ff9040', '#ffd060', '#8a8484'], up: 30, speed: 10, life: 0.8, glow: true });
      return true;
    }
    // Breathing in: whoever's at her mouth when she's done goes in.
    if (c.inhale) {
      c.inhale.t -= dt;
      if (c.inhale.t > 0) return true;
      c.inhale = null;
      if (t && !t.dead && dist(c, t) <= 1 && !(t.rollT > 0) && t.kind === 'player') {
        swallow(game, t, c, { need: ph >= 3 ? 9 : 7, max: 6, dmg: 1, spit: dmgOf(c, 6) });
        return true;
      }
      // Missed you: out it comes again, as fire.
      if (t && !t.dead) {
        c.face(t.x, t.z);
        fire(game, c, coneTiles(c, t, 5, 0.55), 0.6, 7, { burn: 3, knock: 1, from: { x: c.x, z: c.z } });
      }
      game.renderer.floatText(c.x, c.y + 3, c.z, '...and OUT', '#ff9040');
      c.stunT = 0.8;
      return true;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Ash poured out across the floor in a fan: it lies there a long
    // while; in it you're slowed, and your flame gutters.
    if (cd(c, 'ashCd', dt, 2.5) && ready(c) && d <= 8 && !c.windup) {
      c.ashCd = 7;
      used(c);
      c.face(t.x, t.z);
      const tiles = coneTiles(c, t, 6, 0.5).filter((q) => inHall(c, q));
      addHazard(game, { by: c, tiles, y: c.y, dur: 1, dmg: dmgOf(c, 3), kind: 'acid', color: [160, 150, 150], onFire: (g) => ashPatch(g, c, tiles, 10) });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'she tips...', '#c8c0b8');
      game.audio?.play('pour', c);
      return true;
    }
    // A breath in: the whole hall's air drawn to her mouth (and you with
    // it): be at her lip when it's done and she has you.
    if (cd(c, 'breathCd', dt, 4) && ready(c) && d <= 9 && !c.windup) {
      c.breathCd = ph >= 2 ? 9 : 11;
      used(c, 2.2);
      addZone(game, { by: c, kind: 'wind', tiles: hallTiles(c), y: c.y, life: 2, tick: 0.3, pull: { x: c.x, z: c.z }, puff: ['#c8c0b8', '#e8e4dc'] });
      c.inhale = { t: 2 };
      game.renderer.floatText(c.x, c.y + 3, c.z, 'she breathes IN... (keep off her lip!)', '#ffb070');
      if (!game.toldUrn) game.ui.msg('The Urn-Mother draws the air of the hall in: be right by her when she\'s done and she swallows you whole.', '#ffb070', true);
      game.toldUrn = true;
      game.audio?.play('wind', c);
      return true;
    }
    // Hot from the kiln: up close she glows, and the heat comes off her in
    // rings.
    if (d <= 2 && cd(c, 'glowCd', dt, 2) && ready(c) && !c.windup) {
      c.glowCd = 6;
      used(c, 0.3);
      for (let r = 1; r <= 2; r++) fire(game, c, ringTiles(c.x, c.z, r + (c.foot || 0)), 0.9 + r * 0.15, 5, { knock: 1, from: { x: c.x, z: c.z }, quiet: r > 1 });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'she glows white-hot', '#ffd060');
      c.stunT = 0.9;
      return true;
    }
    // Shards of herself spat at you, three at a time (five, desperate).
    if (d >= 2 && d <= 9 && cd(c, 'spitCd', dt, 3) && ready(c) && sees(game, c, t) && !c.windup) {
      c.spitCd = ph >= 2 ? 4.5 : 6;
      used(c);
      c.face(t.x, t.z);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of ph >= 3 ? [-0.5, -0.25, 0, 0.25, 0.5] : [-0.3, 0, 0.3]) {
        const to = { x: c.x + Math.cos(base + s) * 9, z: c.z + Math.sin(base + s) * 9 };
        shards(game, c, lineTiles(game, c, to, 9), 0.75, 4, { quiet: s !== 0 });
      }
      game.audio?.play('glass', c);
      return true;
    }
    // (Worn) Ash falling from the roof in patches.
    if (ph >= 2 && cd(c, 'fallCd', dt, 4) && ready(c)) {
      c.fallCd = 10;
      used(c, 0.2);
      for (let i = 0; i < 3; i++) {
        const at = spotIn(c, t, 0, 4);
        if (at) ashPatch(game, c, areaTiles(at.x, at.z, 1), 8);
      }
    }
    if (d <= 2 && !c.inhale && backOff(c, t)) return true;
    return d > 1;
  },

  smokeHerald(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // In its smoke it's all but gone.
    c.inSmoke = (game.zones || []).some((z) => z.by === c && z.kind === 'smoke' && z.tiles.some((q) => q.x === c.x && q.z === c.z));
    c.fade = c.inSmoke && !c.windup ? 0.25 : 1;
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Smoke: half the hall filled with it.
    if (cd(c, 'smokeCd', dt, 1.5) && ready(c) && !c.windup) {
      c.smokeCd = 10;
      used(c, 0.3);
      const L = hallOf(c);
      const across = Math.random() < 0.5;
      const half = hallTiles(c).filter((q) => (across ? q.x <= (L.x0 + L.x1) / 2 : q.z <= (L.z0 + L.z1) / 2) === (across ? c.x <= (L.x0 + L.x1) / 2 : c.z <= (L.z0 + L.z1) / 2));
      addZone(game, { by: c, kind: 'smoke', tiles: half, y: c.y, life: 8, tick: 1, slow: false, color: [90, 86, 86], puff: ['#5a5454', '#8a8484', '#3a3636'] });
      shout(c, 'Lose yourself in the smoke!', '#c8c0c0');
      game.audio?.play('wind', c);
      return true;
    }
    // The horn, blast on blast: each a ring of force going out across the
    // hall a pace at a time. There's no outrunning it; roll through it as
    // it reaches you.
    if (cd(c, 'hornCd', dt, 2.5) && ready(c) && d <= 9 && !c.windup) {
      c.hornCd = ph >= 3 ? 7 : 8.5;
      const blasts = ph + 1;
      used(c, blasts * 0.9 + 0.6);
      c.stunT = blasts * 0.9 + 0.3;
      const at = { x: c.x, z: c.z };
      proc(game, c, 0.9, blasts, () => {
        game.audio?.play('horn', c);
        game.renderer.floatText(c.x, c.y + 3, c.z, 'BWAAARRR', '#ffd0a0');
        game.renderer.effect?.({ type: 'ring', wx: at.x, wy: c.y, wz: at.z, r0: 6, r1: 10 * 16, color: ['#ffd0a0', '#ffffff'], life: 1.35, oy: 4, flat: 0.5, thick: 3 });
        proc(game, c, 0.13, 10, (r) => {
          const ring = ringTiles(at.x, at.z, r + 1).filter((q) => inHall(c, q) && openFloor(game, q.x, q.z));
          if (ring.length) addHazard(game, { by: c, tiles: ring, y: c.y, dur: 0.12, dmg: dmgOf(c, 4), knock: 1, from: at, kind: 'wave', quiet: true, color: [255, 210, 170] });
        });
      }, 0.4);
      shout(c, 'Hear the horn of the mountain!', '#ffd0a0');
      if (!game.toldHorn) game.ui.msg('Each blast of the Herald\'s horn sends a ring of force across the hall. You can\'t outrun it: roll through it as it reaches you.', '#ffd0a0', true);
      game.toldHorn = true;
      return true;
    }
    // (Worn) Its smoke catches: wherever it lies about you, it bursts into
    // flame (out of the smoke!).
    if (ph >= 2 && cd(c, 'flareCd', dt, 3) && ready(c) && !c.windup) {
      const smoke = (game.zones || []).filter((z) => z.by === c && z.kind === 'smoke').flatMap((z) => z.tiles).filter((q) => Math.max(Math.abs(q.x - t.x), Math.abs(q.z - t.z)) <= 3);
      if (smoke.length >= 4) {
        c.flareCd = 9;
        used(c, 0.4);
        fire(game, c, smoke, 1.3, 5, { burn: 2, quiet: true });
        game.renderer.floatText(t.x, t.y + 3, t.z, 'the smoke catches!', '#ffb060');
        game.audio?.play('crackle', c);
        return true;
      }
      c.flareCd = 1.5;
    }
    // Out of its smoke at your back: a blow, and gone again.
    if (c.inSmoke && cd(c, 'ambushCd', dt, 4) && ready(c) && d >= 3 && !c.windup) {
      const to = spotIn(c, { x: t.x + Math.sign(t.x - c.x), z: t.z + Math.sign(t.z - c.z) }, 0, 1.5);
      if (to) {
        c.ambushCd = ph >= 2 ? 6 : 8;
        used(c, 0.4);
        blinkTo(c, to, ASHC);
        c.face(t.x, t.z);
        addHazard(game, { by: c, tiles: coneTiles(c, t, 2, 0.9), y: c.y, dur: 0.6, dmg: dmgOf(c, 6), knock: 1, stun: 0.3, from: { x: c.x, z: c.z }, kind: 'slam', center: { x: t.x, z: t.z }, radius: 1, color: COLORS.blow });
        game.renderer.floatText(c.x, c.y + 3, c.z, 'out of the smoke!', '#c8c0c0');
        game.audio?.play('whoosh', c);
        c.stunT = 0.7;
        return true;
      }
      c.ambushCd = 1;
    }
    // Cinders lobbed out of the smoke.
    if (cd(c, 'cinderCd', dt, 3) && ready(c) && d <= 10 && !c.windup) {
      c.cinderCd = ph >= 2 ? 4 : 5.5;
      used(c);
      for (let k = 0; k < (ph >= 2 ? 3 : 2); k++) {
        const at = k ? spotIn(c, t, 1, 3) || t : t;
        lob(game, c, at.x, at.z, { tint: [255, 140, 60], onLand: (g, x, z) => fire(g, c, areaTiles(x, z, 1), 0.05, 4, { burn: 2 }) });
      }
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  // ------------------------------------------------ the Glass Mine
  glassWyrm(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // Under the floor, listening for you.
    if (c.hunt) return huntTremor(c, dt);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Down through the floor: it hunts you by your footsteps from there.
    if (cd(c, 'digCd', dt, 3) && ready(c) && !c.windup) {
      c.digCd = ph >= 3 ? 7 : 10;
      used(c, 2);
      game.renderer.emit(c.x, c.y + 0.3, c.z, { n: 20, color: GLASS, up: 30, speed: 40, gravity: 120, life: 0.6 });
      c.burrowed = true;
      c.solid = false;
      game.removeOcc(c);
      c.hunt = { t: 0, at: { x: c.x, z: c.z }, heard: { x: t.x, z: t.z }, quiet: 0, step: 0, rumble: 0, max: ph >= 2 ? 6 : 5, rise: 0 };
      game.audio?.play('rumble', c);
      if (!game.toldTremor) game.ui.msg('The Glass Wyrm is under the floor, hunting you by your footsteps. Stand stock still and it loses you!', '#c8b8f0', true);
      game.toldTremor = true;
      return true;
    }
    // A spray of glass, fanned out.
    if (cd(c, 'sprayCd', dt, 2) && ready(c) && d >= 2 && d <= 9 && sees(game, c, t) && !c.windup) {
      c.sprayCd = 5;
      used(c);
      c.face(t.x, t.z);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of [-0.5, -0.25, 0, 0.25, 0.5]) {
        const to = { x: c.x + Math.cos(base + s) * 9, z: c.z + Math.sin(base + s) * 9 };
        shards(game, c, lineTiles(game, c, to, 9), 0.9, 4, { quiet: s !== 0 });
      }
      c.stunT = 0.9;
      game.audio?.play('glass', c);
      return true;
    }
    // (Worn) Glass rain: shards shaken down from the roof round you.
    if (ph >= 2 && cd(c, 'rainCd', dt, 3) && ready(c) && d <= 10 && !c.windup) {
      c.rainCd = 9;
      used(c, 0.4);
      for (let i = 0; i < 7; i++) {
        const at = i ? spotIn(c, t, 0, 3) : { x: t.x, z: t.z };
        if (at) shards(game, c, [at], 0.9 + i * 0.14, 5, { quiet: i > 0 });
      }
      game.renderer.floatText(t.x, t.y + 2.6, t.z, 'glass falls!', '#c8b8f0');
      return true;
    }
    if (bossSlam(c, dt, 1, 0.9, 6, 4.5)) return true;
    return false;
  },

  magmaTender(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (c.crustT > 0) {
      c.crustT -= dt;
      if (Math.random() < dt * 6) game.renderer.emit(c.x, c.y + 1, c.z, { n: 1, color: ['#6a6060', '#8a8080'], up: 10, speed: 20, life: 0.6 });
      if (c.crustT <= 0) {
        game.renderer.floatText(c.x, c.y + 3, c.z, 'the crust cracks!', '#ffb070');
        game.renderer.emit(c.x, c.y + 1, c.z, { n: 20, color: FIRE, up: 30, speed: 50, life: 0.6, glow: true });
      }
    }
    phaseSummons(c, [0.75, 0.5, 0.25], () => {
      for (let i = 0; i < 2; i++) summon(game, 'magma_slug', c, 3, { color: FIRE });
    });
    if (!t || t.dead) return false;
    // The vents opened: lava welling out across the floor, spreading.
    if (cd(c, 'ventCd', dt, 3) && ready(c) && dist(c, t) <= 14 && !c.windup) {
      c.ventCd = ph >= 3 ? 11 : 14;
      used(c, 0.6);
      const vents = [spotIn(c, t, 3, 7), spotIn(c, c, 2, 6)].filter(Boolean);
      for (const v of vents) {
        fire(game, c, [v], 1.2, 4, { burn: 0 });
        game.renderer.floatText(v.x, FY + 2, v.z, 'a vent glows...', '#ff9050');
        proc(game, c, 0.7, 4, (k) => {
          for (const q of areaTiles(v.x, v.z, k, true)) if (inHall(c, q) && openFloor(game, q.x, q.z)) work(game, q.x, FY, q.z, B.lava, 12 - k, c);
          game.renderer.emit(v.x, FY + 0.4, v.z, { n: 8, color: FIRE, up: 30, speed: 30, life: 0.6, glow: true });
        }, 1.2);
      }
      shout(c, 'Gllurrrb...', '#ff9050');
      game.audio?.play('eruption', c);
      return true;
    }
    // (Worn) A tide of magma rolled out across the hall at you, a wall of
    // it, a pace at a time: get round its end, or roll through it.
    if (ph >= 2 && cd(c, 'tideCd', dt, 3) && ready(c) && !c.windup) {
      c.tideCd = 12;
      used(c, 0.8);
      const [fx, fz] = Math.abs(t.x - c.x) >= Math.abs(t.z - c.z) ? [Math.sign(t.x - c.x) || 1, 0] : [0, Math.sign(t.z - c.z) || 1];
      const at = { x: c.x, z: c.z };
      const r0 = 1 + (c.foot || 0);
      proc(game, c, 0.22, 12, (k) => {
        const row = [];
        for (let w = -3; w <= 3; w++) {
          const q = { x: at.x + fx * (k + r0) + fz * w, z: at.z + fz * (k + r0) + fx * w };
          if (inHall(c, q) && openFloor(game, q.x, q.z, true)) row.push(q);
        }
        if (row.length) fire(game, c, row, 0.25, 5, { burn: 2, knock: 1, from: { x: at.x + fx * (k + r0 - 1), z: at.z + fz * (k + r0 - 1) }, quiet: k % 3 !== 0 });
      }, 0.7);
      game.renderer.floatText(c.x, c.y + 3, c.z, 'a tide of magma!', '#ff9050');
      game.audio?.play('eruption', c);
      return true;
    }
    // Gobbets of magma flung at you: they splash, and pool a while.
    if (cd(c, 'globCd', dt, 2.5) && ready(c) && dist(c, t) >= 2 && dist(c, t) <= 10 && !c.windup) {
      c.globCd = ph >= 2 ? 5 : 6.5;
      used(c);
      for (let k = 0; k < (ph >= 3 ? 4 : 3); k++) {
        const at = k ? spotIn(c, t, 1, 3) || t : t;
        lob(game, c, at.x, at.z, { tint: [255, 110, 40], onLand: (g, x, z) => {
          fire(g, c, areaTiles(x, z, 1), 0.05, 4, { burn: 2, quiet: k > 0 });
          if (inHall(c, { x, z }) && openFloor(g, x, z) && !g.everyone().some((p) => p.x === x && p.z === z)) work(g, x, FY, z, B.lava, 6, c);
        } });
      }
      shout(c, 'Hhhuk!', '#ff9050');
      return true;
    }
    // A crust: your blows hardly touch her till it cracks.
    if (cd(c, 'crustCd', dt, 6) && ready(c) && !(c.crustT > 0)) {
      c.crustT = 5;
      c.crustCd = 13;
      used(c, 0.2);
      game.renderer.floatText(c.x, c.y + 3, c.z, 'her skin crusts over', '#a8a0a0');
      if (!game.toldCrust) game.ui.msg('The Magma Tender crusts over: your blows hardly touch her. Wait for it to crack!', '#ffb070', true);
      game.toldCrust = true;
      return true;
    }
    if (bossSlam(c, dt, 1, 0.9, 6, 5)) return true;
    return false;
  },

  bellowsGolem(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // Venting (see heatTick): stood where it is, doing nothing else.
    if (c.ventT > 0) return true;
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // The gale: you're thrown back (your own flame blown out).
    if (cd(c, 'galeCd', dt, 2.5) && ready(c) && d <= 7 && !c.windup) {
      c.galeCd = 8;
      used(c, 0.4);
      c.heat += 12;
      c.face(t.x, t.z);
      const cone = coneTiles(c, t, 7, 0.45);
      addHazard(game, { by: c, tiles: cone, y: c.y, dur: 1, dmg: dmgOf(c, 3), knock: 4, from: { x: c.x, z: c.z }, kind: 'burst', center: { x: t.x, z: t.z }, onFire: (g, h, hit) => {
        for (const e of hit) if (e === g.player) e.snuff?.(3);
        for (const z of g.zones || []) if (z.kind === 'fire' && z.tiles.some((p) => cone.some((q) => q.x === p.x && q.z === p.z))) z.done = true;
      } });
      for (const q of cone) if (Math.random() < 0.3) game.renderer.emit(q.x, c.y + 0.8, q.z, { n: 1, color: ['#e8e4dc', '#c8c0b8'], up: 2, speed: 30, life: 0.6, shape: 'puff' });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'WHOOOSH', '#e8e4dc');
      game.audio?.play('wind', c);
      return true;
    }
    // It stokes: every fire in the hall spreads, and a line of it runs out
    // at you.
    if (cd(c, 'stokeCd', dt, 4) && ready(c) && !c.windup) {
      c.stokeCd = 10;
      used(c, 0.3);
      c.heat += 15;
      for (const z of [...(game.zones || [])]) if (z.kind === 'fire' && !z.done) for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) groundFire(game, z.tiles[0].x + dx, z.tiles[0].z + dz, z.y, c, false, 0);
      const line = lineTiles(game, c, t, d + 2);
      fire(game, c, line, 1.1, 4, { onFire: (g, h) => h.tiles.forEach((q) => groundFire(g, q.x, q.z, c.y, c, false, 0)) });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'STOKING', '#ffb040');
      game.audio?.play('fire', c);
      return true;
    }
    // (Worn) Heat thrown off it in rings.
    if (ph >= 2 && cd(c, 'heatCd', dt, 4) && ready(c) && !c.windup) {
      c.heatCd = 11;
      used(c, 0.8);
      c.heat += 18;
      for (let r = 1; r <= 5; r++) fire(game, c, ringTiles(c.x, c.z, r).filter((q) => inHall(c, q)), 0.7 + r * 0.3, 5, { quiet: r > 1 });
      return true;
    }
    if (bossSlam(c, dt, 1, 1, 6, 5)) {
      c.heat += 8;
      return true;
    }
    return false;
  },

  // ------------------------------------------------ the Glass Crypt
  obsidianAbbess(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Walls of glass raised across her hall.
    if (cd(c, 'mirrorCd', dt, 1.5) && ready(c) && !c.windup) {
      c.mirrorCd = 11;
      used(c, 0.3);
      for (let k = 0; k < 2; k++) {
        const at = spotIn(c, c, 3, 7);
        if (!at) continue;
        for (const q of wallTiles(at, Math.random() < 0.5, 5)) if (inHall(c, q) && openFloor(game, q.x, q.z)) {
          work(game, q.x, FY, q.z, B.glass, 14, c);
          work(game, q.x, FY + 1, q.z, B.glass, 14, c);
        }
      }
      shout(c, 'Be kept.', '#c8b8f0');
      game.audio?.play('glass', c);
      return true;
    }
    // A bolt that glances off the glass, and comes at you from the side.
    if (cd(c, 'boltCd', dt, 2.5) && ready(c) && d >= 2 && !c.windup) {
      c.boltCd = ph >= 2 ? 3.5 : 4.5;
      used(c);
      c.face(t.x, t.z);
      const segs = bounceBolt(game, c, t, 16, 2);
      segs.forEach((s, i) => addHazard(game, { by: c, tiles: s.tiles, y: c.y, dur: 0.85 + i * 0.12, dmg: dmgOf(c, 5), kind: 'beam', from: s.from, to: s.to, beamColor: '#f0e8ff', halo: '#8a6ad8', width: 2 }));
      game.audio?.play('reflect', c);
      return true;
    }
    // A fan of glass shards flung at you: three lines, spreading. (Round
    // 50: a third thing from the first.)
    if (cd(c, 'fanCd', dt, 4) && ready(c) && d >= 2 && d <= 8 && !c.windup) {
      c.fanCd = ph >= 2 ? 6 : 7.5;
      used(c, 0.4);
      c.face(t.x, t.z);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      for (const off of [-0.42, 0, 0.42]) {
        const end = { x: Math.round(c.x + Math.cos(base + off) * 7), z: Math.round(c.z + Math.sin(base + off) * 7) };
        const line = lineTiles(game, c, end, 7);
        if (line.length) addHazard(game, { by: c, tiles: line, y: c.y, dur: 0.7, dmg: dmgOf(c, 4), kind: 'beam', from: { x: c.x, z: c.z }, to: line[line.length - 1], beamColor: '#e8e0ff', halo: '#8a6ad8', width: 1, quiet: off !== 0 });
      }
      shout(c, 'Shatter.', '#c8b8f0');
      game.audio?.play('glass', c);
      return true;
    }
    // (Worn) A cell of glass round you, with one pane missing: out through
    // it before it's filled with her light.
    if (ph >= 2 && cd(c, 'tombCd', dt, 3) && ready(c) && d <= 9 && !c.windup) {
      c.tombCd = 13;
      used(c, 0.8);
      const ring = ringTiles(t.x, t.z, 1);
      const gap = ring.reduce((b, q) => (Math.hypot(q.x - c.x, q.z - c.z) > Math.hypot(b.x - c.x, b.z - c.z) && (q.x === t.x || q.z === t.z) ? q : b), ring[1]);
      for (const q of ring) if (q !== gap) for (const y of [FY, FY + 1]) work(game, q.x, y, q.z, B.glass, 3, c);
      addHazard(game, { by: c, tiles: [{ x: t.x, z: t.z }], y: t.y, dur: 2, dmg: dmgOf(c, 9), kind: 'hex', center: { x: t.x, z: t.z }, color: [200, 184, 240] });
      game.renderer.floatText(t.x, t.y + 2.6, t.z, 'ENTOMBED: find the gap!', '#c8b8f0');
      game.audio?.play('glass', c);
      return true;
    }
    // (Desperate) Every pane brought down at once, in shards.
    if (ph >= 3 && cd(c, 'reqCd', dt, 2) && ready(c) && !c.windup) {
      c.reqCd = 12;
      used(c, 0.6);
      const panes = (game.works || []).filter((q) => q.by === c && q.y === FY && q.id === B.glass);
      for (const q of panes) {
        q.life = 0.7;
        q.t = 0;
      }
      shards(game, c, panes.flatMap((q) => areaTiles(q.x, q.z, 1)), 0.75, 5);
      shout(c, 'Sing, every pane!', '#c8b8f0');
      game.audio?.play('glass', c);
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  kilnPriest(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    const glazed = (g, h, hit) => hit.forEach((e) => e === g.player && glaze(g, e, c, h.coats || 1));
    // Risen, raining embers down.
    if (c.riseT > 0) {
      c.riseT -= dt;
      c.rise = -10 - Math.round(Math.sin(c.riseT * 4) * 2);
      c.emberAcc = (c.emberAcc || 0) + dt;
      if (c.emberAcc >= 0.35 && t && !t.dead) {
        c.emberAcc = 0;
        const at = spotIn(c, t, 0, 3) || t;
        fire(game, c, [at], 0.9, 4);
      }
      if (c.riseT <= 0) c.rise = 0;
      return true;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // The kiln-wave: the floor heated row by row, coming across the hall
    // at you (one tile in each row kept cool: find it). It glazes you.
    if (cd(c, 'kilnCd', dt, 2) && ready(c) && !c.windup) {
      c.kilnCd = ph >= 2 ? 8 : 10;
      used(c, 1.2);
      const L = hallOf(c);
      const across = Math.abs(t.x - c.x) > Math.abs(t.z - c.z);
      const from = across ? (c.x < t.x ? L.x1 : L.x0) : (c.z < t.z ? L.z1 : L.z0);
      const to = across ? (c.x < t.x ? L.x0 : L.x1) : (c.z < t.z ? L.z0 : L.z1);
      const step = Math.sign(to - from) || 1;
      let cool = across ? t.z : t.x;
      for (let k = 0, v = from; k < 24 && v !== to + step; k++, v += step) {
        cool += Math.round((Math.random() - 0.5) * 2);
        const row = [];
        const lo = across ? L.z0 : L.x0;
        const hi = across ? L.z1 : L.x1;
        cool = Math.max(lo, Math.min(hi, cool));
        for (let w = lo; w <= hi; w++) if (w !== cool) row.push(across ? { x: v, z: w } : { x: w, z: v });
        fire(game, c, row.filter((q) => openFloor(game, q.x, q.z)), 1.2 + k * 0.28, 4, { quiet: k % 3 !== 0, burn: 1, onFire: glazed });
      }
      shout(c, 'Into the kiln!', '#ffb040');
      game.audio?.play('fire', c);
      return true;
    }
    // The glazing: white-hot glaze poured along the floor at you.
    if (cd(c, 'glazeCd', dt, 1.5) && ready(c) && d >= 1 && d <= 8 && !c.windup) {
      c.glazeCd = ph >= 2 ? 4 : 5;
      used(c);
      c.face(t.x, t.z);
      const line = lineTiles(game, c, t, d + 1);
      addHazard(game, { by: c, tiles: line, y: c.y, dur: 0.75, dmg: dmgOf(c, 3), kind: 'beam', from: { x: c.x, z: c.z }, to: line[line.length - 1] || t, beamColor: '#ffe8c0', halo: '#ff9040', width: 2, onFire: glazed });
      game.audio?.play('pour', c);
      return true;
    }
    // Funeral urns lobbed about you, each bursting into a ring of kiln-fire
    // (that glazes). (Round 50: a third thing from the first.)
    if (cd(c, 'urnCd', dt, 4) && ready(c) && d >= 2 && d <= 9 && !c.windup) {
      c.urnCd = ph >= 2 ? 7 : 8.5;
      used(c, 0.5);
      for (let k = 0; k < 2; k++) {
        const at = spotIn(c, t, k ? 2 : 1, 3) || t;
        lob(game, c, at.x, at.z, { tint: [200, 120, 70], onLand: (g, x, z) => fire(g, c, areaTiles(x, z, 1), 0.55, 4, { burn: 1, onFire: glazed }) });
      }
      shout(c, 'Ashes to the urn!', '#ffb040');
      game.audio?.play('crumble', c);
      return true;
    }
    // (Worn) The kiln's mouth opened at you: heat that glazes twice over.
    if (ph >= 2 && cd(c, 'mouthCd', dt, 3) && ready(c) && d <= 5 && !c.windup) {
      c.mouthCd = 10;
      used(c, 0.8);
      c.face(t.x, t.z);
      fire(game, c, coneTiles(c, t, 5, 0.5), 1.1, 5, { burn: 2, coats: 2, onFire: glazed });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'the kiln door opens...', '#ffb040');
      return true;
    }
    // (Desperate) He rises in the fire, embers raining down.
    if (ph >= 3 && cd(c, 'riseCd', dt, 2) && ready(c) && !c.windup) {
      c.riseCd = 14;
      used(c, 4);
      c.riseT = 4.5;
      shout(c, 'I rise!', '#ffb040');
      game.audio?.play('roar', c);
      return true;
    }
    if (d <= 2 && backOff(c, t)) return true;
    return d > 1;
  },

  vitrifiedHorror(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // In pieces: they have a little while to get back to it.
    if (c.shatter) return reform(c, dt);
    // Shards where it's stepped.
    const k = `${c.x},${c.z}`;
    if (c.trail && c.trail.k !== k) {
      for (const q of areaTiles(c.trail.x, c.trail.z, 1)) if (Math.random() < 0.3 && openFloor(game, q.x, q.z)) addZone(game, { by: c, kind: 'shards', tiles: [q], y: c.y, life: 12, step: dmgOf(c, 1), color: [180, 170, 220], puff: ['#c8b8f0'] });
    }
    c.trail = { k, x: c.x, z: c.z };
    // Worn down to each mark, it shatters.
    phaseSummons(c, [0.66, 0.33], () => shatter(c));
    if (c.shatter) return true;
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // A prism beam, burned slowly round after you.
    if (cd(c, 'prismCd', dt, 3) && ready(c) && d >= 2 && sees(game, c, t) && !c.windup) {
      c.prismCd = ph >= 2 ? 9 : 11;
      used(c, 3);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      startLaser(game, { by: c, ang: base + (Math.random() < 0.5 ? -1 : 1) * 0.7, turn: 0.4, len: 12, charge: 1.2, dur: 3.2, dmg: dmgOf(c, 3), tick: 0.35, width: 0.6, foes: 'player', fire: false, hue: 'arc', aim: () => (c.target && !c.target.dead ? Math.atan2(c.target.z - c.z, c.target.x - c.x) : null) });
      c.stunT = 4.4;
      return true;
    }
    // Glass spines up through the floor at you, one after another down
    // the line (three lines, desperate); some stay.
    if (cd(c, 'spineCd', dt, 2.5) && ready(c) && d >= 2 && d <= 10 && !c.windup) {
      c.spineCd = ph >= 2 ? 5 : 6.5;
      used(c, 0.4);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of ph >= 3 ? [-0.35, 0, 0.35] : [0]) {
        const to = { x: c.x + Math.cos(base + s) * 10, z: c.z + Math.sin(base + s) * 10 };
        lineTiles(game, c, to, 10).forEach((q, k) => shards(game, c, [q], 0.6 + k * 0.09, 5, { quiet: k % 3 !== 0, onFire: (g) => {
          if (Math.random() < 0.4 && openFloor(g, q.x, q.z)) addZone(g, { by: c, kind: 'shards', tiles: [q], y: c.y, life: 8, step: dmgOf(c, 1), color: [180, 170, 220], puff: ['#c8b8f0'] });
        } }));
      }
      game.audio?.play('glass', c);
      c.stunT = 0.6;
      return true;
    }
    // (Worn) Glass shaken down from the roof round you.
    if (ph >= 2 && cd(c, 'rainCd', dt, 3) && ready(c) && !c.windup) {
      c.rainCd = 10;
      used(c, 0.3);
      proc(game, c, 0.35, 6, () => {
        const tt = c.target && !c.target.dead ? c.target : t;
        const at = spotIn(c, tt, 0, 3);
        if (at) shards(game, c, areaTiles(at.x, at.z, 1), 1.0, 4, { quiet: true });
      });
      game.renderer.floatText(t.x, t.y + 3, t.z, 'glass falls from the roof!', '#c8b8f0');
      game.audio?.play('shatter', c);
      return true;
    }
    // Shards thrown out in every direction.
    if (cd(c, 'novaCd', dt, 4) && ready(c) && d <= 6 && !c.windup) {
      c.novaCd = ph >= 2 ? 8 : 10;
      used(c);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        shards(game, c, lineTiles(game, c, { x: c.x + Math.cos(a) * 7, z: c.z + Math.sin(a) * 7 }, 7), 1, 5, { quiet: i > 0 });
      }
      game.audio?.play('glass', c);
      c.stunT = 1;
      return true;
    }
    if (bossSlam(c, dt, 1, 0.9, 6, 4.5)) return true;
    return false;
  },

  // ------------------------------------------------ the Ash-Raider Den
  ashReaver(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      for (let i = 0; i < 2; i++) summon(game, 'ash_raider', c, 3, { color: ASHC });
      shout(c, 'To me, raiders!', '#ff9060');
    });
    // Berserk (see furyTick): the flail never still.
    if (c.berserkT > 0) {
      if (t && !t.dead && cd(c, 'rageCd', dt, 0) && ready(c) && dist(c, t) <= 3 && !c.windup) {
        c.rageCd = 2.2;
        used(c, 0.4);
        whirl(game, c);
        return true;
      }
      return false;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Oil thrown across the floor; it lies there.
    if (cd(c, 'oilCd', dt, 2) && ready(c) && d <= 9 && !c.windup) {
      c.oilCd = 6;
      used(c);
      for (let k = 0; k < 3; k++) {
        const at = k ? spotIn(c, t, 1, 3) || t : t;
        lob(game, c, at.x, at.z, { tint: [60, 50, 40], onLand: (g, x, z, y) => addZone(g, { by: c, kind: 'oil', tiles: areaTiles(x, z, 1).filter((q) => openFloor(g, q.x, q.z)), y, life: 14, slow: true, color: [40, 34, 30], puff: ['#2a2420', '#4a4036'] }) });
      }
      shout(c, 'Oil for the fire!', '#ff9060');
      return true;
    }
    // And then fire to it: every pool of it goes up.
    const oils = (game.zones || []).filter((z) => z.by === c && z.kind === 'oil' && !z.done);
    if (oils.length && cd(c, 'igniteCd', dt, 3) && ready(c) && !c.windup) {
      c.igniteCd = 7;
      used(c, 0.4);
      const tiles = oils.flatMap((z) => z.tiles);
      lob(game, c, tiles[0].x, tiles[0].z, { tint: [255, 140, 40], onLand: (g) => {
        for (const z of oils) z.done = true;
        fire(g, c, tiles, 0.05, 6, { burn: 3, onFire: (gg, h) => h.tiles.forEach((q) => groundFire(gg, q.x, q.z, c.y, c, false, 0)) });
      } });
      shout(c, 'Burn!', '#ff6030');
      return true;
    }
    // (Worn) The flail whirled: drawn in, and battered.
    if (ph >= 2 && cd(c, 'whirlCd', dt, 3) && ready(c) && d <= 4 && !c.windup) {
      c.whirlCd = 9;
      used(c, 1);
      whirl(game, c);
      return true;
    }
    return false;
  },

  bombardQueen(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    phaseSummons(c, [0.66, 0.33], () => {
      if (t && !t.dead) for (let k = 0; k < 2; k++) rollKeg(game, c, t, k);
      shout(c, 'Mind the kegs!', '#ffb040');
    });
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // Kegs rolled out at you, fuses lit: they go up where they stop. Hit
    // one, and it rolls back to her.
    if (cd(c, 'kegCd', dt, 2) && ready(c) && d >= 2 && !c.windup) {
      c.kegCd = ph >= 2 ? 5.5 : 7;
      used(c, 0.4);
      for (let k = 0; k < (ph >= 3 ? 2 : 1); k++) rollKeg(game, c, t, k);
      shout(c, 'Catch!', '#ffb040');
      if (!game.toldKegs) game.ui.msg('Pyrrha rolls lit kegs at you. Strike one and it rolls back to her: let her have her own powder!', '#ffb040', true);
      game.toldKegs = true;
      game.audio?.play('fuse', c);
      return true;
    }
    // Shells lobbed at you.
    if (cd(c, 'shotCd', dt, 1.5) && ready(c) && d >= 2 && d <= 11 && !c.windup) {
      c.shotCd = 5;
      used(c);
      c.face(t.x, t.z);
      for (let k = 0; k < ph; k++) {
        const at = k ? spotIn(c, t, 1, 3) || t : t;
        lob(game, c, at.x, at.z, { tint: [80, 70, 60], onLand: (g, x, z) => fire(g, c, areaTiles(x, z, 1), 0.6, 6, { burn: 1, knock: 1, from: { x, z: z + 0.01 } }) });
      }
      game.audio?.play('catapult', c);
      return true;
    }
    // A line of powder laid along the floor, and lit: the fire runs down it.
    if (cd(c, 'trailCd', dt, 4) && ready(c) && !c.windup) {
      c.trailCd = 10;
      used(c, 0.6);
      const end = { x: t.x + Math.sign(t.x - c.x) * 3, z: t.z + Math.sign(t.z - c.z) * 3 };
      const line = lineTiles(game, c, end, dist(c, end) + 1);
      addZone(game, { by: c, kind: 'powder', tiles: line, y: c.y, life: 1.2 + line.length * 0.15, color: [90, 90, 90], puff: ['#5a5a5a'] });
      line.forEach((q, i) => fire(game, c, [q], 1.2 + i * 0.15, 5, { quiet: i % 3 !== 0, spark: i === 0 ? { x: q.x, y: c.y, z: q.z } : null }));
      shout(c, 'Light the line!', '#ffb040');
      game.audio?.play('fuse', c);
      return true;
    }
    // (Worn) Too close: smoke, and she's across the hall.
    if (ph >= 2 && d <= 2 && cd(c, 'smokeCd', dt, 1)) {
      c.smokeCd = 7;
      const to = spotIn(c, c, 5, 9);
      if (to) {
        addZone(game, { by: c, kind: 'smoke', tiles: areaTiles(c.x, c.z, 1), y: c.y, life: 4, color: [90, 86, 86], puff: ['#5a5454', '#8a8484'] });
        blinkTo(c, to, ['#5a5454', '#8a8484', '#3a3636']);
        return true;
      }
    }
    if (d <= 3 && backOff(c, t)) return true;
    return d > 1;
  },

  chainedDrake(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // Chained to the middle of its hall till it tears the chain out.
    c.anchor ??= { x: c.x, z: c.z };
    c.hall ??= c.leash;
    if (ph < 2) {
      const A = c.anchor;
      // (Its chain, from the collar to the stake, is drawn with it: see
      // bossbeasts.drakeChain.)
      c.leash = { x0: A.x - 4, z0: A.z - 4, x1: A.x + 4, z1: A.z + 4 };
    } else if (!c.unchained) {
      c.unchained = true;
      c.leash = c.hall;
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'THE CHAIN SNAPS!', '#ff9060');
      game.renderer.emit(c.anchor.x, c.y + 0.5, c.anchor.z, { n: 20, color: ['#8a8480', '#c8c0b8'], up: 40, speed: 50, life: 0.6 });
      game.audio?.play('clang', c);
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // A sweep of fire across its hall, side to side.
    if (cd(c, 'breathCd', dt, 2) && ready(c) && d <= 8 && !c.windup) {
      c.breathCd = 7;
      used(c, 1.2);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      const dir = Math.random() < 0.5 ? 1 : -1;
      for (let k = 0; k < 6; k++) {
        const a = base + dir * (-0.8 + k * 0.32);
        const aim = { x: c.x + Math.cos(a) * 7, z: c.z + Math.sin(a) * 7 };
        fire(game, c, coneTiles(c, aim, 7, 0.17), 0.8 + k * 0.2, 6, { burn: 3, quiet: k > 0 });
      }
      c.stunT = 1.9;
      game.renderer.floatText(c.x, c.y + 3, c.z, 'it draws breath...', '#ff9060');
      game.audio?.play('roar', c);
      return true;
    }
    // Its chain lashed round, the whole length of it.
    if (!c.unchained && cd(c, 'lashCd', dt, 4) && ready(c) && !c.windup) {
      c.lashCd = 8;
      used(c, 0.4);
      const ring = [...ringTiles(c.anchor.x, c.anchor.z, 4), ...ringTiles(c.anchor.x, c.anchor.z, 5)];
      addHazard(game, { by: c, tiles: ring, y: c.y, dur: 1.1, dmg: dmgOf(c, 6), knock: 1, from: c.anchor, kind: 'slam', center: c.anchor, radius: 5, color: COLORS.blow });
      game.audio?.play('chains', c);
      return true;
    }
    // Its tail swept round: everything close to it thrown off its feet.
    if (d <= 2 && cd(c, 'tailCd', dt, 2) && ready(c) && !c.windup) {
      c.tailCd = 6;
      used(c, 0.3);
      const R = 1 + (c.foot || 0);
      const tiles = [...ringTiles(c.x, c.z, R), ...ringTiles(c.x, c.z, R + 1)];
      addHazard(game, { by: c, tiles, y: c.y, dur: 0.75, dmg: dmgOf(c, 6), knock: 2, stun: 0.4, from: { x: c.x, z: c.z }, kind: 'slam', center: { x: c.x, z: c.z }, radius: R + 1, color: COLORS.blow });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'its tail swings!', '#ff9060');
      game.audio?.play('whoosh', c);
      return true;
    }
    // Gobs of fire spat at you: where they land the floor burns.
    if (d >= 3 && cd(c, 'spitCd', dt, 3) && ready(c) && !c.windup) {
      c.spitCd = ph >= 2 ? 5 : 6.5;
      used(c);
      c.face(t.x, t.z);
      for (let k = 0; k < (ph >= 2 ? 3 : 2); k++) {
        const at = k ? spotIn(c, t, 1, 3) || t : t;
        lob(game, c, at.x, at.z, { tint: [255, 120, 40], onLand: (g, x, z) => {
          fire(g, c, areaTiles(x, z, 1), 0.05, 5, { burn: 2, quiet: k > 0 });
          groundFire(g, x, z, c.y, c, false, 0);
        } });
      }
      game.audio?.play('roar', c);
      return true;
    }
    // (Worn) Its wings beat: ash and embers down from the roof all over
    // its hall.
    if (ph >= 2 && cd(c, 'wingCd', dt, 3) && ready(c) && !c.windup) {
      c.wingCd = 13;
      used(c, 0.8);
      const tiles = hallTiles(c);
      proc(game, c, 0.4, 10, () => {
        for (let i = 0; i < 3; i++) {
          const q = tiles[Math.floor(Math.random() * tiles.length)];
          if (q) fire(game, c, [q], 0.9, 4, { quiet: true });
        }
      });
      game.renderer.floatText(c.x, c.y + 3, c.z, 'wings beat!', '#ff9060');
      game.audio?.play('flap', c);
      return true;
    }
    return false;
  },

  // ------------------------------------------------ the Kiln-Deep
  kilnKing(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    if (!t || t.dead) return false;
    const d = dist(c, t);
    // The mould poured: molten metal down channels across the hall, which
    // sets into walls of black glass (gaps left in them).
    if (cd(c, 'pourCd', dt, 3) && ready(c) && (c.pours || 0) < 3 && !c.windup) {
      c.pourCd = 12;
      c.pours = (c.pours || 0) + 1;
      used(c, 1);
      const L = hallOf(c);
      const across = Math.random() < 0.5;
      const lines = [];
      for (let k = 0; k < 2; k++) {
        const v = across ? Math.round(L.z0 + 2 + Math.random() * (L.z1 - L.z0 - 4)) : Math.round(L.x0 + 2 + Math.random() * (L.x1 - L.x0 - 4));
        const line = [];
        const lo = across ? L.x0 : L.z0;
        const hi = across ? L.x1 : L.z1;
        for (let w = lo; w <= hi; w++) line.push(across ? { x: w, z: v } : { x: v, z: w });
        lines.push(line.filter((q) => openFloor(game, q.x, q.z) && !(Math.abs(q.x - c.x) <= 1 && Math.abs(q.z - c.z) <= 1)));
      }
      for (const line of lines) {
        fire(game, c, line, 1.6, 6, { burn: 2, onFire: (g, h) => {
          for (const q of h.tiles) work(g, q.x, FY, q.z, B.lava, 0, c);
          // (Set, it's a wall; with a gap every few paces.)
          proc(g, c, 5, 1, () => h.tiles.forEach((q, i) => {
            if (g.world.getBlock(q.x, FY, q.z) !== B.lava) return;
            if (i % 5 === 2) work(g, q.x, FY, q.z, B.air, 0, c);
            else {
              work(g, q.x, FY, q.z, B.obsidian, 0, c);
              work(g, q.x, FY + 1, q.z, B.obsidian, 0, c);
            }
          }));
        } });
      }
      shout(c, 'Into the mould!', '#ffb040');
      game.audio?.play('pour', c);
      return true;
    }
    // His tongs, out at you down a line: caught, you're hauled to his
    // anvil (and the hammer's coming).
    if (cd(c, 'tongsCd', dt, 4) && ready(c) && d >= 3 && d <= 7 && sees(game, c, t) && !c.windup) {
      c.tongsCd = ph >= 2 ? 8 : 10;
      used(c, 0.6);
      c.face(t.x, t.z);
      const line = lineTiles(game, c, t, d + 1);
      const end = line[line.length - 1] || { x: t.x, z: t.z };
      addHazard(game, { by: c, tiles: line, y: c.y, dur: 0.75, dmg: dmgOf(c, 3), kind: 'dart', from: { x: c.x, z: c.z }, to: end, color: [180, 170, 160], onFire: (g, h, hit) => {
        for (const e of hit) {
          if (e.kind !== 'player') continue;
          drag(g, e, c, Math.max(1, dist(c, e) - 1));
          g.renderer.floatText(e.x, e.y + 2.4, e.z, 'hauled in!', '#ffb040');
          c.anvilCd = Math.min(c.anvilCd ?? 0, 0.6);
        }
      } });
      shout(c, 'Come here, ore.', '#ffb040');
      game.audio?.play('chains', c);
      return true;
    }
    // Sparks off the anvil, showering down round you.
    if (cd(c, 'sparkCd', dt, 3) && ready(c) && d <= 10 && !c.windup) {
      c.sparkCd = ph >= 2 ? 6 : 7.5;
      used(c, 0.3);
      for (let k = 0; k < (ph >= 3 ? 6 : 4); k++) {
        const at = k ? spotIn(c, t, 1, 3) : { x: t.x, z: t.z };
        if (at) lob(game, c, at.x, at.z, { tint: [255, 220, 120], onLand: (g, x, z) => fire(g, c, [{ x, z }, ...ringTiles(x, z, 1).filter(() => Math.random() < 0.5)], 0.05, 4, { burn: 1, quiet: k > 0 }) });
      }
      game.renderer.floatText(c.x, c.y + 3, c.z, 'sparks fly!', '#ffe0a0');
      game.audio?.play('clang', c);
      return true;
    }
    // His hammer on the anvil: the floor splits in a cross.
    if (cd(c, 'anvilCd', dt, 2) && ready(c) && d <= 9 && !c.windup) {
      c.anvilCd = 6;
      used(c);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const line = lineTiles(game, c, { x: c.x + dx * 10, z: c.z + dz * 10 }, 10);
        addHazard(game, { by: c, tiles: line, y: c.y, dur: 1, dmg: dmgOf(c, 7), knock: 2, from: { x: c.x, z: c.z }, kind: 'erupt' });
      }
      c.stunT = 1.1;
      game.renderer.floatText(c.x, c.y + 3, c.z, 'CLANG', '#ffe0a0');
      game.audio?.play('clang', c);
      return true;
    }
    // (Worn) Quenched: every channel of metal goes up in scalding steam,
    // and the walls it set into crack and fall.
    if (ph >= 2 && cd(c, 'quenchCd', dt, 3) && ready(c) && (game.works || []).some((q) => q.by === c) && !c.windup) {
      c.quenchCd = 12;
      used(c, 0.8);
      const mine = (game.works || []).filter((q) => q.by === c && q.y === FY);
      const tiles = mine.map((q) => ({ x: q.x, z: q.z }));
      for (const q of game.works.filter((w) => w.by === c)) {
        q.life = 0.5;
        q.t = 0;
      }
      addZone(game, { by: c, kind: 'steam', tiles, y: c.y, life: 5, tick: 0.6, dmg: dmgOf(c, 2), color: [220, 220, 220], puff: ['#ffffff', '#e0e0e0', '#c8c8c8'] });
      shards(game, c, tiles, 0.6, 4);
      shout(c, 'QUENCH!', '#e0f0ff');
      game.audio?.play('hiss', c);
      return true;
    }
    return false;
  },

  slagTitan(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // (Worn) Its core open: the ground round it burns.
    if (ph >= 2 && Math.random() < dt * 2) for (const q of ringTiles(c.x, c.z, 2)) if (Math.random() < 0.3) groundFire(game, q.x, q.z, c.y, c, false, 0);
    // Its lodestone heart charged, glowing blue: then it pulls on every
    // bit of iron in the hall.
    if (c.charge) {
      c.charge.t -= dt;
      if (Math.random() < dt * 16) {
        const a = Math.random() * Math.PI * 2;
        game.renderer.emit(c.x + Math.cos(a) * 2, c.y + 1 + Math.random(), c.z + Math.sin(a) * 2, { n: 1, color: ['#a0c8ff', '#ffffff', '#5a8ae0'], up: 0, speed: 30, life: 0.4, glow: true });
      }
      if (c.charge.t > 0) return true;
      c.charge = null;
      game.renderer.effect?.({ type: 'ring', wx: c.x, wy: c.y, wz: c.z, r1: 9 * 16, r0: 60, color: ['#a0c8ff', '#ffffff'], life: 0.6, oy: 4, flat: 0.5, thick: 2 });
      game.audio?.play('hum', c);
      let tore = false;
      for (const p of game.everyone()) if (p && !p.dead && dist(c, p) <= 9 && lodestone(game, p, c, drag) === 'weapon') tore = true;
      if (tore) shout(c, 'GRRRNNN', '#a0c8ff');
      return true;
    }
    if (!t || t.dead) return false;
    const d = dist(c, t);
    if (cd(c, 'magCd', dt, 3.5) && ready(c) && d <= 9 && !c.windup) {
      c.magCd = ph >= 2 ? 9 : 11;
      used(c, 1.8);
      c.charge = { t: 1.5 };
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'its heart turns to lodestone...', '#a0c8ff');
      if (!game.toldLode) game.ui.msg('The Slag Titan\'s heart is a lodestone: when it glows blue it tears iron out of your hands (and drags you in by iron armour). Put your iron away, or fight with something else!', '#a0c8ff', true);
      game.toldLode = true;
      return true;
    }
    // The floor split open at you: three fissures of molten slag racing
    // out from its feet.
    if (cd(c, 'fissureCd', dt, 3) && ready(c) && d >= 2 && d <= 10 && !c.windup) {
      c.fissureCd = ph >= 2 ? 6 : 7.5;
      used(c, 0.5);
      const base = Math.atan2(t.z - c.z, t.x - c.x);
      for (const s of [-0.45, 0, 0.45]) {
        const to = { x: c.x + Math.cos(base + s) * 10, z: c.z + Math.sin(base + s) * 10 };
        lineTiles(game, c, to, 10).forEach((q, k) => {
          if (k >= (c.foot || 0)) fire(game, c, [q], 0.7 + k * 0.08, 5, { burn: 2, quiet: k % 3 !== 0 });
        });
      }
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'the floor splits!', '#ff9050');
      game.audio?.play('rumble', c);
      c.stunT = 0.7;
      return true;
    }
    // (Worn) Iron shot out of it all round; and then the lodestone calls
    // every scrap of it back, from between where it went.
    if (ph >= 2 && cd(c, 'ironCd', dt, 3) && ready(c) && d <= 9 && !c.windup) {
      c.ironCd = 11;
      used(c, 1);
      const off = Math.random() * (Math.PI / 6);
      for (let i = 0; i < 6; i++) {
        const a = off + (i / 6) * Math.PI * 2;
        const line = lineTiles(game, c, { x: c.x + Math.cos(a) * 9, z: c.z + Math.sin(a) * 9 }, 9);
        const end = line[line.length - 1];
        if (!end) continue;
        addHazard(game, { by: c, tiles: line, y: c.y, dur: 0.8, dmg: dmgOf(c, 4), kind: 'dart', from: { x: c.x, z: c.z }, to: end, color: [160, 170, 190], quiet: i > 0, onFire: (g) => {
          const b = a + Math.PI / 6;
          const back = lineTiles(g, c, { x: c.x + Math.cos(b) * 9, z: c.z + Math.sin(b) * 9 }, 9);
          const far = back[back.length - 1];
          if (far) addHazard(g, { by: c, tiles: back, y: c.y, dur: 0.9, dmg: dmgOf(c, 4), kind: 'dart', from: far, to: { x: c.x, z: c.z }, color: [160, 200, 255] });
        } });
      }
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'iron flies!', '#a0c8ff');
      game.audio?.play('clank', c);
      return true;
    }
    // Slag thrown: it burns where it lands.
    if (cd(c, 'heapCd', dt, 2) && ready(c) && d >= 2 && d <= 10 && !c.windup) {
      c.heapCd = 6;
      used(c);
      for (let k = 0; k < 2; k++) {
        const at = k ? spotIn(c, t, 2, 4) || t : t;
        lob(game, c, at.x, at.z, { tint: [255, 120, 50], onLand: (g, x, z) => {
          fire(g, c, areaTiles(x, z, 1), 0.4, 6, { burn: 2 });
          groundFire(g, x, z, c.y, c, false, 0);
        } });
      }
      game.audio?.play('catapult', c);
      return true;
    }
    if (bossSlam(c, dt, 2, 1.1, 8, 5)) return true;
    return false;
  },

  moltenHeart(c, dt) {
    const game = c.game;
    const t = c.target;
    const ph = phaseOf(c);
    // Its four chains, anchored at the hall's corners.
    if (!c.anchored) {
      c.anchored = true;
      const L = hallOf(c);
      for (const [x, z] of [[L.x0 + 1, L.z0 + 1], [L.x1 - 1, L.z0 + 1], [L.x0 + 1, L.z1 - 1], [L.x1 - 1, L.z1 - 1]]) summon(game, 'heart_anchor', { x, y: c.y, z }, 1, { color: ['#8a8480', '#ffb040'] });
      if (!game.toldAnchors) game.ui.msg('Four chains hold the Molten Heart up: break their anchors, or your blows will hardly touch it!', '#ffb070', true);
      game.toldAnchors = true;
    }
    // (Its chains are drawn with it: see bossbeasts.heartChains.)
    c.wardNote = (c.wardNote || 0) - dt;
    if (!t || t.dead) return true;
    const d = dist(c, t);
    // The floor erupting under you, square by square.
    if (cd(c, 'eruptCd', dt, 2) && ready(c) && !c.windup) {
      c.eruptCd = ph >= 2 ? 5 : 6.5;
      used(c, 0.4);
      c.parity = 1 - (c.parity || 0);
      const tiles = hallTiles(c).filter((q) => (q.x + q.z) % 2 === c.parity && Math.max(Math.abs(q.x - c.x), Math.abs(q.z - c.z)) > 1);
      fire(game, c, tiles, 1.5, 6, { quiet: true, onFire: (g, h) => {
        for (let i = 0; i < 12; i++) {
          const q = h.tiles[Math.floor(Math.random() * h.tiles.length)];
          if (q) g.renderer.emit(q.x, c.y + 0.2, q.z, { n: 4, color: FIRE, up: 50, speed: 20, gravity: 140, life: 0.6, glow: true });
        }
      } });
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'the floor glows...', '#ff9060');
      game.audio?.play('rumble', c);
      return true;
    }
    // Gobs of magma spat at you.
    if (cd(c, 'spitCd', dt, 3) && ready(c) && d >= 2 && !c.windup) {
      c.spitCd = ph >= 2 ? 4 : 5;
      used(c);
      for (let k = 0; k < 2; k++) {
        const at = k ? spotIn(c, t, 1, 2) || t : t;
        lob(game, c, at.x, at.z, { tint: [255, 100, 30], onLand: (g, x, z) => fire(g, c, areaTiles(x, z, 1), 0.05, 5, { burn: 2 }) });
      }
      return true;
    }
    // A chain lashed across the floor from the anchor nearest you, through
    // where it hangs, to the far side (or, its anchors all broken, slag
    // rained about you). (Round 50: a third thing from the first.)
    if (cd(c, 'lashCd', dt, 4) && ready(c) && !c.windup) {
      c.lashCd = ph >= 2 ? 6.5 : 8;
      used(c, 0.5);
      const a = game.creatures.filter((o) => !o.dead && o.species === 'heart_anchor' && dist(o, c) < 30).sort((p, q) => dist(p, t) - dist(q, t))[0];
      if (a) {
        const far = { x: c.x + (c.x - a.x), z: c.z + (c.z - a.z) };
        const tiles = lineTiles(game, a, far, Math.ceil(Math.hypot(far.x - a.x, far.z - a.z)) + 1).filter((q) => inHall(c, q));
        for (const w of [-1, 1]) {
          const side = tiles.map((q) => (Math.abs(far.x - a.x) > Math.abs(far.z - a.z) ? { x: q.x, z: q.z + w } : { x: q.x + w, z: q.z })).filter((q) => inHall(c, q));
          if (side.length) addHazard(game, { by: c, tiles: side, y: c.y, dur: 1.0, dmg: dmgOf(c, 3), kind: 'fire', color: COLORS.fire, quiet: true });
        }
        if (tiles.length) addHazard(game, { by: c, tiles, y: c.y, dur: 1.0, dmg: dmgOf(c, 5), kind: 'beam', from: { x: a.x, z: a.z }, to: tiles[tiles.length - 1], beamColor: '#ffb040', halo: '#ff5020', width: 2, knock: 1 });
        game.renderer.floatText(a.x, a.y + 2.4, a.z, 'the chain whips!', '#ffb040');
        game.audio?.play('chains', c);
      } else {
        for (let k = 0; k < 4; k++) {
          const at = spotIn(c, t, 0, 3) || t;
          lob(game, c, at.x, at.z, { tint: [255, 120, 40], onLand: (g, x, z) => fire(g, c, areaTiles(x, z, 1), 0.05, 4, { burn: 1 }) });
        }
      }
      return true;
    }
    // (Worn) A beam of magma, turned after you.
    if (ph >= 2 && cd(c, 'beamCd', dt, 3) && ready(c) && d >= 2 && !c.windup) {
      c.beamCd = 11;
      used(c, 3);
      startLaser(game, { by: c, ang: Math.atan2(t.z - c.z, t.x - c.x) + 0.8, turn: 0.4, len: 12, charge: 1.2, dur: 3, dmg: dmgOf(c, 3), tick: 0.35, width: 0.6, foes: 'player', fire: true, hue: 'red', aim: () => (c.target && !c.target.dead ? Math.atan2(c.target.z - c.z, c.target.x - c.x) : null) });
      return true;
    }
    // (Desperate) Meltdown: fire in from the walls, ring by ring, till
    // there's only the middle left.
    if (ph >= 3 && cd(c, 'meltCd', dt, 2) && ready(c) && !c.windup) {
      c.meltCd = 14;
      used(c, 2);
      const L = hallOf(c);
      const edge = (q) => Math.min(q.x - L.x0, L.x1 - q.x, q.z - L.z0, L.z1 - q.z);
      const tiles = hallTiles(c);
      proc(game, c, 1.1, 4, (k) => fire(game, c, tiles.filter((q) => edge(q) === k), 0.9, 5, { quiet: true, burn: 2 }));
      game.renderer.floatText(c.x, c.y + 3.4, c.z, 'MELTDOWN: get to the middle!', '#ff6030');
      game.audio?.play('eruption', c);
      return true;
    }
    return true;
  },

  // A chain anchor: it only stands there, its chain taut.
  heartAnchor() {
    return true;
  },
  // A lit keg, rolling: straight at you, or (struck) back to her; it goes
  // up when its fuse burns down, or when it reaches her.
  rollingKeg(c, dt) {
    const game = c.game;
    c.fuseT -= dt;
    if (Math.random() < dt * 20) game.renderer.emit(c.x, c.y + 0.9, c.z, { n: 1, color: ['#ffe070', '#ff9030', '#ffffff'], up: 20, speed: 24, life: 0.3, glow: true });
    const o = c.owner;
    if (c.back && o && !o.dead && dist(c, o) <= 1) return kegGoesUp(c, true);
    if (c.fuseT <= 0) return kegGoesUp(c, false);
    if (!c.moving && !c.stopped) {
      let [ux, uz] = c.roll;
      if (c.back && o && !o.dead) {
        const dx = o.x - c.x;
        const dz = o.z - c.z;
        [ux, uz] = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx), 0] : [0, Math.sign(dz)];
      }
      if (!c.tryStep(c.x + ux, c.z + uz, c.back ? 0.16 : c.S.step)) {
        // (Fetched up against something: it lies there fizzing.)
        if (!c.back) {
          c.stopped = true;
          c.fuseT = Math.min(c.fuseT, 1.2);
        } else if (!c.tryStep(c.x + (uz ? Math.sign(o.x - c.x) || 1 : 0), c.z + (ux ? Math.sign(o.z - c.z) || 1 : 0), 0.16)) c.fuseT = Math.min(c.fuseT, 0.6);
      }
    }
    return true;
  },
};

// ------------------------------------------------------------ their ways
// The Cinder King's decree, laid on you: obeyed or defied?
function judgeDecree(c, dt) {
  const game = c.game;
  const D = c.decree;
  const p = c.target && c.target.kind === 'player' ? c.target : game.player;
  D.t += dt;
  if (!p || p.dead) {
    c.decree = null;
    return false;
  }
  if (Math.random() < dt * 8) {
    const a = Math.random() * Math.PI * 2;
    game.renderer.emit(p.x + Math.cos(a) * 1.1, p.y + 0.1, p.z + Math.sin(a) * 1.1, { n: 1, color: D.kneel ? ['#ffd060', '#ffffff'] : FIRE, up: 18, speed: 4, life: 0.5, glow: true });
  }
  if (D.t > D.grace) {
    const acting = p.moving || p.rollT > 0 || p.swing || p.commitT > 0;
    if (D.kneel && acting) D.broke = true;
    if (!D.kneel) {
      D.still = p.moving || p.rollT > 0 ? 0 : D.still + dt;
      if (D.still > 0.8) D.broke = true;
    }
  }
  if (D.t < D.judge && !D.broke) return true;
  c.decree = null;
  if (D.broke) {
    fire(game, c, areaTiles(p.x, p.z, 1), 0.45, 8, { burn: 3 });
    game.renderer.floatText(p.x, p.y + 3, p.z, 'DEFIANCE!', '#ff6030');
    shout(c, 'You DARE?!', '#ff6030');
  } else {
    c.exposedT = 3;
    c.stunT = Math.max(c.stunT || 0, 1.2);
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'he is satisfied: off his guard!', '#ffe070');
    shout(c, D.kneel ? 'Good. Stay down.' : 'Hah! Run, then.', '#ffb060');
  }
  return true;
}

// The Glass Wyrm under the floor, making its way toward the last sound
// you made (the floor heaving over it); still long enough and it's lost
// you.
function huntTremor(c, dt) {
  const game = c.game;
  const H = c.hunt;
  const p = c.target && !c.target.dead ? c.target : game.player;
  H.t += dt;
  if (H.rise > 0) {
    H.rise -= dt;
    if (H.rise <= 0) return surface(c, H.heard, true);
    return true;
  }
  const loud = p && !p.dead && (p.moving || p.rollT > 0 || p.swing || p.commitT > 0);
  if (loud) {
    H.heard = { x: p.x, z: p.z };
    H.quiet = 0;
  } else H.quiet += dt;
  H.step += dt;
  if (H.step >= 0.22) {
    H.step = 0;
    H.at.x += Math.sign(H.heard.x - H.at.x);
    H.at.z += Math.sign(H.heard.z - H.at.z);
    game.renderer.emit(H.at.x, c.y + 0.2, H.at.z, { n: 4, color: ['#5a4e6a', '#8a7aaa', '#c8b8f0'], up: 16, speed: 18, gravity: 120, life: 0.45 });
    H.rumble -= 0.22;
    if (H.rumble <= 0) {
      H.rumble = 0.9;
      game.audio?.play('rumble', H.at);
      game.shake = Math.min(0.6, (game.shake || 0) + 0.12);
    }
  }
  if (H.quiet >= 1.6 && H.t > 1) return surface(c, H.at, false);
  const under = H.at.x === H.heard.x && H.at.z === H.heard.z;
  if ((under && H.t > 1 && H.quiet < 0.5) || H.t >= H.max) {
    // A moment's warning, the floor bulging, and up it comes.
    H.rise = 0.55;
    addHazard(game, { by: c, tiles: areaTiles(H.heard.x, H.heard.z, 1), y: c.y, dur: 0.55, dmg: dmgOf(c, 8), knock: 2, from: { x: H.heard.x, z: H.heard.z + 0.01 }, kind: 'erupt', keep: true });
  }
  return true;
}
function surface(c, at, onYou) {
  const game = c.game;
  c.hunt = null;
  c.burrowed = false;
  c.solid = true;
  const to = spotIn(c, at, 0, 2) || { x: c.x, y: c.y, z: c.z };
  c.teleport(to.x, to.y ?? c.y, to.z);
  game.moveEntity(c, to.x, to.y ?? c.y, to.z);
  game.renderer.emit(to.x, c.y + 0.5, to.z, { n: 24, color: GLASS, up: 50, speed: 60, gravity: 160, life: 0.8 });
  game.shake = Math.min(1.4, (game.shake || 0) + 0.6);
  if (onYou) c.stunT = 0.6;
  else {
    c.stunT = 3;
    c.exposedT = 3;
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'it lost you! dazed: strike now!', '#ffe070');
  }
  return true;
}

// The Vitrified Horror in pieces: they're loose in the hall; whatever's
// left of them when its time is up goes back into it, and mends it.
function shatter(c) {
  const game = c.game;
  c.shatter = { t: 0, max: 8, at: { x: c.x, y: c.y, z: c.z }, pieces: [] };
  for (let i = 0; i < 3; i++) {
    const s = summon(game, 'glass_shard', c, 3, { color: GLASS });
    if (s) {
      s.pieceOf = c;
      c.shatter.pieces.push(s);
    }
  }
  c.burrowed = true;
  c.solid = false;
  c.windup = null;
  game.removeOcc(c);
  game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 40, color: ['#c8b8f0', '#ffffff', '#a0c8ff', '#e8e0c8'], up: 50, speed: 80, gravity: 140, life: 0.9 });
  game.renderer.floatText(c.x, c.y + 3.4, c.z, 'IT SHATTERS!', '#c8b8f0');
  game.audio?.play('glass', c);
  if (!game.toldShatter) game.ui.msg('The Vitrified Horror shatters! Break its pieces before they crawl back together: each one that makes it mends it.', '#c8b8f0', true);
  game.toldShatter = true;
}
function reform(c, dt) {
  const game = c.game;
  const S = c.shatter;
  S.t += dt;
  const live = S.pieces.filter((q) => !q.dead);
  if (live.length && S.t < S.max) {
    if (Math.random() < dt * 3) {
      const q = live[Math.floor(Math.random() * live.length)];
      game.renderer.effect?.({ type: 'siphon', wx: q.x, wy: q.y + 0.6, wz: q.z, tx: S.at.x, ty: S.at.y + 1, tz: S.at.z, life: 0.5, oy: -6, n: 6, amp: 2, color: GLASS });
    }
    return true;
  }
  c.shatter = null;
  c.burrowed = false;
  c.solid = true;
  c.teleport(S.at.x, S.at.y, S.at.z);
  game.moveEntity(c, S.at.x, S.at.y, S.at.z);
  for (const q of live) {
    game.renderer.effect?.({ type: 'siphon', wx: q.x, wy: q.y + 0.6, wz: q.z, tx: c.x, ty: c.y + 1, tz: c.z, life: 0.6, oy: -6, n: 10, amp: 3, color: GLASS });
    q.dead = true;
  }
  game.renderer.emit(c.x, c.y + 1.4, c.z, { n: 30, color: ['#c8b8f0', '#ffffff'], up: 30, speed: 40, life: 0.7, glow: true });
  if (live.length) {
    const heal = Math.round(c.maxHp * 0.06 * live.length);
    c.hp = Math.min(c.maxHp, c.hp + heal);
    game.renderer.floatText(c.x, c.y + 3.4, c.z, `it reforms (+${heal})`, '#c8b8f0');
  } else {
    c.stunT = 2;
    c.exposedT = 4;
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'it reforms cracked: strike now!', '#ffe070');
  }
  game.audio?.play('glass', c);
  return true;
}

// The Bellows Golem's heat, every moment: climbing (quicker when it's
// worn), and at the top it vents: stood still, steam roaring out of its
// front, its back open to you, till it's cooled.
function heatTick(c, dt) {
  const game = c.game;
  c.heat ??= 0;
  if (c.ventT > 0) {
    c.ventT -= dt;
    c.exposedT = Math.max(c.exposedT || 0, c.ventT);
    c.heat = Math.max(0, c.heat - dt * 25);
    c.gauge = { label: 'VENTING', v: c.ventT / 4.5, color: '#e8e4dc' };
    c.steamT = (c.steamT || 0) - dt;
    if (c.steamT <= 0) {
      c.steamT = 0.6;
      const [fx, fz] = [[0, 1], [-1, 0], [0, -1], [1, 0]][c.dir] || [0, 1];
      const cone = coneTiles(c, { x: c.x + fx * 5, z: c.z + fz * 5 }, 5, 0.6);
      addHazard(game, { by: c, tiles: cone, y: c.y, dur: 0.3, dmg: dmgOf(c, 3), kind: 'steam', quiet: true, knock: 1, from: { x: c.x, z: c.z }, color: [235, 235, 240] });
      for (const q of cone) if (Math.random() < 0.25) game.renderer.emit(q.x, c.y + 0.8, q.z, { n: 1, color: ['#ffffff', '#e8e4dc'], up: 20, speed: 20, life: 0.6, shape: 'puff', gravity: -20 });
    }
    if (c.ventT <= 0) {
      c.heat = 0;
      game.renderer.floatText(c.x, c.y + 3, c.z, 'it cools, and starts up again', '#c8c0b8');
    }
    return;
  }
  c.heat = Math.min(100, c.heat + dt * (phaseOf(c) >= 2 ? 3 : 2));
  c.gauge = { label: 'HEAT', v: c.heat / 100, color: c.heat > 70 ? '#ff6020' : '#ffb040' };
  if (c.heat >= 100 && !c.windup) {
    c.ventT = 4.5;
    c.exposedT = 4.5;
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'OVERHEATED: VENTING!', '#ffe070');
    if (!game.toldVent) game.ui.msg('The Bellows Golem overheats and must vent: steam out of its front, its back wide open. Get behind it and strike! (Hit it while it\'s hot and it overheats sooner.)', '#ffe070', true);
    game.toldVent = true;
    game.audio?.play('hiss', c);
  }
}

// Kharn's fury, every moment: building while he's after you; full, he
// goes berserk (quicker, harder) for a while, and then he's spent.
function furyTick(c, dt) {
  const game = c.game;
  const t = c.target;
  if (c.berserkT > 0) {
    c.berserkT -= dt;
    c.hasteT = Math.max(c.hasteT || 0, 0.3);
    c.fury = Math.max(0, (100 * c.berserkT) / 7);
    c.gauge = { label: 'BERSERK', v: c.fury / 100, color: '#ff3020' };
    if (Math.random() < dt * 12) game.renderer.emit(c.x, c.y + 1.2, c.z, { n: 1, color: ['#ff3020', '#ff9060'], up: 20, speed: 14, life: 0.5, glow: true });
    if (c.berserkT <= 0) {
      c.dmgMult /= 1.3;
      c.fury = 0;
      c.windup = null;
      c.stunT = 2.5;
      c.exposedT = 3;
      game.renderer.floatText(c.x, c.y + 3, c.z, 'spent: strike now!', '#ffe070');
    }
    return;
  }
  c.fury = Math.min(100, (c.fury || 0) + dt * (t && !t.dead ? 3 : 0));
  c.gauge = { label: 'FURY', v: c.fury / 100, color: '#ff7040' };
  if (c.fury >= 100) {
    c.berserkT = 7;
    c.dmgMult *= 1.3;
    game.renderer.floatText(c.x, c.y + 3.4, c.z, 'BERSERK!', '#ff3020');
    c.say?.('BLOOD AND ASH!', 2.2, '#ff3020');
    game.audio?.play('roar', c);
    if (!game.toldFury) game.ui.msg('Kharn\'s fury builds with every blow he lands, and when it\'s full he goes berserk. Parry him to cool it!', '#ff7040', true);
    game.toldFury = true;
  }
}

// Kharn's flail whirled: drawn in, and battered.
function whirl(game, c) {
  addZone(game, { by: c, kind: 'wind', tiles: areaTiles(c.x, c.z, 4), y: c.y, life: 1.2, tick: 0.3, pull: { x: c.x, z: c.z }, puff: ASHC });
  addHazard(game, { by: c, tiles: areaTiles(c.x, c.z, 2), y: c.y, dur: 1.1, dmg: dmgOf(c, 7), knock: 2, from: { x: c.x, z: c.z }, center: { x: c.x, z: c.z }, radius: 2, kind: 'slam', color: COLORS.blow });
  c.stunT = 1.2;
  game.renderer.floatText(c.x, c.y + 3, c.z, 'the flail whirls!', '#ff9060');
  game.audio?.play('whoosh', c);
}

// One of Pyrrha's kegs, set rolling from beside her straight at you.
function rollKeg(game, c, t, k) {
  const dx = t.x - c.x;
  const dz = t.z - c.z;
  const dir = Math.abs(dx) >= Math.abs(dz) ? [Math.sign(dx) || 1, 0] : [0, Math.sign(dz) || 1];
  const side = k ? (dir[0] ? [0, 1] : [1, 0]) : [0, 0];
  const at = { x: c.x + dir[0] + side[0], y: c.y, z: c.z + dir[1] + side[1] };
  const keg = summon(game, 'rolling_keg', at, 1, { color: ['#ffe070', '#ff9030'] });
  if (!keg) return null;
  keg.owner = c;
  keg.roll = dir;
  keg.fuseT = 3.6;
  return keg;
}
function kegGoesUp(c, onOwner) {
  const game = c.game;
  const o = c.owner;
  c.dead = true;
  game.removeOcc?.(c);
  addHazard(game, { tiles: areaTiles(c.x, c.z, 1), y: c.y, dur: 0.05, dmg: c.back ? 4 : dmgOf(o || c, 8), burn: 2, knock: 2, from: { x: c.x, z: c.z + 0.001 }, center: { x: c.x, z: c.z }, kind: 'blast', trap: true });
  game.renderer.effect?.({ type: 'blast', wx: c.x, wy: c.y, wz: c.z, r1: 36, life: 0.7, oy: 2 });
  game.renderer.emit(c.x, c.y + 1, c.z, { n: 30, color: ['#ff9030', '#ffe070', '#5a5048', '#3a3430'], up: 60, speed: 90, gravity: 120, life: 0.9 });
  game.audio?.play('boom', c);
  game.shake = Math.min(1.5, (game.shake || 0) + 0.8);
  // (Her own powder, back at her.)
  if (o && !o.dead && (onOwner || dist(c, o) <= 1)) {
    game.damage(o, Math.max(4, Math.round(o.maxHp * 0.1)), game.player);
    o.stunT = Math.max(o.stunT || 0, 2.5);
    o.exposedT = Math.max(o.exposedT || 0, 2.5);
    game.renderer.floatText(o.x, o.y + 3.2, o.z, 'her own powder!', '#ffe070');
    o.say?.('ARGH! My own keg!', 2, '#ffb040');
  }
  return true;
}

// Ash lying over the floor: slowed in it, and your flame gutters.
function ashPatch(game, c, tiles, life) {
  addZone(game, {
    by: c, kind: 'ash', tiles: tiles.filter((q) => openFloor(game, q.x, q.z)), y: c.y, life, tick: 1, slow: true, color: [120, 114, 112], puff: ASHC,
    onTick: (g, z, inside) => {
      for (const e of inside) if (e === g.player) e.snuff?.(1.2);
    },
  });
}

// A bolt from `c` at `t` that glances off the glass in its way (turning
// toward `t`), `bends` times at most: its straight runs.
function bounceBolt(game, c, t, len, bends) {
  const out = [];
  let x = c.x;
  let z = c.z;
  let dx = Math.abs(t.x - c.x) >= Math.abs(t.z - c.z) ? Math.sign(t.x - c.x) : 0;
  let dz = dx ? 0 : Math.sign(t.z - c.z) || 1;
  let seg = { from: { x, z }, tiles: [] };
  for (let n = 0; n < len; n++) {
    const nx = x + dx;
    const nz = z + dz;
    const id = game.world.getBlock(nx, FY, nz);
    if (id === B.glass && bends > 0) {
      bends--;
      seg.to = { x, z };
      if (seg.tiles.length) out.push(seg);
      game.renderer.emit(x, FY + 1, z, { n: 8, color: ['#ffffff', '#c8b8f0'], up: 20, speed: 40, life: 0.4, glow: true });
      // (Turned toward you.)
      if (dx) {
        dx = 0;
        dz = Math.sign(t.z - z) || (Math.random() < 0.5 ? 1 : -1);
      } else {
        dz = 0;
        dx = Math.sign(t.x - x) || (Math.random() < 0.5 ? 1 : -1);
      }
      seg = { from: { x, z }, tiles: [] };
      continue;
    }
    const b = game.world.getBlock(nx, FY, nz);
    if (b !== B.air && b !== B.water && b !== B.lava && !(game.world.getBlock(nx, FY, nz) === B.fence)) break;
    x = nx;
    z = nz;
    seg.tiles.push({ x, z });
  }
  seg.to = { x, z };
  if (seg.tiles.length) out.push(seg);
  return out;
}

Object.assign(BRAINS, KHAROS_BRAINS);
Object.assign(BOSS_TITLES, KHAROS_TITLES);
